// ─────────────────────────────────────────────
// NetworkFeed — KAN-17 + KAN-201 home redesign 2026-06-01
//
// Home Network Feed surface. Reads Posted announcements directly from
// `public.announcements` under leader RLS (policy
// `leaders_can_read_posted_announcements`). FE filter mirrors the policy
// as defense-in-depth.
//
// Read pattern: direct Supabase `from('announcements').select(...)` —
// no edge function. Sort: `published_at DESC`. Cursor: `published_at <
// cursor` for older pages.
//
// Card routing (redesign):
//   author_type === 'leader' → LeaderWordCard (attribution FROZEN at publish
//                               into source_label; Replant seal avatar; no
//                               per-viewer resolution — SME interim 2026-07-22)
//   link_url present          → LinkCard (external resource, no comments)
//   else                      → AnnouncementCard (letterhead)
//
// AC coverage retained from KAN-17:
//   #4 ORDER BY published_at DESC · #5 Posted-only predicate (+ FE mirror)
//   #6 mount + pull-to-refresh · #7 empty state · #8 cursor pagination 20/pg
//   #9 no realtime · #14 read-failure retry · #15 scroll preserved
//   #[age] FEED_MAX_AGE_DAYS (7) floor independent of the cursor.
//
// Motion (Day-1 polish, Founder 2026-07-28): rows enter with the Prayer
// Wall StaggerRow grammar (fade + 7px rise, 500ms, 55ms/row capped). The
// entrance re-plays on mount + pull-to-refresh via StaggerRow's
// replayToken PROP — never by re-keying rows (warm remounts can lose the
// read-on mirror's only onTextLayout event; see StaggerRow). Reduced
// motion skips it entirely.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import AnnouncementCard from './AnnouncementCard';
import LeaderWordCard from './LeaderWordCard';
import LinkCard from './LinkCard';
import ArticleCard from './ArticleCard';
import EncouragementCard from './EncouragementCard';
import TogetherCard from './TogetherCard';
import CallToActionCard from './CallToActionCard';
import HomeSectionLabel from './HomeSectionLabel';
import {
  PAGE_SIZE,
  deriveArticleStandfirst,
  formatRelativeTime,
  isPosted,
  resolveEyebrowTag,
  type AnnouncementRow,
} from './NetworkFeedLogic';
// Cross-feature import is deliberate — StaggerRow is the app's shared
// entrance grammar (Persecuted imports it the same way).
import { StaggerRow } from '../prayer/WallPrimitives';

// Column projection. The redesign adds link_url / author_type /
// comment_count. author_id is deliberately ABSENT: leader attribution is
// frozen into source_label at publish (SME panel interim, 2026-07-22), so
// the feed needs no author FK and no leader row ever ships to clients
// and NEVER reaches a display component (D-56 / SEC Observation D).
//
// KAN-335 badge cutover: `badge` (none | new | urgent) is the new
// eyebrow-register authority; `tag_type` is retained as the shadow — it
// stays projected here until a later migration drops it, once the app
// floor version moves past clients that still read tag_type.
// resolveEyebrowTag prefers badge and falls back to tag_type.
const SELECT_COLS =
  'id, title, body, published_at, is_active, source_label, source_sublabel, source_initial, tag_type, badge, link_url, author_type, comment_count, card_type, verse_text, verse_reference';

// KAN-17 amendment — feed shows only announcements published within the
// last FEED_MAX_AGE_DAYS days.
const FEED_MAX_AGE_DAYS = 7;

// Masked-leader display constant (mirrors CommentThread). Underground
// leaders never surface a name or location.
const MASKED_NAME = 'A leader in the network';

type LoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

