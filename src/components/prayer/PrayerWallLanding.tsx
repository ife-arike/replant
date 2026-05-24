// ─────────────────────────────────────────────
// PrayerWallLanding — KAN-23 v2 (Ticket C)
//
// Default view on the Prayer Wall tab. Scripture-first surface (Eph
// 6:18 KJV, never truncated), two action cards (Make intercession /
// Receive intercession), a "view my open prayers" quick-link, and a
// rotating testimony card at the bottom.
//
// Hard rule: Eph 6:18 renders in full at every device width. No
// numberOfLines, no ellipsis. If it doesn't fit, the line wraps to
// more lines.
//
// Receive intercession is feature-gated. Verified leaders see a Coming
// Soon CTA that surfaces an Alert. Pending leaders see the same card
// at 55% opacity with no CTA tap.
//
// Testimony rotator data: supabase.rpc('get_landing_testimonies') on
// mount. Up to ~5 rotated through, 5.0 s per card with 250 ms fade
// in/out. Tap-card or "See all →" routes to the testimonies view.
// Long-press pauses auto-advance; reduced motion disables auto-
// advance and makes dots tappable.
//
// Zero testimonies: rotator block hidden entirely.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useReducedMotion } from '../../utils/useReducedMotion';
import {
  getLeaderLine,
  getLocationLine,
  type TestimonyRow,
} from './PrayerWallLogic';
import { GlassIcon, IncenseIcon, LockIcon } from './PrayerIcons';

// Eph 6:18 (KJV) — locked in full. NEVER truncate.
const EPH_6_18_KJV =
  'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints;';
const EPH_6_18_REF = 'EPHESIANS 6:18 · KJV';

const ROTATOR_INTERVAL_MS = 5000;
const ROTATOR_FADE_MS = 250;
const MAX_DOTS = 5;

interface Props {
  onEnterFeed: () => void;
  onSeeAllTestimonies: () => void;
  onOpenTestimony: (testimonyId: string) => void;
  onViewMyOpenPrayers: () => void;
}

export default function PrayerWallLanding({
  onEnterFeed,
  onSeeAllTestimonies,
  onOpenTestimony,
  onViewMyOpenPrayers,
}: Props) {
  const { branch } = useAuth();
  const isVerified = branch === 'active';

  return (
    <View style={styles.root}>
      {/* Scripture block — never truncated. */}
      <View style={styles.scriptureBlock}>
        <Text style={styles.scriptureText}>{EPH_6_18_KJV}</Text>
        <Text style={styles.scriptureRef}>{EPH_6_18_REF}</Text>
      </View>

      {/* Action cards */}
      <View style={styles.actionStack}>
        <ActionCard
          accent="sky"
          icon={<IncenseIcon size={24} color={Colors.accent} />}
          title="Make intercession"
          subtitle="Pray through the wall of requests from churches around the world."
          ctaLabel="Enter the prayer wall"
          ctaVariant="solid"
          onPress={onEnterFeed}
        />
        <ReceiveIntercessionCard isVerified={isVerified} />
      </View>

      {/* Quick-link */}
      <Pressable
        onPress={onViewMyOpenPrayers}
        accessibilityRole="button"
        hitSlop={6}
        style={styles.quickLink}
      >
        <Text style={styles.quickLinkText}>View my open prayers →</Text>
      </Pressable>

      {/* Testimony rotator (hidden when zero testimonies) */}
      <TestimonyRotator
        onSeeAll={onSeeAllTestimonies}
        onOpenTestimony={onOpenTestimony}
      />
    </View>
  );
}

// ─── Action cards ─────────────────────────────────────────────────────

interface ActionCardProps {
  accent: 'sky' | 'green';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaVariant: 'solid' | 'locked';
  onPress?: () => void;
  cornerPill?: React.ReactNode;
  dimmed?: boolean;
  hintBelow?: string;
}

function ActionCard({
  accent,
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaVariant,
  onPress,
  cornerPill,
  dimmed,
  hintBelow,
}: ActionCardProps) {
  const borderColor = accent === 'sky' ? Colors.borderAccent : 'rgba(91, 173, 122, 0.30)';
  const iconBg = accent === 'sky' ? 'rgba(107, 181, 232, 0.10)' : 'rgba(91, 173, 122, 0.10)';

  return (
    <View style={[styles.actionCard, { borderColor, opacity: dimmed ? 0.55 : 1 }]}>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg, borderColor }]}>
          {icon}
        </View>
        {cornerPill}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      {ctaVariant === 'solid' ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cardCta,
            styles.cardCtaSolid,
            pressed && styles.cardCtaPressed,
          ]}
        >
          <Text style={styles.cardCtaTextSolid}>{ctaLabel}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onPress }}
          disabled={!onPress}
          style={({ pressed }) => [
            styles.cardCta,
            styles.cardCtaLocked,
            pressed && onPress && styles.cardCtaPressed,
          ]}
        >
          <LockIcon size={14} color={Colors.textMuted} />
          <Text style={styles.cardCtaTextLocked}>{ctaLabel}</Text>
        </Pressable>
      )}
      {hintBelow ? <Text style={styles.cardHint}>{hintBelow}</Text> : null}
    </View>
  );
}

