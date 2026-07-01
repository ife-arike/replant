// DMThreadView — KAN-70 §6.3 / HANDOFF §6.3.
//
// 1:1 leader-to-leader DM thread. Inverted FlatList (newest at bottom),
// 5-minute timestamp grouping, optimistic send via the KAN-71
// send-message edge function, Realtime subscription on
// public.messages filtered by conversation_id, covenant gate on the
// leader's first send ever.
//
// SECURITY INVARIANTS — DO NOT VIOLATE:
//   - Plain text only. URLs render as PLAIN TEXT — never linkified, no
//     preview, no prefetch (HANDOFF §6.3 + §10: prevents IP/location
//     leakage to outside servers).
//   - No flagged-state read or render anywhere in this component. The
//     KAN-70 leader-opacity contract holds: the leader's app treats
//     every delivered message identically; only the admin moderation
//     queue ever sees `flagged`. DELIVER-ALWAYS (D-45 clause 3).
//   - Send call uses the EXISTING send-message edge function
//     (KAN-71) — NEVER send-branch-message. Branch threads use a
//     different function (BranchThreadView).
//   - Content NEVER appears in any log statement (mirror the SAFE-LOG
//     posture in send-message). We don't log here at all today;
//     keeping that posture if anyone adds debug logs later.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useConnectBadge } from '../../contexts/ConnectBadgeContext';
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { getRoleLabel } from '../../utils/displayHelpers';
import CovenantStrip from './CovenantStrip';
import CovenantNotice from './CovenantNotice';
import AttachmentPopover from './AttachmentPopover';
import RequestNote from './RequestNote';
import SentRequestModal from './SentRequestModal';
import DeclineRequestModal from './DeclineRequestModal';
import RequestActionsBar from './RequestActionsBar';
import {
  sendConnectionRequest,
  respondToRequest,
  ConnectionRequestError,
} from '../../hooks/useConnectionRequest';

interface Props {
  // Either threadId (existing conversation) or recipientUserId (lazy thread).
  conversationId: string | null;
  recipientUserId: string | null;
  // Fix 1 (KAN-68 CD-alignment pass): the row-list already resolved the
  // other party's identity via get_leader_thread_list — accept that
  // snapshot here so the header renders correctly on the very first
  // frame, before the async profile-resolution useEffect lands. When
  // absent (e.g. KAN-65 deep link via the routing primitive) we fall
  // back to the existing profile-load path.
  //
  // `displayName` is the pre-composed header label (e.g. "Pastor
  // Ruth James" for identified, "Pastor" for anonymous, "Replant
  // Team — Secure Message" rendered locally for secure). Computed in
  // LeadersList.fetchThreadList per the data.jsx leaderName() rule
  // so the header matches the row name exactly.
  initialProfile?: {
    displayName: string;
    fullName: string;
    churchName: string;
    isSecure: boolean;
    isAnon?: boolean;
  };
  callerUserId: string | null;
  covenantAcknowledged: boolean;
  onAcknowledgeCovenant: () => Promise<void>;
  onBack: () => void;
  // Optional swipe-left-to-go-back gesture handler. Called by the
  // PanResponder when the leader swipes right→left with a horizontal
  // displacement > 80pt and a vertical component < 30pt. The existing
  // back button remains; this is an additive gesture path.
  onSwipeBack?: () => void;
  onConversationCreated?: (conversationId: string) => void;
  // KAN-69 request-flow props.
  //
  // isConnectionRequest: true when the thread is being opened for a
  // NEW message to an unconnected leader. Shows RequestNote above the
  // composer and routes Send through send_connection_request RPC
  // instead of the normal send-message edge fn.
  isConnectionRequest?: boolean;
  // requestId + requestMessage: populated when the current leader is
  // the RECIPIENT of a pending connection request (row_kind =
  // 'request_incoming'). These power the in-thread accept/decline view.
  requestId?: string | null;
  requestMessage?: string | null;
  // requestSenderName: display name of the person who sent the request.
  // Used in the AcceptSystemMessage label.
  requestSenderName?: string;
}

interface ThreadMessage {
  id: string;
  mine: boolean;
  text: string;
  createdAt: Date;
  // Optimistic-send state on outbound messages only.
  state?: 'pending' | 'sent' | 'failed';
  // Stable groupLabel decided once per 5-min window (see buildGroupLabels).
  groupLabel?: string | null;
  // KAN-296 Task #21 — human-first attribution on Replant-Team-authored
  // messages. When set on an inbound message inside a secure Replant Team
  // thread, the renderer surfaces `"<First> · Replant Team"` as an eyebrow
  // above the bubble so the leader in distress sees the warmth of a real
  // person's first name (e.g. "Sarah") instead of a faceless system label.
  // NULL / empty → render the bubble alone (backwards-compat with all
  // pre-KAN-296 rows and with any Replant Team send that omitted the
  // attribution deliberately).
  attributionDisplayName?: string | null;
}

interface OtherParty {
  userId: string;
  displayName: string;
  churchLabel: string;
  isSecure: boolean;
}

