// ─────────────────────────────────────────────
// JoinByCodeScreen — NEW (Ask 4 · Rulings #4 + #13)
// Second-leader join. Reached from UndergroundEntryScreen's "join with a
// code" row. The leader enters the code given to them FACE-TO-FACE.
//
// Founder-final entry: SEGMENTED CELLS (4 letters + 5 digits, "RPL" prefix).
//
// This screen owns the FULL second-leader flow (code + personal details +
// submit). On submit it calls POST /functions/v1/join-underground-church
// (verify_jwt=false), which atomically creates auth.users + public.users
// and attaches them to the underground church. We then sign the leader in
// with the same email/password they just entered; AuthProvider's
// onAuthStateChange handler routes to the main tabs.
//
// Error model (LOCKED, ruling #4): every redemption failure — invalid,
// expired, consumed, cap-reached, deactivated, internal — returns ONE
// generic string. Distinct cases:
//   - 409 email_already_registered (Founder override 2026-06-20) — "sign
//     in instead" copy.
//   - 429 rate_limited — distinct copy.
//   - network throw — distinct copy.
// All others fold into "That code did not match. Please check with the
// leader who gave it to you."
// ─────────────────────────────────────────────

import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { joinUndergroundChurch } from '../../api/underground';
import { newIdempotencyKey } from '../../utils/idempotency';
import { supabase } from '../../lib/supabase';
import type { Role } from '../../api/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'JoinByCode'>;

// 4 letters + 5 digits — matches the RPL-XXXX-NNNNN format LOCKED in
// ruling #2. The "RPL-" prefix is fixed chrome, not entered by the leader.
const BODY_LEN = 9;

type ErrKind = null | 'generic' | 'rate' | 'net' | 'email';

