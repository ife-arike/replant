// ─────────────────────────────────────────────
// ScripturePull — the scripture anchor inside a feed card
// (Day-1 Home polish, Founder GO 2026-07-28)
//
// Renders announcements.verse_text / verse_reference. Two modes:
//   text + reference → pull-quote: scriptureItalic verse behind a thin
//                      sky-tinted left rule (DailyScriptureStrip DNA at
//                      card scale), mono reference beneath (sky).
//   reference only   → a single mono anchor line (sky) — the same
//                      register the leader-voice cards' verse slot uses.
// Nothing renders when both are absent.
//
// The verse column is ONE deliberate anchor per post (Founder ruling
// 2026-07-28): scriptures mentioned in the body stay ordinary prose;
// the author lifts at most one. scriptureItalic is permitted here —
// this is actual scripture (typography ruling).
// ─────────────────────────────────────────────

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

type Props = {
  text?: string | null;
  reference?: string | null;
};

export default function ScripturePull({ text, reference }: Props) {
  const t = text?.trim();
  const ref = reference?.trim();
  if (!t && !ref) return null;

  if (!t) {
    // Anchor-only — quiet mono citation line.
    return (
      <View style={s.anchorWrap}>
        <Text style={s.ref}>{ref}</Text>
      </View>
    );
  }

  return (
    <View style={s.pullWrap}>
      <Text style={s.verse}>{t}</Text>
      {!!ref && <Text style={[s.ref, s.refUnderVerse]}>{ref}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  pullWrap: {
    marginTop: 14,
    paddingLeft: 13,
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderAccentStrong,
  },
  anchorWrap: {
    marginTop: 14,
  },
  // Scripture register — native 300 Light Italic (never synthetic italic).
  verse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
    color: Colors.text,
  },
  ref: {
    fontFamily: Typography.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: Colors.accent,
  },
  refUnderVerse: {
    marginTop: 7,
  },
});
