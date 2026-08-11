// ─────────────────────────────────────────────
// PreRemovalModal — §20 (Ruling #18)  ·  NEW
//
// Modal-on-launch at day 23 — 3 days before the day-30 auto-delete window for an
// unresponsive pending registration. Shows ONCE (launch-gate flag).
//
// SCOPE: all church types. Generic chrome.
//
// COPY REVISED 2026-06-22 (Founder): the originally-locked "Your registration
// will be removed soon" implied the leader dropped the ball. The new copy is
// BLAMELESS — the headline centers our wish to keep them, and the body OWNS that
// the delay may be on Replant's side. Never implies the leader failed.
//
// Amber glyph well — a heads-up, NOT a verdict (red is reserved). Single
// "I understand" CTA — no dismiss-X that feels like a trap.
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

const APPEAL_EMAIL = 'accounts@projectreplant.org';

interface Props {
  visible: boolean;
  /** "I understand" — dismiss. Once-only; the launch-gate flag clears. */
  onAcknowledge: () => void;
}

export default function PreRemovalModal({ visible, onAcknowledge }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAcknowledge}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          {/* Amber heads-up glyph — NOT red, NOT a verdict */}
          <View style={styles.glyph}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={Colors.amber} strokeWidth={1.4}>
              <Circle cx={10} cy={10} r={7.5} />
              <Path d="M10 5.5v5" strokeLinecap="round" />
              <Circle cx={10} cy={13.4} r={0.5} fill={Colors.amber} stroke="none" />
            </Svg>
          </View>
          <Text style={styles.eyebrow}>A note for you</Text>
          <Text style={styles.title} accessibilityRole="header">
            We don’t want to lose your registration
          </Text>

          {/* Blameless body — owns that the delay may be on our side */}
          <Text style={styles.body}>
            Your registration hasn’t been completed yet, and it’s set to be removed from our records in a
            few days. Sometimes that’s because we’re still reviewing on our end. If you’d still like to
            join, or if you’ve been waiting to hear from us, please reach out and we’ll pick it back up
            with you.
          </Text>

          <View style={styles.appeal}>
            <Text style={styles.appealText}>
              You can reach us any time at{' '}
              <Text
                style={styles.appealLink}
                onPress={() => Linking.openURL(`mailto:${APPEAL_EMAIL}`)}
                accessibilityRole="link"
                accessibilityLabel={`Email ${APPEAL_EMAIL}`}
              >
                {APPEAL_EMAIL}
              </Text>.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.ghost}
            onPress={onAcknowledge}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="I understand"
          >
            <Text style={styles.ghostText}>I understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,8,8,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  card: { width: '100%', backgroundColor: Colors.surfaceElevated, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.14)', borderRadius: Radius.xl, padding: 26 },

  glyph: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: Colors.amber, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', color: Colors.amber, marginBottom: 12 },
  title: { fontFamily: Typography.displayMedium, fontSize: 23, color: Colors.text, lineHeight: 28, marginBottom: Spacing.md },

  body: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, lineHeight: 23, marginBottom: Spacing.md },

  appeal: { backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.08)', borderRadius: Radius.lg, padding: 13, marginBottom: 22 },
  appealText: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 20 },
  appealLink: { fontFamily: Typography.bodyMedium, color: Colors.accent },

  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },
});
