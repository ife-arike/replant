// ─────────────────────────────────────────────
// WallPrimitives — Prayer Wall rebuild shared pieces
// (design_handoff_prayer_wall_NEW/README.md — the README wins over the
// .dc.html mock; motion table + type scale are final and reviewed.)
//
//   WallTabs        — Feed · Testimonies · My Prayers row + gliding
//                     1.5px indicator (420ms bezier(0.22,0.61,0.36,1),
//                     layout props → useNativeDriver:false). Labels are
//                     measured from the Pressable box, which carries no
//                     horizontal padding, so the measured frame IS the
//                     text frame (README: measure the text, not the
//                     touchable's padding box). Hidden (width 0) while
//                     Journal / Compose is open — those are not tabs.
//   GapMark         — three bars, centre fills sky via a 450ms
//                     bottom-anchored rise when interceding. This is
//                     the metaphor — you close the gap. Never an icon.
//   RejoiceMark     — 9px ring → filled disc + two echo rings looping
//                     scale 1→2.7 / opacity .65→0 over 1900ms, second
//                     offset 950ms. Reads as a sustained sound going out.
//   BreathingDot    — 6px dot, opacity .3→.85→.3 over 3400ms.
//   StaggerRow      — fade + 7px rise (500ms), delay staggerDelay(i);
//                     parent re-keys rows on animTick to re-trigger.
//   WallScriptureFooter / WallEmpty — per README tables.
//
// Reduced motion (src/utils/useReducedMotion.ts): breathe, pulse, and
// echo loops freeze at their resting state; the stagger is skipped.
// Functional transitions (indicator, gap fill) stay.
// ─────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { useReducedMotion } from '../../utils/useReducedMotion';
import { staggerDelay, WALL_TABS, type WallView } from './wallNewLogic';

// README motion table — shared curve for indicator glide, gap fill,
// toggle travel.
export const WALL_BEZIER = Easing.bezier(0.22, 0.61, 0.36, 1);

// ─── WallTabs ─────────────────────────────────────────────────────────

interface TabFrame {
  x: number;
  width: number;
}

export interface WallTabDef {
  id: string;
  label: string;
}

interface WallTabsProps {
  active: string;
  hidden: boolean; // journal / compose open — indicator collapses to width 0
  onChange: (tab: string) => void;
  // Persecuted refinement (2026-07-26): the tab row is shared chrome.
  // Defaults preserve Prayer Wall exactly — three wall tabs, sky
  // indicator. Persecuted passes its own tabs and Colors.red (labels
  // stay off-white in both accent modes; red is the indicator and the
  // rule, never the letters).
  tabs?: readonly WallTabDef[];
  indicatorColor?: string;
  // Gated: labels dim further and taps are delegated (host toasts).
  gated?: boolean;
}

