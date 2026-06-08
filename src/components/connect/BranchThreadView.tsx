// BranchThreadView — KAN-69 §7.3 + §7.4 / HANDOFF §7.3.
//
// Group thread (branch). Shape mirrors DMThreadView but with:
//   - Author label above each received bubble (sender name + ministry).
//   - Forming banner when branch.status === 'forming'; composer locked.
//   - MembersSheet bottom sheet showing per-ministry consent badges.
//   - Decline-cascade banner when any ministry has fully declined.
//   - send-branch-message edge function (KAN-214) instead of send-message.
//
// SECURITY INVARIANTS:
//   - Plain text. URLs render as plain text, not linkified, no prefetch.
//   - DELIVER-ALWAYS: no read or branch on `flagged`. The leader's UI is
//     identical whether the send was flagged or not. Admin moderation
//     queue is the only `flagged` reader.
//   - send-branch-message is the ONLY edge function called from this
//     view. send-message (KAN-71) is for 1:1 DMs and never appears here.
//   - SAFE-LOG posture: do not log content text. We don't log anything
//     in this component today; preserving that posture for future debug.
//
// Data:
//   - get_branch_messages(p_branch_id, p_before)            — message history.
//   - get_branch_members(p_branch_id)                       — member list.
//   - remove_ministry_from_branch(p_branch_id, p_ministry_id) — decline cascade.

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
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { getLeaderDisplayName } from '../../utils/getLeaderDisplayName';
import { getRoleLabel } from '../../utils/displayHelpers';
import {
  assignGroupLabels,
  formatMessageTime,
} from './DMThreadView';
import CovenantStrip from './CovenantStrip';
import AttachmentPopover from './AttachmentPopover';

interface Props {
  branchId: string;
  callerUserId: string | null;
  onBack: () => void;
  // Optional swipe-left-to-go-back gesture handler. Called by the
  // PanResponder when the leader swipes right→left with a horizontal
  // displacement > 80pt and a vertical component < 30pt. The existing
  // back button remains; this is an additive gesture path.
  onSwipeBack?: () => void;
}

interface BranchMessage {
  id: string;
  mine: boolean;
  senderId: string;
  text: string;
  createdAt: Date;
  state?: 'pending' | 'sent' | 'failed';
  groupLabel?: string | null;
  isSystem?: boolean;
}

interface BranchMember {
  userId: string;
  ministryId: string;
  ministryName: string;
  fullName: string;
  displayName: string; // pre-composed; for bubble author label
  role: string | null;
  anonymous: boolean;
  isHost: boolean;
  consentStatus: 'invited' | 'joined' | 'declined';
}

interface BranchSummary {
  name: string;
  status: 'forming' | 'active' | 'cancelled';
  ministryCount: number;
  memberCount: number;
}

// KAN-69 §7.x — branch-join system message. The DB migration
// (20260608000001) inserts a row authored by this synthetic system user
// whenever a leader accepts a branch invitation. These rows render as a
// centered grace notice rather than a chat bubble — a clear, calm record
// of consent to the branch's fellowship.
const BRANCH_SYSTEM_USER_ID = '028be745-8014-4314-a7cf-36b0a4d52b46';

const PAGE_SIZE = 30;
const FIVE_MIN_MS = 5 * 60 * 1000;
const MAX_COMPOSER_HEIGHT = 124;
// connect-polish-3 Fix B: branch-thread composer was retained at the
// pre-polish-1 42pt size while the DM composer shrank to 36pt across
// polish-1 Fix B + polish-2 Fix 3. Founder-reported visual mismatch
// between branch-thread and DM-thread composers. Matching values here
// so both surfaces feel identical. textAlignVertical untouched.
const MIN_COMPOSER_HEIGHT = 36;
const COMPOSER_BUTTON_SIZE = 36;

