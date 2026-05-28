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
  FlatList,
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
import { useAuth } from '../../contexts/AuthProvider';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { useViewerChurch } from '../../hooks/useViewerChurch';
import { usePrayerWall } from '../../hooks/usePrayerWall';
import {
  CATEGORIES,
  URGENCY_FILTERS,
  type PrayerCategory,
  type PrayerRow,
} from '../prayer/PrayerWallLogic';
import PrayerWallCard from '../prayer/PrayerWallCard';
import PostPrayerRequestModal from './PostPrayerRequestModal';

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
const TOAST_MS = 3000;

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

export default function PrayerWallPullUp() {
  const { branch } = useAuth();
  const viewerVerified = branch === 'active';
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { church } = useViewerChurch();

  const {
    rows, loadState, hasFetchedOnce, hasMore,
    selectedCategories, urgency,
    toggleCategory, setUrgency, clearFilters,
    open, refresh, loadMore,
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
    if (target !== 'collapsed') open();
  }, [translateY, reduced, open]);

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

  // ── Post-a-Request modal + success toast ──
  const [postOpen, setPostOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        () => setToast(null),
      );
    }, TOAST_MS);
  }, [toastOpacity]);

  const handlePostSuccess = useCallback(() => {
    setPostOpen(false);
    flashToast('Your request has been lifted to the wall.');
    // AC #14 — new request appears after pull-to-refresh, not injected.
  }, [flashToast]);

  // ── Render helpers ──
  const renderCard = useCallback(({ item }: { item: PrayerRow }) => (
    <PrayerWallCard row={item} onPress={() => { /* tap-to-expand sheet is out of scope here */ }} />
  ), []);

  const keyExtractor = useCallback((r: PrayerRow) => r.id, []);

  const showSpinner = loadState === 'initial' && !hasFetchedOnce;
  const isFullOrHalf = snap !== 'collapsed';

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
        {/* ── Grip + header (drag region) ── */}
        <View {...panResponder.panHandlers}>
          <Pressable onPress={handleHeaderTap} accessibilityRole="button" accessibilityLabel="Open Prayer Wall">
            <View style={styles.grabHandle} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Prayer Wall</Text>
              {viewerVerified ? (
                <Pressable
                  onPress={() => setPostOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Post a prayer request"
                  style={styles.postBtn}
                >
                  <Text style={styles.postBtnText}>+ Post a Request</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>

          {/* Filter rows — category + urgency.  Hidden when collapsed
              (no point showing chips that are 80pt below the fold). */}
          {isFullOrHalf ? (
            <View style={styles.filterBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                keyboardShouldPersistTaps="handled"
              >
                <FilterPill
                  label="All"
                  active={selectedCategories.size === 0}
                  onPress={() => clearFilters()}
                />
                {CATEGORIES.map((c) => (
                  <FilterPill
                    key={c}
                    label={c}
                    active={selectedCategories.has(c)}
                    onPress={() => toggleCategory(c as PrayerCategory)}
                  />
                ))}
              </ScrollView>

              <View style={styles.urgencyRow}>
                {URGENCY_FILTERS.map((u) => (
                  <FilterPill
                    key={u}
                    label={u === 'Urgent' ? 'Urgent only' : u}
                    active={urgency === u}
                    onPress={() => setUrgency(u)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── List body ── */}
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
              <Text style={styles.emptyText}>No prayer requests match this filter.</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              renderItem={renderCard}
              keyExtractor={keyExtractor}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              refreshControl={
                <RefreshControl
                  refreshing={loadState === 'refreshing'}
                  onRefresh={refresh}
                  tintColor={Colors.accent}
                />
              }
              ListFooterComponent={
                loadState === 'paging' ? (
                  <View style={styles.footerSpinner}>
                    <ActivityIndicator color={Colors.accent} />
                  </View>
                ) : null
              }
            />
          )
        ) : null}
      </Animated.View>

      {/* Post-a-Request modal */}
      <PostPrayerRequestModal
        visible={postOpen}
        churchName={church?.name ?? null}
        isUnderground={!!church?.isUnderground}
        onCancel={() => setPostOpen(false)}
        onSuccess={handlePostSuccess}
      />

      {/* Toast */}
      {toast ? (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 88 }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  // Sky-blue underline on active chip per AC #6/#7. Inactive chips are
  // text-only with muted color; active gets the sky underline + sky text.
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={styles.filterPill}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
      <View style={[styles.filterUnderline, active && styles.filterUnderlineActive]} />
    </Pressable>
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
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerTitle: { fontFamily: Typography.display, fontSize: 20, color: Colors.text },
  postBtn: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: 'rgba(107,181,232,0.14)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderAccent,
  },
  postBtnText: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.accent, letterSpacing: 0.3 },

  filterBar: {
    paddingTop: 4, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  filterRow: { paddingHorizontal: 14, gap: 4, alignItems: 'center' },
  urgencyRow: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 6,
  },
  filterPill: { paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  filterPillText: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted },
  filterPillTextActive: { color: Colors.accent, fontFamily: Typography.bodyMedium },
  filterUnderline: { marginTop: 3, height: 2, width: '100%', backgroundColor: 'transparent', borderRadius: 1 },
  filterUnderlineActive: { backgroundColor: Colors.accent },

  listContent: { paddingHorizontal: 14, paddingTop: 14 },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyText: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  errorText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  retryText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.5, color: Colors.accent, textTransform: 'uppercase' },
  footerSpinner: { paddingVertical: 16, alignItems: 'center' },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999,
    backgroundColor: 'rgba(8,8,8,0.92)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  toastText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.text },
});
