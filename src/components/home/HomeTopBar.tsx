// ─────────────────────────────────────────────
// HomeTopBar — Home top bar (KAN-201 home redesign 2026-06-01)
//
// Wordmark "Replant" (title-case, 26pt). The Rp mark stays on Home ONLY
// — removed from Prayer Wall + Persecuted per Founder (2026-06). No
// bottom hairline: the open scripture strip below creates the visual
// separation, so the old border was dropped in the redesign.
//
// Hamburger wires to useHamburger().open — the global slide-in panel
// that lives at the App root (KAN-76). Preserved across the redesign.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useHamburger } from '../../contexts/HamburgerContext';
import { RpMark } from './HomeIcons';

export default function HomeTopBar() {
  const { open } = useHamburger();
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <RpMark width={38} height={38} />
        <Text style={styles.wordmark}>Replant</Text>
      </View>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        accessibilityState={{ expanded: false }}
        hitSlop={12}
        style={styles.menu}
      >
        <View style={styles.line} />
        <View style={styles.line} />
        <View style={styles.line} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmark: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.text,
  },
  menu: { width: 26, alignItems: 'flex-end', gap: 5 },
  line: { width: 26, height: 1.5, borderRadius: 2, backgroundColor: Colors.text },
});
