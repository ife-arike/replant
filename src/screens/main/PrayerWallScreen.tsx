// ─────────────────────────────────────────────
// PrayerWallScreen — KAN-23
//
// Full-screen scrollable list of prayer requests from verified
// churches. Sort is server-side (urgent DESC, created_at DESC inside
// the get_prayer_wall RPC). Filtering is client-side per AC ("no
// network call on change"); 12 category × urgency combinations exercised
// in PrayerWallLogic.test.ts.
//
// Pagination: 20 per page via page_offset on the RPC; infinite scroll
// triggers loadMore as the user approaches the bottom (FlatList's
// onEndReachedThreshold = 0.5 ≈ 3 cards from end for typical card
// heights). Pull-to-refresh resets to offset 0 and scrolls to top.
//
// Empty-state matrix:
//   - filter active + no matches → "No prayer requests match this
//     filter." + clearable
//   - verified branch ('active'), no rows at all → "No prayer requests
//     yet. Be the first to lift one up." + Post CTA
//   - unverified branch ('pending'), no rows → "Prayer requests from
//     verified churches will appear here." (no CTA)
//
// Post CTA gate: rendered only when AuthProvider's branch === 'active'.
// Pending leaders see read-only feed + filters; no Post button anywhere.
// The actual posting flow is a separate ticket — tapping the CTA here
// surfaces a "coming soon" Alert.
//
// Tab-leave reset: useFocusEffect runs a cleanup on blur that restores
// the filter defaults (All categories, All urgency) so a leader who
// returns to the tab lands on the wide-open default view.
//
// Read pattern: supabase.rpc('get_prayer_wall', { page_offset }). The
// RPC owns underground masking + anonymous masking; the FE trusts the
// wire shape and renders. Do NOT re-derive or layer on FE-side
// masking — that would duplicate the BE perimeter and rot if the RPC
// changes. (Watched invariant per dispatch.)
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
import PrayerWallFilterBar from '../../components/prayer/PrayerWallFilterBar';
import {
  DEFAULT_CATEGORY,
  DEFAULT_URGENCY,
  PAGE_SIZE,
  applyFilters,
  isDefaultFilter,
  type CategoryFilter,
  type PrayerRow,
  type UrgencyFilter,
} from '../../components/prayer/PrayerWallLogic';

type LoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

const SKELETON_COUNT = 3;

async function fetchPage(offset: number): Promise<{
  rows: PrayerRow[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_prayer_wall', {
    page_offset: offset,
  });
  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: (data ?? []) as PrayerRow[], error: null };
}

