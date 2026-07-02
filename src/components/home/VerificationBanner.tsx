// VerificationBanner.tsx — KAN-35 redesign (Direction 1 · Held field).
//
// Sits in HomeScreen body (paddingHorizontal 20) above the "TODAY" label,
// rendered when branch === 'pending'. Open/unboxed language: a soft tinted
// field with a leading icon — no hard border box.
//
// States (restores the 3-state model; live code collapsed neutral→amber —
// confirm threshold with eng):
//   days > 7            → neutral  (informational, sky)
//   1 < days <= 7       → amber    ("will be deactivated soon")
//   days <= 1 (incl 0)  → urgent   ("expires today")
//   days === null       → register (no church linked, 7-day window)
//   variant="leader"    → leader   (church verified, sky, no countdown)
//
// Contact is ALWAYS accounts@projectreplant.org, rendered in plain off-white
// (Colors.text) — never colour-coded. Dismiss is in-memory per session only.
//
// Underground variant (Ask 6 · Ruling #5, 2026-06-19):
//   - For underground viewers, the pending copy collapses to a single
//     pastoral line: "Your church is being verified. We are praying with
//     you." — no countdown, no type/region reference, no admin email
//     (admin contact is in-app, not via email).
//   - Generic chrome on all underground states — byte-identical to a
//     standalone leader's banner. The device could be seen by anyone.

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import { useViewerChurch } from '../../hooks/useViewerChurch';
import { viewerOrgCopy } from '../../utils/displayHelpers';
import { InfoIcon, ClockIcon, AlertIcon, LeaderIcon } from './banner-icons';

const EMAIL = 'accounts@projectreplant.org';

function computeDays(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.floor((new Date(deadline).getTime() - Date.now()) / 86_400_000);
}

type State = 'neutral' | 'amber' | 'urgent' | 'register' | 'leader';

const TINT: Record<State, string> = {
  neutral: Colors.surfaceElevated,
  amber: 'rgba(212,168,85,0.08)',
  urgent: 'rgba(224,85,85,0.08)',
  register: 'rgba(224,85,85,0.08)',
  leader: 'rgba(107,181,232,0.06)',
};
const ACCENT: Record<State, string> = {
  neutral: Colors.accent, amber: Colors.amber, urgent: Colors.red, register: Colors.red, leader: Colors.accent,
};
const HEAD_COLOR: Record<State, string> = {
  neutral: Colors.text, amber: Colors.amber, urgent: Colors.red, register: Colors.red, leader: Colors.text,
};

function Icon({ state }: { state: State }) {
  const c = ACCENT[state];
  if (state === 'amber') return <ClockIcon color={c} />;
  if (state === 'urgent' || state === 'register') return <AlertIcon color={c} />;
  if (state === 'leader') return <LeaderIcon color={c} />;
  return <InfoIcon color={c} />;
}

const Mail = () => (
  <Text style={styles.email} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>{EMAIL}</Text>
);

