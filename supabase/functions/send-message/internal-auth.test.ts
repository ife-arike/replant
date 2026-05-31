// KAN-217 — unit tests for /internal auth helpers. Pure-logic only;
// no Request objects, no Deno.serve, no DB.
//
// device-pass-fixes-1 (2026-05-31): the token rides on the
// X-Internal-Token request header, not the Authorization Bearer.
// Tests pass the token value directly to requireInternalAuthHeaders
// (no Bearer-extraction step). extractBearerToken was deleted.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  requireInternalAuthHeaders,
  timingSafeEqualStrings,
} from "./internal-auth.ts";

// ──────────────────── timingSafeEqualStrings ────────────────────

Deno.test("timingSafeEqualStrings: equal strings return true", () => {
  assertEquals(timingSafeEqualStrings("abc", "abc"), true);
});

Deno.test("timingSafeEqualStrings: differing strings of same length return false", () => {
  assertEquals(timingSafeEqualStrings("abc", "abd"), false);
});

Deno.test("timingSafeEqualStrings: differing lengths return false", () => {
  assertEquals(timingSafeEqualStrings("abc", "abcd"), false);
  assertEquals(timingSafeEqualStrings("abcd", "abc"), false);
});

Deno.test("timingSafeEqualStrings: empty vs non-empty returns false", () => {
  assertEquals(timingSafeEqualStrings("", "x"), false);
  assertEquals(timingSafeEqualStrings("x", ""), false);
});

Deno.test("timingSafeEqualStrings: both empty returns true", () => {
  assertEquals(timingSafeEqualStrings("", ""), true);
});

Deno.test("timingSafeEqualStrings: handles 64-char hex Vault-token shape", () => {
  // Realistic shape: 64 hex chars (256 bits entropy).
  const a = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef00cafe11";
  const b = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef00cafe11";
  assertEquals(timingSafeEqualStrings(a, b), true);
  // One-char diff at the tail.
  const c = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef00cafe12";
  assertEquals(timingSafeEqualStrings(a, c), false);
  // One-char diff at the head.
  const d = "aeadbeef0123456789abcdef0123456789abcdef0123456789abcdef00cafe11";
  assertEquals(timingSafeEqualStrings(a, d), false);
});

Deno.test("timingSafeEqualStrings: unicode equality", () => {
  assertEquals(timingSafeEqualStrings("café", "café"), true);
  assertEquals(timingSafeEqualStrings("café", "cafe"), false);
});

// ──────────────────── requireInternalAuthHeaders ────────────────────

const TOKEN = "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef00cafe11";

Deno.test("requireInternalAuthHeaders: passes when token header + sentinel correct", () => {
  assertEquals(requireInternalAuthHeaders(TOKEN, "true", TOKEN), true);
});

Deno.test("requireInternalAuthHeaders: fails when sentinel missing", () => {
  assertEquals(requireInternalAuthHeaders(TOKEN, null, TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: fails when sentinel value is not 'true'", () => {
  assertEquals(requireInternalAuthHeaders(TOKEN, "yes", TOKEN), false);
  assertEquals(requireInternalAuthHeaders(TOKEN, "1", TOKEN), false);
  assertEquals(requireInternalAuthHeaders(TOKEN, "TRUE", TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: fails when token header value wrong", () => {
  assertEquals(requireInternalAuthHeaders("wrong-token", "true", TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: fails when token header absent", () => {
  assertEquals(requireInternalAuthHeaders(null, "true", TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: fails when token header empty string", () => {
  assertEquals(requireInternalAuthHeaders("", "true", TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: both wrong fails", () => {
  assertEquals(requireInternalAuthHeaders("wrong", "nope", TOKEN), false);
});

Deno.test("requireInternalAuthHeaders: does NOT accept a 'Bearer <token>'-wrapped value", () => {
  // Defense-in-depth: callers must send the bare token in X-Internal-Token,
  // not a Bearer-prefixed string. If a future caller drift sends
  // "Bearer <token>" in the custom header, the compare must fail.
  assertEquals(
    requireInternalAuthHeaders(`Bearer ${TOKEN}`, "true", TOKEN),
    false,
  );
});
