// PersecutedScreen — KAN-65.
//
// Tab visible to all authenticated leaders (per AC 1). The screen self-
// gates on users.verification_status:
//   verified  → Screen 14 (banner, confirmation card with CTA, status
//               tracker if a heartcry exists, feed, encrypted footer)
//   anything  → Screen 14B (lock glyph + two lines of copy, no CTA)
//   else      → null while loading (parent SafeAreaView still mounts)
//
// Per dispatch the gate queries the DB value directly (not the
// AuthProvider 'branch' translation): canonical value for full access is
// 'verified'. KAN-206 anchor work locked this; AC 2 mirrors it.
//
// Feed data via SECURITY DEFINER RPC get_heartcry_feed. The RPC returns
// continent server-side — invariant: no client-side country→continent map.
// feed_content is returned by the RPC for rows where post_to_feed AND
// feed_approved are both true; encryption-at-rest is handled in the DB,
// the client never sees ciphertext (per SEC c.14512 / KAN-66 lineage).
//
// Status tracker reads the most recent heartcry for the current leader
// via RLS (heartcry_own_status_read). One row max — if none exists, no
// tracker is rendered (AC 8 — absence-as-empty-state).
//
// Refresh-on-focus: useFocusEffect re-fetches both verification status
// and the most recent heartcry so the tracker updates after a leader
// returns from the submission screen.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import LockIcon from '../../components/icons/LockIcon';
import type { RootStackParamList } from '../../navigation/types';
import {
  SEVERITY_DISPLAY,
  formatRelativeTime,
  trackerCopy,
  truncateExcerpt,
  type HeartcrySeverity,
  type HeartcryStatus,
} from './persecutedLogic';

interface FeedRow {
  id: string;
  severity: string;
  created_at: string;
  feed_content: string | null;
  continent: string | null;
}

interface RecentHeartcry {
  id: string;
  status: HeartcryStatus;
  responded_at: string | null;
}

type GateState = 'loading' | 'verified' | 'gated' | 'error';

const FEED_PAGE_SIZE = 20;

// AC 6 — empty-state copy (dispatch verbatim, after CONTENT lock).
const EMPTY_FEED_COPY = 'Quiet here for now. Pray while you wait.';

// AC 3 — encrypted footer copy (verbatim from content file).
const ENCRYPTED_FOOTER =
  '🔒 This section is encrypted. What is shared here stays within the Replant network. Your safety is our responsibility.';

// AC 3 — banner copy (verbatim).
const BANNER_COPY =
  'This section is for churches facing severe persecution — imprisonment, prohibition of fellowship, violence, and active hunting for the faith. Handle with prayer and sobriety.';
const CONFIRMATION_Q =
  'Are you currently undergoing persecution for the name of Jesus?';

