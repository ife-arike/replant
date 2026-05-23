// ─────────────────────────────────────────────
// HomeTopBar — KAN-201 chassis + KAN-76 hamburger wire
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
// KAN-76 (2026-05-22): hamburger Pressable now calls useHamburger().open
// — opens the global slide-in panel that lives at the App root. The
// panel handles the rest (slide animation, dismiss patterns, menu
// items, identity card, logout).
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useHamburger } from '../../contexts/HamburgerContext';
import RpLogo from './RpLogo';

// Lockup constants — WORDMARK_SIZE is the single source of truth for
// the wordmark font size; LOGO_SIZE is derived via the wireframe ratio
// (1.6×). Changing WORDMARK_SIZE here propagates to both the <Text> and
// the <RpLogo>; styles.wordmark.fontSize is overridden inline below so
// the constant remains authoritative.
const WORDMARK_SIZE = 24;
const LOGO_SIZE = Math.round(WORDMARK_SIZE * 1.6);

export default function HomeTopBar() {
  const { open } = useHamburger();
  return (
    <View style={styles.bar}>
      {/* Lockup: RpLogo + wordmark. Sizes derived from WORDMARK_SIZE
          via the 1.6× wireframe ratio. The inline ratio comment must
          NOT sit between JSX siblings inside the View — RN reads the
          whitespace as a text node and throws "Text strings must be
          rendered within a <Text>". */}
      <View style={styles.logoCluster}>
        <RpLogo size={LOGO_SIZE} />
        <Text style={{ ...styles.wordmark, fontSize: WORDMARK_SIZE }}>Replant</Text>
      </View>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        accessibilityState={{ expanded: false }}
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
    // CD: the RpLogo SVG has internal whitespace on its trailing edge
    // that inflates the visual gap beyond the style value. 8 here
    // reads as ~12px between glyph and wordmark — the lockup feels
    // like one unit instead of two adjacent elements.
    gap: 8,
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
