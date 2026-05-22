// ─────────────────────────────────────────────
// Screen 03 — Account Setup Page 1
// Personal details. All validation inline, not on submit.
// Duplicate email check fires on Next tap (before navigating to Page 2).
// 12 roles — scrollable picker. No free text for "Other".
// Data held in OnboardingContext — nothing hits server until Page 2 submit.
//
// KAN-11 contract:
//   - Password policy: min 8, max 64, ≥1 number, ≥1 uppercase. Common-
//     password rejection is intentionally NOT enforced at MVP (AC #4).
//   - Email uniqueness via check-email-available edge function (10 req/hr
//     per IP). 200 + {available:false} = taken; 429 = rate-limited;
//     anything else = network/5xx + Next re-enabled for retry (AC #10-12).
//   - On success, navigate to AccountSetupPage2.
//
// KAN-196 (D-63, 2026-05-22): anonymous mode is now an inline toggle on
// this page, below the Country picker. Default false. The standalone
// AnonymousModeScreen is removed; the value flows through
// OnboardingContext.personalDetails.anonymous and lands in the
// create-account payload at the Page 2 submit.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { ROLES } from '../../utils/displayHelpers';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountSetupPage1'>;

const CHECK_EMAIL_URL = `${SUPABASE_URL}/functions/v1/check-email-available`;
const PASSWORD_MAX = 64;

// Password policy (KAN-11 AC #3):
//   - Min 8 chars
//   - At least 1 digit
//   - At least 1 uppercase ASCII letter
//   - Max 64 chars (hard cap; matches the maxLength prop on the input)
// AC #4 explicitly excludes common-password rejection at MVP.
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > PASSWORD_MAX) return `Password must be ${PASSWORD_MAX} characters or fewer`;
  if (!/\d/.test(pw)) return 'Password must include at least one number';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter';
  return null;
}

// Discriminated union — separates the three checkEmailAvailable failure
// modes so the Next button can stay disabled (taken / rate_limit) or
// re-enable for retry (network), per AC #10-12.
type EmailCheckError =
  | { kind: 'taken'; message: string }
  | { kind: 'rate_limit'; message: string }
  | { kind: 'network'; message: string }
  | null;

// Country list — abbreviated for MVP, full list to be injected from a data file
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Australia',
  'Austria', 'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Cameroon',
  'Canada', 'Chile', 'China', 'Colombia', 'Congo (DRC)', 'Cuba',
  'Dominican Republic', 'Ecuador', 'Egypt', 'Ethiopia', 'France', 'Germany',
  'Ghana', 'Guatemala', 'Haiti', 'Honduras', 'India', 'Indonesia', 'Iran',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
  'Kenya', 'South Korea', 'Lebanon', 'Liberia', 'Libya', 'Madagascar',
  'Malaysia', 'Mexico', 'Morocco', 'Mozambique', 'Myanmar', 'Nepal',
  'Netherlands', 'Nicaragua', 'Nigeria', 'North Korea', 'Pakistan',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal',
  'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Spain',
  'Sri Lanka', 'Sudan', 'Syria', 'Tanzania', 'Thailand', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Uganda', 'Ukraine', 'United Kingdom',
  'United States', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

