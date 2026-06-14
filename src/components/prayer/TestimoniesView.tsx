// ─────────────────────────────────────────────
// TestimoniesView — KAN-23 v2 (Ticket D)
//
// Full testimonies feed inside the Prayer Wall tab. Reached from the
// segmented control (Feed ↔ Testimonies), or via deep-link from the
// landing rotator (tap a testimony → arrive here with the target
// scrolled into view and a 1.6 s glow on the card).
//
// Scripture: Rev 12:11 KJV in full at the top. NEVER truncated.
// Reduced motion still keeps the scripture rendered — the rule applies
// to the Word, not to animation.
//
// Data: supabase.rpc('get_testimonies', { page_offset }) — 10 per
// page. Infinite scroll triggers at 80% depth (FlatList
// onEndReachedThreshold 0.2 since RN measures from bottom).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  TESTIMONY_PAGE_SIZE,
  type TestimonyRow,
} from './PrayerWallLogic';
import TestimonyCard from './TestimonyCard';
import TestimonyDetailSheet from './TestimonyDetailSheet';
import ScriptureBanner from './ScriptureBanner';

// Rev 12:11 (KJV) — locked in full. NEVER truncate.
const REV_12_11_KJV =
  'And they overcame him by the blood of the Lamb, and by the word of their testimony; and they loved not their lives unto the death.';
const REV_12_11_REF = 'REVELATION 12:11 · KJV';

type LoadState = 'initial' | 'paging' | 'idle' | 'error';

interface Props {
  /** When set on entry, scroll that testimony into view and pulse-glow it. */
  deepLinkTestimonyId: string | null;
  /** Notifies the parent the deep-link has been consumed so subsequent
   *  visits don't re-glow the same card. */
  onDeepLinkConsumed: () => void;
  /** v6 Fix G — selected testimony for the bottom sheet, owned at the
   *  screen level so it can be cleared on tab blur. Null when no
   *  sheet is open. */
  selectedTestimony: TestimonyRow | null;
  onSelectTestimony: (row: TestimonyRow | null) => void;
  /** v7 Fix 09 — testimony rows hoisted to PrayerWallScreen so the
   *  optimistic Rejoice state survives view switches AND tab blur
   *  (this view unmounts on segmented-control switch; the screen
   *  doesn't). Pull-to-refresh + initial fetch use setRows to
   *  populate; the screen also passes a stable hasFetchedOnce ref
   *  so we don't refetch on every re-mount. */
  rows: TestimonyRow[];
  setRows: React.Dispatch<React.SetStateAction<TestimonyRow[]>>;
  hasFetchedOnce: React.MutableRefObject<boolean>;
  /** v6 Fix G + v7 Fix 09 — onCelebratedChange propagation. Lives at
   *  the screen so the row swap persists across view-switch unmounts. */
  onCelebratedChange: (id: string, iCelebrated: boolean, count: number) => void;
  /** Routes the leader to their open prayers (MyOpenPrayersView) where
   *  Mark-as-Praise is the canonical publish-testimony path. */
  onPublishTestimony?: () => void;
}

export default function TestimoniesView({
  deepLinkTestimonyId,
  onDeepLinkConsumed,
  selectedTestimony,
  onSelectTestimony,
  rows,
  setRows,
  hasFetchedOnce,
  onCelebratedChange,
  onPublishTestimony,
}: Props) {
  const [loadState, setLoadState] = useState<LoadState>(
    hasFetchedOnce.current ? 'idle' : 'initial',
  );
  const [hasMore, setHasMore] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showFromLandingPill, setShowFromLandingPill] = useState(false);
  const listRef = useRef<FlatList<TestimonyRow> | null>(null);
  const pillFade = useRef(new Animated.Value(0)).current;

  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await supabase.rpc('get_testimonies', {
      page_offset: offset,
    });
    if (error) return { rows: [] as TestimonyRow[], error: error.message };
    return { rows: (data ?? []) as TestimonyRow[], error: null };
  }, []);

  const loadInitial = useCallback(async () => {
    setLoadState('initial');
    const { rows: page, error } = await fetchPage(0);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(page);
    setHasMore(page.length === TESTIMONY_PAGE_SIZE);
    setLoadState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, setRows, hasFetchedOnce]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const { rows: page, error } = await fetchPage(rows.length);
    if (error) {
      setLoadState('idle');
      return;
    }
    if (page.length === 0) setHasMore(false);
    else {
      setRows((prev) => [...prev, ...page]);
      setHasMore(page.length === TESTIMONY_PAGE_SIZE);
    }
    setLoadState('idle');
  }, [fetchPage, hasMore, loadState, rows.length]);

  // v7 Fix 09 — only fetch on first mount across the screen's
  // lifetime. If the screen-level hasFetchedOnce ref is already true
  // (we navigated away and back), reuse the rows + skip the network.
  // This preserves optimistic Rejoice state across view switches.
  useEffect(() => {
    if (!hasFetchedOnce.current) {
      void loadInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link arrival — scroll the target testimony into view and
  // pulse-glow it for 1.6 s. The "From landing" pill fades out 2.0 s
  // after arrival.
  useEffect(() => {
    if (deepLinkTestimonyId === null) return;
    if (rows.length === 0) return; // wait for first page
    const idx = rows.findIndex((r) => r.id === deepLinkTestimonyId);
    if (idx === -1) {
      // Target not on first page — for v1 we accept this and just
      // mark consumed. Pagination-aware scroll-to is a future polish.
      onDeepLinkConsumed();
      return;
    }
    setHighlightedId(deepLinkTestimonyId);
    setShowFromLandingPill(true);
    // Scroll to target. viewOffset adds a 16 pt cushion under the
    // scripture / pill so the target lands below them, not under.
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewOffset: 16 });
    });
    Animated.timing(pillFade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const fadeT = setTimeout(() => {
      Animated.timing(pillFade, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setShowFromLandingPill(false));
    }, 2000);
    onDeepLinkConsumed();
    return () => clearTimeout(fadeT);
  }, [deepLinkTestimonyId, rows, onDeepLinkConsumed, pillFade]);

  // v7 Fix 09 — handleCelebratedChange now lives on PrayerWallScreen
  // (passed in via onCelebratedChange prop) so the row swap persists
  // across this view's mount/unmount cycles.

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <TestimonyCard
            row={item}
            isHighlighted={item.id === highlightedId}
            onPress={onSelectTestimony}
            green
          />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ScriptureHeader pillVisible={showFromLandingPill} pillOpacity={pillFade} />
        }
        ListEmptyComponent={
          loadState === 'idle' && hasFetchedOnce.current ? <EmptyState onPublish={onPublishTestimony} /> : null
        }
        ListFooterComponent={
          loadState === 'paging' ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : loadState === 'initial' && !hasFetchedOnce.current ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        onScrollToIndexFailed={() => {
          // Defensive — RN occasionally fails scrollToIndex when the
          // target hasn't measured yet. Drop the deep-link glow request
          // silently rather than crash.
          setHighlightedId(null);
        }}
      />
      <TestimonyDetailSheet
        row={selectedTestimony}
        onDismiss={() => onSelectTestimony(null)}
        onCelebratedChange={onCelebratedChange}
      />
    </View>
  );
}

