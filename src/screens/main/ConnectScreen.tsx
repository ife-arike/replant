// ConnectScreen — KAN-68/69/70 host (HANDOFF.md / docs/design_handoff_connect_tab).
//
// "A sealed letter, not a chat app." Connect is the private communication
// layer of Replant: 1:1 leader-to-leader DMs (Leaders sub-tab, KAN-68/70)
// and group church-to-church branches (Ministries sub-tab, KAN-69 / John
// 15:5). This screen is the host:
//   - Holds the SubTab (ministries | leaders) state.
//   - Drives a ConnectView union for push-screen navigation entirely
//     in component state (no nested Stack.Navigator per the architecture
//     decision — consistent with TheChurchScreen + PersecutedScreen).
//   - Loads + writes the covenant_ack flag from/to SecureStore. The
//     flag is per-account; written once, never re-prompted.
//   - Resolves caller's public.users.id + church_id once on mount so
//     downstream surfaces (LeadersList, BranchCreate) can use them.
//   - Renders the unverified soft-gate overlay when the leader's
//     `branch` is anything other than 'active' (HANDOFF §8).
//
// SECURITY:
//   - covenant_ack lives in SecureStore (Keychain / EncryptedSharedPrefs),
//     NOT AsyncStorage. The flag is auth-adjacent material; AsyncStorage
//     is plaintext on Android and below SEC's bar for the persecuted-
//     leader threat model (cross-ref src/lib/supabase.ts header).
//   - No content text ever passes through this component's logs.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { TabsParamList } from '../../navigation/types';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import Svg, { Line } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useChurchVerifiedStatus } from '../../hooks/useChurchVerifiedStatus';
import { useConnectBadge } from '../../contexts/ConnectBadgeContext';
import { supabase } from '../../lib/supabase';
import { getRoleLabel, viewerOrgCopy } from '../../utils/displayHelpers';
import { useViewerChurch } from '../../hooks/useViewerChurch';

import ConnectHeader from '../../components/connect/ConnectHeader';
import Segmented from '../../components/connect/Segmented';
import LeadersList from '../../components/connect/LeadersList';
import LeaderSearch, { type SearchedLeader } from '../../components/connect/LeaderSearch';
import DMThreadView from '../../components/connect/DMThreadView';
import {
  getOrCreateConversationIfPermitted,
  ConnectionRequestError,
} from '../../hooks/useConnectionRequest';
import MinistriesList from '../../components/connect/MinistriesList';
import BranchCreate from '../../components/connect/BranchCreate';
import BranchThreadView from '../../components/connect/BranchThreadView';

export type SubTab = 'ministries' | 'leaders';

// Optional initial profile snapshot passed into the DM thread view so
// its header renders immediately without waiting on the async profile
// resolution (Fix 1, KAN-68 CD-alignment pass). Already RPC-masked:
// the row-list source applies the underground "Underground Church"
// substitution and the "Replant Team" secure-thread label before
// handing the snapshot to the view.
export interface InitialThreadProfile {
  // Pre-composed display name for the DM thread view header — matches
  // the row's name line exactly (e.g. "Pastor Ruth James" for
  // identified, role label for anonymous). Computed in LeadersList
  // per the data.jsx leaderName() rule.
  displayName: string;
  fullName: string;
  churchName: string;
  isSecure: boolean;
  isAnon?: boolean;
}

// ConnectView — the single source of truth for which surface is active.
// `list` is the host (Leaders or Ministries list, driven by subTab).
// The other kinds are push screens that overlay the list.
export type ConnectView =
  | { kind: 'list' }
  | { kind: 'search' }
  | {
      kind: 'thread';
      conversationId: string | null;
      recipientUserId: string | null;
      initialProfile?: InitialThreadProfile;
      // KAN-69 request-flow: set true when sending the first message to
      // an unconnected leader. Routes Send through send_connection_request.
      isConnectionRequest?: boolean;
      // Set when the current leader is the recipient of a pending request.
      requestId?: string | null;
      requestMessage?: string | null;
      requestSenderName?: string;
    }
  | { kind: 'branch'; branchId: string }
  | { kind: 'create' };

