// VisibilityChangeActiveScreen — the live-call code surface (Surface 05).
//
// CD SCAFFOLD (design_handoff_visibility_change_flow · KAN-274). This is the
// screen the security floor exists for. Lift structure + tokens; wire the real
// expo-screen-capture / expo-secure-store / polling.
//
// SECURITY FLOOR (non-negotiable, Founder-locked 2026-06-27):
//   - preventScreenCaptureAsync() on focus, allowScreenCaptureAsync() on blur.
//     Blocks Android screenshots; iOS renders blank in the app-switcher.
//   - 90-second idle timeout drops the plaintext code to •••• ; tap-to-reveal.
//   - Persistent "Hide code" target (large, top-right) — one-tap blank for
//     over-shoulder defense. Independent of the idle timer.
//   - Token NEVER persisted to AsyncStorage. Only an encrypted expo-secure-store
//     entry with a 30-min TTL, for force-quit recovery.
//   - No copy-to-clipboard affordance anywhere.
//   - Token cleared on blur, app-background, AND TTL.
//   - Navigation guards prevent back-out mid-call: beforeRemove blocks the
//     gesture; Android hardware back is intercepted while status === 'in_call'.
//
// DURESS (security-class, Founder-ratified):
//   The leader learned the convention in the one-shot FirstCallSafetyBriefing:
//   "if anyone is forcing this, read the digits in REVERSE". This screen carries
//   ONLY a coded jog ("Read them in the order shown." / "The order matters.")
//   — innocuous to a room observer; meaningful to a briefed leader. The duress
//   signal is in what is SPOKEN, never in what is displayed. The screen shows
//   the canonical code either way; the BE detects a reversed submission, returns
//   success to admin, and silently flags the account for human review.
//
// Voice: clinical. No "TOTP"/"token"/"duress" user-side. Italic = scripture only.
// No greens — status uses accent/amber, never a celebratory color.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';

const IDLE_MS = 90 * 1000;

type CallStatus = 'in_call' | 'connecting' | 'validating' | 'validated' | 'expired' | 'failed';

