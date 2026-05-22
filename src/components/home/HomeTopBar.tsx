// ─────────────────────────────────────────────
// HomeTopBar — KAN-201 AC #1
//
// Top bar of the Home screen. Layout per wireframe v4 lines 155-195:
//   - .top-bar       — flex row, space-between, padding 8/16,
//                      border-bottom 0.5px var(--faint), flex-shrink 0
//   - .top-bar-logo  — flex row, gap 6px (Rp mark + wordmark)
//   - .top-bar-logo span (wordmark) — serif (Cormorant), 0.9rem,
//                      letter-spacing 0.08em
//   - .hamburger     — flex column, gap 3px, three 16×1.5 var(--off-white)
//                      bars with border-radius 1px
//
// AC #1 — hamburger is VISUAL ONLY at MVP. The Pressable has a no-op
// onPress with an accessibility label calling out the coming behaviour;
// KAN-76 will wire the drawer onPress to the real navigation hook.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import RpLogo from './RpLogo';

export default function HomeTopBar() {
  return (
    <View style={styles.bar}>
      <View style={styles.logoCluster}>
        <RpLogo size={32} />
        <Text style={styles.wordmark}>Replant</Text>
      </View>

      <Pressable
        onPress={noopMenu}
        accessibilityRole="button"
        accessibilityLabel="Menu (coming soon)"
        hitSlop={10}
        style={styles.hamburger}
      >
        <View style={styles.hamburgerBar} />
        <View style={styles.hamburgerBar} />
        <View style={styles.hamburgerBar} />
      </Pressable>
    </View>
  );
}

// Module-scope no-op so the Pressable doesn't allocate a fresh closure
// on every render. KAN-76 swaps this for the actual drawer-open hook.
function noopMenu(): void {
  // intentional no-op — wired by KAN-76
}

const styles = StyleSheet.create({
  // KAN-201 v3 — full scale-up. The v2 top bar used wireframe-frame
  // values (the HTML is a 280-px scaled preview); v3 lifts every value
  // to production-device scale per Founder direction 2026-05-22.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border, // matches wireframe var(--faint)
  },
  logoCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // KAN-201 v4 — wordmark size lifted to 24 (was 22) with letterSpacing
  // 1.9 (= 0.08em × 24 = 1.92, rounded per dispatch literal). Brings
  // the wordmark into balance with the 32 px logo + larger CD-set type
  // throughout the rest of Home.
  wordmark: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    letterSpacing: 1.9,
    color: Colors.text,
  },
  hamburger: {
    gap: 4,
    alignItems: 'flex-end',
  },
  hamburgerBar: {
    width: 22,
    height: 2,
    backgroundColor: Colors.text, // matches wireframe var(--off-white)
    borderRadius: 1,
  },
});