export function WallTabs({
  active, hidden, onChange, tabs = WALL_TABS, indicatorColor = Colors.accent, gated = false,
}: WallTabsProps) {
  const frames = useRef<Record<string, TabFrame>>({});
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  const glide = (tab: string, animate: boolean) => {
    const f = frames.current[tab];
    if (!f) return;
    if (!animate) {
      left.setValue(f.x);
      width.setValue(f.width);
      return;
    }
    Animated.parallel([
      Animated.timing(left, { toValue: f.x, duration: 420, easing: WALL_BEZIER, useNativeDriver: false }),
      Animated.timing(width, { toValue: f.width, duration: 420, easing: WALL_BEZIER, useNativeDriver: false }),
    ]).start();
  };

  // Re-glide whenever the active tab (or hidden state) changes. First
  // placement after measurement snaps without animation.
  useEffect(() => {
    if (hidden) {
      Animated.timing(width, { toValue: 0, duration: 220, easing: WALL_BEZIER, useNativeDriver: false }).start();
      return;
    }
    glide(active, measured.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hidden]);

  const handleLayout = (tab: string) => (e: LayoutChangeEvent) => {
    const { x, width: w } = e.nativeEvent.layout;
    frames.current[tab] = { x, width: w };
    // Once all three tabs are measured, place the indicator. Re-measure
    // (font load, orientation change) re-places without animation.
    if (Object.keys(frames.current).length === tabs.length) {
      const first = !measured.current;
      measured.current = true;
      if (!hidden) glide(active, !first);
    }
  };

  return (
    // Outer view carries the 22px page gutter; the INNER row is
    // unpadded so each pressable's onLayout x and the indicator's
    // absolute `left` share one coordinate space. (Device pass
    // 2026-07-24: measuring inside a padded row while also offsetting
    // the indicator by the padding double-counted it — the glide sat
    // right of the label.)
    <View style={tabStyles.gutter}>
      <View style={tabStyles.row}>
        {tabs.map((t) => {
          const isActive = active === t.id && !hidden;
          return (
            <Pressable
              key={t.id}
              onLayout={handleLayout(t.id)}
              onPress={() => onChange(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t.label}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={tabStyles.tab}
            >
              <Text
                style={[
                  tabStyles.label,
                  isActive && tabStyles.labelActive,
                  gated && tabStyles.labelGated,
                ]}
              >
                {t.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
        <Animated.View style={[tabStyles.indicator, { left, width, backgroundColor: indicatorColor }]} />
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  gutter: { paddingHorizontal: 22 },
  row: {
    flexDirection: 'row',
    gap: 26,
    position: 'relative',
  },
  // No horizontal padding — the pressable frame doubles as the label
  // frame for indicator measurement (README indicator note).
  tab: { paddingBottom: 12 },
  label: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(240,237,230,0.38)',
  },
  labelActive: { color: Colors.text },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 1.5,
  },
  labelGated: { color: 'rgba(240,237,230,0.22)' },
});

// ─── GapMark ──────────────────────────────────────────────────────────

const GAP_BAR_H = 13;

export function GapMark({ active }: { active: boolean }) {
  // Centre bar rises from the bottom of its 13px slot. RN has no
  // transform-origin, so the fill is a bottom-anchored Animated height
  // inside a fixed slot (450ms, WALL_BEZIER — one-shot layout anim).
  const rise = useRef(new Animated.Value(active ? GAP_BAR_H : 0)).current;
  const fade = useRef(new Animated.Value(active ? 1 : 0)).current;
  const mountedActive = useRef(active);

  useEffect(() => {
    if (mountedActive.current === active) return;
    mountedActive.current = active;
    Animated.parallel([
      Animated.timing(rise, { toValue: active ? GAP_BAR_H : 0, duration: 450, easing: WALL_BEZIER, useNativeDriver: false }),
      Animated.timing(fade, { toValue: active ? 1 : 0, duration: 450, easing: WALL_BEZIER, useNativeDriver: false }),
    ]).start();
  }, [active, rise, fade]);

  return (
    <View style={gapStyles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={gapStyles.outer} />
      <View style={gapStyles.centreSlot}>
        <View style={gapStyles.centreIdle} />
        <Animated.View style={[gapStyles.centreFill, { height: rise, opacity: fade }]} />
      </View>
      <View style={gapStyles.outer} />
    </View>
  );
}

const gapStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: GAP_BAR_H },
  outer: { width: 1.5, height: GAP_BAR_H, backgroundColor: 'rgba(240,237,230,0.50)' },
  centreSlot: { width: 1.5, height: GAP_BAR_H, justifyContent: 'flex-end' },
  centreIdle: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240,237,230,0.09)',
  },
  centreFill: { width: 1.5, backgroundColor: Colors.accent },
});

// ─── RejoiceMark ──────────────────────────────────────────────────────

export function RejoiceMark({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const echoA = useRef(new Animated.Value(0)).current;
  const echoB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduced) {
      echoA.stopAnimation();
      echoB.stopAnimation();
      echoA.setValue(0);
      echoB.setValue(0);
      return;
    }
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 1900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a = loop(echoA, 0);
    const b = loop(echoB, 950);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, reduced, echoA, echoB]);

  const echoStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] }) }],
  });

  return (
    <View style={rejStyles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {active && !reduced ? (
        <>
          <Animated.View style={[rejStyles.echo, echoStyle(echoA)]} />
          <Animated.View style={[rejStyles.echo, echoStyle(echoB)]} />
        </>
      ) : null}
      <View style={[rejStyles.ring, active && rejStyles.disc]} />
    </View>
  );
}