function ReceiveIntercessionCard({ isVerified }: { isVerified: boolean }) {
  const handlePress = () => {
    // Coming-soon alert per dispatch — verified leaders only see this.
    // The actual "receive intercession" surface is a follow-up ticket.
    Alert.alert(
      'Receive intercession',
      'This is coming soon. For now, your church can request prayer by writing to us at connect@projectreplant.org.',
    );
  };

  return (
    <ActionCard
      accent="green"
      icon={<GlassIcon size={24} color={Colors.green} />}
      title="Receive intercession"
      subtitle="Let the body stand with your church in prayer."
      ctaLabel="Coming soon"
      ctaVariant="locked"
      onPress={isVerified ? handlePress : undefined}
      cornerPill={<ComingSoonPill />}
      dimmed={!isVerified}
      hintBelow={isVerified ? undefined : 'Available after your church is verified'}
    />
  );
}

function ComingSoonPill() {
  return (
    <View style={styles.comingSoonPill}>
      <Text style={styles.comingSoonText}>Coming soon</Text>
    </View>
  );
}

// ─── Testimony rotator ────────────────────────────────────────────────

interface RotatorProps {
  onSeeAll: () => void;
  onOpenTestimony: (id: string) => void;
}

function TestimonyRotator({ onSeeAll, onOpenTestimony }: RotatorProps) {
  const reduced = useReducedMotion();
  const [rows, setRows] = useState<TestimonyRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_landing_testimonies');
      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        return;
      }
      setRows((data as TestimonyRow[]).slice(0, MAX_DOTS));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dots = Math.min(rows.length, MAX_DOTS);

  // Auto-advance with cross-fade. Reduced-motion disables auto-advance
  // and replaces it with tappable dots (the dot row below).
  useEffect(() => {
    if (reduced || paused || rows.length < 2) return;
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: ROTATOR_FADE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setIdx((i) => (i + 1) % rows.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: ROTATOR_FADE_MS,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    }, ROTATOR_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [reduced, paused, rows.length, idx, fade]);

  const goToDot = useCallback(
    (i: number) => {
      if (!reduced) return; // dots only tappable when reduced motion is on
      setIdx(i);
    },
    [reduced],
  );

  if (rows.length === 0) return null;

  const current = rows[idx];
  const location = getLocationLine(current.church_name, current.country);
  const leader = getLeaderLine(current.leader_display_name);

  return (
    <View style={styles.rotatorWrap}>
      <View style={styles.rotatorLabelRow}>
        <Text style={styles.rotatorLabel}>Testimonies</Text>
        <Pressable onPress={onSeeAll} hitSlop={6} accessibilityRole="button">
          <Text style={styles.rotatorSeeAll}>See all →</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => onOpenTestimony(current.id)}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        accessibilityRole="button"
        accessibilityLabel={`Open testimony from ${current.church_name}`}
      >
        <Animated.View style={[styles.rotatorCard, { opacity: fade }]}>
          <Text style={styles.rotatorLocation} numberOfLines={1}>
            {location.toUpperCase()}
          </Text>
          <Text style={styles.rotatorLeader} numberOfLines={1}>
            {leader}
          </Text>
          <Text style={styles.rotatorText} numberOfLines={4}>
            {current.testimony_text}
          </Text>
        </Animated.View>
      </Pressable>
      {dots > 1 ? (
        <View style={styles.dotsRow}>
          {Array.from({ length: dots }).map((_, i) => (
            <Pressable
              key={i}
              onPress={() => goToDot(i)}
              disabled={!reduced}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Testimony ${i + 1} of ${dots}`}
            >
              <View
                style={[
                  styles.dot,
                  i === idx ? styles.dotActive : styles.dotIdle,
                  paused && styles.dotPaused,
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scriptureBlock: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  scriptureText: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 25,
  },
  scriptureRef: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.0,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  actionStack: {
    paddingHorizontal: 28,
    gap: 12,
  },
  actionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  cardCta: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardCtaSolid: {
    backgroundColor: Colors.accent,
  },
  cardCtaLocked: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cardCtaPressed: {
    opacity: 0.85,
  },
  cardCtaTextSolid: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background,
  },
  cardCtaTextLocked: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  cardHint: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  comingSoonPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(212, 168, 85, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212, 168, 85, 0.45)',
  },
  comingSoonText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.amber,
    textTransform: 'uppercase',
  },
  quickLink: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'flex-start',
  },
  quickLinkText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.accent,
  },
  rotatorWrap: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  rotatorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rotatorLabel: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.green,
    textTransform: 'uppercase',
  },
  rotatorSeeAll: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.green,
  },
  rotatorCard: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.green,
    backgroundColor: 'rgba(91, 173, 122, 0.06)',
    borderWidth: 0.25,
    borderColor: 'rgba(91, 173, 122, 0.20)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    padding: 14,
    minHeight: 132,
  },
  rotatorLocation: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.green,
  },
  rotatorLeader: {
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  rotatorText: {
    marginTop: 8,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.green,
  },
  dotIdle: {
    backgroundColor: Colors.green,
    opacity: 0.3,
  },
  dotPaused: {
    opacity: 0.5,
  },
});