export default function PrayerWallScreen() {
  const { branch } = useAuth();
  const [rows, setRows] = useState<PrayerRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>(DEFAULT_CATEGORY);
  const [urgency, setUrgency] = useState<UrgencyFilter>(DEFAULT_URGENCY);
  const hasFetchedOnce = useRef(false);
  const listRef = useRef<FlatList<PrayerRow>>(null);

  const loadInitial = useCallback(async () => {
    setLoadState('initial');
    const { rows: pageRows, error } = await fetchPage(0);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
  }, []);

  const refresh = useCallback(async () => {
    setLoadState('refreshing');
    const { rows: pageRows, error } = await fetchPage(0);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
    // Scroll to top on pull-to-refresh per AC.
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const { rows: pageRows, error } = await fetchPage(rows.length);
    if (error) {
      // Paging failure leaves what's on screen intact — surface a quiet
      // idle and let the leader pull-to-refresh.
      setLoadState('idle');
      return;
    }
    if (pageRows.length === 0) {
      setHasMore(false);
    } else {
      setRows((prev) => [...prev, ...pageRows]);
      setHasMore(pageRows.length === PAGE_SIZE);
    }
    setLoadState('idle');
  }, [hasMore, loadState, rows.length]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // AC: "Reset to default on tab leave." useFocusEffect's cleanup runs
  // on blur — drop both axes back to the wide-open default so a leader
  // returning to the tab sees the same first paint as a cold mount.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setCategory(DEFAULT_CATEGORY);
        setUrgency(DEFAULT_URGENCY);
      };
    }, []),
  );

  const filteredRows = applyFilters(rows, category, urgency);
  const isVerified = branch === 'active';
  const hasFilters = !isDefaultFilter(category, urgency);

  const clearFilters = () => {
    setCategory(DEFAULT_CATEGORY);
    setUrgency(DEFAULT_URGENCY);
  };

  const handlePostPress = () => {
    // Posting a prayer request is out of scope per the KAN-23 dispatch
    // (separate ticket). Surface a courteous coming-soon so the leader
    // knows the affordance is real, not broken.
    Alert.alert(
      'Posting a prayer request',
      'This is coming in a future update. Thank you for wanting to lift up your church.',
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Prayer Wall</Text>
        {isVerified ? (
          <Pressable
            onPress={handlePostPress}
            accessibilityRole="button"
            accessibilityLabel="Post a prayer request"
            hitSlop={8}
          >
            <Text style={styles.postCta}>+ Post</Text>
          </Pressable>
        ) : null}
      </View>

      <PrayerWallFilterBar
        category={category}
        urgency={urgency}
        onCategoryChange={setCategory}
        onUrgencyChange={setUrgency}
      />

      {renderBody({
        loadState,
        hasFetchedOnce: hasFetchedOnce.current,
        filteredRows,
        rawRows: rows,
        hasFilters,
        isVerified,
        clearFilters,
        loadInitial,
        refresh,
        loadMore,
        listRef,
        onPostPress: handlePostPress,
      })}
    </SafeAreaView>
  );
}

interface BodyArgs {
  loadState: LoadState;
  hasFetchedOnce: boolean;
  filteredRows: PrayerRow[];
  rawRows: PrayerRow[];
  hasFilters: boolean;
  isVerified: boolean;
  clearFilters: () => void;
  loadInitial: () => void;
  refresh: () => void;
  loadMore: () => void;
  listRef: React.RefObject<FlatList<PrayerRow> | null>;
  onPostPress: () => void;
}

function renderBody(args: BodyArgs) {
  const {
    loadState,
    hasFetchedOnce,
    filteredRows,
    rawRows,
    hasFilters,
    isVerified,
    clearFilters,
    loadInitial,
    refresh,
    loadMore,
    listRef,
    onPostPress,
  } = args;

  // Error state — show retry. Read-failure is rare (RPC + RLS); if it
  // happens we don't want the leader stuck on a phantom skeleton.
  if (loadState === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>
          Couldn't load prayer requests right now.
        </Text>
        <Pressable onPress={loadInitial} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  // Skeleton placeholders on initial fetch only — pull-to-refresh and
  // paging use spinners instead.
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

  // Filter empty state — has rows underneath but the current narrow
  // filter zeros them out. Clear-filters link returns to the wide-open
  // default.
  if (rawRows.length > 0 && filteredRows.length === 0 && hasFilters) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>No prayer requests match this filter.</Text>
        <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      </View>
    );
  }

  // True-empty states (no rows at all from the RPC).
  if (rawRows.length === 0) {
    if (isVerified) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyCopy}>
            No prayer requests yet. Be the first to lift one up.
          </Text>
          <Pressable
            onPress={onPostPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Post a prayer request"
            style={styles.emptyCtaButton}
          >
            <Text style={styles.emptyCtaText}>+ Post a Request</Text>
          </Pressable>
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

  // Main scrollable list.
  return (
    <FlatList
      ref={listRef}
      data={filteredRows}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={Separator}
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

function keyExtractor(row: PrayerRow): string {
  return row.id;
}

function renderItem({ item }: { item: PrayerRow }) {
  return <PrayerWallCard row={item} />;
}

function Separator() {
  // Card margin-bottom per dispatch sizing.
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  postCta: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  separator: {
    height: 3,
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
  clearFiltersText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  emptyCtaButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    borderRadius: 4,
  },
  emptyCtaText: {
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
