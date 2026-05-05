// The Church tab placeholder — KAN-87 foundation (AC-7).
// Real content lands in The Church tab's dedicated ticket (LocalMapScreen /
// ChurchDotLayer / MapPinSelector per FE plan 10976 #6).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function TheChurchPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>The Church</Text>
      <Text style={styles.body}>(content lands in The Church tab ticket)</Text>
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
