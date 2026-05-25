// ─────────────────────────────────────────────
// TestimonyDetailSheet — KAN-23 v6 (Fix G)
//
// Bottom sheet for a single testimony. Founder ruling: tapping a
// testimony card in the testimonies list opens this sheet with the
// full testimony text (no clamp), the optional "Originally prayed as:"
// quote block (when original_request_id is set), a celebrate row, and
// a timestamp.
//
// Animation pattern is the same as PrayerWallDetailSheet — 320 ms
// cubic ease-out slide-up, dim backdrop 0 → 0.55 (no expo-blur).
// Dismiss via ✕ tap, backdrop tap, or swipe-down.
//
// Celebrate row is a STUB — optimistic local toggle of iCelebrated +
// count ±1 + `// TODO: wire celebrate RPC — pending SEC checkpoint`
// at the call site. onCelebratedChange fires on dismiss only when the
// state has actually changed (mirrors onPrayedChange on the prayer
// detail sheet) so the testimony list row reflects the new state
// without a server round-trip.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import {
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  hasPrayedStateChanged,
  type TestimonyRow,
} from './PrayerWallLogic';
import { CelebrateIcon, XIcon } from './PrayerIcons';

interface Props {
  row: TestimonyRow | null;
  onDismiss: () => void;
  /**
   * Fires on every dismiss path (✕, backdrop, swipe-down) when the
   * leader's celebrate state changed during this sheet session.
   * Suppressed when state matches the row's initial values (silent
   * dismiss, no fire). Parent uses it to mirror the new
   * i_celebrated / celebrated_count back to the testimony list row.
   *
   * STUB note: the real celebrate RPC is pending SEC checkpoint; until
   * then this is optimistic-UI mirror only.
   */
  onCelebratedChange?: (testimonyId: string, iCelebrated: boolean, celebratedCount: number) => void;
  now?: Date;
}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX_RATIO = 0.88;
const SHEET_HEIGHT = SCREEN_H * SHEET_MAX_RATIO;
const ANIM_MS = 320;
const SWIPE_DISMISS_THRESHOLD = 80;
const CELEBRATE_BURST_MS = 600;

