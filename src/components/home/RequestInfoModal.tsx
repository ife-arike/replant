// ─────────────────────────────────────────────
// RequestInfoModal — §16 (Ruling #16)  ·  NEW
//
// Modal-on-launch on the Home tab when the verification queue has an open
// request_info for the viewer. NOT a notification badge, NOT a new inbox.
//
// SCOPE: all church types. Generic chrome — an underground leader sees exactly
// what a standalone leader sees. No "underground" string anywhere here.
//
// Delivery contract:
//   - Fires on Home-tab launch when branch === 'request_info'. Shows once per
//     launch; dismissing leaves the persistent banner (§19) so it isn't lost.
//   - Agent is always "the Replant team". Never a name. Never "Admin".
//   - The question text gets the scriptureItalic quote treatment (same voice as
//     the Home verse) — it is the most important thing on the screen.
//
// Gate interaction (#22): while branch === 'request_info', suppress the
// verified-gate tiny-copy in UnverifiedGateView (TheChurchScreen) — the team is
// waiting on the leader, not the other way around.
//
// CD-ALT (qDelivery='banner'): deliver via the persistent banner alone, no
// modal. Founder-final = modal-on-launch + banner.
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

interface Props {
  visible: boolean;
  /** The admin's question, verbatim. Rendered in the scriptureItalic quote. */
  question: string;
  /** CTA → opens ReplyComposer (§17). */
  onReply: () => void;
  /** "Not now" — dismiss; the persistent banner remains. */
  onDismiss: () => void;
}

function ReplantMark() {
  // Envelope glyph — matches RequestInfoBanner for visual continuity
  // (Founder ruling 2026-06-22). A message, not a warning.
  return (
    <View style={styles.glyph}>
      <Svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke={Colors.accent} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M2.5 4.5h11v7h-11z" />
        <Path d="M2.5 4.5l5.5 4 5.5-4" />
      </Svg>
    </View>
  );
}

export default function RequestInfoModal({ visible, question, onReply, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <ReplantMark />
          <Text style={styles.eyebrow}>A message for you</Text>
          <Text style={styles.title} accessibilityRole="header">
            The Replant team has a question for you
          </Text>

          {/* scriptureItalic quote — set apart, given weight, never a form field */}
          <View style={styles.quoteWrap}>
            <Text style={styles.quote}>“{question}”</Text>
          </View>

          {/* Tone: no rush, no time-of-day, no deadline */}
          <Text style={styles.rest}>Reply when you’re ready. There’s no rush.</Text>

          <TouchableOpacity
            style={styles.cta}
            onPress={onReply}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send a reply to the Replant team"
          >
            <Text style={styles.ctaText}>Send a reply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ghost}
            onPress={onDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Dismiss; reply later"
          >
            <Text style={styles.ghostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,8,8,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  card: { width: '100%', backgroundColor: Colors.surfaceElevated, borderWidth: 0.5, borderColor: 'rgba(240,237,230,0.14)', borderRadius: Radius.xl, padding: 26 },

  glyph: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', color: Colors.accent, marginBottom: 12 },
  title: { fontFamily: Typography.displayMedium, fontSize: 23, color: Colors.text, lineHeight: 28, marginBottom: 4 },

  quoteWrap: { borderLeftWidth: 1.5, borderLeftColor: Colors.borderAccent, paddingLeft: 18, paddingVertical: 6, marginTop: Spacing.md, marginBottom: 18 },
  quote: { fontFamily: Typography.scriptureItalic, fontSize: 19, color: Colors.text, lineHeight: 28 },

  rest: { fontFamily: Typography.scriptureItalic, fontSize: 15, color: Colors.textMuted, lineHeight: 22, marginBottom: Spacing.lg },

  cta: { minHeight: 50, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.background },
  ghost: { minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.body, fontSize: 15, color: Colors.textMuted },
});
