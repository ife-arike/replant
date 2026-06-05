// ─────────────────────────────────────────────
// IntercessionJournalView — KAN-23 (Intercession Journal)
//
// A quiet sanctuary-feeling ledger. Two segmented tabs:
//   Churches      — up to 10 churches the leader is currently praying for.
//   Standing in Gap — chronological log of prayer requests stood in for.
//
// Entry points:
//   1. Prayer Wall landing → "Your intercession journal" row
//   2. Auto-navigate after Pray tap on a church profile (first-time, session)
//
// Design tokens match Prayer Wall tab exactly (sky-blue, cream, serif, mono).
// No expo-blur, no expo-linear-gradient, no fontStyle:'italic'.
// Typography.scriptureItalic for: StandingRow prayer text (historical record).
// All other copy is roman.
//
// Swipe-to-remove on ChurchRow: PanResponder-based, 72 px reveal slot,
// matching the ChurchProfileBottomSheet swipe-dismiss pattern.
// ─────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthProvider';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { formatRelativeTime } from './PrayerWallLogic';

// ─── Types ────────────────────────────────────────────────────────────────

type JournalTab = 'churches' | 'standing';

interface HoldRow {
  id: string;
  church_id: string;
  church_name: string;
  city: string | null;
  country: string | null;
  created_at: string;
}

interface StandingRow {
  prayer_request_id: string;
  prayer_text: string;
  church_name: string;
  city: string | null;
  country: string | null;
  prayed_at: string;
  prayed_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const SKY = '#6BB5E8';
const SKY_MID = 'rgba(107,181,232,0.35)';
const SKY_FAINT = 'rgba(107,181,232,0.06)';
const CREAM = '#E6E1D5';
const OFFWHITE = '#F0EDE6';
const MUTED = 'rgba(230,225,213,0.45)';
const FAINT = 'rgba(240,237,230,0.08)';
const SURFACE = Colors.surface;
const REMOVE_SLOT = 72;
const SWIPE_THRESHOLD = 40;
const UNDO_MS = 4000;

const GAL_6_2 = 'Bear ye one another\'s burdens, and so fulfil the law of Christ.';
const GAL_6_2_REF = 'GALATIANS 6:2 · KJV';

// ─── Helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function getLocationLine(city: string | null, country: string | null): string {
  const parts = [city, country].filter(Boolean);
  return parts.join(', ') || 'Location unknown';
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  pendingChurch?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export default function IntercessionJournalView({ onBack, pendingChurch }: Props) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<JournalTab>('churches');
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [standing, setStanding] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  // Store the removed row so undo can re-insert it after optimistic delete.
  const pendingRemoveRow = useRef<HoldRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Segmented pill animation — thumb slides left/right.
  const thumbX = useRef(new Animated.Value(0)).current;

