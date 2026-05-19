// KAN-11 check-email-available — logic tests. Pure validator coverage.
//
// Pins the dispatch contract:
//   - email required, non-empty, ≤320 chars, matches basic regex
//   - email is canonicalised (trim + lowercase) for downstream compare
//   - non-object / non-string / empty / oversize bodies rejected
//   - rateLimitKey is deterministic + namespaced

import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MAX_EMAIL, parsePayload, rateLimitKey } from "./logic.ts";

// ── Happy path ────────────────────────────────────────────────────────

Deno.test("parsePayload — valid email returns lowercased + trimmed", () => {
  const r = parsePayload({ email: "  Office@Maranatha.Test  " });
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.email, "office@maranatha.test");
});

Deno.test("parsePayload — internationalised email accepted (basic regex permits)", () => {
  for (const good of ["a@b.co", "user.name+tag@example.org", "ç@é.test"]) {
    const r = parsePayload({ email: good });
    assertEquals(r.ok, true, `expected accept for email=${good}`);
  }
});

// ── Rejection paths ───────────────────────────────────────────────────

Deno.test("parsePayload — null / non-object body rejected", () => {
  assertEquals(parsePayload(null).ok, false);
  assertEquals(parsePayload(undefined).ok, false);
  assertEquals(parsePayload("string body").ok, false);
  assertEquals(parsePayload(42).ok, false);
});

Deno.test("parsePayload — missing email rejected", () => {
  const r = parsePayload({});
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "email is required");
});

Deno.test("parsePayload — non-string email rejected", () => {
  for (const bad of [null, 42, true, [], {}]) {
    const r = parsePayload({ email: bad });
    assertEquals(r.ok, false, `expected reject for email=${String(bad)}`);
  }
});

Deno.test("parsePayload — empty / whitespace-only email rejected", () => {
  assertEquals(parsePayload({ email: "" }).ok, false);
  assertEquals(parsePayload({ email: "   " }).ok, false);
});

Deno.test("parsePayload — email over 320 chars rejected", () => {
  const tooLong = "a".repeat(310) + "@example.test"; // 310 + 13 = 323
  const r = parsePayload({ email: tooLong });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "email is too long");
  assertStrictEquals(MAX_EMAIL, 320);
});

Deno.test("parsePayload — malformed email rejected", () => {
  for (const bad of [
    "no-at-sign",
    "missing@tld",
    "@nolocal.test",
    "two@@signs.test",
    "spaces in@email.test",
  ]) {
    const r = parsePayload({ email: bad });
    assertEquals(r.ok, false, `expected reject for email=${bad}`);
    if (!r.ok) {
      assertEquals(
        r.error,
        "email is not a valid email address",
        `expected canonical error for ${bad}`,
      );
    }
  }
});

// ── Rate-limit key ────────────────────────────────────────────────────

Deno.test("rateLimitKey — deterministic + namespaced", () => {
  assertEquals(rateLimitKey("1.2.3.4"), "check-email-available:ratelimit:1.2.3.4");
  assertEquals(
    rateLimitKey("2001:db8::1"),
    "check-email-available:ratelimit:2001:db8::1",
  );
  // Same IP, same key — guarantees a single bucket per IP across requests.
  assertEquals(rateLimitKey("9.9.9.9"), rateLimitKey("9.9.9.9"));
});
