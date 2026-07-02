// PersecutedScreen — Multi-page expansion (Persecuted Tab rebuild).
//
// Tab visible to all authenticated leaders. The screen self-gates on
// users.verification_status:
//   verified  → TabView host with pill tabs: Feed / My Heartcries /
//               Bear Witness / Take Heart. Together is feature-flagged off.
//   anything  → Screen 14B gate (lock glyph + two lines of copy, no CTA).
//   loading   → small spinner above the gate body.
//
// Architecture: PersecutedScreen.tsx is now the TabView host. Each surface
// is a scene component imported from persecuted/scenes/. Pushed reader
// screens are registered at RootNavigator level (slide_from_right).
//
// Navigation pattern: Pill tabs (Option B) — pill chips below the NavBar.
// Red accent (never sky) — Persecuted is the only tab with red as its accent.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useViewerChurch } from '../../hooks/useViewerChurch';
import { viewerOrgCopy } from '../../utils/displayHelpers';
import LockIcon from '../../components/icons/LockIcon';
import PillTabBar, { type PillRoute } from './persecuted/components/PillTabBar';
import FeedScene from './persecuted/scenes/FeedScene';
import MyHeartcriesScene from './persecuted/scenes/MyHeartcriesScene';
import BearWitnessScene from './persecuted/scenes/BearWitnessScene';
import TakeHeartScene from './persecuted/scenes/TakeHeartScene';

// ── Constants ────────────────────────────────────────────────────────

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type GateState = 'loading' | 'verified' | 'gated' | 'error';

// KAN-65 AC 2 — gate copy (Screen 14B) — verbatim from content file.
// GATE_LINE_2 swaps "church" → "organization" via viewerOrgCopy at render time
// for para-ministry viewers (BA-para #1).
const GATE_LINE_1 = 'This section is for verified leaders in the Replant network.';

// Pill tab routes — Together is feature-flagged off until 5k+ leaders
const PILL_ROUTES: PillRoute[] = [
  { key: 'feed', title: 'Feed' },
  { key: 'mine', title: 'My Heartcries' },
  { key: 'memorial', title: 'Bear Witness' },
  { key: 'encouragement', title: 'Take Heart' },
  // { key: 'stand', title: 'Together' }, // POST-MVP — feature-flagged off
];

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────

export default function PersecutedScreen() {
  const [gateState, setGateState] = useState<GateState>('loading');
  const [activeTab, setActiveTab] = useState(0);
  // Para-ministry copy swap on the gate body line (BA-para #1).
  const { church: viewerChurch } = useViewerChurch();
  const viewer = viewerOrgCopy(viewerChurch?.type);
  const gateLine2 = `Once ${viewer.yourChurchOrOrg} is verified, you'll have full access.`;

  // Keep a ref in sync so useFocusEffect can read current gate state
  // without including it in the dependency array (which would re-subscribe
  // the effect on every state change).
  const gateStateRef = useRef<GateState>('loading');
  useEffect(() => { gateStateRef.current = gateState; }, [gateState]);

  // ── Gate check ──
  const loadVerification = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const authId = userData.user?.id;
    if (!authId) {
      setGateState('gated');
      return;
    }
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

  // Only re-check verification when not already verified. Once verified,
  // skip the re-check on every tab focus to avoid the loading spinner
  // flash and scene unmount/remount cycle. Gated/error states still
  // re-check (the admin may have approved the leader since last visit).
  useFocusEffect(
    useCallback(() => {
      if (gateStateRef.current !== 'verified') {
        void loadVerification();
      }
    }, [loadVerification]),
  );

  // ── Pill tab navigation callback ──
  const handleNavigateToTab = useCallback((tabIndex: number) => {
    setActiveTab(tabIndex);
  }, []);

  // ── Screen 14B — gated / error ─────────────────────────────────────
  if (gateState === 'gated' || gateState === 'error') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <NavBar />
        <View style={styles.gateBody}>
          <View style={styles.gateGlyph}>
            <LockIcon size={60} />
          </View>
          <View style={styles.gateRule} />
          <View style={styles.gateCopyBlock}>
            <Text style={styles.gateLine1}>{GATE_LINE_1}</Text>
            <Text style={styles.gateLine2}>{gateLine2}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading shell ──
  if (gateState === 'loading') {
    return (
      <SafeAreaView style={styles.gateRoot} edges={['top']}>
        <NavBar />
        <View style={styles.gateBody}>
          <ActivityIndicator color={Colors.red} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Verified surface — TabView host with pill tabs ─────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Left-edge red accent line */}
      <View pointerEvents="none" style={styles.leftEdgeAccent} />
      <NavBar />
      <PillTabBar
        routes={PILL_ROUTES}
        activeIndex={activeTab}
        onTabPress={setActiveTab}
      />
      <View style={styles.sceneContainer}>
        <View style={{ flex: 1, display: activeTab === 0 ? 'flex' : 'none' }}>
          <FeedScene onNavigateToTab={handleNavigateToTab} />
        </View>
        <View style={{ flex: 1, display: activeTab === 1 ? 'flex' : 'none' }}>
          <MyHeartcriesScene />
        </View>
        <View style={{ flex: 1, display: activeTab === 2 ? 'flex' : 'none' }}>
          <BearWitnessScene />
        </View>
        <View style={{ flex: 1, display: activeTab === 3 ? 'flex' : 'none' }}>
          <TakeHeartScene />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// NavBar — shared across verified, gated, and loading branches.
// Three-row structure: title / subtitle + hairline.
// ─────────────────────────────────────────────────────────────────────

function NavBar() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>The Persecuted Church</Text>
      <Text style={styles.headerSubtitle}>
        ENCRYPTED · ANONYMOUS · WITHIN THE NETWORK
      </Text>
      <View style={styles.headerHairline} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  gateRoot: { flex: 1, backgroundColor: '#080808' },

  // Left-edge red accent (verified surface only)
  leftEdgeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.red,
    opacity: 0.25,
    zIndex: 1,
  },

  // NavBar
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 0 },
  headerTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.red,
  },
  headerSubtitle: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 6,
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(217,89,79,0.30)',
    marginTop: 14,
  },

  // Scene container — fills remaining space below pills
  sceneContainer: { flex: 1 },

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
});
