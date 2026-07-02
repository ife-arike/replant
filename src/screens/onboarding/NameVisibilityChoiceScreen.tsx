// ─────────────────────────────────────────────
// NameVisibilityChoiceScreen — NEW (Ask 2 · Rulings #10 + #11)
// Shown after the underground RegCP1 form, BEFORE the register-church
// validation call + loopback to ASP2.
//
// Functional language only — NO "brave" / "safe".
// Default = "Keep our name hidden" (matches Migration A server-side default).
//
// Asymmetric reversibility (locked, ruling #11):
//   hidden → shown : leader self-serve within 7 days of registration,
//                    then locks.
//   shown  → hidden: NEVER self-reversible — admin-only via direct contact
//                    (#25). The commit-to-show modal communicates that
//                    gravity.
//
// Submit flow (mirrors the existing RegCP1.submitUnderground path that
// was removed in favor of this screen):
//   1. Persist showChurchName to OnboardingContext.churchDetails.
//   2. POST to register-church (verify_jwt=false, validation-only mode).
//   3. On 200 → navigate to AccountSetupPage2 with newChurch + newChurchId
//      so the existing loopback bypass card mounts. ASP2 then calls
//      create-account v8 with newChurch payload that includes
//      show_church_name; orphan-prevention v4 architecture preserved.
//   4. On error → render the existing inline error pattern.
//
// Founder-final layout: STACKED RADIO (no card chrome). CD-ALT preserved
// as a comment in the design handoff source.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NameVisibilityChoice'>;

type NameVisibility = 'show' | 'hidden';

const REGISTER_CHURCH_URL = `${SUPABASE_URL}/functions/v1/register-church`;
const STATE_DECLARATION_AFFIRMATION =
  'I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth.';

// register-church validation-only response (v6+). For underground we send
// the underground-stripped payload; the orphan-prevention design means
// the DB write happens later via create-account v8 on ASP2 submit.
interface ValidateOkResponse {
  valid: true;
}
interface ValidateErrResponse {
  valid: false;
  error?: string;
  message?: string;
}

