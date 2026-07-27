// ─────────────────────────────────────────────
// Segmented — the app's segmented control (`.pp-seg` / `.an-seg` register:
// Colors.surface track, active pill sky-15 bg / accent text). Used for the
// Compose | My Submissions segment (with the amber edits badge) and the
// review screen's Proposed | Your original toggle (compact variant).
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { SKY_15 } from './tokens';

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  badge?: boolean; // amber dot (edits proposed)
}

interface Props<K extends string> {
  options: ReadonlyArray<SegmentOption<K>>;
  value: K;
  onChange: (key: K) => void;
  compact?: boolean;
}

export default function Segmented<K extends string>({
  options,
  value,
  onChange,
  compact,
}: Props<K>) {
  return (
    <View style={[styles.track, compact && styles.trackCompact]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              styles.pill,
              compact && styles.pillCompact,
              active && styles.pillActive,
            ]}
          >
            <Text
              style={[
                compact ? styles.labelCompact : styles.label,
                active && styles.labelActive,
              ]}
            >
              {opt.label}
            </Text>
            {opt.badge ? <View style={styles.badge} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 3,
  },
  trackCompact: {
    borderRadius: 9,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  pillCompact: {
    paddingVertical: 8,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: SKY_15,
  },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  labelCompact: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.accent,
  },
  badge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.amber,
  },
});
