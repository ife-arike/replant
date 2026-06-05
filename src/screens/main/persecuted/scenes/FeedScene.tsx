// FeedScene — Surface 1 (extracted from PersecutedScreen.tsx).
// ThresholdPreamble, ActionCard, paginated heartcry feed, entry points.
// Now includes NotifBar, HeartcryCard read-on/fold, pagination.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import { formatRelativeTime, formatHoldCount } from '../../persecutedLogic';
import NotifBar from '../components/NotifBar';
import EntryPointBlock from '../components/EntryPointBlock';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';
const ROUND_SIZE = 4;
const FEED_PAGE_SIZE = 20;

// ── Types ──────────────────────────────────────────────────────────
interface HeartcryFeedRow {
  id: string;
  feed_content: string | null;
  continent: string | null;
  region: string | null;
  severity: string;
  created_at: string;
  hold_count: number;
  viewer_held: boolean;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── Region taxonomy ────────────────────────────────────────────────
const HEARTCRY_REGIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'all',           label: 'All' },
  { id: 'Africa',        label: 'Africa' },
  { id: 'North America', label: 'North America' },
  { id: 'South America', label: 'South America' },
  { id: 'Asia',          label: 'Asia' },
  { id: 'Europe',        label: 'Europe' },
  { id: 'Oceania',       label: 'Oceania' },
  { id: 'Antarctica',    label: 'Antarctica' },
];

// ── Static copy ────────────────────────────────────────────────────
const THRESHOLD_EYEBROW = 'A HELD SPACE';
const THRESHOLD_BODY =
  'For churches under threat, imprisonment, prohibition of fellowship, violence, and active hunting for the faith.';
const ACTION_PROMPT = 'Are you suffering persecution for the name of Jesus?';
const ACTION_SUB =
  'Heartcries shared to Replant are encrypted and your identity is held. This is a safe space for your voice.';
const ACTION_CTA = 'SHARE MY HEARTCRY';
const EMPTY_TITLE = 'Quiet here, for now.';
const EMPTY_BODY =
  'This space is held in prayer until someone speaks. If you are experiencing any form of persecution, you can share here.';
const SECTION_HEADING = 'Heartcries from the body';
const HEB_13_3 =
  'Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body.';
const HEB_13_3_REF = 'HEBREWS 13:3';

// ── Props ──────────────────────────────────────────────────────────
interface FeedSceneProps {
  onNavigateToTab: (tabIndex: number) => void;
}

