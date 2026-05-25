// ─────────────────────────────────────────────
// PrayerWallCard — KAN-23 v2 (Ticket B)
//
// Feed-row card for one prayer request. The card itself is a Pressable
// that surfaces a tap to the parent (which opens PrayerWallDetailSheet
// over the feed). The heart count display in the meta row is NOT
// tappable — it's a passive indicator. The actual "stand in the gap"
// affordance lives inside the detail sheet, where the leader has
// confirmation context. This separation is locked by the dispatch:
//   "Card heart on feed cards is display-only. Not a Pressable. Not
//   tappable. The press happens only inside the detail sheet."
//
//   ┌────────────────────────────────────────────────┐
//   │ Church Name (Type) · Country                   │  Row 1 — identity
//   │ {leader_display_name OR "A fellow leader"}     │  Row 1b — attribution
//   │ Full prayer text — clamped to 3 lines …      › │  Row 2 — body + chevron
//   │ [Category]  [Urgent]  ♥ 12   1h ago            │  Row 3 — meta
//   └────────────────────────────────────────────────┘
//
// Body is 3-line clamped (was unclamped in v1) — fix this. Chevron sits
// on the far right of the body row to telegraph "tap to expand". The
// heart is the icon-and-count in the meta row, NOT a button.
//
// Underground rows arrive from the RPC with church_name='Underground
// Church' and country=null; the FE trusts and renders what's on the
// wire. Anonymous rows have leader_display_name=null and render under
// ANONYMOUS_LEADER_LABEL. Both masks are RPC-enforced.
//
// Left-border colour: urgency=true → Colors.red; otherwise Colors.accent.
// status='answered' is a future state — RPC scopes the feed to 'open'
// today, so we never see other values here.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import {
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  type PrayerRow,
} from './PrayerWallLogic';
import { ChevronRightIcon, HeartIcon } from './PrayerIcons';

interface Props {
  row: PrayerRow;
  /** Tap on the card opens the detail sheet. Owned by the parent screen. */
  onPress: (row: PrayerRow) => void;
  /** Injectable for tests / pinned clock. Production gets `new Date()`. */
  now?: Date;
}

export default function PrayerWallCard({ row, onPress, now }: Props) {
  // KAN-23 corrections r1 — church type removed from card header per
  // dispatch. Identity is church name + country only (underground
  // collapses to church name alone via getLocationLine's null-country
  // branch). Type still exposed on the wire for other consumers; we
  // just don't surface it here.
  const locationLine = getLocationLine(row.church_name, row.country);
  const leaderLine = getLeaderLine(row.leader_display_name);
  const timestamp = formatRelativeTime(row.created_at, now);

  return (
    <Pressable
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={`Open prayer request from ${row.church_name}`}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: row.urgency ? Colors.red : Colors.accent },
        pressed && styles.cardPressed,
      ]}
    >
      <Text style={styles.location} numberOfLines={2}>{locationLine}</Text>
      <Text style={styles.leader} numberOfLines={1}>{leaderLine}</Text>

      <View style={styles.bodyRow}>
        <Text style={styles.body} numberOfLines={3}>
          {row.prayer_text}
        </Text>
        <View style={styles.chevronWrap}>
          <ChevronRightIcon size={14} color={Colors.textMuted} />
        </View>
      </View>

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

        {/* Heart count — display only. NOT a Pressable. The press path
            for stand-in-the-gap lives inside PrayerWallDetailSheet. */}
        <View style={styles.heartDisplay} accessible accessibilityLabel={`${row.prayed_count} prayed`}>
          <HeartIcon size={12} color={row.i_prayed ? Colors.red : Colors.textMuted} filled={row.i_prayed} />
          <Text style={styles.heartCount}>{row.prayed_count}</Text>
        </View>

        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // v5 item 04 — card padding 8/10 → 14/16.
    backgroundColor: Colors.surface,
    borderLeftWidth: 2,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardPressed: {
    opacity: 0.85,
  },
  location: {
    // v5 item 04 — church name 16 pt DM Sans 400 (dispatch said
    // unchanged; build was 13; redline locks 16).
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 21,
  },
  leader: {
    // v5 item 04 — author 13 pt DM Sans 300, rgba(text, 0.45),
    // marginTop 2, marginBottom 12 (the header → body gap).
    // No DM Sans 300 in bundle; using Typography.body (400).
    fontFamily: Typography.body,
    fontSize: 13,
    color: 'rgba(240, 237, 230, 0.45)',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 12,
  },
  bodyRow: {
    // marginTop removed — the leader's marginBottom now owns the gap
    // (v5 item 04 — 6 pt → 12 pt).
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    // v5 item 04 — body Cormorant italic 300 at 16 pt, line-height 1.6,
    // colour --text. Bundle has no italic 300; using displayMediumItalic.
    flex: 1,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
  },
  chevronWrap: {
    paddingLeft: 8,
    paddingTop: 2,
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
  heartDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  heartCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  timestamp: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
