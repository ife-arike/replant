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
  getLocationLine,
  type TestimonyRow,
} from './PrayerWallLogic';
import { formatLeaderLine } from '../../utils/displayHelpers';
import { CandleIcon, IncenseIcon, LockIcon } from './PrayerIcons';

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
      {/* Pastoral one-liner — breathing room before action cards */}
      <View style={styles.welcomeWrap}>
        <Text style={styles.welcomeText}>
          The place where the body lifts one another up in prayer.
        </Text>
      </View>

      {/* Action cards — v6 fix C: icon-LEFT layout, 18 pt gap, title
          26 pt / sub 15 pt / CTA 16 pt. */}
      <View style={styles.actionStack}>
        <ActionCard
          accent="sky"
          icon={<IncenseIcon size={30} color={Colors.accent} />}
          title="Make Intercession"
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
        <Text style={styles.quickLinkText}>View my open prayers</Text>
      </Pressable>

      {/* Testimony rotator (hidden when zero testimonies) */}
      <TestimonyRotator
        onSeeAll={onSeeAllTestimonies}
        onOpenTestimony={onOpenTestimony}
      />

      {/* Scripture footer — Eph 6:18, reverent anchor matching Persecuted tab pattern */}
      <View style={styles.scriptureFooter}>
        <View style={styles.scriptureRule} />
        <View style={styles.scriptureFooterInner}>
          <Text style={styles.scriptureVerse}>{EPH_6_18_KJV}</Text>
          <Text style={styles.scriptureRef}>{EPH_6_18_REF}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Action cards ─────────────────────────────────────────────────────

