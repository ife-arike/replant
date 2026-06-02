// components/home/banner-icons.tsx — react-native-svg glyphs for the banner system.
// Setup: react-native-svg (+ svg-transformer for the Rp mark). See README.
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../../constants/theme';

type P = { size?: number; color?: string };
const S = { fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const InfoIcon = ({ size = 17, color = Colors.accent }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" stroke={color} {...S}>
    <Circle cx={10} cy={10} r={7.5} /><Path d="M10 9.2v4.3" /><Circle cx={10} cy={6.4} r={0.25} />
  </Svg>
);
export const ClockIcon = ({ size = 17, color = Colors.amber }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" stroke={color} {...S}>
    <Circle cx={10} cy={10} r={7.5} /><Path d="M10 6v4.2l2.8 1.8" />
  </Svg>
);
export const AlertIcon = ({ size = 17, color = Colors.red }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" stroke={color} {...S}>
    <Path d="M10 2.6 18 16.4H2L10 2.6Z" /><Path d="M10 8v3.4" /><Circle cx={10} cy={14.1} r={0.25} />
  </Svg>
);
export const LeaderIcon = ({ size = 17, color = Colors.accent }: P) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" stroke={color} {...S}>
    <Circle cx={10} cy={6.5} r={3} /><Path d="M4 16.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
  </Svg>
);
export const CheckIcon = ({ size = 16, color = Colors.green }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" stroke={color} {...S}><Path d="M3.5 9.3 7.2 13l7.3-8" /></Svg>
);
export const HeartIcon = ({ size = 16, color = Colors.green }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" stroke={color} {...S}>
    <Path d="M9 14.6S2.9 10.7 2.9 6.6A3.1 3.1 0 0 1 9 5.2 3.1 3.1 0 0 1 15.1 6.6C15.1 10.7 9 14.6 9 14.6Z" />
  </Svg>
);
export const Chevron = ({ size = 16, color = Colors.textSubtle }: P) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" stroke={color} {...S}><Path d="M7 4l5 5-5 5" /></Svg>
);
