// PillTabBar — horizontal pill chip row for Persecuted tab sub-surfaces.
// Red accent (never sky) — this is the only tab with red as its accent.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../../constants/theme';

export interface PillRoute {
  key: string;
  title: string;
}

interface PillTabBarProps {
  routes: PillRoute[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export default function PillTabBar({ routes, activeIndex, onTabPress }: PillTabBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {routes.map((route, i) => {
          const active = i === activeIndex;
          return (
            <Pressable
              key={route.key}
              onPress={() => onTabPress(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={route.title}
              style={[styles.pill, active && styles.pillActive]}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                {route.title.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,      // was paddingVertical: 6 — now matches Prayer Wall's pill nav top spacing
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(240,237,230,0.08)',  // was rgba(217,89,79,0.22)
  },
  content: {
    gap: 6,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.10)',
    backgroundColor: 'transparent',
  },
  pillActive: {
    borderColor: 'rgba(224,85,85,0.30)',
    backgroundColor: 'rgba(224,85,85,0.05)',
  },
  pillLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    color: Colors.textMuted,
  },
  pillLabelActive: {
    color: Colors.red,
  },
});
