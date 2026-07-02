// ─────────────────────────────────────────────
// UndergroundEntryScreen — NEW (Ask 1 · Ruling #13)
// The secondary chooser, NESTED inside the underground flow.
// Reached ONLY from RegisterIntroScreen's underground tile — never shown on
// the main intro. Back returns to the 3-tile intro.
//
// Founder-final layout: LIST ROWS (compact). CD-ALT: large tiles preserved
// as a comment in the design handoff source.
//
// Threat model: an over-the-shoulder watcher sees only "Underground", then a
// generic "starting or joining?" choice. The "I have a code" path is one
// level deeper than any casual glance reaches. No underground badge/count
// renders anywhere on this surface.
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path, Circle } from 'react-native-svg';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';

const STROKE = 1.5;

function PlusCircle({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx="11" cy="11" r="8.2" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M11 7.2v7.6M7.2 11h7.6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function KeyIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Circle cx="7.2" cy="14.8" r="3.8" stroke={color} strokeWidth={STROKE} />
      <Path
        d="M9.9 12.1 17.6 4.4M14.8 7.2l2.2 2.2M12.7 9.3l1.6 1.6"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

type Props = NativeStackScreenProps<OnboardingStackParamList, 'UndergroundEntry'>;

export default function UndergroundEntryScreen({ navigation }: Props) {
  const { setRegistrationEntry } = useOnboarding();

  const goNew = () => {
    // Existing underground RegCP1 path: private name, hidden location,
    // RAG-Red locked + the new name-visibility choice (NameVisibilityChoice)
    // before final register-church submit.
    setRegistrationEntry('underground');
    navigation.navigate('RegisterChurchPage1', { entry: 'underground' });
  };

  const goJoin = () => {
    // Second-leader join — no church created; redeems an invite code.
    navigation.navigate('JoinByCode');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back to registration options"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>UNDERGROUND · SECURE</Text>
        <Text style={styles.title}>Are you starting or joining?</Text>
        <Text style={styles.lead}>
          This stays between you and Replant. The choice below is never shown
          anywhere else.
        </Text>
      </View>

      <View style={styles.rows}>
        <Row
          icon={<PlusCircle color={Colors.red} />}
          tone="danger"
          title="Register a new underground church"
          desc="Create a hidden fellowship. Your identity and location stay protected."
          onPress={goNew}
        />
        <Row
          icon={<KeyIcon color={Colors.accent} />}
          title="Join an existing fellowship with a code"
          desc="A leader gave you an invite code in person. Enter it to join their church."
          onPress={goJoin}
        />
      </View>

      <Text style={styles.foot}>Back returns to the three registration options.</Text>
    </View>
  );
}

function Row({
  icon,
  title,
  desc,
  onPress,
  tone = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.rowGlyph, tone === 'danger' && styles.rowGlyphDanger]}>
        {icon}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Text style={styles.rowArrow}>›</Text>
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
  back: {
    marginBottom: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: { fontFamily: Typography.body, fontSize: 16, color: Colors.accent },
  eyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.red,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  title: { fontFamily: Typography.display, fontSize: 28, color: Colors.text },
  lead: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    lineHeight: 21,
    marginTop: Spacing.sm,
    fontWeight: '300',
  },
  rows: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    minHeight: 44,
  },
  rowGlyph: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  rowGlyphDanger: { backgroundColor: 'rgba(224,85,85,0.10)' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 19,
  },
  rowDesc: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    fontWeight: '300',
  },
  rowArrow: { fontFamily: Typography.body, fontSize: 18, color: Colors.textSubtle },
  foot: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    fontWeight: '300',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
