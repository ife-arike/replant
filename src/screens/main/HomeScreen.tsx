// Home screen — KAN-201 visual chassis around KAN-16 (scripture strip)
// and KAN-17 (network feed). Renamed from HomePlaceholderScreen.tsx
// 2026-05-21 once the real visual frame landed.
//
// Composition (top → bottom):
//   HomeTopBar         — Rp logo + "Replant" wordmark + hamburger
//   ──── hairline ────
//   "Today"            — section label (KAN-201 AC #2)
//   DailyScriptureStrip (KAN-16)
//   "Network Updates"  — section label (KAN-201 AC #3)
//   NetworkFeed        (KAN-17) — takes remaining vertical space, scrolls
//
// AC #4 removed the temporary Settings entry-point (was scaffolding for
// KAN-87 AC-8). KAN-76 will wire the hamburger to the real settings
// drawer; the icon ships visual-only here per AC #1.
//
// AC #5 font guard: App.tsx already gates render on useFonts (see
// App.tsx:88-95 — returns null until fonts resolve, splash held by
// preventAutoHideAsync). No local guard needed.

import React from "react";
import { StyleSheet, View } from "react-native";
import { Colors } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthProvider";
import DailyScriptureStrip from "../../components/home/DailyScriptureStrip";
import NetworkFeed from "../../components/home/NetworkFeed";
import HomeTopBar from "../../components/home/HomeTopBar";
import HomeSectionLabel from "../../components/home/HomeSectionLabel";
import VerificationBanner from "../../components/home/VerificationBanner";

export default function HomeScreen() {
  const { branch } = useAuth();
  return (
    <View style={styles.root}>
      <HomeTopBar />

      <View style={styles.scrollArea}>
        {/* KAN-35 — verification countdown banner. Shown only when
            branch === 'pending' (Founder ruling 2026-05-22: pending
            leaders see Home with this banner instead of being routed
            to a separate placeholder screen). */}
        {branch === 'pending' && <VerificationBanner />}

        <HomeSectionLabel>Today</HomeSectionLabel>
        {/* Wrapping View carries the marginBottom — DailyScriptureStrip
            does not accept a style prop and the dispatch forbids
            touching its internals. With scrollArea gap: 12, the wrapper's
            marginBottom: 20 produces the intended 32 px section break
            from scripture-bottom to NETWORK UPDATES label. */}
        <View style={{ marginBottom: 20 }}>
          <DailyScriptureStrip />
        </View>

        <HomeSectionLabel>Network Updates</HomeSectionLabel>
        <View style={styles.feedZone}>
          <NetworkFeed />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60, // matches the existing safe-area + status-bar offset
  },
  // KAN-201 v5 — paddingTop 16 → 24 (top-bar border to TODAY label).
  // gap: 12 governs label-to-content spacing within each section.
  // DailyScriptureStrip carries inline marginBottom: 20 so the
  // scripture→NETWORK UPDATES break reads 32 px total (12 + 20).
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  // Feed takes remaining vertical space so the FlatList can scroll
  // independently — section label stays anchored above. The 12 px
  // scrollArea.gap is the correct label-to-content spacing; v4's
  // negative marginTop was compensating for something that no longer
  // needs compensation.
  feedZone: {
    flex: 1,
  },
});
