// ─────────────────────────────────────────────
// ArticleCard — article / long-read announcement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'article' or 'long_read'. A weightier card than the
// standard announcement: kicker eyebrow, larger serif headline, an italic
// standfirst, a page-turn body (3-line clamp, read on / fold — the CD
// letterhead grammar; Founder 2026-07-22), and a slim "Read · N min →"
// link row above the footer when an external url is present.
//
// SEC Observation B (defence-in-depth): only http(s) URLs reach the OS
// link handler. safeOpen rejects javascript:, data:, file:, intent: and
// any other scheme before Linking.openURL.
//
// D-56 author attribution: footer renders "Replant Team" — author_id is
// never selected over the wire and never reaches this component.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
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
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];
  const label = kicker ?? tg.label;

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
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Fold the article' : 'Read on'}
      >
        <Text style={s.body} numberOfLines={expanded ? undefined : 3}>{body}</Text>
        <View style={s.readon}>
          <View style={s.readonRule} />
          <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
        </View>
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

  // Larger, weightier than the standard card title (600 SemiBold, 22pt).
  title: { fontFamily: Typography.display, fontSize: 22, lineHeight: 28, color: Colors.text, letterSpacing: 0.1 },
  standfirst: { fontFamily: Typography.scriptureItalic, fontSize: 16, lineHeight: 24, color: Colors.textMuted, marginTop: 10 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 10 },

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
