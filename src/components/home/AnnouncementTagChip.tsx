// ─────────────────────────────────────────────
// AnnouncementTagChip — KAN-17 AC #13
//
// Renders the small uppercase tag chip in the card-row alongside the
// title. Returns null for null tag_type or 'none' (per AC — both render
// no chip). Palette mapping is in NetworkFeedLogic.ts; this file is
// strictly the render surface.
//
// Wireframe v4 lines 277-289 — 0.5rem font, 0.12em letter-spacing,
// uppercase, 2px/6px padding, 2px border-radius. Mobile scaling: 10px
// font (matches scripture-strip reference type), full uppercase, tight
// letter-spacing for the eyebrow read.
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';
import { getTagChipMeta, type TagChipMeta } from './NetworkFeedLogic';

interface Props {
  /** Raw `tag_type` column value (text in the DB). */
  tagType: string | null | undefined;
}

export default function AnnouncementTagChip({ tagType }: Props) {
  const meta = getTagChipMeta(tagType);
  if (!meta) return null;

  const { bg, fg } = paletteColors(meta.palette);

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{meta.label}</Text>
    </View>
  );
}

function paletteColors(palette: TagChipMeta['palette']): { bg: string; fg: string } {
  // Background = 12%-opacity tint of the foreground hex. Matches wireframe
  // tag-red / tag-green / tag-amber / tag-sky declarations (12% rgba over
  // the same hex).
  switch (palette) {
    case 'red':   return { bg: 'rgba(224, 85, 85, 0.12)',  fg: Colors.red };
    case 'green': return { bg: 'rgba(91, 173, 122, 0.12)', fg: Colors.green };
    case 'amber': return { bg: 'rgba(212, 168, 85, 0.12)', fg: Colors.amber };
    case 'sky':   return { bg: 'rgba(107, 181, 232, 0.12)', fg: Colors.accent };
  }
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
