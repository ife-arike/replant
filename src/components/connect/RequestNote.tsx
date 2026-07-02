// RequestNote — inline composer notice for the message request flow.
//
// Shown above the text input row (inside the composer zone, between
// CovenantStrip and the input) when the leader is composing to an
// unconnected leader. Signals that the message will be delivered as a
// connection request, not a direct DM.
//
// Spec: REQUEST-FLOW-HANDOFF.md §4.1.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
}

// Simple envelope — stroke, weight 1.4, rounded. Per HANDOFF §4.1 SVG spec.
function EnvelopeIcon() {
  return (
    <Svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Rect
        x={3} y={5} width={18} height={14} rx={2}
        stroke={Colors.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 5l9 7 9-7"
        stroke={Colors.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function RequestNote({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <EnvelopeIcon />
      </View>
      <Text style={styles.label}>
        This will be sent as a connection request
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(8,8,8,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(240,237,230,0.08)',
  },
  // The envelope SVG already renders at 13×13. Wrap for flex alignment.
  iconWrap: {
    opacity: 0.6,
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 0.06,
  },
});
