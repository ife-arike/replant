// ─────────────────────────────────────────────
// Screen 20 — Settings (KAN-138 v2.3 — fonts · toggle · RAG · anon · names · Saved flash)
//
// v2.3 follow-ups on top of the v2.2 flat-row CD-exact rebuild:
//   - Global font bump across rows + labels (per UAT readability pass)
//   - Custom 38×21px ToggleSwitch replacing the wide native Switch
//   - RAG word color removed (only the radio glyph carries the RAG color)
//   - Display Name preference row hidden when anonymous mode is ON
//   - Real specimens — first/full name + role pulled from public.users
//     (container reads full_name + role and threads them in)
//   - "Saved" flash (1.5s) after each successful optimistic write
//   - Double-hairline fix: destructive footer no longer has borderTop
//     (Connect block's borderBottom is the single divider)
//
// Layout order (KAN-68 CD-alignment pass insert: new 05 Notifications;
// About renumbers to 06):
//   Header (fixed) → Epigraph + rule → 01 Account → 02 Privacy →
//   03 Church → 04 Language → 05 Notifications → 06 About →
//   Connect block → inline writeError (if any) → Destructive footer →
//   Foundation block (scripture + ref + version stamp, NO rp-mark)
// ─────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { ROLES } from '../../utils/displayHelpers';
import RpMark from '../../components/icons/RpMark';
import {
  setNotifBadgeEnabled,
  useNotifBadgeEnabled,
} from '../../lib/connect-prefs';

// ─── Types ─────────────────────────────────────────────────────────────

type DisplayNamePreference = 'first_name_only' | 'full_name';
type RagStatus = 'green' | 'amber' | 'red';
type SavedSection = 'account' | 'privacy' | 'church' | null;

interface SettingsScreenProps {
  userId: string;
  email?: string | null;
  initialDisplayNamePreference?: DisplayNamePreference;
  anonymousMode?: boolean;
  fullName?: string | null;
  userRole?: string | null;
  churchCode?: string | null;
  churchName?: string | null;
  churchId?: string | null;
  ragStatus?: RagStatus | null;
}

// ─── Custom narrow toggle (38×21) — replaces the wider native iOS Switch ─

function ToggleSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[toggleStyles.track, value && toggleStyles.trackOn]}
    >
      <View style={[toggleStyles.thumb, value && toggleStyles.thumbOn]} />
    </TouchableOpacity>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 38,
    height: 21,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: 'rgba(240, 237, 230, 0.08)',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  trackOn: {
    backgroundColor: 'rgba(107, 181, 232, 0.15)',
    borderColor: Colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: Colors.textMuted,
    top: 2,
    left: 3,
  },
  thumbOn: {
    backgroundColor: Colors.accent,
    left: 20,
  },
});

// ─── Sub-components ────────────────────────────────────────────────────

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionNum}>{number}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionRule} />
    </View>
  );
}

// ─── RAG metadata — only the glyph carries the status color now. ───
const RAG_COLORS: Record<RagStatus, string> = {
  green: Colors.green,
  amber: Colors.amber,
  red: Colors.red,
};
const RAG_DESCRIPTIONS: Record<RagStatus, string> = {
  green: ' — yes, with no limitations',
  amber: ' — with some limitations or needs',
  red: ' — severely limited or facing active persecution',
};
const RAG_WORDS: Record<RagStatus, string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
};

// ─── Main Screen ──────────────────────────────────────────────────────

