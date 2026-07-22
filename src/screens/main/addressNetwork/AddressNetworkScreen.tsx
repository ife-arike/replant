// ─────────────────────────────────────────────
// AddressNetworkScreen — the one door a leader speaks through to the whole
// network (KAN-337). Hamburger-launched, two surfaces behind a segmented
// control: Compose and My Submissions. Verified leaders only (the hamburger
// row is hidden until active — Ruling 5).
//
// This container owns the shared state: the submissions list + open count
// (which drives Compose's at-capacity branch and the amber edits badge on
// the My Submissions segment), and the one-time intro. Everything reaches
// the backend through SECURITY DEFINER RPCs (addressNetworkApi), which fail
// soft to an in-memory store until the parallel-lane RPCs deploy.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../../constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import AtnNavBar from './AtnNavBar';
import Segmented from './Segmented';
import IntroModal from './IntroModal';
import ComposeView from './ComposeView';
import SubmissionsView from './SubmissionsView';
import { fetchSubmissions, withdrawSubmission } from './addressNetworkApi';
import { hasEditsProposed, openCountOf, type Submission } from './types';
import { useComposeIdentity } from './useComposeIdentity';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type Segment = 'compose' | 'submissions';

// One-time intro flag — SecureStore, matching the codebase's one-time-flag
// convention (ChurchTutorialOverlay). AsyncStorage is below the SEC bar.
const INTRO_SEEN_KEY = 'atn_intro_seen';

export default function AddressNetworkScreen() {
  const navigation = useNavigation<NavProp>();
  const identity = useComposeIdentity();

  const [segment, setSegment] = useState<Segment>('compose');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [introVisible, setIntroVisible] = useState(false);

  const openCount = openCountOf(submissions);
  const atCapacity = openCount >= 2;

  const load = useCallback(async () => {
    const rows = await fetchSubmissions();
    setSubmissions(rows);
  }, []);

  // Refetch whenever the screen regains focus (e.g. returning from the
  // edits-review screen after a publish / request-changes / withdraw).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // First-run intro — shown once over the (dimmed) Compose surface.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(INTRO_SEEN_KEY);
        if (!cancelled && seen !== 'true') setIntroVisible(true);
      } catch {
        // If SecureStore is unavailable, don't block the screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissIntro = useCallback(() => {
    setIntroVisible(false);
    void SecureStore.setItemAsync(INTRO_SEEN_KEY, 'true').catch(() => {});
  }, []);

  const onWithdraw = useCallback(
    async (id: string) => {
      await withdrawSubmission(id);
      await load();
    },
    [load],
  );

  const onOpenReview = useCallback(
    (submission: Submission) => {
      navigation.navigate('AddressNetworkEditReview', { submission });
    },
    [navigation],
  );

  const onViewLive = useCallback(() => {
    // "View →" opens the Home feed where the card lives. Deep-scroll to the
    // exact card is out of scope for this build (no feed deep-link infra).
    navigation.navigate('Tabs', { screen: 'Home' });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AtnNavBar title="Address the Network" onBack={() => navigation.goBack()} />

      <View style={styles.subnav}>
        <Segmented<Segment>
          options={[
            { key: 'compose', label: 'Compose' },
            { key: 'submissions', label: 'My Submissions', badge: hasEditsProposed(submissions) },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      <View style={styles.body}>
        {segment === 'compose' ? (
          <ComposeView
            identity={identity}
            atCapacity={atCapacity}
            openCount={openCount}
            onSubmitted={load}
            onGoToSubmissions={() => setSegment('submissions')}
          />
        ) : (
          <SubmissionsView
            submissions={submissions}
            openCount={openCount}
            onWithdraw={onWithdraw}
            onOpenReview={onOpenReview}
            onViewLive={onViewLive}
          />
        )}
      </View>

      <IntroModal visible={introVisible} onDismiss={dismissIntro} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  subnav: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  body: { flex: 1 },
});
