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
import { supabase } from '../../lib/supabase';

import ConnectHeader from '../../components/connect/ConnectHeader';
import Segmented from '../../components/connect/Segmented';
import LeadersList from '../../components/connect/LeadersList';
import LeaderSearch, { type SearchedLeader } from '../../components/connect/LeaderSearch';
import DMThreadView from '../../components/connect/DMThreadView';
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
function ConnectGateView({ churchVerified }: { churchVerified: boolean | null }) {
  const isLeaderPending = churchVerified === true;
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
          ? "Your church is already part of the Replant network. Once the team confirms your account, you'll unlock Connect and be able to reach leaders directly."
          : "Once your church is confirmed by a Replant team member, you'll unlock Connect — private, sealed letters between leaders around the world."}
      </Text>
      <Text style={styles.gateTiny}>
        {isLeaderPending
          ? 'Confirmation usually takes 24–72 hours.'
          : 'Most verifications complete in 24–72 hours.'}
      </Text>
      <View style={styles.gateScripture}>
        <Text style={styles.gateScriptureText}>
          "For the vision is yet for an appointed time, but at the end it shall speak, and not lie: though it tarry, wait for it; because it will surely come, it will not tarry."
        </Text>
        <Text style={styles.gateScriptureRef}>HABAKKUK 2:3</Text>
      </View>
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
  // Distinguish church-pending vs leader-pending for the gate copy.
  // useChurchVerifiedStatus only fires a DB query when branch === 'pending';
  // it is a no-op (returns null) for active leaders — zero extra cost.
  const churchVerified = useChurchVerifiedStatus();
  const { callerUserId, callerChurchId, callerChurchName } = useCallerIdentity();

  const [subTab, setSubTab] = useState<SubTab>('leaders');
  const [view, setView] = useState<ConnectView>({ kind: 'list' });
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
      // Animate the current push surface out, then unmount.
      Animated.timing(pushAnim, {
        toValue: 0,
        duration: PUSH_DURATION_MS,
        easing: PUSH_EASING,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setPushVisible(null);
          setView({ kind: 'list' });
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

  // ── compose handler — depends on subTab ──────────────────────────
  const handleCompose = useCallback(() => {
    if (subTab === 'leaders') {
      goTo({ kind: 'search' });
    } else {
      goTo({ kind: 'create' });
    }
  }, [subTab, goTo]);

  // ── leader picked from search — branch to existing or lazy ──────
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
    if (existing?.id) {
      goTo({ kind: 'thread', conversationId: existing.id, recipientUserId: null });
    } else {
      goTo({ kind: 'thread', conversationId: null, recipientUserId: leader.userId });
    }
  }, [callerUserId, goTo]);

  // ── render the active list surface (Leaders or Ministries) ──────
  const listSurface = useMemo(() => {
    if (subTab === 'leaders') {
      return (
        <LeadersList
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
              },
            })}
          onFindLeader={() => goTo({ kind: 'search' })}
        />
      );
    }
    return (
      <MinistriesList
        onOpenBranch={(branchId) => goTo({ kind: 'branch', branchId })}
        onStartBranch={() => goTo({ kind: 'create' })}
        onToast={showToast}
      />
    );
  }, [subTab, goTo, showToast]);

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
  const pushOpacity = pushAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* List + chrome (always mounted under push surfaces). */}
      <View style={styles.listLayer}>
        <ConnectHeader
          subTab={subTab}
          showCompose={view.kind === 'list' && verified}
          onCompose={handleCompose}
        />
        {view.kind === 'list' && (
          <Segmented value={subTab} onChange={setSubTab} />
        )}
        <View style={styles.listBody}>
          {listSurface}
        </View>
      </View>

      {/* Push layer — slides in from right with fade. */}
      {pushVisible && (
        <Animated.View
          style={[
            styles.pushLayer,
            {
              transform: [{ translateX: pushTranslate }],
              opacity: pushOpacity,
            },
          ]}
        >
          {pushSurface}
        </Animated.View>
      )}

      {/* Unverified gate — full-screen overlay (zIndex 20) matching the
          Church tab gate style. NOT dismissible — protection layer.
          Covers the list AND any push surface that might be behind it.
          Two copy variants: church-pending vs leader-pending. */}
      {!verified ? <ConnectGateView churchVerified={churchVerified} /> : null}

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
  gate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'rgba(8,8,8,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  gateCrossGlyph: { marginBottom: 28 },
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
    fontSize: 9.5,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 28,
  },
  gateScripture: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(107,181,232,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  gateScriptureText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16.5,
    color: Colors.text,
    lineHeight: 25,
    textAlign: 'center',
    marginBottom: 12,
  },
  gateScriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: Colors.accent,
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
