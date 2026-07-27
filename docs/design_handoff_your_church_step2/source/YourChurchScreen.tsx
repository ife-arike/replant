// YourChurchScreen — Account Setup, Step 2 of 2 · confirmed state.
//
// Shown immediately after a leader either picks an existing church
// from search or completes the "register a new church" sub-flow.
// The screen confirms the link, surfaces verification status in plain
// language, and gates entry into the main app behind a single CTA.
//
// Redesign of the legacy "Made a mistake? Select an option below."
// sub-block. Key changes:
//   • Edit affordance moved inline into the card's ribbon row.
//   • Destructive "Delete and return to search" demoted to a quiet
//     text link below the card ("Made a mistake? Switch >").
//   • Amber status dot is now named ("Awaiting verification") with a
//     one-line description of the 2–3 day window.
//
// This screen owns NO mutations except the final onboarding commit,
// which is invoked via the `onEnterReplant` prop. Edit and Switch are
// entry points to existing flows (church edit form, switch-confirm
// sheet) handed up to the parent navigator.

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

// ── Types ────────────────────────────────────────────────────────────

export type ChurchType =
  | 'Church'
  | 'House Church'
  | 'Ministry'
  | 'Underground';

export type VerificationStatus = 'pending' | 'verified';

export interface YourChurchScreenProps {
  church: {
    id: string;
    name: string;
    type: ChurchType;
    /** Pre-formatted region/country string, e.g. "Test, Australia". */
    locationLabel: string;
    verificationStatus: VerificationStatus;
  };
  onBack: () => void;
  onEdit: () => void;
  onSwitch: () => void;
  onEnterReplant: () => void;
}

// ── Screen ───────────────────────────────────────────────────────────

export default function YourChurchScreen({
  church,
  onBack,
  onEdit,
  onSwitch,
  onEnterReplant,
}: YourChurchScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <BackButton onPress={onBack} />

        <Header />

        <ChurchCard church={church} onEdit={onEdit} />

        <SwitchLink onPress={onSwitch} />
      </ScrollView>

      <Footer onEnterReplant={onEnterReplant} />
    </SafeAreaView>
  );
}

// ── Header ───────────────────────────────────────────────────────────

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      style={styles.back}
    >
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>Account Setup · 2 of 2</Text>
      <Text style={styles.title}>Your Church</Text>
      <Text style={styles.body}>
        Every leader in the Replant network is tied to a church. Search
        for yours below, or register a new one.
      </Text>
    </View>
  );
}

// ── Card ─────────────────────────────────────────────────────────────

function ChurchCard({
  church,
  onEdit,
}: {
  church: YourChurchScreenProps['church'];
  onEdit: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.ribbon}>
        <View style={styles.ribbonLeft}>
          <CheckGlyph />
          <Text style={styles.ribbonLabel}>Registered</Text>
        </View>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit church"
          hitSlop={8}
          style={styles.editButton}
        >
          <PencilGlyph />
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.churchName}>{church.name}</Text>
        <Text style={styles.churchMeta}>
          {church.type}
          <Text style={styles.churchMetaSep}>  ·  </Text>
          {church.locationLabel}
        </Text>

        <StatusRow status={church.verificationStatus} />
      </View>
    </View>
  );
}

// ── Status row ───────────────────────────────────────────────────────

function StatusRow({ status }: { status: VerificationStatus }) {
  const isPending = status === 'pending';
  const tone = isPending ? Colors.amber : Colors.green;
  const title = isPending ? 'Awaiting verification' : 'Verified';
  const tagLabel = isPending ? 'Pending' : 'Verified';
  const description = isPending
    ? 'A Replant team member will reach out within 2–3 days. Your account stays active during this window.'
    : null;

  return (
    <View
      style={styles.statusRow}
      accessibilityLabel={
        description ? `${title}. ${description}` : title
      }
    >
      <View
        style={[
          styles.statusDot,
          { backgroundColor: tone, shadowColor: tone },
        ]}
      />
      <View style={styles.statusText}>
        <View style={styles.statusTitleRow}>
          <Text style={styles.statusTitle}>{title}</Text>
          <View
            style={[
              styles.statusTag,
              {
                borderColor: withAlpha(tone, 0.35),
                backgroundColor: withAlpha(tone, 0.06),
              },
            ]}
          >
            <Text style={[styles.statusTagText, { color: tone }]}>
              {tagLabel}
            </Text>
          </View>
        </View>
        {description && (
          <Text style={styles.statusDesc}>{description}</Text>
        )}
      </View>
    </View>
  );
}

