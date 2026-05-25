// Prayer Wall iconography — kept inline as react-native-svg primitives,
// matching the project's existing icon convention (see
// src/components/icons/TabIcons.tsx). Strokes are 1.5 px round-cap to
// stay visually consistent with the tab icons.
//
// Sizing: each icon accepts size and color props. The default size is
// the most common usage at the call site; callers override per spec.

import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
  /** Used by HeartIcon to swap outline vs filled. */
  filled?: boolean;
}

const STROKE = 1.5;
const CAPS = 'round' as const;
const JOINS = 'round' as const;

// Outline / filled heart. Filled variant fills the silhouette with `color`
// and drops the stroke; outline keeps a 1.5 px stroke on transparent fill.
export function HeartIcon({ size = 14, color, filled = false }: IconProps) {
  const d = 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z';
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d={d} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 14, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="9,6 15,12 9,18" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} />
    </Svg>
  );
}

export function XIcon({ size = 14, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
    </Svg>
  );
}

// Small open-circle for the Urgent chip idle indicator.
export function DotIcon({ size = 8, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

// Incense bowl rising — Rev 5:8 reference. A wide footed bowl with three
// flame wisps rising from the rim. Kept geometric so it reads at 24 px.
export function IncenseIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* bowl */}
      <Path d="M4 14 Q12 19 20 14" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} />
      <Line x1="4" y1="14" x2="20" y2="14" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      {/* foot */}
      <Line x1="8" y1="20" x2="16" y2="20" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      <Line x1="12" y1="17" x2="12" y2="20" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      {/* three wisps of smoke */}
      <Path d="M9 12 Q8 10 9 8 Q10 6 9 4" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} fill="none" />
      <Path d="M12 12 Q13 10 12 8 Q11 6 12 4" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} fill="none" />
      <Path d="M15 12 Q14 10 15 8 Q16 6 15 4" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} fill="none" />
    </Svg>
  );
}

// Candle near its end — Receive intercession icon per v5 redlines.
// Stubby wax stub with a single melted-wax drip down the left side,
// sitting in a wide flat holder dish. Wick rises ~3 pt above; filled
// flame teardrop at 0.85 opacity. Two postures of the wall: the
// incense bowl rises (intercession ascending to God); the candle is
// burning down (a leader at the end of themselves asking the Body to
// stand with them). SVG geometry ported verbatim from the v5
// redlines doc.
export function CandleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* filled flame teardrop @ 0.85 opacity */}
      <Path
        d="M12 4 Q10.8 6 11.6 8 Q12 9 12.4 8 Q13.2 6 12 4"
        fill={color}
        opacity={0.85}
      />
      {/* flame outline (over the fill for crispness on dark bg) */}
      <Path
        d="M12 4 Q10.8 6 11.6 8 Q12 9 12.4 8 Q13.2 6 12 4"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap={CAPS}
        strokeLinejoin={JOINS}
        fill="none"
      />
      {/* wick */}
      <Line x1="12" y1="8" x2="12" y2="11" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      {/* stubby wax body */}
      <Path d="M10 11 H14 V16 H10 Z" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} fill="none" />
      {/* single melted-wax drip down the left */}
      <Path d="M10 13 Q9.3 14 9.8 15" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} fill="none" />
      {/* wide flat holder dish */}
      <Path d="M5 16 H19 Q19 19 17 19 H7 Q5 19 5 16 Z" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} fill="none" />
    </Svg>
  );
}

// Lock icon for the disabled "Receive intercession" CTA.
export function LockIcon({ size = 14, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="11" width="12" height="9" rx="2" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M9 11 V8 a3 3 0 0 1 6 0 V11" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} fill="none" />
    </Svg>
  );
}

// Confetti / celebration popper for the testimony celebrate affordance.
// A triangular popper with three diverging streamers.
export function CelebrateIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* popper triangle */}
      <Path d="M3 21 L8 8 L18 18 Z" stroke={color} strokeWidth={STROKE} strokeLinejoin={JOINS} fill="none" />
      {/* sparkles */}
      <Line x1="14" y1="6" x2="14" y2="3" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      <Line x1="17" y1="9" x2="20" y2="9" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      <Line x1="16" y1="5" x2="18" y2="3" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
    </Svg>
  );
}

// Overflow menu trigger — three horizontal dots.
export function OverflowIcon({ size = 14, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="6" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="18" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}
