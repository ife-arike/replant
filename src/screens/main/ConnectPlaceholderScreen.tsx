// Connect tab placeholder — KAN-87 foundation (AC-7).
// Real content lands in the KAN-67 epic (KAN-71 send-message etc).

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function ConnectPlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Connect</Text>
      <Text style={styles.body}>(content lands in KAN-67 epic)</Text>
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
