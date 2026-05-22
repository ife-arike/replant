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
import { Colors, Spacing } from "../../constants/theme";
import DailyScriptureStrip from "../../components/home/DailyScriptureStrip";
import NetworkFeed from "../../components/home/NetworkFeed";
import HomeTopBar from "../../components/home/HomeTopBar";
import HomeSectionLabel from "../../components/home/HomeSectionLabel";

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <HomeTopBar />

      <View style={styles.scrollArea}>
        {/* KAN-35 verification banner slot — when shown (pending leaders),
            the banner sits ABOVE the "Today" label per KAN-16 AC #1. */}

        <HomeSectionLabel>Today</HomeSectionLabel>
        <DailyScriptureStrip />

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
  // KAN-201 v2 — README L90: section gap is 12 px (matches the
  // between-cards gap, so Home's rhythm stays consistent: 12 between
  // every visual block from label to strip to label to first feed card).
  // 16 horizontal inset aligns with the top-bar so section labels +
  // cards sit directly beneath the wordmark.
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  // Feed takes remaining vertical space so the FlatList can scroll
  // independently — section label stays anchored above.
  feedZone: {
    flex: 1,
    marginTop: -Spacing.xs, // tighter coupling: label sits closer to cards
  },
});
