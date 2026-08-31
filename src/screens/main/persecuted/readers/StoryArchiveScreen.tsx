// StoryArchiveScreen — pushed from Bear Witness "All stories" link.
// FlatList with filter chips: All / Replant Editorial / Partner feeds.
// Tap story → push ArticleReader.

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import BackRow from '../components/BackRow';
import ArchiveIntro from '../components/ArchiveIntro';
import FilterChips, { type ChipOption } from '../components/FilterChips';
import { classifyFetch } from './readerLoadState';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface StoryRow {
  id: string;
  source: string;
  author: string;
  title: string;
  published_at: string;
}

const FILTER_OPTIONS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'replant', label: 'Replant Editorial' },
  { id: 'partner', label: 'Partner feeds' },
];

// Placeholder stories until data is seeded. The 'placeholder-' id prefix
// is load-bearing (KAN-347): ArticleReader serves these in-app and never
// sends a placeholder id to the RPC.
const PLACEHOLDER_STORIES: StoryRow[] = [
  { id: 'placeholder-1', source: 'Replant Editorial', author: 'Replant Team', title: 'Three families, one basement.', published_at: new Date().toISOString() },
  { id: 'placeholder-2', source: 'Voice of the Martyrs', author: 'Partner feed', title: 'A letter from inside.', published_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'placeholder-3', source: 'Replant Editorial', author: 'Replant Team', title: 'When the gathering is forbidden.', published_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'placeholder-4', source: 'Open Doors', author: 'Partner feed', title: 'The watchlist, rethought.', published_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'placeholder-5', source: 'Replant Editorial', author: 'Replant Team', title: 'How a pastor prepares his successor.', published_at: new Date(Date.now() - 86400000 * 14).toISOString() },
];

export default function StoryArchiveScreen() {
  const navigation = useNavigation<NavProp>();
  const [filter, setFilter] = useState('all');
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadStories = useCallback(async (f: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_story_archive', { p_filter: f });
    // KAN-347: error gets an honest retry state — the placeholder list is
    // the documented pre-seed design for EMPTY only, never for failure.
    switch (classifyFetch(error, data)) {
      case 'ready':
        setLoadError(false);
        setStories(data as StoryRow[]);
        break;
      case 'error':
        setLoadError(true);
        setStories([]);
        break;
      case 'empty': {
        setLoadError(false);
        const filtered = PLACEHOLDER_STORIES.filter((s) => {
          if (f === 'all') return true;
          if (f === 'replant') return s.source === 'Replant Editorial';
          return s.source !== 'Replant Editorial';
        });
        setStories(filtered);
        break;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStories(filter);
  }, [filter, loadStories]);

  const handleFilterSelect = useCallback((id: string) => {
    setFilter(id);
  }, []);

  const renderStory = useCallback(({ item }: { item: StoryRow }) => {
    const dateStr = new Date(item.published_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return (
      <Pressable
        onPress={() => navigation.navigate('ArticleReader', { articleId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        hitSlop={{ top: 4, bottom: 4 }}
        style={styles.storyRow}
      >
        <View style={styles.storyMeta}>
          <Text style={styles.storyAuthor}>{item.source}</Text>
          <Text style={styles.storySep}> · </Text>
          <Text style={styles.storySourceLabel}>{item.author}</Text>
        </View>
        <Text style={styles.storyTitle}>{item.title}</Text>
        <Text style={styles.storyDate}>{dateStr}</Text>
      </Pressable>
    );
  }, [navigation]);

  const keyExtractor = useCallback((item: StoryRow) => item.id, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.leftEdge} pointerEvents="none" />
      <StoryNavBar onBack={() => navigation.goBack()} />
      <FlatList
        data={stories}
        renderItem={renderStory}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ArchiveIntro
              eyebrow="FROM THE BODY"
              body="Editorials and partner-feed dispatches that have been held by the body. Tap any to read in full."
            />
            <FilterChips
              options={FILTER_OPTIONS}
              selectedId={filter}
              onSelect={handleFilterSelect}
            />
          </>
        }
        ListEmptyComponent={
          !loading && loadError ? (
            <View style={styles.errWrap}>
              <Text style={styles.errText}>Couldn't load stories</Text>
              <Pressable
                onPress={() => void loadStories(filter)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Retry loading stories"
              >
                <Text style={styles.errRetry}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.scriptureFoot}>
            <Text style={styles.scriptureEyebrow}>THE BODY SPEAKS</Text>
            <Text style={styles.scriptureVerse}>
              And they overcame him by the blood of the Lamb, and by the word of their testimony.
            </Text>
            <Text style={styles.scriptureRef}>REVELATION 12:11</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function StoryNavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navbar}>
      <BackRow onPress={onBack} />
      <Text style={styles.navTitle}>All stories</Text>
      <Text style={styles.navSubtitle}>AROUND THE WORLD · HELD IN-APP</Text>
      <View style={styles.navHairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  leftEdge: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 1.5,
    backgroundColor: Colors.red,
    opacity: 0.25,
    zIndex: 1,
  },
  listContent: { paddingBottom: 28 },
  errWrap: { paddingTop: 48, alignItems: 'center' },
  errText: {
    fontFamily: Typography.mono,
    fontSize: 12,
    color: Colors.textSubtle,
    letterSpacing: 0.3,
  },
  errRetry: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    color: Colors.accent,
    letterSpacing: 0.4,
    paddingVertical: 10,
  },

  // NavBar
  navbar: { paddingTop: 14, paddingBottom: 10 },
  navTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.red,
    paddingHorizontal: 20,
  },
  navSubtitle: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginTop: 6,
    paddingHorizontal: 20,
  },
  navHairline: {
    height: 0.5,
    backgroundColor: 'rgba(217,89,79,0.30)',
    marginTop: 14,
    marginHorizontal: 20,
  },

  // Story row
  storyRow: {
    marginHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT,
  },
  storyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyAuthor: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 12.5,
    color: Colors.accent,
  },
  storySep: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  storySourceLabel: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  storyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 4,
  },
  storyDate: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 12,
    color: Colors.textSubtle,
  },

  // Scripture footer
  scriptureFoot: {
    marginTop: 40,
    marginHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  scriptureEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 14,
  },
  scriptureVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
    maxWidth: 320,
    textAlign: 'center',
    marginBottom: 12,
  },
  scriptureRef: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 2.09,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
});
