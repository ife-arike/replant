// ─────────────────────────────────────────────
// ArticleCard — article / long-read announcement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'article' or 'long_read'. A weightier, editorial card
// than the standard announcement (Founder round-2 2026-07-22, CD frame in
// docs/home-tab-handoff): kicker eyebrow + time top-right, a large serif
// headline, an italic standfirst (derived upstream — first sentence of the
// body), a drop-cap opening initial on the body, and a page-turn body that
// rests at a 3-line clamp with a "read on" ⇄ "fold" cue. The cue + tap +
// button semantics only surface when the body overflows the clamp
// (offscreen mirror measure — app-wide overflow-gating ruling 2026-07-22).
// The fold row sits above the slim "Read · N min →" link (external url).
//
// SEC Observation B (defence-in-depth): only http(s) URLs reach the OS
// link handler. safeOpen rejects javascript:, data:, file:, intent: and
// any other scheme before Linking.openURL.
//
// D-56 author attribution: footer renders "Replant Team" — author_id is
// never selected over the wire and never reaches this component.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  Easing,
  LayoutAnimation,
  Linking,
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
import { Arrow, Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';
import { commentCountLabel } from './CommentThreadLogic';
import ScripturePull from './ScripturePull';
import PageTurnText from './PageTurnText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// SEC Observation B — client-side scheme allow-list. Only http(s) reaches
// the OS link handler; everything else is silently ignored.
const safeOpen = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    void Linking.openURL(url);
  }
};

// Body resting clamp — matches AnnouncementCard / DailyScriptureStrip so
// Home's collapsed rhythm stays consistent. Cue + tap-to-expand only
// surface when the body's natural line count exceeds this.
const COLLAPSED_LINES = 3;
// Must match s.body lineHeight — feeds PageTurnText's pre-measure
// window estimate; the clamp itself is PageTurnText's height window,
// never a numberOfLines flip (tear class, 2026-07-28).
const BODY_LINE_HEIGHT = 23;

type Props = {
  tag?: TagType;
  kicker?: string; // eyebrow label override (e.g. "Long read")
  title: string;
  standfirst?: string; // italic intro sentence
  body: string; // body text — 3-line clamp with read on / fold
  readTimeMin?: number; // "Read · 5 min →" — omit only the minutes if null
  url?: string; // link_url
  time: string;
  announcementId: string;
  commentCount?: number;
  onCommentPosted?: () => void;
  // Verse anchor (Day-1, 2026-07-28) — ScripturePull renders it.
  verseText?: string | null;
  verseRef?: string | null;
};

export default function ArticleCard({
  tag = 'update',
  kicker,
  title,
  standfirst,
  body,
  readTimeMin,
  url,
  time,
  announcementId,
  commentCount,
  onCommentPosted,
  verseText,
  verseRef,
}: Props) {
  const [cOpen, setCOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];
  const label = kicker ?? tg.label;

  // Drop-cap split — the first initial rides in a serif gutter, the
  // remainder flows in the body column beside it. Skipped for bodies too
  // short to carry an initial (falls back to a plain full-width body).
  const useDropCap = body.trim().length > 1;
  const capLetter = useDropCap ? body.charAt(0) : '';
  const bodyText = useDropCap ? body.slice(1) : body;

  // Overflow signal — reported by PageTurnText, which owns the entire
  // clamp/measure mechanism (see its header for the tear saga).
  const [overflows, setOverflows] = useState(false);

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
      {/* eyebrow / letterhead — FeedEyebrow owns the register (KAN-348) */}
      <FeedEyebrow tag={tag} label={label} time={time} />

      <Text style={s.title}>{title}</Text>
      {!!standfirst && <Text style={s.standfirst}>{standfirst}</Text>}

      <Pressable
        onPress={toggleExpand}
        disabled={!overflows}
        accessibilityRole={overflows ? 'button' : undefined}
        accessibilityState={overflows ? { expanded } : undefined}
        accessibilityHint={overflows ? (expanded ? 'Tap to fold' : 'Tap to read on') : undefined}
      >
        <View style={s.teaser}>
          {useDropCap && <Text style={s.dropCap}>{capLetter}</Text>}
          <View style={s.bodyCol}>
            <PageTurnText
              text={bodyText}
              style={s.body}
              lineHeight={BODY_LINE_HEIGHT}
              lines={COLLAPSED_LINES}
              expanded={expanded}
              onOverflowsChange={setOverflows}
            />
          </View>
        </View>

        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      <ScripturePull text={verseText} reference={verseRef} />

      {!!url && (
        <Pressable
          style={s.read}
          onPress={() => safeOpen(url)}
          accessibilityRole="link"
          accessibilityLabel="Read the full article"
        >
          <Text style={s.readText}>
            {/* Founder 2026-07-28: article-family cards carry the full piece
                elsewhere — the card is an excerpt, so the link row says what
                it does. Read-time keeps its compact form when present. */}
            {readTimeMin != null ? `Read the full article · ${readTimeMin} min` : 'Read the full article'}
          </Text>
          <Arrow />
        </Pressable>
      )}

      {/* footer — seal · Replant Team · [comments right-aligned] */}
      <View style={s.foot}>
        <RpMark width={17} height={17} opacity={0.65} />
        <Text style={s.by}>{AUTHOR_ATTRIBUTION}</Text>
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable
            onPress={toggleComments}
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


  // Editorial headline — larger + weightier than the standard card title,
  // toward the CD frame's 26–28 (600 SemiBold, 26pt).
  title: { fontFamily: Typography.display, ...FeedTitle, color: Colors.text, letterSpacing: 0.1 },
  standfirst: { fontFamily: Typography.scriptureItalic, fontSize: 16, lineHeight: 24, color: Colors.textMuted, marginTop: 10 },

  // Teaser row — drop-cap gutter + body column. Top-aligned so the initial
  // rises with the body's first line; spacing lives here (not on the body)
  // so the cap and body share a top edge.
  teaser: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 },
  // Serif initial — Cormorant 600, ~2 lines tall. Sized conservatively for
  // mobile density (easily enlarged toward a full 3-line cap).
  // lineHeight must be >= fontSize or RN clips Cormorant's top serifs
  // (the Founder-reported cut-off "I"). Sized a notch down from 52.
  dropCap: {
    fontFamily: Typography.display,
    fontSize: 46,
    lineHeight: 48,
    color: Colors.text,
    marginRight: 10,
    marginTop: 1,
  },
  bodyCol: { flex: 1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted },

  // Slim read row — quieter than LinkCard's framed resource block.
  read: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  readText: { fontFamily: Typography.mono, fontSize: 11.5, letterSpacing: 0.4, color: Colors.accent },

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
