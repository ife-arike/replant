// KAN-124 — FLAG_TAXONOMY secret loader + type definitions.
//
// AC-12 PATTERN SECRECY (load-bearing for persecuted-leader safety):
// pattern strings live ONLY in the Supabase Edge Function secret
// `FLAG_TAXONOMY` (set via dashboard: Functions → send-message →
// Secrets). They never appear in any committed file in this repo,
// any FE bundle, or any test fixture. The Edge Function reads the
// secret via Deno.env.get('FLAG_TAXONOMY') at cold-start and parses
// it into the shape below. Tests use SYNTHETIC taxonomy fixtures
// only — never real patterns.
//
// AC-18 forward-track (KAN-125): per-axis state-transition independence.
// Admin clearing flag_status MUST NOT remove row from pastoral queue.
// Pastoral-axis clearing MUST NOT remove from admin queue.
// State-transition independence is owned by KAN-125 surface design.
//
// DELIVER-ALWAYS (D-45 clause 3): loadTaxonomy returns null on missing
// or malformed env. Callers treat null as "no taxonomy available" which
// the matcher folds into "no matches" — flagged=false, flag_reason=null.
// The function STILL delivers messages even when the taxonomy secret
// is missing or corrupt. Fail-open is the contract; the warning is the
// alarm.

export type TaxonomyRouting = "admin" | "pastoral";
export type TaxonomySource = "auto" | "manual";
export type TaxonomyTier = 1 | 2 | 3;

export interface TaxonomyCode {
  code: string;
  source_prefix: TaxonomySource;
  tier: TaxonomyTier;
  routing: TaxonomyRouting;
  // patterns loaded from FLAG_TAXONOMY secret — never inline-listed
  // in code per AC-12. Stub codes (T2/T3 admin + pastoral T2 + manual)
  // have patterns: [] and are skipped by the matcher.
  patterns: string[];
}

export interface Taxonomy {
  taxonomy_version: string;
  codes: TaxonomyCode[];
}

// Defensive shape validation. Edge case posture: any malformed entry
// invalidates the whole taxonomy (return null at the top level). The
// matcher then runs with no taxonomy → flagged=false on every message.
// SOC sees the "taxonomy-unavailable" log at boot; messages keep
// delivering. Half-broken taxonomies are forbidden — partial trust
// is worse than no trust here.
function isTaxonomyShape(v: unknown): v is Taxonomy {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj.taxonomy_version !== "string") return false;
  if (obj.taxonomy_version.length === 0) return false;
  if (!Array.isArray(obj.codes)) return false;
  for (const c of obj.codes) {
    if (!c || typeof c !== "object") return false;
    const code = c as Record<string, unknown>;
    if (typeof code.code !== "string" || code.code.length === 0) return false;
    if (code.source_prefix !== "auto" && code.source_prefix !== "manual") {
      return false;
    }
    if (code.tier !== 1 && code.tier !== 2 && code.tier !== 3) return false;
    if (code.routing !== "admin" && code.routing !== "pastoral") return false;
    if (!Array.isArray(code.patterns)) return false;
    for (const p of code.patterns) if (typeof p !== "string") return false;
  }
  return true;
}

// loadTaxonomy — parses the FLAG_TAXONOMY env JSON. Returns null on:
//   - undefined / empty env value
//   - JSON.parse throw (malformed JSON)
//   - shape validation failure (missing fields / wrong types)
// Pure function; no logging here — caller logs the failure reason.
// Tests can call this with a JSON string directly.
export function loadTaxonomy(envValue: string | undefined | null): Taxonomy | null {
  if (!envValue) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(envValue);
  } catch {
    return null;
  }
  if (!isTaxonomyShape(parsed)) return null;
  return parsed;
}

// Reason classifier for boot-time logging. Caller logs the right
// reason without re-parsing.
export type TaxonomyLoadFailureReason =
  | "env-missing"
  | "parse-failed"
  | "shape-invalid";

export function classifyLoadFailure(
  envValue: string | undefined | null,
): TaxonomyLoadFailureReason | null {
  if (!envValue) return "env-missing";
  try {
    const parsed = JSON.parse(envValue);
    if (!isTaxonomyShape(parsed)) return "shape-invalid";
    return null;
  } catch {
    return "parse-failed";
  }
}
