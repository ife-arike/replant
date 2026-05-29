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
  Alert,
  FlatList,
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
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { getLeaderDisplayName } from '../../utils/getLeaderDisplayName';
import { getRoleLabel } from '../../utils/displayHelpers';
import CovenantStrip from './CovenantStrip';
import CovenantNotice from './CovenantNotice';

interface Props {
  // Either threadId (existing conversation) or recipientUserId (lazy thread).
  conversationId: string | null;
  recipientUserId: string | null;
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
function LazyEmpty() {
  return (
    <View style={styles.lazyEmpty}>
      <View style={styles.lazyGlyph}><LockIcon size={22} /></View>
      <Text style={styles.lazyLine}>A new, private letter.</Text>
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
  callerUserId,
  covenantAcknowledged,
  onAcknowledgeCovenant,
  onBack,
  onConversationCreated,
}: Props) {
  const { session } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [other, setOther] = useState<OtherParty | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [draft, setDraft] = useState('');
  const [composerHeight, setComposerHeight] = useState(42);
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
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Path A: existing conversation — fetch the other user from the row.
      if (conversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('participant_a, participant_b, is_secure_replant_thread')
          .eq('id', conversationId).maybeSingle();
        if (!conv || cancelled) return;
        const otherId = conv.participant_a === callerUserId ? conv.participant_b : conv.participant_a;
        const { data: u } = await supabase
          .from('users')
          .select('id, full_name, role, anonymous, churches:church_id(name, type)')
          .eq('id', otherId).maybeSingle() as any;
        if (cancelled) return;
        const ch = u?.churches;
        const underground = ch?.type === 'underground';
        const churchName = underground ? 'Underground Church' : (ch?.name ?? '');
        const [first = '', ...rest] = (u?.full_name ?? '').split(' ');
        setOther({
          userId: otherId,
          displayName: conv.is_secure_replant_thread
            ? 'Replant Team — Secure Message'
            : getLeaderDisplayName({
              firstName: first,
              lastName: rest.join(' '),
              roleLabel: getRoleLabel(u?.role),
              churchName,
              anonymous: !!u?.anonymous,
            }),
          churchLabel: conv.is_secure_replant_thread ? 'Replant · system-managed' : churchName,
          isSecure: !!conv.is_secure_replant_thread,
        });
        return;
      }
      // Path B: lazy thread — fetch the recipient only; no conversation row yet.
      if (recipientUserId) {
        const { data: u } = await supabase
          .from('users')
          .select('id, full_name, role, anonymous, churches:church_id(name, type)')
          .eq('id', recipientUserId).maybeSingle() as any;
        if (cancelled) return;
        const ch = u?.churches;
        const underground = ch?.type === 'underground';
        const churchName = underground ? 'Underground Church' : (ch?.name ?? '');
        const [first = '', ...rest] = (u?.full_name ?? '').split(' ');
        setOther({
          userId: recipientUserId,
          displayName: getLeaderDisplayName({
            firstName: first,
            lastName: rest.join(' '),
            roleLabel: getRoleLabel(u?.role),
            churchName,
            anonymous: !!u?.anonymous,
          }),
          churchLabel: churchName,
          isSecure: false,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, recipientUserId, callerUserId]);

  // ── Load initial page ──────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !callerUserId) {
      setLoading(false);
      setMessages([]);
      return;
    }
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
    })();
    return () => { cancelled = true; };
  }, [conversationId, callerUserId]);

  // ── Realtime subscription on messages (conversation_id filter) ─────
  useEffect(() => {
    if (!conversationId || !callerUserId) return;
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
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, callerUserId]);

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
    setComposerHeight(42);
    void sendNow(text);
  }, [draft, covenantAcknowledged, sendNow]);

  const acceptCovenant = useCallback(async () => {
    await onAcknowledgeCovenant();
    setShowCovenant(false);
    const text = pendingTextRef.current;
    pendingTextRef.current = '';
    if (text) {
      setDraft('');
      setComposerHeight(42);
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
    Alert.alert(
      '',
      'Attachments are coming soon. Sharing files will require consent and must follow the Replant community standard.',
    );
  };

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
          <View style={styles.whoNameRow}>
            {isSecure && <LockIcon color={Colors.accent} size={12} />}
            <Text
              style={[styles.whoName, isSecure && styles.whoNameSecure]}
              numberOfLines={1}
            >
              {other?.displayName ?? '…'}
            </Text>
          </View>
          {other?.churchLabel ? (
            <Text style={styles.whoChurch} numberOfLines={1}>
              {other.churchLabel.toUpperCase()}
            </Text>
          ) : null}
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
          <Pressable
            onPress={handleAttach}
            hitSlop={6}
            style={styles.attach}
            accessibilityRole="button"
            accessibilityLabel="Attachment (coming soon)"
          >
            <ClipIcon />
          </Pressable>
          <TextInput
            style={[styles.field, { height: composerHeight }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={isSecure ? 'Reply to the Replant Team' : 'Write a message'}
            placeholderTextColor={Colors.textSubtle}
            multiline
            scrollEnabled
            onContentSizeChange={(e) => {
              const h = Math.min(MAX_COMPOSER_HEIGHT, Math.max(42, e.nativeEvent.contentSize.height + 12));
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
  // ── composer ──
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
    width: 42, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  field: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: Colors.text,
  },
  send: {
    width: 42, height: 42, borderRadius: 21,
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
    fontSize: 19,
    color: Colors.text,
    textAlign: 'center',
  },
  lazySub: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
