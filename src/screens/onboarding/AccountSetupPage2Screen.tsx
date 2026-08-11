// ─────────────────────────────────────────────
// Screen 04 — Account Setup Page 2 (KAN-12)
// Church association — join existing or register new.
// 2-leader cap enforced server-side; FE blocks selection on at_capacity.
// On "Complete Registration": atomic Steps 1-5 via create-account edge
// function + Steps 6-7 fire-and-forget Resend. Three-layer idempotency
// per SPEC c.10175: FE pre-check (Layer 1), FE post-error retry guard
// (Layer 2), server-side duplicate detection (Layer 3).
//
// On success: signInWithPassword with OnboardingContext creds — the
// AuthProvider's onAuthStateChange listener flips RootNavigator to the
// authenticated branch. No manual nav.reset needed.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding, type OnboardingLoopbackChurch } from '../../context/OnboardingContext';
import { useAuth } from '../../contexts/AuthProvider';
import { getChurchTypeLabel, orgCopy } from '../../utils/displayHelpers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';
import {
  type CallerContext,
  shouldFireOptimisticPending,
} from '../../utils/asp2OptimisticPending';
import { newIdempotencyKey } from '../../utils/idempotency';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountSetupPage2'>;

// Mirrors the BE `search-churches` row shape — at_capacity is computed
// server-side (active leader count ≥ 2). FE never sees the raw count
// for the capacity decision; the server-side capacity guard in
// create-account re-applies the same threshold at write time.
// leader_count is surfaced separately (raw active-leader count) so the
// pending-cascade notice can suppress for 0-leader churches.
export interface ChurchResult {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  at_capacity: boolean;
  leader_count: number;
}

const SEARCH_CHURCHES_URL = `${SUPABASE_URL}/functions/v1/search-churches`;
const CREATE_ACCOUNT_URL = `${SUPABASE_URL}/functions/v1/create-account`;
const CHECK_EMAIL_URL = `${SUPABASE_URL}/functions/v1/check-email-available`;
// register-church-delete is dead code under the orphan-prevention
// architecture (2026-06-14). The bypass card's "Switch / Delete"
// affordance now clears OnboardingContext only — no DB row exists yet
// (register-church v6 is validation-only). Edge function deployment
// stays one cycle as defense; removed in a follow-up cleanup PR.

// Debounce window for the live search useEffect — matches KAN-12 dispatch.
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

// Result of the FE-side check-email-available helper. Discriminates the
// three Layer-1/Layer-2 outcomes the submit flow needs to react to.
type EmailCheckOutcome =
  | { kind: 'available' }
  | { kind: 'registered' }
  | { kind: 'rate_limited' }
  | { kind: 'network' };

// Mapped FE error messages (sourced from the KAN-12 AC inline-copy items).
const COPY_USER_EXISTS =
  'An account with this email already exists. Try signing in instead.';
const COPY_GENERIC_FAIL = 'Account creation failed. Please try again.';
const COPY_NETWORK_FAIL =
  'Something went wrong. Please check your connection and try again.';
const COPY_RATE_LIMITED =
  'Too many attempts. Please try again in a little while.';

// KAN-192 AC 2 — status dot driven by `verification_status` (not
// `rag_status`). The lookup is intentionally tolerant: any unmapped value
// (legacy rows, future enum additions) falls back to amber so the dot is
// never blank. Mapping locked Founder 2026-06-12 (see KAN-192 c.15743):
//   verified                 → green
//   pending                  → amber
//   rejected / deactivated   → red
const VERIFICATION_DOT_COLORS: Record<string, string> = {
  verified: Colors.green,
  pending: Colors.amber,
  rejected: Colors.red,
  deactivated: Colors.red,
};
const dotColorFor = (verificationStatus: string | undefined): string =>
  VERIFICATION_DOT_COLORS[verificationStatus ?? ''] ?? Colors.amber;

// KAN-192 AC 3 — small inline search icon for the pre-search empty state.
// Pure SVG via react-native-svg (the same lib SettingsScreen + ConnectScreen
// use) so we avoid pulling in a new icon dependency for a single glyph.
const SearchIcon = ({ color, size = 28 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm9.7 4.3-4.1-4.1 1.4-1.4 4.1 4.1-1.4 1.4Z"
      fill={color}
    />
  </Svg>
);

// KAN-192 — RPL Network ID detection. Founder confirmed (2026-06-12) the
// church-search input also accepts `RPL-XXXXX` IDs (memory #14). We
// detect the format client-side and route the same query through
// search-churches; the edge function format-detect branch resolves to
// a direct-lookup against churches_public.network_id rather than a
// substring ilike on name/city. Tolerant of leading/trailing whitespace
// and case (admin-dash displays IDs uppercase, but we lowercase for
// the lookup to keep the BE branch case-insensitive).
const RPL_ID_PATTERN = /^RPL-[A-Z0-9]{4,}$/i;
const isRplIdQuery = (raw: string): boolean => RPL_ID_PATTERN.test(raw.trim());

// KAN-192 — alpha mixer for the status tag. CD design uses hex inputs
// from Colors (#XXYYZZ) with a translucent border + background tone.
// Keeps the pending/verified swatches generated from one source of
// truth (Colors.amber / Colors.green) instead of hardcoded rgba.
const withAlpha = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// KAN-192 — named-state status row inside the bypass card. Replaces
// the unlabeled amber dot with verification-state copy ("Awaiting
// verification" / "Verified") + a Pending/Verified tag + a 1-line
// description of the wait window. Per CD handoff
// design_handoff_your_church_step2 (2026-06-13).
function BypassStatusRow({ status }: { status: string }) {
  const isPending = status === 'pending';
  const tone = isPending ? Colors.amber : Colors.green;
  const title = isPending ? 'Awaiting verification' : 'Verified';
  const tagLabel = isPending ? 'Pending' : 'Verified';
  const description = isPending
    ? 'A Replant team member will reach out within a few days. Your account stays active during this window.'
    : null;

  return (
    <View
      style={statusStyles.statusRow}
      accessibilityLabel={description ? `${title}. ${description}` : title}
    >
      <View
        style={[
          statusStyles.statusDot,
          { backgroundColor: tone, shadowColor: tone },
        ]}
      />
      <View style={statusStyles.statusText}>
        <View style={statusStyles.statusTitleRow}>
          <Text style={statusStyles.statusTitle}>{title}</Text>
          <View
            style={[
              statusStyles.statusTag,
              {
                borderColor: withAlpha(tone, 0.35),
                backgroundColor: withAlpha(tone, 0.06),
              },
            ]}
          >
            <Text style={[statusStyles.statusTagText, { color: tone }]}>
              {tagLabel}
            </Text>
          </View>
        </View>
        {description && (
          <Text style={statusStyles.statusDesc}>{description}</Text>
        )}
      </View>
    </View>
  );
}

// Status row styles isolated from the main StyleSheet so the helper
// component stays self-contained and the main styles block doesn't
// grow unnecessarily.
const statusStyles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm + 4,
    marginTop: Spacing.md + 2,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.md - 2,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md + 2,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  statusText: { flex: 1 },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
  },
  statusTagText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  statusDesc: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});