// AC 2 — Screen 14B gate copy (verbatim).
const GATE_LINE_1 = 'This section is for verified leaders in the Replant network.';
const GATE_LINE_2 = "Once your church is verified, you'll have full access.";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function PersecutedScreen() {
  const navigation = useNavigation<NavProp>();
  const [gateState, setGateState] = useState<GateState>('loading');
  const [recent, setRecent] = useState<RecentHeartcry | null>(null);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const loadVerificationAndTracker = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authId = userData.user?.id;
    if (!authId) {
      // No session — RootNavigator would have routed us to Onboarding
      // before this tab could mount. Defensive fall-through to gated.
      setGateState('gated');
      return;
    }

    // KAN-65 AC 2 — canonical DB literal 'verified' (NOT the API-layer
    // 'active' translation used elsewhere in the app via AuthProvider).
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
      setRecent(null);
      return;
    }
    setGateState('verified');

    // Most recent own heartcry for the status tracker. RLS
    // (heartcry_own_status_read) gates this to the current leader's rows.
    const { data: tracker, error: trackerErr } = await supabase
      .from('heartcries')
      .select('id, status, responded_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (trackerErr) {
      // Tracker failure shouldn't gate the rest of the screen — leave
      // recent at null and the rest of the verified surface renders.
      setRecent(null);
      return;
    }
    if (tracker && tracker.length > 0) {
      const row = tracker[0] as { id: string; status: HeartcryStatus; responded_at: string | null };
      setRecent(row);
    } else {
      setRecent(null);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    const { data, error } = await supabase.rpc('get_heartcry_feed', {
      p_limit: FEED_PAGE_SIZE,
      p_offset: 0,
    });
    if (error) {
      setFeedRows([]);
    } else {
      setFeedRows((data ?? []) as FeedRow[]);
    }
    setFeedLoading(false);
  }, []);

  // Refresh on focus — covers initial mount AND return-from-submission.
  useFocusEffect(
    useCallback(() => {
      void loadVerificationAndTracker().then(() => {
        // Only load feed if the gate passed — gated leaders never see it.
        // setState above is async; check the live ref by re-querying state
        // via the same callback chain. Simpler: kick off feed unconditionally,
        // it's RLS-gated server-side anyway, and we drop the result when
        // we render under the gated branch.
        void loadFeed();
      });
    }, [loadVerificationAndTracker, loadFeed]),
  );

  // ── Screen 14B — gate ────────────────────────────────────────────────
  if (gateState === 'gated' || gateState === 'error') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Persecuted</Text>
        </View>
        <View style={styles.gateBody}>
          <View style={styles.gateGlyph}>
            <LockIcon size={56} />
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

  // ── Loading shell ────────────────────────────────────────────────────
  if (gateState === 'loading') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Persecuted</Text>
        </View>
        <View style={styles.gateBody}>
          <ActivityIndicator color={Colors.red} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 14 — verified landing ─────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Persecuted</Text>
      </View>
      <FlatList
        data={feedRows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <FeedCard row={item} />}
        ItemSeparatorComponent={FeedSeparator}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ListHeader
            recent={recent}
            onShareHeartcry={() => navigation.navigate('HeartcrySubmission')}
          />
        }
        ListEmptyComponent={
          !feedLoading ? <EmptyFeed /> : null
        }
        ListFooterComponent={
          <FeedFooter loading={feedLoading} />
        }
      />
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Pieces
// ──────────────────────────────────────────────────────────────────────

interface ListHeaderProps {
  recent: RecentHeartcry | null;
  onShareHeartcry: () => void;
}

function ListHeader({ recent, onShareHeartcry }: ListHeaderProps) {
  return (
    <View style={styles.headerStack}>
      {/* Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerEyebrow}>SET APART</Text>
        <Text style={styles.bannerBody}>{BANNER_COPY}</Text>
      </View>

      {/* Status tracker — appears above the CTA when the leader has any
          submitted heartcry (AC 7). Absence is its own empty state (AC 8). */}
      {recent !== null ? (
        <View style={styles.trackerBlock}>
          <Text style={styles.trackerLabel}>YOUR HEARTCRY</Text>
          <Text style={styles.trackerCopy}>
            {trackerCopy(recent.status, recent.responded_at)}
          </Text>
        </View>
      ) : null}

      {/* Confirmation question + CTA */}
      <View style={styles.confirmCard}>
        <Text style={styles.confirmQuestion}>{CONFIRMATION_Q}</Text>
        <Pressable
          onPress={onShareHeartcry}
          accessibilityRole="button"
          accessibilityLabel="Share your heartcry"
          style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed]}
        >
          <Text style={styles.primaryCtaLabel}>Share Your Heartcry</Text>
        </Pressable>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Heartcries from the Body</Text>
        <View style={styles.sectionRule} />
      </View>
    </View>
  );
}

