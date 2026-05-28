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
import { XIcon } from '../prayer/PrayerIcons';

// Fix 2 (2026-05-28): module-level Dimensions.get('window').height was
// previously used to compute SNAP_COLLAPSED, which translated the panel
// far below its actual parent (the pages container is ~681pt on iPhone
// 16 Pro Max after subtracting safe-area top + tc-header + tab bar) —
// the collapsed handle disappeared off-screen. Snap heights are now
// computed from the panel's MEASURED parent height via onLayout, so the
// math is always correct regardless of host layout.
const PEEK_PX = 76;          // collapsed: handle + label peek above bottom
const HALF_RATIO = 0.50;
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
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
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
        style={[styles.panel, { transform: [{ translateY }] }]}
        onLayout={(e) => {
          // Fix 2: measure the panel's parent-allocated height so snap
          // values match reality (host's pages container height, NOT the
          // window height, which would put collapsed off-screen).
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - containerH) > 1) setContainerH(h);
        }}
      >
        {/* ── Head per CD .prayer-sheet .head ── */}
        <View {...panResponder.panHandlers}>
          <Pressable onPress={handleHeaderTap} accessibilityRole="button" accessibilityLabel="Open Prayer Wall">
            <View style={styles.grabHandle} />
            {isFullOrHalf ? (
              <View style={styles.head}>
                <Text style={styles.eyebrow}>GLOBAL PRAYER WALL · LIVE</Text>
                <Text style={styles.title}>The body, interceding</Text>
                <Text style={styles.blurb}>
                  Recent prayer requests from verified leaders across the network.{' '}
                  Tap "Agree in prayer" to stand in the gap.
                </Text>
                {/* Close-X — CD positions at top:22 right:18 of head */}
                <Pressable
                  onPress={() => snapTo('collapsed')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close Prayer Wall"
                  style={styles.closeX}
                >
                  <XIcon size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </View>

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
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              refreshControl={
                <RefreshControl
                  refreshing={loadState === 'refreshing'}
                  onRefresh={refresh}
                  tintColor={Colors.accent}
                />
              }
            >
              {visibleRows.map((row) => (
                <PullUpInterCard key={row.id} row={row} />
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
      {/* LOC row */}
      <View style={styles.interLoc}>
        {/* Dispatch B4 maps the dot color to the church's rag_status,
            but PrayerRow does not carry rag_status — get_prayer_wall
            returns church_type + urgency only, not the source church's
            RAG. Per dispatch fallback ('else → Colors.textMuted') the
            dot renders neutral here. TODO(DBA): add rag_status to
            get_prayer_wall so the dot can carry meaning on this
            surface; until then we don't fabricate a colour. */}
        <View style={[styles.ragDot, { backgroundColor: ragDotColor('') }]} />
        <Text style={styles.interLocText} numberOfLines={1}>{locText}</Text>
        {/* RPL tag intentionally omitted — get_prayer_wall does not
            return rpl/network_id today. Per dispatch B4: do not
            fabricate. Add the field once the RPC supplies it. */}
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
    // Fix B1 (2026-05-28): CD .prayer-sheet bg is var(--bg) — the dark
    // base — not the elevated surface.
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderAccent, // CD: sky-mid border-top
    borderTopLeftRadius: 22, // CD: 22px corners
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.7,
    shadowRadius: 60,
    elevation: 12,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(240,237,230,0.22)',
    marginTop: 9,
    marginBottom: 10,
  },
  // Head per CD .prayer-sheet .head (with dispatch overrides on h3 size
  // 20 + blurb 12pt). Close-X positioned absolute to the head.
  head: {
    paddingTop: 4, paddingBottom: 12,
    paddingHorizontal: 18,
    paddingRight: 50, // room for absolute closeX
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2, // ~0.22em × 9
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.4, // 0.02em × 20
    color: Colors.text,
  },
  blurb: {
    marginTop: 6,
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  closeX: {
    position: 'absolute',
    top: 22, right: 18,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },

  // State boxes
  bodyScroll: { flex: 1 },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyText: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },

  // Intercession card per CD .inter (dispatch B4 row paddings)
  interCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  interLoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  ragDot: { width: 7, height: 7, borderRadius: 3.5 },
  interLocText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  interText: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.text,
  },
  interMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  agreeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
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
