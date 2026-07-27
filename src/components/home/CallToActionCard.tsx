// ─────────────────────────────────────────────
// CallToActionCard — an announcement with a prominent action affordance
// (KAN-201 card system 2026-06-02 · Founder addition)
//
// For card_type = 'call_to_action'. A filled sky-accent CTA row drives to
// link_url ("Join us", "Pray with us", "Read the report"). Distinct from
// LinkCard's quiet framed resource block — this one is meant to be acted
// on, so it carries weight. CTA label text is sourced from source_label
// (admin-set), defaulting to "Learn more".
//
// SEC Observation B (defence-in-depth): only http(s) URLs reach the OS
// link handler. safeOpen rejects every other scheme before openURL.
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
import { Colors, FeedTitle, Radius, Tags, Typography, type TagType } from '../../constants/theme';
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

// Body resting clamp — matches AnnouncementCard so Home's collapsed rhythm
// stays consistent. Cue + tap only surface when the body overflows; the
// fold row sits above the CTA button.
const COLLAPSED_LINES = 3;

type Props = {
  tag?: TagType;
  title: string;
  body: string;
  ctaLabel: string; // button text e.g. "Join us", "Pray with us"
  url: string; // link_url — required for CTA
  time: string;
  announcementId: string;
  commentCount?: number;
  onCommentPosted?: () => void;
};

export default function CallToActionCard({
  tag = 'update',
  title,
  body,
  ctaLabel,
  url,
  time,
  announcementId,
  commentCount,
  onCommentPosted,
}: Props) {
  const [cOpen, setCOpen] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount ?? 0);
  const tg = Tags[tag];

  // Page-turn body — 3-line clamp with a gated "read on" ⇄ "fold" cue.
  const [expanded, setExpanded] = useState(false);
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

  const toggleExpand = () => {
    if (!overflows) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded((v) => !v);
  };

  // Urgent dot halo — gentle breathing pulse, generic so an urgent CTA
  // would blink; non-urgent tags hold static.
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
        <Text style={s.eyebrowLabel}>{tg.label}</Text>
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

      {/* CTA link — accent words + arrow, no fill (CD register) */}
      <Pressable
        style={s.cta}
        onPress={() => safeOpen(url)}
        accessibilityRole="link"
        accessibilityLabel={ctaLabel}
        hitSlop={8}
      >
        <Text style={s.ctaLabel}>{ctaLabel}</Text>
        <Arrow color={Colors.accent} />
      </Pressable>

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

  title: { fontFamily: Typography.displayRegular, ...FeedTitle, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },

  // Offscreen mirror + page-turn cue — exact style values from
  // AnnouncementCard so the read-on grammar reads identically app-wide.
  mirror: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  // CTA = words as a hyperlink + arrow (CD register; the filled sky pill
  // was rejected by the Founder 2026-07-22). Left-aligned, accent text.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  ctaLabel: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.accent },

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
