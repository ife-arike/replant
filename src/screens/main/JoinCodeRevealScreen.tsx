// ─────────────────────────────────────────────
// JoinCodeRevealScreen — NEW (Ask 3 · Rulings #2 + #3 + #6)
//
// One-shot reveal of the founding leader's invite code. Triggered by
// auth-status-check returning underground_join_code_pending_reveal:true
// on a verified underground founder's first post-verification sign-in.
//
// Per Founder ratification 2026-06-20 (override of original CD design):
//   The route is NOT forced. The FIRST screen the leader sees is a
//   pre-reveal "I'm somewhere private" gate that allows them to cancel
//   and come back later. Multi-session safe.
//
// Flow inside the screen (3 internal stages):
//   1. PRE-REVEAL GATE — "Make sure you're somewhere private."
//        Buttons: [I'm somewhere private — show code] · [Cancel, come
//        back later]. Cancel → navigation.goBack(); next sign-in
//        re-surfaces the prompt via auth-status-check.
//   2. CODE DISPLAY — after server-side reveal succeeds. Full-screen
//        takeover. Underlined quiet code block; copy-on-tap. From here
//        the leader cannot back-out (gestureEnabled:false on the route);
//        Android hardware back is intercepted.
//   3. CONFIRM-DISMISS — "Are you sure? We will not show this code
//        again." [Show me again] / [Yes, I have it]. Yes → navigate back
//        to Home.
//
// Screenshot defense:
//   Android — react-native-prevent-screen-capture / FLAG_SECURE is NOT
//             yet installed in this codebase. The package is documented
//             in the dispatch; leaving an inline TODO marker so the
//             follow-up FE ticket can wire it without re-deriving.
//   iOS    — Cannot block capture. We subscribe to
//             userDidTakeScreenshotNotification via NativeAppEventEmitter
//             (RN-builtin) and surface the red warning state. Detection
//             is best-effort; on modern iOS the API is restricted but
//             the notification still fires for many capture events.
//
// MFA leverage (#19) — surfaced as an inline coming-soon prompt below
// the code. MFA enrollment infrastructure isn't built yet; placeholder
// keeps the design contract visible without claiming a flow that doesn't
// exist. Replace with a real CTA when MFA is shipped.
// ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  BackHandler,
  ScrollView,
  NativeAppEventEmitter,
  NativeEventEmitter,
  NativeModules,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';

