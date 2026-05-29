// ─────────────────────────────────────────────
// TestimonyCard — KAN-23 v6 (Fix G — pressable wrapper)
//
// One testimony in the testimonies list. Distinguished from a prayer
// card by a 3 pt green left border (vs 2 pt sky/red on prayer cards),
// 4-line body clamp (vs 3), no chevron, and a permanent "Testimony"
// tag (NEVER a category chip — locked by dispatch).
//
// v6 Fix G — card is now a Pressable whose onPress surfaces to the
// parent (TestimoniesView) so it can open TestimonyDetailSheet. The
// celebrate icon in the meta row is DISPLAY-ONLY (no Pressable,
// not tappable) — confirmation lives only inside the sheet, same
// pattern as PrayerWallCard's heart vs PrayerWallDetailSheet's
// stand-in-the-gap CTA.
//
// Optional "Originally posted as:" quote block renders when the wire
// shape includes original_request_id. get_landing_testimonies skips
// the join and emits original_text=null, so the rotator never shows
// the quote; get_testimonies includes it.
//
// Deep-link glow: when isHighlighted is true (parent passes this for
// the target testimony arriving from the landing rotator), a 1.6 s
// green pulse animation overlays the card.
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
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
  getLocationLine,
  type TestimonyRow,
} from './PrayerWallLogic';
import { formatLeaderLine } from '../../utils/displayHelpers';
import { CelebrateIcon } from './PrayerIcons';

/**
 * v8 Fix G — shared body style for TestimonyCard +
 * TestimonyDetailSheet. Same 18 pt Cormorant 500 Medium Italic as
 * PRAYER_BODY_STYLE — both card types now match per Founder ruling
 * (prayer and testimony body weights should not differ at the same
 * size). Kept as a separate const from PRAYER_BODY_STYLE so the two
 * surfaces can diverge later without touching each other.
 */
export const TESTIMONY_BODY_STYLE = {
  fontFamily: Typography.displayMediumItalic,
  fontSize: 18,
  lineHeight: 27, // 18 × 1.50
  color: Colors.text,
} as const;

interface Props {
  row: TestimonyRow;
  isHighlighted?: boolean;
  /** v6 Fix G — tap opens TestimonyDetailSheet on the parent. */
  onPress: (row: TestimonyRow) => void;
  now?: Date;
}

const GLOW_DURATION_MS = 1600;

export default function TestimonyCard({ row, isHighlighted = false, onPress, now }: Props) {
  const reduced = useReducedMotion();
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

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  const locationLine = getLocationLine(row.church_name, row.country);
  // v8 Fix H3 — attribution flows through shared formatLeaderLine
  // helper. isAnonymous derived from leader_display_name === null
  // (server-side mask returns null for anonymous + underground
  // posts; no separate wire flag).
  const leaderLine = formatLeaderLine(
    row.leader_role,
    row.leader_display_name,
    row.leader_display_name === null,
  );
  const timestamp = formatRelativeTime(row.created_at, now);

  // v6 Fix G — card is a Pressable wrapping the existing chrome. The
  // celebrate icon + count in the meta row below are display-only
  // (no Pressable, no internal state) — the tap path for celebrate
  // lives inside TestimonyDetailSheet. Card body / quote block / meta
  // taps all fall through to onPress, opening the sheet.
  return (
    <Pressable
      onPress={() => onPress(row)}
      accessibilityRole="button"
      accessibilityLabel={`Open testimony from ${row.church_name}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Deep-link glow overlay — sits on top, pointer-events: none. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glowOpacity }]}
      />

      <Text style={styles.location} numberOfLines={1}>
        {locationLine}
      </Text>
      <Text style={styles.leader} numberOfLines={1}>{leaderLine}</Text>

      <Text style={[styles.body, TESTIMONY_BODY_STYLE]} numberOfLines={4}>
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
        {/* Passive celebrate display — no Pressable. Fed directly
            from row props so the parent's onCelebratedChange row swap
            propagates here on the next render. */}
        <View
          style={styles.celebrateWrap}
          accessible
          accessibilityLabel={`${row.celebrated_count} rejoicing`}
        >
          <CelebrateIcon
            size={16}
            color={row.i_celebrated ? Colors.amber : Colors.textMuted}
          />
          <Text
            style={[
              styles.celebrateCount,
              row.i_celebrated && styles.celebrateCountActive,
            ]}
          >
            {row.celebrated_count}
          </Text>
        </View>
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(107, 181, 232, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.20)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(107, 181, 232, 0.55)',
  },
  location: {
    // v7 Item 08 — 14 pt DM Sans 400 sentence case (was 13 pt mono
    // UPPERCASE). letter-spacing 0.02em × 14 ≈ 0.28 pt. Reads as a
    // church name, not a label.
    fontFamily: Typography.body,
    fontSize: 14,
    letterSpacing: 0.28,
    color: Colors.accent,
  },
  leader: {
    // v8 Fix H3 — attribution 14 pt DM Sans 400, lh 1.3, muted-45%.
    // Directly below the Church · Country (green) line with 2 pt
    // top-margin. Content formatted via formatLeaderLine: role
    // prefix + name, or "A fellow leader" when anonymous/underground.
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 18, // 14 × 1.3 ≈ 18.2
    color: 'rgba(240, 237, 230, 0.45)',
  },
  body: {
    // v8 Fix G — type values sourced from the shared
    // TESTIMONY_BODY_STYLE constant (exported above). This style
    // block owns only card-specific positioning (marginTop).
    marginTop: 8,
  },
  quote: {
    // v5 item 06 — "Originally posted as:" block — bg rgba(text, 0.04),
    // 1 pt green left-border, padding 8 × 10 pt, radius 0 4 4 0.
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(240, 237, 230, 0.04)',
    borderLeftWidth: 1,
    borderLeftColor: Colors.accent,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  quoteLabel: {
    // v7 Item 08 — 11 pt DM Sans 400 0.15em UPPERCASE (was 10 pt mono).
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 1.65, // 0.15em × 11
    color: 'rgba(240, 237, 230, 0.45)',
    textTransform: 'uppercase',
  },
  quoteText: {
    // v7 Item 07 — 14 pt DM Sans 300 Light, lh 1.55, rgba(text, 0.55).
    // Native 300 Light via Typography.sansLight.
    marginTop: 4,
    fontFamily: Typography.sansLight,
    fontSize: 14,
    color: 'rgba(240, 237, 230, 0.55)',
    lineHeight: 22, // 14 × 1.55 ≈ 21.7
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
    backgroundColor: 'rgba(107, 181, 232, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.35)',
  },
  testimonyChipText: {
    // v5 item 06 — 11 pt DM Mono 400, 0.14em UPPERCASE green.
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  celebrateWrap: {
    // v6 Fix G — display-only (no tap-hit-target). Icon + count
    // shown side-by-side with 4 pt gap. The tap path lives in
    // TestimonyDetailSheet.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  celebrateCount: {
    // v7 Item 08 — 12 pt DM Sans 400 (was DM Mono).
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  celebrateCountActive: {
    color: Colors.amber,
  },
  timestamp: {
    // v7 Item 08 — 11 pt DM Sans 400, sentence case, no tracking
    // (was 11 pt mono 0.08em).
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
});
