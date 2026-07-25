// ─────────────────────────────────────────────
// wallNewLogic — Prayer Wall rebuild (design_handoff_prayer_wall_NEW)
//
// Pure helpers for the 2026-07 Prayer Wall rebuild. Mirrors the
// PrayerWallLogic pattern: everything testable without React/RN sits
// here. The wire shapes (PrayerRow, TestimonyRow) stay in
// PrayerWallLogic.ts — this module only adds rebuild-specific logic.
//
// Spec: docs/design_handoff_prayer_wall_NEW/README.md (the README wins
// over the .dc.html mock). Founder decisions 2026-07-24 folded in:
//   - "Interceding now" live presence → replaced by a trailing-7-day
//     intercession count (see get_wall_weekly_intercessions migration).
//   - Sort options: Newest first (default) · Most interceding ·
//     Urgent first. Server-side p_sort is additive (migration); the
//     client re-sorts loaded rows so the choice applies even before
//     the migration is deployed.
// ─────────────────────────────────────────────

import type { PrayerRow, TestimonyRow } from './PrayerWallLogic';

// ─── View model ───────────────────────────────────────────────────────

export type WallView = 'feed' | 'testimonies' | 'mine' | 'journal' | 'compose';
export type WallSort = 'newest' | 'most' | 'urgent';
export type WallShow = 'all' | 'urgent';

export const WALL_TABS: { id: Extract<WallView, 'feed' | 'testimonies' | 'mine'>; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'testimonies', label: 'Testimonies' },
  { id: 'mine', label: 'My Prayers' },
];

// Gate fallback — README "Gated state": Compose and Journal are
// unreachable for unverified leaders. If verification lapses while one
// is open, the EFFECTIVE view falls back to Feed; deriving view flags
// from raw state alone rendered an empty screen in the prototype (bug
// note carried in the README verbatim). 'mine' stays reachable when
// gated — it renders the gate panel, not an empty screen.
export function effectiveView(view: WallView, isVerified: boolean): WallView {
  if (!isVerified && (view === 'journal' || view === 'compose')) return 'feed';
  return view;
}

// ─── First-sentence preview ───────────────────────────────────────────
//
// README structural move #2: "The list shows the opening sentence only.
// Prayers are full, multi-sentence texts. The list renders sentence one
// (two if the first is short) with an ellipsis; the full text appears
// on expand."
//
// "Short" is < SHORT_FIRST_CHARS — tuned against the mock's sample data
// so a terse opener ("Pray for us.") carries its second sentence rather
// than rendering as a 3-word row.

const SHORT_FIRST_CHARS = 45;

