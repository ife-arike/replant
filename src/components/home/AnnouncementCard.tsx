// ─────────────────────────────────────────────
// AnnouncementCard — admin network announcement (KAN-201 home redesign)
//
// PREFERRED: variant="letterhead" (dot + label + hairline eyebrow),
// title 21pt. ALTERNATE: variant="rule" (coloured left margin rule).
// `warm` surface OFF by default.
//
// Interaction: page-turn truncation — the body rests at a 3-line clamp;
// tap the card body to expand / collapse; the trailing cue reads
// "read on" ⇄ "fold" (no chevron). The cue + tap affordance only appear
// when the body actually overflows the clamp, measured via an offscreen
// mirror Text (same pattern as DailyScriptureStrip — Founder ruling
// 2026-07-22: "read on" never shows when the text already fits).
// Comments live in the FOOTER, right-aligned. The comment Pressable owns
// its own hitSlop and stops propagation so a comment tap never toggles
// the card body. The thread fetches its own data via announcementId.
//
// D-56 author attribution: the footer renders the constant "Replant Team"
// — the DB author_id is retained for audit but NEVER surfaces to users
// (author_id is not even selected over the wire by NetworkFeed).
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Radius, Tags, Typography, type TagType } from '../../constants/theme';
import { AUTHOR_ATTRIBUTION } from './NetworkFeedLogic';
import { Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  announcementId: string;
  tag?: TagType; // 'update' | 'notice' | 'urgent'
  title: string;
  body: string;
  time: string; // e.g. "2h ago"
  commentCount?: number;
  variant?: 'letterhead' | 'rule';
  titleSize?: 20 | 21 | 22; // PREFERRED 21
  warm?: boolean;
}

const LINE: Record<number, number> = { 20: 25, 21: 26, 22: 27 };

// Body resting clamp — matches DailyScriptureStrip's COLLAPSED_LINES so
// Home's collapsed rhythm stays consistent. Cue + tap-to-expand only
// surface when the body's natural line count exceeds this.
const COLLAPSED_LINES = 3;

export default function AnnouncementCard({
  announcementId,
  tag = 'update',
  title,
  body,
  time,
  commentCount,
  variant = 'letterhead',
  titleSize = 21,
  warm = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cOpen, setCOpen] = useState(false);
  // Local count so the footer reflects a just-posted comment immediately
  // (the commentCount prop is a static feed-snapshot value, never refreshed).
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];

  // Overflow detection — natural (uncapped) line count for the body,
  // measured via an offscreen mirror Text. null = not yet measured; until
  // measured the cue stays hidden (avoids a flash on short bodies).
  const [naturalLines, setNaturalLines] = useState<number | null>(null);
  useEffect(() => {
    setNaturalLines(null);
  }, [body]);

  // Fabric (RN 0.81 new arch) fires an early text-layout pass before the
  // custom fonts resolve and before the absolute mirror has its final
  // width. The old code LATCHED that first result and discarded every
  // correction, so one bogus early count killed the cue permanently.
  // Take the newest valid measurement instead; a zero-line pass is never
  // valid. (Founder device pass 2026-07-27.)
  const handleMirrorLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const n = e.nativeEvent.lines.length;
    if (n <= 0) return;
    setNaturalLines((prev) => (prev === n ? prev : n));
  };

  const overflows = naturalLines !== null && naturalLines > COLLAPSED_LINES;

  // Urgent dot halo: a slow, gentle breathing pulse (~1.8s period). Only
  // the halo animates — the dot itself stays solid. Non-urgent tags hold
  // a static glow (opacity 1).
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (tag !== 'urgent') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tag, blinkAnim]);

  const toggleBody = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };
  const toggleComments = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen((v) => !v);
  };

  return (
    <Pressable
      onPress={toggleBody}
      disabled={!overflows}
      style={[s.card, warm && s.warm, variant === 'rule' && s.ruleCard]}
      accessibilityRole={overflows ? 'button' : undefined}
      accessibilityState={overflows ? { expanded } : undefined}
      accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
    >
      {variant === 'rule' && <View style={[s.rule, { backgroundColor: tg.color }]} />}

      {/* eyebrow / letterhead */}
      <View style={s.eyebrow}>
        {variant === 'letterhead' && (
          <View style={s.dotWrap}>
            <Animated.View
              style={[
                s.dotHalo,
                { backgroundColor: tg.color + '30', opacity: tag === 'urgent' ? blinkAnim : 1 },
              ]}
            />
            <View style={[s.dot, { backgroundColor: tg.color }]} />
          </View>
        )}
        <Text style={s.eyebrowLabel}>{tg.label}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.eyebrowTime}>{time}</Text>
      </View>

      <Text style={[s.title, { fontSize: titleSize, lineHeight: LINE[titleSize] }]}>{title}</Text>
      <Text style={s.body} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>{body}</Text>
      {/* Offscreen mirror — measures the natural (uncapped) line count so
          the cue only renders when the body truly overflows the clamp.
          Identical text styles to the visible body so wrapping matches;
          kept offscreen rather than height:0 (RN skips onTextLayout for
          zero-height text). */}
      <Text
        style={[s.body, s.mirror, variant === 'rule' && s.mirrorRule]}
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

      {/* footer — seal · Replant Team · [comments right-aligned] */}
      <View style={s.foot}>
        <RpMark width={17} height={17} opacity={0.65} />
        <Text style={s.by}>{AUTHOR_ATTRIBUTION}</Text>
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              toggleComments();
            }}
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
        <Pressable onPress={(e) => e.stopPropagation()}>
          <CommentThread
            announcementId={announcementId}
            count={localCount}
            onClose={() => setCOpen(false)}
            onCommentPosted={() => setLocalCount((c) => c + 1)}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: Colors.cardSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },
  warm: { backgroundColor: Colors.cardWarm },
  ruleCard: { paddingLeft: 22 },
  rule: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 2, borderRadius: 2 },

  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  title: { fontFamily: Typography.displayRegular, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },
  // Offscreen mirror — pinned to the visible body's column width so its
  // line wrapping matches (left/right mirror the card's padding; the rule
  // variant's wider left padding gets its own override). Offscreen-top,
  // NOT height:0 — RN skips text layout entirely for zero-height text,
  // which would silently kill the overflow signal.
  mirror: { position: 'absolute', left: 20, right: 20, top: 0, opacity: 0 },
  mirrorRule: { left: 22 },

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
  by: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
