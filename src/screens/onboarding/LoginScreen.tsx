// ─────────────────────────────────────────────
// Screen 06 — Login (KAN-38)
//
// Returning-user sign-in. Calls supabase.auth.signInWithPassword and
// releases — AuthProvider's onAuthStateChange (src/contexts/AuthProvider.tsx
// line 204) then runs auth-status-check and flips the RootNavigator
// branch (active / pending / deactivated). This screen never navigates
// after a successful credential check.
//
// Anti-enumeration: invalid email and invalid password share the same
// copy ("Incorrect email or password.") — a leader cannot probe whether
// an email is registered by attempting a login.
//
// SEC-relevant invariants:
//   - secureTextEntry default on; SHOW/HIDE toggle resets to masked on
//     submit so a glance over the shoulder after tap doesn't leak the
//     password.
//   - inFlight ref + loading state gate concurrent submits; rapid taps
//     do not fire multiple signInWithPassword calls.
//   - autoComplete="email" / "password" hooks into platform password
//     managers without requiring our own credential persistence.
//
// Out of scope (per dispatch):
//   - Forgot password (Screen 06A) — Alert + TODO
//   - Deactivation modal — KAN-36 v2 surfaces deactivation as a top-
//     level overlay (src/components/auth/DeactivationModal.tsx) rendered
//     from App.tsx, not as anything this screen owns. AuthProvider
//     sets the modal path AND calls signOut on detection, so this
//     screen sits underneath the modal once it appears.
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
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import RpMark from '../../components/icons/RpMark';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Login'>;

// Static copy — exact strings from KAN-38 dispatch + Screen 06 wireframe.
const TAGLINE = 'The Church, Connected';
const FOOTNOTE = `By signing in you affirm Replant's\nDeclaration of Faith`;

