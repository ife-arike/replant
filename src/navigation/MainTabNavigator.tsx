// ─────────────────────────────────────────────
// Replant — Main Tab Navigator
// 6 tabs: Home · Local · Global · Persecuted · Prayer Wall · Connect
// Persecuted and Prayer Wall icons are PLACEHOLDERS — swap when UI/UX delivers
// Active tab: sky blue icon, no dot indicators
// Locked tabs (Persecuted, Connect) show modal for unverified users
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

// Screen imports
import HomeScreen from '../screens/main/HomeScreen';
import ChurchScreen from '../screens/main/ChurchScreen';

// Placeholder screens — will be replaced in Priority 3+
const PlaceholderScreen = ({ route }: any) => (
  <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: Typography.display, fontSize: 24, color: Colors.text }}>{route.name}</Text>
    <Text style={{ fontFamily: Typography.body, fontSize: 14, color: Colors.textMuted, marginTop: 8 }}>Coming in next build</Text>
  </View>
);

export type MainTabParamList = {
  Home: undefined;
  'The Church': undefined;  // D-34 — label is "The Church" not "Church". Swipeable: At My Location ↔ At Large
  Persecuted: undefined;
  'Prayer Wall': undefined;
  Connect: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// SVG-style icons as React Native views
// Home — hearth/house icon
const HomeIcon = ({ color }: { color: string }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 18, color }}>⌂</Text>
  </View>
);

// Church — pin icon (covers both Local and Global views via swipe)
const ChurchIcon = ({ color }: { color: string }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 16, color }}>◈</Text>
  </View>
);

// Persecuted — PLACEHOLDER — awaiting UI/UX icon delivery (flame rejected)
const PersecutedIcon = ({ color }: { color: string }) => (
  <View style={{
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: color, borderRadius: 4,
  }}>
    <Text style={{ fontSize: 8, color, fontFamily: 'monospace' }}>P</Text>
  </View>
);

// Prayer Wall — PLACEHOLDER — awaiting UI/UX icon delivery (praying hands rejected)
const PrayerWallIcon = ({ color }: { color: string }) => (
  <View style={{
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: color, borderRadius: 4,
  }}>
    <Text style={{ fontSize: 8, color, fontFamily: 'monospace' }}>PW</Text>
  </View>
);

// Connect — speech bubble icon
const ConnectIcon = ({ color }: { color: string }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 16, color }}>◫</Text>
  </View>
);

interface LockedModalProps {
  visible: boolean;
  daysRemaining: number;
  onClose: () => void;
}

function LockedModal({ visible, daysRemaining, onClose }: LockedModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Verified Leaders Only</Text>
          <Text style={styles.modalBody}>
            This section is available to verified leaders only. Your verification is pending
            — {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining.
          </Text>
          <TouchableOpacity style={styles.modalButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface MainTabNavigatorProps {
  isVerified: boolean;
  daysRemaining: number;
}

export default function MainTabNavigator({ isVerified, daysRemaining }: MainTabNavigatorProps) {
  const [lockedModalVisible, setLockedModalVisible] = useState(false);

  const handleLockedTab = () => {
    if (!isVerified) {
      setLockedModalVisible(true);
    }
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: 'rgba(240, 237, 230, 0.35)',
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          }}
        />

        {/* The Church tab — swipe between At My Location and At Large (D-34) */}
        <Tab.Screen
          name="The Church"
          component={ChurchScreen}
          options={{
            tabBarIcon: ({ color }) => <ChurchIcon color={color} />,
          }}
        />

        {/* Persecuted — locked for unverified users */}
        <Tab.Screen
          name="Persecuted"
          component={PlaceholderScreen}
          listeners={{
            tabPress: e => {
              if (!isVerified) {
                e.preventDefault();
                handleLockedTab();
              }
            },
          }}
          options={{
            tabBarIcon: ({ color }) => <PersecutedIcon color={color} />,
            // Dim icon for unverified
            tabBarInactiveTintColor: isVerified
              ? 'rgba(240, 237, 230, 0.35)'
              : 'rgba(240, 237, 230, 0.2)',
          }}
        />

        <Tab.Screen
          name="Prayer Wall"
          component={PlaceholderScreen}
          options={{
            tabBarIcon: ({ color }) => <PrayerWallIcon color={color} />,
          }}
        />

        {/* Connect — locked for unverified users */}
        <Tab.Screen
          name="Connect"
          component={PlaceholderScreen}
          listeners={{
            tabPress: e => {
              if (!isVerified) {
                e.preventDefault();
                handleLockedTab();
              }
            },
          }}
          options={{
            tabBarIcon: ({ color }) => <ConnectIcon color={color} />,
            tabBarInactiveTintColor: isVerified
              ? 'rgba(240, 237, 230, 0.35)'
              : 'rgba(240, 237, 230, 0.2)',
          }}
        />
      </Tab.Navigator>

      <LockedModal
        visible={lockedModalVisible}
        daysRemaining={daysRemaining}
        onClose={() => setLockedModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0E0E0E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(240, 237, 230, 0.06)',
    height: 84,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabLabel: {
    fontFamily: Typography.body,
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 340,
    gap: Spacing.md,
  },
  modalTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
  },
  modalBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    marginTop: Spacing.sm,
  },
  modalButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
});
