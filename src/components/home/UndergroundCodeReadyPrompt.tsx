// UndergroundCodeReadyPrompt — surfaced on the Home tab when
// auth-status-check returns underground_join_code_pending_reveal: true.
//
// Founder ratification 2026-06-20 (override of the original CD design,
// which auto-routed the leader into the reveal): the leader CAN dismiss
// this prompt and come back later. Reveal is opt-in via a 2-step gate
// (pre-reveal "I'm somewhere private" → server-side reveal call).
//
// Copy: "You're verified. You are not standing alone." (locked).
// Quiet attributed Isaiah 43:2 underneath in scriptureItalic.
//
// Generic chrome — no underground-specific icon or wording. The visible
// label is a generic verified-checkmark mark. The "Continue" CTA mono
// label routes to JoinCodeReveal (which itself is the 2-step gate).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function UndergroundCodeReadyPrompt() {
  const navigation = useNavigation<NavProp>();

  const goReveal = () => {
    navigation.navigate('JoinCodeReveal');
  };

  return (
    <View style={styles.field}>
      <View style={styles.mark}>
        <Svg width={20} height={20} viewBox="0 0 28 28" fill="none" stroke={Colors.accent} strokeWidth={1.8}>
          <Path d="M7 14.5 12 19.5 21.5 9" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={styles.main}>
        <Text style={styles.head}>You&rsquo;re verified. You are not standing alone.</Text>
        <Text style={styles.verse}>
          &ldquo;When thou passest through the waters, I will be with thee.&rdquo;{'\n'}Isaiah 43:2
        </Text>
        <TouchableOpacity style={styles.cta} onPress={goReveal} activeOpacity={0.85}>
          <Text style={styles.ctaText}>VIEW YOUR INVITE CODE ▸</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    borderRadius: Radius.lg,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: 'rgba(107,181,232,0.06)',
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,237,230,0.05)',
    marginTop: 1,
  },
  main: { flex: 1, paddingRight: 4, gap: Spacing.sm },
  head: {
    fontFamily: Typography.display,
    fontSize: 18,
    color: Colors.text,
    lineHeight: 24,
  },
  verse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13,
    color: Colors.accent,
    lineHeight: 20,
  },
  cta: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
});
