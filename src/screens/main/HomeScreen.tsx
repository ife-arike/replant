// Home screen — KAN-201 home redesign 2026-06-01.
//
// Composition (top → bottom):
//   HomeTopBar          — Rp mark + "Replant" wordmark + hamburger
//   VerificationBanner  — only when branch === 'pending' (KAN-35)
//   "TODAY"             — section label
//   DailyScriptureStrip — open variant (KAN-16)
//   "NETWORK UPDATES"   — section label
//   NetworkFeed         — FlatList; owns its own scroll + the
//                         "— held in prayer —" footer (KAN-17)
//
// The screen uses a View (not a ScrollView) at the top level because
// NetworkFeed is a FlatList and must own the scroll — the feed fills the
// remaining vertical space via feedZone (flex: 1). SafeAreaView replaces
// the old paddingTop: 60 offset, matching Prayer Wall / Persecuted.
//
// VerificationBanner is load-bearing — do not remove or relocate.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import DailyScriptureStrip from '../../components/home/DailyScriptureStrip';
import NetworkFeed from '../../components/home/NetworkFeed';
import HomeTopBar from '../../components/home/HomeTopBar';
import HomeSectionLabel from '../../components/home/HomeSectionLabel';
import VerificationBanner from '../../components/home/VerificationBanner';
import { NotificationToast, type ToastType } from '../../components/home/NotificationToast';
import { useChurchVerifiedStatus } from '../../hooks/useChurchVerifiedStatus';

export default function HomeScreen() {
  const { branch } = useAuth();
  // Distinguish church-pending vs leader-pending so the right banner variant
  // is shown. null while the check is in flight — defaults to 'church' variant.
  const churchVerified = useChurchVerifiedStatus();
  // TODO: wire toast triggers from real events (verification approved, rejected, heartcry responded)
  const [toast, setToast] = useState<ToastType | null>(null);
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <HomeTopBar />
      {toast && (
        <NotificationToast
          type={toast}
          onPress={() => { setToast(null); }}
          onDismiss={() => setToast(null)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.body}>
        {/* KAN-35 — verification countdown banner. Pending leaders see
            Home with this banner instead of a separate placeholder
            screen (Founder ruling 2026-05-22). */}
        {branch === 'pending' && (
          <VerificationBanner variant={churchVerified === true ? 'leader' : 'church'} />
        )}

        <HomeSectionLabel>Today</HomeSectionLabel>
        <DailyScriptureStrip />

        <HomeSectionLabel>Network updates</HomeSectionLabel>
        <View style={styles.feedZone}>
          <NetworkFeed />
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  kav: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Feed takes the remaining vertical space so the FlatList scrolls
  // independently — the section labels above stay anchored.
  feedZone: {
    flex: 1,
  },
});
