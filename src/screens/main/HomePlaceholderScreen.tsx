// Home tab — KAN-17 Network Feed lands here, KAN-16 scripture strip
// stays at the top. File is still named "Placeholder" because the
// temporary KAN-87 AC-8 Settings entry-point continues to live below
// the feed until KAN-76 ships the real Settings access path.
//
// Layout:
//   topZone        — scripture strip (KAN-16) + KAN-35 banner slot above
//   feedZone       — NetworkFeed (KAN-17) — takes the rest of the screen
//   bottomZone     — temporary Settings entry (KAN-76 will remove this)

import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import type { MainStackParamList } from "../../navigation/types";
import DailyScriptureStrip from "../../components/home/DailyScriptureStrip";
import NetworkFeed from "../../components/home/NetworkFeed";

type Nav = NativeStackNavigationProp<MainStackParamList, "Tabs">;

export default function HomePlaceholderScreen() {
  const nav = useNavigation<Nav>();
  return (
    <View style={styles.root}>
      {/* Top zone — KAN-35 verification banner slot (when shown) sits
          ABOVE the scripture strip per KAN-16 AC #1; the strip adapts
          automatically. */}
      <View style={styles.topZone}>
        <DailyScriptureStrip />
      </View>

      {/* Feed zone — KAN-17 Network Feed. Takes the remaining vertical
          space; scrolls independently. */}
      <View style={styles.feedZone}>
        <NetworkFeed />
      </View>

      {/* Temporary Settings entry — KAN-87 AC-8 placeholder kept until
          KAN-76 ships the real Settings access path. NOT part of KAN-17
          scope; intentionally compact + at the bottom so it stays out of
          the feed's visual hierarchy. */}
      <View style={styles.bottomZone}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => nav.navigate("Settings")}
          accessibilityRole="button"
          accessibilityLabel="Open Settings (temporary entry — KAN-76 takes over)"
        >
          <Text style={styles.settingsButtonText}>Open Settings (temp entry)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },
  topZone: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  feedZone: {
    flex: 1,
  },
  bottomZone: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  settingsButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  settingsButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
