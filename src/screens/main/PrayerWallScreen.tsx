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
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import PrayerWallCard from '../../components/prayer/PrayerWallCard';
import PrayerWallDetailSheet from '../../components/prayer/PrayerWallDetailSheet';
import PrayerWallFilterBar from '../../components/prayer/PrayerWallFilterBar';
import PrayerWallLanding from '../../components/prayer/PrayerWallLanding';
import PrayerWallPillNav, { type PrayerWallPill } from '../../components/prayer/PrayerWallPillNav';
import ScriptureBanner from '../../components/prayer/ScriptureBanner';
import TestimoniesView from '../../components/prayer/TestimoniesView';
import MyOpenPrayersView from '../../components/prayer/MyOpenPrayersView';
import RevelationView from '../../components/prayer/RevelationView';
import LocationsView from '../../components/prayer/LocationsView';
import IntercessionJournalView from '../../components/prayer/IntercessionJournalView';
import PostPrayerRequestModal from '../../components/church/PostPrayerRequestModal';
import {
  DEFAULT_URGENCY,
  PAGE_SIZE,
  buildRpcFilters,
  type PrayerCategory,
  type PrayerRow,
  type SelectedCategories,
  type UrgencyFilter,
} from '../../components/prayer/PrayerWallLogic';
import type { TabsParamList } from '../../navigation/types';

