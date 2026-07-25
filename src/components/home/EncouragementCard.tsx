// ─────────────────────────────────────────────
// EncouragementCard — short-form leader encouragement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'encouragement'. A leader voice, not an admin
// announcement — a green-dot letterhead eyebrow (like "A word for today")
// over the warm card surface (Colors.cardWarm) signals the type. The lead
// reads as a roman-serif long-read line (Founder round-2 2026-07-22: no
// longer italic scripture) and rests at a 3-line clamp with a "read on" ⇄
// "fold" page-turn — the cue only surfaces when the lead overflows the
// clamp (app-wide overflow-gating ruling). A verse anchor and an author
// row sit below.
//
// Pastoral decision: encouragement cards are READ, not replied to — no
// comment thread renders. The commentCount / onCommentPosted props are
// accepted for routing-shape parity but intentionally unused.
//
// Author attribution: frozen upstream in NetworkFeed (source_label byline +
// seal; the feed never resolves authors client-side — SME interim 2026-07-22).
// Two independent axes (decoupled 2026-06-21):
//   • users.anonymous = true → name becomes "A fellow {role}", initial "A".
//   • underground church + safe (show_church_name=false) → church display
//     becomes '' (no name, no city, no country).
// Both can be true, neither, or either. An underground leader who chose
// to be known by name still arrives here with their real name + initial,
// just with the church display held. author_id NEVER reaches this
// component (SEC Obs D).
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';
import { RpMark } from './HomeIcons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Lead resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the lead overflows.
const COLLAPSED_LINES = 3;

type Props = {
  lead: string; // the full encouragement (short — 1-2 lines)
  verse?: string; // anchor reference e.g. "Matthew 11:28"
  time: string;
  // seal → Replant seal in the avatar circle (frozen attribution; the feed
  // passes source_label as name). initial drives the lettered circle otherwise.
  author: { initial?: string; seal?: boolean; name: string; church: string };
  announcementId: string;
  // Accepted for routing-shape parity; encouragement cards do not open a
  // comment thread (pastoral decision — read, not replied to).
  commentCount?: number;
  onCommentPosted?: () => void;
};

export default function EncouragementCard({ lead, verse, time, author }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Overflow detection — natural (uncapped) line count for the lead,
  // measured via an offscreen mirror Text. The cue + tap stay hidden until
  // measured, and only render when the lead truly exceeds the clamp.
  const [naturalLines, setNaturalLines] = useState<number | null>(null);
  const measuredForRef = useRef<string | null>(null);
  useEffect(() => {
    setNaturalLines(null);
    measuredForRef.current = null;
  }, [lead]);

  const handleMirrorLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (measuredForRef.current === lead) return;
    measuredForRef.current = lead;
    setNaturalLines(e.nativeEvent.lines.length);
  };

  const overflows = naturalLines !== null && naturalLines > COLLAPSED_LINES;

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  return (
    <View style={s.card}>
      <View style={s.eyebrow}>
        <View style={s.dotWrap}>
          <View style={s.dotHalo} />
          <View style={s.dot} />
        </View>
        <Text style={s.eyebrowLabel}>Encouragement</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.when}>{time}</Text>
      </View>

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        <Text style={s.lead} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
          {lead}
        </Text>
        {/* Offscreen mirror — measures the lead's natural line count so the
            cue only renders on true overflow (offscreen-top, not height:0). */}
        <Text
          style={[s.lead, s.mirror]}
          onTextLayout={handleMirrorLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {lead}
        </Text>
        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      {!!verse && (
        <View style={s.meta}>
          <Text style={s.verse}>{verse}</Text>
        </View>
      )}

      <View style={s.author}>
        <View style={s.av}>
          {author.seal
            ? <RpMark width={16} height={16} opacity={0.8} />
            : <Text style={s.avInitial}>{author.initial ?? '·'}</Text>}
        </View>
        <View>
          <Text style={s.name}>{author.name}</Text>
          {!!author.church && <Text style={s.church}>{author.church}</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardWarm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },

  // Letterhead eyebrow — dot + label + rule + time, matching LeaderWordCard
  // (Founder 2026-07-22: green dot like word-for-today, label muted, time top-right).
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.green + '30' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  // Roman serif, long-read-title register (Founder round-2 2026-07-22 —
  // no longer scripture italic). Size tracks ArticleCard's title family.
  lead: { fontFamily: Typography.displayRegular, fontSize: 22, lineHeight: 30, letterSpacing: 0.1, color: Colors.text },

  // Offscreen mirror + page-turn cue — exact style values from
  // AnnouncementCard so the read-on grammar reads identically app-wide.
  mirror: { position: 'absolute', left: 20, right: 20, top: -10000, opacity: 0 },
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  verse: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.accent },
  when: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  av: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 15, color: Colors.textMuted },
  name: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  church: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
});
