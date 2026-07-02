// ─────────────────────────────────────────────
// Replant — Onboarding Context
// Holds all onboarding form state in memory.
// Nothing is written to the server until final submission on Page 2.
// ─────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useState } from 'react';

// B13 — Loopback church survives the CommonActions.reset that fires
// when RegisterChurchPage2 returns a successful registration. Without
// this, the fresh ASP2 instance loses selectedChurch + the
// isNewChurchFromLoopback flag (they live in component useState). The
// Edit affordance + isNewChurch flag at submit both depend on this.
// Shape mirrors search-churches' ChurchResult plus leader_count so the
// in-memory selectedChurch can be reconstructed from context on remount.
export interface OnboardingLoopbackChurch {
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

interface PersonalDetails {
  firstName: string;
  // KAN-229: optional middle name. Empty string is the canonical "no
  // middle" value (~75% of leaders); preserved through the write path
  // and stored as '' in users.middle_name (NOT NULL).
  middleName?: string;
  lastName: string;
  email: string;
  // KAN-231: optional personal phone. Empty string == not provided.
  // Replant team contact fallback only; never surfaced to other leaders.
  phone?: string;
  password: string;
  role: string;
  country: string;
  anonymous?: boolean; // KAN-83 — D-37 field; held in context until create-account on KAN-12
  // B15 — free-text describing the leader's role when role === 'other'.
  // Surfaced for the Replant team to review; account displays as Minister
  // in the interim per the inline tooltip copy.
  otherRole?: string;
}

interface ChurchDetails {
  churchId?: string;       // if joining existing
  churchName?: string;     // if registering new
  churchType?: string;
  country?: string;
  cityRegion?: string;
  address?: string;
  // KAN-13 v2 — admin-only PII. Always carried for both underground and
  // non-underground churches; never surfaced to non-admin leaders.
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  ragStatus?: string;
  lat?: number;
  lng?: number;
  // Finalization — Page 2 needs/has free-text. Persisted to context on
  // every change so back-nav restores the leader's work (they don't
  // re-type if they bounce back from a later step).
  hasText?: string;
  needsText?: string;
  // B18 — emergency preparedness responses. Tri-state: null = unanswered.
  // Persisted so back-nav and edit-path restore prior selections.
  hasEmergencyPlan?: boolean | null;
  openToCollaboration?: boolean | null;
  // Underground flow (2026-06-19/20). Captured on NameVisibilityChoice
  // before final submit. Defaults to false (keep name hidden); irreversible
  // commit gate fires when leader toggles to true. Server-side default also
  // false post-Migration A — passing undefined is safe.
  showChurchName?: boolean;
}

// Branch-flow extensions (2026-06-18). Set on RegisterIntroScreen choice.
// 'standalone' = standard RegCP1 (type picker visible).
// 'branch'     = branch RegCP1 (type picker hidden, parent-picker leads).
// 'underground'= dedicated secure underground RegCP1 (existing UX).
export type RegistrationEntry = 'standalone' | 'branch' | 'underground';

// Resolved parent reference. Selected via ParentChurchPicker (RPL ID or name).
export interface OnboardingParentRef {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  type: string;
  verificationStatus: 'verified' | 'pending';
  churchCode: string | null;
  isHeadquarters: boolean;
}

// Deferred-parent claim. Filled when leader picks "Not Sure" or "Parent not on
// Replant yet" — name + city + country typed locally; resolves via nightly
// auto_link or admin manual-link.
export interface OnboardingPendingClaim {
  name: string;
  city: string | null;
  country: string | null;
}

interface OnboardingState {
  personalDetails: Partial<PersonalDetails>;
  churchDetails: Partial<ChurchDetails>;
  declarationAgreed: boolean;
  loopbackChurch: OnboardingLoopbackChurch | null;
  // Branch-flow extensions (2026-06-18)
  registrationEntry: RegistrationEntry | null;
  parentRef: OnboardingParentRef | null;
  pendingParentClaim: OnboardingPendingClaim | null;
  isHeadquarters: boolean;
}

interface OnboardingContextValue {
  state: OnboardingState;
  setPersonalDetails: (details: Partial<PersonalDetails>) => void;
  setChurchDetails: (details: Partial<ChurchDetails>) => void;
  setDeclarationAgreed: (agreed: boolean) => void;
  // B13 — replaces outright (not merged) since loopback is a discrete
  // "selected loopback church" or "no loopback church" state.
  setLoopbackChurch: (church: OnboardingLoopbackChurch | null) => void;
  // Branch-flow setters (2026-06-18)
  setRegistrationEntry: (entry: RegistrationEntry | null) => void;
  setParentRef: (parent: OnboardingParentRef | null) => void;
  setPendingParentClaim: (claim: OnboardingPendingClaim | null) => void;
  setIsHeadquarters: (hq: boolean) => void;
  reset: () => void;
}

const defaultState: OnboardingState = {
  personalDetails: {},
  churchDetails: {},
  declarationAgreed: false,
  loopbackChurch: null,
  registrationEntry: null,
  parentRef: null,
  pendingParentClaim: null,
  isHeadquarters: false,
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(defaultState);

  // 2026-06-18 hotfix — all setters wrapped in useCallback so they're stable
  // across renders. Consumer useEffects depending on these setters (e.g.,
  // RegCP1's hqChecked mirror) would otherwise loop infinitely when the setter
  // reference recreates each render.
  const setPersonalDetails = useCallback((details: Partial<PersonalDetails>) => {
    setState(prev => ({
      ...prev,
      personalDetails: { ...prev.personalDetails, ...details },
    }));
  }, []);

  const setChurchDetails = useCallback((details: Partial<ChurchDetails>) => {
    setState(prev => ({
      ...prev,
      churchDetails: { ...prev.churchDetails, ...details },
    }));
  }, []);

  const setDeclarationAgreed = useCallback((agreed: boolean) => {
    setState(prev => ({ ...prev, declarationAgreed: agreed }));
  }, []);

  const setLoopbackChurch = useCallback((church: OnboardingLoopbackChurch | null) => {
    setState(prev => ({ ...prev, loopbackChurch: church }));
  }, []);

  const setRegistrationEntry = useCallback((entry: RegistrationEntry | null) => {
    setState(prev => ({ ...prev, registrationEntry: entry }));
  }, []);
  // Setting a parent clears any pending claim (mutually exclusive — only one
  // can populate at a time; mirrors the create-account v7 payload contract).
  const setParentRef = useCallback((parent: OnboardingParentRef | null) => {
    setState(prev => ({
      ...prev,
      parentRef: parent,
      pendingParentClaim: parent === null ? prev.pendingParentClaim : null,
    }));
  }, []);
  const setPendingParentClaim = useCallback((claim: OnboardingPendingClaim | null) => {
    setState(prev => ({
      ...prev,
      pendingParentClaim: claim,
      parentRef: claim === null ? prev.parentRef : null,
    }));
  }, []);
  const setIsHeadquarters = useCallback((hq: boolean) => {
    setState(prev => ({ ...prev, isHeadquarters: hq }));
  }, []);

  const reset = () => setState(defaultState);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setPersonalDetails,
        setChurchDetails,
        setDeclarationAgreed,
        setLoopbackChurch,
        setRegistrationEntry,
        setParentRef,
        setPendingParentClaim,
        setIsHeadquarters,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