const rejStyles = StyleSheet.create({
  wrap: { width: 13, height: 13, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: Colors.accent },
  disc: { backgroundColor: Colors.accent },
  echo: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
});

// ─── BreathingDot ─────────────────────────────────────────────────────

export function BreathingDot({ color = Colors.accent }: { color?: string }) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 0.85 : 0.3)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.85); // static at full opacity under reduced motion
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);

  return <Animated.View style={[dotStyles.dot, { backgroundColor: color, opacity }]} />;
}

const dotStyles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3 },
});

// ─── UrgentLabel (pulsing) ────────────────────────────────────────────

export function UrgentLabel() {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);

  return (
    <Animated.Text style={[urgStyles.label, { opacity }]} accessibilityLabel="Urgent">
      URGENT
    </Animated.Text>
  );
}

const urgStyles = StyleSheet.create({
  label: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    color: Colors.red,
    marginLeft: 'auto',
  },
});

// ─── StaggerRow ───────────────────────────────────────────────────────

export function StaggerRow({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return; // skip entirely under reduced motion (README)
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay: staggerDelay(index),
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [reduced, anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── WallScriptureFooter ──────────────────────────────────────────────

export function WallScriptureFooter({ text, reference }: { text: string; reference: string }) {
  return (
    <View style={footStyles.wrap}>
      <View style={footStyles.rule} />
      <Text style={footStyles.verse}>{text}</Text>
      <Text style={footStyles.ref}>{reference}</Text>
    </View>
  );
}

const footStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 24, paddingBottom: 30, paddingHorizontal: 22 },
  rule: { height: 1, alignSelf: 'stretch', backgroundColor: Colors.borderAccentSubtle, marginBottom: 22 },
  verse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 17,
    lineHeight: 26,
    color: '#E6E1D5',
    textAlign: 'center',
    maxWidth: 300,
  },
  ref: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
});

// ─── WallEmpty ────────────────────────────────────────────────────────
//
// README empty states: one serif line and one plain sentence. Hairline
// above, padding 34 top. No icons, no illustrations. `italic` renders
// the body in the scripture italic asset (never synthetic italic).

interface WallEmptyProps {
  heading?: string;
  body: string;
  italic?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function WallEmpty({ heading, body, italic = false, actionLabel, onAction }: WallEmptyProps) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.rule} />
      {heading ? <Text style={emptyStyles.heading}>{heading}</Text> : null}
      <Text style={italic ? emptyStyles.bodyItalic : emptyStyles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [emptyStyles.action, pressed && { opacity: 0.7 }]}
          hitSlop={6}
        >
          <Text style={emptyStyles.actionLabel}>{actionLabel.toUpperCase()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { paddingTop: 0, paddingHorizontal: 22, alignItems: 'flex-start' },
  rule: { height: 1, alignSelf: 'stretch', backgroundColor: Colors.border, marginBottom: 34 },
  heading: {
    fontFamily: Typography.displayRegular,
    fontSize: 21,
    color: Colors.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: Typography.sansLight,
    fontSize: 13,
    lineHeight: 21.5,
    color: 'rgba(240,237,230,0.50)',
  },
  bodyItalic: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(240,237,230,0.45)',
  },
  action: {
    marginTop: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(107,181,232,0.30)',
    borderRadius: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionLabel: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: Colors.accent,
  },
});
