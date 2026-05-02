import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps { color: string; size?: number; }
const STROKE = 1.5;
const CAPS = 'round' as const;
const JOINS = 'round' as const;

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 14 L12 7 L20 14" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M16 9 V5" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
    </Svg>
  );
}

export function TheChurchIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4 V20" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M12 8 H17" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M17 8 V5" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M12 13 H7" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M7 13 V10" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M12 17 H17" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M17 17 V14" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
    </Svg>
  );
}

export function PersecutedIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 9 Q12 4 19 9" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M12 11 V20" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M9 14 H15" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
    </Svg>
  );
}

export function PrayerWallIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21 V11 Q5 4 12 4 Q19 4 19 11 V21" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
      <Path d="M9 21 V14 Q9 11 12 11" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS} strokeLinejoin={JOINS}/>
    </Svg>
  );
}

export function ConnectIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={2.5} stroke={color} strokeWidth={STROKE}/>
      <Circle cx={18} cy={12} r={2.5} stroke={color} strokeWidth={STROKE}/>
      <Path d="M8.5 12 H15.5" stroke={color} strokeWidth={STROKE} strokeLinecap={CAPS}/>
    </Svg>
  );
}
