// ─────────────────────────────────────────────
// GlobeView — KAN-21
//
// Mapbox globe-projection view of every active, non-underground church
// in the network. Fetches via useChurchesGlobal (which calls the two
// SECURITY DEFINER RPCs landed in KAN-21 c.14803):
//   - get_churches_global → { id, lat, lng, rag_status } per dot.
//   - get_underground_count → integer for the "+N hidden" honor chip.
//
// Reusable: ChurchProfileBottomSheet ownership stays with the consumer
// (TheChurchScreen). This component fires `onChurchSelect(id)` on a
// non-cluster dot tap; the host opens the sheet. Globe never reads or
// renders any leader identity field — that's all inside the sheet
// (KAN-20, PR #87).
//
// Mechanics:
//   - @rnmapbox/maps v10. MapView projection="globe", <Atmosphere>
//     component drives sky + stars. Style URL: mapbox dark v11
//     (supports globe projection).
//   - Clustering via ShapeSource cluster=true; cluster tap →
//     getClusterExpansionZoom() → camera flyTo. Individual dot tap →
//     onChurchSelect(props.id).
//   - Own-church dot rendered larger and sky-blue via a dedicated
//     CircleLayer filtered on properties.isOwn (data join, not GPS —
//     dispatch invariant). Comment locked below.
//   - Auto-rotation: setInterval @ 30 fps advancing centerCoordinate
//     longitude by ~0.2°/tick (≈6°/s, matches the prototype). Pauses on
//     onRegionWillChange (user gesture), resumes 3.5s after onMapIdle
//     with a 600ms "Resuming" sky cue chip, per the canonical motion
//     contract. Programmatic camera moves are flagged so they don't self-
//     trigger the pause cycle.
//   - "Back to world view" pill appears when zoom > initial+0.5; tap
//     resets camera. "Regional view · Reset" pill replaces the percent
//     readout above zoom ≈ 5.
//   - No RAG pulse on the globe (AC #14, perf).
//   - No expo-blur — overlays are dim-only by convention.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox, {
  Atmosphere,
  Camera,
  CircleLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from '@rnmapbox/maps';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { useChurchesGlobal } from '../../hooks/useChurchesGlobal';
import { getCountryCentroid } from './countryCentroid';

// ─── Mapbox token (module-level) ─────────────────────────────────────
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const STYLE_URL = 'mapbox://styles/mapbox/dark-v11'; // globe-projection capable
const INITIAL_ZOOM = 3.2;                 // continental
const ROTATION_DEG_PER_TICK = 0.2;        // ≈6°/s @ 30 fps tick
const ROTATION_TICK_MS = 33;
const RESUME_DELAY_MS = 3500;             // dispatch: 3.5s stillness before resume
const CUE_MS = 600;                       // dispatch: "Resuming" cue duration
const ZOOMED_PILL_THRESHOLD = INITIAL_ZOOM + 0.5; // show "Back to world view"
const REGIONAL_ZOOM = 5.0;                // dispatch: regional view density threshold

// Watched invariant — own-church coords come from the registered church
// row, NEVER from expo-location / live GPS. The hook returns ownChurchId
// from public.users.church_id; the dot uses the registered lat/lng that
// arrives with the rest of the dataset.
const OWN_CHURCH_COORD_SOURCE = 'registered_church_lat_lng_NOT_live_gps' as const;

interface Props {
  /** Fires when the leader taps a non-cluster church dot. */
  onChurchSelect: (churchId: string) => void;
  /** Optional override for the initial camera (mostly for tests/storybook). */
  initialCenterOverride?: [number, number];
}