// 2026-06-20 — expo-haptics + expo-screen-capture are installed in
// package.json but require a native rebuild (npx expo run:ios) before
// the ExpoHaptics / ExpoScreenCapture native modules load. Defensive
// require here so the dev-client build pre-rebuild doesn't crash with
// "Cannot find native module 'ExpoScreenCapture'". Once the native
// rebuild lands, these resolve normally and the screen-capture +
// haptic protections become active. Until then they no-op silently.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ScreenCapture: any = null;
try { Haptics = require('expo-haptics'); } catch { /* native rebuild needed */ }
try { ScreenCapture = require('expo-screen-capture'); } catch { /* native rebuild needed */ }
import { revealJoinCode } from '../../api/underground';
import { newIdempotencyKey } from '../../utils/idempotency';
import type { RootStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'JoinCodeReveal'>;

type Stage = 'gate' | 'revealing' | 'shown' | 'consumed';

export default function JoinCodeRevealScreen() {
  const navigation = useNavigation<NavProp>();

  const [stage, setStage] = useState<Stage>('gate');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [shotWarn, setShotWarn] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Swallow Android hardware back once we've revealed the code. The pre-
  // reveal gate still allows back (we want the leader to be able to
  // cancel cleanly).
  useEffect(() => {
    if (stage !== 'shown' && stage !== 'consumed') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [stage]);

  // Screenshot defense — 2026-06-20: packages installed and wired.
  //   Android: expo-screen-capture's preventScreenCaptureAsync() applies
  //     FLAG_SECURE while the code is shown. Blocks screenshots AND screen
  //     recordings at the OS level.
  //   iOS: cannot block; we both call preventScreenCaptureAsync (Expo's
  //     no-op on iOS) AND subscribe to Expo's own
  //     addScreenshotListener — fires on actual screenshot capture and
  //     flips the visible red warning state.
  // Active only while stage === 'shown' (gate + confirm don't expose the
  // code; consumed state has already cleared the plaintext).
  useEffect(() => {
    if (stage !== 'shown') return;

    let active = true;
    if (!ScreenCapture) return; // native module not in this build — silent no-op
    void ScreenCapture.preventScreenCaptureAsync('underground-reveal').catch(() => {
      // best-effort; some Android devices reject FLAG_SECURE — fall through
    });

    // Expo's first-party screenshot listener (iOS-only in practice; Android
    // returns a no-op subscription). Cleaner than NativeAppEventEmitter.
    const expoSub = ScreenCapture.addScreenshotListener?.(() => {
      if (active) setShotWarn(true);
    });

    return () => {
      active = false;
      expoSub?.remove?.();
      void ScreenCapture.allowScreenCaptureAsync('underground-reveal').catch(() => {});
    };
  }, [stage]);

  // Legacy iOS screenshot listener via NativeAppEventEmitter — kept as a
  // belt-and-suspenders backup behind the expo-screen-capture listener
  // above. Some integrations bridge UIApplicationUserDidTakeScreenshot via
  // alternate channels.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (stage !== 'shown') return;

    // Prefer the native module event emitter if available; fall back to
    // NativeAppEventEmitter so older RN clients still register the
    // listener. Either way we just flip the warn state.
    let subscription: { remove: () => void } | undefined;
    try {
      // userDidTakeScreenshotNotification is the system notification name.
      // RN doesn't expose it as a typed event; we register on the global
      // emitter so any module that bridges it can fire the callback.
      subscription = NativeAppEventEmitter.addListener(
        'userDidTakeScreenshot',
        () => setShotWarn(true),
      );
    } catch {
      // ignore — best-effort
    }

    // Some integrations expose it under a different module name.
    let secondary: { remove: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (NativeModules as Record<string, any>).ScreenshotDetector;
      if (mod) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emitter = new NativeEventEmitter(mod as any);
        secondary = emitter.addListener('UIApplicationUserDidTakeScreenshotNotification', () =>
          setShotWarn(true),
        );
      }
    } catch {
      // ignore
    }

    return () => {
      subscription?.remove();
      secondary?.remove();
    };
  }, [stage]);

  const cancelGate = () => {
    // Leader chose to come back later. auth-status-check will surface
    // the prompt again on next sign-in / app foreground.
    navigation.goBack();
  };

  const proceedToReveal = async () => {
    if (stage !== 'gate') return;
    setStage('revealing');
    setRevealError(null);

    const idempotencyKey = newIdempotencyKey();
    const res = await revealJoinCode({ idempotencyKey });

    if (res.ok) {
      setCode(res.joinCode);
      setStage('shown');
      return;
    }

    // Map server failures. code_already_consumed = a prior reveal landed
    // (or our cache thinks so); rotation is the only recovery.
    let msg: string;
    switch (res.reason) {
      case 'code_already_consumed':
        msg =
          'This code has already been viewed. If you’ve lost it, please contact the Replant team.';
        break;
      case 'unauthorized':
      case 'not_authorized':
      case 'not_found':
        msg = 'We couldn’t verify your church right now. Please try again later.';
        break;
      default:
        msg = 'We couldn’t reveal the code right now. Please check your connection and try again.';
    }
    setRevealError(msg);
    setStage('gate');
  };

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    // Success haptic — short Light tap. The leader is copying a code under
    // stress; the haptic is the "I got it" confirmation independent of
    // visual feedback (which they may not be watching). Best-effort —
    // silently ignored on devices without haptic hardware OR pre-rebuild
    // dev-clients that don't have the native module yet.
    if (Haptics?.impactAsync) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1900);
  };

  const onContinueTap = () => setConfirm(true);

  const onConfirmDone = () => {
    setConfirm(false);
    setStage('consumed');
    // Drop the in-memory plaintext now. The leader has confirmed they
    // saved it; we never want to keep it around in JS heap any longer
    // than needed.
    setCode(null);
    navigation.goBack();
  };

  // ── Stage: GATE ───────────────────────────────────────────────────
  if (stage === 'gate' || stage === 'revealing') {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>TRUSTED INVITE</Text>
          <Text style={styles.title}>One trusted leader at a time</Text>

          <Text style={styles.body}>
            Your invite code is ready. Before we show it: make sure
            you&rsquo;re <Text style={styles.b}>somewhere private</Text>. The
            code will be shown <Text style={styles.b}>once</Text> and cannot
            be shown again from inside the app.
          </Text>

          <Text style={styles.body}>
            If now is not the right moment, choose &ldquo;Come back later&rdquo;.
            We&rsquo;ll prompt you again next time you sign in.
          </Text>

          {revealError && (
            <View style={styles.errBlock}>
              <Text style={styles.errText}>{revealError}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.foot}>
          <TouchableOpacity
            style={[styles.cta, stage === 'revealing' && styles.ctaDisabled]}
            onPress={proceedToReveal}
            activeOpacity={0.85}
            disabled={stage === 'revealing'}
          >
            {stage === 'revealing' ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.ctaText}>I&rsquo;m somewhere private — show code</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaGhost}
            onPress={cancelGate}
            activeOpacity={0.7}
            disabled={stage === 'revealing'}
          >
            <Text style={styles.ctaGhostText}>Cancel, come back later</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Stage: SHOWN or CONSUMED ──────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TRUSTED INVITE</Text>
        <Text style={styles.title}>One trusted leader at a time</Text>

        {shotWarn && (
          <View style={styles.shotWarn}>
            <View style={styles.shotIco}>
              <Text style={styles.shotIcoText}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shotTitle}>Screenshot detected</Text>
              <Text style={styles.shotText}>
                A screen capture was taken. This code is a key to your fellowship —
                delete the image, and never store or send it. Share it only
                face-to-face.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.body}>
          If God brings another leader into your fellowship who needs to be on
          Replant with you, give them this code{' '}
          <Text style={styles.b}>in person, by hand</Text>. Anyone you give it
          to will be able to join your church on Replant. No one without it can.
        </Text>

        <Text style={styles.once}>
          We will show this to you once. We cannot show it to you again.
        </Text>

        {/* Founder-final: QUIET code block (underlined, no box). */}
        <TouchableOpacity
          style={styles.codeQuiet}
          onPress={copy}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy invite code"
        >
          <Text style={styles.codeText}>{code ?? ''}</Text>
        </TouchableOpacity>
        <View style={styles.tapHint}>
          <Text style={[styles.tapHintText, copied && styles.tapHintCopied]}>
            {copied ? '✓  Copied' : '⧉  Tap to copy'}
          </Text>
        </View>

        <Text style={styles.body}>
          Write it down somewhere only you can reach. Do not save it to this
          phone, do not send it in a message, do not put it in email. Share it
          only face-to-face with someone you would trust with your life.
        </Text>

        {/* MFA leverage prompt (#19). MFA enrollment infrastructure isn't
            built yet — surfacing as a coming-soon placeholder so the design
            contract is visible. Replace with a real CTA when MFA ships. */}
        <View style={styles.mfaBlock}>
          <Text style={styles.mfaTitle}>Two-step verification</Text>
          <Text style={styles.mfaBody}>
            Coming soon: enable two-step verification to add another layer of
            protection to your church&rsquo;s account.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.foot}>
        <TouchableOpacity
          style={styles.cta}
          onPress={onContinueTap}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>I have saved this — continue</Text>
        </TouchableOpacity>
      </View>

      {/* Pre-dismiss confirm — the only way off this screen once revealed. */}
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { /* swallow */ }}>
        <View style={styles.modalScrim}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              We will not show this code again. If you lose it, you&rsquo;ll
              need to contact the Replant team directly to issue a new one.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.ghost]}
                onPress={() => setConfirm(false)}
              >
                <Text style={styles.ghostText}>Show me again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.danger]}
                onPress={onConfirmDone}
              >
                <Text style={styles.dangerText}>Yes, I have it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy toast */}
      {copied && (
        <View style={styles.toast}>
          <View style={styles.toastCheck}>
            <Text style={styles.toastCheckText}>✓</Text>
          </View>
          <Text style={styles.toastText}>Code copied</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingTop: 72,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 2.2,
    color: Colors.accent,
    textTransform: 'uppercase',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 30,
    color: Colors.text,
    lineHeight: 35,
    marginBottom: 18,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 23,
    marginBottom: 12,
  },
  b: { fontFamily: Typography.bodyMedium, color: Colors.text },
  once: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    color: Colors.text,
    lineHeight: 25,
    marginVertical: 6,
    marginBottom: 24,
    paddingLeft: 16,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.borderAccent,
  },

  codeQuiet: {
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderAccent,
  },
  codeText: {
    fontFamily: Typography.mono,
    fontSize: 30,
    letterSpacing: 4,
    color: Colors.text,
  },
  tapHint: { alignItems: 'center', marginTop: 12, marginBottom: 22 },
  tapHintText: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: Colors.textSubtle,
    textTransform: 'uppercase',
  },
  tapHintCopied: { color: Colors.green },

  mfaBlock: {
    backgroundColor: 'rgba(107,181,232,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderAccent,
    borderRadius: Radius.lg,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  mfaTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
  },
  mfaBody: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 18,
  },

  foot: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 12,
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15.5,
    color: Colors.background,
  },
  ctaGhost: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },

  errBlock: {
    borderWidth: 1,
    borderColor: 'rgba(224,85,85,0.28)',
    backgroundColor: 'rgba(224,85,85,0.07)',
    borderRadius: Radius.lg,
    padding: 13,
    marginTop: Spacing.md,
  },
  errText: {
    fontFamily: Typography.body,
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 18,
  },

  modalScrim: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  modal: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(240,237,230,0.14)',
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontFamily: Typography.display,
    fontSize: 23,
    color: Colors.text,
    marginBottom: 12,
  },
  modalBody: {
    fontFamily: Typography.body,
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 21,
    marginBottom: 22,
  },
  modalActions: { gap: 10 },
  modalBtn: {
    minHeight: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1, borderColor: Colors.border },
  ghostText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textMuted,
  },
  danger: { backgroundColor: 'rgba(224,85,85,0.12)' },
  dangerText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.red,
  },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 156,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(20,22,20,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(91,173,122,0.4)',
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCheckText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.background,
  },
  toastText: { fontFamily: Typography.body, fontSize: 13, color: Colors.text },

  shotWarn: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(224,85,85,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(224,85,85,0.28)',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 22,
  },
  shotIco: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(224,85,85,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotIcoText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.red,
  },
  shotTitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.red,
    marginBottom: 4,
  },
  shotText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '300',
    lineHeight: 17,
  },
});
