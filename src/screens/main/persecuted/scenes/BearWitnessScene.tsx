// BearWitnessScene — Surface 3: Standing this week, stories, witness of the day.
// Three sections with SectionHeader + content.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import WitnessOfDayCard, { type WitnessData } from '../components/WitnessOfDayCard';
import { ScriptureFooter } from './FeedScene';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface StandingStat {
  num: string;
  desc: string;
}

interface StoryPreview {
  id?: string;
  source: string;
  author: string;
  title: string;
  excerpt?: string;
  read?: string;
}

// ── Placeholder data (until RPCs are seeded) ────────────────────────
const PLACEHOLDER_STATS: StandingStat[] = [
  { num: '8,412', desc: 'leaders standing in prayer across forty-three regions this week' },
  { num: '1,206', desc: 'heartcries held by the body this month, each one named before the Father' },
  { num: '63', desc: 'churches currently under active persecution, region only — never named' },
];

const PLACEHOLDER_STORIES: StoryPreview[] = [
  {
    source: 'Replant Editorial',
    author: 'Replant Team',
    title: 'Three families, one basement.',
    excerpt: 'What we have learned from leaders sheltering in place: the body does not need permission to gather. It needs only courage and one room.',
    read: '6 min read',
  },
  {
    source: 'Voice of the Martyrs',
    author: 'Partner feed',
    title: 'A letter from inside.',
    excerpt: 'Translated and shared with permission. A pastor writes to his congregation from prison — not asking for release, but for the church to remain.',
    read: '4 min read',
  },
  {
    source: 'Replant Editorial',
    author: 'Replant Team',
    title: 'When the gathering is forbidden.',
    excerpt: 'A pastoral note on the threshold: how the early church gathered when Rome forbade it, and what they wrote to each other when they could not.',
    read: '9 min read',
  },
];

const PLACEHOLDER_WITNESS: WitnessData = {
  era: 'AD 156',
  years_label: 'c. AD 69 – 156',
  name: 'Polycarp of Smyrna',
  region: 'Asia Minor',
  category: 'Father of the Faith',
  martyr: true,
  quote: 'Eighty-six years I have served Him, and He has done me no wrong. How can I blaspheme my King who saved me?',
  scripture_ref: 'Revelation 2:10',
};

export default function BearWitnessScene() {
  const navigation = useNavigation<NavProp>();

  // TODO: Replace with live RPC data when seeded
  const [stats] = useState<StandingStat[]>(PLACEHOLDER_STATS);
  const [stories] = useState<StoryPreview[]>(PLACEHOLDER_STORIES);
  const [witness] = useState<WitnessData>(PLACEHOLDER_WITNESS);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Standing this week */}
      <View style={styles.statsBlock}>
        <Text style={styles.statsEyebrow}>STANDING THIS WEEK</Text>
        {stats.map((s, i) => (
          <View key={i} style={styles.statRow}>
            <Text style={styles.statNum}>{s.num}</Text>
            <Text style={styles.statDesc}>{s.desc}</Text>
          </View>
        ))}
      </View>

      {/* Around the world */}
      <SectionHeader
        label="Around the world"
        link="All stories"
        onLink={() => navigation.navigate('StoryArchive')}
      />
      <View style={styles.storiesBlock}>
        {stories.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => {
              // TODO: Pass real article ID when articles are seeded
              navigation.navigate('ArticleReader', { articleId: 'placeholder' });
            }}
            accessibilityRole="button"
            accessibilityLabel={s.title}
            hitSlop={{ top: 4, bottom: 4 }}
            style={styles.storyCard}
          >
            <View style={styles.storySourceRow}>
              <Text style={styles.storyAuthor}>{s.source}</Text>
              <Text style={styles.storySep}> · </Text>
              <Text style={styles.storySourceLabel}>{s.author}</Text>
            </View>
            <Text style={styles.storyTitle}>{s.title}</Text>
            {s.excerpt ? <Text style={styles.storyExcerpt}>{s.excerpt}</Text> : null}
            {s.read ? <Text style={styles.storyReadTime}>{s.read}</Text> : null}
          </Pressable>
        ))}
      </View>

      {/* Witness of the day */}
      <SectionHeader
        label="Witness of the day"
        link="Archive"
        onLink={() => navigation.navigate('WitnessArchive')}
      />
      <WitnessOfDayCard
        witness={witness}
        onOpenArchive={() => navigation.navigate('WitnessArchive')}
      />

      <ScriptureFooter
        eyebrow="A CLOUD OF WITNESSES"
        verse="Since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight and run with endurance the race that is set before us."
        verseRef="HEBREWS 12:1"
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SectionHeader — serif label + hairline + optional italic sky link
// ─────────────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  link,
  onLink,
}: {
  label: string;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
      {link && onLink && (
        <Pressable
          onPress={onLink}
          accessibilityRole="button"
          accessibilityLabel={link}
          hitSlop={8}
        >
          <Text style={styles.sectionLink}>{link}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 28 },

  // Stats block
  statsBlock: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },
  statsEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.4, // 0.24em × 10
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  statNum: {
    fontFamily: Typography.displayRegular,
    fontSize: 34,
    letterSpacing: 0.34,
    color: Colors.text,
    lineHeight: 34,
    minWidth: 70,
  },
  statDesc: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    flex: 1,
    paddingTop: 6,
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
  sectionLink: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: Colors.accent,
  },

  // Stories
  storiesBlock: {
    paddingHorizontal: 22,
    gap: 14,
  },
  storyCard: {
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(224,85,85,0.30)',
    paddingLeft: 14,
    paddingVertical: 10,
  },
  storySourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyAuthor: {
    fontFamily: Typography.displayRegular,
    fontSize: 14,
    color: Colors.accent,
  },
  storySep: {
    fontFamily: Typography.displayRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  storySourceLabel: {
    fontFamily: Typography.displayRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  storyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
    marginBottom: 6,
  },
  storyExcerpt: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15.5,
    lineHeight: 24,
    color: CREAM,
    marginBottom: 6,
  },
  storyReadTime: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62,
    color: Colors.textSubtle,
  },
});
