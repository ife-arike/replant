// ─────────────────────────────────────────────
// Screen 20 — Settings
// KAN-72: Account section + display name preference toggle + Language placeholder
//
// Field: users.display_name_preference
// Values: 'first_name_only' | 'full_name'  (DBA confirmed — NOT 'first_name_role')
// Write: direct Supabase update, no edge function, RLS allows own-row update
// Pattern: optimistic UI — updates immediately, reverts on failure
// No save button. No toast on success. Visual change is the confirmation.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase'; // wired at app level

// ─── Types ───────────────────────────────────

type DisplayNamePreference = 'first_name_only' | 'full_name';

interface SettingsScreenProps {
  userId: string;
  initialDisplayNamePreference?: DisplayNamePreference;
}

// ─── Section components ───────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function DisplayNameOption({
  value,
  label,
  example,
  selected,
  disabled,
  onSelect,
}: {
  value: DisplayNamePreference;
  label: string;
  example: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: DisplayNamePreference) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.optionRow,
        selected && styles.optionRowSelected,
      ]}
      onPress={() => !disabled && onSelect(value)}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. Example: ${example}. ${selected ? 'Selected.' : 'Not selected.'}`}
    >
      <View style={styles.optionLeft}>
        {/* Radio indicator */}
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>

        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
            {label}
          </Text>
          <Text style={styles.optionExample}>{example}</Text>
        </View>
      </View>

      {disabled && (
        <ActivityIndicator size="small" color={Colors.accent} style={styles.optionSpinner} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────

export default function SettingsScreen({
  userId,
  initialDisplayNamePreference = 'first_name_only',
}: SettingsScreenProps) {
  // Null at read time defaults to 'first_name_only' per D-15
  const [displayNamePref, setDisplayNamePref] = useState<DisplayNamePreference>(
    initialDisplayNamePreference ?? 'first_name_only'
  );
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);

  // Gate rapid taps — only one write in flight at a time
  const writeInFlight = useRef(false);

  const handleDisplayNameChange = async (newValue: DisplayNamePreference) => {
    if (newValue === displayNamePref) return; // no-op if same value
    if (writeInFlight.current) return;        // gate rapid taps

    const previousValue = displayNamePref;

    // Optimistic UI — update immediately
    setDisplayNamePref(newValue);
    setWriteError(null);
    setIsWriting(true);
    writeInFlight.current = true;

    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name_preference: newValue })
        .eq('auth_id', userId);

      if (error) throw error;
      // Success — no toast, the visual change is the confirmation

    } catch {
      // Write failed — revert to previous selection
      setDisplayNamePref(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");

      // Announce reversion to screen readers
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your display name preference. Check your connection."
      );
    } finally {
      setIsWriting(false);
      writeInFlight.current = false;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Screen header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account section ── */}
        <SectionHeader title="Account" />

        <View
          style={styles.section}
          accessibilityRole="radiogroup"
          accessibilityLabel="Display name preference"
        >
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingLabel}>Display name preference</Text>
            <Text style={styles.settingSubLabel}>
              Controls how your name appears to other leaders across the network.
            </Text>
          </View>

          <View style={styles.optionGroup}>
            <DisplayNameOption
              value="first_name_only"
              label="First name + role only"
              example='e.g. "Pastor James"'
              selected={displayNamePref === 'first_name_only'}
              disabled={isWriting}
              onSelect={handleDisplayNameChange}
            />

            <View style={styles.optionDivider} />

            <DisplayNameOption
              value="full_name"
              label="Full name"
              example='e.g. "Pastor James Adeoye"'
              selected={displayNamePref === 'full_name'}
              disabled={isWriting}
              onSelect={handleDisplayNameChange}
            />
          </View>

          {/* Inline error — shown on write failure */}
          {writeError && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{writeError}</Text>
            </View>
          )}
        </View>

        {/* ── Language section — placeholder, no interaction ── */}
        <SectionHeader title="Language" />

        <View style={styles.section}>
          <View
            style={styles.comingSoonRow}
            accessibilityElementsHidden={false}
            accessibilityLabel="Language selector, coming soon"
          >
            <Text style={styles.comingSoonLabel}>Language</Text>
            <Text style={styles.comingSoonBadge}>Coming soon</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.3,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: Spacing.lg,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderText: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    textTransform: 'uppercase',
  },

  // Section container
  section: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },

  // Setting label above option group
  settingLabelRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 3,
  },
  settingLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.text,
  },
  settingSubLabel: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // Option group
  optionGroup: {},

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(107, 181, 232, 0.06)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },

  // Radio indicator
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },

  optionText: {
    gap: 2,
    flex: 1,
  },
  optionLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  optionLabelSelected: {
    fontFamily: Typography.bodyMedium,
    color: Colors.accent,
  },
  optionExample: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    fontStyle: 'italic',
  },
  optionSpinner: {
    marginLeft: Spacing.sm,
  },

  optionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 20 + Spacing.md, // align with text, not radio
  },

  // Inline error
  errorRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(224, 85, 85, 0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 85, 85, 0.2)',
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    lineHeight: 18,
  },

  // Language coming soon
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
  },
  comingSoonLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textSubtle, // de-emphasised — not interactive
  },
  comingSoonBadge: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.textSubtle,
    backgroundColor: 'rgba(240, 237, 230, 0.06)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },

  bottomSpacer: { height: Spacing.xxxl },
});
