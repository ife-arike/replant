// ─────────────────────────────────────────────
// ReplyComposer — §17 (Ruling #16)  ·  NEW
//
// Reached from RequestInfoModal's "Send a reply". One field, the question kept
// in view for context, a send action, and a calm post-send confirmation.
//
// SCOPE: all church types. Generic chrome.
//
// Contract:
//   - Send disabled until the field is non-empty.
//   - On send → write to the request-info thread the admin reads in the detail
//     route (admin §3) via supabase.rpc('fn_send_reply_to_team'), then show the
//     green "sent" takeover and auto-return Home.
//   - NO read receipts, NO typing indicators, NO "team will respond by…".
//     Nothing that pressures. The leader says what they can and leaves in peace.
//
// Mounted in-line by HomeScreen as step 2 of the RequestInfo flow (no separate
// route registration needed).
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

interface Props {
  /** The admin's question, kept in view above the field for context. */
  question: string;
  /** Persist the reply to the request-info thread. Resolve when written. */
  onSend: (reply: string) => Promise<void>;
  /** Called after the sent-confirmation auto-dismiss (~2.6s). Returns Home. */
  onDone: () => void;
  onBack: () => void;
}

export default function ReplyComposer({ question, onSend, onDone, onBack }: Props) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      await onSend(text.trim());
      setSent(true);
      setTimeout(onDone, 2600);
    } catch {
      // Reset send state so the leader can try again. Error surfacing is the
      // caller's job — we do not mount a modal here that would re-traumatize.
      setSending(false);
    }
  }, [canSend, text, onSend, onDone]);

  if (sent) {
    return (
      <SafeAreaView style={styles.sentRoot} edges={['top', 'bottom']}>
        <View style={styles.sentMark}>
          <Svg width={26} height={26} viewBox="0 0 28 28" fill="none" stroke={Colors.green} strokeWidth={1.6}>
            <Path d="M7 14.5 12 19.5 21.5 9" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.sentTitle} accessibilityRole="header">
          Your reply was sent.
        </Text>
        <Text style={styles.sentSub}>
          We’ll be in touch here once we’ve reviewed it.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>Reply to the team</Text>
        <Text style={styles.title} accessibilityRole="header">Your reply</Text>
      </View>

      {/* Tap outside the field dismisses the keyboard. Send button stays
          at the bottom (keyboard will cover it while typing — leader taps
          outside to dismiss, then taps Send). 2026-06-22 — per Founder:
          no layout shift; the only behavior added is tap-outside-collapse. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.body}>
          {/* Question kept in view for context — scriptureItalic, quiet */}
          <Text style={styles.context}>“{question}”</Text>

          <TextInput
            style={styles.field}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Write your reply…"
            placeholderTextColor={Colors.textSubtle}
            textAlignVertical="top"
            accessibilityLabel="Your reply"
          />
          <Text style={styles.footNote}>
            Only the Replant team will see this.
          </Text>
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.foot}>
        <TouchableOpacity
          style={[styles.cta, !canSend && styles.ctaOff]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
        >
          <Text style={[styles.ctaText, !canSend && styles.ctaTextOff]}>
            {sending ? 'Sending…' : 'Send reply'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  head: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(240,237,230,0.08)' },
  back: { fontFamily: Typography.body, fontSize: 16, color: Colors.accent, marginBottom: 16 },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.98, textTransform: 'uppercase', color: Colors.accent, marginBottom: 8 },
  title: { fontFamily: Typography.displayMedium, fontSize: 26, color: Colors.text },

  body: { flex: 1, paddingHorizontal: 22, paddingTop: Spacing.md, gap: Spacing.md },
  context: { fontFamily: Typography.scriptureItalic, fontSize: 14.5, color: Colors.textMuted, lineHeight: 22, borderLeftWidth: 1.5, borderLeftColor: Colors.borderAccent, paddingLeft: 14 },
  field: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(240,237,230,0.08)', borderRadius: Radius.lg, padding: 15, fontFamily: Typography.body, fontSize: 14, color: Colors.text, minHeight: 130, lineHeight: 22 },
  footNote: { fontFamily: Typography.body, fontSize: 11.5, color: Colors.textSubtle, lineHeight: 17, textAlign: 'center', alignSelf: 'stretch' },

  foot: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },
  cta: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: 'rgba(107,181,232,0.15)' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.background },
  ctaTextOff: { color: 'rgba(107,181,232,0.4)' },

  sentRoot: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 18 },
  sentMark: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: 'rgba(91,173,122,0.4)', backgroundColor: 'rgba(91,173,122,0.12)', alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: Typography.displayMedium, fontSize: 23, color: Colors.text, textAlign: 'center', lineHeight: 29 },
  sentSub: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 240 },
});
