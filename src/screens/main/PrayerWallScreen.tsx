// ─────────────────────────────────────────────
// PrayerWallScreen — KAN-23 v2 (Step 8)
//
// View-state switcher inside a single tab screen. Four views:
//   landing         → PrayerWallLanding (Eph 6:18 scripture + 2 action
//                     cards + quick-link + testimony rotator)
//   feed            → top bar + segmented control (Feed/Testimonies)
//                     + multi-axis filter bar + paginated card list +
//                     detail sheet
//   testimonies     → top bar + segmented control + Rev 12:11 scripture
//                     + testimony list (with optional deep-link glow)
//   my_open_prayers → top bar + own-church prayer cards + overflow
//                     menu / stubbed write actions
//
// Filtering is server-side in v2 — the screen calls
// supabase.rpc('get_prayer_wall', { page_offset, filter_urgent,
// filter_categories }) and resets to offset 0 on any filter change.
// No client-side applyFilters call survives from v1.
//
// useFocusEffect cleanup on tab blur resets:
//   - view → 'landing'
//   - filter axes → defaults
//   - detail sheet target → null
//   - testimony deep-link id → null
// So a leader returning to the tab lands on the wide-open default view.
//
// Post CTA (top-right "+ Post" on the feed top bar) renders only for
// verified leaders — pending leaders see read-only feed + filters.
// Tapping the CTA surfaces a "coming soon" Alert; the posting flow is
// a separate ticket.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { useHamburger } from '../../contexts/HamburgerContext';
import PrayerWallCard from '../../components/prayer/PrayerWallCard';
import PrayerWallDetailSheet from '../../components/prayer/PrayerWallDetailSheet';
import PrayerWallFilterBar from '../../components/prayer/PrayerWallFilterBar';
import PrayerWallLanding from '../../components/prayer/PrayerWallLanding';
import PrayerWallSegmentedControl from '../../components/prayer/PrayerWallSegmentedControl';
import ScriptureBanner from '../../components/prayer/ScriptureBanner';
import TestimoniesView from '../../components/prayer/TestimoniesView';
import MyOpenPrayersView from '../../components/prayer/MyOpenPrayersView';
import {
  DEFAULT_URGENCY,
  PAGE_SIZE,
  buildRpcFilters,
  type PrayerCategory,
  type PrayerRow,
  type SelectedCategories,
  type UrgencyFilter,
} from '../../components/prayer/PrayerWallLogic';

type PrayerWallView = 'landing' | 'feed' | 'testimonies' | 'my_open_prayers';
type LoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

const SKELETON_COUNT = 3;

// v7 Fix 01 — Philippians 4:6 (KJV) rendered above the first prayer
// card via the FlatList ListHeaderComponent. Floating (tone="none"),
// 18 pt body per Item 11 (smaller than the 20 pt landing/testimonies
// banners — the feed has cards directly below and shouldn't crowd
// itself). NEVER truncated.
const PHIL_4_6_KJV =
  'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.';
const PHIL_4_6_REF = 'PHILIPPIANS 4:6 · KJV';

async function fetchPage(
  offset: number,
  filterUrgent: boolean | null,
  filterCategories: string[] | null,
): Promise<{ rows: PrayerRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_prayer_wall', {
    page_offset: offset,
    filter_urgent: filterUrgent,
    filter_categories: filterCategories,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PrayerRow[], error: null };
}

