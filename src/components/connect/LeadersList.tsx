// LeadersList — KAN-68 §6.1 / HANDOFF §6.1.
//
// The Leaders sub-tab thread list. The Replant Team secure thread (system-
// managed, conversations.is_secure_replant_thread = true) is pinned at
// the top above the recency-sorted peer DMs.
//
// Data model:
//   public.conversations  — participant_a, participant_b (sorted),
//                           is_secure_replant_thread, last_message_at,
//                           last_read_at_a / last_read_at_b (KAN-214
//                           follow-up migration 20260529000003).
//   public.messages       — for the last-message preview + timestamp.
//   public.users          — the OTHER participant's identity.
//   public.churches       — the OTHER participant's church name + type
//                           (underground → label "Underground Church").
//
// Unread tracking (KAN-214 follow-up): the badge is present iff
// last_message_at > caller's last_read_at_<x>. This is the MVP shape
// — a present/absent badge, not a precise count. A precise count
// would require a per-conversation messages count subquery, which is
// the right shape for a future get_leader_thread_list RPC.
//
// No dedicated RPC exists for this list yet. The query joins via PostgREST
// embeds + parallel last-message fetches. BA follow-up: a SECURITY
// DEFINER get_leader_thread_list RPC would collapse the round-trips
// and let the BE own the underground-name-elision invariant rather
// than the FE — file in a future ticket.
//
// Search: activates at 2+ chars; matches display name + church only,
// NEVER message content (HANDOFF §6.1 + §10).
//
// Pagination: 25 threads on mount, scroll-to-end loads next 25.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getLeaderDisplayName } from '../../utils/getLeaderDisplayName';
import { getRoleLabel } from '../../utils/displayHelpers';
import CovenantFooter from './CovenantFooter';

export interface LeaderThread {
  conversationId: string;
  otherUserId: string;
  isSecure: boolean;
  // Pre-composed identity strings — what actually renders on the row.
  displayName: string;
  monogramInitial: string;
  churchLabel: string;
  anonymous: boolean;
  underground: boolean;
  preview: string;
  lastAt: Date | null;
  // Per-caller unread badge. MVP semantic: 0 = nothing newer than the
  // caller's last_read_at_<x>; 1 = at least one newer message. A
  // precise count would require a messages-count subquery — deferred
  // to a future get_leader_thread_list RPC (BA follow-up).
  unread: number;
}

interface Props {
  onOpenThread: (conversationId: string, otherUserId: string) => void;
  onFindLeader: () => void;
}

const PAGE_SIZE = 25;
const PREVIEW_MAX = 60;

// ── inline icons ──────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={Colors.textSubtle} strokeWidth={1.6} />
      <Path d="M21 21l-4.3-4.3" stroke={Colors.textSubtle} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function LockIcon({ color = Colors.accent }: { color?: string }) {
  return (
    <Svg width={11} height={12} viewBox="0 0 14 16" fill="none">
      <Rect x={2.5} y={6.5} width={9} height={7.5} rx={1.4} stroke={color} strokeWidth={1.3} />
      <Path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}
function AnonGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={3.5} stroke={Colors.textMuted} strokeWidth={1.4} />
      <Path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke={Colors.textMuted} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function RpMark({ color }: { color: string }) {
  // Minimal stylized R mark — production swap to the rp-mark.svg asset
  // is a Founder copy-lock issue; this placeholder keeps shape parity.
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
      <Path d="M9 7.5h4.5a3 3 0 0 1 0 6H9zm0 6l5 5"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── time formatting ───────────────────────────────────────────────────
// HANDOFF §6.1: "2m ago · 3h ago · Yesterday · 3d ago"
export function formatThreadTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  // Compare calendar days for "Yesterday".
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startToday.getTime() - startThen.getTime()) / 86_400_000);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

