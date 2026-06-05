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
  Animated, AppState, Easing, Linking, PanResponder,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
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
import { getChurchTypeLabel, PRAYER_WALL_ROLE_LABELS } from '../../utils/displayHelpers';

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
  network_id?:  string | null; // KAN-18 R2 — RPL identifier; public, never masked
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
  // Fix 6 — once data lands, CAML reports the resolved area city so the
  // host header can render "The Church at <city>" dynamically. Prefer
  // the nearest non-own church (it represents the surrounding area);
  // fall back to whatever is first if no other church exists.
  onCityResolved?: (city: string) => void;
  // KAN-18 R3 — total verified leaders within the API radius (sum of
  // c.leaders.length across the response). Fires once per fetch.
  // Masked rows contribute 0 — that's the truth the unverified caller
  // sees today, and the only thing the host can faithfully render.
  onLeaderCountResolved?: (count: number) => void;
  // Post-completion refetch — TheChurchScreen bumps this after the leader
  // finishes the Church Profile Setup Flow so CAML re-runs its internal
  // get-nearby-churches fetch and the leader's own church appears in the
  // list + on the map without navigating away. Starts at 0 (no fetch on
  // mount — the mount-fetch effect already handles first load); any
  // value > 0 triggers a re-fetch.
  refreshTrigger?: number;
  // Tutorial pan — TheChurchScreen bumps this when the Church tab tutorial
  // enters step 2 ("Your church is here") so the camera flies to the
  // registered church dot. Same counter pattern as refreshTrigger; 0 is
  // ignored (no pan on mount). If ownChurch is not yet loaded when the
  // trigger fires, the effect re-runs once it lands.
  panToChurchTrigger?: number;
  /** Tutorial GPS recenter — bump to snap camera back to the leader's
      physical location after the church-location pan in step 2. */
  recenterToGPSTrigger?: number;
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

// Fix 3 — role label sourced from the canonical map (Prayer Wall taxonomy)
// with the same "Minister" fallback prayer-wall uses for unknown roles.
// Name token is the first_name (matches CD caml.jsx leader line and the
// pastoral register; surname-only read cold without context).
function leaderLineText(leaders: Leader[]): string {
  if (!leaders.length) return '';
  return leaders.slice(0, 2).map((l) => {
    const roleLabel = PRAYER_WALL_ROLE_LABELS[l.role as keyof typeof PRAYER_WALL_ROLE_LABELS] ?? 'Minister';
    if (l.anon) return `A fellow ${roleLabel}`;
    const first = l.first_name?.trim();
    return first ? `${roleLabel} ${first}` : roleLabel;
  }).join(' · ');
}

// Fix 6 (KAN-18) — Mapbox places reverse-geocode for the header city.
// We use the actual user GPS rather than the nearest-church-city proxy
// so the header tells the truth even when the leader is in an area with
// no Replant churches yet. ?types=place restricts to the locality tier
// (city/town/village) — what the leader expects to read in the header.
// Silent on any failure (network, 4xx/5xx, malformed body); the caller
// just keeps showing the fallback.
async function resolveCity(lng: number, lat: number, token: string): Promise<string | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json() as { features?: Array<{ text?: string }> };
    return json.features?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────

