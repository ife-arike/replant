// DeleteAccountFlow — KAN-205 in-app account deletion ceremony
// (Founder-ratified 2026-07-03; SEC lane + CONTENT copy set, both in
// .claude/plans/2026-07-03-kan205-deletion-panel-*.md).
//
// Three steps inside one modal, in the ratified order:
//   1. 'explain'  — CONTENT §2 "Delete your account": exactly what
//      happens, the 30-day window, what stays de-named, the conditional
//      sole-leader church-cascade disclosure (driven by
//      fn_my_deletion_preview — the FE cannot see co-leader rows under
//      RLS). UG variants per CONTENT §6.
//   2. 'password' — SEC §1 knowledge-factor re-check:
//      signInWithPassword(session email, typed password). Defeats the
//      unattended-unlocked-device attacker; a 168h refresh token means
//      "signed in" can be weeks stale. (Microcopy for this step is not
//      in the CONTENT set — SEC-required insertion, flagged for CONTENT.)
//   3. 'confirm'  — CONTENT §3 Shape 1, type-DELETE (ratified over
//      hold-to-confirm for switch-control/tremor accessibility). The
//      confirm word never echoes a name or church.
//
// On confirm: POST /functions/v1/delete-account (soft-delete RPC + global
// refresh-token revoke + Founder-ruled deletion-started email, all server
// side) → showGoodbye() → wipeLocalAccountState() → signOut(). The
// goodbye overlay (App.tsx level) survives the branch flip to Login.
//
// Copy is VERBATIM from the ratified CONTENT file — do not rewrite.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Typography } from '../../constants/theme';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { wipeLocalAccountState } from '../../utils/wipeLocalAccountState';

// fn_my_deletion_preview() jsonb shape (migration 20260707000001).
interface DeletionPreview {
  is_last_active_leader: boolean;
  church_type: string | null;
  church_verification_status: string | null;
  pending_co_leader: boolean;
  show_church_name: boolean | null;
}

type Step = 'explain' | 'password' | 'confirm';

