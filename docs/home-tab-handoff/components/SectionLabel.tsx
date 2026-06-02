// components/SectionLabel.tsx — "TODAY" / "NETWORK UPDATES".
// The ONLY all-caps in the Home UI (founder call, 2026-06). Everything else
// is title/sentence case.
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';

export function SectionLabel({ children }: { children: string }) {
  // Pass plain text; uppercasing is done here so source stays readable.
  return <Text style={s.label}>{children.toUpperCase()}</Text>;
}

const s = StyleSheet.create({
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 2.3, // ≈ 0.18em
    color: Colors.accent,
    marginTop: 22,
    marginBottom: 14,
  },
});
