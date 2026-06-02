// components/LeaderWordCard.tsx — a verified leader's word to the network.
// NOT a testimony — an encouragement / daily-bread reflection. Warm surface
// (intentional, distinct from admin cards). Time sits opposite the verse anchor;
// comments are right-aligned in the author row (matching announcement cards).
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Colors, Typography, Radius } from '../theme';
import { CommentIcon, Chevron } from './icons';
import { CommentThread, Comment } from './CommentThread';

type Props = {
  kicker?: string;     // "A word for today" | "Encouragement"
  lead: string;        // the reflective opening line (serif italic)
  body?: string;       // optional continuation
  verse?: string;      // anchor reference, e.g. "Zechariah 4:10"
  author: { initial: string; name: string; church: string; time: string };
  commentCount?: number;
  comments?: Comment[];
};

export function LeaderWordCard({ kicker = 'A word for today', lead, body, verse, author, commentCount, comments = [] }: Props) {
  const [cOpen, setCOpen] = useState(false);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); setCOpen(v => !v); };

  return (
    <View style={s.card}>
      <View style={s.eyebrow}>
        <View style={s.dot} />
        <Text style={s.eyebrowLabel}>{kicker}</Text>
        <View style={s.eyebrowRule} />
      </View>

      <Text style={s.lead}>{lead}</Text>
      {!!body && <Text style={s.body}>{body}</Text>}

      {/* time opposite the verse anchor */}
      <View style={s.meta}>
        {verse ? <Text style={s.verse}>{verse}</Text> : <View />}
        <Text style={s.when}>{author.time}</Text>
      </View>

      {/* author row carries the right-aligned comments */}
      <View style={s.author}>
        <View style={s.av}><Text style={s.avInitial}>{author.initial}</Text></View>
        <View>
          <Text style={s.name}>{author.name}</Text>
          <Text style={s.church}>{author.church}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {commentCount != null && (
          <Pressable onPress={toggle} hitSlop={8} style={s.cc}>
            <CommentIcon />
            <Text style={[s.ccText, cOpen && { color: Colors.accent }]}>{commentCount} comments</Text>
            <View style={{ transform: [{ rotate: cOpen ? '180deg' : '0deg' }] }}><Chevron /></View>
          </Pressable>
        )}
      </View>

      {cOpen && <CommentThread comments={comments} count={commentCount ?? comments.length} onClose={() => setCOpen(false)} />}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.cardWarm, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: Radius.lg, padding: 20, overflow: 'hidden' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  lead: { fontFamily: Typography.scriptureItalic, fontSize: 22, lineHeight: 30, letterSpacing: 0.1, color: Colors.text },
  body: { fontFamily: Typography.body, fontSize: 15, lineHeight: 23, color: Colors.textMuted, marginTop: 12 },

  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  verse: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.accent },
  when: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  author: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  av: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderAccent, alignItems: 'center', justifyContent: 'center' },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 15, color: Colors.textMuted },
  name: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  church: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ccText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted },
});
