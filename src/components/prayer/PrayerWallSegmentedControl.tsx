// ─────────────────────────────────────────────
// PrayerWallSegmentedControl — KAN-23 v2 (Ticket D)
//
// Two-segment control rendered below the top bar when view is 'feed'
// or 'testimonies'. Switches the inner view without changing the tab.
// "Feed" hides on landing.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export type SegmentValue = 'feed' | 'testimonies';

interface Props {
  value: SegmentValue;
  onChange: (next: SegmentValue) => void;
}

export default function PrayerWallSegmentedControl({ value, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      <Segment label="Feed" active={value === 'feed'} onPress={() => onChange('feed')} />
      <Segment label="Testimonies" active={value === 'testimonies'} onPress={() => onChange('testimonies')} />
    </View>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 6,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.transparent,
  },
  segmentActive: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
  },
  segmentText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  segmentTextActive: {
    color: Colors.text,
  },
});
