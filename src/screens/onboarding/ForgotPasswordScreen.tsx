// ─────────────────────────────────────────────
// Screen 06A — Forgot Password (KAN-38)
//
// Two states (single component, viewState drives the UI):
//   - 'form'    — email input + Send Reset Link
//   - 'success' — "Check your email" with a 36px sky hairline
//
// Anti-enumeration: the success state is shown REGARDLESS of whether
// the email is registered, and regardless of whether the underlying
// supabase.auth.resetPasswordForEmail call returned an error. A leader
// cannot probe whether an address is in the system by attempting a
// reset. Errors are swallowed (logged to console.warn for ops only).
//
// Deep-link target: `replant://reset-password`. Supabase puts that into
// the reset email; when the leader taps it, supabase-js exchanges the
// token in the URL fragment and AuthProvider's onAuthStateChange fires
// PASSWORD_RECOVERY → branch flips to password_recovery → RootNavigator
// mounts SetNewPasswordScreen (Screen 06B).
// ─────────────────────────────────────────────

import React, { useRef, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import RpMark from '../../components/icons/RpMark';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ForgotPassword'>;

const TAGLINE = 'The Church, Connected';
const FOOTNOTE_FORM = 'Reset links expire after 1 hour';
const FOOTNOTE_SUCCESS = `Didn't receive it? Check spam,\nthen request again`;
const TITLE_FORM = 'Reset your password';
const SUB_FORM = `Enter the email tied to your account.\nWe'll send a link to set a new password.`;
const TITLE_SUCCESS = 'Check your email';
const SUB_SUCCESS = `If an account exists for that address,\na reset link is on its way.\nThe link expires in one hour.`;

// Basic email shape — same regex used by register-church + check-email-available.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deep-link target: the app's `replant://` scheme + `reset-password` host.
// supabase will put this in the email body; tapping it opens the app and
// supabase-js exchanges the token in the URL fragment.
const RESET_REDIRECT_URL = 'replant://reset-password';

type ViewState = 'form' | 'success';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [viewState, setViewState] = useState<ViewState>('form');
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const trimmedEmail = email.trim();
  const isValidEmail = EMAIL_REGEX.test(trimmedEmail);
  const canSubmit = isValidEmail && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (inFlight.current) return;
    setLoading(true);
    inFlight.current = true;

    try {
      // Anti-enumeration: regardless of return shape (success OR error —
      // unknown email, rate limit, network blip — anything), we land on
      // the same "Check your email" success view. Errors are logged at
      // warn for ops only.
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: RESET_REDIRECT_URL,
      });
      if (error) {
        console.warn('[ForgotPasswordScreen] resetPasswordForEmail returned error (silenced for anti-enumeration):', error.status, error.message);
      }
    } catch (err) {
      // Network errors are swallowed too — anti-enumeration. Logged only.
      console.warn('[ForgotPasswordScreen] resetPasswordForEmail threw (silenced for anti-enumeration):', err);
    } finally {
      setLoading(false);
      inFlight.current = false;
      setViewState('success');
    }
  };

  const handleBackToSignIn = () => {
    // From either state — replace, so a back gesture doesn't return into
    // the success confirmation.
    navigation.navigate('Login');
  };

  // ── Shared logo block ─────────────────────────────────────────────
  const renderLogoBlock = () => (
    <View style={styles.logoBlock}>
      <RpMark size={90} />
      <Text style={styles.wordmark}>REPLANT</Text>
      <Text style={styles.tagline}>{TAGLINE}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top-left back chevron (form only — success has a single link below) */}
      {viewState === 'form' && (
        <TouchableOpacity
          onPress={handleBackToSignIn}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹  Back to sign in</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {renderLogoBlock()}

          {/* Success state has a 36px hairline above the title */}
          {viewState === 'success' && <View style={styles.serifRule} />}

          <Text style={styles.stateTitle}>
            {viewState === 'form' ? TITLE_FORM : TITLE_SUCCESS}
          </Text>
          <Text style={styles.stateSub}>
            {viewState === 'form' ? SUB_FORM : SUB_SUCCESS}
          </Text>

          {viewState === 'form' && (
            <>
              <View style={styles.fields}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>EMAIL</Text>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      emailFocused && styles.fieldInputFocused,
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.textSubtle}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    accessibilityLabel="Email address"
                    editable={!loading}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!canSubmit || loading) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send reset link"
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
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.linksRow}>
                <TouchableOpacity
                  onPress={handleBackToSignIn}
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

          {viewState === 'success' && (
            <View style={styles.linksRow}>
              <TouchableOpacity
                onPress={handleBackToSignIn}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.link}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footnote zone — hairline divider + state-appropriate copy */}
        <View style={styles.footnoteZone}>
          <View style={styles.footnoteDivider} />
          <Text style={styles.footnote}>
            {viewState === 'form' ? FOOTNOTE_FORM : FOOTNOTE_SUCCESS}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  backRow: {
    position: 'absolute',
    top: 52,
    left: 24,
    zIndex: 10,
    paddingVertical: 4,
  },
  backText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },

  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },

  logoBlock: {
    alignItems: 'center',
    marginTop: 0,
    gap: 12,
    marginBottom: Spacing.xxl,
  },
  wordmark: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.18 * 28,
    marginTop: 6,
  },
  tagline: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 0.2 * 12,
    color: Colors.accent,
    textTransform: 'uppercase',
  },

  // 36px sky hairline above the success-state title.
  serifRule: {
    width: 36,
    height: 0.5,
    backgroundColor: 'rgba(240, 237, 230, 0.25)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },

  // State title (Cormorant Garamond — same display family as Splash + Settings).
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

  fields: { gap: Spacing.md },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.18 * 8.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  fieldInput: {
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.18)',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  fieldInputFocused: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(107, 181, 232, 0.04)',
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
