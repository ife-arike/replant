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
import PrayerWallCard from '../../components/prayer/PrayerWallCard';
import PrayerWallDetailSheet from '../../components/prayer/PrayerWallDetailSheet';
import PrayerWallFilterBar from '../../components/prayer/PrayerWallFilterBar';
import PrayerWallLanding from '../../components/prayer/PrayerWallLanding';
import PrayerWallSegmentedControl from '../../components/prayer/PrayerWallSegmentedControl';
import TestimoniesView from '../../components/prayer/TestimoniesView';
import MyOpenPrayersView from '../../components/prayer/MyOpenPrayersView';
import {
  DEFAULT_CATEGORY,
  DEFAULT_URGENCY,
  PAGE_SIZE,
  buildRpcFilters,
  type CategoryFilter,
  type PrayerRow,
  type UrgencyFilter,
} from '../../components/prayer/PrayerWallLogic';

type PrayerWallView = 'landing' | 'feed' | 'testimonies' | 'my_open_prayers';
type LoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

const SKELETON_COUNT = 3;

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

  const [view, setView] = useState<PrayerWallView>('landing');
  const [rows, setRows] = useState<PrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>(DEFAULT_CATEGORY);
  const [urgency, setUrgency] = useState<UrgencyFilter>(DEFAULT_URGENCY);
  const [detailRow, setDetailRow] = useState<PrayerRow | null>(null);
  const [deepLinkTestimonyId, setDeepLinkTestimonyId] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);
  const listRef = useRef<FlatList<PrayerRow> | null>(null);

  // ─── Feed loaders ─────────────────────────────────────────────────

  const loadInitial = useCallback(
    async (cat: CategoryFilter, urg: UrgencyFilter) => {
      setLoadState('initial');
      const { filter_urgent, filter_categories } = buildRpcFilters(cat, urg);
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
    const { filter_urgent, filter_categories } = buildRpcFilters(category, urgency);
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
  }, [category, urgency]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const { filter_urgent, filter_categories } = buildRpcFilters(category, urgency);
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
  }, [category, urgency, hasMore, loadState, rows.length]);

  // Feed mounts on view transition to 'feed'. The fetch always runs
  // on first entry; subsequent entries within the same focus cycle
  // refresh implicitly when filters change (effect below).
  useEffect(() => {
    if (view !== 'feed') return;
    if (!hasFetchedOnce.current) {
      void loadInitial(category, urgency);
    }
    // intentionally omits category/urgency — filter-change effect handles those
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Filter changes — reset to offset 0 and refetch. Only fires while
  // the leader is on the feed view; switching to other views doesn't
  // trigger a network call here.
  useEffect(() => {
    if (view !== 'feed') return;
    if (!hasFetchedOnce.current) return; // initial-load effect owns the first fetch
    void loadInitial(category, urgency);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, urgency]);

  // Tab-blur reset — restore landing + defaults + clear deep-link.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setView('landing');
        setCategory(DEFAULT_CATEGORY);
        setUrgency(DEFAULT_URGENCY);
        setDetailRow(null);
        setDeepLinkTestimonyId(null);
      };
    }, []),
  );

  const handleClearFilters = () => {
    setCategory(DEFAULT_CATEGORY);
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
        </View>
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
            category={category}
            urgency={urgency}
            resultCount={rows.length}
            onCategoryChange={setCategory}
            onUrgencyChange={setUrgency}
            onClear={handleClearFilters}
          />
          {renderFeedBody({
            loadState,
            hasFetchedOnce: hasFetchedOnce.current,
            rows,
            isVerified,
            loadInitial: () => void loadInitial(category, urgency),
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
        />
      )}

      <PrayerWallDetailSheet
        row={detailRow}
        onDismiss={() => setDetailRow(null)}
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
      ItemSeparatorComponent={() => <View style={{ height: 3 }} />}
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
  postCta: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  listContent: { paddingVertical: 8, paddingHorizontal: 14 },
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
