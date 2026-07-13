// HeartcrySubmissionScreen — KAN-64 / Screen 15 (+ 15B confirmation modal).
//
// Pushed screen (back returns to KAN-65 PersecutedScreen). Sends a
// heartcry to the submit-heartcry edge function (SEC c.14512 Path A);
// the function handles server-side encryption + INSERT.
//
// 2026-05-26 Founder pass updates:
//   - Post-submit confirmation modal (Screen 15B). Modal sits over a
//     dimmed scrim (rgba(0,0,0,0.72), no expo-blur per dispatch). Body
//     copy verbatim from content file §6; email rendered as an inline
//     mailto Pressable. "Done" button dismisses modal AND pops back to
//     the Persecuted landing (the focus-effect on PersecutedScreen then
//     re-fetches the tracker, which now reads status='received').
//   - region → continent in the post_to_feed toggle subtext (the
//     anonymization scheme is 6-continent UN M.49, not region).
//   - Type bumps + 2×2 chip grid per wireframe v2: nav title 20px,
//     field labels 14px, chip height 44pt, chips in a 2-col grid so
//     "Just to be heard" stops orphaning to a third row.
//
// SECURITY INVARIANTS — DO NOT VIOLATE (AC 14, SEC Items 1a + 1b):
//   - The heartcry content (and every field that goes with it: severity,
//     request_type, post_to_feed) must NEVER appear in console.log /
//     console.error / analytics / AsyncStorage / SecureStore / crash
//     payloads. Mount, change, submit, success, error — all silent.
//   - No client-side draft persistence (AC 15). On unmount the in-progress
//     content is discarded.
//   - feed_approved is NEVER sent — admin-only column write.
//   - church_id resolved server-side from JWT (AC 16); the FE only sends
//     { content, severity, request_type, post_to_feed }.
//
// The submission body shape is the contract the edge function validator
// in supabase/functions/submit-heartcry/logic.ts expects (validateBody);
// any drift here breaks the submit path.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  REQUEST_TYPE_OPTIONS,
  SEVERITY_RADIO_OPTIONS,
  type HeartcryRequestType,
  type HeartcrySeverity,
} from './persecutedLogic';

const PASTORAL_INTRO =
  'Speak freely. What you share here goes directly to the Replant team — no other leader will see it, unless you choose to let the Body stand with you in prayer. We receive every word with prayer, and we will respond.';

const ENCRYPTED_DISCLOSURE =
  '🔒 Your words are encrypted the moment you send them. They go to the Replant team, and no one else.';

// Item 4 — fixed from "your region only" → "your continent only" to
// match the 6-continent UN M.49 anonymization the BE actually applies.
const POST_TO_FEED_SUBTEXT =
  'After Replant team review, your heartcry may appear in the feed — your continent only, never your name or church.';

// Item 2 — modal copy verbatim from content file §6 (Founder-ratified
// 2026-05-26). Email is rendered as an inline mailto Pressable inside
// the body Text.
const MODAL_BODY_PRE =
  'Your heartcry has been received. We will be praying alongside you.\n\nPlease reach out to the Replant Team directly at ';
const MODAL_EMAIL = 'connect@projectreplant.org';
const MODAL_BODY_POST = ' if you have a request that cannot wait.';
const MODAL_ACTION_LABEL = 'Done';

type SubmitState = 'idle' | 'submitting' | 'error';

