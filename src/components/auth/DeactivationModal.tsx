// KAN-36 v2 — Deactivation modal overlay (SEC c.14235 + Founder ratification
// c.14236, locked 2026-05-24). Replaces the PR #72 full-screen
// DeactivatedPlaceholderScreen with a modal that floats over the login
// surface.
//
// Architecture (per docs/Replant Deactivation Flow v3.html):
//   - Mounted at App.tsx top level as a sibling to NavigationContainer
//     and HamburgerPanel, so it overlays whatever navigator screen is
//     currently mounted.
//   - AuthProvider sets `deactivationModalPath` AND calls
//     supabase.auth.signOut() when auth-status-check returns deactivated.
//     The branch flips to "unauthenticated" via the SIGNED_OUT
//     onAuthStateChange handler — Login (under OnboardingNavigator) sits
//     behind this modal once the navigation settles.
//   - Dismiss (tap outside, tap contact, tap-elsewhere-on-card) clears
//     the modal path via dismissDeactivationModal. The session is
//     already gone, so the leader is back on Login able to try a
//     different account.
//
// Two copy variants per c.14235 #2:
//   - verification_renewal — Founder's renewal-window copy from design v3
//     line 268-269. The leader's deactivation was driven by their
//     verification_deadline passing (cron- or login-check-flipped).
//   - support_contact — admin-manual / NULL-deadline fail-closed /
//     super_admin downgrade. The leader can only re-engage via a human
//     conversation, so the copy points at accounts@ directly.
//
// Email address: accounts@projectreplant.org per design v3 c.348. The
// PR #72 placeholder used connect@; this surface replaces every
// reference with accounts@.
//
// Backdrop: design v3 specifies rgba(0,0,0,0.55) + backdrop-filter:
// blur(10px) saturate(120%). expo-blur is not installed at MVP (see
// src/components/hamburger/HamburgerPanel.tsx line 520 for the same
// deferral), so the dim is bumped to rgba(0,0,0,0.72) to compensate
// for the missing blur. When expo-blur lands the dim should drop back
// to 0.55 and a BlurView wrap the backdrop Pressable.

import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, type RecoveryPath } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';

const CONTACT_EMAIL = 'accounts@projectreplant.org';

// Copy strings — c.14235 #2.
//
// verification_renewal: design v3 lines 268-269 (two real <p>
// paragraphs, 8px gap). Tone is solemn-but-actionable: the leader
// missed their window, and the path forward is to write to us.
const COPY_RENEWAL_PARAGRAPHS = [
  "Your church verification window expired and your account has been deactivated. We're sorry for the difficulty this may cause.",
  "If you'd like to appeal or restore access, write to us.",
];

// support_contact: dispatch copy. Single paragraph by design — the
// leader does not have a window to renew, so framing the renewal
// case would be a false promise. The reach-out-to-us guidance is the
// full body of work.
const COPY_SUPPORT_PARAGRAPHS = [
  'Your account has been deactivated. If you believe this was done in error or would like to connect with us to reinstate, please reach out to us at accounts@projectreplant.org',
];

function paragraphsFor(path: RecoveryPath): string[] {
  switch (path) {
    case 'verification_renewal':
      return COPY_RENEWAL_PARAGRAPHS;
    case 'support_contact':
      return COPY_SUPPORT_PARAGRAPHS;
  }
}

export default function DeactivationModal() {
  const { deactivationModalPath, dismissDeactivationModal } = useAuth();
  const insets = useSafeAreaInsets();

  if (deactivationModalPath === null) return null;

  // Backdrop tap = dismiss. Card taps that aren't the contact pressable
  // bubble to the backdrop (the inner View has no onPress), so any tap
  // on the card body or hint or title also dismisses — matching design
  // v3's "tap outside the contact line dismisses" rule.
  const handleDismiss = () => {
    dismissDeactivationModal();
  };

  // Contact-line tap — copy + open mailer + dismiss. Mailer-open is
  // fire-and-forget; on most devices it backgrounds the app and the
  // modal dismiss completes regardless of whether the leader sends a
  // message. Clipboard copy runs first so the address is on the
  // clipboard even if the mailer fails to open.
  const handleContact = async () => {
    try {
      await Clipboard.setStringAsync(CONTACT_EMAIL);
    } catch {
      // Clipboard unavailable (sandboxed test env, permission denied) —
      // fall through. Address is still visible + the mailer attempt below
      // pre-fills it.
    }
    try {
      await Linking.openURL(`mailto:${CONTACT_EMAIL}`);
    } catch {
      // No mail client configured — fall through. Leader has the address
      // on the clipboard from the step above.
    }
    dismissDeactivationModal();
  };

  const paragraphs = paragraphsFor(deactivationModalPath);

  // Bottom-anchored per design v3: align-items: flex-end with a 16/22 px
  // gutter, respecting the safe-area inset on devices with a home
  // indicator. The card lifts off the dimmed background via shadow +
  // lighter surface (#181818) per the AFTER mockup pins 1 & 3.
  return (
    <Pressable
      style={styles.backdrop}
      onPress={handleDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss deactivation notice"
    >
      <View
        style={[
          styles.cardWrapper,
          { paddingBottom: Math.max(insets.bottom + 6, 22) },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A NOTE ON YOUR ACCOUNT</Text>
          <Text style={styles.title}>Account deactivated</Text>
          <View style={styles.bodyBlock}>
            {paragraphs.map((p, i) => (
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
          >
            <Text style={styles.contactText}>{CONTACT_EMAIL}</Text>
          </Pressable>
          <Text style={styles.hint}>
            Tap to copy & open mail{'\n'}or tap outside to dismiss
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
    color: 'rgba(224, 85, 85, 0.7)',
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
