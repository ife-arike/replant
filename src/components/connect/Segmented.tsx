// Segmented — KAN-68/69 §5.2 (HANDOFF.md).
//
// Two-item segmented control under the header: Ministries | Leaders.
// Active item: surfaceElevated bg, text color; inactive: muted.
// Active thumb position is animated via Animated.Value — a hard
// snap would feel unfriendly on a tab that's all about reverence.
// 200ms ease-out matches the rest of the Connect motion register.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import type { SubTab } from '../../screens/main/ConnectScreen';

interface Props {
  value: SubTab;
  onChange: (next: SubTab) => void;
}

const OPTIONS: Array<{ value: SubTab; label: string }> = [
  { value: 'ministries', label: 'Ministries' },
  { value: 'leaders', label: 'Leaders' },
];

// Horizontal screen padding matches HANDOFF §5.2 (22px on each side).
const SIDE_PAD = 22;
const INNER_PAD = 3;

export default function Segmented({ value, onChange }: Props) {
  const { width } = useWindowDimensions();
  // Container inner width = screen width - 2*22 (side padding).
  // Each item width = (inner - 2*3 padding) / 2.
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
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },
  labelOn: {
    color: Colors.text,
  },
});
