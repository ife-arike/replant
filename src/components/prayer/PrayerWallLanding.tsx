// ─────────────────────────────────────────────
// PrayerWallLanding — KAN-23 v2 R2 (Prayer Wall landing redesign).
//
// Replaces the v8 two-card stack (Make Intercession / Receive Intercession)
// + auto-rotating testimony with the CD v2 layered surface:
//
//   • Hero prayer card — "TONIGHT · LIVE" sky pulsing dot, "Make
//     intercession" title, two open-prayer previews from
//     get_prayer_wall(), live counts (hardcoded MVP), full-width
//     "ENTER THE PRAYER WALL" sky CTA.
//   • Receive intercession — branches on isVerified:
//       verified  → ReceiveActiveCard (live "TONIGHT · LIVE" eyebrow,
//                   first 2 open requests from get_open_prayers(),
//                   "N open · praying for you" stats, "+ Share a need"
//                   ghost CTA — currently a coming-soon Alert).
//       pending   → ReceiveLockedCard (compact row with lock circle,
//                   title, "Coming soon" pill).
//   • JournalLinkRow — quiet row pointing at MyOpenPrayers.
//   • TestimonyCarousel — horizontal snap-scroller of cards from
//     get_landing_testimonies(); scroll dots track active index. The
//     v8 auto-rotator + fade animation are entirely removed.
//   • ScriptureFooter — Ephesians 6:18 KJV (PRAY ALWAYS) reverent close.
//
// Data fetches (all FE-side, no new RPCs):
//   1) get_prayer_wall({ page_offset:0, filter_urgent:null, filter_categories:null })
//      → preview rows for the hero (first 2).
//   2) public.users where auth_id = current user.id → church_id (verified-only).
//   3) get_open_prayers({ p_church_id })                → first 2 own requests.
//   4) get_landing_testimonies()                       → carousel rows (first 5).
//
// church_id is not on AuthState; we fetch it from public.users the same
// way MyOpenPrayersView does (KAN-23 v1, MyOpenPrayersView.tsx L84-103).
// ─────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useReducedMotion } from '../../utils/useReducedMotion';
import {
  formatRelativeTime,
  getLocationLine,
  type PrayerRow,
  type TestimonyRow,
} from './PrayerWallLogic';
import { formatLeaderLine } from '../../utils/displayHelpers';

// ── Static copy ──────────────────────────────────────────────────────

const HERO_EYEBROW = 'TONIGHT · LIVE';
const HERO_TITLE = 'Make intercession';
const HERO_SUB = 'Pray through the wall of requests from churches around the world.';
const HERO_CTA = 'ENTER THE PRAYER WALL';

// MVP — counts are not live yet. The CD makes them feel like they should
// be ticking, so they're surfaced as hardcoded values that match the CD
// at this snapshot. KAN-XXX (future) will wire a live counter.
const HERO_STAT_INTERCEDING = '1,247';
const HERO_STAT_HOUR_ADDS = '12';

const RECEIVE_LOCKED_TITLE = 'Receive intercession';
const RECEIVE_LOCKED_SUB = 'Let the body lift your church in prayer.';
const RECEIVE_LOCKED_BADGE = 'COMING SOON';

const RECEIVE_ACTIVE_EYEBROW = 'YOUR CHURCH · IN PRAYER';
const RECEIVE_ACTIVE_TITLE = 'Receive intercession';
const RECEIVE_ACTIVE_SUB = 'Let the body stand with you. Share what your church is carrying.';
const RECEIVE_ACTIVE_EMPTY_TITLE = 'No open requests yet.';
const RECEIVE_ACTIVE_EMPTY_BODY = 'Share what your church is carrying.';
const RECEIVE_ACTIVE_CTA = 'SHARE A NEED';

