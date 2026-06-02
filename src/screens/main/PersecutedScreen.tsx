// PersecutedScreen — KAN-65 v2 (Persecuted Tab rebuild, 2026-05-28).
//
// Tab visible to all authenticated leaders. The screen self-gates on
// users.verification_status:
//   verified  → Held-space surface: threshold preamble, action card,
//               Heartcries-from-the-body section with region filter +
//               cards, Hebrews 13:3 scripture footer.
//   anything  → Screen 14B gate (lock glyph + two lines of copy, no CTA).
//   loading   → small spinner above the gate body.
//
// What R2 removes vs the prior v1 build (per KAN-65 R2 dispatch):
//   • RecentHeartcry interface + status tracker block ("YOUR HEARTCRY · …").
//   • LAST_SEEN_KEY_PREFIX + every AsyncStorage read/write call —
//     no more per-user last-seen status tracking, no more
//     "New update on your heartcry" sky chip.
//   • FeedCard (replaced by HeartcryCard).
//   • The heartcry_own_status_read fetch entirely (RLS still allows it
//     when we re-introduce a tracker later, but the FE no longer runs it).
//
// What R2 keeps:
//   • Submission flow stays as navigation.navigate('HeartcrySubmission').
//   • The gate check is still the first thing the screen runs.
//   • useFocusEffect refreshes ONLY the feed on focus (no tracker).
//
// What R2 adds:
//   • ThresholdPreamble — quiet "A held space" intro, lock icon row.
//   • PersecutedActionCard — italic prompt + "SHARE MY HEARTCRY" CTA.
//   • RegionFilterBar — horizontal chips: All / Middle East / Central
//     Asia / North Africa / East Asia / South Asia / Southeast Asia.
//     Selection drives the p_region parameter on get_heartcry_feed.
//   • HeartcryCard — sky-tinted when "held"; per-row hold toggle held
//     entirely in-memory (heldIds Set).
//   • HeartcryEmpty — dashed circle + exclamation glyph + "Quiet here,
//     for now." pastoral copy.
//   • Scripture footer (Hebrews 13:3) rebuilt to match the CD spec
//     (PRAY WITH US eyebrow, centered verse, ref).
//
// RPC contract (KAN-65 R2, migration 20260528000008):
//   get_heartcry_feed(p_limit int, p_offset int, p_region text)
//   → { id, severity, created_at, feed_content, continent, region }
// Region filter is server-side; the FE never filters rows it didn't ask
// for. region is the new column; continent is kept for parity / future
// use (HeartcryFeedRow keeps both).

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useHamburger } from '../../contexts/HamburgerContext';
import LockIcon from '../../components/icons/LockIcon';
import type { RootStackParamList } from '../../navigation/types';
import { formatRelativeTime } from './persecutedLogic';

// ── Types ────────────────────────────────────────────────────────────

interface HeartcryFeedRow {
  id: string;
  feed_content: string | null;
  continent: string | null;  // kept — parity with v1, useful as fallback
  region: string | null;     // KAN-65 R2 — server-derived from country list
  severity: string;
  created_at: string;
}

type GateState = 'loading' | 'verified' | 'gated' | 'error';

const FEED_PAGE_SIZE = 20;

// ── Region taxonomy (mirrors the migration's CASE block) ─────────────
// id === label since we filter the RPC by the exact region string.

const HEARTCRY_REGIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'all',            label: 'All' },
  { id: 'Middle East',    label: 'Middle East' },
  { id: 'Central Asia',   label: 'Central Asia' },
  { id: 'North Africa',   label: 'North Africa' },
  { id: 'East Asia',      label: 'East Asia' },
  { id: 'South Asia',     label: 'South Asia' },
  { id: 'Southeast Asia', label: 'Southeast Asia' },
];

// ── Static copy ──────────────────────────────────────────────────────

