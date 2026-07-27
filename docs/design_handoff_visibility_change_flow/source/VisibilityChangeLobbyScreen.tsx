// VisibilityChangeLobbyScreen — pre-call pre-arm (Surface 04).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). Surfaces off
// ROOT (above the tab tree, like JoinCodeReveal) when the T-15 silent push sets
// visibilityChangeRequest.status === 'revealed'. The leader is NEVER logged out
// to see it.
//
// "I'm ready" is the leader's PRE-ARM: it tells the admin the leader is present
// and unobserved. Only after this tap does the code mint and the admin dial —
// so the code never exists while the phone is in someone else's hand. First
// call only, "I'm ready" routes through FirstCallSafetyBriefing before the
// active screen; later calls go straight to active.
//
// Reschedule + Cancel stay available right up to the pre-arm tap. After it,
// back-out is guarded on the active screen.
//
// Voice: clinical. Italic = scripture only — none here. No new tokens.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';

const BRIEFING_KEY = 'rp-vc-safety-briefing-seen';

export default function VisibilityChangeLobbyScreen() {
  const navigation = useNavigation<any>();
  const { visibilityChangeRequest } = useAuth() as any;
  const [arming, setArming] = useState(false);

  const direction = visibilityChangeRequest?.direction ?? 'hidden_to_visible';
  const dirLabel = direction === 'hidden_to_visible' ? 'Hidden → Visible' : 'Visible → Hidden';
  const windowLabel = visibilityChangeRequest?.windowLabel ?? 'Today · 14:00 – 16:00';

  const onReady = async () => {
    if (arming) return;
    setArming(true);
    // POST arm-visibility-call → mints the code, flips status to in_call.
    // First call only: route through the safety briefing first.
    const seen = await SecureStore.getItemAsync(BRIEFING_KEY);
    if (seen !== 'true') {
      navigation.navigate('SafetyBriefing');
    } else {
      navigation.replace('Active');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.scroll}>
        <Text style={styles.eyebrow}>Your verification call</Text>
        <Text style={styles.title}>It's almost time</Text>
        <Text style={styles.body}>
          When you're somewhere private and ready to talk, tap{' '}
          <Text style={styles.bodyStrong}>I'm ready</Text>. Our team will call within your window.
          Your code appears only after you're ready.
        </Text>

        <View style={styles.schedCard}>
          <Text style={styles.schedEyebrow}>Scheduled window</Text>
          <Text style={styles.schedWhen}>{windowLabel}</Text>
          <Text style={styles.schedSub}>Changing {dirLabel}</Text>
        </View>

        <Text style={styles.note}>
          Stay on this screen once you've tapped ready — the call comes through here.
        </Text>
      </View>

      <View style={styles.foot}>
        <TouchableOpacity style={styles.cta} onPress={onReady} activeOpacity={0.85} disabled={arming}>
          <Text style={styles.ctaText}>I'm ready</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghost}
          onPress={() => navigation.navigate('Schedule', { reschedule: true, direction })}
          activeOpacity={0.7}
        >
          <Text style={styles.ghostText}>Reschedule</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Cancel')} activeOpacity={0.7}>
          <Text style={styles.cancelCap}>
            Need to stop? <Text style={styles.cancelStrong}>Cancel this request</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1, paddingHorizontal: 26, paddingTop: 24 },
  eyebrow: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: Colors.accent, marginBottom: 14 },
  title: { fontFamily: Typography.display, fontSize: 30, color: Colors.text, lineHeight: 34.8, marginBottom: 16 },
  body: { fontFamily: Typography.sansLight, fontSize: 13.5, color: Colors.textMuted, lineHeight: 23.2, marginBottom: 12 },
  bodyStrong: { fontFamily: Typography.bodyMedium, color: Colors.text },
  schedCard: { borderWidth: 1, borderColor: Colors.borderAccent, backgroundColor: 'rgba(107,181,232,0.04)', borderRadius: Radius.lg, padding: 15, marginTop: 8 },
  schedEyebrow: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 1.44, textTransform: 'uppercase', color: Colors.accent, marginBottom: 9 },
  schedWhen: { fontFamily: Typography.display, fontSize: 19, color: Colors.text, lineHeight: 23.75, marginBottom: 4 },
  schedSub: { fontFamily: Typography.sansLight, fontSize: 12, color: Colors.textMuted },
  note: { fontFamily: Typography.sansLight, fontSize: 12.5, color: Colors.textMuted, lineHeight: 20, marginTop: 20 },
  foot: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: 11 },
  cta: { minHeight: 54, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: Typography.bodyMedium, fontSize: 15.5, color: Colors.background },
  ghost: { minHeight: 48, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textMuted },
  cancelCap: { fontFamily: Typography.sansLight, fontSize: 11, color: Colors.textSubtle, textAlign: 'center', paddingTop: 2 },
  cancelStrong: { color: Colors.textMuted },
});
