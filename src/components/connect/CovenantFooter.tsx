// CovenantFooter — KAN-68/69 §5.4 (HANDOFF.md).
//
// Sits at the foot of every list (Leaders thread list, Ministries branch
// list, Leader search empty). Copy is verbatim per HANDOFF — do not
// paraphrase. The covenant is a load-bearing reminder that Connect is
// not a social feed; it lives at the bottom of every list so a leader
// scrolling through their threads is reminded of the standard the
// network holds itself to.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export default function CovenantFooter() {
  return (
    <View style={styles.root}>
      <Text style={styles.body}>
        Conversations within Replant are governed by our community
        covenant. Chats are protected within the network. Keywords
        flagged for review if misuse is detected.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 14,
    marginHorizontal: 22,
    marginBottom: 22,
    paddingVertical: 13,
    paddingHorizontal: 15,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 11,
    lineHeight: 18,
    color: Colors.textMuted,
  },
});
