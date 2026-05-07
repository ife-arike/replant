// Persecuted tab placeholder — KAN-87 foundation (AC-7).
// Real content lands in KAN-65 (Persecuted surface).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function PersecutedPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Persecuted</Text>
      <Text style={styles.body}>(content lands in KAN-65)</Text>
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
