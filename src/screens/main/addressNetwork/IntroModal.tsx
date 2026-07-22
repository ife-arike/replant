// ─────────────────────────────────────────────
// IntroModal — the one-time "What is Address the Network?" intro, shown the
// first time a leader opens the screen (persisted via SecureStore, the
// codebase's one-time-flag store — AsyncStorage is below the SEC bar; see
// ChurchTutorialOverlay). Plain modal scrim pattern (NOT ComingSoonModal),
// no glyph. Copy is Founder-final, verbatim.
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { HAIRLINE, SCRIM } from './tokens';

const TITLE = 'What is Address the Network?';
const INTRO =
  "This is a space for you to share a word to every leader in the network. Here's how it works:";
const BULLETS = [
  'Share a word for today or a testimony. It will be published as that topic type.',
  'Keep up to two submissions open at a time. When one is answered, you can share again.',
  'The team reviews each one, and you confirm any edits, before it publishes.',
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function IntroModal({ visible, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>{TITLE}</Text>
          <Text style={styles.intro}>{INTRO}</Text>
          <View style={styles.list}>
            {BULLETS.map((b) => (
              <View key={b} style={styles.row}>
                <View style={styles.dot} />
                <Text style={styles.rowText}>{b}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    maxWidth: 344,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: HAIRLINE,
    borderRadius: 14,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontFamily: Typography.displayMedium,
    fontSize: 24,
    lineHeight: 29, // 1.2 × 24
    color: Colors.text,
    marginBottom: 8,
  },
  intro: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21, // 1.6 × 13
    color: Colors.textMuted,
    marginBottom: 18,
  },
  list: {
    gap: 14,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 20, // ~1.55 × 13
    color: Colors.text,
  },
  cta: {
    minHeight: 50,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.background,
  },
});
