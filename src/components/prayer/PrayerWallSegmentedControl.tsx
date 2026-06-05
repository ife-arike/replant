// ─────────────────────────────────────────────
// PrayerWallSegmentedControl — KAN-23 v3 (animated thumb)
//
// Two-segment control rendered below the top bar when view is 'feed'
// or 'testimonies'. Switches the inner view without changing the tab.
// Animated sliding thumb matches Connect's Segmented.tsx motion register
// (200ms ease-out bezier). Mono/uppercase label font preserved — the
// Prayer Wall tone is more reverent than Connect.
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';

export type SegmentValue = 'feed' | 'testimonies';

interface Props {
  value: SegmentValue;
  onChange: (next: SegmentValue) => void;
}

const OPTIONS: Array<{ value: SegmentValue; label: string }> = [
  { value: 'feed', label: 'Feed' },
  { value: 'testimonies', label: 'Testimonies' },
];

// Horizontal padding matches Connect §5.2 layout (22px each side).
const SIDE_PAD = 22;
const INNER_PAD = 3;

export default function PrayerWallSegmentedControl({ value, onChange }: Props) {
  const { width } = useWindowDimensions();
  // Container inner width = screen width - 2×22 (side pads) - 2×3 (inner pads).
  const innerWidth = width - SIDE_PAD * 2 - INNER_PAD * 2;
  const itemWidth = innerWidth / OPTIONS.length;

  const activeIdx = OPTIONS.findIndex((o) => o.value === value);
  const tx = useRef(new Animated.Value(activeIdx)).current;

  useEffect(() => {
    Animated.timing(tx, {
      toValue: activeIdx,
      duration: 200,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [activeIdx, tx]);

  const translateX = tx.interpolate({
    inputRange: [0, OPTIONS.length - 1],
    outputRange: [0, itemWidth * (OPTIONS.length - 1)],
  });

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.thumb,
          {
            width: itemWidth,
            transform: [{ translateX }],
          },
        ]}
        pointerEvents="none"
      />
      {OPTIONS.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 2,
    marginHorizontal: SIDE_PAD,
    marginBottom: 8,
    padding: INNER_PAD,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 11,
    flexDirection: 'row',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: INNER_PAD,
    left: INNER_PAD,
    bottom: INNER_PAD,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
  },
  item: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  labelOn: {
    color: Colors.text,
  },
});
