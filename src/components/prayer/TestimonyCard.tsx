// ─────────────────────────────────────────────
// TestimonyCard — KAN-23 v2 (Ticket D)
//
// One testimony in the testimonies list. Distinguished from a prayer
// card by a 3 pt green left border (vs 2 pt sky/red on prayer cards),
// 4-line body clamp (vs 3), no chevron, and a permanent "Testimony"
// tag (NEVER a category chip — locked by dispatch).
//
// Optional "Originally posted as:" quote block renders when the wire
// shape includes original_request_id. get_landing_testimonies skips
// the join and emits original_text=null, so the rotator never shows
// the quote; get_testimonies includes it.
//
// Celebrate tap is a write STUB — optimistic flip of iCelebrated +
// count ±1 with a small scale + sparkle animation. Reduced motion
// drops the animation. RPC wiring is pending SEC checkpoint.
//
// Deep-link glow: when isHighlighted is true (parent passes this for
// the target testimony arriving from the landing rotator), a 1.6 s
// green pulse animation overlays the card.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  type TestimonyRow,
} from './PrayerWallLogic';
import { CelebrateIcon } from './PrayerIcons';

interface Props {
  row: TestimonyRow;
  isHighlighted?: boolean;
  now?: Date;
}

const GLOW_DURATION_MS = 1600;
const CELEBRATE_BURST_MS = 600;

export default function TestimonyCard({ row, isHighlighted = false, now }: Props) {
  const reduced = useReducedMotion();
  const [iCelebrated, setICelebrated] = useState(row.i_celebrated);
  const [celebrateCount, setCelebrateCount] = useState(row.celebrated_count);
  const burst = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isHighlighted) return;
    if (reduced) {
      glow.setValue(0.5);
      const t = setTimeout(() => glow.setValue(0), GLOW_DURATION_MS);
      return () => clearTimeout(t);
    }
    Animated.sequence([
      Animated.timing(glow, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: GLOW_DURATION_MS - 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [isHighlighted, reduced, glow]);

  const handleCelebrate = () => {
    // TODO: wire celebrate RPC — pending SEC checkpoint.
    // Optimistic flip only; nothing is persisted. The real RPC lives in
    // a follow-up ticket and may apply server-side rate-limiting.
    setICelebrated((prev) => {
      const next = !prev;
      setCelebrateCount((c) => c + (next ? 1 : -1));
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

  const scale = burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1.2] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const locationLine = getLocationLine(row.church_name, row.country);
  const leaderLine = getLeaderLine(row.leader_display_name);
  const timestamp = formatRelativeTime(row.created_at, now);

  return (
    <View style={styles.card}>
      {/* Deep-link glow overlay — sits on top, pointer-events: none. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glowOpacity }]}
      />

      <Text style={styles.location} numberOfLines={1}>
        {locationLine.toUpperCase()}
      </Text>
      <Text style={styles.leader} numberOfLines={1}>{leaderLine}</Text>

      <Text style={styles.body} numberOfLines={4}>
        {row.testimony_text}
      </Text>

      {row.original_request_id !== null && row.original_text ? (
        <View style={styles.quote}>
          <Text style={styles.quoteLabel}>Originally posted as:</Text>
          <Text style={styles.quoteText} numberOfLines={3}>{row.original_text}</Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {/* Always "Testimony" — never a category chip. Locked. */}
        <View style={styles.testimonyChip}>
          <Text style={styles.testimonyChipText}>Testimony</Text>
        </View>
        <Pressable
          onPress={handleCelebrate}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={iCelebrated ? 'Un-celebrate' : 'Celebrate'}
          style={styles.celebrateWrap}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <CelebrateIcon size={14} color={iCelebrated ? Colors.amber : Colors.textMuted} />
          </Animated.View>
          <Text style={[styles.celebrateCount, iCelebrated && styles.celebrateCountActive]}>
            {celebrateCount}
          </Text>
        </Pressable>
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(91, 173, 122, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
    borderWidth: 0.25,
    borderColor: 'rgba(91, 173, 122, 0.20)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(91, 173, 122, 0.55)',
  },
  location: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.green,
  },
  leader: {
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  body: {
    marginTop: 6,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  quote: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(240, 237, 230, 0.04)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.green,
  },
  quoteLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  quoteText: {
    marginTop: 2,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  testimonyChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(91, 173, 122, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 173, 122, 0.35)',
  },
  testimonyChipText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.0,
    color: Colors.green,
    textTransform: 'uppercase',
  },
  celebrateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  celebrateCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },
  celebrateCountActive: {
    color: Colors.amber,
  },
  timestamp: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
