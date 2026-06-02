// theme.ts — Replant design tokens (locked).
// Mirrors src/constants/theme.ts. Web fallbacks for each Typography family
// are noted in comments; the strings below are the React Native font identifiers.

export const Colors = {
  background:      '#080808',
  surface:         '#111111',
  surfaceElevated: '#181818',
  border:          'rgba(240,237,230,0.08)',
  borderAccent:    'rgba(107,181,232,0.25)',
  accent:          '#6BB5E8',  // sky — interactive
  text:            '#F0EDE6',  // off-white — primary
  textMuted:       'rgba(240,237,230,0.45)',
  textSubtle:      'rgba(240,237,230,0.25)',
  green:           '#5BAD7A',
  amber:           '#D4A855',
  red:             '#E05555',

  // Home-tab additions used by this screen:
  cardSurface:     '#111113',  // a hair above surface — the card chassis
  cardWarm:        '#131110',  // warm card surface (OPTIONAL — default off)
  linkWell:        'rgba(107,181,232,0.04)',
} as const;

export const Typography = {
  display:         'CormorantGaramond_600SemiBold',
  displayMedium:   'CormorantGaramond_500Medium',
  displayRegular:  'CormorantGaramond_400Regular',
  scriptureItalic: 'CormorantGaramond_300Light_Italic',
  scriptureLight:  'CormorantGaramond_300Light',
  body:            'DMSans_400Regular',
  bodyMedium:      'DMSans_500Medium',
  sansLight:       'DMSans_300Light',
  mono:            'DMMono_400Regular',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const Radius  = { sm: 4, md: 8, lg: 12, xl: 20 } as const;

// Tag → dot / label / chip colour (drives the eyebrow dot + Notice/Urgent chips).
export const Tags = {
  update: { label: 'Network update', color: Colors.accent },
  notice: { label: 'Notice',         color: Colors.amber  },
  urgent: { label: 'Urgent',         color: Colors.red    },
} as const;
export type TagType = keyof typeof Tags;