function ScriptureHeader({
  pillVisible,
  pillOpacity,
}: {
  pillVisible: boolean;
  pillOpacity: Animated.Value;
}) {
  // KAN-23 R3 — props retained for call-site parity (TestimoniesView
  // still computes and passes them so the scroll-to-testimony deep-
  // link state stays intact), but the pill render is gone. void-
  // reference both so the unused-param read doesn't trip lint and
  // future re-introduction stays a one-line edit.
  void pillVisible; void pillOpacity;
  // v8 Fix A — Rev 12:11 flips to tone="none" (no fill, no border).
  // Body 20 pt 300 Light Italic rgba(text, 0.78); reference 11 pt
  // DM Sans 0.18em GREEN-tinted (rgba(green, 0.70)). NEVER truncates.
  // Block padding 24/24/20 + margin above 16 (below segmented
  // control) + margin below 20 (above first testimony card) — set
  // by styles.headerWrap.
  //
  // KAN-23 R3 — "From landing" pill removed from render. The
  // pillVisible / pillOpacity props stay on this component (and the
  // showFromLandingPill state + pillFade Animated.Value + setTimeout
  // fade cycle stay in TestimoniesView) so the deep-link scroll-into-
  // view + glow path remains intact — the fade just no longer paints
  // anything. The pill itself was carrying no information the leader
  // needed: arriving from the landing was already obvious from the
  // testimony being glowed and scrolled into view.
  // Prayer Wall redesign — Testimonies pill takes the green register.
  // Reference tinted green (Rev 12:11) to match the green card chrome.
  return (
    <View style={styles.headerWrap}>
      <ScriptureBanner
        tone="none"
        text={REV_12_11_KJV}
        reference={REV_12_11_REF}
        bodyFontSize={17}
      />
    </View>
  );
}

function EmptyState({ onPublish }: { onPublish?: () => void }) {
  return (
    <View style={styles.emptyState}>
      {/* Sprout icon removed from this surface per Founder ruling
          2026-06-10 — only the "Testimonies from the wall" empty state
          on PrayerWallLanding keeps the glyph. */}
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Testify of His mighty works.</Text>
        <Text style={styles.emptyBody}>
          As the Lord moves on our behalf, we share them here. Be the first to give Him praise!
        </Text>
      </View>
      {onPublish && (
        <Pressable
          onPress={onPublish}
          accessibilityRole="button"
          accessibilityLabel="Publish a testimony"
          style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
          hitSlop={6}
        >
          <Text style={styles.emptyCtaLabel}>PUBLISH A TESTIMONY</Text>
        </Pressable>
      )}
    </View>
  );
}

function Separator() {
  // v6 fix E — card-to-card gap 8 → 20 pt.
  return <View style={{ height: 20 }} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  headerWrap: {
    // v8 Fix A — ScriptureBanner is now tone="none" and owns its
    // own 24/20 block padding. Wrap supplies outer margins only:
    //   16 pt above (below the segmented control — list parent's
    //                paddingTop: 8 + this marginTop: 8 = 16)
    //   20 pt below (above the first testimony card)
    marginTop: 8,
    marginBottom: 20,
  },
  // KAN-23 R3 — fromLandingPill + fromLandingPillText styles removed
  // alongside the pill render. The scroll-to-testimony + glow deep-link
  // path still fires; only the "From landing" pill chrome is gone.
  footerSpinner: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyGlyphCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.17,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 4,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 6,
    alignItems: 'center',
  },
  emptyCtaPressed: { opacity: 0.7 },
  emptyCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.61,
    color: Colors.accent,
  },
});
