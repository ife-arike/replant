// ─────────────────────────────────────────────
// PostPrayerRequestModal — KAN-22 (AC #12 – #15)
//
// Verified-leader-only post surface, presented as a full-screen RN
// Modal over the CAL host. Wires the create_prayer_request RPC
// (SECURITY DEFINER, landed via PR #92 → patched by PR #93 to the
// canonical 8-value CATEGORIES set).
//
// Field set (AC #12):
//   - prayer text (multiline, max 300 chars; counter "X / 300" with
//     muted → amber (≥250) → red (≥280) → blocked at 301 via
//     TextInput maxLength)
//   - category (required) — picker over the 8 canonical CATEGORIES;
//     dispatch's narrower 5-value list is superseded by the Founder-
//     locked CATEGORIES constant (KAN-22 c.14806 + Founder ruling
//     2026-05-28).
//   - urgent toggle (default off)
//
// Attribution line (non-editable, AC #13):
//   standard    → "This request will be posted on behalf of {name}."
//   underground → "This request will be posted anonymously on behalf of
//                  your church."
//
// Submit "Lift It Up" (AC #14):
//   - Disabled until trimmed content non-empty AND a category is picked.
//   - Loading state; button disabled during the in-flight call (no
//     double-submit).
//   - Success → onSuccess() (host dismisses modal + toasts on the panel;
//     new row appears after the leader's next pull-to-refresh, NOT
//     injected here — matches AC #14 "appears after pull-to-refresh").
//   - Failure → maps the 6 RPC error codes to inline error copy;
//     button re-activates so the leader can correct + retry.
//
// AC #15 — Back button returns to panel without submitting (handled by
// onCancel / onRequestClose).
//
// Watched invariants:
//   - This component is only opened by the panel when viewerVerified === true.
//     The RPC's not_verified guard is the defence-in-depth at the wire.
//   - No expo-blur; modal backdrop is dim-only (matches all sheets in
//     this codebase).
// ─────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { CATEGORIES, type PrayerCategory } from '../prayer/PrayerWallLogic';

const MAX_CHARS = 300;
const AMBER_AT = 250;
const RED_AT = 280;

interface Props {
  visible: boolean;
  churchName: string | null;
  isUnderground: boolean;
  defaultAnonymous?: boolean;
  onCancel: () => void;
  onSuccess: () => void; // host dismisses + toasts
}

// Map create_prayer_request error codes → inline copy.
function errorCopy(code: string | null | undefined): string {
  switch (code) {
    case 'content_required':   return 'Please add a prayer request before submitting.';
    case 'content_too_long':   return 'Keep it under 300 characters.';
    case 'invalid_category':   return 'Please pick a category.';
    case 'not_verified':       return 'Your church must be verified to post.';
    case 'not_authenticated':  return 'Sign in to post.';
    case 'user_not_found':     return "We couldn't find your account.";
    default:                   return "Something went wrong posting this. Try again.";
  }
}

