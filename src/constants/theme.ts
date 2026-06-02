// ─────────────────────────────────────────────
// Replant — Theme Constants
// Single source of truth. Never hardcode brand values in screens.
// ─────────────────────────────────────────────

import {
  CormorantGaramond_300Light,
  CormorantGaramond_300Light_Italic,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { DMMono_400Regular } from "@expo-google-fonts/dm-mono";

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

  // Home-tab card surfaces (KAN-201 home redesign 2026-06-01) — derived
  // from existing tokens; do not introduce additional brand values.
  cardSurface: '#111113',   // card chassis — a hair above surface
  cardWarm: '#131110',      // warm card surface (leader word cards)
  linkWell: 'rgba(107,181,232,0.04)', // link block background

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
  // KAN-23 v7 Item 00 — Cormorant 300 Light + 300 Light Italic added
  // so scripture/prayer body can render at native 300 weight rather
  // than falling back to 500 (v6 device pass flagged it as too heavy).
  // The italic must be the native 300Light_Italic file — do NOT apply
  // fontStyle:'italic' to the roman 300Light file (separate asset;
  // synthetic italic causes Android rendering failures).
  CormorantGaramond_300Light,
  CormorantGaramond_300Light_Italic,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  // KAN-23 v7 Item 00 — DM Sans 300 Light added for action card
  // descriptions and other body-light copy that was previously
  // falling back to 400.
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMMono_400Regular,
};

// Family-name strings used in StyleSheet `fontFamily` — must match fontModules
// keys above. `display*` = 600 SemiBold (default heading weight). `displayMedium*`
// = 500 Medium variant added per KAN-10 iteration 3 (lighter heading weight).
// `displayRegular` = 400 Regular variant — non-italic serif used for the inline
// scripture-citation token so it visually separates from the surrounding italic
// verse via weight + size while flowing on the same line.
export const Typography = {
  display: 'CormorantGaramond_600SemiBold',
  displayItalic: 'CormorantGaramond_600SemiBold_Italic',
  displayMedium: 'CormorantGaramond_500Medium',
  displayMediumItalic: 'CormorantGaramond_500Medium_Italic',
  displayRegular: 'CormorantGaramond_400Regular',
  // KAN-23 v7 Item 00 — scripture + prayer/testimony body uses native
  // 300 Light Italic (NOT fontStyle:'italic' on the roman 300 file —
  // those are separate font assets and synthetic italic breaks
  // Android rendering). Wire load via fontModules above.
  scriptureItalic: 'CormorantGaramond_300Light_Italic',
  scriptureLight: 'CormorantGaramond_300Light',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  // KAN-23 v7 Item 00 — action card descriptions + other body-light
  // sites that previously fell back to 400.
  sansLight: 'DMSans_300Light',
  // DM Mono — identifier register (RPL-XXXXX codes, numbered eyebrows,
  // version stamps). Added for KAN-138 Settings on-brand pass.
  // KAN-23 v7 Item 08 — kept ONLY for filter chips, feed card category/
  // urgent tags, testimony chip. All other mono usages on the Prayer
  // Wall swept to DM Sans.
  mono: 'DMMono_400Regular',
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

// Tag → dot / label / colour for the Home-tab announcement letterhead
// eyebrow. The DB `announcements.tag_type` CHECK also permits 'new' and
// 'none'; the home cards collapse those to the neutral 'update' register
// (see NetworkFeed card routing). Keep this in sync with the eyebrow dot
// colours — it is the single source of truth for the new Home cards.
export const Tags = {
  update: { label: 'Network update', color: Colors.accent },
  notice: { label: 'Notice', color: Colors.amber },
  urgent: { label: 'Urgent', color: Colors.red },
  // KAN-201 card-system extension 2026-06-02 — new card types.
  together: { label: 'Together', color: Colors.green },
  call_to_action: { label: 'Call to action', color: Colors.accent },
} as const;
export type TagType = keyof typeof Tags;
