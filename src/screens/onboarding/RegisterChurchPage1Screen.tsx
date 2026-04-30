// ─────────────────────────────────────────────
// Screen 05 — Register Church, Page 1
// Church details. Underground type hides location fields immediately on selection.
// "Church Branch" displays in UI — stored as `branch` per SPEC.
// RAG defaults to Red for Underground, any value permitted.
// Screen 10 (map pin) is next for non-Underground types — gated on MAP wiring.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { CHURCH_TYPES, RAG_OPTIONS } from '../../utils/displayHelpers';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RegisterChurchPage1'>;

const IS_UNDERGROUND = (type: string) => type === 'underground';

export default function RegisterChurchPage1Screen({ navigation }: Props) {
  const { setChurchDetails } = useOnboarding();

  const [churchName, setChurchName] = useState('');
  const [churchType, setChurchType] = useState('');
  const [country, setCountry] = useState('');
  const [cityRegion, setCityRegion] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [ragStatus, setRagStatus] = useState('');

  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const isUnderground = IS_UNDERGROUND(churchType);

  // When Underground is selected, default RAG to red
  const handleTypeSelect = (type: string) => {
    setChurchType(type);
    setTypePickerVisible(false);
    if (type === 'underground' && !ragStatus) {
      setRagStatus('red');
    }
    // Clear location fields when switching to underground
    if (type === 'underground') {
      setCityRegion('');
      setAddress('');
    }
  };

  const isFormValid =
    churchName.trim() &&
    churchType &&
    country &&
    (isUnderground || cityRegion.trim()) &&
    contactEmail.trim() &&
    ragStatus;

  const handleNext = () => {
    setChurchDetails({
      churchName,
      churchType,
      country,
      cityRegion: isUnderground ? undefined : cityRegion,
      address: isUnderground ? undefined : address,
      contactEmail,
      contactPhone,
      ragStatus,
    });

    if (isUnderground) {
      // Underground → skip map screen, go directly to submission
      // TODO: navigate to confirmation/submission screen when built
      navigation.goBack(); // temporary — replace with submission nav
    } else {
      // Non-underground → Screen 10 (MapPinSelector) — gated on MAP wiring
      // TODO: navigation.navigate('RegisterChurchPage2') when Screen 10 is ready
      navigation.goBack(); // temporary — replace with Screen 10 nav
    }
  };

  // Countries abbreviated — full list same as Page 1
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

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>REGISTER CHURCH · 1 OF 2</Text>
        <Text style={styles.title}>Church Details</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Church Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Church Name</Text>
          {isUnderground && (
            <Text style={styles.fieldNote}>
              Your church name will be kept private. It will display as "Underground Church" to other users.
            </Text>
          )}
          <TextInput
            style={styles.input}
            value={churchName}
            onChangeText={setChurchName}
            placeholder="Enter church name"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
          />
        </View>

        {/* Church Type */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Church Type</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setTypePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={churchType ? styles.pickerValue : styles.pickerPlaceholder}>
              {churchType
                ? CHURCH_TYPES.find(t => t.value === churchType)?.label
                : 'Select church type'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>

          {/* Underground inline notice */}
          {isUnderground && (
            <View style={styles.undergroundNotice}>
              <Text style={styles.undergroundNoticeText}>
                Location fields are disabled for underground churches. Your church will not appear
                on the map. Your name will display as "Underground Church" to protect your identity.
              </Text>
            </View>
          )}
        </View>

        {/* Country */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setCountryPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={country ? styles.pickerValue : styles.pickerPlaceholder}>
              {country || 'Select country'}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* City / Region — hidden for Underground */}
        {!isUnderground && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>City / Region</Text>
            <TextInput
              style={styles.input}
              value={cityRegion}
              onChangeText={setCityRegion}
              placeholder="General area (not exact address)"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
        )}

        {/* Address — optional, hidden for Underground */}
        {!isUnderground && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Address <Text style={styles.optionalTag}>(Optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Full street address"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
        )}

        {/* Contact Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contact Email</Text>
          <Text style={styles.fieldNote}>
            Used by the Replant team for verification. Retained securely after verification.
          </Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="church@example.com"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Contact Phone — optional */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Contact Phone <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+1 000 000 0000"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="phone-pad"
          />
        </View>

        {/* RAG Status */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current Status</Text>
          <Text style={styles.fieldNote}>
            Self-declaration. You can update this at any time from Settings.
          </Text>
          <View style={styles.ragOptions}>
            {RAG_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.ragOption,
                  ragStatus === option.value && {
                    borderColor: option.color,
                    backgroundColor: `${option.color}12`,
                  },
                ]}
                onPress={() => setRagStatus(option.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.ragDot, { backgroundColor: option.color }]} />
                <Text style={[
                  styles.ragOptionText,
                  ragStatus === option.value && { color: option.color },
                ]}>
                  {option.label}
                </Text>
                {ragStatus === option.value && (
                  <View style={styles.ragCheck}>
                    <Text style={[styles.ragCheckText, { color: option.color }]}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !isFormValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isFormValid}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextButtonText, !isFormValid && styles.nextButtonTextDisabled]}>
            {isUnderground ? 'Submit Church' : 'Next — Confirm Location'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Church Type Picker */}
      <Modal visible={typePickerVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Church Type</Text>
              <TouchableOpacity onPress={() => setTypePickerVisible(false)}>
                <Text style={styles.sheetClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={CHURCH_TYPES}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sheetItem,
                    churchType === item.value && styles.sheetItemSelected,
                  ]}
                  onPress={() => handleTypeSelect(item.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.sheetItemText,
                    churchType === item.value && styles.sheetItemTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {churchType === item.value && (
                    <Text style={styles.sheetItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Country Picker */}
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
  backButton: {
    marginBottom: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.accent,
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
    gap: Spacing.lg,
  },

  fieldGroup: { gap: Spacing.xs },

  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  optionalTag: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 0.5,
    color: Colors.textSubtle,
    textTransform: 'none',
  },
  fieldNote: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    lineHeight: 18,
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

  undergroundNotice: {
    backgroundColor: 'rgba(224, 85, 85, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 85, 85, 0.2)',
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  undergroundNoticeText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  ragOptions: {
    gap: Spacing.sm,
  },
  ragOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
    minHeight: 44,
  },
  ragDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ragOptionText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
  },
  ragCheck: {
    width: 20,
    alignItems: 'center',
  },
  ragCheckText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
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

  // Pickers
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
    paddingVertical: 14,
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
