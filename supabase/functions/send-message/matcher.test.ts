// KAN-124 matcher tests — synthetic taxonomy fixtures only.
//
// AC-12 PATTERN SECRECY enforcement: this file MUST NEVER contain a
// real pattern string from the FLAG_TAXONOMY secret. All test patterns
// use uppercase synthetic markers (e.g., "ALPHA1A", "BRIBE_PAYWORD")
// that can never collide with real English content. SM-grep at merge
// verifies zero real-pattern leakage in any committed file.
//
// What's NOT covered here (deferred to integration / smoke):
//   - AC-13(ii) per-T1-code recipient-parity (requires a Realtime
//     subscriber; defers to founder smoke at FE wire-up)
//   - AC-7 corpus seeding for the 10 T1 codes (operator-only test
//     suite using the real FLAG_TAXONOMY against a SEC-curated corpus
//     at tests/security/auto_flag_corpus/ — separate authoring pass)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectMatches,
  composeFlagReason,
  escapeRegex,
  FLAG_REASON_MAX_LEN,
  normalizeForMatching,
} from "./matcher.ts";
import { type Taxonomy } from "./taxonomy.ts";

// SYNTHETIC taxonomy fixture. Uppercase markers chosen so they cannot
// collide with English content. Two admin T1 codes, one admin T2, one
// admin T3, one pastoral T1, one pastoral T2, one bribery-shaped code,
// one stub (skipped by matcher), one manual (skipped by matcher).
const SYNTH: Taxonomy = {
  taxonomy_version: "test-1.0",
  codes: [
    { code: "synth_a_t1_alpha",  source_prefix: "auto",   tier: 1, routing: "admin",    patterns: ["ALPHA1A"] },
    { code: "synth_a_t1_beta",   source_prefix: "auto",   tier: 1, routing: "admin",    patterns: ["BETA1B"] },
    { code: "synth_a_t2",        source_prefix: "auto",   tier: 2, routing: "admin",    patterns: ["GAMMA2"] },
    { code: "synth_a_t3",        source_prefix: "auto",   tier: 3, routing: "admin",    patterns: ["DELTA3"] },
    { code: "synth_p_t1",        source_prefix: "auto",   tier: 1, routing: "pastoral", patterns: ["EPSILON_P1"] },
    { code: "synth_p_t2",        source_prefix: "auto",   tier: 2, routing: "pastoral", patterns: ["ZETA_P2"] },
    { code: "bribery_attempt",   source_prefix: "auto",   tier: 1, routing: "admin",    patterns: ["BRIBE_PAYWORD"] },
    { code: "synth_stub",        source_prefix: "auto",   tier: 2, routing: "admin",    patterns: [] },
    { code: "synth_manual",      source_prefix: "manual", tier: 3, routing: "admin",    patterns: [] },
  ],
};

// ─────────────────────────── escapeRegex ───────────────────────────

Deno.test("escapeRegex: escapes regex metacharacters", () => {
  assertEquals(escapeRegex("a.b*c+d?"), "a\\.b\\*c\\+d\\?");
});

Deno.test("escapeRegex: leaves plain alphanumerics alone", () => {
  assertEquals(escapeRegex("hello123"), "hello123");
});

Deno.test("escapeRegex: metachar in pattern compiles to literal-match regex", () => {
  // If a real pattern ever contained a regex metacharacter, escapeRegex
  // turns it literal — preventing wildcard false-positives. Synthetic
  // probe; no real-pattern reference.
  const re = new RegExp("\\b" + escapeRegex("a.b") + "\\b", "i");
  assertEquals(re.test("the a.b token"), true);
  assertEquals(re.test("the aXb token"), false);
});

// ─────────────────────── normalizeForMatching ───────────────────────

Deno.test("normalizeForMatching: applies NFKC normalization", () => {
  // Fullwidth A (U+FF21) decomposes to halfwidth A under NFKC.
  const fullwidth = "Ａ" + "BC"; // "ＡBC"
  assertEquals(normalizeForMatching(fullwidth), "ABC");
});

Deno.test("normalizeForMatching: collapses whitespace runs", () => {
  assertEquals(normalizeForMatching("hello   \t  world"), "hello world");
  assertEquals(normalizeForMatching("a\n\n\nb"), "a b");
});

