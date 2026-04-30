// ─────────────────────────────────────────────
// Replant — Theme Constants
// Single source of truth. Never hardcode brand values in screens.
// ─────────────────────────────────────────────

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

export const Typography = {
  display: 'CormorantGaramond_600SemiBold',
  displayItalic: 'CormorantGaramond_600SemiBold_Italic',
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