function head(
  state: State,
  viewer: ReturnType<typeof viewerOrgCopy>,
  isUnderground: boolean,
): string {
  // Underground generic-chrome override (Ask 6 · Ruling #5). Single
  // pastoral copy across every pending state — no countdown reference,
  // no expiry threat, no admin-email surfacing.
  if (isUnderground && state !== 'leader') {
    return 'Verification in progress';
  }
  switch (state) {
    case 'neutral': return 'Verification pending';
    case 'amber': return `${viewer.yourChurchOrOrgCap} will be deactivated soon`;
    case 'urgent': return 'Verification expires today';
    case 'register': return `No ${viewer.churchOrOrgNoun} linked`;
    case 'leader': return 'Leader verification pending';
  }
}
function Detail({
  state,
  days,
  viewer,
  isUnderground,
}: {
  state: State;
  days: number | null;
  viewer: ReturnType<typeof viewerOrgCopy>;
  isUnderground: boolean;
}) {
  // Underground generic-chrome override — single pastoral line; in-app
  // admin contact only (no Mail link surfaced on the pending state).
  if (isUnderground && state !== 'leader') {
    return (
      <Text style={styles.detail}>
        Your church is being verified. The Replant team is praying with you and reviewing carefully.
      </Text>
    );
  }
  const word = days === 1 ? 'day' : 'days';
  switch (state) {
    case 'neutral':
      return <Text style={styles.detail}>{viewer.yourChurchOrOrgCap} is visible to the network but limited until verified. {days} {word} remaining. Questions? <Mail />.</Text>;
    case 'amber':
      return <Text style={styles.detail}>Verify within {days} {word} to stay active. If you've already submitted, email <Mail />.</Text>;
    case 'urgent':
      return <Text style={styles.detail}>{viewer.yourChurchOrOrgCap} will be deactivated today unless verified. Email <Mail />.</Text>;
    case 'register':
      return <Text style={styles.detail}>You have 7 days from account creation to register or join a {viewer.churchOrOrgNoun}. Questions? <Mail />.</Text>;
    case 'leader':
      return <Text style={styles.detail}>{viewer.yourChurchOrOrgCap} is verified. Your leader access opens once the Replant team confirms your account. <Mail />.</Text>;
  }
}

export default function VerificationBanner({ variant = 'church' }: { variant?: 'church' | 'leader' }) {
  const { verificationDeadline } = useAuth();
  const { church } = useViewerChurch();
  const viewer = viewerOrgCopy(church?.type);
  const isUnderground = church?.isUnderground === true;
  const [dismissed, setDismissed] = useState(false);

  const days = variant === 'leader' ? null : computeDays(verificationDeadline);

  // past deadline is owned by the Deactivation flow — don't linger
  if (dismissed) return null;
  if (variant === 'church' && days !== null && days < 0) return null;

  const state: State =
    variant === 'leader' ? 'leader'
    : days === null ? 'register'
    : days > 7 ? 'neutral'
    : days > 1 ? 'amber'
    : 'urgent';

  return (
    <View style={[styles.field, { backgroundColor: TINT[state] }]}>
      <View style={styles.iconWell}><Icon state={state} /></View>
      <View style={styles.main}>
        <Text style={[styles.head, { color: HEAD_COLOR[state] }]}>{head(state, viewer, isUnderground)}</Text>
        <Detail state={state} days={days} viewer={viewer} isUnderground={isUnderground} />
      </View>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss banner">
        <Text style={styles.x}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: Radius.lg, paddingHorizontal: 15, paddingVertical: 14 },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,237,230,0.05)', marginTop: 1 },
  main: { flex: 1, paddingRight: 4 },
  head: { fontFamily: Typography.bodyMedium, fontSize: 14, letterSpacing: 0.06 },
  detail: { fontFamily: Typography.body, fontSize: 13.5, lineHeight: 19, color: Colors.textMuted, marginTop: 4 },
  email: { fontFamily: Typography.body, color: Colors.text }, // plain — NEVER colour-coded
  x: { fontFamily: Typography.body, fontSize: 16, lineHeight: 18, color: Colors.textSubtle },
});

// ── §19: VerificationOutcomeBanner ─────────────────────────────────────
// Persistent banner shown on Home after the leader dismisses the
// VerificationOutcomeModal (§18). SCOPE: all church types — generic
// chrome, byte-identical to what a standalone leader sees. Sits where
// the verification-pending banner does; neutral tint (the modal already
// carried the weight). A screenshot reveals nothing underground-specific.
//
// Behavior:
//   - Persists until the leader re-applies or the record is removed.
//     NO auto-dismiss.
//   - "Read details →" re-opens VerificationOutcomeModal (§18). The
//     leader is NEVER logged out — this banner is the revisit path.
//   - safety_concern variant: collapses detail to the on-hold copy and
//     points to the appeal email instead of "Read details →".

interface OutcomeBannerProps {
  /** Re-opens the full VerificationOutcomeModal. */
  onReadDetails: () => void;
  /** True iff the rejection reason is safety_concern — banner copy shifts
   *  to "on hold" + email instead of "Read details →". */
  safetyConcern?: boolean;
}

