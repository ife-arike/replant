// LeadersList — KAN-68 §6.1 / HANDOFF §6.1.
//
// The Leaders sub-tab thread list. The Replant Team secure thread
// (system-managed, conversations.is_secure_replant_thread = true) is
// pinned at the top above the recency-sorted peer DMs.
//
// Data source: public.get_leader_thread_list() — a SECURITY DEFINER
// RPC that bypasses the per-row users RLS (which only exposes the
// caller's own row) and returns the other participant's identity
// fields directly, with the underground-name masking applied
// server-side. The RPC also computes a precise per-caller unread
// count from the messages stream.
//
// Why an RPC: public.users RLS is `auth.uid() = auth_id` — a leader
// can only read their own row. A PostgREST-direct fetch on the other
// participants' rows returns empty, leaving the name + church lines
// blank. Earlier device testing under a super_admin account masked
// the bug because the `users_admin_select` policy lifts the gate for
// that role.
//
// Search: activates at 2+ chars; matches display name + church only,
// NEVER message content (HANDOFF §6.1 + §10). Client-side filter
// against pre-resolved row text — the RPC returns the full corpus.
//
// Pagination: 25 threads on mount, scroll-to-end loads next 25.
// Locally paginated because the RPC returns the caller's full thread
// set; for MVP this is fine (a leader's thread count is small).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  // Per-caller precise unread count (computed by the RPC from the
  // messages stream where sender_id <> caller AND created_at > my
  // last_read_at_<x>).
  unread: number;
  // Raw fields passed to the DM thread view as initial nav params
  // (Fix 1, KAN-68 CD-alignment pass). The thread view can render
  // its header immediately from these without waiting on its own
  // async profile resolution — no more "·" placeholder header.
  // Underground masking and the "Replant Team" secure-thread label
  // are already applied to these values by get_leader_thread_list.
  fullName: string;
  role: string | null;
  churchName: string;
}

interface Props {
  onOpenThread: (thread: LeaderThread) => void;
  onFindLeader: () => void;
}

const PAGE_SIZE = 25;
// Preview is pre-truncated to 60 chars by get_leader_thread_list (LEFT
// (content, 60) — HANDOFF §6.1).

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
      {/* Fix 5 (KAN-68 CD-alignment pass): 0.5px bottom hairline inset
          to left:76 (40 seal + 14 gap + 22 left pad). Inside the row
          so it appears on every row including the last (no
          ItemSeparator skips). */}
      <View style={styles.rowHairline} pointerEvents="none" />
    </Pressable>
  );
}

