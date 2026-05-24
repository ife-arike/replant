// ─────────────────────────────────────────────
// PrayerWallFilterBar — KAN-23 v2 (Ticket A, amended for multi-select)
//
// Two-axis filter strip: Urgent chip on the left, vertical divider,
// then 8 category chips on the right. Category chips are multi-select
// — tapping toggles a chip in/out of the selected Set. The Clear chip
// pins to the right edge the moment any axis is non-default; one tap
// restores defaults with no confirm.
//
// At 3+ active categories the chip strip promotes to a 2-row stack:
// active categories on top, idle below. This branch is now reachable
// under multi-select and is implemented as a conditional layout switch
// (single horizontal scroll row vs two stacked horizontal scroll rows).
//
// Below the strip, an active-count strip animates in (height 0 → 36 pt)
// naming the active filters + result count.
//
// Filtering is server-side in v2 — this component is presentation-only.
// The parent (PrayerWallScreen) observes onCategoryToggle /
// onUrgencyChange / onClear and re-runs the RPC.
//
// Reduced motion: useReducedMotion() drops the height-grow animation
// on the active-count strip to a 1-frame swap.
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
const STACK_THRESHOLD = 3; // promote to 2-row stack when this many cats are active

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
  const promoteToStack = selectedCategories.size >= STACK_THRESHOLD;

  // Active-count strip — animated height.
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
    onUrgencyChange(urgentActive ? 'All' : 'Urgent');
  };

  // Split the 8 categories into active vs idle. Active preserves the
  // dispatch order (the order in CATEGORIES), not tap order — keeps
  // the stacked row reading consistently between toggles. Idle keeps
  // the same dispatch order.
  const activeCats = CATEGORIES.filter((c) => selectedCategories.has(c));
  const idleCats = CATEGORIES.filter((c) => !selectedCategories.has(c));

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <UrgentChip active={urgentActive} onPress={handleUrgentToggle} />
        <View style={styles.divider} />

        <View style={styles.chipArea}>
          {promoteToStack ? (
            <View style={styles.stackColumn}>
              <ChipRow
                cats={activeCats}
                selectedCategories={selectedCategories}
                onToggle={onCategoryToggle}
              />
              <ChipRow
                cats={idleCats}
                selectedCategories={selectedCategories}
                onToggle={onCategoryToggle}
                style={styles.stackIdleRow}
              />
            </View>
          ) : (
            <ChipRow
              cats={CATEGORIES as readonly PrayerCategory[]}
              selectedCategories={selectedCategories}
              onToggle={onCategoryToggle}
            />
          )}

          {/* Right-edge fade — fakes the gradient mask without
              expo-linear-gradient (not installed). */}
          <View pointerEvents="none" style={styles.fadeOuter} />
          <View pointerEvents="none" style={styles.fadeInner} />
        </View>

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

function ChipRow({
  cats,
  selectedCategories,
  onToggle,
  style,
}: {
  cats: readonly PrayerCategory[];
  selectedCategories: SelectedCategories;
  onToggle: (cat: PrayerCategory) => void;
  style?: object;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={[styles.scroll, style]}
    >
      {cats.map((cat, i) => (
        <CategoryChip
          key={cat}
          label={cat}
          active={selectedCategories.has(cat)}
          onPress={() => onToggle(cat)}
          first={i === 0}
        />
      ))}
    </ScrollView>
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
  first,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  first: boolean;
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
        !first && styles.chipGap,
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
  chipArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 14,
  },
  stackColumn: {
    gap: 6,
  },
  stackIdleRow: {
    opacity: 0.85,
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
