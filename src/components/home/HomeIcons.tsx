// ─────────────────────────────────────────────
// HomeIcons — Home-tab icon set (KAN-201 home redesign 2026-06-01)
//
// Ported from the design handoff (docs/home-tab-handoff/components/
// icons.tsx). The handoff imports the brand mark via
// `react-native-svg-transformer` (`import RpMark from '../assets/
// rp-mark.svg'`). That transformer is NOT configured in this project's
// metro.config (there is no metro.config.js and no svg-transformer dep),
// so the brand mark is re-exported here as a thin wrapper over the
// existing inline `RpLogo` component (src/components/home/RpLogo.tsx),
// which is the live, working brand mark. The wrapper accepts the same
// width / height / opacity props the handoff cards pass.
//
// The remaining icons (CommentIcon, LinkIcon, LockIcon, Chevron, Arrow)
// are character-faithful ports of the handoff SVG paths.
// ─────────────────────────────────────────────

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import RpLogo from './RpLogo';

// Brand mark — wraps RpLogo so the handoff `<RpMark width={..} height={..}
// opacity={..} />` call sites work unchanged. RpLogo renders square at
// `size × size`; we honour `width` (height tracks it) and apply `opacity`
// via a wrapping View so the footer "faded seal" reads as designed.
export function RpMark({
  width = 38,
  height,
  opacity = 1,
  color,
}: {
  width?: number;
  height?: number;
  opacity?: number;
  color?: string;
}) {
  const size = width ?? height ?? 38;
  return (
    <View style={{ opacity }}>
      <RpLogo size={size} color={color} />
    </View>
  );
}

type IconProps = { size?: number; color?: string };

export const CommentIcon = ({ size = 13, color = Colors.textSubtle }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke={color}
    strokeWidth={1.3}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2.5 4.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6l-3 2.5V11H4a1.5 1.5 0 0 1-1.5-1.5Z" />
  </Svg>
);

export const LinkIcon = ({ size = 17, color = Colors.accent }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    fill="none"
    stroke={color}
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M7.5 10.5 10.5 7.5M8 5l1-1a3 3 0 0 1 4 4l-1 1M10 13l-1 1a3 3 0 0 1-4-4l1-1" />
  </Svg>
);

export const LockIcon = ({ size = 13, color = Colors.textSubtle }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={1.3}>
    <Rect x={3.5} y={7} width={9} height={6.5} rx={1.3} />
    <Path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
  </Svg>
);

// Chevron points down; rotate 180° (via style transform) when open.
export const Chevron = ({ size = 9, color = Colors.textMuted }: IconProps) => (
  <Svg
    width={size}
    height={size * 0.7}
    viewBox="0 0 10 7"
    fill="none"
    stroke={color}
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M1 1.5 5 5.5 9 1.5" />
  </Svg>
);

export const Arrow = ({ size = 12, color = Colors.accent }: IconProps) => (
  <Svg
    width={size}
    height={size * 0.7}
    viewBox="0 0 13 9"
    fill="none"
    stroke={color}
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M1 4.5h10M8 1.5l3 3-3 3" />
  </Svg>
);
