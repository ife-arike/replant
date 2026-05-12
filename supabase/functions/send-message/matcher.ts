// KAN-124 — taxonomy matcher + flag_reason composition + observability.
//
// DELIVER-ALWAYS — D-45 clause 3 (locked decision, 2026-05-09).
// Keyword match writes flagged/flag_reason but NEVER gates delivery.
// TIER routes admin-queue prioritization only. Never introduce HOLD-on-keyword.
//
// AC-2 collect-all semantics: iterate ALL codes; per-code first-pattern-
// match short-circuits the inner pattern loop only. Never short-circuit
// the OUTER code-iteration loop on first match — that masks cross-code
// signals (e.g., a duress_signal pattern alongside an imminent_threat
// pattern; both must surface).
//
// AC-3 flag_reason composition: comma-joined `auto:<code>` entries,
// 500-char total cap. Overflow handling drops lowest-priority entries
// first (highest tier number → T3 first, then T2; T1 is preserved at
// all costs). dropped_codes returned for BE observability logging.
//
// AC-12 PATTERN SECRECY: pattern strings come from the FLAG_TAXONOMY
// secret via taxonomy.ts. They are NEVER inlined in this file. Tests
// use synthetic taxonomy fixtures only.
//
// AC-16 obfuscation handling at the matcher layer:
//   - NFKC normalization (content.normalize('NFKC')) folds fullwidth +
//     compatibility forms to canonical halfwidth ASCII so a fullwidth
//     pattern variant doesn't bypass detection.
//   - Whitespace collapse (multiple runs of whitespace → single space)
//     defeats space-insertion obfuscation.
//   - L33t substitution: STUB at MVP (returns input unchanged). Table
//     authoring is a separate SEC + OPS pass; the stub keeps the call
//     site stable so the eventual table swap is one function-body edit.
//
// AC-18 forward-track (KAN-125): per-axis state-transition independence.
// Admin clearing flag_status MUST NOT remove row from pastoral queue.
// Pastoral-axis clearing MUST NOT remove from admin queue.
// State-transition independence is owned by KAN-125 surface design.

import { type Taxonomy, type TaxonomyCode, type TaxonomyTier } from "./taxonomy.ts";

export interface MatchObservability {
  // True iff bribery_attempt matched AND a currency-amount pattern
  // appeared within 50 chars of the bribery match. Strengthened
  // T1 signal for SOC observability; does NOT alter flag_reason
  // composition.
  bribery_currency_co_occurrence: boolean;
  // True iff matched codes include at least one admin-routing AND
  // at least one pastoral-routing entry. AC-17 cross-axis dual-route
  // is the general case; this counter surfaces the high-stakes
  // collision (e.g., urgent_safety_request + self_harm_indicator).
  cross_axis: boolean;
}

export interface MatchResult {
  matches: TaxonomyCode[];
  priority: TaxonomyTier | null; // lowest tier number across matches; null if no matches
  observability: MatchObservability;
}

// escapeRegex — mandatory before any RegExp construction over content
// derived from the taxonomy. Without it, a regex metachar inside a
// SEC-stamped pattern would become wildcard / unmatched-group and
// either over-match (false positive cascade) or throw at construction
// (silent scan failure). Per SEC keyword-scan discipline.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// applyLeetSubstitution — STUB at MVP per AC-16. Returns input unchanged.
// The l33t substitution table is a separate SEC + OPS authoring pass;
// the matcher call site is built around this function so the eventual
// table swap is a one-function-body change with no surrounding code edits.
export function applyLeetSubstitution(s: string): string {
  // TODO: l33t table — separate SEC + OPS authoring pass
  return s;
}

// normalizeForMatching — pre-processes content before regex evaluation.
// Order matters:
//   1. NFKC normalization (fullwidth → halfwidth, compatibility forms)
//   2. L33t substitution stub (no-op at MVP)
//   3. Whitespace collapse (runs of \s+ → single space)
// The original content is NOT mutated; the matcher operates on the
// normalized copy. Audit / persistence still see the raw content.
export function normalizeForMatching(content: string): string {
  let s = content.normalize("NFKC");
  s = applyLeetSubstitution(s);
  s = s.replace(/\s+/g, " ");
  return s;
}

// Bribery currency co-occurrence regexes. Two patterns:
//   (a) currency-symbol-leading: $1,200 / €500 / ₦5,000 / R$ 100 / ₽ 50K
//   (b) currency-word-trailing: 1,000 USD / 50 naira / 200 dollars
// Observability only — does NOT alter flag_reason composition. Logged
// alongside the matcher result for SOC.
const CURRENCY_SYMBOL_RE =
  /(?:\$|€|£|¥|₦|₹|R\$|₽)\s*[\d,]+(?:\.\d+)?(?:\s*(?:thousand|million|k|m))?/i;
const CURRENCY_WORD_RE =
  /\b\d[\d,]*\s*(?:USD|EUR|GBP|JPY|NGN|INR|BRL|RUB|naira|dollars|euros|pounds|yuan|rupees|reais|rubles)\b/i;