// Sentence splitter: break after . ! ? (plus any closing quote) when
// followed by whitespace. Keeps the terminator with the sentence.
const SENTENCE_RE = /[^.!?]*[.!?]+["')\]]?(?:\s+|$)/g;

export function sentencePreview(text: string): { preview: string; truncated: boolean } {
  const full = text.trim();
  if (full.length === 0) return { preview: '', truncated: false };

  const matches = full.match(SENTENCE_RE);
  // No sentence punctuation at all — the whole text is the preview.
  if (!matches || matches.length === 0) return { preview: full, truncated: false };

  let preview = matches[0].trim();
  let used = 1;
  if (preview.length < SHORT_FIRST_CHARS && matches.length > 1) {
    preview = (matches[0] + matches[1]).trim();
    used = 2;
  }

  const truncated = matches.slice(used).join('').trim().length > 0
    // Trailing prose beyond the last matched sentence (text without a
    // final terminator) also counts as more-to-read.
    || matches.join('').trim().length < full.length;

  return { preview: truncated ? `${preview}…` : preview, truncated };
}

// ─── Sorting ──────────────────────────────────────────────────────────
//
// Applied client-side over the loaded pages; the p_sort RPC param (see
// migration) makes the server agree once deployed. Ties break to
// newest so the order is deterministic under jest.

function newestFirst(a: PrayerRow, b: PrayerRow): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

// Generic newest-first guard for any created_at-bearing rows. The
// testimonies RPC predates the repo's migrations dir, so its ORDER BY
// cannot be audited from source — the FE enforces chronology itself
// rather than trusting the wire (Founder device pass r2, 2026-07-24).
export function byNewest<T extends { created_at: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

// ─── Standing-in-the-gap window (Founder-approved 2026-07-25) ─────────
//
// The journal list is a VIEW of the intercession record, never its own
// table — so this window can't touch the intercede counts by
// construction (README's invariant). 30 days = a season of carrying;
// 25 visible = the most recent within it. At the cap the oldest simply
// leaves the visible list; the Intercede tap never fails and there is
// no cleanup homework.

export const GAP_WINDOW_DAYS = 30;
export const GAP_VISIBLE_MAX = 25;

export function windowStanding<T extends { prayed_at: string }>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  const cutoff = now.getTime() - GAP_WINDOW_DAYS * 86_400_000;
  return [...rows]
    .filter((r) => {
      const ts = Date.parse(r.prayed_at);
      return !Number.isNaN(ts) && ts >= cutoff;
    })
    .sort((a, b) => Date.parse(b.prayed_at) - Date.parse(a.prayed_at))
    .slice(0, GAP_VISIBLE_MAX);
}

export function sortRows(rows: readonly PrayerRow[], sort: WallSort): PrayerRow[] {
  const copy = [...rows];
  switch (sort) {
    case 'most':
      return copy.sort((a, b) => b.prayed_count - a.prayed_count || newestFirst(a, b));
    case 'urgent':
      return copy.sort((a, b) => Number(b.urgency) - Number(a.urgency) || newestFirst(a, b));
    case 'newest':
    default:
      return copy.sort(newestFirst);
  }
}

// ─── Compose counter stages ───────────────────────────────────────────
//
// Same thresholds as PostPrayerRequestModal (KAN-22): muted → amber at
// ≥250 → red at ≥280; the TextInput maxLength hard-stops at 300. The
// README adds: the counter must reset whenever the Compose view opens
// (a stale amber over an empty field was a real prototype bug) — that
// reset lives in the view; the stage math lives here.

export const COMPOSE_MAX_CHARS = 300;
export const COMPOSE_AMBER_AT = 250;
export const COMPOSE_RED_AT = 280;

export type CounterStage = 'muted' | 'amber' | 'red';

export function counterStage(length: number): CounterStage {
  if (length >= COMPOSE_RED_AT) return 'red';
  if (length >= COMPOSE_AMBER_AT) return 'amber';
  return 'muted';
}

// ─── Testimonies count row ────────────────────────────────────────────
//
// "ANSWERED THIS MONTH" — calendar month of the viewer's clock, not a
// trailing window. Derived client-side from the loaded rows; reads 0
// when the list is empty (README: counts must read 0, not hide).

export function answeredThisMonth(rows: readonly TestimonyRow[], now: Date = new Date()): number {
  const m = now.getMonth();
  const y = now.getFullYear();
  return rows.reduce((count, row) => {
    const t = new Date(row.created_at);
    return t.getMonth() === m && t.getFullYear() === y ? count + 1 : count;
  }, 0);
}

// ─── Row stagger ──────────────────────────────────────────────────────
//
// README motion table: rows fade+rise 500ms with 55ms/row delay,
// capped (~10 rows) so a long page never accumulates seconds of delay.

export const STAGGER_STEP_MS = 55;
export const STAGGER_CAP_ROWS = 10;

export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_CAP_ROWS) * STAGGER_STEP_MS;
}

// ─── Default testimony line ───────────────────────────────────────────
//
// Mark-as-testimony with an empty composer publishes this exact line
// (README View 3). Verbatim; do not paraphrase.
export const DEFAULT_TESTIMONY_TEXT = 'The Lord answered this. We are giving thanks.';
