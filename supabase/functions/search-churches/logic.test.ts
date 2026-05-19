// KAN-12 search-churches — logic tests. Pure validator + capacity helpers.
//
// Per dispatch minimums:
//   - query-too-short rejected (here: parsePayload 400 case)
//   - capacity threshold: at_capacity true when count ≥ 2, false when < 2
//   - parsePayload coverage: missing / non-string / oversize / valid
//   - rateLimitKey: deterministic + namespaced

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CHURCH_LEADER_CAP,
  isAtCapacity,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  parsePayload,
  rateLimitKey,
  SEARCH_RESULT_LIMIT,
} from "./logic.ts";

// ── Constants pinned ──────────────────────────────────────────────────

Deno.test("constants — values pinned to KAN-12 dispatch", () => {
  assertEquals(MIN_QUERY_LENGTH, 3);
  assertEquals(MAX_QUERY_LENGTH, 200);
  assertEquals(SEARCH_RESULT_LIMIT, 20);
  assertEquals(CHURCH_LEADER_CAP, 2);
});

// ── parsePayload happy path ──────────────────────────────────────────

Deno.test("parsePayload — valid 3-char query accepted", () => {
  const r = parsePayload({ query: "Mar" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.query, "Mar");
});

Deno.test("parsePayload — trims whitespace then validates length", () => {
  const r = parsePayload({ query: "   Maranatha   " });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.query, "Maranatha");
});

// ── parsePayload rejection paths ──────────────────────────────────────

Deno.test("parsePayload — null / non-object body rejected (400 surface)", () => {
  assertEquals(parsePayload(null).ok, false);
  assertEquals(parsePayload(undefined).ok, false);
  assertEquals(parsePayload("string body").ok, false);
  assertEquals(parsePayload(42).ok, false);
  assertEquals(parsePayload(true).ok, false);
});

Deno.test("parsePayload — missing / non-string query rejected", () => {
  assertEquals(parsePayload({}).ok, false);
  assertEquals(parsePayload({ query: 42 }).ok, false);
  assertEquals(parsePayload({ query: null }).ok, false);
  const r = parsePayload({});
  if (!r.ok) assertEquals(r.error, "query is required");
});

Deno.test("parsePayload — query shorter than MIN_QUERY_LENGTH rejected (400)", () => {
  for (const tooShort of ["", "a", "ab", "  ", "a "]) {
    const r = parsePayload({ query: tooShort });
    assertEquals(r.ok, false, `expected reject for query=${JSON.stringify(tooShort)}`);
    if (!r.ok) {
      // Accept either "query is required" (whitespace-only post-trim → empty)
      // OR the length-bound message. Both are correct 400 responses.
      assertEquals(
        r.error === "query is required" ||
          r.error === `query must be at least ${MIN_QUERY_LENGTH} characters`,
        true,
        `unexpected error: ${r.error}`,
      );
    }
  }
});

Deno.test("parsePayload — query longer than MAX_QUERY_LENGTH rejected", () => {
  const r = parsePayload({ query: "a".repeat(MAX_QUERY_LENGTH + 1) });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, `query must be at most ${MAX_QUERY_LENGTH} characters`);
});

// ── isAtCapacity ──────────────────────────────────────────────────────

Deno.test("isAtCapacity — true when count ≥ 2 (dispatch threshold)", () => {
  assertEquals(isAtCapacity(2), true);
  assertEquals(isAtCapacity(3), true);
  assertEquals(isAtCapacity(100), true);
});

Deno.test("isAtCapacity — false when count < 2", () => {
  assertEquals(isAtCapacity(0), false);
  assertEquals(isAtCapacity(1), false);
});

// ── Rate-limit key ────────────────────────────────────────────────────

Deno.test("rateLimitKey — deterministic + namespaced (search-churches scope)", () => {
  assertEquals(rateLimitKey("1.2.3.4"), "search-churches:ratelimit:1.2.3.4");
  assertEquals(
    rateLimitKey("2001:db8::1"),
    "search-churches:ratelimit:2001:db8::1",
  );
  // Same input → same key (single bucket per IP across requests).
  assertEquals(rateLimitKey("9.9.9.9"), rateLimitKey("9.9.9.9"));
  // Distinct namespace from check-email-available / create-account.
  assertEquals(
    rateLimitKey("1.2.3.4").startsWith("search-churches:"),
    true,
  );
});
