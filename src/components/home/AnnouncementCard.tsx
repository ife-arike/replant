// ─────────────────────────────────────────────
// AnnouncementCard — KAN-17 AC #2, #3, #11, #12
//
// Read-only card for one announcement on Home. Layout follows wireframe
// v4 lines 1086-1106 (the "Network Updates" card cluster):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ Title (Cormorant 400)                  [Tag chip if any] │
//   │ Body text — truncated at 3 lines on first render with    │
//   │ "Read more" expand-in-place. Plain text only at MVP;     │
//   │ URLs render as plain text per AC #12.                    │
//   │ Replant Team · 2h ago · Operations                       │
//   └──────────────────────────────────────────────────────────┘
//
// D-56 locked: author attribution is the constant "Replant Team" — the
// DB `author_id` is retained for audit but NEVER surfaces to app users.
// The footer line composes: attribution · relative-timestamp · source-
// label (when set). No like / comment / share / bookmark (AC #10).
//
// Body truncation uses RN's numberOfLines={3} when collapsed; tapping
// "Read more" toggles to numberOfLines=undefined (full text). The toggle
// is component-local state — collapses again on remount. URLs are not
// linkified anywhere (AC #12 — body is plain text only at MVP).
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
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
  const [expanded, setExpanded] = useState(false);
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

      <Text style={styles.body} numberOfLines={expanded ? undefined : 3}>
        {row.body}
      </Text>

      {!expanded && row.body.length > 0 && (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Read more"
          hitSlop={6}
        >
          <Text style={styles.readMore}>Read more</Text>
        </Pressable>
      )}

      <Text style={styles.footer}>{footerSegments.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wireframe card: surface bg, hairline border, 8px radius, 10/12 padding.
  // gap: Spacing.sm separates the three rows (title, body, footer) for
  // breathing room — wireframe relied on margin-bottom on each child;
  // RN's `gap` is the cleaner equivalent.
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  // Card-row from wireframe: title + chip on one row, chip aligned right.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  // Cormorant 400 (displayRegular) per wireframe `card-title font-weight:
  // 400`. flex: 1 so the title can wrap while the chip stays right-aligned
  // and doesn't get crushed.
  title: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
  },
  // Body — DM Sans regular, muted color, 1.5 line-height.
  body: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
  },
  // "Read more" affordance — small, sky accent, monospace eyebrow weight.
  readMore: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.accent,
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