export default function PrayerWallScreen() {
  const { branch } = useAuth();
  const isVerified = branch === 'active';
  const { open: openHamburger } = useHamburger();

  const [view, setView] = useState<PrayerWallView>('landing');
  const [rows, setRows] = useState<PrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategories>(
    () => new Set<PrayerCategory>(),
  );
  const [urgency, setUrgency] = useState<UrgencyFilter>(DEFAULT_URGENCY);
  const [detailRow, setDetailRow] = useState<PrayerRow | null>(null);
  const [deepLinkTestimonyId, setDeepLinkTestimonyId] = useState<string | null>(null);
  const [selectedTestimony, setSelectedTestimony] = useState<import('../../components/prayer/PrayerWallLogic').TestimonyRow | null>(null);
  // v7 Fix 09 — testimony rows hoisted to the screen so optimistic
  // Rejoice state survives view-switch unmounts of TestimoniesView.
  // The screen-level hasFetchedOnce ref stops TestimoniesView from
  // re-fetching on re-mount (which would clobber the optimistic
  // state with server-truth that doesn't yet reflect the stub RPC).
  const [testimonyRows, setTestimonyRows] = useState<
    import('../../components/prayer/PrayerWallLogic').TestimonyRow[]
  >([]);
  const testimonyHasFetchedOnce = useRef(false);

  const handleCelebratedChange = useCallback(
    (id: string, iCelebrated: boolean, celebratedCount: number) => {
      // v7 Fix 09 — same shape as the prayer-feed onPrayedChange
      // handler (commit 1bc179b). Mirror sheet-side Rejoice toggle
      // into the screen-level testimonyRows so the testimony list
      // card reflects the new state on next render, AND so the
      // state persists across view-switch unmounts.
      setTestimonyRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, i_celebrated: iCelebrated, celebrated_count: celebratedCount }
            : r,
        ),
      );
    },
    [],
  );
  const hasFetchedOnce = useRef(false);
  const listRef = useRef<FlatList<PrayerRow> | null>(null);

  // Toggle a category in/out of the selected Set. Always returns a new
  // Set instance so React re-renders consumers (Set identity is the
  // change signal; mutating in place would not trip dependency arrays).
  const handleCategoryToggle = useCallback((cat: PrayerCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // ─── Feed loaders ─────────────────────────────────────────────────

  const loadInitial = useCallback(
    async (cats: SelectedCategories, urg: UrgencyFilter) => {
      setLoadState('initial');
      const { filter_urgent, filter_categories } = buildRpcFilters(cats, urg);
      const { rows: page, error } = await fetchPage(0, filter_urgent, filter_categories);
      hasFetchedOnce.current = true;
      if (error) {
        setLoadState('error');
        return;
      }
      setRows(page);
      setHasMore(page.length === PAGE_SIZE);
      setLoadState('idle');
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoadState('refreshing');
    const { filter_urgent, filter_categories } = buildRpcFilters(selectedCategories, urgency);
    const { rows: page, error } = await fetchPage(0, filter_urgent, filter_categories);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(page);
    setHasMore(page.length === PAGE_SIZE);
    setLoadState('idle');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [selectedCategories, urgency]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const { filter_urgent, filter_categories } = buildRpcFilters(selectedCategories, urgency);
    const { rows: page, error } = await fetchPage(rows.length, filter_urgent, filter_categories);
    if (error) {
      setLoadState('idle');
      return;
    }
    if (page.length === 0) setHasMore(false);
    else {
      setRows((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    }
    setLoadState('idle');
  }, [selectedCategories, urgency, hasMore, loadState, rows.length]);

  // Feed mounts on view transition to 'feed'. The fetch always runs
  // on first entry; subsequent entries within the same focus cycle
  // refresh implicitly when filters change (effect below).
  useEffect(() => {
    if (view !== 'feed') return;
    if (!hasFetchedOnce.current) {
      void loadInitial(selectedCategories, urgency);
    }
    // intentionally omits filter deps — filter-change effect handles those
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Filter changes — reset to offset 0 and refetch. Only fires while
  // the leader is on the feed view; switching to other views doesn't
  // trigger a network call here. selectedCategories identity changes
  // on every toggle (handleCategoryToggle always returns a new Set),
  // so this effect catches multi-select additions and removals.
  useEffect(() => {
    if (view !== 'feed') return;
    if (!hasFetchedOnce.current) return; // initial-load effect owns the first fetch
    void loadInitial(selectedCategories, urgency);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, urgency]);

  // Tab-blur reset — restore landing + defaults + clear deep-link
  // + clear selected testimony (v6 Fix G — testimony detail sheet
  // dismisses when the leader leaves the tab, same posture as the
  // prayer detail sheet).
  useFocusEffect(
    useCallback(() => {
      return () => {
        setView('landing');
        setSelectedCategories(new Set());
        setUrgency(DEFAULT_URGENCY);
        setDetailRow(null);
        setDeepLinkTestimonyId(null);
        setSelectedTestimony(null);
      };
    }, []),
  );

  const handleClearFilters = () => {
    setSelectedCategories(new Set());
    setUrgency(DEFAULT_URGENCY);
  };

  const handlePostPress = () => {
    Alert.alert(
      'Posting a prayer request',
      'This is coming in a future update. Thank you for wanting to lift up your church.',
    );
  };

  // ─── View routing ────────────────────────────────────────────────

  if (view === 'landing') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Prayer Wall</Text>
          <Pressable
            onPress={openHamburger}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            accessibilityState={{ expanded: false }}
            hitSlop={10}
            style={styles.hamburger}
          >
            <View style={styles.hamburgerBar} />
            <View style={styles.hamburgerBar} />
            <View style={styles.hamburgerBar} />
          </Pressable>
        </View>
        {/* v6 fix B — Founder override of v5 Option A. Ship the
            0.5 pt hairline below the Prayer Wall title on the
            landing, matching Home. Only renders on this view. */}
        <View style={styles.landingHairline} />
        <PrayerWallLanding
          onEnterFeed={() => setView('feed')}
          onSeeAllTestimonies={() => setView('testimonies')}
          onOpenTestimony={(id) => {
            setDeepLinkTestimonyId(id);
            setView('testimonies');
          }}
          onViewMyOpenPrayers={() => setView('my_open_prayers')}
        />
      </SafeAreaView>
    );
  }

  if (view === 'my_open_prayers') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setView('landing')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Prayer Wall landing"
          >
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.title}>My open prayers</Text>
          <View style={styles.topBarRightPlaceholder} />
        </View>
        <MyOpenPrayersView onBackToLanding={() => setView('landing')} />
      </SafeAreaView>
    );
  }

  // 'feed' and 'testimonies' share top-bar + segmented control chrome.
  const segmentValue = view === 'feed' ? 'feed' : 'testimonies';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => setView('landing')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to Prayer Wall landing"
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Prayer Wall</Text>
        {isVerified && view === 'feed' ? (
          <Pressable
            onPress={handlePostPress}
            accessibilityRole="button"
            accessibilityLabel="Post a prayer request"
            hitSlop={8}
          >
            <Text style={styles.postCta}>+ Post</Text>
          </Pressable>
        ) : (
          <View style={styles.topBarRightPlaceholder} />
        )}
      </View>

      <PrayerWallSegmentedControl
        value={segmentValue}
        onChange={(next) => setView(next)}
      />

      {view === 'feed' ? (
        <>
          <PrayerWallFilterBar
            selectedCategories={selectedCategories}
            urgency={urgency}
            resultCount={rows.length}
            onCategoryToggle={handleCategoryToggle}
            onUrgencyChange={setUrgency}
            onClear={handleClearFilters}
          />
          {renderFeedBody({
            loadState,
            hasFetchedOnce: hasFetchedOnce.current,
            rows,
            isVerified,
            loadInitial: () => void loadInitial(selectedCategories, urgency),
            refresh,
            loadMore,
            listRef,
            onOpenDetail: setDetailRow,
            onPostPress: handlePostPress,
          })}
        </>
      ) : (
        <TestimoniesView
          deepLinkTestimonyId={deepLinkTestimonyId}
          onDeepLinkConsumed={() => setDeepLinkTestimonyId(null)}
          selectedTestimony={selectedTestimony}
          onSelectTestimony={setSelectedTestimony}
          rows={testimonyRows}
          setRows={setTestimonyRows}
          hasFetchedOnce={testimonyHasFetchedOnce}
          onCelebratedChange={handleCelebratedChange}
        />
      )}

      <PrayerWallDetailSheet
        row={detailRow}
        onDismiss={() => setDetailRow(null)}
        onPrayedChange={(id, iPrayed, prayedCount) => {
          // KAN-23 corrections r1 — mirror the sheet's optimistic
          // stand-in-the-gap toggle back to the feed row so the card
          // heart count + filled state don't go stale when the sheet
          // closes. STUB until the stand_in_the_gap RPC lands; next
          // feed refresh overwrites with server-truth.
          setRows((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, i_prayed: iPrayed, prayed_count: prayedCount } : r,
            ),
          );
        }}
      />
    </SafeAreaView>
  );
}

