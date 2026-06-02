// components/CommentThread.tsx — opens in place on a card.
// Conversational sans (NOT scripture italic). Under-threat leaders post with a
// held identity: lock avatar · "A leader in the network" · region withheld.
// Two ways to close: the card's footer toggle, or the "Hide" control here.
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Colors, Typography, Radius } from '../theme';
import { RpMark, LockIcon, Chevron } from './icons';

export type Comment = {
  id: string;
  name: string;
  church: string;     // or region label for masked authors
  time: string;
  text: string;
  initial?: string;   // avatar letter
  team?: boolean;     // Replant team → Rp mark avatar
  masked?: boolean;   // under-threat → lock avatar, no name/location
};

export function CommentThread({ comments, count, onClose }: { comments: Comment[]; count: number; onClose: () => void }) {
  const [draft, setDraft] = useState('');
  return (
    <View>
      <View style={s.head}>
        <Text style={s.headLabel}>Comments {'\u00B7'} {count}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={s.hide}>
          <Text style={s.hideText}>Hide</Text>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Chevron color={Colors.accent} /></View>
        </Pressable>
      </View>

      <View style={s.list}>
        {comments.map(c => (
          <View key={c.id} style={s.row}>
            <View style={[s.av, (c.team || c.masked) && s.avRound]}>
              {c.team ? <RpMark width={18} height={18} />
                : c.masked ? <LockIcon />
                : <Text style={s.avInitial}>{c.initial}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.crow}>
                <Text style={s.cname}>{c.name}</Text>
                <Text style={s.cchurch}>{c.church}</Text>
                <Text style={s.ctime}>{c.time}</Text>
              </View>
              <Text style={s.ctext}>{c.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.compose}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a word…"
          placeholderTextColor={Colors.textSubtle}
          style={s.field}
        />
        <Text style={s.send}>Post</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  headLabel: { fontFamily: Typography.mono, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.4 },
  hide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hideText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.accent, letterSpacing: 0.4 },

  list: { marginTop: 16, gap: 18 },
  row: { flexDirection: 'row', gap: 11 },
  av: { width: 30, height: 30, borderRadius: Radius.sm + 4, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  avRound: { borderRadius: 15 },
  avInitial: { fontFamily: Typography.displayRegular, fontSize: 14, color: Colors.textMuted },
  crow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cname: { fontFamily: Typography.bodyMedium, fontSize: 13.5, color: Colors.text },
  cchurch: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
  ctime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle, marginLeft: 'auto' },
  ctext: { fontFamily: Typography.body, fontSize: 14, lineHeight: 21, color: 'rgba(240,237,230,0.72)', marginTop: 4 },

  compose: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  field: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 10, fontFamily: Typography.body, fontSize: 13, color: Colors.text },
  send: { fontFamily: Typography.mono, fontSize: 11.5, color: Colors.accent, letterSpacing: 0.4 },
});
