// ─────────────────────────────────────────────
// PrayerWallFilterBar — KAN-23 v2 (Ticket A)
//
// Two-axis filter strip in a single visually-unified row: Urgent chip
// on the left, vertical divider, category chips on the right. Clear
// chip pins to the right edge the moment any axis is non-default; one
// tap restores defaults with no confirm. Below the strip, an active-
// count strip animates in (height 0 → 36 pt) naming the active filters
// + result count.
//
// Filtering is server-side in v2 — this component is presentation-only.
// It does not call the RPC. The parent (PrayerWallScreen) observes
// onCategoryChange / onUrgencyChange / onClear and re-runs the RPC.
//
// Single-select state per axis (CategoryFilter / UrgencyFilter — see
// PrayerWallLogic). The 3+ promote-to-stack branch from the dispatch
// spec is plumbed but is unreachable today because the current state
// shape caps active chips at 2 (1 category + Urgent). Keeping the
// branch wired so a future multi-select expansion drops in without a
// rewrite.
//
// Reduced motion: useReducedMotion() drops the height-grow animation
// on the active-count strip and the chip selection transitions to
// 1-frame swaps.
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
  DEFAULT_CATEGORY,
  DEFAULT_URGENCY,
  hasActiveFilter,
  type CategoryFilter,
  type UrgencyFilter,
} from './PrayerWallLogic';
import { DotIcon, XIcon } from './PrayerIcons';

interface Props {
  category: CategoryFilter;
  urgency: UrgencyFilter;
  resultCount: number;
  onCategoryChange: (next: CategoryFilter) => void;
  onUrgencyChange: (next: UrgencyFilter) => void;
  onClear: () => void;
}

const STRIP_HEIGHT = 36;
const ANIM_MS = 200;

export default function PrayerWallFilterBar({
  category,
  urgency,
  resultCount,
  onCategoryChange,
  onUrgencyChange,
  onClear,
}: Props) {
  const reduced = useReducedMotion();
  const showActiveStrip = hasActiveFilter(category, urgency);

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
      useNativeDriver: false, // animating layout height
    }).start();
  }, [showActiveStrip, reduced, stripHeight]);

  const urgentActive = urgency === 'Urgent';

  const handleUrgentToggle = () => {
    onUrgencyChange(urgentActive ? DEFAULT_URGENCY : 'Urgent');
  };

  const handleCategoryTap = (cat: CategoryFilter) => {
    // Toggle behaviour — tapping the active chip returns to 'All'.
    if (cat === category) {
      onCategoryChange(DEFAULT_CATEGORY);
      return;
    }
    onCategoryChange(cat);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Urgent chip — left of divider */}
        <UrgentChip active={urgentActive} onPress={handleUrgentToggle} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Category chips — horizontally scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {/* "All" chip lives at the head — tapping it explicitly
              restores the default. */}
          <CategoryChip
            label="All"
            active={category === 'All'}
            onPress={() => onCategoryChange('All')}
          />
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              active={category === cat}
              onPress={() => handleCategoryTap(cat)}
            />
          ))}
        </ScrollView>

        {/* Right-edge fade — fakes the gradient mask without
            expo-linear-gradient (not installed). Two narrow stacked
            View bands give a soft transition to the background. */}
        <View pointerEvents="none" style={styles.fadeOuter} />
        <View pointerEvents="none" style={styles.fadeInner} />

        {/* Clear chip — pins to right edge when any axis is non-default. */}
        {showActiveStrip ? (
          <Pressable
            onPress={onClear}
            style={styles.clearChip}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            hitSlop={6}
          >
            <XIcon size={10} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Active-count strip */}
      <Animated.View style={[styles.activeStrip, { height: stripHeight }]}>
        {showActiveStrip ? (
          <Text style={styles.activeStripText} numberOfLines={1}>
            {composeActiveLabel(category, urgency, resultCount)}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function composeActiveLabel(
  category: CategoryFilter,
  urgency: UrgencyFilter,
  count: number,
): string {
  const parts: string[] = [];
  if (urgency === 'Urgent') parts.push('Urgent');
  if (category !== 'All') parts.push(category);
  const labels = parts.join(' · ');
  const noun = count === 1 ? 'request' : 'requests';
  return `${labels} — ${count} ${noun}`;
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
  divider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(240, 237, 230, 0.10)',
    marginHorizontal: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 14, // room for the Clear chip to overlay on the right
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
    width: 28,
    height: 28,
    marginLeft: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two stacked semi-transparent bands fake the gradient mask. Stops 1 px
  // short of the Clear chip so the chip border stays visible when on.
  fadeOuter: {
    position: 'absolute',
    right: 30,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: Colors.background,
    opacity: 0.6,
  },
  fadeInner: {
    position: 'absolute',
    right: 30,
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