// ── Scene ──────────────────────────────────────────────────────────
export default function FeedScene({ onNavigateToTab }: FeedSceneProps) {
  const navigation = useNavigation<NavProp>();
  const [feedRows, setFeedRows] = useState<HeartcryFeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [round, setRound] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  // ── Feed fetch ──
  const loadFeed = useCallback(async (regionId: string) => {
    setFeedLoading(true);
    const { data, error } = await supabase.rpc('get_heartcry_feed', {
      p_limit: FEED_PAGE_SIZE,
      p_offset: 0,
      p_region: regionId === 'all' ? null : regionId,
    });
    if (error) {
      setFeedRows([]);
    } else {
      setFeedRows((data ?? []) as HeartcryFeedRow[]);
    }
    setFeedLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFeed(selectedRegion);
    }, [loadFeed, selectedRegion]),
  );

  // Reset round when region changes
  useEffect(() => { setRound(0); }, [selectedRegion]);

  const handleRegionSelect = useCallback(
    (id: string) => {
      setSelectedRegion(id);
      void loadFeed(id);
    },
    [loadFeed],
  );

  // ── Hold toggle ──
  const handleToggleHold = useCallback(async (id: string) => {
    const row = feedRows.find((r) => r.id === id);
    if (!row) return;
    const prevHeld = row.viewer_held;
    const prevCount = row.hold_count;
    const nextHeld = !prevHeld;
    const nextCount = prevCount + (nextHeld ? 1 : -1);
    setFeedRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, viewer_held: nextHeld, hold_count: nextCount } : r,
      ),
    );
    const { error } = await supabase.rpc('hold_heartcry_in_prayer', {
      p_heartcry_id: id,
    });
    if (error) {
      setFeedRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, viewer_held: prevHeld, hold_count: prevCount } : r,
        ),
      );
    }
  }, [feedRows]);

  // ── Pagination ──
  const total = feedRows.length;
  const totalRounds = Math.max(1, Math.ceil(total / ROUND_SIZE));
  const start = round * ROUND_SIZE;
  const end = Math.min(start + ROUND_SIZE, total);
  const slice = feedRows.slice(start, end);
  const isFirst = round === 0;
  const isLast = round >= totalRounds - 1;

  const scrollRef = React.useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* NotifBar — only when hasUnreadStatus */}
      {showNotif && (
        <NotifBar
          text="The Replant team has responded — check your secure messages."
          onTap={() => onNavigateToTab(1)} // My Heartcries
          onClose={() => setShowNotif(false)}
        />
      )}

      <ThresholdPreamble />

      <View style={styles.bodyPad}>
        <PersecutedActionCard
          onPress={() => navigation.navigate('HeartcrySubmission')}
        />

        {/* Section header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{SECTION_HEADING}</Text>
          <View style={styles.sectionRule} />
        </View>

        <RegionFilterBar
          selectedId={selectedRegion}
          onSelect={handleRegionSelect}
        />
        <View style={{ height: 14 }} />

        {feedLoading ? (
          <View style={styles.feedSpinner}>
            <ActivityIndicator color={Colors.red} />
          </View>
        ) : feedRows.length > 0 ? (
          <>
            <View style={styles.cardStack}>
              {slice.map((row) => (
                <HeartcryCard
                  key={row.id}
                  row={row}
                  onToggleHold={() => handleToggleHold(row.id)}
                />
              ))}
            </View>

            {/* Pagination footer */}
            {total > ROUND_SIZE && (
              <View style={styles.roundNav}>
                <Pressable
                  onPress={() => {
                    if (!isFirst) {
                      setRound((r) => r - 1);
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }
                  }}
                  disabled={isFirst}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.navLink}
                >
                  <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                    <Path
                      d="M8 2L4 6l4 4"
                      stroke={isFirst ? Colors.textSubtle : Colors.accent}
                      strokeWidth={1.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={[styles.navLinkText, isFirst ? styles.navDisabled : styles.navActive]}>
                    previous
                  </Text>
                </Pressable>

                <Text style={styles.navCount}>
                  {start + 1}–{end} of {total}
                </Text>

                <Pressable
                  onPress={() => {
                    if (!isLast) {
                      setRound((r) => r + 1);
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }
                  }}
                  disabled={isLast}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.navLink}
                >
                  <Text style={[styles.navLinkText, isLast ? styles.navDisabled : styles.navActive]}>
                    next
                  </Text>
                  <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                    <Path
                      d="M4 2l4 4-4 4"
                      stroke={isLast ? Colors.textSubtle : Colors.accent}
                      strokeWidth={1.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <HeartcryEmpty />
        )}
      </View>

      <ScriptureFooter
        eyebrow="PRAY WITH US"
        verse={HEB_13_3}
        verseRef={HEB_13_3_REF}
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ThresholdPreamble
// ─────────────────────────────────────────────────────────────────────

function ThresholdPreamble() {
  return (
    <View style={styles.threshold}>
      <Text style={styles.thresholdEyebrow}>{THRESHOLD_EYEBROW}</Text>
      <Text style={styles.thresholdBody}>{THRESHOLD_BODY}</Text>
      <View style={styles.thresholdMeta}>
        <ThresholdLock />
        <Text style={[styles.thresholdMetaText, styles.thresholdMetaSky]}>ENCRYPTED</Text>
        <Text style={styles.thresholdMetaDot}>·</Text>
        <Text style={styles.thresholdMetaText}>NO LOCATION STORED</Text>
        <Text style={styles.thresholdMetaDot}>·</Text>
        <Text style={styles.thresholdMetaText}>REGION ONLY</Text>
      </View>
    </View>
  );
}

