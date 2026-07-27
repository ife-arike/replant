// ─────────────────────────────────────────────
// HeartcriesView — Persecuted refinement View 1
// (design_handoff_persecuted_NEW/README.md — the README wins over the
// .dc.html mock.)
//
// Threshold preamble (A HELD SPACE) → share card (the security line
// lives HERE, beside the act of sharing — removed from the header) →
// filter row whose label doubles as the section heading → hairline
// heartcry rows that expand in place → Heb 13:3 footer.
//
// The red system on this view:
//   - tier dot: filled Colors.red for critical/urgent, hollow redRing
//     otherwise; tier word right-aligned in tierTint; only critical
//     pulses (2600ms, frozen under reduced motion)
//   - margin rule left of the preview, filled tiers only
//   - the share CTA is one of the app's two deliberate interactive
//     reds — outlined, never filled
// Everything else interactive is sky.
//
// Founder ruling 2026-07-26: anonymisation stays CONTINENT — the
// byline reads A VOICE · {CONTINENT}, the security row promises
// CONTINENT ONLY, and the filter is continents present in the feed.
//
// Rows are hoisted at the host (optimistic hold survives view
// switches — same posture as PrayerWallScreen v7 Fix 09).
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import { useReducedMotion } from '../../../utils/useReducedMotion';
import { formatRelativeTime } from '../../../components/prayer/PrayerWallLogic';
import { sentencePreview } from '../../../components/prayer/wallNewLogic';
import { StaggerRow, WallEmpty, WallScriptureFooter } from '../../../components/prayer/WallPrimitives';
import {
  ALL_CONTINENTS,
  continentOptions,
  feedSectionLabel,
  isFilledTier,
  pulsesTier,
  tierTint,
  tierWord,
  type HeartcryRow,
} from './persecutedNewLogic';

const HEB_13_3 =
  'Remember them that are in bonds, as bound with them; and them which suffer adversity, as being yourselves also in the body.';
const HEB_13_3_REF = 'HEBREWS 13:3 · KJV';

export type HeartcryLoadState = 'initial' | 'refreshing' | 'paging' | 'idle' | 'error';

interface Props {
  rows: HeartcryRow[];
  loadState: HeartcryLoadState;
  expandedId: string | null;
  continent: string;
  filterOpen: boolean;
  animTick: number;
  onExpand: (id: string | null) => void;
  onHold: (row: HeartcryRow) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onToggleFilter: () => void;
  onSelectContinent: (c: string) => void;
  onShare: () => void;
}