// ── data loader ───────────────────────────────────────────────────────
// Single SECURITY DEFINER RPC call. The RPC has already:
//   - resolved each conversation's "other" participant (no
//     participant_a/_b math here);
//   - applied the underground-name mask (other_church_name returns
//     "Underground Church" for type='underground' rows);
//   - substituted "Replant Team" for the secure system thread's name;
//   - sorted secure-pinned-first, then by last_message_at DESC;
//   - computed a precise per-caller unread_count from the messages
//     stream gated on last_read_at_<x>.
//
// HANDOFF §6.1 row anatomy — TWO separate lines:
//   Name line  : full_name (or RoleLabel when anonymous=true)
//   Church line: other_church_name
// This file used to compose the combined "FullName · ChurchName"
// string from getLeaderDisplayName and put it on the name line; that
// duplicated the church between name + church lines. Row now renders
// the two fields cleanly separated.
async function fetchThreadList(): Promise<LeaderThread[]> {
  const { data, error } = await supabase.rpc('get_leader_thread_list');
  if (error || !data) return [];
  return (data as any[]).map((r): LeaderThread => {
    const isSecure = !!r.is_secure_replant_thread;
    const anonymous = !!r.other_anonymous;
    const underground = !!r.other_underground;
    const fullName: string = r.other_full_name ?? '';
    const role: string | null = r.other_role ?? null;
    const rawChurchName: string = r.other_church_name ?? '';
    const roleLabel = role ? getRoleLabel(role) : '';
    // Name line per §6.1 (Fix 2): just the leader's full name (or
    // role label when anonymous). No "· church" suffix — church
    // renders on its own line.
    let displayName: string;
    if (isSecure) {
      displayName = 'Replant Team';
    } else if (anonymous) {
      displayName = roleLabel || 'Leader';
    } else {
      displayName = fullName;
    }
    // Church line per Fix 2: "ChurchName · RoleLabel" for identified
    // leaders; "ChurchName" alone for anonymous (role already on
    // line 1); "Underground Church" alone for underground (role
    // omitted per dispatch). Secure thread uses the literal
    // "Replant · system-managed".
    let churchLabel: string;
    if (isSecure) {
      churchLabel = 'Replant · system-managed';
    } else if (underground) {
      churchLabel = 'Underground Church';
    } else if (anonymous) {
      churchLabel = rawChurchName;
    } else {
      churchLabel = roleLabel
        ? `${rawChurchName} · ${roleLabel}`
        : rawChurchName;
    }
    // Monogram initial = first letter of the leader's actual full
    // name (not the role label). Anonymous + underground both render
    // the muted figure glyph instead — see ThreadRow's branch.
    const monogramInitial = fullName.trim().charAt(0).toUpperCase() || '·';
    const lastAt = r.last_message_at ? new Date(r.last_message_at) : null;
    return {
      conversationId: r.conversation_id,
      otherUserId: r.other_user_id,
      isSecure,
      displayName,
      monogramInitial,
      churchLabel,
      anonymous,
      underground,
      preview: r.last_message_preview ?? '',
      lastAt,
      unread: Number(r.unread_count) || 0,
      fullName,
      role,
      // Raw church name for the DM-thread-view header (Fix 1). The
      // header does NOT include the role; only the row church line
      // does (per §6.3 vs §6.1 distinction).
      churchName: isSecure ? 'Replant · system-managed' : (underground ? 'Underground Church' : rawChurchName),
    };
  });
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
  const [allThreads, setAllThreads] = useState<LeaderThread[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // sessionReady gates the initial load on session.user.id being non-null.
  // The RPC resolves the caller server-side via auth.uid(), so the FE
  // doesn't need callerUserId for the fetch — but we wait until the
  // session is hydrated to avoid firing an unauthenticated RPC call.
  const sessionReady = !!session?.user?.id;

  const loadInitial = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchThreadList();
      setAllThreads(list);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [sessionReady]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, allThreads.length));
  }, [allThreads.length]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // Realtime list refresh — Fix 2 (KAN-68 fix pass).
  //
  // Root cause of the original bd68eb3 subscription failing silently:
  // public.conversations is NOT in the supabase_realtime publication.
  // Only `messages`, `branches`, and `branch_members` are published
  // (see pg_publication_tables). Subscribing to a non-published table
  // produces no events.
  //
  // Fix: subscribe to `messages` INSERT events. send-message inserts a
  // row on every successful 1:1 DM send, which is the trigger we
  // want. RLS on messages gates events to messages the caller can
  // see (i.e. messages in their own threads), so there's no
  // cross-leader leakage. Debounced 250ms to coalesce bursts.
  //
  // Refetch is a single RPC call, cheap.
  useEffect(() => {
    if (!sessionReady) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void loadInitial(); }, 250);
    };
    const channel = supabase
      .channel(`leaders-list-realtime-${session?.user?.id ?? 'anon'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        queueRefresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionReady, session?.user?.id, loadInitial]);

  // Filter on name + church only (NEVER preview). Local 2-char gate
  // mirrors the search semantic in HANDOFF §6.1.
  //
  // When the user is NOT searching, we show the paginated slice of
  // allThreads (visibleCount grows on scroll-to-end). When searching,
  // we filter the WHOLE list so a match isn't hidden below the
  // pagination cursor.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return allThreads.slice(0, visibleCount);
    return allThreads.filter((t) =>
      t.displayName.toLowerCase().includes(q) ||
      (t.churchLabel && t.churchLabel.toLowerCase().includes(q))
    );
  }, [allThreads, visibleCount, query]);

  const hasMore = visibleCount < allThreads.length;

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
              onPress={() => onOpenThread(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.noMatch}>
              <Text style={styles.noMatchTitle}>No matches.</Text>
              <Text style={styles.noMatchBody}>
                No conversation with a leader or church by that name.
              </Text>
            </View>
          }
          ListFooterComponent={<CovenantFooter />}
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
  rowHairline: {
    position: 'absolute',
    left: 76, // 22 (left pad) + 40 (seal) + 14 (gap)
    right: 22,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
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
});
