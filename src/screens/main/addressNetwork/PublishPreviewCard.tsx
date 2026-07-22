// ─────────────────────────────────────────────
// PublishPreviewCard — a submission rendered "in the shape it will publish"
// (§G reading surface). Shared by the Testimony compose preview and the
// edits-review screen (Proposed vs Your original).
//
// Reading, not editing. Warm card, kicker eyebrow, serif title (testimony),
// ROMAN body (displayRegular — human voice, never scriptureItalic), the
// attribution line under a hairline. The "original" variant sits on the
// plain surface, labelled. No inline diff — clean reading, calm comparison.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';

interface Props {
  variant: 'publish' | 'original';
  kicker: string;
  title?: string | null;
  body: string;
  attribution: string;
}

export default function PublishPreviewCard({
  variant,
  kicker,
  title,
  body,
  attribution,
}: Props) {
  const isPublish = variant === 'publish';
  return (
    <View style={[styles.card, isPublish ? styles.cardPublish : styles.cardOriginal]}>
      <View style={styles.kickerRow}>
        <View style={[styles.kickerDot, isPublish ? styles.dotPublish : styles.dotOriginal]} />
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.body}>{body}</Text>
      <Text style={styles.attr}>{attribution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    gap: 13,
  },
  cardPublish: {
    backgroundColor: Colors.cardWarm,
  },
  cardOriginal: {
    backgroundColor: Colors.surface,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotPublish: {
    backgroundColor: Colors.green,
  },
  dotOriginal: {
    backgroundColor: Colors.textSubtle,
  },
  kicker: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.33, // 0.14em × 9.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  title: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    lineHeight: 26, // 1.2 × 22
    color: Colors.text,
  },
  body: {
    fontFamily: Typography.displayRegular, // Cormorant 400 roman — human voice
    fontSize: 18,
    lineHeight: 28, // 1.55 × 18
    color: Colors.text,
  },
  attr: {
    fontFamily: Typography.sansLight,
    fontSize: 12,
    color: Colors.textMuted,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
});