export default function NetworkFeed() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('initial');
  const [hasMore, setHasMore] = useState(true);
  const hasFetchedOnce = useRef(false);
  // Bumped on initial load + pull-to-refresh; StaggerRow replays its
  // entrance off this PROP. Deliberately NOT a key: re-keying rows
  // remounts them warm, and a warm remount can lose the mirror's only
  // onTextLayout event, killing the read-on cue (Day-1 regression,
  // Founder report 2026-07-28). Stable keys also preserve expanded
  // bodies + open comment threads across a refresh.
  const [animTick, setAnimTick] = useState(0);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<{ rows: AnnouncementRow[]; error: string | null }> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - FEED_MAX_AGE_DAYS);
      let q = supabase
        .from('announcements')
        .select(SELECT_COLS)
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString())
        .gte('published_at', cutoff.toISOString())
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) {
        q = q.lt('published_at', cursor);
      }

      const { data, error } = await q;
      if (error) {
        return { rows: [], error: error.message };
      }
      const filtered = ((data ?? []) as AnnouncementRow[]).filter((r) => isPosted(r));
      return { rows: filtered, error: null };
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    setLoadState('initial');
    const { rows: pageRows, error } = await fetchPage(null);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setAnimTick((t) => t + 1);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setLoadState('refreshing');
    const { rows: pageRows, error } = await fetchPage(null);
    hasFetchedOnce.current = true;
    if (error) {
      setLoadState('error');
      return;
    }
    setRows(pageRows);
    setAnimTick((t) => t + 1);
    setHasMore(pageRows.length === PAGE_SIZE);
    setLoadState('idle');
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadState !== 'idle' || !hasMore || rows.length === 0) return;
    setLoadState('paging');
    const cursor = rows[rows.length - 1].published_at;
    const { rows: pageRows, error } = await fetchPage(cursor);
    if (error) {
      setLoadState('idle');
      return;
    }
    if (pageRows.length === 0) {
      setHasMore(false);
    } else {
      setRows((prev) => [...prev, ...pageRows]);
      setHasMore(pageRows.length === PAGE_SIZE);
    }
    setLoadState('idle');
  }, [fetchPage, hasMore, loadState, rows]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Empty + error states — AC #7 (no rows) and AC #14 (read error).
  if (loadState === 'error') {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>The wall is still for now.</Text>
          <Text style={styles.emptyBody}>Check back soon for an update from the Network.</Text>
        </View>
        <Pressable
          onPress={loadInitial}
          accessibilityRole="button"
          accessibilityLabel="Tap to retry"
          hitSlop={8}
        >
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (loadState === 'initial' && !hasFetchedOnce.current) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>The wall is still for now.</Text>
          <Text style={styles.emptyBody}>Check back soon for an update from the Network.</Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item, index }) => (
        <StaggerRow index={index} replayToken={animTick}>
          <FeedItem item={item} />
        </StaggerRow>
      )}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={<HomeSectionLabel>Network updates</HomeSectionLabel>}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={loadState === 'refreshing'}
          onRefresh={refresh}
          tintColor={Colors.accent}
        />
      }
      ListFooterComponent={
        loadState === 'paging' ? (
          <View style={styles.footerSpinner}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          // "— held in prayer —" sits below the last card, only once the
          // feed has finished paging. Lives inside the FlatList footer so
          // it never floats above the list end.
          <Text style={styles.end}>— held in prayer —</Text>
        )
      }
    />
  );
}

// One feed row, routed by card_type (KAN-201 card system 2026-06-02).
// card_type now drives routing and takes priority over the legacy
// author_type === 'leader' check; author_type stays as defence-in-depth.
// Leader-voice cards (leader_word, encouragement) resolve author display
// data from a secondary users/churches lookup; underground churches are
// masked here, client-side, before the card ever renders (SEC Obs D).
function FeedItem({ item }: { item: AnnouncementRow }) {
  const time = item.published_at ? formatRelativeTime(item.published_at) : '';
  // KAN-335 — prefer the `badge` column, fall back to legacy `tag_type`
  // for rows cached before badge entered the projection.
  const tag = resolveEyebrowTag(item.badge, item.tag_type);

  switch (item.card_type) {
    case 'article':
    case 'long_read': {
      // announcements has no standfirst column — derive it: the first
      // sentence becomes the italic standfirst, the remainder the body
      // (guarded so a one-sentence body is never split into an empty
      // body). Article/long_read only — the caller (this case) gates it.
      const { standfirst, body } = deriveArticleStandfirst(item.body);
      return (
        <ArticleCard
          announcementId={item.id}
          tag={tag}
          // Founder 2026-07-28: "Long read" display retired — nothing
          // principled separated it from an article. Both article-family
          // types self-identify as "Article" in the eyebrow; the dot still
          // carries the badge register (red urgent / breathing sky new).
          kicker="Article"
          title={item.title}
          standfirst={standfirst}
          body={body}
          // readTimeMin is not yet a column on announcements;
          // url is sourced from link_url when present.
          url={item.link_url ?? undefined}
          time={time}
          commentCount={item.comment_count}
          verseText={item.verse_text}
          verseRef={item.verse_reference}
        />
      );
    }

    case 'encouragement':
      return <EncouragementFeedItem item={item} time={time} />;

    case 'together':
      return (
        <TogetherCard
          announcementId={item.id}
          title={item.title}
          body={item.body}
          time={time}
          verseText={item.verse_text}
          verseRef={item.verse_reference}
          // Multi-author columns are not built yet — pass undefined so the
          // card renders the Rp seal + "Replant Team" fallback (correct
          // behaviour until multi-author support lands).
          coAuthors={undefined}
          commentCount={item.comment_count}
        />
      );

    case 'call_to_action':
      // CTA requires a destination. Fall back to a standard card when
      // link_url is absent rather than rendering a dead button.
      if (item.link_url) {
        return (
          <CallToActionCard
            announcementId={item.id}
            tag={tag}
            title={item.title}
            body={item.body}
            ctaLabel={item.source_label ?? 'Learn more'}
            url={item.link_url}
            time={time}
            commentCount={item.comment_count}
            verseText={item.verse_text}
            verseRef={item.verse_reference}
          />
        );
      }
      break;

    case 'leader_word':
      return <LeaderFeedItem item={item} time={time} />;

    default:
      break;
  }

  // Legacy fallback: author_type defence-in-depth, then link, then standard.
  if (item.author_type === 'leader') {
    return <LeaderFeedItem item={item} time={time} />;
  }

  if (item.link_url) {
    return (
      <LinkCard
        tag={tag}
        title={item.title}
        body={item.body}
        time={time}
        resource={item.source_label ?? 'External resource'}
        source="external link"
        url={item.link_url}
      />
    );
  }

  return (
    <AnnouncementCard
      announcementId={item.id}
      tag={tag}
      title={item.title}
      body={item.body}
      time={time}
      commentCount={item.comment_count}
      verseText={item.verse_text}
      verseRef={item.verse_reference}
    />
  );
}


