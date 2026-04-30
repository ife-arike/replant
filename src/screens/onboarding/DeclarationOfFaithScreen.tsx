// ─────────────────────────────────────────────
// Screen 02 — Declaration of Faith
// Scroll-gate: "I Agree" disabled until user reaches bottom (pixel-based).
// "I Do Not Agree" → modal, navigation locked, no exit (iOS-safe).
// No back navigation from this screen.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DeclarationOfFaith'>;

const SCROLL_THRESHOLD = 20; // px from bottom to unlock — handles font scaling variance

const DECLARATION_TEXT =
  'Jesus Christ is the Word of God made flesh, born of the Virgin Mary, crucified under ' +
  'Pontius Pilate, buried, and raised on the third day. He ascended to the Father and will ' +
  'come again. The Holy Bible is the only source of truth.';

export default function DeclarationOfFaithScreen({ navigation }: Props) {
  const { setDeclarationAgreed } = useOnboarding();
  const [agreedEnabled, setAgreedEnabled] = useState(false);
  const [declineModalVisible, setDeclineModalVisible] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom <= SCROLL_THRESHOLD) {
      setAgreedEnabled(true);
    }
  };

  const handleAgree = () => {
    setDeclarationAgreed(true);
    navigation.replace('AccountSetupPage1');
  };

  const handleDecline = () => {
    setDeclineModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>REPLANT</Text>
        <Text style={styles.headerSub}>Declaration of Faith</Text>
      </View>

      {/* Scrollable declaration */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.declarationIntro}>
          Before joining the network, you are asked to affirm the following:
        </Text>

        <View style={styles.declarationBlock}>
          <View style={styles.declarationAccent} />
          <Text style={styles.declarationText}>{DECLARATION_TEXT}</Text>
        </View>

        <Text style={styles.declarationFooter}>
          This is the foundation on which Replant is built. The network exists to connect
          those who hold this faith in common — across cities, regions, and nations.
        </Text>

        {/* Scroll anchor — ensures user reaches true bottom */}
        <View style={styles.scrollAnchor} />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.agreeButton, !agreedEnabled && styles.agreeButtonDisabled]}
          onPress={handleAgree}
          disabled={!agreedEnabled}
          activeOpacity={0.8}
        >
          <Text style={[styles.agreeButtonText, !agreedEnabled && styles.agreeButtonTextDisabled]}>
            I Agree
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          activeOpacity={0.6}
        >
          <Text style={styles.declineButtonText}>I Do Not Agree</Text>
        </TouchableOpacity>

        {!agreedEnabled && (
          <Text style={styles.scrollHint}>Scroll to read the full declaration</Text>
        )}
      </View>

      {/* Decline modal — navigation locked, iOS-safe (no programmatic close) */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Access Not Possible</Text>
            <Text style={styles.modalBody}>
              Replant is built on this foundation. Without agreement, access is not possible.
            </Text>
            {/* No "Exit App" — iOS prohibits programmatic close. Navigation is dead-ended. */}
            <Text style={styles.modalNote}>
              Close the app to exit.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLabel: {
    fontFamily: Typography.display,
    fontSize: 13,
    letterSpacing: 6,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  headerSub: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.5,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  declarationIntro: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  declarationBlock: {
    flexDirection: 'row',
    marginBottom: Spacing.xl,
  },
  declarationAccent: {
    width: 2,
    backgroundColor: Colors.accent,
    marginRight: Spacing.md,
    borderRadius: 1,
  },
  declarationText: {
    flex: 1,
    fontFamily: Typography.displayItalic,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 34,
    letterSpacing: 0.3,
  },

  declarationFooter: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  scrollAnchor: {
    height: Spacing.xxxl,
  },

  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },

  agreeButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  agreeButtonDisabled: {
    backgroundColor: 'rgba(107, 181, 232, 0.2)',
  },
  agreeButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 0.3,
  },
  agreeButtonTextDisabled: {
    color: 'rgba(107, 181, 232, 0.4)',
  },

  declineButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineButtonText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  scrollHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  modalBody: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  modalNote: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
});
