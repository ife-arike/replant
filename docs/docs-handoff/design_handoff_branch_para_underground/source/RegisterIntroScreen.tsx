// ─────────────────────────────────────────────
// RegisterIntroScreen — NEW
// "How are you registering?" entry chooser (Option A — Founder pick).
// Sits between ASP2 "Register Yours" and RegisterChurchPage1.
//
// Three mutually-exclusive entry tiles:
//   • Standalone church → RegCP1 (standard; type picker shown)
//   • Church branch     → RegCP1 (branch mode; type picker hidden, parent-picker first)
//   • Underground church→ dedicated secure underground flow
//
// This screen is pure navigation — it sets the entry mode in
// OnboardingContext and pushes the appropriate next screen. No DB writes.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'RegisterIntro'>;

type EntryMode = 'standalone' | 'branch';

export default function RegisterIntroScreen({ navigation }: Props) {
  const { setRegistrationEntry } = useOnboarding();

  // Standalone + Branch both land on RegCP1 with an entry flag; the screen
  // reads it to decide whether to show the type picker (standalone) or lead
  // with the parent-picker (branch). Underground routes to its own flow.
  const goRegCP1 = (mode: EntryMode) => {
    setRegistrationEntry(mode);
    navigation.navigate('RegisterChurchPage1', { entry: mode });
  };

  const goUnderground = () => {
    // The underground flow sets churchType='underground' itself; it is never
    // user-selectable in the dropdown. Reuses the existing underground RegCP1
    // behavior (private name, hidden location, RAG locked Red, Submit Church).
    setRegistrationEntry('underground');
    navigation.navigate('RegisterChurchPage1', { entry: 'underground' });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>REGISTER YOUR CHURCH</Text>
        <Text style={styles.title}>How are you registering?</Text>
        <Text style={styles.lead}>
          Choose how you'd like to add your church to the network.
        </Text>
      </View>

      <View style={styles.tiles}>
        <Tile
          title="Register a standalone church"
          desc="A main campus, house church, ministry, or church without walls that stands on its own."
          onPress={() => goRegCP1('standalone')}
        />
        <Tile
          title="Register a Church branch"
          desc="A campus or plant of an existing church already in (or joining) the Replant network."
          onPress={() => goRegCP1('branch')}
        />
        <Tile
          title="Register an underground church"
          desc="For believers under persecution who must stay hidden. Opens a separate, secure flow that protects your identity and location."
          tone="danger"
          onPress={goUnderground}
        />
      </View>
    </View>
  );
}

function Tile({
  title,
  desc,
  onPress,
  tone = 'default',
}: {
  title: string;
  desc: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.tileGlyph, tone === 'danger' && styles.tileGlyphDanger]}>
        {/* Replace with the project's icon set. Shield for underground,
            house for standalone, node-graph for branch. */}
        <Text style={[styles.tileGlyphText, tone === 'danger' && styles.tileGlyphTextDanger]}>
          {tone === 'danger' ? '◆' : '›'}
        </Text>
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileDesc}>{desc}</Text>
      </View>
      <Text style={styles.tileArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  back: { marginBottom: Spacing.md, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: Typography.body, fontSize: 16, color: Colors.accent },
  eyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  title: { fontFamily: Typography.display, fontSize: 30, color: Colors.text },
  lead: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  tiles: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    minHeight: 44,
  },
  tileGlyph: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGlyphDanger: { backgroundColor: 'rgba(224,85,85,0.10)' },
  tileGlyphText: { fontFamily: Typography.body, fontSize: 20, color: Colors.accent },
  tileGlyphTextDanger: { color: Colors.red },
  tileBody: { flex: 1, gap: 5 },
  tileTitle: { fontFamily: Typography.displayMedium, fontSize: 21, color: Colors.text },
  tileDesc: { fontFamily: Typography.body, fontSize: 12.5, color: Colors.textMuted, lineHeight: 19 },
  tileArrow: { fontFamily: Typography.body, fontSize: 20, color: Colors.textSubtle },
});
