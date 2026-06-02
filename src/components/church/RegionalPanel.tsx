// ─────────────────────────────────────────────
// RegionalPanel — KAN-21 shell → KAN-223 full build
//
// Slide-in panel from the right showing:
//   Head: close X, "REGION" eyebrow, h3 region name, RAG summary chunks.
//   Body: scrollable list of churches in the region sorted red→amber→green
//         then alphabetically, with a live name/city/country enrichment
//         fetch from churches_public when the panel opens.
//
// Underground footer: underground regions (Middle East, South Asia, East
// Asia) render a qualitative "gatherings we cannot name" row below the
// list. This is a pastoral acknowledgment ONLY — no count, never
// populated from data (get_churches_global already excludes underground
// churches at the DB level).
//
// Empty state: if a region has no visible churches (all underground, or
// truly no network presence) we render a prayer-prompt empty state.
//
// No expo-blur — background is dim-only per the invariant.
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { supabase } from '../../lib/supabase';
import { REGION_DEFS } from '../../utils/regionUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_WIDTH = Math.round(SCREEN_W * 0.80); // CD: width: 80%
const ANIM_MS = 450;

// ── Underground set (for the qualitative footer) ──────────────────────
// Derived from REGION_DEFS so this stays in sync with the authoritative
// list. Never derives a count — purely a key lookup for the footer flag.
// Typed as Set<string> so isUndergroundRegion accepts any string argument.
const UNDERGROUND_NAMES: Set<string> = new Set(
  REGION_DEFS.filter((r) => r.underground).map((r) => r.name),
);
function isUndergroundRegion(name: string): boolean {
  return UNDERGROUND_NAMES.has(name);
}

// ── Public types ──────────────────────────────────────────────────────

/** A single church row inside the panel. `name` / `city` / `country` are
 *  enriched from churches_public when the panel opens; they start empty
 *  and are replaced by the fetch result before the list renders. */
export interface RegionRow {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  rag_status: string; // 'green' | 'amber' | 'red'
  church_code?: string | null;
  leaders?: Array<{ role: string; name: string | null; anonymous: boolean }>;
}

/** The region payload passed from TheChurchScreen into this panel. */
export interface ChurchRegion {
  /** RegionKey — matches REGION_DEFS[*].key */
  key: string;
  /** Display name, e.g. "East Asia" */
  name: string;
  /** Whether this region has a qualitative underground footer */
  underground: boolean;
  /** Church dots assigned to this region (id + rag_status from the globe) */
  churches: RegionRow[];
}

interface Props {
  open: boolean;
  region: ChurchRegion | null;
  onClose: () => void;
  /** Tap-row passthrough — fires with churchId; host opens the profile sheet. */
  onPickChurch?: (churchId: string) => void;
}

// ── Enrichment shape (from churches_public) ───────────────────────────
interface EnrichedRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  rag_status: string;
}

// ── RegionalRow sub-component ─────────────────────────────────────────

