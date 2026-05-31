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
  };
  callerUserId: string | null;
  covenantAcknowledged: boolean;
  onAcknowledgeCovenant: () => Promise<void>;
  onBack: () => void;
  onConversationCreated?: (conversationId: string) => void;
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
}

interface OtherParty {
  userId: string;
  displayName: string;
  churchLabel: string;
  isSecure: boolean;
}

const PAGE_SIZE = 30;
const FIVE_MIN_MS = 5 * 60 * 1000;
const MAX_COMPOSER_HEIGHT = 124;
// connect-polish-1 Fix B: device pass reported the composer feels too
// tall on a single line. Founder ruling overrides the prior HANDOFF
// §6.3 42pt minimum for the FIELD; the attach + send button hit
// targets stay at 42pt (COMPOSER_BUTTON_SIZE) for tap-area generosity.
// Field collapses to 36pt min with reduced vertical padding so the
// placeholder centres in a compact pill, not a tall textarea. Grow-
// on-input behaviour and textAlignVertical are untouched.
const MIN_COMPOSER_HEIGHT = 36;
const COMPOSER_BUTTON_SIZE = 42;

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
  if (sameDay) return time;
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
    if (prevTs === null || t - prevTs > FIVE_MIN_MS) {
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
  // Bubble radius per HANDOFF §6.3: sent 16/16/5/16, recv 16/16/16/5.
  // Tail tightens the inner corner radius on consecutive same-author rows.
  const radii = mine
    ? {
        borderTopLeftRadius: 16,
        borderTopRightRadius: tightTail ? 5 : 16,
        borderBottomRightRadius: 5,
        borderBottomLeftRadius: 16,
      }
    : {
        borderTopLeftRadius: tightTail ? 5 : 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 5,
      };

  return (
    <View style={{ marginTop: tightTail ? 2 : 6 }}>
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
        Say what is on your heart to begin. Only the two of you will read it.
      </Text>
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
  onConversationCreated,
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
  const [composerHeight, setComposerHeight] = useState(MIN_COMPOSER_HEIGHT);
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
        .select('id, content, sender_id, created_at')
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
        .select('id, content, sender_id, created_at')
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
      setMessages((prev) =>
        assignGroupLabels(prev.map((m) =>
          m.id === optId
            ? {
              ...m,
              id: result.id,
              state: 'sent',
              createdAt: new Date(result.created_at),
            }
            : m,
        )),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...m, state: 'failed' } : m),
      );
    }
  }, [session?.access_token, recipientUserId, onConversationCreated]);

  const attemptSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    if (!covenantAcknowledged) {
      pendingTextRef.current = text;
      setShowCovenant(true);
      return;
    }
    setDraft('');
    setComposerHeight(MIN_COMPOSER_HEIGHT);
    // B3 (device pass): dismiss the keyboard the moment the message
    // leaves the composer. The optimistic bubble takes over the
    // visual feedback; staying keyboard-up makes the leader feel like
    // the send didn't land. NOT done on the retry path (failed-send
    // bubbles stay tappable while the keyboard remains visible).
    Keyboard.dismiss();
    void sendNow(text);
  }, [draft, covenantAcknowledged, sendNow]);

  const acceptCovenant = useCallback(async () => {
    await onAcknowledgeCovenant();
    setShowCovenant(false);
    const text = pendingTextRef.current;
    pendingTextRef.current = '';
    if (text) {
      setDraft('');
      setComposerHeight(MIN_COMPOSER_HEIGHT);
      // Same B3 dismiss on the covenant-gated first-send path.
      Keyboard.dismiss();
      void sendNow(text);
    }
  }, [onAcknowledgeCovenant, sendNow]);

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
              ? { ...m, id: result.id, state: 'sent', createdAt: new Date(result.created_at) }
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
  const canSend = draft.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
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
        {!conversationId && !loading && messages.length === 0 ? (
          <LazyEmpty />
        ) : loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={Colors.textSubtle} />
          </View>
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
                  <Bubble
                    msg={item}
                    prevSameAuthor={prevSameAuthor}
                    secure={isSecure}
                    onRetry={retry}
                  />
                  {item.groupLabel && (
                    <Text style={styles.tsDivider}>{item.groupLabel.toUpperCase()}</Text>
                  )}
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

        <CovenantStrip />

        <View style={styles.composer}>
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
            style={[styles.field, { height: composerHeight }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={isSecure ? 'Reply to the Replant Team' : 'Write a message'}
            placeholderTextColor={Colors.textSubtle}
            multiline
            scrollEnabled
            onContentSizeChange={(e) => {
              const h = Math.min(
                MAX_COMPOSER_HEIGHT,
                Math.max(MIN_COMPOSER_HEIGHT, e.nativeEvent.contentSize.height + 12),
              );
              setComposerHeight(h);
            }}
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
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── composer ── (Fix 4: restored to HANDOFF §6.3 spec)
  composer: {
    paddingTop: 10,
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
