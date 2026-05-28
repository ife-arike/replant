// ─────────────────────────────────────────────
// CamlView — KAN-18 + KAN-19
//
// "Church At My Location" — Mapbox flat dark map centred on the
// leader's GPS, surrounded by RAG-coloured dots and (under a pull-up
// sheet) a distance-sorted list of nearby churches. Caller-verification
// masking is server-enforced (KAN-19): unverified leaders see the
// church type label only, never the name or the leaders array.
//
// Data: get-nearby-churches edge function (POST { lat, lng }). The
// function decides the radius (50 → 100 if <3); the FE consumes
// `expanded` + `radius_km` for the meta line.
//
// Location: @rnmapbox/maps' LocationManager only — no expo-location.
// The dispatch explicitly forbids the expo-location dep; LocationManager
// also keeps Mapbox's permission UX consistent with the rest of the app.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Linking, PanResponder,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox, {
  Camera,
  CircleLayer,
  MapView,
  MarkerView,
  ShapeSource,
  SymbolLayer,
  locationManager,
} from '@rnmapbox/maps';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../lib/supabase';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { getChurchTypeLabel } from '../../utils/displayHelpers';

const STYLE_URL = 'mapbox://styles/mapbox/dark-v11';
const INITIAL_ZOOM = 13;
const SHEET_HEIGHT_RATIO = 0.78;
const SHEET_PEEK_PX = 140;        // visible above the bottom when peeked
const ANIM_MS = 280;

type Rag = 'green' | 'amber' | 'red';

interface Leader {
  role: string;
  first_name: string | null;
  last_name:  string | null;
  anon:       boolean;
}

interface NearbyChurch {
  id:           string;
  name?:        string;   // omitted when caller_verified=false
  type:         string;
  city:         string | null;
  country:      string | null;
  lat:          number;
  lng:          number;
  rag_status:   string;
  distance_km:  number;
  leaders:      Leader[];
  is_own:       boolean;
}

interface NearbyResponse {
  churches:        NearbyChurch[];
  expanded:        boolean;
  radius_km:       number;
  caller_verified: boolean;
}

