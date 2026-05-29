// CovenantStrip — KAN-68/69 §5.4 (HANDOFF.md).
//
// Condensed covenant pinned directly above every composer (1:1 DM thread
// AND branch thread). The copy is verbatim per HANDOFF — a 1-line
// reminder that flagged keywords are reviewed. This is the surface-level
// expression of DELIVER-ALWAYS (D-45 clause 3): the leader knows the
// floor of the moderation contract before they send.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

function LockIcon() {
  // 0.7 opacity per HANDOFF — the lock is a marker, not a primary affordance.
  return (
    <Svg width={10} height={11} viewBox="0 0 14 16" fill="none" style={{ opacity: 0.7 }}>
      <Rect x={2.5} y={6.5} width={9} height={7.5} rx={1.4}
        stroke={Colors.accent} strokeWidth={1.3} />
      <Path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2"
        stroke={Colors.accent} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

export default function CovenantStrip() {
  return (
    <View style={styles.root}>
      <LockIcon />
      <Text style={styles.body}>
        Protected within the network · flagged keywords are reviewed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(8,8,8,0.96)',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  body: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 0.96, // 0.12em × 8pt
    textTransform: 'uppercase',
    color: Colors.textSubtle,
  },
});