export default function CamlView({
  isActive, ownChurchId, viewerVerified, onChurchSelect, onCityResolved, onLeaderCountResolved,
  refreshTrigger = 0, panToChurchTrigger = 0, recenterToGPSTrigger = 0,
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

  // YOUR CHURCH pulsing rings — two sonar/GPS-ping rings radiating out
  // from the own-church dot. Created via useRef so the Animated.Values
  // survive re-renders (a new Animated.Value() in the body each render
  // would reset the running loop). Ring 2 is phase-offset by 900ms so
  // the two rings never overlap exactly. Driven by the effect below;
  // skipped entirely under useReducedMotion (static halo shown instead).
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.65)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.65)).current;
  const emptyRing1Opacity = useRef(new Animated.Value(0)).current;
  const emptyRing1Scale   = useRef(new Animated.Value(1)).current;
  const emptyRing2Opacity = useRef(new Animated.Value(0)).current;
  const emptyRing2Scale   = useRef(new Animated.Value(1)).current;

  const [viewerCoord, setViewerCoord] = useState<[number, number] | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [cameraCenter, setCameraCenter] = useState<[number, number] | null>(null);

  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ragFilter, setRagFilter] = useState<Record<Rag, boolean>>({ green: true, amber: true, red: true });

  // Fix 6 — reverse-geocode the leader's GPS into a place name and
  // hand it to the host so the header reads "The Church at <city>".
  // hasCityRef gates this to a single call per mount — viewerCoord
  // updates on every GPS fix and we don't want to hammer Mapbox.
  const hasCityRef = useRef(false);
  useEffect(() => {
    if (!viewerCoord || hasCityRef.current) return;
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
    if (!token) return;
    hasCityRef.current = true;
    void resolveCity(viewerCoord[0], viewerCoord[1], token).then((city) => {
      if (city) onCityResolved?.(city);
    });
  }, [viewerCoord, onCityResolved]);

  // Fix 2 — DRAG TO EXPLORE hint fades on the leader's first gesture
  // (sheet pull, or map pan that crosses 0.5 km from home) and never
  // returns. hasDraggedRef mirrors the state so the PanResponder
  // closure (captured once in useRef) reads the current value without
  // stale-closure bugs. Hoisted above distanceFromHomeKm so the map-pan
  // trigger effect below can reference markDragged safely.
  const [hasDragged, setHasDragged] = useState(false);
  const hasDraggedRef = useRef(false);
  const markDragged = useCallback(() => {
    if (hasDraggedRef.current) return;
    hasDraggedRef.current = true;
    setHasDragged(true);
  }, []);
  const dragHintOpacity = useRef(new Animated.Value(1)).current;
  const [dragHintMounted, setDragHintMounted] = useState(true);
  useEffect(() => {
    if (!hasDragged || !dragHintMounted) return;
    Animated.timing(dragHintOpacity, {
      toValue: 0, duration: 400, useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setDragHintMounted(false); });
  }, [hasDragged, dragHintMounted, dragHintOpacity]);

  // YOUR CHURCH pulsing rings — two looped scale-up + fade-out animations
  // (sonar/GPS ping). Each ring scales 1 → 2.2 while opacity falls
  // 0.65 → 0 over ~2000ms, then resets and loops. Ring 2 starts 900ms
  // late so the pair stay phase-offset. Skipped under reduced motion —
  // the static halo Views render instead (see the MarkerView branch).
  useEffect(() => {
    if (reduced) return;

    const makeLoop = (scale: Animated.Value, opacity: Animated.Value) =>
      Animated.loop(
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );

    const loop1 = makeLoop(ring1Scale, ring1Opacity);
    const loop2 = makeLoop(ring2Scale, ring2Opacity);

    // A loop restarts its child from the CHILD's defined fromValue, but
    // Animated.timing has no fromValue — it animates from the value's
    // current state. After the first cycle the values sit at 2.2 / 0, so
    // each loop iteration must reset them first. resetAndStart seeds the
    // start state, then runs the loop.
    const startLoop = (
      loop: Animated.CompositeAnimation,
      scale: Animated.Value,
      opacity: Animated.Value,
    ) => {
      scale.setValue(1);
      opacity.setValue(0.65);
      loop.start();
    };

    startLoop(loop1, ring1Scale, ring1Opacity);
    const ring2TimeoutId = setTimeout(() => {
      startLoop(loop2, ring2Scale, ring2Opacity);
    }, 900);

    return () => {
      clearTimeout(ring2TimeoutId);
      loop1.stop();
      loop2.stop();
    };
  }, [reduced, ring1Scale, ring1Opacity, ring2Scale, ring2Opacity]);

  // showEmpty hoisted above the empty-ring pulse effect so the effect's
  // deps array can reference it without a temporal-dead-zone error (the
  // render-body declaration lives further down, after the locationDenied
  // early-return, and would not yet be initialized when this deps array
  // evaluates). The render body reuses this same const. Depends only on
  // viewerCoord + data, both declared above.
  const showEmpty = !!viewerCoord && data !== null && data.caller_verified &&
    data.churches.filter((c) => !c.is_own).length === 0;

  useEffect(() => {
    if (reduced || !showEmpty) return;

    const makePulse = (opRef: Animated.Value, scaleRef: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          // Instant reset to start position — fixes loop not resetting Animated.Value between iterations
          Animated.parallel([
            Animated.timing(opRef,    { toValue: 1,   duration: 0, useNativeDriver: true }),
            Animated.timing(scaleRef, { toValue: 0.2, duration: 0, useNativeDriver: true }),
          ]),
          // Animate outward
          Animated.parallel([
            Animated.timing(opRef,    { toValue: 0,   duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scaleRef, { toValue: 2.4, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          // Pause before next pulse
          Animated.delay(2000),
        ]),
      );

    emptyRing1Opacity.setValue(1);
    emptyRing1Scale.setValue(0.2);
    emptyRing2Opacity.setValue(0);
    emptyRing2Scale.setValue(0.2);

    const a1 = makePulse(emptyRing1Opacity, emptyRing1Scale);
    let a2: Animated.CompositeAnimation | null = null;
    a1.start();

    // Ring 2 starts when ring 1 finishes its first pulse — clean alternating signal
    const timer = setTimeout(() => {
      emptyRing2Opacity.setValue(1);
      emptyRing2Scale.setValue(0.2);
      a2 = makePulse(emptyRing2Opacity, emptyRing2Scale);
      a2.start();
    }, 2000);

    return () => {
      clearTimeout(timer);
      a1.stop();
      a2?.stop();
      emptyRing1Opacity.setValue(0);
      emptyRing1Scale.setValue(0.2);
      emptyRing2Opacity.setValue(0);
      emptyRing2Scale.setValue(0.2);
    };
  }, [reduced, showEmpty, emptyRing1Opacity, emptyRing1Scale, emptyRing2Opacity, emptyRing2Scale]);

  // Bumps re-run the location useEffect after the leader returns from
  // Settings with a fresh permission grant. Without this, locationDenied
  // stays true and the map never recovers without a full app restart.
  const [locationRetry, setLocationRetry] = useState(0);

  // AppState 'active' return — if we previously flipped to the denied
  // UI, give the leader a fresh attempt now that they're back from
  // (probably) toggling permission in Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && locationDenied) {
        setLocationDenied(false);
        setLocationRetry((r) => r + 1);
      }
    });
    return () => sub.remove();
  }, [locationDenied]);

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
    // locationRetry bumps re-run this effect after the leader grants
    // permission in Settings and returns to the app.
  }, [locationRetry]);

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
      // Fix 6 (2026-05-28 revision) — city resolution moved off the
      // nearest-church proxy. The actual GPS coordinate is reverse-
      // geocoded via Mapbox places in the useEffect above so the
      // header tells the truth even when no nearby churches exist.

      // KAN-18 R3 — total leaders within the API radius. Verified callers
      // get real per-row leaders[]; unverified get [] (server-masked),
      // which truthfully sums to 0 for them.
      const totalLeaders = resp.churches.reduce(
        (sum, c) => sum + (c.leaders?.length ?? 0), 0,
      );
      onLeaderCountResolved?.(totalLeaders);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, onLeaderCountResolved]);

  // KAN-XXX (church-tab-states) — retry the nearby fetch after a CamlErrorView
  // tap. Clears the error so the overlay unmounts immediately on retry, then
  // re-fires fetchNearby with the current GPS coord. Held by the host (this
  // component) since error/setError/viewerCoord/fetchNearby all live here.
  const handleRetry = useCallback(() => {
    if (viewerCoord) {
      setError(null);
      void fetchNearby(viewerCoord);
    }
  }, [viewerCoord, fetchNearby]);

  // Fix 1 — loading flicker (2026-05-28). viewerCoord changes on every
  // GPS update from the listener, so without a data-exists guard this
  // effect would re-fire continuously, blinking the list back to
  // LOADING… on every fix. Only fetch once per session; AppState
  // refresh / pull-to-refresh would be the future opt-in re-fetch
  // surface if needed.
  useEffect(() => {
    if (!isActive || !viewerCoord || data !== null) return;
    void fetchNearby(viewerCoord);
  }, [isActive, viewerCoord, data, fetchNearby]);

  // Post-completion refetch — the host bumps refreshTrigger after the
  // leader finishes the Church Profile Setup Flow. The mount-fetch effect
  // above only fires once (data !== null guard), so a freshly-joined
  // leader would otherwise have to leave and return to see their own
  // church land in the list + on the map. Gated on refreshTrigger > 0 to
  // avoid a double-fetch racing the mount fetch on first render.
  useEffect(() => {
    if (refreshTrigger <= 0 || !viewerCoord) return;
    void fetchNearby(viewerCoord);
    // viewerCoord intentionally omitted from deps: this effect re-runs
    // ONLY when the host bumps refreshTrigger, reading whatever GPS coord
    // is current at that moment. Including it would re-fetch on every GPS
    // fix — the exact flicker the mount-fetch guard above avoids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

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

  // Fix 2 (map-pan path) — a meaningful map drag (past 0.5 km from
  // home) also retires the DRAG TO EXPLORE hint. Without this, panning
  // the map and panning back would show the hint again.
  useEffect(() => {
    if (distanceFromHomeKm >= 0.5) markDragged();
  }, [distanceFromHomeKm, markDragged]);

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
    () => churches.filter((c) => !c.is_own && ragFilter[c.rag_status as Rag] !== false),
    [churches, ragFilter],
  );

  // ── Sheet: peek ↔ open ──
  const [sheetOpen, setSheetOpen] = useState(false);
  // Mirrors sheetOpen for the PanResponder, which captures its callbacks
  // once on mount and would otherwise read a stale sheetOpen closure.
  const sheetOpenRef = useRef(false);
  const translateY = useRef(new Animated.Value(0)).current; // delta from open position
  // We'll measure container height and compute peek vs open dynamically (parent-relative, same fix as KAN-22 pull-up).
  const [containerH, setContainerH] = useState(0);
  const containerHRef = useRef(0);
  const dragStartY = useRef(0);
  // KAN-18 R2 — tracks ScrollView contentOffset.y so the PanResponder
  // only claims downward gestures when the list is scrolled to the top.
  // Upward gestures (sheet-pull from inside the list) always claim.
  const scrollOffsetRef = useRef(0);
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
    sheetOpenRef.current = open;
    const target = yFor(open);
    if (reduced) translateY.setValue(target);
    else Animated.timing(translateY, {
      toValue: target,
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, translateY]);

  // snapToRef keeps the PanResponder (captured once on mount) calling the
  // always-current snapTo rather than the mount-time closure.
  const snapToRef = useRef(snapTo);
  useEffect(() => { snapToRef.current = snapTo; }, [snapTo]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        // KAN-18 R2 — claim threshold bumped 2 → 6 (less twitchy);
        // downward claims gated on the list being scrolled to the top
        // so the user can scroll inside the open sheet without the
        // PanResponder stealing the gesture and snapping the sheet
        // closed. Upward gestures always claim (sheet-pull from peek).
        const isDownward = g.dy > 0;
        const atScrollTop = scrollOffsetRef.current <= 0;
        const shouldClaim = Math.abs(g.dy) > 6
          && Math.abs(g.dy) > Math.abs(g.dx)
          && (isDownward ? atScrollTop : true);
        if (shouldClaim) markDragged();
        return shouldClaim;
      },
      onPanResponderGrant: () => {
        const h = containerHRef.current;
        const livepeekY = Math.max(0, Math.round(h * SHEET_HEIGHT_RATIO) - SHEET_PEEK_PX);
        dragStartY.current = sheetOpenRef.current ? 0 : livepeekY;
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
        if (g.dy > 60 && wasOpen) snapToRef.current(false);
        else if (g.dy < -60 && !wasOpen) snapToRef.current(true);
        else snapToRef.current(wasOpen);
      },
    }),
  ).current;

  // Fix 5 — recenter targets the leader's own church (the anchor for
  // CAML), not the moving GPS fix. Hidden entirely below if ownChurch
  // is missing or its coords aren't real numbers — never fly to
  // [null, null]. INITIAL_ZOOM is held by Camera.defaultSettings; flyTo
  // preserves zoom intentionally so a recenter from a zoomed-in pan
  // doesn't snap the leader back to the wide view.
  const ownChurchPinReady =
    !!ownChurch &&
    typeof ownChurch.lng === 'number' && !isNaN(ownChurch.lng) &&
    typeof ownChurch.lat === 'number' && !isNaN(ownChurch.lat);
  const recenter = useCallback(() => {
    if (!ownChurch) return;
    cameraRef.current?.flyTo([ownChurch.lng, ownChurch.lat], (ownChurch.distance_km ?? 0) >= 80 ? 350 : 1000);
  }, [ownChurch]);

  // Tutorial pan-to-church — fires once per trigger increment. If
  // ownChurch is not yet loaded when the trigger fires, the effect
  // re-runs when ownChurch lands (lastPanTrigger stays at the previous
  // value until ownChurch is available).
  const lastPanTrigger = useRef(0);
  useEffect(() => {
    if (!panToChurchTrigger || panToChurchTrigger === lastPanTrigger.current || !ownChurchPinReady || !ownChurch) return;
    lastPanTrigger.current = panToChurchTrigger;
    cameraRef.current?.flyTo([ownChurch.lng, ownChurch.lat], 0);
  }, [panToChurchTrigger, ownChurch, ownChurchPinReady]);

  const lastRecenterTrigger = useRef(0);
  useEffect(() => {
    if (!recenterToGPSTrigger || recenterToGPSTrigger === lastRecenterTrigger.current || !viewerCoord) return;
    lastRecenterTrigger.current = recenterToGPSTrigger;
    cameraRef.current?.flyTo([viewerCoord[0], viewerCoord[1]], 400);
  }, [recenterToGPSTrigger, viewerCoord]);

  // KAN-18 R2 — second recenter, targeting the leader's live GPS
  // (viewerCoord) instead of their registered church. Surfaced as the
  // pan-hint pill once they've panned past 0.5 km from home; gives
  // them a one-tap way back to where they actually are.
  const recenterToGPS = useCallback(() => {
    if (!viewerCoord || !cameraRef.current) return;
    cameraRef.current.flyTo(viewerCoord, 600);
  }, [viewerCoord]);

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
  // showEmpty (no non-own churches in results — own church is always
  // injected by the edge fn) is computed + declared above, hoisted so the
  // empty-ring pulse effect's deps array can reference it. Reused here.
  const emptyIsAway = !ownChurch || (ownChurch.distance_km ?? 0) >= 80;

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
            {/* Soft halo UNDER each dot — radius 15 (vs 8), low opacity,
                blurred edge. Renders before caml-nearby-dots so the dot
                sits on top. RAG-matched to the dot so the glow reads as
                the same status. No animation — keeps the map alive
                without per-frame cost. */}
            <CircleLayer
              id="caml-nearby-dots-glow"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleRadius: 15,
                circleOpacity: 0.18,
                circleColor: [
                  'match', ['get', 'rag_status'],
                  'green', Colors.green,
                  'amber', Colors.amber,
                  'red',   Colors.red,
                  Colors.textMuted,
                ],
                circleBlur: 0.5,
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
                {reduced ? (
                  <>
                    <View style={styles.ownHaloOuter} pointerEvents="none" />
                    <View style={styles.ownHalo} pointerEvents="none" />
                  </>
                ) : (
                  <>
                    <Animated.View
                      style={[
                        styles.ownRing,
                        { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] },
                      ]}
                      pointerEvents="none"
                    />
                    <Animated.View
                      style={[
                        styles.ownRing,
                        { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
                      ]}
                      pointerEvents="none"
                    />
                  </>
                )}
                <View style={styles.ownCore}>
                  <View style={styles.ownDot} />
                </View>
                <View style={styles.ownLabel} pointerEvents="none">
                  {/* KAN-18 R4 — numberOfLines={1} prevents the marker
                      label from wrapping character-by-character when the
                      MarkerView's native child measures narrow on the
                      device. That wrap was rendering the dark pill as a
                      vertical column of stacked letters extending
                      downward from the GPS puck. */}
                  <Text style={styles.ownLabelText} numberOfLines={1}>YOUR CHURCH</Text>
                </View>
              </Pressable>
            </MarkerView>
          ) : null}
        </MapView>
      ) : (
        <CamlLoadingView />
      )}

      {/* Filter chips.
          KAN-18 R2 — top: 8 (no insets.top). CamlView renders inside
          TheChurchScreen's pages container, which sits below tc-header.
          The SafeAreaView at the screen root already consumed the
          device safe area; adding insets.top here double-counted it. */}
      {camlReady ? (
        <View style={[styles.filterRow, { top: 8 }]} pointerEvents="box-none">
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
          {ownChurchPinReady ? (
            <Pressable
              onPress={recenter}
              accessibilityRole="button"
              accessibilityLabel="Recenter on my church location"
              style={[styles.chip, styles.chipActive]}
            >
              <Text style={[styles.chipText, styles.chipTextActive]}>⊙ MY CHURCH LOCATION</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Pan distance hint — DRAG TO EXPLORE fades on first gesture
          (sheet drag or 0.5 km map pan) and unmounts; FROM HOME pill
          stays a plain View, no animation. */}
      {camlReady && dragHintMounted && distanceFromHomeKm < 0.5 ? (
        <Animated.View
          style={[
            styles.panHint,
            styles.panHintResting,
            { bottom: (containerH > 0 ? Math.round(containerH * SHEET_HEIGHT_RATIO) - SHEET_PEEK_PX : 0) + 16,
              opacity: dragHintOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.panHintText}>DRAG TO EXPLORE</Text>
        </Animated.View>
      ) : null}
      {/* KAN-18 R3 — RE-CENTER ME pill: bottom-right, BEHIND the pull-up
          sheet. Reusing styles.panHint here previously produced a tall
          horizontal-stretched bar (panHint has alignSelf: 'center' on
          an absolutely-positioned element with no left/right and no
          explicit width — RN ignores alignSelf for absolute children,
          leaving width undetermined). Own style with explicit right: 14,
          right-anchored bottom math just above the sheet's peek tab,
          and zIndex: 3 so the sheet (zIndex 4+) covers it cleanly when
          it rises. */}
      {/* KAN-18 R4 — RE-CENTER ME pill: gated on !sheetOpen so it
          yields the surface to the leader once they're reading the
          list. Bottom anchored at SHEET_PEEK_PX + 8 — just above the
          peek grip bar, regardless of containerH. The sheet's
          zIndex: 10 (set on the sheet style below) covers any
          half-state animation overlap definitively. */}
      {camlReady && distanceFromHomeKm >= 0.5 && !sheetOpen ? (
        <Pressable
          onPress={recenterToGPS}
          accessibilityRole="button"
          accessibilityLabel="Recenter map to my GPS location"
          style={[
            styles.recenterPill,
            { bottom: SHEET_PEEK_PX + 8 },
          ]}
        >
          <Text style={styles.recenterPillText}>RE-CENTER ME</Text>
        </Pressable>
      ) : null}

      {/* CAML sheet — peek ↔ open */}
      {camlReady && sheetH > 0 ? (
        <Animated.View
          style={[styles.sheet, { height: sheetH, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View>
            <View>
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
                        : data.expanded && visibleListRows.length > 0
                          ? `SHOWING CHURCHES WITHIN 100 KM · ${visibleListRows.length} FOUND`
                          : `${visibleListRows.length} CHURCHES NEAR YOU · SWIPE TO SEE MORE`}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: 4, paddingHorizontal: 16 }}
            onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            {showEmpty ? (
              <View style={styles.emptyPastoral}>
                <View style={styles.emptyRingWrap}>
                  {!reduced ? (
                    <>
                      <Animated.View
                        style={[styles.emptyRingPulse, { opacity: emptyRing1Opacity, transform: [{ scale: emptyRing1Scale }] }]}
                        pointerEvents="none"
                      />
                      <Animated.View
                        style={[styles.emptyRingPulse, { opacity: emptyRing2Opacity, transform: [{ scale: emptyRing2Scale }] }]}
                        pointerEvents="none"
                      />
                    </>
                  ) : null}
                  <View style={styles.emptyRing} />
                  <View style={styles.emptyLogoWrap}>
                    <Svg width={22} height={21} viewBox="482 201 581 544">
                      <Path
                        fill={Colors.accent}
                        d="M 727.50 224.51 C 732.42 223.82 737.39 223.97 742.35 223.21 Q 745.93 222.65 752.75 222.35 Q 774.24 221.41 794.64 223.22 Q 796.68 223.40 799.46 223.76 C 801.86 224.07 804.27 223.90 806.51 224.25 Q 829.32 227.88 835.88 229.63 Q 843.96 231.79 846.42 232.43 Q 852.00 233.89 856.88 235.47 Q 896.68 248.35 931.16 272.57 Q 951.36 286.75 967.19 302.79 Q 990.45 326.35 1007.25 354.73 Q 1032.23 396.94 1039.85 445.05 Q 1043.06 465.29 1042.89 487.09 Q 1042.84 493.60 1042.46 496.91 C 1041.92 501.62 1041.98 505.52 1041.48 510.01 Q 1038.38 537.81 1029.50 564.01 Q 1007.67 628.48 955.20 670.46 Q 952.46 672.65 946.32 677.06 Q 923.10 693.75 898.16 703.82 C 891.10 706.67 885.02 709.28 879.69 710.87 Q 876.51 711.82 862.23 715.95 Q 855.65 717.86 839.48 720.51 Q 824.39 722.98 813.25 723.78 Q 794.33 725.14 769.12 723.85 C 766.01 723.69 762.99 723.01 759.74 722.97 C 756.37 722.92 753.38 722.20 750.21 721.99 C 746.74 721.76 742.33 720.65 738.52 720.17 Q 737.39 720.03 732.57 719.33 Q 721.97 717.78 699.08 711.13 Q 681.78 706.11 667.63 699.61 Q 659.94 696.08 652.44 692.29 Q 595.63 663.58 555.30 613.22 Q 549.80 606.36 541.09 592.68 Q 513.97 550.10 506.45 500.05 Q 505.70 495.08 504.77 485.88 Q 504.11 479.28 503.92 471.61 Q 502.41 410.53 531.97 356.20 Q 546.31 329.85 566.24 308.24 Q 588.39 284.23 615.50 266.26 Q 649.66 243.62 688.92 232.65 Q 708.71 227.12 727.50 224.51 Z M 1030.93 465.85 Q 1031.05 497.05 1024.49 523.76 Q 1015.90 558.72 995.98 589.50 Q 990.46 598.03 983.19 607.43 Q 949.96 650.42 901.32 673.02 Q 874.08 685.68 837.70 693.16 Q 836.85 693.34 828.93 694.29 Q 825.57 694.69 820.13 695.35 Q 804.37 697.28 786.07 696.84 Q 783.01 696.77 782.61 696.59 A 0.32 0.32 0.0 0 1 782.58 696.03 Q 783.49 695.47 784.88 695.38 Q 794.86 694.75 803.26 693.48 Q 813.95 691.88 830.55 688.11 Q 874.58 678.12 913.24 654.24 Q 963.20 623.37 992.93 572.96 Q 1016.51 532.95 1020.91 487.50 Q 1022.25 473.61 1021.34 456.46 Q 1020.55 441.45 1016.90 425.69 Q 1000.48 354.76 948.65 305.16 Q 918.99 276.79 879.11 258.71 Q 874.54 256.64 866.38 253.53 Q 856.17 249.64 853.49 248.82 Q 829.48 241.42 805.19 238.32 C 801.46 237.85 798.71 238.06 795.42 237.56 Q 793.10 237.20 788.08 236.99 Q 769.76 236.24 751.63 237.07 Q 750.09 237.14 744.41 237.73 Q 740.08 238.18 737.20 238.50 Q 731.10 239.17 726.40 239.98 Q 654.98 252.35 600.91 300.92 Q 567.25 331.15 547.21 371.21 Q 532.44 400.73 527.97 432.76 Q 523.16 467.32 528.92 501.33 Q 534.73 535.62 551.23 566.14 Q 567.86 596.88 592.67 621.38 C 597.84 626.48 604.53 633.21 610.93 638.41 C 617.01 643.35 622.57 648.04 627.98 651.88 Q 653.83 670.24 681.86 682.08 Q 705.06 691.87 727.30 696.85 Q 741.90 700.12 754.70 701.56 Q 770.47 703.34 788.59 703.67 C 794.85 703.79 800.09 703.26 805.26 703.24 Q 811.14 703.21 817.70 702.27 C 821.63 701.71 829.88 701.04 835.10 700.19 Q 870.27 694.49 903.09 679.60 C 908.66 677.07 914.27 673.80 919.66 670.92 Q 925.90 667.59 931.72 663.79 Q 952.79 649.99 970.49 631.49 Q 985.30 616.01 996.14 599.66 Q 1014.60 571.84 1024.01 540.00 Q 1027.48 528.23 1030.02 511.76 Q 1033.50 489.17 1031.26 465.83 A 0.17 0.16 -48.1 0 0 1030.93 465.85 Z"
                      />
                      <Path
                        fill={Colors.accent}
                        d="M 891.92 519.04 Q 892.95 519.84 897.61 521.94 C 908.73 526.95 917.77 534.73 924.23 544.76 Q 928.98 552.12 930.36 561.89 C 930.50 562.87 930.88 563.82 930.49 564.95 A 0.34 0.34 0.0 0 1 929.88 565.01 C 926.57 559.33 923.39 553.64 918.92 548.62 Q 912.15 541.02 903.40 534.45 Q 895.93 528.83 885.39 524.31 Q 874.54 519.65 865.87 517.41 Q 858.00 515.38 842.76 512.16 Q 839.67 511.51 837.49 510.93 C 834.37 510.10 831.35 510.05 828.60 509.45 Q 816.94 506.92 805.63 503.86 Q 797.61 501.69 790.33 498.51 A 0.29 0.29 0.0 0 0 789.99 498.96 Q 793.70 503.75 799.00 508.23 Q 812.41 519.58 830.18 525.56 Q 842.48 529.70 863.91 535.57 Q 875.94 538.86 889.06 545.20 Q 906.64 553.69 918.55 569.21 C 924.11 576.45 927.99 584.73 929.15 593.82 C 929.88 599.49 930.79 604.85 928.86 609.77 A 0.31 0.31 0.0 0 1 928.26 609.70 C 926.47 597.54 922.06 586.74 913.87 577.37 Q 905.37 567.66 894.48 561.55 Q 878.13 552.40 863.58 548.49 Q 854.92 546.16 854.02 545.62 A 0.29 0.29 0.0 0 0 853.58 545.89 Q 853.59 546.04 856.30 549.73 C 862.79 558.58 864.10 570.27 862.14 581.15 Q 860.89 588.11 860.86 590.94 Q 860.74 602.80 869.05 611.90 Q 869.39 612.26 869.39 612.61 A 0.34 0.34 0.0 0 1 868.88 612.91 C 863.56 609.99 858.76 605.42 856.41 599.32 Q 853.68 592.19 853.16 586.80 C 852.28 577.69 855.08 566.77 849.91 558.12 Q 844.03 548.31 833.75 543.05 C 827.72 539.97 817.51 536.71 810.87 533.04 Q 795.55 524.56 783.77 510.83 C 782.96 509.89 782.49 508.48 781.33 507.75 A 0.27 0.27 0.0 0 0 780.92 508.00 C 781.44 513.99 780.94 520.47 779.98 527.22 Q 778.68 536.38 778.08 543.24 Q 775.97 567.61 791.53 585.91 Q 795.81 590.94 805.26 596.97 Q 811.54 600.97 820.91 606.82 Q 834.79 615.49 835.91 631.47 C 836.42 638.78 835.42 645.87 831.02 651.48 Q 830.32 652.36 829.35 652.87 A 0.27 0.26 -6.2 0 1 828.97 652.57 Q 830.89 645.83 831.11 642.67 C 832.31 624.68 818.68 616.07 804.99 609.00 A 0.57 0.57 0.0 0 0 804.16 609.47 L 803.75 616.40 A 1.78 1.64 56.6 0 1 803.69 616.77 C 801.76 624.27 798.87 630.56 795.23 638.67 Q 792.84 644.00 791.87 647.69 Q 789.16 657.87 790.40 668.51 C 790.72 671.29 792.11 674.44 792.52 676.74 A 0.20 0.19 17.0 0 1 792.19 676.91 Q 787.48 672.56 786.61 668.60 Q 785.81 664.94 784.94 661.23 Q 784.20 658.11 784.14 653.74 Q 784.01 644.61 786.25 638.23 Q 792.09 621.65 792.76 619.53 C 794.46 614.11 795.14 605.42 790.81 600.94 C 786.15 596.12 780.64 591.42 776.46 585.66 Q 765.94 571.16 764.30 552.83 A 0.19 0.19 0.0 0 0 763.96 552.74 Q 756.40 563.25 750.71 572.70 Q 743.72 584.29 743.36 597.36 C 743.27 600.70 742.69 604.75 743.52 608.15 C 744.05 610.30 743.79 612.50 744.22 614.55 Q 745.02 618.46 747.36 626.44 Q 750.90 638.46 761.78 650.63 A 0.28 0.27 66.9 0 1 761.60 651.09 Q 760.63 651.17 759.31 650.43 Q 740.68 640.05 734.69 619.31 Q 733.73 616.00 732.08 607.51 Q 731.97 606.94 732.14 606.07 Q 732.27 605.42 732.19 605.13 A 0.39 0.39 0.0 0 0 731.53 604.95 Q 718.20 618.64 699.29 621.52 Q 694.41 622.26 690.70 621.93 A 0.43 0.43 0.0 0 1 690.59 621.10 C 708.52 614.56 725.88 600.95 732.35 582.87 Q 737.63 568.10 742.46 560.98 Q 747.77 553.15 754.30 542.07 C 756.77 537.88 758.69 532.39 760.23 528.49 Q 764.13 518.62 764.41 507.73 A 0.43 0.43 0.0 0 0 763.64 507.45 Q 750.30 524.40 729.87 533.86 Q 720.26 538.30 713.63 540.33 Q 708.85 541.79 705.45 543.53 C 698.92 546.87 696.68 553.09 695.06 560.51 Q 694.79 561.72 694.86 568.50 Q 694.88 570.61 695.55 576.47 Q 695.94 579.92 696.23 585.51 C 696.53 591.39 695.30 601.07 690.46 604.95 A 0.38 0.38 0.0 0 1 689.86 604.56 Q 692.25 595.14 690.72 586.42 Q 690.28 583.89 688.06 577.07 C 684.96 567.58 684.54 555.23 690.16 546.52 A 0.45 0.45 0.0 0 0 689.70 545.83 C 684.84 546.70 680.21 549.49 676.80 550.81 Q 660.10 557.26 646.94 569.96 Q 639.41 577.22 634.99 585.95 Q 630.33 595.14 629.90 604.68 A 0.31 0.31 0.0 0 1 629.41 604.92 C 627.22 603.29 627.08 597.06 627.28 594.49 Q 628.67 577.29 639.90 563.85 Q 645.95 556.63 653.55 551.06 Q 669.54 539.36 687.30 534.40 Q 689.16 533.88 689.36 533.81 Q 696.36 531.45 703.66 529.29 Q 711.80 526.88 717.75 524.24 Q 729.02 519.25 734.83 515.57 Q 740.86 511.76 751.01 502.13 A 3.75 3.60 -7.0 0 0 751.67 501.32 Q 752.33 500.24 754.05 498.27 A 0.34 0.34 0.0 0 0 753.67 497.73 C 749.41 499.48 742.17 502.49 735.91 504.31 Q 722.90 508.07 720.44 508.67 Q 708.72 511.50 691.51 514.30 Q 689.28 514.66 687.32 514.86 A 2.02 0.02 -6.3 0 0 685.59 515.07 Q 665.07 520.13 660.96 521.47 Q 645.09 526.66 631.11 536.02 C 621.71 542.31 614.63 549.61 608.49 558.99 Q 604.90 564.48 603.46 569.67 Q 602.04 574.81 600.41 578.69 A 0.58 0.58 0.0 0 1 599.29 578.50 Q 598.41 563.20 605.27 550.56 Q 606.45 548.39 610.78 542.44 Q 613.38 538.87 617.40 535.21 Q 628.00 525.57 639.92 520.74 A 0.37 0.36 37.1 0 0 639.82 520.04 Q 637.48 519.80 634.28 520.61 A 3.72 3.20 -49.4 0 1 633.76 520.69 L 607.27 522.83 A 1.22 1.21 -80.5 0 0 606.26 523.56 C 603.20 530.77 599.07 535.90 590.48 536.18 Q 581.75 536.46 576.30 530.77 C 567.50 521.58 570.70 506.55 582.87 502.30 Q 592.17 499.06 599.81 504.53 Q 603.95 507.49 606.44 514.58 A 0.90 0.88 5.4 0 0 606.82 515.03 Q 607.15 515.21 607.65 514.84 Q 607.87 514.68 608.38 514.63 C 613.00 514.17 616.50 514.04 621.80 513.16 Q 628.54 512.04 634.93 510.98 Q 644.18 509.45 648.03 508.68 C 666.70 504.98 678.64 502.61 694.79 500.21 Q 703.27 498.95 712.28 497.11 C 725.59 494.39 732.88 492.52 742.14 488.13 A 8.45 7.98 12.9 0 0 743.62 487.26 L 749.52 482.89 A 7.31 7.31 0.0 0 0 751.02 481.39 Q 755.24 475.80 755.89 474.37 Q 760.39 464.47 760.82 454.52 Q 761.67 435.09 755.00 416.48 C 753.12 411.22 748.79 410.79 743.16 411.10 Q 725.98 412.02 707.29 406.18 Q 701.21 404.28 696.72 402.04 Q 655.18 381.31 647.77 334.57 A 1.26 1.26 0.0 0 1 648.86 333.13 C 650.54 332.92 652.81 332.16 654.23 332.14 C 659.03 332.10 663.56 331.06 668.61 331.06 Q 685.18 331.05 688.50 331.32 Q 700.47 332.28 712.21 335.08 C 719.42 336.80 725.65 339.78 732.52 343.03 Q 736.26 344.79 739.57 347.02 Q 749.65 353.79 756.50 363.71 Q 764.26 374.94 766.53 387.20 Q 767.37 391.76 768.36 397.81 C 769.08 402.24 769.03 408.52 768.94 411.69 A 0.64 0.63 39.0 0 1 767.69 411.82 Q 765.89 404.69 761.60 398.62 C 758.79 394.63 756.15 390.52 753.62 387.60 Q 736.53 367.86 711.89 359.54 Q 707.94 358.20 701.51 356.74 Q 696.16 355.53 690.95 354.16 A 0.39 0.39 0.0 0 0 690.48 354.41 L 690.47 354.43 A 0.43 0.43 0.0 0 0 690.69 354.96 Q 698.47 358.69 712.07 365.17 C 717.65 367.83 724.61 372.95 728.72 375.81 Q 743.46 386.05 753.14 402.12 Q 759.70 413.01 763.36 422.38 Q 765.90 428.90 767.46 436.79 Q 767.60 437.45 767.73 437.54 A 1.15 1.15 0.0 0 0 769.43 436.89 C 771.10 431.38 772.79 423.87 775.42 417.65 Q 781.80 402.52 790.91 391.63 Q 794.85 386.92 801.90 380.14 Q 807.69 374.56 814.12 370.00 Q 821.41 364.82 828.18 360.69 C 830.36 359.35 832.34 358.77 834.38 357.46 Q 840.98 353.20 848.70 349.59 A 0.36 0.36 0.0 0 0 848.84 349.05 L 848.67 348.83 A 0.23 0.22 64.9 0 0 848.44 348.74 Q 836.34 352.00 831.78 353.55 Q 825.27 355.75 817.17 359.91 Q 808.82 364.20 796.50 374.33 C 792.47 377.65 789.47 381.58 785.01 386.51 Q 778.27 393.99 774.23 402.93 Q 774.06 403.32 772.62 404.65 A 0.32 0.32 0.0 0 1 772.11 404.55 Q 771.85 404.00 772.64 400.71 Q 772.83 399.88 773.16 397.26 C 775.64 377.41 785.16 360.14 801.57 348.40 Q 813.02 340.21 825.76 336.02 Q 837.35 332.21 850.08 330.39 Q 865.66 328.15 887.70 329.16 A 0.86 0.86 0.0 0 1 888.50 329.87 Q 888.60 330.44 888.30 331.16 Q 887.94 332.00 887.89 332.53 Q 886.73 343.83 884.04 355.01 Q 881.20 366.78 875.07 377.35 Q 859.78 403.70 830.89 414.63 Q 820.81 418.44 811.16 419.95 C 807.81 420.48 804.44 421.19 801.22 421.70 C 792.25 423.13 785.65 428.91 782.57 437.30 Q 779.66 445.20 779.33 455.76 C 778.84 471.58 786.06 484.50 800.92 490.59 Q 810.06 494.34 821.00 496.49 Q 832.36 498.71 845.54 500.91 C 846.97 501.15 848.78 501.03 850.37 501.39 Q 855.40 502.52 859.60 503.27 Q 867.45 504.67 868.87 504.97 Q 891.41 509.66 910.03 512.67 Q 920.55 514.38 929.60 515.19 A 0.86 0.86 0.0 0 0 930.48 514.65 L 932.31 510.09 A 2.35 2.01 -22.2 0 1 932.48 509.76 Q 938.31 500.83 948.35 501.28 C 968.13 502.15 970.09 530.35 951.62 535.89 Q 951.03 536.06 945.88 536.11 C 937.30 536.18 933.23 530.51 929.95 523.65 A 1.02 1.02 0.0 0 0 929.16 523.08 L 892.07 518.66 A 0.21 0.21 0.0 0 0 891.92 519.04 Z"
                      />
                    </Svg>
                  </View>
                </View>
                {emptyIsAway ? (
                  <>
                    <Text style={styles.emptyTitle}>No Replant churches in this area yet.</Text>
                    <Text style={styles.emptyBody}>
                      Your church is registered elsewhere — this is unfamiliar ground for Replant. If you know any churches in this area, extend an invite on our behalf.
                    </Text>
                    <View style={styles.scriptureBox}>
                      <Text style={styles.scriptureText}>
                        {'"'}How beautiful on the mountains are the feet of those who bring good news.{'"'}
                      </Text>
                      <Text style={styles.scriptureRef}>ISAIAH 52:7</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>You may be the first here.</Text>
                    <Text style={styles.emptyBody}>
                      No other verified churches have joined Replant in this area yet. Others will come. Hold this ground.{'\n\n'}If you know any churches nearby, please extend an invite on behalf of Replant.
                    </Text>
                    <View style={styles.scriptureBox}>
                      <Text style={styles.scriptureText}>
                        {'"'}You are the light of the world. A city set on a hill cannot be hidden.{'"'}
                      </Text>
                      <Text style={styles.scriptureRef}>MATTHEW 5:14</Text>
                    </View>
                  </>
                )}
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

            {/* Underground honor note — only once data has settled so it
                doesn't surface alone while the nearby list is loading. */}
            {data !== null ? (
              <View style={styles.undergroundNote}>
                <Text style={styles.undergroundEyebrow}>UNDERGROUND · NOT PICTURED</Text>
                <Text style={styles.undergroundBody}>
                  Some churches gather in places we cannot show on a map.{'\n'}
                  You are part of their covering.
                </Text>
                {/* TODO(DBA): live underground count by region */}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* KAN-XXX — fetch-failure overlay. Sits at zIndex 12 above map +
          sheet + recenter pill, below the host-level UnverifiedGate (z 20).
          Clears + re-fires the RPC on retry. */}
      {error ? <CamlErrorView onRetry={handleRetry} /> : null}
    </View>
  );
}

// ─── Loading + error overlays ────────────────────────────────────────

// CamlLoadingView — CD states.jsx LoadingState
// Full-height skeleton shown while GPS / map not yet ready (!camlReady).
// Static non-animated blocks (no Animated.loop — accessible, honours
// useReducedMotion implicitly). Own loadingStyles so the placeholder
// blocks don't pollute the main styles object.
function CamlLoadingView() {
  return (
    <View style={loadingStyles.root}>
      <View style={loadingStyles.inner}>
        <View style={loadingStyles.skelMap} />
        <View style={loadingStyles.skelLabel} />
        <View style={loadingStyles.skelRow} />
        <View style={loadingStyles.skelRow} />
        <View style={loadingStyles.skelRow} />
      </View>
      <View style={loadingStyles.footer}>
        <Text style={loadingStyles.footerText}>Loading the network…</Text>
      </View>
    </View>
  );
}
const loadingStyles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.background },
  inner:      { padding: 16, paddingTop: 60 },
  skelMap:    { height: 240, borderRadius: 6, backgroundColor: Colors.surface, marginBottom: 16 },
  skelLabel:  { height: 14,  width: '40%', borderRadius: 6, backgroundColor: Colors.surface, marginBottom: 8 },
  skelRow:    { height: 60,  borderRadius: 6, backgroundColor: Colors.surface, marginBottom: 8 },
  footer:     { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  footerText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});

// CamlErrorView — CD states.jsx ErrorState
// Absolute overlay (zIndex 12) covering map + sheet on fetch failure.
// "The body is still gathered" — the network is the leader's connection,
// not the body itself.
function CamlErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={errorStyles.root}>
      <Svg width={48} height={48} viewBox="0 0 48 48" style={errorStyles.glyph}>
        <Circle cx={24} cy={24} r={22} fill="none" stroke="rgba(224,85,85,0.4)" strokeWidth={0.8} strokeDasharray="3 3" />
        <Path d="M16 16l16 16M32 16L16 32" stroke={Colors.red} strokeWidth={1.2} />
      </Svg>
      <Text style={errorStyles.title}>We couldn't reach the network.</Text>
      <Text style={errorStyles.body}>
        Could be our servers, could be your connection. Try again in a moment — the body is still gathered.
      </Text>
      <Pressable onPress={onRetry} style={errorStyles.retryBtn} accessibilityRole="button">
        <Text style={errorStyles.retryText}>RETRY</Text>
      </Pressable>
    </View>
  );
}
const errorStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12,
    backgroundColor: 'rgba(8,8,8,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glyph: { marginBottom: 20 },
  title: {
    fontFamily: Typography.scriptureLight,
    fontSize: 20,
    letterSpacing: 0.4,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 10,
    maxWidth: 260,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: 22,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.7,
    color: Colors.textMuted,
  },
});

// ─── List row ────────────────────────────────────────────────────────

function CamlListRow({ church, unit, onPress, viewerVerified }: {
  church: NearbyChurch;
  unit: 'mi' | 'km';
  onPress: () => void;
  viewerVerified: boolean;
}) {
  const typeLabel = getChurchTypeLabel(church.type);
  const masked = !viewerVerified && !church.name;
  // KAN-18 R2 — CD CamlListRow row order: dot → name → leader → RPL → distance.
  // The type label was here before; the CD slot is the RPL identifier
  // (church_code in our schema). Masked rows still show VERIFY hint
  // instead of leader / RPL — masking precedence is unchanged.
  return (
    <Pressable onPress={onPress} style={styles.listRow} accessibilityRole="button">
      <View style={[styles.listDot, { backgroundColor: ragColor(church.rag_status) }]} />
      <View style={styles.listBody}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>
            {masked ? typeLabel : (church.name ?? typeLabel)}
          </Text>
          {church.is_own ? (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          ) : null}
        </View>
        {masked ? (
          <Text style={styles.listMaskedHint}>VERIFY TO VIEW DETAILS</Text>
        ) : (
          <>
            <Text style={styles.listLeader} numberOfLines={1}>
              {leaderLineText(church.leaders)}
            </Text>
            {church.network_id ? (
              <Text style={styles.listRpl} numberOfLines={1}>{church.network_id}</Text>
            ) : null}
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
    // Fix 4 — bumped 8.5 → 9 to match TheChurchScreen pagerLabel size.
    // Letter-spacing recomputed against the chip's 0.14em design rule.
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.26, // 0.14em × 9
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

  // KAN-18 R3 — RE-CENTER ME pill (own surface, NOT a panHint reuse).
  // right-anchored, zIndex BELOW the sheet so it disappears under the
  // sheet when it rises. Inline bottom is computed at render so the
  // pill always sits just above the peek tab.
  recenterPill: {
    position: 'absolute',
    right: 14,
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(8,8,8,0.82)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: 100,
    zIndex: 3, // sheet sits at zIndex 4+ (implicit via render order)
  },
  recenterPillText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    color: Colors.textMuted, textTransform: 'uppercase',
  },
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
  // Pulsing ping ring — sized to sit concentric with ownCore (16px box,
  // centre at 8,8). A 24px ring centred there places its top-left at
  // (8 - 12, 8 - 12) = (-4, -4). Scales up to 2.2× via the loop effect.
  ownRing: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    left: -4, top: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent,
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
    // KAN-18 R4 — explicit width: 80 so the label has deterministic
    // dimensions regardless of how the MarkerView's native child
    // container measures the Pressable. translateX(-40) re-centers
    // against the new half-width. Combined with numberOfLines={1} on
    // the Text, this eliminates the character-stacking that
    // previously rendered the label as a dark vertical bar below the
    // GPS puck on devices where the parent measured narrow.
    position: 'absolute',
    top: 28, left: '50%',
    width: 80,
    alignItems: 'center',
    paddingVertical: 2, paddingHorizontal: 7,
    backgroundColor: 'rgba(8,8,8,0.70)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 100,
    transform: [{ translateX: -40 }],
  },
  ownLabelText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53,
    color: Colors.accent,
  },

  // Sheet
  // KAN-18 R4 — zIndex: 10 sits the sheet definitively above the
  // RE-CENTER ME pill (zIndex 3) and the DRAG TO EXPLORE Animated.View
  // (zIndex 4) regardless of render order; the pill is also gated on
  // !sheetOpen at render time as a belt-and-suspenders.
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(107,181,232,0.35)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 50,
    shadowOffset: { width: 0, height: -16 },
    zIndex: 10,
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
  // Name + YOU badge share a baseline-ish row. flexShrink on the name
  // lets a long church name truncate (numberOfLines={1}) before crowding
  // the badge out of view.
  listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  listName: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.text, flexShrink: 1 },
  // YOU pill — leader's own church marker in the list (parity with the
  // YOUR CHURCH map label). Sky outline, mono micro-caps.
  youBadge: {
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.4)',
  },
  youBadgeText: {
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.accent,
  },
  listLeader: { marginTop: 3, fontFamily: Typography.body, fontSize: 11.5, color: Colors.textMuted },
  // KAN-18 R2 — RPL identifier row. Matches panHintText sizing per
  // dispatch (CD .rpl class equivalent: mono ~8.5pt, letter-spacing
  // ~0.18em, uppercase, muted). RPL identifiers like RPL-00001 are
  // already uppercase in the DB, but textTransform makes the rule
  // explicit and self-documenting.
  listRpl: {
    marginTop: 5,
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
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
  emptyRingWrap: {
    width: 42, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyRingPulse: {
    position: 'absolute',
    width: 42, height: 42, borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent,
  },
  emptyRing: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, borderColor: 'rgba(107,181,232,0.55)',
    borderStyle: 'dashed',
  },
  emptyLogoWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: Typography.scriptureItalic, fontSize: 15,
    lineHeight: 23, color: Colors.text, textAlign: 'center',
  },
  scriptureRef: {
    marginTop: 8,
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.98, // 0.22em × 9
    color: Colors.accent, textAlign: 'center',
  },

  // Underground note — KAN-18 R3: centered (pastoral register).
  undergroundNote: {
    marginTop: 8, marginBottom: 16,
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(107,181,232,0.20)',
    borderRadius: 8,
  },
  undergroundEyebrow: {
    fontFamily: Typography.mono, fontSize: 9,
    letterSpacing: 1.98, color: Colors.accent,
    textTransform: 'uppercase', marginBottom: 6,
    textAlign: 'center',
  },
  undergroundBody: {
    fontFamily: Typography.body, fontSize: 12,
    lineHeight: 20, color: Colors.textMuted,
    textAlign: 'center',
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
