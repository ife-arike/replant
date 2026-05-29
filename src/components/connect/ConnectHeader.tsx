// ConnectHeader — KAN-68/69 §5.1 (HANDOFF.md).
//
// Serif title ("Connect") + subtitle ("Ministry to ministry · Held in
// confidence" on Ministries OR "Leader to leader · Held in confidence"
// on Leaders) + compose affordance at top-right.
//
// B6 (device pass): the "Tab 5 · In Confidence" eyebrow that lived
// above the title was a CD-prototype development artifact for the
// design handoff and is not part of the final product. Removed.
//
// Compose icon swaps based on sub-tab: + (Ministries → start a branch),
// pencil (Leaders → new DM). Hidden when view.kind !== 'list' so the
// back gesture is the unambiguous nav affordance on push screens.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../../constants/theme';
import type { SubTab } from '../../screens/main/ConnectScreen';

interface Props {
  subTab: SubTab;
  showCompose: boolean;
  onCompose: () => void;
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14"
        stroke={Colors.accent} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function ComposeIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4l10.5-10.5a2 2 0 0 0-2.8-2.8L5 17.2z"
        stroke={Colors.accent} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M13.5 6.5l4 4"
        stroke={Colors.accent} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function ConnectHeader({ subTab, showCompose, onCompose }: Props) {
  const subtitle = subTab === 'ministries'
    ? 'Ministry to ministry · Held in confidence'
    : 'Leader to leader · Held in confidence';

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.title}>Connect</Text>
        <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>
      </View>
      {showCompose && (
        <Pressable
          onPress={onCompose}
          style={({ pressed }) => [styles.compose, pressed && styles.composePressed]}
          accessibilityRole="button"
          accessibilityLabel={subTab === 'ministries' ? 'Start a branch' : 'New message'}
          hitSlop={8}
        >
          {subTab === 'ministries' ? <PlusIcon /> : <ComposeIcon />}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  copy: { flex: 1, minWidth: 0 },
  // B6: eyebrow style removed alongside the JSX element.
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 30,
    letterSpacing: 0.6, // 0.02em × 30pt
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.8, // 0.2em × 9pt
    color: Colors.textMuted,
  },
  compose: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  composePressed: {
    backgroundColor: 'rgba(107,181,232,0.08)',
    borderColor: 'rgba(107,181,232,0.35)',
  },
});
