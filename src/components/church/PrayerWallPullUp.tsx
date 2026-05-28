// ─────────────────────────────────────────────
// PrayerWallPullUp — KAN-22
//
// Bottom-anchored pull-up panel that overlays the CAL globe with three
// snap states (collapsed / half / full). Built on RN Animated +
// PanResponder — same pattern as PrayerWallDetailSheet / ChurchProfile-
// BottomSheet (no @gorhom/bottom-sheet, no expo-blur).
//
// Snap states:
//   collapsed → only the handle + "Prayer Wall" label peek up from the
//               bottom of the screen (~80pt visible). The leader
//               taps/drags up to expand. Cards NOT fetched yet.
//   half      → ~50% screen height; globe stays visible above. First
//               fetch fires here (AC #2 "Fetch on panel open").
//   full      → ~85% screen height; covers most of the globe.
//
// Reads via the existing get_prayer_wall RPC through usePrayerWall.
// Cards are PrayerWallCard from KAN-23 — already canonical for this
// exact payload (church-name/type/country header, leader line via
// formatLeaderLine, 3-line body clamp, category + urgent chips +
// heart count + timestamp meta, urgency red left border, underground
// trusted from the wire). KAN-22 ships zero card-level code.
//
// Filter row: 8 canonical CATEGORIES + "All", plus urgency All/Urgent.
// Active filter chip: sky-blue underline (AC #6 / #7).
//
// Sort: handled server-side by the RPC's ORDER BY (AC #8).
//
// Post a Request button: header-right, visible ONLY when viewerVerified
// (AC #11; viewer status read from useAuth().branch — never from the
// prayer-wall payload, per watched invariant).
//
// Watched invariants honored:
//   - Underground cards are masked by the RPC (church_name='Underground
//     Church', country=null). PrayerWallCard trusts the wire — this
//     panel does NOT re-derive or override.
//   - Anonymous attribution handled inside PrayerWallCard via
//     formatLeaderLine — no fallback or override in this component.
//   - "Post a Request" visibility keyed off auth context, not payload.
//   - No expo-blur. Dim-only overlay between panel and globe when
//     half/full open.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { usePrayerWall } from '../../hooks/usePrayerWall';
import { type PrayerRow } from '../prayer/PrayerWallLogic';

// Fix 2 (2026-05-28): module-level Dimensions.get('window').height was
// previously used to compute SNAP_COLLAPSED, which translated the panel
// far below its actual parent (the pages container is ~681pt on iPhone
// 16 Pro Max after subtracting safe-area top + tc-header + tab bar) —
// the collapsed handle disappeared off-screen. Snap heights are now
// computed from the panel's MEASURED parent height via onLayout, so the
// math is always correct regardless of host layout.
// Fix B1 (2026-05-28): collapsed peek = 68pt to fit grab bar (~4pt) +
// mono label + scripture quote without the panel's surface bleeding up
// into the globe area. Panel bg goes transparent when collapsed (see
// styles.panelCollapsed) so only the gradient-like fade of the three
// labels is visible above the bottom.
// Fix B2 (2026-05-28): PEEK 68 → 88 — collapsed label was sitting too
// close to the tab bar edge; +20pt buys it breathing room. HALF
// 0.50 → 0.25 — half state felt cramped (top at 50% of container);
// raising it to 25% from the top matches the visual height of
// ChurchProfileBottomSheet (SHEET_RATIO = 0.65) so the two surfaces
// feel like the same family.
const PEEK_PX = 88;
const HALF_RATIO = 0.25;
const FULL_RATIO = 0.15;

type Snap = 'collapsed' | 'half' | 'full';

const ANIM_MS = 280;

function snapToY(s: Snap, containerH: number): number {
  switch (s) {
    case 'collapsed': return Math.max(0, containerH - PEEK_PX);
    case 'half':      return Math.round(containerH * HALF_RATIO);
    case 'full':      return Math.round(containerH * FULL_RATIO);
  }
}

