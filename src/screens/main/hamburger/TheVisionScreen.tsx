// TheVisionScreen — hamburger sprint (CD v5 final, Founder-locked 2026-06-09).
// Pushed slide_from_right from the Home-tab hamburger panel.
//
// Editorial manifesto surface — the heart of Replant (John 17:21). All
// italic copy uses Typography.scriptureItalic (Cormorant 300 Light Italic
// font asset) — never fontStyle:'italic'. All colours via Colors tokens.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../constants/theme';
import type { RootStackParamList } from '../../../navigation/types';
import HamburgerNavBar from './HamburgerNavBar';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function TheVisionScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <HamburgerNavBar title="The Vision" onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Eyebrow — 20px sky hairline + mono label */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowHairline} />
          <Text style={styles.eyebrow}>Replant · The Vision</Text>
        </View>

        {/* Headline — "The Church," roman off-white, "Sewn Back Together" italic sky */}
        <Text style={styles.headline}>{'The Church,\n'}<Text style={styles.headlineItalic}>Sewn Back Together</Text></Text>

        {/* Lede — scripture-italic asset */}
        <Text style={styles.lede}>
          Connecting leaders across cities, continents, and callings — for prayer,
          for support, for one another.
        </Text>

        <View style={styles.divider} />

        {/* Scripture block — left sky-25 rule */}
        <View style={styles.scriptureBlock}>
          <Text style={styles.scriptureQuote}>
            That they all may be one; as thou, Father, art in me, and I in thee, that
            they also may be one in us
          </Text>
          <Text style={styles.scriptureRef}>John 17:21 · KJV</Text>
        </View>

        <Text style={styles.para}>
          Churches were never meant to carry their burdens alone. Right now, leaders
          in the same city don't always know each other. Prayer needs go unheard.
          Resources sit in one church when another is in desperate need. The Body is
          fragmented.
        </Text>
        <Text style={styles.para}>
          Replant is a secure network — not a social media platform — where verified
          Christian leaders can find one another, pray together, and extend real
          support across geography. Anchored in Scripture. Driven by the Spirit.
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerMark}>Replant Initiative, Inc.</Text>
          <Text style={styles.footerEst}>Est. 2026</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Eyebrow
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 26,
  },
  eyebrowHairline: {
    width: 20,
    height: 0.5,
    backgroundColor: Colors.accent,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 3.3, // 0.30em × 11
    textTransform: 'uppercase',
    color: Colors.accent,
  },

  // Headline
  headline: {
    fontFamily: Typography.displayRegular,
    fontSize: 38,
    letterSpacing: -0.38, // -0.01em × 38
    lineHeight: 40, // 1.05 × 38
    color: Colors.text,
    marginBottom: 28,
  },
  headlineItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 38,
    color: Colors.accent,
  },

  // Lede
  lede: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 19,
    lineHeight: 30, // ~1.6 × 19
    color: Colors.text,
    marginBottom: 26,
  },

  divider: {
    width: 32,
    height: 0.5,
    backgroundColor: Colors.borderAccent,
    marginBottom: 22,
  },

  // Scripture block
  scriptureBlock: {
    paddingLeft: 18,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.borderAccent,
    marginTop: 8,
    marginBottom: 24,
  },
  scriptureQuote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 27, // 1.6 × 17
    color: Colors.text,
    marginBottom: 10,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.86, // 0.26em × 11
    textTransform: 'uppercase',
    color: Colors.accent,
  },

  // Body paragraphs
  para: {
    fontFamily: Typography.sansLight,
    fontSize: 15,
    lineHeight: 26, // 1.75 × 15
    color: Colors.textMuted,
    marginBottom: 16,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 22,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerMark: {
    fontFamily: Typography.displayRegular,
    fontSize: 12.5,
    letterSpacing: 1.0,
    color: Colors.textSubtle,
  },
  footerEst: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.42, // 0.22em × 11
    color: Colors.textSubtle,
  },
});
