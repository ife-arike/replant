// ─────────────────────────────────────────────
// TogetherCard — a joint call: multiple voices behind one announcement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'together'. "Together" is connective, not alert — the
// eyebrow dot is green. The footer carries overlapping author seals when
// co-authors are present; otherwise it falls back to the standard
// Rp-seal + "Replant Team" footer (the multi-author columns are not built
// on announcements yet, so NetworkFeed passes coAuthors=undefined for now
// — the fallback is the correct behaviour until that lands).
//
// D-56 author attribution: when no co-authors are supplied the footer
// renders "Replant Team" — author_id never reaches this component.
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
import { Colors, Radius, Tags, Typography } from '../../constants/theme';
import { AUTHOR_ATTRIBUTION } from './NetworkFeedLogic';
import { Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Body resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the body overflows.
const COLLAPSED_LINES = 3;

type CoAuthor = { initial: string; name: string };

type Props = {
  title: string;
  body: string;
  time: string;
  coAuthors?: CoAuthor[]; // up to 3 overlapping seals; null → Rp team only
  announcementId: string;
  commentCount?: number;
  onCommentPosted?: () => void;
};

// Compose the co-author name list, e.g.
// "Daniel Okoro, Grace Mbeki & the Replant team".
function coAuthorLabel(authors: CoAuthor[]): string {
  const names = authors.map((a) => a.name).filter(Boolean);
  if (names.length === 0) return AUTHOR_ATTRIBUTION;
  if (names.length === 1) return `${names[0]} & the Replant team`;
  const head = names.slice(0, -1).join(', ');
  const tail = names[names.length - 1];
  return `${head} & ${tail} & the Replant team`;
}

export default function TogetherCard({
  title,
  body,
  time,
  coAuthors,
  announcementId,
  commentCount,
  onCommentPosted,
}: Props) {
  const [cOpen, setCOpen] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  // Cap at 3 overlapping seals per the design.
  const seals = (coAuthors ?? []).slice(0, 3);
  const hasCoAuthors = seals.length > 0;

  // Page-turn body — 3-line clamp with a gated "read on" ⇄ "fold" cue.
  const [expanded, setExpanded] = useState(false);
  const [naturalLines, setNaturalLines] = useState<number | null>(null);
  const measuredForRef = useRef<string | null>(null);
  useEffect(() => {
    setNaturalLines(null);
    measuredForRef.current = null;
  }, [body]);

  const handleMirrorLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (measuredForRef.current === body) return;
    measuredForRef.current = body;
    setNaturalLines(e.nativeEvent.lines.length);
  };

  const overflows = naturalLines !== null && naturalLines > COLLAPSED_LINES;

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  const toggleComments = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen((v) => !v);
  };

  return (
    <View style={s.card}>
      {/* eyebrow — green dot ("Together" is connective, not alert) */}
      <View style={s.eyebrow}>
        <View style={s.dotWrap}>
          <View style={s.dotHalo} />
          <View style={s.dot} />
        </View>
        <Text style={s.eyebrowLabel}>{Tags.together.label}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.eyebrowTime}>{time}</Text>
      </View>

      <Text style={s.title}>{title}</Text>

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        <Text style={s.body} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
          {body}
        </Text>
        {/* Offscreen mirror — measures the body's natural line count so the
            cue only renders on true overflow (offscreen-top, not height:0). */}
        <Text
          style={[s.body, s.mirror]}
          onTextLayout={handleMirrorLayout}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {body}
        </Text>
        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      {/* footer — overlapping seals + name list, or Rp-team fallback */}
      <View style={s.foot}>
        {hasCoAuthors ? (
          <>
            <View style={s.seals}>
              {seals.map((a, i) => (
                <View key={`${a.name}-${i}`} style={[s.seal, i > 0 && s.sealOverlap]}>
                  <Text style={s.sealInitial}>{a.initial}</Text>
                </View>
              ))}
            </View>
            <Text style={s.by} numberOfLines={1}>{coAuthorLabel(seals)}</Text>
          </>
        ) : (
          <>
            <RpMark width={17} height={17} opacity={0.65} />
            <Text style={s.by}>{AUTHOR_ATTRIBUTION}</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable
            onPress={toggleComments}
            hitSlop={8}
            style={s.cc}
            accessibilityRole="button"
            accessibilityLabel={`${localCount} comments`}
          >
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{localCount} comments</Text>
            <View style={{ transform: [{ rotate: cOpen ? '180deg' : '0deg' }] }}>
              <Chevron />
            </View>
          </Pressable>
        )}
      </View>

      {cOpen && (
        <CommentThread
          announcementId={announcementId}
          count={localCount}
          onClose={() => setCOpen(false)}
          onCommentPosted={() => {
            setLocalCount((c) => c + 1);
            onCommentPosted?.();
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },

  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.green + '30' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  title: { fontFamily: Typography.displayRegular, fontSize: 21, lineHeight: 26, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },

  // Offscreen mirror + page-turn cue — exact style values from
  // AnnouncementCard so the read-on grammar reads identically app-wide.
  mirror: { position: 'absolute', left: 20, right: 20, top: -10000, opacity: 0 },
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  by: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle, flexShrink: 1 },

  // Overlapping author seals — each offset left by -10 to overlap.
  seals: { flexDirection: 'row', alignItems: 'center' },
  seal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealOverlap: { marginLeft: -10 },
  sealInitial: { fontFamily: Typography.displayRegular, fontSize: 13, color: Colors.textMuted },

  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
