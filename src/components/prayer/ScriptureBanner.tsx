// ─────────────────────────────────────────────
// ScriptureBanner — KAN-23 v8 (Fix A: all three surfaces tone="none")
//
// Shared scripture-display component for the three Prayer Wall
// surfaces. After v8 Fix A, all three flip to tone="none" (floating
// text, no fill, no border, no container):
//   - Eph 6:18 on landing            tone="none" · 20 pt body
//   - Phil 4:6 above the feed        tone="none" · 18 pt body
//   - Rev 12:11 on testimonies       tone="none" · 20 pt body
//
// The sky/green tone branches are retained for source compatibility
// (no consumer uses them after v8 Fix A; the FE-facing API stays
// stable in case a future surface wants the tinted treatment).
//
// Hard rule from the dispatch hierarchy: Your Word never truncates.
// No numberOfLines, no ellipsis. Text wraps to more lines if the
// device is narrow — that's intentional.
//
// v8 Fix A — tone="none" block padding spec:
//   Landing + Testimonies: 24 pt vert · 20 pt horiz (per dispatch)
//   Feed (Phil 4:6, approved reference): smaller — caller passes its
//     own paddingVertical to preserve the v7 layout that Founder OK'd
//
// v7 Item 00 — body uses native Cormorant 300 Light Italic via
// Typography.scriptureItalic.
// v7 Item 08 — reference font: DM Sans 400 (NOT DM Mono).
//
// Children slot lets consumers (TestimoniesView) overlay the
// "From landing" pill on the banner without leaking that concern.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../constants/theme';

interface Props {
  text: string;
  reference: string;
  /** sky/green = retained tinted variants. none = floating text. */
  tone: 'sky' | 'green' | 'none';
  /** Per-surface body size: 20 pt on landing/testimonies, 18 pt on feed. */
  bodyFontSize?: number;
  /** Per-surface body line-height. Defaults to round(bodyFontSize × 1.55). */
  bodyLineHeight?: number;
  /**
   * v8 Fix A — tone="none" block padding. Defaults match the
   * Landing + Testimonies spec (24 vert / 20 horiz). Feed passes
   * paddingVertical={8} + paddingHorizontal={0} to preserve the v7
   * approved layout (its parent wrapper supplies the outer 16 pt
   * horizontal gutter via listContent padding).
   */
  paddingVertical?: number;
  paddingHorizontal?: number;
  /** v8 Fix A — reference colour tint override (defaults are tone-based). */
  referenceColor?: string;
  children?: React.ReactNode;
}

// v7 Item 04 — scripture body always rgba(text, 0.78) (muted, NOT
// full white). Same across tone="sky" / "green" / "none" per Plan A.
const BODY_COLOR = 'rgba(240, 237, 230, 0.78)';

// v7 Item 04 — reference tinted at 0.70 alpha, per tone.
const REF_SKY = 'rgba(107, 181, 232, 0.70)';
const REF_GREEN = 'rgba(91, 173, 122, 0.70)';

// v7 Item 04 Plan A — fills at 0.06 alpha. Not 0.10. No border.
const SKY_FILL = 'rgba(107, 181, 232, 0.06)';
const GREEN_FILL = 'rgba(91, 173, 122, 0.06)';

export default function ScriptureBanner({
  text,
  reference,
  tone,
  bodyFontSize = 20,
  bodyLineHeight,
  paddingVertical,
  paddingHorizontal,
  referenceColor,
  children,
}: Props) {
  const computedLineHeight = bodyLineHeight ?? Math.round(bodyFontSize * 1.55);

  // v8 Fix A — block padding defaults: 24 vert / 20 horiz (matches
  // Landing + Testimonies spec). Feed overrides with smaller values.
  const padV = paddingVertical ?? 24;
  const padH = paddingHorizontal ?? 20;

  let containerStyle;
  if (tone === 'sky') {
    containerStyle = [
      styles.banner,
      { backgroundColor: SKY_FILL, paddingVertical: padV, paddingHorizontal: padH },
    ];
  } else if (tone === 'green') {
    containerStyle = [
      styles.banner,
      { backgroundColor: GREEN_FILL, paddingVertical: padV, paddingHorizontal: padH },
    ];
  } else {
    // tone="none" — floating, no fill, no border, no radius. Block
    // padding is the only chrome; defaults above match Landing +
    // Testimonies. Feed passes explicit smaller values.
    containerStyle = [
      styles.floating,
      { paddingVertical: padV, paddingHorizontal: padH },
    ];
  }

  const refColor = referenceColor ?? (tone === 'green' ? REF_GREEN : REF_SKY);

  return (
    <View style={containerStyle}>
      <Text
        style={[
          styles.body,
          { fontSize: bodyFontSize, lineHeight: computedLineHeight },
        ]}
      >
        {text}
      </Text>
      <Text style={[styles.reference, { color: refColor }]}>{reference}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    // v7 Item 04 Plan A — radius 10, NO border. Padding now controlled
    // per-instance via props (defaults to 24 vert / 20 horiz).
    borderRadius: 10,
    alignItems: 'center',
  },
  floating: {
    // v8 Fix A — tone="none". Padding controlled per-instance via
    // props (defaults to 24 vert / 20 horiz for Landing + Testimonies;
    // Feed overrides with 8 vert / 0 horiz to keep the v7 approved
    // visual since its parent wrap already provides outer gutters).
    alignItems: 'center',
  },
  body: {
    // v7 Item 00 — native Cormorant 300 Light Italic.
    // v7 Item 04 Plan A — color muted (NOT full --text).
    fontFamily: Typography.scriptureItalic,
    color: BODY_COLOR,
    textAlign: 'center',
  },
  reference: {
    // v7 Item 08 — DM Sans 400 (was DM Mono).
    marginTop: 8,
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 2.0, // ~0.18em on 11 pt
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
