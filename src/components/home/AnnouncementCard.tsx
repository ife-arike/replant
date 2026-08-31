// ─────────────────────────────────────────────
// AnnouncementCard — admin network announcement (KAN-201 home redesign)
//
// PREFERRED: variant="letterhead" (dot + label + hairline eyebrow),
// title = shared FeedTitle token. ALTERNATE: variant="rule" (coloured
// left margin rule). `warm` surface OFF by default.
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

import React, { useState } from 'react';
import {
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, FeedTitle, Radius, Tags, Typography, type TagType } from '../../constants/theme';
import FeedEyebrow from './FeedEyebrow';
import { AUTHOR_ATTRIBUTION } from './NetworkFeedLogic';
import { Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';
import { commentCountLabel } from './CommentThreadLogic';
import ScripturePull from './ScripturePull';
import PageTurnText from './PageTurnText';

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
  warm?: boolean;
  // Verse anchor (Day-1, 2026-07-28) — ScripturePull renders it.
  verseText?: string | null;
  verseRef?: string | null;
}

// Body resting clamp — matches DailyScriptureStrip's COLLAPSED_LINES so
// Home's collapsed rhythm stays consistent. Cue + tap-to-expand only
// surface when the body's natural line count exceeds this.
const COLLAPSED_LINES = 3;
// Must match s.body lineHeight — the collapsed crop is a container
// maxHeight (clampHeight), never a numberOfLines flip (the flip re-measure
// tears on some devices; Founder repro 2026-07-28).
const BODY_LINE_HEIGHT = 23;

export default function AnnouncementCard({
  announcementId,
  tag = 'update',
  title,
  body,
  time,
  commentCount,
  variant = 'letterhead',
  warm = false,
  verseText,
  verseRef,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cOpen, setCOpen] = useState(false);
  // Local count so the footer reflects a just-posted comment immediately
  // (the commentCount prop is a static feed-snapshot value, never refreshed).
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];

  // Overflow signal — reported by PageTurnText, which owns the entire
  // clamp/measure mechanism (see its header for the tear saga).
  const [overflows, setOverflows] = useState(false);

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

      {/* eyebrow / letterhead — FeedEyebrow owns the register (KAN-348) */}
      <FeedEyebrow tag={tag} label={tg.label} time={time} showDot={variant === 'letterhead'} />

      <Text style={s.title}>{title}</Text>
      <View style={s.bodyWrap}>
        <PageTurnText
          text={body}
          style={[s.body, s.bodyInWrap]}
          lineHeight={BODY_LINE_HEIGHT}
          lines={COLLAPSED_LINES}
          expanded={expanded}
          onOverflowsChange={setOverflows}
        />
      </View>

      {overflows && (
        <View style={s.readon}>
          <View style={s.readonRule} />
          <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
        </View>
      )}

      <ScripturePull text={verseText} reference={verseRef} />

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
            accessibilityLabel={commentCountLabel(localCount)}
          >
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{commentCountLabel(localCount)}</Text>
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


  title: { fontFamily: Typography.displayRegular, ...FeedTitle, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },
  // The wrapper owns the top spacing (PageTurnText's window strips text
  // margins); the visible body drops its own margin inside it.
  bodyWrap: { marginTop: 9 },
  bodyInWrap: { marginTop: 0 },

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
