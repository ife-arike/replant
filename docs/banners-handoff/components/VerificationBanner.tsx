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

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Radius } from '../theme';
import { useAuth } from '../contexts/AuthProvider';
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

function head(state: State): string {
  switch (state) {
    case 'neutral': return 'Verification pending';
    case 'amber': return 'Your church will be deactivated soon';
    case 'urgent': return 'Verification expires today';
    case 'register': return 'No church linked';
    case 'leader': return 'Leader verification pending';
  }
}
function Detail({ state, days }: { state: State; days: number | null }) {
  const word = days === 1 ? 'day' : 'days';
  switch (state) {
    case 'neutral':
      return <Text style={styles.detail}>Your church is visible to the network but limited until verified. {days} {word} remaining. Questions? <Mail />.</Text>;
    case 'amber':
      return <Text style={styles.detail}>Verify within {days} {word} to stay active. If you've already submitted, email <Mail />.</Text>;
    case 'urgent':
      return <Text style={styles.detail}>Your church will be deactivated today unless verified. Email <Mail />.</Text>;
    case 'register':
      return <Text style={styles.detail}>You have 7 days from account creation to register or join a church. Questions? <Mail />.</Text>;
    case 'leader':
      return <Text style={styles.detail}>Your church is verified. Your leader access opens once the Replant team confirms your account. <Mail />.</Text>;
  }
}

export default function VerificationBanner({ variant = 'church' }: { variant?: 'church' | 'leader' }) {
  const { verificationDeadline } = useAuth();
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
        <Text style={[styles.head, { color: HEAD_COLOR[state] }]}>{head(state)}</Text>
        <Detail state={state} days={days} />
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
