// ─────────────────────────────────────────────
// ComingSoonModal — canonical "feature in progress" pattern
//
// One look across the whole app. Replaces Alert.alert('Coming soon', ...),
// inline pills, and bespoke notice cards. Sweep targets: LocationsView,
// SettingsScreen (4 Alert.alerts), OutreachMissionsScreen, HamburgerPanel
// fallbacks, ChurchProfileBottomSheet share, AttachmentPopover,
// MinistriesList "branches > 7" note.
//
// Visual contract (locked 2026-06-10):
//   - Scrim: rgba(8,8,8,0.78). NO expo-blur (load-bearing invariant).
//   - Surface: Colors.surface (#181818), 0.5px FAINT border, radius 14.
//   - Glyph: 44px sky-bordered circle + 20px contextual icon (default clock).
//   - Eyebrow: DM Mono 10px, letterSpacing 0.30em, sky uppercase "COMING SOON".
//   - Title: Cormorant Garamond (displayRegular) 21px off-white.
//   - Body: DM Sans 13px, line-height 20, cream muted 78% — NOT italic.
//   - CTA: sky-bordered outline "GOT IT" (or custom dismissLabel).
// ─────────────────────────────────────────────

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ReactNode,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

const FAINT = 'rgba(240,237,230,0.14)';
const SCRIM = 'rgba(8,8,8,0.78)';
const OFFWHITE = '#F0EDE6';
const CREAM = '#E6E1D5';
const MUTED = 'rgba(200,196,188,0.78)';
const SKY_BORDER = 'rgba(107,181,232,0.30)';

export interface ComingSoonModalProps {
  visible: boolean;
  title: string;
  body: string;
  /** Optional override for the dismiss button label. Default "GOT IT". */
  dismissLabel?: string;
  onDismiss: () => void;
  /** Optional contextual glyph. Defaults to a clock. */
  glyph?: ReactNode;
}

export default function ComingSoonModal({
  visible,
  title,
  body,
  dismissLabel = 'Got it',
  onDismiss,
  glyph,
}: ComingSoonModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable
          style={styles.card}
          onPress={(e) => e.stopPropagation()}
          accessibilityRole="none"
        >
          <View style={styles.glyphCircle}>
            {glyph ?? <DefaultGlyph />}
          </View>
          <Text style={styles.eyebrow}>COMING SOON</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
          >
            <Text style={styles.ctaLabel}>{dismissLabel.toUpperCase()}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DefaultGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={Colors.accent} strokeWidth={1.3} />
      <Path d="M12 7v5l3 2" stroke={Colors.accent} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 14,
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 26,
    alignItems: 'center',
  },
  glyphCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: SKY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 3.0, // 0.30em × 10
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 12,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    lineHeight: 26,
    color: OFFWHITE,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  cta: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.40)',
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.7 },
  ctaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.98, // 0.18em × 11
    textTransform: 'uppercase',
    color: Colors.accent,
  },
});