export default function HeartcrySubmissionScreen() {
  const navigation = useNavigation();

  // SECURITY: these are FE-local state only. Never log, never persist.
  const [content, setContent] = useState('');
  const [requestTypes, setRequestTypes] = useState<Set<HeartcryRequestType>>(
    () => new Set<HeartcryRequestType>(),
  );
  const [severity, setSeverity] = useState<HeartcrySeverity | null>(null);
  const [postToFeed, setPostToFeed] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Item 2 — confirmation modal visibility. Flipped true on successful
  // submit; the "Done" press flips it false AND calls goBack().
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  // Touched flag drives "required" hints — surfaced only after the first
  // submit attempt so the form doesn't bark at the leader mid-typing.
  const [touched, setTouched] = useState(false);

  const trimmedContent = content.trim();
  const hasContent = trimmedContent.length > 0;
  const hasRequestType = requestTypes.size > 0;
  const hasSeverity = severity !== null;
  const canSubmit = hasContent && hasRequestType && hasSeverity && submitState !== 'submitting';

  const toggleRequestType = (value: HeartcryRequestType) => {
    setRequestTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const onSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitState('submitting');
    setErrorMessage(null);

    // SECURITY: this is the ONE place content leaves FE memory. Send
    // straight to the edge function — no logging, no transformation, no
    // intermediate storage. The error path below also must NEVER include
    // any of the body fields in messages surfaced to the user or logs.
    const { error } = await supabase.functions.invoke('submit-heartcry', {
      body: {
        content: trimmedContent,
        severity,
        request_type: Array.from(requestTypes),
        post_to_feed: postToFeed,
      },
    });

    if (error) {
      setSubmitState('error');
      // Generic copy — DO NOT echo body or detail strings from the
      // server back (those may have been computed against the content
      // and could leak shape). Leader can retry; nothing was persisted.
      setErrorMessage("We couldn't send your heartcry. Please try again.");
      return;
    }

    // Item 2 — on success, surface the confirmation modal. Stay on
    // Screen 15 under the scrim until the leader taps "Done"; the
    // submit-state goes back to idle in case the leader cancels the
    // navigation (e.g., backgrounds the app) — though the modal is
    // dismiss-only so canSubmit logic doesn't matter at that point.
    setSubmitState('idle');
    setConfirmationVisible(true);
  };

  // Item 2 — "Done" action. Dismiss the modal and pop the form off the
  // stack. goBack() returns to PersecutedScreen; its useFocusEffect
  // re-runs the tracker query, which now reads status='received' for
  // the new row.
  const onConfirmationDone = () => {
    setConfirmationVisible(false);
    navigation.goBack();
  };

  const onMailto = () => {
    void Linking.openURL(`mailto:${MODAL_EMAIL}`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to Persecuted tab"
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Heartcry</Text>
        <View style={styles.topBarRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Pastoral intro (AC 2 — verbatim, non-dismissible) */}
          <View style={styles.pastoralIntro}>
            <Text style={styles.pastoralIntroText}>{PASTORAL_INTRO}</Text>
          </View>

          {/* Field 1 — Your Heartcry (AC 3) */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Your Heartcry</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              placeholder="Write what you are carrying. There is no limit here."
              placeholderTextColor="rgba(240, 237, 230, 0.40)"
              style={styles.textarea}
              textAlignVertical="top"
              accessibilityLabel="Your heartcry"
              // Lock down OS-level mirroring of content where we can — most
              // mobile keyboards still see the text, but this at least
              // prevents predictive caches and autocorrect from indexing
              // the content into the system dictionary.
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
            />
            {touched && !hasContent ? (
              <Text style={styles.fieldError}>Please write your heartcry before sending.</Text>
            ) : null}
          </View>

          {/* Field 2 — What do you need? (AC 4) — Item 8: 2×2 grid */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>What do you need?</Text>
            <View style={styles.chipWrap}>
              {REQUEST_TYPE_OPTIONS.map((opt) => {
                const selected = requestTypes.has(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleRequestType(opt.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={opt.label}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    {selected ? <View style={styles.chipDot} /> : null}
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldHelper}>Select all that apply.</Text>
            {touched && !hasRequestType ? (
              <Text style={styles.fieldError}>Pick at least one.</Text>
            ) : null}
          </View>

          {/* Field 3 — How urgent is your situation? (AC 5) */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>How urgent is your situation?</Text>
            <View style={styles.radioGroup}>
              {SEVERITY_RADIO_OPTIONS.map((opt, idx) => {
                const selected = severity === opt.value;
                const isLast = idx === SEVERITY_RADIO_OPTIONS.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSeverity(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label}. ${opt.descriptor}`}
                    style={[styles.radioRow, !isLast && styles.radioRowBordered]}
                  >
                    <View style={[styles.radioMark, selected && styles.radioMarkSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.radioText}>
                      <Text style={styles.radioLabel}>{opt.label}</Text>
                      <Text style={styles.radioDesc}>{opt.descriptor}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {touched && !hasSeverity ? (
              <Text style={styles.fieldError}>Choose how urgent this is.</Text>
            ) : null}
          </View>

          {/* Field 4 — Let the Body stand with you (AC 6) */}
          <View style={styles.witnessBlock}>
            <View style={styles.witnessRow}>
              <Text style={styles.witnessLabel}>Let the Body stand with you</Text>
              <Switch
                value={postToFeed}
                onValueChange={setPostToFeed}
                trackColor={{ false: 'rgba(240, 237, 230, 0.16)', true: Colors.red }}
                thumbColor={Colors.text}
                ios_backgroundColor="rgba(240, 237, 230, 0.16)"
                accessibilityLabel="Let the Body stand with you in prayer"
                accessibilityRole="switch"
              />
            </View>
            <Text style={styles.witnessSub}>{POST_TO_FEED_SUBTEXT}</Text>
          </View>

          {/* Submit (AC 7) */}
          <Pressable
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel="Send my heartcry"
            disabled={submitState === 'submitting'}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.submitButtonPressed,
            ]}
          >
            {submitState === 'submitting' ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={styles.submitButtonText}>Send My Heartcry</Text>
            )}
          </Pressable>

          {errorMessage ? (
            <Text style={styles.submitError}>{errorMessage}</Text>
          ) : null}

          {/* Encrypted disclosure (AC 8) */}
          <View style={styles.encryptedDisclosure}>
            <Text style={styles.encryptedDisclosureText}>{ENCRYPTED_DISCLOSURE}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Item 2 — Screen 15B confirmation modal. Native Modal with a
          plain scrim (no expo-blur — not installed). Cannot be swiped
          dismissed: the leader must tap "Done" to acknowledge. */}
      <Modal
        visible={confirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={onConfirmationDone}
        statusBarTranslucent
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalGlyph}>
              <ConfirmationCheckIcon />
            </View>

            <Text style={styles.modalBody}>
              {MODAL_BODY_PRE}
              <Text
                style={styles.modalBodyEmail}
                onPress={onMailto}
                accessibilityRole="link"
                accessibilityLabel={`Email ${MODAL_EMAIL}`}
              >
                {MODAL_EMAIL}
              </Text>
              {MODAL_BODY_POST}
            </Text>

            <View style={styles.modalDivider} />

            <Pressable
              onPress={onConfirmationDone}
              accessibilityRole="button"
              accessibilityLabel="Done — return to Persecuted tab"
              style={({ pressed }) => [styles.modalAction, pressed && styles.modalActionPressed]}
            >
              <Text style={styles.modalActionLabel}>{MODAL_ACTION_LABEL}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Sky check glyph for the modal — 44pt circle wraps it; the SVG itself
// sits at 18pt so the stroke has room to breathe inside the ring.
function ConfirmationCheckIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 L10 17 L19 7"
        stroke={Colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },

  // Item 8 — Nav: 52pt height (matches Screen 14 nav), title 20pt
  // Cormorant. Bottom hairline kept — this is a pushed screen so the
  // border helps separate header from scroll content.
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backArrow: {
    fontFamily: Typography.body,
    fontSize: 22,
    color: Colors.text,
  },
  topBarTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    letterSpacing: 0.4, // 0.02em × 20
    color: Colors.text,
  },
  topBarRight: {
    width: 22,
  },

  scroll: {
    padding: 20,
    paddingBottom: 32,
    gap: 24,
  },

  pastoralIntro: {
    paddingVertical: 18,
    paddingLeft: 22,
    paddingRight: 18,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    backgroundColor: 'rgba(224, 85, 85, 0.04)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  pastoralIntroText: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 28, // 18 × 1.55
    color: Colors.text,
  },

  field: {
    gap: 10,
  },
  // Item 8 — field label 13 → 14
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.28, // 0.02em × 14
    color: Colors.text,
  },
  fieldHelper: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: 'rgba(240, 237, 230, 0.60)',
  },
  fieldError: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
  },

  textarea: {
    width: '100%',
    minHeight: 180,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.text,
  },

  // Item 8 — 2×2 grid: row-wrap with each chip flex-basis 45% +
  // flex-grow 1, so 4 chips lay out as 2 rows of 2 with the grow
  // distributing the gap remainder. "Just to be heard" no longer
  // orphans to a third row.
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '45%',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: 'rgba(224, 85, 85, 0.10)',
    borderColor: 'rgba(224, 85, 85, 0.28)',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  chipText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  chipTextSelected: {
    fontFamily: Typography.bodyMedium,
    color: Colors.red,
  },

  radioGroup: {
    gap: 0,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  radioRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  radioMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioMarkSelected: {
    borderColor: Colors.red,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.red,
  },
  radioText: {
    flex: 1,
    gap: 3,
  },
  radioLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.15,
  },
  radioDesc: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 18, // 12.5 × 1.45
    color: 'rgba(240, 237, 230, 0.60)',
  },

  witnessBlock: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  witnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  witnessLabel: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 0.18,
  },
  witnessSub: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: 'rgba(240, 237, 230, 0.60)',
  },

  submitButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: '#0A0A0A',
    letterSpacing: 0.6,
  },
  submitError: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
  },

  encryptedDisclosure: {
    paddingHorizontal: 4,
  },
  encryptedDisclosureText: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    lineHeight: 18,
    color: 'rgba(240, 237, 230, 0.60)',
  },

  // Item 2 — Screen 15B modal styles. Scrim is a plain View at @0.72
  // (no expo-blur — not installed per dispatch). Card is centered with
  // 28pt scrim padding so it never reaches phone edges.
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    borderRadius: 18,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  modalGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107, 181, 232, 0.35)',
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 26, // 17 × 1.5
    color: Colors.text,
    textAlign: 'center',
  },
  modalBodyEmail: {
    fontFamily: Typography.scriptureItalic, // serif italic per wireframe
    color: Colors.accent,
  },
  modalDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  modalAction: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1F1F1F',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionPressed: {
    opacity: 0.85,
  },
  modalActionLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
    letterSpacing: 0.56, // 0.04em × 14
  },
});
