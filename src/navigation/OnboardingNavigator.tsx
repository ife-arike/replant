// ─────────────────────────────────────────────
// Replant — Onboarding Navigator
// Back navigation rules:
//   Splash → DoF:   no system back; DoF renders its own "Back" → Splash
//                   (Founder ruling 2026-06-12: leaders who tap Sign Up
//                   by mistake must have a visible way out before they
//                   affirm).
//   DoF → Page1:    no system back; Page 1 renders its own "Back" →
//                   Splash and calls OnboardingContext.reset() so the
//                   in-memory affirmation is discarded. Re-entry shows
//                   DoF clean.
//   Page1 → Page2:  back allowed via swipe / system back (first
//                   reversible step post-DoF).
//   Page2 → ChurchReg: back allowed (cancel returns here).
//   ChurchReg pages: back allowed within registration flow.
//
// KAN-196 (D-63, 2026-05-22): the standalone AnonymousModeScreen was
// removed; the anonymous toggle now lives inline on AccountSetupPage1.
// Flow is Page1 → Page2 directly.
// ─────────────────────────────────────────────

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingProvider } from '../context/OnboardingContext';

import SplashScreen from '../screens/onboarding/SplashScreen';
import DeclarationOfFaithScreen from '../screens/onboarding/DeclarationOfFaithScreen';
import AccountSetupPage1Screen from '../screens/onboarding/AccountSetupPage1Screen';
import AccountSetupPage2Screen from '../screens/onboarding/AccountSetupPage2Screen';
import RegisterChurchPage1Screen from '../screens/onboarding/RegisterChurchPage1Screen';
import RegisterChurchPage2Screen from '../screens/onboarding/RegisterChurchPage2Screen';
import LoginPlaceholderScreen from '../screens/onboarding/LoginPlaceholderScreen';
import ForgotPasswordScreen from '../screens/onboarding/ForgotPasswordScreen';

// AccountSetupPage2 accepts an optional KAN-13 loopback payload — when the
// leader returns from registering a brand-new church, KAN-13 navigates back
// with the freshly-created church so Page 2 can pre-select it (and tag the
// create-account submit with isNewChurch: true → Step 7 team email fires).
// leader_count was added with KAN-pending — used by ASP2's pending-cascade
// notice to suppress the warning for 0-leader churches.
export interface AccountSetupPage2LoopbackChurch {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  at_capacity: boolean;
  // Always 0 at the loopback site — the leader hasn't been linked yet
  // (that happens at the create-account submit on ASP2). Required so
  // the type matches ChurchResult and the loopback church can flow
  // through setSelectedChurch without an unsafe widening.
  leader_count: number;
}

// Edit-church payload passed from ASP2's Edit affordance into the
// RegisterChurchPage1 → Page2 flow. Pre-fills the basic identity fields
// (name/type/city/country/rag) so the leader can fix a typo without
// re-typing the whole form. Contact fields are not in ChurchResult, so
// they pre-fill empty — the leader re-enters them on the edit pass.
// MVP limitation: there is no PATCH endpoint on register-church, so the
// "Apply Changes" submit creates a NEW church row server-side. Acceptable
// for MVP per dispatch; a future PATCH would let this loop be a true edit.
export interface OnboardingEditChurch {
  churchId: string;
  churchName: string;
  churchType: string;
  cityRegion: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  ragStatus: string;
}

export type OnboardingStackParamList = {
  Splash: undefined;
  DeclarationOfFaith: undefined;
  AccountSetupPage1: undefined;
  AccountSetupPage2:
    | {
        newChurchId?: string;
        newChurch?: AccountSetupPage2LoopbackChurch;
      }
    | undefined;
  RegisterChurchPage1:
    | {
        editChurch?: OnboardingEditChurch;
      }
    | undefined;
  RegisterChurchPage2:
    | {
        isEditMode?: boolean;
        editChurch?: OnboardingEditChurch;
      }
    | undefined; // KAN-14 — needs textarea + final non-underground submit
  Login: undefined; // KAN-26 — placeholder destination from Splash "Sign In"
  ForgotPassword: undefined; // KAN-38 — Screen 06A reset-link request flow
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <OnboardingProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false, // controlled per-screen below
        }}
      >
        {/* No back — entry point */}
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ gestureEnabled: false }}
        />

        {/* No back — agreement screen */}
        <Stack.Screen
          name="DeclarationOfFaith"
          component={DeclarationOfFaithScreen}
          options={{ gestureEnabled: false }}
        />

        {/* No back — cannot return to DoF after agreeing */}
        <Stack.Screen
          name="AccountSetupPage1"
          component={AccountSetupPage1Screen}
          options={{ gestureEnabled: false }}
        />

        {/* Back allowed — returns to AccountSetupPage1 (KAN-196 D-63:
            standalone AnonymousModeScreen removed; anonymous toggle is
            now inline on Page 1). */}
        <Stack.Screen
          name="AccountSetupPage2"
          component={AccountSetupPage2Screen}
          options={{ gestureEnabled: true }}
        />

        {/* Back allowed — returns to Page 2 */}
        <Stack.Screen
          name="RegisterChurchPage1"
          component={RegisterChurchPage1Screen}
          options={{ gestureEnabled: true }}
        />

        {/* KAN-14 — needs + final non-underground submit; back returns to Page 1 */}
        <Stack.Screen
          name="RegisterChurchPage2"
          component={RegisterChurchPage2Screen}
          options={{ gestureEnabled: true }}
        />

        {/* Login placeholder — KAN-26 will ship the real screen */}
        <Stack.Screen
          name="Login"
          component={LoginPlaceholderScreen}
          options={{ gestureEnabled: true }}
        />

        {/* KAN-38 — Forgot Password (Screen 06A); back allowed to Login */}
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ gestureEnabled: true }}
        />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
