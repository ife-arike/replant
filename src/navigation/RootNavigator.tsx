// Root native-stack navigator — KAN-87 foundation (AC-4, AC-5).
//
// Conditionally registers Screens based on useAuth().branch. React Navigation
// re-renders the navigator when the registered Screens change, which means an
// auth state transition (active → pending, etc.) cleanly unmounts the previous
// branch's tree and mounts the new one — no stale state, no manual reset.
//
// Branch mapping per AC-5 (locked KAN-44 contract, comment 10292):
//   active        → Tabs + Settings push
//   pending       → Pending placeholder (KAN-35 takes over)
//   deactivated   → Deactivated placeholder (KAN-36 takes over)
//   unauthenticated (incl. all 401 paths) → Login placeholder (KAN-38 takes over)

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthProvider";
import LoginPlaceholderScreen from "../screens/auth/LoginPlaceholderScreen";
import PendingPlaceholderScreen from "../screens/auth/PendingPlaceholderScreen";
import DeactivatedPlaceholderScreen from "../screens/auth/DeactivatedPlaceholderScreen";
import SettingsPlaceholderScreen from "../screens/main/SettingsPlaceholderScreen";
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
          <Stack.Screen name="Settings" component={SettingsPlaceholderScreen} />
        </>
      )}
      {branch === "pending" && (
        <Stack.Screen name="Pending" component={PendingPlaceholderScreen} />
      )}
      {branch === "deactivated" && (
        <Stack.Screen name="Deactivated" component={DeactivatedPlaceholderScreen} />
      )}
      {(branch === "unauthenticated" || branch === "loading") && (
        <Stack.Screen name="Login" component={LoginPlaceholderScreen} />
      )}
    </Stack.Navigator>
  );
}