function hasCurrencyInWindow(text: string): boolean {
  return CURRENCY_SYMBOL_RE.test(text) || CURRENCY_WORD_RE.test(text);
}

// collectMatches — full taxonomy matcher.
// Returns { matches, priority, observability }. Pattern strings loaded
// from FLAG_TAXONOMY secret — see taxonomy.ts.
//
// Iteration shape:
//   - SKIP entries where source_prefix !== 'auto' (manual codes never auto-fire)
//   - SKIP entries where patterns.length === 0 (T2/T3 stubs deferred to corpus authoring)
//   - For each remaining code, iterate its patterns; break the INNER
//     pattern loop on first match (one match per code is sufficient).
//   - NEVER break the OUTER code loop on a match — collect-all is
//     load-bearing per AC-2.
//   - priority = min(matched.tier) once iteration completes. null when
//     no matches.
//
// DELIVER-ALWAYS contract: this function never returns a delivery
// decision. The caller MUST NOT branch INSERT / Realtime broadcast /
// 200 response on the return value.
export function collectMatches(
  content: string,
  taxonomy: Taxonomy | null,
): MatchResult {
  const empty: MatchResult = {
    matches: [],
    priority: null,
    observability: { bribery_currency_co_occurrence: false, cross_axis: false },
  };
  if (!taxonomy) return empty;

  const normalized = normalizeForMatching(content);

  const matched: TaxonomyCode[] = [];
  let briberyMatchIdx: number | null = null;
  let briberyMatchLen = 0;

  for (const code of taxonomy.codes) {
    if (code.source_prefix !== "auto") continue;
    if (code.patterns.length === 0) continue;
    for (const pattern of code.patterns) {
      // Word-boundary regex per SEC keyword-scan discipline (substring
      // false positives drive alert fatigue at moderation).
      const re = new RegExp("\\b" + escapeRegex(pattern) + "\\b", "i");
      const m = re.exec(normalized);
      if (m) {
        matched.push(code);
        if (code.code === "bribery_attempt") {
          briberyMatchIdx = m.index;
          briberyMatchLen = m[0].length;
        }
        break; // per-pattern break — outer loop continues (collect-all)
      }
    }
  }

  const priority: TaxonomyTier | null = matched.length > 0
    ? (Math.min(...matched.map((c) => c.tier)) as TaxonomyTier)
    : null;

  // Cross-axis observability — at least one admin AND at least one
  // pastoral match in the same message. Per AC-17 this is the load-
  // bearing dual-route case; BOTH queues receive the row via their
  // routing-axis filter on read.
  const hasAdmin = matched.some((c) => c.routing === "admin");
  const hasPastoral = matched.some((c) => c.routing === "pastoral");
  const cross_axis = hasAdmin && hasPastoral;

  // Bribery + currency co-occurrence (50-char window either side of
  // the bribery match). Observability-only — does NOT change flag_reason.
  let bribery_currency_co_occurrence = false;
  if (briberyMatchIdx !== null) {
    const start = Math.max(0, briberyMatchIdx - 50);
    const end = Math.min(normalized.length, briberyMatchIdx + briberyMatchLen + 50);
    bribery_currency_co_occurrence = hasCurrencyInWindow(normalized.slice(start, end));
  }

  return {
    matches: matched,
    priority,
    observability: { bribery_currency_co_occurrence, cross_axis },
  };
}

// AC-3 — flag_reason composition. Comma-joined `auto:<code>` entries,
// total ≤ 500 chars. Overflow handling drops lowest-priority entries
// first (highest tier number → T3 dropped before T2; T1 preserved at
// all costs per the SEC budget rationale). dropped_codes returned so
// the caller emits a single observability log entry (without leaking
// content).
//
// Stable ordering on entries: sort by tier ASC, then by original
// taxonomy position within tier. Preserves T1-first determinism in
// flag_reason rendering on the admin queue.

export const FLAG_REASON_MAX_LEN = 500;

export interface FlagReasonComposed {
  flag_reason: string | null;
  dropped_codes: string[]; // `auto:<code>` entries dropped on overflow
}

export function composeFlagReason(
  matched: TaxonomyCode[],
): FlagReasonComposed {
  if (matched.length === 0) return { flag_reason: null, dropped_codes: [] };

  // Stable sort: tier ASC primary, preserves original sequence for ties.
  const sorted = [...matched].sort((a, b) => a.tier - b.tier);
  const entries = sorted.map((c) => `auto:${c.code}`);
  const dropped: string[] = [];

  // Drop tail (lowest tier) while over cap. Even a single entry over
  // cap is impossible at MVP (longest code name + `auto:` prefix is
  // well under 50 chars; 500-char cap accommodates ~10 entries). The
  // length > 1 guard keeps a single-entry-over-cap pathological from
  // looping forever — that shape would be a taxonomy authoring bug
  // and bubbles up as a too-long flag_reason rather than silently
  // dropping the only signal.
  while (entries.join(",").length > FLAG_REASON_MAX_LEN && entries.length > 1) {
    const droppedEntry = entries.pop()!;
    dropped.push(droppedEntry);
  }

  return { flag_reason: entries.join(","), dropped_codes: dropped };
}
