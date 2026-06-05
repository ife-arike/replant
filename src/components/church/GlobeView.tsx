// ─────────────────────────────────────────────
// GlobeView — KAN-21 / KAN-223
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
//
// KAN-223 additions:
//   - Region pill (top-right) — names the currently faced region; tapping
//     it opens the RegionalPanel via onPickRegion.
//   - Faced-region detection — computed each rotation tick and on map-idle;
//     fires onFaceRegion only when the RegionKey changes (key-change guard
//     on facedKeyRef), avoiding redundant parent re-renders.
//   - Globe-body tap → onPickRegion — detects a tap (dx/dy < 12 px, not a
//     drag) on the globe body (not a dot) and fires onPickRegion for the
//     currently faced region. dotPressedRef guards: if a dot was pressed,
//     the body-tap handler skips so onChurchSelect wins.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
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
import type { ChurchDot } from '../../hooks/useChurchesGlobal';
import { getCountryCentroid } from './countryCentroid';
import { facedRegionForCenter, type RegionDef } from '../../utils/regionUtils';

// ─── Mapbox token (module-level) ─────────────────────────────────────
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const STYLE_URL = 'mapbox://styles/mapbox/dark-v11'; // globe-projection capable
// Fix 4 (2026-05-28): open at full visible sphere, not flat-map. In
// @rnmapbox/maps v10 globe projection, zoom ≈ 1.0 frames the whole
// earth as a sphere on a phone-sized canvas.
const INITIAL_ZOOM = 1.0;
// Fix 4: rotation reduced to ~2°/s — felt frantic at 6°/s with the
// fuller-globe view. 0.07°/tick @ 33ms (~30fps) = 2.1°/s, slower and
// more deliberate than the CD prototype's 6°/s while preserving the
// same pause/resume contract.
const ROTATION_DEG_PER_TICK = 0.07;
const ROTATION_TICK_MS = 33;
const RESUME_DELAY_MS = 3500;             // dispatch: 3.5s stillness before resume
const CUE_MS = 600;                       // dispatch: "Resuming" cue duration
const REGIONAL_ZOOM = 5.0;                // regional view density threshold
                                          // (kept for the cluster-tap zoom cap;
                                          // no UI pill — CD chrome owns the
                                          // top-corner row, KAN-21 pills stripped)

// Watched invariant — own-church coords come from the registered church
// row, NEVER from expo-location / live GPS. The hook returns ownChurchId
// from public.users.church_id; the dot uses the registered lat/lng that
// arrives with the rest of the dataset.
const OWN_CHURCH_COORD_SOURCE = 'registered_church_lat_lng_NOT_live_gps' as const;

interface Props {
  /** Worldwide RAG dots — hoisted from the host via useChurchesGlobal. */
  dots: ChurchDot[];
  /** Viewer's own church id — sky-blue larger dot. Null = no highlight. */
  ownChurchId: string | null;
  /** Viewer's church country — drives initial camera centroid. */
  viewerCountry: string | null;
  /** Hook loading flag — drives the in-globe spinner overlay. */
  loading: boolean;
  /** Hook error message (if any) — drives the retry overlay. */
  error: string | null;
  /** Refetch callback for the retry overlay. */
  onRetry: () => void;
  /** Fires when the leader taps a non-cluster church dot. */
  onChurchSelect: (churchId: string) => void;
  /** Optional override for the initial camera (mostly for tests/storybook). */
  initialCenterOverride?: [number, number];
  /** Fix A (2026-05-28): read-only host-level gate that suspends both
      the rotation tick AND the red-dot pulse while any overlay (profile
      sheet, regional panel, prayer wall pull-up half/full) is open.
      Does NOT participate in the setPaused/scheduleResume state machine
      — it gates the effects directly. */
  forcePaused?: boolean;
  /** Bottom inset for the zoom-out pill — should match PrayerWallPullUp
      PEEK_PX (88) so the pill sits above the collapsed pull-up handle. */
  bottomInset?: number;
  /** KAN-223: Fires when the globe rotates past a new region boundary or
      the user pans to a new region. Debounced by key-change only —
      will not fire repeatedly while the globe is within the same region.
      Handled internally (pill state); forwarded to host for any host-level
      tracking. Pass undefined if no host-side tracking is needed. */
  onFaceRegion?: (region: RegionDef) => void;
  /** KAN-223: Fires when the user taps the globe body (not a dot) or the
      region pill. The host should open the RegionalPanel for this region. */
  onPickRegion?: (region: RegionDef) => void;
}

