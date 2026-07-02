// ─────────────────────────────────────────────
// VerificationBanner.outcome — §19 (Ruling #17)  ·  EDIT
//
// Adds an `outcome` state to src/components/home/VerificationBanner.tsx,
// alongside the existing `pending` state. After the leader dismisses the
// VerificationOutcomeModal (§18), the Home tab keeps THIS persistent banner so
// the message isn't lost.
//
// SCOPE: all church types. Generic chrome — sits exactly where the
// verification-pending banner does. Neutral tint, NOT red (the modal already
// carried the weight; the banner is a calm reminder). A screenshot reveals
// nothing underground-specific.
//
// Behavior:
//   - Persists until the leader re-applies or the record is removed. NO auto-dismiss.
//   - "Read details →" re-opens VerificationOutcomeModal (§18). The leader is
//     NEVER logged out — this banner is the revisit path.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Radius } from '../../constants/theme';

interface OutcomeBannerProps {
  /** Re-opens the full VerificationOutcomeModal. */
  onReadDetails: () => void;
}

// Render this branch when VerificationBanner resolves state === 'outcome'.
// (Add 'outcome' to the banner's State union; keep pending/neutral as-is.)
export function VerificationOutcomeBanner({ onReadDetails }: OutcomeBannerProps) {
  return (
    <View style={styles.field}>
      <View style={styles.iconWell}>
        {/* Small Replant mark — neutral, never an error glyph */}
        <Svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke={Colors.textMuted} strokeWidth={1.3}>
          <Path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z" />
        </Svg>
      </View>
      <View style={styles.main}>
        <Text style={styles.head}>Registration update</Text>
        <Text style={styles.detail}>Your registration could not be verified at this time.</Text>
        <TouchableOpacity onPress={onReadDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.read}>
            Read details <Text style={styles.readArrow}>→</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors VerificationBanner.tsx field/iconWell/main/head/detail (neutral)
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: Radius.lg, paddingHorizontal: 15, paddingVertical: 14, backgroundColor: Colors.surfaceElevated },
  iconWell: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,237,230,0.05)', marginTop: 1 },
  main: { flex: 1, paddingRight: 4 },
  head: { fontFamily: Typography.bodyMedium, fontSize: 14, letterSpacing: 0.06, color: Colors.text },
  detail: { fontFamily: Typography.body, fontSize: 13.5, lineHeight: 19, color: Colors.textMuted, marginTop: 4, fontWeight: '300' },
  read: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.text, marginTop: 8 },
  readArrow: { color: Colors.accent },
});