interface DeleteAccountFlowProps {
  visible: boolean;
  onClose: () => void;
  /** Session email — the knowledge-factor re-check signs in against it. */
  email: string | null;
  churchName: string | null;
  viewerChurchType: string | null;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const CONFIRM_WORD = 'DELETE';

export default function DeleteAccountFlow({
  visible,
  onClose,
  email,
  churchName,
  viewerChurchType,
}: DeleteAccountFlowProps) {
  const { session, showGoodbye, signOut } = useAuth();

  const [step, setStep] = useState<Step>('explain');
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  // UG posture: trust the preview's church_type once loaded; the prop
  // covers the loading window so UG copy never flashes standard lines.
  const isUnderground =
    (preview?.church_type ?? viewerChurchType) === 'underground';

  const fetchPreview = useCallback(async () => {
    setPreviewError(false);
    try {
      const { data, error } = await supabase.rpc('fn_my_deletion_preview');
      if (error) throw error;
      setPreview(data as DeletionPreview);
    } catch {
      setPreviewError(true);
    }
  }, []);

  // Reset the ceremony every time it opens; kick off the preview read.
  useEffect(() => {
    if (!visible) return;
    setStep('explain');
    setPreview(null);
    setPassword('');
    setPasswordError(null);
    setVerifying(false);
    setConfirmText('');
    setDeleteError(null);
    setDeleting(false);
    busy.current = false;
    void fetchPreview();
    AccessibilityInfo.announceForAccessibility('Delete your account. Before you decide.');
  }, [visible, fetchPreview]);

  const close = () => {
    if (deleting) return; // never abandon mid-deletion
    onClose();
  };

  // ─── Step 2 — password re-check (SEC §1) ───
  const handleVerifyPassword = async () => {
    if (busy.current || !email || !password) return;
    busy.current = true;
    setVerifying(true);
    setPasswordError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const invalid = /invalid login credentials/i.test(error.message ?? '');
        setPasswordError(invalid ? 'Incorrect password. Try again.' : GENERIC_ERROR);
        AccessibilityInfo.announceForAccessibility(
          invalid ? 'Incorrect password. Try again.' : GENERIC_ERROR,
        );
        return;
      }
      setPassword('');
      setStep('confirm');
      AccessibilityInfo.announceForAccessibility('Final confirmation. This is the final step.');
    } catch {
      setPasswordError(GENERIC_ERROR);
      AccessibilityInfo.announceForAccessibility(GENERIC_ERROR);
    } finally {
      setVerifying(false);
      busy.current = false;
    }
  };

  // ─── Step 3 — the deletion itself ───
  const handleDelete = async () => {
    if (busy.current || confirmText !== CONFIRM_WORD) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      setDeleteError(GENERIC_ERROR);
      return;
    }
    busy.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (response.status === 429) {
        // Ratified cycle shape (3 per 30 days) fired server-side. Copy is
        // not in the CONTENT set — minimal house register, email guidance
        // omitted for UG per the §6.2 discipline. Flagged for CONTENT.
        const line = isUnderground
          ? 'This account has reached its deletion limit for now. Reach the Replant team in the app.'
          : 'This account has reached its deletion limit for now. Write to accounts@projectreplant.org.';
        setDeleteError(line);
        AccessibilityInfo.announceForAccessibility(line);
        return;
      }
      if (!response.ok) {
        setDeleteError(GENERIC_ERROR);
        AccessibilityInfo.announceForAccessibility(GENERIC_ERROR);
        return;
      }
      // Deletion committed server-side. Goodbye BEFORE signOut so the
      // overlay is already mounted when the branch flips to Login.
      showGoodbye();
      await wipeLocalAccountState();
      await signOut();
      // No onClose needed — Settings unmounts with the branch flip; the
      // modal goes with it.
    } catch {
      setDeleteError(GENERIC_ERROR);
      AccessibilityInfo.announceForAccessibility(GENERIC_ERROR);
    } finally {
      setDeleting(false);
      busy.current = false;
    }
  };

  // ─── Copy assembly (CONTENT §2 / §6) ───

  // §6.1 — UG restore sentence swap (mechanism-free; never describe the
  // protected path on-screen).
  const paragraph1 = isUnderground
    ? 'Deleting your account starts a 30-day window. If you return within 30 days, your account can be restored.'
    : 'Deleting your account starts a 30-day window. During that time you can change your mind — sign back in, and you can restore everything as you left it.';

  const paragraph2 =
    'After 30 days, your account is permanently deleted. Your name, email address, and phone number are removed from Replant, and you will no longer be able to sign in.';

  const paragraph3 =
    'What you gave to the community stays with the community. Prayers, testimonies, comments, and messages you already sent remain with the people you shared them with — no longer attached to your name.';

  // §6.2 — support paragraph omitted entirely for UG (precedent:
  // VerificationBanner UG pending drops the admin email; UG contact is
  // in-app). Authenticated surface, so the absence carries no fingerprint.
  const showSupportParagraph = !isUnderground;

  // Sole-leader disclosure — required whenever the leader is the only
  // active leader (SEC §5.3; pending co-leaders count as active, so the
  // preview already returns false and the promise is correctly withheld).
  const showSoleLeaderBlock = preview?.is_last_active_leader === true;
  // §6.3 — hidden-name UG renders the fellowship variant; brave UG
  // (show_church_name=true) renders the name per existing display rules.
  const useFellowshipWording =
    isUnderground && preview?.show_church_name !== true;
  const disclosedName = churchName ?? 'your church';

  const soleLeaderBody = useFellowshipWording
    ? "You are the only leader of your fellowship on Replant. If your account is deleted, your fellowship's place in the network is removed with it, on the same schedule."
    : `You are the only leader for ${disclosedName} on Replant. If your account is deleted, ${disclosedName}'s place in the network is removed with it, on the same schedule.`;

  const soleLeaderEcho = useFellowshipWording
    ? 'Your fellowship leaves the network with you.'
    : `${disclosedName} leaves the network with you.`;

  const confirmMismatch =
    confirmText.length > 0 && confirmText !== CONFIRM_WORD;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidingView}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.card}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.cardContent}
            >
              {/* ── STEP 1 — CONTENT §2 ── */}
              {step === 'explain' && (
                <>
                  <Text style={styles.eyebrow}>BEFORE YOU DECIDE</Text>
                  <Text style={styles.title} accessibilityRole="header">
                    Delete your account
                  </Text>
                  <Text style={styles.lead}>
                    Here is exactly what happens, so you can decide in peace.
                  </Text>

                  <Text style={styles.body}>{paragraph1}</Text>
                  <Text style={[styles.body, styles.bodyGap]}>{paragraph2}</Text>
                  <Text style={[styles.body, styles.bodyGap]}>{paragraph3}</Text>
                  {showSupportParagraph && (
                    <Text style={[styles.body, styles.bodyGap]}>
                      If something is wrong that we could help with, we would like
                      to hear it before you go. Write to{' '}
                      <Text
                        style={styles.emailInline}
                        onPress={() => {
                          void Clipboard.setStringAsync('accounts@projectreplant.org');
                        }}
                        accessibilityRole="link"
                        accessibilityLabel="accounts@projectreplant.org. Tap to copy."
                      >
                        accounts@projectreplant.org
                      </Text>
                      .
                    </Text>
                  )}

                  {/* Preview-driven sole-leader disclosure (visually set
                      apart, above the buttons — CONTENT §2). */}
                  {showSoleLeaderBlock && (
                    <View style={styles.disclosureBlock}>
                      <Text style={styles.disclosureText}>
                        One more thing you should know. {soleLeaderBody}
                      </Text>
                    </View>
                  )}

                  {/* Preview not yet loaded / failed — the disclosure is
                      load-bearing (a sole leader must not proceed unwarned),
                      so Continue waits on it. */}
                  {!preview && !previewError && (
                    <View style={styles.previewPendingRow}>
                      <ActivityIndicator size="small" color={Colors.accent} />
                    </View>
                  )}
                  {previewError && (
                    <View>
                      <Text
                        style={styles.errorText}
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite"
                      >
                        Couldn&apos;t load your account details. Check your
                        connection and try again.
                      </Text>
                      <TouchableOpacity
                        onPress={() => void fetchPreview()}
                        style={styles.retryButton}
                        accessibilityRole="button"
                        accessibilityLabel="Try loading account details again"
                        activeOpacity={0.7}
                      >
                        <Text style={styles.retryText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.safeButton}
                    onPress={close}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Keep my account and go back"
                  >
                    <Text style={styles.safeButtonText}>Keep my account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quietDestructive,
                      !preview && styles.quietDisabled,
                    ]}
                    onPress={() => {
                      if (!preview) return;
                      setStep('password');
                      AccessibilityInfo.announceForAccessibility(
                        'Confirm it is you. Enter your password.',
                      );
                    }}
                    disabled={!preview}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the final confirmation"
                    accessibilityState={{ disabled: !preview }}
                  >
                    <Text style={styles.quietDestructiveText}>Continue</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 2 — password re-check (SEC §1) ── */}
              {step === 'password' && (
                <>
                  <Text style={styles.eyebrow}>CONFIRM IT&apos;S YOU</Text>
                  <Text style={styles.title} accessibilityRole="header">
                    Enter your password
                  </Text>
                  <Text style={styles.body}>
                    To protect your account, confirm your password before
                    deletion begins.
                  </Text>

                  {passwordError && (
                    <Text
                      style={styles.errorText}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                    >
                      {passwordError}
                    </Text>
                  )}

                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!verifying}
                    accessibilityLabel="Password"
                    onSubmitEditing={() => void handleVerifyPassword()}
                    returnKeyType="done"
                  />

                  <TouchableOpacity
                    style={[
                      styles.safeButton,
                      (!password || verifying) && styles.quietDisabled,
                    ]}
                    onPress={() => void handleVerifyPassword()}
                    disabled={!password || verifying}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Continue"
                    accessibilityState={{ disabled: !password || verifying, busy: verifying }}
                  >
                    {verifying ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <Text style={styles.safeButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quietDestructive}
                    onPress={close}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel="Keep my account and go back"
                  >
                    <Text style={styles.quietExitText}>Keep my account</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 3 — CONTENT §3, Shape 1 (type-DELETE) ── */}
              {step === 'confirm' && (
                <>
                  <Text style={[styles.eyebrow, styles.eyebrowFinal]}>
                    FINAL CONFIRMATION
                  </Text>
                  <Text style={styles.title} accessibilityRole="header">
                    This is the final step.
                  </Text>
                  <Text style={styles.body}>
                    Your account closes now, and the 30-day window begins. After
                    that, deletion is permanent.
                  </Text>
                  {showSoleLeaderBlock && (
                    <Text style={[styles.body, styles.bodyGap, styles.echoLine]}>
                      {soleLeaderEcho}
                    </Text>
                  )}

                  {deleteError && (
                    <Text
                      style={styles.errorText}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                    >
                      {deleteError}
                    </Text>
                  )}

                  {/* CONTENT §3 instruction — verbatim sentence case; the
                      capital DELETE inside is the copy's own emphasis. */}
                  <Text style={styles.confirmInstruction}>
                    Type DELETE to confirm.
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder={CONFIRM_WORD}
                    placeholderTextColor={Colors.textSubtle}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!deleting}
                    accessibilityLabel="Type DELETE to confirm"
                    accessibilityHint="Deletion stays disabled until you type DELETE in capital letters"
                  />
                  {confirmMismatch && (
                    <Text style={styles.mismatchHelper}>
                      Type DELETE in capital letters to continue.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.destructiveButton,
                      (confirmText !== CONFIRM_WORD || deleting) &&
                        styles.destructiveDisabled,
                    ]}
                    onPress={() => void handleDelete()}
                    disabled={confirmText !== CONFIRM_WORD || deleting}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Delete my account"
                    accessibilityState={{
                      disabled: confirmText !== CONFIRM_WORD || deleting,
                      busy: deleting,
                    }}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color={Colors.red} />
                    ) : (
                      <Text style={styles.destructiveButtonText}>
                        Delete my account
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quietDestructive}
                    onPress={close}
                    disabled={deleting}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel="Keep my account and go back"
                    accessibilityState={{ disabled: deleting }}
                  >
                    <Text style={styles.quietExitText}>Keep my account</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
  },
  avoidingView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    maxHeight: '86%',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.12)',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 25,
    elevation: 24,
  },
  cardContent: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(107, 181, 232, 0.7)',
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  eyebrowFinal: {
    color: 'rgba(224, 85, 85, 0.7)',
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.4,
    marginBottom: 12,
    textAlign: 'center',
  },
  lead: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 16,
    color: Colors.accent,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.1,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 14.5,
    color: 'rgba(240, 237, 230, 0.65)',
    lineHeight: 22,
  },
  bodyGap: {
    marginTop: 10,
  },
  emailInline: {
    color: Colors.accent,
  },
  echoLine: {
    color: Colors.text,
  },
  disclosureBlock: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 168, 85, 0.4)',
    backgroundColor: 'rgba(212, 168, 85, 0.08)',
  },
  disclosureText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  previewPendingRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.red,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 14,
  },
  retryButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  inputLabel: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  // §3 instruction keeps the copy's own casing (no uppercase transform).
  confirmInstruction: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.18)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(240, 237, 230, 0.04)',
  },
  mismatchHelper: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  safeButton: {
    marginTop: 22,
    borderWidth: 0.5,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
  },
  safeButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
    letterSpacing: 0.2,
  },
  quietDestructive: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quietDestructiveText: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 2.0,
    color: Colors.red,
    opacity: 0.75,
    textTransform: 'uppercase',
  },
  quietExitText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  quietDisabled: {
    opacity: 0.35,
  },
  destructiveButton: {
    marginTop: 22,
    borderWidth: 0.5,
    borderColor: 'rgba(224, 85, 85, 0.5)',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
  },
  destructiveDisabled: {
    opacity: 0.35,
  },
  destructiveButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.red,
    letterSpacing: 0.2,
  },
});
