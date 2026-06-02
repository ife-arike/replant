// ChurchTutorialOverlay — 5-step onboarding for The Church tab
//
// Design source: docs/design_handoff_the_church_tab/church-tab/tutorial.jsx
// Founder rulings 2026-06-04:
//   - Step 2: snap CAML camera to church's registered location (instant, 0ms).
//   - Step 3 (swipe): drop Modal; show upward arrow at horizon bar; advance
//     when currentPage flips to 1.
//   - Step 4 (prayer wall): same interactive treatment; downward arrow pointing
//     at pull-up handle; advance when prayerWallSnap !== 'collapsed' OR after
//     4 s auto-advance so the leader isn't stuck.
//   - Steps 0, 1, 4: full-screen Modal with SVG spotlight cut-out.
// "Seen" flag persisted to SecureStore (key: tutorial_church_tab_seen).
// No expo-blur per invariant.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Svg, { Line, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';

export const TUTORIAL_SEEN_KEY = 'tutorial_church_tab_seen';

const { width: W, height: H } = Dimensions.get('window');

const STEP_WELCOME = 0;
const STEP_CAML    = 1;
const STEP_SWIPE   = 2;
const STEP_PRAYER  = 3;
const STEP_LAST    = 4;

interface TutorialStep {
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: TutorialStep[] = [
  {
    eyebrow: 'Welcome',
    title: 'This is The Church.',
    body: "Two pages. Your location, and the global body. You'll move between them with a swipe — just like turning your eyes from the room to the horizon.",
  },
  {
    eyebrow: 'At My Location',
    title: 'Your church is here.',
    body: "The sky-blue marker is pinned to your church's registered location. But this page centres on your physical location — it shows churches near where you are right now. Tap the marker to see how others see you, or tap any dot to open their profile.",
  },
  // STEP_SWIPE — handled by SwipeHint (no Modal card)
  { eyebrow: '', title: '', body: '' },
  // STEP_PRAYER — handled by PrayerHint (no Modal card)
  { eyebrow: '', title: '', body: '' },
  {
    eyebrow: 'A note before you enter',
    title: 'Some are not pictured.',
    body: "Underground churches are part of this network too. They're not shown on any map for their protection — but they're in our prayers, and yours.",
  },
];

interface Props {
  onComplete: () => void;
  /** Called when tutorial enters step 2 — host snaps CAML camera to church. */
  onRequestPanToChurch?: () => void;
  /** Called when tutorial leaves step 2 — host snaps CAML back to GPS. */
  onRequestRecenterToGPS?: () => void;
  /** Current page in TheChurchScreen: 0 = CAML, 1 = At Large. */
  currentPage: 0 | 1;
  /** Prayer wall snap state — when not 'collapsed', auto-advances from step 4. */
  prayerWallSnap: 'collapsed' | 'half' | 'full';
}

export default function ChurchTutorialOverlay({
  onComplete, onRequestPanToChurch, onRequestRecenterToGPS, currentPage, prayerWallSnap,
}: Props) {
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const s = STEPS[step];
  const isLast       = step === STEP_LAST;
  const isSwipeStep  = step === STEP_SWIPE;
  const isPrayerStep = step === STEP_PRAYER;
  const isInteractive = isSwipeStep || isPrayerStep;
  const cardAtBottom = step <= STEP_CAML;

  // Mount entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevStep = useRef(step);
  useEffect(() => {
    const from = prevStep.current;
    prevStep.current = step;
    if (from === step) return;

    if (step === STEP_LAST) {
      // Reverent entrance — Modal re-appears after the interactive prayer step.
      fadeAnim.setValue(0);
      slideAnim.setValue(28);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }

    // Modal-to-modal advance (Welcome → Your church is here, etc.):
    // slide the card up softly so content doesn't cut abruptly.
    if (!isInteractive) {
      slideAnim.setValue(18);
      Animated.timing(slideAnim, {
        toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step 2 (CAML): request camera snap. Stable ref from parent avoids loop.
  useEffect(() => {
    if (step === STEP_CAML) onRequestPanToChurch?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step 3 (swipe): advance when the leader switches to At Large.
  // Also snap CAML back to GPS now (happens in the background while At Large is shown).
  useEffect(() => {
    if (step === STEP_SWIPE && currentPage === 1) {
      onRequestRecenterToGPS?.();
      setStep(STEP_PRAYER);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentPage]);

  // Step 4 (prayer): advance when the leader pulls up the wall, OR after 10 s.
  useEffect(() => {
    if (step !== STEP_PRAYER) return;
    if (prayerWallSnap !== 'collapsed') { setStep(STEP_LAST); return; }
    const t = setTimeout(() => setStep(STEP_LAST), 10000);
    return () => clearTimeout(t);
  }, [step, prayerWallSnap]);

  const dismiss = useCallback(async () => {
    await SecureStore.setItemAsync(TUTORIAL_SEEN_KEY, 'true').catch(() => {});
    onComplete();
  }, [onComplete]);

  const goNext = () => { if (isLast) { void dismiss(); } else { setStep(n => n + 1); } };
  const goBack = () => { if (step > 0) setStep(n => n - 1); };

  return (
    <>
      {/* Full-screen Modal for non-interactive steps */}
      <Modal visible={!isInteractive} transparent animationType="none">
        <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
          {/* Step 2 (CAML): no scrim — full map visible so the blue pulsing
              church dot reads clearly. All other steps use the full dark scrim. */}
          {step !== STEP_CAML && (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Rect fill="rgba(0,0,0,0.84)" x={0} y={0} width={W} height={H} />
            </Svg>
          )}

          <Animated.View
            style={[
              styles.card,
              cardAtBottom ? styles.cardBottom : styles.cardMiddle,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <ProgressDots total={STEPS.length} current={step} />
            <Text style={styles.eyebrow}>{s.eyebrow.toUpperCase()}</Text>
            <Text style={styles.title}>{s.title}</Text>
            {!!s.body && <Text style={styles.body}>{s.body}</Text>}

            <View style={styles.actions}>
              {step > 0 && (
                <Pressable onPress={goBack} style={[styles.btn, styles.btnGhost, { flex: 0, minWidth: 80 }]} accessibilityRole="button">
                  <Text style={styles.btnGhostText}>Back</Text>
                </Pressable>
              )}
              <Pressable onPress={goNext} style={[styles.btn, styles.btnPrimary, { flex: 1 }]} accessibilityRole="button">
                <Text style={styles.btnPrimaryText}>{isLast ? 'Enter The Church' : 'Continue'}</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => void dismiss()} accessibilityRole="button" style={styles.skipRow}>
              <Text style={styles.skipText}>Skip · I'll figure it out</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* In-tree hints (non-Modal so underlying UI remains interactive) */}
      {isSwipeStep  && <SwipeHint  step={step} onSkip={() => void dismiss()} />}
      {isPrayerStep && <PrayerHint step={step} onSkip={() => void dismiss()} />}
    </>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current ? styles.dotActive :
            i < current  ? styles.dotDone   :
                           styles.dotPending,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Shared hint chrome ───────────────────────────────────────────────

// Distance from SafeAreaView content top to the BOTTOM of the pager row
// (title 30 + subtitle 18 + pager-with-margin 25 + paddingTop 14 = 87).
// Adding insets.top gives the screen-top offset.
// Scrim starts just below this; arrow sits right at this level.
const PAGER_BOTTOM_H = 87;

// ─── Swipe hint (step 3) ─────────────────────────────────────────────
// Arrow pointing UP toward the horizon bar.

function SwipeHint({ onSkip }: { onSkip: () => void; step: number }) {
  const insets = useSafeAreaInsets();
  const scrimTop = insets.top + PAGER_BOTTOM_H + 2;
  const bounce  = useRef(new Animated.Value(0)).current;
  // Only the arrow + text fade in; scrim is instant so no map flash on Modal close.
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -10, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bounce, { toValue:   0, duration: 360, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.hintRoot} pointerEvents="box-none">
      {/* Instant scrim — opacity 1 from frame 1, so map is never uncovered */}
      <View style={[styles.hintScrimUpper, { top: scrimTop }]} pointerEvents="none" />
      <Animated.View
        style={[styles.hintArrowUpper, { top: scrimTop + 6, opacity: contentOpacity }, { transform: [{ translateY: bounce }] }]}
        pointerEvents="none"
      >
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Line x1="6" y1="18" x2="14" y2="10" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" />
          <Line x1="14" y1="10" x2="22" y2="18" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" />
        </Svg>
        <Text style={styles.hintLabel}>TAP THE BAR OR SWIPE</Text>
      </Animated.View>
      <Animated.View style={[styles.hintSkip, { opacity: contentOpacity }]}>
        <Pressable onPress={onSkip} accessibilityRole="button">
          <Text style={styles.skipText}>Skip · I'll figure it out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Prayer Wall hint (step 4) ────────────────────────────────────────
// Arrow pointing DOWN toward the prayer wall pull-up handle.

function PrayerHint({ onSkip }: { onSkip: () => void; step: number }) {
  const insets  = useSafeAreaInsets();
  const scrimTop = insets.top + PAGER_BOTTOM_H + 2;
  const bounce  = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 10, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bounce, { toValue:  0, duration: 360, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.hintRoot} pointerEvents="box-none">
      {/* Instant scrim — covers globe immediately on mount */}
      <View style={[styles.hintScrimPrayer, { top: scrimTop }]} pointerEvents="none" />
      <Animated.View
        style={[styles.hintArrowLower, { opacity: contentOpacity, transform: [{ translateY: bounce }] }]}
        pointerEvents="none"
      >
        <Text style={styles.hintLabel}>DRAG UP THE HANDLE</Text>
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Line x1="6" y1="10" x2="14" y2="18" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" />
          <Line x1="14" y1="18" x2="22" y2="10" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.hintSkipUpper, { opacity: contentOpacity }]}>
        <Pressable onPress={onSkip} accessibilityRole="button">
          <Text style={styles.skipText}>Skip · I'll figure it out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  card: {
    position: 'absolute',
    left: 20, right: 20,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  cardBottom:  { bottom: 40 },
  cardMiddle:  { top: H * 0.38 },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
  dotActive:  { backgroundColor: Colors.accent, width: 18, borderRadius: 3 },
  dotDone:    { backgroundColor: Colors.accent, opacity: 0.45 },
  dotPending: { backgroundColor: Colors.border },

  eyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9, letterSpacing: 1.98,
    color: Colors.accent, marginBottom: 8,
  },
  title: {
    fontFamily: Typography.displayRegular,
    fontSize: 22, lineHeight: 27, letterSpacing: 0.22,
    color: Colors.text, marginBottom: 10,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: 13.5, lineHeight: 21,
    color: Colors.textMuted, marginBottom: 20,
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  btn: {
    minHeight: 44, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  btnPrimary:     { backgroundColor: Colors.accent },
  btnPrimaryText: { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.32, textTransform: 'uppercase', color: Colors.background },
  btnGhost:       { borderColor: Colors.borderAccent },
  btnGhostText:   { fontFamily: Typography.bodyMedium, fontSize: 11, letterSpacing: 1.32, textTransform: 'uppercase', color: Colors.accent },
  skipRow: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontFamily: Typography.body, fontSize: 12, color: Colors.textSubtle, letterSpacing: 0.2 },

  // ── Shared hint chrome ──
  hintRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },

  // Swipe hint scrim — top applied inline with dynamic inset value
  hintScrimUpper: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  // Arrow — top applied inline
  hintArrowUpper: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    gap: 6,
  },

  // Prayer hint scrim — top applied inline; leave bottom clear for handle
  hintScrimPrayer: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  // Arrow group sits just above the pull-up handle
  hintArrowLower: {
    position: 'absolute',
    bottom: 110,
    left: 0, right: 0,
    alignItems: 'center',
    gap: 6,
  },

  hintLabel: {
    fontFamily: Typography.mono,
    fontSize: 9, letterSpacing: 1.8,
    color: Colors.accent, textTransform: 'uppercase',
  },
  hintSkip: {
    position: 'absolute',
    bottom: 52, left: 0, right: 0,
    alignItems: 'center',
  },
  hintSkipUpper: {
    position: 'absolute',
    top: 200, left: 0, right: 0,
    alignItems: 'center',
  },
});
