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
  ScrollView,
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
import { CandleIcon, IncenseIcon, LockIcon } from './PrayerIcons';
import ScriptureBanner from './ScriptureBanner';

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

  // v6 fix A — landing now scrolls. Tab bar sticks outside (TabNavigator
  // owns it); top bar + hairline divider sit above this ScrollView in
  // PrayerWallScreen. ContentContainer carries the trailing padding so
  // the rotator's dots don't graze the tab bar.
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* v6 fix D — Eph 6:18 wrapped in a sky-tinted ScriptureBanner
          matching the Rev 12:11 treatment on Testimonies. NEVER
          truncates. 24 pt top + bottom margin enforced by the
          banner's parent gaps. */}
      <View style={styles.scriptureWrap}>
        <ScriptureBanner
          tone="sky"
          text={EPH_6_18_KJV}
          reference={EPH_6_18_REF}
        />
      </View>

      {/* Action cards — v6 fix C: icon-LEFT layout, 18 pt gap, title
          26 pt / sub 15 pt / CTA 16 pt. */}
      <View style={styles.actionStack}>
        <ActionCard
          accent="sky"
          icon={<IncenseIcon size={30} color={Colors.accent} />}
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
    </ScrollView>
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
  const isLocked = ctaVariant === 'locked';

  // v6 fix C — icon-LEFT layout. Head row uses flex with alignItems
  // 'center' so the 60 pt circle vertically centres against the
  // title+description stack. Title and description are LEFT-aligned;
  // cornerPill (Coming soon) no longer lives next to the icon — it
  // now centres above the locked CTA per v6 spec, below the head row.
  return (
    <View style={[styles.actionCard, { borderColor, opacity: dimmed ? 0.55 : 1 }]}>
      <View style={styles.cardHeadRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg, borderColor }]}>
          {icon}
        </View>
        <View style={styles.cardTextCol}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* Coming soon pill — only on locked CTAs, centred above. */}
      {isLocked && cornerPill ? (
        <View style={styles.pillSlot}>{cornerPill}</View>
      ) : null}

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

      {/* Disabled hint — centered below locked CTA, 10 pt above. */}
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
      icon={<CandleIcon size={30} color={Colors.green} />}
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
    // v6 fix A — ScrollView wrapper. flex:1 inside the parent
    // SafeAreaView so the scroll container takes the remaining height
    // after top bar + hairline.
    flex: 1,
  },
  scrollContent: {
    // Trailing breath so the testimony rotator's dots don't graze the
    // tab bar at the bottom of the screen.
    paddingBottom: 40,
  },
  scriptureWrap: {
    // v6 fix D — sky banner is full-width minus a 24 pt safe area,
    // with 24 pt above (gap from top-bar hairline) and 24 pt below
    // (gap above the first action card).
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 24,
  },
  actionStack: {
    paddingHorizontal: 24,
    gap: 12,
  },
  actionCard: {
    // v6 fix C — padding 22 top / 22 horizontal / 20 bottom.
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface,
  },
  cardHeadRow: {
    // v6 fix C — icon-LEFT row: 18 pt gap between icon and text column,
    // vertical centring. marginBottom 14 sets the gap before the pill
    // (or directly to the CTA if no pill).
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 14,
  },
  cardTextCol: {
    // flex:1 lets the title + description wrap to multiple lines if
    // the device is narrow without pushing the icon off-screen.
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    // v6 fix C — title 30 → 26 pt Cormorant 500, lh 1.15, ls 0.01em,
    // left-aligned. 0.01em × 26 pt ≈ 0.26 pt letterSpacing.
    fontFamily: Typography.displayMedium,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: 0.26,
    lineHeight: 30, // 26 × 1.15
    textAlign: 'left',
  },
  cardSubtitle: {
    // v6 fix C — sub 16 → 15 pt DM Sans 300, lh 1.45, rgba(text, 0.65),
    // left-aligned, 4 pt below the title. Bundle has no DM Sans 300;
    // using Typography.body (400).
    marginTop: 4,
    fontFamily: Typography.body,
    fontSize: 15,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 22, // 15 × 1.45
    textAlign: 'left',
  },
  pillSlot: {
    // v6 fix C — Coming Soon pill centred above locked CTA, 10 pt
    // marginBottom from the pill (head row already gave 14 above).
    alignItems: 'center',
    marginBottom: 10,
  },
  cardCta: {
    // v6 fix C — CTA padding 14 pt vertical, radius 10. Full card
    // width. No marginTop because the head row's marginBottom (14)
    // or the pillSlot's marginBottom (10) already set the gap above.
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
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
    // v6 fix C — label 15 → 16 pt DM Sans 500, ls 0.02em
    // (0.02em × 16 = ~0.32 pt letterSpacing).
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    letterSpacing: 0.32,
    color: Colors.background,
  },
  cardCtaTextLocked: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    letterSpacing: 0.32,
    color: Colors.textMuted,
  },
  cardHint: {
    // v6 fix C — disabled hint centred below locked CTA, 11 pt mono
    // caps muted, 10 pt margin above.
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.5,
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
    // v5 item 03 — Coming Soon pill 11 pt 0.18em (dispatch said
    // unchanged; build was 10; redline locks 11).
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.0,
    color: Colors.amber,
    textTransform: 'uppercase',
  },
  quickLink: {
    // v5 item 02 — link sits 16 pt below Receive card, horizontally
    // centred. alignItems centre + alignSelf stretch achieves this
    // without a separate flex wrapper.
    marginTop: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  quickLinkText: {
    // v5 item 03 — link 10 → 11 pt, DM Mono sky. 0.08em on 11 pt =
    // ~0.9 pt letterSpacing.
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 0.9,
    color: Colors.accent,
    textAlign: 'center',
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
