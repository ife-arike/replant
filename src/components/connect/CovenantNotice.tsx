// CovenantNotice — KAN-70 / HANDOFF §6.4.
//
// Fires on the leader's FIRST send attempt EVER (per-account flag, not
// per-conversation). Dim-only overlay (no expo-blur per HANDOFF §13.2).
// Requires explicit acknowledgement — cannot be dismissed without
// tapping "I understand". Once acknowledged the flag is written to
// SecureStore under key 'covenant_ack' and the notice is never shown
// again on this account.
//
// COPY STATUS: prototype copy per HANDOFF §6.4 — final wording is owned
// by Content + Founder. Container shape (sky shield + serif heading +
// body + pull-quote + primary CTA) is the CD deliverable here.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  onAccept: () => void;
}

function ShieldGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"
        stroke={Colors.accent} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4.2"
        stroke={Colors.accent} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function CovenantNotice({ visible, onAccept }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Hardware back on Android is a no-op — acknowledgement is required.
      }}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <View style={styles.sealRow}>
            <View style={styles.seal}><ShieldGlyph /></View>
          </View>
          <Text style={styles.eyebrow}>A WORD BEFORE YOU WRITE</Text>
          <Text style={styles.heading}>Connect is a room of trust.</Text>
          <Text style={styles.body}>
            These letters travel between verified leaders for the work of
            the kingdom. Replant reviews messages that are flagged —
            nothing here is hidden from God, and little is hidden from
            us.{'\n\n'}
            <Text style={styles.bodyItalic}>
              "Behave as you would before your King."
            </Text>
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="I understand"
          >
            <Text style={styles.btnText}>I understand</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,4,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 18,
    paddingVertical: 30,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  sealRow: { marginBottom: 14 },
  seal: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.34, // 0.26em × 9pt
    color: Colors.accent,
    marginBottom: 14,
  },
  heading: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  bodyItalic: {
    fontFamily: Typography.scriptureItalic,
    color: Colors.text,
  },
  btn: {
    minWidth: 200,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.85 },
  btnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: '#07232f',
    letterSpacing: 0.2,
  },
});
