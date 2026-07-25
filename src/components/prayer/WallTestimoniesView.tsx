// ─────────────────────────────────────────────
// WallTestimoniesView — Prayer Wall rebuild · View 2 (Testimonies)
// Spec: docs/design_handoff_prayer_wall_NEW/README.md §View 2.
//
// Identical skeleton to Feed by design ("Feed and Testimonies are the
// same skeleton" — README structural move #3). Differences only:
//   - State dot + count dot are off-white #E6E1D5. GREEN IS NOT USED
//     ON THIS TAB (README colour rule — earlier iterations used green
//     for testimonies; it read as childish).
//   - Testimony body is ROMAN, not italic (was italic; cut in review).
//   - Action is Rejoice (echo rings), not Intercede.
//   - Expanded testimonies that came from a request render the
//     embedded pair: THE REQUEST (muted past) → THE ANSWER (bright
//     present). Request and answer separate by brightness, not hue.
//     The "{n} stood in the gap" line under the request is spec'd but
//     get_testimonies does not yet return the original prayed_count —
//     parked as a BE follow-up; the line is omitted until then.
//
// Count row: ANSWERED THIS MONTH — calendar-month count derived
// client-side (answeredThisMonth); reads 0, never hides.
// ─────────────────────────────────────────────

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import {
  formatRelativeTime,
  getLeaderLine,
  getLocationLine,
  type TestimonyRow,
} from './PrayerWallLogic';
import { answeredThisMonth, sentencePreview } from './wallNewLogic';
import { RejoiceMark, StaggerRow, WallEmpty, WallScriptureFooter } from './WallPrimitives';

const REV_12_11 =
  'And they overcame him by the blood of the Lamb, and by the word of their testimony.';
const REV_12_11_REF = 'REVELATION 12:11 · KJV';

const OFF_WHITE = '#E6E1D5';

export type TestimonyLoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

