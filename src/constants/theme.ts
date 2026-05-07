// ─────────────────────────────────────────────
// Replant — Theme Constants
// Single source of truth. Never hardcode brand values in screens.
// ─────────────────────────────────────────────

import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";

export const Colors = {
  background: '#080808',
  accent: '#6BB5E8',       // sky blue — interactive, user dot
  text: '#F0EDE6',         // off-white — primary text
  textMuted: 'rgba(240, 237, 230, 0.45)',
  textSubtle: 'rgba(240, 237, 230, 0.25)',
  surface: '#111111',
  surfaceElevated: '#181818',
  border: 'rgba(240, 237, 230, 0.08)',
  borderAccent: 'rgba(107, 181, 232, 0.25)',

  // RAG
  green: '#5BAD7A',
  amber: '#D4A855',
  red: '#E05555',

  // Utility
  overlay: 'rgba(8, 8, 8, 0.85)',
  transparent: 'transparent',
} as const;

// Font asset bundle — pass to useFonts() in App.tsx.
// Keys are font-family names; values are the .ttf binary modules from
// @expo-google-fonts/*. The keys here MUST match the literal strings in
// Typography below — that's the Android-safety guarantee FE plan 10976 #5
// asked for. If @expo-google-fonts ever renames an export, this file fails
// to compile and the Android-asymmetric font fallback bug surfaces at build
// time rather than as a silent visual fallback at runtime.
export const fontModules = {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  DMSans_400Regular,
  DMSans_500Medium,
};

// Family-name strings used in StyleSheet `fontFamily` — must match fontModules
// keys above. `display*` = 600 SemiBold (default heading weight). `displayMedium*`
// = 500 Medium variant added per KAN-10 iteration 3 (lighter heading weight).
export const Typography = {
  display: 'CormorantGaramond_600SemiBold',
  displayItalic: 'CormorantGaramond_600SemiBold_Italic',
  displayMedium: 'CormorantGaramond_500Medium',
  displayMediumItalic: 'CormorantGaramond_500Medium_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 999,
} as const;
