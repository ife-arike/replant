// ─────────────────────────────────────────────
// JoinCodeReveal — NEW (Ask 3 · Rulings #2 + #3 + #6)
// One-shot reveal of the founding leader's invite code. Shown EXACTLY ONCE,
// triggered by auth-status-check returning `underground_join_code` on the first
// sign-in after admin verification.
//
// Code format LOCKED: RPL-XXXX-NNNNN (4 A–Z + 5 digits), monospaced, large.
// Founder-final treatment: QUIET (underlined, no box). CD-ALT: boxed / cells.
// Founder-final weight: FULL-SCREEN takeover. CD-ALT: bottom sheet.
//
// NON-DISMISSIBLE: no swipe, no hardware back. Only "I have saved this —
// continue" → second confirm modal. Mount this route with
// gestureEnabled:false + a hardware-back interceptor (Android).
//
// Screenshot defense:
//   Android — FLAG_SECURE on this screen blocks capture outright.
//   iOS     — cannot block; detect via userDidTakeScreenshotNotification and
//             surface the red warning (delete the image, share only by hand).
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform, BackHandler, ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

type Props = {
  code: string;              // plaintext, from consume_underground_join_code_reveal — held in memory only
  onContinue: () => void;    // after second-modal confirm; navigate away, never back here
};

export default function JoinCodeReveal({ code, onContinue }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [shotWarn, setShotWarn] = useState(false);

  // NON-DISMISSIBLE — swallow hardware back on Android.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // iOS screenshot DETECTION (cannot block). Wire the native notification
  // (userDidTakeScreenshotNotification) to setShotWarn(true). Android relies on
  // FLAG_SECURE set on this Activity (see notes) and never reaches this state.
  // useEffect(() => subscribeScreenshot(() => setShotWarn(true)), []);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1900);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TRUSTED INVITE</Text>
        <Text style={styles.title}>One trusted leader at a time</Text>

        {shotWarn && (
          <View style={styles.shotWarn}>
            <View style={styles.shotIco}><Text style={styles.shotIcoText}>!</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shotTitle}>Screenshot detected</Text>
              <Text style={styles.shotText}>
                A screen capture was taken. This code is a key to your fellowship —
                delete the image, and never store or send it. Share it only face-to-face.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.body}>
          If God brings another leader into your fellowship who needs to be on Replant
          with you, give them this code <Text style={styles.b}>in person, by hand</Text>.
          Anyone you give it to will be able to join your church on Replant. No one without it can.
        </Text>

        <Text style={styles.once}>We will show this to you once. We cannot show it to you again.</Text>

        {/* Founder-final: QUIET code block (underlined, no box). */}
        <TouchableOpacity style={styles.codeQuiet} onPress={copy} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={`Copy invite code ${code}`}>
          <Text style={styles.codeText}>{code}</Text>
        </TouchableOpacity>
        <View style={styles.tapHint}>
          <Text style={[styles.tapHintText, copied && styles.tapHintCopied]}>
            {copied ? '✓  Copied' : '⧉  Tap to copy'}
          </Text>
        </View>

        <Text style={styles.body}>
          Write it down somewhere only you can reach. Do not save it to this phone,
          do not send it in a message, do not put it in email. Share it only
          face-to-face with someone you would trust with your life.
        </Text>
      </ScrollView>

      <View style={styles.foot}>
        <TouchableOpacity style={styles.cta} onPress={() => setConfirm(true)} activeOpacity={0.85}>
          <Text style={styles.ctaText}>I have saved this — continue</Text>
        </TouchableOpacity>
      </View>

      {/* Pre-dismiss confirm — the only way off this screen. */}
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalScrim}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              We will not show this code again. If you lose it, you’ll need to contact
              the Replant team directly to issue a new one.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.ghost]} onPress={() => setConfirm(false)}>
                <Text style={styles.ghostText}>Show me again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.danger]} onPress={() => { setConfirm(false); onContinue(); }}>
                <Text style={styles.dangerText}>Yes, I have it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy toast */}
      {copied && (
        <View style={styles.toast}>
          <View style={styles.toastCheck}><Text style={styles.toastCheckText}>✓</Text></View>
          <Text style={styles.toastText}>Code copied</Text>
        </View>
      )}
    </View>
  );
}

// ── CD-ALT (not selected) ────────────────────────────────────────────────────
// codeBlock 'boxed'  — gradient card, borderColor accent@25, Radius.xl, 26px pad.
// codeBlock 'cells'  — one mono cell per char (4 letters + 5 digits) with an
//                      "RPL" prefix cell; group gap between letters and digits.
// revealWeight 'sheet' — render inside a bottom sheet at ~88% height over a
//                      scrim instead of a full-screen View. Non-dismiss still
//                      applies (no swipe-down-to-close).

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  eyebrow: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 2.2, color: Colors.accent, textTransform: 'uppercase', marginBottom: Spacing.lg },
  title: { fontFamily: Typography.display, fontSize: 30, color: Colors.text, lineHeight: 35, marginBottom: 18 },
  body: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 23, marginBottom: 12 },
  b: { fontFamily: Typography.bodyMedium, color: Colors.text },
  once: { fontFamily: Typography.scriptureItalic, fontSize: 17, color: Colors.text, lineHeight: 25, marginVertical: 6, marginBottom: 24, paddingLeft: 16, borderLeftWidth: 1.5, borderLeftColor: Colors.borderAccent },

  codeQuiet: { alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  codeText: { fontFamily: Typography.mono, fontSize: 30, letterSpacing: 4, color: Colors.text },
  tapHint: { alignItems: 'center', marginTop: 12, marginBottom: 22 },
  tapHintText: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.4, color: Colors.textSubtle, textTransform: 'uppercase' },
  tapHintCopied: { color: Colors.green },

  foot: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 30, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.accent, borderRadius: Radius.lg, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.background },

  modalScrim: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 26 },
  modal: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(240,237,230,0.14)', padding: 24, width: '100%' },
  modalTitle: { fontFamily: Typography.display, fontSize: 23, color: Colors.text, marginBottom: 12 },
  modalBody: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 21, marginBottom: 22 },
  modalActions: { gap: 10 },
  modalBtn: { minHeight: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  ghostText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.textMuted },
  danger: { backgroundColor: 'rgba(224,85,85,0.12)' },
  dangerText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.red },

  toast: { position: 'absolute', alignSelf: 'center', bottom: 116, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(20,22,20,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(91,173,122,0.4)', borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 10 },
  toastCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  toastCheckText: { fontFamily: Typography.bodyMedium, fontSize: 10, color: Colors.background },
  toastText: { fontFamily: Typography.body, fontSize: 13, color: Colors.text },

  shotWarn: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(224,85,85,0.07)', borderWidth: 1, borderColor: 'rgba(224,85,85,0.28)', borderRadius: Radius.lg, padding: 14, marginBottom: 22 },
  shotIco: { width: 24, height: 24, borderRadius: Radius.md, backgroundColor: 'rgba(224,85,85,0.14)', alignItems: 'center', justifyContent: 'center' },
  shotIcoText: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.red },
  shotTitle: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.red, marginBottom: 4 },
  shotText: { fontFamily: Typography.body, fontSize: 12, color: Colors.textMuted, fontWeight: '300', lineHeight: 17 },
});
