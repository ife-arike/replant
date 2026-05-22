// ─────────────────────────────────────────────
// NetworkFeed — KAN-17
//
// Home Network Feed surface. Reads Posted announcements directly from
// `public.announcements` under leader RLS (policy
// `leaders_can_read_posted_announcements`, applied 2026-05-22). FE
// filter mirrors the policy as defense-in-depth — if a future policy
// change widens read access, the FE gate still keeps draft / scheduled
// / inactive rows off-screen.
//
// Read pattern: direct Supabase `from('announcements').select(...)` —
// no edge function. Sort: `published_at DESC`. Cursor: `published_at <
// cursor` for older pages.
//
// AC coverage:
//   #1  feed renders on Home below the scripture strip — composed in
//        HomeScreen, not here.
//   #4  ORDER BY published_at DESC — set on every query.
//   #5  Posted-only predicate — set on every query AND mirrored FE-side
//        in NetworkFeedLogic.isPosted as belt-and-suspenders.
//   #6  Loads on mount + pull-to-refresh.
//   #7  Empty-state copy.
//   #8  Cursor-based pagination, 20 per page.
//   #9  No real-time push — refresh on Home mount + pull-to-refresh only.
//   #14 Read-failure shows empty state + "Tap to retry"; no crash.
//   #15 Scroll position preserved — FlatList stays mounted across
//        Home-tab re-focus events (React Navigation keeps the Home stack
//        screen mounted on stack push to Settings).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AnnouncementCard from './AnnouncementCard';
import {
  PAGE_SIZE,
  isPosted,
  type AnnouncementRow,
} from './NetworkFeedLogic';

// Column projection — only what the card renders + the cursor field.
// `author_id` is intentionally NOT selected: D-56 attribution is a
// hardcoded FE constant ("Replant Team"), so pulling author_id over the
// wire would be both wasted bytes and a forensic leak vector.
const SELECT_COLS = 'id, title, body, published_at, is_active, source_label, tag_type';

type LoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

export default function NetworkFeed() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  // Track whether *any* attempt has resolved so the empty-state vs
  // first-paint loading-spinner branches don't flicker together.
  const hasFetchedOnce = useRef(false);

  const fetchPage = useCallback(async (cursor: string | null): Promise<{
    rows: AnnouncementRow[];
    error: string | null;
  }> => {
    // Posted-only predicate on the query — RLS enforces it too, but the
    // explicit WHERE keeps the response payload minimal AND ensures the
    // same predicate is visible at the call site for AC review.
    let q = supabase
      .from('announcements')
      .select(SELECT_COLS)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) {
      q = q.lt('published_at', cursor);
    }

    const { data, error } = await q;
    if (error) {
      return { rows: [], error: error.message };
    }
    // FE-side D-54 mirror — belt-and-suspenders. If RLS / query somehow
    // returned a non-Posted row, drop it before render.
    const filtered = ((data ?? []) as AnnouncementRow[]).filter((r) => isPosted(r));
    return { rows: filtered, error: null };
  }, []);

  const loadInitial = useCallback(async () => {
    setLoadState('initial');
    const { rows: pageRows, error } = await fetchPage(null);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setLoadState('refreshing');
    const { rows: pageRows, error } = await fetchPage(null);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const cursor = rows[rows.length - 1].published_at;
    const { rows: pageRows, error } = await fetchPage(cursor);
    if (error) {
      // Paging failure shouldn't blow away what's already on screen —
      // surface as an idle state and let the user pull-to-refresh.
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
  }, [fetchPage, hasMore, loadState, rows]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Empty state — both AC #7 (no rows) and AC #14 (read error). The
  // error variant adds the "Tap to retry" affordance; the no-rows
  // variant is just the empty copy.
  if (loadState === 'error') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>No updates yet. Check back soon.</Text>
        <Pressable
          onPress={loadInitial}
          accessibilityRole="button"
          accessibilityLabel="Tap to retry"
          hitSlop={8}
        >
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loadState === 'initial' && !hasFetchedOnce.current) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.emptyCopy}>No updates yet. Check back soon.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
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

function keyExtractor(row: AnnouncementRow): string {
  return row.id;
}

function renderItem({ item }: { item: AnnouncementRow }) {
  return <AnnouncementCard row={item} />;
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: Spacing.xl,
  },
  separator: {
    height: Spacing.sm,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyCopy: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  footerSpinner: {
    paddingVertical: Spacing.md,
  },
});