const JOURNAL_TITLE = 'Your intercession journal';
// KAN-23 R2 (2026-05-28): JOURNAL_SUB removed. Until there's a live
// "N holding · M returned with answer" count to surface here, silence
// is more honest than a stub. journalLinkSub style kept (harmless) in
// case the live count lands later and we re-introduce the sub line.

const SECTION_HEADING = 'Testimonies from the wall';
const SEE_ALL_LABEL = 'SEE ALL';

const TESTIMONY_EMPTY_TITLE = 'No testimonies yet.';
const TESTIMONY_EMPTY_BODY =
  'The prayers continue. When the Lord answers, the testimonies will be carried here.';

const EPH_6_18 =
  'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance.';
const EPH_6_18_REF = 'EPHESIANS 6:18 · KJV';
const SCRIPTURE_EYEBROW = 'WATCHING IN PRAYER';

const FAINT = 'rgba(240,237,230,0.08)';
const SOFT_DOT_BG = 'rgba(8,8,8,0.45)';
const CREAM = '#E6E1D5';
const OFFWHITE = '#F0EDE6';

const TESTIMONY_LIMIT = 5;
const PREVIEW_LIMIT = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TESTIMONY_CARD_WIDTH = SCREEN_WIDTH - 44;

interface Props {
  onEnterFeed: () => void;
  onSeeAllTestimonies: () => void;
  onOpenTestimony: (testimonyId: string) => void;
  onViewMyOpenPrayers: () => void;
}

// Local count formatter (matches CD's formatCount).
function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}

