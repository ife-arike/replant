// ─────────────────────────────────────────────
// SubmissionsView — My Submissions (§F). Four honest states. A declined
// word never hides its reason. This list is the ONLY place the workflow
// lives; the Replant Team chat thread carries none of it.
//
//   In review      calm/neutral, withdrawable
//   Edits proposed  amber, the only actionable row → opens the review screen
//   Live            green, links to the Home feed
//   Declined        red (soft), reason always visible, withdrawable
// ─────────────────────────────────────────────

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { LockIcon } from './icons';
import { monthDay, peek, relativeDays } from './format';
import { OPEN_CAP, TYPE_LABEL, type Submission, type SubmissionStatus } from './types';
import {
  AMBER_BG,
  AMBER_BORDER,
  AMBER_CARD_BG,
  AMBER_CARD_BORDER,
  GREEN_BG,
  GREEN_BORDER,
  RED_BG,
  RED_BORDER,
  RED_REASON_BG,
  RED_REASON_BORDER,
  REVIEW_BG,
} from './tokens';

interface Props {
  submissions: Submission[];
  openCount: number;
  onWithdraw: (id: string) => void;
  onOpenReview: (submission: Submission) => void;
  onViewLive: (submission: Submission) => void;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  in_review: 'In review',
  edits_proposed: 'Edits proposed',
  live: 'Live',
  declined: 'Declined',
};

function confirmWithdraw(onConfirm: () => void) {
  Alert.alert(
    'Withdraw this submission?',
    'It will be removed and a slot will free up. You can always share again.',
    [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: onConfirm },
    ],
    { cancelable: true },
  );
}

export default function SubmissionsView({
  submissions,
  openCount,
  onWithdraw,
  onOpenReview,
  onViewLive,
}: Props) {
  const atCap = openCount >= OPEN_CAP;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={styles.headLabel}>My Submissions</Text>
        <View style={styles.count}>
          {atCap ? <LockIcon size={11} color={Colors.text} /> : null}
          <Text style={[styles.countText, atCap && styles.countTextFull]}>
            {openCount} of {OPEN_CAP} open
          </Text>
        </View>
      </View>

      {submissions.length === 0 ? (
        <Text style={styles.empty}>
          Nothing here yet. When you share a word, it appears here while the team
          reads it.
        </Text>
      ) : (
        <View style={styles.list}>
          {submissions.map((s) => (
            <Row
              key={s.id}
              submission={s}
              onWithdraw={() => confirmWithdraw(() => onWithdraw(s.id))}
              onOpenReview={() => onOpenReview(s)}
              onViewLive={() => onViewLive(s)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  submission: s,
  onWithdraw,
  onOpenReview,
  onViewLive,
}: {
  submission: Submission;
  onWithdraw: () => void;
  onOpenReview: () => void;
  onViewLive: () => void;
}) {
  const isEdits = s.status === 'edits_proposed';
  const showPeek = s.status !== 'declined';
  const showReason = s.status === 'declined';

  const inner = (
    <>
      <View style={styles.rowTop}>
        <Text style={styles.kind}>{TYPE_LABEL[s.type]}</Text>
        <StatusPill status={s.status} />
      </View>

      {s.title ? <Text style={styles.title}>{s.title}</Text> : null}
      {showPeek ? <Text style={styles.peek}>{peek(s.body)}</Text> : null}

      {showReason ? (
        <View style={styles.reason}>
          <Text style={styles.reasonLabel}>Why the team held this</Text>
          <Text style={styles.reasonText}>{s.declineReason}</Text>
        </View>
      ) : null}

      <View style={styles.foot}>
        <Text style={styles.when}>{footWhen(s)}</Text>
        {s.status === 'edits_proposed' ? (
          <Text style={[styles.cta, styles.ctaEdits]}>Read the team&apos;s edits →</Text>
        ) : s.status === 'live' ? (
          <Pressable onPress={onViewLive} hitSlop={8} accessibilityRole="link">
            <Text style={[styles.cta, styles.ctaLive]}>View →</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onWithdraw} hitSlop={8} accessibilityRole="button">
            <Text style={styles.withdraw}>Withdraw</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  if (isEdits) {
    return (
      <Pressable
        onPress={onOpenReview}
        accessibilityRole="button"
        accessibilityLabel={`${TYPE_LABEL[s.type]}. Edits proposed. Read the team's edits.`}
        style={[styles.card, styles.cardEdits]}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.card}>{inner}</View>;
}

function footWhen(s: Submission): string {
  switch (s.status) {
    case 'in_review':
      return `Sent ${relativeDays(s.createdAt)}`;
    case 'edits_proposed':
      return `Updated ${relativeDays(s.updatedAt)}`;
    case 'live':
      return `Live since ${monthDay(s.liveSince ?? s.updatedAt)} · Home feed`;
    case 'declined':
      return monthDay(s.updatedAt || s.createdAt);
  }
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const tint = PILL_TINT[status];
  return (
    <View style={[styles.pill, { borderColor: tint.border, backgroundColor: tint.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: tint.dot }]} />
      <Text style={[styles.pillText, { color: tint.dot }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const PILL_TINT: Record<SubmissionStatus, { dot: string; bg: string; border: string }> = {
  in_review: { dot: Colors.textMuted, bg: REVIEW_BG, border: Colors.border },
  edits_proposed: { dot: Colors.amber, bg: AMBER_BG, border: AMBER_BORDER },
  live: { dot: Colors.green, bg: GREEN_BG, border: GREEN_BORDER },
  declined: { dot: Colors.red, bg: RED_BG, border: RED_BORDER },
};

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  headLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.78, // 0.06em × 13
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.0, // 0.10em × 10
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  countTextFull: { color: Colors.text },

  empty: {
    fontFamily: Typography.sansLight,
    fontSize: 13.5,
    lineHeight: 22,
    color: Colors.textMuted,
    paddingTop: 6,
  },

  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    gap: 11,
  },
  cardEdits: {
    borderColor: AMBER_CARD_BORDER,
    backgroundColor: AMBER_CARD_BG,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kind: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26, // 0.14em × 9
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
  title: {
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    lineHeight: 23, // 1.25 × 18
    color: Colors.text,
  },
  peek: {
    fontFamily: Typography.sansLight,
    fontSize: 12.5,
    lineHeight: 19, // 1.55 × 12.5
    color: Colors.textMuted,
  },
  reason: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: RED_REASON_BG,
    borderWidth: 0.5,
    borderColor: RED_REASON_BORDER,
    borderRadius: 9,
    gap: 7,
  },
  reasonLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.19, // 0.14em × 8.5
    textTransform: 'uppercase',
    color: Colors.red,
  },
  reasonText: {
    fontFamily: Typography.sansLight,
    fontSize: 12.5,
    lineHeight: 20, // 1.6 × 12.5
    color: Colors.textMuted,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 11,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  when: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.48, // 0.05em × 9.5
    color: Colors.textSubtle,
  },
  cta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
  },
  ctaEdits: { color: Colors.amber },
  ctaLive: { color: Colors.accent },
  withdraw: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 9,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.08, // 0.12em × 9
    textTransform: 'uppercase',
  },
});
