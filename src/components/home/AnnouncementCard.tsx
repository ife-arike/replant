// ─────────────────────────────────────────────
// AnnouncementCard — KAN-17 AC #2, #3, #10, #12
//
// Read-only card for one announcement on Home. Layout follows wireframe
// v4 lines 1086-1106 (the "Network Updates" card cluster):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ Title (Cormorant 500 Medium)            [Tag chip if any]│
//   │ Body text — rendered in full, no truncation. URLs render │
//   │ as plain text per AC #12.                                │
//   │ Replant Team · 2h ago · Operations                       │
//   └──────────────────────────────────────────────────────────┘
//
// D-56 locked: author attribution is the constant "Replant Team" — the
// DB `author_id` is retained for audit but NEVER surfaces to app users.
// The footer line composes: attribution · relative-timestamp · source-
// label (when set). No like / comment / share / bookmark (AC #10).
//
// KAN-201 v3 (2026-05-22): truncation + expand affordance removed.
// Cards always render the body in full. v1 had an always-on "Read more"
// (broken gate), v2 added onTextLayout-detected truncation with a
// chevron — v3 removes the entire feature. A very-long-body
// affordance is deferred to a future ticket; the network feed presents
// each announcement whole, in line with a small ministry-network volume.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';
import AnnouncementTagChip from './AnnouncementTagChip';
import {
  AUTHOR_ATTRIBUTION,
  formatRelativeTime,
  type AnnouncementRow,
} from './NetworkFeedLogic';

interface Props {
  row: AnnouncementRow;
  /** Injectable for tests / forced clock pinning. Production gets `new Date()`. */
  now?: Date;
}

export default function AnnouncementCard({ row, now }: Props) {
  const timestamp = row.published_at ? formatRelativeTime(row.published_at, now) : '';

  // Footer composes "Replant Team · 2h ago · Operations" — separators
  // collapse cleanly when source_label is null.
  const footerSegments = [AUTHOR_ATTRIBUTION, timestamp, row.source_label]
    .filter((seg): seg is string => Boolean(seg && seg.length));

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{row.title}</Text>
        <AnnouncementTagChip tagType={row.tag_type} />
      </View>

      <Text style={styles.body}>{row.body}</Text>

      <Text style={styles.footer}>{footerSegments.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // KAN-201 v3 — Founder scale-up to 16/16 internal padding (was 14/14
  // in v2; README L91 allows 12-16). Lifts the card to the production
  // breathing room now that title + body sit at 18 / 14.
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  // Card-row: title + chip on one row, chip aligned right.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  // KAN-201 v3 — Title at 18 / 26. Cormorant 500 Medium for on-device
  // serif weight visible against muted body. flex: 1 so the title can
  // wrap while the chip stays right-aligned.
  title: {
    flex: 1,
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
  },
  // Body — DM Sans regular, muted color, 1.5 line-height. Always rendered
  // in full per v3; the v2 numberOfLines={3} + chevron was removed.
  body: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
  },
  // Footer — mono uppercase letterspaced, subtle (textSubtle for the
  // attribution-row hierarchy below body).
  footer: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
});
