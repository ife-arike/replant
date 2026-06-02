// ─────────────────────────────────────────────
// HomeSectionLabel — "TODAY" / "NETWORK UPDATES"
// (KAN-201 home redesign 2026-06-01)
//
// The only all-caps in the Home UI (Founder call, 2026-06). Pass plain
// title-case text; uppercasing happens here so the source stays readable.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  children: string;
}

export default function HomeSectionLabel({ children }: Props) {
  return <Text style={styles.label}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 2.3, // ≈ 0.18em
    color: Colors.accent,
    marginTop: 22,
    marginBottom: 14,
  },
});
