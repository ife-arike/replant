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
  // Prayer Wall rebuild (design_handoff_prayer_wall_NEW, Founder-approved
  // 2026-07-24) — sky-tinted hairlines for the wall's header rule and row
  // separators. The tint is subtle but intentional: it is the only thing
  // keeping the long request list from reading as grey.
  borderAccentStrong: 'rgba(107, 181, 232, 0.22)',
  borderAccentSubtle: 'rgba(107, 181, 232, 0.10)',
  // Persecuted refinement (design_handoff_persecuted_NEW §3, 2026-07-26).
  // borderRowSubtle intentionally equals borderAccentSubtle today — named
  // separately so the two tabs can diverge without a sweep.
  borderRowSubtle: 'rgba(107, 181, 232, 0.10)',
  borderAccentRed: 'rgba(224, 85, 85, 0.26)',
  redRing: 'rgba(224, 85, 85, 0.55)',

  // RAG
  green: '#5BAD7A',
  amber: '#D4A855',
  red: '#E05555',

  // Home-tab card surfaces (KAN-201 home redesign 2026-06-01) — derived
  // from existing tokens; do not introduce additional brand values.
  cardSurface: '#111113',   // card chassis — a hair above surface
  // Founder 2026-07-24: feed cards unified to ONE surface for now — the
  // subtle warm/cool split didn't help. Token retained so a future
  // re-split is a one-line change.
  cardWarm: '#111113',      // = cardSurface (unified; was #131110)
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
  // KAN-23 v7 Item 08 — was: kept ONLY for filter chips, feed card
  // category/urgent tags, testimony chip; all other Prayer Wall mono
  // swept to DM Sans.
  // AMENDED by the Prayer Wall rebuild (design_handoff_prayer_wall_NEW,
  // token decision A, Founder-approved 2026-07-24): the rebuilt tab
  // deliberately uses the tiny-caps mono register for its eyebrow/label
  // layer — location eyebrows, tab labels, section labels, meta labels —
  // because the mono caps are what make the wall read as a quiet ledger
  // rather than a social feed. Item 08 remains in force on surfaces
  // outside the rebuilt Prayer Wall tab.
  mono: 'DMMono_400Regular',
} as const;

// Feed card title register — ONE size across every Home feed card.
// Founder 2026-07-27: standardize on the regular announcement card's
// title (21/26). Cards previously ranged 21–26, which read as accidental
// rather than hierarchical. Spread this into a card's title/lead style;
// never re-hardcode a feed title size.
export const FeedTitle = { fontSize: 21, lineHeight: 26 } as const;

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
// eyebrow. Post badge-cutover (KAN-335) the mobile feed resolves this
// register from `announcements.badge` (none | new | urgent), falling back
// to the legacy `tag_type` shadow only for rows cached before badge
// entered the projection (see NetworkFeed `resolveEyebrowTag`):
//   badge 'urgent' → urgent   badge 'new' → new   badge 'none' → update
// The retired 'notice' register is no longer produced by the feed
// resolver (kept below only for the legacy chip meta + its tests). Keep
// this in sync with the eyebrow dot colours — it is the single source of
// truth for the Home cards.
export const Tags = {
  update: { label: 'Network update', color: Colors.accent },
  notice: { label: 'Notice', color: Colors.amber }, // retired — never emitted by resolveEyebrowTag
  urgent: { label: 'Urgent', color: Colors.red },
  new: { label: 'New', color: Colors.accent }, // KAN-335 badge=new register (sky, static dot)
  // KAN-201 card-system extension 2026-06-02 — new card types.
  together: { label: 'Together', color: Colors.green },
  call_to_action: { label: 'Call to action', color: Colors.accent },
} as const;
export type TagType = keyof typeof Tags;
