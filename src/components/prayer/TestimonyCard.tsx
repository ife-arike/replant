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
            <CelebrateIcon size={16} color={iCelebrated ? Colors.amber : Colors.textMuted} />
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
    // v5 item 06 — fill rgba(91,173,122,0.06), border 0.5 pt
    // rgba(91,173,122,0.20) (was 0.25 — redline locks 0.5 / hairline),
    // 3 pt green left-border, padding 14 × 16.
    backgroundColor: 'rgba(91, 173, 122, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 173, 122, 0.20)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    // v5 item 06 — location 13 pt DM Mono 400, 0.16em UPPERCASE green.
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 2.1,
    color: Colors.green,
  },
  leader: {
    // 13 pt DM Sans (bundle has no 300; using 400), rgba(text, 0.45).
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 13,
    color: 'rgba(240, 237, 230, 0.45)',
  },
  body: {
    // v5 item 06 — body 15 → 17 pt Cormorant italic, line-height 1.6,
    // --text. Bundle has no italic 300; using displayMediumItalic.
    marginTop: 8,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 17,
    color: Colors.text,
    lineHeight: 27,
  },
  quote: {
    // v5 item 06 — "Originally posted as:" block — bg rgba(text, 0.04),
    // 1 pt green left-border, padding 8 × 10 pt, radius 0 4 4 0.
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    // 13 pt DM Sans 300 (closest: 400) muted.
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 13,
    color: 'rgba(240, 237, 230, 0.45)',
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  testimonyChip: {
    // v5 item 06 — chip padding 3 × 8 pt, radius 3, bg
    // rgba(91,173,122,0.12). Always reads "Testimony" — never a
    // category chip (locked).
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(91, 173, 122, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91, 173, 122, 0.35)',
  },
  testimonyChipText: {
    // v5 item 06 — 11 pt DM Mono 400, 0.14em UPPERCASE green.
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.green,
    textTransform: 'uppercase',
  },
  celebrateWrap: {
    // v5 item 06 — 28 pt tap-hit-target around the 16 pt icon.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 4,
  },
  celebrateCount: {
    // v5 item 06 — count 12 pt DM Mono, 4 pt gap (set via gap above).
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.textMuted,
  },
  celebrateCountActive: {
    color: Colors.amber,
  },
  timestamp: {
    // v5 item 06 — 11 pt DM Mono, --muted, 0.08em right-aligned.
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 0.9,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