Deno.test("normalizeForMatching: defeats space-insertion obfuscation", () => {
  // Attacker inserts extra spaces inside a phrase to dodge word-boundary
  // pattern. Normalize collapses, then the matcher sees the canonical
  // single-spaced form.
  const obfuscated = "ALPHA1A   in   the   middle";
  assertEquals(normalizeForMatching(obfuscated), "ALPHA1A in the middle");
});

// ─────────────────────────── collectMatches ───────────────────────────

Deno.test("collectMatches: null taxonomy → empty matches (DELIVER-ALWAYS fail-open)", () => {
  const r = collectMatches("anything at all", null);
  assertEquals(r.matches.length, 0);
  assertEquals(r.priority, null);
  assertEquals(r.observability.cross_axis, false);
  assertEquals(r.observability.bribery_currency_co_occurrence, false);
});

Deno.test("collectMatches: empty content → empty matches", () => {
  const r = collectMatches("", SYNTH);
  assertEquals(r.matches.length, 0);
  assertEquals(r.priority, null);
});

Deno.test("collectMatches: no match → empty matches; priority=null", () => {
  const r = collectMatches("ordinary safe content with nothing concerning", SYNTH);
  assertEquals(r.matches.length, 0);
  assertEquals(r.priority, null);
});

Deno.test("collectMatches: single-code match → 1 match; priority=that tier", () => {
  const r = collectMatches("warning sign: ALPHA1A appears", SYNTH);
  assertEquals(r.matches.length, 1);
  assertEquals(r.matches[0].code, "synth_a_t1_alpha");
  assertEquals(r.priority, 1);
});

Deno.test("collectMatches: AC-2 collect-all — multi-code match returns all codes (NOT first-wins)", () => {
  // Three different codes hit simultaneously across tiers. The matcher
  // MUST return all three — first-match-wins would mask the T1 + T2
  // behind whichever ordered first in the taxonomy.
  const r = collectMatches(
    "ALPHA1A and GAMMA2 and DELTA3 all in one message",
    SYNTH,
  );
  const codes = r.matches.map((m) => m.code).sort();
  assertEquals(codes, ["synth_a_t1_alpha", "synth_a_t2", "synth_a_t3"]);
  assertEquals(r.priority, 1); // min tier across matches
});

Deno.test("collectMatches: AC-17 cross-axis dual-route — admin AND pastoral both in matches", () => {
  // The highest-stakes collision scenario per the dispatch: a single
  // message hits both routing axes. The matcher returns both codes;
  // downstream queue surfaces filter on routing.
  const r = collectMatches(
    "BETA1B (admin signal) AND EPSILON_P1 (pastoral signal)",
    SYNTH,
  );
  const codes = r.matches.map((m) => m.code).sort();
  assertEquals(codes, ["synth_a_t1_beta", "synth_p_t1"]);
  assertEquals(r.observability.cross_axis, true);
});

Deno.test("collectMatches: pure-admin matches → cross_axis=false", () => {
  const r = collectMatches("ALPHA1A and GAMMA2 here", SYNTH);
  assertEquals(r.observability.cross_axis, false);
});

Deno.test("collectMatches: pure-pastoral matches → cross_axis=false", () => {
  const r = collectMatches("EPSILON_P1 and ZETA_P2 here", SYNTH);
  assertEquals(r.observability.cross_axis, false);
});

Deno.test("collectMatches: stub code (patterns: []) is skipped", () => {
  // synth_stub has source_prefix='auto' but empty patterns — matcher
  // must skip without throwing on the empty array.
  const r = collectMatches("synth_stub mention in plain text", SYNTH);
  assertEquals(r.matches.find((m) => m.code === "synth_stub"), undefined);
});

Deno.test("collectMatches: manual-source code never auto-fires", () => {
  // synth_manual has source_prefix='manual'. Even if its code name
  // appears in content, the matcher must NOT include it.
  const r = collectMatches("synth_manual is mentioned here", SYNTH);
  assertEquals(r.matches.find((m) => m.code === "synth_manual"), undefined);
});

Deno.test("collectMatches: case-insensitive matching", () => {
  const r = collectMatches("the word alpha1a appears in lowercase", SYNTH);
  assertEquals(r.matches.length, 1);
  assertEquals(r.matches[0].code, "synth_a_t1_alpha");
});

