// ─────────────────────────────────────────────
// Screen 05 — Register Church, Page 1
// Church details. Underground type hides location fields immediately on selection.
// "Church branch" displays in UI (Founder lock 2026-06-18) — stored as `branch` per SPEC.
// RAG defaults to Red for Underground, any value permitted.
// Screen 10 (map pin) is next for non-Underground types — gated on MAP wiring.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import {
  CHURCH_TYPES,
  RAG_OPTIONS,
  orgCopy,
  isParaMinistry,
  canMarkHeadquarters,
  PARA_MINISTRY_TOOLTIP,
} from '../../utils/displayHelpers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';
import ParentChurchPicker, {
  ParentChurch,
  ParentSelection,
} from '../../components/onboarding/ParentChurchPicker';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RegisterChurchPage1'>;

const IS_UNDERGROUND = (type: string) => type === 'underground';

// KAN-13 — canonical declaration text passed to register-church as
// state_declaration. Matches the affirmation copy shown to the user on
// the Declaration of Faith screen (Screen 02). The DB column is text
// NOT NULL; this string is the user's record of what they affirmed.
const STATE_DECLARATION_AFFIRMATION =
  'I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth.';

// KAN-13 — register-church BE endpoint URL.
const REGISTER_CHURCH_URL = `${SUPABASE_URL}/functions/v1/register-church`;

// KAN-13 — Underground submission shape sent to register-church.
// city / lat / lng are intentionally absent — the BE force-strips them on
// type='underground' anyway, but FE not sending them keeps the wire clean.
// KAN-13 v2 — contact_name is required; contact_email is optional under
// the at-least-one-of-email-or-phone rule. contact_name is admin-only PII
// and is NOT stripped on the underground path (the verification team
// needs to be able to reach the leader).
interface RegisterChurchUndergroundPayload {
  name: string;
  type: 'underground';
  country: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  rag_status: string;
  state_declaration: string;
}

interface RegisterChurchSuccessResponse {
  success: true;
  church_id: string;
  verification_status: 'pending';
  verification_deadline: string;
  message: string;
}

