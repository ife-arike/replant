// KAN-36 — Deactivated screen (Option B per design v3, locked SM 2026-05-24).
//
// Reached via AuthProvider's `branch === "deactivated"` flip, which fires
// in three cases (all served by `auth-status-check` v3):
//   1. users.verification_status === 'deactivated' (cron-set or login-check
//      auto-set per KAN-44).
//   2. pending user past their church deadline — the function atomically
//      flips to deactivated + writes audit row (KAN-44 SEC 10920).
//   3. pending user with NULL church.verification_deadline (skip-flow with
//      no church_id, or church row missing deadline) — KAN-36 fail-closed
//      per SEC c.14194 + Founder Option Y, no DB write.
//
// Design v3 — docs/replant-login-flow-v3.html, Screen 06 deactivation:
//   "Option B (no button) — the email IS the action. Tap copies it, opens
//   default mail composer with the address pre-filled, and closes the
//   modal. Tap outside the contact line dismisses → calls signOut() →
//   returns to Screen 06 default. Tone: solemn, not alarmed. No red
//   banner, no destructive button. The eyebrow is the only red note."
//
// "Closes the modal" = signs out → AuthProvider flips branch to
// "unauthenticated" → RootNavigator routes to Splash/Login. Both tap
// paths (contact line OR anywhere else) sign out; the contact path also
// copies the email + opens the mailer first.
//
// SM ruling (KAN-36 c.14199, 2026-05-24): honour design v3 in full. AC
// amendments to be applied by BA after this ships. The original
// "Close button" AC is superseded by the no-button pattern.

import React from 'react';
import {
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';

const CONTACT_EMAIL = 'connect@projectreplant.org';

export default function DeactivatedPlaceholderScreen() {
  const { signOut } = useAuth();

  // Anywhere-but-the-contact-line tap: solemn dismiss. signOut flips
  // AuthProvider branch → "unauthenticated"; RootNavigator routes back
  // to the Splash/Login tree. No confirm, no toast — the dismiss is
  // the leaving.
  const handleDismiss = () => {
    void signOut();
  };

  // Contact-line tap: the action of the screen per design v3 line 440.
  // Copy first (so the address is on the clipboard even if the mailer
  // fails to open on this device), then open the mailer, then sign out.
  // Mailer-open is fire-and-forget; on most devices it backgrounds the
  // app — the dismiss completes regardless of whether the leader sends
  // a message.
  const handleContact = async () => {
    try {
      await Clipboard.setStringAsync(CONTACT_EMAIL);
    } catch {
      // Clipboard unavailable (sandboxed test env, permission denied) —
      // fall through to mailer + signOut. The address is still on
      // screen and the mailer will pre-fill it; copying is a bonus.
    }
    try {
      await Linking.openURL(`mailto:${CONTACT_EMAIL}`);
    } catch {
      // Mailer unavailable (no mail client configured) — fall through
      // to signOut. The leader sees the address on the dismissed
      // Login surface only if they remembered it; the copy step above
      // means they can paste it elsewhere.
    }
    void signOut();
  };

  return (
    <Pressable style={styles.overlay} onPress={handleDismiss}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      {/* The card is rendered directly inside the Pressable. RN's
          gesture-responder system gives the inner contact Pressable
          priority — its onPress fires instead of the backdrop's when
          the contact line is tapped. All other taps inside the card
          (eyebrow, title, body, hint) bubble to the backdrop = dismiss.
          That matches the design v3 rule "Tap outside the contact line
          dismisses." */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>A NOTE ON YOUR ACCOUNT</Text>
        <Text style={styles.title}>Account deactivated</Text>
        <Text style={styles.body}>
          Your church verification window expired and your account has been
          deactivated. We're sorry for the difficulty this may cause.
          {'\n\n'}
          If you'd like to appeal or restore access, write to us.
        </Text>
        <Pressable onPress={handleContact} style={styles.contactPressable}>
          <Text style={styles.contactText}>{CONTACT_EMAIL}</Text>
        </Pressable>
        <Text style={styles.hint}>
          Tap to copy & open mail{'\n'}or tap outside to dismiss
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Overlay matches design v3 `.modal-overlay` (line 163): centered
  // card on rgba(8,8,8,0.88) backdrop with 24px frame padding. Renders
  // as a full-screen take-over because the deactivated branch in
  // RootNavigator is its own Stack.Screen (functionally equivalent to
  // the design's modal-on-Login surface).
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Card matches design v3 `.modal-card` (lines 164-171): surface fill,
  // hairline faint border, 6 radius, generous side padding so the
  // centered text breathes. Asymmetric vertical padding (28/24) keeps
  // the eyebrow + title further from the top edge than the hint sits
  // from the bottom — same vertical-rhythm shape as the design.
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  // Eyebrow — design v3 `.modal-eyebrow` (lines 172-179): DM Mono
  // uppercase letter-spaced red 0.65 alpha. The eyebrow is the only red
  // note on the screen (design intent: solemn, not alarmed).
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(224, 85, 85, 0.65)',
    textTransform: 'uppercase',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Title — design v3 `.modal-title` (lines 180-187): serif weight 300
  // with light letter-spacing. We use `displayRegular` (Cormorant 400)
  // because 300 Light is not in the loaded font bundle; this is the
  // lightest Cormorant variant available and preserves the serif tone.
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.6,
    marginBottom: 20,
    textAlign: 'center',
  },
  // Body — design v3 `.modal-body` (lines 188-193): muted DM Sans
  // with line-height 1.75. The double-line-break inside the Text
  // component reproduces the design's `<br><br>` between the two
  // sentences ("...difficulty this may cause." / "If you'd like to...").
  body: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 26,
    marginBottom: 24,
    textAlign: 'center',
  },
  // Contact line wrapper — design v3 `.modal-contact` (lines 194-205):
  // displayed as a block between hairline faint borders, generous
  // vertical padding so the touch target is comfortably above 44pt.
  // The italic Cormorant treatment makes the address read as "a letter
  // address" rather than a CTA, per the line-686 design commentary.
  contactPressable: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  contactText: {
    // displayMediumItalic (Cormorant 500 Italic) is the lightest italic
    // Cormorant variant in the font bundle (design specifies italic
    // weight 300, not loaded). Trade-off: a touch heavier visual register
    // but proper italic glyphs rather than synthesized italic.
    fontFamily: Typography.displayMediumItalic,
    fontSize: 20,
    color: Colors.accent,
    textAlign: 'center',
  },
  // Hint — design v3 `.modal-hint` (lines 206-213): mono uppercase
  // letter-spaced at the dimmest text color tier (rgba 0.30). The
  // single line-break inside the Text reproduces the design's `<br>`
  // between "open mail" and "or tap outside to dismiss".
  hint: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.0,
    color: 'rgba(240, 237, 230, 0.30)',
    textTransform: 'uppercase',
    lineHeight: 18,
    textAlign: 'center',
  },
});
