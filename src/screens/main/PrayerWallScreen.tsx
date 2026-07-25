// ─────────────────────────────────────────────
// PrayerWallScreen — Prayer Wall rebuild (2026-07)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md — the README wins
// over the .dc.html mock. Founder decisions 2026-07-24 folded in (see
// NOTES-postmvp.md): Revelation + Locations surfaces retired from this
// tab; live-presence count replaced by the weekly intercession count;
// journal gains free-text entries.
//
// One screen, five views under a fixed header (README "single screen,
// five views"):
//   feed        → WallFeedView        (View 1)
//   testimonies → WallTestimoniesView (View 2)
//   mine        → WallMyPrayersView   (View 3 + gate panel)
//   journal     → WallJournalView     (View 4 — header action, not a tab)
//   compose     → WallComposeView     (View 5 — header action, not a tab)
//
// Replaced from the previous build: PrayerWallLanding (two-step
// "Enter the prayer wall"), PrayerWallPillNav (5 pills), the filter
// bar, and BOTH detail sheets — requests and testimonies now expand in
// place (README structural move #1). RevelationView / LocationsView
// stay on disk, unrouted, pending the church-state articles idea
// (NOTES-postmvp.md).
//
// Data ownership:
//   - Feed rows + testimony rows live HERE so optimistic Intercede /
//     Rejoice state survives view switches (v7 Fix 09 posture).
//   - My Prayers + Journal fetch inside their views (as before).
//   - Weekly intercession count: get_wall_weekly_intercessions,
//     DEFENSIVE — renders "—" until the migration is deployed; the FE
//     never fakes a number (Founder truthfulness ruling 2026-07-24).
//   - get_prayer_wall is called WITH p_sort first and falls back to
//     the legacy 3-arg signature if the deployed RPC predates the
//     sort migration; sortRows() re-sorts loaded pages client-side
//     either way so the choice always applies.
//
// Gate posture (README "Gated state"): unverified leaders read
// everything; only actions gate. effectiveView() owns the fallback —
// if verification lapses while Journal/Compose is open, the leader
// lands back on Feed (deriving view flags from raw state alone
// rendered an empty screen in the prototype).
//
// Cross-tab contract preserved: route.params.initialView === 'journal'
// (+ pendingChurch) opens the Journal view — The Church tab navigates
// here after a Pray tap. Params are consumed on focus.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { PAGE_SIZE, TESTIMONY_PAGE_SIZE, type PrayerRow, type TestimonyRow } from '../../components/prayer/PrayerWallLogic';
import { effectiveView, sortRows, type WallShow, type WallSort, type WallView } from '../../components/prayer/wallNewLogic';
import { WallTabs } from '../../components/prayer/WallPrimitives';
import WallFeedView, { type FeedLoadState } from '../../components/prayer/WallFeedView';
import WallTestimoniesView, { type TestimonyLoadState } from '../../components/prayer/WallTestimoniesView';
import WallMyPrayersView from '../../components/prayer/WallMyPrayersView';
import WallJournalView from '../../components/prayer/WallJournalView';
import WallComposeView from '../../components/prayer/WallComposeView';
import type { TabsParamList } from '../../navigation/types';

// ─── Feed fetch (p_sort-aware, legacy-safe) ───────────────────────────

async function fetchWallPage(
  offset: number,
  sort: WallSort,
  urgentOnly: boolean,
): Promise<{ rows: PrayerRow[]; error: string | null }> {
  const base = {
    page_offset: offset,
    filter_urgent: urgentOnly ? true : null,
    filter_categories: null as string[] | null,
  };
  // Preferred: sort-aware signature (migration in this branch). If the
  // deployed RPC predates it, PostgREST rejects the unknown arg — fall
  // back to the legacy call. sortRows() reconciles client-side.
  const sorted = await supabase.rpc('get_prayer_wall', { ...base, p_sort: sort });
  if (!sorted.error) return { rows: (sorted.data ?? []) as PrayerRow[], error: null };
  const legacy = await supabase.rpc('get_prayer_wall', base);
  if (legacy.error) return { rows: [], error: legacy.error.message };
  return { rows: (legacy.data ?? []) as PrayerRow[], error: null };
}