// Error copy table — anti-enumeration: invalid email vs invalid password
// both surface the same generic credential message.
const ERROR_INVALID_CREDS = 'Incorrect email or password.';
const ERROR_NO_NETWORK = 'No connection. Check your internet and try again.';
const ERROR_RATE_LIMITED = 'Too many attempts. Please wait a few minutes and try again.';
const ERROR_GENERIC = 'Something went wrong. Please try again.';

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Single-flight gate — ref so concurrent taps don't re-trigger
  // signInWithPassword before the first response lands. Distinct from
  // `loading` state which drives the button spinner.
  const inFlight = useRef(false);

  // Focus management — email submit → focus password → submit → sign in.
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (loginError) setLoginError(null);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (loginError) setLoginError(null);
  };

  const handleSignIn = async () => {
    if (!canSubmit) return;
    if (inFlight.current) return;

    setLoginError(null);
    setPasswordVisible(false); // mask on submit — shoulder-surf guard
    setLoading(true);
    inFlight.current = true;

    // Track success separately from the finally block: on success the
    // screen unmounts via AuthProvider branch flip, so we MUST NOT
    // setState in finally on that path (state-on-unmounted-component
    // warning + a no-op anyway).
    let succeeded = false;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Map Supabase auth errors to the user-facing copy.
        // Supabase returns 'Invalid login credentials' for both unknown
        // email AND wrong password — that's the anti-enumeration source
        // of truth, and we surface the same string regardless.
        if (error.status === 429) {
          setLoginError(ERROR_RATE_LIMITED);
        } else if (
          error.status === 0 ||
          error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('failed to fetch')
        ) {
          setLoginError(ERROR_NO_NETWORK);
        } else if (
          error.message?.toLowerCase().includes('invalid login') ||
          error.message?.toLowerCase().includes('invalid_credentials') ||
          error.message?.toLowerCase().includes('email not confirmed')
        ) {
          setLoginError(ERROR_INVALID_CREDS);
        } else {
          // Unknown auth error — surface as generic so we don't leak
          // implementation detail. Console-log for ops triage.
          console.warn('[LoginScreen] unexpected auth error:', error.status, error.message);
          setLoginError(ERROR_GENERIC);
        }
      } else {
        // Credentials valid. AuthProvider's onAuthStateChange will fire
        // next tick, hit auth-status-check, and set the branch. Root-
        // Navigator unmounts this screen the moment the branch flips
        // out of "unauthenticated".
        succeeded = true;
      }
    } catch {
      // Thrown errors here are network failures (fetch threw) — Supabase
      // SDK normally wraps these in the `error` field above, but defensive.
      setLoginError(ERROR_NO_NETWORK);
    } finally {
      if (!succeeded) {
        setLoading(false);
        inFlight.current = false;
      }
      // succeeded === true: leave both flags as-is. The screen is about
      // to unmount via the branch flip; setting state here would warn.
    }

    // Accessibility announcement is handled by the error banner's
    // accessibilityLiveRegion="polite" + accessibilityRole="alert" — the
    // banner narrates itself when it appears. No explicit announce call
    // needed here (and explicit calls here would read stale closure state).
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleCreateAccount = () => {
    navigation.navigate('DeclarationOfFaith');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top-left back chevron — returns to Splash */}
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Back"
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main content — flex:1 + justifyContent:'center' so the logo +
            fields + button + links cluster vertically center in whatever
            space remains above the footnote zone. */}
        <View style={styles.mainContent}>
        {/* Logo block — rp-mark + wordmark + tagline */}
        <View style={styles.logoBlock}>
          <RpMark size={90} />
          <Text style={styles.wordmark}>REPLANT</Text>
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>

        {/* Error banner — appears above fields when loginError is set */}
        {loginError && (
          <View
            style={styles.errorBanner}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.errorText}>{loginError}</Text>
          </View>
        )}

        {/* Fields */}
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={[
                styles.fieldInput,
                emailFocused && styles.fieldInputFocused,
              ]}
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email address"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View
              style={[
                styles.fieldInputRow,
                passwordFocused && styles.fieldInputFocused,
              ]}
            >
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={handlePasswordChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSubtle}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
                accessibilityLabel="Password"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((v) => !v)}
                style={styles.eyeToggle}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.eyeText}>{passwordVisible ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sign In button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit || loading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSignIn}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
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
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Links row — Create account · Forgot password? */}
        <View style={styles.linksRow}>
          <TouchableOpacity
            onPress={handleCreateAccount}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.link}>Create account</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}>·</Text>
          <TouchableOpacity
            onPress={handleForgotPassword}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        </View>
        {/* /mainContent — footnote zone below sits at the bottom because
            mainContent's flex:1 swallows the remaining vertical space. */}

        {/* Footnote zone — hairline divider + Declaration affirmation */}
        <View style={styles.footnoteZone}>
          <View style={styles.footnoteDivider} />
          <Text style={styles.footnote}>{FOOTNOTE}</Text>
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

  // Back chevron — absolute-positioned top-left so the form layout stays clean.
  backButton: {
    position: 'absolute',
    top: 52,
    left: 24,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: 28,
    color: Colors.textMuted,
    lineHeight: 28,
  },

  scroll: { flex: 1 },
  // flexGrow:1 lets the inner mainContent fill the available height so
  // its justifyContent:'center' actually centers vertically. paddingTop
  // is 0 — the centering provides the vertical math itself.
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },

  // Main content wrapper — fills space above footnote, vertically centers
  // its children (logo cluster + error banner + fields + button + links).
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // Logo block — auth-base pattern shared with other entry screens.
  // marginTop:0 because mainContent's justifyContent:'center' provides
  // the centering — no fixed top offset needed.
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

  // Error banner — appears above fields. Anti-enumeration generic copy.
  errorBanner: {
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(224, 85, 85, 0.4)',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Fields — EMAIL + PASSWORD with shared label + input styling.
  fields: {
    gap: Spacing.md,
  },
  field: {
    gap: 6,
  },
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
    // RN doesn't natively support box-shadow; using a subtle tint as the
    // closest visual approximation of the design's rgba(107,181,232,0.15) glow.
    backgroundColor: 'rgba(107, 181, 232, 0.04)',
  },

  // Password field — TextInput + SHOW/HIDE toggle share the bordered row.
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.18)',
    borderRadius: 4,
    paddingHorizontal: 12,
    minHeight: 44,
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

  // Sign In button — accent fill, dark text, full width. Disabled goes
  // to a muted accent so the button still reads as the primary action.
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

  // Links row — Create account · Forgot password?
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
  linkSeparator: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Footnote zone — divider + affirmation copy.
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