const COVENANT_ACK_KEY = 'covenant_ack';
const PUSH_DURATION_MS = 260;

// HANDOFF §4: cubic-bezier(.32,.72,0,1) is the global Connect easing.
const PUSH_EASING = Easing.bezier(0.32, 0.72, 0, 1);

// Soft cross-platform toast — matches the "no expo-blur, no native
// chrome popups" posture of the rest of the app. On iOS we render a
// transient pill; on Android we use ToastAndroid.
function useToast() {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    setText(message);
    Animated.timing(opacity, {
      toValue: 1, duration: 180, useNativeDriver: true,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0, duration: 220, useNativeDriver: true,
      }).start(() => setText(null));
    }, 3000);
  }, [opacity]);

  const node = text ? (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  ) : null;

  return { show, node };
}

// ── ConnectGateView — full-screen overlay (HANDOFF §8) ───────────────
// Matches TheChurchScreen's UnverifiedGateView exactly: absolute fill,
// rgba(8,8,8,0.92) background, sky cross glyph, scriptureLight title,
// body text, mono wait-line, scripture box with Habakkuk 2:3.
//
// Two copy variants (same logic as TheChurchScreen):
//   churchVerified = true  → second leader (church verified, leader pending)
//   churchVerified = false/null → original leader (church + leader pending)
//
// NOT dismissible — this is a protection layer, not an info sheet.
// Copy is Connect-specific (not "The Church tab" language).
function ConnectGateView({ churchVerified, viewerChurchType }: { churchVerified: boolean | null; viewerChurchType: string | null | undefined }) {
  const isLeaderPending = churchVerified === true;
  const viewer = viewerOrgCopy(viewerChurchType);
  // Founder ruling #6 (locked 2026-06-21) is PRESERVED: the timeline
  // copy is the SAME phrase for surface and underground — no
  // differential, no fingerprint. The phrase now states both the
  // 30-day max AND the 24-72hr typical window universally.
  // viewerChurchType is intentionally NOT branched on here.
  // para-ministry copy swap (church → organization) still applies via
  // viewer.yourChurchOrOrg per BA-para #1.
  void viewerChurchType;
  return (
    <View style={styles.gate}>
      {/* Sky cross glyph — identical to TheChurchScreen */}
      <Svg width={44} height={44} viewBox="0 0 36 36" style={styles.gateCrossGlyph}>
        <Line x1="18" y1="5"  x2="18" y2="31" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="9"  y1="15" x2="27" y2="15" stroke={Colors.accent} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
      <Text style={styles.gateTitle}>
        {isLeaderPending
          ? 'Your access is being confirmed.'
          : 'Your account is being verified.'}
      </Text>
      <Text style={styles.gateBody}>
        {isLeaderPending
          ? `${viewer.yourChurchOrOrgCap} is already part of the Replant network. Once the team confirms your account, you'll unlock Connect and reach verified leaders around the world.`
          : `Once ${viewer.yourChurchOrOrg} is confirmed by a Replant team member, you'll unlock Connect and reach verified leaders around the world.`}
      </Text>
      <Text style={styles.gateTiny}>
        This process may take up to 30 days, but reviews are typically complete within 24-72 hours.
      </Text>
    </View>
  );
}

// ── caller identity hook ─────────────────────────────────────────────
function useCallerIdentity() {
  const { session } = useAuth();
  const [callerUserId, setCallerUserId] = useState<string | null>(null);
  const [callerChurchId, setCallerChurchId] = useState<string | null>(null);
  const [callerChurchName, setCallerChurchName] = useState<string>('Your ministry');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authUid = session?.user?.id;
      if (!authUid) return;
      const { data } = await supabase
        .from('users')
        .select('id, church_id, churches!users_church_id_fkey(name, type)')
        .eq('auth_id', authUid)
        .maybeSingle() as any;
      if (cancelled || !data) return;
      setCallerUserId(data.id);
      setCallerChurchId(data.church_id ?? null);
      const ch = data.churches;
      const underground = ch?.type === 'underground';
      setCallerChurchName(underground ? 'Underground Church' : (ch?.name ?? 'Your ministry'));
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return { callerUserId, callerChurchId, callerChurchName };
}

