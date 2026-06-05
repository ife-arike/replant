// StatusTrack — three-step progress indicator (Received → Seen → Responded).
// Seen uses Colors.accent (sky), NOT amber — Founder ruling.
// Responded uses Colors.green.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../../constants/theme';

const STEPS = ['received', 'seen', 'responded'] as const;
const STEP_LABELS = ['Received', 'Seen', 'Responded'] as const;

const STEP_DONE_COLORS = [
  Colors.text,    // received → off-white
  Colors.accent,  // seen → sky (NOT amber)
  Colors.green,   // responded → green
] as const;

interface StatusTrackProps {
  status: string;
}

export default function StatusTrack({ status }: StatusTrackProps) {
  const activeIdx = STEPS.indexOf(status as typeof STEPS[number]);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: activeIdx + 1, min: 1, max: 3 }}
    >
      {STEPS.map((step, i) => {
        const done = i <= activeIdx;
        const dotColor = done ? STEP_DONE_COLORS[i] : 'transparent';
        const borderColor = done ? STEP_DONE_COLORS[i] : Colors.border;
        const labelColor = done ? STEP_DONE_COLORS[i] : Colors.textSubtle;

        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: done ? STEP_DONE_COLORS[i] : Colors.border },
                ]}
              />
            )}
            <View style={styles.step}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dotColor, borderColor },
                ]}
              />
              <Text style={[styles.label, { color: labelColor }]}>{STEP_LABELS[i]}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  line: {
    flex: 1,
    height: 0.5,
    marginHorizontal: 6,
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    textTransform: 'uppercase',
  },
});
