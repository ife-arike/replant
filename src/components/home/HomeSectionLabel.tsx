// ─────────────────────────────────────────────
// HomeSectionLabel — KAN-201 AC #2 + #3
//
// Eyebrow label above each Home section ("Today" above the scripture
// strip, "Network Updates" above the announcements feed). Matches
// wireframe v4 `.screen-section-label` (lines 297-304): mono uppercase
// letterspaced sky-color.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  children: string;
}

export default function HomeSectionLabel({ children }: Props) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  // KAN-201 v2 — README L75 production spec: section label is 11 px,
  // 0.20em letter-spacing, uppercase sky. 0.20em × 11px = 2.2px on
  // device. v1 used 10 px / 3 px which overstated the tracking AND
  // undersized the eyebrow relative to scripture-ref + tag-chip at the
  // same scale. The 11 px reading also matches README typography table
  // L77 "Meta / timestamp 10-11 px" — section labels read one step up.
  label: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
