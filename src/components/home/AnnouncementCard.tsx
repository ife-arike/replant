// ─────────────────────────────────────────────
// AnnouncementCard — KAN-17 AC #2, #3, #10, #12
//
// Read-only card for one announcement on Home. Layout follows wireframe
// v4 lines 1086-1106 (the "Network Updates" card cluster):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ Title (Cormorant 400, 22 px)            [Tag chip if any]│
//   │ ─ 8 px ─                                                 │
//   │ Paragraph 1                                              │
//   │ ─ 6 px ─                                                 │
//   │ Paragraph 2 (when body contains "\n\n")                  │
//   │ ─ 10 px ─                                                │
//   │ Replant Team · 2h ago · Operations                       │
//   └──────────────────────────────────────────────────────────┘
//
// D-56 locked: author attribution is the constant "Replant Team" — the
// DB `author_id` is retained for audit but NEVER surfaces to app users.
// The footer line composes: attribution · relative-timestamp · source-
// label (when set). No like / comment / share / bookmark (AC #10).
//
// KAN-201 v3 (2026-05-22): truncation + expand affordance removed —
// cards always render the body in full.
//
// KAN-201 v4 (2026-05-22): paragraph-aware body. `row.body` is split on
// blank-line separators (`\n\n`) and each paragraph renders as its own
// <Text>. Spacing is now per-child via marginBottom on titleRow + body
// container; the card no longer carries a single `gap` — paragraph gap
// (6 px) is distinct from row gap (titleRow→body 8 px, body→footer
// 10 px). Title font reverts to Cormorant 400 (Typography.displayRegular)
// — at 22 px the 400-weight serif reads correctly without needing the
// 500 Medium boost.
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

  // KAN-201 v4 — split body into paragraphs on blank-line separators.
  // Filter empties so a trailing "\n\n" doesn't render a phantom row.
  const paragraphs = row.body.split('\n\n').filter((s) => s.trim().length > 0);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{row.title}</Text>
        <AnnouncementTagChip tagType={row.tag_type} />
      </View>

      <View style={styles.bodyContainer}>
        {paragraphs.map((para, i) => (
          <Text key={i} style={styles.body}>{para.trim()}</Text>
        ))}
      </View>

      <Text style={styles.footer}>{footerSegments.join('  ·  ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // KAN-201 v4 — internal padding stays at 16/16; the single `gap` was
  // removed in favor of per-child marginBottom so the title→body and
  // body→footer rhythms can differ from the inter-paragraph rhythm.
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  // Card-row: title + chip on one row, chip aligned right.
  // KAN-201 v4 — marginBottom 8 anchors the gap from title to first
  // paragraph; no longer relies on the parent's removed `gap`.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  // KAN-201 v4 — title reverts to Cormorant 400 (displayRegular). At
  // 22 px / 26 lineHeight the letterforms are large enough that the
  // 400 weight reads with the right hierarchy against the body; the
  // 500 Medium that v2/v3 used was an on-device correction for the
  // smaller v1/v2 sizes and is no longer needed at the v4 scale.
  title: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.text,
  },
  // KAN-201 v4 — paragraph container. `gap: 6` separates paragraphs
  // within the body; `marginBottom: 10` separates the body block from
  // the footer meta line.
  bodyContainer: {
    gap: 6,
    marginBottom: 10,
  },
  // Body — DM Sans regular, muted color. v4 lifts to 15/23 from v3's
  // 14/21 for comfortable multi-paragraph reading at production scale.
  body: {
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textMuted,
  },
  // KAN-201 v4 — footer meta line at 11 px / 0.55 letter-spacing
  // (= 0.05em × 11). Mono uppercase + textSubtle keep the eyebrow
  // present but subordinate to the body it follows.
  footer: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
});
