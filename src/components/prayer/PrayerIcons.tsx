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

// Glass less than half full — vessel awaiting fullness. A footed cup with
// a water-line drawn one-third up the inside.
export function GlassIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* vessel outline */}
      <Path d="M7 4 H17 L15.5 18 H8.5 Z" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS} fill="none" />
      {/* water line ~30% full */}
      <Path d="M9 14 H15 L14.5 18 H9.5 Z" fill={color} opacity={0.5} stroke="none" />
      {/* stem + base */}
      <Line x1="12" y1="18" x2="12" y2="21" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
      <Line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} />
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
