// components/TopBar.tsx — Home top bar.
// Wordmark "Replant" (title-case), 26pt. The Rp mark stays on Home ONLY
// (removed from Prayer Wall + Persecuted per founder, 2026-06). Excludes
// Connect & The Church, which keep their own headers.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';
import { RpMark } from './icons';

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  return (
    <View style={s.bar}>
      <View style={s.brand}>
        <RpMark width={38} height={38} />
        <Text style={s.wordmark}>Replant</Text>
      </View>
      <Pressable onPress={onMenu} hitSlop={12} style={s.menu}>
        <View style={s.line} />
        <View style={s.line} />
        <View style={s.line} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmark: {
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    letterSpacing: 0.4,
    color: Colors.text,
  },
  menu: { width: 26, alignItems: 'flex-end', gap: 5 },
  line: { width: 26, height: 1.5, borderRadius: 2, backgroundColor: Colors.text },
});