Deno.test("collectMatches: word-boundary respected — substring does NOT match", () => {
  // ALPHA1A as a substring inside a longer word doesn't fire — per
  // SEC alert-fatigue ruling.
  const r = collectMatches("xALPHA1Ax embedded substring", SYNTH);
  assertEquals(r.matches.length, 0);
});

Deno.test("collectMatches: one match per code (multiple keyword instances don't dupe)", () => {
  // If a single message contains the same pattern twice, the matcher
  // includes the code once (not twice). Per-pattern break inside the
  // inner loop is the load-bearing detail.
  const r = collectMatches("ALPHA1A ALPHA1A ALPHA1A all over", SYNTH);
  assertEquals(r.matches.length, 1);
});

Deno.test("collectMatches: NFKC normalize defeats fullwidth obfuscation", () => {
  // Fullwidth A B C D E etc. normalize to ASCII halfwidth — the matcher
  // catches a fullwidth-encoded variant of the synthetic pattern.
  const fullwidth = "ＡＬＰＨＡ" + "1" + "Ａ"; // ＡＬＰＨＡ1Ａ
  // After NFKC + collapse: "ALPHA1A"
  const r = collectMatches(`some prefix ${fullwidth} suffix`, SYNTH);
  assertEquals(r.matches.length, 1);
  assertEquals(r.matches[0].code, "synth_a_t1_alpha");
});

// ─────────────────── bribery currency co-occurrence ───────────────────

Deno.test("collectMatches: bribery match + currency within 50 chars → co_occurrence=true", () => {
  const r = collectMatches(
    "we will pay BRIBE_PAYWORD $5,000 for info",
    SYNTH,
  );
  assertEquals(r.matches.find((m) => m.code === "bribery_attempt") !== undefined, true);
  assertEquals(r.observability.bribery_currency_co_occurrence, true);
});

Deno.test("collectMatches: bribery match WITHOUT currency → co_occurrence=false", () => {
  const r = collectMatches("BRIBE_PAYWORD but no money mentioned at all", SYNTH);
  assertEquals(r.matches.find((m) => m.code === "bribery_attempt") !== undefined, true);
  assertEquals(r.observability.bribery_currency_co_occurrence, false);
});

Deno.test("collectMatches: currency without bribery → co_occurrence=false (bribery is the anchor)", () => {
  const r = collectMatches("we paid $5,000 to the vendor — nothing illegal", SYNTH);
  assertEquals(r.matches.find((m) => m.code === "bribery_attempt"), undefined);
  assertEquals(r.observability.bribery_currency_co_occurrence, false);
});

Deno.test("collectMatches: currency-word form (e.g., '5000 USD') triggers co_occurrence", () => {
  const r = collectMatches(
    "BRIBE_PAYWORD and 5,000 USD as the price",
    SYNTH,
  );
  assertEquals(r.observability.bribery_currency_co_occurrence, true);
});

Deno.test("collectMatches: currency >50 chars from bribery → co_occurrence=false (window discipline)", () => {
  const padding = " padding ".repeat(8); // ~72 chars, exceeds 50-char window
  const r = collectMatches(`BRIBE_PAYWORD${padding}$5,000`, SYNTH);
  assertEquals(r.observability.bribery_currency_co_occurrence, false);
});

// ─────────────────────────── composeFlagReason ───────────────────────────

Deno.test("composeFlagReason: empty matches → null flag_reason", () => {
  const r = composeFlagReason([]);
  assertEquals(r.flag_reason, null);
  assertEquals(r.dropped_codes.length, 0);
});

Deno.test("composeFlagReason: single match → single auto:<code> entry", () => {
  const r = composeFlagReason([SYNTH.codes[0]]); // synth_a_t1_alpha
  assertEquals(r.flag_reason, "auto:synth_a_t1_alpha");
  assertEquals(r.dropped_codes.length, 0);
});

Deno.test("composeFlagReason: multi-code → comma-joined; sorted by tier ASC (T1 first)", () => {
  // Out-of-order input (T3 first, then T1, then T2) — output sorted by tier.
  const r = composeFlagReason([
    SYNTH.codes[3], // synth_a_t3 (tier 3)
    SYNTH.codes[0], // synth_a_t1_alpha (tier 1)
    SYNTH.codes[2], // synth_a_t2 (tier 2)
  ]);
  assertEquals(
    r.flag_reason,
    "auto:synth_a_t1_alpha,auto:synth_a_t2,auto:synth_a_t3",
  );
  assertEquals(r.dropped_codes.length, 0);
});

