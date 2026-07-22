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
//   author_type === 'leader' → LeaderWordCard (author resolved via a
//                               secondary users/churches lookup; UNDERGROUND
//                               churches are masked client-side — SEC Obs D)
//   link_url present          → LinkCard (external resource, no comments)
//   else                      → AnnouncementCard (letterhead)
//
// AC coverage retained from KAN-17:
//   #4 ORDER BY published_at DESC · #5 Posted-only predicate (+ FE mirror)
//   #6 mount + pull-to-refresh · #7 empty state · #8 cursor pagination 20/pg
//   #9 no realtime · #14 read-failure retry · #15 scroll preserved
//   #[age] FEED_MAX_AGE_DAYS (7) floor independent of the cursor.
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
  ROLE_DISPLAY,
  deriveArticleStandfirst,
  formatRelativeTime,
  isPosted,
  resolveDisplayName,
  resolveEyebrowTag,
  type AnnouncementRow,
} from './NetworkFeedLogic';

// Column projection. The redesign adds link_url / author_type /
// comment_count / author_id. author_id is selected ONLY to resolve
// leader-card attribution via a secondary lookup — it is NEVER rendered
// and NEVER reaches a display component (D-56 / SEC Observation D).
//
// KAN-335 badge cutover: `badge` (none | new | urgent) is the new
// eyebrow-register authority; `tag_type` is retained as the shadow — it
// stays projected here until a later migration drops it, once the app
// floor version moves past clients that still read tag_type.
// resolveEyebrowTag prefers badge and falls back to tag_type.
const SELECT_COLS =
  'id, title, body, published_at, is_active, source_label, tag_type, badge, link_url, author_type, comment_count, author_id, card_type';

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
      keyExtractor={keyExtractor}
      renderItem={renderItem}
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

function keyExtractor(row: AnnouncementRow): string {
  return row.id;
}

function renderItem({ item }: { item: AnnouncementRow }) {
  return <FeedItem item={item} />;
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
          kicker={item.card_type === 'long_read' ? 'Long read' : undefined}
          title={item.title}
          standfirst={standfirst}
          body={body}
          // readTimeMin is not yet a column on announcements;
          // url is sourced from link_url when present.
          url={item.link_url ?? undefined}
          time={time}
          commentCount={item.comment_count}
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
    />
  );
}

type ResolvedAuthor = {
  initial: string;
  name: string;
  church: string;
};

// Masked author — the safe default for unresolved / error / loading state.
const MASKED_AUTHOR: ResolvedAuthor = { initial: '·', name: MASKED_NAME, church: '' };

// Resolve the "A fellow {role}" label used for anon and underground authors.
// Role display values are title-case ("Minister") — lowercase for this phrase.
function resolveAnonLabel(role: string | null): string {
  const display = role ? (ROLE_DISPLAY[role] ?? 'leader') : 'leader';
  return 'A fellow ' + display.toLowerCase();
}

// Shared leader-author resolver. Resolves full_name + role + church via
// author_id (matched against public.users.id — author_id references the
// public.users PK, NOT auth_id; verified live 2026-06-02). Masking is the
// safe default: a missing author_id, an unresolved row, a church-less
// leader, or any error all leave the author masked.
//
// Decoupled 2026-06-21 — two independent axes:
//
//   1. users.anonymous = true → mask the LEADER's name to "A fellow {role}"
//      with initial "A". Church name STAYS REAL (per anon-identity rules:
//      public anon hides the person, not the church).
//
//   2. churches.type='underground' + show_church_name=false → mask the
//      CHURCH's identity. Church display drops to '' (no name, no city,
//      no country). Brave underground (show_church_name=true) discloses
//      the real church name. Leader name is NOT masked by underground
//      church status — that's the anonymous flag's job.
//
// Both axes can be true (underground + anon), neither (public + named),
// or either independently.
function useResolvedLeaderAuthor(authorId: string | null): ResolvedAuthor {
  const [author, setAuthor] = useState<ResolvedAuthor>(MASKED_AUTHOR);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authorId) return; // stays masked
      try {
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('first_name, middle_name, last_name, honorific, last_name_first, church_id, role, anonymous, display_name_preference')
          .eq('id', authorId)
          .maybeSingle();
        if (cancelled || userErr || !userRow) return;

        const firstName = ((userRow as any).first_name as string | null) ?? '';
        const middleName = ((userRow as any).middle_name as string | null) ?? '';
        const lastName = ((userRow as any).last_name as string | null) ?? '';
        const honorific = ((userRow as any).honorific as string | null) ?? null;
        const lastNameFirst = !!(userRow as any).last_name_first;
        const role = (userRow.role as string | null) ?? null;
        const churchId = userRow.church_id as string | null;
        const isAnon = !!userRow.anonymous;
        const displayNamePref = (userRow as any).display_name_preference as
          | 'first_name_only'
          | 'full_name'
          | null;

        if (!churchId) return; // no church → stay masked

        const { data: churchRow, error: churchErr } = await supabase
          .from('churches')
          .select('name, type, show_church_name')
          .eq('id', churchId)
          .maybeSingle();
        if (cancelled || churchErr || !churchRow) return;

        // Resolve church display first (church-side axis, independent of leader).
        // Underground + safe → masked to ''. Underground + brave or non-underground
        // → real name. TODO: macro_region_label fallback for safe underground.
        const isUnderground = churchRow.type === 'underground';
        const isBraveUnderground =
          isUnderground && churchRow.show_church_name === true;
        const churchDisplay =
          !isUnderground || isBraveUnderground
            ? ((churchRow.name as string | null) ?? '')
            : '';

        // Resolve leader display (leader-side axis, independent of church).
        if (isAnon) {
          // Anonymous: name held regardless of church type. Initial "A".
          if (!cancelled) {
            setAuthor({
              initial: 'A',
              name: resolveAnonLabel(role),
              church: churchDisplay,
            });
          }
          return;
        }

        // Not anonymous — leader chose to be known by name, even if their
        // church is underground. Show the real name + initial.
        if (!cancelled) {
          setAuthor({
            initial: firstName ? firstName.charAt(0).toUpperCase() : '·',
            name: resolveDisplayName({
              firstName: firstName || null,
              middleName,
              lastName: lastName || null,
              honorific,
              role,
              displayNamePreference: displayNamePref ?? null,
              lastNameFirst,
            }),
            church: churchDisplay,
          });
        }
      } catch {
        // Stay masked on any failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  return author;
}

function LeaderFeedItem({ item, time }: { item: AnnouncementRow; time: string }) {
  const author = useResolvedLeaderAuthor(item.author_id);

  return (
    <LeaderWordCard
      announcementId={item.id}
      lead={item.title}
      body={item.body}
      author={{ ...author, time }}
      commentCount={item.comment_count}
    />
  );
}

// Encouragement card wrapper — same author-resolution pattern as
// LeaderFeedItem (underground masking, role humanisation). The card body
// is the announcement title (the short reflective line); source_label
// carries the verse anchor when set.
function EncouragementFeedItem({ item, time }: { item: AnnouncementRow; time: string }) {
  const author = useResolvedLeaderAuthor(item.author_id);

  return (
    <EncouragementCard
      announcementId={item.id}
      lead={item.title}
      verse={item.source_label ?? undefined}
      time={time}
      author={author}
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
