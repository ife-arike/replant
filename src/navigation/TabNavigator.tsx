// 5-tab bottom navigator — KAN-87 foundation (AC-6, AC-7).
//
// Tabs (D-34): Home / The Church / Persecuted / Prayer Wall / Connect.
// Icons (D-35): wired from src/components/icons/TabIcons.tsx — production
// RN-SVG components from UI/UX handoff v2 FINAL (commit 73873c3), per SM
// recon ruling 10979 #2 (Option A). NOT re-added as .svg assets.

import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ConnectIcon,
  GearIcon,
  HomeIcon,
  PersecutedIcon,
  PrayerWallIcon,
  TheChurchIcon,
} from "../components/icons/TabIcons";
import { Colors, Spacing, Typography } from "../constants/theme";
import HomePlaceholderScreen from "../screens/main/HomePlaceholderScreen";
import TheChurchPlaceholderScreen from "../screens/main/TheChurchPlaceholderScreen";
import PersecutedPlaceholderScreen from "../screens/main/PersecutedPlaceholderScreen";
import PrayerWallPlaceholderScreen from "../screens/main/PrayerWallPlaceholderScreen";
import ConnectPlaceholderScreen from "../screens/main/ConnectPlaceholderScreen";
import type { MainStackParamList, TabsParamList } from "./types";

// KAN-72 — temporary Settings entry-point on the Home tab header right.
// Superseded by the KAN-76 hamburger menu when that ships. Lives inside the
// tab navigator file because it's the header that owns the entry; the nested
// navigation.navigate("Settings") resolves up to the root stack's Settings
// route per react-navigation's parent-route lookup.
function HomeHeaderRight() {
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gearButton,
        pressed && styles.gearButtonPressed,
      ]}
      onPress={() => nav.navigate("Settings")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Open Settings"
    >
      <GearIcon color={Colors.text} size={22} />
    </Pressable>
  );
}

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
        component={HomePlaceholderScreen}
        options={{
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          // KAN-72 — header on Home tab only, gear icon right.
          headerShown: true,
          headerTitle: "",
          headerStyle: {
            backgroundColor: Colors.background,
            borderBottomWidth: 0,
            shadowOpacity: 0,
            elevation: 0,
          },
          headerShadowVisible: false,
          headerRight: () => <HomeHeaderRight />,
        }}
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
        component={PrayerWallPlaceholderScreen}
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

const styles = StyleSheet.create({
  gearButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  gearButtonPressed: {
    opacity: 0.6,
  },
});
