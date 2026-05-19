// ─────────────────────────────────────────────
// Screen 03A — Anonymous Mode Choice (KAN-83)
//
// Privacy onboarding step between Account Setup Page 1 (KAN-11) and
// Account Setup Page 2 (KAN-12). Captures a single boolean — anonymous —
// into OnboardingContext. No DB write at this step; the value travels to
// the create-account edge function on KAN-12.
//
// Copy is LOCKED per Founder + SPEC c.13246 (2026-05-19). Do not edit
// strings without a fresh Founder ruling — high-judgement pastoral copy.
//
// Default selection: Option A (anonymous = false) — D-37 / c.13246.
//
// Live preview lines render via the canonical getLeaderDisplayName helper
// (src/utils/getLeaderDisplayName.ts — ESC-08 close, 2026-05-04) using the
// "Your Church" placeholder because church details aren't collected until
// KAN-12. Consumer surfaces (KAN-20/22/68/69/70) will use the same helper
// at runtime against real church names — no rendering drift.
//
// Back navigation: gestureEnabled: true on the navigator (Founder c.13246).
// Leaders may return to Page 1 to correct typos before locking the choice.
// No manual back button rendered on this screen — gesture-only.
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { ROLES } from '../../utils/displayHelpers';
import { getLeaderDisplayName } from '../../utils/getLeaderDisplayName';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AnonymousMode'>;

// Locked copy — c.13246 (SPEC + Founder, 2026-05-19). Do not change.
const COPY = {
  stepLabel: 'ACCOUNT SETUP · PRIVACY',
  header: 'How would you like to appear to other leaders in the network?',
  optionA: {
    title: 'Show my name',
    body: 'Other leaders in the network will see your name and church together. This is the default.',
  },
  optionB: {
    title: 'Keep it private',
    body: 'Other leaders see your role and church, but not your name. You can still send and receive messages. Some leaders choose this for safety, ministry context, or personal reasons.',
  },
  churchPlaceholder: 'Your Church',
  greySubtext: 'This preference can be changed at any point in settings.',
  continue: 'Continue',
} as const;

// VoiceOver / TalkBack announcement on mount — Gap-3 accessibility AC.
const A11Y_MOUNT_ANNOUNCEMENT = 'Show my name selected by default';

export default function AnonymousModeScreen({ navigation }: Props) {
  const { state, setPersonalDetails } = useOnboarding();

  // D-37 default — c.13246 ratifies anonymous = false on mount.
  const [anonymous, setAnonymous] = useState<boolean>(false);

  // Mount-time a11y announcement so screen-reader users hear the default
  // selection without having to navigate to it. RN-native API; no shim.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(A11Y_MOUNT_ANNOUNCEMENT);
  }, []);

  // Resolve preview-line inputs from OnboardingContext (populated by Page 1).
  // Empty-string defaults are deliberate — getLeaderDisplayName documents
  // and pins this behavior in its test suite. A leader landing here without
  // Page 1 data is a flow bug, not a render bug.
  const firstName = state.personalDetails.firstName ?? '';
  const lastName = state.personalDetails.lastName ?? '';
  const rawRole = state.personalDetails.role ?? '';
  const roleLabel = ROLES.find((r) => r.value === rawRole)?.label ?? rawRole;

  const previewA = getLeaderDisplayName({
    firstName,
    lastName,
    roleLabel,
    churchName: COPY.churchPlaceholder,
    anonymous: false,
  });
  const previewB = getLeaderDisplayName({
    firstName,
    lastName,
    roleLabel,
    churchName: COPY.churchPlaceholder,
    anonymous: true,
  });

  const handleContinue = () => {
    setPersonalDetails({ anonymous });
    navigation.navigate('AccountSetupPage2');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Text style={styles.stepLabel}>{COPY.stepLabel}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {COPY.header}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Network visibility preference"
          style={styles.cardGroup}
        >
          <Card
            title={COPY.optionA.title}
            body={COPY.optionA.body}
            preview={previewA}
            selected={anonymous === false}
            onPress={() => setAnonymous(false)}
          />
          <Card
            title={COPY.optionB.title}
            body={COPY.optionB.body}
            preview={previewB}
            selected={anonymous === true}
            onPress={() => setAnonymous(true)}
          />
        </View>

        <Text style={styles.greySubtext}>{COPY.greySubtext}</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={COPY.continue}
        >
          <Text style={styles.continueButtonText}>{COPY.continue}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

interface CardProps {
  title: string;
  body: string;
  preview: string;
  selected: boolean;
  onPress: () => void;
}

function Card({ title, body, preview, selected, onPress }: CardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={[styles.card, selected ? styles.cardSelected : styles.cardUnselected]}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.indicator, selected && styles.indicatorSelected]}>
          {selected && <View style={styles.indicatorDot} />}
        </View>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
      <Text style={styles.cardPreview}>{preview}</Text>
    </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    lineHeight: 36,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },

  cardGroup: {
    gap: Spacing.md,
  },

  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    minHeight: 120, // comfortable tap target — pastoral moment, not cramped
  },
  cardUnselected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  cardSelected: {
    backgroundColor: 'rgba(107, 181, 232, 0.06)', // accent tint — see Colors.accent
    borderColor: Colors.accent,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 17,
    color: Colors.text,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  cardBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 21,
  },
  cardPreview: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },

  indicator: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSelected: {
    borderColor: Colors.accent,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },

  greySubtext: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },

  bottomSpacer: { height: Spacing.xxxl },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  continueButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
});
