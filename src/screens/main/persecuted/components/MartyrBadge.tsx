// MartyrBadge — red badge with filled circle marker.
// Renders only when witness.martyr === true. mono caps, red text,
// 0.5px red-mid border, red 5% bg.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';

export default function MartyrBadge() {
  return (
    <View style={styles.container}>
      <Svg width={7} height={7} viewBox="0 0 8 8">
        <Circle cx={4} cy={4} r={3} fill={Colors.red} />
      </Svg>
      <Text style={styles.label}>MARTYR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(224,85,85,0.30)',
    backgroundColor: 'rgba(224,85,85,0.05)',
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.44,
    color: Colors.red,
  },
});
