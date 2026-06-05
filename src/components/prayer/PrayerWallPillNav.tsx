// ─────────────────────────────────────────────
// PrayerWallPillNav — Prayer Wall redesign (pill navigation)
//
// Horizontal pill row replacing the old 2-segment control. Five pills:
//   Feed · Testimonies · My Prayers · Revelation · Locations
//
// Scrolls horizontally (no scrollbar) so the full set is reachable on
// narrow devices. The active pill animates its sky tint over 200 ms via
// a per-pill Animated.Value driven by the active prop.
//
// Spec — docs/design_handoff_prayer_wall_redesign/README.md (Pill Nav):
//   container  paddingTop 12, paddingBottom 14, 0.5 px bottom border
//   pills      gap 6, 22 px horizontal scroll padding
//   inactive   DM Mono 400 10px, 0.18em ls, uppercase; 7×14 padding;
//              radius 100; 0.5 border faint; color muted-55%; bg none
//   active     color sky; border sky-mid; bg sky-dim
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Typography } from '../../constants/theme';

export type PrayerWallPill =
  | 'feed'
  | 'testimonies'
  | 'my_prayers'
  | 'revelation'
  | 'locations';

interface PillDef {
  id: PrayerWallPill;
  label: string;
}

const PILLS: PillDef[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'testimonies', label: 'Testimonies' },
  { id: 'my_prayers', label: 'My Prayers' },
  { id: 'revelation', label: 'Revelation' },
  { id: 'locations', label: 'Locations' },
];

// Tokens (README global colour table).
const SKY = '#6BB5E8';
const SKY_MID = 'rgba(107,181,232,0.35)';
const SKY_DIM = 'rgba(107,181,232,0.12)';
const FAINT = 'rgba(240,237,230,0.08)';
const MUTED_55 = 'rgba(240,237,230,0.55)';

interface Props {
  active: PrayerWallPill;
  onChange: (pill: PrayerWallPill) => void;
}

export default function PrayerWallPillNav({ active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      {PILLS.map((pill) => (
        <Pill
          key={pill.id}
          label={pill.label}
          active={pill.id === active}
          onPress={() => onChange(pill.id)}
        />
      ))}
    </ScrollView>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  // 0 → inactive, 1 → active. Drives a smooth 200 ms colour interpolation
  // on the background + border. The label colour is swapped directly
  // (Animated can't drive Text color cross-platform reliably).
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(107,181,232,0)', SKY_DIM],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [FAINT, SKY_MID],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.pill, { backgroundColor, borderColor }]}>
        <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // A horizontal ScrollView placed in a flex column will stretch to
    // fill the column's cross-axis (vertical) space unless its growth is
    // pinned. Without flexGrow: 0 the pill bar expands downward and opens
    // a large blank gap between the header and the Feed content (the
    // 3339b1d restructure regression). flexShrink: 0 keeps it from being
    // squeezed when the body below is tall.
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: FAINT,
  },
  scrollContent: {
    paddingHorizontal: 22,
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 0.5,
  },
  pillLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10, // 0.018 × 10px → 0.18em
    textTransform: 'uppercase',
    color: MUTED_55,
  },
  pillLabelActive: {
    color: SKY,
  },
});
