// components/ScriptureStrip.tsx — daily verse.
// PREFERRED: variant="open" (unboxed, faint hanging quote).
// ALTERNATE: variant="rule" (a 2px sky rule in the margin). No box, no candle.
// Font is unchanged from today: Typography.scriptureItalic (Cormorant 300 italic).
// Internals are otherwise owned by CC per existing rule — this only restyles the frame.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';

type Props = {
  verse: string;
  reference: string;   // book + chapter:verse, e.g. "Revelation 22:20"
  translation?: string; // e.g. "KJV"
  variant?: 'open' | 'rule';
};

export function ScriptureStrip({ verse, reference, translation = 'KJV', variant = 'open' }: Props) {
  return (
    <View style={[s.wrap, variant === 'rule' && s.ruleWrap]}>
      {variant === 'rule' && <View style={s.rule} />}
      {variant === 'open' && <Text style={s.quote}>{'\u201C'}</Text>}
      <Text style={s.verse}>{verse}</Text>
      <Text style={s.ref}>
        <Text style={s.refBook}>{reference}</Text>
        {translation ? ` \u00B7 ${translation}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative', paddingHorizontal: 4, paddingTop: 24, paddingBottom: 18 },
  ruleWrap: { paddingLeft: 24 },
  rule: { position: 'absolute', left: 4, top: 8, bottom: 34, width: 2, borderRadius: 2, backgroundColor: Colors.accent },
  quote: {
    position: 'absolute', top: -8, left: -4,
    fontFamily: Typography.displayMedium, fontSize: 64, lineHeight: 64,
    color: 'rgba(107,181,232,0.12)',
  },
  verse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 23,
    lineHeight: 33,        // ≈ 1.42
    letterSpacing: 0.2,
    color: Colors.text,
  },
  ref: {
    fontFamily: Typography.mono,
    fontSize: 13,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    marginTop: 18,
  },
  refBook: { color: Colors.accent },
});
