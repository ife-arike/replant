// 5-tab bottom navigator — KAN-87 foundation (AC-6, AC-7).
//
// Tabs (D-34): Home / The Church / Persecuted / Prayer Wall / Connect.
// Icons (D-35): wired from src/components/icons/TabIcons.tsx — production
// RN-SVG components from UI/UX handoff v2 FINAL (commit 73873c3), per SM
// recon ruling 10979 #2 (Option A). NOT re-added as .svg assets.

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  ConnectIcon,
  HomeIcon,
  PersecutedIcon,
  PrayerWallIcon,
  TheChurchIcon,
} from "../components/icons/TabIcons";
import { Colors, Typography } from "../constants/theme";
import HomeScreen from "../screens/main/HomeScreen";
import TheChurchScreen from "../screens/main/TheChurchScreen";
import PersecutedScreen from "../screens/main/PersecutedScreen";
import PrayerWallScreen from "../screens/main/PrayerWallScreen";
import ConnectPlaceholderScreen from "../screens/main/ConnectPlaceholderScreen";
import type { TabsParamList } from "./types";

const Tab = createBottomTabNavigator<TabsParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0E0E0E",
          borderTopWidth: 1,
          borderTopColor: "rgba(240, 237, 230, 0.06)",
          height: 84,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: "rgba(240, 237, 230, 0.35)",
        tabBarLabelStyle: {
          fontFamily: Typography.body,
          fontSize: 10,
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tab.Screen
        name="The Church"
        component={TheChurchScreen}
        options={{ tabBarIcon: ({ color }) => <TheChurchIcon color={color} /> }}
      />
      {/* KAN-65 R2 — the Persecuted tab uses Colors.red for its active
          tint instead of Colors.accent. Per-screen override; all other
          tabs continue to inherit the navigator-level
          tabBarActiveTintColor (Colors.accent). The icon's color prop
          comes from this tint, so PersecutedIcon's stroke flips to red
          when the tab is focused. */}
      <Tab.Screen
        name="Persecuted"
        component={PersecutedScreen}
        options={{
          tabBarIcon: ({ color }) => <PersecutedIcon color={color} />,
          tabBarActiveTintColor: Colors.red,
        }}
      />
      <Tab.Screen
        name="Prayer Wall"
        component={PrayerWallScreen}
        options={{ tabBarIcon: ({ color }) => <PrayerWallIcon color={color} /> }}
      />
      <Tab.Screen
        name="Connect"
        component={ConnectPlaceholderScreen}
        options={{ tabBarIcon: ({ color }) => <ConnectIcon color={color} /> }}
      />
    </Tab.Navigator>
  );
}
