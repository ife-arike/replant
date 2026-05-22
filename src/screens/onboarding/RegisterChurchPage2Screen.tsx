// ─────────────────────────────────────────────
// Screen 06 — Register Church, Page 2 (KAN-14)
// Fields: Current Status (RAG) + Needs (comma-separated free-text).
// Reads Page 1 data from OnboardingContext.churchDetails.
// On submit: register-church edge function → AccountSetupPage2 loopback.
// Underground path is unchanged (it submits from Page 1 and never reaches here).
//
// KAN-13 finalization 2026-05-22: Current Status moved from Page 1 to
// Page 2 for non-underground leaders, with descriptive subtitles on
// each RAG option. Underground still picks status on Page 1 (locked
// to red). Payload-construction bug fixed: contact_name was missing.
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { RAG_OPTIONS } from '../../utils/displayHelpers';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RegisterChurchPage2'>;

// Mirrors the Page 1 constant so both paths submit the same declaration text
// to register-church. If this string ever changes, update both screens.
const STATE_DECLARATION_AFFIRMATION =
  'I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth.';

const REGISTER_CHURCH_URL = `${SUPABASE_URL}/functions/v1/register-church`;

interface RegisterChurchSuccessResponse {
  success: true;
  church_id: string;
  verification_status: 'pending';
  verification_deadline: string;
  message: string;
}

