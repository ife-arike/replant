// ─────────────────────────────────────────────
// PersecutedScreen — Persecuted refinement host (2026-07-26)
// Spec: docs/design_handoff_persecuted_NEW/README.md — the README wins
// over the .dc.html mock. Founder rulings 2026-07-26: anonymisation
// stays CONTINENT; "Standing this week" ships as its empty state (no
// fabrication) until get_persecuted_standing() + admin tagging exist.
//
// A REFINEMENT, not a rebuild: keeps the threshold preamble, anonymity
// byline, hold-in-prayer, status track, four scripture footers, the
// guidance library, and the EAP prompt. Replaces the four pills + the
// red flood: three tabs (Heartcries · Witnesses · Take heart) under the
// Prayer Wall's gliding-indicator chrome (indicator + header rule are
// the tab's ONLY chrome reds), My Voice as a header text action with an
// unread dot (replaces NotifBar entirely), expand-in-place rows, and
// red reduced to the five marks + two share actions.
//
// Replaced from the previous build: PillTabBar (4 pills), NotifBar,
// FeedScene's ROUND_SIZE pager + detail-card grammar, the red screen
// title, the header security subtitle (now inside the share card), the
// left-edge red accent, and the 60px gate lock. Old scenes stay on
// disk, unrouted, until this design settles.
//
// Gate: the WHOLE tab is gated (unlike Prayer Wall) — heartcries carry
// real risk for the people who write them. Tabs render dimmed, the
// indicator collapses, and every tap toasts the unlock line.
//
// Data ownership: heartcry rows + hold state and My Voice rows live
// HERE so optimistic state survives view switches (PrayerWallScreen v7
// Fix 09 posture). Hold honours the jsonb payload contract via
// rpcAppError (device pass r3 lesson — never transport-only).
//
// Cross-screen contract: HeartcrySubmission's confirmation Done lands
// the leader in My Voice via route.params.initialView === 'voice'
// (consumed on focus, same grammar as Prayer Wall's journal param).
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useViewerChurch } from '../../hooks/useViewerChurch';
import { viewerOrgCopy } from '../../utils/displayHelpers';
import { rpcAppError } from '../../components/prayer/wallNewLogic';
import { WallTabs } from '../../components/prayer/WallPrimitives';
import type { RootStackParamList, TabsParamList } from '../../navigation/types';
import HeartcriesView, { type HeartcryLoadState } from './persecuted/HeartcriesView';
import WitnessesView from './persecuted/WitnessesView';
import TakeHeartView from './persecuted/TakeHeartView';
import MyVoiceView, { type MyVoiceLoadState, type MyVoiceRow } from './persecuted/MyVoiceView';
import {
  ALL_CONTINENTS,
  PERSECUTED_TABS,
  TIER_RED,
  type HeartcryRow,
  type PersecutedTab,
} from './persecuted/persecutedNewLogic';

const FEED_PAGE_SIZE = 20;

const EMAIL = 'accounts@projectreplant.org';