export default function GlobeView({ onChurchSelect, initialCenterOverride }: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const {
    dots,
    undergroundCount,
    ownChurchId,
    viewerCountry,
    loading,
    error,
    refetch,
  } = useChurchesGlobal();

  // ── Camera + rotation state ──
  const cameraRef = useRef<Camera>(null);
  const shapeRef = useRef<ShapeSource>(null);

  const initialCenter = useMemo<[number, number]>(
    () => initialCenterOverride ?? getCountryCentroid(viewerCountry),
    [initialCenterOverride, viewerCountry],
  );

  const currentLngRef = useRef(initialCenter[0]);
  const currentLatRef = useRef(initialCenter[1]);
  const isProgrammaticRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  // Whenever the viewer country resolves (post-hook-load), jump the
  // camera + reseat the rotation anchor so we don't start mid-Atlantic.
  useEffect(() => {
    if (!viewerCountry && !initialCenterOverride) return;
    const [lng, lat] = initialCenter;
    currentLngRef.current = lng;
    currentLatRef.current = lat;
    isProgrammaticRef.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: INITIAL_ZOOM,
      animationDuration: reduced ? 0 : 600,
      animationMode: 'flyTo',
    });
  }, [initialCenter, viewerCountry, initialCenterOverride, reduced]);

  // ── Rotation tick (active only while !paused && !resuming) ──
  useEffect(() => {
    if (paused || resuming || reduced) return;
    const iv = setInterval(() => {
      let nextLng = currentLngRef.current + ROTATION_DEG_PER_TICK;
      if (nextLng > 180) nextLng -= 360;
      if (nextLng < -180) nextLng += 360;
      currentLngRef.current = nextLng;
      isProgrammaticRef.current = true;
      cameraRef.current?.setCamera({
        centerCoordinate: [nextLng, currentLatRef.current],
        animationDuration: 0,
        animationMode: 'none',
      });
    }, ROTATION_TICK_MS);
    return () => clearInterval(iv);
  }, [paused, resuming, reduced]);

  const clearResumeCycle = useCallback(() => {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    if (cueTimerRef.current)    { clearTimeout(cueTimerRef.current);    cueTimerRef.current = null; }
  }, []);

  const scheduleResume = useCallback(() => {
    if (reduced) return; // reduced motion: leave paused, no auto-resume
    clearResumeCycle();
    resumeTimerRef.current = setTimeout(() => {
      setResuming(true);
      cueTimerRef.current = setTimeout(() => {
        setResuming(false);
        setPaused(false);
      }, CUE_MS);
    }, RESUME_DELAY_MS);
  }, [clearResumeCycle, reduced]);

  useEffect(() => () => clearResumeCycle(), [clearResumeCycle]);

  // ── Mapbox camera-change events ──
  // onRegionWillChange fires for both user gestures and programmatic
  // setCamera. The isProgrammaticRef flag-and-reset keeps our own
  // rotation ticks from self-triggering the pause cycle.
  const handleRegionWillChange = useCallback(() => {
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      return;
    }
    setPaused(true);
    clearResumeCycle();
  }, [clearResumeCycle]);

  // onMapIdle is v10's "camera has stopped moving" signal. We use it to
  // (a) capture the current zoom for the pills and (b) schedule the 3.5s
  // resume timer only when the user (not us) caused the move. Typed
  // loosely — MapState's `properties` shape is internal to @rnmapbox v10
  // and not exported as a public type; we read the two fields we need.
  const handleMapIdle = useCallback((state: unknown) => {
    const props = (state as { properties?: { zoom?: number; center?: [number, number] } } | null)?.properties;
    const z = props?.zoom;
    if (typeof z === 'number' && Number.isFinite(z)) setZoom(z);
    const center = props?.center;
    if (Array.isArray(center) && center.length === 2) {
      // Keep the rotation anchor in sync with where the user left the
      // map — resume continues from here, not from the country centroid.
      currentLngRef.current = center[0];
      currentLatRef.current = center[1];
    }
    if (paused) scheduleResume();
  }, [paused, scheduleResume]);

  // ── Reset / Back to world view ──
  const resetCamera = useCallback(() => {
    isProgrammaticRef.current = true;
    const [lng, lat] = initialCenter;
    currentLngRef.current = lng;
    currentLatRef.current = lat;
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: INITIAL_ZOOM,
      animationDuration: reduced ? 0 : 600,
      animationMode: 'flyTo',
    });
    setZoom(INITIAL_ZOOM);
    // Coming back to world view restarts the resume cycle so rotation
    // kicks in after the usual 3.5s — feels intentional, not abrupt.
    setPaused(true);
    scheduleResume();
  }, [initialCenter, reduced, scheduleResume]);

  // ── Shape source / GeoJSON ──
  const featureCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: dots.map((d) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
      properties: {
        id: d.id,
        rag_status: d.rag_status,
        // own-church flag — derived from the data join (registered
        // church id), never from device GPS. Filter target for the
        // sky-blue larger dot layer below.
        isOwn: ownChurchId !== null && d.id === ownChurchId,
      },
    })),
  }), [dots, ownChurchId]);

  // ── Source-press handler ──
  // Typed loosely — OnPressEvent from @rnmapbox v10 uses generic
  // GeoJSON.Feature[] for `features`; we only need props.cluster and
  // props.id (set in our FeatureCollection builder) + coordinates.
  const handleSourcePress = useCallback(async (e: unknown) => {
    const evt = e as { features?: Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: [number, number] } }> };
    const f = evt.features?.[0];
    if (!f) return;
    const props = (f.properties ?? {}) as { cluster?: boolean; cluster_id?: number; id?: string };
    if (props.cluster) {
      // Cluster tap — expand to a zoom where children separate.
      const coords = (f.geometry?.coordinates ?? null) as [number, number] | null;
      let nextZoom = Math.min(REGIONAL_ZOOM + 1, zoom + 2);
      try {
        // @ts-expect-error — getClusterExpansionZoom accepts the feature in v10.
        const z = await shapeRef.current?.getClusterExpansionZoom(f);
        if (typeof z === 'number') nextZoom = z;
      } catch {
        // Fall back to a conservative zoom-in if the call fails.
      }
      if (coords) {
        isProgrammaticRef.current = true;
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: nextZoom,
          animationDuration: reduced ? 0 : 600,
          animationMode: 'flyTo',
        });
      }
      return;
    }
    if (typeof props.id === 'string') onChurchSelect(props.id);
  }, [onChurchSelect, reduced, zoom]);

  // ── Pill visibility ──
  const showBackToWorld = zoom > ZOOMED_PILL_THRESHOLD;
  const isRegional = zoom >= REGIONAL_ZOOM;

  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        styleURL={STYLE_URL}
        projection="globe"
        attributionEnabled={false}
        logoEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        onRegionWillChange={handleRegionWillChange}
        onMapIdle={handleMapIdle}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: INITIAL_ZOOM,
          }}
        />

        <Atmosphere
          style={{
            color: 'rgba(20, 40, 80, 0.6)',
            highColor: 'rgba(40, 70, 130, 0.7)',
            horizonBlend: 0.05,
            spaceColor: '#020409',
            starIntensity: 0.55,
          }}
        />

        <ShapeSource
          id="churches-global"
          ref={shapeRef}
          shape={featureCollection}
          cluster
          clusterRadius={48}
          clusterMaxZoomLevel={6}
          clusterProperties={{
            // Preserve RAG counts on each cluster for MVP-2 colouring.
            green: ['+', ['case', ['==', ['get', 'rag_status'], 'green'], 1, 0]],
            amber: ['+', ['case', ['==', ['get', 'rag_status'], 'amber'], 1, 0]],
            red:   ['+', ['case', ['==', ['get', 'rag_status'], 'red'],   1, 0]],
          }}
          onPress={handleSourcePress}
        >
          <CircleLayer
            id="cluster-circles"
            filter={['has', 'point_count']}
            style={{
              circleColor: 'rgba(240, 237, 230, 0.18)',
              circleStrokeColor: 'rgba(107, 181, 232, 0.45)',
              circleStrokeWidth: 1,
              circleRadius: [
                'step', ['get', 'point_count'],
                14, 10,
                18, 50,
                22,
              ],
            }}
          />
          <SymbolLayer
            id="cluster-counts"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 12,
              textColor: Colors.text,
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />
          <CircleLayer
            id="own-church-dot"
            filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'isOwn'], true]]}
            style={{
              circleColor: Colors.accent,
              circleRadius: 7,
              circleStrokeColor: Colors.background,
              circleStrokeWidth: 2,
            }}
          />
          <CircleLayer
            id="rag-dots"
            filter={['all', ['!', ['has', 'point_count']], ['!=', ['get', 'isOwn'], true]]}
            style={{
              circleColor: [
                'match', ['get', 'rag_status'],
                'green', Colors.green,
                'amber', Colors.amber,
                'red',   Colors.red,
                Colors.textMuted,
              ],
              circleRadius: 5,
              circleStrokeColor: Colors.background,
              circleStrokeWidth: 1,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Loading / error overlays — dim-only */}
      {loading ? (
        <View style={[styles.overlay, styles.overlayLoading]}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : null}
      {error ? (
        <View style={[styles.overlay, styles.overlayError]}>
          <Text style={styles.errorText}>Couldn't load the global map right now.</Text>
          <Pressable onPress={refetch} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Top-left: "Back to world view" pill (when zoomed in) */}
      {showBackToWorld ? (
        <Pressable
          onPress={resetCamera}
          accessibilityRole="button"
          accessibilityLabel="Back to world view"
          style={[styles.backPill, { top: insets.top + 12 }]}
        >
          <Text style={styles.backPillText}>← Back to world view</Text>
        </Pressable>
      ) : null}

      {/* Top-right: zoom % readout OR "Regional view · Reset" pill */}
      {zoom > INITIAL_ZOOM + 0.15 ? (
        <View style={[styles.zoomPill, { top: insets.top + 12 }]}>
          {isRegional ? (
            <>
              <Text style={styles.zoomPillText}>Regional view</Text>
              <Pressable onPress={resetCamera} hitSlop={6} accessibilityRole="button">
                <Text style={styles.zoomPillReset}>· Reset</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.zoomPillText}>{Math.round((zoom / INITIAL_ZOOM) * 100)}%</Text>
          )}
        </View>
      ) : null}

      {/* "Resuming" cue — sky-tinted, bottom-centre */}
      {resuming ? (
        <View style={[styles.resumeCue, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.resumeCueText}>↻  Resuming</Text>
        </View>
      ) : null}

      {/* "+N hidden" honor chip — bottom-right */}
      {undergroundCount > 0 ? (
        <View style={[styles.hiddenChip, { bottom: insets.bottom + 16 }]} pointerEvents="none">
          <Text style={styles.hiddenChipText}>+{undergroundCount} hidden</Text>
        </View>
      ) : null}
    </View>
  );
}

// Re-export the invariant token so a grep for it surfaces the comment.
export { OWN_CHURCH_COORD_SOURCE };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },

  // Overlays — dim-only (no expo-blur)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 8, 8, 0.55)',
    gap: 12,
  },
  overlayLoading: {},
  overlayError: { paddingHorizontal: 24 },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },

  // Top-left pill
  backPill: {
    position: 'absolute',
    left: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
  },
  backPillText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.accent, letterSpacing: 0.2 },

  // Top-right pill (zoom % / Regional view)
  zoomPill: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  zoomPillText: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1, color: Colors.textMuted },
  zoomPillReset: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1, color: Colors.accent },

  // Bottom-centre resume cue
  resumeCue: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 181, 232, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
  },
  resumeCueText: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.accent, letterSpacing: 0.4 },

  // Bottom-right hidden-count honor chip
  hiddenChip: {
    position: 'absolute',
    right: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
  },
  hiddenChipText: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.2, color: Colors.accent },
});
