// RequestActionsBar — action bar shown above the locked composer when
// the recipient views an incoming connection request thread (Option B).
//
// Layout per HANDOFF §4.4:
//   Label:   "Accept this conversation?"
//   Buttons: Decline (quiet/outline) + Accept (primary/sky blue)
//
// Props:
//   onAccept  — async handler; buttons disabled (busy=true) while in-flight
//   onDecline — async handler; same busy gate
//   busy      — true while either action is in-flight
//
// Spec: REQUEST-FLOW-HANDOFF.md §4.4.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  busy: boolean;
}

export default function RequestActionsBar({ onAccept, onDecline, busy }: Props) {
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>Accept this conversation?</Text>
      <View style={styles.buttons}>
        {/* Decline — quiet/outline button */}
        <Pressable
          onPress={onDecline}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.declineBtn,
            pressed && !busy && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Decline connection request"
        >
          <Text style={[styles.btnText, styles.declineBtnText, busy && styles.btnTextDisabled]}>
            Decline
          </Text>
        </Pressable>

        {/* Accept — primary/sky blue button */}
        <Pressable
          onPress={onAccept}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.acceptBtn,
            pressed && !busy && styles.acceptBtnPressed,
            busy && styles.acceptBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Accept connection request"
        >
          {busy ? (
            <ActivityIndicator color="#07232f" size="small" />
          ) : (
            <Text style={styles.acceptBtnText}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(240,237,230,0.08)',
    alignItems: 'center',
  },
  label: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
  },
  btn: {
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.7 },
  btnDisabled: { opacity: 0.4 },
  // Decline: quiet outline style
  declineBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.25)',
    backgroundColor: 'transparent',
  },
  declineBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  // Accept: primary sky-blue fill
  acceptBtn: {
    flex: 1.4,
    backgroundColor: Colors.accent,
  },
  acceptBtnPressed: { opacity: 0.85 },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: '#07232f',
    letterSpacing: 0.2,
  },
  btnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  btnTextDisabled: { color: Colors.textSubtle },
});
