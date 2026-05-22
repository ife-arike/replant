// Home tab placeholder — KAN-87 foundation (AC-7).
// Real Home screen content lands in KAN-17. This placeholder hosts the
// temporary Settings entry-point (AC-8 — gets removed when KAN-76 ships)
// and, as of KAN-16, the Daily Scripture Strip at the top of the screen.
// KAN-17 will replace the rest of this placeholder with the real Home
// feed; the strip is the only KAN-16 surface here.

import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import type { MainStackParamList } from "../../navigation/types";
import DailyScriptureStrip from "../../components/home/DailyScriptureStrip";

type Nav = NativeStackNavigationProp<MainStackParamList, "Tabs">;

export default function HomePlaceholderScreen() {
  const nav = useNavigation<Nav>();
  return (
    <View style={styles.root}>
      {/* Top zone — KAN-16 scripture strip lives here. */}
      <View style={styles.topZone}>
        {/* KAN-35 verification banner slot — when shown (pending leaders),
            the banner sits ABOVE the scripture strip per KAN-16 AC #1. The
            strip's position adapts automatically (no spacer needed). */}
        <DailyScriptureStrip />
        {/* KAN-17 home feed slot — the rest of Home (announcements feed,
            etc.) will be composed BELOW the strip when KAN-17 ships. The
            placeholder content below is temporary scaffolding. */}
      </View>

      {/* Temporary placeholder content — KAN-17 replaces. */}
      <View style={styles.placeholderZone}>
        <Text style={styles.heading}>Home</Text>
        <Text style={styles.body}>(rest of Home lands in KAN-17)</Text>

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
  // Top zone — fixed-height-ish content (strip + future banner). Stays at
  // the top of the scroll area; not centered.
  topZone: {
    gap: Spacing.md,
  },
  // Placeholder zone — remaining vertical space, centered scaffolding
  // until KAN-17 composes the real feed.
  placeholderZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heading: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  settingsButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  settingsButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
});
