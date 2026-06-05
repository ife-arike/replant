// WitnessOfDayCard — featured witness card on Bear Witness surface.
// Red-left-accent surface card. Martyr badge renders ONLY when witness.martyr === true.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography } from '../../../../constants/theme';
import MartyrBadge from './MartyrBadge';

const CREAM = '#E6E1D5';
const FAINT = 'rgba(240,237,230,0.08)';

export interface WitnessData {
  id?: string;
  era: string;
  years_label: string;
  name: string;
  region?: string;
  category: string;
  martyr: boolean;
  quote: string;
  scripture_ref: string;
}

interface WitnessOfDayCardProps {
  witness: WitnessData;
  onOpenArchive: () => void;
}

export default function WitnessOfDayCard({ witness, onOpenArchive }: WitnessOfDayCardProps) {
  return (
    <View style={styles.container}>
      {/* Header row: era pill + optional martyr badge */}
      <View style={styles.headerRow}>
        <View style={styles.eraPill}>
          <Text style={styles.eraPillText}>{witness.era}</Text>
        </View>
        {witness.martyr && <MartyrBadge />}
      </View>

      {/* Name */}
      <Text style={styles.name} accessibilityRole="header">{witness.name}</Text>

      {/* Meta line */}
      <Text style={styles.meta}>
        {witness.years_label} · {witness.category}
        {witness.region ? ` · ${witness.region}` : ''}
      </Text>

      {/* Quote */}
      <Text style={styles.quote}>{'“'}{witness.quote}{'”'}</Text>

      {/* Bottom row: scripture ref + archive link */}
      <View style={styles.bottomRow}>
        <Text style={styles.scriptureRef}>{witness.scripture_ref}</Text>
        <Pressable
          onPress={onOpenArchive}
          accessibilityRole="button"
          accessibilityLabel="Open witness archive"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.archiveLink}
        >
          <Text style={styles.archiveLinkText}>Witness archive</Text>
          <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
            <Path
              d="M4 2l4 4-4 4"
              stroke={Colors.textMuted}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: FAINT,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginHorizontal: 20,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  eraPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: Colors.textMuted,
  },
  eraPillText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 1.53,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  name: {
    fontFamily: Typography.displayRegular,
    fontSize: 24,
    color: Colors.text,
    letterSpacing: 0.24,
    marginBottom: 6,
  },
  meta: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  quote: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.17,
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scriptureRef: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: Colors.accent,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  archiveLinkText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
