// FeedEyebrow — the ONE letterhead eyebrow for Home feed cards (KAN-348).
// dot + label + hairline rule + time. The 2026-08-10 audit found this row
// pasted into six cards with five behaviours — urgent silently dropped on
// three of them — so every card now consumes this component and the Day-1
// rulings it upholds live here and nowhere else:
//   · dots are the WHITE/connective register (green retired, Founder
//     2026-07-28) — colour rides the Tags map, or `baseColor` for the
//     leader-voice registers; never a per-card literal.
//   · dot MOTION is URGENT-ONLY (Founder 2026-07-28 device walk): the
//     halo breathes (~1.8s) only when tag='urgent', frozen under reduced
//     motion. Every other register holds still.
//   · an urgent tag ALWAYS wins the dot treatment, whatever card type
//     carries it — tag_type and card_type are orthogonal by ruling.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, Tags, Typography, type TagType } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';

type Props = {
  // Colour + urgency driver. Optional: the leader-voice registers have no
  // tag-coloured identity and pass baseColor instead — but when the feed
  // hands them an 'urgent' tag, urgent takes the dot over regardless.
  tag?: TagType;
  label: string;
  time?: string;
  // Non-urgent colour override for registers whose dot is not tag-driven
  // (leader-voice white, Together's connective white).
  baseColor?: string;
  // Announcement 'rule' variant renders its eyebrow dotless.
  showDot?: boolean;
};

export default function FeedEyebrow({ tag, label, time, baseColor, showDot = true }: Props) {
  const reduced = useReducedMotion();
  const urgent = tag === 'urgent';
  const color = urgent
    ? Tags.urgent.color
    : (baseColor ?? (tag ? Tags[tag].color : Colors.text));

  // Urgent dot halo: a slow, gentle breathing pulse (~1.8s period). Only
  // the halo animates — the dot itself stays solid.
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, reduced, blinkAnim]);

  return (
    <View style={s.eyebrow}>
      {showDot && (
        <View style={s.dotWrap}>
          <Animated.View
            style={[s.dotHalo, { backgroundColor: color + '30', opacity: urgent ? blinkAnim : 1 }]}
          />
          <View style={[s.dot, { backgroundColor: color }]} />
        </View>
      )}
      <Text style={s.eyebrowLabel}>{label}</Text>
      <View style={s.eyebrowRule} />
      {time != null && <Text style={s.eyebrowTime}>{time}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  dotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 11, height: 11, borderRadius: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowLabel: { fontFamily: Typography.mono, fontSize: 10.5, letterSpacing: 1.26, color: Colors.textMuted },
  eyebrowRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  eyebrowTime: { fontFamily: Typography.mono, fontSize: 10, color: Colors.textSubtle },
});
