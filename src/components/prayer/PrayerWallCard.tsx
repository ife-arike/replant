// ─────────────────────────────────────────────
// PrayerWallCard — KAN-23
//
// One prayer request card on the Prayer Wall feed. Left-border colour
// distinguishes urgent (Colors.red) from standard (Colors.accent /
// sky). Border-radius is asymmetric so the 2px left edge reads as a
// flag, not a rounded box:
//
//   ┌────────────────────────────────────────────────┐
//   │ Church Name (Type) · Country                   │  Row 1 — identity
//   │ {leader_display_name OR "A fellow leader"}     │  Row 1b — attribution
//   │ ─ 6 px ─                                       │
//   │ Full prayer text — no truncation               │  Row 2 — body
//   │ ─ 8 px ─                                       │
//   │ [Category]  [Urgent]  1h ago                   │  Row 3 — meta
//   └────────────────────────────────────────────────┘
//
// Underground rows arrive with church_name='Underground Church' and
// country=NULL per the RPC's CASE WHEN c.type='underground' branch —
// getLocationLine omits the " · null" tail. Anonymous rows arrive with
// leader_display_name=NULL — getLeaderLine emits "A fellow leader".
// Both masks are RPC-enforced; the FE just trusts the wire shape.
//
// Sizing per dispatch (CD Pro Max baseline). paddingVertical 8,
// paddingHorizontal 10, card margin-bottom is owned by the parent
// FlatList's ItemSeparatorComponent.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { getChurchTypeLabel } from '../../utils/displayHelpers';
import {
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  type PrayerRow,
} from './PrayerWallLogic';

interface Props {
  row: PrayerRow;
  /** Injectable for tests / pinned clock. Production gets `new Date()`. */
  now?: Date;
}

export default function PrayerWallCard({ row, now }: Props) {
  const churchTypeLabel = getChurchTypeLabel(row.church_type);
  const locationLine = getLocationLine(
    `${row.church_name} (${churchTypeLabel})`,
    row.country,
  );
  const leaderLine = getLeaderLine(row.leader_display_name);
  const timestamp = formatRelativeTime(row.created_at, now);

  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: row.urgency ? Colors.red : Colors.accent },
      ]}
    >
      <Text style={styles.location} numberOfLines={2}>{locationLine}</Text>
      <Text style={styles.leader} numberOfLines={1}>{leaderLine}</Text>
      <Text style={styles.body}>{row.prayer_text}</Text>
      <View style={styles.metaRow}>
        {row.category ? (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{row.category}</Text>
          </View>
        ) : null}
        {row.urgency ? (
          <View style={styles.urgentChip}>
            <Text style={styles.urgentChipText}>Urgent</Text>
          </View>
        ) : null}
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 2,
    // Asymmetric radius — flag edge on the left, rounded on the right.
    // Values per dispatch card anatomy.
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  location: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  leader: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 1,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 20,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.30)',
  },
  categoryChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  urgentChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.30)',
  },
  urgentChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.red,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
