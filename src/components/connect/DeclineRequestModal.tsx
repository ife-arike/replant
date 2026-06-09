// DeclineRequestModal — confirmation overlay shown before a decline fires.
//
// Mirrors SentRequestModal exactly in structure: Modal, transparent,
// animationType="fade", dark scrim, card, enter animation
// (translateY(12)+scale(0.98)→0/1, 260ms). No tap-outside dismiss.
//
// Red-tinted destructive iconography distinguishes this from the
// sky-tinted SentRequestModal. Two stacked buttons:
//   Keep           — sky pill (primary, dismiss)
//   Yes, Decline   — text-only, Colors.red (destructive confirm)
//
// Props:
//   visible          — controls Modal visibility
//   senderName       — name shown in body copy
//   onKeep           — dismiss (also bound to hardware back)
//   onConfirmDecline — fires the actual decline
//   declining        — true while the decline RPC is in flight (disables both buttons)

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  senderName: string;
  onKeep: () => void;
  onConfirmDecline: () => void;
  declining: boolean;
}

// X-circle icon — red-tinted to signal destructive action.
function XCircleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke="rgba(224,85,85,0.80)"
        strokeWidth={1.4}
      />
      <Path
        d="M9 9l6 6M15 9l-6 6"
        stroke="rgba(224,85,85,0.80)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function DeclineRequestModal({
  visible,
  senderName,
  onKeep,
  onConfirmDecline,
  declining,
}: Props) {
  // Enter animation: translateY(12) + scale(0.98) → zero/1, 260ms.
  const translateY = useRef(new Animated.Value(12)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(12);
      scale.setValue(0.98);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, scale]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeep}
    >
      <View style={styles.scrim}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ translateY }, { scale }] },
          ]}
        >
          {/* Red-tinted icon */}
          <View style={styles.seal}>
            <XCircleIcon />
          </View>

          {/* Eyebrow */}
          <Text style={styles.eyebrow}>DECLINE REQUEST</Text>

          {/* Heading */}
          <Text style={styles.heading}>Decline this request?</Text>

          {/* Body — bold the sender name inline */}
          <Text style={styles.body}>
            {'Declining will remove '}
            <Text style={styles.bodyName}>{senderName}</Text>
            {"'s request to connect. They will not be able to send you a connection request for 30 days."}
          </Text>

          {/* Keep button — primary sky pill */}
          <Pressable
            style={({ pressed }) => [
              styles.keepBtn,
              pressed && styles.btnPressed,
              declining && styles.btnDisabled,
            ]}
            onPress={onKeep}
            disabled={declining}
            accessibilityRole="button"
            accessibilityLabel="Keep"
          >
            <Text style={styles.keepBtnText}>Keep</Text>
          </Pressable>

          {/* Yes, Decline button — text-only destructive */}
          <Pressable
            style={({ pressed }) => [
              styles.declineBtn,
              pressed && styles.btnPressed,
              declining && styles.btnDisabled,
            ]}
            onPress={onConfirmDecline}
            disabled={declining}
            accessibilityRole="button"
            accessibilityLabel="Yes, Decline"
          >
            <Text style={styles.declineBtnText}>Yes, Decline</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,4,0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 34,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 18,
    paddingTop: 30,
    paddingHorizontal: 26,
    paddingBottom: 24,
    alignItems: 'center',
  },
  seal: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.25)',
    backgroundColor: 'rgba(224,85,85,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.34,
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 14,
  },
  heading: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    lineHeight: 30,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  bodyName: {
    fontFamily: Typography.bodyMedium,
    color: Colors.text,
  },
  // Keep — primary sky pill
  keepBtn: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 10,
  },
  keepBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: '#07232f',
    letterSpacing: 0.2,
  },
  // Yes, Decline — text-only destructive
  declineBtn: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  declineBtnText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.red,
    letterSpacing: 0.2,
  },
  btnPressed: { opacity: 0.70 },
  btnDisabled: { opacity: 0.40 },
});
