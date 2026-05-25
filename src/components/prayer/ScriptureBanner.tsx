// ─────────────────────────────────────────────
// ScriptureBanner — KAN-23 v6 (Item 04)
//
// Shared tinted-banner component for the two scripture surfaces on the
// Prayer Wall tab: Eph 6:18 on the landing (tone="sky") and Rev 12:11
// on the testimonies view (tone="green"). Same shape, same padding,
// same border radius, same type sizes — only the colour differs.
//
// Hard rule from the dispatch hierarchy: Your Word never truncates.
// No numberOfLines, no ellipsis. Text wraps to more lines if the
// device is narrow — that's intentional.
//
// Per v6 redlines item 04:
//   - Fill:    rgba(107,181,232,0.10) sky | rgba(91,173,122,0.10) green
//   - Border:  0.5 pt rgba(107,181,232,0.30) sky | rgba(91,173,122,0.30) green
//   - Radius:  10 pt
//   - Padding: 22 pt vertical · 24 pt horizontal
//   - Body:    20 pt Cormorant italic 300, line-height 1.55, --text, centred
//   - Ref:     12 pt DM Mono 400, letter-spacing 0.18em UPPERCASE,
//              tone-coloured, centred, 10 pt above-margin from body
//
// Bundle has no Cormorant italic 300; using Typography.displayMediumItalic
// (500) — same project-wide deviation documented in DeactivationModal.
//
// Children slot lets consumers (e.g. TestimoniesView) overlay the
// "From landing" pill on the banner without leaking that concern back
// into this component.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface Props {
  text: string;
  reference: string;
  tone: 'sky' | 'green';
  children?: React.ReactNode;
}

export default function ScriptureBanner({ text, reference, tone, children }: Props) {
  const palette = tone === 'sky' ? SKY_PALETTE : GREEN_PALETTE;
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
    >
      <Text style={styles.body}>{text}</Text>
      <Text style={[styles.reference, { color: palette.ref }]}>{reference}</Text>
      {children}
    </View>
  );
}

const SKY_PALETTE = {
  bg: 'rgba(107, 181, 232, 0.10)',
  border: 'rgba(107, 181, 232, 0.30)',
  ref: Colors.accent,
};

const GREEN_PALETTE = {
  bg: 'rgba(91, 173, 122, 0.10)',
  border: 'rgba(91, 173, 122, 0.30)',
  ref: Colors.green,
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  body: {
    fontFamily: Typography.displayMediumItalic,
    fontSize: 20,
    lineHeight: 31, // ~20 × 1.55
    color: Colors.text,
    textAlign: 'center',
  },
  reference: {
    marginTop: 10,
    fontFamily: Typography.mono,
    fontSize: 12,
    letterSpacing: 2.2, // ~0.18em × 12 pt
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
