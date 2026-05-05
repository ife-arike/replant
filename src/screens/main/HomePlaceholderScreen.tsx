// Home tab placeholder — KAN-87 foundation (AC-7).
// Real Home screen content lands in KAN-16. This placeholder also hosts the
// temporary Settings entry-point (AC-8) — gets removed when KAN-76 (Hamburger
// Shell) lands and becomes the canonical entry.

import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Colors, Radius, Spacing, Typography } from "../../constants/theme";
import type { MainStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<MainStackParamList, "Tabs">;

export default function HomePlaceholderScreen() {
  const nav = useNavigation<Nav>();
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Home</Text>
      <Text style={styles.body}>(content lands in KAN-16)</Text>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => nav.navigate("Settings")}
        accessibilityRole="button"
        accessibilityLabel="Open Settings (temporary entry — KAN-76 takes over)"
      >
        <Text style={styles.settingsButtonText}>Open Settings (temp entry)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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