// ── ConnectScreen ────────────────────────────────────────────────────
export default function ConnectScreen() {
  const { branch } = useAuth();
  const verified = branch === 'active';
  // Underground Verification Queue (manifest 2026-06-22) — a soft-deleted
  // leader can READ existing threads + ministries but cannot WRITE.
  // - Compose hidden (no new DM / branch).
  // - Gate overlay NOT mounted (would block reading the leader's own
  //   threads, which is the explicit read-only experience the queue
  //   guarantees during the 30-day window).
  // RLS enforces write-block server-side; this is FE defense-in-depth.
  const isSoftDeleted = branch === 'soft_deleted';
  // Distinguish church-pending vs leader-pending for the gate copy.
  // useChurchVerifiedStatus only fires a DB query when branch === 'pending';
  // it is a no-op (returns null) for active leaders — zero extra cost.
  const churchVerified = useChurchVerifiedStatus();
  const { pendingInvites } = useConnectBadge();
  const { callerUserId, callerChurchId, callerChurchName } = useCallerIdentity();
  // Para-ministry copy swap on the unverified gate (BA-para #1).
  const { church: viewerChurch } = useViewerChurch();

  const [subTab, setSubTab] = useState<SubTab>('leaders');
  const [view, setView] = useState<ConnectView>({ kind: 'list' });
  const [ministriesRefreshTick, setMinistriesRefreshTick] = useState(0);
  const [leadersRefreshTick, setLeadersRefreshTick] = useState(0);
  const [covenantAck, setCovenantAck] = useState(false);
  const { show: showToast, node: toastNode } = useToast();
  const { width } = useWindowDimensions();

  // Push transition Animated.Value: 0 = list shown, 1 = push surface shown.
  // We keep the list mounted underneath so back gestures can slide back.
  const pushAnim = useRef(new Animated.Value(0)).current;
  // Hold the active push view independent of `view` so we can render it
  // during slide-out animations after the user dismisses.
  const [pushVisible, setPushVisible] = useState<ConnectView | null>(null);

  // ── covenant: load on mount, persist on accept ───────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(COVENANT_ACK_KEY);
        if (!cancelled) setCovenantAck(v === 'true');
      } catch {
        if (!cancelled) setCovenantAck(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const acknowledgeCovenant = useCallback(async () => {
    setCovenantAck(true);
    try {
      await SecureStore.setItemAsync(COVENANT_ACK_KEY, 'true');
    } catch {
      // Best-effort. If SecureStore fails, the in-memory flag still
      // unblocks this session's send; next launch will re-prompt.
    }
  }, []);

  // ── view transitions ─────────────────────────────────────────────
  const goTo = useCallback((next: ConnectView) => {
    if (next.kind === 'list') {
      // Restore list state immediately so Segmented + compose button
      // are visible as the push layer slides away. pushVisible stays
      // set until animation finishes so the push surface keeps animating.
      setView({ kind: 'list' });
      Animated.timing(pushAnim, {
        toValue: 0,
        duration: PUSH_DURATION_MS,
        easing: PUSH_EASING,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setPushVisible(null);
          setMinistriesRefreshTick((t) => t + 1);
          setLeadersRefreshTick((t) => t + 1);
        }
      });
      return;
    }
    // Push: mount the surface + animate it in.
    setPushVisible(next);
    setView(next);
    pushAnim.setValue(0);
    Animated.timing(pushAnim, {
      toValue: 1,
      duration: PUSH_DURATION_MS,
      easing: PUSH_EASING,
      useNativeDriver: true,
    }).start();
  }, [pushAnim]);

  const backToList = useCallback(() => goTo({ kind: 'list' }), [goTo]);

  // ── deep-link param consumption — one-shot on focus ─────────────
  // ConnectScreen is a state-machine host (no nested Stack.Navigator).
  // Cross-tab navigations pass params on the Connect tab route; we
  // consume them here on first focus after navigation so the tab bar
  // doesn't need to know anything about internal Connect surfaces.
  const route = useRoute<RouteProp<TabsParamList, 'Connect'>>();
  const navigation = useNavigation();
  const consumedConvRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const params = route.params;
      if (!params) return;

      // conversationId → open DM thread directly
      if (params.conversationId && consumedConvRef.current !== params.conversationId) {
        consumedConvRef.current = params.conversationId;
        goTo({ kind: 'thread', conversationId: params.conversationId, recipientUserId: null });
        return; // don't also switch sub-tab
      }

      // initialSubTab → switch sub-tab (only on list view, not mid-thread).
      // Clear after consuming so it doesn't re-apply on every tab focus.
      if (params.initialSubTab && view.kind === 'list') {
        setSubTab(params.initialSubTab);
        navigation.setParams({ initialSubTab: undefined } as never);
      }
    }, [route.params, view.kind, goTo]),
  );

  // ── compose handler — depends on subTab ──────────────────────────
  const handleCompose = useCallback(() => {
    if (subTab === 'leaders') {
      goTo({ kind: 'search' });
    } else {
      goTo({ kind: 'create' });
    }
  }, [subTab, goTo]);

  // ── leader picked from search — branch to existing, bypass, or request ─
  // KAN-69 + same-network bypass (20260609000006):
  //   1. Existing conversation → open it normally.
  //   2. No conversation yet → ask the server (via
  //      getOrCreateConversationIfPermitted) whether the two leaders are
  //      in-network (same church OR a shared active branch):
  //        - returns a conversation_id → in-network, open a normal DM
  //          (isConnectionRequest: false) with that conversation.
  //        - throws ConnectionRequestError('requires_connection_request')
  //          → strangers, open the thread in request mode (existing flow).
  // The bypass decision belongs HERE at the navigation layer so the DM
  // thread opens in the right mode from the first frame — never inside
  // DMThreadView.
  const onPickLeader = useCallback(async (leader: SearchedLeader) => {
    if (!callerUserId) return;
    // Canonical UUID-sorted participant pair (matches the conversations
    // unique_participant_pair constraint).
    const [pa, pb] = [callerUserId, leader.userId].sort();
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_a', pa)
      .eq('participant_b', pb)
      .maybeSingle();
    // Compose displayName from role + fullName (same rule as LeadersList).
    const roleLabel = leader.role ? getRoleLabel(leader.role) : '';
    const displayName = leader.anonymous
      ? (roleLabel || 'Leader')
      : (roleLabel ? `${roleLabel} ${leader.fullName}`.trim() : leader.fullName);
    const churchName = leader.underground ? 'Underground Church' : leader.churchName;
    const initialProfile = {
      displayName,
      fullName: leader.fullName,
      churchName,
      isSecure: false,
      isAnon: leader.anonymous,
    };

    if (existing?.id) {
      // Existing conversation — open normally.
      goTo({
        kind: 'thread',
        conversationId: existing.id,
        recipientUserId: null,
        initialProfile,
      });
      return;
    }

    // No conversation yet — let the server decide whether the consent
    // layer applies. In-network pairs bypass the request flow.
    try {
      const convId = await getOrCreateConversationIfPermitted(leader.userId);
      // In-network — open a normal DM with the (find-or-created) conversation.
      goTo({
        kind: 'thread',
        conversationId: convId,
        recipientUserId: null,
        initialProfile,
        isConnectionRequest: false,
      });
    } catch (err) {
      if (
        err instanceof ConnectionRequestError &&
        err.code === 'requires_connection_request'
      ) {
        // Strangers — open the thread in connection-request mode.
        goTo({
          kind: 'thread',
          conversationId: null,
          recipientUserId: leader.userId,
          initialProfile,
          isConnectionRequest: true,
        });
      } else {
        // Any other failure (not_authorized, recipient_not_found, etc.).
        // Surface a neutral toast and stay on the search surface rather
        // than opening a half-formed thread.
        showToast("This leader can't be reached right now.");
      }
    }
  }, [callerUserId, goTo, showToast]);

  // ── always-mounted list surfaces — hidden with display:'none' ──────
  // Both lists stay mounted regardless of which sub-tab is active.
  // Switching sub-tabs toggles visibility only; neither list ever
  // unmounts, so they never hit their initial loading state on a
  // tab switch. display:'none' removes from layout (like CSS) without
  // unmounting the React subtree.
  const leadersVisible = subTab === 'leaders';
  const ministriesVisible = subTab === 'ministries';
  const listSurface = useMemo(() => (
    <>
      <View style={{ flex: 1, display: leadersVisible ? 'flex' : 'none' }}>
        <LeadersList
          refreshTrigger={leadersRefreshTick}
          onOpenThread={(thread) =>
            goTo({
              kind: 'thread',
              conversationId: thread.conversationId,
              recipientUserId: null,
              // Snapshot the already-resolved profile so the DM view
              // header doesn't render a "·" placeholder while it
              // re-fetches the same data (Fix 1). `displayName` is
              // the pre-composed header label from LeadersList
              // (data.jsx leaderName() rule — "Pastor Ruth James"
              // for identified, role-only for anonymous).
              initialProfile: {
                displayName: thread.displayName,
                fullName: thread.fullName,
                churchName: thread.churchName,
                isSecure: thread.isSecure,
                isAnon: thread.anonymous,
              },
            })}
          onFindLeader={() => goTo({ kind: 'search' })}
          // KAN-69: incoming request rows open with the request props so
          // DMThreadView renders the in-thread accept/decline view.
          onOpenRequestThread={(thread) =>
            goTo({
              kind: 'thread',
              conversationId: null,
              recipientUserId: thread.otherUserId,
              initialProfile: {
                displayName: thread.displayName,
                fullName: thread.fullName,
                churchName: thread.churchName,
                isSecure: thread.isSecure,
                isAnon: thread.anonymous,
              },
              requestId: thread.requestId,
              // The preview from get_leader_thread_list contains the
              // request message body (LEFT 60 chars).
              requestMessage: thread.preview || null,
              requestSenderName: thread.displayName,
            })}
        />
      </View>
      <View style={{ flex: 1, display: ministriesVisible ? 'flex' : 'none' }}>
        <MinistriesList
          onOpenBranch={(branchId) => goTo({ kind: 'branch', branchId })}
          onStartBranch={() => goTo({ kind: 'create' })}
          onToast={showToast}
          refreshTrigger={ministriesRefreshTick}
        />
      </View>
    </>
  ), [leadersVisible, ministriesVisible, leadersRefreshTick, ministriesRefreshTick, goTo, showToast]);

  // ── render the active push surface (when applicable) ─────────────
  const pushSurface = useMemo(() => {
    if (!pushVisible) return null;
    switch (pushVisible.kind) {
      case 'search':
        return (
          <LeaderSearch
            callerUserId={callerUserId}
            onBack={backToList}
            onPick={onPickLeader}
          />
        );
      case 'thread':
        return (
          <DMThreadView
            conversationId={pushVisible.conversationId}
            recipientUserId={pushVisible.recipientUserId}
            initialProfile={pushVisible.initialProfile}
            callerUserId={callerUserId}
            covenantAcknowledged={covenantAck}
            onAcknowledgeCovenant={acknowledgeCovenant}
            onBack={backToList}
            onSwipeBack={backToList}
            onConversationCreated={(cid) => {
              // Update the in-flight view so a subsequent send-message
              // call carries conversation_id (not recipient_user_id).
              setView((cur) =>
                cur.kind === 'thread'
                  ? { ...cur, conversationId: cid, recipientUserId: null }
                  : cur,
              );
            }}
            // KAN-69 request-flow props (undefined when not applicable).
            isConnectionRequest={pushVisible.isConnectionRequest}
            requestId={pushVisible.requestId}
            requestMessage={pushVisible.requestMessage}
            requestSenderName={pushVisible.requestSenderName}
          />
        );
      case 'branch':
        return (
          <BranchThreadView
            branchId={pushVisible.branchId}
            callerUserId={callerUserId}
            onBack={backToList}
            onSwipeBack={backToList}
          />
        );
      case 'create':
        return (
          <BranchCreate
            callerUserId={callerUserId}
            callerChurchId={callerChurchId}
            callerChurchName={callerChurchName}
            onBack={backToList}
            onCreated={(branchId) => {
              // Swap to the branch thread view (which will render the
              // forming banner until consent fills out).
              goTo({ kind: 'branch', branchId });
            }}
            onToast={showToast}
          />
        );
      case 'list':
        return null;
    }
  }, [
    pushVisible, callerUserId, callerChurchId, callerChurchName,
    covenantAck, acknowledgeCovenant, backToList, onPickLeader, goTo, showToast,
  ]);

  // ── animated push container styles ────────────────────────────────
  const pushTranslate = pushAnim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* List + chrome (always mounted under push surfaces). */}
      <View style={styles.listLayer}>
        <ConnectHeader
          subTab={subTab}
          showCompose={view.kind === 'list' && verified}
          onCompose={handleCompose}
        />
        <Segmented
          value={subTab}
          onChange={setSubTab}
          badges={{ ministries: pendingInvites }}
        />
        <View style={styles.listBody}>
          {listSurface}
        </View>
      </View>

      {/* Push layer — slides in from right with fade. */}
      {pushVisible && (
        <Animated.View
          style={[
            styles.pushLayer,
            { transform: [{ translateX: pushTranslate }] },
          ]}
        >
          {pushSurface}
        </Animated.View>
      )}

      {/* Unverified gate — full-screen overlay (zIndex 20) matching the
          Church tab gate style. NOT dismissible — protection layer.
          Covers the list AND any push surface that might be behind it.
          Two copy variants: church-pending vs leader-pending.
          Queue §4 (manifest 2026-06-22): soft-deleted leaders SKIP this
          gate — they get a read-only Connect with compose hidden so
          their existing threads remain accessible during the 30-day
          window. RLS enforces write-block server-side. */}
      {!verified && !isSoftDeleted ? (
        <ConnectGateView churchVerified={churchVerified} viewerChurchType={viewerChurch?.type} />
      ) : null}

      {/* iOS toast (Android uses ToastAndroid). */}
      {toastNode}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  listLayer: { flex: 1 },
  listBody: { flex: 1 },
  pushLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 20,
  },
  // ── ConnectGateView — full-screen overlay (mirrors TheChurchScreen) ──
  // Full-screen overlay. Top-aligned (no justifyContent:'center') so
  // the glyph sits ~marginTop:300 below the screen top, matching the
  // Persecuted gate's lower-anchored feel. Scripture block removed
  // 2026-06-22.
  gate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(8,8,8,0.92)',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  gateCrossGlyph: { marginTop: 300, marginBottom: 28 },
  gateTitle: {
    fontFamily: Typography.scriptureLight,
    fontSize: 28,
    letterSpacing: 0.56,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 35,
    marginBottom: 16,
  },
  gateBody: {
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: Colors.textMuted,
    lineHeight: 23,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  gateTiny: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em × 10.5
    textTransform: 'uppercase',
    color: Colors.accent,
    textAlign: 'center',
    marginBottom: 28,
  },
  // ── toast (iOS only; Android uses ToastAndroid) ──
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 22, right: 22,
    backgroundColor: 'rgba(15,15,15,0.96)',
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  toastText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
  },
});
