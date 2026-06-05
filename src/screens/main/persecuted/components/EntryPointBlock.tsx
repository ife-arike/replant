// EntryPointBlock — tappable row linking to a pill tab sub-page.
// 1×38px red-mid left marker, serif title, italic sub, mono meta, right chevron.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';

const FAINT = 'rgba(240,237,230,0.08)';

interface EntryPointBlockProps {
  title: string;
  sub: string;
  meta?: string;
  onPress: () => void;
}

export default function EntryPointBlock({ title, sub, meta, onPress }: EntryPointBlockProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.container}
    >
      <View style={styles.marker} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={styles.chevron}>
        <Path
          d="M4 2l4 4-4 4"
          stroke={Colors.textMuted}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FAINT,
    alignItems: 'center',
  },
  marker: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(224,85,85,0.30)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 19,
    color: Colors.text,
    letterSpacing: 0.19,
  },
  sub: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14.5,
    color: Colors.textMuted,
    marginTop: 3,
  },
  meta: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53, // 0.18em × 8.5
    textTransform: 'uppercase',
    color: Colors.textSubtle,
    marginTop: 5,
  },
  chevron: {
    flexShrink: 0,
  },
});
