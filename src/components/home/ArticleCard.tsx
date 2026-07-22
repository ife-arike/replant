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

import React, { useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import {
  Animated,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Colors, Radius, Tags, Typography, type TagType } from '../../constants/theme';
import { AUTHOR_ATTRIBUTION } from './NetworkFeedLogic';
import { Arrow, Chevron, CommentIcon, RpMark } from './HomeIcons';
import { CommentThread } from './CommentThread';

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

  // Overflow detection — natural (uncapped) line count for the body column,
  // measured via an offscreen mirror Text. null = not yet measured; the cue
  // stays hidden until measured (no flash on short bodies). App-wide
  // overflow-gating ruling: cue + tap + button semantics only when the body
  // truly exceeds the clamp.
  const [naturalLines, setNaturalLines] = useState<number | null>(null);
  const measuredForRef = useRef<string | null>(null);
  useEffect(() => {
    setNaturalLines(null);
    measuredForRef.current = null;
  }, [bodyText]);

  const handleMirrorLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (measuredForRef.current === bodyText) return;
    measuredForRef.current = bodyText;
    setNaturalLines(e.nativeEvent.lines.length);
  };

  const overflows = naturalLines !== null && naturalLines > COLLAPSED_LINES;

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  // Urgent dot halo — gentle breathing pulse. Implemented generically so
  // an 'urgent'-tagged article would blink; non-urgent tags hold static.
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

  const toggleComments = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen((v) => !v);
  };

  return (
    <View style={s.card}>
      {/* eyebrow / letterhead */}
      <View style={s.eyebrow}>
        <View style={s.dotWrap}>
          <Animated.View
            style={[
              s.dotHalo,
              { backgroundColor: tg.color + '30', opacity: tag === 'urgent' ? blinkAnim : 1 },
            ]}
          />
          <View style={[s.dot, { backgroundColor: tg.color }]} />
        </View>
        <Text style={s.eyebrowLabel}>{label}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.eyebrowTime}>{time}</Text>
      </View>

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
            <Text style={s.body} numberOfLines={expanded ? undefined : COLLAPSED_LINES}>
              {bodyText}
            </Text>
            {/* Offscreen mirror — measures the natural (uncapped) line count
                at the body column's width so the cue only renders on true
                overflow. Inside bodyCol (left:0/right:0) so it tracks the
                drop-cap-narrowed column automatically. */}
            <Text
              style={[s.body, s.mirror]}
              onTextLayout={handleMirrorLayout}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
            >
              {bodyText}
            </Text>
          </View>
        </View>

        {overflows && (
          <View style={s.readon}>
            <View style={s.readonRule} />
            <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
          </View>
        )}
      </Pressable>

      {!!url && (
        <Pressable
          style={s.read}
          onPress={() => safeOpen(url)}
          accessibilityRole="link"
          accessibilityLabel="Read the full article"
        >
          <Text style={s.readText}>
            {readTimeMin != null ? `Read · ${readTimeMin} min` : 'Read'}
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
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  // Editorial headline — larger + weightier than the standard card title,
  // toward the CD frame's 26–28 (600 SemiBold, 26pt).
  title: { fontFamily: Typography.display, fontSize: 26, lineHeight: 31, color: Colors.text, letterSpacing: 0.1 },
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
  bodyCol: { flex: 1, position: 'relative' },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted },
  // Offscreen mirror — pinned to the body column's width (left/right 0) so
  // its wrapping matches the visible body, incl. the drop-cap narrowing.
  // Offscreen-top, NOT height:0 (RN skips text layout for zero-height text).
  mirror: { position: 'absolute', left: 0, right: 0, top: -10000, opacity: 0 },

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
