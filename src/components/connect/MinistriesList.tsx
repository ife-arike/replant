// MinistriesList — KAN-69 §7.2 / HANDOFF §7.
//
// Branch list — group chats connecting up to 7 ministries (John 15:5).
// Surfaces:
//   - Empty state (MinistriesEmpty) — "What would you like to start today?"
//     + full John 15:5 verse + Start a branch CTA.
//   - InviteCard rows — branches where caller_consent_status='invited'.
//     Decline → DeclineConfirm modal → respond_to_branch_invite RPC.
//     Join → respond_to_branch_invite RPC directly.
//   - BranchRow rows — forming + active branches, sorted recency.
//   - CovenantFooter at the bottom of the list.
//
// Data: public.get_branch_list() RPC (KAN-214) returns caller-scoped
// rows with member_count, ministry_count, last_message_preview,
// last_message_at, unread_count (0 at MVP — read-receipts is a
// follow-up), caller_consent_status, and invited_by_ministry_name
// (populated only when caller_consent_status='invited').

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import CovenantFooter from './CovenantFooter';

export interface BranchListRow {
  branchId: string;
  name: string;
  status: 'forming' | 'active' | 'cancelled';
  memberCount: number;
  ministryCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  callerConsentStatus: 'invited' | 'joined' | 'declined';
  invitedByMinistryName: string | null;
}

interface Props {
  onOpenBranch: (branchId: string) => void;
  onStartBranch: () => void;
  onToast: (text: string) => void;
}

// ── inline icons ──────────────────────────────────────────────────────
function BranchGlyph({ color = Colors.accent, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={6} r={2.3} stroke={color} strokeWidth={1.4} />
      <Circle cx={18} cy={7} r={2.3} stroke={color} strokeWidth={1.4} />
      <Circle cx={12} cy={18} r={2.3} stroke={color} strokeWidth={1.4} />
      <Path d="M7.7 7.5l3.1 8.4M16.4 8.7L13 15.9M8.2 6.4h7.4"
        stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

// ── BranchRow ─────────────────────────────────────────────────────────
function BranchRow({ row, onPress }: { row: BranchListRow; onPress: () => void }) {
  const unread = row.unreadCount > 0;
  const forming = row.status === 'forming';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      pressed && { backgroundColor: 'rgba(240,237,230,0.02)' },
    ]}>
      <View style={styles.branchSeal}><BranchGlyph color={Colors.accent} size={18} /></View>
      <View style={styles.center}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.name, unread && styles.nameUnread]}>{row.name}</Text>
          {forming && (
            <View style={styles.formingTag}>
              <Text style={styles.formingTagText}>FORMING</Text>
            </View>
          )}
        </View>
        <Text style={styles.members}>
          {row.ministryCount} ministries · {row.memberCount} leaders
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {row.lastMessagePreview ?? ' '}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.time}>{formatBranchTime(row.lastMessageAt)}</Text>
        {unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{row.unreadCount}</Text>
          </View>
        )}
      </View>
      {/* Fix 5 (KAN-68 CD-alignment pass): 0.5px hairline inset to
          left:72 (22 left pad + 36 seal + 14 gap = 72). Same pattern
          as Leaders thread row but the branch seal is 36 wide, not
          40. Inside the row so it appears on every row including
          the last. */}
      <View style={styles.rowHairline} pointerEvents="none" />
    </Pressable>
  );
}

function formatBranchTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startToday.getTime() - startThen.getTime()) / 86_400_000);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── InviteCard ────────────────────────────────────────────────────────
function InviteCard({
  row,
  onJoin,
  onDeclineClick,
  inFlight,
}: {
  row: BranchListRow;
  onJoin: () => void;
  onDeclineClick: () => void;
  inFlight: boolean;
}) {
  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHead}>
        <View style={styles.inviteSeal}>
          <BranchGlyph color={Colors.amber} size={18} />
        </View>
        <View style={styles.inviteWho}>
          <Text style={styles.inviteEyebrow}>YOU'RE INVITED TO A BRANCH</Text>
          <Text style={styles.inviteName} numberOfLines={2}>{row.name}</Text>
        </View>
      </View>
      <Text style={styles.inviteBody}>
        <Text style={styles.inviteBodyStrong}>{row.invitedByMinistryName ?? 'Another ministry'}</Text>
        <Text>{' '}invited your ministry to join — </Text>
        <Text>{row.ministryCount} ministries, {row.memberCount} leaders in all. Everyone joins only by consent.</Text>
      </Text>
      <View style={styles.inviteActions}>
        <Pressable
          onPress={onDeclineClick}
          disabled={inFlight}
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.btnGhostText}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={onJoin}
          disabled={inFlight}
          style={({ pressed }) => [styles.btnPrimary, styles.btnPrimaryRow, pressed && { opacity: 0.85 }]}
        >
          {inFlight ? <ActivityIndicator color="#07232f" />
            : <Text style={styles.btnPrimaryText}>Join the branch</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── DeclineConfirm ────────────────────────────────────────────────────
function DeclineConfirm({
  visible,
  branch,
  onCancel,
  onConfirm,
  inFlight,
}: {
  visible: boolean;
  branch: BranchListRow | null;
  onCancel: () => void;
  onConfirm: () => void;
  inFlight: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.confirmScrim} onPress={onCancel}>
        <Pressable style={styles.confirmCard} onPress={() => {}}>
          <Text style={styles.confirmTitle}>Decline this invitation?</Text>
          <Text style={styles.confirmBody}>
            Your ministry won't join "{branch?.name ?? ''}." {branch?.invitedByMinistryName ?? 'They'} can invite you again later — no harm, no foul.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} disabled={inFlight}
              style={({ pressed }) => [styles.btnGhost, { flex: 1 }, pressed && { opacity: 0.7 }]}>
              <Text style={styles.btnGhostText}>Keep invitation</Text>
            </Pressable>
            <Pressable onPress={onConfirm} disabled={inFlight}
              style={({ pressed }) => [styles.btnDecline, { flex: 1 }, pressed && { opacity: 0.85 }]}>
              {inFlight ? <ActivityIndicator color={Colors.red} />
                : <Text style={styles.btnDeclineText}>Decline</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── empty state ───────────────────────────────────────────────────────
function MinistriesEmpty({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptySeal}>
        <BranchGlyph color={Colors.accent} size={26} />
      </View>
      <Text style={styles.emptyTitle}>What would you like to start today?</Text>
      <Text style={styles.emptyBody}>
        Open a church-to-church conversation. You can bring up to seven ministries
        together into one branch — everyone joins by consent.
      </Text>
      <Pressable onPress={onStart} style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}>
        <Text style={styles.btnPrimaryText}>Start a branch</Text>
      </Pressable>
      <View style={styles.verseBlock}>
        <Text style={styles.verseText}>
          "I am the vine, ye are the branches: He that abideth in me, and I in him,
          the same bringeth forth much fruit: for without me ye can do nothing."
        </Text>
        <Text style={styles.verseRef}>JOHN 15:5</Text>
      </View>
      <Text style={styles.postNote}>Branches with more than seven ministries coming soon.</Text>
    </View>
  );
}

// ── main ──────────────────────────────────────────────────────────────
export default function MinistriesList({ onOpenBranch, onStartBranch, onToast }: Props) {
  const [rows, setRows] = useState<BranchListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [declining, setDeclining] = useState<BranchListRow | null>(null);
  // branchId → inFlight (join/decline RPC). Lets us disable both buttons
  // on the affected row without flashing every other invite card.
  const [busyByBranchId, setBusyByBranchId] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_branch_list');
      if (rpcErr) throw rpcErr;
      const mapped: BranchListRow[] = (data ?? []).map((r: any) => ({
        branchId: r.branch_id,
        name: r.name,
        status: r.status,
        memberCount: Number(r.member_count) || 0,
        ministryCount: Number(r.ministry_count) || 0,
        lastMessagePreview: r.last_message_preview ?? null,
        lastMessageAt: r.last_message_at ? new Date(r.last_message_at) : null,
        unreadCount: Number(r.unread_count) || 0,
        callerConsentStatus: r.caller_consent_status,
        invitedByMinistryName: r.invited_by_ministry_name ?? null,
      }));
      setRows(mapped);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Realtime list refresh — Fix 3 (KAN-68 fix pass). Mirrors the
  // Leaders pattern with the right published-table targets for
  // Ministries:
  //   - `branches` UPDATE: fires when send-branch-message bumps
  //     `last_message_at` (preview + unread refresh) and when the
  //     RPC pipeline transitions a branch `forming` → `active`.
  //   - `branch_members` *: fires when a member's consent_status
  //     flips (Joined / Declined badges in the forming banner +
  //     members sheet) and when the host removes a ministry via
  //     remove_ministry_from_branch.
  //
  // Both tables ARE in the supabase_realtime publication (KAN-214
  // Migration 3). RLS on each scopes events to the caller's
  // branches via the branch_members membership join. 250ms
  // debounce coalesces bursts (e.g. a host activating + a member
  // joining within the same tick).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 250);
    };
    const channel = supabase
      .channel('ministries-list-realtime')
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
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const respondToInvite = useCallback(async (branchId: string, response: 'joined' | 'declined') => {
    setBusyByBranchId((p) => ({ ...p, [branchId]: true }));
    try {
      const { error: rpcErr } = await supabase.rpc('respond_to_branch_invite', {
        p_branch_id: branchId,
        p_response: response,
      });
      if (rpcErr) throw rpcErr;
      // Optimistic update + then reload to pull updated status.
      if (response === 'declined') {
        setRows((prev) => prev.filter((r) => r.branchId !== branchId));
        onToast('Invitation declined.');
      } else {
        await load();
      }
    } catch {
      onToast('Couldn’t update your response. Try again.');
    } finally {
      setBusyByBranchId((p) => ({ ...p, [branchId]: false }));
    }
  }, [load, onToast]);

  // Split: invites surface above the rest.
  const invites = rows.filter((r) => r.callerConsentStatus === 'invited');
  const rest = rows.filter((r) => r.callerConsentStatus !== 'invited');

  if (loading) {
    return (
      <View style={styles.fillCenter}>
        <ActivityIndicator color={Colors.textSubtle} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorLine}>Couldn't load your branches.</Text>
        <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <MinistriesEmpty onStart={onStartBranch} />
        <CovenantFooter />
      </View>
    );
  }

  const data: Array<{ kind: 'invite' | 'row'; row: BranchListRow }> = [
    ...invites.map((r) => ({ kind: 'invite' as const, row: r })),
    ...rest.map((r) => ({ kind: 'row' as const, row: r })),
  ];

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(d) => `${d.kind}-${d.row.branchId}`}
        renderItem={({ item }) =>
          item.kind === 'invite' ? (
            <InviteCard
              row={item.row}
              inFlight={!!busyByBranchId[item.row.branchId]}
              onJoin={() => respondToInvite(item.row.branchId, 'joined')}
              onDeclineClick={() => setDeclining(item.row)}
            />
          ) : (
            <BranchRow row={item.row} onPress={() => onOpenBranch(item.row.branchId)} />
          )
        }
        ListFooterComponent={<CovenantFooter />}
      />
      <DeclineConfirm
        visible={!!declining}
        branch={declining}
        inFlight={!!declining && !!busyByBranchId[declining.branchId]}
        onCancel={() => setDeclining(null)}
        onConfirm={() => {
          if (!declining) return;
          const b = declining;
          setDeclining(null);
          void respondToInvite(b.branchId, 'declined');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── row ──
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  rowHairline: {
    position: 'absolute',
    left: 72, // 22 (left pad) + 36 (branch seal) + 14 (gap)
    right: 22,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  branchSeal: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  center: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: {
    flexShrink: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 14.5,
    color: Colors.text,
    letterSpacing: 0.07,
  },
  nameUnread: { color: Colors.text },
  formingTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.amber,
    borderRadius: 4,
  },
  formingTagText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.28, // 0.16em × 8
    color: Colors.amber,
  },
  members: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: Colors.accent,
    marginTop: 4,
  },
  preview: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 5,
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 2,
  },
  time: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.57,
    color: Colors.textSubtle,
  },
  unreadBadge: {
    minWidth: 19, height: 19,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.background,
  },
  // ── invite card ──
  inviteCard: {
    margin: 14,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.amber,
    borderRadius: 14,
    padding: 18,
  },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  inviteSeal: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(212,168,85,0.10)',
    borderWidth: 0.5, borderColor: 'rgba(212,168,85,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  inviteWho: { flex: 1, minWidth: 0 },
  inviteEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    color: Colors.amber,
    marginBottom: 4,
  },
  inviteName: {
    fontFamily: Typography.displayMedium,
    fontSize: 19,
    color: Colors.text,
  },
  inviteBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  inviteBodyStrong: {
    color: Colors.text,
    fontFamily: Typography.bodyMedium,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  // Fix 3 (KAN-68 CD-alignment pass): `flex: 1.4` was leaking from the
  // InviteCard row context (where it sits next to a `flex: 1` ghost
  // button) into the MinistriesEmpty standalone usage. In a column
  // container `flex: 1.4` blows the button to ~200pt vertical height
  // and pushes the text out of the visible region — leaving a blank
  // sky rectangle. Base style now has no flex; the InviteCard usage
  // adds `flex: 1.4` inline.
  btnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryRow: {
    flex: 1.4,
  },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: '#07232f',
    letterSpacing: 0.3,
  },
  // ── decline confirm ──
  confirmScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,4,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 18,
    padding: 24,
  },
  confirmTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
  btnDecline: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeclineText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.red,
    letterSpacing: 0.3,
  },
  // ── empty ── (B5 device pass: bottom padding bumped from 22 → 100pt
  // so the "Start a branch" button, the John 15:5 verse block, and the
  // post-note all clear the bottom tab bar (≈84pt) + the CovenantFooter
  // / CovenantStrip area that sits at the bottom of the Ministries
  // sub-tab. Without this the button could be clipped on smaller
  // device heights.)
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 56,
    paddingBottom: 100,
    gap: 14,
  },
  emptySeal: {
    width: 58, height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  verseBlock: {
    maxWidth: 300,
    alignItems: 'center',
    marginTop: 22,
    gap: 8,
  },
  verseText: {
    fontFamily: Typography.scriptureLight,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  verseRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: Colors.textSubtle,
  },
  postNote: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.18,
  },
  // ── error ──
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 12,
  },
  errorLine: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retry: { paddingVertical: 10, paddingHorizontal: 16 },
  retryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
});
