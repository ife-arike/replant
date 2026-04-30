// ─────────────────────────────────────────────
// Screen 01 — Splash Screen
// Static. Auto-advances to DeclarationOfFaith at 2s.
// No interaction, no spinner, no network call.
// Portrait locked at navigator level.
// ─────────────────────────────────────────────

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('DeclarationOfFaith');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Corner marks — brand detail from wireframes */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      {/* Logomark placeholder — swap with SVG asset when delivered */}
      <View style={styles.logoContainer}>
        <View style={styles.logoMark} />

        <Text style={styles.wordmark}>REPLANT</Text>
        <Text style={styles.tagline}>The Church, Connected.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Corner crosshair marks — 4 corners, brand detail
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(240, 237, 230, 0.15)',
  },
  cornerTL: {
    top: 24,
    left: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  cornerTR: {
    top: 24,
    right: 24,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  cornerBL: {
    bottom: 24,
    left: 24,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  cornerBR: {
    bottom: 24,
    right: 24,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },

  logoContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },

  // Logomark circle placeholder — swap with SVG
  logoMark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.accent,
    marginBottom: Spacing.sm,
  },

  wordmark: {
    fontFamily: Typography.display,
    fontSize: 36,
    letterSpacing: 10,
    color: Colors.text,
  },

  tagline: {
    fontFamily: Typography.displayItalic,
    fontSize: 16,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
