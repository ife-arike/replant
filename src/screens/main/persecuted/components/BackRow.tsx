// BackRow — mono eyebrow back affordance for pushed screens.
// Normal flow (not absolutely positioned). Chevron + "BACK" label.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';

interface BackRowProps {
  onPress: () => void;
}

export default function BackRow({ onPress }: BackRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      style={styles.container}
    >
      <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
        <Path
          d="M7.5 2L3 6l4.5 4"
          stroke={Colors.textMuted}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.label}>BACK</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    color: Colors.textMuted,
  },
});
