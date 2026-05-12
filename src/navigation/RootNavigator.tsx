// Root native-stack navigator — KAN-87 foundation (AC-4, AC-5),
// patched per KAN-10 SM ruling 11047 (Path B).
//
// Conditionally registers Screens based on useAuth().branch. React Navigation
// re-renders the navigator when the registered Screens change, which means an
// auth state transition (active → pending, etc.) cleanly unmounts the previous
// branch's tree and mounts the new one — no stale state, no manual reset.
//
// Branch mapping per AC-5 (locked KAN-44 contract, comment 10292):
//   active                   → Tabs + Settings push
//   pending                  → Pending placeholder (KAN-35 takes over)
//   deactivated              → Deactivated placeholder (KAN-36 takes over)
//   unauthenticated / loading → DeclarationOfFaith → AccountSetup1Placeholder
//
// Per SM ruling 11047, KAN-10 (Path B) replaces the unauthenticated-branch's
// Login placeholder with the Declaration of Faith flow as the cold-launch
// landing. KAN-9 (Splash) and KAN-38 (Login) re-introduce the splash + login
// surfaces in their respective tickets; LoginPlaceholderScreen.tsx remains in
// the repo as orphan source for KAN-38 to repurpose.
//
// gestureEnabled: false on both unauthenticated routes — KAN-10 AC requires no
// back gesture from DoF, and after navigation.replace to AccountSetup1
// there is no DoF in the stack to back-into anyway.

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthProvider";
import AccountSetup1PlaceholderScreen from "../screens/auth/AccountSetup1PlaceholderScreen";
import DeactivatedPlaceholderScreen from "../screens/auth/DeactivatedPlaceholderScreen";
import PendingPlaceholderScreen from "../screens/auth/PendingPlaceholderScreen";
import DeclarationOfFaithScreen from "../screens/onboarding/DeclarationOfFaithScreen";
import SettingsScreenContainer from "../screens/main/SettingsScreenContainer";
import TabNavigator from "./TabNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { branch } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {branch === "active" && (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="Settings" component={SettingsScreenContainer} />
        </>
      )}
      {branch === "pending" && (
        <Stack.Screen name="Pending" component={PendingPlaceholderScreen} />
      )}
      {branch === "deactivated" && (
        <Stack.Screen name="Deactivated" component={DeactivatedPlaceholderScreen} />
      )}
      {(branch === "unauthenticated" || branch === "loading") && (
        <>
          <Stack.Screen
            name="DeclarationOfFaith"
            component={DeclarationOfFaithScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="AccountSetup1Placeholder"
            component={AccountSetup1PlaceholderScreen}
            options={{ gestureEnabled: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