// Leader-voice attribution is FROZEN at publish (SME panel interim, locked
// 2026-07-22): the byline travels in source_label, composed server-side by
// content_submission_publish (real name for show_name, else the role+region
// mask). The feed never resolves an author — no users/churches lookup, so
// every viewer reads the identical byline and no leader row ships to
// clients. CommentThread's resolver copy remains in the NetworkFeed-masking
// SEC panel's scope.
//
// Avatar (Founder 2026-07-28): NAMED leader posts show the leader's initial
// in the circle; SEALED posts (masked / underground — SEC F1) keep the
// Replant seal. The initial is SERVER-COMPOSED (announcements.source_initial
// — first letter of the leader's NAME, the feed counterpart of
// get_comments' avatar_initial). NEVER derive it client-side from the
// byline: the byline leads with a role title, so charAt(0) yields the
// ROLE's letter — the exact defect the comments avatar_initial work fixed
// (Founder caught a recurrence 2026-07-28). No initial → seal, fail-safe.
function leaderAvatar(item: AnnouncementRow): { seal?: boolean; initial?: string } {
  const initial = item.source_initial?.trim().toUpperCase();
  return initial ? { initial } : { seal: true };
}

function LeaderFeedItem({ item, time }: { item: AnnouncementRow; time: string }) {
  return (
    <LeaderWordCard
      announcementId={item.id}
      lead={item.title}
      body={item.body}
      verse={item.verse_reference ?? undefined}
      verseText={item.verse_text ?? undefined}
      author={{ ...leaderAvatar(item), name: item.source_label ?? MASKED_NAME, church: item.source_sublabel ?? '', time }}
      commentCount={item.comment_count}
    />
  );
}

// Encouragement wrapper — same frozen attribution. source_label is the
// BYLINE, not a verse anchor: the verse slot was a source_label overload
// (unmapped 2026-07-22); it returns when a dedicated verse column exists.
function EncouragementFeedItem({ item, time }: { item: AnnouncementRow; time: string }) {
  return (
    <EncouragementCard
      announcementId={item.id}
      lead={item.title}
      time={time}
      verse={item.verse_reference ?? undefined}
      verseText={item.verse_text ?? undefined}
      author={{ ...leaderAvatar(item), name: item.source_label ?? MASKED_NAME, church: item.source_sublabel ?? '' }}
      commentCount={item.comment_count}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: Spacing.xl,
  },
  separator: {
    height: 14,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyCopy: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyCard: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(240,237,230,0.14)',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 22,
    width: '85%',
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.17,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  footerSpinner: {
    paddingVertical: Spacing.md,
  },
  end: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: Colors.textSubtle,
    textAlign: 'center',
    paddingVertical: 22,
  },
});
