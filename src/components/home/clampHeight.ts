// ─────────────────────────────────────────────
// clampHeight — the collapsed-state crop for Home's page-turn texts.
//
// The clamp is a CONTAINER maxHeight (the text itself is always laid out
// UNCLAMPED, in a single configuration) instead of a numberOfLines flip.
// Flipping numberOfLines forces Fabric to re-measure the text node under
// LayoutAnimation, and at some device width × text-size combinations that
// re-measure TEARS: one line painted wider than its siblings, cut
// mid-glyph, tail lines dropped (Founder device, 2026-07-28 — survived
// two node-freshness fixes because ANY later relayout, e.g. opening a
// comment thread, could re-trigger it). With one stable text
// configuration there is nothing to re-measure differently, ever.
//
// The crop height scales by fontScale so it always lands on a line
// boundary under Dynamic Type (RN scales lineHeight with the font).
// Trade-off, accepted: the collapsed state no longer shows a "…" — the
// read-on cue below the clamp is the continuation signal.
// ─────────────────────────────────────────────

import { PixelRatio } from 'react-native';

export function clampHeight(lineHeight: number, lines: number): number {
  return Math.round(lineHeight * PixelRatio.getFontScale() * lines);
}
