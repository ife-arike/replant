// ─────────────────────────────────────────────
// RegionalPanel — KAN-21 (CAL chrome patch, 2026-05-28)
//
// SHELL ONLY. The CD specifies a slide-in panel from the right with a
// head (close X, eyebrow "Region", h3 region name, RAG-summary chunks)
// and a body of church list rows. The list-row body is NOT built in
// this patch — `get_churches_global` returns only `{id, lat, lng,
// rag_status}` and has no `country` / `name` / `leaders` / `church_code`
// to populate region grouping or row rendering. Filed as a DBA
// dependency in KAN-21 c.14810.
//
// What this shell does today:
//   - Slides in from the right (Animated.timing on translateX, 450ms
//     cubic, matching styles.css .regional-panel transition).
//   - Renders the head per CSS — close X, "REGION" eyebrow, h3 name,
//     RAG-summary placeholder.
//   - Body renders a single CD-faithful "coming soon" placeholder so a
//     QA / Founder review of the chrome doesn't see an empty void.
//
// When DBA lands the region data shape, the body becomes a FlatList of
// list-row entries — props are already typed for the eventual payload.
// ─────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_WIDTH = Math.round(SCREEN_W * 0.80); // CSS: width: 80%
const ANIM_MS = 450;

// Future payload shape (CD reference; populated by DBA when ready).
export interface RegionRow {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  rag_status: string; // 'green' | 'amber' | 'red'
  church_code?: string | null;
  leaders?: Array<{ role: string; name: string | null; anonymous: boolean }>;
}

export interface ChurchRegion {
  name: string;          // e.g. "East Asia" or a country name
  churches: RegionRow[]; // populated by DBA-provided RPC
}

interface Props {
  open: boolean;
  region: ChurchRegion | null;
  onClose: () => void;
  /** Tap-row passthrough — will wire to ChurchProfileBottomSheet once body is built. */
  onPickChurch?: (church: RegionRow) => void;
}

export default function RegionalPanel({ open, region, onClose }: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;

  // Slide animation per CSS: translateX(100%) → translateX(0) when open.
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

  // Sum RAG counts for the head's summary chunks. Empty when region is null.
  const ragCounts: { g: number; a: number; r: number } = { g: 0, a: 0, r: 0 };
  for (const c of region?.churches ?? []) {
    if (c.rag_status === 'green') ragCounts.g++;
    else if (c.rag_status === 'amber') ragCounts.a++;
    else if (c.rag_status === 'red') ragCounts.r++;
  }

  return (
    <Animated.View
      style={[styles.panel, { paddingTop: insets.top + 14, transform: [{ translateX }] }]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {/* Head — close X, eyebrow, h3, RAG summary */}
      <View style={styles.head}>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeX} accessibilityRole="button" accessibilityLabel="Close regional panel">
          <Text style={styles.closeXText}>×</Text>
        </Pressable>
        <Text style={styles.eyebrow}>REGION</Text>
        <Text style={styles.title}>{region?.name ?? '—'}</Text>
        <View style={styles.ragSummary}>
          {ragCounts.g > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.green }]} />
              <Text style={styles.ragChunkText}>{ragCounts.g} freely operating</Text>
            </View>
          ) : null}
          {ragCounts.a > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.amber }]} />
              <Text style={styles.ragChunkText}>{ragCounts.a} with limitations</Text>
            </View>
          ) : null}
          {ragCounts.r > 0 ? (
            <View style={styles.ragChunk}>
              <View style={[styles.ragDot, { backgroundColor: Colors.red }]} />
              <Text style={styles.ragChunkText}>{ragCounts.r} not freely</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Body — CD-faithful placeholder pending DBA region RPC */}
      <View style={styles.bodyPlaceholder}>
        <Text style={styles.placeholderEyebrow}>COMING SOON</Text>
        <Text style={styles.placeholderText}>
          Regional church lists will populate here once the data layer is in place.
        </Text>
        <Text style={styles.placeholderTodo}>TODO(DBA): get_churches_in_region or country in get_churches_global</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: -20, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 24,
    zIndex: 35, // per CSS
  },
  head: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  closeX: {
    position: 'absolute',
    top: 14, right: 14,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  closeXText: { fontFamily: Typography.body, fontSize: 22, color: Colors.textMuted, lineHeight: 24 },
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
  ragSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  ragChunk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ragDot: { width: 7, height: 7, borderRadius: 3.5 },
  ragChunkText: { fontFamily: Typography.body, fontSize: 11, color: Colors.textMuted },

  bodyPlaceholder: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 28,
    gap: 10,
  },
  placeholderEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: Colors.textSubtle,
  },
  placeholderText: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  placeholderTodo: {
    marginTop: 8,
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.textSubtle,
  },
});