// ── Quiet secondary action ───────────────────────────────────────────

function SwitchLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Switch to a different church"
      hitSlop={8}
      style={styles.switchLink}
    >
      <Text style={styles.switchLinkText}>
        Made a mistake?{' '}
        <Text style={styles.switchLinkStrong}>Switch ›</Text>
      </Text>
    </Pressable>
  );
}

// ── Footer / CTA ─────────────────────────────────────────────────────

function Footer({ onEnterReplant }: { onEnterReplant: () => void }) {
  return (
    <View style={styles.footer}>
      <Pressable
        onPress={onEnterReplant}
        accessibilityRole="button"
        accessibilityLabel="Enter Replant"
        accessibilityHint="Completes account setup and opens the app"
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>Enter Replant</Text>
      </Pressable>
    </View>
  );
}

// ── Inline glyphs (react-native-svg) ─────────────────────────────────

function CheckGlyph() {
  return (
    <View style={styles.ribbonCheck}>
      <Svg width={7} height={6} viewBox="0 0 7 6" fill="none">
        <Path
          d="M1 3L2.6 4.6L6 1"
          stroke={Colors.accent}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function PencilGlyph() {
  return (
    <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
      <Path
        d="M1 10L1 8L7.5 1.5L9.5 3.5L3 10H1Z"
        stroke={Colors.accent}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Utilities ────────────────────────────────────────────────────────

// Lightweight alpha mixer for the status tag. Inputs are restricted to
// the RAG hex values from Colors (#XXYYZZ) — no rgba() inputs here.
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: Spacing.lg,
  },

  // Back
  back: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: 17,
    color: Colors.accent,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 48,
    lineHeight: 50,
    color: Colors.text,
    letterSpacing: -0.7,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },

  // Card
  card: {
    marginHorizontal: Spacing.md + 4,
    marginTop: Spacing.sm + 4,
    borderRadius: Radius.lg + 4,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(107,181,232,0.04)',
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ribbonCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    backgroundColor: 'rgba(107,181,232,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonLabel: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: 2,
  },
  editText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.accent,
  },

  cardBody: {
    paddingHorizontal: Spacing.md + 6,
    paddingTop: Spacing.lg - 4,
    paddingBottom: Spacing.lg - 2,
  },
  churchName: {
    fontFamily: Typography.displayMedium,
    fontSize: 30,
    lineHeight: 33,
    color: Colors.text,
    letterSpacing: -0.15,
  },
  churchMeta: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.xs + 2,
  },
  churchMetaSep: {
    color: 'rgba(240,237,230,0.35)',
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm + 4,
    marginTop: Spacing.md + 2,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.md - 2,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md + 2,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    // Halo via shadow (iOS); Android falls back to a flat dot, which is fine.
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  statusText: {
    flex: 1,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
  },
  statusTagText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  statusDesc: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  // Quiet secondary
  switchLink: {
    alignSelf: 'center',
    marginTop: Spacing.md + 2,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
  },
  switchLinkText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  switchLinkStrong: {
    fontFamily: Typography.bodyMedium,
    color: Colors.text,
  },

  // Footer + CTA
  footer: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.background,
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg + 2,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: '#82C1EC',
  },
  ctaLabel: {
    fontFamily: Typography.displayMedium,
    fontSize: 22,
    color: '#0D2235',
    letterSpacing: 0.2,
  },
});
