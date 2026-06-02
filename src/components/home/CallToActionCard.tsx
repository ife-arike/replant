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
      <Text style={s.body}>{body}</Text>

      {/* filled sky-accent CTA — dark text on sky fill */}
      <Pressable
        style={s.cta}
        onPress={() => safeOpen(url)}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Text style={s.ctaLabel}>{ctaLabel}</Text>
        <Arrow color={Colors.background} />
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

  title: { fontFamily: Typography.displayRegular, fontSize: 21, lineHeight: 26, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },

  // Filled sky-accent action row — dark text on sky fill, arrow at right.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 13,
    marginTop: 16,
  },
  ctaLabel: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.background },

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