export default function VisibilityChangeActiveScreen() {
  const navigation = useNavigation<any>();
  const { visibilityChangeRequest } = useAuth() as any;

  // Plaintext code lives in component state only — never AsyncStorage. On
  // mount it is read once from the armed request (held in secure-store, 30-min
  // TTL) so a force-quit/relaunch within TTL recovers it. We model it here as
  // a prop off the request for the scaffold.
  const code: string = visibilityChangeRequest?.code ?? '7294';
  const direction = visibilityChangeRequest?.direction ?? 'hidden_to_visible';
  const target = direction === 'hidden_to_visible' ? 'Visible' : 'Hidden';

  const [status, setStatus] = useState<CallStatus>('in_call');
  const [codeHidden, setCodeHidden] = useState(false); // Hide-code button
  const [idleBlank, setIdleBlank] = useState(false);    // 90s auto-blank
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blanked = codeHidden || idleBlank || status === 'connecting' ? false : false; // see render

  // ── idle timer ──
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setIdleBlank(false);
    idleTimer.current = setTimeout(() => setIdleBlank(true), IDLE_MS);
  }, []);

  // ── screen-capture block + lifecycle clears ──
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    armIdle();
    const sub = AppState.addEventListener('change', (s) => {
      // Clear plaintext on background; secure-store TTL handles recovery.
      if (s !== 'active') setCodeHidden(true);
    });
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      sub.remove();
      // Token cleared on blur/unmount — nothing to persist here.
    };
  }, [armIdle]);

  // ── navigation guard: no back-out mid-call ──
  useEffect(() => {
    const beforeRemove = (e: any) => {
      if (status === 'in_call' || status === 'connecting' || status === 'validating') {
        e.preventDefault();
      }
    };
    navigation.addListener('beforeRemove', beforeRemove);
    const back = BackHandler.addEventListener('hardwareBackPress', () =>
      status === 'in_call' || status === 'connecting' || status === 'validating',
    );
    return () => {
      navigation.removeListener('beforeRemove', beforeRemove);
      back.remove();
    };
  }, [navigation, status]);

  // ── status polling reconciles in_call → validated | expired | failed ──
  // On a terminal status, route to the Complete screen. The leader never sees
  // wrong-attempt counts — only the terminal outcome.
  useEffect(() => {
    if (status === 'validated' || status === 'expired' || status === 'failed') {
      navigation.replace('Complete', { status, direction });
    }
  }, [status, direction, navigation]);

  const showDots = codeHidden || idleBlank;

  return (
    <View style={styles.root} onTouchStart={armIdle}>
      <View style={styles.top}>
        <View style={styles.statusWrap}>
          <View style={[styles.sdot, status === 'connecting' && styles.sdotAmber]} />
          <Text style={styles.statusText}>
            {status === 'connecting' ? 'Connecting…' : status === 'validating' ? 'Confirming' : 'On the call'}
          </Text>
        </View>
        {status !== 'validating' && (
          <TouchableOpacity
            style={styles.hideBtn}
            activeOpacity={0.7}
            onPress={() => setCodeHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={showDots ? 'Show code' : 'Hide code'}
          >
            <Text style={styles.hideBtnText}>{showDots ? 'Show code' : 'Hide code'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {status === 'connecting' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Our team is a moment behind</Text>
          <Text style={styles.bannerText}>
            Stay on this screen — they'll connect shortly. Your code is still valid.
          </Text>
        </View>
      )}

      <View style={styles.mid}>
        {status === 'validating' ? (
          <Text style={styles.lead}>Confirming your change…</Text>
        ) : (
          <>
            <Text style={styles.lead}>
              Read these digits aloud to confirm the change to <Text style={styles.leadStrong}>{target}</Text>.
            </Text>
            <View style={styles.codeRow}>
              {code.split('').map((d, i) => (
                <Text key={i} style={[styles.digit, showDots && styles.digitDim]}>
                  {showDots ? '•' : d}
                </Text>
              ))}
            </View>
            <View style={styles.codeRule} />
            {showDots ? (
              <TouchableOpacity onPress={() => { setCodeHidden(false); armIdle(); }}>
                <Text style={styles.revealTap}>Tap to reveal</Text>
              </TouchableOpacity>
            ) : (
              // Coded duress jog — "order" is the only on-screen cue; the plain
              // teaching ('read in reverse if forced') lives in the one-shot
              // FirstCallSafetyBriefing, never repeated literally on this screen.
              <Text style={styles.codeCap}>Read them in the order shown.</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.foot}>
        <Text style={styles.secline}>
          Screen-capture blocked · code never saved · clears when you leave
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sdot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.green },
  sdotAmber: { backgroundColor: Colors.amber },
  statusText: { fontFamily: Typography.sansLight, fontSize: 12.5, color: Colors.textMuted },
  hideBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(240,237,230,0.18)', backgroundColor: 'rgba(240,237,230,0.03)' },
  hideBtnText: { fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.text },

  banner: { marginHorizontal: 20, marginTop: 12, flexDirection: 'column', gap: 3, backgroundColor: 'rgba(212,168,85,0.07)', borderWidth: 1, borderColor: 'rgba(212,168,85,0.28)', borderRadius: Radius.lg, padding: 14 },
  bannerTitle: { fontFamily: Typography.bodyMedium, fontSize: 12.5, color: Colors.amber },
  bannerText: { fontFamily: Typography.sansLight, fontSize: 11.5, color: Colors.textMuted, lineHeight: 17.25 },

  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  lead: { fontFamily: Typography.sansLight, fontSize: 13.5, color: Colors.textMuted, lineHeight: 21.6, textAlign: 'center', maxWidth: 280, marginBottom: 28 },
  leadStrong: { fontFamily: Typography.bodyMedium, color: Colors.text },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 6, paddingBottom: 18 },
  digit: { fontFamily: Typography.mono, fontSize: 68, lineHeight: 68, color: Colors.text, minWidth: 46, textAlign: 'center' },
  digitDim: { color: Colors.textSubtle, fontSize: 60 },
  codeRule: { width: 196, height: 1, backgroundColor: Colors.borderAccent, marginBottom: 16 },
  codeCap: { fontFamily: Typography.body, fontSize: 13, color: Colors.text },
  revealTap: { fontFamily: Typography.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.accent, marginTop: 4 },
  duress: { fontFamily: Typography.sansLight, fontSize: 12, color: Colors.textSubtle, marginTop: 22 },

  foot: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  secline: { fontFamily: Typography.mono, fontSize: 9, letterSpacing: 0.72, color: Colors.textSubtle, textAlign: 'center' },
});
