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
  Modal,
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
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
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

// ── unverified soft gate (HANDOFF §8) ────────────────────────────────
function ShieldGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
        stroke={Colors.accent} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4.2"
        stroke={Colors.accent} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UnverifiedGate({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.gateScrim} onPress={onDismiss}>
        <Pressable style={styles.gateSheet} onPress={() => {}}>
          <View style={styles.gateGrab} />
          <View style={styles.gateGlyph}><ShieldGlyph /></View>
          <Text style={styles.gateTitle}>For verified leaders</Text>
          <Text style={styles.gateBody}>
            Available to verified leaders. Verification confirms your place
            in the network.
          </Text>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.gateBtnText}>I understand</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
        .select('id, church_id, churches:church_id(name, type)')
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
  const { callerUserId, callerChurchId, callerChurchName } = useCallerIdentity();

  const [subTab, setSubTab] = useState<SubTab>('leaders');
  const [view, setView] = useState<ConnectView>({ kind: 'list' });
  const [covenantAck, setCovenantAck] = useState(false);
  const [gateDismissedThisSession, setGateDismissedThisSession] = useState(false);
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
      {/* List + chrome (always mounted under push surfaces). The
          `filter: brightness(0.5)` from the prototype maps to RN as an
          opacity overlay over the list when the unverified sheet is
          showing — see styles.gateBackdrop. */}
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
        {!verified && !gateDismissedThisSession && (
          <View pointerEvents="none" style={styles.gateBackdrop} />
        )}
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

      {/* Unverified soft gate — shown each time the leader lands on
          Connect while not yet verified. Does NOT permanently dismiss;
          just hides for this session. */}
      <UnverifiedGate
        visible={!verified && !gateDismissedThisSession}
        onDismiss={() => setGateDismissedThisSession(true)}
      />

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
  // ── unverified gate ──
  gateBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,8,0.5)',
  },
  gateScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,4,0.5)',
    justifyContent: 'flex-end',
  },
  gateSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
  },
  gateGrab: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(240,237,230,0.20)',
    marginBottom: 16,
  },
  gateGlyph: { marginBottom: 12 },
  gateTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  gateBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  gateBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
  },
  gateBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
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
