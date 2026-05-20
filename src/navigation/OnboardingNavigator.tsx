// ─────────────────────────────────────────────
// Replant — Onboarding Navigator
// Back navigation rules:
//   Splash → DoF: no back (headerLeft removed)
//   DoF → Page1: no back (agreement must stand)
//   Page1 → AnonymousMode: back allowed (first reversible step post-DoF)
//   AnonymousMode → Page2: back allowed
//   Page2 → ChurchReg: back allowed (cancel returns here)
//   ChurchReg pages: back allowed within registration flow
// ─────────────────────────────────────────────

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingProvider } from '../context/OnboardingContext';

import SplashScreen from '../screens/onboarding/SplashScreen';
import DeclarationOfFaithScreen from '../screens/onboarding/DeclarationOfFaithScreen';
import AccountSetupPage1Screen from '../screens/onboarding/AccountSetupPage1Screen';
import AnonymousModeScreen from '../screens/onboarding/AnonymousModeScreen';
import AccountSetupPage2Screen from '../screens/onboarding/AccountSetupPage2Screen';
import RegisterChurchPage1Screen from '../screens/onboarding/RegisterChurchPage1Screen';
import LoginPlaceholderScreen from '../screens/onboarding/LoginPlaceholderScreen';

// AccountSetupPage2 accepts an optional KAN-13 loopback payload — when the
// leader returns from registering a brand-new church, KAN-13 navigates back
// with the freshly-created church so Page 2 can pre-select it (and tag the
// create-account submit with isNewChurch: true → Step 7 team email fires).
export interface AccountSetupPage2LoopbackChurch {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  at_capacity: boolean;
}

export type OnboardingStackParamList = {
  Splash: undefined;
  DeclarationOfFaith: undefined;
  AccountSetupPage1: undefined;
  AnonymousMode: undefined;
  AccountSetupPage2:
    | {
        newChurchId?: string;
        newChurch?: AccountSetupPage2LoopbackChurch;
      }
    | undefined;
  RegisterChurchPage1: undefined;
  Login: undefined; // KAN-26 — placeholder destination from Splash "Sign In"
  // Screen 10 (RegisterChurchPage2 / MapPin) — gated on MAP wiring confirmation
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

        {/* Back allowed — returns to Page 1 */}
        <Stack.Screen
          name="AnonymousMode"
          component={AnonymousModeScreen}
          options={{ gestureEnabled: true }}
        />

        {/* Back allowed — returns to AnonymousMode */}
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

        {/* Login placeholder — KAN-26 will ship the real screen */}
        <Stack.Screen
          name="Login"
          component={LoginPlaceholderScreen}
          options={{ gestureEnabled: true }}
        />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