// 350ms view fade on tab change (README motion table).
function FadeView({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [opacity]);
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

export default function PrayerWallScreen() {
  const { branch, session } = useAuth();
  const isVerified = branch === 'active';
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const route = useRoute<RouteProp<TabsParamList, 'Prayer Wall'>>();

  // ─── View state ─────────────────────────────────────────────────────
  const [rawView, setRawView] = useState<WallView>('feed');
  const view = effectiveView(rawView, isVerified);
  const [animTick, setAnimTick] = useState(0);
  const [composeKey, setComposeKey] = useState(0); // remount Compose per open → counter resets

  // ─── Feed state (hoisted — optimistic state survives view switches) ─
  const [rows, setRows] = useState<PrayerRow[]>([]);
  const [feedLoad, setFeedLoad] = useState<FeedLoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<WallSort>('newest');
  const [show, setShow] = useState<WallShow>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const feedFetchedOnce = useRef(false);

  // ─── Testimonies state (hoisted, v7 Fix 09 posture) ─────────────────
  const [tRows, setTRows] = useState<TestimonyRow[]>([]);
  const [tLoad, setTLoad] = useState<TestimonyLoadState>('initial');
  const [tHasMore, setTHasMore] = useState(true);
  const [expandedTestimonyId, setExpandedTestimonyId] = useState<string | null>(null);
  const tFetchedOnce = useRef(false);

  // ─── Weekly intercession count (null → "—", never faked) ────────────
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);

  // ─── Viewer church context (for Compose attribution) ────────────────
  const [postChurchName, setPostChurchName] = useState<string | null>(null);
  const [postIsUnderground, setPostIsUnderground] = useState(false);
  const [postDefaultAnon, setPostDefaultAnon] = useState(false);

  // ─── Toast (README: ~2600ms, 300 in / 220 out) ──────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 2600);
    },
    [toastOpacity],
  );
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ─── Weekly count fetch (defensive) ─────────────────────────────────
  const loadWeekly = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_wall_weekly_intercessions');
      if (error) return; // migration not deployed → stays "—"
      if (typeof data === 'number') setWeeklyCount(data);
    } catch {
      // stays "—"
    }
  }, []);

  // ─── Feed loaders ───────────────────────────────────────────────────
  const loadFeedInitial = useCallback(async (s: WallSort, u: WallShow) => {
    setFeedLoad('initial');
    const { rows: page, error } = await fetchWallPage(0, s, u === 'urgent');
    feedFetchedOnce.current = true;
    if (error) {
      setFeedLoad('error');
      return;
    }
    setRows(sortRows(page, s));
    setHasMore(page.length === PAGE_SIZE);
    setFeedLoad('idle');
    setAnimTick((t) => t + 1);
  }, []);

  const refreshFeed = useCallback(
    async (opts?: { silent?: boolean }) => {
      setFeedLoad('refreshing');
      const { rows: page, error } = await fetchWallPage(0, sort, show === 'urgent');
      feedFetchedOnce.current = true;
      if (error) {
        setFeedLoad('error');
        return;
      }
      setRows(sortRows(page, sort));
      setHasMore(page.length === PAGE_SIZE);
      setFeedLoad('idle');
      setAnimTick((t) => t + 1);
      void loadWeekly();
      if (!opts?.silent) showToast('The wall is current.');
    },
    [sort, show, showToast, loadWeekly],
  );

  const loadMoreFeed = useCallback(async () => {
    if (feedLoad !== 'idle' || !hasMore || rows.length === 0) return;
    setFeedLoad('paging');
    const { rows: page, error } = await fetchWallPage(rows.length, sort, show === 'urgent');
    if (error) {
      setFeedLoad('idle');
      return;
    }
    if (page.length === 0) setHasMore(false);
    else {
      setRows((prev) => sortRows([...prev, ...page], sort));
      setHasMore(page.length === PAGE_SIZE);
    }
    setFeedLoad('idle');
  }, [feedLoad, hasMore, rows.length, sort, show]);

  // First entry + filter/sort changes re-run the initial load.
  useEffect(() => {
    void loadFeedInitial(sort, show);
    setExpandedRequestId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, show]);

  useEffect(() => {
    void loadWeekly();
  }, [loadWeekly]);

  // ─── Testimony loaders ──────────────────────────────────────────────
  const loadTestimoniesInitial = useCallback(async () => {
    setTLoad('initial');
    const { data, error } = await supabase.rpc('get_testimonies', { page_offset: 0 });
    tFetchedOnce.current = true;
    if (error) {
      setTLoad('error');
      return;
    }
    const page = (data ?? []) as TestimonyRow[];
    setTRows(page);
    setTHasMore(page.length === TESTIMONY_PAGE_SIZE);
    setTLoad('idle');
    setAnimTick((t) => t + 1);
  }, []);

  const refreshTestimonies = useCallback(
    async (opts?: { silent?: boolean }) => {
      setTLoad('refreshing');
      const { data, error } = await supabase.rpc('get_testimonies', { page_offset: 0 });
      tFetchedOnce.current = true;
      if (error) {
        setTLoad('error');
        return;
      }
      const page = (data ?? []) as TestimonyRow[];
      setTRows(page);
      setTHasMore(page.length === TESTIMONY_PAGE_SIZE);
      setTLoad('idle');
      setAnimTick((t) => t + 1);
      if (!opts?.silent) showToast('The wall is current.');
    },
    [showToast],
  );

  const loadMoreTestimonies = useCallback(async () => {
    if (tLoad !== 'idle' || !tHasMore || tRows.length === 0) return;
    setTLoad('paging');
    const { data, error } = await supabase.rpc('get_testimonies', { page_offset: tRows.length });
    if (error) {
      setTLoad('idle');
      return;
    }
    const page = (data ?? []) as TestimonyRow[];
    if (page.length === 0) setTHasMore(false);
    else {
      setTRows((prev) => [...prev, ...page]);
      setTHasMore(page.length === TESTIMONY_PAGE_SIZE);
    }
    setTLoad('idle');
  }, [tLoad, tHasMore, tRows.length]);

  useEffect(() => {
    if (view === 'testimonies' && !tFetchedOnce.current) void loadTestimoniesInitial();
  }, [view, loadTestimoniesInitial]);

  // ─── Optimistic Intercede (no toast — the mark filling says it) ─────
  const handleIntercede = useCallback(async (row: PrayerRow) => {
    const next = !row.i_prayed;
    const delta = next ? 1 : -1;
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, i_prayed: next, prayed_count: r.prayed_count + delta } : r,
      ),
    );
    const { error } = await supabase.rpc('stand_in_the_gap', { p_prayer_request_id: row.id });
    if (error) {
      // Roll back (not_verified, self_interaction_blocked, network).
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, i_prayed: row.i_prayed, prayed_count: row.prayed_count } : r,
        ),
      );
    } else {
      void loadWeekly(); // the weekly count just moved
    }
  }, [loadWeekly]);

  // ─── Optimistic Rejoice ─────────────────────────────────────────────
  const handleRejoice = useCallback(async (row: TestimonyRow) => {
    const next = !row.i_celebrated;
    const delta = next ? 1 : -1;
    setTRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, i_celebrated: next, celebrated_count: r.celebrated_count + delta }
          : r,
      ),
    );
    const { error } = await supabase.rpc('celebrate', { p_testimony_id: row.id });
    if (error) {
      setTRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, i_celebrated: row.i_celebrated, celebrated_count: row.celebrated_count }
            : r,
        ),
      );
    }
  }, []);

  // Journal Release → un-intercede: keep any loaded feed row honest.
  const handleReleasedRequest = useCallback((requestId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === requestId && r.i_prayed
          ? { ...r, i_prayed: false, prayed_count: Math.max(0, r.prayed_count - 1) }
          : r,
      ),
    );
    void loadWeekly();
  }, [loadWeekly]);

  // ─── Viewer church context (Compose attribution) ────────────────────
  useEffect(() => {
    if (!isVerified) return;
    let cancelled = false;
    (async () => {
      const authId = session?.user?.id;
      if (!authId) return;
      const { data: userData } = await supabase
        .from('users')
        .select('church_id, anonymous')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled || !userData?.church_id) return;
      const { data: churchData } = await supabase
        .from('churches')
        .select('name, type')
        .eq('id', userData.church_id)
        .maybeSingle();
      if (cancelled || !churchData) return;
      setPostChurchName(churchData.name ?? null);
      setPostIsUnderground(churchData.type === 'underground');
      setPostDefaultAnon(userData.anonymous ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isVerified, session?.user?.id]);

  // ─── Header actions ─────────────────────────────────────────────────
  const openJournal = () => {
    if (!isVerified) {
      showToast('The journal unlocks once your church is verified.');
      return;
    }
    setRawView('journal');
  };

  const openCompose = () => {
    if (!isVerified) {
      // Verbatim from the existing not_verified RPC copy (README).
      showToast('Your church must be verified to post.');
      return;
    }
    setComposeKey((k) => k + 1); // fresh mount → counter resets to 0
    setRawView('compose');
  };

  const handleTabChange = (tab: 'feed' | 'testimonies' | 'mine') => {
    if (tab === rawView) return;
    setRawView(tab);
    setFilterOpen(false);
    setAnimTick((t) => t + 1);
  };

  // Compose success → Feed with the new request expanded (README §View 5).
  const handlePosted = useCallback(
    async (newRequestId: string | null) => {
      setRawView('feed');
      showToast('Lifted up. The body will pray it through.');
      setFeedLoad('refreshing');
      const { rows: page, error } = await fetchWallPage(0, sort, show === 'urgent');
      if (!error) {
        setRows(sortRows(page, sort));
        setHasMore(page.length === PAGE_SIZE);
        setAnimTick((t) => t + 1);
      }
      setFeedLoad(error ? 'error' : 'idle');
      if (newRequestId) setExpandedRequestId(newRequestId);
    },
    [sort, show, showToast],
  );

  // ─── Cross-tab params + tab-blur reset ──────────────────────────────
  const routeParamsRef = useRef(route.params);
  useEffect(() => {
    routeParamsRef.current = route.params;
  }, [route.params]);

  useFocusEffect(
    useCallback(() => {
      const params = routeParamsRef.current;
      if (params?.initialView === 'journal' && isVerified) {
        setRawView('journal');
        navigation.setParams({ initialView: undefined, pendingChurch: undefined });
      }
      return () => {
        // Leader returns to a wide-open default view (existing posture).
        setRawView('feed');
        setSort('newest');
        setShow('all');
        setFilterOpen(false);
        setExpandedRequestId(null);
        setExpandedTestimonyId(null);
      };
    }, [navigation, isVerified]),
  );

  const headerActionsHidden = view === 'journal' || view === 'compose';

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header — fixed, always mounted (README). */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Prayer Wall</Text>
        <View style={styles.titleActions}>
          <Pressable
            onPress={openJournal}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Intercession journal"
            accessibilityState={{ selected: view === 'journal' }}
          >
            <Text
              style={[
                styles.headerAction,
                view === 'journal' && { color: Colors.accent },
                !isVerified && styles.headerActionGated,
              ]}
            >
              JOURNAL
            </Text>
          </Pressable>
          <Pressable
            onPress={openCompose}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Post a prayer request"
          >
            <Text
              style={[
                styles.headerAction,
                isVerified ? { color: Colors.accent } : styles.headerActionGated,
              ]}
            >
              + POST
            </Text>
          </Pressable>
        </View>
      </View>

      <WallTabs
        active={view}
        hidden={headerActionsHidden}
        onChange={handleTabChange}
      />
      <View style={styles.headerRule} />

      {/* Views — one at a time, 350ms fade on change. */}
      {/* FadeView keys are the view name only — the fade marks view
          changes; row-level stagger already re-triggers via animTick
          (re-keying here would reset scroll on every filter change). */}
      {view === 'feed' ? (
        <FadeView key="feed">
          <WallFeedView
            rows={rows}
            loadState={feedLoad}
            weeklyCount={weeklyCount}
            sort={sort}
            show={show}
            filterOpen={filterOpen}
            expandedId={expandedRequestId}
            animTick={animTick}
            isVerified={isVerified}
            onToggleFilter={() => setFilterOpen((v) => !v)}
            onSort={setSort}
            onShow={setShow}
            onExpand={setExpandedRequestId}
            onIntercede={(r) => void handleIntercede(r)}
            onRefresh={() => void refreshFeed()}
            onLoadMore={() => void loadMoreFeed()}
            onRetry={() => void loadFeedInitial(sort, show)}
          />
        </FadeView>
      ) : null}

      {view === 'testimonies' ? (
        <FadeView key="testimonies">
          <WallTestimoniesView
            rows={tRows}
            loadState={tLoad}
            expandedId={expandedTestimonyId}
            animTick={animTick}
            isVerified={isVerified}
            onExpand={setExpandedTestimonyId}
            onRejoice={(r) => void handleRejoice(r)}
            onRefresh={() => void refreshTestimonies()}
            onLoadMore={() => void loadMoreTestimonies()}
            onRetry={() => void loadTestimoniesInitial()}
          />
        </FadeView>
      ) : null}

      {view === 'mine' ? (
        <FadeView key="mine">
          <WallMyPrayersView
            isVerified={isVerified}
            onPost={openCompose}
            onTestimonyCreated={() => void refreshTestimonies({ silent: true })}
            onToast={showToast}
          />
        </FadeView>
      ) : null}

      {view === 'journal' ? (
        <FadeView key="journal">
          <WallJournalView
            onBack={() => setRawView('feed')}
            pendingChurch={route.params?.pendingChurch ?? null}
            onReleasedRequest={handleReleasedRequest}
            onToast={showToast}
          />
        </FadeView>
      ) : null}

      {view === 'compose' ? (
        <FadeView key={`compose-${composeKey}`}>
          <WallComposeView
            key={composeKey}
            churchName={postChurchName}
            isUnderground={postIsUnderground}
            defaultAnonymous={postDefaultAnon}
            onBack={() => setRawView('feed')}
            onSuccess={(id) => void handlePosted(id)}
          />
        </FadeView>
      ) : null}

      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 27,
    lineHeight: 27,
    letterSpacing: 0.4,
    color: Colors.text,
  },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerAction: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: 'rgba(240,237,230,0.42)',
  },
  headerActionGated: { color: 'rgba(240,237,230,0.28)' },

  // Inset to the 22px content gutter — the mock's rule does not bleed
  // to the screen edges (Founder device pass 2026-07-24).
  headerRule: { height: 1, backgroundColor: Colors.borderAccentStrong, marginHorizontal: 22 },

  // Toast, restyled to the wall's own register (Founder device pass
  // 2026-07-24: the inherited KAN-24 grey pill read as system chrome).
  // Serif italic line, centred, near-black pill, sky hairline — the
  // same voice as the scripture strip, quiet enough to be devotional.
  toast: {
    position: 'absolute',
    bottom: 30,
    left: 26,
    right: 26,
    backgroundColor: 'rgba(10,10,11,0.97)',
    borderRadius: 9,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: Colors.borderAccentStrong,
  },
  toastText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 22,
    color: '#E6E1D5',
    textAlign: 'center',
  },
});
