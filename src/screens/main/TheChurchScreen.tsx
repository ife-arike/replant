// ─────────────────────────────────────────────
// TheChurchScreen — CAML + CAL host (KAN-18 / KAN-19 / KAN-21 / KAN-22)
//
// Structure per CD (church-tab/app.jsx + styles.css, Founder-locked
// 2026-05-28):
//
//   tc-header
//     ├── tc-title-row (title + subtitle, CAML/CAL variants)
//     └── tc-pager (At My Location · horizon line · At Large)
//
//   tc-pages — BOTH pages always mounted, opacity-crossfaded via
//             horizonProgress (R3). pointerEvents discrete-gated on
//             page so taps don't land mid-crossfade.
//     ├── page 0: CamlView (KAN-18/19, Mapbox flat map + nearby list)
//     └── page 1: CAL
//           ├── GlobeView (Mapbox globe, dot rendering, rotation)
//           ├── Count stats chip   (top-left of globe area)
//           ├── Regions button     (top-right of globe area — STUB)
//           ├── RegionalPanel      (slide-in, shell only — DBA-blocked body)
//           ├── ChurchProfileBottomSheet (KAN-20, dot-tap)
//           └── PrayerWallPullUp   (KAN-22, 3-state)
//
// useChurchesGlobal is hoisted here so both the subtitle (verified +
// hidden counts) and the count chip read from one source. GlobeView
// receives the data as props — its KAN-21 corner pills were stripped
// per CD chrome rule (KAN-21 c.14810, Founder ack 2026-05-28).
//
// Globe pause posture: forcePaused fires when ANY overlay is open OR the
// leader is on CAML (page !== 1). The CAML map handles its own pause
// implicitly — no rotation, no pulse, gated fetches via isActive.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import type { TabsParamList } from '../../navigation/types';
import Svg, { Line } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { useChurchesGlobal } from '../../hooks/useChurchesGlobal';
import { supabase } from '../../lib/supabase';
import GlobeView from '../../components/church/GlobeView';
import ChurchProfileBottomSheet from '../../components/church/ChurchProfileBottomSheet';
import CompletionFlowOverlay from '../../components/church/CompletionFlowOverlay';
import PrayerWallPullUp from '../../components/church/PrayerWallPullUp';
import RegionalPanel, { type ChurchRegion } from '../../components/church/RegionalPanel';
import CamlView from '../../components/church/CamlView';
import ChurchTutorialOverlay, { TUTORIAL_SEEN_KEY } from '../../components/church/ChurchTutorialOverlay';

type Page = 0 | 1; // 0 = CAML (placeholder), 1 = CAL (globe)

// Horizon-line math from CD styles.css: --horizon-w grows from 22% to
// 78% as page goes 0→1; --horizon-x slides from 0% to 22% so the bar
// stays inside the track. Same easing as the CD: cubic-bezier(.22, .61,
// .36, 1) over 550ms.
const HORIZON_MS = 550;

// ── UnverifiedGateView ──────────────────────────────────────────────
// Sits at the top of TheChurchScreen's stacking context (zIndex 20)
// when the viewer is not yet verified, covering globe + CAML + sheet
// + tab chrome with a near-opaque sky scrim. Pastoral copy + the CD
// .glyph-cross + Philippians 1:6. The Mapbox surfaces below remain
// mounted but are visually held until the leader's church is
// confirmed by a Replant team member.
function UnverifiedGateView() {
  return (
    <View style={styles.unverifiedGate}>
      {/* Sky cross glyph — CD .glyph-cross, 36×36 */}
      <Svg width={36} height={36} viewBox="0 0 36 36" style={styles.gateCrossGlyph}>
        <Line x1="18" y1="5"  x2="18" y2="31" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="9"  y1="15" x2="27" y2="15" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
      <Text style={styles.gateTitle}>Your account is being verified.</Text>
      <Text style={styles.gateBody}>
        Once your church is confirmed by a Replant team member, you'll unlock The Church
        tab — and be able to see, and be seen by, every verified leader on the network.
      </Text>
      <Text style={styles.gateTiny}>Most verifications complete in 24–72 hours.</Text>
      <View style={styles.gateScripture}>
        <Text style={styles.gateScriptureText}>
          "He which hath begun a good work in you will perform it…"
        </Text>
        <Text style={styles.gateScriptureRef}>PHILIPPIANS 1:6</Text>
      </View>
    </View>
  );
}

