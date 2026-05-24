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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  TESTIMONY_PAGE_SIZE,
  type TestimonyRow,
} from './PrayerWallLogic';
import TestimonyCard from './TestimonyCard';

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
}

export default function TestimoniesView({
  deepLinkTestimonyId,
  onDeepLinkConsumed,
}: Props) {
  const [rows, setRows] = useState<TestimonyRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showFromLandingPill, setShowFromLandingPill] = useState(false);
  const listRef = useRef<FlatList<TestimonyRow> | null>(null);
  const hasFetchedOnce = useRef(false);
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
  }, [fetchPage]);

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

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

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

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <TestimonyCard row={item} isHighlighted={item.id === highlightedId} />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ScriptureHeader pillVisible={showFromLandingPill} pillOpacity={pillFade} />
        }
        ListEmptyComponent={
          loadState === 'idle' && hasFetchedOnce.current ? <EmptyState /> : null
        }
        ListFooterComponent={
          loadState === 'paging' ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator color={Colors.green} />
            </View>
          ) : loadState === 'initial' && !hasFetchedOnce.current ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator color={Colors.green} />
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
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.scriptureText}>{REV_12_11_KJV}</Text>
      <Text style={styles.scriptureRef}>{REV_12_11_REF}</Text>
      {pillVisible ? (
        <Animated.View style={[styles.fromLandingPill, { opacity: pillOpacity }]}>
          <Text style={styles.fromLandingPillText}>From landing</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No testimonies yet — be the first when God moves.</Text>
      <View style={styles.hairline} />
      <Text style={styles.emptyRef}>{REV_12_11_REF}</Text>
    </View>
  );
}

function Separator() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  headerBlock: {
    backgroundColor: 'rgba(91, 173, 122, 0.06)',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  scriptureText: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.green,
    textTransform: 'uppercase',
  },
  fromLandingPill: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(91, 173, 122, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 173, 122, 0.45)',
  },
  fromLandingPillText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.green,
    textTransform: 'uppercase',
  },
  footerSpinner: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  hairline: {
    width: 60,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  emptyRef: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.green,
    textTransform: 'uppercase',
  },
});
