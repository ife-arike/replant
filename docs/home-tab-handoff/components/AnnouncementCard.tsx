// components/AnnouncementCard.tsx — admin network announcement.
// PREFERRED: variant="letterhead" (dot + label + hairline eyebrow), title 21pt.
// ALTERNATE: variant="rule" (coloured left margin rule). `warm` surface OFF by default.
// Interaction: page-turn truncation (tap card → expand/collapse, "read on" ↔ "fold").
// Comments live in the FOOTER, right-aligned (tap to open thread in place).
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Colors, Typography, Radius, Tags, TagType } from '../theme';
import { RpMark, CommentIcon, Chevron } from './icons';
import { CommentThread, Comment } from './CommentThread';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  tag?: TagType;            // 'update' | 'notice' | 'urgent'
  title: string;
  body: string;
  time: string;             // e.g. "2h ago"
  commentCount?: number;
  comments?: Comment[];
  variant?: 'letterhead' | 'rule';
  titleSize?: 20 | 21 | 22; // PREFERRED 21
  warm?: boolean;
};

const LINE: Record<number, number> = { 20: 25, 21: 26, 22: 27 };

export function AnnouncementCard({
  tag = 'update', title, body, time,
  commentCount, comments = [],
  variant = 'letterhead', titleSize = 21, warm = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [cOpen, setCOpen] = useState(false);
  const tg = Tags[tag];

  const toggleBody = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setExpanded(v => !v);
  };
  const toggleComments = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCOpen(v => !v);
  };

  return (
    <Pressable onPress={toggleBody} style={[s.card, warm && s.warm, variant === 'rule' && s.ruleCard]}>
      {variant === 'rule' && <View style={[s.rule, { backgroundColor: tg.color }]} />}

      {/* eyebrow / letterhead */}
      <View style={s.eyebrow}>
        {variant === 'letterhead' && <View style={[s.dot, { backgroundColor: tg.color }]} />}
        <Text style={s.eyebrowLabel}>{tg.label}</Text>
        <View style={s.eyebrowRule} />
        <Text style={s.eyebrowTime}>{time}</Text>
      </View>

      <Text style={[s.title, { fontSize: titleSize, lineHeight: LINE[titleSize] }]}>{title}</Text>
      <Text style={s.body} numberOfLines={expanded ? undefined : 3}>{body}</Text>

      <View style={s.readon}>
        <View style={s.readonRule} />
        <Text style={s.readonText}>{expanded ? 'fold' : 'read on'}</Text>
      </View>

      {/* footer — seal · Replant Team · [comments right-aligned] */}
      <View style={s.foot}>
        <RpMark width={17} height={17} opacity={0.65} />
        <Text style={s.by}>Replant Team</Text>
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable onPress={toggleComments} hitSlop={8} style={s.cc}>
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{commentCount} comments</Text>
            <View style={{ transform: [{ rotate: cOpen ? '180deg' : '0deg' }] }}><Chevron /></View>
          </Pressable>
        )}
      </View>

      {cOpen && <CommentThread comments={comments} count={commentCount ?? comments.length} onClose={() => setCOpen(false)} />}
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
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  title: { fontFamily: Typography.displayRegular, color: Colors.text, letterSpacing: 0.1 },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 9 },

  readon: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  readonRule: { width: 24, height: 1, backgroundColor: Colors.border },
  readonText: { fontFamily: Typography.mono, fontSize: 12, letterSpacing: 1.2, color: Colors.textSubtle },

  foot: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  by: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textSubtle },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
