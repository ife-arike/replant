// ─────────────────────────────────────────────
// LocationsView — Prayer Wall redesign (Locations pill · Coming Soon)
//
// Placeholder surface. The future feature clusters prayer requests by
// area to discern strongholds (Job 5:12). At MVP this is a quiet
// dashed-frame card with map-pin glyph, "COMING SOON" badge, body copy,
// and the Job 5:12 scripture close.
//
// Spec — docs/design_handoff_prayer_wall_redesign/README.md (Screen 6).
// ─────────────────────────────────────────────

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Typography } from '../../constants/theme';

const OFFWHITE = '#F0EDE6';
const CREAM = '#E6E1D5';
const MUTED_55 = 'rgba(240,237,230,0.55)';
const MUTED_32 = 'rgba(240,237,230,0.32)';
const FAINT_2 = 'rgba(240,237,230,0.14)';

const BODY =
  'Cluster prayer requests to discern strongholds in an area. Where the body prays, ' +
  'the map exposes the enemy’s devices — so that we can disappoint them.';
const SCRIPTURE =
  '"He disappointeth the devices of the crafty, so that their hands cannot perform their enterprise."';

export default function LocationsView() {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Svg width={48} height={48} viewBox="0 0 48 48" style={styles.glyph}>
          <Circle cx={24} cy={24} r={22} fill="none" stroke="rgba(107,181,232,0.2)" strokeWidth={0.6} strokeDasharray="2 3" />
          <Path
            d="M24 12c-4.4 0-8 3.6-8 8 0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z"
            fill="none"
            stroke="rgba(107,181,232,0.5)"
            strokeWidth={1.2}
          />
          <Circle cx={24} cy={20} r={3} fill="none" stroke="rgba(107,181,232,0.5)" strokeWidth={1.2} />
        </Svg>

        <Text style={styles.title}>Locations</Text>
        <Text style={styles.badge}>COMING SOON</Text>

        <Text style={styles.body}>{BODY}</Text>

        <Text style={styles.scripture}>{SCRIPTURE}</Text>
        <Text style={styles.ref}>JOB 5:12</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 40 },
  card: {
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: FAINT_2,
    borderRadius: 10,
    backgroundColor: 'rgba(8,8,8,0.4)',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 50,
    alignItems: 'center',
  },
  glyph: { marginBottom: 20 },
  title: {
    // Device-pass — up from 22 → 26.
    fontFamily: Typography.displayRegular,
    fontSize: 26,
    color: OFFWHITE,
    letterSpacing: 0.26,
  },
  badge: {
    // Device-pass — up from 9 → 10.
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.22 * 10,
    textTransform: 'uppercase',
    color: MUTED_32,
    marginTop: 10,
    marginBottom: 18,
  },
  body: {
    // Device-pass — up from 13 → 15.
    fontFamily: Typography.body,
    fontSize: 15,
    lineHeight: 23,
    color: MUTED_55,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: 22,
  },
  scripture: {
    // Device-pass — up from 14 → 16.
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 25,
    color: CREAM,
    textAlign: 'center',
    letterSpacing: 0.16,
    maxWidth: 290,
    marginBottom: 10,
  },
  ref: {
    // Device-pass — up from 8.5 → 10.
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 0.22 * 10,
    textTransform: 'uppercase',
    color: MUTED_32,
  },
});
