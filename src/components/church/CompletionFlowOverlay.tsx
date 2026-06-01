// ─────────────────────────────────────────────
// CompletionFlowOverlay — KAN-213
//
// Full-screen overlay that appears when a verified leader enters the
// Church tab for the first time with profile_completion_done = false.
// Walks them through 3 steps to finalize their church profile before
// entering the network:
//
//   Step -1: Intro       — welcome + begin / skip
//   Step  0: Review      — confirm church name / type / city / country / role
//   Step  1: Enrichment  — website / language / denomination / size chips
//   Step  2: Visibility  — contact toggle + pastoral warning
//
// Gate logic (AC 1):
//   branch === 'active' AND get_church_profile().profile_completion_done === false
//
// Second-leader path (AC 2):
//   branch === 'active' AND profile_completion_done === true
//   AND profile_completion_done_by !== currentUserId → Intro only, "Enter the Network"
//
// Overlay sits at zIndex 28, above UnverifiedGate (zIndex 20).
// NO expo-blur — dim overlay only per project invariant.
//
// Design source: docs/design_handoff_the_church_tab 2/church-tab/completion.jsx
// CD sizing values cited inline throughout.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  CHURCH_TYPES,
  getChurchTypeLabel,
  getRoleLabel,
  ROLES,
} from '../../utils/displayHelpers';

// ─── Types ─────────────────────────────────────────────────────────────

// Extended ChurchProfile shape — includes KAN-213 DBA-lane additions.
// profile_completion_done and profile_completion_done_by are added here
// since the TypeScript type in ChurchProfileBottomSheet predates this ticket.
interface CompletionProfile {
  id: string;
  name: string;
  type: string;
  city: string | null;
  country: string | null;
  website_url: string | null;
  primary_language: string | null;
  denomination_affiliation: string | null;
  congregation_size_range: string | null;
  show_contact_on_profile: boolean;
  profile_completion_done: boolean;
  profile_completion_done_by: string | null;
}

// Draft state held locally between steps — never persisted to DB until
// the "Continue" / "Enter the Network" CTA is pressed for each step.
interface DraftState {
  churchType: string;
  city: string;
  country: string;
  role: string;
  websiteUrl: string;
  primaryLanguage: string;
  denomination: string;
  congregationSize: string; // enum value — not display label
  showContact: boolean;
}

interface Props {
  /** The viewer's public.users.id (NOT auth.uid) — used for AC 2 second-leader check. */
  currentUserId: string;
  /** The viewer's church_id. */
  churchId: string;
  /** The viewer's role as loaded from their users row, for pre-fill. */
  currentRole: string;
  /**
   * Called when the leader completes the flow (Step 3 "Enter the Network" success)
   * or when the second-leader "Enter the Network" CTA is tapped.
   * profile_completion_done is true in DB after this path.
   */
  onComplete: () => void;
  /**
   * Called when the leader taps "Skip · I'll do this later".
   * profile_completion_done stays false. The host sets a session-local flag
   * so the overlay does not re-show during this session (AC 3).
   */
  onSkip: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────

// Congregation size chips — display label → enum value mapping
// Enum values per live Supabase congregation_size_enum (KAN-213 BA anchor).
const CONGREGATION_SIZE_CHIPS: { label: string; value: string }[] = [
  { label: 'Under 50',     value: 'under_50' },
  { label: '50–200',       value: '50_to_200' },
  { label: '200–500',      value: '200_to_500' },
  { label: '500+',         value: 'over_500' },
  { label: 'Not specified', value: 'not_specified' },
];

// Church type options — underground excluded per spec invariant.
// Derived from CHURCH_TYPES with underground filtered out at render.
const COMPLETION_CHURCH_TYPES = CHURCH_TYPES.filter(
  (t) => t.value !== 'underground',
);

// ─── Sub-components ─────────────────────────────────────────────────────

// CD .progress — 3 dots, active/done/pending states.
// Shown on steps 0, 1, 2 only — NOT on Intro (step -1).
function ProgressDots({ currentStep }: { currentStep: 0 | 1 | 2 }) {
  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            i === currentStep && styles.progressDotActive,
            i < currentStep && styles.progressDotDone,
          ]}
        />
      ))}
    </View>
  );
}

