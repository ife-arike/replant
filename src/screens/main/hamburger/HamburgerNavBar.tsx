// HamburgerNavBar — shared top bar for the hamburger-sprint slide screens
// (The Vision, Outreach & Missions, FAQ). CD v5 final spec:
//   height 48, borderBottom 0.5 faint
//   left: sky back chevron (navigation.goBack()) — no label
//   center: title, DM Sans 500 14px, Colors.text (absolutely centered)
//   right: no action (transparent placeholder to balance the row)

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../../constants/theme';

interface Props {
  title: string;
  onBack: () => void;
}

export default function HamburgerNavBar({ title, onBack }: Props) {
  return (
    <View style={styles.navBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.back}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 18l-6-6 6-6"
            stroke={Colors.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Typography.display,
    fontSize: 22,
    letterSpacing: 0.5,
    color: Colors.text,
  },
});