const PAGE_SIZE = 30;
// Timestamp grouping threshold. iMessage uses ~60-minute gaps; a 5-minute
// window put a divider between every tight cluster of replies.
const GROUP_GAP_MS = 60 * 60 * 1000;
// connect-polish-1 Fix B → connect-polish-2 Fix 3 follow-up: with the
// field collapsed to 36pt, the 42pt attach + send buttons looked larger
// than the field they framed (visual misalignment in the device pass).
// Founder ruling: match button size to field height so the clip icon,
// input field, and send arrow all sit at the same vertical extent. The
// 36pt hit target is still well above the iOS HIG 24pt minimum and the
// Material 32dp recommendation; tap accuracy is fine. AttachmentPopover
// anchoring is unaffected — `attachWrap` is `position: relative` and
// the popover's `bottom: 50` is measured from the wrap's bottom edge
// (which sits at the composer's flex-end floor regardless of the
// button's height). Grow-on-input + textAlignVertical untouched.
const MIN_COMPOSER_HEIGHT = 36;
const COMPOSER_BUTTON_SIZE = 40;

// ── inline icons ──────────────────────────────────────────────────────
function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={Colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LockIcon({ color = Colors.accent, size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size + 1} viewBox="0 0 14 16" fill="none">
      <Rect x={2.5} y={6.5} width={9} height={7.5} rx={1.4} stroke={color} strokeWidth={1.3} />
      <Path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}
function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l15-7-5.5 16-3.2-6.3L5 12z"
        stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function ClipIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M9 7.5v8a3 3 0 0 0 6 0V6a4.5 4.5 0 0 0-9 0v9.5a6 6 0 0 0 12 0V8"
        stroke={Colors.textSubtle} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClockIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.5} stroke={Colors.textSubtle} strokeWidth={1.3} />
      <Path d="M7 4v3.2l2 1.3" stroke={Colors.textSubtle} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function AlertIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.8} stroke={Colors.red} strokeWidth={1.4} />
      <Path d="M7 4v3.4M7 9.6v.2" stroke={Colors.red} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