// ── thread row ────────────────────────────────────────────────────────
function ThreadRow({
  thread,
  onPress,
}: {
  thread: LeaderThread;
  onPress: () => void;
}) {
  const unread = thread.unread > 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      thread.isSecure && styles.rowSecure,
      pressed && styles.rowPressed,
    ]}>
      {thread.isSecure && <View style={styles.secureRail} />}
      <View style={[
        styles.monogram,
        thread.isSecure && styles.monogramSecure,
        (thread.anonymous || thread.underground) && styles.monogramAnon,
      ]}>
        {thread.isSecure
          ? <RpMark color={Colors.accent} />
          : (thread.anonymous || thread.underground)
            ? <AnonGlyph />
            : <Text style={styles.monogramInitial}>{thread.monogramInitial}</Text>}
      </View>
      <View style={styles.center}>
        <View style={styles.nameLine}>
          {thread.isSecure && <LockIcon color={Colors.accent} />}
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              unread && styles.nameUnread,
              thread.isSecure && styles.nameSecure,
            ]}
          >
            {thread.displayName}
          </Text>
          {thread.isSecure && (
            <View style={styles.secureTag}>
              <Text style={styles.secureTagText}>SECURE</Text>
            </View>
          )}
        </View>
        <Text style={styles.church} numberOfLines={1}>{thread.churchLabel}</Text>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
          {thread.preview || ' '}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.time}>{formatThreadTime(thread.lastAt)}</Text>
        {unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{thread.unread}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── data loader (inline; extract to a hook in a follow-up) ────────────
async function fetchThreadPage(callerUserId: string, offset: number, limit: number): Promise<LeaderThread[]> {
  // 1. Conversations — RLS scopes to caller's threads (participant_a/_b
  //    SELECT policies on public.conversations). Pull both last_read_at
  //    columns; we'll pick whichever matches the caller's participant
  //    slot when computing the per-conversation unread badge.
  const { data: convs, error: convErr } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, is_secure_replant_thread, last_message_at, last_read_at_a, last_read_at_b, created_at')
    .order('is_secure_replant_thread', { ascending: false }) // secure pinned
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (convErr || !convs || convs.length === 0) return [];

  // Other-participant + last-message resolution happens in parallel.
  const otherIds = convs.map((c) =>
    c.participant_a === callerUserId ? c.participant_b : c.participant_a,
  );

  const [usersRes, msgsRes] = await Promise.all([
    // Load each "other" user's identity + church name + church type.
    // RLS on users + churches gates this — anything not viewable
    // returns an empty embed.
    supabase
      .from('users')
      .select('id, full_name, role, anonymous, churches:church_id(id, name, type)')
      .in('id', otherIds),
    // Last-message preview + timestamp per conversation. ORDER + LIMIT
    // would require one query per conversation; instead grab the
    // latest 50 across all conversations and pick the head per id.
    supabase
      .from('messages')
      .select('id, conversation_id, content, created_at, sender_id')
      .in('conversation_id', convs.map((c) => c.id))
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(convs.length * 10),
  ]);

  const usersById = new Map<string, any>();
  (usersRes.data ?? []).forEach((u: any) => usersById.set(u.id, u));

  // First message per conversation_id (already ordered desc by created_at).
  const lastMsgByConv = new Map<string, { content: string; created_at: string }>();
  (msgsRes.data ?? []).forEach((m: any) => {
    if (!lastMsgByConv.has(m.conversation_id)) {
      lastMsgByConv.set(m.conversation_id, { content: m.content, created_at: m.created_at });
    }
  });

  const threads: LeaderThread[] = convs.map((c) => {
    const otherId = c.participant_a === callerUserId ? c.participant_b : c.participant_a;
    const u = usersById.get(otherId);
    const church = u?.churches;
    const underground = church?.type === 'underground';
    const churchName = underground ? 'Underground Church' : (church?.name ?? '');
    const fullName: string = u?.full_name ?? '';
    const [firstName = '', ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');
    const displayName = c.is_secure_replant_thread
      ? 'Replant Team'
      : getLeaderDisplayName({
          firstName,
          lastName,
          roleLabel: getRoleLabel(u?.role),
          churchName,
          anonymous: !!u?.anonymous,
        });
    const monogramInitial = firstName.charAt(0).toUpperCase() || '·';
    const lastMsg = lastMsgByConv.get(c.id);
    // Per-caller unread badge: present iff last_message_at > caller's
    // last_read_at_<x>. Picks _a or _b based on which participant slot
    // the caller occupies. A NULL last_read_at means the caller has
    // never opened the thread; any existing message is unread. A
    // conversation with no messages at all has nothing to read.
    const callerLastRead = c.participant_a === callerUserId
      ? c.last_read_at_a
      : c.last_read_at_b;
    const lastAtIso = lastMsg
      ? lastMsg.created_at
      : (c.last_message_at ?? null);
    let unread = 0;
    if (lastAtIso) {
      if (!callerLastRead) {
        unread = 1;
      } else if (new Date(lastAtIso).getTime() > new Date(callerLastRead).getTime()) {
        unread = 1;
      }
    }
    return {
      conversationId: c.id,
      otherUserId: otherId,
      isSecure: !!c.is_secure_replant_thread,
      displayName,
      monogramInitial,
      churchLabel: c.is_secure_replant_thread ? 'Replant · system-managed' : churchName,
      anonymous: !!u?.anonymous,
      underground,
      preview: lastMsg ? truncate(lastMsg.content, PREVIEW_MAX) : '',
      lastAt: lastMsg ? new Date(lastMsg.created_at)
        : (c.last_message_at ? new Date(c.last_message_at) : null),
      unread,
    };
  });

  return threads;
}

// ── skeleton, error, empty ────────────────────────────────────────────
function SkeletonRows() {
  const widths = [68, 80, 56, 74, 62, 70];
  return (
    <View>
      {widths.map((w, i) => (
        <View key={i} style={styles.skelRow}>
          <View style={styles.skelMono} />
          <View style={{ flex: 1 }}>
            <View style={[styles.skelBar, { width: `${w}%`, height: 12 }]} />
            <View style={[styles.skelBar, { width: `${w - 28}%`, height: 8, marginTop: 8 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorLine}>Couldn't load your conversations.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
        <Text style={styles.retryText}>Tap to retry</Text>
      </Pressable>
    </View>
  );
}

function EmptyView({ onFind }: { onFind: () => void }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyGlyph}>
        <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
          <Path d="M7 10h26a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H15l-6 5v-5H7a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
            stroke={Colors.accent} strokeWidth={1} strokeLinejoin="round" opacity={0.75} />
        </Svg>
      </View>
      <Text style={styles.emptyTitle}>No conversations yet.</Text>
      <Text style={styles.emptyBody}>Find a leader in the network and start one.</Text>
      <Pressable onPress={onFind} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.emptyBtnText}>Find a Leader</Text>
      </Pressable>
    </View>
  );
}

// ── main ──────────────────────────────────────────────────────────────
export default function LeadersList({ onOpenThread, onFindLeader }: Props) {
  const { session } = useAuth();
  const [callerUserId, setCallerUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<LeaderThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  // Resolve caller's public.users.id once per session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authUid = session?.user?.id;
      if (!authUid) return;
      const { data } = await supabase
        .from('users').select('id').eq('auth_id', authUid).maybeSingle();
      if (!cancelled && data?.id) setCallerUserId(data.id);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const loadInitial = useCallback(async () => {
    if (!callerUserId) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchThreadPage(callerUserId, 0, PAGE_SIZE);
      setThreads(page);
      setExhausted(page.length < PAGE_SIZE);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [callerUserId]);

  const loadMore = useCallback(async () => {
    if (!callerUserId || loadingMore || exhausted) return;
    setLoadingMore(true);
    try {
      const next = await fetchThreadPage(callerUserId, threads.length, PAGE_SIZE);
      setThreads((prev) => [...prev, ...next]);
      if (next.length < PAGE_SIZE) setExhausted(true);
    } catch {
      // soft-fail on page; keep what we have.
    } finally {
      setLoadingMore(false);
    }
  }, [callerUserId, threads.length, loadingMore, exhausted]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // Realtime list refresh — KAN-68 device pass B1.
  // Subscribe to the caller's conversations row stream. send-message +
  // send-branch-message both bump `last_message_at` on the row after a
  // successful insert (UPDATE event), and a lazy-created thread shows
  // up as a fresh row on the recipient side (INSERT event). RLS on
  // conversations gates these events to the caller's own threads, so
  // no cross-leader leakage. Debounced to coalesce bursts (e.g. a
  // sender firing several messages quickly).
  //
  // We refetch the first page rather than mutating a single row in
  // place — the page query already joins users + churches + last
  // message preview, and an in-place update would need to repeat
  // most of that fetch anyway. For ≤25 rows the cost is negligible.
  useEffect(() => {
    if (!callerUserId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void loadInitial(); }, 250);
    };
    const channel = supabase
      .channel(`leaders-list-${callerUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        queueRefresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [callerUserId, loadInitial]);

  // Filter on name + church only (NEVER preview). Local 2-char gate
  // mirrors the search semantic in HANDOFF §6.1.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return threads;
    return threads.filter((t) =>
      t.displayName.toLowerCase().includes(q) ||
      (t.churchLabel && t.churchLabel.toLowerCase().includes(q))
    );
  }, [threads, query]);

  return (
    <View style={styles.root}>
      <View style={[styles.search, focused && styles.searchFocused]}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or church"
          placeholderTextColor={Colors.textSubtle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <ErrorView onRetry={loadInitial} />
      ) : filtered.length === 0 && query.trim().length < 2 ? (
        <>
          <EmptyView onFind={onFindLeader} />
          <CovenantFooter />
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.conversationId}
          renderItem={({ item }) => (
            <ThreadRow
              thread={item}
              onPress={() => onOpenThread(item.conversationId, item.otherUserId)}
            />
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.noMatch}>
              <Text style={styles.noMatchTitle}>No matches.</Text>
              <Text style={styles.noMatchBody}>
                No conversation with a leader or church by that name.
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {loadingMore && (
                <View style={styles.loadMore}>
                  <ActivityIndicator color={Colors.textSubtle} />
                </View>
              )}
              <CovenantFooter />
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // ── search ──
  search: {
    marginTop: 4,
    marginHorizontal: 22,
    marginBottom: 6,
    height: 42,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchFocused: { borderColor: 'rgba(107,181,232,0.35)' },
  searchInput: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  // ── row ──
  listContent: { paddingTop: 6, paddingBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  rowPressed: { backgroundColor: 'rgba(240,237,230,0.02)' },
  rowSecure: { backgroundColor: 'rgba(107,181,232,0.04)' },
  secureRail: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, width: 2,
    backgroundColor: Colors.accent,
  },
  monogram: {
    width: 40, height: 40,
    borderRadius: 11,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  monogramSecure: {
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderColor: 'rgba(107,181,232,0.35)',
  },
  monogramAnon: { borderColor: 'rgba(240,237,230,0.10)' },
  monogramInitial: {
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    color: Colors.text,
  },
  center: { flex: 1, minWidth: 0 },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    flexShrink: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 14.5,
    color: Colors.text,
    letterSpacing: 0.07,
  },
  nameUnread: { color: Colors.text },
  nameSecure: { color: Colors.accent },
  church: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  preview: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 5,
    lineHeight: 17,
  },
  previewUnread: { color: Colors.text },
  right: {
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 2,
  },
  time: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.57, // 0.06em × 9.5
    color: Colors.textSubtle,
  },
  unreadBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.background,
  },
  secureTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 4,
  },
  secureTagText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44, // 0.18em × 8
    color: Colors.accent,
  },
  // ── skeleton ──
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  skelMono: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: Colors.surface,
  },
  skelBar: {
    backgroundColor: Colors.surface,
    borderRadius: 4,
  },
  // ── error ──
  errorBox: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 64,
    gap: 12,
  },
  errorLine: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  retryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  // ── empty ──
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 56,
    paddingBottom: 22,
    gap: 12,
  },
  emptyGlyph: { marginBottom: 6 },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBtn: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    backgroundColor: 'rgba(107,181,232,0.08)',
  },
  emptyBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  // ── filter empty ──
  noMatch: {
    padding: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 6,
  },
  noMatchTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
  },
  noMatchBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  loadMore: { paddingVertical: 16, alignItems: 'center' },
});