export default function RegisterChurchPage1Screen({ navigation, route }: Props) {
  const {
    state,
    setChurchDetails,
    setParentRef,
    setPendingParentClaim,
    setIsHeadquarters,
  } = useOnboarding();
  const personalDetails = state.personalDetails;
  // B4 — editChurch pre-fill. When ASP2's Edit affordance routes here,
  // basic identity fields seed from the leader's existing selection so
  // they can fix a typo without re-typing. Contact fields aren't in
  // ChurchResult — they pre-fill from OnboardingContext.churchDetails.
  // Submit path: RegCP2 routes edits to the `update-church` edge function
  // (KAN-207, JWT + ownership-verified PATCH) when editChurchId points
  // at a DB-resident row; for mid-signup loopback edits, the church
  // lives only in OnboardingContext until atomic create-account fires
  // on "Enter Replant" — no orphan path.
  const editChurch = route.params?.editChurch;
  const isEditMode = !!editChurch;

  // 2026-06-18 — Branch-flow entry mode. RegisterIntroScreen routes here with
  // entry='standalone' | 'branch' | 'underground'. Edit path has no entry param
  // (defaults to 'standalone'). Auto-sets churchType for the mutually-exclusive
  // branch / underground paths.
  const entry = route.params?.entry ?? 'standalone';
  const isBranchEntry = entry === 'branch';
  const isUndergroundEntry = entry === 'underground';

  const [churchName, setChurchName] = useState(editChurch?.churchName ?? '');
  const [churchType, setChurchType] = useState(
    editChurch?.churchType ??
      (isBranchEntry ? 'branch' : isUndergroundEntry ? 'underground' : ''),
  );

  // ParentChurchPicker state — only used in branch entry. Selection writes to
  // OnboardingContext (parentRef or pendingParentClaim) so ASP2 can read it
  // and pass to create-account v7.
  //
  // 2026-06-19 — when the screen mounts in branch Edit mode (ASP2 bypass-card
  // Edit on a branch row), HYDRATE local picker state from OnboardingContext
  // so the previously-picked parent re-shows. Without this hydration, local
  // state starts null + the mirror effect below nukes context's parentRef.
  const initialParentSelection = useMemo<ParentSelection>(() => {
    if (!isBranchEntry) return null;
    if (state.parentRef) {
      return {
        id: state.parentRef.id,
        name: state.parentRef.name,
        city: state.parentRef.city,
        country: state.parentRef.country,
        type: state.parentRef.type,
        verificationStatus: state.parentRef.verificationStatus,
        rplId: state.parentRef.churchCode ?? '',
        isHeadquarters: state.parentRef.isHeadquarters ?? false,
      };
    }
    if (state.pendingParentClaim) {
      return {
        deferred: true,
        claimName: state.pendingParentClaim.name ?? '',
        claimCity: state.pendingParentClaim.city ?? '',
        claimCountry: state.pendingParentClaim.country ?? '',
      };
    }
    // 2026-06-19 — on Edit re-entry with no real parent + no claim, restore
    // the "link later" deferred card (the leader's committed posture) instead
    // of the blank picker idle state. With the new no-claim-required model,
    // a branch with no parent info is a valid terminal state; the leader
    // should re-enter where they left off, not get demoted to "make a choice."
    if (isEditMode) return { deferred: true };
    return null;
    // Hydrate once at mount only; subsequent picker changes flow through
    // setParentSelection + the mirror effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [parentSelection, setParentSelection] =
    useState<ParentSelection>(initialParentSelection);

  // HQ self-asserted at signup. Hidden for branch / para / underground; only
  // visible when canMarkHeadquarters(churchType) returns true.
  // HQ checkbox hydrates from OnboardingContext (the durable pre-submit store)
  // so that Edit-from-ASP2-bypass round-trips don't wipe a prior selection.
  // 2026-06-19 device pass: previously initialized to `false`, which the
  // mirror useEffect then echoed back into context, clobbering the user's
  // intent every time RegCP1 remounted in Edit mode.
  const [hqChecked, setHqChecked] = useState(state.isHeadquarters ?? false);
  // Mirror to context whenever the leader toggles it.
  useEffect(() => {
    setIsHeadquarters(hqChecked);
  }, [hqChecked, setIsHeadquarters]);
  // Reset HQ if the leader changes type to one that can't be HQ.
  useEffect(() => {
    if (!canMarkHeadquarters(churchType) && hqChecked) {
      setHqChecked(false);
    }
  }, [churchType, hqChecked]);

  // Mirror ParentChurchPicker selection into OnboardingContext.
  useEffect(() => {
    if (!isBranchEntry) return;
    if (parentSelection === null) {
      setParentRef(null);
      setPendingParentClaim(null);
      return;
    }
    if ('deferred' in parentSelection) {
      // Deferred — leader typed parent locally; claim populated via Name+City
      // captured in OnboardingContext.churchDetails (re-used here since the
      // branch's own name+city are NOT the parent's). For MVP the claim is
      // synthesized from the picker's deferred branch with placeholder data;
      // the picker's deferred path is a sentinel meaning "leader confirmed
      // parent not on Replant yet" — the leader still types their branch's
      // OWN name + city below. Submit-time we populate the claim payload.
      setParentRef(null);
      // pendingParentClaim is populated at submit time from the branch's own
      // typed parent name; see handleNext.
    } else {
      setParentRef({
        id: parentSelection.id,
        name: parentSelection.name,
        city: parentSelection.city ?? null,
        country: parentSelection.country ?? null,
        type: parentSelection.type,
        verificationStatus: parentSelection.verificationStatus,
        churchCode: parentSelection.rplId ?? null,
        isHeadquarters: parentSelection.isHeadquarters,
      });
      setPendingParentClaim(null);
    }
  }, [parentSelection, isBranchEntry, setParentRef, setPendingParentClaim]);

  // Supabase-RPC-backed lookup functions for ParentChurchPicker.
  const lookupByRplId = useCallback(
    async (rplId: string): Promise<ParentChurch | null> => {
      const { data, error } = await supabase.rpc('find_church_by_code', {
        p_church_code: rplId,
      });
      if (error) return null;
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        city: row.city ?? '',
        country: row.country ?? '',
        type: row.type,
        isHeadquarters: !!row.is_headquarters,
        verificationStatus: row.verification_status === 'verified' ? 'verified' : 'pending',
        rplId: row.church_code ?? '',
      };
    },
    [],
  );

  const searchByName = useCallback(
    async (q: string): Promise<ParentChurch[]> => {
      const { data, error } = await supabase.rpc('find_parentable_churches', {
        p_query: q,
      });
      if (error || !Array.isArray(data)) return [];
      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        city: row.city ?? '',
        country: row.country ?? '',
        type: row.type,
        isHeadquarters: !!row.is_headquarters,
        verificationStatus: row.verification_status === 'verified' ? 'verified' : 'pending',
        rplId: row.church_code ?? '',
      }));
    },
    [],
  );
  const [country, setCountry] = useState(editChurch?.country ?? '');
  const [cityRegion, setCityRegion] = useState(editChurch?.cityRegion ?? '');
  // B17 — on the edit path, seed contact + address fields from
  // OnboardingContext.churchDetails (persisted from the original
  // registration). ChurchResult never carries contact fields; context
  // does. Non-edit path starts blank as before.
  const [address, setAddress] = useState(
    isEditMode ? (state.churchDetails.address ?? '') : '',
  );
  // KAN-13 v2 — contact_name is required (admin-only PII).
  const [contactName, setContactName] = useState(
    isEditMode ? (state.churchDetails.contactName ?? '') : '',
  );
  const [contactEmail, setContactEmail] = useState(
    isEditMode ? (state.churchDetails.contactEmail ?? '') : '',
  );
  const [contactPhone, setContactPhone] = useState(
    isEditMode ? (state.churchDetails.contactPhone ?? '') : '',
  );
  // KAN-13 finalization — "Same as my account info" pre-fill toggle.
  // Pre-fills name + email from personalDetails on check; clears on
  // uncheck. Fields remain editable after pre-fill (the checkbox does
  // not lock them); the checkbox is just an entry-shortcut.
  //
  // 2026-06-20 — Hydrate from churchDetails on Edit re-entry. If the
  // persisted contact fields match the leader's account info (i.e. the
  // checkbox was checked on the original pass), restore the checked
  // state so the leader doesn't have to re-tick it. Inferred from a
  // field-equality check rather than a separate persisted boolean —
  // works equally well if the leader manually typed matching values.
  const [sameAsMyInfo, setSameAsMyInfo] = useState(() => {
    if (!isEditMode) return false;
    const expectedName = [personalDetails.firstName, personalDetails.lastName]
      .filter(Boolean)
      .join(' ');
    const expectedEmail = personalDetails.email ?? '';
    const cd = state.churchDetails;
    return (
      !!expectedName &&
      cd.contactName === expectedName &&
      cd.contactEmail === expectedEmail
    );
  });
  const [ragStatus, setRagStatus] = useState(editChurch?.ragStatus ?? '');
  // 2026-06-20 — Underground optional needs/share fields (Founder ruling).
  // Underground founders skip RegCP2 entirely, but should still be able
  // to optionally tell the network what they need (bibles, training, prayer)
  // and what they can share (encouragement, prayer, experience). Both
  // optional. Stored in churchDetails so ASP2's create-account composer
  // picks them up alongside the standard-flow values.
  const [undergroundNeedsText, setUndergroundNeedsText] = useState(
    state.churchDetails.needsText ?? '',
  );
  const [undergroundHasText, setUndergroundHasText] = useState(
    state.churchDetails.hasText ?? '',
  );

  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  // B16 — tap-reveal ⓘ tooltip for the City field. PR #58's B11 fix
  // incorrectly converted this to an always-visible caption; the
  // CWW (churches-without-walls) note belongs behind the tooltip per
  // original design intent. Only the underground-privacy line (which
  // was always unreachable under !isUnderground) stays removed.
  const [showCityTooltip, setShowCityTooltip] = useState(false);
  const [showParaTooltip, setShowParaTooltip] = useState(false);
  // Para tooltip visibility inside the type picker sheet (before-selection
  // discoverability per Founder ruling 2026-06-18 device pass).
  const [sheetParaTooltipOpen, setSheetParaTooltipOpen] = useState(false);

  // KAN-13 — Underground submission state. submitting blocks the Next button
  // + spinner; submitError surfaces inline above the button (matches the
  // styles.errorText pattern from AccountSetupPage1/2 — no new error style).
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // KAN-192 — phantom-inset defense on screen focus. Mirror of the
  // useFocusEffect on AccountSetupPage2Screen. ASP2's KAV-wrapped
  // siblings + the search field on ASP2 itself can leak a residual
  // iOS keyboard inset across the push transition; the two ScrollView
  // props (automaticallyAdjustKeyboardInsets / contentInsetAdjustmentBehavior)
  // prevent NEW adjustments but don't zero a pre-existing inset.
  // Forcing scrollTo({y:0}) + Keyboard.dismiss() on focus restores a
  // usable cold landing regardless of entry path (handleRegisterNew
  // from ASP2 — search field active; handleBypassEdit from ASP2 —
  // edit pre-fills; or back-nav from RegCP2).
  const scrollViewRef = useRef<ScrollView | null>(null);
  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, []),
  );

  const isUnderground = IS_UNDERGROUND(churchType);
  const isBranch = churchType === 'branch';
  const isPara = isParaMinistry(churchType);
  const copy = orgCopy(churchType);
  // Disable the type picker when the entry pre-set the type (branch / underground).
  const typeLocked = isBranchEntry || isUndergroundEntry;
  // 2026-06-18 device pass v2: in branch entry, hide the standard fields
  // (country / city / address / contact) UNTIL the leader has either selected
  // a real parent church or chosen the deferred ("link later") sentinel.
  // Otherwise the screen is cluttered with empty fields before the leader has
  // a sense of what they're registering. On Edit, initialParentSelection
  // restores the leader's committed posture (real parent or deferred) so this
  // hide path only fires on truly-fresh entries.
  const hideStandardFields = isBranchEntry && parentSelection === null;
  // 2026-06-19 — when the leader picked "Parent not on Replant yet", the
  // branch needs a SELF-SUFFICIENT name (parent isn't known yet to suffix it
  // with). Label + placeholder pivot accordingly.
  const isDeferredBranch =
    isBranchEntry && parentSelection !== null && 'deferred' in parentSelection;

  // KAN-13 finalization — "Same as my account info" handler. Pre-fills
  // contactName + contactEmail from personalDetails on check; clears
  // all three contact fields on uncheck. Phone is not pre-filled (not
  // collected on Page 1 of account setup).
  const handleSameAsMyInfo = (checked: boolean) => {
    setSameAsMyInfo(checked);
    if (checked) {
      const fullName = [personalDetails.firstName, personalDetails.lastName]
        .filter(Boolean)
        .join(' ');
      setContactName(fullName);
      setContactEmail(personalDetails.email ?? '');
      setContactPhone('');
    } else {
      setContactName('');
      setContactEmail('');
      setContactPhone('');
    }
  };

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

  // 2026-06-18 — Branch entry: validate parent selection (real parent OR
  // deferred sentinel). Without one, the branch can't proceed.
  const hasParentChoice = parentSelection !== null;

  // 2026-06-20 — Underground entry auto-sets churchType='underground' at
  // initial state without going through handleTypeSelect, so the RAG
  // auto-set inside that handler never fires. Mirror it here: when type
  // is underground and ragStatus hasn't been set yet, default to 'red'.
  // Without this, isFormValid stays false and Submit Church stays disabled
  // even with every field populated.
  useEffect(() => {
    if (churchType === 'underground' && !ragStatus) {
      setRagStatus('red');
    }
  }, [churchType, ragStatus]);

  // KAN-13 v2 — contact_name required; at-least-one of email/phone.
  // KAN-13 finalization — ragStatus only required on the underground
  // path (UG submits from Page 1). Non-underground churches choose
  // ragStatus on RegisterChurchPage2.
  // 2026-06-18 device pass v2 — fields are visible (and required) after the
  // branch leader picks a parent or selects deferred. Parent choice gates
  // the rest of the form for branch entry.
  const isFormValid =
    churchName.trim() &&
    churchType &&
    country &&
    (isUnderground || cityRegion.trim()) &&
    contactName.trim() &&
    (contactEmail.trim() || contactPhone.trim()) &&
    (!isUnderground || ragStatus) &&
    (!isBranchEntry || hasParentChoice);

  // KAN-13 — submit the Underground registration to register-church.
  // Throws on any non-200 response; caller surfaces error to the user.
  const submitUnderground = async (): Promise<RegisterChurchSuccessResponse> => {
    const payload: RegisterChurchUndergroundPayload = {
      name: churchName.trim(),
      type: 'underground',
      country,
      contact_name: contactName.trim(),
      rag_status: ragStatus,
      state_declaration: STATE_DECLARATION_AFFIRMATION,
    };
    if (contactEmail.trim()) payload.contact_email = contactEmail.trim();
    if (contactPhone.trim()) payload.contact_phone = contactPhone.trim();

    const response = await fetch(REGISTER_CHURCH_URL, {
      method: 'POST',
      headers: {
        // No Authorization header — verify_jwt=false on register-church
        // (user has no auth.users row yet at this point in onboarding).
        // apikey is still required for the Supabase gateway to route the call.
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Try to surface the BE's `error` string when present; fall back to
      // a generic message so a 5xx with no body doesn't crash the screen.
      let beError: string | null = null;
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body?.error === 'string') beError = body.error;
      } catch {
        // ignore body-parse errors — fall through to generic
      }
      throw new Error(
        beError ?? 'Church registration failed. Please try again.',
      );
    }

    return (await response.json()) as RegisterChurchSuccessResponse;
  };

  const handleNext = async () => {
    // setChurchDetails stays at the top of the handler so context is
    // populated even on submission failure (the next attempt picks up
    // the latest field values; back-nav doesn't lose them).
    // 2026-06-18 — for para_ministry, force rag_status='green' since the RAG
    // section is hidden in UI; BE validator still requires the field.
    const effectiveRag = isPara ? 'green' : ragStatus;

    // 2026-06-18 device pass v2 — Founder ruling: branch leaders type their
    // own country/city/address/contact (visible after parent picked or
    // deferred). No auto-derivation from parent; branches are typically in
    // a different city than their parent. Standard typed values flow through.
    setChurchDetails({
      churchName,
      churchType,
      country,
      cityRegion: isUnderground ? undefined : cityRegion,
      address: isUnderground ? undefined : address,
      contactName,
      contactEmail,
      contactPhone,
      ragStatus: effectiveRag,
    });

    // 2026-06-19 — Branch entry: claim writes are now OPTIONAL.
    // Only persist pendingParentClaim if leader actually typed a parent name
    // in the deferred-card inputs. Empty → no claim row written at all (per
    // Founder's parent-delegation-is-top-down ruling). Real parent picks set
    // parentRef via the picker useEffect; both never coexist.
    if (isBranchEntry && parentSelection && 'deferred' in parentSelection) {
      const claimName = (parentSelection.claimName ?? '').trim();
      const claimCity = (parentSelection.claimCity ?? '').trim();
      const claimCountry = (parentSelection.claimCountry ?? '').trim();
      if (claimName) {
        setPendingParentClaim({
          name: claimName,
          city: claimCity || null,
          country: claimCountry || null,
        });
      } else {
        setPendingParentClaim(null);
      }
    }

    if (isUnderground) {
      // 2026-06-19 (Ask 2 · Rulings #10/#11) — underground submit now
      // routes to the name-visibility choice screen FIRST. That screen
      // captures show_church_name + calls register-church (validation-
      // only) + loopbacks to ASP2 with the same newChurch sentinel that
      // this path used to produce. The atomic DB write still happens
      // later via create-account v8 on ASP2 submit (orphan-prevention).
      //
      // No submitting/submitError reset needed — NameVisibilityChoice
      // owns the network call now. setChurchDetails above already
      // persisted everything else this screen captured.
      navigation.navigate('NameVisibilityChoice');
    } else {
      // KAN-14: advance to Page 2 for needs + final submit.
      // B4 — on the edit path, forward isEditMode + editChurch so Page 2
      // can swap the submit button label to "Apply Changes" and (future)
      // pre-fill needs/resources/emergency-plan when those become
      // PATCH-able. MVP: Page 2 still submits a new church row.
      if (isEditMode) {
        navigation.navigate('RegisterChurchPage2', {
          isEditMode: true,
          editChurch,
        });
      } else {
        navigation.navigate('RegisterChurchPage2');
      }
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
    // KAN-192 layout pattern (mirrors AccountSetupPage2Screen).
    // See ASP2Screen.tsx for the full rationale. Three rules:
    //   1. NO KeyboardAvoidingView.
    //   2. Footer in flex flow at end of root (NOT position: absolute).
    //   3. ScrollView with `automaticallyAdjustKeyboardInsets={false}`
    //      + `contentInsetAdjustmentBehavior="never"` to kill iOS's
    //      phantom keyboard contentInset that lingers from the
    //      previous screen and would otherwise let the user scroll
    //      the entire body off the top of the viewport.
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>
          {isBranchEntry ? 'REGISTER CHURCH BRANCH · 1 OF 2' : copy.stepLabel}
        </Text>
        <Text style={styles.title}>
          {isBranchEntry ? 'Branch Details' : copy.screenTitle}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* 2026-06-18 — Branch entry: ParentChurchPicker leads the form.
            Replaces the standalone type picker (we already know type='branch'). */}
        {isBranchEntry && (
          <View style={styles.fieldGroup}>
            <ParentChurchPicker
              value={parentSelection}
              onChange={setParentSelection}
              lookupByRplId={lookupByRplId}
              searchByName={searchByName}
            />
          </View>
        )}

        {/* Church / Organization / Branch Name — copy swaps via orgCopy().
            2026-06-19 device pass v3: in branch entry, the name field is hidden
            until the parent is picked (or deferred) — Founder ruling: the
            branch name was rendering out-of-place at the bottom of an otherwise
            empty page. Now groups with the rest of the data fields. */}
        {!hideStandardFields && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {isBranchEntry ? 'Your church name + branch identifier' : copy.nameLabel}
            </Text>
            {isUnderground && (
              // 2026-06-19 (Ask 2 · Ruling #10) — Updated copy. The name
              // is no longer always hidden; the next step (NameVisibilityChoice)
              // captures the leader's show/hide preference. The default
              // remains hidden, so this note still reads accurate for the
              // common path.
              <Text style={styles.fieldNote}>
                Your church name stays private by default. You&rsquo;ll choose how
                other leaders see it on the next step.
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={churchName}
              onChangeText={setChurchName}
              placeholder={
                isBranchEntry
                  ? isDeferredBranch
                    ? 'e.g., Test Ministry Atlanta Parish'
                    : parentSelection !== null && 'name' in parentSelection
                      ? `e.g., ${parentSelection.name} Atlanta Parish`
                      : 'e.g., Maranatha Ministries Atlanta Parish'
                  : copy.namePlaceholder
              }
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
        )}

        {/* Church / Organization Type — hidden when entry pre-set the type
            (branch / underground both auto-set; user picks for standalone). */}
        {!typeLocked && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{copy.typeLabel}</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setTypePickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={churchType ? styles.pickerValue : styles.pickerPlaceholder}>
                {churchType
                  ? CHURCH_TYPES.find(t => t.value === churchType)?.label
                  : `Select ${copy.typeLabel.toLowerCase()}`}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            {/* Para-ministry tap-reveal tooltip — CONTENT F2 locked string.
                Uses the BLUE informational notice (not the red underground one)
                per Founder ruling 2026-06-18 device pass v2. */}
            {isPara && showParaTooltip && (
              <View style={styles.infoNotice}>
                <Text style={styles.infoNoticeText}>{PARA_MINISTRY_TOOLTIP}</Text>
              </View>
            )}
            {isPara && !showParaTooltip && (
              <TouchableOpacity
                onPress={() => setShowParaTooltip(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginTop: 6, alignSelf: 'flex-start' }}
              >
                <Text style={styles.tooltipIcon}>ⓘ What's this?</Text>
              </TouchableOpacity>
            )}

            {/* Underground inline notice */}
            {isUnderground && (
              <View style={styles.undergroundNotice}>
                <Text style={styles.undergroundNoticeText}>
                  City/Region and Address are hidden to protect your identity. Your church displays
                  as "Underground Church" to other users. Country is kept for internal categorisation
                  only and is never shown publicly.
                </Text>
              </View>
            )}

            {/* Mark as Headquarters checkbox — visible only for parentable types
                (Founder ruling 2026-06-18). Leader self-asserts at signup; admin
                confirms in normal verification flow. NOT available for branch /
                para / underground per the DB trigger fence. */}
            {canMarkHeadquarters(churchType) && (
              <TouchableOpacity
                style={styles.hqRow}
                onPress={() => setHqChecked(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.hqCheckbox, hqChecked && styles.hqCheckboxOn]}>
                  {hqChecked && <Text style={styles.hqCheckmark}>✓</Text>}
                </View>
                <Text style={styles.hqLabel}>Mark as Headquarters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Country / City / Address / Contact — progressive disclosure on
            branch entry (Founder ruling 2026-06-18 device pass v2): hidden
            UNTIL the leader has picked a parent or chosen "link later".
            Once shown, branch leaders still type their own country/city/etc
            (branches are typically in a different city than their parent). */}
        {!hideStandardFields && (
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
        )}

        {/* City / Region — hidden for Underground + (branch with no parent picked).
            B16 — tap-reveal ⓘ tooltip restored. PR #58 B11 incorrectly
            removed the tooltip mechanism; only the underground-privacy
            line was the regression target. CWW note stays as tap-reveal
            per original design intent. */}
        {!isUnderground && !hideStandardFields && (
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>City</Text>
              <TouchableOpacity
                onPress={() => setShowCityTooltip(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Text style={styles.tooltipIcon}>ⓘ</Text>
              </TouchableOpacity>
            </View>
            {showCityTooltip && (
              <Text style={styles.fieldNote}>
                Online ministries and churches without walls can enter their HQ or broadcast city.
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={cityRegion}
              onChangeText={setCityRegion}
              placeholder="City where church is based"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="words"
            />
          </View>
        )}

        {/* Address — optional, hidden for Underground + (branch with no parent picked) */}
        {!isUnderground && !hideStandardFields && (
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

        {/* Contact Details section — hidden in branch entry UNTIL parent picked.
            Branch leaders still type their own contact info; not auto-inherited. */}
        {!hideStandardFields && (
          <>
            <Text style={styles.sectionLabel}>Contact Details</Text>

            {/* "Same as my account info" pre-fill — KAN-13 finalization.
                Quick path for leaders who are themselves the church's primary
                contact. Pre-fills name + email; phone is left blank because
                account setup doesn't collect it. Fields stay editable. */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleSameAsMyInfo(!sameAsMyInfo)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  sameAsMyInfo && styles.checkboxChecked,
                ]}
              >
                {sameAsMyInfo && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Same as my account info</Text>
            </TouchableOpacity>

            {/* Contact Name — required */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact Name</Text>
              <Text style={styles.fieldNote}>
                Seen only by the Replant verification team — never shown publicly.
              </Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={setContactName}
                placeholder={copy.contactNamePlaceholder}
                placeholderTextColor={Colors.textSubtle}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Contact Email — no longer required at field level */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contact Email</Text>
              <Text style={styles.fieldNote}>{copy.contactValidationNote}</Text>
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder={isPara ? 'organization@example.com' : 'church@example.com'}
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
          </>
        )}

        {/* RAG Status — KAN-13 finalization: visible ONLY on the
            underground path (UG submits from Page 1 and needs the
            status). Non-underground churches choose Current Status on
            RegisterChurchPage2 with description text per option.
            2026-06-19 (Ask 5 · Ruling #33) — both dual notes removed
            (they contradicted each other) and replaced with a single
            soft-blue informational note below the RAG row. RAG behavior
            unchanged — rag_status='red' forced server-side; Green/Amber
            muted + non-interactive. */}
        {isUnderground && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Current Status</Text>
            <View style={styles.ragOptions}>
              {RAG_OPTIONS.map(option => {
                // Underground status lock per SPEC: only Red is selectable;
                // Green and Amber are visually muted and non-interactive.
                // Red itself is not deselectable while underground (no toggle
                // off → the form always has a valid ragStatus).
                const lockedOut = option.value !== 'red';
                const isSelected = ragStatus === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.ragOption,
                      isSelected && !lockedOut && {
                        borderColor: option.color,
                        backgroundColor: `${option.color}12`,
                      },
                      lockedOut && styles.ragOptionLocked,
                    ]}
                    onPress={() => {
                      // Underground RAG is locked to red — no interaction.
                    }}
                    disabled={lockedOut}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.ragDot, { backgroundColor: option.color }]} />
                    <Text style={[
                      styles.ragOptionText,
                      isSelected && !lockedOut && { color: option.color },
                    ]}>
                      {option.label}
                    </Text>
                    {isSelected && !lockedOut && (
                      <View style={styles.ragCheck}>
                        <Text style={[styles.ragCheckText, { color: option.color }]}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Founder-final soft-blue note (Ask 5 · Ruling #33).
                Replaces the prior two contradictory notes. Red is reserved
                for things the leader can act on; the lock is simply a fact
                about how underground churches are recorded — reads
                informational, not alarming. */}
            <View style={styles.undergroundRagNote}>
              <Text style={styles.undergroundRagNoteIco}>ⓘ</Text>
              <Text style={styles.undergroundRagNoteText}>
                This is set for underground churches and can&rsquo;t be changed in the app.
              </Text>
            </View>
          </View>
        )}

        {/* 2026-06-20 — Underground optional "how can the network walk with you?"
            section. Underground founders skip RegCP2; without this they had no
            path to say "we need bibles" or "we'd love to send encouragement."
            Both fields are OPTIONAL — empty submits cleanly. */}
        {isUnderground && (
          <View style={[styles.fieldGroup, { marginTop: Spacing.xl }]}>
            <Text style={styles.label}>How can the network walk with you?</Text>
            <Text style={styles.fieldNote}>
              Both fields are optional. Share as much or as little as feels safe.
            </Text>

            <Text style={[styles.label, { marginTop: Spacing.md, fontSize: 14 }]}>
              What does your church need? <Text style={styles.optionalChip}>Optional</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={undergroundNeedsText}
              onChangeText={(v) => {
                setUndergroundNeedsText(v);
                setChurchDetails({ needsText: v });
              }}
              placeholder="e.g. Bibles, theological training, prayer support, encouragement"
              placeholderTextColor={Colors.textSubtle}
              multiline
              numberOfLines={3}
              maxLength={500}
            />

            <Text style={[styles.label, { marginTop: Spacing.md, fontSize: 14 }]}>
              What could your church share? <Text style={styles.optionalChip}>Optional</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={undergroundHasText}
              onChangeText={(v) => {
                setUndergroundHasText(v);
                setChurchDetails({ hasText: v });
              }}
              placeholder="e.g. Prayer, encouragement, lived testimony, regional knowledge"
              placeholderTextColor={Colors.textSubtle}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        {/* KAN-13 — submission error surfaces inline above the Next button.
            Matches the styles.errorText pattern used by AccountSetupPage1/2
            field-level validation messages — no new error style introduced. */}
        {submitError && (
          <Text style={[styles.errorText, styles.submitErrorText]}>
            {submitError}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!isFormValid || submitting) && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!isFormValid || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text
              style={[
                styles.nextButtonText,
                !isFormValid && styles.nextButtonTextDisabled,
              ]}
            >
              {isUnderground ? 'Submit Church' : 'Next — Confirm Status'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Church / Organization Type Picker */}
      <Modal visible={typePickerVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{copy.typeLabel}</Text>
              <TouchableOpacity onPress={() => {
                setTypePickerVisible(false);
                setSheetParaTooltipOpen(false);
              }}>
                <Text style={styles.sheetClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              // 2026-06-18 — Founder ruling: 'branch' has its own entry tile
              // on RegisterIntroScreen, so it must NOT appear in the standalone
              // dropdown. Filter it out at render.
              data={CHURCH_TYPES.filter(t => t.value !== 'branch')}
              keyExtractor={item => item.value}
              renderItem={({ item }) => {
                const isPara = item.value === 'para_ministry';
                return (
                  <View>
                    <TouchableOpacity
                      style={[
                        styles.sheetItem,
                        churchType === item.value && styles.sheetItemSelected,
                      ]}
                      onPress={() => handleTypeSelect(item.value)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                        <Text style={[
                          styles.sheetItemText,
                          churchType === item.value && styles.sheetItemTextSelected,
                        ]}>
                          {item.label}
                        </Text>
                        {/* Para-ministry tap-reveal ⓘ — discoverable BEFORE
                            selecting (Founder ruling 2026-06-18 device pass).
                            Stops propagation so tapping ⓘ doesn't select the row. */}
                        {isPara && (
                          <TouchableOpacity
                            onPress={e => {
                              e.stopPropagation();
                              setSheetParaTooltipOpen(v => !v);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.tooltipIcon}>ⓘ</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {churchType === item.value && (
                        <Text style={styles.sheetItemCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                    {isPara && sheetParaTooltipOpen && (
                      <View style={[styles.infoNotice, { marginHorizontal: 16, marginBottom: 8 }]}>
                        <Text style={styles.infoNoticeText}>{PARA_MINISTRY_TOOLTIP}</Text>
                      </View>
                    )}
                  </View>
                );
              }}
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

  // KAN-13 v2 — section label for the Contact Details group. Same
  // typographic register as the top-of-screen stepLabel (mono-ish
  // uppercase letterspaced sky) but at a slightly smaller size so it
  // reads as a group divider mid-form, not a peer of the screen title.
  sectionLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },

  // KAN-13 finalization — "Same as my account info" pre-fill toggle.
  // Sits between the Contact Details section label and the Contact Name
  // field as a single-tap shortcut for leaders who are themselves the
  // primary contact for the church they're registering.
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkboxTick: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.background,
    lineHeight: 14,
  },
  checkboxLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  // B16 — label + ⓘ tap-reveal tooltip icon row. Used by the City
  // field; pattern mirrors ASP1's B15 "Describe your role" labelRow.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tooltipIcon: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.accent,
  },
  // Mark as Headquarters checkbox (2026-06-18)
  hqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 10,
  },
  hqCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hqCheckboxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  hqCheckmark: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  hqLabel: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
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
  // 2026-06-20 — Inline "Optional" chip beside field labels in the
  // underground needs/share section. Tiny pill, muted color, lowercase
  // weight — communicates optionality without competing with the label.
  optionalChip: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textSubtle,
    fontWeight: '400',
  },
  // KAN-197 — textarea variant of the standard input. Allows multiline
  // entry of needs / offerings with vertical-top alignment.
  textarea: {
    minHeight: 96,
    paddingTop: 12,
  },
  // KAN-197 — counter + helper note share a row below the textarea.
  needsMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  charCounter: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.textSubtle,
    minWidth: 56,
    textAlign: 'right',
  },
  charCounterAmber: {
    color: '#D9A91A',
  },
  charCounterRed: {
    color: '#D9534F',
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
  // 2026-06-18 device pass v2 — informational (blue) notice for para-ministry
  // tooltip. Founder ruling: para is informational, not urgent/bad — should
  // not use the red underground notice palette.
  infoNotice: {
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(107, 181, 232, 0.25)',
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  infoNoticeText: {
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
  // Visual muted state for RAG options non-interactive under underground lock.
  // No active border / no accent tint — even if (somehow) flipped to selected,
  // the visual stays dimmed so the lock is unambiguous to the user.
  ragOptionLocked: {
    opacity: 0.35,
  },

  bottomSpacer: { height: Spacing.xxxl },

  // 2026-06-19 (Ask 5 · Ruling #33) — soft-blue informational note below
  // the underground RAG row. Replaces the two prior fieldNote lines.
  undergroundRagNote: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  undergroundRagNoteIco: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.accent,
    marginTop: 1,
  },
  undergroundRagNoteText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 18,
  },

  // KAN-192 (Session 4) — footer back in flex flow at the end of root.
  // ScrollView's flex:1 fills the space between header and footer, so
  // content cannot scroll into a phantom overlay region. No KAV — the
  // keyboard naturally overlays the footer; user dismisses (drag-down
  // on scroll) to access Next. Background matches the page so the
  // footer reads as one continuous surface.
  footer: {
    backgroundColor: Colors.background,
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

  // KAN-13 — matches the AccountSetupPage1/2 errorText pattern so inline
  // validation/submission errors on this screen feel identical to the
  // surrounding onboarding flow. submitErrorText adds margin-bottom so
  // the message has breathing room above the Next button.
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    marginTop: 2,
  },
  submitErrorText: {
    marginBottom: Spacing.sm,
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
