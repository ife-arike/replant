// LockIcon — KAN-65 Screen 14B gate glyph.
//
// Outline lock, body 16×11 rounded with shackle arch above. The wireframe
// renders at 56×56 with 1.4-stroke; this component accepts a size prop so
// the same SVG can be reused elsewhere if needed. Color defaults to muted
// off-white (gate copy guidance — "not red, not sky").

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function LockIcon({ size = 56, color = 'rgba(240, 237, 230, 0.60)', strokeWidth = 1.4 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={10.5} width={16} height={11} rx={2} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.5 10.5 V7 a4.5 4.5 0 0 1 9 0 V10.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={15.5} r={1} fill={color} />
      <Path d="M12 16.5 V18.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
