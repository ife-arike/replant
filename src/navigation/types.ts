// Navigator param-list types — KAN-87 foundation.
//
// RootStack switches between the auth-gated branches (Login / Pending /
// Deactivated) and the active app surface (Tabs + Settings). Each branch's
// Screens are conditionally registered in RootNavigator based on
// useAuth().branch — see src/navigation/RootNavigator.tsx.

import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabsParamList = {
  Home: undefined;
  "The Church": undefined;
  Persecuted: undefined;
  "Prayer Wall": undefined;
  Connect: undefined;
};

// MainStackParamList = the active-branch native-stack: Tabs + Settings push.
export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  Settings: undefined;
};

// RootStackParamList = the conditional union across all auth branches.
// Only one branch's screens are registered at a time per RootNavigator.
export type RootStackParamList = MainStackParamList & {
  Login: undefined;
  Pending: undefined;
  Deactivated: undefined;
};
