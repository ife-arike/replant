// ─────────────────────────────────────────────
// Screen 20 — Settings (KAN-138 v2.2 CD-exact rebuild)
//
// Flat-row pattern — sections have NO card background and NO container
// border. Each row has only a thin bottom hairline (the last row in a
// section drops the hairline). The previous build's card wrappers were
// the primary visual divergence from the CD; this rebuild removes them.
//
// Layout order (top → bottom):
//   Header (fixed) → Epigraph + rule → 01 Account → 02 Privacy →
//   03 Church → 04 Language → 05 About → Connect block (mission
//   treatment, top/bottom hairlines) → Inline writeError (if any) →
//   Destructive footer (Sign out + Deactivate, ABOVE the foundation
//   per Founder ruling) → Foundation block (scripture + ref + version
//   stamp, NO rp-mark)
//
// Writes (optimistic, single-flight gate via writeInFlight ref —
// preserved from v2.1):
//   - users.display_name_preference  (radio)
//   - users.anonymous                (Switch)
//   - churches.rag_status            (radio, only when churchId present)
//
// Reads handled by SettingsScreenContainer. Email comes from auth.users
// via session (NOT public.users.email).
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
import { Colors, Spacing, Typography } from '../../constants/theme';
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

// RAG_COLORS — italic-serif color-word treatment per CD (the word IS
// the swatch, not a dot indicator).
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

  // Single-flight gate — ref so concurrent taps across the three write
  // paths don't race against the network response. Preserved from v2.1.
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

  // ─── Sign out — RootNavigator's auth listener handles the branch flip ───

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // AuthProvider's onAuthStateChange flips the branch — no manual nav.
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
  const EPIGRAPH = 'your account, your church.';
  const TEAM_EMAIL = 'connect@projectreplant.org';
  const version =
    Constants.expoConfig?.version ??
    (Constants as unknown as { manifest?: { version?: string } }).manifest?.version ??
    '0.1.0';
  const versionStamp = `VERSION ${version}`;

  // Display name specimens — only the SELECTED option renders its
  // specimen below itself (per v2.2 dispatch, overriding the CD which
  // showed both — selected in sky, unselected dimmed).
  const SPECIMEN_FIRST = 'Pastor James';
  const SPECIMEN_FULL = 'Pastor James Adeoye';

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

        {/* Email — read-only */}
        <View style={styles.row} accessibilityLabel={`Email: ${email ?? 'not set'}`}>
          <Text style={styles.rowLabel}>Email</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.rowValueMuted]}>{email ?? '—'}</Text>
          </View>
        </View>

        {/* Display name — radio with italic-serif specimen below selected */}
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

        {/* Password — tappable row → ChangePassword stub */}
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

        {/* ── 02 PRIVACY ── */}
        <SectionHeader number="02" title="Privacy" />

        {/* Anonymous mode — toggle + italic-serif helper */}
        <View style={styles.rowLast}>
          <Text style={styles.rowLabel}>Anonymous mode</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.rowValue}>{anonymousModeState ? 'On' : 'Off'}</Text>
            <Switch
              value={anonymousModeState}
              onValueChange={handleAnonymousToggle}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={Colors.text}
              ios_backgroundColor={Colors.border}
              accessibilityLabel="Anonymous mode toggle"
            />
          </View>
          <Text style={styles.rowHelper}>{ANONYMOUS_HELPER}</Text>
        </View>

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

        {/* Network ID — tap to copy. Label kept as "Network ID" per
            existing CONTENT confirmation; CD draft says "Church ID" but
            we ship Network ID until SPEC re-confirms. */}
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

        {/* RAG status — italic-serif color-word with description.
            Disabled with opacity:0.4 + pointerEvents:none when no churchId. */}
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
                  <Text style={[styles.radioGlyph, selected && styles.radioGlyphSelected]}>
                    {selected ? '◉' : '○'}
                  </Text>
                  <Text style={[styles.ragLine, !selected && styles.radioLabelOff]}>
                    <Text style={[styles.ragWord, { color: RAG_COLORS[val] }]}>
                      {RAG_WORDS[val]}
                    </Text>
                    <Text style={styles.ragDesc}>{RAG_DESCRIPTIONS[val]}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 04 LANGUAGE ── */}
        <SectionHeader number="04" title="Language" />

        <View style={styles.rowLast} accessibilityLabel="App language, coming soon">
          <Text style={styles.rowLabel}>App language</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.languageComingSoon]}>Coming soon</Text>
          </View>
        </View>

        {/* ── 05 ABOUT ── */}
        <SectionHeader number="05" title="About" />

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

        {/* ── DESTRUCTIVE FOOTER — ABOVE foundation (Founder ruling) ── */}
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
    // No top padding — the epigraph + section headers provide their own.
    paddingTop: 0,
  },

  // ─── Epigraph + rule ───
  epigraph: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 13,
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
    fontSize: 19,
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
    fontSize: 9,
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
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  rowValueMuted: {
    color: Colors.textMuted,
  },
  rowChev: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  rowHelper: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 14 * 1.55,
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
    fontSize: 12.5,
    color: Colors.text,
    flexShrink: 1,
  },
  radioLabelOff: {
    color: Colors.textMuted,
  },
  // Italic-serif specimen rendered below the selected display-name option.
  radioSpecimen: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 13.5,
    color: Colors.accent,
    marginLeft: 20,
    paddingBottom: 8,
    lineHeight: 13.5 * 1.3,
    letterSpacing: 0.1,
  },

  // ─── RAG line — italic-serif color-word + DM Sans description ───
  ragLine: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.text,
    flexShrink: 1,
  },
  ragWord: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  ragDesc: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.text,
  },
  ragGroupDisabled: {
    opacity: 0.4,
  },

  // ─── Network ID row — value in DM Mono with tap-to-copy hint ───
  churchIdValue: {
    fontFamily: Typography.mono,
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 9,
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

  // ─── Destructive footer — ABOVE foundation, gap 18 between actions ───
  destructive: {
    marginTop: 22,
    paddingTop: 22,
    paddingBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
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
