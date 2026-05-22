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
  // Wireframe `.screen-section-label`: 0.52rem, letter-spacing 0.2em,
  // uppercase, color var(--sky). Mobile mapping: 10px size + 3 (≈0.3em)
  // letter-spacing matches the existing chip / footer eyebrow weight in
  // AnnouncementCard + DailyScriptureStrip — keeps Home's mono-uppercase
  // language internally consistent at one scale.
  label: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
