// ─────────────────────────────────────────────
// WallFeedView — Prayer Wall rebuild · View 1 (Feed)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md §View 1.
//
// Structural moves owned here:
//   - Expand in place, never navigate away (no detail sheet; README
//     move #1). One expanded row at a time; the host owns expandedId.
//   - First-sentence preview via sentencePreview (README move #2).
//   - Intercede lives inside the expanded body; optimistic flip +
//     rollback is owned by the host (PrayerWallScreen) so row state
//     survives collapse.
//
// Count row (Founder 2026-07-24): live presence ("Interceding now")
// was dropped as un-computable-honestly. The slot now reads
// INTERCESSIONS THIS WEEK — a trailing-7-day count of stand_in_the_gap
// events (get_wall_weekly_intercessions, defensive: renders "—" until
// the RPC exists/answers, 0 only when the server says 0).
//
// Gate posture (README "Gated state"): unverified leaders read
// everything; the Intercede button is replaced by the unlock notice.
// Prayer is never gated, only the feature — copy is verbatim.
// ─────────────────────────────────────────────

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import {
  getLeaderLine,
  getLocationLine,
  formatRelativeTime,
  type PrayerRow,
} from './PrayerWallLogic';
import { sentencePreview, type WallShow, type WallSort } from './wallNewLogic';
import {
  BreathingDot,
  GapMark,
  StaggerRow,
  UrgentLabel,
  WallEmpty,
  WallScriptureFooter,
} from './WallPrimitives';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EPH_6_18 =
  'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance.';
const EPH_6_18_REF = 'EPHESIANS 6:18 · KJV';

const SORT_LABELS: Record<WallSort, string> = {
  newest: 'Newest first',
  most: 'Most interceding',
  urgent: 'Urgent first',
};

export type FeedLoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

