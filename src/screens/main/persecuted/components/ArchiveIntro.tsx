// ArchiveIntro — red eyebrow + italic body intro block for archive screens.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../../constants/theme';

const CREAM = '#E6E1D5';

interface ArchiveIntroProps {
  eyebrow: string;
  body: string;
}

export default function ArchiveIntro({ eyebrow, body }: ArchiveIntroProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2.16, // 0.24em × 9
    textTransform: 'uppercase',
    color: Colors.red,
    marginBottom: 10,
  },
  body: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
  },
});
