// ─────────────────────────────────────────────
// VisibilityAndJoinModals — §21 (Rulings #19 + #20)  ·  NEW
//
// THREE modal-on-launch notices the admin actions produce, all UNDERGROUND-ONLY
// (only underground churches have show_church_name + a join code). Mount only
// when viewerChurchType === 'underground'. Chrome stays identical to every other
// modal — nothing stands out in a captured screen.
//
//   VisibilityFlipModal  direction='h2v' | 'v2h'
//   JoinCodeRefreshedModal
//
// CRITICAL: neither visibility notice NAMES the channel of contact — that is
// admin-internal meta only. Copy is LOCKED. Locale-safe: no idioms, no
// time-of-day. "Visible / Hidden" map to show_church_name; the internal
// "Brave / Safe" jargon never surfaces to a leader.
//
// Join code: locked format RPL-XXXX-NNNNN, DM Mono, QUIET treatment (underlined,
// no box — CD tweak codeBlock Founder-final='quiet'). Copy-on-tap via
// Clipboard.setStringAsync + Haptics.notificationAsync(Success).
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

function ReplantMark({ color }: { color: string }) {
  return (
    <View style={[styles.glyph, { borderColor: color }]}>
      <Svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.3}>
        <Path d="M8 14V6M8 6C8 4 6.5 2.5 4.5 2.5 4.5 5 6 6 8 6ZM8 6c0-2 1.5-3.5 3.5-3.5C11.5 5 10 6 8 6Z" />
      </Svg>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VISIBILITY FLIP (#19)
═══════════════════════════════════════════════════════════════════════════ */
interface FlipProps {
  visible: boolean;
  direction: 'h2v' | 'v2h';
  onDismiss: () => void;
}

export function VisibilityFlipModal({ visible, direction, onDismiss }: FlipProps) {
  const toVisible = direction === 'h2v';
  const accent = toVisible ? Colors.accent : Colors.textMuted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <ReplantMark color={accent} />
          <Text style={[styles.eyebrow, { color: accent }]}>Your church</Text>
          <Text style={styles.title}>Your visibility setting was updated</Text>

          <View style={[styles.pill, { borderColor: toVisible ? Colors.borderAccent : 'rgba(240,237,230,0.14)' }]}>
            <View style={[styles.pillDot, { backgroundColor: accent }]} />
            <Text style={[styles.pillText, { color: accent }]}>{toVisible ? 'Now Visible' : 'Now Hidden'}</Text>
          </View>

          {/* LOCKED copy. Does NOT name the channel of contact. */}
          <Text style={styles.flipText}>
            {toVisible ? (
              <>Your church is now listed as <Text style={styles.flipStrong}>Visible</Text> in the Replant network. Your location remains hidden.</>
            ) : (
              <>Your church is now listed as <Text style={styles.flipStrong}>Hidden</Text>. Other leaders will see “Underground Church” and your region only.</>
            )}
          </Text>

          <TouchableOpacity style={styles.ghost} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.ghostText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   JOIN-CODE REFRESHED (#20)
═══════════════════════════════════════════════════════════════════════════ */
interface JoinProps {
  visible: boolean;
  /** Plaintext refreshed code, RPL-XXXX-NNNNN. Shown once; never re-fetchable. */
  code: string;
  onDismiss: () => void;
}

export function JoinCodeRefreshedModal({ visible, code, onDismiss }: JoinProps) {
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
        <View style={styles.card}>
          <View style={[styles.glyph, { borderColor: Colors.accent }]}>
            <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke={Colors.accent} strokeWidth={1.4}>
              <Circle cx={6.5} cy={13.5} r={3.5} />
              <Path d="M9 11 16 4M13.5 6.5l2 2M11.5 8.5l1.5 1.5" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={[styles.eyebrow, { color: Colors.accent }]}>Invite code</Text>
          <Text style={styles.title}>Your join code has been refreshed</Text>
          <Text style={styles.joinBody}>
            Your previous code no longer works. Use this new code to invite one trusted leader, in person.
          </Text>

          {/* QUIET treatment — underlined, no box. DM Mono. Copy-on-tap. */}
          <TouchableOpacity style={styles.codeQuiet} onPress={handleCopy} activeOpacity={0.7}>
            <Text style={styles.codeText}>{code}</Text>
          </TouchableOpacity>
          <View style={styles.copyHint}>
            <Text style={[styles.copyHintText, copied && styles.copyHintDone]}>
              {copied ? '✓  Copied' : '⧉  Tap to copy'}
            </Text>
          </View>

          <TouchableOpacity style={styles.ghost} onPress={onDismiss} activeOpacity={0.7}>
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

  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16 },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillText: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },

  flipText: { fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, fontWeight: '300', lineHeight: 24, marginBottom: 18 },
  flipStrong: { color: Colors.text, fontFamily: Typography.bodyMedium, fontWeight: '500' },

  joinBody: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 22, marginBottom: 18 },
  codeQuiet: { alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.borderAccent },
  codeText: { fontFamily: Typography.mono, fontSize: 28, letterSpacing: 4, color: Colors.text },
  copyHint: { alignItems: 'center', marginTop: 12, marginBottom: 18 },
  copyHintText: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.textSubtle },
  copyHintDone: { color: Colors.green },

  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },
});
