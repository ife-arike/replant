// TakeHeartScene — Surface 4: Word for today, practical guidance, body with you.
// Tap-to-cycle verse with 12s auto-cycle. Guidance cards push GuidanceReader.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { ScriptureFooter } from './FeedScene';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ── Static data ────────────────────────────────────────────────────
interface FamilyWord {
  text: string;
  attribution: string; // "A [Role] from [Region]"
}

const FAMILY_WORDS: FamilyWord[] = [
  {
    text: 'We are standing with you. The church does not sleep while her members are pressed.',
    attribution: 'Samuel, a Minister from West Africa',
  },
  {
    text: 'You are not forgotten. We say your name before the Lord every morning.',
    attribution: 'James, a Pastor from East Asia',
  },
  {
    text: 'The same Christ who sustained the early church sustains you now. Hold fast.',
    attribution: 'Lucia, an Evangelist from South America',
  },
  {
    text: 'We are praying. We are watching. You are not alone in this.',
    attribution: 'Andrei, a Ministry Leader from Eastern Europe',
  },
  {
    text: 'Your faithfulness is seed. We will see the harvest together.',
    attribution: 'Emmanuel, a Pastor from Central Africa',
  },
];

interface GuidanceCardData {
  icon: 'lock' | 'door' | 'shield' | 'book';
  slug: string;
  title: string;
  sub: string;
}

const GUIDANCE_CARDS: GuidanceCardData[] = [
  {
    icon: 'lock',
    slug: 'digital',
    title: 'Digital security, brief.',
    sub: 'Six habits that protect you and the body. Read once, return when needed.',
  },
  {
    icon: 'door',
    slug: 'raid',
    title: 'If your fellowship is raided.',
    sub: 'Steps to protect the gathered, the records, and those who came new.',
  },
  {
    icon: 'shield',
    slug: 'arrest',
    title: 'If you are arrested.',
    sub: 'What to say, what not to say, and how the body will continue without you.',
  },
  {
    icon: 'book',
    slug: 'prohibition',
    title: 'Continuing under prohibition.',
    sub: 'How the early church gathered when forbidden, and what they wrote to each other.',
  },
];

