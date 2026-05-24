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
import TheChurchPlaceholderScreen from "../screens/main/TheChurchPlaceholderScreen";
import PersecutedPlaceholderScreen from "../screens/main/PersecutedPlaceholderScreen";
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
        component={TheChurchPlaceholderScreen}
        options={{ tabBarIcon: ({ color }) => <TheChurchIcon color={color} /> }}
      />
      <Tab.Screen
        name="Persecuted"
        component={PersecutedPlaceholderScreen}
        options={{ tabBarIcon: ({ color }) => <PersecutedIcon color={color} /> }}
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
