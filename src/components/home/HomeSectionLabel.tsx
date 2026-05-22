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
  // KAN-201 v4 — switch to DM Sans 500 (Typography.bodyMedium). Mono
  // read too utilitarian at the section-label scale; bodyMedium sans
  // gives the eyebrow a softer typographic register that matches the
  // CD direction. 12 px / 2.4 letter-spacing (= 0.20em × 12).
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