type GateState = 'loading' | 'verified' | 'gated' | 'error';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function PersecutedScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<TabsParamList, 'Persecuted'>>();
  const [gateState, setGateState] = useState<GateState>('loading');
  const { church: viewerChurch } = useViewerChurch();
  const viewer = viewerOrgCopy(viewerChurch?.type);

  // ── View state ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<PersecutedTab>('heartcries');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [animTick, setAnimTick] = useState(0);

  // ── Heartcries state (hoisted — optimistic hold survives switches) ──
  const [rows, setRows] = useState<HeartcryRow[]>([]);
  const [feedLoad, setFeedLoad] = useState<HeartcryLoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [continent, setContinent] = useState<string>(ALL_CONTINENTS);
  const [filterOpen, setFilterOpen] = useState(false);
  const feedFetchedOnce = useRef(false);

  // ── My Voice state ──────────────────────────────────────────────────
  const [voiceRows, setVoiceRows] = useState<MyVoiceRow[]>([]);
  const [voiceLoad, setVoiceLoad] = useState<MyVoiceLoadState>('initial');
  const voiceFetchedOnce = useRef(false);
  // Unread dot — a heartcry has been responded to and My Voice is
  // closed. Replaces NotifBar entirely (one dot instead of a banner).
  const unread = !voiceOpen && voiceRows.some((r) => r.status === 'responded' && r.thread_id !== null);

  // ── Toast (wall register — serif italic, sky hairline) ──────────────
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

  // ── Gate check (existing posture — users.verification_status) ───────
  const gateStateRef = useRef<GateState>('loading');
  useEffect(() => { gateStateRef.current = gateState; }, [gateState]);

  const loadVerification = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authId = userData.user?.id;
    if (!authId) {
      setGateState('gated');
      return;
    }
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('verification_status')
      .eq('auth_id', authId)
      .maybeSingle();
    if (userErr || !userRow) {
      setGateState('error');
      return;
    }
    setGateState(userRow.verification_status === 'verified' ? 'verified' : 'gated');
  }, []);

  // ── Heartcries fetch ────────────────────────────────────────────────
  const fetchFeedPage = useCallback(async (offset: number, cont: string) => {
    const { data, error } = await supabase.rpc('get_heartcry_feed', {
      p_limit: FEED_PAGE_SIZE,
      p_offset: offset,
      p_region: cont === ALL_CONTINENTS ? null : cont,
    });
    if (error) return { rows: null as HeartcryRow[] | null };
    return { rows: (data ?? []) as HeartcryRow[] };
  }, []);

  const loadFeedInitial = useCallback(async (cont: string) => {
    setFeedLoad('initial');
    const { rows: page } = await fetchFeedPage(0, cont);
    feedFetchedOnce.current = true;
    if (page === null) {
      setFeedLoad('error');
      return;
    }
    setRows(page);
    setHasMore(page.length === FEED_PAGE_SIZE);
    setFeedLoad('idle');
    setAnimTick((t) => t + 1);
  }, [fetchFeedPage]);

  const refreshFeed = useCallback(async () => {
    setFeedLoad('refreshing');
    const { rows: page } = await fetchFeedPage(0, continent);
    feedFetchedOnce.current = true;
    if (page === null) {
      setFeedLoad('error');
      return;
    }
    setRows(page);
    setHasMore(page.length === FEED_PAGE_SIZE);
    setFeedLoad('idle');
    setAnimTick((t) => t + 1);
    showToast('The feed is current.');
  }, [fetchFeedPage, continent, showToast]);

  useEffect(() => {
    if (gateState !== 'verified') return;
    if (!feedFetchedOnce.current) void loadFeedInitial(continent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateState]);

  // Continent change refetches (server-side p_region) and re-staggers.
  const handleSelectContinent = useCallback((c: string) => {
    setContinent(c);
    void loadFeedInitial(c);
  }, [loadFeedInitial]);

  // ── Hold in prayer — optimistic, payload-contract aware ─────────────
  const handleHold = useCallback(async (row: HeartcryRow) => {
    const nextHeld = !row.viewer_held;
    const delta = nextHeld ? 1 : -1;
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, viewer_held: nextHeld, hold_count: r.hold_count + delta } : r,
      ),
    );
    const { data, error } = await supabase.rpc('hold_heartcry_in_prayer', {
      p_heartcry_id: row.id,
    });
    if (error || rpcAppError(data)) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, viewer_held: row.viewer_held, hold_count: row.hold_count } : r,
        ),
      );
    }
    // No toast on hold (README) — the label flip and the count say it.
  }, []);

  // ── My Voice fetch ──────────────────────────────────────────────────
  const loadVoice = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_heartcries');
    voiceFetchedOnce.current = true;
    if (error) {
      setVoiceLoad('error');
      return;
    }
    setVoiceRows((data ?? []) as MyVoiceRow[]);
    setVoiceLoad('idle');
  }, []);

  useEffect(() => {
    if (gateState !== 'verified') return;
    if (!voiceFetchedOnce.current) void loadVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateState]);

  // ── Focus: gate recheck + cross-screen My Voice landing ────────────
  const routeParamsRef = useRef(route.params);
  useEffect(() => { routeParamsRef.current = route.params; }, [route.params]);

  useFocusEffect(
    useCallback(() => {
      if (gateStateRef.current !== 'verified') void loadVerification();
      const params = routeParamsRef.current;
      if (params?.initialView === 'voice') {
        setVoiceOpen(true);
        void loadVoice();
        navigation.setParams?.({ initialView: undefined } as never);
      }
      return () => {
        // Leader returns to the wide-open default (existing posture).
        setTab('heartcries');
        setVoiceOpen(false);
        setExpandedId(null);
        setFilterOpen(false);
      };
    }, [loadVerification, loadVoice, navigation]),
  );

  // ── Navigation ──────────────────────────────────────────────────────
  const openForm = () => navigation.navigate('HeartcrySubmission');
  const openThread = (threadId: string) =>
    navigation.navigate('Tabs', { screen: 'Connect', params: { conversationId: threadId } });
  const openGuidance = (slug: string) => navigation.navigate('GuidanceReader', { slug });
  const startEap = () =>
    navigation.navigate('Tabs', { screen: 'Connect', params: { initialSubTab: 'ministries' } });

  const gated = gateState === 'gated' || gateState === 'error';
  const gateToast = () =>
    showToast(`The Persecuted Church unlocks once ${viewer.yourChurchOrOrg} is verified.`);

  const handleTab = (t: string) => {
    if (gated) {
      gateToast();
      return;
    }
    const next = t as PersecutedTab;
    if (next === tab && !voiceOpen) return;
    setVoiceOpen(false);
    setTab(next);
    setFilterOpen(false);
    setAnimTick((k) => k + 1);
  };

  const handleVoicePress = () => {
    if (gated) {
      gateToast();
      return;
    }
    setVoiceOpen((v) => !v);
    if (!voiceFetchedOnce.current) void loadVoice();
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header — title row + My Voice action + tabs + red rule. The
          security subtitle is gone (it lives in the share card now);
          the title is off-white, never red. */}
      <View style={s.titleRow}>
        <Text style={s.title}>The Persecuted Church</Text>
        <Pressable
          onPress={handleVoicePress}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: voiceOpen }}
          accessibilityLabel={unread ? 'My Voice — response waiting' : 'My Voice'}
          style={s.voiceAction}
        >
          {unread ? <View style={s.unreadDot} /> : null}
          <Text
            style={[
              s.voiceLabel,
              voiceOpen && { color: Colors.accent },
              gated && { color: 'rgba(240,237,230,0.28)' },
            ]}
          >
            MY VOICE
          </Text>
        </Pressable>
      </View>

      <WallTabs
        active={tab}
        hidden={voiceOpen || gated}
        onChange={handleTab}
        tabs={PERSECUTED_TABS}
        indicatorColor={TIER_RED}
        gated={gated}
      />
      <View style={s.headerRule} />

      {gateState === 'loading' ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : gated ? (
        <GateBody orgWord={viewer.yourChurchOrOrg} />
      ) : voiceOpen ? (
        <FadeView key="voice">
          <MyVoiceView
            rows={voiceRows}
            loadState={voiceLoad === 'error' ? 'error' : voiceFetchedOnce.current ? voiceLoad : 'initial'}
            onOpenThread={openThread}
            onShare={openForm}
            onRetry={() => { setVoiceLoad('initial'); void loadVoice(); }}
          />
        </FadeView>
      ) : tab === 'heartcries' ? (
        <FadeView key={`heartcries-${animTick}`}>
          <HeartcriesView
            rows={rows}
            loadState={feedLoad}
            expandedId={expandedId}
            continent={continent}
            filterOpen={filterOpen}
            animTick={animTick}
            onExpand={setExpandedId}
            onHold={handleHold}
            onRefresh={() => void refreshFeed()}
            onRetry={() => void loadFeedInitial(continent)}
            onToggleFilter={() => setFilterOpen((v) => !v)}
            onSelectContinent={handleSelectContinent}
            onShare={openForm}
          />
        </FadeView>
      ) : tab === 'witnesses' ? (
        <FadeView key="witnesses">
          <WitnessesView witness={null} stories={[]} />
        </FadeView>
      ) : (
        <FadeView key="takeheart">
          <TakeHeartView onOpenGuidance={openGuidance} onStartEap={startEap} />
        </FadeView>
      )}

      {toast ? (
        <Animated.View style={[s.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// 350ms view fade on tab change (README motion table).
function FadeView({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [opacity]);
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

// ─── Gate body — copy per README; no lock glyph, tabs stay visible ────

function GateBody({ orgWord }: { orgWord: string }) {
  return (
    <View style={s.gateBody}>
      <Text style={s.gateEyebrow}>NOT YET VERIFIED</Text>
      <Text style={s.gateHeading}>This section is for verified leaders in the Replant network.</Text>
      {/* "your church" swaps for para-ministry viewers (BA-para #1 —
          house invariant predating the handoff copy). */}
      <Text style={s.gateBodyCopy}>
        Heartcries carry real risk for the people who write them, so the room stays closed until
        the Replant team confirms {orgWord}. Once verified, it opens in full.
      </Text>
      <Text style={s.gateItalic}>
        In the meantime the Prayer Wall is open to you, and the body there is praying for these
        same churches.
      </Text>
      <View style={s.gateRule} />
      <Pressable
        onPress={() => Linking.openURL(`mailto:${EMAIL}`)}
        accessibilityRole="button"
        accessibilityLabel={`Email the Replant team at ${EMAIL}`}
        hitSlop={8}
      >
        <Text style={s.gateMail}>QUESTIONS? EMAIL THE REPLANT TEAM.</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 25,
    lineHeight: 25,
    letterSpacing: 0.4,
    color: Colors.text,
  },
  voiceAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 3 },
  unreadDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  voiceLabel: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: 'rgba(240,237,230,0.42)',
    textTransform: 'uppercase',
  },
  headerRule: { height: 1, backgroundColor: Colors.borderAccentRed, marginHorizontal: 22 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  gateBody: { paddingTop: 44, paddingHorizontal: 22 },
  gateEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.8,
    color: 'rgba(240,237,230,0.35)',
    textTransform: 'uppercase',
  },
  gateHeading: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    lineHeight: 29.5,
    color: Colors.text,
    marginTop: 16,
  },
  gateBodyCopy: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21.5,
    color: 'rgba(240,237,230,0.50)',
    marginTop: 14,
  },
  gateItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(240,237,230,0.45)',
    marginTop: 18,
  },
  gateRule: { height: 1, backgroundColor: Colors.border, marginTop: 28 },
  gateMail: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.32)',
    textTransform: 'uppercase',
    marginTop: 16,
  },

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