// ── time formatting (per HANDOFF §6.3) ────────────────────────────────
export function formatMessageTime(date: Date): string {
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return 'Today ' + time;
  if (isYesterday) return `Yesterday ${time}`;
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'short' });
    return `${weekday} ${time}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

// Walk messages oldest→newest; the first message in each 5-min window
// from its predecessor gets a groupLabel string. Generic over the
// message shape so BranchThreadView can reuse it on BranchMessage
// (which has the same `createdAt` + optional `groupLabel` contract).
export function assignGroupLabels<M extends { createdAt: Date; groupLabel?: string | null }>(
  msgs: M[],
): M[] {
  let prevTs: number | null = null;
  return msgs.map((m) => {
    const t = m.createdAt.getTime();
    if (prevTs === null || t - prevTs > GROUP_GAP_MS) {
      prevTs = t;
      return { ...m, groupLabel: formatMessageTime(m.createdAt) };
    }
    prevTs = t;
    return { ...m, groupLabel: null };
  });
}

// ── bubble ────────────────────────────────────────────────────────────
function Bubble({
  msg,
  prevSameAuthor,
  secure,
  onRetry,
}: {
  msg: ThreadMessage;
  prevSameAuthor: boolean;
  secure: boolean;
  onRetry: (id: string) => void;
}) {
  const mine = msg.mine;
  const tightTail = prevSameAuthor;
  // KAN-296 Task #21 — Replant Team attribution eyebrow.
  // Gated on: inbound (!mine) + secure Replant Team thread + non-empty
  // attribution_display_name. In a secure thread, every non-mine message
  // is authored by the Replant Team system user; the SYSTEM_USER_ID lives
  // in Vault and is intentionally never shipped to the client (SEC posture
  // — matches send-message index.ts comment 3c). The triple-gate is the
  // safe client-side proxy for "sender is the Replant Team system user".
  // Renders ONLY on the first bubble of a same-author cluster so a burst
  // of consecutive replies from the same admin doesn't repeat the eyebrow
  // on every row.
  const attribName =
    !mine && secure && !prevSameAuthor
      ? (msg.attributionDisplayName ?? '').trim()
      : '';
  const showAttribution = attribName.length > 0;
  // Bubble radius: all corners stay clearly rounded (14) regardless of
  // grouping so consecutive same-author bubbles still feel iMessage-tight
  // but never get a sharp inner corner.
  const radii = mine
    ? {
        borderTopLeftRadius: 16,
        borderTopRightRadius: tightTail ? 14 : 16,
        borderBottomRightRadius: 14,
        borderBottomLeftRadius: 16,
      }
    : {
        borderTopLeftRadius: tightTail ? 14 : 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 14,
      };

  return (
    <View style={{ marginTop: tightTail ? 2 : 10 }}>
      {showAttribution && (
        <Text style={styles.attributionEyebrow} numberOfLines={1}>
          {`${attribName} · REPLANT TEAM`}
        </Text>
      )}
      <View
        style={[
          styles.bubbleRow,
          mine ? styles.bubbleRowSent : styles.bubbleRowRecv,
        ]}
      >
        <View
          style={[
            styles.bubble,
            radii,
            mine ? styles.bubbleSent : styles.bubbleRecv,
            !mine && secure && styles.bubbleSecureRecv,
            msg.state === 'pending' && styles.bubblePending,
            msg.state === 'failed' && styles.bubbleFailed,
          ]}
        >
          <Text style={mine ? styles.bubbleTextSent : styles.bubbleText}>
            {msg.text}
          </Text>
        </View>
      </View>
      {msg.state === 'pending' && (
        <View style={[styles.statusRow, styles.statusRowSent]}>
          <ClockIcon />
          <Text style={styles.statusPending}>Sending</Text>
        </View>
      )}
      {msg.state === 'failed' && (
        <Pressable onPress={() => onRetry(msg.id)} hitSlop={6}>
          <View style={[styles.statusRow, styles.statusRowSent]}>
            <AlertIcon />
            <Text style={styles.statusFailed}>Not delivered · Tap to retry</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ── empty (lazy thread) ───────────────────────────────────────────────
// C1 (device pass): scripture-led opener replacing "A new, private
// letter." Matches the verse + citation pattern used by
// MinistriesEmpty (Cormorant Garamond italic for the verse, mono small
// caps for the citation). Sub-text retained.
function LazyEmpty() {
  return (
    <View style={styles.lazyEmpty}>
      <View style={styles.lazyGlyph}><LockIcon size={22} /></View>
      <Text style={styles.lazyLine}>
        "Where two or three are gathered in my name, there am I also."
      </Text>
      <Text style={styles.lazyRef}>MATTHEW 18:20 · KJV</Text>
      <Text style={styles.lazySub}>
        A letter to a fellow leader. Let your words be with grace.
      </Text>
    </View>
  );
}

// ── leader-initial header icon ────────────────────────────────────────
// Mirrors BranchThreadView's 28×28 branchHeadIcon — a small rounded glyph
// between the back arrow and the who-block. Renders the other party's
// first initial so the DM header has the same spatial rhythm as branches.
function LeaderInitialIcon({ initial }: { initial: string }) {
  return (
    <View style={styles.dmHeadIcon}>
      <Text style={styles.dmHeadInitial}>{initial}</Text>
    </View>
  );
}

function AnonHeadIcon() {
  return (
    <View style={styles.dmHeadIcon}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8.5} r={3.5} stroke={Colors.textMuted} strokeWidth={1.4} />
        <Path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke={Colors.textMuted} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ── main ──────────────────────────────────────────────────────────────
export default function DMThreadView({
  conversationId: initialConversationId,
  recipientUserId,
  initialProfile,
  callerUserId,
  covenantAcknowledged,
  onAcknowledgeCovenant,
  onBack,
  onSwipeBack,
  onConversationCreated,
  isConnectionRequest = false,
  requestId = null,
  requestMessage = null,
  requestSenderName,
}: Props) {
  const { session } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  // Seed `other` from the initial profile snapshot (Fix 1) so the
  // header renders cleanly on first frame. The header-only church
  // line shows just the church name per §6.3 (no role suffix —
  // that's a §6.1 row-only treatment).
  const [other, setOther] = useState<OtherParty | null>(() => {
    if (!initialProfile) return null;
    return {
      userId: initialConversationId ?? recipientUserId ?? '',
      displayName: initialProfile.isSecure
        ? 'Replant Team — Secure Message'
        : initialProfile.displayName,
      churchLabel: initialProfile.isSecure
        ? 'Replant · admin-monitored'
        : initialProfile.churchName,
      isSecure: initialProfile.isSecure,
    };
  });
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  // device-pass-fixes-1 Fix 4: gate Realtime subscribe on the initial
  // page load completing (success or error). Previously the two effects
  // fired concurrently — on first mount with a hydrating session the
  // initial load could lose its race against the subscribe, and the
  // Replant Team thread would render empty until the user navigated
  // away and back (forcing a remount). Sequencing matches LeadersList.
  const [initialFetchComplete, setInitialFetchComplete] = useState(false);
  // connect-polish-1 Fix E: refresh the Connect tab badge when this
  // thread unmounts (the leader navigates away after reading). The
  // `mark_conversation_read` RPC fires inside the initial-load
  // useEffect on a successful load; it writes conversations.last_read_at_x
  // which is NOT in the Realtime publication, so the badge would only
  // catch up on the next messages INSERT without this explicit refresh.
  //
  // Gating on initialFetchComplete is approximate: an errored initial
  // load (no mark_conversation_read fired) still triggers refresh on
  // unmount. Acceptable — that's one extra cheap RPC returning the
  // unchanged count; not a correctness issue.
  //
  // Cleanup fires on (a) deps change — e.g. conv switch within the
  // same mount — and (b) unmount. Both are useful refresh moments.
  const { refresh: refreshConnectBadge } = useConnectBadge();
  useEffect(() => {
    return () => {
      if (initialFetchComplete) {
        void refreshConnectBadge();
      }
    };
  }, [initialFetchComplete, refreshConnectBadge]);
  const [draft, setDraft] = useState('');
  // Fix 8 (KAN-68 §15.3): paperclip → anticipatory popover (NOT a
  // toast / alert). Visible flag is toggled by the paperclip tap;
  // backdrop tap closes; a non-empty draft also closes (the user is
  // typing, so the affordance is no longer the focus).
  const [attachPopoverVisible, setAttachPopoverVisible] = useState(false);
  const [showCovenant, setShowCovenant] = useState(false);
  const pendingTextRef = useRef<string>('');
  // Refs for messages + conversationId so the Realtime callback always
  // closes over the current value, not the value at subscribe time.
  const messagesRef = useRef<ThreadMessage[]>(messages);
  const conversationIdRef = useRef<string | null>(conversationId);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  const isSecure = other?.isSecure ?? false;

  // ── KAN-69 request-flow state ──────────────────────────────────────
  // isConnectionRequest=true → send path uses send_connection_request RPC.
  // requestId != null       → recipient view with accept/decline.

  // SentRequestModal shown after successful send_connection_request.
  const [sentRequestModalVisible, setSentRequestModalVisible] = useState(false);
  // DeclineRequestModal — shown before firing the decline RPC.
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  // recipientDisplayName for the modal copy. Derived from initialProfile.
  const requestRecipientName =
    initialProfile?.fullName ||
    initialProfile?.displayName ||
    'this leader';

  // busy state for accept/decline buttons.
  const [requestActionBusy, setRequestActionBusy] = useState(false);

  // Once accepted, the request_incoming thread transitions to a normal
  // conversation. acceptedSystemMsg shows the "[Name] accepted" notice.
  const [acceptedSystemMsg, setAcceptedSystemMsg] = useState<string | null>(null);

  // ── Swipe-left-to-go-back PanResponder ────────────────────────────
  // Only claims the gesture when the move is predominantly horizontal
  // (dx > 10pt, |dy| < 25pt) so it does NOT intercept vertical FlatList
  // scrolling. Fires onSwipeBack on release when total dx > 80pt.
  // The 80pt threshold is intentional — avoids accidental triggers while
  // the leader pans the message list slightly sideways.
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return dx > 10 && Math.abs(dy) < 25;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 80 && onSwipeBack) {
          onSwipeBack();
        }
      },
    }),
  ).current;

  // ── Resolve other party identity ───────────────────────────────────
  // Header rendering per §6.3: name (serif 18px) + church (mono 9.5px
  // upper) on SEPARATE lines. Name = full_name (or role label when
  // anonymous); never the combined "Name · Church" output of
  // getLeaderDisplayName. The combined helper is for surfaces that
  // stack name+church onto a single line (admin lists etc.).
  //
  // Initial render uses the caller-provided initialProfile snapshot
  // (Fix 1). The resolver below is a defense-in-depth refresh:
  //   - If a deep link landed here without an initialProfile (e.g.
  //     KAN-65 routing primitive to a secure thread), pull the row
  //     from get_leader_thread_list. RLS-safe because the RPC is
  //     SECURITY DEFINER and only returns the caller's own threads.
  //   - For a lazy-created thread (recipientUserId, no
  //     conversationId yet), the row hasn't been written so the
  //     RPC won't return anything until first-send completes; we
  //     accept the initialProfile (set on tap from LeaderSearch
  //     pick) or leave the header in its skeleton state.
  useEffect(() => {
    if (initialProfile) return;
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_leader_thread_list');
      if (cancelled || error || !Array.isArray(data)) return;
      const row = (data as any[]).find(
        (r) => r.conversation_id === conversationId,
      );
      if (!row) return;
      const isSec = !!row.is_secure_replant_thread;
      const anon = !!row.other_anonymous;
      // KAN-229: get_leader_thread_list now pre-resolves other_full_name
      // (honorific OR role prefix + given names per preference + family +
      // last_name_first). FE no longer re-derives.
      const fullName: string = row.other_full_name ?? '';
      const churchName: string = isSec
        ? 'Replant · admin-monitored'
        : (row.other_church_name ?? '');
      setOther({
        userId: row.other_user_id,
        displayName: isSec
          ? 'Replant Team — Secure Message'
          : (anon ? getRoleLabel(row.other_role) : fullName),
        churchLabel: churchName,
        isSecure: isSec,
      });
    })();
    return () => { cancelled = true; };
  }, [conversationId, initialProfile]);

  // ── Load initial page ──────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !callerUserId) {
      setLoading(false);
      setMessages([]);
      // No fetch to wait for in the lazy-create / unauth-skeleton case;
      // unblock the Realtime subscribe so it can wire up if/when the
      // ids arrive on a subsequent render.
      setInitialFetchComplete(true);
      return;
    }
    // Reset the gate when conversationId/callerUserId change — the new
    // conversation needs its own fresh initial load before its Realtime
    // subscribe can fire.
    setInitialFetchComplete(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at, attribution_display_name')
        .eq('conversation_id', conversationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (cancelled) return;
      if (error || !data) {
        setMessages([]);
        setLoading(false);
        setInitialFetchComplete(true);
        return;
      }
      // We hold messages oldest→newest for groupLabel walk; invert for display.
      const ordered: ThreadMessage[] = data
        .map((m: any) => ({
          id: m.id,
          mine: m.sender_id === callerUserId,
          text: m.content,
          createdAt: new Date(m.created_at),
          // KAN-296 Task #21 — nullable; NULL rows render as they do today.
          attributionDisplayName: m.attribution_display_name ?? null,
        }))
        .reverse();
      setMessages(assignGroupLabels(ordered));
      setExhausted(data.length < PAGE_SIZE);
      setLoading(false);
      setInitialFetchComplete(true);
      // Mark the thread read on initial open. Fire-and-forget — a
      // mark-read failure must NEVER block the thread render. The
      // caller may not yet be at-the-bottom of the inverted list, but
      // the open-the-thread intent is what last_read_at tracks.
      void supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
        .then(() => undefined, () => undefined);
    })();
    return () => { cancelled = true; };
  }, [conversationId, callerUserId]);

  // ── Realtime subscription on messages (conversation_id filter) ─────
  // device-pass-fixes-1 Fix 4: gated on initialFetchComplete so the
  // subscribe wires up AFTER the initial page load lands. Same canonical
  // pattern as LeadersList — Realtime supplements the initial data,
  // never replaces it.
  useEffect(() => {
    if (!conversationId || !callerUserId) return;
    if (!initialFetchComplete) return;
    const channel = supabase
      .channel(`dm-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          const incoming: ThreadMessage = {
            id: row.id,
            mine: row.sender_id === callerUserId,
            text: row.content,
            createdAt: new Date(row.created_at),
            // KAN-296 Task #21 — Realtime payload carries the full row shape.
            attributionDisplayName: row.attribution_display_name ?? null,
          };
          // Dedupe — if we already have this id (Realtime + send round-trip
          // race), skip. Optimistic 'pending' rows have local ids prefixed
          // with 'opt-' so they never collide with server uuids.
          const existing = messagesRef.current;
          if (existing.some((m) => m.id === incoming.id)) return;
          // Out-of-order safety: insert in sorted-by-time order.
          const next = [...existing, incoming].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
          setMessages(assignGroupLabels(next));
          // Caller is actively viewing this thread when an inbound
          // message lands — bump last_read_at_<x> so the badge clears
          // on the next get_*list snapshot. Skip on own-message echoes
          // (no read state change). Fire-and-forget.
          if (!incoming.mine) {
            void supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
              .then(() => undefined, () => undefined);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, callerUserId, initialFetchComplete]);

  // ── Load older (scroll-to-top in inverted list = onEndReached) ────
  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || exhausted) return;
    setLoadingOlder(true);
    try {
      // The oldest currently-loaded createdAt is the cursor.
      const cursor = messages[0]?.createdAt;
      if (!cursor) { setLoadingOlder(false); return; }
      const { data } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at, attribution_display_name')
        .eq('conversation_id', conversationId)
        .eq('is_active', true)
        .lt('created_at', cursor.toISOString())
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (!data || data.length === 0) {
        setExhausted(true);
        return;
      }
      const older: ThreadMessage[] = data.map((m: any) => ({
        id: m.id,
        mine: m.sender_id === callerUserId,
        text: m.content,
        createdAt: new Date(m.created_at),
        // KAN-296 Task #21 — nullable; NULL rows render as they do today.
        attributionDisplayName: m.attribution_display_name ?? null,
      })).reverse();
      const combined = [...older, ...messages];
      setMessages(assignGroupLabels(combined));
      if (data.length < PAGE_SIZE) setExhausted(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, callerUserId, messages, loadingOlder, exhausted]);

  // ── Send ───────────────────────────────────────────────────────────
  const sendNow = useCallback(async (text: string) => {
    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ThreadMessage = {
      id: optId,
      mine: true,
      text,
      createdAt: new Date(),
      state: 'pending',
    };
    setMessages((prev) => assignGroupLabels([...prev, optimistic]));

    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('no_session');
      const body: Record<string, unknown> = { content: text };
      if (conversationIdRef.current) {
        body.conversation_id = conversationIdRef.current;
      } else if (recipientUserId) {
        body.recipient_user_id = recipientUserId;
      } else {
        throw new Error('no_target');
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`send_failed_${res.status}`);
      const result = await res.json() as {
        id: string;
        conversation_id: string;
        created_at: string;
      };
      // Lazy thread creation: server-provided conversation_id replaces null.
      if (!conversationIdRef.current && result.conversation_id) {
        conversationIdRef.current = result.conversation_id;
        setConversationId(result.conversation_id);
        onConversationCreated?.(result.conversation_id);
      }
      // Reconcile the optimistic row with the server's row id + ts.
      // DELIVER-ALWAYS contract: we DO NOT read `flagged` from the
      // response. The send-message edge function returns the field but
      // the leader's UI is identical regardless of its value — per
      // KAN-70 leader-opacity.
      //
      // Sync messagesRef INSIDE the updater so the Realtime INSERT
      // handler (which reads messagesRef for dedup) sees the real UUID
      // immediately — before the async useEffect that normally syncs
      // the ref can run. Without this, the handler checks the stale
      // ref (still holding the opt- ID), misses the dedup, and inserts
      // a second row with the same real UUID → duplicate key error.
      setMessages((prev) => {
        const next = assignGroupLabels(prev.map((m) =>
          m.id === optId
            ? {
              ...m,
              id: result.id,
              state: 'sent' as const,
              createdAt: new Date(result.created_at),
            }
            : m,
        ));
        messagesRef.current = next;
        return next;
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...m, state: 'failed' } : m),
      );
    }
  }, [session?.access_token, recipientUserId, onConversationCreated]);

  // ── Send connection request (KAN-69) ─────────────────────────────
  // Called instead of sendNow when isConnectionRequest=true.
  // Covenant notice fires first (same gate as regular sends) — the
  // acceptCovenant callback routes here via pendingRequestTextRef.
  const pendingRequestTextRef = useRef<string>('');

  const sendRequest = useCallback(async (text: string) => {
    if (!recipientUserId) return;
    try {
      await sendConnectionRequest(recipientUserId, text);
      setSentRequestModalVisible(true);
    } catch (err) {
      // Surface the user-friendly message via the failed-send UI.
      // For requests we don't have an optimistic bubble to mark failed,
      // so we re-add the draft text and let the leader retry.
      const msg = err instanceof ConnectionRequestError
        ? err.message
        : 'Your request could not be sent. Please try again.';
      setDraft(text);
      // Minimal error feedback — a future pass can wire this to the
      // same toast used by BranchCreate.
      // eslint-disable-next-line no-console
      void msg; // suppress unused warning; message is in the Error
    }
  }, [recipientUserId]);

  const attemptSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (!covenantAcknowledged) {
      pendingTextRef.current = text;
      // For connection requests, also store in the request-specific ref
      // so acceptCovenant can route correctly.
      if (isConnectionRequest) {
        pendingRequestTextRef.current = text;
      }
      setShowCovenant(true);
      return;
    }
    setDraft('');
    // B3 (device pass): dismiss the keyboard the moment the message
    // leaves the composer. The optimistic bubble takes over the
    // visual feedback; staying keyboard-up makes the leader feel like
    // the send didn't land. NOT done on the retry path (failed-send
    // bubbles stay tappable while the keyboard remains visible).
    Keyboard.dismiss();
    if (isConnectionRequest) {
      void sendRequest(text);
    } else {
      void sendNow(text);
    }
  }, [draft, covenantAcknowledged, sendNow, isConnectionRequest, sendRequest]);

  const acceptCovenant = useCallback(async () => {
    await onAcknowledgeCovenant();
    setShowCovenant(false);
    const text = pendingTextRef.current;
    pendingTextRef.current = '';
    if (text) {
      setDraft('');
      // Same B3 dismiss on the covenant-gated first-send path.
      Keyboard.dismiss();
      // KAN-69: route to request send if this is a connection request.
      if (isConnectionRequest) {
        pendingRequestTextRef.current = '';
        void sendRequest(text);
      } else {
        void sendNow(text);
      }
    }
  }, [onAcknowledgeCovenant, sendNow, isConnectionRequest, sendRequest]);

  const retry = useCallback((optId: string) => {
    // Find the failed row, mark pending, and re-fire send.
    const failed = messagesRef.current.find((m) => m.id === optId);
    if (!failed) return;
    setMessages((prev) =>
      prev.map((m) => m.id === optId ? { ...m, state: 'pending' } : m),
    );
    // Re-fire — note that on success this creates a NEW server row id; we
    // accept the duplication risk here because the user explicitly
    // pressed retry, and the old failed-row id is local-only.
    void (async () => {
      try {
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error('no_session');
        const body: Record<string, unknown> = { content: failed.text };
        if (conversationIdRef.current) body.conversation_id = conversationIdRef.current;
        else if (recipientUserId) body.recipient_user_id = recipientUserId;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('retry_failed');
        const result = await res.json() as { id: string; conversation_id: string; created_at: string };
        if (!conversationIdRef.current && result.conversation_id) {
          conversationIdRef.current = result.conversation_id;
          setConversationId(result.conversation_id);
          onConversationCreated?.(result.conversation_id);
        }
        setMessages((prev) =>
          assignGroupLabels(prev.map((m) =>
            m.id === optId
              ? { ...m, id: result.id, state: 'sent' as const, createdAt: new Date(result.created_at) }
              : m,
          )),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => m.id === optId ? { ...m, state: 'failed' } : m),
        );
      }
    })();
  }, [session?.access_token, recipientUserId, onConversationCreated]);

  // ── Accept / Decline (KAN-69 recipient view) ──────────────────────
  const handleAccept = useCallback(async () => {
    if (!requestId || requestActionBusy) return;
    setRequestActionBusy(true);
    try {
      // KAN-69 consent-layer accept path. The accept-connection-request
      // edge fn owns the whole flow server-side: it FLAG_TAXONOMY-scans the
      // request message, flips the request to 'accepted', then seeds the
      // already-scanned message ATTRIBUTED TO THE ORIGINAL REQUESTER (not
      // to us, the accepter — the prior send-message call mis-attributed
      // it). We never call respondToRequest or send-message directly here.
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/accept-connection-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ request_id: requestId }),
        },
      );
      const { conversation_id: convId } = await res.json() as {
        conversation_id?: string;
      };
      if (res.ok && convId) {
        // Transition from request thread to normal conversation.
        conversationIdRef.current = convId;
        setConversationId(convId);
        onConversationCreated?.(convId);
      }
      // Acceptance system message — RECIPIENT perspective (we accepted).
      const senderLabel = requestSenderName ?? other?.displayName ?? 'They';
      setAcceptedSystemMsg(`You accepted ${senderLabel}'s request to connect`);
    } catch {
      // Silent — let the user retry.
    } finally {
      setRequestActionBusy(false);
    }
  }, [requestId, requestActionBusy, session?.access_token, onConversationCreated, requestSenderName, other?.displayName]);

  const handleDecline = useCallback(async () => {
    if (!requestId || requestActionBusy) return;
    setRequestActionBusy(true);
    try {
      await respondToRequest(requestId, 'decline');
      // Navigate back to the Leaders list — no thread is created.
      onBack();
    } catch {
      // Silent — let the user retry.
    } finally {
      setRequestActionBusy(false);
    }
  }, [requestId, requestActionBusy, onBack]);

  const handleAttach = () => {
    setAttachPopoverVisible((v) => !v);
  };

  // Auto-dismiss the popover the moment the leader starts typing.
  useEffect(() => {
    if (attachPopoverVisible && draft.length > 0) {
      setAttachPopoverVisible(false);
    }
  }, [draft, attachPopoverVisible]);

  // ── Render (inverted FlatList: newest at bottom) ──────────────────
  // Each frame on the inverted list takes [newest...oldest]; we keep
  // `messages` oldest→newest for groupLabel correctness, then reverse
  // here for the data prop.
  const displayData = useMemo(() => [...messages].reverse(), [messages]);
  // KAN-69: recipient of a pending request cannot send until accepted.
  // The composer is locked; requestId != null and no conversationId yet
  // (the conversation is only created on accept).
  const isIncomingRequest = !!requestId && !conversationId;
  const canSend = !isIncomingRequest && draft.trim().length > 0;

  return (
    <View style={styles.root} {...swipePanResponder.panHandlers}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        {initialProfile?.isAnon
          ? <AnonHeadIcon />
          : <LeaderInitialIcon initial={(initialProfile?.fullName?.charAt(0) ?? initialProfile?.displayName?.charAt(0) ?? '?').toUpperCase()} />}
        <View style={styles.who}>
          {/* B2 (device pass): never render a partial header. While the
              other party's profile is still resolving (lazy thread, race
              between mount and the users+churches join), render a
              skeleton instead of placeholder text or an empty string. */}
          {other ? (
            <>
              <View style={styles.whoNameRow}>
                {isSecure && <LockIcon color={Colors.accent} size={12} />}
                <Text
                  style={[styles.whoName, isSecure && styles.whoNameSecure]}
                  numberOfLines={1}
                >
                  {other.displayName}
                </Text>
              </View>
              {other.churchLabel ? (
                <Text style={styles.whoChurch} numberOfLines={1}>
                  {other.churchLabel.toUpperCase()}
                </Text>
              ) : null}
            </>
          ) : (
            <View accessibilityLabel="Loading conversation">
              <View style={styles.whoNameSkel} />
              <View style={styles.whoChurchSkel} />
            </View>
          )}
        </View>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* KAN-69: incoming request view — show system label + request message
            bubble + accept/decline bar. The conversation hasn't been created
            yet (isIncomingRequest = true); the normal messages list is empty. */}
        {isIncomingRequest ? (
          <View style={styles.requestThreadBody}>
            {/* System label: "CONNECTION REQUEST · {time}" */}
            <Text style={styles.requestSystemLabel}>
              {`CONNECTION REQUEST`}
            </Text>
            {/* Request message as a received bubble */}
            {requestMessage ? (
              <View style={styles.requestBubbleWrap}>
                <View style={[styles.bubble, styles.bubbleRecv, { borderRadius: 16, maxWidth: '80%' }]}>
                  <Text style={styles.bubbleText}>{requestMessage}</Text>
                </View>
              </View>
            ) : null}
            {/* Post-accept system message */}
            {acceptedSystemMsg ? (
              <Text style={styles.acceptSystemMsg}>{acceptedSystemMsg.toUpperCase()}</Text>
            ) : null}
          </View>
        ) : !conversationId && !loading && messages.length === 0 ? (
          <LazyEmpty />
        ) : (
          <FlatList
            inverted
            data={displayData}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.6}
            renderItem={({ item, index }) => {
              // displayData is reversed (newest first); to read
              // "prevSameAuthor" we look at the NEXT entry in
              // displayData (= older message in time).
              const nextOlder = displayData[index + 1];
              const prevSameAuthor =
                !!nextOlder && nextOlder.mine === item.mine && !item.groupLabel;
              return (
                <View>
                  {/* KAN-69: acceptance system message above the first row */}
                  {index === displayData.length - 1 && acceptedSystemMsg ? (
                    <Text style={styles.acceptSystemMsg}>
                      {acceptedSystemMsg.toUpperCase()}
                    </Text>
                  ) : null}
                  {item.groupLabel && (
                    <Text style={styles.tsDivider}>{item.groupLabel.toUpperCase()}</Text>
                  )}
                  <Bubble
                    msg={item}
                    prevSameAuthor={prevSameAuthor}
                    secure={isSecure}
                    onRetry={retry}
                  />
                </View>
              );
            }}
            ListFooterComponent={
              loadingOlder
                ? <View style={styles.loadingOlder}>
                    <ActivityIndicator color={Colors.textSubtle} />
                    <Text style={styles.loadingOlderText}>Loading earlier</Text>
                  </View>
                : exhausted
                  ? <Text style={styles.historyTop}>Beginning of conversation</Text>
                  : null
            }
          />
        )}

        {/* KAN-69: request actions bar for incoming requests */}
        {isIncomingRequest && !acceptedSystemMsg && (
          <RequestActionsBar
            onAccept={handleAccept}
            onDecline={() => { setDeclineModalVisible(true); return Promise.resolve(); }}
            busy={requestActionBusy}
          />
        )}

        <CovenantStrip />

        {/* KAN-69: RequestNote above composer for outgoing requests */}
        <RequestNote visible={isConnectionRequest && !conversationId} />

        <View style={[styles.composer, { paddingBottom: 8 }]}>
          <View style={styles.attachWrap}>
            <AttachmentPopover
              visible={attachPopoverVisible}
              onRequestClose={() => setAttachPopoverVisible(false)}
            />
            <Pressable
              onPress={handleAttach}
              hitSlop={6}
              style={styles.attach}
              accessibilityRole="button"
              accessibilityLabel="Attachments — coming soon"
              accessibilityState={{ expanded: attachPopoverVisible }}
            >
              <ClipIcon />
            </Pressable>
          </View>
          <TextInput
            style={styles.field}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              isIncomingRequest && !acceptedSystemMsg
                ? 'Reply opens when you accept'
                : isSecure
                  ? 'Reply to the Replant Team'
                  : 'Write a message'
            }
            placeholderTextColor={Colors.textSubtle}
            multiline
            editable={!isIncomingRequest || !!acceptedSystemMsg}
          />
          <Pressable
            onPress={attemptSend}
            disabled={!canSend}
            style={[
              styles.send,
              canSend ? styles.sendActive : styles.sendDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <SendIcon color={canSend ? '#07232f' : Colors.textSubtle} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <CovenantNotice visible={showCovenant} onAccept={acceptCovenant} />

      {/* KAN-69: SentRequestModal — shown after successful request send */}
      <SentRequestModal
        visible={sentRequestModalVisible}
        recipientName={requestRecipientName}
        onBack={() => {
          setSentRequestModalVisible(false);
          onBack();
        }}
      />

      {/* KAN-69: DeclineRequestModal — confirmation before firing decline RPC */}
      <DeclineRequestModal
        visible={declineModalVisible}
        senderName={requestSenderName ?? other?.displayName ?? 'this leader'}
        onKeep={() => setDeclineModalVisible(false)}
        onConfirmDecline={() => {
          setDeclineModalVisible(false);
          void handleDecline();
        }}
        declining={requestActionBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  // ── head ──
  head: {
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: 'rgba(8,8,8,0.92)',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dmHeadIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(240,237,230,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmHeadInitial: {
    fontFamily: Typography.displayMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  who: { flex: 1, minWidth: 0 },
  whoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whoName: {
    flexShrink: 1,
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    color: Colors.text,
  },
  whoNameSecure: { color: Colors.accent },
  whoChurch: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.14, // 0.12em × 9.5
    color: Colors.textMuted,
    marginTop: 2,
  },
  // B2 skeletons — same approximate dimensions as the real name + church
  // lines so the header doesn't reflow when the profile resolves.
  whoNameSkel: {
    width: 140,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.surface,
  },
  whoChurchSkel: {
    width: 90,
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    marginTop: 6,
  },
  body: { flex: 1 },
  // ── list ──
  listContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  tsDivider: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26, // 0.14em × 9
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  // KAN-296 Task #21 — Replant Team attribution eyebrow above the bubble.
  // Utility register (mono, small caps by upper-casing at the source, muted
  // color, tight letter-spacing) — never italicized per [[typography-ruling]]
  // (attribution is utility text, not scripture / editorial / witness).
  // Left-aligned to hug the received-bubble alignment. 4pt gap above the
  // bubble comes from marginBottom below; the outer wrapper's marginTop
  // (10pt for a new-author group, 2pt for a same-author tail) handles the
  // top gap. `showAttribution` in Bubble() only fires when !prevSameAuthor,
  // so the 10pt spacing always applies here.
  attributionEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.9, // 0.10em × 9pt — matches requestSystemLabel register
    color: Colors.textMuted,
    marginBottom: 4,
    marginLeft: 2,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowRecv: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 11,
    paddingHorizontal: 15,
  },
  bubbleSent: { backgroundColor: Colors.accent },
  bubbleRecv: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  bubbleSecureRecv: {
    borderColor: 'rgba(107,181,232,0.35)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
  },
  bubblePending: { opacity: 0.55 },
  bubbleFailed: {
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
  },
  bubbleText: {
    fontFamily: Typography.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.text,
  },
  bubbleTextSent: {
    fontFamily: Typography.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: '#07232f',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  statusRowSent: { justifyContent: 'flex-end' },
  statusPending: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    color: Colors.textSubtle,
  },
  statusFailed: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    color: Colors.red,
  },
  loadingOlder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loadingOlderText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textSubtle,
    letterSpacing: 0.18,
  },
  historyTop: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textSubtle,
    letterSpacing: 0.18,
    textAlign: 'center',
    paddingVertical: 18,
  },
  // ── composer ── (Fix 4: restored to HANDOFF §6.3 spec)
  // paddingBottom applied inline as a flat 8pt — the Connect tab bar below
  // already accounts for the bottom safe area, so reserving insets.bottom
  // here created a large dead gap under the composer.
  composer: {
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  attach: {
    // connect-polish-1 Fix B: hit target stays at 42pt while field
    // shrinks to 36pt — buttons use COMPOSER_BUTTON_SIZE.
    width: COMPOSER_BUTTON_SIZE, height: COMPOSER_BUTTON_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  // Fix 8: the attach Pressable's parent. Position-relative anchor
  // for the AttachmentPopover's absolute positioning. We don't size
  // it explicitly — it adopts the Pressable's intrinsic size. The
  // popover renders at bottom:50 left:-8 relative to this wrap.
  attachWrap: {
    position: 'relative',
  },
  field: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    // connect-polish-1 Fix B: pill radius = MIN_COMPOSER_HEIGHT / 2 so
    // it stays pill-shaped at the new 36pt collapsed height.
    borderRadius: MIN_COMPOSER_HEIGHT / 2,
    paddingHorizontal: 16,
    // connect-polish-1 Fix B: padding 11→8 each direction; field
    // collapsed height = 36, leaves 20pt for the 14.5pt text which
    // centres cleanly.
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: Colors.text,
  },
  send: {
    // connect-polish-1 Fix B: button stays at 42pt for hit-target
    // generosity (was MIN_COMPOSER_HEIGHT, which shrank to 36); pill
    // radius matches.
    width: COMPOSER_BUTTON_SIZE, height: COMPOSER_BUTTON_SIZE,
    borderRadius: COMPOSER_BUTTON_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  sendActive: { backgroundColor: Colors.accent },
  sendDisabled: { backgroundColor: Colors.surfaceElevated },
  // ── KAN-69 request thread styles ──
  // Incoming request view — flex column showing the system label +
  // request message bubble, centred in the available space.
  requestThreadBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 18,
  },
  requestSystemLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.25)',
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  requestBubbleWrap: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  // System message at top of accepted thread — reuses the branch-event style.
  acceptSystemMsg: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.25)',
    alignSelf: 'center',
    textAlign: 'center',
    maxWidth: '84%',
    marginVertical: 8,
    lineHeight: 14,
  },
  // ── lazy empty ──
  lazyEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 10,
  },
  lazyGlyph: { marginBottom: 6 },
  lazyLine: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  lazyRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8, // 0.2em × 9pt — matches MinistriesEmpty.verseRef
    color: Colors.textSubtle,
    marginTop: 10,
  },
  lazySub: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
