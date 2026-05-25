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
  getLeaderLine,
  getLocationLine,
  type TestimonyRow,
} from './PrayerWallLogic';
import { CelebrateIcon } from './PrayerIcons';

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
  const leaderLine = getLeaderLine(row.leader_display_name);
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
        {/* Passive celebrate display — no Pressable. Fed directly
            from row props so the parent's onCelebratedChange row swap
            propagates here on the next render. */}
        <View
          style={styles.celebrateWrap}
          accessible
          accessibilityLabel={`${row.celebrated_count} celebrating`}
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
  cardPressed: {
    opacity: 0.85,
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
    // v6 Fix G — display-only (no tap-hit-target). Icon + count
    // shown side-by-side with 4 pt gap. The tap path lives in
    // TestimonyDetailSheet.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
