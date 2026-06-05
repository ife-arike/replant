// NotifBar — sky-tinted ribbon for heartcry status updates.
// Shown on Feed page above ThresholdPreamble when hasUnreadStatus === true.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';

const CREAM = '#E6E1D5';

interface NotifBarProps {
  text: string;
  onTap: () => void;
  onClose: () => void;
}

export default function NotifBar({ text, onTap, onClose }: NotifBarProps) {
  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel="Your heartcry has a new status"
      hitSlop={8}
      style={styles.container}
    >
      <View style={styles.dot} />
      <View style={styles.body}>
        <Text style={styles.eyebrow}>YOUR HEARTCRY</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Svg width={10} height={10} viewBox="0 0 12 12" fill="none" style={styles.chevron}>
        <Path
          d="M4 2l4 4-4 4"
          stroke={Colors.textMuted}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Pressable
        onPress={(e) => {
          // Prevent the outer Pressable from firing
          onClose();
        }}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        style={styles.closeBtn}
      >
        <Svg width={10} height={10} viewBox="0 0 12 12" fill="none">
          <Path d="M2 2l8 8M10 2l-8 8" stroke={Colors.textMuted} strokeWidth={1.3} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107,181,232,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.22)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    borderRadius: 4,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.6, // 0.20em × 8
    color: Colors.accent,
    marginBottom: 4,
  },
  text: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: CREAM,
    lineHeight: 20,
  },
  chevron: {
    flexShrink: 0,
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
