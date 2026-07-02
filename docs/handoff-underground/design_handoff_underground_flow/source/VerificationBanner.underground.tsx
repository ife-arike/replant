// ─────────────────────────────────────────────
// VerificationBanner / status surfaces — underground (Ask 6 · Ruling #5)
// EDIT spec for src/components/home/VerificationBanner.tsx + a NEW one-shot
// VerifiedTakeover. All status comms in-app; NO email reveals underground status.
//
// CRITICAL: generic chrome is the safety mechanism. An underground leader's
// pending/rejected banners are byte-identical to a standalone leader's — the
// device could be seen by anyone. Add NO underground-specific copy, icon, or
// color anywhere a screenshot could capture it.
//
// Three states:
//   pending  — reuses the existing neutral VerificationBanner. Generic copy.
//   verified — NEW one-shot pastoral takeover on first post-approval sign-in,
//              then auto-routes to JoinCodeReveal (Ask 3).
//   rejected — single string for all reasons; specifics via secure thread.
// ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

/* ════════════════════════════════════════════════════════════════════════════
   1 · PENDING — existing VerificationBanner, neutral state. Copy override only.
   In VerificationBanner.tsx `Detail()`, the underground viewer falls through to
   the same 'neutral' state every church sees. Confirm the neutral detail line
   reads (or override to) the locked pastoral copy:
      "Your church is being verified. We are praying with you."
   NO countdown text, NO type/region reference for underground.
═══════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
   2 · REJECTED — single string, all reasons. Add to the banner's State union as
   a discrete 'rejected' variant (red tint), OR render this standalone block.
═══════════════════════════════════════════════════════════════════════════════ */
export function RejectedBanner({ onContact }: { onContact: () => void }) {
  return (
    <View style={[styles.field, styles.fieldRejected]}>
      <View style={styles.iconWell}>
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke={Colors.red} strokeWidth={1.4}>
          <Path d="M8 1.4a6.6 6.6 0 1 0 0 13.2A6.6 6.6 0 0 0 8 1.4ZM8 5v3.5M8 11h.01" strokeLinecap="round" />
        </Svg>
      </View>
      <View style={styles.main}>
        <Text style={[styles.head, { color: Colors.red }]}>Verification unsuccessful</Text>
        <Text style={styles.detail}>
          We weren’t able to verify your registration. Please{' '}
          <Text style={styles.link} onPress={onContact}>contact the Replant team</Text>.
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   3 · VERIFIED — one-shot pastoral takeover. Triggered on the first sign-in
   after admin approval (same session that auth-status-check returns the join
   code). Tapping continue auto-routes to JoinCodeReveal.
   Founder-final copy: "You're verified. You are not standing alone."
   (Original "Welcome. You are with us now." was cut — in-group/cultish.)
═══════════════════════════════════════════════════════════════════════════════ */
const VERIFIED_HEAD = 'You’re verified. You are not standing alone.';
// CD-ALT copy: 'Your church is verified. We’re walking with you.' /
//             'You’re verified. We’re glad you’re here.'

export function VerifiedTakeover({ onContinue }: { onContinue: () => void }) {
  // Pastoral, not transactional. Routes onward to the join-code reveal.
  return (
    <View style={styles.takeover}>
      <View style={styles.mark}>
        <Svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke={Colors.accent} strokeWidth={1.5}>
          <Path d="M7 14.5 12 19.5 21.5 9" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Text style={styles.vtHead}>{VERIFIED_HEAD}</Text>
      <Text style={styles.vtSub}>
        Your registration is confirmed. A code to invite one trusted leader is ready
        on the next screen.
      </Text>
      {/* Quiet, ATTRIBUTED scripture — consistent with the home-screen verse voice.
          Never the app speaking AS God. Uses the native scriptureItalic asset. */}
      <Text style={styles.vtVerse}>
        “When thou passest through the waters, I will be with thee.”{'\n'}Isaiah 43:2
      </Text>
      <TouchableOpacity style={styles.vtRoute} onPress={onContinue} activeOpacity={0.8}>
        <Text style={styles.vtRouteText}>Continue ▸ One trusted leader</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // matches VerificationBanner.tsx field/iconWell/main/head/detail
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: Radius.lg, paddingHorizontal: 15, paddingVertical: 14 },
  fieldRejected: { backgroundColor: 'rgba(224,85,85,0.08)' },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,237,230,0.05)', marginTop: 1 },
  main: { flex: 1, paddingRight: 4 },
  head: { fontFamily: Typography.bodyMedium, fontSize: 14, letterSpacing: 0.06 },
  detail: { fontFamily: Typography.body, fontSize: 13.5, lineHeight: 19, color: Colors.textMuted, marginTop: 4, fontWeight: '300' },
  link: { fontFamily: Typography.body, color: Colors.text },  // plain — never colour-coded

  takeover: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, backgroundColor: Colors.background },
  mark: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  vtHead: { fontFamily: Typography.display, fontSize: 32, color: Colors.text, lineHeight: 38, textAlign: 'center', marginBottom: 16 },
  vtSub: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, fontWeight: '300', lineHeight: 24, textAlign: 'center', maxWidth: 280 },
  vtVerse: { fontFamily: Typography.scriptureItalic, fontSize: 16, color: Colors.accent, lineHeight: 24, textAlign: 'center', maxWidth: 290, marginTop: 22 },
  vtRoute: { position: 'absolute', bottom: 38 },
  vtRouteText: { fontFamily: Typography.mono, fontSize: 11, letterSpacing: 1.2, color: Colors.textSubtle, textTransform: 'uppercase' },
});
