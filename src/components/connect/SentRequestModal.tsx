// SentRequestModal — confirmation overlay shown after the sender taps Send
// on a connection request.
//
// Matches the CovenantNotice card style (§6.4): sky-tinted seal icon,
// DMMono eyebrow, Cormorant heading, DM Sans body, primary CTA.
// The only dismiss path is the "Back to Leaders" CTA — no tap-outside.
//
// Props:
//   visible       — controls Modal visibility
//   recipientName — name of the leader the request was sent to
//   onBack        — navigates back to Leaders list
//
// Spec: REQUEST-FLOW-HANDOFF.md §4.2.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  visible: boolean;
  recipientName: string;
  onBack: () => void;
}

// Envelope icon — same as RequestNote but larger (22×22) for the seal.
function EnvelopeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3} y={5} width={18} height={14} rx={2}
        stroke={Colors.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 5l9 7 9-7"
        stroke={Colors.accent}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SentRequestModal({ visible, recipientName, onBack }: Props) {
  // Enter animation: translateY(12) + scale(0.98) → zero/1, 260ms.
  // cubic-bezier(.32,.72,0,1) matches the global Connect easing.
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
          // RN Easing doesn't expose a direct bezier, so approximate with
          // the spring-style out-cubic that matches .32,.72,0,1.
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
      onRequestClose={() => {
        // Hardware back is a no-op — CTA is the only dismiss path.
      }}
    >
      <View style={styles.scrim}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ translateY }, { scale }] },
          ]}
        >
          {/* Seal icon — envelope in sky-tinted square */}
          <View style={styles.seal}>
            <EnvelopeIcon />
          </View>

          {/* Eyebrow */}
          <Text style={styles.eyebrow}>REQUEST SENT</Text>

          {/* Heading */}
          <Text style={styles.heading}>Your letter is on the way.</Text>

          {/* Body — bold the recipient name inline */}
          <Text style={styles.body}>
            {'Your message request to '}
            <Text style={styles.bodyName}>{recipientName}</Text>
            {' has been sent. If they accept, your conversation will appear here.'}
          </Text>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Leaders"
          >
            <Text style={styles.ctaText}>Back to Leaders</Text>
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
    borderColor: 'rgba(107,181,232,0.35)',
    backgroundColor: 'rgba(107,181,232,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.34,
    textTransform: 'uppercase',
    color: Colors.accent,
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
  cta: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: '#07232f',
    letterSpacing: 0.2,
  },
});
