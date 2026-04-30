// ─────────────────────────────────────────────
// Screen 03 — Account Setup Page 1
// Personal details. All validation inline, not on submit.
// Duplicate email check fires on Next tap (before Page 2).
// 12 roles — scrollable picker. No free text for "Other".
// Data held in OnboardingContext — nothing hits server until Page 2 submit.
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { ROLES } from '../../utils/displayHelpers';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountSetupPage1'>;

// Password: min 8 chars, must include at least one number
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/\d/.test(pw)) return 'Password must include at least one number';
  return null;
}

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
  const { setPersonalDetails } = useOnboarding();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [country, setCountry] = useState('');

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const isFormValid =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    password.length >= 8 &&
    /\d/.test(password) &&
    password === confirmPassword &&
    role &&
    country &&
    !emailError;

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
    // Duplicate email check fires here — before advancing to Page 2
    // → BE: calls Supabase to check email uniqueness
    // Stubbed at MVP — wire to BE edge function when ready
    setCheckingEmail(true);
    try {
      // TODO → BE: replace stub with real uniqueness check
      await new Promise(r => setTimeout(r, 500));
      const emailTaken = false; // stub

      if (emailTaken) {
        setEmailError('An account with this email already exists.');
        return;
      }

      setPersonalDetails({ firstName, lastName, email, password, role, country });
      navigation.navigate('AccountSetupPage2');
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
            style={[styles.input, emailError ? styles.inputError : null]}
            value={email}
            onChangeText={t => { setEmail(t); setEmailError(null); }}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {emailError && <Text style={styles.errorText}>{emailError}</Text>}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            value={password}
            onChangeText={handlePasswordChange}
            placeholder="Min 8 characters, include a number"
            placeholderTextColor={Colors.textSubtle}
            secureTextEntry
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
