// ─────────────────────────────────────────────
// Screen 06B — Set New Password (KAN-38)
//
// Three states (single component, viewState drives the UI):
//   - 'form'    — deep-link banner countdown + two password fields + rules
//   - 'success' — "Password updated" with Sign In button
//   - 'expired' — "Link expired" with Request a new link button
//
// Mounted by RootNavigator when AuthProvider's branch flips to
// "password_recovery" (the PASSWORD_RECOVERY auth event is interpreted by
// AuthProvider's onAuthStateChange handler — see contexts/AuthProvider.tsx).
//
// No navigation prop — this screen sits inside the RootNavigator's
// conditional branch, NOT inside OnboardingNavigator. Uses useAuth() to
// get the recovery session + clearPasswordRecovery (which clears the
// session and bounces the leader back to the unauthenticated branch).
//
// Countdown source: session.expires_at (Unix seconds). When it hits 0
// (or updateUser returns an error), viewState flips to 'expired'.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import RpMark from '../../components/icons/RpMark';

const TAGLINE = 'The Church, Connected';
const TITLE_FORM = 'Set a new password';
const SUB_FORM = `Choose a password you haven't used before.`;
const TITLE_SUCCESS = 'Password updated';
const SUB_SUCCESS = `Your password has been changed.\nSign in with your new password to continue.`;
const TITLE_EXPIRED = 'Link expired';
const SUB_EXPIRED = `This reset link has expired or has already been used.\nReset links are valid for one hour.`;
const FOOTNOTE_FORM = `Updating your password will sign\nyou out of all other devices`;
const FOOTNOTE_SUCCESS = `All other sessions have been\nsigned out for your security`;
const FOOTNOTE_EXPIRED = `For your security, links can\nonly be used once`;

type ViewState = 'form' | 'success' | 'expired';

// Password rules — live-validated as the leader types.
const meetsMinLength = (pw: string) => pw.length >= 8;
const containsNumber = (pw: string) => /\d/.test(pw);
const containsUppercase = (pw: string) => /[A-Z]/.test(pw);

