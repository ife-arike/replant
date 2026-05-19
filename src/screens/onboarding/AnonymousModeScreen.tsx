// ─────────────────────────────────────────────
// Screen 04 (KAN-11) — Anonymous Mode (stub)
//
// Placeholder for the Underground-vs-Identified branching question that
// follows Account Setup Page 1. The full screen is out of scope for KAN-11
// (built as part of KAN-12 or a follow-up). This stub exists so Page 1's
// navigation target resolves cleanly and a smoke test of the new flow does
// not crash.
//
// Back-nav: gesture is allowed (per OnboardingNavigator config) — this is
// the first step where the user CAN go back. AC #14 (no back to DoF) is
// enforced upstream on AccountSetupPage1.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AnonymousMode'>;

export default function AnonymousModeScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>ANONYMOUS MODE</Text>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.subtitle}>
          This screen will ask whether you want to remain anonymous within the network.
          For now, it is a placeholder while the rest of onboarding is built.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.accent,
  },
  stepLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },
});