export default function AccountSetupPage1Screen({ navigation }: Props) {
  const { state, setPersonalDetails } = useOnboarding();
  // B3 — initialize form state from OnboardingContext.personalDetails so
  // the back-button-and-re-entry path (e.g. CommonActions.reset from the
  // post-registration loopback) restores the leader's prior values
  // instead of presenting empty inputs. The context survives the screen
  // remount; useState defaults read from it on the initial render.
  // confirmPassword mirrors password because the context only stores
  // the validated password — confirm was already proven equal pre-Next.
  const pd = state.personalDetails;

  const [firstName, setFirstName] = useState(pd?.firstName ?? '');
  const [lastName, setLastName] = useState(pd?.lastName ?? '');
  const [email, setEmail] = useState(pd?.email ?? '');
  const [password, setPassword] = useState(pd?.password ?? '');
  const [confirmPassword, setConfirmPassword] = useState(pd?.password ?? '');
  const [role, setRole] = useState(pd?.role ?? '');
  const [country, setCountry] = useState(pd?.country ?? '');
  // KAN-196 (D-63) — anonymous mode is now an inline toggle on this page.
  // Default false; flows through OnboardingContext.personalDetails into
  // the create-account payload at Page 2 submit. The standalone
  // AnonymousModeScreen has been retired by this ticket.
  const [anonymous, setAnonymous] = useState<boolean>(pd?.anonymous ?? false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [emailCheckError, setEmailCheckError] = useState<EmailCheckError>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Network errors keep Next enabled (AC #12 retry). Taken + rate_limit
  // block Next (AC #10, #11).
  const blockingEmailError =
    emailCheckError !== null && emailCheckError.kind !== 'network';

  const isFormValid =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    password.length <= PASSWORD_MAX &&
    /\d/.test(password) &&
    /[A-Z]/.test(password) &&
    password === confirmPassword &&
    role &&
    country &&
    !blockingEmailError;

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setPasswordError(validatePassword(val));
    if (confirmPassword) {
      setConfirmError(val !== confirmPassword ? 'Passwords do not match' : null);
    }
  };

  const handleConfirmChange = (val: string) => {
    setConfirmPassword(val);
    setConfirmError(val !== password ? 'Passwords do not match' : null);
  };

  const handleNext = async () => {
    if (checkingEmail) return;
    setCheckingEmail(true);
    setEmailCheckError(null);

    const trimmedEmail = email.trim();

    try {
      const response = await fetch(CHECK_EMAIL_URL, {
        method: 'POST',
        headers: {
          // No Authorization header — verify_jwt=false on check-email-available
          // (user has no auth.users row yet). apikey is required for the
          // Supabase gateway to route the call.
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      // AC #11 — 10 req/hr per IP rate limit returns 429.
      if (response.status === 429) {
        setEmailCheckError({
          kind: 'rate_limit',
          message:
            'Too many attempts from this network. Please try again in a little while.',
        });
        return;
      }

      // AC #12 — anything else non-2xx is treated as network/5xx; Next
      // re-enables so the user can retry.
      if (!response.ok) {
        setEmailCheckError({
          kind: 'network',
          message: 'Something went wrong. Please check your connection and try again.',
        });
        return;
      }

      const body = (await response.json()) as { available?: boolean };

      if (body.available === false) {
        // AC #10 — inline error; Next disabled until the user changes email.
        setEmailCheckError({
          kind: 'taken',
          message: 'An account with this email already exists.',
        });
        return;
      }

      if (body.available !== true) {
        // Defensive: server returned 2xx but a shape we don't recognise.
        setEmailCheckError({
          kind: 'network',
          message: 'Something went wrong. Please try again.',
        });
        return;
      }

      // Email is available — persist and advance to Page 2.
      // KAN-196 — anonymous is carried inline (no longer a separate screen).
      setPersonalDetails({
        firstName,
        lastName,
        email: trimmedEmail,
        password,
        role,
        country,
        anonymous,
      });
      navigation.navigate('AccountSetupPage2');
    } catch {
      setEmailCheckError({
        kind: 'network',
        message: 'Something went wrong. Please check your connection and try again.',
      });
    } finally {
      setCheckingEmail(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepLabel}>ACCOUNT SETUP · 1 OF 2</Text>
        <Text style={styles.title}>Your Details</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name row */}
        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, emailCheckError ? styles.inputError : null]}
            value={email}
            onChangeText={t => {
              setEmail(t);
              // Only auto-clear the "taken" error on edit — rate-limit and
              // network errors should persist until the next Next-tap so
              // the user sees what blocked their last attempt.
              if (emailCheckError?.kind === 'taken') setEmailCheckError(null);
            }}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {emailCheckError && <Text style={styles.errorText}>{emailCheckError.message}</Text>}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            value={password}
            onChangeText={handlePasswordChange}
            placeholder="Min 8 chars · 1 uppercase · 1 number"
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry
            maxLength={PASSWORD_MAX}
          />
          {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
        </View>

        {/* Confirm Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, confirmError ? styles.inputError : null]}
            value={confirmPassword}
            onChangeText={handleConfirmChange}
            placeholder="Repeat your password"
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry
          />
          {confirmError && <Text style={styles.errorText}>{confirmError}</Text>}
        </View>

        {/* Role picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your Role</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setRolePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={role ? styles.pickerValue : styles.pickerPlaceholder}>
              {role ? ROLES.find(r => r.value === role)?.label : 'Select your role'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Country picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setCountryPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={country ? styles.pickerValue : styles.pickerPlaceholder}>
              {country || 'Select your country'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* KAN-196 (D-63) — Anonymous Mode inline toggle. Default OFF.
            Wires into OnboardingContext.personalDetails.anonymous; lands
            in create-account payload at Page 2 submit. Replaces the
            standalone AnonymousModeScreen (removed by this ticket). */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextGroup}>
            <Text style={styles.label}>Anonymous Mode</Text>
            <Text style={styles.fieldNote}>
              Hide your name from the network. Other leaders will see your role and church, but not your name. You can change this in Settings.
            </Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: Colors.border, true: Colors.accent }}
            thumbColor={Colors.text}
            ios_backgroundColor={Colors.surface}
          />
        </View>

        {/* KAN-196 addendum + finalization fix 1 — live identity preview.
            Role-first format (space-separated from the name):
              OFF + firstName     → "Role Name · Your Church"
              OFF + no firstName  → "Role · Your Church"
              ON                  → "Role · Your Church" (name suppressed)
            Hidden until at least one of firstName/role has a value so
            a fresh screen doesn't render an empty placeholder block. */}
        {(firstName.trim() || role) && (
          <View style={styles.identityPreview}>
            <Text style={styles.identityPreviewLabel}>HOW YOU'LL APPEAR</Text>
            <Text style={styles.identityPreviewText} numberOfLines={1}>
              {(() => {
                const roleLabel = ROLES.find(r => r.value === role)?.label ?? 'Your Role';
                if (anonymous) return `${roleLabel} · Your Church`;
                const name = firstName.trim();
                return name
                  ? `${roleLabel} ${name} · Your Church`
                  : `${roleLabel} · Your Church`;
              })()}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Next button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !isFormValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isFormValid || checkingEmail}
          activeOpacity={0.8}
        >
          {checkingEmail ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[styles.nextButtonText, !isFormValid && styles.nextButtonTextDisabled]}>
              Next
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Role Picker Modal — 12 items, scrollable, min 44pt targets */}
      <Modal visible={rolePickerVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your Role</Text>
              <TouchableOpacity onPress={() => setRolePickerVisible(false)}>
                <Text style={styles.sheetClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={ROLES}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    role === item.value && styles.sheetItemSelected,
                  ]}
                  onPress={() => {
                    setRole(item.value);
                    setRolePickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sheetItemText,
                    role === item.value && styles.sheetItemTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {role === item.value && (
                    <Text style={styles.sheetItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Country Picker Modal — searchable full list */}
      <Modal visible={countryPickerVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Country</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <Text style={styles.sheetClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries..."
              placeholderTextColor={Colors.textSubtle}
              autoCorrect={false}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    country === item && styles.sheetItemSelected,
                  ]}
                  onPress={() => {
                    setCountry(item);
                    setCountryPickerVisible(false);
                    setCountrySearch('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sheetItemText,
                    country === item && styles.sheetItemTextSelected,
                  ]}>
                    {item}
                  </Text>
                  {country === item && (
                    <Text style={styles.sheetItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },

  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  fieldGroup: {
    gap: Spacing.xs,
  },

  // KAN-196 — Anonymous Mode toggle row. Two-column layout: explanatory
  // text takes the available space, Switch sits at the right edge,
  // vertically top-aligned so the toggle anchors to the label line
  // even when the note wraps to two lines.
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toggleTextGroup: {
    flex: 1,
    gap: Spacing.xs,
  },
  fieldNote: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    lineHeight: 18,
  },

  // KAN-196 addendum — identity preview card. Sky-tinted block beneath
  // the anonymous toggle that previews the leader's appearance on
  // other leaders' surfaces. Updates live as firstName / role /
  // anonymous change.
  identityPreview: {
    backgroundColor: 'rgba(107, 181, 232, 0.05)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  identityPreviewLabel: {
    fontFamily: Typography.body,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.accent,
  },
  identityPreviewText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },

  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },

  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  inputError: {
    borderColor: Colors.red,
  },

  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    marginTop: 2,
  },

  pickerButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  pickerValue: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  pickerPlaceholder: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textSubtle,
  },
  pickerChevron: {
    fontFamily: Typography.body,
    fontSize: 18,
    color: Colors.textMuted,
  },

  bottomSpacer: { height: Spacing.xxxl },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  nextButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(107, 181, 232, 0.2)',
  },
  nextButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
  nextButtonTextDisabled: {
    color: 'rgba(107, 181, 232, 0.4)',
  },

  // Sheet (role + country pickers)
  sheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    fontFamily: Typography.display,
    fontSize: 20,
    color: Colors.text,
  },
  sheetClose: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  sheetItem: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14, // comfortably above 44pt
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetItemSelected: {
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
  },
  sheetItemText: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  sheetItemTextSelected: {
    color: Colors.accent,
    fontFamily: Typography.bodyMedium,
  },
  sheetItemCheck: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.accent,
  },
});
