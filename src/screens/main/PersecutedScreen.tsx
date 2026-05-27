// PersecutedScreen — KAN-65.
//
// Tab visible to all authenticated leaders (per AC 1). The screen self-
// gates on users.verification_status:
//   verified  → Screen 14 (banner, confirmation card with CTA, status
//               tracker if a heartcry exists, feed, encrypted footer,
//               Hebrews 13:3)
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
// via RLS (heartcry_own_status_read). If none exists, no tracker is
// rendered (AC 8 — absence-as-empty-state). When the leader has > 1
// row, a "1 of N" subtle indicator is shown next to the recent state.
//
// "New update on your heartcry" chip — top of the scroll area, sky pill.
// Compares current status to a per-user value stashed in AsyncStorage
// (KAN-64 Items 1a/1b only restrict heartcry CONTENT — the status enum
// is non-sensitive metadata so plain AsyncStorage is fine here). Dismiss
// is tap-only and updates the stored value; first appearance seeds
// silently so the chip never shows for a brand-new heartcry.
//
// Refresh-on-focus: useFocusEffect re-fetches verification status,
// recent heartcry + count, and feed so the tracker updates after a
// leader returns from the submission screen.

import React, { useCallback, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useHamburger } from '../../contexts/HamburgerContext';
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
  totalCount: number;
}

type GateState = 'loading' | 'verified' | 'gated' | 'error';

const FEED_PAGE_SIZE = 20;

// AC 6 — empty-state copy (verbatim from content file).
const EMPTY_FEED_COPY = 'Quiet here for now. Pray while you wait.';

// AC 3 — encrypted footer copy (verbatim from content file).
const ENCRYPTED_FOOTER =
  '🔒 This section is encrypted. What is shared here stays within the Replant network. Your safety is our responsibility.';

// AC 3 — banner + question copy (verbatim).
const BANNER_COPY =
  'This section is for churches facing severe persecution — imprisonment, prohibition of fellowship, violence, and active hunting for the faith. Handle with prayer and sobriety.';
const CONFIRMATION_Q =
  'Are you currently undergoing persecution for the name of Jesus?';

// AC 2 — Screen 14B gate copy (verbatim).
const GATE_LINE_1 = 'This section is for verified leaders in the Replant network.';
const GATE_LINE_2 = "Once your church is verified, you'll have full access.";

// Item 9 — Hebrews 13:3 verbatim (content file §7, 2026-05-26 ratified).
const HEB_13_3 =
  'Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body.';
const HEB_13_3_REF = 'Hebrews 13:3';

