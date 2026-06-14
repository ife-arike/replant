// OutreachMissionsScreen — hamburger sprint (CD v5 final, Founder-locked 2026-06-09).
// Full spec: Zech 7:10 anchor · "Outreach near you" feed (city from churches.city,
// no geolocation) · "Across the network" restricted feed · "Where the Body bears"
// 6-chip 2-col grid · "How to help" action rows · limits note.
//
// City: fetched via auth_id = auth.uid() → churches!users_church_id_fkey(city).
// All feed data is static at MVP (outreach_needs table not yet seeded).
// All italic copy uses Typography.scriptureItalic; colours via Colors tokens.

import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthProvider';
import { supabase } from '../../../lib/supabase';
import type { RootStackParamList } from '../../../navigation/types';
import HamburgerNavBar from './HamburgerNavBar';
import ComingSoonModal from '../../../components/common/ComingSoonModal';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const H_PAD = 22;
const CHIP_GAP = 8;
const CHIP_W = (Dimensions.get('window').width - H_PAD * 2 - CHIP_GAP) / 2;

// ─── Static data (outreach_needs table not yet seeded; local feed shows empty
//     state referencing leader's real church city from the DB) ───

interface NeedItem {
  area: string;
  title: string;
  meta: string;
  loc: string;
}

const TYPE_CHIPS = [
  { numeral: '01', name: 'Widow & Orphan',        ref: 'James 1:27' },
  { numeral: '02', name: 'Shelter & Refuge',      ref: 'Psalm 146:9' },
  { numeral: '03', name: 'Persecuted Church',     ref: 'Hebrews 13:3' },
  { numeral: '04', name: 'Church Planting',       ref: 'Acts 14:23' },
  { numeral: '05', name: 'Resource Distribution', ref: '2 Cor 8:14' },
  { numeral: '06', name: 'Prison & Hospital',     ref: 'Matthew 25:36' },
];

// ─── Sub-components ───

function SectionHead({ label, meta }: { label: string; meta?: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.sectionHairline} />
    </View>
  );
}

function FeedItem({ item, onPress }: { item: NeedItem; onPress: () => void }) {
  return (
    <Pressable
      style={styles.feedItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.feedItemTopRow}>
        <Text style={styles.feedItemArea}>{item.area}</Text>
        <Text style={styles.feedItemLoc}>{item.loc}</Text>
      </View>
      <Text style={styles.feedItemTitle}>{item.title}</Text>
      <Text style={styles.feedItemMeta}>{item.meta}</Text>
    </Pressable>
  );
}

// ─── Screen ───