export default function NameVisibilityChoiceScreen({ navigation }: Props) {
  const { state, setChurchDetails } = useOnboarding();
  const cd = state.churchDetails;

  // Default to 'hidden' — matches Migration A's server-side default.
  // Restore the staged value if the leader bounced back.
  const initial: NameVisibility =
    cd.showChurchName === true ? 'show' : 'hidden';
  const [value, setValue] = useState<NameVisibility>(initial);
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pick = (v: NameVisibility) => setValue(v);

  const validateAndAdvance = async (chosen: NameVisibility) => {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    // Persist the staged choice. ASP2's create-account v8 submit reads
    // this from context. Setting it BEFORE the network call so a
    // bounce-back retains the leader's selection even if validate fails.
    setChurchDetails({ showChurchName: chosen === 'show' });

    // Underground payload — city / lat / lng intentionally absent (the
    // BE strips them too, but cleaner wire). show_church_name carried in
    // case register-church starts validating it; safe extra field today.
    const payload: Record<string, unknown> = {
      name: (cd.churchName ?? '').trim(),
      type: 'underground',
      country: cd.country,
      contact_name: (cd.contactName ?? '').trim(),
      rag_status: cd.ragStatus,
      state_declaration: STATE_DECLARATION_AFFIRMATION,
      show_church_name: chosen === 'show',
    };
    if (cd.contactEmail && cd.contactEmail.trim()) {
      payload.contact_email = cd.contactEmail.trim();
    }
    if (cd.contactPhone && cd.contactPhone.trim()) {
      payload.contact_phone = cd.contactPhone.trim();
    }

    try {
      const response = await fetch(REGISTER_CHURCH_URL, {
        method: 'POST',
        headers: {
          // No Authorization header — verify_jwt=false on register-church.
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let beError: string | null = null;
        try {
          const body = (await response.json()) as ValidateErrResponse;
          if (typeof body?.message === 'string') beError = body.message;
          else if (typeof body?.error === 'string') beError = body.error;
        } catch {
          // ignore body-parse errors
        }
        throw new Error(
          beError ?? 'Church registration failed. Please try again.',
        );
      }

      const body = (await response.json()) as ValidateOkResponse;
      if (body.valid !== true) {
        throw new Error('Church registration failed. Please try again.');
      }

      // Validation passed → loopback to ASP2 bypass card. The church row
      // is BORN later via create-account v8 atomic RPC. Sentinel ID so
      // ASP2's loopback effect fires; ASP2 ignores it and rebuilds the
      // payload from context.
      const sentinelId = 'underground_pending_atomic_create';
      navigation.navigate('AccountSetupPage2', {
        newChurch: {
          id: sentinelId,
          name: (cd.churchName ?? '').trim(),
          type: 'underground',
          city: '',
          country: cd.country ?? '',
          rag_status: cd.ragStatus ?? 'red',
          verification_status: 'pending',
          at_capacity: false,
          leader_count: 0,
        },
        newChurchId: sentinelId,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Church registration failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onContinue = () => {
    if (value === 'show') {
      setModal(true);
      return;
    }
    void validateAndAdvance(value);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back to church details"
          disabled={submitting}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>UNDERGROUND · SECURE</Text>
        <Text style={styles.title}>How should other leaders see your church?</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Other leaders across the network can pray for and connect with your
          church. You decide what they see.
        </Text>

        <View style={styles.list}>
          <Option
            on={value === 'show'}
            title="Show our name"
            helper="Other leaders can see your church's name when they pray for you or connect with you. They will not see where you are."
            onPress={() => pick('show')}
            disabled={submitting}
          />
          <Option
            on={value === 'hidden'}
            isDefault
            title="Keep our name hidden"
            helper={'Other leaders see "Underground Church · {region}" instead of your name. Your region is shown so the body of Christ can still pray with you.'}
            onPress={() => pick('hidden')}
            disabled={submitting}
          />
        </View>

        <Text style={styles.foot}>This choice applies to your whole church. Take your time.</Text>
      </ScrollView>

      <View style={styles.footer}>
        {submitError && <Text style={styles.errorText}>{submitError}</Text>}
        <TouchableOpacity
          style={[styles.cta, submitting && styles.ctaDisabled]}
          onPress={onContinue}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.ctaText}>Submit Church</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Irreversible-commit modal — only for "show". Pastoral, not panic. */}
      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              Once your name is shown, <Text style={styles.b}>it cannot be hidden again</Text>
              {' '}from inside the app. Only the Replant team can reverse this on direct request.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.ghost]}
                onPress={() => setModal(false)}
              >
                <Text style={styles.ghostText}>Go back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.danger]}
                onPress={() => {
                  setModal(false);
                  void validateAndAdvance('show');
                }}
              >
                <Text style={styles.dangerText}>I&rsquo;m sure, show our name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Option({
  on,
  title,
  helper,
  onPress,
  isDefault,
  disabled,
}: {
  on: boolean;
  title: string;
  helper: string;
  onPress: () => void;
  isDefault?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.opt}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled: !!disabled }}
    >
      <View style={styles.optHead}>
        <View style={[styles.radio, on && styles.radioOn]}>
          {on && <View style={styles.radioDot} />}
        </View>
        <Text style={styles.optTitle}>{title}</Text>
        {isDefault && <Text style={styles.defaultPill}>DEFAULT</Text>}
      </View>
      <Text style={styles.optHelper}>{helper}</Text>
    </TouchableOpacity>
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
    letterSpacing: 3,
    color: Colors.red,
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
  intro: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 22,
  },
  list: {},
  opt: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 7,
  },
  optHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(240,237,230,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  optTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15.5,
    color: Colors.text,
  },
  defaultPill: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: Colors.textMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 'auto',
    overflow: 'hidden',
  },
  optHelper: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 19,
    paddingLeft: 31,
  },
  foot: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    fontWeight: '300',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.red,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },

  modalScrim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  modal: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240,237,230,0.14)',
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontFamily: Typography.display,
    fontSize: 23,
    color: Colors.text,
    marginBottom: 12,
  },
  modalBody: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 21,
    marginBottom: 22,
  },
  b: { fontFamily: Typography.bodyMedium, color: Colors.text },
  modalActions: { gap: 10 },
  modalBtn: {
    minHeight: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  ghostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
  danger: { backgroundColor: 'rgba(224,85,85,0.12)' },
  dangerText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.red,
  },
});
