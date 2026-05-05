// Settings placeholder — KAN-87 foundation (AC-8).
// Reachable from Home placeholder's "Open Settings" button. KAN-72 replaces
// this stub with the real SettingsScreen once KAN-87 reaches Done.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function SettingsPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.body}>(KAN-72 takes over here once KAN-87 is Done)</Text>
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
  heading: { fontFamily: Typography.display, fontSize: 28, color: Colors.text },
  body: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted },
});
