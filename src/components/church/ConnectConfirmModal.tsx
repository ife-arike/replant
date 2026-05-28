// ─────────────────────────────────────────────
// ConnectConfirmModal — KAN-21 Fix 7 (2026-05-28)
//
// Replaces the iOS Alert.alert that the ChurchProfileBottomSheet's
// Connect button used to fire. Styled to the CD's .modal-scrim + .modal
// pattern (states.jsx ConnectModal + styles.css):
//
//   - Dark scrim (rgba(2,2,3,0.7), no expo-blur)
//   - Centred card, max-width 340, sky-mid border, rounded
//   - Eyebrow "SEND A CONNECTION REQUEST" (mono sky)
//   - h3 "Reach out to {targetLabel}?" (serif)
//   - Body copy
//   - Cancel (ghost) + Send request (primary, flex 2) row
// ─────────────────────────────────────────────

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  targetLabel: string;  // e.g. "Pastor James at Maranatha Ministries"
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConnectConfirmModal({
  visible, targetLabel, onCancel, onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={styles.scrim} accessibilityLabel="Dismiss connection request">
        {/* stopPropagation: tap-card-doesn't-dismiss */}
        <Pressable onPress={() => {}} style={styles.card}>
          <Text style={styles.eyebrow}>SEND A CONNECTION REQUEST</Text>
          <Text style={styles.title}>Reach out to {targetLabel}?</Text>
          <Text style={styles.body}>
            Replant will let them know you'd like to connect. If they accept, the conversation
            will open in your Connect tab.
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={[styles.btn, styles.btnGhost]}
            >
              <Text style={styles.btnGhostText}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
            >
              <Text style={styles.btnPrimaryText}>SEND REQUEST</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // CD .modal-scrim — dim only (no expo-blur)
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(2, 2, 3, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // CD .modal — centred card, sky-mid border
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    borderRadius: 14,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 30 },
    elevation: 24,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.accent,
    marginBottom: 8,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 25,
    color: Colors.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    marginBottom: 18,
  },
  row: { flexDirection: 'row', gap: 8 },
  // CD .btn — 11px sans-medium uppercase, padding 11/12
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  btnGhost: { backgroundColor: Colors.transparent, borderColor: Colors.borderAccent },
  btnGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32, // 0.12em × 11
    color: Colors.accent,
  },
  btnPrimary: { backgroundColor: Colors.accent },
  btnPrimaryText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32,
    color: Colors.background,
  },
});