interface Props {
  rows: PrayerRow[];
  loadState: FeedLoadState;
  weeklyCount: number | null; // null → "—" (RPC unavailable), README: 0 must render as 0
  sort: WallSort;
  show: WallShow;
  filterOpen: boolean;
  expandedId: string | null;
  animTick: number;
  isVerified: boolean;
  onToggleFilter: () => void;
  onSort: (s: WallSort) => void;
  onShow: (s: WallShow) => void;
  onExpand: (id: string | null) => void;
  onIntercede: (row: PrayerRow) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export default function WallFeedView(props: Props) {
  const {
    rows, loadState, weeklyCount, sort, show, filterOpen, expandedId, animTick,
    isVerified, onToggleFilter, onSort, onShow, onExpand, onIntercede,
    onRefresh, onLoadMore, onRetry,
  } = props;

  const listRef = useRef<FlatList<PrayerRow>>(null);
  const empty = rows.length === 0 && loadState !== 'initial' && loadState !== 'error';

  const header = (
    <View>
      <View style={s.intro}>
        {/* Welcome line — hidden when the feed is empty so it can never
            contradict a zero count (README). */}
        {!empty ? (
          <Text style={s.welcome}>The body is already praying. Add your voice.</Text>
        ) : null}

        <View style={s.countRow}>
          <BreathingDot />
          <Text style={s.countLabel}>INTERCESSIONS THIS WEEK</Text>
          <Text style={s.countValue}>
            {weeklyCount === null ? '—' : weeklyCount.toLocaleString('en-US')}
          </Text>
          <Pressable
            onPress={onToggleFilter}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel={filterOpen ? 'Close filters' : 'Open filters'}
            style={s.filterMark}
          >
            <View style={[s.fBar, { width: 13 }, filterOpen && s.fBarOn]} />
            <View style={[s.fBar, { width: 9 }, filterOpen && s.fBarOn]} />
            <View style={[s.fBar, { width: 5 }, filterOpen && s.fBarOn]} />
          </Pressable>
        </View>

        <Text style={s.metaLine}>
          {SORT_LABELS[sort].toUpperCase()} · {show === 'urgent' ? 'URGENT ONLY' : 'PULL TO REFRESH'}
        </Text>

        {filterOpen ? (
          <FilterPanel sort={sort} show={show} onSort={onSort} onShow={onShow} />
        ) : null}
      </View>
    </View>
  );

  if (loadState === 'error') {
    return (
      <View style={s.stateWrap}>
        <Text style={s.errorCopy}>Couldn't load the wall right now.</Text>
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={s.retry}>TAP TO RETRY</Text>
        </Pressable>
      </View>
    );
  }

  if (loadState === 'initial') {
    return (
      <View style={s.stateWrap}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      // README row stagger: remount rows on animTick so the fade+rise
      // re-triggers on tab switch / refresh / filter change.
      keyExtractor={(r) => `${r.id}-${animTick}`}
      renderItem={({ item, index }) => (
        <StaggerRow index={index}>
          <RequestRow
            row={item}
            expanded={expandedId === item.id}
            isVerified={isVerified}
            onToggle={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
              );
              onExpand(expandedId === item.id ? null : item.id);
            }}
            onIntercede={() => onIntercede(item)}
          />
        </StaggerRow>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        show === 'urgent' ? (
          <WallEmpty
            heading="Nothing urgent right now."
            body="That is its own kind of mercy."
            italic
            actionLabel="Show all requests"
            onAction={() => onShow('all')}
          />
        ) : (
          <WallEmpty
            heading="The wall is quiet."
            body="No requests have been lifted yet. Yours can be the first the body carries."
          />
        )
      }
      ListFooterComponent={
        loadState === 'paging' ? (
          <View style={s.footSpinner}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : rows.length > 0 ? (
          <WallScriptureFooter text={EPH_6_18} reference={EPH_6_18_REF} />
        ) : null
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={loadState === 'refreshing'} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
      contentContainerStyle={s.listContent}
    />
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────

function FilterPanel({
  sort, show, onSort, onShow,
}: { sort: WallSort; show: WallShow; onSort: (s: WallSort) => void; onShow: (s: WallShow) => void }) {
  // 250ms fade/slide-in on mount (README).
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.ease, useNativeDriver: true }).start();
  }, [anim]);

  const option = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={8}
    >
      <Text style={[s.fpOption, selected && s.fpOptionOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <Animated.View
      style={[
        s.fpPanel,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] },
      ]}
    >
      <Text style={s.fpLabel}>SORT</Text>
      <View style={s.fpRow}>
        {option('Newest first', sort === 'newest', () => onSort('newest'))}
        {option('Most interceding', sort === 'most', () => onSort('most'))}
        {option('Urgent first', sort === 'urgent', () => onSort('urgent'))}
      </View>
      <Text style={[s.fpLabel, { marginTop: 14 }]}>SHOW</Text>
      <View style={s.fpRow}>
        {option('All requests', show === 'all', () => onShow('all'))}
        {option('Urgent only', show === 'urgent', () => onShow('urgent'))}
      </View>
    </Animated.View>
  );
}

// ─── Request row ──────────────────────────────────────────────────────

