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
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { RAG_OPTIONS, orgCopy } from '../../utils/displayHelpers';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../lib/supabase';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RegisterChurchPage2'>;

// Mirrors the Page 1 constant so both paths submit the same declaration text
// to register-church. If this string ever changes, update both screens.
const STATE_DECLARATION_AFFIRMATION =
  'I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth.';

const REGISTER_CHURCH_URL = `${SUPABASE_URL}/functions/v1/register-church`;
// KAN-207 — separate endpoint for the edit path. register-church always
// INSERTs; routing edits through it created duplicate church rows. The
// edit endpoint requires JWT (verify_jwt=true) and verifies caller
// ownership of the church_id server-side before updating.
const UPDATE_CHURCH_URL = `${SUPABASE_URL}/functions/v1/update-church`;
// register-church-delete is dead code under the orphan-prevention
// architecture (2026-06-14). Removed from FE references; the edge
// function deployment stays for one cycle as defense-in-depth, then
// gets removed in a follow-up cleanup PR.

interface RegisterChurchSuccessResponse {
  success: true;
  church_id: string;
  verification_status: 'pending';
  verification_deadline: string;
  message: string;
}

export default function RegisterChurchPage2Screen({ navigation, route }: Props) {
  const { state, setChurchDetails } = useOnboarding();
  // B5 — edit mode swaps the primary CTA label from "Register Church"
  // to "Apply Changes". Submit routing (KAN-207, see handleSubmit ~L234):
  // when editChurchId points at a DB-resident row, it goes to the
  // `update-church` edge function (PATCH with JWT + ownership). For
  // mid-signup loopback edits (no DB row yet), edits mutate
  // OnboardingContext only — the church doesn't exist server-side
  // until atomic create-account fires on "Enter Replant" in ASP2.
  // Either path is orphan-safe.
  const isEditMode = route.params?.isEditMode ?? false;

  // Finalization (Founder ruling 2026-06-12, full revert of SPEC c.13818
  // additions ACs 8/9/11) — "What we have" + "What we need" back as a
  // symmetric paired set on Page 2. Both REQUIRED; leaders without a
  // concrete answer guided to type "N/A" via the shared note below
  // the fields (preserves the data-quality signal — "explicitly
  // didn't answer" vs ambiguous blank). The 500-char counter is
  // dropped. Placeholder voice keeps the "your ministry" framing
  // SPEC c.13818 AC 13 introduced, applied symmetrically to both
  // fields so the pair reads as one ask.
  // 2026-06-19 device pass — orgCopy applied to all RegCP2 labels so para
  // ministries see "What we can offer" / "What we're seeking" / "organization"
  // wording. Founder revoked the earlier "hide RAG for para" lock — RAG renders
  // for both paths now (orgCopy.showRag === true).
  const copy = orgCopy(state.churchDetails.churchType);
  const [hasText, setHasText] = useState(state.churchDetails.hasText ?? '');
  const [needsText, setNeedsText] = useState(state.churchDetails.needsText ?? '');
  // KAN-13 finalization — Current Status now lives on Page 2 for
  // non-underground churches. Seed from context in case the leader
  // back-navigates from a later step.
  const [ragStatus, setRagStatus] = useState(state.churchDetails.ragStatus ?? '');
  // Finalization fix 8 — emergency preparedness self-report. Both
  // optional (tri-state null/true/false); never gate submission.
  // Tapping the already-selected option deselects (back to null).
  // B18 — seed from context so back-nav and the edit-path remount
  // restore the leader's prior Yes/No selection rather than resetting
  // to null on every mount.
  const [hasEmergencyPlan, setHasEmergencyPlan] = useState<boolean | null>(
    state.churchDetails.hasEmergencyPlan ?? null,
  );
  const [openToCollaboration, setOpenToCollaboration] = useState<boolean | null>(
    state.churchDetails.openToCollaboration ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // v7 same-room race modal (Founder ruling 2026-06-18). When
  // register-church v7 returns valid:false with a `similar` list, we
  // surface a modal that lets the leader either jump back to ASP2
  // search (to select the existing church instead) or continue with a
  // force:true re-submission (acknowledging it's actually a different
  // church). State-level disambiguation pending task #19.
  interface SimilarChurch {
    id: string;
    name: string;
    city: string | null;
    verification_status: string;
    match_reason: string;
  }
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [similarChurches, setSimilarChurches] = useState<SimilarChurch[]>([]);

  // Submit gate — RAG selected AND BOTH have/need fields non-empty.
  // Leaders without a concrete answer are guided to type "N/A" via
  // the shared note below the fields.
  const canSubmit =
    !submitting && !!ragStatus && !!hasText.trim() && !!needsText.trim();

  const handleSubmit = async (opts: { force?: boolean } = {}) => {
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

    // Both "What we have" and "What we need" required at submit.
    // Leaders without an answer type "N/A" per the shared note below
    // the fields — preserves the data signal vs an ambiguous blank.
    if (!hasText.trim() || !needsText.trim()) {
      setSubmitError('Please fill in both fields, or type N/A if you cannot answer now.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    // Comma-split → trim per entry → drop empties. BE re-normalises
    // defensively but the FE delivers a clean array. Same shape
    // applied to both "What we have" (resources) and "What we need"
    // (needs) textareas. Leaders who type "N/A" send ['N/A'] — a
    // meaningful signal at the data layer ("explicitly didn't
    // answer") rather than a blank that's ambiguous between
    // unanswered and missing.
    const needsArr = needsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const resourcesArr = hasText
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
    if (resourcesArr.length > 0) payload.resources = resourcesArr;
    // Finalization fix 8 — emergency preparedness fields. Only sent
    // when the leader actually answered (null = unanswered = absent).
    if (hasEmergencyPlan !== null) payload.has_emergency_plan = hasEmergencyPlan;
    if (openToCollaboration !== null) payload.open_to_collaboration = openToCollaboration;
    // v7 force flag (Founder ruling 2026-06-18). When the leader has
    // already seen the similar-church modal and confirmed it's
    // intentionally distinct, the FE re-submits with force:true and
    // register-church v7 skips the similarity check.
    if (opts.force === true) payload.force = true;

    try {
      // Orphan-prevention architecture (2026-06-14): the BE branching
      // simplifies. There are now only two outbound contracts:
      //
      //   1) Post-auth EDIT (Church Profile screen, leader has session):
      //      → POST update-church with Bearer + church_id, returns
      //        { success, church_id } (unchanged from KAN-207).
      //
      //   2) PRE-auth (signup flow — create OR edit-bypass):
      //      → POST register-church v6 (validation-only, no DB write).
      //        Returns { valid: true } on pass, or
      //        { valid: false, similar: [...] } when a same-room race
      //        is detected, or { valid: false, error: '...' } on
      //        validation failure. The DB write happens later in
      //        create-account v4 (called from ASP2 "Enter Replant").
      //
      // The pre-auth edit path (signup bypass card "Edit") no longer
      // needs register-church-delete — there's no DB row to delete
      // because v6 doesn't write. Editing is just a context rewrite.
      let url: string;
      let headers: Record<string, string>;
      let body: Record<string, unknown>;
      let isPostAuthEdit = false;

      const editChurchId = route.params?.editChurch?.churchId;
      if (isEditMode && editChurchId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          isPostAuthEdit = true;
          url = UPDATE_CHURCH_URL;
          headers = {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          };
          body = { ...payload, church_id: editChurchId };
        } else {
          // Pre-auth Edit. v6 validation-only. No delete needed.
          url = REGISTER_CHURCH_URL;
          headers = {
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          };
          body = payload as unknown as Record<string, unknown>;
        }
      } else {
        // Fresh create (signup-flow). v6 validation-only.
        url = REGISTER_CHURCH_URL;
        headers = {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        };
        body = payload as unknown as Record<string, unknown>;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let beError: string | null = null;
        let beCode: string | null = null;
        let beMessage: string | null = null;
        try {
          const errBody = (await response.json()) as {
            error?: unknown; code?: unknown; message?: unknown;
          };
          if (typeof errBody?.error === 'string') beError = errBody.error;
          if (typeof errBody?.code === 'string') beCode = errBody.code;
          if (typeof errBody?.message === 'string') beMessage = errBody.message;
          console.log('[RegCP2] BE !ok', { status: response.status, beError, beCode, beMessage });
        } catch (parseErr) {
          console.log('[RegCP2] BE !ok parse-fail', { status: response.status, parseErr });
        }
        // KAN-230 — 409 with code 'contact_email_taken' carries the
        // Founder-locked copy in beError; surface verbatim. Only fires
        // on the post-auth edit path now (v6 doesn't write so it can't
        // hit the unique-violation pre-write).
        if (response.status === 409 && beCode === 'contact_email_taken') {
          throw new Error(beError ?? 'This email is already registered to another church.');
        }
        throw new Error(beMessage ?? beError ?? 'Church registration failed. Please try again.');
      }

      // ── Parse success ─────────────────────────────────────────
      // Two distinct success shapes depending on the branch above.
      if (isPostAuthEdit) {
        // update-church returns { success, church_id, ... } — same as
        // pre-orphan-prevention era. Reuse the same nav-reset shape.
        const result = (await response.json()) as RegisterChurchSuccessResponse;
        setChurchDetails({ churchId: result.church_id });
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'AccountSetupPage1' },
              {
                name: 'AccountSetupPage2',
                params: {
                  newChurch: {
                    id: result.church_id,
                    name: cd.churchName.trim(),
                    type: cd.churchType,
                    city: cd.cityRegion ?? '',
                    country: cd.country,
                    rag_status: ragStatus,
                    verification_status: 'pending',
                    at_capacity: false,
                    leader_count: 0,
                  },
                  newChurchId: result.church_id,
                },
              },
            ],
          }),
        );
      } else {
        // Pre-auth v7 validation-only path.
        type V7Body =
          | { valid: true }
          | {
              valid: false;
              similar?: SimilarChurch[];
              error?: string;
              message?: string;
            };
        const result = (await response.json()) as V7Body;

        if (!result.valid) {
          // v7 same-room race soft warning (Founder ruling 2026-06-18).
          // The inline-throw pattern is gone — we now open a modal that
          // gives the leader two intentional choices: jump to ASP2
          // search OR continue anyway (re-submit with force:true).
          if (result.similar && result.similar.length > 0) {
            setSimilarChurches(result.similar);
            setShowSimilarModal(true);
            setSubmitting(false);
            return;
          }
          throw new Error(
            result.message ?? result.error ?? 'Church registration failed. Please try again.',
          );
        }

        // valid: true — persist church payload to OnboardingContext and
        // navigate back to ASP2 bypass card. NO DB write happened; the
        // church row will be INSERTed atomically alongside the leader
        // when "Enter Replant" fires create-account v4.
        //
        // Placeholder id: 'local-draft' sentinel. ASP2 detects this on
        // selectedChurch.id and switches its handleSubmit to send the
        // full newChurch payload (built from OnboardingContext) rather
        // than churchId. Sentinel is never sent to any BE call.
        const LOCAL_DRAFT_ID = 'local-draft';
        setChurchDetails({ churchId: undefined });
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'AccountSetupPage1' },
              {
                name: 'AccountSetupPage2',
                params: {
                  newChurch: {
                    id: LOCAL_DRAFT_ID,
                    name: cd.churchName.trim(),
                    type: cd.churchType,
                    city: cd.cityRegion ?? '',
                    country: cd.country,
                    rag_status: ragStatus,
                    verification_status: 'pending',
                    at_capacity: false,
                    leader_count: 0,
                  },
                  newChurchId: LOCAL_DRAFT_ID,
                },
              },
            ],
          }),
        );
      }
    } catch (err) {
      console.log('[RegCP2] submit caught error:', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Church registration failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // v7 similar-church modal CTAs (Founder ruling 2026-06-18).
  //
  // "Go back to search" — collapse the nav stack to [ASP1, ASP2] so the
  // leader lands directly on church search. OnboardingContext keeps the
  // partially-filled church details, so if they back-out of search
  // without picking, RegCP1 still has their entries.
  //
  // "Continue anyway" — close the modal and re-fire handleSubmit with
  // force:true. v7 skips the similarity check on that retry. No
  // double-confirm (Founder ruling 2026-06-18 — modal IS the confirm).
  const handleGoBackToSearch = () => {
    setShowSimilarModal(false);
    setSimilarChurches([]);
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'AccountSetupPage1' },
          { name: 'AccountSetupPage2' },
        ],
      }),
    );
  };
  const handleContinueAnyway = () => {
    setShowSimilarModal(false);
    setSimilarChurches([]);
    void handleSubmit({ force: true });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>{copy.stepLabel2}</Text>
        <Text style={styles.title}>{copy.screenTitle2}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
                  onPress={() => {
                    setRagStatus(option.value);
                    // Persist to OnboardingContext so ASP2 can read it
                    // when building the newChurch payload for create-
                    // account v4. Without this the church-details object
                    // in context is missing rag_status and v4 rejects
                    // the payload as invalid (orphan-prevention 2026-06-14).
                    setChurchDetails({ ragStatus: option.value });
                  }}
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

        {/* Founder ruling 2026-06-12 — "What we have" + "What we need"
            paired required fields, "your ministry" voice applied
            symmetrically to both placeholders so the pair reads as
            one ask. Shared N/A note sits under the pair (not under
            each field) to anchor the guidance once, not twice. Both
            persist to context on every change so back-nav restores
            the leader's work. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{copy.whatWeHaveLabel}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={hasText}
            onChangeText={(v) => {
              setHasText(v);
              setChurchDetails({ hasText: v });
            }}
            placeholder="e.g. skills, space, manpower, resources — what does your ministry already have to offer?"
            placeholderTextColor={Colors.textSubtle}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{copy.whatWeNeedLabel}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={needsText}
            onChangeText={(v) => {
              setNeedsText(v);
              setChurchDetails({ needsText: v });
            }}
            placeholder="e.g. prayer support, theological training, hospitality — what does your ministry need most right now?"
            placeholderTextColor={Colors.textSubtle}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.fieldNote}>
            If you cannot answer now, type N/A — you can update this later in your Church Profile.
          </Text>
        </View>

        {/* Finalization fix 8 — emergency preparedness Q1 + Q2. Tri-state
            Yes / No / unanswered. Tapping the selected option deselects
            (back to null). Both fields are fully optional and never
            gate submission — leaders without an answer ship as null. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            {copy.emergencyPlanLabel} in case of a sudden incident?
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
              onPress={() => {
                // B18 — persist alongside the toggle so edit-path remount
                // and back-nav restore prior selection from context.
                const next = hasEmergencyPlan === true ? null : true;
                setHasEmergencyPlan(next);
                setChurchDetails({ hasEmergencyPlan: next });
              }}
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
              onPress={() => {
                const next = hasEmergencyPlan === false ? null : false;
                setHasEmergencyPlan(next);
                setChurchDetails({ hasEmergencyPlan: next });
              }}
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
          <Text style={styles.label}>{copy.collaborationLabel}</Text>
          <Text style={styles.fieldNote}>
            Optional — this helps us connect you with the right partners.
          </Text>
          <View style={styles.yesNoRow}>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                openToCollaboration === true && styles.yesNoButtonSelected,
              ]}
              onPress={() => {
                // B18 — persist alongside the toggle (same pattern as
                // hasEmergencyPlan above).
                const next = openToCollaboration === true ? null : true;
                setOpenToCollaboration(next);
                setChurchDetails({ openToCollaboration: next });
              }}
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
              onPress={() => {
                const next = openToCollaboration === false ? null : false;
                setOpenToCollaboration(next);
                setChurchDetails({ openToCollaboration: next });
              }}
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
              {isEditMode ? 'Apply Changes' : copy.submitButtonLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* v7 same-room race modal (Founder ruling 2026-06-18). Replaces
          the inline red error text. Surfaces up to 3 similar-match
          candidates with reason chips ("Same email", "Same phone",
          "Same name + city"), and two CTAs. State-level disambiguation
          (task #19) will let copy address the exact-state mismatch. */}
      <Modal
        visible={showSimilarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSimilarModal(false)}
        statusBarTranslucent
      >
        <View style={styles.similarModalBackdrop}>
          <View style={styles.similarModalCard}>
            <Text style={styles.similarModalTitle}>Is this your church?</Text>
            <Text style={styles.similarModalBody}>
              We found {similarChurches.length === 1 ? 'a church' : 'churches'} that may match the one you're registering. If one of these is yours, go back and search for it on the previous screen. If it's in a different state or region, continue anyway.
            </Text>

            <View style={styles.similarMatchList}>
              {similarChurches.map((m) => (
                <View key={m.id} style={styles.similarMatchRow}>
                  <View style={styles.similarMatchTextBlock}>
                    <Text style={styles.similarMatchName}>{m.name}</Text>
                    {m.city ? (
                      <Text style={styles.similarMatchMeta}>{m.city}</Text>
                    ) : null}
                  </View>
                  <View style={styles.similarMatchReasonPill}>
                    <Text style={styles.similarMatchReasonText}>
                      {m.match_reason === 'contact_email'
                        ? 'Same email'
                        : m.match_reason === 'contact_phone'
                        ? 'Same phone'
                        : 'Same name + city'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, styles.similarModalPrimary]}
              onPress={handleGoBackToSearch}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Go back to search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.similarModalSecondary}
              onPress={handleContinueAnyway}
              activeOpacity={0.7}
            >
              <Text style={styles.similarModalSecondaryText}>Continue anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  // Founder ruling 2026-06-12 — the paired "What we have" / "What we
  // need" textareas use an explicit `height` (not minHeight) so iOS
  // can't grow one taller than the other when the placeholder copy
  // wraps to a different number of lines. Both render at the same
  // visual height regardless of content; users still type freely and
  // the field scrolls internally past the visible 4 lines.
  textarea: {
    height: 110,
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

  // v7 similar-church modal (Founder ruling 2026-06-18). Mirrors the
  // pattern of ASP2's skip / replace / delete modals.
  similarModalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  similarModalCard: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  similarModalTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  similarModalBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  similarMatchList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  similarMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md - 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  similarMatchTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  similarMatchName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
  similarMatchMeta: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  similarMatchReasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
  },
  similarMatchReasonText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  similarModalPrimary: {
    marginTop: Spacing.sm,
  },
  similarModalSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  similarModalSecondaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
