// useConnectUnreadBadge — Connect-tab unread aggregator (HANDOFF §15.1).
//
// Returns the total unread message count across the caller's Leaders
// DMs and Ministries branches, capped to a "99+" label. Hidden when
// zero or when the leader has switched the notification badge off
// (via Settings → 05 Notifications → New message badge).
//
// Data source: the same two RPCs the lists already call:
//   - public.get_leader_thread_list() — returns per-thread unread_count
//   - public.get_branch_list()        — returns per-branch unread_count
//
// Refresh triggers (mirrors the Realtime pattern in LeadersList +
// MinistriesList — same publication-aware tables):
//   - public.messages INSERT (catches both 1:1 sends and branch sends;
//     RLS gates events to messages the caller can read)
//   - public.branches UPDATE (branch last_message_at bumps,
//     forming → active transitions)
//   - public.branch_members * (consent changes that affect the caller's
//     access to a branch's messages)
//
// All refetches are debounced 350ms so a flurry of sends in either
// tab coalesces to one round-trip.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../lib/supabase';
import { useNotifBadgeEnabled } from '../lib/connect-prefs';

export interface ConnectUnreadBadge {
  // Raw count (uncapped) — useful for screen-reader announcements.
  count: number;
  // Label for the visible badge: undefined when shown=false; "1".."99"
  // for counts 1-99; "99+" beyond.
  label: string | undefined;
  // Whether the badge should render at all (count > 0 AND the
  // leader's preference is on).
  shown: boolean;
}

const REFRESH_DEBOUNCE_MS = 350;
const CAP = 99;

function formatBadgeLabel(count: number): string | undefined {
  if (count <= 0) return undefined;
  if (count > CAP) return `${CAP}+`;
  return String(count);
}

async function fetchTotalUnread(): Promise<number> {
  // Both RPCs return a bigint unread_count per row. The two queries
  // run in parallel and we sum across both result sets. RPC failures
  // (e.g. session expired, RLS gate) fall back to zero rather than
  // throwing — the badge is a UX hint, not a correctness path.
  const [leadersRes, branchesRes] = await Promise.all([
    supabase.rpc('get_leader_thread_list'),
    supabase.rpc('get_branch_list'),
  ]);
  const leaderSum = Array.isArray(leadersRes.data)
    ? (leadersRes.data as any[]).reduce(
        (acc, r) => acc + (Number(r?.unread_count) || 0),
        0,
      )
    : 0;
  const branchSum = Array.isArray(branchesRes.data)
    ? (branchesRes.data as any[]).reduce(
        (acc, r) => acc + (Number(r?.unread_count) || 0),
        0,
      )
    : 0;
  return leaderSum + branchSum;
}

export function useConnectUnreadBadge(): ConnectUnreadBadge {
  const { session, branch } = useAuth();
  const enabled = useNotifBadgeEnabled();
  const [count, setCount] = useState(0);

  // Only count when the leader has an active verified session. Any
  // other branch (loading / unauthenticated / pending / recovery)
  // returns zero — the badge is for verified leaders.
  const eligible = !!session?.user?.id && branch === 'active';

  const refresh = useCallback(async () => {
    if (!eligible) {
      setCount(0);
      return;
    }
    try {
      const total = await fetchTotalUnread();
      setCount(total);
    } catch {
      // Silent — see fetchTotalUnread comment.
    }
  }, [eligible]);

  // Initial fetch + reactive refetch on session / branch change.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Stable ref to the latest refresh callback. The subscription effect
  // below reads through this ref instead of depending on `refresh`
  // directly — if it depended on `refresh`, the effect would tear down
  // and re-subscribe every time `eligible` flips during session
  // hydration, racing the previous channel's async cleanup and
  // producing "cannot add postgres_changes callbacks after
  // subscribe()" (Change 1, KAN-68 follow-up).
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  // Realtime subscriptions — debounced refetch. Same publication-aware
  // pattern as LeadersList / MinistriesList: messages (INSERT), branches
  // (UPDATE), branch_members (*).
  useEffect(() => {
    if (!eligible) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timer) clearTimeout(timer);
      // Read through refreshRef — see the ref's definition for why we
      // can't close over `refresh` directly here.
      timer = setTimeout(() => { void refreshRef.current(); }, REFRESH_DEBOUNCE_MS);
    };
    // Change 2 (KAN-68 follow-up): unique channel name per effect run.
    // `supabase.channel(name)` returns the EXISTING channel if a channel
    // with that name is already subscribed; calling `.on()` on it after
    // its prior `.subscribe()` throws "cannot add postgres_changes
    // callbacks after subscribe()". A random suffix per run guarantees
    // a fresh, unsubscribed channel even if the previous channel's
    // async cleanup is mid-flight. The cleanup closes over `channel`
    // by reference, so we still remove the correct one.
    const channelName = `connect-badge-${session?.user?.id ?? 'anon'}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        queueRefresh,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'branches' },
        queueRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branch_members' },
        queueRefresh,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      // Crash fix (KAN-68 follow-up): React effect cleanup runs
      // synchronously, but `supabase.removeChannel` is async. If the
      // effect re-fires before removal completes, the next iteration
      // calls `.on()` on a channel that is still registered as
      // subscribed → Supabase throws "cannot add postgres_changes
      // callbacks after subscribe()". Explicit `unsubscribe()` first
      // tears down the channel's server-side state before the new
      // subscribe call races in. The Change 2 unique channel name is
      // a belt; this is the suspenders.
      void channel.unsubscribe().then(() => supabase.removeChannel(channel));
    };
    // `refresh` is intentionally NOT a dependency — it's accessed via
    // refreshRef so an `eligible` flip during hydration doesn't tear
    // down and re-subscribe the channel inside the same render cycle.
  }, [eligible, session?.user?.id]);

  const shown = enabled && eligible && count > 0;
  return {
    count,
    label: shown ? formatBadgeLabel(count) : undefined,
    shown,
  };
}