export default function TestimonyDetailSheet({
  row,
  onDismiss,
  onCelebratedChange,
  now,
}: Props) {
  const reduced = useReducedMotion();
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Local optimistic state — write stub.
  const [iCelebrated, setICelebrated] = useState(row?.i_celebrated ?? false);
  const [celebratedCount, setCelebratedCount] = useState(row?.celebrated_count ?? 0);

  // Sync local state when row changes (e.g., opening a different card
  // without an intervening unmount).
  useEffect(() => {
    if (row !== null) {
      setICelebrated(row.i_celebrated);
      setCelebratedCount(row.celebrated_count);
    }
  }, [row]);

  useEffect(() => {
    if (row !== null) {
      setMounted(true);
      if (reduced) {
        slideY.setValue(0);
        backdropOpacity.setValue(0.55);
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0.55,
            duration: ANIM_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (mounted) {
      const done = () => setMounted(false);
      if (reduced) {
        slideY.setValue(SHEET_HEIGHT);
        backdropOpacity.setValue(0);
        done();
      } else {
        Animated.parallel([
          Animated.timing(slideY, {
            toValue: SHEET_HEIGHT,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 0,
            duration: ANIM_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(done);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, reduced]);

  // Dispatch dismiss path — fires onCelebratedChange iff state changed,
  // then onDismiss. Same pattern as PrayerWallDetailSheet.
  // hasPrayedStateChanged is reused for the celebrate axis (same
  // boolean+count shape — "did the row's i_X flag or X_count differ
  // from initial").
  const handleDismiss = () => {
    if (
      row !== null &&
      onCelebratedChange &&
      hasPrayedStateChanged(
        { i_prayed: row.i_celebrated, prayed_count: row.celebrated_count },
        { i_prayed: iCelebrated, prayed_count: celebratedCount },
      )
    ) {
      onCelebratedChange(row.id, iCelebrated, celebratedCount);
    }
    onDismiss();
  };

  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => {
    handleDismissRef.current = handleDismiss;
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_DISMISS_THRESHOLD) {
          handleDismissRef.current();
        } else {
          Animated.timing(slideY, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const handleCelebrate = () => {
    // TODO: wire celebrate RPC — pending SEC checkpoint.
    // Optimistic flip only; nothing is persisted. The leader sees
    // their toggle reflected locally; on next testimonies reload the
    // server-truth value overwrites this. Do NOT remove this TODO
    // until the RPC + SEC ruling are in place.
    setICelebrated((prev) => {
      const next = !prev;
      setCelebratedCount((c) => c + (next ? 1 : -1));
      return next;
    });
    if (reduced) return;
    burst.setValue(0);
    Animated.sequence([
      Animated.timing(burst, {
        toValue: 1,
        duration: CELEBRATE_BURST_MS / 2,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        toValue: 0,
        duration: CELEBRATE_BURST_MS / 2,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const burstScale = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1.2] });

  if (!mounted || row === null) return null;

  // KAN-23 corrections r1 — church type removed from card headers;
  // same rule applies to the sheet header. Identity = name + country
  // only; underground collapses via getLocationLine's null branch.
  const locationLine = getLocationLine(row.church_name, row.country);
  const leaderLine = getLeaderLine(row.leader_display_name);
  const timestamp = formatRelativeTime(row.created_at, now);
  const hasOriginal = row.original_request_id !== null && row.original_text;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — dim + tap-to-dismiss. */}
      <Pressable
        onPress={handleDismiss}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Dismiss testimony"
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000', opacity: backdropOpacity },
          ]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.grabHandle} />

        <View style={styles.headerRow}>
          <Text style={styles.headerLocation} numberOfLines={2}>
            {locationLine.toUpperCase()}
          </Text>
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <XIcon size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.leaderLine}>{leaderLine}</Text>

        {/* Full testimony text — no clamp. */}
        <Text style={styles.body}>{row.testimony_text}</Text>

        {/* Optional "Originally prayed as:" quote block. */}
        {hasOriginal ? (
          <View style={styles.quote}>
            <Text style={styles.quoteLabel}>Originally prayed as:</Text>
            <Text style={styles.quoteText}>{row.original_text}</Text>
          </View>
        ) : null}

        {/* Celebrate row + timestamp. */}
        <View style={styles.metaRow}>
          <Pressable
            onPress={handleCelebrate}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={iCelebrated ? 'Un-celebrate' : 'Celebrate'}
            style={styles.celebrateCta}
          >
            <Animated.View style={{ transform: [{ scale: burstScale }] }}>
              <CelebrateIcon
                size={20}
                color={iCelebrated ? Colors.amber : Colors.textMuted}
              />
            </Animated.View>
            <Text
              style={[
                styles.celebrateLabel,
                iCelebrated && styles.celebrateLabelActive,
              ]}
            >
              {iCelebrated ? "You're celebrating" : 'Celebrate'}
            </Text>
            <Text
              style={[
                styles.celebrateCount,
                iCelebrated && styles.celebrateCountActive,
              ]}
            >
              {celebratedCount}
            </Text>
          </Pressable>
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 26,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(240, 237, 230, 0.18)',
    marginTop: 8,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLocation: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: 16,
    color: Colors.green,
  },
  leaderLine: {
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  body: {
    // Fix G — body 19 pt Cormorant italic, line-height 1.65 (same as
    // PrayerWallDetailSheet after Fix F). Bundle has no italic 300;
    // using displayMediumItalic (500).
    marginTop: 16,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 19,
    color: Colors.text,
    lineHeight: 31, // 19 × 1.65
  },
  quote: {
    // Mirror of the testimony-card quote block: green left-border,
    // rgba(text, 0.04) bg, 13 pt DM Sans italic body. Sheet version
    // has slightly more breathing room since the sheet has room.
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(240, 237, 230, 0.04)',
    borderLeftWidth: 1,
    borderLeftColor: Colors.green,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  quoteLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.3,
    color: 'rgba(240, 237, 230, 0.45)',
    textTransform: 'uppercase',
    fontStyle: 'italic',
  },
  quoteText: {
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 13,
    color: 'rgba(240, 237, 230, 0.45)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  celebrateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 168, 85, 0.45)',
    backgroundColor: 'rgba(212, 168, 85, 0.08)',
  },
  celebrateLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.amber,
  },
  celebrateLabelActive: {
    color: Colors.amber,
  },
  celebrateCount: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.textMuted,
  },
  celebrateCountActive: {
    color: Colors.amber,
  },
  timestamp: {
    // Fix G — 13 pt DM Mono, --muted, right-aligned.
    fontFamily: Typography.mono,
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