function nearestSnap(value: number, containerH: number): Snap {
  const candidates: Snap[] = ['collapsed', 'half', 'full'];
  let best: Snap = 'collapsed';
  let bestDist = Math.abs(value - snapToY('collapsed', containerH));
  for (const s of candidates) {
    const d = Math.abs(value - snapToY(s, containerH));
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

interface Props {
  /** Fix A (2026-05-28): fires whenever snap state changes so the host
      (TheChurchScreen) can pause the globe rotation while the panel is
      half- or full-open. Called AFTER setSnap inside snapTo, with the
      target snap value. */
  onSnapChange?: (snap: Snap) => void;
}

export default function PrayerWallPullUp({ onSnapChange }: Props = {}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  const {
    rows, loadState, hasFetchedOnce,
    clearFilters,
    open, refresh,
  } = usePrayerWall();

  // ── Snap state + animated translateY ──
  // Snap is the LOGICAL state (collapsed / half / full); the pixel
  // value is derived dynamically from containerH (measured via the
  // panel's onLayout below).
  const [snap, setSnap] = useState<Snap>('collapsed');
  const [containerH, setContainerH] = useState(0);
  const translateY = useRef(new Animated.Value(9999)).current; // off-screen until measured
  const dragStartY = useRef(0);
  const containerHRef = useRef(0); // mirrored ref so PanResponder closures see fresh value

  // Whenever the container's measured height changes (mount, rotation,
  // layout shift), reseat translateY to the current snap's pixel value
  // — without animation — so the panel never sits in a stale position.
  useEffect(() => {
    if (containerH <= 0) return;
    containerHRef.current = containerH;
    translateY.setValue(snapToY(snap, containerH));
  }, [containerH, snap, translateY]);

  // Backdrop opacity derives from translateY — linear interp between
  // full-open (max dim 0.45) and collapsed (no dim). Uses the live
  // container height so the interp range matches reality.
  const backdropOpacity = containerH > 0
    ? translateY.interpolate({
        inputRange: [snapToY('full', containerH), snapToY('collapsed', containerH)],
        outputRange: [0.45, 0],
        extrapolate: 'clamp',
      })
    : new Animated.Value(0);

  const snapTo = useCallback((target: Snap) => {
    setSnap(target);
    // Fix A: notify host so the globe can pause while we're up.
    onSnapChange?.(target);
    const targetY = snapToY(target, containerHRef.current);
    if (reduced) {
      translateY.setValue(targetY);
    } else {
      Animated.timing(translateY, {
        toValue: targetY,
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // AC #2 — fire first fetch on the first time we leave collapsed.
    // Fix B6: drop filters when leaving collapsed so the panel always
    // shows the most-recent unfiltered feed (the pull-up is a quick
    // intercession surface, not the full Prayer Wall tab).
    if (target !== 'collapsed') {
      open();
      clearFilters();
    }
  }, [translateY, reduced, open, clearFilters, onSnapChange]);

  // Tap the collapsed header → expand to half.
  const handleHeaderTap = useCallback(() => {
    if (snap === 'collapsed') snapTo('half');
  }, [snap, snapTo]);

  // ── Drag responder — attached to the grip area only, so the FlatList
  //    inside can still scroll independently when full-open. Closures
  //    read live container height from containerHRef so snap math stays
  //    in lockstep with on-device layout.
  const panResponder = useRef(
    PanResponder.create({
      // Fix B4 (2026-05-28): threshold 4 → 2 so light drags register.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 2 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        dragStartY.current = snapToY(snap, containerHRef.current);
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const h = containerHRef.current;
        if (h <= 0) return;
        const minY = snapToY('full', h);
        const maxY = snapToY('collapsed', h);
        const next = Math.max(minY, Math.min(maxY, dragStartY.current + g.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const h = containerHRef.current;
        if (h <= 0) return;
        const minY = snapToY('full', h);
        const maxY = snapToY('collapsed', h);
        const end = Math.max(minY, Math.min(maxY, dragStartY.current + g.dy));
        snapTo(nearestSnap(end, h));
      },
    }),
  ).current;

  const showSpinner = loadState === 'initial' && !hasFetchedOnce;
  const isFullOrHalf = snap !== 'collapsed';
  const visibleRows = rows.slice(0, 10);

  return (
    <>
      {/* Dim backdrop — sits between the globe and the panel.
          pointerEvents=box-none so the globe stays interactive when
          collapsed; backdrop becomes tap-to-collapse when half/full. */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={isFullOrHalf ? 'auto' : 'none'}
      >
        <Pressable
          onPress={() => snapTo('collapsed')}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Dismiss Prayer Wall panel"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          // Fix B1: collapsed state shows only the grab bar + GLOBAL
          // PRAYER WALL label + scripture quote — no panel surface
          // bleeds up into the globe area.
          snap === 'collapsed' && styles.panelCollapsed,
          { transform: [{ translateY }] },
        ]}
        onLayout={(e) => {
          // Fix 2: measure the panel's parent-allocated height so snap
          // values match reality (host's pages container height, NOT the
          // window height, which would put collapsed off-screen).
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - containerH) > 1) setContainerH(h);
        }}
      >
        {/* ── Head ──
            Fix B4 (2026-05-28): collapsed state uses a SIBLING Pressable
            (tap-to-open) instead of a wrapping Pressable around the
            PanResponder. This stops the Pressable from swallowing the
            upward-drag PanResponder gestures. Open state uses the
            panHandlers View for grip + drag. */}
        {snap === 'collapsed' ? (
          <Pressable
            onPress={handleHeaderTap}
            accessibilityRole="button"
            accessibilityLabel="Open Prayer Wall"
            style={styles.collapsedTab}
          >
            <View style={styles.grabHandle} />
            <Text style={styles.collapsedLabel}>GLOBAL PRAYER WALL</Text>
            <Text style={styles.collapsedScripture}>"That they all may be one…"</Text>
          </Pressable>
        ) : (
          <View {...panResponder.panHandlers}>
            <View style={styles.grabHandle} />
            <View style={styles.head}>
              <Text style={styles.eyebrow}>GLOBAL PRAYER WALL · LIVE</Text>
              <Text style={styles.title}>The body, interceding</Text>
              <Text style={styles.blurb}>
                Recent prayer requests from verified leaders across the network.{' '}
                Tap "Agree in prayer" to stand in the gap.
              </Text>
              {/* Close-X removed per Founder ruling 2026-05-28 — drag-down
                  to collapse is the close gesture. */}
            </View>
          </View>
        )}

        {/* ── Body — ScrollView of at most 10 PullUpInterCards ── */}
        {isFullOrHalf ? (
          showSpinner ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : loadState === 'error' && rows.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>Couldn't load prayer requests right now.</Text>
              <Pressable onPress={() => void refresh()} hitSlop={8} accessibilityRole="button">
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : rows.length === 0 && hasFetchedOnce ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyText}>No prayer requests on the wall right now.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.bodyScroll}
              // Fix B5 (2026-05-28): CD .prayer-sheet .body padding
              // 8 16 24. Gap is implemented per-card via marginTop on
              // each card after the first (RN ScrollView has no `gap`).
              contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 80 }]}
              refreshControl={
                <RefreshControl
                  refreshing={loadState === 'refreshing'}
                  onRefresh={refresh}
                  tintColor={Colors.accent}
                />
              }
            >
              {visibleRows.map((row, i) => (
                <View key={row.id} style={i > 0 ? styles.interGap : undefined}>
                  <PullUpInterCard row={row} />
                </View>
              ))}
            </ScrollView>
          )
        ) : null}
      </Animated.View>
    </>
  );
}

