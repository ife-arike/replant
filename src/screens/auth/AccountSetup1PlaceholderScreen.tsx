// Account Setup Page 1 placeholder — KAN-10 forward target (per SM ruling 11047).
// Reached when the user affirms the Declaration of Faith. KAN-11 replaces this
// stub with the real Account Setup Page 1.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "../../constants/theme";

export default function AccountSetup1PlaceholderScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Account Setup</Text>
      <Text style={styles.body}>(KAN-11 takes over here once Done)</Text>
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