// ── icons (subset specific to this view) ─────────────────────────────
function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={Colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function UsersIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={Colors.text} strokeWidth={1.4} />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke={Colors.text} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" stroke={Colors.text} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function BranchGlyph({ color = Colors.accent }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={6} r={2.3} stroke={color} strokeWidth={1.4} />
      <Circle cx={18} cy={7} r={2.3} stroke={color} strokeWidth={1.4} />
      <Circle cx={12} cy={18} r={2.3} stroke={color} strokeWidth={1.4} />
      <Path d="M7.7 7.5l3.1 8.4M16.4 8.7L13 15.9M8.2 6.4h7.4"
        stroke={color} strokeWidth={1.4} strokeLinecap="round" />
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
function CheckMini() {
  return (
    <Svg width={11} height={11} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 7.5l3 3 6-7" stroke={Colors.green} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function XMini() {
  return (
    <Svg width={11} height={11} viewBox="0 0 14 14" fill="none">
      <Path d="M3 3l8 8M11 3l-8 8" stroke={Colors.red} strokeWidth={1.5} strokeLinecap="round" />
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

// ── system notice (branch-join consent record) ──────────────────────
// Rendered for messages authored by BRANCH_SYSTEM_USER_ID. Centered,
// muted, mono — distinct from a chat bubble. A quiet, grace-filled
// record that a leader consented to and joined this branch.
function SystemNotice({ text }: { text: string }) {
  return (
    <View style={styles.systemNotice}>
      <Text style={styles.systemNoticeText}>{text}</Text>
    </View>
  );
}

// ── bubble (group-thread variant — includes author label) ────────────
function GroupBubble({
  msg,
  member,
  prevSameSender,
  onRetry,
}: {
  msg: BranchMessage;
  member: BranchMember | null;
  prevSameSender: boolean;
  onRetry: (id: string) => void;
}) {
  const mine = msg.mine;
  const tail = prevSameSender;
  const radii = mine
    ? { borderTopLeftRadius: 16, borderTopRightRadius: tail ? 5 : 16, borderBottomRightRadius: 5, borderBottomLeftRadius: 16 }
    : { borderTopLeftRadius: tail ? 5 : 16, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 5 };

  return (
    <View style={{ marginTop: tail ? 2 : 6 }}>
      {!mine && !prevSameSender && member && (
        <View style={styles.authorRow}>
          <Text style={styles.authorName}>{member.displayName.split(' · ')[0] ?? member.displayName}</Text>
          <Text style={styles.authorMin}>{(member.ministryName || '').toUpperCase()}</Text>
        </View>
      )}
      <View style={[
        styles.bubbleRow,
        mine ? styles.bubbleRowSent : styles.bubbleRowRecv,
      ]}>
        <View style={[
          styles.bubble,
          radii,
          mine ? styles.bubbleSent : styles.bubbleRecv,
          msg.state === 'pending' && styles.bubblePending,
          msg.state === 'failed' && styles.bubbleFailed,
        ]}>
          <Text style={mine ? styles.bubbleTextSent : styles.bubbleText}>{msg.text}</Text>
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

// ── Members sheet ─────────────────────────────────────────────────────
function MembersSheet({
  visible,
  branchName,
  ministryCount,
  memberCount,
  members,
  membersError,
  onRetryMembers,
  hostMinistryId,
  onClose,
  callerUserId,
  callerIsHost,
  branchId,
  onLeave,
  onRemoveLeader,
  onRemoveMinistry,
  onEditName,
  onDeleteBranch,
}: {
  visible: boolean;
  branchName: string;
  ministryCount: number;
  memberCount: number;
  members: BranchMember[];
  membersError: string | null;
  onRetryMembers: () => void;
  hostMinistryId: string | null;
  onClose: () => void;
  callerUserId: string | null;
  callerIsHost: boolean;
  branchId: string;
  onLeave: () => void;
  onRemoveLeader: (userId: string) => void;
  onRemoveMinistry: (ministryId: string) => void;
  onEditName: (newName: string) => void;
  onDeleteBranch: () => void;
}) {
  // Group members by ministry_id, preserving insertion order.
  const byMinistry = useMemo(() => {
    const map = new Map<string, BranchMember[]>();
    members.forEach((m) => {
      if (!map.has(m.ministryId)) map.set(m.ministryId, []);
      map.get(m.ministryId)!.push(m);
    });
    return Array.from(map.entries());
  }, [members]);

  const confirmLeave = () => {
    Alert.alert(
      'Leave this branch?',
      'You will no longer have access to this conversation or its messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onLeave },
      ],
    );
  };

  const confirmRemoveMinistry = (mid: string) => {
    Alert.alert(
      'Remove this ministry?',
      'All leaders from this ministry will be removed from the branch.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveMinistry(mid) },
      ],
    );
  };

  const confirmRemoveLeader = (userId: string) => {
    Alert.alert(
      'Remove this leader?',
      'They will no longer have access to this branch.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveLeader(userId) },
      ],
    );
  };

  const promptRename = () => {
    Alert.prompt(
      'Rename branch',
      'Enter a new name for this branch.',
      (newName) => {
        if (newName && newName.trim()) onEditName(newName.trim());
      },
      'plain-text',
      branchName,
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this branch?',
      'This will permanently close the thread for all members.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteBranch },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetGrab} />
          <Text style={styles.sheetTitle}>{branchName}</Text>
          <Text style={styles.sheetSub}>{ministryCount} ministries · {memberCount} leaders</Text>
          {membersError && members.length === 0 ? (
            <Pressable onPress={onRetryMembers} style={styles.retryRow}>
              <Text style={styles.retryText}>Couldn't load members · Tap to retry</Text>
            </Pressable>
          ) : (
          <View style={{ marginTop: 14 }}>
            {byMinistry.map(([mid, list]) => {
              const ministryName = list[0]?.ministryName ?? 'Ministry';
              const isHostMinistry = mid === hostMinistryId;
              return (
                <View key={mid} style={styles.ministryBlock}>
                  <View style={styles.ministryNameRow}>
                    <Text style={styles.ministryName}>{ministryName}</Text>
                    {isHostMinistry && <Text style={styles.youTag}>YOUR MINISTRY</Text>}
                    {callerIsHost && !isHostMinistry && (
                      <Pressable
                        onPress={() => confirmRemoveMinistry(mid)}
                        hitSlop={6}
                        style={({ pressed }) => [{ marginLeft: 'auto' }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.removeMinistryText}>Remove ministry</Text>
                      </Pressable>
                    )}
                  </View>
                  {list.map((m) => (
                    <View key={m.userId} style={styles.memberLeader}>
                      <Text style={styles.mlName} numberOfLines={1}>
                        {m.anonymous ? getRoleLabel(m.role) : m.fullName || getRoleLabel(m.role)}
                      </Text>
                      {callerIsHost && !m.isHost && (
                        <Pressable
                          onPress={() => confirmRemoveLeader(m.userId)}
                          hitSlop={6}
                          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                        >
                          <Text style={styles.removeLeaderText}>Remove</Text>
                        </Pressable>
                      )}
                      {m.consentStatus === 'joined' && (
                        <View style={[styles.consent, styles.consentJoined]}>
                          <CheckMini /><Text style={styles.consentTextJoined}>Joined</Text>
                        </View>
                      )}
                      {m.consentStatus === 'declined' && (
                        <View style={[styles.consent, styles.consentDeclined]}>
                          <XMini /><Text style={styles.consentTextDeclined}>Declined</Text>
                        </View>
                      )}
                      {m.consentStatus === 'invited' && (
                        <View style={styles.consent}>
                          <Text style={styles.consentTextInvited}>Invited</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
          )}
          {callerIsHost && (
            <>
              <Pressable
                onPress={promptRename}
                style={({ pressed }) => [styles.sheetActionRename, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sheetActionRenameText}>Rename branch</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [styles.sheetActionDelete, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sheetActionDeleteText}>Delete branch</Text>
              </Pressable>
            </>
          )}
          {!callerIsHost && (
            <Pressable
              onPress={confirmLeave}
              style={({ pressed }) => [styles.sheetActionLeave, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.sheetActionLeaveText}>Leave this branch</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.sheetClose, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.sheetCloseText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── tallies (decline cascade) ────────────────────────────────────────
function findFullyDeclinedMinistry(members: BranchMember[]): { ministryId: string; name: string } | null {
  // Group, return the first ministry where all leaders have declined
  // AND the ministry is not the host's (the host ministry can't be
  // declined out of its own branch).
  const byMinistry = new Map<string, BranchMember[]>();
  members.forEach((m) => {
    if (!byMinistry.has(m.ministryId)) byMinistry.set(m.ministryId, []);
    byMinistry.get(m.ministryId)!.push(m);
  });
  for (const [mid, list] of byMinistry.entries()) {
    const isHost = list.some((m) => m.isHost);
    if (isHost) continue;
    if (list.length > 0 && list.every((m) => m.consentStatus === 'declined')) {
      return { ministryId: mid, name: list[0].ministryName };
    }
  }
  return null;
}

function computeTally(members: BranchMember[]) {
  let joined = 0, declined = 0, pending = 0;
  members.forEach((m) => {
    if (m.consentStatus === 'joined') joined++;
    else if (m.consentStatus === 'declined') declined++;
    else pending++;
  });
  return { joined, declined, pending, total: members.length };
}

// ── main ─────────────────────────────────────────────────────────────
export default function BranchThreadView({ branchId, callerUserId, onBack, onSwipeBack }: Props) {
  const { session } = useAuth();
  const [summary, setSummary] = useState<BranchSummary | null>(null);
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [messages, setMessages] = useState<BranchMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [draft, setDraft] = useState('');
  const [composerHeight, setComposerHeight] = useState(MIN_COMPOSER_HEIGHT);
  const [showMembers, setShowMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [resolvedDecline, setResolvedDecline] = useState(false);
  // Fix 8 (KAN-68 §15.3) — same anticipatory popover as DMThreadView.
  const [attachPopoverVisible, setAttachPopoverVisible] = useState(false);
  useEffect(() => {
    if (attachPopoverVisible && draft.length > 0) {
      setAttachPopoverVisible(false);
    }
  }, [draft, attachPopoverVisible]);
  const messagesRef = useRef<BranchMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const memberByUserId = useMemo(() => {
    const m = new Map<string, BranchMember>();
    members.forEach((bm) => m.set(bm.userId, bm));
    return m;
  }, [members]);

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

  const hostMinistryId = useMemo(() => {
    return members.find((m) => m.isHost)?.ministryId ?? null;
  }, [members]);

  const callerIsHost = useMemo(() => {
    return !!members.find((m) => m.userId === callerUserId && m.isHost);
  }, [members, callerUserId]);

  const fullyDeclinedMinistry = useMemo(() => {
    if (resolvedDecline) return null;
    if (!callerIsHost) return null;
    if (summary?.status !== 'forming') return null;
    return findFullyDeclinedMinistry(members);
  }, [members, callerIsHost, summary?.status, resolvedDecline]);

  const tally = useMemo(() => {
    const t = computeTally(members);
    if (members.length === 0 && summary) {
      return { ...t, total: summary.memberCount, pending: summary.memberCount };
    }
    return t;
  }, [members, summary]);

  // ── Load members + summary (refetch via Realtime + after actions) ─
  const loadMembersAndSummary = useCallback(async () => {
    const [memRes, listRes] = await Promise.all([
      supabase.rpc('get_branch_members', { p_branch_id: branchId }),
      supabase.rpc('get_branch_list'),
    ]);
    if (memRes.error) {
      console.error('[BranchThreadView] get_branch_members failed:', memRes.error.message, memRes.error.details);
      setMembersError(memRes.error.message ?? 'Failed to load members');
    } else {
      setMembersError(null);
    }
    const mapped: BranchMember[] = (memRes.data ?? []).map((r: any) => {
      const fullName: string = r.full_name ?? '';
      const [first = '', ...rest] = fullName.split(' ');
      const display = getLeaderDisplayName({
        firstName: first,
        lastName: rest.join(' '),
        roleLabel: getRoleLabel(r.role),
        churchName: r.ministry_name ?? '',
        anonymous: !!r.anonymous,
      });
      return {
        userId: r.user_id,
        ministryId: r.ministry_id,
        ministryName: r.ministry_name ?? '',
        fullName,
        displayName: display,
        role: r.role ?? null,
        anonymous: !!r.anonymous,
        isHost: !!r.is_host,
        consentStatus: r.consent_status,
      };
    });
    setMembers(mapped);
    const summaryRow = (listRes.data ?? []).find((r: any) => r.branch_id === branchId);
    if (summaryRow) {
      setSummary({
        name: summaryRow.name,
        status: summaryRow.status,
        ministryCount: Number(summaryRow.ministry_count) || 0,
        memberCount: Number(summaryRow.member_count) || 0,
      });
    }
  }, [branchId]);

  useEffect(() => { void loadMembersAndSummary(); }, [loadMembersAndSummary]);

  // ── Branch member action handlers (KAN-69) ────────────────────────
  const handleLeave = useCallback(async () => {
    const { error } = await supabase.rpc('leave_branch', { p_branch_id: branchId });
    if (error) {
      Alert.alert('Error', "Couldn't leave the branch. Try again.");
      return;
    }
    onBack();
  }, [branchId, onBack]);

  const handleRemoveLeader = useCallback(async (userId: string) => {
    const { error } = await supabase.rpc('remove_branch_leader', {
      p_branch_id: branchId,
      p_user_id: userId,
    });
    if (error) {
      Alert.alert('Error', "Couldn't remove that leader. Try again.");
      return;
    }
    loadMembersAndSummary();
  }, [branchId, loadMembersAndSummary]);

  const handleRemoveMinistry = useCallback(async (ministryId: string) => {
    const { error } = await supabase.rpc('remove_ministry_from_branch', {
      p_branch_id: branchId,
      p_ministry_id: ministryId,
    });
    if (error) {
      Alert.alert('Error', "Couldn't remove that ministry. Try again.");
      return;
    }
    loadMembersAndSummary();
  }, [branchId, loadMembersAndSummary]);

  const handleEditName = useCallback(async (newName: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase.rpc('edit_branch_name', {
      p_branch_id: branchId,
      p_name: newName.trim(),
    });
    if (error) {
      Alert.alert('Error', "Couldn't rename the branch. Try again.");
      return;
    }
    loadMembersAndSummary();
  }, [branchId, loadMembersAndSummary]);

  const handleDeleteBranch = useCallback(async () => {
    const { error } = await supabase.rpc('delete_branch', { p_branch_id: branchId });
    if (error) {
      Alert.alert('Error', "Couldn't delete the branch. Try again.");
      return;
    }
    onBack();
  }, [branchId, onBack]);

  // ── Load initial messages page (only when joined+active OR forming
  // with caller=joined-host; get_branch_messages will 403 otherwise). ─
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase.rpc('get_branch_messages', {
        p_branch_id: branchId,
      });
      if (cancelled) return;
      if (error || !data) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }
      const ordered: BranchMessage[] = (data as any[])
        .map((m) => ({
          id: m.message_id,
          // System messages are never "mine" regardless of caller.
          mine: m.sender_id !== BRANCH_SYSTEM_USER_ID && m.sender_id === callerUserId,
          senderId: m.sender_id,
          text: m.content,
          createdAt: new Date(m.created_at),
          isSystem: m.sender_id === BRANCH_SYSTEM_USER_ID,
        }))
        .reverse(); // RPC returns newest-first; flip to oldest-first.
      setMessages(assignGroupLabels(ordered));
      setExhausted(ordered.length < PAGE_SIZE);
      setLoadingMessages(false);
      // Mark the branch read on initial open. Fire-and-forget — a
      // mark-read failure must NEVER block the thread render. The
      // RPC raises 'not_authorized' if the caller isn't a member
      // (e.g. opening a forming branch as an 'invited' member who
      // hasn't joined yet). We swallow it because the surface still
      // renders fine for non-joined members; they just won't have
      // a last_read_at cursor written, which is correct — they
      // aren't reading anything yet.
      void supabase.rpc('mark_branch_read', { p_branch_id: branchId })
        .then(() => undefined, () => undefined);
    })();
    return () => { cancelled = true; };
  }, [branchId, callerUserId]);

  // ── Realtime: messages (branch_id filter) + branch_members (consent) ─
  useEffect(() => {
    if (!branchId) return;
    const messagesCh = supabase
      .channel(`branch-msgs-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          const incoming: BranchMessage = {
            id: row.id,
            mine: row.sender_id !== BRANCH_SYSTEM_USER_ID && row.sender_id === callerUserId,
            senderId: row.sender_id,
            text: row.content,
            createdAt: new Date(row.created_at),
            isSystem: row.sender_id === BRANCH_SYSTEM_USER_ID,
          };
          if (messagesRef.current.some((m) => m.id === incoming.id)) return;
          const next = [...messagesRef.current, incoming].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
          setMessages(assignGroupLabels(next));
          // Caller is actively viewing this branch when an inbound
          // message lands — bump branch_members.last_read_at so the
          // badge clears on the next get_branch_list snapshot. Skip
          // own-message echoes (no read state change). Fire-and-forget.
          if (!incoming.mine) {
            void supabase.rpc('mark_branch_read', { p_branch_id: branchId })
              .then(() => undefined, () => undefined);
          }
        },
      )
      .subscribe();
    const membersCh = supabase
      .channel(`branch-members-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branch_members',
          filter: `branch_id=eq.${branchId}`,
        },
        () => { void loadMembersAndSummary(); },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(messagesCh);
      void supabase.removeChannel(membersCh);
    };
  }, [branchId, callerUserId, loadMembersAndSummary]);

  // ── Load older ────────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (!branchId || loadingOlder || exhausted) return;
    const cursor = messages[0]?.createdAt;
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const { data } = await supabase.rpc('get_branch_messages', {
        p_branch_id: branchId,
        p_before: cursor.toISOString(),
      });
      if (!data || (data as any[]).length === 0) {
        setExhausted(true);
        return;
      }
      const older: BranchMessage[] = (data as any[]).map((m) => ({
        id: m.message_id,
        mine: m.sender_id !== BRANCH_SYSTEM_USER_ID && m.sender_id === callerUserId,
        senderId: m.sender_id,
        text: m.content,
        createdAt: new Date(m.created_at),
        isSystem: m.sender_id === BRANCH_SYSTEM_USER_ID,
      })).reverse();
      setMessages(assignGroupLabels([...older, ...messages]));
      if ((data as any[]).length < PAGE_SIZE) setExhausted(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [branchId, callerUserId, messages, loadingOlder, exhausted]);

  // ── Send (branch path — different edge function!) ─────────────────
  const sendNow = useCallback(async (text: string) => {
    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: BranchMessage = {
      id: optId,
      mine: true,
      senderId: callerUserId ?? '',
      text,
      createdAt: new Date(),
      state: 'pending',
    };
    setMessages((prev) => assignGroupLabels([...prev, optimistic]));
    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('no_session');
      // CRITICAL: this calls send-branch-message (KAN-214), NOT
      // send-message (KAN-71). The two edge functions are isolated by
      // design — see KAN-214 OQ-3 ruling.
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-branch-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ branch_id: branchId, content: text }),
      });
      if (!res.ok) throw new Error(`send_failed_${res.status}`);
      // DELIVER-ALWAYS: we do NOT read the response's `flagged` field.
      // The leader's UI is identical regardless of moderation outcome.
      const result = await res.json() as { success: true; message_id: string; branch_id: string };
      setMessages((prev) =>
        assignGroupLabels(prev.map((m) =>
          m.id === optId
            ? { ...m, id: result.message_id, state: 'sent' }
            : m,
        )),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optId ? { ...m, state: 'failed' } : m),
      );
    }
  }, [session?.access_token, branchId, callerUserId]);

  const attemptSend = useCallback(() => {
    if (summary?.status !== 'active') return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setComposerHeight(42);
    void sendNow(text);
  }, [draft, sendNow, summary?.status]);

  const retry = useCallback((optId: string) => {
    const failed = messagesRef.current.find((m) => m.id === optId);
    if (!failed) return;
    setMessages((prev) => prev.map((m) => m.id === optId ? { ...m, state: 'pending' } : m));
    void (async () => {
      try {
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error('no_session');
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-branch-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ branch_id: branchId, content: failed.text }),
        });
        if (!res.ok) throw new Error('retry_failed');
        const result = await res.json() as { message_id: string };
        setMessages((prev) =>
          assignGroupLabels(prev.map((m) =>
            m.id === optId ? { ...m, id: result.message_id, state: 'sent' } : m,
          )),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => m.id === optId ? { ...m, state: 'failed' } : m),
        );
      }
    })();
  }, [session?.access_token, branchId]);

  const handleAttach = () => {
    setAttachPopoverVisible((v) => !v);
  };

  const continueWithout = useCallback(async () => {
    if (!fullyDeclinedMinistry) return;
    try {
      const { error } = await supabase.rpc('remove_ministry_from_branch', {
        p_branch_id: branchId,
        p_ministry_id: fullyDeclinedMinistry.ministryId,
      });
      if (error) {
        Alert.alert('', "Couldn't update the branch. Try again.");
        return;
      }
      setResolvedDecline(true);
      await loadMembersAndSummary();
    } catch {
      Alert.alert('', "Couldn't update the branch. Try again.");
    }
  }, [branchId, fullyDeclinedMinistry, loadMembersAndSummary]);

  const displayData = useMemo(() => [...messages].reverse(), [messages]);
  const canSend = summary?.status === 'active' && draft.trim().length > 0;
  const forming = summary?.status === 'forming';

  return (
    <View style={styles.root} {...swipePanResponder.panHandlers}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <View style={styles.branchHeadIcon}><BranchGlyph color={Colors.accent} /></View>
        <View style={styles.who}>
          <Text style={styles.whoName} numberOfLines={1}>{summary?.name ?? '…'}</Text>
          {summary && (
            <Text style={styles.whoSub}>
              {summary.ministryCount} ministries · {summary.memberCount} leaders
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => setShowMembers(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Members"
        >
          <UsersIcon />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          inverted
          data={displayData}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {forming && (
                <View style={styles.formingBanner}>
                  <Text style={styles.formingTitle}>Forming this branch</Text>
                  <Text style={styles.formingBody}>
                    {members.length === 0 && !membersError
                      ? 'Loading member status…'
                      : membersError
                        ? 'Could not load member status. Pull down or tap ↑ to retry.'
                        : tally.declined > 0
                          ? `${tally.joined} of ${tally.total} joined · ${tally.declined} declined. ${tally.pending} still to consent.`
                          : `${tally.joined} of ${tally.total} leaders have joined. Messages open once every leader accepts — ${tally.pending} still to consent.`}
                  </Text>
                </View>
              )}
              {fullyDeclinedMinistry && (
                <View style={styles.declinePrompt}>
                  <Text style={styles.declineTitle}>
                    {fullyDeclinedMinistry.name} declined this branch.
                  </Text>
                  <Text style={styles.declineBody}>
                    Their leaders chose not to join. You can continue forming
                    the branch without them — no harm, no foul.
                  </Text>
                  <View style={styles.declineActions}>
                    <Pressable onPress={onBack}
                      style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.btnGhostText}>Cancel branch</Text>
                    </Pressable>
                    <Pressable onPress={continueWithout}
                      style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.btnPrimaryText}>Continue without them</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.isSystem) {
              return (
                <View>
                  <SystemNotice text={item.text} />
                  {item.groupLabel && (
                    <Text style={styles.tsDivider}>{item.groupLabel.toUpperCase()}</Text>
                  )}
                </View>
              );
            }
            const member = memberByUserId.get(item.senderId) ?? null;
            const nextOlder = displayData[index + 1];
            const prevSameSender = !!nextOlder
              && nextOlder.senderId === item.senderId
              && !item.groupLabel;
            return (
              <View>
                <GroupBubble
                  msg={item}
                  member={member}
                  prevSameSender={prevSameSender}
                  onRetry={retry}
                />
                {item.groupLabel && (
                  <Text style={styles.tsDivider}>{item.groupLabel.toUpperCase()}</Text>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            loadingMessages
              ? <View style={styles.loadingOlder}><ActivityIndicator color={Colors.textSubtle} /></View>
              : loadingOlder
                ? <View style={styles.loadingOlder}>
                    <ActivityIndicator color={Colors.textSubtle} />
                    <Text style={styles.loadingOlderText}>Loading earlier</Text>
                  </View>
                : exhausted && messages.length > 0
                  ? <Text style={styles.historyTop}>Beginning of conversation</Text>
                  : null
          }
        />

        <CovenantStrip />

        {forming ? (
          <View style={[styles.composer, styles.composerLocked]}>
            <Text style={styles.lockedNote}>Messaging opens once everyone has joined</Text>
            <View style={[styles.send, styles.sendDisabled]}>
              <SendIcon color={Colors.textSubtle} />
            </View>
          </View>
        ) : (
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
              placeholder="Message the branch"
              placeholderTextColor={Colors.textSubtle}
              multiline
              scrollEnabled
              onContentSizeChange={(e) => {
                const h = Math.min(MAX_COMPOSER_HEIGHT, Math.max(MIN_COMPOSER_HEIGHT, e.nativeEvent.contentSize.height + 12));
                setComposerHeight(h);
              }}
            />
            <Pressable
              onPress={attemptSend}
              disabled={!canSend}
              style={[styles.send, canSend ? styles.sendActive : styles.sendDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <SendIcon color={canSend ? '#07232f' : Colors.textSubtle} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <MembersSheet
        visible={showMembers}
        branchName={summary?.name ?? ''}
        ministryCount={summary?.ministryCount ?? 0}
        memberCount={summary?.memberCount ?? 0}
        members={members}
        membersError={membersError}
        onRetryMembers={loadMembersAndSummary}
        hostMinistryId={hostMinistryId}
        onClose={() => setShowMembers(false)}
        callerUserId={callerUserId}
        callerIsHost={callerIsHost}
        branchId={branchId}
        onLeave={handleLeave}
        onRemoveLeader={handleRemoveLeader}
        onRemoveMinistry={handleRemoveMinistry}
        onEditName={handleEditName}
        onDeleteBranch={handleDeleteBranch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  head: {
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: 'rgba(8,8,8,0.92)',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchHeadIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(107,181,232,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  who: { flex: 1, minWidth: 0 },
  whoName: {
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    color: Colors.text,
  },
  whoSub: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    color: Colors.accent,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  body: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  // ── forming banner ──
  formingBanner: {
    marginHorizontal: -4,
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(212,168,85,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(212,168,85,0.35)',
    borderRadius: 12,
  },
  formingTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    color: Colors.amber,
    marginBottom: 4,
  },
  formingBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  // ── decline prompt ──
  declinePrompt: {
    marginHorizontal: -4,
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(224,85,85,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    borderRadius: 12,
  },
  declineTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 17,
    color: Colors.red,
    marginBottom: 4,
  },
  declineBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  declineActions: { flexDirection: 'row', gap: 8 },
  btnGhost: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  btnPrimary: {
    flex: 1.4,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: '#07232f',
    letterSpacing: 0.3,
  },
  // ── author label ──
  authorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  authorName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    color: Colors.accent,
  },
  authorMin: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.68, // 0.08em × 8.5
    color: Colors.textMuted,
  },
  // ── bubbles ──
  bubbleRow: { flexDirection: 'row' },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowRecv: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingVertical: 11, paddingHorizontal: 15 },
  bubbleSent: { backgroundColor: Colors.accent },
  bubbleRecv: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  bubblePending: { opacity: 0.55 },
  bubbleFailed: { borderWidth: 0.5, borderColor: 'rgba(224,85,85,0.30)' },
  bubbleText: { fontFamily: Typography.body, fontSize: 14.5, lineHeight: 22, color: Colors.text },
  bubbleTextSent: { fontFamily: Typography.body, fontSize: 14.5, lineHeight: 22, color: '#07232f' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusRowSent: { justifyContent: 'flex-end' },
  statusPending: { fontFamily: Typography.mono, fontSize: 8.5, color: Colors.textSubtle },
  statusFailed: { fontFamily: Typography.mono, fontSize: 8.5, color: Colors.red },
  // ── ts divider ──
  tsDivider: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  // ── system notice (branch-join consent record) ──
  systemNotice: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  systemNoticeText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textAlign: 'center',
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
  },
  historyTop: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textSubtle,
    textAlign: 'center',
    paddingVertical: 18,
  },
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
  composerLocked: { alignItems: 'center' },
  // connect-polish-3 Fix B: parameterized to MIN_COMPOSER_HEIGHT /
  // COMPOSER_BUTTON_SIZE so future tweaks land at one anchor.
  attach: { width: COMPOSER_BUTTON_SIZE, height: COMPOSER_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  attachWrap: { position: 'relative' },
  field: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: MIN_COMPOSER_HEIGHT / 2,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: Colors.text,
  },
  lockedNote: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  send: { width: COMPOSER_BUTTON_SIZE, height: COMPOSER_BUTTON_SIZE, borderRadius: COMPOSER_BUTTON_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  sendActive: { backgroundColor: Colors.accent },
  sendDisabled: { backgroundColor: Colors.surfaceElevated },
  // ── members sheet ──
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,4,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '76%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetGrab: {
    alignSelf: 'center',
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(240,237,230,0.20)',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    color: Colors.text,
  },
  sheetSub: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: Colors.accent,
    marginTop: 4,
  },
  ministryBlock: {
    marginTop: 16,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  ministryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ministryName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13.5,
    color: Colors.text,
  },
  youTag: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.28,
    color: Colors.accent,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  memberLeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  mlName: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    minWidth: 0,
    marginRight: 8,
  },
  consent: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(240,237,230,0.04)',
  },
  consentJoined: { backgroundColor: 'rgba(91,173,122,0.10)' },
  consentDeclined: { backgroundColor: 'rgba(224,85,85,0.10)' },
  consentTextJoined: { fontFamily: Typography.mono, fontSize: 10, color: Colors.green, letterSpacing: 0.3 },
  consentTextDeclined: { fontFamily: Typography.mono, fontSize: 10, color: Colors.red, letterSpacing: 0.3 },
  consentTextInvited: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.3 },
  retryRow: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  retryText: { fontFamily: Typography.mono, fontSize: 10.5, color: Colors.accent, letterSpacing: 0.4 },
  sheetClose: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
  },
  sheetCloseText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  // ── host admin + leave actions in MembersSheet ──
  removeMinistryText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.red,
    textAlign: 'right',
  },
  removeLeaderText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.red,
    marginRight: 6,
  },
  sheetActionRename: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetActionRenameText: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    color: Colors.accent,
    textAlign: 'center',
  },
  sheetActionDelete: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetActionDeleteText: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    color: Colors.red,
    textAlign: 'center',
  },
  sheetActionLeave: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetActionLeaveText: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    color: Colors.red,
    textAlign: 'center',
  },
});

// Re-exports for the host screen to render the same time helper.
export { formatMessageTime };