interface OpenPrayerRow {
  id: string;
  prayer_text: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────

export default function PrayerWallLanding({
  onEnterFeed,
  onSeeAllTestimonies,
  onOpenTestimony,
  onViewMyOpenPrayers,
}: Props) {
  const { branch, session } = useAuth();
  const isVerified = branch === 'active';

  const [previewRows, setPreviewRows] = useState<PrayerRow[]>([]);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [ownRequests, setOwnRequests] = useState<OpenPrayerRow[]>([]);
  const [testimonyRows, setTestimonyRows] = useState<TestimonyRow[]>([]);

  // ── Hero preview (first 2 from the global prayer wall) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_prayer_wall', {
        page_offset: 0,
        filter_urgent: null,
        filter_categories: null,
      });
      if (cancelled) return;
      if (error || !data) {
        setPreviewRows([]);
        return;
      }
      setPreviewRows((data as PrayerRow[]).slice(0, PREVIEW_LIMIT));
    })();
    return () => { cancelled = true; };
  }, []);

  // ── church_id lookup — mirrors MyOpenPrayersView L84–103. ──
  useEffect(() => {
    if (!isVerified) return;
    let cancelled = false;
    (async () => {
      const authId = session?.user?.id;
      if (!authId) return;
      const { data, error } = await supabase
        .from('users')
        .select('church_id')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.church_id) {
        setChurchId(null);
        return;
      }
      setChurchId(data.church_id);
    })();
    return () => { cancelled = true; };
  }, [isVerified, session?.user?.id]);

  // ── Own open requests via get_open_prayers (verified + church_id only) ──
  useEffect(() => {
    if (!churchId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_open_prayers', {
        p_church_id: churchId,
      });
      if (cancelled) return;
      if (error || !data) {
        setOwnRequests([]);
        return;
      }
      // get_open_prayers returns the wider OpenPrayerRow used by
      // MyOpenPrayersView; project down to the three fields the card needs.
      const rows = (data as Array<{ id: string; prayer_text: string; created_at: string }>)
        .slice(0, PREVIEW_LIMIT)
        .map((r) => ({ id: r.id, prayer_text: r.prayer_text, created_at: r.created_at }));
      setOwnRequests(rows);
    })();
    return () => { cancelled = true; };
  }, [churchId]);

  // ── Testimonies via get_landing_testimonies ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_landing_testimonies');
      if (cancelled) return;
      if (error || !data) {
        setTestimonyRows([]);
        return;
      }
      setTestimonyRows((data as TestimonyRow[]).slice(0, TESTIMONY_LIMIT));
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.bodyPad}>
        <HeroPrayerCard previewRows={previewRows} onEnterFeed={onEnterFeed} />

        {isVerified ? (
          <ReceiveActiveCard requests={ownRequests} />
        ) : (
          <ReceiveLockedCard />
        )}

        <JournalLinkRow onPress={onViewMyOpenPrayers} />

        {/* Section header — "Testimonies from the wall" + "See all" link */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{SECTION_HEADING}</Text>
          <View style={styles.sectionRule} />
          {testimonyRows.length > 0 ? (
            <Pressable onPress={onSeeAllTestimonies} hitSlop={6} accessibilityRole="button">
              <Text style={styles.seeAllLink}>{SEE_ALL_LABEL}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Carousel bleeds full-width — wrapped outside bodyPad. */}
      {testimonyRows.length > 0 ? (
        <TestimonyCarousel rows={testimonyRows} onOpenTestimony={onOpenTestimony} />
      ) : (
        <View style={styles.bodyPad}>
          <TestimonyEmpty />
        </View>
      )}

      <ScriptureFooter />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LiveDot — sky pulsing dot (used by hero + receive-active eyebrow rows).
// useReducedMotion() skips the loop and pins opacity at 1.
// ─────────────────────────────────────────────────────────────────────

function LiveDot() {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} pointerEvents="none" />;
}

// ─────────────────────────────────────────────────────────────────────
// HeroPrayerCard
// ─────────────────────────────────────────────────────────────────────

function HeroPrayerCard({
  previewRows,
  onEnterFeed,
}: {
  previewRows: PrayerRow[];
  onEnterFeed: () => void;
}) {
  // Skeleton placeholders before the RPC settles — same shape so the
  // hero card doesn't jump.
  const showSkeletons = previewRows.length === 0;
  return (
    <View style={styles.hero}>
      <View style={styles.heroEyebrowRow}>
        <LiveDot />
        <Text style={styles.heroEyebrow}>{HERO_EYEBROW}</Text>
      </View>
      <Text style={styles.heroTitle}>{HERO_TITLE}</Text>
      <Text style={styles.heroSub}>{HERO_SUB}</Text>

      <View style={styles.previewList}>
        {showSkeletons
          ? [0, 1].map((i) => <PreviewSkeleton key={i} />)
          : previewRows.map((row) => (
              <PreviewRow
                key={row.id}
                primary={row.prayer_text}
                meta={`${getLocationLine(row.church_name, row.country)} · ${formatRelativeTime(row.created_at)}`}
                onPress={onEnterFeed}
              />
            ))}
      </View>

      <View style={styles.heroStats}>
        <Text style={styles.heroStatNumSky}>{HERO_STAT_INTERCEDING}</Text>
        <Text style={styles.heroStatTextMuted}> interceding now</Text>
        <Text style={styles.heroStatDot}>·</Text>
        <Text style={styles.heroStatNumSky}>{HERO_STAT_HOUR_ADDS}</Text>
        <Text style={styles.heroStatTextMuted}> added this hour</Text>
      </View>

      <Pressable
        onPress={onEnterFeed}
        accessibilityRole="button"
        accessibilityLabel="Enter the prayer wall"
        style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}
      >
        <Text style={styles.heroCtaLabel}>{HERO_CTA}</Text>
        <ChevronRight size={11} color={Colors.background} />
      </Pressable>
    </View>
  );
}