export default function RegisterChurchPage2Screen({ navigation }: Props) {
  const { state, setChurchDetails } = useOnboarding();

  const [needsText, setNeedsText] = useState('');
  // KAN-13 finalization — Current Status now lives on Page 2 for
  // non-underground churches. Seed from context in case the leader
  // back-navigates from a later step.
  const [ragStatus, setRagStatus] = useState(state.churchDetails.ragStatus ?? '');
  // Finalization fix 8 — emergency preparedness self-report. Both
  // optional (tri-state null/true/false); never gate submission.
  // Tapping the already-selected option deselects (back to null).
  const [hasEmergencyPlan, setHasEmergencyPlan] = useState<boolean | null>(null);
  const [openToCollaboration, setOpenToCollaboration] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submit gate — RAG must be chosen before "Register Church" enables.
  const canSubmit = !submitting && !!ragStatus;

  const handleSubmit = async () => {
    if (submitting) return;
    const cd = state.churchDetails;

    // Guard: Page 1 data must be present. If a leader somehow lands here
    // without it (deep link, state loss), surface the gap and ask them
    // to go back rather than submitting a malformed payload.
    // KAN-13 finalization: contactName required (was missing from guard);
    // contactEmail relaxed to at-least-one-of-email-or-phone; ragStatus
    // now sourced from local state, not context.
    if (
      !cd.churchName ||
      !cd.churchType ||
      !cd.country ||
      !cd.cityRegion ||
      !cd.contactName ||
      (!cd.contactEmail && !cd.contactPhone) ||
      !ragStatus
    ) {
      setSubmitError('Missing church details. Please go back and re-enter.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    // Comma-split → trim per entry → drop empties. BE re-normalises
    // defensively but the FE delivers a clean array.
    const needsArr = needsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // KAN-13 finalization — contact_name was missing from the payload
    // (BE-side rejection bug); contact_email is now conditional to
    // match the at-least-one rule (logic.ts:130-148).
    const payload: Record<string, unknown> = {
      name: cd.churchName.trim(),
      type: cd.churchType,
      country: cd.country,
      city: cd.cityRegion,
      contact_name: cd.contactName.trim(),
      rag_status: ragStatus,
      state_declaration: STATE_DECLARATION_AFFIRMATION,
      // KAN-14: no map-pin step yet; lat/lng pass as null. logic.ts accepts.
      lat: null,
      lng: null,
    };
    if (cd.address && cd.address.trim()) payload.address = cd.address.trim();
    if (cd.contactEmail && cd.contactEmail.trim()) payload.contact_email = cd.contactEmail.trim();
    if (cd.contactPhone && cd.contactPhone.trim()) payload.contact_phone = cd.contactPhone.trim();
    if (needsArr.length > 0) payload.needs = needsArr;
    // Finalization fix 8 — emergency preparedness fields. Only sent
    // when the leader actually answered (null = unanswered = absent).
    if (hasEmergencyPlan !== null) payload.has_emergency_plan = hasEmergencyPlan;
    if (openToCollaboration !== null) payload.open_to_collaboration = openToCollaboration;

    try {
      const response = await fetch(REGISTER_CHURCH_URL, {
        method: 'POST',
        headers: {
          // No Authorization header — verify_jwt=false on register-church.
          // apikey is required for the Supabase gateway to route the call.
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let beError: string | null = null;
        try {
          const body = (await response.json()) as { error?: unknown };
          if (typeof body?.error === 'string') beError = body.error;
        } catch {
          // ignore body-parse errors — fall through to generic
        }
        throw new Error(beError ?? 'Church registration failed. Please try again.');
      }

      const result = (await response.json()) as RegisterChurchSuccessResponse;
      setChurchDetails({ churchId: result.church_id });

      navigation.navigate('AccountSetupPage2', {
        newChurch: {
          id: result.church_id,
          name: cd.churchName.trim(),
          type: cd.churchType,
          city: cd.cityRegion ?? '',
          country: cd.country,
          rag_status: ragStatus,
          verification_status: 'pending',
          at_capacity: false,
        },
        newChurchId: result.church_id,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Church registration failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={styles.stepLabel}>REGISTER CHURCH · 2 OF 2</Text>
        <Text style={styles.title}>Confirm Your Church</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Current Status — KAN-13 finalization. Each option shows a
            descriptive subtitle (from RAG_OPTIONS.description) so the
            leader reads the concrete meaning before choosing. No
            underground lock here — underground never reaches Page 2. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current Status</Text>
          <Text style={styles.fieldNote}>
            How is your ministry operating? You can update this at any time from Settings.
          </Text>
          <View style={styles.ragOptions}>
            {RAG_OPTIONS.map(option => {
              const isSelected = ragStatus === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.ragOption,
                    isSelected && {
                      borderColor: option.color,
                      backgroundColor: `${option.color}12`,
                    },
                  ]}
                  onPress={() => setRagStatus(option.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.ragDot, { backgroundColor: option.color }]} />
                  <View style={styles.ragOptionTextGroup}>
                    <Text
                      style={[
                        styles.ragOptionLabel,
                        isSelected && { color: option.color },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.ragOptionDesc}>{option.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.ragCheck}>
                      <Text style={[styles.ragCheckText, { color: option.color }]}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Needs — optional, comma-separated */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Share needs, or what your church has in abundance{' '}
            <Text style={styles.optionalTag}>(Optional)</Text>
          </Text>
          <Text style={styles.fieldNote}>
            Separate entries with commas. e.g. "Manpower, resources, prayer, talents".
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={needsText}
            onChangeText={setNeedsText}
            placeholder="Manpower, resources, prayer, talents…"
            placeholderTextColor={Colors.textSubtle}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Finalization fix 8 — emergency preparedness Q1 + Q2. Tri-state
            Yes / No / unanswered. Tapping the selected option deselects
            (back to null). Both fields are fully optional and never
            gate submission — leaders without an answer ship as null. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Do you have an emergency action plan in case of a sudden incident?
          </Text>
          <Text style={styles.fieldNote}>
            Optional — you can update this at any time from Settings.
          </Text>
          <View style={styles.yesNoRow}>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                hasEmergencyPlan === true && styles.yesNoButtonSelected,
              ]}
              onPress={() => setHasEmergencyPlan(hasEmergencyPlan === true ? null : true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yesNoButtonText,
                  hasEmergencyPlan === true && styles.yesNoButtonTextSelected,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                hasEmergencyPlan === false && styles.yesNoButtonSelected,
              ]}
              onPress={() => setHasEmergencyPlan(hasEmergencyPlan === false ? null : false)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yesNoButtonText,
                  hasEmergencyPlan === false && styles.yesNoButtonTextSelected,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Would you be willing to strategize with nearby churches on emergency preparedness?
          </Text>
          <Text style={styles.fieldNote}>
            Optional — this helps us connect you with the right partners.
          </Text>
          <View style={styles.yesNoRow}>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                openToCollaboration === true && styles.yesNoButtonSelected,
              ]}
              onPress={() => setOpenToCollaboration(openToCollaboration === true ? null : true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yesNoButtonText,
                  openToCollaboration === true && styles.yesNoButtonTextSelected,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                openToCollaboration === false && styles.yesNoButtonSelected,
              ]}
              onPress={() => setOpenToCollaboration(openToCollaboration === false ? null : false)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yesNoButtonText,
                  openToCollaboration === false && styles.yesNoButtonTextSelected,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        {submitError && (
          <Text style={[styles.errorText, styles.submitErrorText]}>{submitError}</Text>
        )}
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              Register Church
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  textarea: {
    minHeight: 120,
    paddingTop: 14,
  },

  bottomSpacer: { height: Spacing.xxxl },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // Tokens mirror AccountSetupPage1.nextButton for visual consistency.
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(107, 181, 232, 0.2)',
  },
  submitButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
  submitButtonTextDisabled: {
    color: 'rgba(107, 181, 232, 0.4)',
  },

  // RAG option styles — mirror Page 1's pattern (ragOption, ragDot,
  // ragCheck) but with a vertical-stack text group (label + description)
  // since Page 2 surfaces the per-option description subtitle.
  ragOptions: {
    gap: Spacing.sm,
  },
  ragOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 6, // baseline-align with first line of label
  },
  ragOptionTextGroup: {
    flex: 1,
  },
  ragOptionLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  ragOptionDesc: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    marginTop: 2,
    lineHeight: 18,
  },
  ragCheck: {
    width: 20,
    alignItems: 'center',
  },
  ragCheckText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
  },

  // Finalization fix 8 — Yes / No button pair for the emergency
  // preparedness questions. Two equal-width buttons in a row with
  // standard surface backgrounds; selected state fills with the sky
  // accent and flips text to background color for contrast.
  yesNoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  yesNoButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
  },
  yesNoButtonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  yesNoButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  yesNoButtonTextSelected: {
    color: Colors.background,
  },

  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    marginTop: 2,
  },
  submitErrorText: {
    marginBottom: Spacing.sm,
  },
});
