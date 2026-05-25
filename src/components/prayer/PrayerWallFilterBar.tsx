// ─────────────────────────────────────────────
// PrayerWallFilterBar — KAN-23 v5 visual pass (Item 05)
//
// Single horizontal scroll row, ALWAYS. The v4 2-row-stack promotion
// (the selectedCategories.size >= 3 branch that split chips into
// active vs idle rows) is removed entirely per the v5 redlines —
// front-of-row Clear is the new affordance for narrowing many filters
// and it doubles as a thumb-reachable single-tap reset.
//
// New row order (left → right):
//   [× Clear] | [● Urgent] | [Healing] [Protection] ... [Laborers]
//
// Clear chip renders only when ≥1 axis is non-default. When no chip is
// active the row begins with the Urgent chip — no leading divider, no
// Clear chip taking a visual slot.
//
// Dividers: 1 × 18 pt, rgba(text, 0.14). Two of them when Clear is
// present (one after Clear, one after Urgent); one of them when Clear
// is hidden (only after Urgent).
//
// Right-edge fade stays (faked with stacked semi-transparent bands of
// Colors.background — expo-linear-gradient not installed at MVP). No
// left-edge fade because the Clear chip itself is the left affordance.
//
// Active-count strip (below the chips, names active filters + result
// count) is unchanged.
//
// Reduced motion: the active-count strip's height-grow drops to a
// 1-frame swap. The Clear-chip slide-out is layout-driven (the chip
// just unmounts), so reduced motion doesn't need to suppress it.
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import {
  CATEGORIES,
  hasActiveFilter,
  type PrayerCategory,
  type SelectedCategories,
  type UrgencyFilter,
} from './PrayerWallLogic';
import { DotIcon, XIcon } from './PrayerIcons';

interface Props {
  selectedCategories: SelectedCategories;
  urgency: UrgencyFilter;
  resultCount: number;
  onCategoryToggle: (cat: PrayerCategory) => void;
  onUrgencyChange: (next: UrgencyFilter) => void;
  onClear: () => void;
}

const STRIP_HEIGHT = 36;
const ANIM_MS = 200;

export default function PrayerWallFilterBar({
  selectedCategories,
  urgency,
  resultCount,
  onCategoryToggle,
  onUrgencyChange,
  onClear,
}: Props) {
  const reduced = useReducedMotion();
  const showActiveStrip = hasActiveFilter(selectedCategories, urgency);
  const urgentActive = urgency === 'Urgent';

  // Active-count strip — animated height. Reduced motion skips the
  // ease-out and snaps to the target value in one frame.
  const stripHeight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const target = showActiveStrip ? STRIP_HEIGHT : 0;
    if (reduced) {
      stripHeight.setValue(target);
      return;
    }
    Animated.timing(stripHeight, {
      toValue: target,
      duration: ANIM_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [showActiveStrip, reduced, stripHeight]);

  const handleUrgentToggle = () => {
    onUrgencyChange(urgentActive ? 'All' : 'Urgent');
  };

  // Active categories computed once for the active-count label.
  const activeCats = CATEGORIES.filter((c) => selectedCategories.has(c));

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {showActiveStrip ? (
            <>
              <ClearChip onPress={onClear} />
              <Divider />
            </>
          ) : null}

          <UrgentChip active={urgentActive} onPress={handleUrgentToggle} />
          <Divider />

          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={selectedCategories.has(cat)}
              onPress={() => onCategoryToggle(cat)}
            />
          ))}
        </ScrollView>

        {/* Right-edge fade — fakes the gradient mask without
            expo-linear-gradient (not installed). */}
        <View pointerEvents="none" style={styles.fadeOuter} />
        <View pointerEvents="none" style={styles.fadeInner} />
      </View>

      <Animated.View style={[styles.activeStrip, { height: stripHeight }]}>
        {showActiveStrip ? (
          <Text style={styles.activeStripText} numberOfLines={1}>
            {composeActiveLabel(activeCats, urgency, resultCount)}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function composeActiveLabel(
  activeCats: PrayerCategory[],
  urgency: UrgencyFilter,
  count: number,
): string {
  const parts: string[] = [];
  if (urgency === 'Urgent') parts.push('Urgent');
  parts.push(...activeCats);
  const labels = parts.join(' · ');
  const noun = count === 1 ? 'request' : 'requests';
  return `${labels} — ${count} ${noun}`;
}

function Divider() {
  return <View style={styles.divider} />;
}

function ClearChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Clear all filters"
      hitSlop={6}
      style={styles.clearChip}
    >
      <XIcon size={14} color={Colors.red} />
    </Pressable>
  );
}

function UrgentChip({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel="Filter urgent only"
      hitSlop={6}
      style={[
        styles.chip,
        active ? styles.chipUrgentActive : styles.chipIdle,
      ]}
    >
      {active ? null : <DotIcon size={8} color={Colors.textMuted} />}
      <Text
        style={[
          styles.chipText,
          active ? styles.chipUrgentTextActive : styles.chipTextIdle,
        ]}
      >
        Urgent
      </Text>
    </Pressable>
  );
}

function CategoryChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter ${label}`}
      hitSlop={6}
      style={[
        styles.chip,
        active ? styles.chipCategoryActive : styles.chipIdle,
        styles.chipGap,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipCategoryTextActive : styles.chipTextIdle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    // v7 Fix 02 — was `flexGrow: 0, flex: 1`. The two conflict:
    // flex:1 sets flexGrow:1 + flexShrink:1 + flexBasis:0, then
    // flexGrow:0 overrides growth → with flexBasis:0 the ScrollView
    // collapsed to 0 width on device. v7 regression report. Use
    // flex:1 alone so it fills the row.
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 14,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(240, 237, 230, 0.14)',
    marginHorizontal: 12,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipIdle: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.border,
  },
  chipUrgentActive: {
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderColor: 'rgba(224, 85, 85, 0.55)',
  },
  chipCategoryActive: {
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderColor: Colors.borderAccent,
  },
  chipGap: {
    marginLeft: 8,
  },
  chipText: {
    fontFamily: Typography.body,
    fontSize: 13,
  },
  chipTextIdle: {
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  chipUrgentTextActive: {
    color: Colors.red,
    fontFamily: Typography.bodyMedium,
  },
  chipCategoryTextActive: {
    color: Colors.accent,
    fontFamily: Typography.bodyMedium,
  },
  clearChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
  },
  fadeOuter: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: Colors.background,
    opacity: 0.6,
  },
  fadeInner: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: Colors.background,
    opacity: 0.4,
  },
  activeStrip: {
    overflow: 'hidden',
    justifyContent: 'center',
    paddingTop: 6,
  },
  activeStripText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
});