export default function GlobeView({
  dots,
  ownChurchId,
  viewerCountry,
  loading,
  error,
  onRetry,
  onChurchSelect,
  initialCenterOverride,
  forcePaused = false,
  bottomInset = 88,
  onFaceRegion,
  onPickRegion,
}: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  // ── Camera + rotation state ──
  const cameraRef = useRef<Camera>(null);
  const shapeRef = useRef<ShapeSource>(null);

  const initialCenter = useMemo<[number, number]>(
    () => initialCenterOverride ?? getCountryCentroid(viewerCountry),
    [initialCenterOverride, viewerCountry],
  );

  const currentLngRef = useRef(initialCenter[0]);
  const currentLatRef = useRef(initialCenter[1]);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  // The current zoom is tracked on a ref (not state) — the CD-side top
  // chrome doesn't render a zoom/percent readout, so we no longer need
  // React renders on every onMapIdle. The ref is read inside the
  // cluster-tap handler to clamp the next zoom level.
  const currentZoomRef = useRef(INITIAL_ZOOM);
  // Fix E (2026-05-28): red-dot pulse halo. Two-step opacity flip every
  // 700ms drives the circleOpacity on the rag-dots-red-pulse layer.
  // Paused/forcePaused/reduced suspend it (rotation effect dep mirrors).
  const [pulseOpacity, setPulseOpacity] = useState(0.32);

  // KAN-223: Faced-region state + key-change guard.
  // `facedRegion` drives the region pill (rendered inside GlobeView so it
  // sits directly on the globe canvas). `facedKeyRef` prevents redundant
  // fires — handleFaceRegion is only called when the RegionKey changes.
  const [facedRegion, setFacedRegion] = useState<RegionDef | null>(null);
  const facedKeyRef = useRef<string | null>(null);

  // KAN-223: Globe-body tap guard. Set to true in handleSourcePress when a
  // non-cluster dot is pressed. handleTouchEnd checks this ref; if true, the
  // body-tap→onPickRegion path is skipped so onChurchSelect always wins.
  const dotPressedRef = useRef(false);
  // Touch start position — used to distinguish a tap (small delta) from a drag.
  const touchStartCoordRef = useRef<{ x: number; y: number } | null>(null);
  // KAN-223 race fix (2026-06-05): defer onPickRegion by 250ms so the Mapbox
  // feature-press (handleSourcePress) — which fires AFTER RN's handleTouchEnd
  // — has a window to set dotPressedRef and cancel this pending region open.
  // Combined with the zoom gate, this prevents a pin tap at INITIAL_ZOOM from
  // also opening the regional panel under the church sheet.
  const pendingRegionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // KAN-223: Internal faced-region handler. Sets pill state AND forwards to
  // the optional host prop. Guards on key change (facedKeyRef).
  const handleFaceRegion = useCallback((region: RegionDef) => {
    setFacedRegion(region);
    onFaceRegion?.(region);
  }, [onFaceRegion]);

  // Whenever the viewer country resolves (post-hook-load), jump the
  // camera + reseat the rotation anchor so we don't start mid-Atlantic.
  useEffect(() => {
    if (!viewerCountry && !initialCenterOverride) return;
    const [lng, lat] = initialCenter;
    currentLngRef.current = lng;
    currentLatRef.current = lat;
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: INITIAL_ZOOM,
      animationDuration: reduced ? 0 : 600,
      animationMode: 'flyTo',
    });
  }, [initialCenter, viewerCountry, initialCenterOverride, reduced]);

  // ── Rotation tick (active only while !paused && !resuming) ──
  // Fix 3: drives camera longitude WITHOUT setting an isProgrammatic
  // flag. The pause cycle is now driven by RN core onTouchStart/End on
  // the MapView (see handleTouchStart / handleTouchEnd below) — those
  // fire only on real user gestures, so there is no flag-state race
  // between rotation ticks and user touches.
  useEffect(() => {
    if (paused || forcePaused || resuming || reduced) return;
    const iv = setInterval(() => {
      // Scale rotation speed by zoom so visual angular velocity stays
      // constant — at zoom N the map is 2^(N−INITIAL_ZOOM)× magnified,
      // so divide degrees-per-tick by the same factor.
      const zoomScale = Math.pow(2, Math.max(0, currentZoomRef.current - INITIAL_ZOOM));
      let nextLng = currentLngRef.current + ROTATION_DEG_PER_TICK / zoomScale;
      if (nextLng > 180) nextLng -= 360;
      if (nextLng < -180) nextLng += 360;
      currentLngRef.current = nextLng;
      cameraRef.current?.setCamera({
        centerCoordinate: [nextLng, currentLatRef.current],
        animationDuration: 0,
        animationMode: 'none',
      });
      // KAN-223: fire handleFaceRegion only when the globe rotates into a
      // new region. facedKeyRef guards against per-tick redundant calls —
      // handleFaceRegion only fires when the RegionKey actually changes.
      const faced = facedRegionForCenter(nextLng, currentLatRef.current);
      if (faced.key !== facedKeyRef.current) {
        facedKeyRef.current = faced.key;
        handleFaceRegion(faced);
      }
    }, ROTATION_TICK_MS);
    return () => clearInterval(iv);
  }, [paused, forcePaused, resuming, reduced]);

  // ── Fix E: red-dot pulse interval (700ms two-step flip) ──
  useEffect(() => {
    if (paused || forcePaused || reduced) return;
    const iv = setInterval(() => {
      setPulseOpacity((p) => (p > 0.15 ? 0.06 : 0.32));
    }, 700);
    return () => clearInterval(iv);
  }, [paused, forcePaused, reduced]);

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

  useEffect(() => () => {
    clearResumeCycle();
    if (pendingRegionRef.current) clearTimeout(pendingRegionRef.current);
  }, [clearResumeCycle]);

  // ── Touch + Mapbox events ──
  // Fix 3: pause/resume is driven by RN core onTouchStart/onTouchEnd on
  // MapView. These fire only on real user touches (not on programmatic
  // setCamera ticks), which removes the runaway-rotation + drag-glitch
  // we saw with the prior isProgrammatic flag pattern.
  //
  // Contract per globe.jsx:
  //   onPointerDown → pauseRotation (immediate, clears timers)
  //   onPointerUp   → scheduleResume (3.5s → 600ms cue → resume)
  //
  // KAN-223: handleTouchStart also records the touch position so
  // handleTouchEnd can detect a tap (dx/dy < 12 px) vs. a drag.
  // A globe-body tap fires onPickRegion for the currently faced region.
  // dotPressedRef guards: if a dot triggered handleSourcePress first,
  // onPickRegion is skipped and onChurchSelect wins.
  const handleTouchStart = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      touchStartCoordRef.current = {
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
      };
      setPaused(true);
      setResuming(false);
      clearResumeCycle();
    },
    [clearResumeCycle],
  );

  const handleTouchEnd = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      const start = touchStartCoordRef.current;
      // Globe-body tap detection — only fires onPickRegion when:
      //   1. We have a recorded start position.
      //   2. A dot was NOT pressed (dotPressedRef guards; resets below).
      //   3. The globe is at/near the wide world view (zoom < REGIONAL_ZOOM).
      //      Zoom-level gate (2026-06-05): once zoomed into regional density
      //      or beyond, the user is browsing individual pins, not regions —
      //      so body taps do nothing and a pin tap opens ONLY the church
      //      sheet. This replaces the prior 100ms pendingRegionRef defer,
      //      which raced unreliably against the Mapbox feature-press.
      //   4. Movement is < 12 px in both axes (tap, not drag).
      if (start && !dotPressedRef.current && currentZoomRef.current < REGIONAL_ZOOM) {
        const dx = Math.abs(e.nativeEvent.locationX - start.x);
        const dy = Math.abs(e.nativeEvent.locationY - start.y);
        if (dx < 12 && dy < 12) {
          const faced = facedRegionForCenter(currentLngRef.current, currentLatRef.current);
          // 250ms defer (2026-06-05): handleSourcePress fires after this
          // handler; if a dot was hit it cancels this timer (see below), so
          // a pin tap opens ONLY the church sheet. 100ms was too short and
          // raced unreliably.
          pendingRegionRef.current = setTimeout(() => {
            pendingRegionRef.current = null;
            onPickRegion?.(faced);
          }, 250);
        }
      }
      dotPressedRef.current = false;
      touchStartCoordRef.current = null;
      scheduleResume();
    },
    [scheduleResume, onPickRegion],
  );

  // onMapIdle captures the user's final zoom/center for refs so the
  // resumed rotation continues from where they left the map. Also drives
  // the zoom-out pill visibility and (KAN-223) fires faced-region detection
  // for user pan/drag endings. No timer scheduling here — onTouchEnd owns
  // the resume cycle.
  const handleMapIdle = useCallback((state: unknown) => {
    const props = (state as { properties?: { zoom?: number; center?: [number, number] } } | null)?.properties;
    const z = props?.zoom;
    if (typeof z === 'number' && Number.isFinite(z)) {
      currentZoomRef.current = z;
      setIsZoomedIn(z > INITIAL_ZOOM + 0.5);
    }
    const center = props?.center;
    if (Array.isArray(center) && center.length === 2) {
      currentLngRef.current = center[0];
      currentLatRef.current = center[1];
      // KAN-223: also update the region pill when the user finishes
      // panning. Same key-change guard as the rotation tick.
      const faced = facedRegionForCenter(center[0], center[1]);
      if (faced.key !== facedKeyRef.current) {
        facedKeyRef.current = faced.key;
        handleFaceRegion(faced);
      }
    }
  }, [handleFaceRegion]);

  const handleZoomOut = useCallback(() => {
    currentLngRef.current = initialCenter[0];
    currentLatRef.current = initialCenter[1];
    currentZoomRef.current = INITIAL_ZOOM;
    setIsZoomedIn(false);
    cameraRef.current?.setCamera({
      centerCoordinate: initialCenter,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: reduced ? 0 : 600,
      animationMode: 'flyTo',
    });
  }, [initialCenter, reduced]);

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
      let nextZoom = Math.min(REGIONAL_ZOOM + 1, currentZoomRef.current + 2);
      try {
        // @ts-expect-error — getClusterExpansionZoom accepts the feature in v10.
        const z = await shapeRef.current?.getClusterExpansionZoom(f);
        if (typeof z === 'number') nextZoom = z;
      } catch {
        // Fall back to a conservative zoom-in if the call fails.
      }
      if (coords) {
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: nextZoom,
          animationDuration: reduced ? 0 : 600,
          animationMode: 'flyTo',
        });
      }
      return;
    }
    if (typeof props.id === 'string') {
      // KAN-223: flag that a dot was pressed so the handleTouchEnd
      // body-tap guard skips onPickRegion and onChurchSelect wins. The
      // zoom-level gate in handleTouchEnd is the primary defense against
      // a pin tap also opening the regional panel; dotPressedRef remains
      // the same-zoom-level body-vs-dot disambiguator.
      dotPressedRef.current = true;
      // Cancel any deferred region open queued by handleTouchEnd — a dot was
      // pressed, so the church sheet wins and the regional panel must NOT open.
      if (pendingRegionRef.current) {
        clearTimeout(pendingRegionRef.current);
        pendingRegionRef.current = null;
      }
      onChurchSelect(props.id);
    }
  }, [onChurchSelect, reduced]);

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
        pitchEnabled={false}
        onTouchStart={handleTouchStart as (e: unknown) => void}
        onTouchEnd={handleTouchEnd as (e: unknown) => void}
        onTouchCancel={handleTouchEnd as (e: unknown) => void}
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
          {/* Fix E (2026-05-28): pulsing halo under each red dot.
              Renders BEFORE rag-dots so the solid 5px circle sits on
              top of this 11px translucent halo. circleOpacity is
              animated by the JS pulse interval (700ms two-step flip
              0.32 ↔ 0.06). Layer order in Mapbox = paint order, so
              this layer's circles draw beneath the rag-dots layer. */}
          <CircleLayer
            id="rag-dots-red-pulse"
            filter={['all',
              ['!', ['has', 'point_count']],
              ['!=', ['get', 'isOwn'], true],
              ['==', ['get', 'rag_status'], 'red'],
            ]}
            style={{
              circleColor: Colors.red,
              circleRadius: 11,
              circleOpacity: pulseOpacity,
              circleStrokeWidth: 0,
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

      {/* KAN-223: Region pill removed — Founder ruling 2026-06-04.
          The existing "REGIONS" button in the host header chrome is the
          sole entry point for the panel; it reads the faced region via
          onFaceRegion forwarded to TheChurchScreen. Globe-body tap still
          fires onPickRegion for the currently faced region (unchanged). */}

      {/* Zoom-out pill — mirrors RE-CENTER ME on CAML for visual parity.
          Hidden while any overlay is open (forcePaused) so it doesn't
          compete with the sheet or prayer wall handle. */}
      {isZoomedIn && !forcePaused ? (
        <Pressable
          onPress={handleZoomOut}
          accessibilityRole="button"
          accessibilityLabel="Return to world view"
          style={[styles.zoomOutPill, { bottom: bottomInset + 8 }]}
        >
          <Text style={styles.zoomOutPillText}>ZOOM OUT</Text>
        </Pressable>
      ) : null}

      {/* Loading / error overlays — dim-only, no expo-blur */}
      {loading ? (
        <View style={[styles.overlay, styles.overlayLoading]}>
          <Svg width={28} height={28} viewBox="0 0 36 36" style={styles.overlayGlyph}>
            <Line x1="18" y1="5"  x2="18" y2="31" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
            <Line x1="9"  y1="15" x2="27" y2="15" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
          </Svg>
          <Text style={styles.overlayLoadingText}>Connecting to the network…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.overlay, styles.overlayError]}>
          <Text style={styles.errorText}>Couldn't load the global map right now.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* "Resuming" cue — sky-tinted, bottom-centre. Motion-contract
          piece (KAN-21 c.14801) — not a corner pill, kept under the CD
          chrome strip rule. */}
      {resuming ? (
        <View style={[styles.resumeCue, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.resumeCueText}>↻  Resuming</Text>
        </View>
      ) : null}

      {/* CD-chrome strip (2026-05-28, Founder ack): the KAN-21 corner
          pills (Back to world view / Regional view · Reset) and the
          bottom-right "+N hidden" chip are deliberately removed. The CD's
          top-row chrome (count chip + Regions button) lives in the host
          (TheChurchScreen), not here. The cluster-tap zoom interaction
          still functions; only the explicit reset affordance is gone.
          If Founder requests the reset affordance back during review,
          re-add a top-left pill at insets.top + 56 to stay clear of the
          new chrome row. */}
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
  overlayLoading: { gap: 14 },
  overlayGlyph: {},
  overlayLoadingText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  overlayError: { paddingHorizontal: 24 },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },

  // Zoom-out pill — same geometry as RE-CENTER ME on CAML for visual parity.
  zoomOutPill: {
    position: 'absolute',
    right: 14,
    paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: 'rgba(8,8,8,0.82)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: 100,
    zIndex: 3,
  },
  zoomOutPillText: {
    fontFamily: Typography.mono, fontSize: 8.5,
    letterSpacing: 1.53,
    color: Colors.textMuted, textTransform: 'uppercase',
  },

  // Bottom-centre resume cue — only chrome that stays inside GlobeView
  // post CD strip (motion-contract piece, not a corner pill).
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
});