export default function HeartcriesView({
  rows, loadState, expandedId, continent, filterOpen, animTick,
  onExpand, onHold, onRefresh, onRetry, onToggleFilter, onSelectContinent, onShare,
}: Props) {
  const filtered = continent === ALL_CONTINENTS
    ? rows
    : rows.filter((r) => r.continent === continent);
  const empty = filtered.length === 0 && loadState !== 'initial' && loadState !== 'error';

  const header = (
    <View>
      {/* Threshold preamble — A HELD SPACE (was red; now muted). */}
      <View style={s.preamble}>
        <Text style={s.preambleEyebrow}>A HELD SPACE</Text>
        <Text style={s.preambleBody}>
          For churches under threat, imprisonment, prohibition of fellowship, violence, and
          active hunting for the faith.
        </Text>
      </View>

      {/* Share card — the security line lives beside the act of sharing. */}
      <View style={s.shareCard}>
        <Text style={s.sharePrompt}>Are you suffering persecution for the name of Jesus?</Text>
        <Text style={s.shareSub}>
          Heartcries shared to Replant are encrypted and your identity is held. This is a safe
          space for your voice.
        </Text>
        <View style={s.securityRow}>
          <LockGlyph />
          <Text style={s.securityText}>ENCRYPTED · ANONYMOUS · CONTINENT ONLY</Text>
        </View>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share my heartcry"
          style={({ pressed }) => [s.shareCta, pressed && { opacity: 0.75 }]}
        >
          <Text style={s.shareCtaLabel}>SHARE MY HEARTCRY</Text>
        </Pressable>
      </View>

      {/* Filter row — label doubles as the section heading. */}
      <View style={s.filterRow}>
        <Text style={s.filterLabel}>{feedSectionLabel(continent).toUpperCase()}</Text>
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
      <Text style={s.metaLine}>NEWEST FIRST · PULL TO REFRESH</Text>

      {filterOpen ? (
        <FilterPanel
          options={continentOptions(rows)}
          selected={continent}
          onSelect={onSelectContinent}
        />
      ) : null}
    </View>
  );

  if (loadState === 'error') {
    return (
      <View style={s.root}>
        {header}
        <View style={s.stateWrap}>
          <Text style={s.errorCopy}>Couldn't load heartcries right now.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={s.retry}>TAP TO RETRY</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loadState === 'initial') {
    return (
      <View style={s.root}>
        {header}
        <View style={s.stateWrap}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(r) => `${r.id}-${animTick}`}
      renderItem={({ item, index }) => (
        <StaggerRow index={index}>
          <HeartcryRowView
            row={item}
            expanded={expandedId === item.id}
            onToggle={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
              );
              onExpand(expandedId === item.id ? null : item.id);
            }}
            onHold={() => onHold(item)}
          />
        </StaggerRow>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        continent !== ALL_CONTINENTS ? (
          <WallEmpty
            heading={`Nothing from ${continent}.`}
            body="No one there has written to us. The body is praying for that church regardless."
            actionLabel="All continents"
            onAction={() => onSelectContinent(ALL_CONTINENTS)}
          />
        ) : (
          <WallEmpty
            heading="Quiet here, for now."
            body="This space is held in prayer until someone speaks. If you are experiencing any form of persecution, you can share here."
          />
        )
      }
      ListFooterComponent={
        loadState === 'paging' ? (
          <View style={s.footSpinner}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : !empty ? (
          <WallScriptureFooter eyebrow="PRAY WITH US" text={HEB_13_3} reference={HEB_13_3_REF} />
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={loadState === 'refreshing'} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
      contentContainerStyle={s.listContent}
    />
  );
}

// ─── Lock glyph — drawn, never an emoji ───────────────────────────────

function LockGlyph() {
  return (
    <View style={s.lockWrap}>
      <View style={s.lockShackle} />
      <View style={s.lockBody} />
    </View>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────

function FilterPanel({
  options, selected, onSelect,
}: { options: string[]; selected: string; onSelect: (c: string) => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.ease, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        s.panel,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] },
      ]}
    >
      <Text style={s.panelLabel}>CONTINENT</Text>
      <View style={s.panelOptions}>
        {options.map((c) => {
          const active = selected === c;
          const label = c === ALL_CONTINENTS ? 'All continents' : c;
          return (
            <Pressable
              key={c}
              onPress={() => onSelect(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              hitSlop={6}
            >
              <Text style={[s.panelOption, active && s.panelOptionOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Critical pulse — the only animated red on the tab ────────────────

function TierWordText({ severity }: { severity: string }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const shouldPulse = pulsesTier(severity) && !reduced;

  useEffect(() => {
    if (!shouldPulse) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shouldPulse, pulse]);

  return (
    <Animated.Text style={[s.tierWord, { color: tierTint(severity), opacity: pulse }]} numberOfLines={1}>
      {tierWord(severity).toUpperCase()}
    </Animated.Text>
  );
}

// ─── Heartcry row ─────────────────────────────────────────────────────

function HeartcryRowView({
  row, expanded, onToggle, onHold,
}: {
  row: HeartcryRow;
  expanded: boolean;
  onToggle: () => void;
  onHold: () => void;
}) {
  const text = row.feed_content ?? '';
  const { preview } = sentencePreview(text);
  const filled = isFilledTier(row.severity);
  const byline = `A VOICE · ${(row.continent ?? 'THE BODY').toUpperCase()}`;

  return (
    <View style={s.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Fold this heartcry' : 'Open this heartcry'}
      >
        <View style={s.eyebrow}>
          <View style={[s.tierDot, filled ? s.tierDotFilled : s.tierDotHollow]} />
          <Text style={s.byline} numberOfLines={1}>
            {byline}
          </Text>
          <TierWordText severity={row.severity} />
        </View>

        {!expanded ? (
          <>
            <View style={s.previewRow}>
              {filled ? <View style={s.marginRule} /> : null}
              <Text style={s.preview}>{preview}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                Shared {formatRelativeTime(row.created_at)}
              </Text>
              <Text style={s.metaRight} numberOfLines={1}>
                {row.hold_count} praying
              </Text>
            </View>
          </>
        ) : (
          <View style={s.expandedWrap}>
            <View style={s.previewRow}>
              {filled ? <View style={s.marginRule} /> : null}
              <Text style={s.fullText}>{text}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLeft} numberOfLines={1}>
                Shared {formatRelativeTime(row.created_at)}
              </Text>
              <Text style={s.fold}>FOLD</Text>
            </View>
            <View style={s.actionRow}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onHold();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${row.viewer_held ? 'Keep holding' : 'Hold in prayer'} — ${row.hold_count} praying`}
                style={[s.holdBtn, row.viewer_held && s.holdBtnOn]}
              >
                <Text style={s.holdLabel} numberOfLines={1}>
                  {row.viewer_held ? 'KEEP HOLDING' : '+ HOLD IN PRAYER'}
                </Text>
              </Pressable>
              <Text style={s.actionCount} numberOfLines={1}>
                {row.hold_count} praying
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingBottom: 8 },

  preamble: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  preambleEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  preambleBody: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 28,
    color: '#E6E1D5',
    marginTop: 12,
  },

  shareCard: {
    marginHorizontal: 22,
    marginTop: 22,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  sharePrompt: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: 0.2,
    color: Colors.text,
    textAlign: 'center',
  },
  shareSub: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 20,
    color: 'rgba(240,237,230,0.45)',
    textAlign: 'center',
    marginTop: 10,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  securityText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.38)',
    textTransform: 'uppercase',
  },
  lockWrap: { width: 8, height: 10, alignItems: 'center' },
  lockShackle: {
    width: 6,
    height: 5,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(240,237,230,0.38)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  lockBody: {
    width: 8,
    height: 6,
    borderWidth: 1,
    borderColor: 'rgba(240,237,230,0.38)',
    borderRadius: 1.5,
    marginTop: -1,
  },
  // One of the app's two deliberate interactive reds — outlined, never filled.
  shareCta: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  shareCtaLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: Colors.red,
    textTransform: 'uppercase',
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 22,
  },
  filterLabel: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(240,237,230,0.50)',
    textTransform: 'uppercase',
  },
  filterMark: { alignItems: 'flex-end', gap: 2.5 },
  fBar: { height: 1, backgroundColor: 'rgba(240,237,230,0.42)' },
  fBarOn: { backgroundColor: Colors.accent },
  metaLine: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.30)',
    textTransform: 'uppercase',
    marginTop: 9,
    paddingHorizontal: 22,
  },

  panel: {
    marginHorizontal: 22,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(107,181,232,0.18)',
    borderRadius: 8,
    padding: 14,
  },
  panelLabel: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.8,
    color: 'rgba(240,237,230,0.35)',
    textTransform: 'uppercase',
  },
  panelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  panelOption: { fontFamily: Typography.body, fontSize: 12.5, color: 'rgba(240,237,230,0.42)' },
  panelOptionOn: { color: Colors.accent },

  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderRowSubtle,
    paddingTop: 19,
    paddingHorizontal: 22,
    marginTop: 0,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tierDot: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  tierDotFilled: { backgroundColor: Colors.red },
  tierDotHollow: { borderWidth: 1, borderColor: Colors.redRing, backgroundColor: 'transparent' },
  byline: {
    flex: 1,
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: 'rgba(240,237,230,0.50)',
    textTransform: 'uppercase',
  },
  tierWord: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    flexShrink: 0,
  },

  previewRow: { flexDirection: 'row', gap: 11, marginTop: 9 },
  marginRule: {
    width: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(224,85,85,0.5)',
    alignSelf: 'stretch',
  },
  preview: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    lineHeight: 27,
    color: Colors.text,
  },
  fullText: {
    flex: 1,
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    lineHeight: 29.5,
    color: Colors.text,
  },
  expandedWrap: { paddingTop: 1 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 11,
    marginBottom: 19,
  },
  metaLeft: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.38)' },
  metaRight: { fontFamily: Typography.body, fontSize: 10.5, color: 'rgba(240,237,230,0.45)' },
  fold: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: 'rgba(240,237,230,0.40)',
    textTransform: 'uppercase',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: -1,
    marginBottom: 22,
  },
  holdBtn: {
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  holdBtnOn: {
    backgroundColor: 'rgba(107,181,232,0.07)',
    borderColor: 'rgba(107,181,232,0.50)',
  },
  holdLabel: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: Colors.text,
    textTransform: 'uppercase',
  },
  actionCount: {
    marginLeft: 'auto',
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: 'rgba(240,237,230,0.45)',
  },

  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  errorCopy: { fontFamily: Typography.body, fontSize: 13, color: Colors.textMuted },
  retry: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  footSpinner: { paddingVertical: 16, alignItems: 'center' },
});