export default function OutreachMissionsScreen() {
  const navigation = useNavigation<NavProp>();
  const { session } = useAuth();
  const authId = session?.user?.id ?? null;
  const [city, setCity] = useState<string>('');

  useEffect(() => {
    if (!authId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('church:churches!users_church_id_fkey(city)')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as unknown as { church: { city: string } | null };
      if (row.church?.city) setCity(row.church.city);
    })();
    return () => { cancelled = true; };
  }, [authId]);

  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const comingSoon = () => setComingSoonOpen(true);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <HamburgerNavBar title="Outreach & Missions" onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Eyebrow */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowHairline} />
          <Text style={styles.eyebrow}>Outreach · Missions</Text>
        </View>

        {/* Title — "Bear one another's" roman off-white, "burdens." italic sky.
            No whitespace between the string and the nested Text — JSX indentation
            before a sibling Text renders as a leading space in RN. */}
        <Text style={styles.title}>{'Bear one another\'s '}<Text style={styles.titleItalic}>{'burdens.'}</Text></Text>

        {/* Scripture anchor — Zechariah 7:10 KJV */}
        <View style={styles.anchor}>
          <Text style={styles.anchorQuote}>
            "And oppress not the widow, nor the fatherless, the stranger, nor the poor; and let none of you imagine evil against his brother in your heart."
          </Text>
          <Text style={styles.anchorRef}>Zechariah 7:10 · KJV</Text>
        </View>

        {/* ── Outreach near you ── */}
        <SectionHead
          label="Outreach near you"
          meta={city || undefined}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {city
              ? `No outreach needs listed near ${city} yet.`
              : 'No outreach needs listed near you yet.'}
          </Text>
          <Text style={styles.emptyStateHint}>
            As leaders post needs across the network, they'll appear here.
          </Text>
        </View>

        {/* ── Across the network ── */}
        <SectionHead label="Across the network" meta="Restricted" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No outreach needs shared across the network yet.
          </Text>
          <Text style={styles.emptyStateHint}>
            As leaders post needs across the network, they'll appear here.
          </Text>
        </View>

        {/* ── Where the Body bears ── */}
        <SectionHead label="Where the Body bears" />
        <View style={styles.typesGrid}>
          {TYPE_CHIPS.map((chip) => (
            <Pressable
              key={chip.numeral}
              style={styles.typeChip}
              onPress={comingSoon}
              accessibilityRole="button"
            >
              <Text style={styles.typeNum}>{chip.numeral}</Text>
              <Text style={styles.typeName}>{chip.name}</Text>
              <Text style={styles.typeRef}>{chip.ref}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── How to help ── */}
        <SectionHead label="How to help" />
        <View style={styles.actionsBlock}>

          {/* Pray */}
          <Pressable style={styles.actionRow} onPress={() => (navigation as any).navigate('Tabs', { screen: 'Prayer Wall' })} accessibilityRole="button">
            <View style={styles.actionIconBox}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 3v9M12 12l-3-3M12 12l3-3" stroke={Colors.accent} strokeWidth={1.5} strokeLinecap="round" />
                <Path d="M5 14c0 4 3 7 7 7s7-3 7-7" stroke={Colors.accent} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Pray</Text>
              <Text style={styles.actionSub}>Lift these needs on the network's prayer wall.</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={Colors.text} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.actionDivider} />

          {/* Give of surplus */}
          <Pressable style={styles.actionRow} onPress={comingSoon} accessibilityRole="button">
            <View style={styles.actionIconBox}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 8z" stroke={Colors.accent} strokeWidth={1.5} strokeLinejoin="round" />
                <Path d="M9 8V6a3 3 0 1 1 6 0v2" stroke={Colors.accent} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Give of your surplus</Text>
              <Text style={styles.actionSub}>Match supplies, curriculum, and manpower with churches in need.</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={Colors.text} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.actionDivider} />

          {/* Go */}
          <Pressable style={styles.actionRow} onPress={comingSoon} accessibilityRole="button">
            <View style={styles.actionIconBox}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={10} r={3} stroke={Colors.accent} strokeWidth={1.5} />
                <Path d="M12 2c4.5 0 8 3.5 8 8 0 6-8 12-8 12S4 16 4 10c0-4.5 3.5-8 8-8z" stroke={Colors.accent} strokeWidth={1.5} strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Go</Text>
              <Text style={styles.actionSub}>Visit, serve, and stand with congregations in your reach.</Text>
            </View>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke={Colors.text} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

        </View>

        {/* Limits note */}
        <View style={styles.limitsNote}>
          <Text style={styles.limitsEyebrow}>A note on how the network bears</Text>
          <Text style={styles.limitsText}>
            {'Replant does not facilitate financial transfers between churches. We match prayer, supplies, hours, and presence — leader to leader, church to church. '}
            <Text style={styles.limitsItalic}>{'Money flows through your own ministry\'s existing channels.'}</Text>
          </Text>
        </View>
      </ScrollView>
      <ComingSoonModal
        visible={comingSoonOpen}
        onDismiss={() => setComingSoonOpen(false)}
        title="This step is on the way."
        body="When this surface is live, you'll be able to act from here directly."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 22,
    paddingBottom: 32,
  },

  // Eyebrow
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
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

  // Title
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 32,
    letterSpacing: -0.32, // -0.01em × 32
    lineHeight: 35,       // 1.1 × 32
    color: Colors.text,
    marginBottom: 20,
  },
  titleItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 32,
    color: Colors.accent,
  },

  // Scripture anchor (Zech 7:10)
  anchor: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 18,
    marginBottom: 8,
  },
  anchorQuote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 27, // 1.6 × 17
    color: Colors.text,
    marginBottom: 10,
  },
  anchorRef: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.86, // 0.26em × 11
    textTransform: 'uppercase',
    color: Colors.accent,
  },

  // Section head (shared across all sections)
  sectionHead: {
    marginTop: 24,
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Typography.mono,
    fontSize: 11,
    letterSpacing: 2.86, // 0.26em × 11
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  sectionMeta: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.accent,
  },
  sectionHairline: {
    height: 0.5,
    backgroundColor: Colors.border,
  },

  // Feed items
  feedItem: {
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  feedItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  feedItemArea: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em × 10.5
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  feedItemLoc: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    color: Colors.textSubtle,
  },
  feedItemTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 3,
  },
  feedItemMeta: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21, // ~1.6 × 13
    color: Colors.textMuted,
  },

  // "Near you" empty state
  emptyState: {
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  emptyStateText: {
    fontFamily: Typography.sansLight,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  emptyStateHint: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: Colors.textSubtle,
  },

  // "Where the Body bears" — 2-col chip grid
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
    marginTop: 12,
  },
  typeChip: {
    width: CHIP_W,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.borderAccent,
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  typeNum: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em × 10.5
    color: Colors.accent,
    marginBottom: 5,
  },
  typeName: {
    fontFamily: Typography.displayMedium,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
    marginBottom: 5,
  },
  typeRef: {
    fontFamily: Typography.sansLight,
    fontSize: 12.5,
    color: Colors.textMuted,
  },

  // "How to help" — action rows
  actionsBlock: {
    marginTop: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: Typography.displayMedium,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 2,
  },
  actionSub: {
    fontFamily: Typography.sansLight,
    fontSize: 13.5,
    lineHeight: 22, // ~1.6 × 13.5
    color: Colors.textMuted,
  },

  // Limits note (bottom)
  limitsNote: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  limitsEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em × 10.5
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  limitsText: {
    fontFamily: Typography.sansLight,
    fontSize: 13.5,
    lineHeight: 23, // ~1.7 × 13.5
    color: Colors.textSubtle,
  },
  limitsItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13.5,
    color: Colors.textSubtle,
  },
});