interface CamlViewProps {
  isActive: boolean;
  ownChurchId: string | null;       // kept for parity though server flags is_own
  viewerVerified: boolean;
  onChurchSelect: (churchId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function ragColor(r: string | null | undefined): string {
  if (r === 'green') return Colors.green;
  if (r === 'amber') return Colors.amber;
  if (r === 'red')   return Colors.red;
  return Colors.textMuted;
}

// Haversine — used for the camera/home distance hint pill only.
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number, unit: 'mi' | 'km'): string {
  if (unit === 'mi') {
    const mi = km * 0.621371;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function leaderLineText(leaders: Leader[]): string {
  if (!leaders.length) return '';
  return leaders.slice(0, 2).map((l) => {
    const roleLabel = l.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (l.anon) return `${roleLabel} · Hidden`;
    const last = l.last_name?.trim();
    return last ? `${roleLabel} ${last}` : roleLabel;
  }).join(' · ');
}

// ─── Component ───────────────────────────────────────────────────────

export default function CamlView({
  isActive, ownChurchId, viewerVerified, onChurchSelect,
}: CamlViewProps) {
  // ownChurchId is part of the dispatched contract for symmetry with the
  // CAL surface, but on CAML the server is authoritative — `is_own` is
  // already set per row inside get-nearby-churches. The prop stays
  // accepted (parity + future fallback) but unused.
  void ownChurchId;

  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const cameraRef = useRef<Camera>(null);

  const [viewerCoord, setViewerCoord] = useState<[number, number] | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [cameraCenter, setCameraCenter] = useState<[number, number] | null>(null);

  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ragFilter, setRagFilter] = useState<Record<Rag, boolean>>({ green: true, amber: true, red: true });

  // ── Location: LocationManager (no expo-location) ──
  useEffect(() => {
    let cancelled = false;
    // Hoisted listener ref so the cleanup closure can pass it to
    // removeListener (Mapbox's API requires the function reference;
    // there is no no-arg removeAll). Parameters<> derives the type
    // without adding a new @rnmapbox/maps import.
    let listener: Parameters<typeof locationManager.addListener>[0] | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      try {
        await locationManager.start();

        // 12s safety net: if no valid fix arrives in time, flip to the
        // location-denied UI so the leader has a clear action path
        // instead of an infinite spinner. Covers the case where
        // getLastKnownLocation resolves with NaN coords AND no live fix
        // ever follows (sim-without-location, hard-denied permission).
        timeoutId = setTimeout(() => {
          if (!cancelled) setLocationDenied(true);
        }, 12_000);

        const last = await locationManager.getLastKnownLocation();
        if (!cancelled && last?.coords) {
          // Coordinate guard (2026-05-28): getLastKnownLocation can
          // return a coords object whose .longitude / .latitude are
          // undefined or NaN in certain GPS states (cold-cache, denied-
          // but-cached, sim-without-location). camlReady = !!viewerCoord
          // only tests array existence; without this guard Mapbox
          // throws "coordinates must contain numbers".
          const lng = last.coords.longitude;
          const lat = last.coords.latitude;
          if (typeof lng === 'number' && !isNaN(lng) && typeof lat === 'number' && !isNaN(lat)) {
            setViewerCoord([lng, lat]);
            if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          }
        }

        // Always register the listener — primary path when the cache
        // returned nothing, live-update path after a cache hit. Critical
        // recovery path when the guard above rejected a NaN cached
        // coord: without this listener registered unconditionally, the
        // map would never get a real fix.
        listener = (loc) => {
          if (cancelled) return;
          if (loc?.coords) {
            const lng = loc.coords.longitude;
            const lat = loc.coords.latitude;
            if (typeof lng === 'number' && !isNaN(lng) && typeof lat === 'number' && !isNaN(lat)) {
              setViewerCoord([lng, lat]);
              if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
            }
          }
        };
        locationManager.addListener(listener);
      } catch {
        if (!cancelled) setLocationDenied(true);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (listener) locationManager.removeListener(listener);
    };
  }, []);

  // ── Fetch nearby on first location fix + when isActive becomes true ──
  const fetchNearby = useCallback(async (coord: [number, number]) => {
    setLoading(true);
    setError(null);
    try {
      const token = session?.access_token;
      if (!token) { setError('not_authenticated'); setLoading(false); return; }
      const { data: resp, error: fnErr } = await supabase.functions.invoke<NearbyResponse>(
        'get-nearby-churches',
        { body: { lat: coord[1], lng: coord[0] } },
      );
      if (fnErr || !resp) {
        setError(fnErr?.message ?? 'unknown_error');
        setLoading(false);
        return;
      }
      setData(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isActive || !viewerCoord) return;
    void fetchNearby(viewerCoord);
  }, [isActive, viewerCoord, fetchNearby]);

  // ── Distance unit detection: US → mi, else km. Read viewer country
  // from the most recent fetched row that includes country (server
  // returns country on every row).
  const unit: 'mi' | 'km' = useMemo(() => {
    const sample = data?.churches.find((c) => !!c.country);
    return sample?.country === 'United States' ? 'mi' : 'km';
  }, [data]);

  // ── Camera distance from home (drives the pan-hint pill) ──
  const distanceFromHomeKm = useMemo(() => {
    if (!viewerCoord || !cameraCenter) return 0;
    return haversineKm(viewerCoord, cameraCenter);
  }, [viewerCoord, cameraCenter]);

  // ── Filtered GeoJSON ──
  const churches = data?.churches ?? [];
  const ownChurch = useMemo(() => churches.find((c) => c.is_own), [churches]);
  const nearbyFeatureCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: churches
      .filter((c) => !c.is_own)
      .filter((c) => ragFilter[c.rag_status as Rag] !== false)
      .map((c) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { id: c.id, rag_status: c.rag_status },
      })),
  }), [churches, ragFilter]);

  const visibleListRows = useMemo(
    () => churches.filter((c) => ragFilter[c.rag_status as Rag] !== false),
    [churches, ragFilter],
  );

  // ── Sheet: peek ↔ open ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current; // delta from open position
  // We'll measure container height and compute peek vs open dynamically (parent-relative, same fix as KAN-22 pull-up).
  const [containerH, setContainerH] = useState(0);
  const containerHRef = useRef(0);
  const dragStartY = useRef(0);
  const sheetH = containerH > 0 ? Math.round(containerH * SHEET_HEIGHT_RATIO) : 0;

  const openY  = 0;                                 // sheet fully visible
  const peekY  = Math.max(0, sheetH - SHEET_PEEK_PX); // only PEEK_PX visible at the top
  const yFor   = (open: boolean) => (open ? openY : peekY);

  useEffect(() => {
    containerHRef.current = containerH;
    if (containerH > 0) translateY.setValue(yFor(sheetOpen));
  }, [containerH, sheetOpen, translateY]);

  const snapTo = useCallback((open: boolean) => {
    setSheetOpen(open);
    const target = yFor(open);
    if (reduced) translateY.setValue(target);
    else Animated.timing(translateY, {
      toValue: target,
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        dragStartY.current = yFor(sheetOpen);
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const h = containerHRef.current;
        if (h <= 0) return;
        const min = 0;
        const max = Math.max(0, Math.round(h * SHEET_HEIGHT_RATIO) - SHEET_PEEK_PX);
        translateY.setValue(Math.min(max, Math.max(min, dragStartY.current + g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const wasOpen = dragStartY.current === 0;
        // If dragged > 60pt away from start, snap toward the other state.
        if (g.dy > 60 && wasOpen) snapTo(false);
        else if (g.dy < -60 && !wasOpen) snapTo(true);
        else snapTo(wasOpen);
      },
    }),
  ).current;

  // ── Recenter ──
  const recenter = useCallback(() => {
    if (!viewerCoord) return;
    cameraRef.current?.setCamera({
      centerCoordinate: viewerCoord,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: reduced ? 0 : 400,
      animationMode: 'easeTo',
    });
  }, [viewerCoord, reduced]);

  // ── Location-denied empty state ──
  if (locationDenied) {
    return (
      <View style={[styles.root, styles.denied]}>
        <Text style={styles.deniedEyebrow}>LOCATION REQUIRED</Text>
        <Text style={styles.deniedTitle}>Enable location to see nearby churches.</Text>
        <Text style={styles.deniedBody}>
          Replant uses your location to show verified churches within 50km of you.
          Your position is never shared.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          style={styles.deniedBtn}
        >
          <Text style={styles.deniedBtnText}>OPEN SETTINGS</Text>
        </Pressable>
      </View>
    );
  }

  const camlReady = !!viewerCoord;
  const showEmpty = camlReady && data !== null && data.caller_verified && data.churches.length === 0;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - containerH) > 1) setContainerH(h);
      }}
    >
      {camlReady ? (
        <MapView
          style={styles.map}
          styleURL={STYLE_URL}
          attributionEnabled={false}
          logoEnabled={false}
          scaleBarEnabled={false}
          compassEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onCameraChanged={(state: unknown) => {
            const c = (state as { properties?: { center?: [number, number] } } | null)?.properties?.center;
            if (Array.isArray(c) && c.length === 2) setCameraCenter(c);
          }}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: viewerCoord, zoomLevel: INITIAL_ZOOM }}
          />

          {/* Nearby churches — clustered */}
          <ShapeSource
            id="caml-nearby"
            shape={nearbyFeatureCollection}
            cluster
            clusterRadius={40}
            clusterMaxZoomLevel={14}
            onPress={(e: unknown) => {
              const f = (e as { features?: Array<{ properties?: Record<string, unknown> }> }).features?.[0];
              if (!f) return;
              const props = (f.properties ?? {}) as { cluster?: boolean; id?: string };
              if (!props.cluster && typeof props.id === 'string') onChurchSelect(props.id);
            }}
          >
            <CircleLayer
              id="caml-cluster-circles"
              filter={['has', 'point_count']}
              style={{
                circleRadius: 15,
                circleColor: 'rgba(18,18,20,0.92)',
                circleStrokeWidth: 1,
                circleStrokeColor: 'rgba(107,181,232,0.35)',
              }}
            />
            <SymbolLayer
              id="caml-cluster-counts"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count'],
                textSize: 11,
                textColor: Colors.accent,
                textIgnorePlacement: true,
                textAllowOverlap: true,
              }}
            />
            <CircleLayer
              id="caml-nearby-dots"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleRadius: 8,
                circleColor: [
                  'match', ['get', 'rag_status'],
                  'green', Colors.green,
                  'amber', Colors.amber,
                  'red',   Colors.red,
                  Colors.textMuted,
                ],
                circleStrokeWidth: 2,
                circleStrokeColor: 'rgba(8,8,8,0.92)',
              }}
            />
          </ShapeSource>

          {/* Own church MarkerView (sky pin + halo + YOUR CHURCH label) */}
          {ownChurch ? (
            <MarkerView coordinate={[ownChurch.lng, ownChurch.lat]} anchor={{ x: 0.5, y: 0.5 }}>
              <Pressable
                onPress={() => onChurchSelect(ownChurch.id)}
                accessibilityRole="button"
                accessibilityLabel="Your church"
              >
                <View style={styles.ownHaloOuter} pointerEvents="none" />
                <View style={styles.ownHalo} pointerEvents="none" />
                <View style={styles.ownCore}>
                  <View style={styles.ownDot} />
                </View>
                <View style={styles.ownLabel} pointerEvents="none">
                  <Text style={styles.ownLabelText}>YOUR CHURCH</Text>
                </View>
              </Pressable>
            </MarkerView>
          ) : null}
        </MapView>
      ) : (
        <View style={[styles.map, styles.mapLoading]}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      )}

      {/* Filter chips */}
      {camlReady ? (
        <View style={[styles.filterRow, { top: insets.top + 14 }]} pointerEvents="box-none">
          <View style={styles.filterGroup}>
            {(['green','amber','red'] as Rag[]).map((k) => {
              const on = ragFilter[k];
              const label = k === 'green' ? 'FREE' : k === 'amber' ? 'LIMITS' : 'URGENT';
              return (
                <Pressable
                  key={k}
                  onPress={() => setRagFilter((prev) => ({ ...prev, [k]: !prev[k] }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <View style={[styles.chipDot, { backgroundColor: ragColor(k) }]} />
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={recenter}
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location"
            style={[styles.chip, styles.chipActive]}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>⊙ MY LOCATION</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Pan distance hint */}
      {camlReady ? (
        <View
          style={[
            styles.panHint,
            { bottom: (containerH > 0 ? Math.round(containerH * SHEET_HEIGHT_RATIO) - SHEET_PEEK_PX : 0) + 16 },
            distanceFromHomeKm < 0.5 && styles.panHintResting,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.panHintText}>
            {distanceFromHomeKm < 0.5
              ? 'DRAG TO EXPLORE'
              : `${formatDistance(distanceFromHomeKm, unit).toUpperCase()} FROM HOME`}
          </Text>
        </View>
      ) : null}

      {/* CAML sheet — peek ↔ open */}
      {camlReady && sheetH > 0 ? (
        <Animated.View
          style={[styles.sheet, { height: sheetH, transform: [{ translateY }] }]}
        >
          <View {...panResponder.panHandlers}>
            <Pressable onPress={() => snapTo(!sheetOpen)} accessibilityRole="button">
              <View style={styles.sheetGrip} />
              <Text style={styles.sheetMeta}>
                {loading
                  ? 'LOADING…'
                  : error
                    ? "COULDN'T LOAD"
                    : data === null
                      ? 'NEARBY · LOADING'
                      : data.churches.length === 0
                        ? 'NO CHURCHES NEARBY'
                        : data.expanded
                          ? `SHOWING CHURCHES WITHIN 100 KM · ${data.churches.length} FOUND`
                          : `${data.churches.length} CHURCHES NEAR YOU · SORTED BY DISTANCE`}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: 4, paddingHorizontal: 16 }}
          >
            {showEmpty ? (
              <View style={styles.emptyPastoral}>
                <View style={styles.emptyRing} />
                <Text style={styles.emptyTitle}>You may be the first here.</Text>
                <Text style={styles.emptyBody}>
                  No other verified churches have joined Replant in your area yet.
                  Others will come. Hold this ground. We will let you know the moment
                  another leader is verified nearby.
                </Text>
                <View style={styles.scriptureBox}>
                  <Text style={styles.scriptureText}>
                    "Where two or three are gathered in My name, there am I in the midst of them."
                  </Text>
                  <Text style={styles.scriptureRef}>MATTHEW 18:20</Text>
                </View>
              </View>
            ) : null}

            {visibleListRows.map((c) => (
              <CamlListRow
                key={c.id}
                church={c}
                unit={unit}
                onPress={() => {
                  if (!viewerVerified && !c.name) {
                    // Masked row tap — surface verify message; do not open sheet.
                    // (UI-only — toast handled by host if needed.)
                    return;
                  }
                  onChurchSelect(c.id);
                }}
                viewerVerified={viewerVerified}
              />
            ))}

            {/* Underground honor note */}
            <View style={styles.undergroundNote}>
              <Text style={styles.undergroundEyebrow}>UNDERGROUND · NOT PICTURED</Text>
              <Text style={styles.undergroundBody}>
                Some churches gather in places we cannot show on a map.{'\n'}
                You are part of their covering.
              </Text>
              {/* TODO(DBA): live underground count by region */}
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── List row ────────────────────────────────────────────────────────

function CamlListRow({ church, unit, onPress, viewerVerified }: {
  church: NearbyChurch;
  unit: 'mi' | 'km';
  onPress: () => void;
  viewerVerified: boolean;
}) {
  const typeLabel = getChurchTypeLabel(church.type);
  const masked = !viewerVerified && !church.name;
  return (
    <Pressable onPress={onPress} style={styles.listRow} accessibilityRole="button">
      <View style={[styles.listDot, { backgroundColor: ragColor(church.rag_status) }]} />
      <View style={styles.listBody}>
        <Text style={styles.listName} numberOfLines={1}>
          {masked ? typeLabel : (church.name ?? typeLabel)}
        </Text>
        {masked ? (
          <Text style={styles.listMaskedHint}>VERIFY TO VIEW DETAILS</Text>
        ) : (
          <>
            <Text style={styles.listLeader} numberOfLines={1}>
              {leaderLineText(church.leaders)}
            </Text>
            <Text style={styles.listType}>{typeLabel}</Text>
          </>
        )}
      </View>
      <Text style={styles.listDist}>{formatDistance(church.distance_km, unit)}</Text>
    </Pressable>
  );
}

// ─── Mapbox token (module-level — already set by GlobeView, but safe
// to re-call). Reading EXPO_PUBLIC_MAPBOX_TOKEN at build time. ──
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
if (MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN);

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },

  // Filter chips
  filterRow: {
    position: 'absolute',
    left: 14, right: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    zIndex: 5,
  },
  filterGroup: { flexDirection: 'row', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: 'rgba(8,8,8,0.70)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: 100,
  },
  chipActive: {
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderColor: Colors.borderAccent,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.19, // 0.14em × 8.5
    color: Colors.textMuted, textTransform: 'uppercase',
  },
  chipTextActive: { color: Colors.text },

  // Pan distance hint pill
  panHint: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: 'rgba(8,8,8,0.75)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: 100,
    zIndex: 4,
    opacity: 0.7,
  },
  panHintResting: { opacity: 0.45 },
  panHintText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    color: Colors.textMuted,
  },

  // Own-church MarkerView
  ownHaloOuter: {
    position: 'absolute',
    width: 64, height: 64, borderRadius: 32,
    left: -24, top: -24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107,181,232,0.16)',
  },
  ownHalo: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    left: -14, top: -14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107,181,232,0.35)',
  },
  ownCore: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.6, shadowRadius: 18,
  },
  ownDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  ownLabel: {
    position: 'absolute',
    top: 28, left: '50%',
    paddingVertical: 2, paddingHorizontal: 7,
    backgroundColor: 'rgba(8,8,8,0.70)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 100,
    transform: [{ translateX: -38 }],
  },
  ownLabelText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53,
    color: Colors.accent,
  },

  // Sheet
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(107,181,232,0.35)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 50,
    shadowOffset: { width: 0, height: -16 },
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 38, height: 4, borderRadius: 100,
    backgroundColor: 'rgba(240,237,230,0.12)',
    marginTop: 8, marginBottom: 5,
  },
  sheetMeta: {
    textAlign: 'center',
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    color: Colors.textMuted,
    paddingBottom: 8,
  },
  sheetBody: { flex: 1, paddingTop: 4 },

  // List row
  listRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  listDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  listBody: { flex: 1, minWidth: 0 },
  listName: { fontFamily: Typography.displayRegular, fontSize: 17, color: Colors.text },
  listLeader: { marginTop: 3, fontFamily: Typography.body, fontSize: 11.5, color: Colors.textMuted },
  listType: {
    marginTop: 5,
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    color: Colors.textMuted, textTransform: 'uppercase',
  },
  listMaskedHint: {
    marginTop: 4,
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53, color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  listDist: {
    marginTop: 6,
    fontFamily: Typography.mono, fontSize: 10,
    letterSpacing: 0.8, color: Colors.textMuted,
  },

  // Empty pastoral
  emptyPastoral: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, gap: 10 },
  emptyRing: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.35)',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular, fontSize: 21,
    color: Colors.text, textAlign: 'center', marginTop: 4,
  },
  emptyBody: {
    fontFamily: Typography.body, fontSize: 12.5,
    lineHeight: 21, color: Colors.textMuted,
    textAlign: 'center', maxWidth: 270,
  },
  scriptureBox: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: 'rgba(107,181,232,0.06)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 8,
  },
  scriptureText: {
    fontFamily: Typography.scriptureItalic, fontSize: 13.5,
    lineHeight: 20, color: Colors.text, textAlign: 'center',
  },
  scriptureRef: {
    marginTop: 8,
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.98, // 0.22em × 9
    color: Colors.accent, textAlign: 'center',
  },

  // Underground note
  undergroundNote: {
    marginTop: 8, marginBottom: 16,
    padding: 14,
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.20)',
    borderRadius: 8,
  },
  undergroundEyebrow: {
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.98, color: Colors.accent,
    textTransform: 'uppercase', marginBottom: 6,
  },
  undergroundBody: {
    fontFamily: Typography.body, fontSize: 12,
    lineHeight: 20, color: Colors.textMuted,
  },

  // Location-denied
  denied: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  deniedEyebrow: {
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.98, color: Colors.accent,
  },
  deniedTitle: {
    fontFamily: Typography.displayRegular, fontSize: 22,
    color: Colors.text, textAlign: 'center', marginTop: 8,
  },
  deniedBody: {
    fontFamily: Typography.body, fontSize: 13, lineHeight: 19,
    color: Colors.textMuted, textAlign: 'center', maxWidth: 290,
  },
  deniedBtn: {
    marginTop: 16, paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: 6, backgroundColor: Colors.accent,
  },
  deniedBtnText: {
    fontFamily: Typography.bodyMedium, fontSize: 11,
    letterSpacing: 1.32, color: Colors.background,
    textTransform: 'uppercase',
  },
});
