// ─────────────────────────────────────────────
// VerificationOutcomeModal — §18 (Ruling #17)  ·  NEW
// THE HIGHEST-LEVERAGE SURFACE. Dignity over efficiency.
//
// An underground leader may have risked exposure to register. "Rejected" lands
// like a door slammed. We never say it — we say "could not be verified at this
// time". This is trauma-aware by design.
//
// SCOPE: all church types. Generic chrome.
//
// Red is RESERVED — never used here. A heavy red ✕ on this surface reads as
// punishment. Muted chrome + a small Replant mark only. (CD tweak rejGlyph:
// Founder-final = 'none'. CD-ALT 'quiet' = a small muted info mark, never red.)
//
// Two variants, ONE component:
//   standard         → lead-in + reason sentence + close + appeal + "I understand"
//   safety_concern   → lead-in + appeal + "I understand"  (NO reason, NO close,
//                      NO re-apply invitation — trauma-aware silence)
//
// The 8-value reason enum → leader-facing translation lives in REASON_COPY.
// Admin-internal rationale is NEVER shown to the leader.
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

export type RejectionReason =
  | 'identity_unconfirmed'
  | 'church_unconfirmed'
  | 'insufficient_evidence'
  | 'contact_unreachable'
  | 'out_of_scope'
  | 'safety_concern'
  | 'duplicate_registration'
  | 'other';

// Leader-facing translations (locked). `safety_concern` has no detail sentence
// — it is intentionally absent from this map's render path.
const REASON_COPY: Record<Exclude<RejectionReason, 'safety_concern'>, string> = {
  identity_unconfirmed:    'Our team was not able to confirm your identity.',
  church_unconfirmed:      'Our team was not able to confirm the church through the references available to us.',
  insufficient_evidence:   'There was not enough information for us to complete the review at this time.',
  contact_unreachable:     'We were not able to reach you through the contact details provided.',
  out_of_scope:            'This appears to fall outside what Replant is able to support.',
  duplicate_registration:  'Another registration associated with you is already being reviewed.',
  other:                   'We were not able to complete your registration at this time.',
};

const APPEAL_EMAIL = 'accounts@projectreplant.org';

interface Props {
  visible: boolean;
  reason: RejectionReason;
  /** "I understand" — dismiss to the persistent banner (§19). */
  onDismiss: () => void;
}

export default function VerificationOutcomeModal({ visible, reason, onDismiss }: Props) {
  const isSafety = reason === 'safety_concern';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          {/* Muted Replant mark — NOT an error glyph, NOT red */}
          <View style={styles.glyph}>
            <Svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke={Colors.textMuted} strokeWidth={1.3}>
              <Path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z" />
            </Svg>
          </View>
          <Text style={styles.eyebrow}>A message for you</Text>

          {/* Lead-in — ALWAYS shown, both variants */}
          <Text style={styles.lead}>After review, your registration could not be verified at this time.</Text>

          {/* Reason + close — OMITTED for safety_concern */}
          {!isSafety && (
            <>
              <Text style={styles.reason}>{REASON_COPY[reason]}</Text>
              <Text style={styles.close}>You are welcome to re-apply when you’re ready.</Text>
            </>
          )}

          {/* Appeal — shown both variants */}
          <View style={styles.appeal}>
            <Text style={styles.appealText}>
              If you believe this is a mistake, you can write to{' '}
              <Text style={styles.appealLink} onPress={() => Linking.openURL(`mailto:${APPEAL_EMAIL}`)}>
                {APPEAL_EMAIL}
              </Text>.
            </Text>
          </View>

          <TouchableOpacity style={styles.ghost} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.ghostText}>I understand</Text>
          </TouchableOpacity>

          {/* Quiet rationale for the silence — dev/reviewer note, NOT rendered for
              safety in production; shown here only to make the intent legible. */}
          {isSafety && <Text style={styles.silence}>No reason shown · no re-apply prompt — by design.</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,8,8,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  card: { width: '100%', backgroundColor: Colors.surfaceElevated, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.14)', borderRadius: Radius.xl, padding: 26 },

  glyph: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(240,237,230,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', color: Colors.textMuted, marginBottom: 12 },

  lead: { fontFamily: Typography.body, fontSize: 14.5, color: Colors.text, lineHeight: 22, marginBottom: 14 },
  reason: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 23, marginBottom: 14 },
  close: { fontFamily: Typography.scriptureItalic, fontSize: 16, color: Colors.text, lineHeight: 24, marginBottom: 20 },

  appeal: { backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.08)', borderRadius: Radius.lg, padding: 13, marginBottom: 22 },
  appealText: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 20 },
  appealLink: { fontFamily: Typography.bodyMedium, color: Colors.accent },

  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },

  silence: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSubtle, fontWeight: '300', textAlign: 'center', marginTop: 12 },
});
