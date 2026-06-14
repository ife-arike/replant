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
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthProvider';
import { ROLES } from '../../utils/displayHelpers';
import RpMark from '../../components/icons/RpMark';
import ComingSoonModal from '../../components/common/ComingSoonModal';
import {
  setNotifBadgeEnabled,
  useNotifBadgeEnabled,
} from '../../lib/connect-prefs';

// ─── Types ─────────────────────────────────────────────────────────────

type DisplayNamePreference = 'first_name_only' | 'full_name';
type RagStatus = 'green' | 'amber' | 'red';
type SavedSection = 'account' | 'privacy' | 'church' | null;

// KAN-229 — name-fields fix (design_handoff_settings_name_fields, 2026-06-14).
// Honorific list trimmed to the canonical 6 per the design (no "Other" — the
// suffix picker carries the free-form branch). "Not set" is rendered as a
// neutral cleared state (sans, not italic) at the top of the picker, and is
// stored as null in users.honorific.
const HONORIFICS = ['Anba', 'Mar', 'Abuna', 'Achen', 'Catholicos', 'Patriarch'] as const;
const SUFFIXES = ['PhD', 'MDiv', 'DMin', 'ThD', 'DD'] as const;
const SUFFIX_OTHER_MAX_LEN = 12;
// Inlined colors per design_handoff_settings_name_fields (the handoff offers
// these as inline values OR theme tokens; inlining keeps theme.ts untouched).
const TEXT_SOFT = 'rgba(240, 237, 230, 0.65)';
const NF_HAIRLINE = 'rgba(240, 237, 230, 0.18)';
const ACCENT_TINT = 'rgba(107, 181, 232, 0.10)';

// ─── KAN-229 sub-components ────────────────────────────────────────────
// Inlined here because they're private to Settings; not reusable elsewhere
// in the app (the design treats them as 01 Account-specific UI primitives).

