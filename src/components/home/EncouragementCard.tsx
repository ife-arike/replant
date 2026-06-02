// ─────────────────────────────────────────────
// EncouragementCard — short-form leader encouragement
// (KAN-201 card system 2026-06-02)
//
// For card_type = 'encouragement'. A leader voice, not an admin
// announcement — so there is no letterhead tag; the warm card surface
// (Colors.cardWarm) signals the type. One reflective line (the full
// message — always shown), a verse anchor opposite the time, and an
// author row below.
//
// Pastoral decision: encouragement cards are READ, not replied to — no
// comment thread renders. The commentCount / onCommentPosted props are
// accepted for routing-shape parity but intentionally unused.
//
// Underground masking: the author is resolved upstream in NetworkFeed's
// EncouragementFeedItem (underground churches are masked to "A leader in
// the network" before this card renders — SEC Obs D). author_id never
// reaches this component.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '../../constants/theme';

type Props = {
  lead: string; // the full encouragement (short — 1-2 lines)
  verse?: string; // anchor reference e.g. "Matthew 11:28"
  time: string;
  author: { initial: string; name: string; church: string };
  announcementId: string;
  // Accepted for routing-shape parity; encouragement cards do not open a
  // comment thread (pastoral decision — read, not replied to).
  commentCount?: number;
  onCommentPosted?: () => void;
};

export default function EncouragementCard({ lead, verse, time, author }: Props) {
  return (
    <View style={s.card}>
      <Text style={s.label}>Encouragement</Text>

      <Text style={s.lead}>{lead}</Text>

      <View style={s.meta}>
        {verse ? <Text style={s.verse}>{verse}</Text> : <View />}
        <Text style={s.when}>{time}</Text>
      </View>

      <View style={s.author}>
        <View style={s.av}>
          <Text style={s.avInitial}>{author.initial}</Text>
        </View>
        <View>
          <Text style={s.name}>{author.name}</Text>
          {!!author.church && <Text style={s.church}>{author.church}</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardWarm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 20,
    overflow: 'hidden',
  },

  // Quieter than the letterhead eyebrow — a single mono label, no dot.
  label: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.4, color: Colors.green, marginBottom: 14 },

  lead: { fontFamily: Typography.scriptureItalic, fontSize: 21, lineHeight: 29, letterSpacing: 0.1, color: Colors.text },

  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  verse: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 0.5, color: Colors.accent },
  when: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },

  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  av: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 15, color: Colors.textMuted },
  name: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  church: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
});
