// Deactivated placeholder — KAN-87 foundation (AC-5, deactivated branch).
// KAN-36 replaces this stub with the deactivation popup + sign-out flow.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function DeactivatedPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Account deactivated</Text>
      <Text style={styles.body}>Popup lands in KAN-36.</Text>
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
  heading: { fontFamily: Typography.display, fontSize: 28, color: Colors.text, textAlign: "center" },
  body: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, textAlign: "center" },
});