export default function SetNewPasswordScreen() {
  const { session, clearPasswordRecovery } = useAuth();

  const [viewState, setViewState] = useState<ViewState>('form');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newVisible, setNewVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  // Countdown — derived from session.expires_at (Unix seconds). On every
  // tick we recompute remaining; if it hits 0 we flip to 'expired'.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.expires_at) return;
    const tick = () => {
      const remaining = (session.expires_at ?? 0) - Math.floor(Date.now() / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        setViewState((prev) => (prev === 'form' ? 'expired' : prev));
        return;
      }
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const countdownLabel =
    secondsLeft != null
      ? `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
      : '--:--';

  // Password rule evaluation.
  const ruleLength = meetsMinLength(newPassword);
  const ruleNumber = containsNumber(newPassword);
  const ruleUpper = containsUppercase(newPassword);
  const allRulesMet = ruleLength && ruleNumber && ruleUpper;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = allRulesMet && passwordsMatch && !loading;

  const handleSetPassword = async () => {
    if (!canSubmit) return;
    if (inFlight.current) return;
    setLoading(true);
    inFlight.current = true;
    let succeeded = false;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        // Token expired / invalid / signed out — all flip us to 'expired'.
        console.warn('[SetNewPasswordScreen] updateUser returned error:', error.status, error.message);
        setViewState('expired');
      } else {
        succeeded = true;
        setViewState('success');
      }
    } catch (err) {
      console.warn('[SetNewPasswordScreen] updateUser threw:', err);
      setViewState('expired');
    } finally {
      setLoading(false);
      inFlight.current = false;
      // Mask both password fields on submit — shoulder-surf guard.
      setNewVisible(false);
      setConfirmVisible(false);
      // succeeded === true: viewState already set to 'success' above.
      void succeeded;
    }
  };

  const handleSignInFromSuccess = async () => {
    // Branch flip to unauthenticated — RootNavigator mounts Onboarding
    // (Splash → user taps Sign In → Login). The leader signs in with
    // the new password they just set.
    await clearPasswordRecovery();
  };

  const handleRequestNewLink = async () => {
    // Same path as above — clears the recovery session and returns to
    // Login. From there the leader taps "Forgot password?" again to
    // start a fresh request.
    await clearPasswordRecovery();
  };

  // ── Shared logo block (form variant uses smaller mark, no tagline) ─
  const renderLogoBlock = (variant: 'tight' | 'full') => (
    <View style={styles.logoBlock}>
      <RpMark size={variant === 'tight' ? 44 : 90} />
      <Text
        style={[
          styles.wordmark,
          variant === 'tight' && styles.wordmarkTight,
        ]}
      >
        REPLANT
      </Text>
      {variant === 'full' && <Text style={styles.tagline}>{TAGLINE}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Deep-link banner — only on form state; carries the countdown */}
        {viewState === 'form' && (
          <View
            style={styles.deeplinkBanner}
            accessibilityLabel={`Secure link, expires in ${countdownLabel}`}
          >
            <Text style={styles.deeplinkText}>
              Secure link · expires in {countdownLabel}
            </Text>
          </View>
        )}

        <View style={styles.mainContent}>
          {/* Logo block — tight variant on form (smaller mark, no tagline) */}
          {viewState === 'form'
            ? renderLogoBlock('tight')
            : renderLogoBlock('full')}

          {/* Hairline rule above the title on success/expired states.
              Sky on success, amber on expired. */}
          {viewState === 'success' && <View style={styles.serifRule} />}
          {viewState === 'expired' && (
            <View style={[styles.serifRule, styles.serifRuleWarn]} />
          )}

          <Text style={styles.stateTitle}>
            {viewState === 'form'
              ? TITLE_FORM
              : viewState === 'success'
                ? TITLE_SUCCESS
                : TITLE_EXPIRED}
          </Text>
          <Text style={styles.stateSub}>
            {viewState === 'form'
              ? SUB_FORM
              : viewState === 'success'
                ? SUB_SUCCESS
                : SUB_EXPIRED}
          </Text>

          {viewState === 'form' && (
            <>
              <View style={styles.fields}>
                {/* NEW PASSWORD */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                  <View
                    style={[
                      styles.fieldInputRow,
                      newFocused && styles.fieldInputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.passwordInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setNewFocused(true)}
                      onBlur={() => setNewFocused(false)}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textSubtle}
                      secureTextEntry={!newVisible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password-new"
                      textContentType="newPassword"
                      returnKeyType="next"
                      accessibilityLabel="New password"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setNewVisible((v) => !v)}
                      style={styles.eyeToggle}
                      accessibilityRole="button"
                      accessibilityLabel={newVisible ? 'Hide new password' : 'Show new password'}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.eyeText}>{newVisible ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Live-validated rules — small filled dot when met. */}
                  <View style={styles.passwordRules}>
                    <PasswordRule met={ruleLength} label="At least 8 characters" />
                    <PasswordRule met={ruleNumber} label="At least 1 number" />
                    <PasswordRule met={ruleUpper} label="At least 1 uppercase letter" />
                  </View>
                </View>

                {/* CONFIRM PASSWORD */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                  <View
                    style={[
                      styles.fieldInputRow,
                      confirmFocused && styles.fieldInputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.passwordInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setConfirmFocused(true)}
                      onBlur={() => setConfirmFocused(false)}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textSubtle}
                      secureTextEntry={!confirmVisible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password-new"
                      textContentType="newPassword"
                      returnKeyType="go"
                      onSubmitEditing={handleSetPassword}
                      accessibilityLabel="Confirm password"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setConfirmVisible((v) => !v)}
                      style={styles.eyeToggle}
                      accessibilityRole="button"
                      accessibilityLabel={confirmVisible ? 'Hide confirm password' : 'Show confirm password'}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.eyeText}>{confirmVisible ? 'HIDE' : 'SHOW'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!canSubmit || loading) && styles.submitButtonDisabled,
                ]}
                onPress={handleSetPassword}
                disabled={!canSubmit || loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Set password"
                accessibilityState={{ disabled: !canSubmit || loading, busy: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      (!canSubmit || loading) && styles.submitButtonTextDisabled,
                    ]}
                  >
                    Set Password
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {viewState === 'success' && (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSignInFromSuccess}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <Text style={styles.submitButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}

          {viewState === 'expired' && (
            <>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRequestNewLink}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Request a new link"
              >
                <Text style={styles.submitButtonText}>Request a new link</Text>
              </TouchableOpacity>
              <View style={styles.linksRow}>
                <TouchableOpacity
                  onPress={handleRequestNewLink}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="Back to sign in"
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.link}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Footnote zone — hairline divider + state-appropriate copy */}
        <View style={styles.footnoteZone}>
          <View style={styles.footnoteDivider} />
          <Text style={styles.footnote}>
            {viewState === 'form'
              ? FOOTNOTE_FORM
              : viewState === 'success'
                ? FOOTNOTE_SUCCESS
                : FOOTNOTE_EXPIRED}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Inline password-rule indicator ───
function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.passwordRuleRow}>
      <View
        style={[
          styles.passwordRuleDot,
          met && styles.passwordRuleDotMet,
        ]}
      />
      <Text
        style={[
          styles.passwordRuleLabel,
          met && styles.passwordRuleLabelMet,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },

  // Deep-link banner — sits at the top of the form state. Sky-tinted box
  // with mono copy + a live countdown.
  deeplinkBanner: {
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(107, 181, 232, 0.30)',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  deeplinkText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // Logo block — full variant matches Splash; tight is smaller for form state.
  logoBlock: {
    alignItems: 'center',
    marginTop: 0,
    gap: 12,
    marginBottom: Spacing.xl,
  },
  wordmark: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.18 * 28,
    marginTop: 6,
  },
  wordmarkTight: {
    fontSize: 20,
    letterSpacing: 0.18 * 20,
    marginTop: 4,
  },
  tagline: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 0.2 * 12,
    color: Colors.accent,
    textTransform: 'uppercase',
  },

  // 36px hairline above success/expired titles. Sky by default; amber via
  // serifRuleWarn override on the expired state.
  serifRule: {
    width: 36,
    height: 0.5,
    backgroundColor: 'rgba(240, 237, 230, 0.25)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  serifRuleWarn: {
    backgroundColor: 'rgba(212, 168, 85, 0.55)',
  },

  stateTitle: {
    fontFamily: Typography.display,
    fontSize: 24,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  stateSub: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 14 * 1.55,
    marginBottom: Spacing.xl,
  },

  // Fields share LoginScreen's auth-base shape.
  fields: { gap: Spacing.md },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.18 * 8.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.18)',
    borderRadius: 4,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  fieldInputFocused: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(107, 181, 232, 0.04)',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: 'transparent',
  },
  eyeToggle: {
    paddingLeft: 10,
    paddingVertical: 4,
  },
  eyeText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },

  // Password rules — small dot + label, dot fills sky when rule met.
  passwordRules: {
    marginTop: 8,
    gap: 4,
  },
  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordRuleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(240, 237, 230, 0.30)',
  },
  passwordRuleDotMet: {
    backgroundColor: Colors.accent,
  },
  passwordRuleLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  passwordRuleLabelMet: {
    color: Colors.text,
  },

  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(107, 181, 232, 0.4)',
  },
  submitButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
  submitButtonTextDisabled: {
    color: 'rgba(8, 8, 8, 0.7)',
  },

  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: 16,
  },
  link: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.accent,
  },

  footnoteZone: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footnoteDivider: {
    width: 32,
    height: 0.5,
    backgroundColor: 'rgba(240, 237, 230, 0.15)',
    marginBottom: Spacing.md,
  },
  footnote: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: 'rgba(240, 237, 230, 0.30)',
    textAlign: 'center',
    letterSpacing: 0.14 * 10,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
});
