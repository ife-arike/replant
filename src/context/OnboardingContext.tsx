// ─────────────────────────────────────────────
// Replant — Onboarding Context
// Holds all onboarding form state in memory.
// Nothing is written to the server until final submission on Page 2.
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

interface PersonalDetails {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  country: string;
}

interface ChurchDetails {
  churchId?: string;       // if joining existing
  churchName?: string;     // if registering new
  churchType?: string;
  country?: string;
  cityRegion?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  ragStatus?: string;
  lat?: number;
  lng?: number;
}

interface OnboardingState {
  personalDetails: Partial<PersonalDetails>;
  churchDetails: Partial<ChurchDetails>;
  declarationAgreed: boolean;
}

interface OnboardingContextValue {
  state: OnboardingState;
  setPersonalDetails: (details: Partial<PersonalDetails>) => void;
  setChurchDetails: (details: Partial<ChurchDetails>) => void;
  setDeclarationAgreed: (agreed: boolean) => void;
  reset: () => void;
}

const defaultState: OnboardingState = {
  personalDetails: {},
  churchDetails: {},
  declarationAgreed: false,
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

  const reset = () => setState(defaultState);

  return (
    <OnboardingContext.Provider
      value={{ state, setPersonalDetails, setChurchDetails, setDeclarationAgreed, reset }}
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