// Prayer Wall redesign — pill-driven view model.
//   feed / testimonies / my_prayers / revelation / locations
//     → the five pill surfaces (header + pill nav shown).
//   feed_list  → full prayer-request list (entered from the Feed pill's
//                "Enter the prayer wall" CTA). No pill nav, no segmented
//                control. Back returns to the 'feed' pill.
//   journal    → IntercessionJournalView. No pill nav, no header.
type PrayerWallView =
  | 'feed'
  | 'testimonies'
  | 'my_prayers'
  | 'revelation'
  | 'locations'
  | 'feed_list'
  | 'journal';
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
  const { branch, session } = useAuth();
  const isVerified = branch === 'active';
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const route = useRoute<RouteProp<TabsParamList, 'Prayer Wall'>>();

  const [view, setView] = useState<PrayerWallView>('feed');
  // Active pill mirrors `view` while on a pill surface; held separately so
  // the pill bar stays highlighted correctly when feed_list (a sub-view of
  // the Feed pill) is active.
  const [activePill, setActivePill] = useState<PrayerWallPill>('feed');

  // Church context for PostPrayerRequestModal — fetched once when verified.
  const [viewerChurchId, setViewerChurchId] = useState<string | null>(null);
  const [postChurchName, setPostChurchName] = useState<string | null>(null);
  const [postIsUnderground, setPostIsUnderground] = useState(false);
  const [postDefaultAnon, setPostDefaultAnon] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
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

  // KAN-24 — confirmation toast after a prayer request is lifted to the
  // wall. The modal dismisses on success (host-owned), so the toast must
  // live here at the screen. 3 s visible, 200 ms fade in/out — mirrors
  // the IntercessionJournalView toast pattern.
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 3000);
    },
    [toastOpacity],
  );
  // Clear any pending toast timer on unmount.
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

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

  // ─── Open a prayer request from the journal ───────────────────────
  // Standing-in-the-gap rows in the Intercession Journal carry only the
  // request id. Fetch the full request, mask underground/anonymous fields
  // the same way the RPC would, build a PrayerRow, and raise the detail
  // sheet. i_prayed can't be derived from this fetch — we stand it in as
  // false (the sheet is read-context here; toggling re-syncs via RPC).
  const handleOpenPrayerRequest = useCallback(async (requestId: string) => {
    const { data, error } = await supabase
      .from('prayer_requests')
      .select(`
        id,
        content,
        category,
        urgent,
        created_at,
        church_id,
        anonymous,
        prayed_count,
        status,
        is_active,
        churches!prayer_requests_church_id_fkey (
          name,
          type,
          country
        ),
        users!prayer_requests_user_id_fkey (
          full_name,
          role
        )
      `)
      .eq('id', requestId)
      .single();

    if (error || !data) return;

    const church = Array.isArray(data.churches) ? data.churches[0] : data.churches;
    const user = Array.isArray(data.users) ? data.users[0] : data.users;
    const isUnderground = church?.type === 'underground';
    const isAnon = data.anonymous ?? false;

    const row: PrayerRow = {
      id: data.id,
      church_name: isUnderground ? 'Underground Church' : (church?.name ?? 'Unknown Church'),
      church_type: church?.type ?? 'standard',
      country: isUnderground ? null : (church?.country ?? null),
      category: data.category ?? null,
      prayer_text: data.content,
      urgency: data.urgent ?? false,
      created_at: data.created_at,
      church_id: data.church_id,
      leader_display_name: isAnon ? null : (user?.full_name ?? null),
      leader_role: isAnon ? null : (user?.role ?? null),
      prayed_count: data.prayed_count ?? 0,
      i_prayed: false, // unknown from this fetch; stand-in
      status: data.status ?? 'open',
      rag_status: null,
    };

    setDetailRow(row);
  }, []);

  // ─── Church context for post modal ────────────────────────────────
  // Fetched once when the leader is verified. Mirrors PrayerWallLanding's
  // church_id lookup pattern (auth_id → users → churches).

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
      setViewerChurchId(userData.church_id);
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
    return () => { cancelled = true; };
  }, [isVerified, session?.user?.id]);

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
    if (view !== 'feed_list') return;
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
    if (view !== 'feed_list') return;
    if (!hasFetchedOnce.current) return; // initial-load effect owns the first fetch
    void loadInitial(selectedCategories, urgency);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, urgency]);

  // Tab-blur reset — restore landing + defaults + clear deep-link
  // + clear selected testimony (v6 Fix G — testimony detail sheet
  // dismisses when the leader leaves the tab, same posture as the
  // prayer detail sheet).
  // Keep a stable ref to route.params so useFocusEffect can read them at
  // focus time without including them in the dependency array (which would
  // cause the blur cleanup to fire every time params change — resetting view
  // mid-session).
  const routeParamsRef = useRef(route.params);
  useEffect(() => { routeParamsRef.current = route.params; }, [route.params]);

  useFocusEffect(
    useCallback(() => {
      // On focus: check if a cross-tab navigation requested the journal view.
      const params = routeParamsRef.current;
      if (params?.initialView === 'journal') {
        setView('journal');
        // Consume the param so re-focus doesn't re-trigger.
        navigation.setParams({ initialView: undefined, pendingChurch: undefined });
      }

      return () => {
        setView('feed');
        setActivePill('feed');
        setSelectedCategories(new Set());
        setUrgency(DEFAULT_URGENCY);
        setDetailRow(null);
        setDeepLinkTestimonyId(null);
        setSelectedTestimony(null);
      };
    }, [navigation]),
  );

  const handleClearFilters = () => {
    setSelectedCategories(new Set());
    setUrgency(DEFAULT_URGENCY);
  };

  const handlePostPress = () => {
    setPostModalVisible(true);
  };

  // Pill nav change — set both the active pill and the matching view.
  const handlePillChange = useCallback((pill: PrayerWallPill) => {
    setActivePill(pill);
    setView(pill as PrayerWallView);
  }, []);

  // ─── View routing ────────────────────────────────────────────────

  // journal — full-bleed Intercession Journal. No pill nav, no header.
  // Back returns to the Feed pill (the journal is reached from the Feed
  // pill's JournalLinkRow, or via cross-tab nav with initialView=journal).
  if (view === 'journal') {
    const pendingChurch = route.params?.pendingChurch ?? null;
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <IntercessionJournalView
          onBack={() => { setView('feed'); setActivePill('feed'); }}
          pendingChurch={pendingChurch}
          onNavigateToChurchTab={() => navigation.navigate('The Church')}
          onOpenPrayerRequest={handleOpenPrayerRequest}
        />
        <PrayerWallDetailSheet
          row={detailRow}
          onDismiss={() => setDetailRow(null)}
          viewerChurchId={viewerChurchId ?? undefined}
          onPrayedChange={(id, iPrayed, prayedCount) => {
            setDetailRow((prev) =>
              prev?.id === id ? { ...prev, i_prayed: iPrayed, prayed_count: prayedCount } : prev,
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // feed_list — full prayer-request list (filter bar + paginated cards).
  // Entered from the Feed pill's "Enter the prayer wall" CTA. No pill nav,
  // no segmented control. Back returns to the Feed pill.
  if (view === 'feed_list') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* Left-edge sky accent — anchor the feed view like the landing. */}
        <View pointerEvents="none" style={styles.leftEdgeAccent} />

        <View style={styles.topBar}>
          <Pressable
            onPress={() => { setView('feed'); setActivePill('feed'); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Prayer Wall"
          >
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
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
          ) : (
            <View style={styles.topBarRightPlaceholder} />
          )}
        </View>

        {/* Closing sky hairline below the topBar — mirrors the landing
            view's tabHeader pattern so the feed top reads as anchored,
            not floating. Separate from headerHairline (which has a
            14px marginTop tuned for the tabHeader context — would
            compound here with topBar.paddingBottom). */}
        <View style={styles.feedListHairline} />

        <PrayerWallFilterBar
          selectedCategories={selectedCategories}
          urgency={urgency}
          resultCount={rows.length}
          onCategoryToggle={handleCategoryToggle}
          onUrgencyChange={setUrgency}
          onClear={handleClearFilters}
        />

        {/* Faint grey closing hairline under the filter bar. Filters need
            their own visual polish (Founder note 2026-06-10 round 3),
            but for now this prevents the filters from bleeding straight
            into the feed cards below. */}
        <View style={styles.filterBarHairline} />

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

        <PrayerWallDetailSheet
          row={detailRow}
          onDismiss={() => setDetailRow(null)}
          viewerChurchId={viewerChurchId ?? undefined}
          onPrayedChange={(id, iPrayed, prayedCount) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === id ? { ...r, i_prayed: iPrayed, prayed_count: prayedCount } : r,
              ),
            );
          }}
        />

        <PostPrayerRequestModal
          visible={postModalVisible}
          churchName={postChurchName}
          isUnderground={postIsUnderground}
          defaultAnonymous={postDefaultAnon}
          onCancel={() => setPostModalVisible(false)}
          onSuccess={() => {
            setPostModalVisible(false);
            showToast('Your request has been lifted to the wall.');
            // On the list — refresh in place so the new request appears
            // immediately at the top without leaving the view.
            void refresh();
          }}
        />

        {toast ? (
          <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ─── Pill surfaces ───────────────────────────────────────────────
  // feed / testimonies / my_prayers / revelation / locations all share
  // the tab header + pill nav chrome. Each renders its own body below.
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Left-edge sky accent — mirrors PersecutedScreen.leftEdgeAccent
          (which uses red). Anchors the screen visually so the top header
          reads as framed, not floating. */}
      <View pointerEvents="none" style={styles.leftEdgeAccent} />

      <View style={styles.tabHeader}>
        <Text style={styles.title}>Prayer Wall</Text>
        <Text style={styles.landingSubtitle}>THE BODY GATHERED · IN ONE ACCORD</Text>
        <View style={styles.headerHairline} />
      </View>

      <PrayerWallPillNav active={activePill} onChange={handlePillChange} />

      {view === 'feed' && (
        <PrayerWallLanding
          onEnterFeed={() => setView('feed_list')}
          onSeeAllTestimonies={() => { setActivePill('testimonies'); setView('testimonies'); }}
          onOpenTestimony={(id) => {
            setDeepLinkTestimonyId(id);
            setActivePill('testimonies');
            setView('testimonies');
          }}
          onViewJournal={() => setView('journal')}
          onPost={handlePostPress}
        />
      )}

      {view === 'testimonies' && (
        <TestimoniesView
          deepLinkTestimonyId={deepLinkTestimonyId}
          onDeepLinkConsumed={() => setDeepLinkTestimonyId(null)}
          selectedTestimony={selectedTestimony}
          onSelectTestimony={setSelectedTestimony}
          rows={testimonyRows}
          setRows={setTestimonyRows}
          hasFetchedOnce={testimonyHasFetchedOnce}
          onCelebratedChange={handleCelebratedChange}
          onPublishTestimony={() => { setView('my_prayers'); setActivePill('my_prayers'); }}
        />
      )}

      <View style={{ flex: 1, display: view === 'my_prayers' ? 'flex' : 'none' }}>
        <MyOpenPrayersView onBackToLanding={() => { setView('feed'); setActivePill('feed'); }} />
      </View>

      {view === 'revelation' && (
        <RevelationView onNavigateToPersecuted={() => navigation.navigate('Persecuted')} />
      )}

      {view === 'locations' && <LocationsView />}

      {/* Detail sheet — reachable from the Feed pill landing previews
          (PrayerWallLanding routes those into feed_list, but the sheet
          host stays mounted here for any pill-surface open path) and
          kept passing viewerChurchId for the own-church Connect guard. */}
      <PrayerWallDetailSheet
        row={detailRow}
        onDismiss={() => setDetailRow(null)}
        viewerChurchId={viewerChurchId ?? undefined}
        onPrayedChange={(id, iPrayed, prayedCount) => {
          setRows((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, i_prayed: iPrayed, prayed_count: prayedCount } : r,
            ),
          );
        }}
      />

      {/* Post modal — also hosted on the pill surfaces so "Share a need"
          on the Feed pill's Receive card can open it without leaving. */}
      <PostPrayerRequestModal
        visible={postModalVisible}
        churchName={postChurchName}
        isUnderground={postIsUnderground}
        defaultAnonymous={postDefaultAnon}
        onCancel={() => setPostModalVisible(false)}
        onSuccess={() => {
          setPostModalVisible(false);
          showToast('Your request has been lifted to the wall.');
          // Posted from a pill surface — reset so the feed_list re-fetches
          // from scratch on next entry and the new request appears.
          hasFetchedOnce.current = false;
          setRows([]);
        }}
      />

      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>The wall is quiet.</Text>
            <Text style={styles.emptyBody}>
              When churches share burdens, their prayers will appear here.
            </Text>
          </View>
          <Pressable
            onPress={onPostPress}
            accessibilityRole="button"
            accessibilityLabel="Post a prayer request"
            style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
            hitSlop={6}
          >
            <Text style={styles.emptyCtaLabel}>POST A PRAYER REQUEST</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>The wall is quiet.</Text>
          <Text style={styles.emptyBody}>
            Prayer requests from verified churches will appear here.
          </Text>
        </View>
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

  // Left-edge sky accent — matches PersecutedScreen's red equivalent.
  // 1.5px wide, 25% opacity sky, full-height absolute. zIndex 1 puts
  // it above the background but below sheets/modals (which lift to 10+).
  leftEdgeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.accent,
    opacity: 0.25,
    zIndex: 1,
  },

  // Sky closing hairline below the feed_list topBar. No marginTop —
  // topBar.paddingBottom (18) already provides the breathing space.
  feedListHairline: {
    height: 0.5,
    backgroundColor: 'rgba(107,181,232,0.30)',
    width: '100%',
  },

  // FAINT grey closing hairline below the filter bar — sits between
  // the filters and the prayer-request cards. Founder ruling 2026-06-10:
  // filters need a stronger visual polish later, this is the holding pattern.
  filterBarHairline: {
    height: 0.5,
    backgroundColor: 'rgba(240,237,230,0.08)',
    width: '100%',
  },

  // KAN-24 — submit confirmation toast. Mirrors the
  // IntercessionJournalView toast (dark pill, faint hairline, off-white
  // body), pinned near the bottom of the screen.
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.08)',
  },
  toastText: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: '#F0EDE6',
  },
  topBar: {
    // Unified top-bar metrics with Home (2026-06-01).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  title: {
    // Unified wordmark with Home (2026-06-01): Cormorant 400 Regular, 26pt.
    // No Rp mark on Prayer Wall — Home only (Founder confirmed).
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  backArrow: {
    fontFamily: Typography.body,
    fontSize: 22,
    color: Colors.accent,
    lineHeight: 24,
  },
  tabHeader: {
    // Prayer Wall redesign — header shown above the pill nav on all five
    // pill surfaces. Matches the old landing header metrics.
    // paddingBottom is 0 since the headerHairline provides the visual
    // closing edge (mirrors PersecutedScreen NavBar pattern).
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 0,
  },
  headerHairline: {
    // Sky hairline at the bottom of the tab header — mirrors the
    // PersecutedScreen headerHairline (height 0.5, 30% accent alpha).
    // Persecuted uses red; Prayer Wall uses sky.
    height: 0.5,
    backgroundColor: 'rgba(107,181,232,0.30)',
    marginTop: 14,
    width: '100%',
  },
  landingSubtitle: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 6,
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
    marginTop: 14,
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
