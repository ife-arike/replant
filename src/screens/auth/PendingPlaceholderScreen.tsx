// Pending placeholder — KAN-87 foundation (AC-5, pending branch).
// KAN-35 (countdown banner) lands inside the Active app shell once verified;
// the pre-active Pending state surface here is the holding screen.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthProvider";

export default function PendingPlaceholderScreen() {
  const { daysRemaining } = useAuth();
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Pending verification</Text>
      <Text style={styles.body}>Countdown banner lands in KAN-35.</Text>
      {daysRemaining !== null && (
        <Text style={styles.daysRemaining}>{daysRemaining} days remaining</Text>
      )}
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
  daysRemaining: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.accent, marginTop: Spacing.sm },
});