export function VerificationOutcomeBanner({ onReadDetails, safetyConcern = false }: OutcomeBannerProps) {
  return (
    <View style={outcomeStyles.field}>
      <View style={outcomeStyles.iconWell}>
        {/* Small Replant mark — neutral, never an error glyph */}
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke={Colors.textMuted} strokeWidth={1.3}>
          <Path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z" />
        </Svg>
      </View>
      <View style={outcomeStyles.main}>
        <Text style={outcomeStyles.head}>Registration update</Text>
        <Text style={outcomeStyles.detail}>
          {safetyConcern
            ? 'Your registration is on hold.'
            : 'Your registration could not be verified at this time.'}
        </Text>
        <Pressable
          onPress={onReadDetails}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            safetyConcern ? 'Contact the Replant team' : 'Read details'
          }
        >
          <Text style={outcomeStyles.read}>
            {safetyConcern ? 'Contact the Replant team' : 'Read details'}{' '}
            <Text style={outcomeStyles.readArrow}>→</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const outcomeStyles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: Radius.lg, paddingHorizontal: 15, paddingVertical: 14, backgroundColor: Colors.surfaceElevated },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,237,230,0.05)', marginTop: 1 },
  main: { flex: 1, paddingRight: 4 },
  head: { fontFamily: Typography.bodyMedium, fontSize: 14, letterSpacing: 0.06, color: Colors.text },
  detail: { fontFamily: Typography.body, fontSize: 13.5, lineHeight: 19, color: Colors.textMuted, marginTop: 4 },
  read: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.text, marginTop: 8 },
  readArrow: { color: Colors.accent },
});

// ── Queue §16: RequestInfoBanner ──────────────────────────────────────
// Persistent banner shown on Home when branch_substate === 'request_info'
// (Founder ruling 2026-06-22 option #1). Sits where VerificationBanner /
// VerificationOutcomeBanner sit — same chrome family, sky-tinted to
// signal "team is waiting on you" rather than "team is reviewing you".
//
// Behavior:
//   - Persists while there's an open admin question (kind='request_info').
//   - Tapping "Open →" re-opens RequestInfoModal with the cached question.
//   - Falls away the moment the leader replies (fn_send_reply_to_team
//     clears churches.last_outcome_modal_kind → branch_substate reverts
//     to plain 'pending' → VerificationBanner re-mounts).

interface RequestInfoBannerProps {
  /** Re-opens RequestInfoModal with the cached question. */
  onOpen: () => void;
}

export function RequestInfoBanner({ onOpen }: RequestInfoBannerProps) {
  return (
    <View style={requestInfoStyles.field}>
      <View style={requestInfoStyles.iconWell}>
        {/* Sky envelope glyph — neutral, conversational, never urgent */}
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke={Colors.accent} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M2.5 4.5h11v7h-11z" />
          <Path d="M2.5 4.5l5.5 4 5.5-4" />
        </Svg>
      </View>
      <View style={requestInfoStyles.main}>
        <Text style={requestInfoStyles.head}>A question from the Replant team</Text>
        <Text style={requestInfoStyles.detail}>
          We have a question to help complete your verification. Reply when you’re ready.
        </Text>
        <Pressable
          onPress={onOpen}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open the question"
        >
          <Text style={requestInfoStyles.read}>
            Open <Text style={requestInfoStyles.readArrow}>→</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const requestInfoStyles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: Radius.lg, paddingHorizontal: 15, paddingVertical: 14, backgroundColor: 'rgba(107,181,232,0.08)', borderWidth: 0.5, borderColor: 'rgba(107,181,232,0.22)' },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,181,232,0.10)', marginTop: 1 },
  main: { flex: 1, paddingRight: 4 },
  head: { fontFamily: Typography.bodyMedium, fontSize: 14, letterSpacing: 0.06, color: Colors.text },
  detail: { fontFamily: Typography.body, fontSize: 13.5, lineHeight: 19, color: Colors.textMuted, marginTop: 4 },
  read: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.text, marginTop: 8 },
  readArrow: { color: Colors.accent },
});