function RequestRow({
  row, expanded, isVerified, onToggle, onIntercede,
}: {
  row: PrayerRow;
  expanded: boolean;
  isVerified: boolean;
  onToggle: () => void;
  onIntercede: () => void;
}) {
  const { preview } = sentencePreview(row.prayer_text);
  const location = getLocationLine(row.church_name, row.country).toUpperCase();
  const posted = `Posted ${formatRelativeTime(row.created_at)}`;

  return (
    <View style={s.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Fold this request' : 'Open this request'}
      >
        <View style={s.eyebrow}>
          <View style={[s.stateDot, { backgroundColor: row.urgency ? Colors.red : Colors.accent }]} />
          <Text style={s.location} numberOfLines={1}>
            {location}
          </Text>
          {row.urgency ? <UrgentLabel /> : !expanded ? <Text style={s.tapOpen}>Tap to open</Text> : null}
        </View>

        {!expanded ? (
          <>
            <View style={s.previewRow}>
              {row.urgency ? <View style={s.urgentRule} /> : null}
              <Text style={s.preview}>{preview}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                {posted}
              </Text>
              <Text style={s.metaRight} numberOfLines={1}>
                {row.prayed_count} interceding
              </Text>
            </View>
          </>
        ) : (
          <View>
            <Text style={s.leaderLine}>{getLeaderLine(row.leader_display_name, row.leader_role)}</Text>
            <View style={s.previewRow}>
              {row.urgency ? <View style={s.urgentRule} /> : null}
              <Text style={s.fullText}>{row.prayer_text}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                {posted}
                {row.category ? ` · ${row.category}` : ''}
              </Text>
              <Text style={s.fold}>FOLD</Text>
            </View>
          </View>
        )}
      </Pressable>

      {expanded ? (
        <View style={s.actionRow}>
          {isVerified ? (
            <>
              <Pressable
                onPress={onIntercede}
                accessibilityRole="button"
                accessibilityLabel={`${row.i_prayed ? 'Standing in the gap' : 'Intercede'} — ${row.prayed_count} interceding`}
                style={[s.intercedeBtn, row.i_prayed && s.intercedeBtnOn]}
              >
                <GapMark active={row.i_prayed} />
                <Text style={s.intercedeLabel} numberOfLines={1}>
                  {row.i_prayed ? 'STANDING IN THE GAP' : 'INTERCEDE'}
                </Text>
              </Pressable>
              <Text style={s.actionCount} numberOfLines={1}>
                {row.prayed_count} interceding
              </Text>
            </>
          ) : (
            <>
              {/* Copy principle: prayer is never gated, only the feature. */}
              <Text style={s.gateNotice}>UNLOCKS ONCE YOUR CHURCH IS VERIFIED</Text>
              <Text style={s.actionCount} numberOfLines={1}>
                {row.prayed_count} interceding
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  intro: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  welcome: {
    fontFamily: Typography.scriptureLight,
    fontSize: 19,
    lineHeight: 27.5,
    color: '#E6E1D5',
    marginBottom: 16,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.50)',
  },
  countValue: {
    marginLeft: 'auto',
    fontFamily: Typography.displayMedium,
    fontSize: 21,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  filterMark: { gap: 2.5, alignItems: 'flex-end', marginLeft: 14 },
  fBar: { height: 1, backgroundColor: 'rgba(240,237,230,0.42)' },
  fBarOn: { backgroundColor: Colors.accent },
  metaLine: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.30)',
  },

  fpPanel: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.borderAccentSubtle,
    borderRadius: 8,
    padding: 14,
  },
  fpLabel: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.35)',
    marginBottom: 8,
  },
  fpRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  fpOption: { fontFamily: Typography.body, fontSize: 12.5, color: 'rgba(240,237,230,0.42)' },
  fpOptionOn: { color: Colors.accent },

  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderAccentSubtle,
    paddingTop: 19,
    paddingHorizontal: 22,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stateDot: { width: 5, height: 5, borderRadius: 3 },
  location: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.50)',
    flexShrink: 1,
  },
  tapOpen: { marginLeft: 'auto', fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.30)' },

  previewRow: { flexDirection: 'row', gap: 11, marginTop: 10 },
  urgentRule: { width: 1.5, borderRadius: 1, backgroundColor: 'rgba(224,85,85,0.5)', alignSelf: 'stretch' },
  preview: { flex: 1, fontFamily: Typography.displayRegular, fontSize: 18, lineHeight: 27, color: Colors.text },
  fullText: { flex: 1, fontFamily: Typography.displayRegular, fontSize: 19, lineHeight: 29.5, color: Colors.text },
  leaderLine: { marginTop: 10, fontFamily: Typography.bodyMedium, fontSize: 12, color: 'rgba(240,237,230,0.60)' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 11,
    marginBottom: 19,
    gap: 12,
  },
  metaLeft: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.38)' },
  metaRight: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.45)' },
  fold: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.40)',
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: -1, marginBottom: 19 },
  intercedeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  intercedeBtnOn: { backgroundColor: 'rgba(107,181,232,0.07)', borderColor: 'rgba(107,181,232,0.50)' },
  intercedeLabel: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.7, color: Colors.text },
  actionCount: { marginLeft: 'auto', fontFamily: Typography.body, fontSize: 11.5, color: 'rgba(240,237,230,0.45)' },
  gateNotice: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.32)',
  },

  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errorCopy: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  retry: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.5, color: Colors.accent },
  footSpinner: { paddingVertical: 16, alignItems: 'center' },
  listContent: { paddingBottom: 8 },
});