function RegionalRow({
  church,
  onPress,
}: {
  church: RegionRow;
  onPress: () => void;
}) {
  const ragColor =
    church.rag_status === 'green'
      ? Colors.green
      : church.rag_status === 'amber'
      ? Colors.amber
      : church.rag_status === 'red'
      ? Colors.red
      : Colors.textMuted;

  const location = [church.city, church.country].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onPress}
      style={rowStyles.row}
      accessibilityRole="button"
    >
      <View
        style={[
          rowStyles.dot,
          {
            backgroundColor: ragColor,
            shadowColor: ragColor,
            shadowOpacity: 0.7,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
      <View style={rowStyles.body}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {church.name || '—'}
        </Text>
        {location ? (
          <Text style={rowStyles.location} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: Typography.displayRegular,
    fontSize: 17,
    lineHeight: 20,
    color: Colors.text,
  },
  location: {
    marginTop: 3,
    fontFamily: Typography.body,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
});

// ── Main component ────────────────────────────────────────────────────

export default function RegionalPanel({
  open,
  region,
  onClose,
  onPickChurch,
}: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;

  // Enriched church list — populated from churches_public when the panel
  // opens. Starts empty; replaced once the Supabase query settles.
  const [enrichedChurches, setEnrichedChurches] = useState<RegionRow[]>([]);
  const [enriching, setEnriching] = useState(false);

  // Slide animation per CD: translateX(100%) → translateX(0) when open.
  useEffect(() => {
    const target = open ? 0 : PANEL_WIDTH;
    if (reduced) {
      translateX.setValue(target);
    } else {
      Animated.timing(translateX, {
        toValue: target,
        duration: ANIM_MS,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [open, reduced, translateX]);

  // Enrichment fetch — fires each time the panel opens with a region.
  // Merges name/city/country from churches_public back onto the original
  // dot rows, preserving the rag_status from the globe as a fallback if
  // the DB row is missing a rag_status.
  useEffect(() => {
    if (!open || !region || region.churches.length === 0) {
      setEnrichedChurches([]);
      return;
    }
    const ids = region.churches.map((c) => c.id);
    setEnriching(true);
    supabase
      .from('churches_public')
      .select('id, name, city, country, rag_status')
      .in('id', ids)
      .then(({ data }) => {
        if (data) {
          const enrichMap = new Map(
            (data as EnrichedRow[]).map((r) => [r.id, r]),
          );
          setEnrichedChurches(
            region.churches.map((c) => ({
              ...c,
              name: enrichMap.get(c.id)?.name ?? '',
              city: enrichMap.get(c.id)?.city ?? null,
              country: enrichMap.get(c.id)?.country ?? null,
            })),
          );
        }
        setEnriching(false);
      });
  }, [open, region]);

  // RAG summary counts — derived from enrichedChurches when available,
  // falls back to the raw region.churches dots while enriching.
  const source = enrichedChurches.length > 0 ? enrichedChurches : region?.churches ?? [];
  const ragCounts = { g: 0, a: 0, r: 0 };
  for (const c of source) {
    if (c.rag_status === 'green') ragCounts.g++;
    else if (c.rag_status === 'amber') ragCounts.a++;
    else if (c.rag_status === 'red') ragCounts.r++;
  }

  const handleRowPress = useCallback(
    (churchId: string) => {
      onClose();
      onPickChurch?.(churchId);
    },
    [onClose, onPickChurch],
  );

  // Sort: red → amber → green, then alphabetical within each band.
  const sortedChurches = enrichedChurches.slice().sort((a, b) => {
    const order: Record<string, number> = { red: 0, amber: 1, green: 2 };
    const ao = order[a.rag_status] ?? 3;
    const bo = order[b.rag_status] ?? 3;
    if (ao !== bo) return ao - bo;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return (
    <Animated.View
      style={[styles.panel, { transform: [{ translateX }] }]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {/* Close × — positioned to panel root, aligned to eyebrow Y baseline.
          CD .regional-head has close at top:18 of panel; insets.top + 12
          clears the safe area and sits tight to the head content. */}
      <Pressable
        onPress={onClose}
        hitSlop={8}
        style={[styles.closeX, { top: insets.top + 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Close regional panel"
      >
        <Text style={styles.closeXText}>×</Text>
      </Pressable>

      {/* Head — eyebrow, h3, RAG summary */}
      <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>REGION</Text>
        <Text style={styles.title}>{region?.name ?? '—'}</Text>
        {/* RAG summary — compact dot + count only; no text labels so all
            three bands fit on one line regardless of count magnitude.
            Color is the signal; no label needed. */}
        <View style={styles.ragSummary}>
          {ragCounts.g > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.green }]} />
              <Text style={styles.ragChunkText}>{ragCounts.g}</Text>
            </View>
          ) : null}
          {ragCounts.a > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.amber }]} />
              <Text style={styles.ragChunkText}>{ragCounts.a}</Text>
            </View>
          ) : null}
          {ragCounts.r > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.red }]} />
              <Text style={styles.ragChunkText}>{ragCounts.r}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Body — church list or states */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {enriching ? (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : sortedChurches.length === 0 ? (
          /* Empty pastoral state — Founder ruling 2026-06-04 */
          <View style={styles.emptyState}>
            <View style={styles.emptyRing} />
            <Text style={styles.emptyTitle}>No churches in this region yet.</Text>
            <Text style={styles.emptyBody}>
              Pray for {region?.name ?? 'this region'} — that the Lord would raise up
              verified, connected leaders here.
            </Text>
          </View>
        ) : (
          sortedChurches.map((c) => (
            <RegionalRow
              key={c.id}
              church={c}
              onPress={() => handleRowPress(c.id)}
            />
          ))
        )}

        {/* Underground footer — qualitative acknowledgment only.
            Renders for Middle East, South Asia, and East Asia.
            Never shows a count — get_churches_global excludes all
            underground churches at the DB level; no row is ever
            derived from underground data. */}
        {region && isUndergroundRegion(region.name) ? (
          <View style={styles.undergroundFooter}>
            <View style={styles.ugDot} />
            <Text style={styles.ugText}>+ gatherings we cannot name</Text>
          </View>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: -20, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 24,
    zIndex: 35, // per CD CSS
  },

  // Head
  head: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    // paddingRight reserves room for the absolute closeX so the title
    // never collides with the × on narrow regions.
    paddingRight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  closeX: {
    position: 'absolute',
    right: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeXText: {
    fontFamily: Typography.body,
    fontSize: 22,
    color: Colors.textMuted,
    lineHeight: 24,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    letterSpacing: 0.4,
    color: Colors.text,
    lineHeight: 28,
  },
  ragSummary: { flexDirection: 'row', flexWrap: 'nowrap', gap: 14, marginTop: 12 },
  ragChunk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ragDot: { width: 7, height: 7, borderRadius: 3.5 },
  ragChunkText: { fontFamily: Typography.body, fontSize: 11, color: Colors.textMuted },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingBottom: 32 },

  // Loading
  loadingRow: { padding: 24, alignItems: 'center' },
  loadingText: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: Colors.textSubtle,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 12,
  },
  emptyRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(107,181,232,0.35)',
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Typography.displayRegular,
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Underground footer
  undergroundFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginHorizontal: 8,
    padding: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  ugDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.red,
    opacity: 0.7,
    flexShrink: 0,
  },
  ugText: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
});