function PreviewRow({
  primary,
  meta,
  onPress,
}: {
  primary: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={styles.previewRow}
    >
      <View style={styles.previewDot} />
      <View style={styles.previewBody}>
        <Text style={styles.previewText} numberOfLines={1}>{primary}</Text>
        <Text style={styles.previewMeta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

function PreviewSkeleton() {
  return (
    <View style={[styles.previewRow, styles.previewSkeleton]} pointerEvents="none">
      <View style={styles.previewDot} />
      <View style={styles.previewBody}>
        <View style={styles.skelLineWide} />
        <View style={styles.skelLineNarrow} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ReceiveLockedCard
// ─────────────────────────────────────────────────────────────────────

function ReceiveLockedCard() {
  return (
    <View style={styles.receiveLocked}>
      <View style={styles.receiveLockGlyph}>
        <Svg width={13} height={13} viewBox="0 0 14 14">
          <Rect x={3} y={6} width={8} height={6} rx={1} fill="none" stroke={Colors.textMuted} strokeWidth={1.1} />
          <Path d="M5 6V4a2 2 0 0 1 4 0v2" fill="none" stroke={Colors.textMuted} strokeWidth={1.1} />
        </Svg>
      </View>
      <View style={styles.receiveLockedBody}>
        <Text style={styles.receiveLockedTitle}>{RECEIVE_LOCKED_TITLE}</Text>
        <Text style={styles.receiveLockedSub}>{RECEIVE_LOCKED_SUB}</Text>
      </View>
      <Text style={styles.receiveLockedBadge}>{RECEIVE_LOCKED_BADGE}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ReceiveActiveCard
// ─────────────────────────────────────────────────────────────────────

function ReceiveActiveCard({ requests }: { requests: OpenPrayerRow[] }) {
  const handleShareNeed = () => {
    Alert.alert('Share a need', 'This feature is coming soon.');
  };
  const isEmpty = requests.length === 0;
  return (
    <View style={styles.receiveActive}>
      <View style={styles.heroEyebrowRow}>
        <LiveDot />
        <Text style={styles.receiveActiveEyebrow}>{RECEIVE_ACTIVE_EYEBROW}</Text>
      </View>
      <Text style={styles.receiveActiveTitle}>{RECEIVE_ACTIVE_TITLE}</Text>
      <Text style={styles.receiveActiveSub}>{RECEIVE_ACTIVE_SUB}</Text>

      {isEmpty ? (
        <View style={styles.receiveActiveEmpty}>
          <Text style={styles.receiveActiveEmptyTitle}>{RECEIVE_ACTIVE_EMPTY_TITLE}</Text>
          <Text style={styles.receiveActiveEmptyBody}>{RECEIVE_ACTIVE_EMPTY_BODY}</Text>
        </View>
      ) : (
        <View style={styles.previewList}>
          {requests.map((r) => (
            <View key={r.id} style={styles.receiveActivePreviewRow}>
              <View style={styles.previewDot} />
              <View style={styles.previewBody}>
                <Text style={styles.previewTextSmall} numberOfLines={1}>{r.prayer_text}</Text>
                <Text style={styles.previewMetaSmall}>
                  Posted {formatRelativeTime(r.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isEmpty ? (
        <View style={styles.receiveActiveStats}>
          <Text style={styles.receiveStatNumSky}>{requests.length}</Text>
          <Text style={styles.receiveStatTextMuted}> open</Text>
          <Text style={styles.heroStatDot}>·</Text>
          <Text style={styles.receiveStatTextMuted}>praying for you</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleShareNeed}
        accessibilityRole="button"
        accessibilityLabel="Share a need"
        style={({ pressed }) => [styles.receiveActiveCta, pressed && styles.heroCtaPressed]}
      >
        <PlusGlyph color={Colors.accent} />
        <Text style={styles.receiveActiveCtaLabel}>{RECEIVE_ACTIVE_CTA}</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// JournalLinkRow
// ─────────────────────────────────────────────────────────────────────

function JournalLinkRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open my open prayers"
      style={styles.journalLink}
    >
      <View style={styles.journalLinkIcon}>
        <Svg width={16} height={16} viewBox="0 0 18 18">
          <Path d="M3 3h12v12H3z" fill="none" stroke={Colors.accent} strokeWidth={1.1} />
          <Path d="M6 6h6M6 9h6M6 12h4" stroke={Colors.accent} strokeWidth={1.1} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={styles.journalLinkBody}>
        <Text style={styles.journalLinkTitle}>{JOURNAL_TITLE}</Text>
      </View>
      <ChevronRight size={13} color={Colors.accent} strokeWidth={1.4} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TestimonyCarousel — horizontal snap-scroller
// ─────────────────────────────────────────────────────────────────────

function TestimonyCarousel({
  rows,
  onOpenTestimony,
}: {
  rows: TestimonyRow[];
  onOpenTestimony: (id: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const reduced = useReducedMotion();
  // dragging mirrors onScrollBeginDrag/EndDrag so the auto-advance tick
  // can short-circuit while the leader is actively swiping — never
  // yank a card out from under their finger.
  const dragging = useRef(false);

  // KAN-23 R2 — auto-advance restored at 5 s, skipped when reduced
  // motion is on or there's only one card. Scrolls smoothly to the
  // next snap position via the imperative ref + scrollTo({ animated }).
  useEffect(() => {
    if (reduced || rows.length < 2) return;
    const timer = setInterval(() => {
      if (dragging.current) return;
      const next = (activeIndex + 1) % rows.length;
      scrollRef.current?.scrollTo({
        x: next * (TESTIMONY_CARD_WIDTH + 14),
        animated: true,
      });
      setActiveIndex(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeIndex, rows.length, reduced]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const step = TESTIMONY_CARD_WIDTH + 14; // matches snapToInterval
    const i = Math.round(x / step);
    const clamped = Math.min(Math.max(i, 0), rows.length - 1);
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

  // memoize card list so React doesn't re-render every scroll tick
  const cards = useMemo(
    () =>
      rows.map((row) => (
        <TestimonyCardView key={row.id} row={row} onPress={() => onOpenTestimony(row.id)} />
      )),
    [rows, onOpenTestimony],
  );

  return (
    <View style={styles.carouselOuter}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={TESTIMONY_CARD_WIDTH + 14}
        snapToAlignment="center"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={() => { dragging.current = false; }}
        contentContainerStyle={styles.carouselContent}
      >
        {cards}
      </ScrollView>
      {rows.length > 1 ? (
        <View style={styles.scrollDots}>
          {rows.map((_, i) => (
            <View
              key={i}
              style={[styles.scrollDot, i === activeIndex ? styles.scrollDotActive : styles.scrollDotIdle]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TestimonyCardView({
  row,
  onPress,
}: {
  row: TestimonyRow;
  onPress: () => void;
}) {
  const location = getLocationLine(row.church_name, row.country);
  // Anonymous + underground masked posts return leader_display_name === null;
  // formatLeaderLine handles that with its internal isAnonymous flag.
  const leader = formatLeaderLine(
    row.leader_role,
    row.leader_display_name,
    row.leader_display_name === null,
  );
  // Live wire field is celebrated_count (TestimonyRow). Dispatch's "amened"
  // label is the surface lexicon; the underlying count is the same.
  const amenLabel = `${formatCount(row.celebrated_count)} amen · ${formatRelativeTime(row.created_at)}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open testimony from ${row.church_name}`}
      style={styles.testimonyCard}
    >
      <View style={styles.testimonyHead}>
        <View style={styles.testimonyHeadDot} />
        <Text style={styles.testimonyLoc} numberOfLines={1}>{location.toUpperCase()}</Text>
      </View>
      <Text style={styles.testimonyLeader} numberOfLines={1}>{leader}</Text>
      <Text style={styles.testimonyQuote} numberOfLines={4}>{`"${row.testimony_text}"`}</Text>
      <View style={styles.testimonyMetaRow}>
        <Text style={styles.testimonyAmen}>+ AMEN</Text>
        <Text style={styles.testimonyMeta}>{amenLabel.toUpperCase()}</Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TestimonyEmpty
// ─────────────────────────────────────────────────────────────────────

function TestimonyEmpty() {
  return (
    <View style={styles.testimonyEmpty}>
      <Svg width={36} height={36} viewBox="0 0 36 36" style={styles.testimonyEmptyGlyph}>
        <Circle cx={18} cy={18} r={16} fill="none" stroke="rgba(107,181,232,0.3)" strokeWidth={0.8} strokeDasharray="2 3" />
        <Path d="M11 22c0-3 7-3 7 0M18 22c0-3 7-3 7 0M14 17l4-3 4 3" stroke="rgba(107,181,232,0.6)" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={styles.testimonyEmptyTitle}>{TESTIMONY_EMPTY_TITLE}</Text>
      <Text style={styles.testimonyEmptyBody}>{TESTIMONY_EMPTY_BODY}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ScriptureFooter — Ephesians 6:18 (KJV)
// ─────────────────────────────────────────────────────────────────────

function ScriptureFooter() {
  return (
    <View style={styles.scriptureFoot}>
      <Text style={styles.scriptureEyebrow}>{SCRIPTURE_EYEBROW}</Text>
      <Text style={styles.scriptureVerse}>{EPH_6_18}</Text>
      <Text style={styles.scriptureRef}>{EPH_6_18_REF}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Glyphs
// ─────────────────────────────────────────────────────────────────────

function ChevronRight({ size, color, strokeWidth = 1.4 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M4 2l5 4-5 4" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusGlyph({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12">
      <Path d="M6 2v8M2 6h8" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  bodyPad: { paddingHorizontal: 22 },

  // ── Hero card
  hero: {
    // KAN-23 R3 — surface bg restored. The sky border (0.5 / 0.35
    // alpha) is what reads as "kin to the receive card"; the tint was
    // crowding the testimony carousel's accent. Border stays sky.
    marginTop: 8,
    marginBottom: 20,
    paddingTop: 24,
    paddingRight: 22,
    paddingBottom: 24,
    paddingLeft: 22,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  heroEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.52, // 0.28em × 9
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  heroTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    lineHeight: 27.6,
    color: OFFWHITE,
    letterSpacing: 0.24,
    marginBottom: 8,
  },
  heroSub: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20.8,
    marginBottom: 18,
  },
  previewList: { gap: 8, marginBottom: 16 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: SOFT_DOT_BG,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 6,
  },
  previewSkeleton: { opacity: 0.3 },
  previewDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: Colors.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  previewBody: { flex: 1, minWidth: 0 },
  previewText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    lineHeight: 20.3,
    color: CREAM,
    letterSpacing: 0.07,
  },
  previewMeta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.36, // 0.16em × 8.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 5,
  },
  skelLineWide: {
    width: '88%', height: 10, borderRadius: 3,
    backgroundColor: 'rgba(240,237,230,0.10)',
  },
  skelLineNarrow: {
    width: '40%', height: 8, borderRadius: 3,
    backgroundColor: 'rgba(240,237,230,0.10)',
    marginTop: 8,
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0,
    marginBottom: 18,
  },
  heroStatNumSky: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52, // 0.16em × 9.5
    color: Colors.accent,
    fontWeight: '500',
  },
  heroStatTextMuted: {
    // KAN-23 R2 — uppercase so the surrounding mono numerals and the
    // muted suffix read as a single tracked-caps stats line, not
    // sentence-case body copy fragments.
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  heroStatDot: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    color: 'rgba(240,237,230,0.32)',
    paddingHorizontal: 8,
  },

  heroCta: {
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  heroCtaPressed: { opacity: 0.85 },
  heroCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 1.61, // 0.14em × 11.5
    textTransform: 'uppercase',
    color: Colors.background,
  },

  // ── Receive locked
  receiveLocked: {
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  receiveLockGlyph: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveLockedBody: { flex: 1, minWidth: 0 },
  receiveLockedTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    color: OFFWHITE,
    letterSpacing: 0.17,
    marginBottom: 3,
  },
  receiveLockedSub: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  receiveLockedBadge: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: FAINT,
    backgroundColor: '#18181b',
    overflow: 'hidden',
  },

  // ── Receive active
  receiveActive: {
    // KAN-23 R3 — surface bg restored (same revert as the hero). The
    // sky border keeps the give+receive pair visually linked; the tint
    // was reading too close to the testimony carousel's accent chrome.
    // Border stays sky.
    marginBottom: 14,
    paddingTop: 22,
    paddingRight: 22,
    paddingBottom: 18,
    paddingLeft: 22,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  receiveActiveEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.98, // 0.22em × 9
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  receiveActiveTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    lineHeight: 26.4,
    color: OFFWHITE,
    letterSpacing: 0.22,
    marginTop: 10,
    marginBottom: 8,
  },
  receiveActiveSub: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  receiveActivePreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: SOFT_DOT_BG,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 6,
  },
  previewTextSmall: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    lineHeight: 20.3,
    color: CREAM,
    letterSpacing: 0.07,
  },
  previewMetaSmall: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.36,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 6,
  },
  receiveActiveStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 18,
  },
  receiveStatNumSky: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    color: Colors.accent,
    fontWeight: '500',
  },
  receiveStatTextMuted: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    color: Colors.textMuted,
  },
  receiveActiveCta: {
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  receiveActiveCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 1.61,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  receiveActiveEmpty: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: FAINT,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  receiveActiveEmptyTitle: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.17,
    marginBottom: 6,
    textAlign: 'center',
  },
  receiveActiveEmptyBody: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },

  // ── Journal link
  journalLink: {
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  journalLinkIcon: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  journalLinkBody: { flex: 1, minWidth: 0 },
  journalLinkTitle: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: OFFWHITE,
    letterSpacing: 0.13,
    marginBottom: 2,
  },
  journalLinkSub: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.44, // 0.16em × 9
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  // ── Section heading
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 32,
    marginBottom: 0,
  },
  sectionHeader: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    letterSpacing: 0.19, // 0.01em × 19
    color: Colors.text,
  },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: FAINT },
  seeAllLink: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.9, // 0.20em × 9.5
    textTransform: 'uppercase',
    color: Colors.accent,
  },

  // ── Carousel
  carouselOuter: { marginHorizontal: 0 },
  carouselContent: { gap: 14, paddingHorizontal: 22, paddingVertical: 6, paddingBottom: 12 },
  testimonyCard: {
    width: TESTIMONY_CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  testimonyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  testimonyHeadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  testimonyLoc: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    color: Colors.accent,
    fontWeight: '500',
  },
  testimonyLeader: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 0.12,
  },
  testimonyQuote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15.5,
    lineHeight: 24,
    color: CREAM,
    letterSpacing: 0.08,
  },
  testimonyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  testimonyAmen: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.19, // 0.14em × 8.5
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  testimonyMeta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.19,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.32)',
  },
  scrollDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  scrollDot: { width: 22, height: 3, borderRadius: 100 },
  scrollDotActive: { backgroundColor: Colors.accent },
  scrollDotIdle: { backgroundColor: FAINT },

  // ── Testimony empty
  testimonyEmpty: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  testimonyEmptyGlyph: { marginBottom: 18, opacity: 0.6 },
  testimonyEmptyTitle: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.text,
    letterSpacing: 0.19,
    marginBottom: 10,
    textAlign: 'center',
  },
  testimonyEmptyBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 21,
    color: Colors.textMuted,
    maxWidth: 280,
    textAlign: 'center',
  },

  // ── Scripture footer
  scriptureFoot: {
    marginTop: 40,
    marginHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  scriptureEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16, // 0.24em × 9
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 14,
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
    maxWidth: 320,
    textAlign: 'center',
    marginBottom: 12,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.09, // 0.22em × 9.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
