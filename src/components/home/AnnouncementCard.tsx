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
  // KAN-201 v2 — `isTruncated` flips true on the first layout pass when
  // RN reports 3+ rendered lines. Replaces the v1 always-on gate that
  // showed "Read more" on every card with body text regardless of
  // whether the 3-line clamp actually clipped anything.
  const [isTruncated, setIsTruncated] = useState(false);
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

      <Text
        style={styles.body}
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          // onTextLayout fires after layout with the actual rendered
          // line array. >= 3 indicates the 3-line clamp engaged; the
          // chevron affordance becomes visible only then.
          if (!expanded) setIsTruncated(e.nativeEvent.lines.length >= 3);
        }}
      >
        {row.body}
      </Text>

      {!expanded && isTruncated && (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Expand"
          hitSlop={8}
          style={styles.expandRow}
        >
          <Text style={styles.expandChevron}>›</Text>
        </Pressable>
      )}

      <Text style={styles.footer}>{footerSegments.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wireframe card: surface bg, hairline border, 8 px radius.
  // KAN-201 v2 — README L91 ("Card internal padding: 12-16 px") sets the
  // production pad; v1 shipped at the low end (12/10) which read cramped
  // on device. 14/14 puts the title row and footer at the README-targeted
  // breathing room. gap: 10 between rows mirrors the wireframe's per-
  // child margin-bottom rhythm at the production scale.
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  // Card-row from wireframe: title + chip on one row, chip aligned right.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  // KAN-201 v2 — Cormorant 500 Medium (displayMedium). README L74 specs
  // weight 400 nominally; on device the 400 thin reads close to the
  // muted DM Sans body and the serif-title hierarchy disappears.
  // 500 Medium restores the wireframe's intended title-vs-body visual
  // contrast without crossing into the bolder 600 used for hero text.
  // flex: 1 lets the title wrap while the chip stays right-aligned.
  title: {
    flex: 1,
    fontFamily: Typography.displayMedium,
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
  // KAN-201 v2 — Expand chevron affordance. Pulled up −4 so it nests
  // against the truncated body baseline rather than floating in extra
  // whitespace. The chevron itself is a typographic guillemet ("›")
  // sized at 18 so the tap target reads clearly on the dark surface.
  expandRow: {
    alignItems: 'flex-start',
    marginTop: -4,
  },
  expandChevron: {
    fontFamily: Typography.body,
    fontSize: 18,
    lineHeight: 18,
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
