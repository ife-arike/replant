// KAN-205 — Post-deletion goodbye overlay (CONTENT copy set §4,
// Founder-ratified 2026-07-03).
//
// Floats over the Login surface exactly like DeactivationModal: mounted at
// App.tsx top level as a sibling to NavigationContainer, driven by
// AuthProvider.goodbyeVisible. The deletion paths (DeleteAccountFlow
// success and RestoreScreen "Continue with deletion") call showGoodbye()
// BEFORE their signOut so the overlay survives the branch flip to
// unauthenticated.
//
// COLD-VIEWABLE SURFACE — the copy is written mechanism-free by design and
// is ONE register for every account class (CONTENT §4: "cold-viewable, so
// ONE copy for all accounts"). No underground variant exists and none may
// be added: anything rendered over Login can be seen by anyone holding the
// device. Do not add account-specific detail here.
//
// Copy is VERBATIM from the ratified CONTENT file — do not rewrite.

import React from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';

const CONTACT_EMAIL = 'accounts@projectreplant.org';

const BODY_PARAGRAPHS = [
  'Deletion completes in 30 days. If you change your mind before then, return within the window and your account can be restored.',
  'Thank you for the time you spent here. Go in peace — you will be welcome back.',
];

export default function GoodbyeModal() {
  const { goodbyeVisible, dismissGoodbye } = useAuth();
  const insets = useSafeAreaInsets();

  if (!goodbyeVisible) return null;

  const handleDismiss = () => {
    dismissGoodbye();
  };

  // Email centerpiece — copy first (survives a failed mailer open), then
  // attempt the composer, then dismiss. DeactivationModal pattern.
  const handleContact = async () => {
    try {
      await Clipboard.setStringAsync(CONTACT_EMAIL);
      AccessibilityInfo.announceForAccessibility('Email address copied to clipboard.');
    } catch {
      // Clipboard unavailable — the address is still visible on screen.
    }
    try {
      await Linking.openURL(`mailto:${CONTACT_EMAIL}`);
    } catch {
      // No mail client — the address is on the clipboard from above.
    }
    dismissGoodbye();
  };

  return (
    <Pressable
      style={styles.backdrop}
      onPress={handleDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss account closing notice"
    >
      <View
        style={[
          styles.cardWrapper,
          { paddingBottom: Math.max(insets.bottom + 6, 22) },
        ]}
      >
        <View
          style={styles.card}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.title} accessibilityRole="header">
            Your account is closing.
          </Text>
          <View style={styles.bodyBlock}>
            {BODY_PARAGRAPHS.map((p, i) => (
              <Text key={i} style={[styles.body, i > 0 && styles.bodyGap]}>
                {p}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={handleContact}
            style={styles.contactPressable}
            accessibilityRole="link"
            accessibilityLabel={`Email ${CONTACT_EMAIL}`}
            accessibilityHint="Copies the address and opens your mail app"
          >
            <Text style={styles.contactText}>{CONTACT_EMAIL}</Text>
          </Pressable>
          <Text style={styles.hint}>
            TAP TO COPY &amp; OPEN MAIL{'\n'}OR TAP OUTSIDE TO CLOSE
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.12)',
    borderRadius: 14,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 25,
    elevation: 24,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    // Quiet sky rather than DeactivationModal's red — this leader chose
    // to leave; the surface is a farewell, not an alarm.
    color: 'rgba(107, 181, 232, 0.7)',
    textTransform: 'uppercase',
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.4,
    marginBottom: 16,
    textAlign: 'center',
  },
  bodyBlock: {
    alignSelf: 'stretch',
    marginBottom: 18,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 24,
    textAlign: 'left',
  },
  bodyGap: {
    marginTop: 10,
  },
  contactPressable: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.12)',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  contactText: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 19,
    color: Colors.accent,
    textAlign: 'center',
  },
  hint: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.0,
    color: 'rgba(240, 237, 230, 0.30)',
    textTransform: 'uppercase',
    lineHeight: 17,
    textAlign: 'center',
  },
});