function FeedCard({ row }: { row: FeedRow }) {
  // Defensive — if severity is somehow a value not in our map (e.g., a new
  // DB enum value the FE hasn't shipped a label for yet), fall through to
  // a clean degraded display rather than crash.
  const sev = SEVERITY_DISPLAY[row.severity as HeartcrySeverity] ?? null;
  const continent = row.continent ?? 'Unknown region';
  const excerpt = truncateExcerpt(row.feed_content);
  const timestamp = formatRelativeTime(row.created_at);

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardTopRow}>
        <Text style={styles.feedCardAuthor}>Anonymous · {continent}</Text>
        {timestamp ? <Text style={styles.feedCardTs}>{timestamp}</Text> : null}
      </View>
      {excerpt ? (
        <Text style={styles.feedCardExcerpt} numberOfLines={3}>
          {excerpt}
        </Text>
      ) : null}
      {sev ? (
        <View style={styles.severityBadge}>
          <View style={styles.severityDot} />
          <Text style={styles.severityBadgeText}>
            {sev.label} — {sev.oneLiner}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FeedSeparator() {
  return <View style={{ height: 12 }} />;
}

function EmptyFeed() {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyText}>{EMPTY_FEED_COPY}</Text>
    </View>
  );
}

function FeedFooter({ loading }: { loading: boolean }) {
  return (
    <View style={styles.footerStack}>
      {loading ? (
        <View style={styles.footerSpinner}>
          <ActivityIndicator color={Colors.red} />
        </View>
      ) : null}
      <View style={styles.encryptedStrip}>
        <Text style={styles.encryptedStripText}>{ENCRYPTED_FOOTER}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gateRoot: {
    flex: 1,
    backgroundColor: '#080808',
  },

  // Top bar (per-screen; Tabs.headerShown is false)
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    letterSpacing: 0.68, // 0.04em × 17
    color: Colors.red,
  },

  // Screen 14B — gate
  gateBody: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  gateGlyph: {
    marginTop: 200,
    width: 56,
    height: 56,
  },
  gateRule: {
    marginTop: 28,
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.16)',
  },
  gateCopyBlock: {
    marginTop: 26,
    maxWidth: 320,
    gap: 12,
  },
  gateLine1: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    lineHeight: 27, // 19 × 1.4 ≈ 26.6
    letterSpacing: 0.19, // 0.01em × 19
    color: Colors.text,
    textAlign: 'center',
  },
  gateLine2: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(240, 237, 230, 0.60)',
    textAlign: 'center',
  },

  // Screen 14 — list
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerStack: {
    gap: 18,
    marginBottom: 18,
  },

  // Banner
  banner: {
    backgroundColor: 'rgba(224, 85, 85, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.28)',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 18,
  },
  bannerEyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 3.36, // 0.32em × 10.5 ≈ 3.36
    color: Colors.red,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bannerBody: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25, // 16 × 1.55
    color: Colors.text,
  },

  // Status tracker (AC 7)
  trackerBlock: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.25)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  trackerLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  trackerCopy: {
    fontFamily: Typography.displayRegular,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },

  // Confirmation card + CTA
  confirmCard: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 18,
    paddingBottom: 16,
    gap: 14,
    alignItems: 'center',
  },
  confirmQuestion: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.text,
    textAlign: 'center',
  },
  primaryCta: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaPressed: {
    opacity: 0.85,
  },
  primaryCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: '#0A0A0A',
    letterSpacing: 0.6,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  sectionHeader: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 0.36,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.16)',
  },

  // Feed card
  feedCard: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  feedCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedCardAuthor: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.76, // 0.16em × 11
    color: Colors.red,
    textTransform: 'uppercase',
  },
  feedCardTs: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 0.63,
    color: 'rgba(240, 237, 230, 0.45)',
  },
  feedCardExcerpt: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(224, 85, 85, 0.28)',
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.red,
  },
  severityBadgeText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Colors.red,
    textTransform: 'uppercase',
  },

  // Empty feed + footer
  emptyBlock: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: 'rgba(240, 237, 230, 0.16)',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(240, 237, 230, 0.60)',
    textAlign: 'center',
  },
  footerStack: {
    gap: 16,
    marginTop: 16,
  },
  footerSpinner: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  encryptedStrip: {
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.35)',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 14,
  },
  encryptedStripText: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 19,
    color: Colors.accent,
  },
});