// CD .step-header eyebrow — mono uppercase, sky color, above h1 on each step.
function StepHeader({ children }: { children: string }) {
  return <Text style={styles.stepHeader}>{children}</Text>;
}

// Field label — mono uppercase muted
function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// Read-only field display (church name, etc.)
function ReadOnlyField({ value, footnote }: { value: string; footnote?: string }) {
  return (
    <View style={styles.readOnlyWrap}>
      <Text style={styles.readOnlyValue}>{value}</Text>
      {footnote ? <Text style={styles.readOnlyFootnote}>{footnote}</Text> : null}
    </View>
  );
}

// Picker tappable button (church type, role)
function PickerButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.pickerButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.pickerButtonText}>{label}</Text>
      <Text style={styles.pickerChevron}>›</Text>
    </TouchableOpacity>
  );
}

// Bottom sheet picker Modal — reused for both type + role selection.
function SheetPicker<T extends { label: string; value: string }>({
  visible,
  title,
  items,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: T[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.sheetClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.sheetItem,
                  selected === item.value && styles.sheetItemSelected,
                ]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    selected === item.value && styles.sheetItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {selected === item.value ? (
                  <Text style={styles.sheetItemCheck}>✓</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// Primary CTA button
function PrimaryButton({
  label,
  onPress,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.btnPrimary, { flex: 2 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={Colors.background} />
      ) : (
        <Text style={styles.btnPrimaryText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// Ghost CTA button (Back, Close)
function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.btnGhost}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.btnGhostText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Step screens ────────────────────────────────────────────────────────

// Step -1: Intro — CD CompletionIntro
function IntroScreen({
  onBegin,
  onSkip,
  secondLeaderMode = false,
}: {
  onBegin: () => void;
  onSkip: () => void;
  secondLeaderMode?: boolean;
}) {
  return (
    <ScrollView
      style={styles.stepScroll}
      contentContainerStyle={[styles.stepContent, styles.introContent]}
      showsVerticalScrollIndicator={false}
    >
      {/* Cross glyph with radial glow — CD: width 32, height 32, inset -28 */}
      <View style={styles.introGlyphWrap}>
        {/* Radial glow — position absolute, inset -28 from glyph bounds.
            CD: background rgba(107,181,232,0.16) radial circle.
            RN: circular View with sky opacity — no CSS radial-gradient. */}
        <View style={styles.introGlow} />
        <Svg
          width={32}
          height={32}
          viewBox="0 0 32 32"
          style={styles.introGlyph}
        >
          {/* CD .glyph-cross — 32×32, stroke sky */}
          <Line
            x1="16" y1="4"
            x2="16" y2="28"
            stroke={Colors.accent}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <Line
            x1="7" y1="13"
            x2="25" y2="13"
            stroke={Colors.accent}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* Eyebrow */}
      <Text style={styles.introEyebrow}>A welcome</Text>

      {/* h1 */}
      {secondLeaderMode ? (
        <Text style={styles.introH1}>
          Your church is set up — welcome to the network.
        </Text>
      ) : (
        <Text style={styles.introH1}>
          Before you enter the Network,{'\n'}let's finalize your card.
        </Text>
      )}

      {/* Lead */}
      {!secondLeaderMode ? (
        <Text style={styles.introLead}>
          You are verified. Other leaders are waiting to find you. We'll take
          three quiet steps to make sure they can — and that you decide what
          they see.
        </Text>
      ) : (
        // TODO: CONTENT-pending — copy for second-leader welcome confirmed by CONTENT lane
        <Text style={styles.introLead}>
          Another leader from your church has already completed the profile
          setup. You're all set — your church card is ready on the network.
        </Text>
      )}

      {/* CTA row */}
      <View style={styles.introCtaRow}>
        {secondLeaderMode ? (
          <PrimaryButton label="Enter the Network" onPress={onBegin} />
        ) : (
          <PrimaryButton label="Begin" onPress={onBegin} />
        )}
      </View>

      {/* Skip link — only on primary intro, not second-leader */}
      {!secondLeaderMode ? (
        <TouchableOpacity onPress={onSkip} hitSlop={8} style={styles.skipLink}>
          <Text style={styles.skipLinkText}>Skip · I'll do this later</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

// Step 0: Review — CD CompletionStep1
function ReviewScreen({
  draft,
  loadedName,
  loadedRole,
  onNext,
  onBack,
  saving,
  onDraftChange,
}: {
  draft: DraftState;
  loadedName: string;
  loadedRole: string;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  onDraftChange: (partial: Partial<DraftState>) => void;
}) {
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [rolePickerVisible, setRolePickerVisible] = useState(false);

  return (
    <>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressDots currentStep={0} />
        <StepHeader>Step 1 of 3 · Review</StepHeader>
        <Text style={styles.stepH1}>Is this still you?</Text>

        {/* Church name — read-only */}
        <View style={styles.field}>
          <FieldLabel>Church name</FieldLabel>
          <ReadOnlyField
            value={loadedName}
            footnote="Confirmed at verification · cannot be changed here"
          />
        </View>

        {/* Church type — editable, underground excluded */}
        <View style={styles.field}>
          <FieldLabel>Type</FieldLabel>
          <PickerButton
            label={
              draft.churchType
                ? getChurchTypeLabel(draft.churchType)
                : 'Select type…'
            }
            onPress={() => setTypePickerVisible(true)}
          />
        </View>

        {/* City — editable */}
        <View style={styles.field}>
          <FieldLabel>City</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.city}
            onChangeText={(v) => onDraftChange({ city: v })}
            placeholder="City"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Country — editable */}
        <View style={styles.field}>
          <FieldLabel>Country</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.country}
            onChangeText={(v) => onDraftChange({ country: v })}
            placeholder="Country"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Role — editable */}
        <View style={styles.field}>
          <FieldLabel>Your role</FieldLabel>
          <PickerButton
            label={draft.role ? getRoleLabel(draft.role) : 'Select role…'}
            onPress={() => setRolePickerVisible(true)}
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Action bar — fixed outside ScrollView */}
      <View style={styles.actionBar}>
        <GhostButton label="Back" onPress={onBack} />
        <PrimaryButton
          label="Looks right · Continue"
          onPress={onNext}
          loading={saving}
        />
      </View>

      {/* Church type picker — underground excluded per spec invariant */}
      <SheetPicker
        visible={typePickerVisible}
        title="Church Type"
        items={COMPLETION_CHURCH_TYPES}
        selected={draft.churchType}
        onSelect={(v) => onDraftChange({ churchType: v })}
        onClose={() => setTypePickerVisible(false)}
      />

      {/* Role picker */}
      <SheetPicker
        visible={rolePickerVisible}
        title="Your Role"
        items={ROLES as unknown as { label: string; value: string }[]}
        selected={draft.role}
        onSelect={(v) => onDraftChange({ role: v })}
        onClose={() => setRolePickerVisible(false)}
      />
    </>
  );
}

// Step 1: Enrichment — CD CompletionStep2
function EnrichmentScreen({
  draft,
  onNext,
  onBack,
  saving,
  onDraftChange,
}: {
  draft: DraftState;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  onDraftChange: (partial: Partial<DraftState>) => void;
}) {
  return (
    <>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressDots currentStep={1} />
        <StepHeader>Step 2 of 3 · Optional details</StepHeader>
        <Text style={styles.stepH1}>Help others see you clearly.</Text>
        <Text style={styles.stepLead}>
          These are optional — but each one helps another leader recognize
          they have found their people.
        </Text>

        {/* Website URL */}
        <View style={styles.field}>
          <FieldLabel>Website (optional)</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.websiteUrl}
            onChangeText={(v) => onDraftChange({ websiteUrl: v })}
            placeholder="https://"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Primary language */}
        <View style={styles.field}>
          <FieldLabel>Primary language</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.primaryLanguage}
            onChangeText={(v) => onDraftChange({ primaryLanguage: v })}
            placeholder="English"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
          />
        </View>

        {/* Denomination / affiliation */}
        <View style={styles.field}>
          <FieldLabel>Denomination / affiliation (optional)</FieldLabel>
          <TextInput
            style={styles.input}
            value={draft.denomination}
            onChangeText={(v) => onDraftChange({ denomination: v })}
            placeholder="Non-denominational"
            placeholderTextColor={Colors.textSubtle}
            autoCapitalize="words"
          />
        </View>

        {/* Congregation size chips — CD: paddingVertical 8, paddingHorizontal 12,
            fontSize 11.5, borderRadius 100, borderWidth 0.5, gap 6 */}
        <View style={styles.field}>
          <FieldLabel>Congregation size</FieldLabel>
          <View style={styles.chipRow}>
            {CONGREGATION_SIZE_CHIPS.map((chip) => {
              const active = draft.congregationSize === chip.value;
              return (
                <TouchableOpacity
                  key={chip.value}
                  style={[styles.sizeChip, active && styles.sizeChipActive]}
                  onPress={() => onDraftChange({ congregationSize: chip.value })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sizeChipText, active && styles.sizeChipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.actionBar}>
        <GhostButton label="Back" onPress={onBack} />
        <PrimaryButton label="Continue" onPress={onNext} loading={saving} />
      </View>
    </>
  );
}

// Step 2: Visibility — CD CompletionStep3
function VisibilityScreen({
  draft,
  onComplete,
  onBack,
  saving,
  onDraftChange,
}: {
  draft: DraftState;
  onComplete: () => void;
  onBack: () => void;
  saving: boolean;
  onDraftChange: (partial: Partial<DraftState>) => void;
}) {
  const on = draft.showContact;
  return (
    <>
      <ScrollView
        style={styles.stepScroll}
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
      >
        <ProgressDots currentStep={2} />
        <StepHeader>Step 3 of 3 · Contact visibility</StepHeader>
        <Text style={styles.stepH1}>How visible would you like to be?</Text>
        <Text style={styles.stepLead}>
          Connection requests are always sent through Replant. Choose whether
          other verified leaders can also see your email and address directly
          on your profile.
        </Text>

        {/* Contact toggle — CD .toggle */}
        <TouchableOpacity
          style={[styles.toggleRow, on && styles.toggleRowOn]}
          onPress={() => onDraftChange({ showContact: !on })}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
        >
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Show contact on profile</Text>
            <Text style={styles.toggleSub}>
              {on
                ? 'Email and address visible to verified leaders. Phone is never shown.'
                : 'Others can still request a connection — Replant will pass it along.'}
            </Text>
          </View>
          <View style={[styles.switchTrack, on && styles.switchTrackOn]}>
            <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
          </View>
        </TouchableOpacity>

        {/* Pastoral warning box — CD: marginTop 16, padding 12px 14px,
            borderRadius 8, fontSize 12, lineHeight 1.55.
            Mono eyebrow: fontSize 9, letterSpacing 0.2em, uppercase. */}
        <View style={styles.warningBox}>
          <Text style={styles.warningEyebrow}>
            For leaders in restricted contexts
          </Text>
          <Text style={styles.warningBody}>
            Keep this off if you are in a region where being publicly
            identified would cost you something. You can turn it on at any
            time, from anywhere in the world.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.actionBar}>
        <GhostButton label="Back" onPress={onBack} />
        <PrimaryButton
          label="Enter the Network"
          onPress={onComplete}
          loading={saving}
        />
      </View>
    </>
  );
}

// ─── Main overlay ────────────────────────────────────────────────────────

export default function CompletionFlowOverlay({
  currentUserId,
  churchId,
  currentRole,
  onComplete,
  onSkip,
}: Props) {
  // -1 = Intro, 0 = Review, 1 = Enrichment, 2 = Visibility
  const [step, setStep] = useState<-1 | 0 | 1 | 2>(-1);

  // Loaded data from get_church_profile on mount
  const [loadedProfile, setLoadedProfile] = useState<CompletionProfile | null>(null);
  const [loadedName, setLoadedName] = useState('');
  const [loadedRole, setLoadedRole] = useState(currentRole);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Second-leader path: profile is done but by a different leader
  const [secondLeaderMode, setSecondLeaderMode] = useState(false);

  const [saving, setSaving] = useState(false);

  // Draft state — pre-filled from loaded values, held locally between steps.
  const [draft, setDraft] = useState<DraftState>({
    churchType: '',
    city: '',
    country: '',
    role: currentRole,
    websiteUrl: '',
    primaryLanguage: '',
    denomination: '',
    congregationSize: '',
    showContact: true, // AC 6: UI always initialises to true when profile_completion_done = false
  });

  const onDraftChange = useCallback((partial: Partial<DraftState>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Load on mount (AC 9) ───────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase.rpc('get_church_profile', {
      p_church_id: churchId,
    });
    if (error || !data) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const p = data as unknown as CompletionProfile;
    setLoadedProfile(p);
    setLoadedName(p.name ?? '');

    // AC 2: second-leader path — profile complete, done by someone else
    if (p.profile_completion_done && p.profile_completion_done_by !== currentUserId) {
      setSecondLeaderMode(true);
      setStep(-1);
      setLoading(false);
      return;
    }

    // Pre-fill draft from loaded values
    const enriched = [
      p.website_url,
      p.primary_language,
      p.denomination_affiliation,
      p.congregation_size_range,
    ].some((v) => v !== null && v !== undefined && v !== '' && v !== 'not_specified');

    setDraft({
      churchType: p.type ?? '',
      city: p.city ?? '',
      country: p.country ?? '',
      role: currentRole,
      websiteUrl: p.website_url ?? '',
      primaryLanguage: p.primary_language ?? '',
      denomination: p.denomination_affiliation ?? '',
      congregationSize: p.congregation_size_range ?? '',
      // AC 6: always start at true for the visibility toggle
      showContact: true,
    });

    // AC 9: resume at step 0 if any enrichment already saved; else Intro
    if (enriched) {
      setStep(0);
    } else {
      setStep(-1);
    }

    setLoading(false);
  }, [churchId, currentUserId, currentRole]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ── Step save handlers ────────────────────────────────────────────

  // Step 0 (Review) save — update type/city/country + role if changed
  const handleReviewContinue = useCallback(async () => {
    setSaving(true);
    try {
      // AC 4: call update_church_profile with Step 0 fields
      const { error: rpcErr } = await supabase.rpc('update_church_profile', {
        p_church_id: churchId,
        p_church_type: draft.churchType || null,
        p_city: draft.city || null,
        p_country: draft.country || null,
        p_mark_complete: false,
      });
      if (rpcErr) throw rpcErr;

      // TODO: KAN-81 — trigger church-type-changed notification email
      // when draft.churchType !== loadedProfile?.type. The audit log entry
      // is written inside update_church_profile (DBA lane). Email notification
      // call goes here once KAN-81 lands.

      // Role update — only if changed from loaded value
      if (draft.role && draft.role !== loadedRole) {
        const { error: roleErr } = await supabase.rpc('update_leader_role', {
          p_role: draft.role,
        });
        if (roleErr) throw roleErr;
        setLoadedRole(draft.role);
      }

      setStep(1);
    } catch {
      // Non-blocking error: allow user to proceed. A real network failure
      // here is uncommon; data is pre-filled from loaded state. Silently
      // continue rather than blocking entry on a partial save failure.
      // TODO: surface toast error if this happens in practice.
      setStep(1);
    } finally {
      setSaving(false);
    }
  }, [churchId, draft, loadedRole]);

  // Step 1 (Enrichment) save
  const handleEnrichmentContinue = useCallback(async () => {
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('update_church_profile', {
        p_church_id: churchId,
        p_website_url: draft.websiteUrl || null,
        p_primary_language: draft.primaryLanguage || null,
        p_denomination_affiliation: draft.denomination || null,
        p_congregation_size_range: draft.congregationSize || null,
        p_mark_complete: false,
      });
      if (rpcErr) throw rpcErr;
      setStep(2);
    } catch {
      // Non-blocking — see comment in handleReviewContinue.
      setStep(2);
    } finally {
      setSaving(false);
    }
  }, [churchId, draft]);

  // Step 2 (Visibility) complete — sets p_mark_complete: true
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('update_church_profile', {
        p_church_id: churchId,
        p_show_contact_on_profile: draft.showContact,
        p_mark_complete: true,
      });
      if (rpcErr) throw rpcErr;
      onComplete();
    } catch {
      // If the completion RPC fails, call onComplete anyway — profile_completion_done
      // stays false so the flow re-triggers next session. Better than
      // stranding the leader outside the network on a transient error.
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [churchId, draft.showContact, onComplete]);

  // Skip — session-local only. Does NOT set profile_completion_done.
  // Flow re-triggers on next cold launch or tab re-entry (AC 3).
  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  // Second-leader "Enter the Network" — dismiss only, no RPC (AC 2)
  const handleSecondLeaderEnter = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    // Absolute fill, zIndex 28 — sits above UnverifiedGate (zIndex 20).
    // No expo-blur — project invariant. Dim overlay only.
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card} pointerEvents="auto">
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : loadError ? (
          <View style={styles.loadingBox}>
            <Text style={styles.errorText}>
              Couldn't load your church profile right now.
            </Text>
            <TouchableOpacity onPress={loadProfile} hitSlop={8}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {step === -1 ? (
              <IntroScreen
                onBegin={secondLeaderMode ? handleSecondLeaderEnter : () => setStep(0)}
                onSkip={handleSkip}
                secondLeaderMode={secondLeaderMode}
              />
            ) : step === 0 ? (
              <ReviewScreen
                draft={draft}
                loadedName={loadedName}
                loadedRole={loadedRole}
                onNext={handleReviewContinue}
                onBack={() => setStep(-1)}
                saving={saving}
                onDraftChange={onDraftChange}
              />
            ) : step === 1 ? (
              <EnrichmentScreen
                draft={draft}
                onNext={handleEnrichmentContinue}
                onBack={() => setStep(0)}
                saving={saving}
                onDraftChange={onDraftChange}
              />
            ) : (
              <VisibilityScreen
                draft={draft}
                onComplete={handleComplete}
                onBack={() => setStep(1)}
                saving={saving}
                onDraftChange={onDraftChange}
              />
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Overlay wrapper — CD: absolute fill, zIndex 28, rgba dim background.
  // Sits above UnverifiedGate (zIndex 20). NO expo-blur per project invariant.
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 28,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  // Card — occupies bottom ~85% of screen, rounded top corners.
  // Mirrors the sheet pattern from ChurchProfileBottomSheet.
  card: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    minHeight: '60%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },

  // ── Step layout ──
  stepScroll: { flex: 1 },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    gap: 16,
  },
  introContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
  },

  // ── Intro ──
  introGlyphWrap: {
    position: 'relative',
    width: 32,
    height: 32,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // CD: position absolute, inset -28, background rgba(107,181,232,0.16) radial circle
  introGlow: {
    position: 'absolute',
    // inset -28 from 32×32 glyph → glow container = 32 + 28*2 = 88×88
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(107,181,232,0.16)',
    top: -28,
    left: -28,
  },
  introGlyph: { position: 'relative' },
  introEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 4,
    textAlign: 'center',
  },
  introH1: {
    fontFamily: Typography.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.22,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    maxWidth: 300,
  },
  introLead: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20.5, // ~1.58 × 13
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 8,
  },
  introCtaRow: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
  },
  skipLink: {
    marginTop: 14,
    paddingVertical: 8,
  },
  skipLinkText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textAlign: 'center',
  },

  // ── Progress dots — CD .progress ──
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    backgroundColor: 'transparent',
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  progressDotDone: {
    backgroundColor: 'rgba(107, 181, 232, 0.35)',
    borderColor: 'rgba(107, 181, 232, 0.35)',
  },

  // ── Step header eyebrow — CD .step-header ──
  // Above h1 on each step: mono uppercase sky, letter-spaced
  stepHeader: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 2,
  },

  // ── Step headings ──
  stepH1: {
    fontFamily: Typography.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: 0.24,
    color: Colors.text,
    marginBottom: 4,
  },
  stepLead: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20.5,
    color: Colors.textMuted,
    marginBottom: 4,
  },

  // ── Field ──
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.52,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  // Read-only field (church name)
  readOnlyWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 4,
  },
  readOnlyValue: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  readOnlyFootnote: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    color: Colors.textSubtle,
  },

  // Editable input
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },

  // Picker button (tappable selector)
  pickerButton: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  pickerButtonText: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  pickerChevron: {
    fontFamily: Typography.body,
    fontSize: 18,
    color: Colors.textMuted,
  },

  // ── Congregation size chips — CD exact values ──
  // paddingVertical: 8, paddingHorizontal: 12, fontSize: 11.5,
  // borderRadius: 100, borderWidth: 0.5, gap: 6
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sizeChipActive: {
    // Active: borderColor sky-mid, backgroundColor sky-dim, color sky
    borderColor: 'rgba(107, 181, 232, 0.45)', // sky-mid
    backgroundColor: 'rgba(107, 181, 232, 0.08)', // sky-dim
  },
  sizeChipText: {
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  sizeChipTextActive: {
    color: Colors.accent,
  },

  // ── Visibility toggle — CD .toggle ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
  },
  toggleRowOn: {
    borderColor: Colors.borderAccent,
    backgroundColor: 'rgba(107, 181, 232, 0.04)',
  },
  toggleTextCol: { flex: 1 },
  toggleTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13.5,
    color: Colors.text,
  },
  toggleSub: {
    marginTop: 3,
    fontFamily: Typography.body,
    fontSize: 11.5,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(240, 237, 230, 0.10)',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: Colors.accent },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.text,
  },
  switchKnobOn: { alignSelf: 'flex-end', backgroundColor: Colors.background },

  // ── Pastoral warning box — CD exact values ──
  // marginTop: 16, padding: '12px 14px' → paddingVertical: 12, paddingHorizontal: 14
  // borderRadius: 8, fontSize: 12, lineHeight: 1.55
  // Warning box mono eyebrow: fontSize: 9, letterSpacing: 0.2em × 9 = 1.8, uppercase
  warningBox: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(107, 181, 232, 0.06)', // sky-faint
    borderWidth: 0.5,
    borderColor: 'rgba(107, 181, 232, 0.30)', // sky-mid
    borderRadius: 8,
  },
  warningEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8, // 0.2em × 9
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 6,
  },
  warningBody: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18.6, // 1.55 × 12
    color: Colors.textMuted,
  },

  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },

  // ── Buttons ──
  btnPrimary: {
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: Colors.accent,
  },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32, // 0.12em × 11
    color: Colors.background,
    textTransform: 'uppercase',
  },
  btnGhost: {
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    backgroundColor: 'transparent',
    flex: 1,
  },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32,
    color: Colors.accent,
    textTransform: 'uppercase',
  },

  // ── Picker sheet (church type / role) ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  sheetItem: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  },
  sheetItemCheck: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
  },
});