function ThresholdLock() {
  return (
    <Svg width={9} height={11} viewBox="0 0 10 12">
      <Rect x={1.5} y={5} width={7} height={6} rx={1} fill="none" stroke={Colors.accent} strokeWidth={1} />
      <Path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke={Colors.accent} strokeWidth={1} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PersecutedActionCard
// ─────────────────────────────────────────────────────────────────────

function PersecutedActionCard({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.actionCard}>
      <Text style={styles.actionPrompt}>{ACTION_PROMPT}</Text>
      <Text style={styles.actionSub}>{ACTION_SUB}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Share my heartcry"
        style={({ pressed }) => [styles.actionCta, pressed && styles.actionCtaPressed]}
      >
        <Text style={styles.actionCtaLabel}>{ACTION_CTA}</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RegionFilterBar
// ─────────────────────────────────────────────────────────────────────

function RegionFilterBar({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.regionBarContent}
    >
      {HEARTCRY_REGIONS.map((r) => {
        const active = r.id === selectedId;
        return (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.regionChip, active && styles.regionChipActive]}
          >
            <Text style={[styles.regionChipLabel, active && styles.regionChipLabelActive]}>
              {r.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeartcryCard — with read-on/fold
// ─────────────────────────────────────────────────────────────────────

function HeartcryCard({
  row,
  onToggleHold,
}: {
  row: HeartcryFeedRow;
  onToggleHold: () => void;
}) {
  const held = row.viewer_held;
  const regionLabel = row.region ?? row.continent ?? '';
  const timestamp = formatRelativeTime(row.created_at);
  const text = row.feed_content ?? '';
  const [isTruncatable, setIsTruncatable] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'),
    );
    setExpanded((v) => !v);
  }, []);

  return (
    <View style={[styles.heartcry, held && styles.heartcryHeld]}>
      {/* Hidden measure pass — renders off-screen to detect overflow */}
      <Text
        numberOfLines={5}
        onTextLayout={(e) => {
          if (e.nativeEvent.lines.length >= 5) setIsTruncatable(true);
        }}
        style={[styles.heartcryText, styles.heartcryMeasure]}
        pointerEvents="none"
      >
        {text}
      </Text>
      <View style={styles.heartcryLocRow}>
        <View style={styles.heartcryDot} />
        <Text style={styles.heartcryVoice}>A VOICE</Text>
        {regionLabel ? (
          <>
            <Text style={styles.heartcryVoice}> · </Text>
            <Text style={styles.heartcryRegion}>{regionLabel.toUpperCase()}</Text>
          </>
        ) : null}
        {timestamp ? <Text style={styles.heartcryTime}>{timestamp}</Text> : null}
      </View>
      <Text
        style={styles.heartcryText}
        numberOfLines={isTruncatable && !expanded ? 4 : undefined}
      >
        {text}
      </Text>
      {isTruncatable && (
        <Pressable onPress={toggleExpand} hitSlop={8} style={styles.readOnRow}>
          <View style={styles.readOnRule} />
          <Text style={styles.readOnLabel}>{expanded ? 'fold' : 'read on'}</Text>
        </Pressable>
      )}
      <View style={styles.heartcryMetaRow}>
        <Pressable
          onPress={onToggleHold}
          accessibilityRole="button"
          accessibilityState={{ selected: held }}
          accessibilityLabel={held ? 'Stop holding this heartcry in prayer' : 'Hold this heartcry in prayer'}
          style={styles.holdToggle}
          hitSlop={6}
        >
          {held ? (
            <>
              <Svg width={10} height={10} viewBox="0 0 12 12">
                <Path d="M2 6l3 3 5-6" stroke={CREAM} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.holdLabel, styles.holdLabelHeld]}>KEEP HOLDING</Text>
            </>
          ) : (
            <Text style={[styles.holdLabel, styles.holdLabelIdle]}>+ HOLD IN PRAYER</Text>
          )}
        </Pressable>
        {row.hold_count > 0 ? (
          <Text style={styles.holdCount}>
            {formatHoldCount(row.hold_count)} praying
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeartcryEmpty
// ─────────────────────────────────────────────────────────────────────

function HeartcryEmpty() {
  return (
    <View style={styles.empty}>
      <Svg width={36} height={36} viewBox="0 0 36 36" style={styles.emptyGlyph}>
        <Circle cx={18} cy={18} r={16} fill="none" stroke="rgba(217,89,79,0.75)" strokeWidth={1.2} strokeDasharray="2 3" />
        <Path d="M18 11v8M18 23v.5" stroke="#D9594F" strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
      <Text style={styles.emptyTitle}>{EMPTY_TITLE}</Text>
      <Text style={styles.emptyBody}>{EMPTY_BODY}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ScriptureFooter (parameterized)
// ─────────────────────────────────────────────────────────────────────

export function ScriptureFooter({
  eyebrow,
  verse,
  verseRef,
}: {
  eyebrow: string;
  verse: string;
  verseRef: string;
}) {
  return (
    <View style={styles.scriptureFoot}>
      <Text style={styles.scriptureEyebrow}>{eyebrow}</Text>
      <Text style={styles.scriptureVerse}>{verse}</Text>
      <Text style={styles.scriptureRef}>{verseRef}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 28 },
  bodyPad: { paddingHorizontal: 22 },

  // Threshold preamble
  threshold: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT,
  },
  thresholdEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 3.08,
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 10,
  },
  thresholdBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 28,
    color: CREAM,
    letterSpacing: 0.18,
  },
  thresholdMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  thresholdMetaText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  thresholdMetaSky: { color: Colors.accent, marginLeft: 4 },
  thresholdMetaDot: { color: 'rgba(240,237,230,0.32)' },

  // Action card
  actionCard: {
    marginVertical: 22,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 10,
  },
  actionPrompt: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 27,
    color: Colors.text,
    letterSpacing: 0.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  actionSub: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  actionCta: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(217,89,79,0.30)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCtaPressed: { opacity: 0.7 },
  actionCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 1.61,
    textTransform: 'uppercase',
    color: Colors.red,
  },

  // Section heading
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionHeader: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    letterSpacing: 0.19,
    color: Colors.text,
  },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: FAINT },

  // Region filter bar
  regionBarContent: { gap: 6, paddingVertical: 4, paddingBottom: 8 },
  regionChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: FAINT,
    backgroundColor: 'transparent',
  },
  regionChipActive: { borderColor: 'rgba(240,237,230,0.14)', backgroundColor: '#18181b' },
  regionChipLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  regionChipLabelActive: { color: Colors.text },

  // Heartcry card
  cardStack: { gap: 12 },
  heartcry: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  heartcryHeld: { backgroundColor: 'rgba(107,181,232,0.04)' },
  heartcryLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  heartcryDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.red,
    flexShrink: 0,
  },
  heartcryVoice: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: Colors.red,
  },
  heartcryRegion: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    textTransform: 'uppercase',
    color: Colors.text,
  },
  heartcryTime: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  heartcryText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25,
    color: CREAM,
    letterSpacing: 0.08,
  },
  heartcryMeasure: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },

  // Read-on / fold affordance
  readOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  readOnRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: FAINT,
  },
  readOnLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textSubtle,
  },

  heartcryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  holdToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  holdLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.02,
    textTransform: 'uppercase',
  },
  holdLabelIdle: { color: Colors.accent },
  holdLabelHeld: { color: CREAM },
  holdCount: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.02,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  // Pagination nav
  roundNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLinkText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.0,
  },
  navActive: { color: Colors.accent },
  navDisabled: { color: Colors.textSubtle },
  navCount: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },

  // Empty
  empty: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' },
  emptyGlyph: { marginBottom: 18, opacity: 0.6 },
  emptyTitle: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.text,
    letterSpacing: 0.19,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 21,
    color: Colors.textMuted,
    maxWidth: 280,
    textAlign: 'center',
  },

  feedSpinner: { paddingVertical: 28, alignItems: 'center' },

  // Entry points
  entryPointsSection: {
    paddingHorizontal: 22,
    marginTop: 28,
  },
  entryPointsEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: Colors.textSubtle,
    marginBottom: 8,
  },

  // Scripture footer
  scriptureFoot: {
    marginTop: 40,
    marginHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  scriptureEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
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
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