// Item 3 — update chip copy + AsyncStorage namespace.
const UPDATE_CHIP_COPY = 'New update on your heartcry';
// Key shape: `replant.heartcry.lastSeenStatus.<auth_uid>`. Scoped by
// auth_uid so a sign-out / different-account sign-in cannot cross-pollute.
const LAST_SEEN_KEY_PREFIX = 'replant.heartcry.lastSeenStatus.';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function PersecutedScreen() {
  const navigation = useNavigation<NavProp>();
  const { open: openHamburger } = useHamburger();
  const [gateState, setGateState] = useState<GateState>('loading');
  const [recent, setRecent] = useState<RecentHeartcry | null>(null);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [showUpdateChip, setShowUpdateChip] = useState(false);
  // Holds the active leader's auth uid so chip-dismiss can write the
  // current status against the same per-user key the read used.
  const authUidRef = useRef<string | null>(null);

  const loadVerificationAndTracker = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authId = userData.user?.id;
    if (!authId) {
      // No session — RootNavigator would have routed us to Onboarding
      // before this tab could mount. Defensive fall-through to gated.
      setGateState('gated');
      authUidRef.current = null;
      return;
    }
    authUidRef.current = authId;

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

    // Most recent own heartcry + total count for the "1 of N" indicator.
    // RLS (heartcry_own_status_read) gates this to the current leader's
    // rows; { count: 'exact' } returns the total row count alongside the
    // limited rows in the response.
    const { data: tracker, count, error: trackerErr } = await supabase
      .from('heartcries')
      .select('id, status, responded_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(1);
    if (trackerErr) {
      // Tracker failure shouldn't gate the rest of the screen — leave
      // recent at null and the rest of the verified surface renders.
      setRecent(null);
      setShowUpdateChip(false);
      return;
    }
    if (tracker && tracker.length > 0) {
      const row = tracker[0] as { id: string; status: HeartcryStatus; responded_at: string | null };
      const total = count ?? tracker.length;
      setRecent({ id: row.id, status: row.status, responded_at: row.responded_at, totalCount: total });

      // Item 3 — chip transition check. Read last-seen status for THIS
      // auth_uid; show the chip iff a stored value exists and differs
      // from the current one. First-time appearance (no stored value)
      // seeds the storage silently so the chip never fires on initial
      // submission.
      const key = LAST_SEEN_KEY_PREFIX + authId;
      try {
        const lastSeen = await AsyncStorage.getItem(key);
        if (lastSeen === null) {
          await AsyncStorage.setItem(key, row.status);
          setShowUpdateChip(false);
        } else if (lastSeen !== row.status) {
          setShowUpdateChip(true);
        } else {
          setShowUpdateChip(false);
        }
      } catch {
        // AsyncStorage failures are non-fatal — quietly suppress the
        // chip rather than risk surfacing it on every focus.
        setShowUpdateChip(false);
      }
    } else {
      setRecent(null);
      setShowUpdateChip(false);
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

  // Refresh on focus — covers initial mount AND return-from-submission
  // (modal "Done" goBack lands here and re-runs both fetches).
  useFocusEffect(
    useCallback(() => {
      void loadVerificationAndTracker().then(() => {
        void loadFeed();
      });
    }, [loadVerificationAndTracker, loadFeed]),
  );

  // Item 3 — dismiss handler. Writes the current status as the new
  // last-seen so the chip won't fire again until the next transition.
  const dismissUpdateChip = useCallback(async () => {
    setShowUpdateChip(false);
    const authId = authUidRef.current;
    const currentStatus = recent?.status;
    if (!authId || !currentStatus) return;
    try {
      await AsyncStorage.setItem(LAST_SEEN_KEY_PREFIX + authId, currentStatus);
    } catch {
      // Silent — chip is already dismissed in-memory. Worst case the
      // chip re-appears on next focus; user can dismiss again.
    }
  }, [recent?.status]);

  // ── Screen 14B — gate ────────────────────────────────────────────────
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

  // ── Loading shell ────────────────────────────────────────────────────
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

  // ── Screen 14 — verified landing ─────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <NavBar onHamburger={openHamburger} />
      <FlatList
        data={feedRows}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <FeedCard row={item} />}
        ItemSeparatorComponent={FeedSeparator}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ListHeader
            recent={recent}
            showUpdateChip={showUpdateChip}
            onDismissChip={() => { void dismissUpdateChip(); }}
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

// Item 5 — Nav bar: 52pt height, left title "The Persecuted Church" (red,
// 22pt Cormorant), right hamburger (wired to global useHamburger panel).
// Used on Screen 14, 14B, and the loading shell so the chrome is stable
// across gate states.
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

interface ListHeaderProps {
  recent: RecentHeartcry | null;
  showUpdateChip: boolean;
  onDismissChip: () => void;
  onShareHeartcry: () => void;
}

function ListHeader({ recent, showUpdateChip, onDismissChip, onShareHeartcry }: ListHeaderProps) {
  return (
    <View style={styles.headerStack}>
      {/* Item 3 — "New update on your heartcry" chip. Sits above the
          banner. Tap-to-dismiss (the whole pill OR the × glyph). */}
      {showUpdateChip ? (
        <Pressable
          onPress={onDismissChip}
          accessibilityRole="button"
          accessibilityLabel="Dismiss heartcry update notification"
          style={styles.updateChip}
        >
          <Text style={styles.updateChipText}>{UPDATE_CHIP_COPY}</Text>
          <View style={styles.updateChipDismiss}>
            <Text style={styles.updateChipDismissGlyph}>×</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerEyebrow}>SET APART</Text>
        <Text style={styles.bannerBody}>{BANNER_COPY}</Text>
      </View>

      {/* Item 1 — status tracker. Guarded: only renders when recent !==
          null (i.e., the leader has ≥1 own heartcry). When totalCount > 1
          a subtle "1 of N" indicator sits inline with the label. */}
      {recent !== null ? (
        <View style={styles.trackerBlock}>
          <View style={styles.trackerLabelRow}>
            <Text style={styles.trackerLabel}>YOUR HEARTCRY</Text>
            {recent.totalCount > 1 ? (
              <Text style={styles.trackerCount}>1 of {recent.totalCount}</Text>
            ) : null}
          </View>
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
  // Continent comes from the RPC server-side mapping (UN M.49). The
  // fallback is rare (data anomaly) — kept in the same lexicon as the
  // rest of the surface so leaders don't see "region" alongside
  // "continent" copy elsewhere.
  const continent = row.continent ?? 'Unknown continent';
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

      {/* Item 9 — Hebrews 13:3 reverent footer. Top hairline divider +
          centered Cormorant verse + DM Sans tracked reference. Per
          wireframe v2 .scripture-block. */}
      <View style={styles.scriptureBlock}>
        <View style={styles.scriptureDivider} />
        <Text style={styles.scriptureVerse}>{HEB_13_3}</Text>
        <Text style={styles.scriptureRef}>{HEB_13_3_REF}</Text>
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

  // Item 5 — Nav bar: 52pt height, left title + right hamburger. No
  // bottom border on the verified surface (wireframe v2 .nav-bar has
  // no border-bottom — the border only appears on the pushed-screen
  // variant used by KAN-64).
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.08)',
  },
  navTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    letterSpacing: 0.44, // 0.02em × 22
    color: Colors.red,
  },
  hamburger: {
    gap: 4,
    alignItems: 'flex-end',
  },
  hamburgerBar: {
    width: 22,
    height: 2,
    backgroundColor: Colors.text,
    borderRadius: 1,
  },

  // Item 7 — Screen 14B gate
  gateBody: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  gateGlyph: {
    marginTop: 230,
    width: 60,
    height: 60,
  },
  gateRule: {
    marginTop: 28,
    width: 26,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.16)',
  },
  gateCopyBlock: {
    marginTop: 28,
    maxWidth: 330,
    gap: 12,
  },
  gateLine1: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 28, // 20 × 1.4
    letterSpacing: 0.2, // 0.01em × 20
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

  // Screen 14 — list
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerStack: {
    gap: 18,
    marginBottom: 18,
  },

  // Item 3 — update chip (sky pill, full-width, dismiss-only)
  updateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 16,
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.35)',
    borderRadius: 999,
  },
  updateChipText: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.13, // 0.01em × 13
    color: Colors.accent,
  },
  updateChipDismiss: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  updateChipDismissGlyph: {
    fontFamily: Typography.body,
    fontSize: 16,
    lineHeight: 18,
    color: Colors.accent,
  },

  // Item 6 — Banner
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
    letterSpacing: 3.52, // 0.32em × 11
    color: Colors.red,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bannerBody: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26, // 17 × 1.55 ≈ 26.35
    color: Colors.text,
  },

  // Item 1 + Item 6 — Status tracker
  trackerBlock: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    borderRadius: 10,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    gap: 6,
  },
  trackerLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackerLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 3.08, // 0.28em × 11
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  trackerCount: {
    // Subtle "1 of N" indicator — mono register for an identifier feel,
    // muted-2 color so it doesn't compete with the sky label.
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 0.63,
    color: 'rgba(240, 237, 230, 0.60)',
  },
  trackerCopy: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 24, // 17 × 1.4 ≈ 23.8
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

  // Item 6 — Section header (kept at 18; already matched dispatch)
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
    letterSpacing: 0.36, // 0.02em × 18
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

  // Item 9 — Hebrews 13:3 footer scripture block
  scriptureBlock: {
    marginTop: 16,
    paddingTop: 20,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 8,
  },
  scriptureDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 18,
    lineHeight: 27, // 18 × 1.50 = 27
    color: 'rgba(240, 237, 230, 0.60)',
    maxWidth: 320,
    textAlign: 'center',
  },
  scriptureRef: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 2.94, // 0.28em × 10.5
    color: 'rgba(240, 237, 230, 0.45)',
    textTransform: 'uppercase',
  },
});