export default function AccountSetupPage2Screen({ navigation, route }: Props) {
  const { state, setChurchDetails, setLoopbackChurch } = useOnboarding();
  // B35 — setOptimisticPending lets tryAutoSignIn flip RootNavigator
  // off "unauthenticated" the moment signInWithPassword resolves, so
  // the leader is navigated to Home before they can re-tap and trigger
  // the Layer 1 email pre-check (which would surface
  // user_already_exists since the account now exists). The
  // onAuthStateChange-triggered callAuthStatusCheck self-corrects the
  // branch 1-3s later. SEC ruling KAN-12 c.14155.
  const { setOptimisticPending } = useAuth();
  const personalDetails = state.personalDetails;

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ChurchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  // B13 — seed from OnboardingContext.loopbackChurch so the post-
  // CommonActions.reset remount of ASP2 restores the loopback selection.
  // OnboardingLoopbackChurch is shape-compatible with ChurchResult; the
  // cast preserves the type contract without a runtime copy.
  const [selectedChurch, setSelectedChurch] = useState<ChurchResult | null>(
    state.loopbackChurch ? (state.loopbackChurch as ChurchResult) : null,
  );
  const [capError, setCapError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // True only when the current selection came from the KAN-13 loopback —
  // controls the create-account `isNewChurch` payload flag (Step 7 email).
  // B13 — seeds from context too so the loopback flag survives the
  // post-registration remount.
  const [isNewChurchFromLoopback, setIsNewChurchFromLoopback] = useState(
    !!state.loopbackChurch,
  );
  // Finalization — Skip-for-now path. A leader who cannot yet name
  // their church still belongs in the network; create-account accepts
  // churchId: null. The 30-day verification window starts ticking
  // either way (handled by computeVerificationDeadline).
  //
  // skippedChurch is set ONLY at the end of the modal-confirm flow
  // (handleSkipSubmit), not by the Skip-for-now button itself. The
  // button opens the modal; the modal's primary action confirms.
  const [skippedChurch, setSkippedChurch] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  // B19/B20 — replace-confirmation flow. pendingReplaceChurch holds the
  // candidate selection while the leader decides whether to abandon
  // their registered loopback church. Confirmed → swap + clear loopback.
  // Cancelled → close modal, loopback church retained. Skip modal +
  // replace modal are mutually exclusive surfaces — replace is gated on
  // isNewChurchFromLoopback in handleSelect, and skip cannot fire from
  // a result row.
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [pendingReplaceChurch, setPendingReplaceChurch] = useState<ChurchResult | null>(null);
  // Safety net for the create-account → signIn chain. If
  // signInWithPassword surfaces an error after a successful
  // create-account, this flag unlocks a "tap here to sign in"
  // affordance in the footer so the leader isn't stranded staring at
  // a frozen "Enter Replant" CTA.
  const [signInFailed, setSignInFailed] = useState(false);
  // KAN-192 AC 5 — bypass-card delete confirmation. The "Delete and
  // search again" affordance on the loopback bypass card opens this
  // modal; confirm fires the register-church-delete edge function.
  // deleteError is surfaced inline on the modal (not a toast) so the
  // confirm step is the obvious place to read failures.
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bumped on every new keystroke; in-flight responses check this against
  // their captured value before applying. Belt-and-suspenders alongside
  // AbortController — covers the case where a response lands after a
  // newer query has been kicked off but the abort hasn't propagated.
  const searchVersionRef = useRef(0);

  // create-account v8 (Founder ruling #28) — idempotency key REQUIRED.
  // We mint at first submit and REUSE across retries within this submission
  // intent. Cleared/reset only on a fresh user-intent (which in practice
  // happens when ASP2 unmounts after success). Same key sent on EVERY retry
  // so the server's idempotency cache replays the prior success body.
  const idempotencyKeyRef = useRef<string | null>(null);

  // KAN-192 — scroll-to-top on church select. After the cap-error
  // path (tap an at-capacity church), the user may be scrolled deep
  // in the results list. Picking a different church hides results
  // and renders the SELECTED card at the top of the scroll body;
  // without resetting scroll the user sees the (now-empty) bottom
  // of the scroll and reports a "blank screen."
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Finalization — footer "Enter Replant" CTA gates on selected-church
  // submission only. The skip path doesn't go through the footer at all;
  // it lives behind the modal's confirm action (handleSkipSubmit). This
  // makes the two paths visually distinct and removes the prior pattern
  // where a leader tapped Skip then had to tap Complete a second time.
  const canSubmit = !!selectedChurch && !capError;

  // KAN-192 AC 5 — bypass mode is gated on selectedChurch + the
  // isNewChurchFromLoopback flag. Both are seeded from
  // OnboardingContext.loopbackChurch on mount, so a leader who
  // backs from the bypass card to ASP1 (e.g., to tweak their account
  // details) and returns to ASP2 lands back on the bypass card —
  // the route.params?.newChurchId path is single-use (consumed by
  // the post-RegCP2 CommonActions.reset) and is NOT required here.
  // Mid-delete guard: setLoopbackChurch(null) runs before the BE
  // call completes, which nulls selectedChurch and exits the bypass
  // cleanly. Back-out-of-edit guard: the Switch flow clears
  // loopbackChurch before the leader returns to ASP2.
  const isLoopbackBypass = !!selectedChurch && isNewChurchFromLoopback;

  // KAN-192 — reset scroll to top whenever a church becomes selected.
  // Without this, after the cap-error path (scrolled deep in results
  // → tap capped row → tap a different open row), the SELECTED card
  // renders at the top of the scroll body but the user remains
  // scrolled deep, seeing only empty space and reporting "blank
  // screen."
  useEffect(() => {
    if (selectedChurch) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [selectedChurch]);

  // KAN-192 — phantom-inset defense on screen focus. On her iPhone the
  // ScrollView mounts with contentInset.bottom ≈ 959pt (confirmed via
  // [ASP2] offsetY instrumentation 2026-06-14) despite
  // automaticallyAdjustKeyboardInsets={false} +
  // contentInsetAdjustmentBehavior="never". Both props prevent iOS from
  // ADJUSTING the inset going forward but do not zero an inset already
  // present at mount — and the previous screen (ASP1) wraps its inputs
  // in KeyboardAvoidingView, so keyboard state leaks across the
  // navigation transition. Forcing scrollTo({y:0}) + Keyboard.dismiss()
  // on every focus restores a usable cold landing regardless of the
  // residual inset. Paired with the Keyboard.dismiss() right before
  // navigation.navigate('AccountSetupPage2') in ASP1's handleNext.
  useFocusEffect(
    useCallback(() => {
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, []),
  );

  // ── Live (debounced) search ────────────────────────────────────────
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      // Clear results when the query falls below the minimum — avoids
      // showing stale data from a previous longer query.
      setResults([]);
      setSearched(false);
      return;
    }
    const myVersion = ++searchVersionRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void doSearch(trimmed, myVersion, controller.signal);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Loopback receive from KAN-13 (RegisterChurchPage1) ─────────────
  //
  // When the leader returns from registering a new church, KAN-13
  // navigates back here with the newly-created church as route.params.
  // We pre-select it and mark isNewChurch so Step 7 fires.
  //
  // Defensive — both newChurch AND newChurchId must be present before
  // we flip the loopback flag (B6 — a second CommonActions.reset that
  // doesn't re-fire this effect silently drops the Edit affordance).
  useEffect(() => {
    const incoming = route.params?.newChurch;
    const incomingId = route.params?.newChurchId;
    if (incoming && incomingId) {
      setSelectedChurch(incoming);
      setIsNewChurchFromLoopback(true);
      setCapError(false);
      // B13 — persist the loopback church to context so a subsequent
      // remount (back-and-rereregister, CommonActions.reset) restores
      // the selection from context rather than landing on an empty
      // ASP2. The shape is structurally compatible with the
      // OnboardingLoopbackChurch interface.
      setLoopbackChurch(incoming as OnboardingLoopbackChurch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.newChurchId]);

  const doSearch = async (q: string, version: number, signal: AbortSignal) => {
    setSearching(true);
    // B19 — do NOT clear selectedChurch / isNewChurchFromLoopback /
    // loopbackChurch here. PR #58's B13 logic cleared on every search
    // keystroke, which silently abandoned the just-registered loopback
    // church the moment the leader touched the search box. The search
    // now runs in the background; the leader explicitly confirms a
    // replacement via handleSelect → showReplaceModal.
    setCapError(false);
    try {
      const response = await fetch(SEARCH_CHURCHES_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q }),
        signal,
      });
      if (signal.aborted || version !== searchVersionRef.current) return;
      if (!response.ok) {
        setResults([]);
        return;
      }
      const body = (await response.json()) as { results?: ChurchResult[] };
      if (signal.aborted || version !== searchVersionRef.current) return;
      setResults(Array.isArray(body.results) ? body.results : []);
    } catch (err) {
      // AbortError on debounce-cancel is expected; swallow silently.
      if ((err as { name?: string })?.name === 'AbortError') return;
      setResults([]);
    } finally {
      if (version === searchVersionRef.current) {
        setSearching(false);
        setSearched(true);
      }
    }
  };

  // Manual Search button — immediate trigger, bypasses the debounce.
  // Belt-and-suspenders: a leader who taps Search before the debounce
  // fires gets an instant result.
  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const myVersion = ++searchVersionRef.current;
    const controller = new AbortController();
    void doSearch(trimmed, myVersion, controller.signal);
  };

  const handleSelect = (church: ChurchResult) => {
    if (church.at_capacity) {
      setSelectedChurch(null);
      setCapError(true);
      return;
    }
    setCapError(false);
    // Finalization fix 3 — picking a church clears any prior skip
    // intent, so a leader who tapped Skip → backed out of the modal →
    // then picked a church doesn't silently submit churchId: null.
    setSkippedChurch(false);

    // B20 — if a loopback church is currently selected, the leader is
    // about to abandon a church they just registered in this session.
    // Surface a confirmation modal before swapping. The DB row for the
    // loopback church already exists; orphan cleanup is deferred to
    // KAN-202 (Post-MVP pg_cron auto-scrub).
    if (isNewChurchFromLoopback) {
      setPendingReplaceChurch(church);
      setShowReplaceModal(true);
      return;
    }

    setSelectedChurch(church);
    setIsNewChurchFromLoopback(false);
    // B13 — selecting an existing church via search replaces any
    // prior loopback selection; clear context too.
    setLoopbackChurch(null);
  };

  // B20 — replace-modal handlers. Confirm swaps the selection to the
  // candidate church and clears all loopback state; Cancel discards the
  // candidate and keeps the loopback selection.
  const handleReplaceConfirm = () => {
    if (pendingReplaceChurch) {
      setSelectedChurch(pendingReplaceChurch);
      setIsNewChurchFromLoopback(false);
      // B21 — orphaned church row cleanup deferred to KAN-202 (Post-MVP
      // pg_cron auto-scrub for churches with no associated leader).
      // Clearing context is the only FE action needed at MVP.
      setLoopbackChurch(null);
    }
    setPendingReplaceChurch(null);
    setShowReplaceModal(false);
  };

  const handleReplaceCancel = () => {
    setPendingReplaceChurch(null);
    setShowReplaceModal(false);
  };

  // 2026-06-18 — Founder ruling: route to RegisterIntro chooser tile screen
  // (Standalone / Church branch / Underground) instead of straight to RegCP1.
  // The chooser dispatches to RegCP1 with the appropriate `entry` param.
  // Edit path (handleBypassEdit) still goes straight to RegCP1 since the
  // existing church already has a type.
  const handleRegisterNew = () => {
    Keyboard.dismiss();
    navigation.navigate('RegisterIntro');
  };

  // KAN-192 AC 5 — bypass card Edit affordance. Identical contract to
  // the Edit chip on the SELECTED card (RegCP1 editChurch params);
  // factored as a handler because the bypass card calls it from a
  // different button and we want the loopback-edit useEffect on RegCP2
  // to fire on the new newChurchId param after Apply Changes lands.
  const handleBypassEdit = () => {
    if (!selectedChurch) return;
    // 2026-06-19/20 — preserve entry mode on Edit roundtrip so the type
    // dropdown stays HIDDEN for branch + underground (both are
    // mutually-exclusive entry paths whose type is determined by tile
    // selection on RegisterIntroScreen, not the dropdown). Standalone
    // is the only mode where the dropdown is visible.
    const entry =
      selectedChurch.type === 'branch'
        ? 'branch'
        : selectedChurch.type === 'underground'
        ? 'underground'
        : 'standalone';
    navigation.navigate('RegisterChurchPage1', {
      entry,
      editChurch: {
        churchId: selectedChurch.id,
        churchName: selectedChurch.name,
        churchType: selectedChurch.type,
        cityRegion: selectedChurch.city,
        country: selectedChurch.country,
        contactEmail: state.churchDetails.contactEmail ?? '',
        contactPhone: state.churchDetails.contactPhone ?? '',
        ragStatus: selectedChurch.rag_status,
      },
    });
  };

  // KAN-192 AC 5 — bypass card delete confirmation flow. The button
  // taps `setShowDeleteModal(true)` here; the modal's primary action
  // calls `handleDeleteConfirm` which fires the edge function. We do
  // NOT clear selection optimistically — the modal stays mounted with
  // a spinner so a stuck network doesn't trap the leader in a half-
  // deleted state.
  const handleBypassDelete = () => {
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteCancel = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedChurch || deleting) return;
    // Orphan-prevention v4 (2026-06-14): "Switch / Delete" on the bypass
    // card is now a pure context-clear. No DB row exists yet (RegCP2
    // didn't write — v6 validation-only). Removing the just-collected
    // church details from OnboardingContext is the full action.
    // register-church-delete is dead code under the new architecture
    // and will be removed in a follow-up cleanup PR.
    setDeleting(true);
    setDeleteError(null);
    try {
      setSelectedChurch(null);
      setIsNewChurchFromLoopback(false);
      setLoopbackChurch(null);
      setChurchDetails({
        churchId: undefined,
        churchName: undefined,
        churchType: undefined,
        country: undefined,
        cityRegion: undefined,
        address: undefined,
        contactName: undefined,
        contactEmail: undefined,
        contactPhone: undefined,
        ragStatus: undefined,
        lat: undefined,
        lng: undefined,
        hasText: undefined,
        needsText: undefined,
        hasEmergencyPlan: null,
        openToCollaboration: null,
      });
      setShowDeleteModal(false);
      // setParams (not reset) avoids remounting the screen and losing
      // OnboardingContext state. Cast to `as never` is React Nav's
      // standard escape hatch for partial-param updates.
      navigation.setParams({ newChurch: undefined, newChurchId: undefined } as never);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Layer 1 / Layer 2 helper — checks the same check-email-available
   * endpoint AccountSetupPage1 uses. Returns a discriminated outcome.
   * Network errors on this read map to `network` (treated as "let the
   * subsequent create-account call be the arbiter").
   */
  const checkEmailAvailable = async (email: string): Promise<EmailCheckOutcome> => {
    try {
      const response = await fetch(CHECK_EMAIL_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      if (response.status === 429) return { kind: 'rate_limited' };
      if (!response.ok) return { kind: 'network' };
      const body = (await response.json()) as { available?: boolean };
      if (body.available === false) return { kind: 'registered' };
      if (body.available === true) return { kind: 'available' };
      return { kind: 'network' };
    } catch {
      return { kind: 'network' };
    }
  };

  /**
   * Drive Supabase Auth into the signed-in state using the leader's
   * just-set credentials. signInWithPassword fires onAuthStateChange,
   * which runs callAuthStatusCheck to land the real branch ~1-3s later.
   *
   * B35 (SEC c.14155) — race-window sealing. The async
   * callAuthStatusCheck takes 1-3s on a cold Supabase function; before
   * PR #62 the FE called refresh() to force a second check, but that
   * created the inFlight double-fire that B30 had to gate against and
   * PR #62 ultimately removed. We now flip `branch = 'pending'`
   * optimistically (via setOptimisticPending) the moment signInWithPassword
   * resolves so RootNavigator transitions to Home before the leader can
   * re-tap the CTA. callAuthStatusCheck overwrites the optimistic value
   * with the real status (active / pending / deactivated) without a
   * race because setOptimisticPending is a direct setBranch — not a
   * second callAuthStatusCheck.
   *
   * `context` is SEC-locked to a one-member literal union. New callers
   * require SEC review — see src/utils/asp2OptimisticPending.ts header.
   */
  const tryAutoSignIn = async (opts: { context: CallerContext }) => {
    const email = personalDetails.email ?? '';
    const password = personalDetails.password ?? '';
    if (!email || !password) {
      setSubmitError(
        'Account created — sign in failed. Please open the app to continue.',
      );
      setSignInFailed(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitError(
        'Account created — sign in failed. Please open the app to continue.',
      );
      setSignInFailed(true);
      return;
    }
    // B35 SEC Condition 1 — type-checked guard. shouldFireOptimisticPending
    // only returns true for the audited 'asp2_skip_after_create' literal.
    // Future callers passing a different context (even via `as any`) will
    // fall through and wait for the real callAuthStatusCheck branch flip.
    // SEC Condition 3 — locked in CI via asp2OptimisticPending.test.ts.
    if (shouldFireOptimisticPending(opts.context)) {
      setOptimisticPending();
    }
  };

  // Finalization — skip-submit confirm-action handler. Closes the
  // modal, marks skippedChurch (for surfaces that read it post-submit,
  // e.g. the VerificationBanner null-deadline branch), and invokes
  // handleSubmit with the explicit skip flag so the closure isn't
  // racing setState.
  const handleSkipSubmit = () => {
    setShowSkipModal(false);
    setSkippedChurch(true);
    void handleSubmit({ skip: true });
  };

  const handleSubmit = async (opts?: { skip?: boolean }) => {
    // The skip path bypasses `canSubmit` since the footer CTA is locked
    // to selected-church submits. `isSkip` is passed explicitly via
    // handleSkipSubmit → setState-then-call isn't reliable because React
    // batches state updates; we'd read stale skippedChurch inside the
    // same tick. The explicit parameter avoids that closure trap.
    const isSkip = opts?.skip === true;
    if ((!canSubmit && !isSkip) || submitting) return;
    if (!selectedChurch && !isSkip) return;
    if (
      !personalDetails.firstName ||
      !personalDetails.lastName ||
      !personalDetails.email ||
      !personalDetails.password ||
      !personalDetails.role
    ) {
      setSubmitError(COPY_GENERIC_FAIL);
      return;
    }

    const churchId: string | null = isSkip ? null : selectedChurch!.id;

    setSubmitError(null);
    setSubmitting(true);
    setChurchDetails({ churchId: churchId ?? undefined });

    try {
      // ── Layer 1 — pre-check email-available ──────────────────────
      const pre = await checkEmailAvailable(personalDetails.email);
      if (pre.kind === 'registered') {
        setSubmitError(COPY_USER_EXISTS);
        return;
      }
      if (pre.kind === 'rate_limited') {
        setSubmitError(COPY_RATE_LIMITED);
        return;
      }
      // pre.kind === 'available' | 'network' → proceed; create-account is
      // the arbiter on the 'network' branch.

      // ── create-account call ──────────────────────────────────────
      // Orphan-prevention v4 contract (2026-06-14): mutually-exclusive
      // payload — pass `newChurch` (atomic write) OR `churchId` (join
      // existing). When isNewChurchFromLoopback is true, the FE holds
      // the church payload in OnboardingContext (no DB write happened
      // at RegCP2 anymore — that's the point). Build the BE-shaped
      // newChurch object here from context and pass it; create-account
      // v4 writes the church + the leader atomically via the
      // create_account_atomic RPC.
      let newChurchForBe: Record<string, unknown> | undefined;
      if (isNewChurchFromLoopback && !isSkip) {
        const cd = state.churchDetails;
        // Diagnostic — surface which church fields are missing from
        // OnboardingContext so we know which screen failed to persist.
        // Orphan-prevention v4 (2026-06-14) requires the FE to hand v4
        // a complete church payload at submit time; gaps here mean
        // RegCP1 or RegCP2 didn't write to context.
        const missing: string[] = [];
        if (!cd.churchName) missing.push('church name');
        if (!cd.churchType) missing.push('church type');
        if (!cd.country) missing.push('country');
        if (!cd.contactName) missing.push('contact name');
        if (!cd.ragStatus) missing.push('current status (RAG)');
        if (missing.length > 0) {
          setSubmitError(
            `We're missing some church details from the previous step (${missing.join(', ')}). Go back to "Register Church" and complete those fields, then try again.`,
          );
          return;
        }
        const nc: Record<string, unknown> = {
          name: cd.churchName.trim(),
          type: cd.churchType,
          country: cd.country,
          city: cd.cityRegion ?? null,
          contact_name: cd.contactName.trim(),
          rag_status: cd.ragStatus,
          state_declaration:
            'I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth.',
          lat: cd.lat ?? null,
          lng: cd.lng ?? null,
        };
        if (cd.address && cd.address.trim()) nc.address = cd.address.trim();
        if (cd.contactEmail && cd.contactEmail.trim()) nc.contact_email = cd.contactEmail.trim();
        if (cd.contactPhone && cd.contactPhone.trim()) nc.contact_phone = cd.contactPhone.trim();
        if (cd.hasEmergencyPlan !== null && cd.hasEmergencyPlan !== undefined) {
          nc.has_emergency_plan = cd.hasEmergencyPlan;
        }
        if (cd.openToCollaboration !== null && cd.openToCollaboration !== undefined) {
          nc.open_to_collaboration = cd.openToCollaboration;
        }
        // KAN-13 — needs/resources as comma-split arrays. Same shape
        // RegCP2 used to send to register-church v5.
        if (cd.needsText && cd.needsText.trim()) {
          nc.needs = cd.needsText.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
        if (cd.hasText && cd.hasText.trim()) {
          nc.resources = cd.hasText.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
        // Underground flow (Ruling #10, 2026-06-19) — forward the
        // name-visibility choice captured on NameVisibilityChoice.
        // create-account v8 only honors this field when type='underground';
        // for all other church types it's ignored server-side. Defaults
        // to false (the Migration A server-side default) when undefined.
        if (cd.churchType === 'underground') {
          nc.show_church_name = cd.showChurchName === true;
        }
        newChurchForBe = nc;
      }

      // 2026-06-18 — Branch-flow extensions (create-account v7):
      // branchOfChurchId / pendingParentClaim / isHeadquarters live in
      // OnboardingContext (populated by RegCP1 branch entry). Only valid
      // alongside a newChurch payload; pass null/false otherwise so existing
      // standalone + skip + existing-church paths stay unchanged.
      const isNewBranchChurch = !!newChurchForBe && (newChurchForBe.type as string) === 'branch';
      const branchOfChurchId = isNewBranchChurch ? (state.parentRef?.id ?? null) : null;
      const pendingParentClaim =
        isNewBranchChurch && state.pendingParentClaim ? state.pendingParentClaim : null;
      const isHeadquarters = !!newChurchForBe ? state.isHeadquarters : false;

      // create-account v8 (Founder ruling #28) — idempotency key REQUIRED.
      // Mint once per submission intent; reuse across all retries until
      // success. Server replays the cached success body on a key replay,
      // so a 5xx-and-retry can never accidentally create two accounts.
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = newIdempotencyKey();
      }
      const idempotencyKey = idempotencyKeyRef.current;

      const response = await fetch(CREATE_ACCOUNT_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          // create-account v8 reads Idempotency-Key header first, with
          // body.idempotencyKey as fallback. We send both so a gateway
          // that strips the header still authenticates the request.
          idempotencyKey,
          firstName: personalDetails.firstName,
          // KAN-229: empty string is the canonical "no middle name" value
          // and lands as '' in users.middle_name (NOT NULL).
          middleName: personalDetails.middleName ?? '',
          lastName: personalDetails.lastName,
          email: personalDetails.email,
          // KAN-231: optional personal phone. Empty string when not provided.
          phone: personalDetails.phone ?? '',
          password: personalDetails.password,
          role: personalDetails.role,
          anonymous: personalDetails.anonymous ?? false,
          // Mutually exclusive — pass exactly one OR neither (skip).
          // When isNewChurchFromLoopback the church is born atomically
          // here via newChurch; churchId stays null.
          churchId: newChurchForBe ? null : churchId,
          newChurch: newChurchForBe,
          // create-account v7 branch-flow fields (2026-06-18). Validated
          // server-side; null/false when not applicable.
          branchOfChurchId,
          pendingParentClaim,
          isHeadquarters,
        }),
      });

      if (response.status === 429) {
        setSubmitError(COPY_RATE_LIMITED);
        return;
      }

      if (response.ok) {
        // 200 — account created. Sign in; AuthProvider routes to main app.
        await tryAutoSignIn({ context: 'asp2_skip_after_create' });
        return;
      }

      // ── Server-side error code mapping ───────────────────────────
      let errCode: string | null = null;
      try {
        const body = (await response.json()) as { error?: string };
        errCode = typeof body.error === 'string' ? body.error : null;
      } catch {
        // 5xx-no-body — fall through to Layer 2 retry guard.
      }

      if (errCode === 'user_already_exists') {
        setSubmitError(COPY_USER_EXISTS);
        return;
      }
      if (errCode === 'LEADER_CAP_EXCEEDED') {
        // Capacity changed between selection and submit — show the
        // canonical cap error, drop the selection.
        setSelectedChurch(null);
        setCapError(true);
        return;
      }
      if (errCode === 'validation_error') {
        setSubmitError(COPY_GENERIC_FAIL);
        return;
      }

      // ── Layer 2 — post-error retry guard ─────────────────────────
      //
      // 5xx or internal_error: re-check email-available. If the email
      // is now registered, the account WAS created on the prior attempt;
      // sign in instead of showing an error.
      if (response.status >= 500 || errCode === 'internal_error') {
        const recheck = await checkEmailAvailable(personalDetails.email);
        if (recheck.kind === 'registered') {
          await tryAutoSignIn({ context: 'asp2_skip_after_create' });
          return;
        }
      }
      setSubmitError(COPY_GENERIC_FAIL);
    } catch {
      // Network error from create-account itself — Layer 2 retry guard.
      const recheck = await checkEmailAvailable(personalDetails.email);
      if (recheck.kind === 'registered') {
        await tryAutoSignIn({ context: 'asp2_skip_after_create' });
        return;
      }
      setSubmitError(COPY_NETWORK_FAIL);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // KAN-192 — layout pattern. Three rules together.
    //
    // 1. NO KeyboardAvoidingView (Session 2/3, 2026-06-12). KAV padding
    //    pushed the fixed footer up by the keyboard height on focus,
    //    squeezing the short scroll body into a narrow strip. The
    //    search input is lifted OUT of the ScrollView (see header
    //    comment below) so iOS's UITextInput.scrollRectToVisible can't
    //    fire on it.
    //
    // 2. Footer in flex flow at the end of root (Session 4, 2026-06-13).
    //    The prior `position: 'absolute'` footer left the ScrollView
    //    viewport extending behind the footer overlay. Flex-flow footer
    //    bounds the ScrollView frame at the footer's top edge so the
    //    keyboard naturally overlays the footer; user dismisses (drag-
    //    down on scroll) to access Enter Replant.
    //
    // 3. ScrollView with `automaticallyAdjustKeyboardInsets={false}`
    //    + `contentInsetAdjustmentBehavior="never"` (Session 4 root-
    //    cause fix). Without these two props, iOS silently applies a
    //    phantom ~300pt `contentInset.bottom` to the ScrollView —
    //    lingering from when the keyboard had been open on the
    //    previous screen (ASP1 password field). That phantom inset
    //    let the user scroll the entire empty-state body off the top
    //    even with `bounces={false}`, leaving the viewport blank.
    //    Diagnostic numbers that confirmed this (Session 4 instrument
    //    pass): content_h=484, scroll_frame_h=434 → natural max
    //    offsetY=50pt, but Founder reached offsetY=351pt before fix.
    //    301pt of phantom inset ≈ iOS keyboard height. Re-introducing
    //    these props is SAFE here because flex-flow footer (rule 2)
    //    means there is no overlay zone for content to slide under —
    //    the Session 3 "SELECTED-card invisible" concern is gone.
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header with back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>ACCOUNT SETUP · 2 OF 2</Text>
        <Text style={styles.title}>{orgCopy(selectedChurch?.type).asp2Title}</Text>
        <Text style={styles.subtitle}>
          Every leader in the Replant network is tied to a church. Search for yours below, or register a new one.
        </Text>
      </View>

      {/* KAN-192 keyboard-fix v3 (Founder ruling 2026-06-12) — the
          search input lives OUTSIDE the ScrollView. With the input
          inside a ScrollView, iOS's UITextInput.scrollRectToVisible()
          override fires when the field becomes first responder and
          pushes scroll content up by the keyboard height regardless
          of contentInsetAdjustmentBehavior / automaticallyAdjustKeyboardInsets.
          Moving the input to a fixed View sibling decouples it from
          any scrollable parent — focus no longer triggers scroll.
          Hidden during loopback bypass because the bypass card owns
          the screen there. */}
      {!isLoopbackBypass && (
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by church name or Replant ID..."
              placeholderTextColor={Colors.textSubtle}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              {searching ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
          {searchQuery.trim().length > 0 && searchQuery.trim().length < MIN_QUERY_LENGTH && (
            <Text style={styles.searchHint}>Type at least 3 characters to search.</Text>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* KAN-192 AC 5 — full bypass confirmation. When the leader has
            just registered a new church (loopback from RegCP2 today;
            underground reg later), search/register/skip are all noise.
            The bypass card replaces the entire scroll body with a single
            confirmation surface: ✓ CHURCH REGISTERED, the new church's
            name + meta, and two distinct affordances (Edit / Delete and
            search again). The primary Enter Replant CTA stays in the
            footer — it already gates on canSubmit, which is satisfied
            here (selectedChurch + isNewChurchFromLoopback both true).

            Once the leader taps Delete and confirms, handleDeleteConfirm
            clears params + selection; isLoopbackBypass flips false on
            the next render and the search UI takes over. Edit pushes
            RegCP1 with editChurch and re-enters bypass on return.

            AC 6 satisfaction — leaders who tapped Skip submit churchId:
            null and route to home before ever rendering this branch, so
            bypass cannot be reached on a skip path. */}
        {isLoopbackBypass && selectedChurch ? (
          // KAN-192 — CD redesign (design_handoff_your_church_step2,
          // 2026-06-13). Ribbon row (✓ Registered + Edit) at top;
          // card body with church name + meta + named status row
          // (Awaiting verification / Verified). Destructive Switch
          // affordance moves OUTSIDE the card as a quiet text link.
          <>
          <View style={styles.bypassCard}>
            <View style={styles.bypassRibbon}>
              <View style={styles.bypassRibbonLeft}>
                <View style={styles.bypassRibbonCheck}>
                  <Text style={styles.bypassRibbonCheckGlyph}>✓</Text>
                </View>
                <Text style={styles.bypassRibbonLabel}>Ready to Register</Text>
              </View>
              <TouchableOpacity
                onPress={handleBypassEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit church"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.bypassRibbonEdit}
              >
                <Text style={styles.bypassRibbonEditText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bypassCardBody}>
              <Text style={styles.bypassChurchName}>{selectedChurch.name}</Text>
              <Text style={styles.bypassChurchMeta}>
                {getChurchTypeLabel(selectedChurch.type)}
                <Text style={styles.bypassChurchMetaSep}>  ·  </Text>
                {/* 2026-06-20 — Underground rows have city stripped to NULL
                    server-side (underground_no_location invariant). Avoid the
                    dangling "Underground · , Country" comma by composing
                    "city, country" only when at least one is present. */}
                {selectedChurch.city && selectedChurch.country
                  ? `${selectedChurch.city}, ${selectedChurch.country}`
                  : selectedChurch.city || selectedChurch.country || ''}
              </Text>

              {/* 2026-06-18 — Branch attribution. When the loopback church is
                  a branch with a resolved parent in OnboardingContext, surface
                  "Church branch of {parent}" so the leader sees the link they
                  just established. Deferred-parent variant shows amber pending
                  copy instead. */}
              {selectedChurch.type === 'branch' && state.parentRef && (
                <Text style={[styles.bypassChurchMeta, { marginTop: 4 }]}>
                  Church branch of {state.parentRef.name}
                  {state.parentRef.city ? ` · ${state.parentRef.city}` : ''}
                </Text>
              )}
              {selectedChurch.type === 'branch' && !state.parentRef && state.pendingParentClaim && (
                <Text style={[styles.bypassChurchMeta, { marginTop: 4, color: Colors.amber }]}>
                  Parent church to be linked · {state.pendingParentClaim.name}
                </Text>
              )}

              {/* Status row — the heart of the CD redesign. The
                  unlabeled amber dot was the screen's biggest
                  usability failure; named "Awaiting verification"
                  with a 2-3 day description makes the wait window
                  explicit. Verified state swaps amber→green, drops
                  the description. */}
              <BypassStatusRow status={selectedChurch.verification_status} />
            </View>
          </View>

          {/* 2026-06-20 — Underground reassurance note. Two variants based
              on the NameVisibilityChoice the leader made.
              SAFE (show_church_name=false, default): name stays hidden in the
                network; bypass card shows it only for confirmation.
              BRAVE (show_church_name=true): name will be visible in the
                network — affirms the leader's chosen posture and reassures
                that location/identifying details still stay hidden.
              Uses the canonical infoNotice treatment (soft-blue accent, ⓘ icon,
              bordered card). Sits UNDER the card, not inside it. */}
          {selectedChurch.type === 'underground' && (
            <View style={styles.bypassUndergroundNoteCard}>
              <Text style={styles.bypassUndergroundNoteIcon}>ⓘ</Text>
              <Text style={styles.bypassUndergroundNoteText}>
                {state.churchDetails.showChurchName === true
                  ? "Your church name will be visible in the network — that's the choice you made. Your location and identifying details still stay hidden everywhere."
                  : "Your church name stays private. It's shown here only so you can confirm what you submitted — only Replant's verification team will see it."}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleBypassDelete}
            accessibilityRole="button"
            accessibilityLabel="Switch to a different church"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.bypassSwitchLink}
          >
            <Text style={styles.bypassSwitchLinkText}>
              Made a mistake?{' '}
              <Text style={styles.bypassSwitchLinkStrong}>Switch ›</Text>
            </Text>
          </TouchableOpacity>
          </>
        ) : (
        <>
        {/* Search input lifted outside the ScrollView (see header
            comment above the searchSection View). What remains inside
            the scroll body is everything that depends on search state:
            cap error, selected card, pending notice, empty states,
            results, register-yours, skip. */}

        {/* 2-leader cap error */}
        {capError && (
          <View style={styles.capError}>
            <Text style={styles.capErrorText}>
              This church already has 2 leaders. Contact them directly or register a new entry.
            </Text>
            <Text style={styles.capErrorContact}>accounts@projectreplant.org</Text>
          </View>
        )}

        {/* Selected church */}
        {selectedChurch && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedLabel}>✓ SELECTED</Text>
              <View style={styles.selectedActions}>
                {/* KAN-192 (Founder ruling 2026-06-12) — only Clear on
                    the SELECTED card. A pre-existing church looked up
                    via search cannot be edited at sign-up time: the
                    leader isn't verified for that church yet, so the
                    profile is read-only until the Church tab Edit path
                    opens post-verification. Editing same-session
                    just-registered churches is handled by the bypass
                    card (loopback flow), not here. */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedChurch(null);
                    setIsNewChurchFromLoopback(false);
                    // B13 — Clear wipes loopback context too so the
                    // selection doesn't reappear on remount.
                    setLoopbackChurch(null);
                  }}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.churchName}>{selectedChurch.name}</Text>
            <View style={styles.churchMeta}>
              <View style={[styles.ragDot, { backgroundColor: dotColorFor(selectedChurch.verification_status) }]} />
              <Text style={styles.churchMetaText}>
                {getChurchTypeLabel(selectedChurch.type)} · {selectedChurch.city}
              </Text>
            </View>
          </View>
        )}

        {/* KAN-12 finalization — pending-church notice. When the leader
            selects an EXISTING church that's still awaiting Replant
            verification, surface the cascade impact: their account will
            also stay pending until the church verifies.

            Finalization fix 2 — guarded by !isNewChurchFromLoopback so
            a leader who just registered their own brand-new church
            doesn't see the cascade copy meant for joining-an-existing-
            pending-church. Their own registration's verification
            countdown is the right signal there. */}
        {selectedChurch?.verification_status === 'pending' && !isNewChurchFromLoopback && (selectedChurch?.leader_count ?? 0) > 0 && (
          <View style={styles.pendingChurchNotice}>
            <Text style={styles.pendingChurchNoticeText}>
              This church is awaiting verification. Your account will also be pending until the church is verified by Replant.
            </Text>
          </View>
        )}

        {/* Inline skip notice removed — finalization moves the skip
            confirmation into a Modal opened by the Skip-for-now button.
            The modal's primary action ("Enter Replant") fires the
            submit directly so there's no two-tap drift between the
            decision and the action. */}

        {/* KAN-192 AC 3 — empty state B (no search yet). Wireframe v4
            pattern (Founder confirmed 2026-06-12): a dark rounded card
            that contains a centered magnifier icon and a two-line
            instructional block (heading + helper). Replaces the prior
            flat icon+text layout that read as broken next to the
            search bar. Renders only on a completely empty query; the
            3-char hint covers the mid-typing case so we never stack
            two pieces of guidance copy. */}
        {!searched && !searching && !selectedChurch && searchQuery.trim().length === 0 && (
          <View style={styles.emptyStateCard}>
            <SearchIcon color={Colors.textMuted} size={36} />
            <Text style={styles.emptyStateHeading}>
              Search by church name or Replant ID
            </Text>
            <Text style={styles.emptyStateHelper}>to find your church</Text>
          </View>
        )}

        {/* KAN-192 AC 1 — empty state A (searched, no results). The
            inline "Register a new church" CTA was removed: the single
            anchored register-yours card below handles that affordance
            now, per AC 1's "single card" rule. The message stays. */}
        {searched && results.length === 0 && !selectedChurch && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No churches found.</Text>
            <Text style={styles.emptyStateSubtext}>Try a different name or Replant ID, or register your church below.</Text>
          </View>
        )}

        {/* KAN-192 (Founder ruling 2026-06-12) — results list collapses
            once a church is selected. The SELECTED card above carries
            the confirmation; keeping the list visible left leaders
            scrolled to mid-list with no clear "you picked one" signal.
            To pick a different church, the leader taps Clear on the
            SELECTED card to reopen results, or just searches again. */}
        {results.length > 0 && !selectedChurch && (
          <View style={styles.results}>
            {results.map(church => (
              <TouchableOpacity
                key={church.id}
                style={[
                  styles.resultItem,
                  church.at_capacity && styles.resultItemCapped,
                ]}
                onPress={() => handleSelect(church)}
                activeOpacity={0.7}
              >
                <View style={styles.resultLeft}>
                  <View style={[styles.ragDot, { backgroundColor: dotColorFor(church.verification_status) }]} />
                  <View>
                    <Text style={styles.churchName}>
                      {church.name || getChurchTypeLabel(church.type)}
                    </Text>
                    <Text style={styles.churchMetaText}>
                      {getChurchTypeLabel(church.type)} · {church.city}, {church.country}
                    </Text>
                    {church.at_capacity && (
                      <Text style={styles.cappedLabel}>Leader slots full</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.resultChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* KAN-192 AC 1 (Founder ruling 2026-06-12) — register-yours
            card + skip link both hide once a church is selected. The
            leader has made their choice; the alternative paths
            (register new, skip) become noise that competes with the
            footer Enter Replant CTA. They re-appear if the leader
            taps Clear on the SELECTED card.
            Wireframe v4 layout: title + sub-line stacked on the left,
            sky-blue "Register yours →" CTA right-aligned. Whole card
            is the tap target. */}
        {!selectedChurch && (
          <TouchableOpacity
            style={styles.registerYoursCard}
            onPress={handleRegisterNew}
            activeOpacity={0.85}
          >
            <View style={styles.registerYoursTextBlock}>
              <Text style={styles.registerYoursTitle}>Don't see your church in the network?</Text>
              <Text style={styles.registerYoursSubline}>Register yours to begin.</Text>
            </View>
            <Text style={styles.registerYoursCta}>Register yours →</Text>
          </TouchableOpacity>
        )}

        {/* KAN-192 AC 4 — Skip-for-now blue text link. Hidden once a
            church is selected (see comment above). Tapping opens the
            confirmation modal (kept per protection-layer rule,
            c.15743). The modal's primary action fires handleSkipSubmit
            which submits with churchId: null. The 7-day countdown
            from users.created_at continues — neither paused nor reset
            by the skip. */}
        {!selectedChurch && (
          <TouchableOpacity
            style={styles.skipLink}
            onPress={() => setShowSkipModal(true)}
            activeOpacity={0.6}
            accessibilityRole="link"
          >
            <Text style={styles.skipLinkText}>Skip for now</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
        </>
        )}
      </ScrollView>

      {/* Footer "Enter Replant" CTA — selected-church path only. The
          skip path lives behind the modal opened by the Skip-for-now
          button above; that path invokes handleSubmit({ skip: true })
          directly without touching this footer CTA. */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={() => { void handleSubmit(); }}
          disabled={!canSubmit || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[styles.submitButtonText, styles.enterReplantText, !canSubmit && styles.submitButtonTextDisabled]}>
              Enter Replant
            </Text>
          )}
        </TouchableOpacity>
        {submitError && (
          <Text style={styles.submitErrorText}>{submitError}</Text>
        )}
        {/* B8 safety net — if create-account succeeded but
            signInWithPassword threw, surface a tappable fallback so
            the leader can re-run tryAutoSignIn without backing out
            and re-entering the flow. Should rarely render — most
            sign-in errors are transient (network) and the second tap
            usually succeeds. */}
        {signInFailed && (
          <TouchableOpacity
            style={styles.signInFallback}
            onPress={() => { void tryAutoSignIn({ context: 'asp2_skip_after_create' }); }}
            activeOpacity={0.7}
          >
            <Text style={styles.signInFallbackText}>
              Account created — tap here to sign in
            </Text>
          </TouchableOpacity>
        )}
        {!canSubmit && !capError && !submitError && !signInFailed && (
          <Text style={styles.footerHint}>Select a church or register one to continue</Text>
        )}
      </View>

      {/* Finalization — Skip-for-now confirmation modal. Replaces the
          prior inline amber card + double-tap pattern with a single
          intentional confirm: "I acknowledge — Enter Replant" fires
          the submit immediately; "Go Back" only closes the modal and
          returns the leader to normal church-selection. */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
        statusBarTranslucent
      >
        <View style={styles.skipModalBackdrop}>
          <View style={styles.skipModalCard}>
            <Text style={styles.skipModalTitle}>Skip for now?</Text>
            <Text style={styles.skipModalBody}>
              No problem — you have <Text style={styles.skipModalBodyEmphasis}>7 days</Text> to register your church or join an existing one. After that, your account is deactivated until you're tied to a church.
            </Text>
            <TouchableOpacity
              style={[styles.submitButton, styles.skipModalPrimary]}
              onPress={handleSkipSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>I acknowledge — Enter Replant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipModalSecondary}
              onPress={() => setShowSkipModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.skipModalSecondaryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* B20 — Replace loopback church confirmation. Shown when the
          leader taps a search result while their newly-registered
          church is the current selection. Confirmation orphans the DB
          row (KAN-202 handles cleanup); cancelling preserves the
          loopback church. Mutually exclusive with the skip modal —
          replace is gated on isNewChurchFromLoopback which presupposes
          a selected church (so the leader cannot have triggered skip
          from the same state). */}
      <Modal
        visible={showReplaceModal}
        transparent
        animationType="fade"
        onRequestClose={handleReplaceCancel}
        statusBarTranslucent
      >
        <View style={styles.skipModalBackdrop}>
          <View style={styles.skipModalCard}>
            <Text style={styles.skipModalTitle}>Replace your church?</Text>
            <Text style={styles.skipModalBody}>
              Are you sure you want to join this church? You will lose all progress on the church you are currently registering.
            </Text>
            <TouchableOpacity
              style={[styles.submitButton, styles.skipModalPrimary]}
              onPress={handleReplaceConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipModalSecondary}
              onPress={handleReplaceCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.skipModalSecondaryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* KAN-192 AC 5 — bypass-card delete confirmation. Distinct from
          the Replace modal because the consequence is different:
          delete actually removes the church row via the
          register-church-delete edge function (hard delete), whereas
          Replace just swaps the selection and leaves the orphan row
          for KAN-202 to scrub. The destructive-action framing here is
          intentional. */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeleteCancel}
        statusBarTranslucent
      >
        <View style={styles.skipModalBackdrop}>
          <View style={styles.skipModalCard}>
            <Text style={styles.skipModalTitle}>Are you sure you want to switch?</Text>
            <Text style={styles.skipModalBody}>
              This newly registered church will be deleted and you will land back on the church lookup page.
            </Text>
            {deleteError && (
              <Text style={styles.submitErrorText}>{deleteError}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.submitButton,
                styles.skipModalPrimary,
                styles.deleteModalDestructive,
                deleting && styles.submitButtonDisabled,
              ]}
              onPress={() => { void handleDeleteConfirm(); }}
              disabled={deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={[styles.submitButtonText, styles.deleteModalDestructiveText]}>Switch church</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipModalSecondary}
              onPress={handleDeleteCancel}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text style={styles.skipModalSecondaryText}>Go Back</Text>
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
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    // searchSection above the scroll already provides the breathing
    // room, so the scroll content starts tighter.
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },

  // KAN-192 keyboard-fix v3 — search input lives outside the
  // ScrollView in this fixed section. Sits flush below the header and
  // above the scrollable body. Horizontal padding matches the scroll
  // content so the input width stays consistent.
  searchSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
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
  searchButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  searchButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background,
  },

  // KAN-192 AC 3 — instructional hint shown only while the leader is
  // mid-typing below the MIN_QUERY_LENGTH threshold. Single line, sky-
  // tinted to read as a passive nudge rather than an error.
  searchHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
  },

  capError: {
    backgroundColor: 'rgba(224, 85, 85, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 85, 85, 0.25)',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  capErrorText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.red,
    lineHeight: 22,
  },
  capErrorContact: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.red,
  },

  // KAN-192 — SELECTED card. Surface (#111) gives real presence
  // against the page background; sky border at 40% opacity makes the
  // affordance read clearly without overpowering. ✓ SELECTED eyebrow
  // sits on top so the confirmation is unmistakable. Earlier device
  // pass surfaced an invisible-card bug — root cause was unrelated
  // ScrollView insets, not contrast, so the restrained styling stays.
  selectedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(107, 181, 232, 0.4)',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.accent,
  },
  clearText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  results: {
    gap: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultItem: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  resultItemCapped: {
    opacity: 0.5,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  resultChevron: {
    fontFamily: Typography.body,
    fontSize: 18,
    color: Colors.textMuted,
  },
  cappedLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.amber,
    marginTop: 2,
  },

  // KAN-12 finalization — pending church cascade notice. Sits below the
  // selectedCard when the chosen church is itself awaiting verification.
  // Restrained amber tint — this is a soft cascade notice, not an
  // alarm. Reads as supporting context next to the SELECTED card, not
  // a louder competing surface.
  pendingChurchNotice: {
    backgroundColor: 'rgba(212, 168, 85, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 168, 85, 0.3)',
    padding: Spacing.md,
  },
  pendingChurchNoticeText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.amber,
    lineHeight: 18,
  },

  // Edit / Clear action pair on the SELECTED card. Edit is only shown
  // for the same-session loopback'd new-church (isNewChurchFromLoopback)
  // so a leader who finds an existing church in search can't accidentally
  // edit it.
  selectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    // B12 — gap was Spacing.md (16) which read as a yawning chasm
    // between Edit · Clear; Spacing.xs (4) tightens it to a typical
    // inline-actions pair.
    gap: Spacing.xs,
  },
  // KAN-192 AC 4 — Skip-for-now is a centered blue text link below
  // the register-yours card (NOT a button). Tapping opens the
  // confirmation modal — the modal stays per protection-layer rule.
  // Trigger is sky blue (Colors.accent) so it reads as interactive
  // text, distinct from the muted gray of the prior `skipButtonText`.
  // Founder ruling 2026-06-12: smaller fontSize (13) so the link sits
  // quieter under the register-yours card; arrow glyph dropped — the
  // colour alone carries the affordance.
  skipLink: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  skipLinkText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.accent,
  },

  // Skip-for-now confirmation modal — centered card over a dimmed
  // backdrop. The card holds the title, body, primary (sky-filled)
  // confirm action, and a secondary text-only Go Back affordance.
  skipModalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  skipModalCard: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  skipModalTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  skipModalBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  skipModalPrimary: {
    marginTop: Spacing.sm,
  },
  skipModalSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipModalSecondaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },

  // KAN-192 AC 3 — wireframe v4 empty-state card. Founder ruling
  // 2026-06-12: card should read DARKER / recessed rather than raised.
  // Uses Colors.surface (one step DOWN from the prior surfaceElevated)
  // plus a 1px Colors.border hairline so the card has a defined edge
  // against the page background without looking lifted. Generous
  // vertical padding anchors the icon visually.
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyStateHeading: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyStateHelper: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyStateText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  emptyStateSubtext: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // KAN-192 AC 1 — single anchored "Register yours" card. Wireframe v4
  // layout (Founder 2026-06-12): horizontal row — stacked title +
  // sub-line on the left, sky-blue right-aligned CTA. Sky-tinted
  // surface + sky-accent hairline so the CTA reads as a primary
  // affordance without competing visually with the footer Enter
  // Replant button. Entire card is the tap target.
  registerYoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(107, 181, 232, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 64,
    gap: Spacing.md,
  },
  registerYoursTextBlock: {
    flex: 1,
    gap: 2,
  },
  registerYoursTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
  // Sub-line under the title — explains the CTA action softly. Muted
  // color + smaller size so the eye lands on title + right-aligned CTA
  // first.
  registerYoursSubline: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  registerYoursCta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
    textAlign: 'right',
  },

  churchName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  churchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  churchMetaText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  ragDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  bottomSpacer: { height: Spacing.xxxl },

  footer: {
    // KAN-192 (Session 4) — footer back in flex flow at the end of root.
    // ScrollView's flex:1 fills the space between header and footer,
    // so content cannot scroll into a phantom overlay region. No KAV
    // anywhere on this screen — keyboard naturally overlays the footer;
    // user dismisses (drag-down on scroll) to access Enter Replant.
    // Background tint matches the page so it reads as one continuous
    // surface, not as a floating bar.
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
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
  // KAN-192 — CD redesign (design_handoff_your_church_step2). Footer
  // "Enter Replant" label specifically uses Cormorant Garamond
  // Medium 22pt to match the title register. Applied only to the
  // footer CTA so modal primary buttons (Switch / Confirm / "I
  // acknowledge — Enter Replant") keep the bodyMedium 16pt run that
  // suits short confirmation labels.
  enterReplantText: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    color: Colors.background,
    letterSpacing: 0.2,
  },
  submitButtonTextDisabled: {
    color: 'rgba(107, 181, 232, 0.4)',
  },
  footerHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
  submitErrorText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
  },
  // B8 safety-net fallback. Sky-tinted tappable row beneath the main
  // CTA / error text. Only renders when signInFailed is true (i.e.
  // create-account succeeded but tryAutoSignIn surfaced an error). The
  // primary fix should make this rare; this is the last line of defense
  // before a leader is told to "open the app to continue."
  signInFallback: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  signInFallbackText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
    textDecorationLine: 'underline',
  },

  // KAN-192 AC 5 — bypass confirmation card. Replaces the scroll body
  // when loopback params land. Visual weight: green-tinted check eyebrow
  // ("✓ CHURCH REGISTERED") + church name in display type + meta row
  // mirroring the SELECTED card's pattern + a soft help line + two
  // distinct affordance buttons divided by a hairline. The primary
  // Enter Replant CTA stays in the footer (not duplicated here).
  // KAN-192 — CD redesign (design_handoff_your_church_step2). Card
  // uses Colors.surface with a subtle hairline border (Colors.border
  // at full token alpha). Ribbon row at top owns the registered
  // eyebrow + inline Edit; body holds name + meta + the named
  // status row.
  bypassCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg + 4,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  bypassRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(107, 181, 232, 0.04)',
  },
  bypassRibbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bypassRibbonCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(107, 181, 232, 0.35)',
    backgroundColor: 'rgba(107, 181, 232, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bypassRibbonCheckGlyph: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    color: Colors.accent,
    lineHeight: 11,
  },
  bypassRibbonLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  bypassRibbonEdit: {
    paddingVertical: 2,
  },
  bypassRibbonEditText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.accent,
  },
  bypassCardBody: {
    paddingHorizontal: Spacing.md + 6,
    paddingTop: Spacing.lg - 4,
    paddingBottom: Spacing.lg - 2,
  },
  bypassChurchName: {
    fontFamily: Typography.displayMedium,
    fontSize: 24,
    lineHeight: 27,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  bypassChurchMeta: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.xs + 2,
  },
  bypassChurchMetaSep: {
    color: 'rgba(240, 237, 230, 0.35)',
  },
  // "Made a mistake? Switch ›" lives BELOW the card. Quiet text link
  // — destructive confirmation lives inside the Switch flow, not on
  // this screen surface. Centered.
  // 2026-06-20 — Underground safe-mode reassurance, OUTSIDE the bypass
  // card per Founder ruling. Canonical infoNotice treatment to match the
  // para tooltip pattern on RegCP1 (soft-blue background tint, bordered,
  // ⓘ icon prefix). Reads as informational, not free-floating.
  bypassUndergroundNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(107, 181, 232, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(107, 181, 232, 0.25)',
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  bypassUndergroundNoteIcon: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.accent,
    marginTop: 1,
  },
  bypassUndergroundNoteText: {
    flex: 1,
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  bypassSwitchLink: {
    alignSelf: 'center',
    marginTop: Spacing.md + 2,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
  },
  bypassSwitchLinkText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  bypassSwitchLinkStrong: {
    fontFamily: Typography.bodyMedium,
    color: Colors.text,
  },

  // KAN-192 AC 4 — emphasised "7 days" inside the locked skip-modal copy.
  // Same fontSize as the body run; bodyMedium weight ties the eye to the
  // number without re-tinting it (no color change — the body stays muted).
  skipModalBodyEmphasis: {
    fontFamily: Typography.bodyMedium,
    color: Colors.text,
  },

  // KAN-192 AC 5 — delete-confirm primary button override. Red surface
  // with light text. The light text override (Colors.text) is necessary
  // because submitButtonText uses Colors.background which is dark and
  // unreadable against a red fill.
  deleteModalDestructive: {
    backgroundColor: Colors.red,
  },
  deleteModalDestructiveText: {
    color: Colors.text,
  },
});