const THRESHOLD_EYEBROW = 'A HELD SPACE';
const THRESHOLD_BODY =
  'For churches under imprisonment, prohibition of fellowship, violence, and active hunting for the faith. Handle with prayer and sobriety.';

const ACTION_PROMPT = 'Are you currently suffering persecution for the name of Jesus?';
const ACTION_SUB =
  'Your account is verified and your identity is held. This is a safe space for your voice.';
const ACTION_CTA = 'SHARE MY HEARTCRY';

const EMPTY_TITLE = 'Quiet here, for now.';
const EMPTY_BODY =
  'This space is held in prayer until someone speaks. If you are experiencing any form of persecution, you can share here.';

const SECTION_HEADING = 'Heartcries from the body';

const HEB_13_3 =
  'Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body.';
const HEB_13_3_REF = 'HEBREWS 13:3';

// KAN-65 AC 2 — gate copy (Screen 14B) — verbatim from content file.
const GATE_LINE_1 = 'This section is for verified leaders in the Replant network.';
const GATE_LINE_2 = "Once your church is verified, you'll have full access.";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────

export default function PersecutedScreen() {
  const navigation = useNavigation<NavProp>();
  const { open: openHamburger } = useHamburger();

  const [gateState, setGateState] = useState<GateState>('loading');
  const [feedRows, setFeedRows] = useState<HeartcryFeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [heldIds, setHeldIds] = useState<Set<string>>(new Set());

  // ── Gate check ──
  const loadVerification = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authId = userData.user?.id;
    if (!authId) {
      setGateState('gated');
      return;
    }
    // KAN-65 AC 2 — canonical DB literal 'verified' (NOT the API-layer
    // 'active' translation used elsewhere via AuthProvider).
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('verification_status')
      .eq('auth_id', authId)
      .maybeSingle();
    if (userErr || !userRow) {
      setGateState('error');
      return;
    }
    if (userRow.verification_status !== 'verified') {
      setGateState('gated');
      return;
    }
    setGateState('verified');
  }, []);

  // ── Feed fetch ──
  const loadFeed = useCallback(async (regionId: string) => {
    setFeedLoading(true);
    const { data, error } = await supabase.rpc('get_heartcry_feed', {
      p_limit: FEED_PAGE_SIZE,
      p_offset: 0,
      // 'all' → null (no filter); any other id is the literal region string
      // and matches one of the CASE branches in the migration.
      p_region: regionId === 'all' ? null : regionId,
    });
    if (error) {
      setFeedRows([]);
    } else {
      setFeedRows((data ?? []) as HeartcryFeedRow[]);
    }
    setFeedLoading(false);
  }, []);

  // Refresh on focus — gate first, then feed (gate failure short-circuits
  // the feed call, but we still keep the feed at [] for safe rendering).
  useFocusEffect(
    useCallback(() => {
      void loadVerification().then(() => {
        void loadFeed(selectedRegion);
      });
    }, [loadVerification, loadFeed, selectedRegion]),
  );

  // ── Region selection ──
  const handleRegionSelect = useCallback(
    (id: string) => {
      setSelectedRegion(id);
      void loadFeed(id);
    },
    [loadFeed],
  );

  // ── Hold toggle (in-memory only — persistence is a future ticket) ──
  const handleToggleHold = useCallback((id: string) => {
    setHeldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Screen 14B — gated / error ─────────────────────────────────────
  if (gateState === 'gated' || gateState === 'error') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <NavBar onHamburger={openHamburger} />
        <View style={styles.gateBody}>
          <View style={styles.gateGlyph}>
            <LockIcon size={60} />
          </View>
          <View style={styles.gateRule} />
          <View style={styles.gateCopyBlock}>
            <Text style={styles.gateLine1}>{GATE_LINE_1}</Text>
            <Text style={styles.gateLine2}>{GATE_LINE_2}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading shell ──
  if (gateState === 'loading') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <NavBar onHamburger={openHamburger} />
        <View style={styles.gateBody}>
          <ActivityIndicator color={Colors.red} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Verified surface ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <NavBar onHamburger={openHamburger} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          {/* Region filter — only when there is something to filter */}
          {feedRows.length > 0 ? (
            <>
              <RegionFilterBar
                selectedId={selectedRegion}
                onSelect={handleRegionSelect}
              />
              <View style={{ height: 14 }} />
            </>
          ) : null}

          {feedLoading ? (
            <View style={styles.feedSpinner}>
              <ActivityIndicator color={Colors.red} />
            </View>
          ) : feedRows.length > 0 ? (
            <View style={styles.cardStack}>
              {feedRows.map((row) => (
                <HeartcryCard
                  key={row.id}
                  row={row}
                  held={heldIds.has(row.id)}
                  onToggleHold={() => handleToggleHold(row.id)}
                />
              ))}
            </View>
          ) : (
            <HeartcryEmpty />
          )}
        </View>

        <ScriptureFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// NavBar — identical to v1, kept verbatim so the chrome stays stable
// across the verified / gated / loading branches.
// ─────────────────────────────────────────────────────────────────────

function NavBar({ onHamburger }: { onHamburger: () => void }) {
  return (
    <>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>The Persecuted Church</Text>
        <Pressable
          onPress={onHamburger}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityState={{ expanded: false }}
          hitSlop={10}
          style={styles.hamburger}
        >
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
          <View style={styles.hamburgerBar} />
        </Pressable>
      </View>
      <View style={styles.navHairline} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ThresholdPreamble — CD .threshold
// ─────────────────────────────────────────────────────────────────────

// KAN-65 R4 — ThresholdPreamble reverts to no-prop. The "My open HC"
// tap-target shipped on R3 (right side of meta row) is removed entirely
// until the Open Heartcries screen exists; the meta row is back to its
// original flat layout (safety chips only).
function ThresholdPreamble() {
  return (
    <View style={styles.threshold}>
      <Text style={styles.thresholdEyebrow}>{THRESHOLD_EYEBROW}</Text>
      <Text style={styles.thresholdBody}>{THRESHOLD_BODY}</Text>
      <View style={styles.thresholdMeta}>
        <ThresholdLock />
        <Text style={[styles.thresholdMetaText, styles.thresholdMetaSky]}>ENCRYPTED</Text>
        <Text style={styles.thresholdMetaDot}>·</Text>
        <Text style={styles.thresholdMetaText}>NO LOCATION SHARED</Text>
        <Text style={styles.thresholdMetaDot}>·</Text>
        <Text style={styles.thresholdMetaText}>REGION ONLY</Text>
      </View>
    </View>
  );
}

// CD inline SVG: 9 × 11, sky stroke, shackle + body — matches caml /
// other in-repo sky lock glyphs.
function ThresholdLock() {
  return (
    <Svg width={9} height={11} viewBox="0 0 10 12">
      <Rect x={1.5} y={5} width={7} height={6} rx={1} fill="none" stroke={Colors.accent} strokeWidth={1} />
      <Path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke={Colors.accent} strokeWidth={1} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PersecutedActionCard — CD .action-card
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
// RegionFilterBar — CD .region-bar
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
// HeartcryCard — CD .heartcry (red-left-accent surface card)
// ─────────────────────────────────────────────────────────────────────

function HeartcryCard({
  row,
  held,
  onToggleHold,
}: {
  row: HeartcryFeedRow;
  held: boolean;
  onToggleHold: () => void;
}) {
  const regionLabel = row.region ?? row.continent ?? '';
  const timestamp = formatRelativeTime(row.created_at);
  return (
    <View style={[styles.heartcry, held && styles.heartcryHeld]}>
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
      <Text style={styles.heartcryText}>{row.feed_content ?? ''}</Text>
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
              <CheckGlyph color={Colors.text} />
              <Text style={[styles.holdLabel, styles.holdLabelHeld]}>KEEP HOLDING</Text>
            </>
          ) : (
            <Text style={[styles.holdLabel, styles.holdLabelIdle]}>+ HOLD IN PRAYER</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function CheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12">
      <Path d="M2 6l3 3 5-6" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeartcryEmpty — CD .empty-quiet
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
// ScriptureFooter — CD .scripture-foot (Hebrews 13:3)
// ─────────────────────────────────────────────────────────────────────

function ScriptureFooter() {
  return (
    <View style={styles.scriptureFoot}>
      <Text style={styles.scriptureEyebrow}>PRAY WITH US</Text>
      <Text style={styles.scriptureVerse}>{HEB_13_3}</Text>
      <Text style={styles.scriptureRef}>{HEB_13_3_REF}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

// Cream token used for the held-space copy — matches CD --cream
// (`#E6E1D5`). Slightly softer than Colors.text on the dark surfaces,
// keeps the body legible while reading less like UI chrome.
const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  gateRoot: { flex: 1, backgroundColor: '#080808' },

  // NavBar
  navBar: {
    // Unified top-bar metrics with Home (2026-06-01).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  navHairline: { height: StyleSheet.hairlineWidth, backgroundColor: FAINT },
  navTitle: {
    // Unified wordmark with Home (2026-06-01): Cormorant 400 Regular, 26pt.
    // Red stays — intentional for the Persecuted tab. No Rp mark (Home only).
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.red,
  },
  hamburger: { gap: 4, alignItems: 'flex-end' },
  hamburgerBar: { width: 22, height: 2, backgroundColor: Colors.text, borderRadius: 1 },

  // Screen 14B gate
  gateBody: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  gateGlyph: { marginTop: 230, width: 60, height: 60 },
  gateRule: {
    marginTop: 28,
    width: 26,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.16)',
  },
  gateCopyBlock: { marginTop: 28, maxWidth: 330, gap: 12 },
  gateLine1: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0.2,
    color: Colors.text,
    textAlign: 'center',
  },
  gateLine2: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(240, 237, 230, 0.60)',
    textAlign: 'center',
  },

  // Scroll
  scrollContent: { paddingBottom: 28 },
  bodyPad: { paddingHorizontal: 22 },

  // Threshold preamble (CD .threshold)
  threshold: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT,
  },
  thresholdEyebrow: {
    // KAN-65 R2 — size bump 9.5 → 11; letter-spacing recomputed
    // proportionally against the 0.28em rule (was 2.66, now 3.08).
    // The eyebrow needs to read as a label on first arrival, not as
    // small print near the body.
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 3.08, // 0.28em × 11
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 10,
  },
  thresholdBody: {
    // KAN-65 R2 — size bump 15 → 17; lineHeight 23 → 26 (same ~1.53
    // ratio); letterSpacing 0.15 → 0.17 (same 0.01em rule). The body
    // needs to land like a hand on the shoulder, not a footnote.
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
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
    letterSpacing: 1.44, // 0.18em × 8
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  thresholdMetaSky: { color: Colors.accent, marginLeft: 4 },
  thresholdMetaDot: { color: 'rgba(240,237,230,0.32)' },

  // Action card (CD .action-card)
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
    fontFamily: Typography.scriptureItalic,
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
    letterSpacing: 1.61, // 0.14em × 11.5
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
    letterSpacing: 0.19, // 0.01em × 19
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
    letterSpacing: 1.53, // 0.18em × 8.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  regionChipLabelActive: { color: Colors.text },

  // Heartcry card (CD .heartcry)
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
    letterSpacing: 1.62, // 0.18em × 9
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
    letterSpacing: 1.26, // 0.14em × 9
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
    letterSpacing: 1.02, // 0.12em × 8.5
    textTransform: 'uppercase',
  },
  holdLabelIdle: { color: Colors.accent },
  holdLabelHeld: { color: Colors.text },

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

  // Inline feed spinner (gates the cardStack while the RPC is in-flight)
  feedSpinner: { paddingVertical: 28, alignItems: 'center' },

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
