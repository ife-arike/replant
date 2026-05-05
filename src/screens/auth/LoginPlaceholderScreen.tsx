// Login placeholder — KAN-87 foundation (AC-5, 401 branch).
// KAN-38 replaces this stub with the real Login screen.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function LoginPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Login</Text>
      <Text style={styles.body}>Login screen lands in KAN-38.</Text>
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