export default function TakeHeartScene() {
  const navigation = useNavigation<NavProp>();
  const [familyIndex, setFamilyIndex] = useState(0);
  const familyPaused = useRef(false);

  // Auto-cycle every 12s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!familyPaused.current) {
        setFamilyIndex((i) => (i + 1) % FAMILY_WORDS.length);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const cycleWord = useCallback(() => {
    setFamilyIndex((i) => (i + 1) % FAMILY_WORDS.length);
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* A word from your family */}
      <Pressable
        onPress={cycleWord}
        onPressIn={() => { familyPaused.current = true; }}
        onPressOut={() => { familyPaused.current = false; }}
        accessibilityRole="button"
        accessibilityHint="Tap for the next word"
        style={styles.familyWord}
      >
        <Text style={styles.familyEyebrow}>A WORD FROM YOUR FAMILY</Text>
        <Text style={styles.familyText}>{FAMILY_WORDS[familyIndex % FAMILY_WORDS.length].text}</Text>
        <Text style={styles.familyAttribution}>{FAMILY_WORDS[familyIndex % FAMILY_WORDS.length].attribution}</Text>
        <View style={styles.dotPager}>
          {FAMILY_WORDS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === familyIndex % FAMILY_WORDS.length && styles.dotActiveSky,
              ]}
            />
          ))}
        </View>
      </Pressable>

      {/* Practical guidance */}
      <SectionHeader label="Practical guidance" />
      <View style={styles.guidanceList}>
        {GUIDANCE_CARDS.map((g) => (
          <Pressable
            key={g.slug}
            onPress={() => navigation.navigate('GuidanceReader', { slug: g.slug })}
            accessibilityRole="button"
            accessibilityLabel={g.title}
            hitSlop={{ top: 4, bottom: 4 }}
            style={styles.guidanceCard}
          >
            <View style={styles.guidanceIconWrap}>
              <GuidanceIcon type={g.icon} />
            </View>
            <View style={styles.guidanceBody}>
              <Text style={styles.guidanceTitle}>{g.title}</Text>
              <Text style={styles.guidanceSub}>{g.sub}</Text>
            </View>
            <Svg width={10} height={10} viewBox="0 0 12 12" fill="none" style={styles.guidanceChev}>
              <Path
                d="M4 2l4 4-4 4"
                stroke={Colors.textMuted}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ))}
      </View>

      {/* Emergency Action Plan */}
      <SectionHeader label="The body with you" />
      <View style={styles.bodyWithYou}>
        <Text style={styles.bodyCopy}>
          Do you have an Emergency Action Plan with the churches around you?
        </Text>
        <Pressable
          onPress={() => {
            // Route to Connect tab → Ministries sub-tab (EAP branch creation/list).
            // Location-based "nearest to you" filtering is post-MVP.
            navigation.navigate('Tabs', {
              screen: 'Connect',
              params: { initialSubTab: 'ministries' },
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Start an EAP Branch"
          style={({ pressed }) => [styles.eapCta, pressed && styles.eapCtaPressed]}
        >
          <Text style={styles.eapCtaLabel}>START AN EAP BRANCH</Text>
        </Pressable>
      </View>

      <ScriptureFooter
        eyebrow="TAKE HEART"
        verse="I have said these things to you, that in me you may have peace. In the world you will have tribulation. But take heart; I have overcome the world."
        verseRef="JOHN 16:33"
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SectionHeader (local)
// ─────────────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GuidanceIcon — sky-colored SVG glyphs
// ─────────────────────────────────────────────────────────────────────

function GuidanceIcon({ type }: { type: 'lock' | 'door' | 'shield' | 'book' }) {
  const color = Colors.accent;
  switch (type) {
    case 'lock':
      return (
        <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <Rect x={2.5} y={6} width={9} height={6.5} rx={1} stroke={color} strokeWidth={1} fill="none" />
          <Path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke={color} strokeWidth={1} fill="none" />
        </Svg>
      );
    case 'door':
      return (
        <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <Rect x={3} y={2} width={8} height={11} stroke={color} strokeWidth={1} fill="none" />
          <Circle cx={9} cy={7.5} r={0.6} fill={color} />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <Path d="M7 1.5l4.5 1.5v4.5c0 2.5-2 4.5-4.5 5-2.5-0.5-4.5-2.5-4.5-5V3z" stroke={color} strokeWidth={1} fill="none" />
        </Svg>
      );
    case 'book':
      return (
        <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
          <Path d="M2 2.5h4a2 2 0 0 1 2 2v8a2 2 0 0 0-2-2H2z" stroke={color} strokeWidth={1} fill="none" />
          <Path d="M12 2.5H8a2 2 0 0 0-2 2v8a2 2 0 0 1 2-2h4z" stroke={color} strokeWidth={1} fill="none" />
        </Svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 28 },

  // A word from your family
  familyWord: {
    paddingVertical: 28,
    paddingHorizontal: 30,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(240,237,230,0.08)',
  },
  familyEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.4, // 0.24em × 10
    textTransform: 'uppercase',
    color: 'rgba(107,181,232,0.70)', // sky at 70% — softer than a CTA
    marginBottom: 18,
  },
  familyText: {
    fontFamily: Typography.displayRegular, // roman, NOT scriptureItalic — human warmth, not sacred weight
    fontSize: 21,
    lineHeight: 30,
    color: CREAM,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.21,
  },
  familyAttribution: {
    fontFamily: Typography.scriptureItalic, // italic — source attribution, correct use
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  dotPager: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.border,
  },
  dotActiveSky: {
    backgroundColor: Colors.accent, // sky, NOT red
  },

  // Section header
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    marginTop: 22,
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    letterSpacing: 0.19,
    color: Colors.text,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: FAINT,
  },

  // Guidance
  guidanceList: {
    paddingHorizontal: 22,
    gap: 10,
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderRadius: 8,
  },
  guidanceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107,181,232,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guidanceBody: {
    flex: 1,
  },
  guidanceTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 3,
  },
  guidanceSub: {
    fontFamily: Typography.displayRegular,
    fontSize: 14.5,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  guidanceChev: {
    flexShrink: 0,
  },

  // Body with you
  bodyWithYou: {
    marginHorizontal: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.18)',
    backgroundColor: 'rgba(107,181,232,0.04)', // solid, no gradient
    borderRadius: 8,
    alignItems: 'center',
  },
  bodyCopy: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 26,
    color: CREAM,
    textAlign: 'center',
    marginBottom: 18,
  },
  eapCta: {
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.35)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(107,181,232,0.08)',
  },
  eapCtaPressed: { opacity: 0.7 },
  eapCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 1.61,
    textTransform: 'uppercase',
    color: Colors.accent,
    textAlign: 'center',
  },
});