Deno.test("composeFlagReason: overflow drops lowest-tier (T3) first, preserves T1", () => {
  // Synthesize many T2 + T3 entries to force overflow, mixed with T1.
  // Build a list whose joined length exceeds 500 chars.
  const longCodeName = "x".repeat(80); // 80 chars per code name → ~85 per entry with `auto:`
  const oversize = [
    { code: "real_t1", source_prefix: "auto", tier: 1, routing: "admin", patterns: [] },
    ...Array.from({ length: 8 }, (_, i) => ({
      code: `${longCodeName}_t3_${i}`,
      source_prefix: "auto" as const,
      tier: 3 as const,
      routing: "admin" as const,
      patterns: [],
    })),
  ];
  // @ts-ignore — test fixture; widens to TaxonomyCode shape
  const r = composeFlagReason(oversize);
  assertEquals(r.flag_reason!.length <= FLAG_REASON_MAX_LEN, true);
  // T1 entry MUST survive
  assertEquals(r.flag_reason!.includes("auto:real_t1"), true);
  // Some T3 entries MUST have been dropped
  assertEquals(r.dropped_codes.length > 0, true);
  // Every dropped code is a T3 entry (none of the dropped should be the T1)
  assertEquals(r.dropped_codes.every((d) => d.includes("_t3_")), true);
});

Deno.test("composeFlagReason: at-or-under cap → zero drops", () => {
  // Two ~80-char entries + 1 comma = ~161 chars total; well under 500.
  // Deterministic check: nothing dropped, all entries serialized.
  const codes = [0, 1].map((i) => ({
    code: "p".repeat(80) + i,
    source_prefix: "auto" as const,
    tier: 2 as const,
    routing: "admin" as const,
    patterns: [],
  }));
  // @ts-ignore — synthetic widening to TaxonomyCode
  const r = composeFlagReason(codes);
  assertEquals(r.dropped_codes.length, 0);
  assertEquals(r.flag_reason!.length <= FLAG_REASON_MAX_LEN, true);
  assertEquals(r.flag_reason!.split(",").length, 2);
});

Deno.test("composeFlagReason: over cap → exact-drop count matches the overflow", () => {
  // 6 entries of ~120 chars each = ~720 chars before commas + 5 commas
  // = ~725 chars. After dropping 2 entries (240 chars + 2 commas worth):
  // ~485 chars remaining (just under 500). Assert dropped_codes.length == 2.
  const codes = [0, 1, 2, 3, 4, 5].map((i) => ({
    code: "z".repeat(115) + i,
    source_prefix: "auto" as const,
    tier: 3 as const, // all T3 so drops happen from the tail in input order
    routing: "admin" as const,
    patterns: [],
  }));
  // @ts-ignore — synthetic widening
  const r = composeFlagReason(codes);
  assertEquals(r.flag_reason!.length <= FLAG_REASON_MAX_LEN, true);
  // 6 originals - 4 kept = 2 dropped (the last two, since all share tier 3)
  assertEquals(r.dropped_codes.length, 2);
});

// ─────────────────────────── DELIVER-ALWAYS contract ───────────────────────────

Deno.test("DELIVER-ALWAYS — collectMatches never throws on adversarial input", () => {
  // Long content, lots of regex metacharacters, mixed scripts. The matcher
  // must complete without throwing. Delivery cannot fail because the
  // matcher exploded.
  const adversarial =
    "*.[]{}()|^$\\?+\\ " + "a".repeat(5000) + " \\\\ )( ][ }{ ALPHA1A";
  const r = collectMatches(adversarial, SYNTH);
  // Should still find ALPHA1A despite the noise
  assertEquals(r.matches.find((m) => m.code === "synth_a_t1_alpha") !== undefined, true);
});

Deno.test("DELIVER-ALWAYS — collectMatches returns no delivery decision (only matches/priority/observability)", () => {
  // Structural assertion: the return shape is { matches, priority,
  // observability }. There is no `block` / `hold` / `reject` field. The
  // caller cannot read a delivery decision from this output even if it
  // wanted to.
  const r = collectMatches("ALPHA1A", SYNTH);
  const keys = Object.keys(r).sort();
  assertEquals(keys, ["matches", "observability", "priority"]);
});
