// Root native-stack navigator — KAN-87 foundation (AC-4, AC-5),
// patched per KAN-10 SM ruling 11047 (Path B), UAT wiring fix for
// KAN-11/83/12, and the nav-loop fix that follows.
//
// Conditionally registers Screens based on useAuth().branch. React Navigation
// re-renders the navigator when the registered Screens change, which means an
// auth state transition (active → pending, etc.) cleanly unmounts the previous
// branch's tree and mounts the new one — no stale state, no manual reset.
//
// Branch mapping per AC-5 (locked KAN-44 contract, comment 10292;
// KAN-35 routing ruling Founder 2026-05-22 — pending now joins active
// in the Tabs + Settings tree, with a verification countdown banner
// on Home as the visible signal; KAN-36 v2 SEC c.14235 + Founder
// c.14236 — the deactivated branch is gone, replaced by a modal
// overlay rendered above the navigator from App.tsx):
//   active | pending          → Tabs + Settings push
//   unauthenticated / loading → Onboarding (nested OnboardingNavigator
//                                — Splash → DoF → AccountSetupPage1 →
//                                AnonymousMode → AccountSetupPage2 →
//                                RegisterChurchPage1)
//
// Root no longer registers a top-level DeclarationOfFaith screen — that
// responsibility now lives entirely inside OnboardingNavigator. The
// previous Root-level DoF + Onboarding pair caused an infinite loop on
// affirm (DoF.replace("Onboarding") → Onboarding.Splash.replace("DoF")
// → back to a fresh DoF, ad nauseam). DeclarationOfFaith remains in
// RootStackParamList per the Login-route precedent — kept as a type-list
// entry so a future ticket can re-mount it at Root level without churn.
//
// gestureEnabled: false on the unauthenticated branch — KAN-10 AC requires
// no back gesture from DoF, and DoF is the first reachable screen inside
// the nested OnboardingNavigator stack.

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthProvider";
import HeartcrySubmissionScreen from "../screens/main/HeartcrySubmissionScreen";
import SettingsScreenContainer from "../screens/main/SettingsScreenContainer";
import SetNewPasswordScreen from "../screens/onboarding/SetNewPasswordScreen";
import ArticleReaderScreen from "../screens/main/persecuted/readers/ArticleReaderScreen";
import GuidanceReaderScreen from "../screens/main/persecuted/readers/GuidanceReaderScreen";
import StoryArchiveScreen from "../screens/main/persecuted/readers/StoryArchiveScreen";
import WitnessArchiveScreen from "../screens/main/persecuted/readers/WitnessArchiveScreen";
import TheVisionScreen from "../screens/main/hamburger/TheVisionScreen";
import OutreachMissionsScreen from "../screens/main/hamburger/OutreachMissionsScreen";
import InviteScreen from "../screens/main/hamburger/InviteScreen";
import FAQScreen from "../screens/main/hamburger/FAQScreen";
import AddressNetworkScreen from "../screens/main/addressNetwork/AddressNetworkScreen";
import EditReviewScreen from "../screens/main/addressNetwork/EditReviewScreen";
import JoinCodeRevealScreen from "../screens/main/JoinCodeRevealScreen";
import OnboardingNavigator from "./OnboardingNavigator";
import TabNavigator from "./TabNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { branch } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Underground Verification Queue (manifest 2026-06-22) —
          'request_info' and 'soft_deleted' route into Tabs too. The
          leader's app still mounts; the appropriate Home-tab modal /
          banner / read-only gating handles the sub-state. The leader
          is NEVER logged out. */}
      {(branch === "active" ||
        branch === "pending" ||
        branch === "request_info" ||
        branch === "soft_deleted") && (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="Settings" component={SettingsScreenContainer} />
          {/* KAN-64 — Heartcry submission form. Pushed from the
              Persecuted tab; tab bar hidden while this is on top. The
              screen itself self-gates on the verified DB literal at
              submit time (the edge function enforces). */}
          <Stack.Screen name="HeartcrySubmission" component={HeartcrySubmissionScreen} />
          {/* Persecuted tab — pushed reader/archive screens (slide_from_right).
              Tab bar hidden while any of these are on top. */}
          <Stack.Screen
            name="ArticleReader"
            component={ArticleReaderScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="GuidanceReader"
            component={GuidanceReaderScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="StoryArchive"
            component={StoryArchiveScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="WitnessArchive"
            component={WitnessArchiveScreen}
            options={{ animation: 'slide_from_right' }}
          />
          {/* Hamburger sprint (CD v5 final) — pushed from Home-tab panel.
              Vision / Outreach / FAQ slide in from the right; Invite presents
              as a full-screen modal that slides up from the bottom. */}
          <Stack.Screen
            name="TheVision"
            component={TheVisionScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="OutreachMissions"
            component={OutreachMissionsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="InviteToReplant"
            component={InviteScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="FAQ"
            component={FAQScreen}
            options={{ animation: 'slide_from_right' }}
          />
          {/* Address the Network (KAN-337) — hamburger-launched leader
              submission flow + the pushed edits-review consent screen. Both
              slide in from the right, matching the other hamburger screens.
              Entry is gated to verified leaders in HamburgerPanel; the
              routes are harmless to register for pending/etc. since nothing
              navigates to them without the (hidden) row. */}
          <Stack.Screen
            name="AddressNetwork"
            component={AddressNetworkScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AddressNetworkEditReview"
            component={EditReviewScreen}
            options={{ animation: 'slide_from_right' }}
          />
          {/* Underground one-shot join-code reveal (2026-06-20). Full-screen
              takeover; NON-DISMISSIBLE via swipe gesture or Android hardware
              back once the leader passes the pre-reveal "I'm somewhere
              private" gate. The pre-gate screen itself IS dismissible —
              leader can cancel and come back later, so the route is opted
              into via a Home-tab CTA rather than auto-presented. */}
          <Stack.Screen
            name="JoinCodeReveal"
            component={JoinCodeRevealScreen}
            options={{
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
        </>
      )}
      {(branch === "unauthenticated" || branch === "loading") && (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingNavigator}
          options={{ gestureEnabled: false }}
        />
      )}
      {branch === "password_recovery" && (
        <Stack.Screen
          name="PasswordRecovery"
          component={SetNewPasswordScreen}
          options={{ gestureEnabled: false }}
        />
      )}
    </Stack.Navigator>
  );
}