interface Props {
  rows: TestimonyRow[];
  loadState: TestimonyLoadState;
  expandedId: string | null;
  animTick: number;
  isVerified: boolean;
  onExpand: (id: string | null) => void;
  onRejoice: (row: TestimonyRow) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export default function WallTestimoniesView(props: Props) {
  const {
    rows, loadState, expandedId, animTick, isVerified,
    onExpand, onRejoice, onRefresh, onLoadMore, onRetry,
  } = props;

  const monthCount = answeredThisMonth(rows);

  const header = (
    <View style={s.intro}>
      <Text style={s.welcome}>See what God has been doing — and share your own.</Text>
      <View style={s.countRow}>
        <View style={s.countDot} />
        <Text style={s.countLabel}>ANSWERED THIS MONTH</Text>
        <Text style={s.countValue}>{monthCount.toLocaleString('en-US')}</Text>
      </View>
      <Text style={s.metaLine}>NEWEST FIRST · PULL TO REFRESH</Text>
    </View>
  );

  if (loadState === 'error') {
    return (
      <View style={s.stateWrap}>
        <Text style={s.errorCopy}>Couldn't load testimonies right now.</Text>
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
      data={rows}
      keyExtractor={(r) => `${r.id}-${animTick}`}
      renderItem={({ item, index }) => (
        <StaggerRow index={index}>
          <TestimonyRowView
            row={item}
            expanded={expandedId === item.id}
            isVerified={isVerified}
            onToggle={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
              );
              onExpand(expandedId === item.id ? null : item.id);
            }}
            onRejoice={() => onRejoice(item)}
          />
        </StaggerRow>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <WallEmpty
          heading="No testimonies yet."
          body="When a prayer is answered, mark it in My Prayers — it will be told here, and the body will rejoice with you."
        />
      }
      ListFooterComponent={
        loadState === 'paging' ? (
          <View style={s.footSpinner}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : rows.length > 0 ? (
          <WallScriptureFooter text={REV_12_11} reference={REV_12_11_REF} />
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

// ─── Testimony row ────────────────────────────────────────────────────

function TestimonyRowView({
  row, expanded, isVerified, onToggle, onRejoice,
}: {
  row: TestimonyRow;
  expanded: boolean;
  isVerified: boolean;
  onToggle: () => void;
  onRejoice: () => void;
}) {
  const { preview } = sentencePreview(row.testimony_text);
  const location = getLocationLine(row.church_name, row.country).toUpperCase();
  const fromRequest = row.original_request_id !== null;

  return (
    <View style={s.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Fold this testimony' : 'Open this testimony'}
      >
        <View style={s.eyebrow}>
          <View style={s.stateDot} />
          <Text style={s.location} numberOfLines={1}>
            {location}
          </Text>
          {fromRequest ? <Text style={s.answeredTag}>ANSWERED REQUEST</Text> : null}
        </View>

        {!expanded ? (
          <>
            <Text style={s.preview}>{preview}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                {formatRelativeTime(row.created_at)}
              </Text>
              <Text style={s.metaRight} numberOfLines={1}>
                {row.celebrated_count} rejoicing
              </Text>
            </View>
          </>
        ) : (
          <View>
            <Text style={s.leaderLine}>{getLeaderLine(row.leader_display_name, row.leader_role)}</Text>

            {/* The embedded pair — the request in muted past, the answer
                at full brightness. Separation by brightness, not hue. */}
            {fromRequest && row.original_text ? (
              <View style={s.pairBlock}>
                {/* Spec wants "THE REQUEST · {reqWhen}" — the original
                    request's date is not on the get_testimonies wire yet
                    (parked BE follow-up with original prayed_count).
                    Until then the label stands alone; never reuse the
                    testimony's own date here. */}
                <Text style={s.pairLabelDim}>THE REQUEST</Text>
                <Text style={s.pairRequest}>{row.original_text}</Text>
              </View>
            ) : null}

            {fromRequest ? <Text style={s.pairLabelBright}>THE ANSWER</Text> : null}
            <Text style={s.fullText}>{row.testimony_text}</Text>

            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                {formatRelativeTime(row.created_at)}
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
                onPress={onRejoice}
                accessibilityRole="button"
                accessibilityLabel={`${row.i_celebrated ? 'Rejoicing' : 'Rejoice'} — ${row.celebrated_count} rejoicing`}
                style={[s.rejoiceBtn, row.i_celebrated && s.rejoiceBtnOn]}
              >
                <RejoiceMark active={row.i_celebrated} />
                <Text style={s.rejoiceLabel} numberOfLines={1}>
                  {row.i_celebrated ? 'REJOICING' : 'REJOICE'}
                </Text>
              </Pressable>
              <Text style={s.actionCount} numberOfLines={1}>
                {row.celebrated_count} rejoicing
              </Text>
            </>
          ) : (
            <>
              <Text style={s.gateNotice}>UNLOCKS ONCE YOUR CHURCH IS VERIFIED</Text>
              <Text style={s.actionCount} numberOfLines={1}>
                {row.celebrated_count} rejoicing
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
    color: OFF_WHITE,
    marginBottom: 16,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: OFF_WHITE, opacity: 0.85 },
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
  metaLine: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.30)',
  },

  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderAccentSubtle,
    paddingTop: 19,
    paddingHorizontal: 22,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: OFF_WHITE, opacity: 0.85 },
  location: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.50)',
    flexShrink: 1,
  },
  answeredTag: {
    marginLeft: 'auto',
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.42)',
  },

  // Roman, same scale as prayers (README: testimony body is NOT italic).
  preview: { marginTop: 10, fontFamily: Typography.displayRegular, fontSize: 18, lineHeight: 27, color: Colors.text },
  fullText: { marginTop: 8, fontFamily: Typography.displayRegular, fontSize: 19, lineHeight: 29.5, color: Colors.text },
  leaderLine: { marginTop: 10, fontFamily: Typography.bodyMedium, fontSize: 12, color: 'rgba(240,237,230,0.60)' },

  pairBlock: {
    marginTop: 14,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(240,237,230,0.16)',
    paddingLeft: 13,
  },
  pairLabelDim: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.38)',
  },
  pairRequest: {
    marginTop: 7,
    fontFamily: Typography.displayRegular,
    fontSize: 16,
    lineHeight: 24.8,
    color: 'rgba(240,237,230,0.55)',
  },
  pairLabelBright: {
    marginTop: 20,
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: 'rgba(240,237,230,0.70)',
  },

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
  rejoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  rejoiceBtnOn: { backgroundColor: 'rgba(107,181,232,0.07)', borderColor: 'rgba(107,181,232,0.50)' },
  rejoiceLabel: { fontFamily: Typography.mono, fontSize: 9.5, letterSpacing: 1.7, color: Colors.text },
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