  // ── Data fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [holdsRes, standingRes] = await Promise.all([
        supabase.rpc('get_intercession_holds'),
        supabase.rpc('get_standing_in_gap_history'),
      ]);
      if (cancelled) return;
      setHolds((holdsRes.data ?? []) as HoldRow[]);
      setStanding((standingRes.data ?? []) as StandingRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // ── Tab switch ─────────────────────────────────────────────────────────

  const switchTab = useCallback((tab: JournalTab) => {
    setActiveTab(tab);
    Animated.timing(thumbX, {
      toValue: tab === 'churches' ? 0 : 1,
      duration: 220,
      easing: Easing.bezier(0.3, 0.7, 0.4, 1),
      useNativeDriver: false,
    }).start();
  }, [thumbX]);

  // ── Remove hold ────────────────────────────────────────────────────────

  const startRemove = useCallback((hold: HoldRow) => {
    // Store the row before removing from state so undo can re-insert it.
    pendingRemoveRow.current = hold;
    setPendingRemoveId(hold.id);
    setHolds((prev) => prev.filter((h) => h.id !== hold.id));
    showToastMsg('Removed from your intercession list.');

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      pendingRemoveRow.current = null;
      setPendingRemoveId(null);
      await supabase.rpc('remove_intercession_hold', { p_hold_id: hold.id });
    }, UNDO_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const undoRemove = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const row = pendingRemoveRow.current;
    if (!row) return;
    pendingRemoveRow.current = null;
    setPendingRemoveId(null);
    setHolds((prev) => {
      if (prev.find((h) => h.id === row.id)) return prev;
      return [...prev, row].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    });
    hideToast();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast helpers ──────────────────────────────────────────────────────

  function showToastMsg(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(hideToast, UNDO_MS + 200);
  }

  function hideToast() {
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setToast(null);
    });
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
  }

  // ── List data ──────────────────────────────────────────────────────────

  const isFull = holds.length >= 10;

  const listData: Array<{ type: 'notice' | 'hold' | 'standing'; item?: HoldRow | StandingRow }> =
    activeTab === 'churches'
      ? [
          ...(pendingChurch && isFull ? [{ type: 'notice' as const }] : []),
          ...holds.map((h) => ({ type: 'hold' as const, item: h })),
        ]
      : standing.map((s) => ({ type: 'standing' as const, item: s }));

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <FlatList
        data={listData}
        keyExtractor={(row, i) =>
          row.type === 'notice'
            ? 'notice'
            : row.type === 'hold'
            ? (row.item as HoldRow).id
            : (row.item as StandingRow).prayer_request_id
        }
        renderItem={({ item: row, index }) => {
          if (row.type === 'notice') {
            return <FullNotice pendingChurch={pendingChurch!} />;
          }
          if (row.type === 'hold') {
            const hold = row.item as HoldRow;
            const isLast = index === listData.length - 1;
            return (
              <ChurchRow
                hold={hold}
                isLast={isLast}
                onRemove={() => startRemove(hold)}
              />
            );
          }
          const s = row.item as StandingRow;
          const isLast = index === listData.length - 1;
          return <StandingEntryRow entry={s} isLast={isLast} />;
        }}
        ListHeaderComponent={
          <IJHeader
            onBack={onBack}
            activeTab={activeTab}
            holdCount={holds.length}
            standingCount={standing.length}
            thumbX={thumbX}
            onSwitchTab={switchTab}
            isFull={isFull}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <IJEmpty
              tab={activeTab}
              onBack={onBack}
            />
          )
        }
        ListFooterComponent={
          listData.length > 0 ? <IJFoot /> : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Toast */}
      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toast}</Text>
          {pendingRemoveId ? (
            <Pressable
              onPress={undoRemove}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.toastUndo}>UNDO</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IJHeader — back row + title + segmented pill
// ─────────────────────────────────────────────────────────────────────────

function IJHeader({
  onBack,
  activeTab,
  holdCount,
  standingCount,
  thumbX,
  onSwitchTab,
  isFull,
}: {
  onBack: () => void;
  activeTab: JournalTab;
  holdCount: number;
  standingCount: number;
  thumbX: Animated.Value;
  onSwitchTab: (tab: JournalTab) => void;
  isFull: boolean;
}) {
  const subtitle =
    activeTab === 'churches'
      ? `${holdCount} HOLDING`
      : `${standingCount} PRAYERS STOOD IN`;

  return (
    <View style={styles.header}>
      {/* Back row */}
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back to Prayer Wall"
        style={styles.backRow}
      >
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backLabel}>PRAYER WALL</Text>
      </Pressable>

      {/* Title + subtitle */}
      <Text style={styles.title}>Intercession Journal</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Segmented pill */}
      <IJSeg
        activeTab={activeTab}
        holdCount={holdCount}
        standingCount={standingCount}
        thumbX={thumbX}
        onSwitchTab={onSwitchTab}
        isFull={isFull}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IJSeg — animated segmented pill
// ─────────────────────────────────────────────────────────────────────────

function IJSeg({
  activeTab,
  holdCount,
  standingCount,
  thumbX,
  onSwitchTab,
  isFull,
}: {
  activeTab: JournalTab;
  holdCount: number;
  standingCount: number;
  thumbX: Animated.Value;
  onSwitchTab: (tab: JournalTab) => void;
  isFull: boolean;
}) {
  return (
    <View style={styles.segTrack}>
      {/* Animated thumb */}
      <Animated.View
        style={[
          styles.segThumb,
          {
            left: thumbX.interpolate({
              inputRange: [0, 1],
              outputRange: ['3%', '50%'],
            }),
          },
        ]}
        pointerEvents="none"
      />

      {/* Churches label */}
      <Pressable
        onPress={() => onSwitchTab('churches')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'churches' }}
        style={styles.segLabel}
      >
        <Text style={[styles.segLabelText, activeTab === 'churches' && styles.segLabelActive]}>
          Churches{' '}
          <Text style={[styles.segChip, activeTab === 'churches' && styles.segChipActive]}>
            {holdCount}/{10}{isFull ? ' · Full' : ''}
          </Text>
        </Text>
      </Pressable>

      {/* Standing in Gap label */}
      <Pressable
        onPress={() => onSwitchTab('standing')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'standing' }}
        style={styles.segLabel}
      >
        <Text style={[styles.segLabelText, activeTab === 'standing' && styles.segLabelActive]}>
          Standing in Gap{' '}
          <Text style={[styles.segChip, activeTab === 'standing' && styles.segChipActive]}>
            {standingCount}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ChurchRow — swipe-to-remove via PanResponder
// ─────────────────────────────────────────────────────────────────────────

function ChurchRow({
  hold,
  isLast,
  onRemove,
}: {
  hold: HoldRow;
  isLast: boolean;
  onRemove: () => void;
}) {
  const slideX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          slideX.setValue(Math.max(g.dx, -REMOVE_SLOT));
        } else if (revealed) {
          slideX.setValue(Math.min(g.dx - REMOVE_SLOT, 0));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (!revealed && g.dx < -SWIPE_THRESHOLD) {
          Animated.spring(slideX, { toValue: -REMOVE_SLOT, useNativeDriver: true }).start();
          setRevealed(true);
        } else if (revealed && g.dx > SWIPE_THRESHOLD) {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
          setRevealed(false);
        } else if (!revealed) {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
        } else {
          Animated.spring(slideX, { toValue: -REMOVE_SLOT, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const initials = getInitials(hold.church_name);
  const location = getLocationLine(hold.city, hold.country);
  const added = formatRelativeTime(hold.created_at);

  return (
    <View style={[styles.rowWrapper, !isLast && styles.rowDivider]}>
      {/* Remove affordance (revealed behind the row) */}
      <View style={styles.removeSlot}>
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove from intercession list"
          style={styles.removeBtn}
        >
          <TrashGlyph />
          <Text style={styles.removeText}>REMOVE</Text>
        </Pressable>
      </View>

      {/* Swipeable row */}
      <Animated.View
        style={[styles.churchRow, { transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Initials glyph */}
        <View style={styles.initialsGlyph}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>

        {/* Body */}
        <View style={styles.churchRowBody}>
          <Text style={styles.churchName} numberOfLines={1}>{hold.church_name}</Text>
          <Text style={styles.churchMeta} numberOfLines={1}>
            {location.toUpperCase()} · ADDED {added.toUpperCase()}
          </Text>
        </View>

        {/* Praying status with pulse dot */}
        <PrayingDot />
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// StandingEntryRow
// ─────────────────────────────────────────────────────────────────────────

function StandingEntryRow({ entry, isLast }: { entry: StandingRow; isLast: boolean }) {
  const location = getLocationLine(entry.city, entry.country);
  const when = formatRelativeTime(entry.prayed_at);
  return (
    <View style={[styles.standingRow, !isLast && styles.rowDivider]}>
      <View style={styles.standingDot} />
      <View style={styles.standingBody}>
        <Text style={styles.standingText} numberOfLines={1}>
          {`"${entry.prayer_text}"`}
        </Text>
        <Text style={styles.standingMeta} numberOfLines={1}>
          {`${entry.church_name.toUpperCase()} · ${location.toUpperCase()} · ${when.toUpperCase()}`}
        </Text>
      </View>
      <Text style={styles.standingCount} numberOfLines={1}>
        {`YOU + ${entry.prayed_count > 1 ? entry.prayed_count - 1 : 0} STANDING`}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FullNotice — shown when holds === 10 and pendingChurch is set
// ─────────────────────────────────────────────────────────────────────────

function FullNotice({ pendingChurch }: { pendingChurch: string }) {
  return (
    <View style={styles.fullNotice}>
      <View style={styles.fullNoticeIcon}>
        <Text style={styles.fullNoticeIconText}>!</Text>
      </View>
      <View style={styles.fullNoticeBody}>
        <Text style={styles.fullNoticeTitle}>Your intercession list is full.</Text>
        <Text style={styles.fullNoticeSub}>
          Remove a church to add another.{' '}
          <Text style={styles.fullNoticePending}>{pendingChurch}</Text>
          {' '}is waiting to be added.
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IJEmpty
// ─────────────────────────────────────────────────────────────────────────

function IJEmpty({ tab, onBack }: { tab: JournalTab; onBack: () => void }) {
  const isChurches = tab === 'churches';
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyGlyphCircle}>
        {isChurches ? <SteepleGlyph /> : <HandsGlyph />}
      </View>
      <Text style={styles.emptyTitle}>
        {isChurches ? 'Your intercession list is empty.' : 'No prayers stood in yet.'}
      </Text>
      <Text style={styles.emptyBody}>
        {isChurches
          ? 'Tap "Pray" on a church in The Church tab to begin carrying them before God.'
          : 'Stand in the gap for a prayer request on the Prayer Wall.'}
      </Text>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.emptyCta}
      >
        <Text style={styles.emptyCtaText}>
          {isChurches ? 'Find a church to pray for ›' : 'Enter the prayer wall ›'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IJFoot — Galatians 6:2 scripture footer
// ─────────────────────────────────────────────────────────────────────────

function IJFoot() {
  return (
    <View style={styles.foot}>
      <Text style={styles.footEyebrow}>CARRIED BEFORE THE THRONE</Text>
      <Text style={styles.footVerse}>{GAL_6_2}</Text>
      <Text style={styles.footRef}>{GAL_6_2_REF}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PrayingDot — sky pulsing status dot
// ─────────────────────────────────────────────────────────────────────────

function PrayingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.prayingStatus}>
      <Animated.View style={[styles.prayingDot, { opacity }]} />
      <Text style={styles.prayingLabel}>Praying</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Glyphs
// ─────────────────────────────────────────────────────────────────────────

function TrashGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M2 4h10M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M10 4v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4" fill="none" stroke={SKY} strokeWidth={1.1} strokeLinecap="round" />
    </Svg>
  );
}

function SteepleGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Path d="M14 4v6M11 10h6M8 10v14h12V10" fill="none" stroke="rgba(107,181,232,0.5)" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 24v-6a4 4 0 0 1 8 0v6" fill="none" stroke="rgba(107,181,232,0.5)" strokeWidth={1.1} />
    </Svg>
  );
}

function HandsGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Path d="M10 20c0-4 8-4 8 0M6 16l4-10 4 6 4-6 4 10" fill="none" stroke="rgba(107,181,232,0.5)" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 40 },

  // ── Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  backChevron: {
    fontFamily: Typography.mono,
    fontSize: 16,
    color: SKY,
    lineHeight: 18,
  },
  backLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    color: SKY,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.26,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 20,
  },

  // ── Segmented pill
  segTrack: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: FAINT,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },
  segThumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '47%',
    borderRadius: 999,
    backgroundColor: SKY_FAINT,
    borderWidth: 0.5,
    borderColor: SKY_MID,
  },
  segLabel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabelText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  segLabelActive: {
    color: SKY,
  },
  segChip: {
    fontFamily: Typography.mono,
    fontSize: 9,
    color: Colors.textMuted,
  },
  segChipActive: {
    color: SKY,
  },

  // ── ChurchRow
  rowWrapper: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  rowDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: FAINT,
  },
  removeSlot: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: REMOVE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: REMOVE_SLOT,
    paddingVertical: 14,
  },
  removeText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.6,
    color: SKY,
    textTransform: 'uppercase',
  },
  churchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.background,
    gap: 12,
  },
  initialsGlyph: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: SKY_MID,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initialsText: {
    fontFamily: Typography.displayRegular,
    fontSize: 13,
    color: SKY,
    letterSpacing: 0.5,
  },
  churchRowBody: {
    flex: 1,
    minWidth: 0,
  },
  churchName: {
    fontFamily: Typography.displayRegular,
    fontSize: 16,
    color: OFFWHITE,
    letterSpacing: 0.16,
    marginBottom: 3,
  },
  churchMeta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.36,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  prayingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  prayingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SKY,
  },
  prayingLabel: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: SKY,
    textTransform: 'uppercase',
  },

  // ── StandingRow
  standingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    marginHorizontal: 20,
    gap: 10,
  },
  standingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SKY,
    marginTop: 5,
    flexShrink: 0,
  },
  standingBody: {
    flex: 1,
    minWidth: 0,
  },
  standingText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    lineHeight: 20,
    color: CREAM,
    letterSpacing: 0.07,
    marginBottom: 5,
  },
  standingMeta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.36,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  standingCount: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: SKY,
    textTransform: 'uppercase',
    flexShrink: 0,
    marginTop: 3,
  },

  // ── FullNotice
  fullNotice: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: SKY_MID,
    borderRadius: 8,
    backgroundColor: SKY_FAINT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fullNoticeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 0.5,
    borderColor: SKY_MID,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fullNoticeIconText: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: SKY,
    lineHeight: 14,
  },
  fullNoticeBody: { flex: 1, minWidth: 0 },
  fullNoticeTitle: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: OFFWHITE,
    lineHeight: 20,
    marginBottom: 4,
  },
  fullNoticeSub: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  fullNoticePending: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: OFFWHITE,
  },

  // ── Empty state
  emptyContainer: {
    paddingTop: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyGlyphCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: SKY_MID,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 18,
    color: OFFWHITE,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyCta: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: SKY_MID,
  },
  emptyCtaText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: SKY,
  },

  // ── Scripture footer
  foot: {
    marginTop: 40,
    marginHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  footEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: SKY,
    marginBottom: 14,
  },
  footVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25,
    color: CREAM,
    textAlign: 'center',
    letterSpacing: 0.1,
    maxWidth: 300,
    marginBottom: 12,
  },
  footRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // ── Toast
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: FAINT,
  },
  toastText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: OFFWHITE,
    flex: 1,
    lineHeight: 18,
  },
  toastUndo: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: SKY,
    textTransform: 'uppercase',
    paddingLeft: 12,
  },
});
