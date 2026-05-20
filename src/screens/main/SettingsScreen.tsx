// ─────────────────────────────────────────────
// Screen 20 — Settings (KAN-138 on-brand v2.1)
//
// Numbered section headers (01 Account · 02 Privacy · 03 Church · 04
// Language · 05 About) + mission-treatment Connect block + John 17:21
// foundation + destructive footer (serif Sign out, mono Deactivate).
//
// Writes (all optimistic, single-flight gate via writeInFlight ref):
//   - users.display_name_preference  (radio)
//   - users.anonymous                (switch)
//   - churches.rag_status            (radio, only when churchId present)
//
// Reads handled by SettingsScreenContainer. Email comes from
// auth.users via session, NOT public.users.email.
//
// Routes that don't exist yet (ChangePassword, TermsOfUse, PrivacyPolicy,
// DeactivateAccount) fall back to Alert.alert with TODO comments.
//
// Clipboard via expo-clipboard. Linking via react-native core.
// Version stamp via expo-constants.
// ─────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import RpMark from '../../components/icons/RpMark';

// ─── Types ─────────────────────────────────────────────────────────────

type DisplayNamePreference = 'first_name_only' | 'full_name';
type RagStatus = 'green' | 'amber' | 'red';

interface SettingsScreenProps {
  userId: string;
  email?: string | null;
  initialDisplayNamePreference?: DisplayNamePreference;
  anonymousMode?: boolean;
  churchCode?: string | null;
  churchName?: string | null;
  churchId?: string | null;
  ragStatus?: RagStatus | null;
}

// ─── Sub-components ────────────────────────────────────────────────────

function NumberedSectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.numberedSectionHeader}>
      <Text style={styles.sectionEyebrow}>{number}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function DisplayNameOption({
  value,
  label,
  specimen,
  selected,
  onSelect,
}: {
  value: DisplayNamePreference;
  label: string;
  specimen: string;
  selected: boolean;
  onSelect: (value: DisplayNamePreference) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={() => onSelect(value)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. Specimen: ${specimen}. ${selected ? 'Selected.' : 'Not selected.'}`}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
            {label}
          </Text>
          <Text style={styles.optionSpecimen}>{specimen}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// RAG_DOT_COLORS maps each RAG status to its dot color. Same RAG triad
// the church-map surface uses (Colors.green / amber / red).
const RAG_DOT_COLORS: Record<RagStatus, string> = {
  green: Colors.green,
  amber: Colors.amber,
  red: Colors.red,
};

function RagOption({
  value,
  label,
  selected,
  disabled,
  onSelect,
}: {
  value: RagStatus;
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: RagStatus) => void;
}) {
  const color = RAG_DOT_COLORS[value];
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={() => onSelect(value)}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${selected ? 'Selected.' : 'Not selected.'}`}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.radio, selected && { borderColor: color }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: color }]} />}
        </View>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function SettingsScreen({
  userId,
  email,
  initialDisplayNamePreference = 'first_name_only',
  anonymousMode = false,
  churchCode = null,
  churchName = null,
  churchId = null,
  ragStatus = null,
}: SettingsScreenProps) {
  const navigation = useNavigation();

  const [displayNamePref, setDisplayNamePref] = useState<DisplayNamePreference>(
    initialDisplayNamePreference ?? 'first_name_only',
  );
  const [anonymousModeState, setAnonymousModeState] = useState<boolean>(anonymousMode);
  const [ragStatusState, setRagStatusState] = useState<RagStatus | null>(ragStatus);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [churchIdCopied, setChurchIdCopied] = useState<boolean>(false);

  // Single-flight gate across all three write paths. Per Founder QA on
  // the original KAN-72 build: the optimistic UI flip IS the success
  // affordance — no spinner — and the ref alone is enough to dedupe
  // rapid taps that would otherwise race against the network response.
  const writeInFlight = useRef(false);

  // ─── Write handlers — all share the same optimistic + revert pattern ───

  const handleDisplayNameChange = async (newValue: DisplayNamePreference) => {
    if (newValue === displayNamePref) return;
    if (writeInFlight.current) return;
    const previousValue = displayNamePref;
    setDisplayNamePref(newValue);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name_preference: newValue })
        .eq('auth_id', userId);
      if (error) throw error;
    } catch {
      setDisplayNamePref(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your display name preference. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  const handleAnonymousToggle = async (newValue: boolean) => {
    if (writeInFlight.current) return;
    const previousValue = anonymousModeState;
    setAnonymousModeState(newValue);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ anonymous: newValue })
        .eq('auth_id', userId);
      if (error) throw error;
    } catch {
      setAnonymousModeState(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your anonymous-mode preference. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  const handleRagChange = async (newValue: RagStatus) => {
    if (!churchId) return;
    if (newValue === ragStatusState) return;
    if (writeInFlight.current) return;
    const previousValue = ragStatusState;
    setRagStatusState(newValue);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('churches')
        .update({ rag_status: newValue })
        .eq('id', churchId);
      if (error) throw error;
    } catch {
      setRagStatusState(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your church status. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  // ─── Tap-to-copy church ID — brief inline "Copied!" flash for 1.5s ───

  const handleChurchIdCopy = async () => {
    if (!churchCode) return;
    await Clipboard.setStringAsync(churchCode);
    setChurchIdCopied(true);
    setTimeout(() => setChurchIdCopied(false), 1500);
    AccessibilityInfo.announceForAccessibility('Network ID copied to clipboard.');
  };

  // ─── Connect block — copy email + open mail composer ───

  const handleConnectTap = async () => {
    await Clipboard.setStringAsync('connect@projectreplant.org');
    await Linking.openURL('mailto:connect@projectreplant.org');
  };

  // ─── Sign out — RootNavigator's auth listener handles the branch flip ───

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // No navigation.navigate(...) — onAuthStateChange flips the branch.
  };

  // ─── Routes that don't exist yet — alert + TODO marker ───

  // TODO: wire to ChangePassword screen when route exists (Screen 06A reset flow).
  const handleChangePassword = () => {
    Alert.alert('Coming soon', 'Password change will be available soon.');
  };
  // TODO: wire to TermsOfUse screen when route exists.
  const handleTermsTap = () => {
    Alert.alert('Coming soon', 'Terms of use will be available soon.');
  };
  // TODO: wire to PrivacyPolicy screen when route exists.
  const handlePrivacyTap = () => {
    Alert.alert('Coming soon', 'Privacy policy will be available soon.');
  };
  // TODO: wire to DeactivateAccount screen when route exists (step-up reauth flow).
  const handleDeactivateTap = () => {
    Alert.alert(
      'Deactivate account',
      'Account deactivation will be available before launch.',
    );
  };

  // ─── Static copy — verbatim from KAN-138 dispatch ───

  const SCRIPTURE =
    'That they all may be one; as thou, Father, art in me, and I in thee, that they also may be one in us: that the world may believe that thou hast sent me.';
  const REFERENCE = 'JOHN 17 · 21 · KJV';
  const ANONYMOUS_HELPER =
    'When on, others see your role and church only — never your name.';
  const EPIGRAPH = 'your account, your church.';
  const TEAM_EMAIL = 'connect@projectreplant.org';
  const version =
    Constants.expoConfig?.version ?? (Constants as unknown as { manifest?: { version?: string } }).manifest?.version ?? '0.1.0';
  const versionStamp = `VERSION ${version}`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* HEADER — [‹] [Settings] [rp-mark] */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBackText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerMark}>
          <RpMark size={26} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* EPIGRAPH */}
        <Text style={styles.epigraph}>{EPIGRAPH}</Text>

        {/* ── 01 ACCOUNT ── */}
        <NumberedSectionHeader number="01" title="Account" />
        <View style={styles.section}>
          {/* Email row — read-only */}
          <View style={styles.readonlyRow} accessibilityLabel={`Email: ${email ?? 'not set'}`}>
            <Text style={styles.readonlyLabel}>Email</Text>
            <Text style={styles.readonlyValue}>{email ?? '—'}</Text>
          </View>
          <View style={styles.rowDivider} />

          {/* Display name preference radio */}
          <View
            style={styles.settingBlock}
            accessibilityRole="radiogroup"
            accessibilityLabel="Display name preference"
          >
            <Text style={styles.settingLabel}>Display name shown to others</Text>
            <View style={styles.optionGroup}>
              <DisplayNameOption
                value="first_name_only"
                label="First name + role"
                specimen="Pastor James"
                selected={displayNamePref === 'first_name_only'}
                onSelect={handleDisplayNameChange}
              />
              <DisplayNameOption
                value="full_name"
                label="Full name + role"
                specimen="Pastor James Adeoye"
                selected={displayNamePref === 'full_name'}
                onSelect={handleDisplayNameChange}
              />
            </View>
          </View>
          <View style={styles.rowDivider} />

          {/* Password row */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleChangePassword}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Change password"
          >
            <Text style={styles.actionLabel}>Password</Text>
            <Text style={styles.actionValueAccent}>Change ›</Text>
          </TouchableOpacity>
        </View>

        {/* Inline write error — surfaces below whichever section just failed */}
        {writeError && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{writeError}</Text>
          </View>
        )}

        {/* ── 02 PRIVACY ── */}
        <NumberedSectionHeader number="02" title="Privacy" />
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Anonymous mode</Text>
            <Switch
              value={anonymousModeState}
              onValueChange={handleAnonymousToggle}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.text}
              ios_backgroundColor={Colors.border}
              accessibilityLabel="Anonymous mode toggle"
            />
          </View>
          <Text style={styles.helperText}>{ANONYMOUS_HELPER}</Text>
        </View>

        {/* ── 03 CHURCH ── */}
        <NumberedSectionHeader number="03" title="Church" />
        <View style={styles.section}>
          {/* Church name — read-only */}
          <View style={styles.readonlyRow} accessibilityLabel={`Church: ${churchName ?? 'not set'}`}>
            <Text style={styles.readonlyLabel}>Church</Text>
            <Text style={styles.readonlyValue}>{churchName ?? '—'}</Text>
          </View>
          <View style={styles.rowDivider} />

          {/* Network ID — tap to copy */}
          <TouchableOpacity
            style={styles.churchIdRow}
            onPress={handleChurchIdCopy}
            activeOpacity={churchCode ? 0.6 : 1}
            disabled={!churchCode}
            accessibilityRole={churchCode ? 'button' : undefined}
            accessibilityLabel={`Network ID: ${churchCode ?? 'not assigned'}. Tap to copy.`}
            accessibilityHint="Copies your network ID to clipboard"
          >
            <View style={styles.churchIdContent}>
              <Text style={styles.churchIdLabel}>Network ID</Text>
              <Text
                style={[
                  styles.churchIdValue,
                  !churchCode && styles.churchIdValueMuted,
                ]}
              >
                {churchCode ?? '—'}
              </Text>
              {churchCode && (
                <Text style={styles.churchIdHint}>
                  {churchIdCopied ? 'COPIED!' : 'TAP TO COPY'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.rowDivider} />

          {/* RAG status — locked when no churchId */}
          <View
            style={[styles.settingBlock, !churchId && styles.disabledBlock]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Church status (Red, Amber, Green)"
            pointerEvents={churchId ? 'auto' : 'none'}
          >
            <Text style={styles.settingLabel}>Status</Text>
            <View style={styles.optionGroup}>
              <RagOption
                value="green"
                label="Green"
                selected={ragStatusState === 'green'}
                disabled={!churchId}
                onSelect={handleRagChange}
              />
              <RagOption
                value="amber"
                label="Amber"
                selected={ragStatusState === 'amber'}
                disabled={!churchId}
                onSelect={handleRagChange}
              />
              <RagOption
                value="red"
                label="Red"
                selected={ragStatusState === 'red'}
                disabled={!churchId}
                onSelect={handleRagChange}
              />
            </View>
          </View>
        </View>

        {/* ── 04 LANGUAGE ── */}
        <NumberedSectionHeader number="04" title="Language" />
        <View style={styles.section}>
          <View
            style={styles.languageRow}
            accessibilityLabel="Language selector, coming soon"
          >
            <Text style={styles.languageComingSoon}>Coming soon</Text>
          </View>
        </View>

        {/* ── 05 ABOUT ── */}
        <NumberedSectionHeader number="05" title="About" />
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionRow}
            // Cast — DeclarationOfFaith is in RootStackParamList (unauthenticated
            // branch) but Settings sits inside the active branch. The nav root
            // exposes the union at runtime, but the local Nav type here is the
            // tabs/settings stack which doesn't include it. Cast at the call site.
            onPress={() => (navigation as unknown as { navigate: (n: string) => void }).navigate('DeclarationOfFaith')}
            activeOpacity={0.6}
            accessibilityRole="button"
          >
            <Text style={styles.aboutLabel}>Declaration of Faith</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleTermsTap}
            activeOpacity={0.6}
            accessibilityRole="button"
          >
            <Text style={styles.aboutLabel}>Terms of use</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handlePrivacyTap}
            activeOpacity={0.6}
            accessibilityRole="button"
          >
            <Text style={styles.aboutLabel}>Privacy policy</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── CONNECT BLOCK — mission treatment ── */}
        <TouchableOpacity
          style={styles.connectBlock}
          onPress={handleConnectTap}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Reach the team. Tap to copy email address and open mail composer."
        >
          <Text style={styles.connectEyebrow}>REACH THE TEAM</Text>
          <Text style={styles.connectEmail}>{TEAM_EMAIL}</Text>
          <Text style={styles.connectHint}>TAP TO COPY &amp; OPEN MAIL</Text>
        </TouchableOpacity>

        {/* ── FOUNDATION — John 17:21 anchor ── */}
        <View style={styles.foundation} accessibilityLabel={`${SCRIPTURE} ${REFERENCE}`}>
          <RpMark size={28} opacity={0.55} />
          <Text style={styles.foundationScripture}>{SCRIPTURE}</Text>
          <Text style={styles.foundationRef}>{REFERENCE}</Text>
        </View>

        {/* ── VERSION STAMP ── */}
        <Text style={styles.versionStamp}>{versionStamp}</Text>

        {/* ── DESTRUCTIVE FOOTER ── */}
        <View style={styles.destructive}>
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOut}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeactivateTap}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Deactivate account"
            style={styles.deactivateWrap}
          >
            <Text style={styles.deactivate}>DEACTIVATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ─── Header — three-part grid: [‹] [Settings] [mark] ───
  header: {
    paddingTop: 52,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    width: 28,
    height: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerBackText: {
    fontFamily: Typography.body,
    fontSize: 28,
    color: Colors.textMuted,
    lineHeight: 28,
  },
  headerTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  headerMark: {
    width: 28,
    height: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ─── Scroll ───
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },

  // ─── Epigraph ───
  epigraph: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 16,
    color: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    textAlign: 'center',
  },

  // ─── Numbered section header (01 / Account) ───
  numberedSectionHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  sectionEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    color: Colors.text,
    marginTop: 2,
  },

  // ─── Section card (Account / Privacy / Church / Language / About) ───
  section: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // ─── Read-only row (Email / Church name) ───
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
    gap: Spacing.md,
  },
  readonlyLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  readonlyValue: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
  },

  // ─── Action row (chevron / Change link) ───
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
  },
  actionLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  actionValueAccent: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.accent,
  },
  aboutLabel: {
    fontFamily: Typography.display,
    fontSize: 16,
    color: Colors.text,
  },
  chev: {
    fontFamily: Typography.body,
    fontSize: 20,
    color: Colors.accent,
    lineHeight: 20,
  },

  // ─── Setting block (label + option group) ───
  settingBlock: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  settingLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  disabledBlock: {
    opacity: 0.4,
  },

  // ─── Radio option (Display name + RAG) ───
  optionGroup: {},
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    minHeight: 44,
  },
  optionRowSelected: {
    // intentionally subtle — selection indicator is the radio dot
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
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
  },
  // Italic-serif specimen — "Pastor James", "Pastor James Adeoye"
  optionSpecimen: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // ─── Anonymous toggle row ───
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    minHeight: 44,
  },
  toggleLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  helperText: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    lineHeight: 18,
  },

  // ─── Church ID row — tap to copy ───
  churchIdRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
  },
  churchIdContent: {
    gap: 4,
  },
  churchIdLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
  },
  churchIdValue: {
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 1.3,
    color: Colors.text,
    marginTop: 2,
  },
  churchIdValueMuted: {
    color: Colors.textMuted,
  },
  churchIdHint: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ─── Language coming soon ───
  languageRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  languageComingSoon: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // ─── Connect block — mission treatment ───
  connectBlock: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  connectEyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  connectEmail: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 18,
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 8,
  },
  connectHint: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },

  // ─── Foundation — mark + scripture + reference ───
  foundation: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  foundationScripture: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
  },
  foundationRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 8,
  },

  // ─── Version stamp ───
  versionStamp: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    letterSpacing: 1.5,
  },

  // ─── Destructive footer (Sign out + Deactivate) ───
  destructive: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  signOut: {
    fontFamily: Typography.displayRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  deactivateWrap: {
    marginTop: Spacing.md,
  },
  deactivate: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.red,
    opacity: 0.55,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ─── Inline write error ───
  errorRow: {
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(224, 85, 85, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 85, 85, 0.2)',
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    lineHeight: 18,
  },

  bottomSpacer: { height: Spacing.lg },
});