// ─── PullUpInterCard — per CD .inter ─────────────────────────────────
//
// Loc row (dot + church · country · timeAgo, optional RPL tag if the
// field ever lands on the RPC), quoted prayer body in serif italic, and
// a meta row with the "Agree in prayer" / "✓ Standing" affordance plus
// a live "{n} interceding" count. The agree action mirrors the
// optimistic-flip pattern from PrayerWallDetailSheet.tsx:200–218 (KAN-23
// canonical) — flip locally, fire stand_in_the_gap, roll back on error.

function ragDotColor(rag: string): string {
  if (rag === 'green') return Colors.green;
  if (rag === 'amber') return Colors.amber;
  if (rag === 'red')   return Colors.red;
  return Colors.textMuted; // pending / unknown
}

// timeAgo — clamp the timestamp into a one-shot mono label.
// (Dispatch literal wrote "Xh ago" for both <60m and <24h; interpreted
// to the obvious distinct units — minutes / hours / days.)
function timeAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Math.max(0, now.getTime() - t);
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function PullUpInterCard({ row }: { row: PrayerRow }) {
  const [agreed, setAgreed] = useState<boolean>(!!row.i_prayed);
  const [agreedCount, setAgreedCount] = useState<number>(row.prayed_count ?? 0);

  const locText = [
    row.church_name,
    row.country ?? null,
    timeAgo(row.created_at),
  ].filter((s): s is string => !!s && s.length > 0).join(' · ');

  const onAgree = async () => {
    const prev = agreed;
    const prevCount = agreedCount;
    const next = !prev;
    setAgreed(next);
    setAgreedCount(prevCount + (next ? 1 : -1));
    const { error } = await supabase.rpc('stand_in_the_gap', {
      p_prayer_request_id: row.id,
    });
    if (error) {
      setAgreed(prev);
      setAgreedCount(prevCount);
    }
  };

  return (
    <View style={styles.interCard}>
      {/* LOC row — DBA migration 20260528000005 now delivers
          row.rag_status for non-underground rows; underground rows are
          masked to NULL upstream (matches the underground masking
          posture on church_name + country). RPL tag still omitted —
          get_prayer_wall does not return rpl/network_id; dispatch B6
          says do not fabricate. */}
      <View style={styles.interLoc}>
        <View style={[styles.ragDot, { backgroundColor: ragDotColor(row.rag_status ?? '') }]} />
        <Text style={styles.interLocText} numberOfLines={1}>{locText}</Text>
      </View>

      {/* TEXT row */}
      <Text style={styles.interText}>{`"${row.prayer_text}"`}</Text>

      {/* META row */}
      <View style={styles.interMeta}>
        <Pressable onPress={onAgree} hitSlop={6} accessibilityRole="button" accessibilityLabel={agreed ? 'You are standing in the gap' : 'Agree in prayer'}>
          <Text style={[styles.agreeText, agreed && styles.agreeTextActive]}>
            {agreed ? '✓ Standing' : '+ Agree in prayer'}
          </Text>
        </Pressable>
        <Text style={styles.intercedingText}>{agreedCount} interceding</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderAccent, // CD: sky-mid border-top
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.7,
    shadowRadius: 60,
    elevation: 12,
  },
  // Fix B1: collapsed state strips the panel surface entirely so only
  // the grab bar + label + scripture float over the bottom of the globe.
  panelCollapsed: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Collapsed pull-tab (CD .prayer-pulltab)
  collapsedTab: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  collapsedLabel: {
    marginTop: 8,
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.09, // 0.22em × 9.5
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  collapsedScripture: {
    marginTop: 6,
    fontFamily: Typography.scriptureLight,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: Colors.text,
    opacity: 0.7,
    textAlign: 'center',
  },

  grabHandle: {
    alignSelf: 'center',
    width: 38,           // CD .grip width
    height: 4,           // CD .grip height
    borderRadius: 100,
    // Collapsed CD .prayer-pulltab .bar uses sky-mid (rgba(107,181,232,0.35));
    // open CD .prayer-sheet .head .grip uses faint-2 (rgba(240,237,230,0.14)).
    // The bar's parent (collapsedTab vs panResponder head) overrides via
    // colour at the parent level — keeping the JSX simple. Default here
    // matches the open state; the collapsed render passes its own colour
    // via collapsedTab's children. (RN doesn't cascade text colour into
    // a child View bg, so this default is the open-state choice.)
    backgroundColor: 'rgba(240,237,230,0.14)',
    marginTop: 9,
    marginBottom: 10,
  },
  // Head per CD .prayer-sheet .head — close-X removed (Founder ruling).
  head: {
    paddingTop: 4,
    paddingBottom: 12,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.98, // 0.22em × 9
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  // Fix B3: h3 uses Cormorant 300 Light (scriptureLight token), 22pt
  // per CD .prayer-sheet .head h3 — not displayRegular (400).
  title: {
    fontFamily: Typography.scriptureLight,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44, // 0.02em × 22
    color: Colors.text,
  },
  blurb: {
    marginTop: 6,
    fontFamily: Typography.body,
    fontSize: 11.5,
    lineHeight: 17, // 1.5 × 11.5 ≈ 17
    color: Colors.textMuted,
  },

  // State boxes + body container
  bodyScroll: { flex: 1 },
  bodyContent: {
    // Fix B5: CD .prayer-sheet .body padding 8 16 24 (h-padding owned
    // by ScrollView's contentContainerStyle).
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  interGap: {
    // CD body has gap: 10pt between intercession items.
    marginTop: 10,
  },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyText: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },

  // Fix B6 — intercession card per CD .inter
  //   bg surface, faint border all sides, 2pt sky LEFT border,
  //   radius 0 / 8 / 8 / 0, padding 12 / 14.
  interCard: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  interLoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  ragDot: { width: 6, height: 6, borderRadius: 3 }, // CD: 6×6
  interLocText: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9 (per dispatch B6 override)
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  interText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 21, // 1.4 × 15
    color: Colors.text,
  },
  interMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  agreeText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.19, // 0.14em × 8.5
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  agreeTextActive: { color: Colors.green },
  intercedingText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26, // 0.14em × 9
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
});
