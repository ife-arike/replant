// MyHeartcriesScene — Surface 2: Own heartcry submissions with severity + status track.
// FlatList with estimatedItemSize 186. Severity tags, StatusTrack, Responded CTA.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography } from '../../../../constants/theme';
import { supabase } from '../../../../lib/supabase';
import { formatRelativeTime } from '../../persecutedLogic';
import SeverityTag from '../components/SeverityTag';
import StatusTrack from '../components/StatusTrack';
import { ScriptureFooter } from './FeedScene';
import type { RootStackParamList } from '../../../../navigation/types';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface MyHeartcryRow {
  id: string;
  severity: string;
  created_at: string;
  feed_content: string | null;
  status: string;
  responded_at: string | null;
  thread_id: string | null;
}

export default function MyHeartcriesScene() {
  const navigation = useNavigation<NavProp>();
  const [rows, setRows] = useState<MyHeartcryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const hasFetchedRef = useRef(false);

  const loadData = useCallback(async (silent?: boolean) => {
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    const { data, error } = await supabase.rpc('get_my_heartcries');
    hasFetchedRef.current = true;
    if (error) {
      if (!silent) setLoadError(true);
    } else {
      setRows((data ?? []) as MyHeartcryRow[]);
    }
    if (!silent) setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData(hasFetchedRef.current);
    }, [loadData]),
  );

  const renderItem = useCallback(({ item }: { item: MyHeartcryRow }) => (
    <MyHeartcryCard
      row={item}
      onOpenMessage={() => {
        if (item.thread_id) {
          // Navigate to Connect tab and open the DM thread by conversationId.
          // ConnectScreen reads the conversationId param on focus and calls
          // goTo({ kind: 'thread', conversationId }) into its state machine.
          navigation.navigate('Tabs', {
            screen: 'Connect',
            params: { conversationId: item.thread_id },
          });
        }
      }}
    />
  ), [navigation]);

  const keyExtractor = useCallback((item: MyHeartcryRow) => item.id, []);

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<MyHeartcryIntro />}
      ListEmptyComponent={loading ? null : loadError ? <MyHeartcryLoadError /> : <MyHeartcryEmpty onShare={() => navigation.navigate('HeartcrySubmission')} />}
      ListFooterComponent={
        <ScriptureFooter
          eyebrow="THE LORD HEARS"
          verse="I sought the Lord, and he answered me and delivered me from all my fears."
          verseRef="PSALM 34:4"
        />
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// MyHeartcryIntro
// ─────────────────────────────────────────────────────────────────────

function MyHeartcryIntro() {
  return (
    <View style={styles.intro}>
      <Text style={styles.introEyebrow}>SET ASIDE FOR YOU</Text>
      <Text style={styles.introBody}>
        Your shared Heartcries live here. The team reads each one, prays through it,
        and reaches you directly in your secure messages when there is something to say.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MyHeartcryCard
// ─────────────────────────────────────────────────────────────────────

function MyHeartcryCard({
  row,
  onOpenMessage,
}: {
  row: MyHeartcryRow;
  onOpenMessage: () => void;
}) {
  const relativeTime = formatRelativeTime(row.created_at);
  const absoluteTime = row.created_at
    ? new Date(row.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ' · ' +
      new Date(row.created_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  const excerpt = row.feed_content ?? '';

  return (
    <View style={styles.card}>
      {/* Header: severity + relative time */}
      <View style={styles.cardHeader}>
        <SeverityTag severity={row.severity} />
        <Text style={styles.cardRelativeTime}>{relativeTime}</Text>
      </View>

      {/* Absolute timestamp */}
      <Text style={styles.cardAbsoluteTime}>{absoluteTime}</Text>

      {/* Excerpt — falls back to status copy when feed_content not yet set */}
      {excerpt ? (
        <Text style={styles.cardExcerpt} numberOfLines={3}>{excerpt}</Text>
      ) : (
        <Text style={styles.cardExcerptPlaceholder}>
          {row.status === 'responded'
            ? 'A response is waiting in your secure messages.'
            : row.status === 'seen'
            ? 'The team has read your heartcry.'
            : 'Being held and prayed over.'}
        </Text>
      )}

      {/* Status track */}
      <StatusTrack status={row.status} />

      {/* Responded CTA */}
      {row.status === 'responded' && row.thread_id && (
        <Pressable
          onPress={onOpenMessage}
          accessibilityRole="button"
          accessibilityLabel="Open secure message"
          hitSlop={{ top: 6, bottom: 6 }}
          style={styles.respondedCta}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6l9 7 9-7M3 6h18v12H3z"
              stroke={Colors.green}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.respondedLabel}>Open Secure Message</Text>
          <Svg width={10} height={10} viewBox="0 0 12 12" fill="none" style={styles.respondedChev}>
            <Path
              d="M4 2l4 4-4 4"
              stroke={Colors.green}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MyHeartcryEmpty
// ─────────────────────────────────────────────────────────────────────

function MyHeartcryEmpty({ onShare }: { onShare: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Svg width={28} height={28} viewBox="0 0 14 14" fill="none" style={styles.emptyGlyph}>
        <Path
          d="M2 3l5 4 5-4M2 3h10v8H2z"
          stroke={Colors.textMuted}
          strokeWidth={1}
        />
      </Svg>
      <Text style={styles.emptyTitle}>No Heartcries written.</Text>
      <Text style={styles.emptyBody}>
        If a day comes when you need to be heard, this space will hold it. Until then, the body is praying around you.
      </Text>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Share my heartcry"
        style={styles.emptyCta}
      >
        <Text style={styles.emptyCtaLabel}>SHARE MY HEARTCRY</Text>
      </Pressable>
    </View>
  );
}

function MyHeartcryLoadError() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Could not load your heartcries.</Text>
      <Text style={styles.emptyBody}>
        Pull down to try again, or check back shortly.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 28,
  },

  // Intro
  intro: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },
  introEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.4, // 0.24em × 10
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 10,
  },
  introBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 27,
    color: CREAM,
    letterSpacing: 0.18,
  },

  // Card
  card: {
    marginHorizontal: 22,
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardRelativeTime: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.08,
    color: Colors.textMuted,
  },
  cardAbsoluteTime: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.08,
    color: Colors.textSubtle,
    marginBottom: 10,
  },
  cardExcerpt: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25,
    color: CREAM,
    letterSpacing: 0.08,
  },
  cardExcerptPlaceholder: {
    fontFamily: Typography.body, // UI status string, not a quote — roman, no italic
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSubtle,
    marginBottom: 4,
  },

  // Responded CTA
  respondedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(91,173,122,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(91,173,122,0.22)',
    borderRadius: 6,
  },
  respondedLabel: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    color: Colors.green,
    flex: 1,
  },
  respondedChev: {
    flexShrink: 0,
  },

  // Empty
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  emptyGlyph: {
    marginBottom: 18,
    opacity: 0.5,
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    lineHeight: 27,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 22,
  },
  emptyCta: {
    borderWidth: 0.5,
    borderColor: 'rgba(217,89,79,0.30)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: Colors.red,
  },
});
