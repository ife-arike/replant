// VerificationBanner — KAN-35
//
// Shown on Home above the "TODAY" section label when branch === 'pending'.
// Three color states (neutral / amber / red) driven by days_remaining
// computed fresh on every render from `useAuth().verificationDeadline`
// using UTC math — no real-time tick, no caching.
//
// Dismiss semantics (resolves the open "define session" gap on KAN-35):
//   - In-memory `useState(false)` only — NO AsyncStorage, NO SecureStore.
//   - Persists while the component stays mounted (e.g., backgrounded app
//     keeps the dismissed state); resets on process kill / next launch.
//   - This matches the live AC: "Banner is dismissible per session —
//     close button hides it for current session only; reappears on
//     next app launch."
//
// Routing context — per Founder ruling 2026-05-22 (extends KAN-35),
// pending leaders now reach Home via the same RootNavigator branch as
// active leaders. This banner is the visible signal that they are
// awaiting verification while still using the app normally.

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';

const EMAIL = 'connect@projectreplant.org';

// Pure: days between `now` and the verificationDeadline ISO. UTC math
// per AC — no timezone conversion of the deadline itself. floor so the
// banner counts a partial day as "1 day remaining" rather than "0".
function computeDays(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.floor((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type BannerState = 'amber' | 'red';

// KAN-13 finalization 2026-05-22: the neutral state is gone. Pending
// verification IS a "needs attention" state regardless of days remaining,
// so the banner reads amber from day 1 of the window until the last
// inside-tomorrow stretch, which flips red. Thresholds:
//   days > 1            → amber
//   days <= 1 (incl. 0) → red
function getBannerState(days: number): BannerState {
  if (days > 1) return 'amber';
  return 'red';
}

export default function VerificationBanner() {
  const { verificationDeadline } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const days = computeDays(verificationDeadline);

  // Not rendered: no deadline known, deadline has already passed, or
  // dismissed this session. days < 0 hand-off: the Deactivation Popup
  // story owns the past-deadline UX; we silently disappear so a stale
  // red banner can't linger after the deactivation cron flips status.
  if (days === null || days < 0 || dismissed) return null;

  const state = getBannerState(days);
  const openMailto = () => {
    void Linking.openURL(`mailto:${EMAIL}`);
  };

  // Body composition. Amber state (days > 1) carries two copy variants
  // separated by the 7-day mark — the "many days remaining" version
  // reads informational; the "due soon" version names the urgency and
  // surfaces the tappable mailto. Red state (days <= 1) is always
  // urgent with the email link.
  const dayWord = days === 1 ? 'day' : 'days';

  return (
    <View style={[styles.banner, stateStyles[state].banner]}>
      <View style={styles.content}>
        <Text style={[styles.body, stateStyles[state].text]}>
          {state === 'amber' && days > 7 && (
            `Verification pending — ${days} ${dayWord} remaining. Your church is visible but limited until verified by Replant.`
          )}
          {state === 'amber' && days <= 7 && (
            <>
              {`Verification due soon — ${days} ${dayWord} remaining. Contact `}
              <Text style={[styles.emailLink, stateStyles[state].text]} onPress={openMailto}>
                {EMAIL}
              </Text>
              {" if you've submitted."}
            </>
          )}
          {state === 'red' && (
            <>
              {'Verification expires tomorrow. Contact '}
              <Text style={[styles.emailLink, stateStyles[state].text]} onPress={openMailto}>
                {EMAIL}
              </Text>
              {' immediately.'}
            </>
          )}
        </Text>
      </View>

      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss verification banner"
        style={styles.dismiss}
      >
        <Text style={[styles.dismissText, stateStyles[state].text]}>×</Text>
      </Pressable>
    </View>
  );
}

// State-tinted backgrounds + borders + text colors. The amber/red
// 8% fills + 25% borders match the project's tag-chip family (see
// AnnouncementTagChip palette) so the banner reads as part of the
// same visual vocabulary. Neutral state dropped per finalization
// 2026-05-22 — pending verification IS an attention state.
const AMBER_BG = 'rgba(212, 168, 85, 0.08)';
const AMBER_BORDER = 'rgba(212, 168, 85, 0.25)';
const RED_BG = 'rgba(224, 85, 85, 0.08)';
const RED_BORDER = 'rgba(224, 85, 85, 0.25)';

const stateStyles = {
  amber: StyleSheet.create({
    banner: { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER },
    text: { color: Colors.amber },
  }),
  red: StyleSheet.create({
    banner: { backgroundColor: RED_BG, borderColor: RED_BORDER },
    text: { color: Colors.red },
  }),
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  content: {
    flex: 1,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
  },
  emailLink: {
    fontFamily: Typography.bodyMedium,
    textDecorationLine: 'underline',
  },
  dismiss: {
    paddingTop: 1,
  },
  dismissText: {
    fontFamily: Typography.body,
    fontSize: 16,
    lineHeight: 18,
  },
});
