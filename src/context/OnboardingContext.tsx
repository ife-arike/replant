// ─────────────────────────────────────────────
// Replant — Onboarding Context
// Holds all onboarding form state in memory.
// Nothing is written to the server until final submission on Page 2.
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

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
}

interface OnboardingState {
  personalDetails: Partial<PersonalDetails>;
  churchDetails: Partial<ChurchDetails>;
  declarationAgreed: boolean;
  loopbackChurch: OnboardingLoopbackChurch | null;
}

interface OnboardingContextValue {
  state: OnboardingState;
  setPersonalDetails: (details: Partial<PersonalDetails>) => void;
  setChurchDetails: (details: Partial<ChurchDetails>) => void;
  setDeclarationAgreed: (agreed: boolean) => void;
  // B13 — replaces outright (not merged) since loopback is a discrete
  // "selected loopback church" or "no loopback church" state.
  setLoopbackChurch: (church: OnboardingLoopbackChurch | null) => void;
  reset: () => void;
}

const defaultState: OnboardingState = {
  personalDetails: {},
  churchDetails: {},
  declarationAgreed: false,
  loopbackChurch: null,
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(defaultState);

  const setPersonalDetails = (details: Partial<PersonalDetails>) => {
    setState(prev => ({
      ...prev,
      personalDetails: { ...prev.personalDetails, ...details },
    }));
  };

  const setChurchDetails = (details: Partial<ChurchDetails>) => {
    setState(prev => ({
      ...prev,
      churchDetails: { ...prev.churchDetails, ...details },
    }));
  };

  const setDeclarationAgreed = (agreed: boolean) => {
    setState(prev => ({ ...prev, declarationAgreed: agreed }));
  };

  const setLoopbackChurch = (church: OnboardingLoopbackChurch | null) => {
    setState(prev => ({ ...prev, loopbackChurch: church }));
  };

  const reset = () => setState(defaultState);

  return (
    <OnboardingContext.Provider
      value={{ state, setPersonalDetails, setChurchDetails, setDeclarationAgreed, setLoopbackChurch, reset }}
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