export default function PostPrayerRequestModal({
  visible, churchName, isUnderground, defaultAnonymous = false, onCancel, onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PrayerCategory | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [anonymous, setAnonymous] = useState(defaultAnonymous);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && category !== null && !submitting;
  const charsLeft = MAX_CHARS - content.length;
  const counterColor = useMemo(() => {
    if (content.length >= RED_AT) return Colors.red;
    if (content.length >= AMBER_AT) return Colors.amber;
    return Colors.textMuted;
  }, [content.length]);

  const reset = () => {
    setContent('');
    setCategory(null);
    setUrgent(false);
    setAnonymous(defaultAnonymous);
    setSubmitting(false);
    setErrorMsg(null);
  };

  const handleCancel = () => { reset(); onCancel(); };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    const { error } = await supabase.rpc('create_prayer_request', {
      p_content: trimmed,
      p_category: category,
      p_urgent: urgent,
      p_anonymous_override: isUnderground ? true : anonymous,
    });
    if (error) {
      // The DEFINER fn RAISEs the code as message text; supabase-js
      // surfaces it on error.message.
      setErrorMsg(errorCopy(error.message));
      setSubmitting(false);
      return;
    }
    reset();
    onSuccess();
  };

  const attribution = isUnderground || anonymous
    ? `This request will be posted anonymously on behalf of ${churchName ?? 'your church'}.`
    : `This request will be posted on behalf of ${churchName ?? 'your church'}.`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Prayer Wall">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Post a Request</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {/* Attribution (non-editable) */}
          <Text style={styles.attribution}>{attribution}</Text>

          {/* Prayer text */}
          <Text style={styles.fieldLabel}>YOUR PRAYER</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={MAX_CHARS} // hard-stop at 300 → "blocked at 301" satisfied
            style={styles.textarea}
            placeholder="Share what your church is bringing before the Lord."
            placeholderTextColor={Colors.textSubtle}
            editable={!submitting}
            textAlignVertical="top"
          />
          <Text style={[styles.counter, { color: counterColor }]}>
            {content.length} / {MAX_CHARS}{charsLeft <= 20 && charsLeft >= 0 ? ` (${charsLeft} left)` : ''}
          </Text>

          {/* Category */}
          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Urgent toggle */}
          <View style={styles.urgentRow}>
            <View style={styles.urgentTextCol}>
              <Text style={styles.urgentTitle}>Mark as urgent</Text>
              <Text style={styles.urgentSub}>For requests needing immediate intercession.</Text>
            </View>
            <Switch
              value={urgent}
              onValueChange={setUrgent}
              disabled={submitting}
              trackColor={{ false: 'rgba(240,237,230,0.15)', true: Colors.red }}
              thumbColor={Colors.text}
            />
          </View>

          {/* Anon toggle — hidden for underground (always anon) */}
          {!isUnderground ? (
            <View style={styles.urgentRow}>
              <View style={styles.urgentTextCol}>
                <Text style={styles.urgentTitle}>Post anonymously</Text>
                <Text style={styles.urgentSub}>Your name will be hidden. Your church will still be shown.</Text>
              </View>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                disabled={submitting}
                trackColor={{ false: 'rgba(240,237,230,0.15)', true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          ) : null}

          {/* Error */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Lift It Up — submit prayer request"
            accessibilityState={{ disabled: !canSubmit }}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.submitText}>Lift It Up</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 18 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  backText: { fontFamily: Typography.bodyMedium, fontSize: 15, color: Colors.accent, minWidth: 64 },
  title: { fontFamily: Typography.display, fontSize: 19, color: Colors.text },
  headerRight: { minWidth: 64 },

  bodyContent: { paddingVertical: 18, gap: 16 },

  attribution: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
    paddingHorizontal: 2,
  },

  fieldLabel: {
    marginTop: 6,
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.textSubtle,
  },
  textarea: {
    minHeight: 140,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  counter: { marginTop: 6, alignSelf: 'flex-end', fontFamily: Typography.mono, fontSize: 11, letterSpacing: 0.6 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: 'rgba(107,181,232,0.12)', borderColor: Colors.borderAccent },
  catChipText: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted },
  catChipTextActive: { color: Colors.accent, fontFamily: Typography.bodyMedium },

  urgentRow: {
    marginTop: 4,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  urgentTextCol: { flex: 1 },
  urgentTitle: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.text },
  urgentSub: { marginTop: 2, fontFamily: Typography.body, fontSize: 12, lineHeight: 16, color: Colors.textMuted },

  errorText: { fontFamily: Typography.body, fontSize: 13, lineHeight: 19, color: Colors.red, marginTop: 4 },

  footer: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  submitBtn: {
    minHeight: 50, borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { fontFamily: Typography.bodyMedium, fontSize: 16, color: Colors.background, letterSpacing: 0.3 },
});
