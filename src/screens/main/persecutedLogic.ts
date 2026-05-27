// Pure logic for the Persecuted tab (KAN-65) + Heartcry Submission Form
// (KAN-64). No React, no Supabase, no IO — every export here is
// deterministic so it can be unit-tested in isolation.
//
// The screen components import these maps so the copy strings live in one
// place; tests can lock them against the live wireframe + content file.

// ── Severity (lockstep with live severity_level enum + content 2026-05-26) ──
// DB enum order: critical · urgent · serious · ongoing · informational.
// Display label + feed one-liner from /content/screen-14-15-persecuted-heartcry.md.

export type HeartcrySeverity =
  | 'critical'
  | 'urgent'
  | 'serious'
  | 'ongoing'
  | 'informational';

interface SeverityCopy {
  label: string;
  oneLiner: string;
}

export const SEVERITY_DISPLAY: Record<HeartcrySeverity, SeverityCopy> = {
  critical: { label: 'Critical', oneLiner: 'In immediate danger now' },
  urgent: { label: 'Urgent', oneLiner: 'Danger is escalating' },
  serious: { label: 'Serious', oneLiner: 'Under real pressure' },
  ongoing: { label: 'Ongoing', oneLiner: 'Enduring for the faith' },
  informational: { label: 'Informational', oneLiner: 'Bearing witness to this' },
} as const;

// ── Heartcry status tracker (KAN-65 AC 7) ─────────────────────────────────
// DB enum: received · seen · responded. Tracker copy ratified by Founder
// 2026-05-26 (post device pass) — verbatim from content file §"Status
// Tracker Copy". DO NOT paraphrase.

export type HeartcryStatus = 'received' | 'seen' | 'responded';

export function trackerCopy(status: HeartcryStatus, respondedAt: string | null): string {
  if (status === 'responded' && respondedAt !== null) {
    return 'We have sent a word — please check your inbox.';
  }
  if (status === 'seen') {
    return 'Your heartcry has been read and we are interceding for your case.';
  }
  // 'received' (DB default on insert) — also the fall-through for the
  // anomalous 'responded' + null responded_at combination, which the BE
  // promises not to write but we defend against here to keep the FE
  // contract total.
  return 'Your heartcry has been received. We will be praying alongside you.';
}

// ── Request type chip options (KAN-64 AC 4) ───────────────────────────────
// CHECK constraint live values: prayer · practical_support · guidance · just_to_be_heard.

export type HeartcryRequestType = 'prayer' | 'practical_support' | 'guidance' | 'just_to_be_heard';

export interface RequestTypeOption {
  value: HeartcryRequestType;
  label: string;
}

export const REQUEST_TYPE_OPTIONS: readonly RequestTypeOption[] = [
  { value: 'prayer', label: 'Prayer' },
  { value: 'practical_support', label: 'Practical support' },
  { value: 'guidance', label: 'Guidance' },
  { value: 'just_to_be_heard', label: 'Just to be heard' },
] as const;

// ── Severity radio options (KAN-64 AC 5) ──────────────────────────────────
// Descriptors verbatim from CONTENT 2026-05-26 (these are DIFFERENT from the
// feed-card one-liners above — radio descriptors explain the urgency tier
// to the leader choosing, feed one-liners explain it to the leader reading).

export interface SeverityRadioOption {
  value: HeartcrySeverity;
  label: string;
  descriptor: string;
}

export const SEVERITY_RADIO_OPTIONS: readonly SeverityRadioOption[] = [
  { value: 'critical', label: 'Critical', descriptor: 'Immediate threat to life or freedom.' },
  { value: 'urgent', label: 'Urgent', descriptor: 'The situation is worsening and needs prayer now.' },
  { value: 'serious', label: 'Serious', descriptor: 'Significant pressure — not yet at immediate risk.' },
  { value: 'ongoing', label: 'Ongoing', descriptor: 'Persistent persecution, not currently escalating.' },
  { value: 'informational', label: 'Informational', descriptor: 'I want the Replant team to know what is happening here.' },
] as const;

// ── Feed-card excerpt truncation (KAN-65 AC 5) ────────────────────────────
// "~120 chars with ellipsis". Truncate on a word boundary when possible so
// the cut doesn't land mid-word. Trim trailing whitespace before adding the
// ellipsis character (… single glyph, not three dots).

const EXCERPT_MAX = 120;
const EXCERPT_ELLIPSIS = '…';

export function truncateExcerpt(text: string | null | undefined): string {
  if (!text) return '';
  if (text.length <= EXCERPT_MAX) return text;
  // Cut at last space within budget; if the budget contains no space the
  // word is longer than the budget, fall back to a hard cut.
  const slice = text.slice(0, EXCERPT_MAX);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + EXCERPT_ELLIPSIS;
}

// ── Relative timestamp (KAN-65 AC 5) ──────────────────────────────────────
// Same shape as PrayerWallLogic.formatRelativeTime so the two surfaces feel
// consistent: just now / Xm ago / Xh ago / Xd ago, then fall back to a date
// once we cross 30 days. Returns '' on invalid input so callers can
// optionally hide the timestamp cell.

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const FALLBACK_DAYS = 30;

export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return '';
  const deltaMs = Math.max(0, now.getTime() - t);
  if (deltaMs < MIN_MS) return 'just now';
  if (deltaMs < HOUR_MS) return `${Math.floor(deltaMs / MIN_MS)}m ago`;
  if (deltaMs < DAY_MS) return `${Math.floor(deltaMs / HOUR_MS)}h ago`;
  const days = Math.floor(deltaMs / DAY_MS);
  if (days < FALLBACK_DAYS) return `${days}d ago`;
  // Beyond a month, surface the date in YYYY-MM-DD (no locale dependency).
  return new Date(t).toISOString().slice(0, 10);
}