interface FeedBodyArgs {
  loadState: LoadState;
  hasFetchedOnce: boolean;
  rows: PrayerRow[];
  isVerified: boolean;
  loadInitial: () => void;
  refresh: () => void;
  loadMore: () => void;
  listRef: React.RefObject<FlatList<PrayerRow> | null>;
  onOpenDetail: (row: PrayerRow) => void;
  onPostPress: () => void;
}

function renderFeedBody(args: FeedBodyArgs) {
  const {
    loadState, hasFetchedOnce, rows, isVerified,
    loadInitial, refresh, loadMore, listRef, onOpenDetail, onPostPress,
  } = args;

  if (loadState === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>Couldn't load prayer requests right now.</Text>
        <Pressable onPress={loadInitial} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loadState === 'initial' && !hasFetchedOnce) {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <View key={i} style={styles.skeletonCard}>
            <View style={[styles.skeletonLine, { width: '60%' }]} />
            <View style={[styles.skeletonLine, { width: '90%', marginTop: 8 }]} />
            <View style={[styles.skeletonLine, { width: '85%', marginTop: 4 }]} />
          </View>
        ))}
      </View>
    );
  }

  if (rows.length === 0) {
    if (isVerified) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyCopy}>No prayer requests match this filter.</Text>
        </View>
      );
    }
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>
          Prayer requests from verified churches will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <PrayerWallCard row={item} onPress={onOpenDetail} />}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
      ListHeaderComponent={
        // v7 Fix 01 — Phil 4:6 floating banner above the first card.
        // Appears once on tab-enter; filter changes re-query cards
        // below it, not the header. The wrapper supplies:
        //   - 2 pt extra horizontal padding (list already has 14 pt;
        //     dispatch wants 16 pt total for the banner width)
        //   - marginBottom 14 — the 14 pt gap above the first card
        // The 20 pt gap above the banner is the sum of FilterBar's
        // paddingBottom (12) + listContent paddingTop (8).
        <View style={styles.scriptureHeader}>
          <ScriptureBanner
            tone="none"
            text={PHIL_4_6_KJV}
            reference={PHIL_4_6_REF}
            bodyFontSize={18}
            // v8 Fix A — Feed banner is the approved reference and
            // MUST NOT shift. Banner default padding is now 24/20
            // for Landing + Testimonies parity; Feed overrides with
            // 8 vert / 0 horiz so the v7 visual is preserved (the
            // wrapping list contentContainerStyle already provides
            // the 16 pt horizontal gutter).
            paddingVertical={8}
            paddingHorizontal={0}
          />
        </View>
      }
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  landingHairline: {
    // v6 fix B — 0.5 pt full-bleed hairline below the Prayer Wall
    // title on the landing only. Matches Home tab pattern.
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.08)',
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  backArrow: {
    fontFamily: Typography.body,
    fontSize: 22,
    color: Colors.accent,
    lineHeight: 24,
  },
  topBarRightPlaceholder: {
    width: 24, // keep title centered when no right action
  },
  hamburger: {
    gap: 4,
    alignItems: 'flex-end',
  },
  hamburgerBar: {
    width: 18,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: Colors.text,
  },
  postCta: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  listContent: { paddingVertical: 8, paddingHorizontal: 14 },
  scriptureHeader: {
    // v7 Fix 01 — Phil 4:6 wrapper. paddingHorizontal: 2 brings the
    // banner to 16 pt total (list already supplies 14). marginBottom:
    // 14 sets the gap between banner and first card. 20 pt gap above
    // the banner comes from FilterBar paddingBottom (12) + listContent
    // paddingTop (8).
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyCopy: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  footerSpinner: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skeletonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 3,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(107, 181, 232, 0.25)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 80,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: 'rgba(240, 237, 230, 0.06)',
    borderRadius: 3,
  },
});
