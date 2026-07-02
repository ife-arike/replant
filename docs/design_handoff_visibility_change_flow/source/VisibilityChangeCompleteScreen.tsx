// VisibilityChangeCompleteScreen — terminal outcome (Surface 06).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). Three terminal
// faces, keyed on the resolved status:
//   validated + hidden_to_visible → success, sky accent
//   validated + visible_to_hidden → success, muted accent
//   expired | failed              → single failure variant (leader never learns
//                                   which, and never sees attempt counts)
//
// ENDGAME COPY — LOCKED VERBATIM (Founder 2026-06-28, Q6 reframe). Rendered
// ROMAN, not italic (italic = scripture only; the brief quotes them in italics
// only as markdown emphasis). Hidden vs Visible = name display only — both
// states retain full underground functionality; location stays hidden either
// way.
//   Hidden → Visible : "Your church name now shows in the network."
//   Visible → Hidden : "Your church name is now hidden."
//   Failure          : "We didn't connect. Choose a new window when you're ready."
//
// NO greens, NO celebratory flare on this sensitive action — success tracks the
// new state with accent / muted, never a green check. Done returns to Settings;
// the failure CTA re-enters the schedule picker with the same direction pre-set.
//
// Voice: clinical, calm. No new tokens.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Typography, Radius } from '../../constants/theme';

type Status = 'validated' | 'expired' | 'failed';
type Direction = 'hidden_to_visible' | 'visible_to_hidden';

export default function VisibilityChangeCompleteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const status: Status = route.params?.status ?? 'validated';
  const direction: Direction = route.params?.direction ?? 'hidden_to_visible';

  const done = () => {
    navigation.popToTop();
    navigation.navigate('Tabs', { screen: 'Settings' });
  };

  // ── failure ──
  if (status === 'expired' || status === 'failed') {
    const stillState = direction === 'hidden_to_visible' ? 'Hidden' : 'Visible';
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <View style={[styles.mark, styles.markFail]}>
            <Text style={styles.markGlyph}>◷</Text>
          </View>
          <Text style={styles.eyebrow}>Not this time</Text>
          <Text style={styles.title}>We didn't connect. Choose a new window when you're ready.</Text>
          <Text style={styles.body}>
            Nothing changed — your church is still <Text style={styles.bodyStrong}>{stillState}</Text>.
            This happens; pick another time you'll be free to talk and we'll try again.
          </Text>
        </View>
        <View style={styles.foot}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={() => navigation.replace('Schedule', { direction })}
          >
            <Text style={styles.ctaText}>Choose a new window</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={done} activeOpacity={0.7}>
            <Text style={styles.ghostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── success ──
  const toVisible = direction === 'hidden_to_visible';
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={[styles.mark, !toVisible && styles.markHidden]}>
          <Text style={[styles.markGlyph, { color: toVisible ? Colors.accent : Colors.textMuted }]}>
            {toVisible ? '◉' : '⦵'}
          </Text>
        </View>
        <Text style={styles.eyebrow}>Change confirmed</Text>
        <View style={[styles.pill, !toVisible && styles.pillHidden]}>
          <View style={[styles.pillDot, !toVisible && styles.pillDotHidden]} />
          <Text style={[styles.pillLbl, !toVisible && styles.pillLblHidden]}>
            {toVisible ? 'Now Visible' : 'Now Hidden'}
          </Text>
        </View>
        <Text style={styles.title}>
          {toVisible ? 'Your church name now shows in the network.' : 'Your church name is now hidden.'}
        </Text>
        <Text style={styles.body}>
          {toVisible ? (
            <>
              Other leaders can now see your church's name. Your{' '}
              <Text style={styles.bodyStrong}>location stays hidden</Text> — only your region is ever shown.
            </>
          ) : (
            <>
              Other leaders will see <Text style={styles.bodyStrong}>"Underground Church"</Text> and your
              region only. Your church name is withheld.
            </>
          )}
        </Text>
      </View>
      <View style={styles.foot}>
        <TouchableOpacity style={styles.cta} onPress={done} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const HAIR = 'rgba(240, 237, 230, 0.18)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  mark: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: Colors.borderAccent, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  markHidden: { borderColor: HAIR },
  markFail: { borderColor: HAIR },
  markGlyph: { fontSize: 22, color: Colors.textMuted },
  eyebrow: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: Colors.textMuted, marginBottom: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderAccent, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 5, marginBottom: 18 },
  pillHidden: { borderColor: HAIR },
  pillDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent },
  pillDotHidden: { backgroundColor: Colors.textMuted },
  pillLbl: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: Colors.accent },
  pillLblHidden: { color: Colors.textMuted },
  title: { fontFamily: Typography.display, fontSize: 28, color: Colors.text, lineHeight: 33.6, textAlign: 'center', marginBottom: 16, maxWidth: 300 },
  body: { fontFamily: Typography.sansLight, fontSize: 13.5, color: Colors.textMuted, lineHeight: 22.95, textAlign: 'center', maxWidth: 300 },
  bodyStrong: { fontFamily: Typography.bodyMedium, color: Colors.text },
  foot: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30, gap: 11 },
  cta: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.background },
  ghost: { minHeight: 48, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textMuted },
});