export default function SettingsScreen({
  userId,
  email,
  initialDisplayNamePreference = 'first_name_only',
  anonymousMode = false,
  fullName = null,
  userRole = null,
  churchCode = null,
  churchName = null,
  churchId = null,
  ragStatus = null,
}: SettingsScreenProps) {
  const navigation = useNavigation();
  const { signOut } = useAuth();

  const [displayNamePref, setDisplayNamePref] = useState<DisplayNamePreference>(
    initialDisplayNamePreference ?? 'first_name_only',
  );
  const [anonymousModeState, setAnonymousModeState] = useState<boolean>(anonymousMode);
  const [ragStatusState, setRagStatusState] = useState<RagStatus | null>(ragStatus);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [churchIdCopied, setChurchIdCopied] = useState<boolean>(false);
  // 05 Notifications — single preference at MVP. Source of truth is
  // connect-prefs (SecureStore-backed, local-only until DBA lands the
  // BE column). Optimistic toggle UX matches the Anonymous-mode row.
  const notifBadgeState = useNotifBadgeEnabled();
  const handleNotifBadgeToggle = (next: boolean) => {
    // No optimistic-revert needed — setNotifBadgeEnabled never throws.
    void setNotifBadgeEnabled(next);
  };

  // "Saved" flash — sets the section name for 1.5s after a successful write,
  // then clears. Sequential writes replace each other (clearTimeout below).
  const [savedSection, setSavedSection] = useState<SavedSection>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single-flight gate across all three write paths (preserved from v2.1).
  const writeInFlight = useRef(false);

  // Show a brief "Saved" badge under the section that just wrote. Repeated
  // writes restart the timer — only the latest section flashes at any time.
  const flashSaved = (section: Exclude<SavedSection, null>) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedSection(section);
    savedTimer.current = setTimeout(() => setSavedSection(null), 1500);
  };

  // ─── Derived specimens — first name + role from public.users ───
  // ROLES is the canonical source of truth for role display labels
  // (displayHelpers.ts). All 12 user_role enum values map cleanly,
  // including ministry_leader → "Minister" per Founder ruling 2026-05-20.
  // Falls back to 'Minister' when role is null (newly-created users
  // mid-onboarding) or somehow not in the canonical 12.
  const roleLabel =
    ROLES.find((r) => r.value === userRole)?.label ?? 'Minister';
  // First name = first whitespace-split token of full_name. Falls back to
  // a neutral 'You' when full_name is null.
  const firstName = fullName?.split(' ')[0] ?? 'You';
  const SPECIMEN_FIRST = `${roleLabel} ${firstName}`;
  const SPECIMEN_FULL = fullName ? `${roleLabel} ${fullName}` : SPECIMEN_FIRST;

  // ─── Write handlers — optimistic, single-flight, flashSaved on success ───

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
      flashSaved('account');
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
      flashSaved('privacy');
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
      flashSaved('church');
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

  // ─── Tap-to-copy church ID — brief inline "COPIED!" flash for 1.5s ───

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

  // ─── Sign out — KAN-42 confirmation dialog → AuthProvider.signOut ───
  // signOut routes through signOutAndClear (writes deferred-revocation
  // flag, calls supabase.auth.signOut, clears flag on success) plus the
  // SEC 11015 #4 ordered abort + in-memory clear + branch flip. The
  // branch flip drives RootNavigator back to Login.

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => { void signOut(); },
        },
      ],
      { cancelable: true },
    );
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

  // ─── Static copy (preserved from KAN-138 dispatch) ───

  const SCRIPTURE =
    '"That they all may be one; as thou, Father, art in me, and I in thee, that they also may be one in us: that the world may believe that thou hast sent me."';
  const REFERENCE = 'JOHN 17 · 21 · KJV';
  const ANONYMOUS_HELPER =
    'When on, others see your role and church only — never your name.';
  const NOTIF_BADGE_HELPER =
    'Shows a count on the Connect tab when you have unread messages.';
  const EPIGRAPH = 'your account, your church.';
  const TEAM_EMAIL = 'connect@projectreplant.org';
  const version =
    Constants.expoConfig?.version ??
    (Constants as unknown as { manifest?: { version?: string } }).manifest?.version ??
    '0.1.0';
  const versionStamp = `VERSION ${version}`;

  // RAG group goes opacity:0.4 + pointerEvents:'none' when no church
  // is assigned yet (the radio still renders so the section structure
  // stays consistent).
  const ragDisabled = !churchId;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* HEADER — fixed, three-column grid: [‹] [Settings] [rp-mark] */}
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
        {/* EPIGRAPH + rule */}
        <Text style={styles.epigraph}>{EPIGRAPH}</Text>
        <View style={styles.epigraphRule} />

        {/* ── 01 ACCOUNT ── */}
        <SectionHeader number="01" title="Account" />

        {/* Email — read-only. Bottom hairline carries through whether the
            Display Name row below is shown or hidden. */}
        <View style={styles.row} accessibilityLabel={`Email: ${email ?? 'not set'}`}>
          <Text style={styles.rowLabel}>Email</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.rowValueMuted]}>{email ?? '—'}</Text>
          </View>
        </View>

        {/* Display name preference — HIDDEN when anonymous mode is on.
            The leader's name is hidden from others when anon, so this
            preference has no surface to control. */}
        {!anonymousModeState && (
          <View
            style={styles.row}
            accessibilityRole="radiogroup"
            accessibilityLabel="Display name preference"
          >
            <Text style={styles.rowLabel}>Display name shown to others</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => handleDisplayNameChange('first_name_only')}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: displayNamePref === 'first_name_only' }}
                accessibilityLabel="First name plus role"
              >
                <Text
                  style={[
                    styles.radioGlyph,
                    displayNamePref === 'first_name_only' && styles.radioGlyphSelected,
                  ]}
                >
                  {displayNamePref === 'first_name_only' ? '◉' : '○'}
                </Text>
                <Text
                  style={[
                    styles.radioLabel,
                    displayNamePref !== 'first_name_only' && styles.radioLabelOff,
                  ]}
                >
                  First name + role
                </Text>
              </TouchableOpacity>
              {displayNamePref === 'first_name_only' && (
                <Text style={styles.radioSpecimen}>{SPECIMEN_FIRST}</Text>
              )}

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => handleDisplayNameChange('full_name')}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: displayNamePref === 'full_name' }}
                accessibilityLabel="Full name plus role"
              >
                <Text
                  style={[
                    styles.radioGlyph,
                    displayNamePref === 'full_name' && styles.radioGlyphSelected,
                  ]}
                >
                  {displayNamePref === 'full_name' ? '◉' : '○'}
                </Text>
                <Text
                  style={[
                    styles.radioLabel,
                    displayNamePref !== 'full_name' && styles.radioLabelOff,
                  ]}
                >
                  Full name + role
                </Text>
              </TouchableOpacity>
              {displayNamePref === 'full_name' && (
                <Text style={styles.radioSpecimen}>{SPECIMEN_FULL}</Text>
              )}
            </View>
          </View>
        )}

        {/* Password — last row of Account; drops the bottom hairline. */}
        <TouchableOpacity
          style={styles.rowLast}
          onPress={handleChangePassword}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Change password"
        >
          <Text style={styles.rowLabel}>Password</Text>
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Change password</Text>
            <Text style={styles.rowChev}>›</Text>
          </View>
        </TouchableOpacity>

        {savedSection === 'account' && (
          <Text style={styles.savedFlash}>Saved</Text>
        )}

        {/* ── 02 PRIVACY ── */}
        <SectionHeader number="02" title="Privacy" />

        {/* Anonymous mode — toggle + italic-serif helper */}
        <View style={styles.rowLast}>
          <Text style={styles.rowLabel}>Anonymous mode</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.rowValue}>{anonymousModeState ? 'On' : 'Off'}</Text>
            <ToggleSwitch
              value={anonymousModeState}
              onValueChange={handleAnonymousToggle}
            />
          </View>
          <Text style={styles.rowHelper}>{ANONYMOUS_HELPER}</Text>
        </View>

        {savedSection === 'privacy' && (
          <Text style={styles.savedFlash}>Saved</Text>
        )}

        {/* ── 03 CHURCH ── */}
        <SectionHeader number="03" title="Church" />

        {/* Church name — read-only */}
        <View
          style={styles.row}
          accessibilityLabel={`Church: ${churchName ?? 'not set'}`}
        >
          <Text style={styles.rowLabel}>Church</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.rowValueMuted]}>
              {churchName ?? '—'}
            </Text>
          </View>
        </View>

        {/* Network ID — tap to copy. Label kept as "Network ID" per the
            existing CONTENT confirmation (KAN-144 AC-7); CD draft says
            "Church ID" but Network ID is the shipped term until SPEC
            re-confirms. */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleChurchIdCopy}
          activeOpacity={churchCode ? 0.6 : 1}
          disabled={!churchCode}
          accessibilityRole={churchCode ? 'button' : undefined}
          accessibilityLabel={`Network ID: ${churchCode ?? 'not assigned'}. Tap to copy.`}
          accessibilityHint="Copies your network ID to clipboard"
        >
          <Text style={styles.rowLabel}>Network ID</Text>
          <Text
            style={[
              styles.churchIdValue,
              !churchCode && styles.rowValueMuted,
            ]}
          >
            {churchCode ?? '—'}
          </Text>
          {churchCode && (
            <Text style={styles.churchIdHint}>
              {churchIdCopied ? 'COPIED!' : 'TAP TO COPY'}
            </Text>
          )}
        </TouchableOpacity>

        {/* RAG status — simplified per v2.3: the WORD is no longer colored.
            Only the radio glyph (◉) carries the RAG color when selected.
            Description text is body / muted, same family as the label. */}
        <View
          style={[styles.rowLast, ragDisabled && styles.ragGroupDisabled]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Church status (Green, Amber, Red)"
          pointerEvents={ragDisabled ? 'none' : 'auto'}
        >
          <Text style={styles.rowLabel}>Status — can your church worship freely?</Text>
          <View style={styles.radioGroup}>
            {(['green', 'amber', 'red'] as const).map((val) => {
              const selected = ragStatusState === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={styles.radioOption}
                  onPress={() => handleRagChange(val)}
                  activeOpacity={0.7}
                  disabled={ragDisabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: ragDisabled }}
                  accessibilityLabel={`${RAG_WORDS[val]}${RAG_DESCRIPTIONS[val]}`}
                >
                  <Text
                    style={[
                      styles.radioGlyph,
                      selected && { color: RAG_COLORS[val] },
                    ]}
                  >
                    {selected ? '◉' : '○'}
                  </Text>
                  <Text
                    style={[
                      styles.ragLine,
                      !selected && styles.radioLabelOff,
                    ]}
                  >
                    {RAG_WORDS[val]}
                    {RAG_DESCRIPTIONS[val]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {savedSection === 'church' && (
          <Text style={styles.savedFlash}>Saved</Text>
        )}

        {/* ── 04 LANGUAGE ── */}
        <SectionHeader number="04" title="Language" />

        <View style={styles.rowLast} accessibilityLabel="App language, coming soon">
          <Text style={styles.rowLabel}>App language</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.languageComingSoon]}>Coming soon</Text>
          </View>
        </View>

        {/* ── 05 NOTIFICATIONS — HANDOFF §15.2 ── */}
        {/* First notification preference in the app. On by default.
            The PATCH /users/me write to users.notif_message_badge is
            HELD per dispatch: that column doesn't exist in live yet.
            Preference is persisted to SecureStore (per-device today)
            via setNotifBadgeEnabled; when DBA lands the column + a
            write RPC, the swap is a single helper in connect-prefs. */}
        <SectionHeader number="05" title="Notifications" />

        <View style={styles.rowLast}>
          <Text style={styles.rowLabel}>New message badge</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.rowValue}>{notifBadgeState ? 'On' : 'Off'}</Text>
            <ToggleSwitch
              value={notifBadgeState}
              onValueChange={handleNotifBadgeToggle}
            />
          </View>
          <Text style={styles.rowHelper}>{NOTIF_BADGE_HELPER}</Text>
        </View>

        {/* ── 06 ABOUT ── */}
        <SectionHeader number="06" title="About" />

        <TouchableOpacity
          style={styles.row}
          onPress={() => (navigation as unknown as { navigate: (n: string) => void }).navigate('DeclarationOfFaith')}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Declaration of Faith</Text>
            <Text style={styles.rowChev}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleTermsTap}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Terms of use</Text>
            <Text style={styles.rowChev}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowLast}
          onPress={handlePrivacyTap}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Privacy policy</Text>
            <Text style={styles.rowChev}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── CONNECT BLOCK — mission treatment, hairline top/bottom ── */}
        <TouchableOpacity
          style={styles.connectBlock}
          onPress={handleConnectTap}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Reach the team. Tap to copy email and open mail composer."
        >
          <View style={styles.connectEyebrowRow}>
            <View style={styles.eyebrowHairline} />
            <Text style={styles.connectEyebrow}>Reach the team</Text>
            <View style={styles.eyebrowHairline} />
          </View>
          <Text style={styles.connectEmail}>{TEAM_EMAIL}</Text>
          <Text style={styles.connectHint}>Tap to copy &amp; open mail</Text>
        </TouchableOpacity>

        {/* Inline write error — below Connect, above destructive footer */}
        {writeError && (
          <Text
            style={styles.writeErrorText}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {writeError}
          </Text>
        )}

        {/* ── DESTRUCTIVE FOOTER — ABOVE foundation (Founder ruling).
            No borderTop — Connect block's borderBottom is the single
            divider between Connect and the destructive footer. */}
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
          >
            <Text style={styles.deactivate}>DEACTIVATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

        {/* ── FOUNDATION — scripture + ref + version stamp, NO rp-mark ── */}
        <View
          style={styles.foundation}
          accessibilityLabel={`${SCRIPTURE} ${REFERENCE}`}
        >
          <Text style={styles.foundationScripture}>{SCRIPTURE}</Text>
          <Text style={styles.foundationRef}>{REFERENCE}</Text>
          <Text style={styles.versionStamp}>{versionStamp}</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const SCROLL_HORIZONTAL_PADDING = 26;
