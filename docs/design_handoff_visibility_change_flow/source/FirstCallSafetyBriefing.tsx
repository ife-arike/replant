// FirstCallSafetyBriefing — one-shot safety briefing (Surface 03).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). Shown ONCE per
// leader, the first time they reach a live call — between "I'm ready" (lobby)
// and the code reveal (active). Teaches the three things the active screen can't
// say out loud every time. After this, the active screen carries only a coded
// jog.
//
// THE DURESS TEACHING (security-class, Founder-ratified):
//   Item 3 is the only place the convention is taught in plain language:
//   "if anyone is with you and forcing this change, read the digits in REVERSE".
//   An observer reading over the shoulder here sees generic safety copy; the
//   meaning only matters to the leader on a future call. The system detects a
//   reversed submission, returns success to admin, and silently flags for human
//   review — INVISIBLE to a room observer (the screen always shows the canonical
//   code; the signal is in what is SPOKEN).
//
// Gated on a per-leader hasSeenSafetyBriefing flag in expo-secure-store; set
// true on "I understand". Non-skippable but self-paced (no timer). Item 3
// carries the one warn accent on the leader's whole path — no other reds.
//
// Voice: clinical, plain. Italic = scripture only — none here. No new tokens.

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors, Typography, Radius } from '../../constants/theme';

interface Props {
  onAcknowledge: () => void; // writes hasSeenSafetyBriefing=true, advances to active
}

const ITEMS = [
  {
    h: 'The screen protects itself',
    p: "Your code can't be screenshotted, and it blanks on its own if you set the phone down. You can hide it any time with one tap.",
    warn: false,
  },
  {
    h: 'Only your voice carries the code',
    p: "Read it aloud to the person on the call. There's no copy button and nothing to send — that's deliberate. It never leaves this phone any other way.",
    warn: false,
  },
  {
    h: 'If you are not free, read it backward',
    p: 'If anyone is with you and forcing this change, read the digits in reverse order. The call will look like it worked. No one in the room will know — and we will quietly check on you.',
    warn: true,
  },
];

export default function FirstCallSafetyBriefing({ onAcknowledge }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Before your first call</Text>
        <Text style={styles.title}>A few things to know, once</Text>

        <View style={{ marginTop: 8 }}>
          {ITEMS.map((it, i) => (
            <View key={i} style={[styles.item, i === ITEMS.length - 1 && styles.itemLast]}>
              <View style={[styles.num, it.warn && styles.numWarn]}>
                <Text style={[styles.numText, it.warn && styles.numTextWarn]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemH}>{it.h}</Text>
                <Text style={styles.itemP}>{it.p}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.foot}>
        <TouchableOpacity style={styles.cta} onPress={onAcknowledge} activeOpacity={0.85}>
          <Text style={styles.ctaText}>I understand</Text>
        </TouchableOpacity>
        <Text style={styles.footCap}>
          You won't see this again. The reverse-the-digits signal works on every call.
        </Text>
      </View>
    </View>
  );
}

const HAIR = 'rgba(240, 237, 230, 0.18)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 14 },
  eyebrow: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: Colors.accent, marginBottom: 14 },
  title: { fontFamily: Typography.display, fontSize: 26, color: Colors.text, lineHeight: 30, marginBottom: 8 },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  itemLast: { borderBottomWidth: 0 },
  num: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: Colors.borderAccent, alignItems: 'center', justifyContent: 'center' },
  numWarn: { borderColor: 'rgba(224,85,85,0.4)' },
  numText: { fontFamily: Typography.mono, fontSize: 11, color: Colors.accent },
  numTextWarn: { color: '#e8918b' },
  itemH: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.text, marginBottom: 5 },
  itemP: { fontFamily: Typography.sansLight, fontSize: 12.5, color: Colors.textMuted, lineHeight: 20.25 },
  foot: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: 11 },
  cta: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.background },
  footCap: { fontFamily: Typography.sansLight, fontSize: 11, color: Colors.textSubtle, textAlign: 'center', lineHeight: 16.5 },
});
