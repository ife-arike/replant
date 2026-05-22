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
  // KAN-201 v3 — Founder scale-up. v2's 11 px / 2.2 tracking still read
  // small once the surrounding strip + cards landed at production size;
  // 13 px / 2.6 tracking (= 0.20em × 13) keeps the same 0.20em proportion
  // and brings the eyebrow into balance with the larger Home blocks.
  label: {
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