const HAIRLINE = 'rgba(240, 237, 230, 0.08)';
const HAIRLINE_SKY = 'rgba(107, 181, 232, 0.35)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ─── Header (fixed) — [‹] [Settings] [rp-mark] ───
  header: {
    paddingTop: 52,
    paddingHorizontal: SCROLL_HORIZONTAL_PADDING,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
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
    fontSize: 22,
    color: Colors.textMuted,
    lineHeight: 22,
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
    paddingHorizontal: SCROLL_HORIZONTAL_PADDING,
    paddingTop: 0,
  },

  // ─── Epigraph + rule ───
  epigraph: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.accent,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    letterSpacing: 0.2,
  },
  epigraphRule: {
    width: 28,
    height: 0.5,
    backgroundColor: HAIRLINE_SKY,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },

  // ─── Section header (01 + Account + thin rule) ───
  sectionHeader: {
    paddingTop: 22,
    paddingBottom: 4,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 14,
  },
  sectionNum: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: Typography.display,
    fontSize: 21,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  sectionRule: {
    height: 0.5,
    backgroundColor: HAIRLINE,
    marginBottom: 4,
  },

  // ─── Row (flat — no card). Bottom hairline; rowLast drops it. ───
  row: {
    paddingTop: 13,
    paddingBottom: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  rowLast: {
    paddingTop: 13,
    paddingBottom: 11,
  },
  rowLabel: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 5,
  },
  rowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowValue: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  rowValueMuted: {
    color: Colors.textMuted,
  },
  rowChev: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  rowHelper: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 16,
    color: Colors.textMuted,
    lineHeight: 16 * 1.55,
    marginTop: 10,
    letterSpacing: 0.1,
  },

  // ─── Toggle row inside anonymous-mode row ───
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 32,
  },

  // ─── Radio group (display name + RAG) ───
  radioGroup: {
    flexDirection: 'column',
    gap: 2,
    marginTop: 6,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 2,
    minHeight: 28,
  },
  radioGlyph: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 11,
  },
  radioGlyphSelected: {
    color: Colors.accent,
  },
  radioLabel: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    flexShrink: 1,
  },
  radioLabelOff: {
    color: Colors.textMuted,
  },
  // Italic-serif specimen rendered below the selected display-name option.
  radioSpecimen: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.accent,
    marginLeft: 20,
    paddingBottom: 8,
    lineHeight: 15 * 1.3,
    letterSpacing: 0.1,
  },

  // ─── RAG line — plain body (no colored word). The radio glyph is the
  //     only color carrier. ───
  ragLine: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.text,
    flexShrink: 1,
  },
  ragGroupDisabled: {
    opacity: 0.4,
  },

  // ─── Network ID row — value in DM Mono with tap-to-copy hint ───
  churchIdValue: {
    fontFamily: Typography.mono,
    fontSize: 15,
    letterSpacing: 1.0,
    color: Colors.text,
    marginTop: 2,
  },
  churchIdHint: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.8,
    color: Colors.textMuted,
    marginTop: 5,
    textTransform: 'uppercase',
  },

  // ─── Language coming-soon row ───
  languageComingSoon: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.textMuted,
  },

  // ─── Connect block — mission treatment ───
  connectBlock: {
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  connectEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  eyebrowHairline: {
    width: 14,
    height: 0.5,
    backgroundColor: HAIRLINE_SKY,
  },
  connectEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  connectEmail: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 18,
    color: Colors.accent,
    textAlign: 'center',
    paddingVertical: 4,
    paddingBottom: 10,
    letterSpacing: 0.1,
  },
  connectHint: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // ─── Inline write-error banner — below Connect, above destructive ───
  writeErrorText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.red,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginHorizontal: 16,
  },

  // ─── "Saved" flash — 1.5s post-write affordance per section ───
  savedFlash: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.accent,
    textTransform: 'uppercase',
    textAlign: 'right',
    paddingRight: 4,
    marginTop: 4,
    marginBottom: 2,
  },

  // ─── Destructive footer — ABOVE foundation. No borderTop (Connect's
  //     borderBottom IS the divider). ───
  destructive: {
    marginTop: 22,
    paddingTop: 22,
    paddingBottom: 4,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },
  signOut: {
    fontFamily: Typography.display,
    fontSize: 16,
    color: Colors.textMuted,
    letterSpacing: 16 * 0.04,
    paddingVertical: 4,
  },
  deactivate: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 2.2,
    color: Colors.red,
    opacity: 0.55,
    textTransform: 'uppercase',
    paddingVertical: 4,
  },

  // ─── Foundation — scripture + ref + version stamp (NO rp-mark) ───
  foundation: {
    paddingTop: 26,
    paddingBottom: 8,
    alignItems: 'center',
  },
  foundationScripture: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 15 * 1.65,
    paddingHorizontal: 16,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  foundationRef: {
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 1.8,
    color: Colors.accent,
    marginTop: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  versionStamp: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textMuted,
    marginTop: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  bottomSpacer: { height: Spacing.xxxl },
});