// Roles mirror the BE enum in supabase/functions/join-underground-church/
// logic.ts ROLES. Keep this list in lockstep — adding a role here without
// updating the BE will fail validation server-side.
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'pastor', label: 'Pastor' },
  { value: 'apostle', label: 'Apostle' },
  { value: 'prophet', label: 'Prophet' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'elder', label: 'Elder' },
  { value: 'bishop', label: 'Bishop' },
  { value: 'reverend', label: 'Reverend' },
  { value: 'intercessor', label: 'Intercessor' },
  { value: 'psalmist', label: 'Psalmist' },
  { value: 'ministry_leader', label: 'Ministry leader' },
  { value: 'other', label: 'Other' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function JoinByCodeScreen({ navigation }: Props) {
  // ── Code section ──────────────────────────────────────────────────
  const [body, setBody] = useState('');
  const [focused, setFocused] = useState(false);
  const hidden = useRef<TextInput>(null);

  // ── Personal details section ──────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  // ── Submit state ──────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<ErrKind>(null);
  // Hold the idempotency key for the lifetime of THIS submission attempt.
  // Same key reused on retries within a single user-intent; mint a fresh
  // one only on a fresh tap after success (which we never reach — success
  // navigates away).
  const idempotencyKeyRef = useRef<string | null>(null);

  const codeFilled = body.length === BODY_LEN;

  const onCodeType = (raw: string) => {
    const norm = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, BODY_LEN);
    setBody(norm);
    if (err) setErr(null);
  };

  const personalValid = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      EMAIL_RE.test(email.trim()) &&
      password.length >= 8 &&
      role !== ''
    );
  }, [firstName, lastName, email, password, role]);

  const canSubmit = codeFilled && personalValid;

  const onSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setErr(null);

    // Reuse the same idempotency key on retries within this session.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    const idempotencyKey = idempotencyKeyRef.current;

    const code = `RPL-${body.slice(0, 4)}-${body.slice(4)}`;
    const trimmedEmail = email.trim();

    try {
      const res = await joinUndergroundChurch({
        idempotencyKey,
        joinCode: code,
        leader: {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          email: trimmedEmail,
          phone: phone.trim() || undefined,
          password,
          role: role as Role,
        },
      });

      if (res.ok) {
        // Sign the leader in with the same credentials. Success here
        // triggers AuthProvider.onAuthStateChange → callAuthStatusCheck
        // → branch flip to 'pending' (or 'active'), and RootNavigator
        // remounts the Tabs tree. Do NOT navigate manually.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          // Account was created, but sign-in failed — unusual. Surface a
          // recoverable message; the leader can try signing in manually.
          setErr('generic');
          setSubmitting(false);
          // Reset idempotency key so the next submit (if they try again)
          // hits the cache and replays the success body — same userId/
          // churchId, no double-create.
        }
        // On success: do not setSubmitting(false) — we're being unmounted.
        return;
      }

      // Failure branches.
      switch (res.reason) {
        case 'email_already_registered':
          setErr('email');
          break;
        case 'rate_limited':
          setErr('rate');
          break;
        case 'internal_error':
          // 500 from server — treat as transient. Use the generic copy
          // (the leader has no way to distinguish, and the spec maps all
          // non-explicit errors into this bucket).
          setErr('generic');
          break;
        default:
          // invalid_or_consumed_code, validation_error, idempotency_key_required.
          setErr('generic');
      }
    } catch {
      // Network / unexpected throw — distinct from a code failure so the
      // leader knows it's a connectivity issue.
      setErr('net');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  const chars = body.split('');
  const cell = (i: number) => {
    const ch = chars[i] || '';
    const cursor = focused && i === chars.length;
    return (
      <View
        key={i}
        style={[
          styles.cell,
          !!ch && styles.cellFilled,
          cursor && styles.cellCursor,
          err === 'generic' && styles.cellErr,
        ]}
      >
        <Text style={styles.cellText}>{ch}</Text>
      </View>
    );
  };

  const selectedRoleLabel =
    role === '' ? 'Select a role' : (ROLE_OPTIONS.find(r => r.value === role)?.label ?? 'Select a role');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>JOIN AN EXISTING FELLOWSHIP</Text>
        <Text style={styles.title}>Enter the code your leader gave you</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          If a leader you serve with has invited you to join their fellowship on
          Replant, enter the code they shared with you in person.
        </Text>

        {/* CODE — segmented cells */}
        <View>
          <Text style={styles.label}>INVITE CODE</Text>
          <TouchableOpacity activeOpacity={1} onPress={() => hidden.current?.focus()}>
            <View style={styles.cells}>
              <Text style={styles.prefix}>RPL</Text>
              <Text style={styles.dash}>–</Text>
              {[0, 1, 2, 3].map(cell)}
              <Text style={styles.dash}>–</Text>
              {[4, 5, 6, 7, 8].map(cell)}
            </View>
          </TouchableOpacity>
          <TextInput
            ref={hidden}
            style={styles.hiddenInput}
            value={body}
            onChangeText={onCodeType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            maxLength={BODY_LEN}
            editable={!submitting}
          />
        </View>

        {/* PERSONAL DETAILS — collected here so we can hit
            join-underground-church atomically. Mirrors ASP1+ASP2 fields
            but in a single screen to keep the second-leader flow tight. */}
        <Text style={[styles.label, styles.sectionLabel]}>YOUR DETAILS</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Given name"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Middle name <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="Middle name"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Family name"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Phone <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 000 000 0000"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="phone-pad"
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Role</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setRolePickerOpen(true)}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.inputText,
                role === '' && { color: Colors.textSubtle },
              ]}
            >
              {selectedRoleLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {err === 'generic' && (
          <Notice kind="err">
            That code did not match. Please check with the leader who gave it to you.
          </Notice>
        )}
        {err === 'rate' && (
          <Notice kind="warn">
            Too many tries. Please wait a few minutes before trying again.
          </Notice>
        )}
        {err === 'email' && (
          <Notice kind="warn">
            This email is already registered. Please sign in or use a different email.
          </Notice>
        )}
        {err === 'net' && (
          <Notice kind="net">
            We couldn&rsquo;t reach Replant right now. Check your connection and try again.
          </Notice>
        )}

        <Text style={styles.helper}>
          The code should have been given to you face-to-face. If you received
          it any other way, do not enter it — speak to your leader first.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !canSubmit && styles.ctaOff]}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[styles.ctaText, !canSubmit && styles.ctaTextOff]}>
              Join fellowship
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Role picker — bottom sheet */}
      <Modal
        visible={rolePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRolePickerOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Role</Text>
              <TouchableOpacity onPress={() => setRolePickerOpen(false)}>
                <Text style={styles.sheetClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={ROLE_OPTIONS}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    role === item.value && styles.sheetItemSelected,
                  ]}
                  onPress={() => {
                    setRole(item.value);
                    setRolePickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sheetItemText,
                      role === item.value && styles.sheetItemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Notice({
  kind,
  children,
}: {
  kind: 'err' | 'warn' | 'net';
  children: React.ReactNode;
}) {
  const tint =
    kind === 'err'
      ? 'rgba(224,85,85,0.06)'
      : kind === 'warn'
        ? 'rgba(212,168,85,0.06)'
        : Colors.surface;
  const border =
    kind === 'err'
      ? 'rgba(224,85,85,0.22)'
      : kind === 'warn'
        ? 'rgba(212,168,85,0.25)'
        : Colors.border;
  const ico = kind === 'err' ? '✕' : kind === 'warn' ? '◷' : '⚠';
  const icoColor =
    kind === 'err' ? Colors.red : kind === 'warn' ? Colors.amber : Colors.textMuted;
  return (
    <View style={[styles.notice, { backgroundColor: tint, borderColor: border }]}>
      <Text style={[styles.noticeIco, { color: icoColor }]}>{ico}</Text>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  back: {
    marginBottom: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: { fontFamily: Typography.body, fontSize: 16, color: Colors.accent },
  eyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 26,
    color: Colors.text,
    lineHeight: 32,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  lead: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 22,
  },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLabel: {
    marginTop: Spacing.md,
  },
  cells: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  prefix: {
    fontFamily: Typography.mono,
    fontSize: 17,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  dash: { fontFamily: Typography.mono, fontSize: 15, color: Colors.textSubtle },
  cell: {
    width: 28,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: { borderColor: Colors.borderAccent },
  cellCursor: { borderColor: Colors.accent },
  cellErr: { borderColor: 'rgba(224,85,85,0.5)' },
  cellText: { fontFamily: Typography.mono, fontSize: 19, color: Colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  optionalTag: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  input: {
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    justifyContent: 'center',
  },
  inputText: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  notice: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 13,
  },
  noticeIco: { fontSize: 13, marginTop: 1 },
  noticeText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 18,
  },
  helper: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    fontWeight: '300',
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { backgroundColor: 'rgba(107,181,232,0.2)' },
  ctaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
  ctaTextOff: { color: 'rgba(107,181,232,0.4)' },

  sheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '70%',
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.text,
  },
  sheetClose: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.accent,
  },
  sheetItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sheetItemSelected: { backgroundColor: 'rgba(107,181,232,0.06)' },
  sheetItemText: { fontFamily: Typography.body, fontSize: 15, color: Colors.text },
  sheetItemTextSelected: { color: Colors.accent },
});
