// ─────────────────────────────────────────────
// Address the Network — inline SVG glyphs (paths lifted verbatim from the
// CD pack HTML). No new assets. All colours via Colors tokens at the call
// site; each glyph defaults to accent/text where the CD does.
// ─────────────────────────────────────────────

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from '../../../constants/theme';

interface GlyphProps {
  size?: number;
  color?: string;
}

// Preview affordance — eye.
export function EyeIcon({ size = 16, color = Colors.accent }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

// At-capacity count — padlock.
export function LockIcon({ size = 11, color = Colors.textMuted }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10h16v10H4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// Submit-success — sky check (same glyph shape the heartcry flow uses).
export function CheckIcon({ size = 24, color = Colors.accent }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5 L10 17 L19 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// At-capacity — quiet two-dot hold mark (no red, no error glyph).
export function TwoDotIcon({ size = 24, color = Colors.textMuted }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8.5} cy={12} r={2} fill={color} />
      <Circle cx={15.5} cy={12} r={2} fill={color} />
    </Svg>
  );
}

// Filled type-picker chevron.
export function ChevronDownIcon({ size = 16, color = Colors.textMuted }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Nav back chevron.
export function BackChevronIcon({ size = 20, color = Colors.text }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