interface ActionCardProps {
  accent: 'sky' | 'green' | 'amber';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaVariant: 'solid' | 'locked';
  onPress?: () => void;
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
  dimmed,
  hintBelow,
}: ActionCardProps) {
  const borderColor =
    accent === 'sky' ? Colors.borderAccent
    : accent === 'amber' ? 'rgba(212, 168, 85, 0.30)'
    : 'rgba(91, 173, 122, 0.30)';
  const iconBg =
    accent === 'sky' ? 'rgba(107, 181, 232, 0.10)'
    : accent === 'amber' ? 'rgba(212, 168, 85, 0.10)'
    : 'rgba(91, 173, 122, 0.10)';

  // v6 fix C — icon-LEFT layout. Head row uses flex with alignItems
  // 'center' so the 60 pt circle vertically centres against the
  // title+description stack. Title and description are LEFT-aligned.
  //
  // v7 Item 06 — amber "Coming soon" pill removed entirely. Card
  // flow is now: head row → 14 pt (head's marginBottom) → CTA →
  // 10 pt (hint's marginTop) → hint copy. The locked-state "Coming
  // soon" text lives in the CTA label itself; the pill was redundant.
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
    // v7 Item 10 — alert copy: action name "Receive Intercession" is
    // title case (matches the card title); the remaining sentence
    // copy stays sentence case.
    Alert.alert(
      'Receive Intercession',
      'Receive Intercession is coming soon. For now, your church can request prayer by writing to us at connect@projectreplant.org.',
    );
  };

  return (
    <ActionCard
      accent="amber"
      icon={<CandleIcon size={30} color={Colors.amber} />}
      title="Receive Intercession"
      subtitle="Let the body stand with your church in prayer."
      ctaLabel="Coming soon"
      ctaVariant="locked"
      onPress={isVerified ? handlePress : undefined}
      dimmed={!isVerified}
      hintBelow={isVerified ? undefined : 'Available after your church is verified'}
    />
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
  // v8 Fix B / H — attribution uses formatLeaderLine for consistency
  // across rotator, full TestimonyCard, and both detail sheets.
  // isAnonymous is derived from leader_display_name === null (server-
  // side masking returns null for both anonymous + underground posts;
  // there is no separate is_anonymous wire field today).
  const leader = formatLeaderLine(
    current.leader_role,
    current.leader_display_name,
    current.leader_display_name === null,
  );

  return (
    <View style={styles.rotatorWrap}>
      <View style={styles.rotatorLabelRow}>
        <Text style={styles.rotatorLabel}>Testimonies</Text>
        <Pressable onPress={onSeeAll} hitSlop={6} accessibilityRole="button">
          <Text style={styles.rotatorSeeAll}>See all</Text>
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
            {location}
          </Text>
          <Text style={styles.rotatorLeader} numberOfLines={1}>
            {leader}
          </Text>
          <Text style={styles.rotatorText} numberOfLines={3}>
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
  scriptureFooter: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  scriptureRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.08)',
  },
  scriptureFooterInner: {
    paddingTop: 14,
    paddingBottom: 6,
    alignItems: 'center',
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 18,            // CD spec: 18pt
    lineHeight: 27,          // 18 × 1.50 = 27
    color: 'rgba(240, 237, 230, 0.60)',
    marginBottom: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  scriptureRef: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 1.89,     // 0.18em × 10.5
    textTransform: 'uppercase',
    color: Colors.text,
    textAlign: 'center',
  },
  welcomeWrap: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,            // 16 × 1.50
    color: 'rgba(240, 237, 230, 0.60)',
    maxWidth: 320,
    textAlign: 'center',
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    // v8 Fix C — title token bumps weight (displayMedium 500 →
    // display 600 SemiBold) and size 26 → 25 pt. lh 1.15, ls 0.005em
    // (0.005em × 25 ≈ 0.125 pt letterSpacing). Heavier weight at
    // slightly smaller size reads sharper against the cards'
    // lighter descriptions.
    fontFamily: Typography.display,
    fontSize: 19,
    color: Colors.text,
    letterSpacing: 0.125,
    lineHeight: 23, // 19 × 1.2 ≈ 22.8
    textAlign: 'left',
  },
  cardSubtitle: {
    // v6 fix C — sub 16 → 15 pt DM Sans 300, lh 1.45, rgba(text, 0.65),
    // left-aligned, 4 pt below the title. Bundle has no DM Sans 300;
    // using Typography.body (400).
    marginTop: 4,
    fontFamily: Typography.sansLight,
    fontSize: 13,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 20, // 13 × 1.5 = 19.5, round to 20
    textAlign: 'left',
  },
  cardCta: {
    // v6 fix C — CTA padding 14 pt vertical, radius 10. Full card
    // width. No marginTop because the head row's marginBottom (14)
    // sets the gap above.
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
    // v6 fix C — disabled hint centred below locked CTA, 11 pt caps
    // muted, 10 pt margin above.
    // v7 Item 08 — DM Sans 400 (was DM Mono), tracking + UPPERCASE
    // preserved so it still reads as a label.
    marginTop: 10,
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 1.5, // ~0.14em on 11 pt
    color: Colors.textMuted,
    textAlign: 'center',
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
    // v7 Item 08 — 15 pt DM Sans 400 (was 11 pt DM Mono). Sentence
    // case, no arrow — reads as a quiet text link, not a callout.
    fontFamily: Typography.body,
    fontSize: 15,
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
    // v7 Item 08 — 12 pt DM Sans 500 (was 11 pt mono), 0.18em
    // UPPERCASE green. Still reads as a section header via tracking
    // + caps without the keyboard-clack of mono.
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 2.2, // 0.18em × 12
    color: Colors.green,
    textTransform: 'uppercase',
  },
  rotatorSeeAll: {
    // v7 Item 08 — 14 pt DM Sans 400 (was 11 pt mono). Sentence case,
    // no arrow.
    fontFamily: Typography.body,
    fontSize: 14,
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
    // v8 Fix B — DM Sans 400 sentence case, 15 pt, lh 1.3, green.
    // The rotator's mini preview cards now match the full testimony
    // card's location size for visual consistency in the cluster.
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 20, // 15 × 1.3 ≈ 19.5
    color: Colors.green,
  },
  rotatorLeader: {
    // v8 Fix B — attribution 13 pt DM Sans 400, lh 1.3, muted-45%.
    // Format is {RoleLabel} {Name} via formatLeaderLine — applied at
    // the render site above.
    marginTop: 2,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 17, // 13 × 1.3
    color: 'rgba(240, 237, 230, 0.45)',
  },
  rotatorText: {
    marginTop: 8,
    // v8 Fix B — rotator body 17 pt Cormorant 500 Medium Italic
    // (displayMediumItalic), lh 1.50 (NOT scriptureItalic 300 — the
    // rotator's compact card benefits from the slightly heavier
    // weight to stay legible at the smaller card size). Color
    // --text full white. numberOfLines: 3 (was 4).
    fontFamily: Typography.displayMediumItalic,
    fontSize: 17,
    color: Colors.text,
    lineHeight: 26, // 17 × 1.50 ≈ 25.5
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
