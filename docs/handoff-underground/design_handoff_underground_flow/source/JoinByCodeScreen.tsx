// ─────────────────────────────────────────────
// JoinByCodeScreen — NEW (Ask 4 · Rulings #4 + #13)
// Second-leader join. Reached from UndergroundEntryScreen's "join with a code"
// row. The leader enters the code given to them FACE-TO-FACE.
//
// Founder-final entry: SEGMENTED CELLS (4 letters + 5 digits, "RPL" prefix).
// CD-ALT: single masked field — preserved as a comment below.
//
// Error model (LOCKED, ruling #4): every redemption failure — invalid, expired,
// consumed, rate-limited, deactivated — returns ONE generic string. Rate-limit
// and network errors are surfaced distinctly (a connection problem is not an
// enumeration signal).
//
// On success → ASP1 with the underground church_id pre-attached; the leader
// completes personal account details and attaches on ASP2 submit.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { joinUndergroundChurch } from '../../api/underground';   // edge-fn wrapper
import { newIdempotencyKey } from '../../utils/idempotency';

const BODY_LEN = 9; // 4 letters + 5 digits (prefix "RPL-" is fixed chrome)

type ErrKind = null | 'generic' | 'rate' | 'net';

export default function JoinByCodeScreen({ navigation }: Props) {
  const [body, setBody] = useState('');           // up to 9 chars, no prefix/dashes
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<ErrKind>(null);
  const hidden = useRef<TextInput>(null);

  const filled = body.length === BODY_LEN;

  const onType = (raw: string) => {
    const norm = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, BODY_LEN);
    setBody(norm);
    if (err) setErr(null);
  };

  const verify = async () => {
    if (!filled || submitting) return;
    setSubmitting(true); setErr(null);
    const code = `RPL-${body.slice(0, 4)}-${body.slice(4)}`;
    try {
      const res = await joinUndergroundChurch({ idempotencyKey: newIdempotencyKey(), joinCode: code });
      if (res.ok) {
        // church_id pre-attached into onboarding context; ASP1 collects the
        // leader's personal details, attaches on ASP2 submit.
        navigation.navigate('AccountSetupPage1', { undergroundChurchId: res.churchId });
        return;
      }
      // ALL redemption failures share one string (enumeration defense).
      setErr(res.reason === 'rate_limited' ? 'rate' : 'generic');
    } catch {
      setErr('net'); // connection problem — distinct from a code failure
    } finally {
      setSubmitting(false);
    }
  };

  const chars = body.split('');
  const cell = (i: number) => {
    const ch = chars[i] || '';
    const cursor = focused && i === chars.length;
    return (
      <View key={i} style={[styles.cell, ch && styles.cellFilled, cursor && styles.cellCursor, err && styles.cellErr]}>
        <Text style={styles.cellText}>{ch}</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>JOIN AN EXISTING FELLOWSHIP</Text>
        <Text style={styles.title}>Enter the code your leader gave you</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.lead}>
          If a leader you serve with has invited you to join their fellowship on Replant,
          enter the code they shared with you in person.
        </Text>

        <View>
          <Text style={styles.label}>INVITE CODE</Text>
          {/* Founder-final: segmented cells. The hidden TextInput captures input;
              the cells render it. Tap anywhere on the cells to focus. */}
          <TouchableOpacity activeOpacity={1} onPress={() => hidden.current?.focus()}>
            <View style={styles.cells}>
              <Text style={styles.prefix}>RPL</Text><Text style={styles.dash}>–</Text>
              {[0, 1, 2, 3].map(cell)}
              <Text style={styles.dash}>–</Text>
              {[4, 5, 6, 7, 8].map(cell)}
            </View>
          </TouchableOpacity>
          <TextInput
            ref={hidden}
            style={styles.hiddenInput}
            value={body}
            onChangeText={onType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            maxLength={BODY_LEN}
          />
        </View>

        {err === 'generic' && <Notice kind="err">That code did not match. Please check with the leader who gave it to you.</Notice>}
        {err === 'rate' && <Notice kind="warn">Too many tries. Please wait a few minutes before trying again.</Notice>}
        {err === 'net' && <Notice kind="net">We couldn’t reach Replant right now. Check your connection and try again.</Notice>}

        <Text style={styles.helper}>
          The code should have been given to you face-to-face. If you received it any
          other way, do not enter it — speak to your leader first.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !filled && styles.ctaOff]}
          onPress={verify}
          disabled={!filled || submitting}
          activeOpacity={0.85}
        >
          {submitting ? <ActivityIndicator color={Colors.background} />
            : <Text style={[styles.ctaText, !filled && styles.ctaTextOff]}>Verify code</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Notice({ kind, children }: { kind: 'err' | 'warn' | 'net'; children: React.ReactNode }) {
  const tint = kind === 'err' ? 'rgba(224,85,85,0.06)' : kind === 'warn' ? 'rgba(212,168,85,0.06)' : Colors.surface;
  const border = kind === 'err' ? 'rgba(224,85,85,0.22)' : kind === 'warn' ? 'rgba(212,168,85,0.25)' : Colors.border;
  const ico = kind === 'err' ? '✕' : kind === 'warn' ? '◷' : '⚠';
  const icoColor = kind === 'err' ? Colors.red : kind === 'warn' ? Colors.amber : Colors.textMuted;
  return (
    <View style={[styles.notice, { backgroundColor: tint, borderColor: border }]}>
      <Text style={[styles.noticeIco, { color: icoColor }]}>{ico}</Text>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

// ── CD-ALT (not selected): single masked field ───────────────────────────────
// One TextInput styled mono 19px, centered, placeholder "RPL-XXXX-XXXXX", with
// an onChangeText mask that re-inserts the "RPL-" prefix and the dash after the
// 4th letter. Error state → red border. Same verify() logic.

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinByCode'>;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 72, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  back: { marginBottom: Spacing.md, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: Typography.body, fontSize: 16, color: Colors.accent },
  eyebrow: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, textTransform: 'uppercase', marginBottom: Spacing.xs },
  title: { fontFamily: Typography.display, fontSize: 28, color: Colors.text, lineHeight: 33 },
  body: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.lg },
  lead: { fontFamily: Typography.body, fontSize: 13.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 23 },
  label: { fontFamily: Typography.bodyMedium, fontSize: 12, letterSpacing: 0.8, color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 10 },
  cells: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  prefix: { fontFamily: Typography.mono, fontSize: 17, color: Colors.textMuted, letterSpacing: 1 },
  dash: { fontFamily: Typography.mono, fontSize: 15, color: Colors.textSubtle },
  cell: { width: 28, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cellFilled: { borderColor: Colors.borderAccent },
  cellCursor: { borderColor: Colors.accent },
  cellErr: { borderColor: 'rgba(224,85,85,0.5)' },
  cellText: { fontFamily: Typography.mono, fontSize: 19, color: Colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  notice: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', borderWidth: 1, borderRadius: Radius.lg, padding: 13 },
  noticeIco: { fontSize: 13, marginTop: 1 },
  noticeText: { flex: 1, fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, fontWeight: '300', lineHeight: 18 },
  helper: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSubtle, fontWeight: '300', lineHeight: 19 },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  cta: { backgroundColor: Colors.accent, borderRadius: Radius.lg, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: 'rgba(107,181,232,0.2)' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.background },
  ctaTextOff: { color: 'rgba(107,181,232,0.4)' },
});