// Restyled checkbox per design_handoff_settings_name_fields:
//   - 14×14 square, Radius.sm
//   - Off: 0.5 px NF_HAIRLINE border on Colors.background
//   - On: 0.5 px Colors.accent border on ACCENT_TINT fill + sky tick
//   - Sky tick drawn with two borders rotated −45° (no asset)
//   - Label sits 12 px to the right, body 13 px, soft-alpha when off
function NameFieldCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={nameFieldStyles.checkboxRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          nameFieldStyles.checkboxBox,
          checked && nameFieldStyles.checkboxBoxOn,
        ]}
      >
        {checked && <View style={nameFieldStyles.checkboxTick} />}
      </View>
      <Text
        style={[
          nameFieldStyles.checkboxLabel,
          !checked && nameFieldStyles.checkboxLabelOff,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Honorific / Suffix row chassis. Mono uppercase label LEFT (min-width 64
// so the labels stack-align), italic-serif sky value, sky chevron. Whole
// row is one tappable target (~38 px tall) that opens the picker sheet.
function NameFieldRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={nameFieldStyles.fieldRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}, currently ${value ?? 'Not set'}`}
    >
      <Text style={nameFieldStyles.fieldRowLabel}>{label}</Text>
      <Text style={nameFieldStyles.fieldRowValue}>{value ?? 'Not set'}</Text>
      <Text style={nameFieldStyles.fieldRowChev}>{'›'}</Text>
    </TouchableOpacity>
  );
}

// Shared picker-sheet chassis. Bottom-anchored Modal with:
//   - Backdrop scrim, tap-to-dismiss
//   - Grip handle (36×4)
//   - Mono eyebrow flanked by hairline rules
//   - Italic-serif title (22pt)
//   - Italic-serif sub-line (12.5pt, soft alpha)
//   - 28×0.5 px sky-mid centred rule
//   - Children (options list OR Other free-text branch)
//   - Foot copy (mono, sky)
function NameFieldPickerSheet({
  visible,
  eyebrow,
  title,
  subline,
  footCopy,
  onClose,
  children,
}: {
  visible: boolean;
  eyebrow: string;
  title: string;
  subline: string;
  footCopy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={nameFieldStyles.sheetScrim} onPress={onClose}>
        <Pressable style={nameFieldStyles.sheetCard} onPress={() => {}}>
          <View style={nameFieldStyles.sheetGrip} />
          <View style={nameFieldStyles.sheetEyebrowRow}>
            <View style={nameFieldStyles.sheetEyebrowRule} />
            <Text style={nameFieldStyles.sheetEyebrow}>{eyebrow}</Text>
            <View style={nameFieldStyles.sheetEyebrowRule} />
          </View>
          <Text style={nameFieldStyles.sheetTitle}>{title}</Text>
          <Text style={nameFieldStyles.sheetSubline}>{subline}</Text>
          <View style={nameFieldStyles.sheetTitleRule} />
          {children}
          <Text style={nameFieldStyles.sheetFoot}>{footCopy}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Single picker-option row. Glyph column + italic-serif title (or sans
// for the "Not set" neutral cleared state per the handoff).
function NameFieldPickerOption({
  selected,
  label,
  onPress,
  isNotSet,
  isLast,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  isNotSet?: boolean;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        nameFieldStyles.optionRow,
        !isLast && nameFieldStyles.optionRowDivider,
      ]}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          nameFieldStyles.optionGlyph,
          selected && nameFieldStyles.optionGlyphSelected,
        ]}
      >
        {selected ? '◉' : '◯'}
      </Text>
      <Text
        style={[
          isNotSet ? nameFieldStyles.optionLabelNeutral : nameFieldStyles.optionLabel,
          selected && nameFieldStyles.optionLabelSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface SettingsScreenProps {
  userId: string;
  email?: string | null;
  initialDisplayNamePreference?: DisplayNamePreference;
  // KAN-229 — name-field modifiers (live preview + persistence).
  initialLastNameFirst?: boolean;
  initialIncludeMiddleName?: boolean;
  initialHonorific?: string | null;
  initialSuffix?: string | null;
  anonymousMode?: boolean;
  fullName?: string | null;
  // KAN-229 — structured name parts. Container fetches these from
  // users.first_name / middle_name / last_name so previews don't need
  // to whitespace-split fullName as a heuristic. fullName is still
  // accepted for back-compat.
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
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

// Android requires explicit opt-in for LayoutAnimation.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Sub-components ────────────────────────────────────────────────────

function SectionHeader({
  number,
  title,
  isOpen,
  onPress,
  alwaysOpen,
}: {
  number: string;
  title: string;
  isOpen: boolean;
  onPress: () => void;
  alwaysOpen?: boolean;
}) {
  if (alwaysOpen) {
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionNum}>{number}</Text>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>{title}</Text>
        </View>
        <View style={styles.sectionRule} />
      </View>
    );
  }
  return (
    <Pressable
      style={styles.sectionHeader}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${isOpen ? 'expanded' : 'collapsed'}`}
    >
      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionNum}>{number}</Text>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>{title}</Text>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path
            d={isOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
            stroke={isOpen ? Colors.accent : Colors.textSubtle}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={styles.sectionRule} />
    </Pressable>
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
  initialLastNameFirst = false,
  initialIncludeMiddleName = false,
  initialHonorific = null,
  initialSuffix = null,
  anonymousMode = false,
  fullName = null,
  firstName: firstNameProp = null,
  middleName: middleNameProp = null,
  lastName: lastNameProp = null,
  userRole = null,
  churchCode = null,
  churchName = null,
  churchId = null,
  ragStatus = null,
}: SettingsScreenProps) {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayNamePref, setDisplayNamePref] = useState<DisplayNamePreference>(
    initialDisplayNamePreference ?? 'first_name_only',
  );
  // KAN-229 — name-field modifier state.
  const [lastNameFirst, setLastNameFirst] = useState<boolean>(initialLastNameFirst);
  const [includeMiddleName, setIncludeMiddleName] = useState<boolean>(initialIncludeMiddleName);
  const [honorific, setHonorific] = useState<string | null>(initialHonorific);
  const [suffix, setSuffix] = useState<string | null>(initialSuffix);
  const [honorificPickerVisible, setHonorificPickerVisible] = useState(false);
  const [suffixPickerVisible, setSuffixPickerVisible] = useState(false);
  // Suffix "Other…" branch — when the leader picks Other from the suffix
  // sheet, the options list is swapped for a small text input. otherDraft
  // holds the in-progress value; Confirm validates (trim, max 12) and writes.
  const [suffixOtherMode, setSuffixOtherMode] = useState<boolean>(false);
  const [suffixOtherDraft, setSuffixOtherDraft] = useState<string>(
    initialSuffix && !(SUFFIXES as readonly string[]).includes(initialSuffix)
      ? initialSuffix
      : '',
  );
  const [anonymousModeState, setAnonymousModeState] = useState<boolean>(anonymousMode);
  const [ragStatusState, setRagStatusState] = useState<RagStatus | null>(ragStatus);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [churchIdCopied, setChurchIdCopied] = useState<boolean>(false);

  // Collapsible section accordion — all collapsed by default (About is permanently expanded).
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const toggleSection = (num: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(num)) { next.delete(num); } else { next.add(num); }
      return next;
    });
  };

  const [faithModalVisible, setFaithModalVisible] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

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

  // ─── Derived specimens — KAN-229 live preview ───
  // ROLES is the canonical source of truth for role display labels
  // (displayHelpers.ts). All 12 user_role enum values map cleanly,
  // including ministry_leader → "Minister" per Founder ruling 2026-05-20.
  // Falls back to 'Minister' when role is null.
  const roleLabel =
    ROLES.find((r) => r.value === userRole)?.label ?? 'Minister';
  // Structured name parts (Container fetches users.first_name / middle_name
  // / last_name). Falls back to the legacy fullName-whitespace-split heuristic
  // when the Container hasn't been updated to pass structured parts yet.
  const fallbackFirst = fullName?.split(' ')[0] ?? 'You';
  const fallbackLast = fullName?.split(' ').slice(1).join(' ') ?? '';
  const safeFirst = (firstNameProp && firstNameProp.trim()) || fallbackFirst;
  const safeMiddle = (middleNameProp && middleNameProp.trim()) || '';
  const safeLast = (lastNameProp && lastNameProp.trim()) || fallbackLast;
  // buildPreview composes the network-display string per
  // design_handoff_settings_name_fields rules:
  //   honorific + role + namePart [+ ', ' + suffix]
  // namePart depends on `lastNameFirst` and `includeMiddleName`.
  const buildPreview = (mode: 'first' | 'full'): string => {
    let namePart: string;
    if (mode === 'first') {
      namePart = lastNameFirst ? safeLast : safeFirst;
    } else {
      const middleSlot = includeMiddleName && safeMiddle ? ` ${safeMiddle}` : '';
      namePart = lastNameFirst
        ? `${safeLast}, ${safeFirst}${middleSlot}`
        : `${safeFirst}${middleSlot} ${safeLast}`.replace(/\s+/g, ' ').trim();
    }
    const head = [honorific, roleLabel, namePart].filter(Boolean).join(' ');
    return suffix ? `${head}, ${suffix}` : head;
  };
  const SPECIMEN_FIRST = buildPreview('first');
  const SPECIMEN_FULL = buildPreview('full');
  // Radio 1's label flips on lastNameFirst — "First name + role" ⇄
  // "Last name + role". Radio 2 always reads "Full name + role".
  const radio1Label = lastNameFirst ? 'Last name + role' : 'First name + role';

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

  // KAN-229: persist last_name_first toggle. Optimistic + revert pattern.
  // Fires AccessibilityInfo.announceForAccessibility on success so a
  // screen-reader user hears the flipped radio label without re-navigating
  // (design_handoff_settings_name_fields accessibility note).
  const handleLastNameFirstToggle = async (newValue: boolean) => {
    if (newValue === lastNameFirst) return;
    if (writeInFlight.current) return;
    const previousValue = lastNameFirst;
    setLastNameFirst(newValue);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_name_first: newValue })
        .eq('auth_id', userId);
      if (error) throw error;
      flashSaved('account');
      AccessibilityInfo.announceForAccessibility(
        newValue
          ? 'Display name now reads as Last name plus role.'
          : 'Display name now reads as First name plus role.',
      );
    } catch {
      setLastNameFirst(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your last-name-first preference. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  // KAN-229: persist include_middle_name toggle. Only affects the
  // "Full name + role" preview when middle_name is non-empty.
  const handleIncludeMiddleNameToggle = async (newValue: boolean) => {
    if (newValue === includeMiddleName) return;
    if (writeInFlight.current) return;
    const previousValue = includeMiddleName;
    setIncludeMiddleName(newValue);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ include_middle_name: newValue })
        .eq('auth_id', userId);
      if (error) throw error;
      flashSaved('account');
    } catch {
      setIncludeMiddleName(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your middle-name preference. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  // KAN-229: persist honorific. null clears it (role-label prefix only).
  const handleHonorificChange = async (newValue: string | null) => {
    const normalised = newValue?.trim() || null;
    if (normalised === honorific) return;
    if (writeInFlight.current) return;
    const previousValue = honorific;
    setHonorific(normalised);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ honorific: normalised })
        .eq('auth_id', userId);
      if (error) throw error;
      flashSaved('account');
    } catch {
      setHonorific(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your honorific. Check your connection.",
      );
    } finally {
      writeInFlight.current = false;
    }
  };

  // KAN-229: persist suffix. null clears it. Free-form values land via the
  // Suffix sheet's "Other…" branch (trimmed, max SUFFIX_OTHER_MAX_LEN chars).
  const handleSuffixChange = async (newValue: string | null) => {
    const normalised = newValue?.trim() || null;
    if (normalised === suffix) return;
    if (writeInFlight.current) return;
    const previousValue = suffix;
    setSuffix(normalised);
    setWriteError(null);
    writeInFlight.current = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ suffix: normalised })
        .eq('auth_id', userId);
      if (error) throw error;
      flashSaved('account');
    } catch {
      setSuffix(previousValue);
      setWriteError("Couldn't save. Check your connection and try again.");
      AccessibilityInfo.announceForAccessibility(
        "Couldn't save your suffix. Check your connection.",
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
    setSignOutModalVisible(true);
  };

  // ─── Routes that don't exist yet — canonical ComingSoonModal ───
  // Single piece of comingSoon state with title/body so we share one
  // modal instance across every Settings row that needs the pattern.

  const [comingSoon, setComingSoon] = useState<{ title: string; body: string } | null>(null);

  const handleChangePassword = () => {
    setComingSoon({
      title: 'Password change is on the way.',
      body: 'You\'ll be able to update your password from this screen shortly.',
    });
  };
  const handleTermsTap = () => {
    setComingSoon({
      title: 'Terms of use are on the way.',
      body: 'The full terms will appear here before launch.',
    });
  };
  const handlePrivacyTap = () => {
    setComingSoon({
      title: 'Privacy policy is on the way.',
      body: 'Our privacy commitment will be linked here before launch.',
    });
  };
  const handleCommunityCovenantTap = () => {
    setComingSoon({
      title: 'Community covenant is on the way.',
      body: 'You\'ll be able to read the full covenant from this screen shortly.',
    });
  };
  const handleDeactivateTap = () => {
    setComingSoon({
      title: 'Account deactivation is on the way.',
      body: 'A guided deactivation flow will be available before launch.',
    });
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
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={Colors.accent}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
        <SectionHeader number="01" title="Account" isOpen={openSections.has('01')} onPress={() => toggleSection('01')} />
        {openSections.has('01') && (
        <>
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
                accessibilityLabel={`${radio1Label} — option`}
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
                  {radio1Label}
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

            {/* KAN-229 — Format eyebrow + modifier checkboxes
                (design_handoff_settings_name_fields). Mini-eyebrow sits
                14 px below the last radio specimen and labels the
                checkbox group as modifiers applied to whichever radio
                is selected. */}
            <Text style={styles.formatEyebrow}>Format</Text>
            <NameFieldCheckbox
              checked={lastNameFirst}
              label="Show last name first"
              onPress={() => { void handleLastNameFirstToggle(!lastNameFirst); }}
            />
            <NameFieldCheckbox
              checked={includeMiddleName}
              label="Include middle name in full name"
              onPress={() => { void handleIncludeMiddleNameToggle(!includeMiddleName); }}
            />

            {/* Dashed hairline separates the Format checkboxes from the
                Honorific + Suffix picker rows. Per the handoff this is
                rgba(240,237,230,0.07) at 1px; we draw it with a thin
                semi-transparent View since RN doesn't support CSS dashed
                cleanly cross-platform. */}
            <View style={styles.nameFieldDivider} />

            <NameFieldRow
              label="Honorific"
              value={honorific}
              onPress={() => setHonorificPickerVisible(true)}
            />
            <NameFieldRow
              label="Suffix"
              value={suffix}
              onPress={() => {
                setSuffixOtherMode(
                  suffix !== null && !(SUFFIXES as readonly string[]).includes(suffix),
                );
                setSuffixPickerVisible(true);
              }}
            />
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
        </>
        )}

        {/* ── 02 PRIVACY ── */}
        <SectionHeader number="02" title="Privacy" isOpen={openSections.has('02')} onPress={() => toggleSection('02')} />
        {openSections.has('02') && (
        <>
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
        </>
        )}

        {/* ── 03 CHURCH ── */}
        <SectionHeader number="03" title="Church" isOpen={openSections.has('03')} onPress={() => toggleSection('03')} />
        {openSections.has('03') && (
        <>
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
        </>
        )}

        {/* ── 04 LANGUAGE ── */}
        <SectionHeader number="04" title="Language" isOpen={openSections.has('04')} onPress={() => toggleSection('04')} />
        {openSections.has('04') && (
        <>
        <View style={styles.rowLast} accessibilityLabel="App language, coming soon">
          <Text style={styles.rowLabel}>App language</Text>
          <View style={styles.rowValueRow}>
            <Text style={[styles.rowValue, styles.languageComingSoon]}>Coming soon</Text>
          </View>
        </View>
        </>
        )}

        {/* ── 05 NOTIFICATIONS — HANDOFF §15.2 ── */}
        {/* First notification preference in the app. On by default.
            The PATCH /users/me write to users.notif_message_badge is
            HELD per dispatch: that column doesn't exist in live yet.
            Preference is persisted to SecureStore (per-device today)
            via setNotifBadgeEnabled; when DBA lands the column + a
            write RPC, the swap is a single helper in connect-prefs. */}
        <SectionHeader number="05" title="Notifications" isOpen={openSections.has('05')} onPress={() => toggleSection('05')} />
        {openSections.has('05') && (
        <>
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
        </>
        )}

        {/* ── 06 ABOUT — permanently expanded, no collapse option ── */}
        <SectionHeader number="06" title="About" isOpen={true} onPress={() => {}} alwaysOpen />
        <TouchableOpacity
          style={styles.row}
          onPress={() => setFaithModalVisible(true)}
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
          style={styles.row}
          onPress={handlePrivacyTap}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Privacy policy</Text>
            <Text style={styles.rowChev}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowLast}
          onPress={handleCommunityCovenantTap}
          activeOpacity={0.6}
          accessibilityRole="button"
        >
          <View style={styles.rowValueRow}>
            <Text style={styles.rowValue}>Community covenant</Text>
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

      {/* ── HONORIFIC PICKER SHEET — KAN-229 (design_handoff_settings_name_fields) ── */}
      <NameFieldPickerSheet
        visible={honorificPickerVisible}
        eyebrow="Choose one"
        title="Honorific"
        subline="A prefix shown before your name in the network."
        footCopy="Tap a name to confirm"
        onClose={() => setHonorificPickerVisible(false)}
      >
        <NameFieldPickerOption
          selected={honorific === null}
          label="Not set"
          isNotSet
          onPress={() => {
            void handleHonorificChange(null);
            setHonorificPickerVisible(false);
          }}
        />
        {HONORIFICS.map((h, idx) => (
          <NameFieldPickerOption
            key={h}
            selected={honorific === h}
            label={h}
            isLast={idx === HONORIFICS.length - 1}
            onPress={() => {
              void handleHonorificChange(h);
              setHonorificPickerVisible(false);
            }}
          />
        ))}
      </NameFieldPickerSheet>

      {/* ── SUFFIX PICKER SHEET — KAN-229 ── */}
      <NameFieldPickerSheet
        visible={suffixPickerVisible}
        eyebrow="Choose one"
        title="Suffix"
        subline="Earned or honorary letters shown after your name. PhD, MDiv, ThD…"
        footCopy={
          suffixOtherMode
            ? 'Type letters · then Confirm'
            : 'Tap to confirm · "Other" opens a text field'
        }
        onClose={() => {
          setSuffixPickerVisible(false);
          setSuffixOtherMode(false);
        }}
      >
        {suffixOtherMode ? (
          <View style={nameFieldStyles.otherBranch}>
            <TextInput
              style={nameFieldStyles.otherInput}
              value={suffixOtherDraft}
              onChangeText={(t) => setSuffixOtherDraft(t.slice(0, SUFFIX_OTHER_MAX_LEN))}
              placeholder="ThM, EdD, Hon…"
              placeholderTextColor={Colors.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={SUFFIX_OTHER_MAX_LEN}
              accessibilityLabel="Custom suffix"
            />
            <TouchableOpacity
              style={[
                nameFieldStyles.otherConfirm,
                !suffixOtherDraft.trim() && nameFieldStyles.otherConfirmDisabled,
              ]}
              disabled={!suffixOtherDraft.trim()}
              onPress={() => {
                const trimmed = suffixOtherDraft.trim();
                if (!trimmed) return;
                void handleSuffixChange(trimmed);
                setSuffixPickerVisible(false);
                setSuffixOtherMode(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Confirm custom suffix"
            >
              <Text style={nameFieldStyles.otherConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <NameFieldPickerOption
              selected={suffix === null}
              label="Not set"
              isNotSet
              onPress={() => {
                void handleSuffixChange(null);
                setSuffixPickerVisible(false);
              }}
            />
            {SUFFIXES.map((s) => (
              <NameFieldPickerOption
                key={s}
                selected={suffix === s}
                label={s}
                onPress={() => {
                  void handleSuffixChange(s);
                  setSuffixPickerVisible(false);
                }}
              />
            ))}
            <NameFieldPickerOption
              selected={
                suffix !== null && !(SUFFIXES as readonly string[]).includes(suffix)
              }
              label="Other…"
              isLast
              onPress={() => setSuffixOtherMode(true)}
            />
          </>
        )}
      </NameFieldPickerSheet>

      {/* ── SIGN OUT CONFIRMATION — centered overlay modal ── */}
      <Modal
        visible={signOutModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <Pressable
          style={styles.signOutOverlay}
          onPress={() => setSignOutModalVisible(false)}
        >
          <Pressable style={styles.signOutCard} onPress={() => {}}>
            <Text style={styles.signOutModalTitle}>Sign out</Text>
            <Text style={styles.signOutModalBody}>
              You'll need to sign in again to access your account.
            </Text>
            <View style={styles.signOutModalActions}>
              <TouchableOpacity
                onPress={() => setSignOutModalVisible(false)}
                style={styles.signOutModalCancel}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.signOutModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSignOutModalVisible(false);
                  void signOut();
                }}
                style={styles.signOutModalConfirm}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text style={styles.signOutModalConfirmText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── DECLARATION OF FAITH — reference modal ── */}
      <Modal
        visible={faithModalVisible}
        animationType="slide"
        onRequestClose={() => setFaithModalVisible(false)}
      >
        <View style={[styles.faithModalRoot, { paddingTop: insets.top }]}>
          <View style={styles.faithModalBar}>
            <TouchableOpacity
              onPress={() => setFaithModalVisible(false)}
              style={styles.faithModalClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={Colors.textMuted}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.faithModalBody}
          >
            <View style={styles.faithCross}>
              <View style={styles.faithCrossV} />
              <View style={styles.faithCrossH} />
            </View>
            <Text style={styles.faithTitle}>A Declaration of Faith</Text>
            <Text style={styles.faithSubtitle}>
              {'Before you enter, we ask that you affirm\nwhat we stand on.'}
            </Text>
            <View style={styles.faithCard}>
              <Text style={[styles.faithPara, styles.faithParaSpaced]}>
                I believe that Jesus Christ is the Word of God made flesh — the
                Lamb of God slain for our sins. He came down from heaven, was
                born of a virgin, was crucified, buried, and ascended to the
                right hand of God, then gave to us the gift of the Holy Spirit.
              </Text>
              <Text style={[styles.faithPara, styles.faithParaSpaced]}>
                He is the image of the invisible God. He is our only Lord and
                Saviour.
              </Text>
              <Text style={styles.faithPara}>
                The Holy Bible is our only source of truth.
              </Text>
              <Text style={styles.faithScripture}>
                Jesus saith unto him, I am the way, the truth, and the life: no
                man cometh unto the Father, but by me. If ye had known me, ye
                should have known my Father also: and from henceforth ye know
                him, and have seen him. — John 14:6-7 KJV
              </Text>
              <View style={styles.faithDivider} />
              <Text style={styles.faithAttribution}>
                By continuing, I personally affirm this testament as my own.
              </Text>
            </View>
            <Text style={styles.faithFooter}>
              {'This is not a legal agreement. This is a test of the spirits.\n1 John 4:1'}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Canonical Coming Soon modal — shared instance, state-driven copy ── */}
      <ComingSoonModal
        visible={!!comingSoon}
        onDismiss={() => setComingSoon(null)}
        title={comingSoon?.title ?? ''}
        body={comingSoon?.body ?? ''}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 20,
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

  // KAN-229 — "Format" mini-eyebrow labelling the modifier checkboxes.
  // Same mono register as rowLabel but slightly smaller (10 vs 11) so it
  // reads as a sub-section header inside the display-name row, not a
  // peer to the row's primary label.
  formatEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
  },
  // KAN-229 — dashed-feel hairline between the Format checkboxes and the
  // Honorific/Suffix picker rows. RN doesn't render CSS-dashed cleanly
  // cross-platform; a 1 px low-alpha rule reads as a divider without
  // visual noise.
  nameFieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(240, 237, 230, 0.07)',
    marginTop: 12,
    marginBottom: 8,
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

  // ─── Sign-out confirmation modal ───
  signOutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  signOutCard: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 24,
  },
  signOutModalTitle: {
    fontFamily: Typography.display,
    fontSize: 22,
    letterSpacing: 0.4,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  signOutModalBody: {
    fontFamily: Typography.sansLight,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  signOutModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  signOutModalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  signOutModalCancelText: {
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.textMuted,
  },
  signOutModalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 53, 69, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(220, 53, 69, 0.30)',
    alignItems: 'center',
  },
  signOutModalConfirmText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.red,
  },

  // ─── Declaration of Faith reference modal ───
  faithModalRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  faithModalBar: {
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  faithModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faithModalBody: {
    paddingHorizontal: 22,
    paddingBottom: 48,
    alignItems: 'center',
  },
  faithCross: {
    width: 28,
    height: 28,
    position: 'relative',
    marginBottom: 16,
    marginTop: 4,
  },
  faithCrossV: {
    position: 'absolute',
    left: 13,
    top: 0,
    width: 2,
    height: 28,
    backgroundColor: Colors.accent,
  },
  faithCrossH: {
    position: 'absolute',
    left: 0,
    top: 9.8,
    width: 28,
    height: 2,
    backgroundColor: Colors.accent,
  },
  faithTitle: {
    fontFamily: Typography.display,
    fontSize: 26,
    letterSpacing: 0.05 * 26,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  faithSubtitle: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 13 * 1.5,
    textAlign: 'center',
    marginBottom: 24,
  },
  faithCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderTopWidth: 1.5,
    borderTopColor: Colors.accent,
    borderRadius: 6,
    padding: 16,
    marginBottom: 24,
  },
  faithPara: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 18,
    color: Colors.text,
    lineHeight: 18 * 1.6,
  },
  faithParaSpaced: {
    marginBottom: 14,
  },
  faithScripture: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 15 * 1.6,
    marginTop: 18,
    marginBottom: 12,
  },
  faithDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  faithAttribution: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 12 * 1.6,
  },
  faithFooter: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 11 * 1.5,
  },
});