export default function TheChurchScreen() {
  const { branch } = useAuth();
  const viewerVerified = branch === 'active';
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList>>();
  const reduced = useReducedMotion();

  // Hoisted globe data — subtitle + count chip + GlobeView all read from
  // the same source (one network call, no duplicate fetches).
  const {
    dots, undergroundCount, ownChurchId, viewerCountry, loading, error, refetch,
  } = useChurchesGlobal();

  // ── KAN-213: Church profile completion gate ─────────────────────────
  // Resolved once on mount (when branch flips to 'active') via a single
  // SELECT on public.users. Re-checked each time TheChurchScreen mounts
  // so a leader who skipped and cold-launched triggers the overlay again.
  //
  // completionReady = true  → gate check settled; render overlay or not
  // showCompletionFlow = true → render CompletionFlowOverlay (AC 1)
  // skippedThisSession = true → leader pressed Skip; overlay dismissed
  //   for this session only. profile_completion_done stays false.
  const [completionReady, setCompletionReady] = useState(false);
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [completionChurchId, setCompletionChurchId] = useState<string | null>(null);
  const [completionUserId, setCompletionUserId] = useState<string | null>(null);
  const [completionUserRole, setCompletionUserRole] = useState<string>('pastor');
  // KAN-213: whether the leader's profile completion is done. Drives the
  // own-dot re-trigger (3b) — tapping your own pin while incomplete
  // re-enters the flow rather than opening your card.
  const [profileComplete, setProfileComplete] = useState(false);
  const skippedThisSession = useRef(false);

  // Tutorial overlay — shown once after the leader's first Church tab entry
  // (post-verification). Persisted via SecureStore. Waits for completionReady
  // so it doesn't race the completion flow.
  const [showTutorial, setShowTutorial] = useState(false);
  // Bumped by the tutorial when step 2 ("Your church is here") is entered,
  // causing CamlView to snap the camera to the church's registered location.
  const [panToChurchTrigger, setPanToChurchTrigger] = useState(0);
  const [recenterGPSTrigger, setRecenterGPSTrigger] = useState(0);
  const [prayerWallCollapseTrigger, setPrayerWallCollapseTrigger] = useState(0);
  // Stable refs — avoids the "maximum update depth" loop from inline arrows.
  const handleTutorialPanToChurch = useCallback(() => {
    setPanToChurchTrigger((n) => n + 1);
  }, []);
  const handleTutorialRecenterGPS = useCallback(() => {
    setRecenterGPSTrigger((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!viewerVerified || !completionReady || showCompletionFlow) return;
    SecureStore.getItemAsync(TUTORIAL_SEEN_KEY).then((v) => {
      if (!v) setShowTutorial(true);
    }).catch(() => {});
  }, [viewerVerified, completionReady, showCompletionFlow]);

  const checkCompletionGate = useCallback(async () => {
    if (!viewerVerified || skippedThisSession.current) return;

    // Resolve the viewer's public.users row for church_id, id, and role.
    const { data: sessionData } = await supabase.auth.getSession();
    const authId = sessionData?.session?.user?.id;
    if (!authId) return;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, church_id, role')
      .eq('auth_id', authId)
      .single();

    if (userErr || !userRow?.church_id) {
      // Can't tell — assume complete to avoid false own-dot re-triggers.
      setProfileComplete(true);
      setCompletionReady(true);
      return;
    }

    const churchId = userRow.church_id as string;
    const userId = userRow.id as string;
    const role = (userRow.role as string) ?? 'pastor';

    setCompletionChurchId(churchId);
    setCompletionUserId(userId);
    setCompletionUserRole(role);

    // Call get_church_profile to read profile_completion_done.
    const { data: profileData, error: profileErr } = await supabase.rpc('get_church_profile', {
      p_church_id: churchId,
    });

    if (profileErr || profileData === null) {
      // Can't determine completion state — fail open (let user in, don't block).
      // Assume complete so the own-dot tap opens the card, not the flow.
      setProfileComplete(true);
      setCompletionReady(true);
      return;
    }

    const profile = profileData as { profile_completion_done?: boolean; profile_completion_done_by?: string | null } | null;
    const completionDone = profile?.profile_completion_done ?? false;
    const completionDoneBy = profile?.profile_completion_done_by ?? null;

    // AC 1: show flow if branch === 'active' AND profile_completion_done === false
    // AC 2: show intro-only if done by a different leader (second-leader path —
    //        CompletionFlowOverlay handles the second-leader branch internally
    //        since it already has the profile data; we surface the overlay for
    //        both cases and let the overlay sort the two paths).
    const shouldShow =
      !completionDone ||
      (completionDone && completionDoneBy !== null && completionDoneBy !== userId);

    setShowCompletionFlow(shouldShow);
    setProfileComplete(!shouldShow);
    setCompletionReady(true);
  }, [viewerVerified]);

  useEffect(() => {
    void checkCompletionGate();
  }, [checkCompletionGate]);

  // onComplete — leader finished Step 3 or second-leader tapped "Enter".
  // Overlay dismissed; DB has profile_completion_done = true so next
  // checkCompletionGate will return shouldShow = false.
  const handleCompletionComplete = useCallback(() => {
    setShowCompletionFlow(false);
    void refetch();
    // refetch() refreshes the global dot data (useChurchesGlobal), but
    // CamlView holds its own get-nearby-churches fetch that won't re-run
    // on its own. Bump the trigger so CAML re-fetches and the leader sees
    // their church land in the list + on the map right away.
    setCamlRefreshTrigger((n) => n + 1);
  }, [refetch]);

  // onSkip — leader tapped "Skip · I'll do this later" (AC 3).
  // Sets session-local flag so the overlay does NOT re-show during this
  // session. profile_completion_done stays false; re-triggers on cold relaunch.
  const handleCompletionSkip = useCallback(() => {
    skippedThisSession.current = true;
    setShowCompletionFlow(false);
  }, []);

  const [page, setPage] = useState<Page>(0);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  // Post-completion CAML refetch — bumped in handleCompletionComplete so
  // CamlView re-runs its internal get-nearby-churches fetch and the
  // leader's own church appears immediately, without leaving the tab.
  // Starts at 0 (CamlView ignores 0 to avoid double-fetching on mount).
  const [camlRefreshTrigger, setCamlRefreshTrigger] = useState(0);

  // KAN-213 (3b): tapping your own church dot while your profile is still
  // incomplete re-enters the completion flow instead of opening the card.
  // Clearing skippedThisSession lets the overlay re-mount even if the
  // leader had skipped it earlier this session.
  const handleChurchSelect = useCallback(
    (churchId: string) => {
      if (churchId === ownChurchId && !profileComplete) {
        skippedThisSession.current = false;
        setShowCompletionFlow(true);
        return;
      }
      setSelectedChurchId(churchId);
    },
    [ownChurchId, profileComplete],
  );
  // Fix 6 — city resolved by CamlView via Mapbox places reverse-geocode
  // on the leader's GPS. Null until the first geocode response lands;
  // the header renders bare "The Church" in the interim (no hardcoded
  // fallback). Page 1 (CAL) keeps its "at Large" copy.
  const [camlCity, setCamlCity] = useState<string | null>(null);
  // KAN-18 R3 — total verified-leader count within CAML's 50 km radius,
  // reported by CamlView once the API call settles. Null until then;
  // subtitle renders an em-dash placeholder.
  const [camlLeaderCount, setCamlLeaderCount] = useState<number | null>(null);
  const [regionalOpen, setRegionalOpen] = useState(false);
  const [regional, setRegional] = useState<ChurchRegion | null>(null);
  // Fix A (2026-05-28): host-side track of overlay state so we can pause
  // the globe rotation + red-dot pulse whenever any overlay is visible.
  const [prayerWallSnap, setPrayerWallSnap] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const anyOverlayOpen =
    selectedChurchId !== null || regionalOpen || prayerWallSnap !== 'collapsed';

  // Counts for the chrome.
  const verifiedCount = dots.length;
  const urgentCount = useMemo(
    () => dots.reduce((n, d) => (d.rag_status === 'red' ? n + 1 : n), 0),
    [dots],
  );

  // Horizon animated value 0→1.
  const horizonProgress = React.useRef(new Animated.Value(page)).current;
  React.useEffect(() => {
    if (reduced) {
      horizonProgress.setValue(page);
    } else {
      Animated.timing(horizonProgress, {
        toValue: page,
        duration: HORIZON_MS,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: false, // animating width/left, not transform
      }).start();
    }
  }, [page, reduced, horizonProgress]);

  const horizonWidth = horizonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['22%', '78%'],
  });
  const horizonLeft = horizonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '22%'],
  });

  // Regions button (STUB per Step 0 halt — get_churches_global lacks
  // country/name/leaders fields). Opens the RegionalPanel shell with a
  // placeholder region so the chrome is testable; real region selection
  // lands when DBA delivers (KAN-21 c.14810).
  const handleRegionsPress = () => {
    setRegional({ name: 'Coming soon', churches: [] });
    setRegionalOpen(true);
  };

  const handleHorizonPress = () => setPage((p) => (p === 0 ? 1 : 0));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* tc-header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {page === 0 ? (
              // Header tells the truth: no fabricated "at <city>" before
              // the Mapbox reverse-geocode lands. useChurchesGlobal does
              // not currently expose ownChurchCity (only ownChurchId and
              // viewerCountry — country-grain, wrong for a city header),
              // and the dispatch barred any hardcoded city string. So we
              // render bare "The Church" until camlCity resolves
              // (typically <1 s after the first GPS fix).
              camlCity ? (
                <>The Church at <Text style={styles.titleEm}>{camlCity}</Text></>
              ) : (
                <>The Church</>
              )
            ) : (
              <>The Church <Text style={styles.titleEm}>at Large</Text></>
            )}
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {page === 0
            ? `YOUR LOCATION · ${camlLeaderCount !== null ? camlLeaderCount : '—'} LEADERS WITHIN 50 KM`
            : `GLOBAL · ${verifiedCount} VERIFIED · +${undergroundCount} HIDDEN`}
        </Text>
        {/* tc-pager — horizon switcher */}
        <View style={styles.pager}>
          <Text style={[styles.pagerLabel, page === 0 && styles.pagerLabelActive]}>AT MY LOCATION</Text>
          <Pressable onPress={handleHorizonPress} style={styles.horizonTrack} accessibilityRole="button" accessibilityLabel={page === 0 ? 'Switch to At Large' : 'Switch to At My Location'}>
            <View style={styles.horizonBase} />
            <Animated.View style={[styles.horizonBar, { width: horizonWidth, left: horizonLeft }]} />
          </Pressable>
          <Text style={[styles.pagerLabel, styles.pagerLabelRight, page === 1 && styles.pagerLabelActive]}>AT LARGE</Text>
        </View>
      </View>

      {/* tc-pages — BOTH surfaces always mounted; crossfade driven by
          horizonProgress (KAN-18 R3). The previous display:none toggle
          flashed; opacity interpolation now slides each container
          opposite the other (CAML 1→0, CAL 0→1) over the same ~550 ms
          horizon-bar animation. pointerEvents is gated on the DISCRETE
          page state — never on the in-flight animation — so taps don't
          land on the fading-out surface mid-crossfade. Mapbox-backed
          views stay mounted across the swap: no GL teardown, no
          location-listener churn. */}
      <View style={styles.pages}>
        {/* CAML — always mounted, fades 1 → 0 as page goes 0 → 1 */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: horizonProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              pointerEvents: page === 0 ? 'auto' : 'none',
            },
          ]}
        >
          <CamlView
            isActive={page === 0}
            ownChurchId={ownChurchId}
            viewerVerified={viewerVerified}
            onChurchSelect={handleChurchSelect}
            onCityResolved={setCamlCity}
            onLeaderCountResolved={setCamlLeaderCount}
            refreshTrigger={camlRefreshTrigger}
            panToChurchTrigger={panToChurchTrigger}
            recenterToGPSTrigger={recenterGPSTrigger}
          />
        </Animated.View>

        {/* CAL — always mounted, fades 0 → 1 as page goes 0 → 1 */}
        <Animated.View
          style={[
            styles.calStack,
            StyleSheet.absoluteFillObject,
            {
              opacity: horizonProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              pointerEvents: page === 1 ? 'auto' : 'none',
            },
          ]}
        >
          <GlobeView
            dots={dots}
            ownChurchId={ownChurchId}
            viewerCountry={viewerCountry}
            loading={loading}
            error={error}
            onRetry={refetch}
            onChurchSelect={handleChurchSelect}
            // KAN-18: also pause when the user is on the CAML page so the
            // globe stops rotating + pulsing the moment they swap surfaces.
            forcePaused={anyOverlayOpen || page !== 1}
            bottomInset={88}
          />

          {/* Count stats chip — top-left of globe area (CD app.jsx) */}
          <View style={styles.countChip} pointerEvents="none">
            <Text style={styles.countChipText}>
              <Text style={styles.countSky}>{verifiedCount}</Text>
              <Text style={styles.countMuted}> VERIFIED · </Text>
              <Text style={styles.countRed}>{urgentCount}</Text>
              <Text style={styles.countMuted}> URGENT · </Text>
              <Text style={styles.countOffWhite}>+{undergroundCount}</Text>
              <Text style={styles.countMuted}> HIDDEN</Text>
            </Text>
          </View>

          {/* Regions button — top-right of globe area. STUB per Step 0
              halt (KAN-21 c.14810) — opens the RegionalPanel shell. */}
          <Pressable
            onPress={handleRegionsPress}
            style={styles.regionsBtn}
            accessibilityRole="button"
            accessibilityLabel="Regions"
          >
            <View style={styles.regionsDot} />
            <Text style={styles.regionsText}>REGIONS</Text>
          </Pressable>

          {/* RegionalPanel — shell only; body pending DBA. */}
          <RegionalPanel
            open={regionalOpen}
            region={regional}
            onClose={() => setRegionalOpen(false)}
          />

          {/* KAN-22 — Prayer Wall pull-up. onSnapChange feeds the
              anyOverlayOpen gate so the globe pauses while the panel
              is half or full (Fix A). */}
          <PrayerWallPullUp onSnapChange={setPrayerWallSnap} collapseTrigger={prayerWallCollapseTrigger} />
        </Animated.View>
      </View>

      {/* Dot-tap profile sheet — outside the page swap so dismiss state
          survives a page change (defensive; not strictly needed today). */}
      <ChurchProfileBottomSheet
        churchId={selectedChurchId}
        viewerVerified={viewerVerified}
        // Fix A (2026-05-28): own-church pin → My Church variant.
        // ownChurchId is sourced from useChurchesGlobal (registered
        // church id from users.church_id, NOT live GPS — the watched
        // invariant).
        isOwnChurch={selectedChurchId !== null && selectedChurchId === ownChurchId}
        onDismiss={() => setSelectedChurchId(null)}
        onNavigateToConnect={() => navigation.navigate('Connect')}
      />

      {/* Unverified-leader gate — overlays the entire surface (zIndex
          20). Mapbox surfaces stay mounted below but are visually held
          until the leader's church is confirmed by a Replant team
          member. */}
      {!viewerVerified ? <UnverifiedGateView /> : null}

      {/* KAN-213: Church profile completion gate (AC 1 + AC 2).
          Renders ONLY when:
            - branch === 'active' (viewerVerified)
            - completionReady (gate check settled, avoids flash on cold start)
            - showCompletionFlow (profile_completion_done = false, or second-leader path)
          zIndex 28 — sits above UnverifiedGate (zIndex 20).
          completionChurchId / completionUserId guaranteed non-null when
          showCompletionFlow is true (gate check sets both before flipping
          showCompletionFlow). */}
      {viewerVerified && completionReady && showCompletionFlow &&
       completionChurchId !== null && completionUserId !== null ? (
        <CompletionFlowOverlay
          churchId={completionChurchId}
          currentUserId={completionUserId}
          currentRole={completionUserRole}
          onComplete={handleCompletionComplete}
          onSkip={handleCompletionSkip}
        />
      ) : null}

      {/* Church tab tutorial — first-entry onboarding. Shows once after
          verification + completion gate. zIndex 30 sits above all overlays. */}
      {showTutorial ? (
        <ChurchTutorialOverlay
          onComplete={() => {
            setShowTutorial(false);
            setPrayerWallCollapseTrigger((n) => n + 1);
          }}
          onRequestPanToChurch={handleTutorialPanToChurch}
          onRequestRecenterToGPS={handleTutorialRecenterGPS}
          currentPage={page}
          prayerWallSnap={prayerWallSnap}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // tc-header — CD styles.css .tc-header
  // Fix 1 (2026-05-28): increased bottom padding so the switcher row
  // has breathing room before the globe area starts.
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    // CD has a gradient fade to background. RN doesn't do CSS gradients
    // out-of-the-box; sticking to a solid near-black for now.
    backgroundColor: 'rgba(8, 8, 8, 0.92)',
    zIndex: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: {
    fontFamily: Typography.displayRegular, // CD: Cormorant 400, weight per spec
    // 26pt matches the Replant wordmark register on Home; 30pt (Connect's
    // size) would wrap long city names like "The Church at Johannesburg".
    fontSize: 26,
    letterSpacing: 0.52, // 0.02em × 26
    color: Colors.text,
    lineHeight: 30,
  },
  titleEm: {
    fontFamily: Typography.displayItalic, // sky italic per CD .tc-title em
    color: Colors.accent,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.1, // ~0.22em × 9.5
    color: Colors.textMuted,
  },

  // tc-pager
  pager: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  // KAN-18 R2 — pager parity. "AT MY LOCATION" renders ~14 chars and
  // "AT LARGE" ~8 chars; with horizonTrack flex: 1 between them, the
  // bar visually shifts off-centre between pages. Equal minWidth on
  // both labels + textAlign 'left' on the left label / 'right' on the
  // right label keeps the track centred between equal-width boxes.
  pagerLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textMuted,
    minWidth: 112,
    textAlign: 'left',
  },
  pagerLabelRight: { textAlign: 'right' },
  pagerLabelActive: { color: Colors.accent },
  horizonTrack: {
    flex: 1, height: 12,
    justifyContent: 'center',
  },
  horizonBase: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  horizonBar: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    shadowColor: Colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // tc-pages
  pages: { flex: 1 },

  // CAL stack
  calStack: { flex: 1 },

  // Count chip — top-left of globe area (CD: top:16, left:16)
  // Fix 1 (2026-05-28): bumped fontSize 8.5 → 10 and padding 7/11 → 9/13
  // so the chip is legible on-device. CD CSS reads 8.5px for web; RN
  // renders the same numeric size noticeably smaller, so a clean bump
  // restores legibility without breaking the visual rhythm.
  countChip: {
    position: 'absolute',
    top: 16, left: 16,
    paddingVertical: 9, paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    zIndex: 8,
  },
  countChipText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6, // ~0.16em × 10
    lineHeight: 14,
  },
  countSky:      { color: Colors.accent },
  countRed:      { color: Colors.red },
  countOffWhite: { color: Colors.text },
  countMuted:    { color: Colors.textMuted },

  // Regions button — top-right of globe area (CD: top:16, right:16)
  regionsBtn: {
    position: 'absolute',
    top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 8, 8, 0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    zIndex: 8,
  },
  regionsDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.textMuted,
  },
  regionsText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },

  // ── Unverified gate (UnverifiedGateView) ──
  unverifiedGate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(8,8,8,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  gateCrossGlyph: { marginBottom: 24 },
  gateTitle: {
    fontFamily: Typography.scriptureLight,
    fontSize: 23,
    letterSpacing: 0.46, // 0.02em × 23
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 29,
    marginBottom: 12,
    maxWidth: 280,
  },
  gateBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 20.5,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 8,
  },
  gateTiny: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 28,
  },
  gateScripture: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(107,181,232,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    borderRadius: 8,
    maxWidth: 300,
    alignItems: 'center',
  },
  gateScriptureText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13.5,
    color: Colors.text,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  gateScriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.98, // 0.22em × 9
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
