// ─────────────────────────────────────────────
// CommentThread — pure identity logic (KAN-338 FE cutover, 2026-07-26)
//
// The get_comments v3 RPC composes ALL identity display server-side
// (Monotone Protection Ratchet, kan338_0006): `display_name` arrives
// render-ready, `church_label` carries the church name or the macro-region
// label, and the three booleans (`name_held`, `church_held`,
// `is_underground`) are LIVE-state discriminants. The FE derives nothing
// from users/churches rows and no longer branches on the write-time
// mask_reason (the F1/F3 defect class: anonymous underground leaders used
// to render with the public-anon affordance because the priority enum
// never recorded the underground fact).
//
// This module is the single place the avatar affordance is decided, so
// the seven reachable states stay unit-pinned (same *Logic.ts pattern as
// NetworkFeedLogic / DailyScriptureStripLogic).
// ─────────────────────────────────────────────

export const MASKED_COMMENT_NAME = 'A leader in the network';

// The v3 composed fields. Optional so a defensively-typed caller can pass
// a legacy-shaped row; absence falls back to the legacy columns without
// ever re-deriving masking rules client-side.
export type CommentIdentityRow = {
  display_name?: string | null;
  name_held?: boolean | null;
  church_label?: string | null;
  church_held?: boolean | null;
  is_underground?: boolean | null;
  // legacy passthrough (fallback only — the server remains the composer)
  author_name?: string | null;
  church_name?: string | null;
  masked_region?: string | null;
};

export type CommentIdentity = {
  /** Render verbatim in the name slot. */
  displayName: string;
  /** Render verbatim in the church slot ('' hides the line). */
  churchLine: string;
  /** Round avatar = underground context or fully-held identity. */
  round: boolean;
  /** What the avatar circle shows. */
  glyph: 'initial' | 'letterA' | 'lock';
  /** Uppercase initial for glyph === 'initial'. */
  initial: string;
};

// The seven reachable states (KAN-338 FE-lane truth table):
//   none                    → square · initial
//   anon + public church    → square · "A"       (church line stays real)
//   anon + UG safe          → round  · lock      (fixed: was square "A")
//   anon + UG brave         → round  · lock
//   UG non-anon + safe      → round  · initial   (region label church line)
//   UG non-anon + brave     → round  · initial   (real church line)
//   no_church               → round  · lock
export function commentIdentity(c: CommentIdentityRow): CommentIdentity {
  const displayName =
    (c.display_name ?? '').trim() ||
    (c.author_name ?? '').trim() ||
    MASKED_COMMENT_NAME;

  const churchLine =
    c.church_label != null
      ? c.church_label
      : (c.church_name ?? c.masked_region ?? '');

  const isUnderground = !!c.is_underground;
  // Fallback when composed booleans are absent: a name present means not
  // held. Never re-derive from mask_reason here — the server owns masking.
  const nameHeld = c.name_held ?? !((c.author_name ?? '').trim());

  const fullyMasked = nameHeld && displayName === MASKED_COMMENT_NAME;
  const round = isUnderground || fullyMasked;
  const glyph: CommentIdentity['glyph'] = !nameHeld
    ? 'initial'
    : isUnderground || fullyMasked
      ? 'lock'
      : 'letterA';

  return {
    displayName,
    churchLine,
    round,
    glyph,
    initial: displayName.trim().charAt(0).toUpperCase() || '·',
  };
}