// ─── KAN-229 — Name-field sub-component styles ─────────────────────────
// Kept in a separate StyleSheet so the main `styles` block stays scoped
// to Settings primitives. All values lift from design_handoff_settings_
// name_fields tokens (mapped 1:1 onto theme.ts where possible; inlined
// for the three values the handoff explicitly offers as inline).
const nameFieldStyles = StyleSheet.create({
  // ── Checkbox row ──
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 32,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 14,
    height: 14,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: NF_HAIRLINE,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxOn: {
    borderColor: Colors.accent,
    backgroundColor: ACCENT_TINT,
  },
  // Sky tick drawn with two borders rotated −45° (no asset; per handoff).
  // Sits 1 px above geometric centre so the rotation looks centred.
  checkboxTick: {
    width: 7,
    height: 4,
    borderLeftWidth: 1.2,
    borderBottomWidth: 1.2,
    borderColor: Colors.accent,
    transform: [{ rotate: '-45deg' }],
    marginTop: -1,
  },
  checkboxLabel: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.text,
    flexShrink: 1,
  },
  checkboxLabelOff: {
    color: TEXT_SOFT,
  },

  // ── Honorific / Suffix row ──
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    minHeight: 38,
    paddingVertical: 6,
  },
  fieldRowLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8, // ~ 0.2em
    color: Colors.textMuted,
    textTransform: 'uppercase',
    minWidth: 64,
  },
  fieldRowValue: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 14.5,
    color: Colors.accent,
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  fieldRowChev: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.accent,
    opacity: 0.8,
    marginLeft: 6,
  },

  // ── Sheet chassis ──
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#131313',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240, 237, 230, 0.06)',
    marginHorizontal: 14,
    marginBottom: 14,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.7,
    shadowRadius: 60,
    elevation: 24,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: NF_HAIRLINE,
    marginBottom: 14,
  },
  sheetEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sheetEyebrowRule: {
    width: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderAccent,
  },
  sheetEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontFamily: Typography.displayItalic,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  sheetSubline: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 12.5,
    color: TEXT_SOFT,
    textAlign: 'center',
    lineHeight: 12.5 * 1.55,
    maxWidth: 230,
    alignSelf: 'center',
    marginTop: 4,
  },
  sheetTitleRule: {
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderAccent,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  sheetFoot: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.9, // ~ 0.22em
    color: Colors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingTop: 14,
  },

  // ── Picker option ──
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  optionRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  optionGlyph: {
    width: 22,
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  optionGlyphSelected: {
    color: Colors.accent,
  },
  optionLabel: {
    fontFamily: Typography.displayItalic,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  optionLabelNeutral: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.text,
    flexShrink: 1,
  },
  optionLabelSelected: {
    color: Colors.accent,
  },

  // ── Suffix "Other…" branch ──
  otherBranch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  otherInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: NF_HAIRLINE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Typography.displayMediumItalic,
    fontSize: 17,
    color: Colors.accent,
  },
  otherConfirm: {
    backgroundColor: ACCENT_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  otherConfirmDisabled: {
    opacity: 0.4,
  },
  otherConfirmText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
});
