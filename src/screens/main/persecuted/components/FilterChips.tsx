// FilterChips — horizontal chip bar for archive screens.
// Reusable pattern matching the region filter on Feed.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors, Typography } from '../../../../constants/theme';

const FAINT = 'rgba(240,237,230,0.08)';

export interface ChipOption {
  id: string;
  label: string;
}

interface FilterChipsProps {
  options: ChipOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function FilterChips({ options, selectedId, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => {
        const active = opt.id === selectedId;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={10}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: FAINT,
    backgroundColor: 'transparent',
  },
  chipActive: {
    borderColor: 'rgba(240,237,230,0.14)',
    backgroundColor: '#18181b',
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.text,
  },
});
