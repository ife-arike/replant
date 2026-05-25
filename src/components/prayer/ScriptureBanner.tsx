// ─────────────────────────────────────────────
// ScriptureBanner — KAN-23 v7 (Item 04 Plan A + tone="none")
//
// Shared tinted-banner component for the three scripture surfaces on
// the Prayer Wall tab:
//   - Eph 6:18 on landing            tone="sky"   (Plan A banner)
//   - Phil 4:6 above the feed        tone="none"  (floating fallback)
//   - Rev 12:11 on testimonies       tone="green" (Plan A banner)
//
// Hard rule from the dispatch hierarchy: Your Word never truncates.
// No numberOfLines, no ellipsis. Text wraps to more lines if the
// device is narrow — that's intentional.
//
// v7 Item 04 — Plan A: soften every dimension after v6 device pass
// flagged the banners as too saturated. Fill 0.06 (NOT 0.10), no
// border (drop the hairline entirely — borders re-introduce
// saturation), 24 pt all-sides padding, scripture body at
// rgba(text, 0.78) NOT full --text, reference tinted at 0.70 alpha.
//
// v7 Item 04 — tone="none" floating fallback: no container, no fill,
// no border, no radius. Body + ref render as floating text. Parent
// controls horizontal padding + outer margins.
//
// v7 Item 00 — body uses native Cormorant 300 Light Italic via
// Typography.scriptureItalic (no more synthetic-italic 500 fallback).
//
// v7 Item 08 — reference font swapped from DM Mono to DM Sans 400.
// Mono stays only on filter chips + feed card tags + testimony chip.
//
// Children slot lets consumers (e.g. TestimoniesView) overlay the
// "From landing" pill on the banner without leaking that concern back
// into this component.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../constants/theme';

interface Props {
  text: string;
  reference: string;
  /** sky/green = Plan A tinted banner. none = floating text, no container. */
  tone: 'sky' | 'green' | 'none';
  /** Per-surface body size: 20 pt on landing/testimonies, 18 pt on feed. */
  bodyFontSize?: number;
  /** Per-surface body line-height. Defaults to round(bodyFontSize × 1.55). */
  bodyLineHeight?: number;
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
  children,
}: Props) {
  const computedLineHeight = bodyLineHeight ?? Math.round(bodyFontSize * 1.55);

  let containerStyle;
  if (tone === 'sky') {
    containerStyle = [styles.banner, { backgroundColor: SKY_FILL }];
  } else if (tone === 'green') {
    containerStyle = [styles.banner, { backgroundColor: GREEN_FILL }];
  } else {
    // tone="none" — floating fallback. No fill, no border, no radius.
    containerStyle = styles.floating;
  }

  const refColor = tone === 'green' ? REF_GREEN : REF_SKY;

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
    // v7 Item 04 Plan A — radius 10, padding 24 all sides, NO border.
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
  },
  floating: {
    // v7 Item 04 tone="none" — floating fallback, no chrome. Vertical
    // breath inside; parent handles horizontal padding + outer
    // margins. Per Item 01 for Phil 4:6: 8 pt vertical is enough
    // since parent's filter-bar padding + list contentContainerStyle
    // already provide outer gaps.
    paddingVertical: 8,
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
