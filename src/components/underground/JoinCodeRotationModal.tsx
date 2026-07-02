// ─────────────────────────────────────────────
// JoinCodeRotationModal — §21 (Ruling #20)  ·  NEW · UNDERGROUND-ONLY
//
// Modal-on-launch notice that the admin's rotate_join_code action produces.
// Mount only when viewerChurchType === 'underground'. Chrome stays identical
// to every other modal: nothing stands out in a captured screen.
//
// Join code: locked format RPL-XXXX-NNNNN, DM Mono, QUIET treatment (underlined,
// no box — CD tweak codeBlock Founder-final='quiet'). Copy-on-tap via
// Clipboard.setStringAsync + Haptics.notificationAsync(Success). Screenshot-
// illegible by design — the underlined block reads as ambient text, not a
// fingerprintable secret.
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

interface Props {
  visible: boolean;
  /** Plaintext refreshed code, RPL-XXXX-NNNNN. Shown once; never re-fetchable. */
  code: string;
  onDismiss: () => void;
}

export default function JoinCodeRotationModal({ visible, code, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1900);
  }, [code]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={[styles.glyph, { borderColor: Colors.accent }]}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={Colors.accent} strokeWidth={1.4}>
              <Circle cx={6.5} cy={13.5} r={3.5} />
              <Path d="M9 11 16 4M13.5 6.5l2 2M11.5 8.5l1.5 1.5" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={[styles.eyebrow, { color: Colors.accent }]}>Invite code</Text>
          <Text style={styles.title} accessibilityRole="header">
            Your join code has been refreshed
          </Text>
          <Text style={styles.joinBody}>
            Your previous code no longer works. Use this new code to invite one trusted leader, in person.
          </Text>

          {/* QUIET treatment — underlined, no box. DM Mono. Copy-on-tap. */}
          <TouchableOpacity
            style={styles.codeQuiet}
            onPress={handleCopy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Copy invite code ${code}`}
          >
            <Text style={styles.codeText}>{code}</Text>
          </TouchableOpacity>
          <View style={styles.copyHint}>
            <Text style={[styles.copyHintText, copied && styles.copyHintDone]}>
              {copied ? '✓  Copied' : '⧉  Tap to copy'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.ghost}
            onPress={onDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.ghostText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,8,8,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  card: { width: '100%', backgroundColor: Colors.surfaceElevated, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.14)', borderRadius: Radius.xl, padding: 26 },

  glyph: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontFamily: Typography.displayMedium, fontSize: 23, color: Colors.text, lineHeight: 28, marginBottom: 14 },

  joinBody: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, lineHeight: 22, marginBottom: 18 },
  codeQuiet: { alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  codeText: { fontFamily: Typography.mono, fontSize: 28, letterSpacing: 4, color: Colors.text },
  copyHint: { alignItems: 'center', marginTop: 12, marginBottom: 18 },
  copyHintText: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.textSubtle },
  copyHintDone: { color: Colors.green },

  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },
});
