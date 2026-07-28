// ─────────────────────────────────────────────
// PageTurnText — THE clamp mechanism for Home's page-turn texts
// (Day-1 2026-07-28, after the expand-tear saga).
//
// One Text node, one configuration, forever:
//   • It NEVER carries numberOfLines — flipping that prop re-measures the
//     node and can TEAR the layout (one line laid wider than its
//     siblings, cut mid-glyph, tail dropped) on some device-width ×
//     Dynamic-Type combinations. Founder's device was the repro.
//   • It is absolutely pinned left/right inside a height-controlled
//     window. Absolute children measure height-UNCONSTRAINED, so the
//     collapse can never reach the text's measurement either — a plain
//     maxHeight wrapper DID reflow it (line-3 "…in a bo" horizontal clip,
//     reproduced on the 16e at small text size).
//   • It measures ITSELF via onTextLayout — unclamped, its natural lines
//     are the truth, so the old offscreen mirror is retired here.
//     Newest-valid semantics + useMirrorRearm keep the measurement
//     race-proof (see ruling_read_on_overflow_gating — all legs).
//
// The window height comes from the engine's own line metrics
// (lines[k].y + lines[k].height), so Dynamic Type scaling and rounding
// are exact in every state. Before the first measurement lands the
// window estimates the collapsed height from lineHeight × fontScale;
// the measurement corrects it, typically before first paint.
//
// The host card keeps: the expanded state, the tap/cue/a11y gating
// (driven by onOverflowsChange), and its LayoutAnimation on toggle —
// which now only ever animates this window's height, a pure frame
// change with nothing left to re-measure.
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import type { NativeSyntheticEvent, StyleProp, TextLayoutEventData, TextStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { clampHeight } from './clampHeight';
import { useMirrorRearm } from './useMirrorRearm';

type Measure = {
  count: number;
  collapsedPx: number;
  fullPx: number;
};

type Props = {
  text: string;
  style: StyleProp<TextStyle>;
  /** Must match the style's lineHeight — used only for the pre-measure estimate. */
  lineHeight: number;
  /** The resting clamp, in lines (COLLAPSED_LINES at every call site). */
  lines: number;
  expanded: boolean;
  /** Fires whenever the natural line count crosses the clamp threshold. */
  onOverflowsChange?: (overflows: boolean) => void;
};

export default function PageTurnText({
  text,
  style,
  lineHeight,
  lines,
  expanded,
  onOverflowsChange,
}: Props) {
  const [m, setM] = useState<Measure | null>(null);
  useEffect(() => {
    setM(null);
  }, [text]);

  // Deterministic re-arm — a fresh node must lay out, so a measurement is
  // guaranteed even when the mount-time event races the listener.
  const rearmKey = useMirrorRearm([text]);

  const handleLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const L = e.nativeEvent.lines;
    const n = L.length;
    if (n <= 0) return;
    const k = Math.min(lines, n) - 1;
    const collapsedPx = L[k].y + L[k].height;
    const fullPx = L[n - 1].y + L[n - 1].height;
    // Newest-valid: never latch the first result (Fabric's early pass is
    // unreliable by nature — 2026-07-27 ruling).
    setM((prev) =>
      prev && prev.count === n && prev.collapsedPx === collapsedPx && prev.fullPx === fullPx
        ? prev
        : { count: n, collapsedPx, fullPx },
    );
  };

  const overflows = m !== null && m.count > lines;
  useEffect(() => {
    onOverflowsChange?.(overflows);
    // Intentionally only on the boolean — callers pass stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overflows]);

  const height = m
    ? expanded
      ? m.fullPx
      : Math.min(m.collapsedPx, m.fullPx)
    : clampHeight(lineHeight, lines);

  return (
    <View style={[s.window, { height }]}>
      <Text key={`t${rearmKey}`} style={[style, s.pinned]} onTextLayout={handleLayout}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  window: {
    overflow: 'hidden',
  },
  // Width from the pins; height unconstrained — the one stable text
  // configuration. Margins must live on the host's wrapper, never here.
  pinned: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    marginTop: 0,
  },
});
