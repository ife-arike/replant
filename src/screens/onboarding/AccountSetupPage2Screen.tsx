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

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { getChurchTypeLabel } from '../../utils/displayHelpers';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountSetupPage2'>;

// Mirrors the BE `search-churches` row shape — at_capacity is computed
// server-side (active leader count ≥ 2). FE never sees the raw count;
// the server-side capacity guard in create-account re-applies the same
// threshold at write time.
export interface ChurchResult {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  at_capacity: boolean;
}

const SEARCH_CHURCHES_URL = `${SUPABASE_URL}/functions/v1/search-churches`;
const CREATE_ACCOUNT_URL = `${SUPABASE_URL}/functions/v1/create-account`;
const CHECK_EMAIL_URL = `${SUPABASE_URL}/functions/v1/check-email-available`;

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

const RAG_COLORS: Record<string, string> = {
  green: Colors.green,
  amber: Colors.amber,
  red: Colors.red,
};

export default function AccountSetupPage2Screen({ navigation, route }: Props) {
  const { state, setChurchDetails } = useOnboarding();
  const personalDetails = state.personalDetails;

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ChurchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<ChurchResult | null>(null);
  const [capError, setCapError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // True only when the current selection came from the KAN-13 loopback —
  // controls the create-account `isNewChurch` payload flag (Step 7 email).
  const [isNewChurchFromLoopback, setIsNewChurchFromLoopback] = useState(false);

  // Bumped on every new keystroke; in-flight responses check this against
  // their captured value before applying. Belt-and-suspenders alongside
  // AbortController — covers the case where a response lands after a
  // newer query has been kicked off but the abort hasn't propagated.
  const searchVersionRef = useRef(0);

  const canSubmit = !!selectedChurch && !capError;

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
  useEffect(() => {
    const incoming = route.params?.newChurch;
    if (incoming) {
      setSelectedChurch(incoming);
      setIsNewChurchFromLoopback(true);
      setCapError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.newChurchId]);

  const doSearch = async (q: string, version: number, signal: AbortSignal) => {
    setSearching(true);
    setSelectedChurch(null);
    setIsNewChurchFromLoopback(false);
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
    setSelectedChurch(church);
    // A selection from the search list is NOT a new-church flow.
    setIsNewChurchFromLoopback(false);
  };

  const handleRegisterNew = () => {
    navigation.navigate('RegisterChurchPage1');
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
   * just-set credentials. The AuthProvider listens on
   * onAuthStateChange and the RootNavigator swaps to the authenticated
   * branch when the session lands. No manual nav.reset needed.
   */
  const tryAutoSignIn = async () => {
    const email = personalDetails.email ?? '';
    const password = personalDetails.password ?? '';
    if (!email || !password) {
      setSubmitError(
        'Account created — sign in failed. Please open the app to continue.',
      );
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitError(
        'Account created — sign in failed. Please open the app to continue.',
      );
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    if (!selectedChurch) return;
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

    setSubmitError(null);
    setSubmitting(true);
    setChurchDetails({ churchId: selectedChurch.id });

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
      const response = await fetch(CREATE_ACCOUNT_URL, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: personalDetails.firstName,
          lastName: personalDetails.lastName,
          email: personalDetails.email,
          password: personalDetails.password,
          role: personalDetails.role,
          anonymous: personalDetails.anonymous ?? false,
          churchId: selectedChurch.id,
          isNewChurch: isNewChurchFromLoopback,
        }),
      });

      if (response.status === 429) {
        setSubmitError(COPY_RATE_LIMITED);
        return;
      }

      if (response.ok) {
        // 200 — account created. Sign in; AuthProvider routes to main app.
        await tryAutoSignIn();
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
          await tryAutoSignIn();
          return;
        }
      }
      setSubmitError(COPY_GENERIC_FAIL);
    } catch {
      // Network error from create-account itself — Layer 2 retry guard.
      const recheck = await checkEmailAvailable(personalDetails.email);
      if (recheck.kind === 'registered') {
        await tryAutoSignIn();
        return;
      }
      setSubmitError(COPY_NETWORK_FAIL);
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

      {/* Header with back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>ACCOUNT SETUP · 2 OF 2</Text>
        <Text style={styles.title}>Your Church</Text>
        <Text style={styles.subtitle}>
          Every leader in the network is tied to a church. Search for yours below, or register a new one.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by church name or city..."
            placeholderTextColor={Colors.textSubtle}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCorrect={false}
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

        {/* 2-leader cap error */}
        {capError && (
          <View style={styles.capError}>
            <Text style={styles.capErrorText}>
              This church already has 2 leaders. Contact them directly or register a new entry.
            </Text>
            <Text style={styles.capErrorContact}>connect@projectreplant.org</Text>
          </View>
        )}

        {/* Selected church */}
        {selectedChurch && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedLabel}>SELECTED</Text>
              <TouchableOpacity onPress={() => setSelectedChurch(null)}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.churchName}>{selectedChurch.name}</Text>
            <View style={styles.churchMeta}>
              <View style={[styles.ragDot, { backgroundColor: RAG_COLORS[selectedChurch.rag_status] }]} />
              <Text style={styles.churchMetaText}>
                {getChurchTypeLabel(selectedChurch.type)} · {selectedChurch.city}
              </Text>
            </View>
          </View>
        )}

        {/* Empty state B — no search yet, initial screen load */}
        {!searched && !searching && !selectedChurch && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateSubtext}>
              Search by church name or city to find your church.
            </Text>
          </View>
        )}

        {/* Empty state A — searched, no results */}
        {searched && results.length === 0 && !selectedChurch && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No churches found. Want to register yours?</Text>
            <TouchableOpacity onPress={handleRegisterNew} activeOpacity={0.7}>
              <Text style={styles.emptyStateCta}>Register a new church</Text>
            </TouchableOpacity>
          </View>
        )}

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
                  <View style={[styles.ragDot, { backgroundColor: RAG_COLORS[church.rag_status] }]} />
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

        {/* Register new */}
        <View style={styles.registerSection}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegisterNew}
            activeOpacity={0.8}
          >
            <Text style={styles.registerButtonText}>Register a New Church</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Complete Registration */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
              Complete Registration
            </Text>
          )}
        </TouchableOpacity>
        {submitError && (
          <Text style={styles.submitErrorText}>{submitError}</Text>
        )}
        {!canSubmit && !capError && !submitError && (
          <Text style={styles.footerHint}>Select or register a church to continue</Text>
        )}
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
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
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

  selectedCard: {
    backgroundColor: 'rgba(107, 181, 232, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
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

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
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
  emptyStateCta: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
    marginTop: Spacing.sm,
  },

  registerSection: {
    gap: Spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  registerButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  registerButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
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
});
