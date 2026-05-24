// ─────────────────────────────────────────────
// PrayerWallFilterBar — KAN-23
//
// Two-axis filter strip: Category (All / Healing / Protection /
// Provision / Unity / Other) on top, Urgency (All / Urgent only)
// underneath. Active chip carries a sky-blue underline indicator
// per AC. Per-axis state lives in the parent so a tab-blur effect can
// reset both at once.
//
// Sizing per dispatch (CD Pro Max baseline). paddingVertical 6,
// paddingHorizontal 14, chip gap 5, chip padding 3/8.
// ─────────────────────────────────────────────

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import {
  CATEGORY_FILTERS,
  URGENCY_FILTERS,
  type CategoryFilter,
  type UrgencyFilter,
} from './PrayerWallLogic';

interface Props {
  category: CategoryFilter;
  urgency: UrgencyFilter;
  onCategoryChange: (next: CategoryFilter) => void;
  onUrgencyChange: (next: UrgencyFilter) => void;
}

export default function PrayerWallFilterBar({
  category,
  urgency,
  onCategoryChange,
  onUrgencyChange,
}: Props) {
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {CATEGORY_FILTERS.map((opt) => {
          const active = opt === category;
          return (
            <Pressable
              key={`cat-${opt}`}
              onPress={() => onCategoryChange(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter category ${opt}`}
              style={[styles.chip, active && styles.chipActive]}
              hitSlop={6}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, styles.rowUrgency]}
      >
        {URGENCY_FILTERS.map((opt) => {
          const active = opt === urgency;
          // "Urgent" label is rendered as "Urgent only" per AC.
          const label = opt === 'Urgent' ? 'Urgent only' : opt;
          return (
            <Pressable
              key={`urg-${opt}`}
              onPress={() => onUrgencyChange(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter urgency ${label}`}
              style={[styles.chip, active && styles.chipActive]}
              hitSlop={6}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  row: {
    gap: 5,
    alignItems: 'center',
  },
  rowUrgency: {
    marginTop: 4,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  chipActive: {
    // Sky-blue underline indicator — AC explicit.
    borderBottomColor: Colors.accent,
  },
  chipText: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: Colors.accent,
  },
});
