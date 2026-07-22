// ─────────────────────────────────────────────
// AtnNavBar — the pushed-screen nav for Address the Network (`.an-nav`):
// 52pt, back chevron left, serif title (displayRegular 20). Distinct from
// HamburgerNavBar (which centres a 22pt display title) — this matches the
// CD's lighter, left-aligned pushed-screen header.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { BackChevronIcon } from './icons';

interface Props {
  title: string;
  onBack: () => void;
}

export default function AtnNavBar({ title, onBack }: Props) {
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.back}
      >
        <BackChevronIcon size={20} color={Colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  back: { width: 40 },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    letterSpacing: 0.2,
    color: Colors.text,
  },
  right: { width: 40 },
});
