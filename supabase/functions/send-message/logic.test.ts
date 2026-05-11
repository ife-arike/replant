// Pure-logic unit tests for send-message validation + keyword scan.
// Runs as `deno test logic.test.ts`. No HTTP, no DB, no network.
// Mirrors submit-heartcry/logic.test.ts pattern.

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  escapeRegex,
  isUuid,
  KEYWORD_FLAG_REASON,
  MAX_CONTENT_LENGTH,
  scanKeywordBlocklist,
  sortParticipants,
  validateBody,
} from "./logic.ts";

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";

// ─────────────────────────── validateBody ───────────────────────────

Deno.test("validateBody: rejects null", () => {
  const r = validateBody(null);
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects array", () => {
  const r = validateBody([]);
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects non-string content", () => {
  const r = validateBody({ content: 123, recipient_user_id: VALID_UUID_A });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects empty content after trim", () => {
  const r = validateBody({
    content: "   \n\t  ",
    recipient_user_id: VALID_UUID_A,
  });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: trims content", () => {
  const r = validateBody({
    content: "  hello world  ",
    recipient_user_id: VALID_UUID_A,
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.content, "hello world");
});

Deno.test("validateBody: rejects content over MAX_CONTENT_LENGTH", () => {
  const r = validateBody({
    content: "x".repeat(MAX_CONTENT_LENGTH + 1),
    recipient_user_id: VALID_UUID_A,
  });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: accepts content at exactly MAX_CONTENT_LENGTH", () => {
  const r = validateBody({
    content: "x".repeat(MAX_CONTENT_LENGTH),
    recipient_user_id: VALID_UUID_A,
  });
  assertEquals(r.ok, true);
});

Deno.test("validateBody: rejects when BOTH conversation_id and recipient_user_id provided", () => {
  const r = validateBody({
    content: "hi",
    conversation_id: VALID_UUID_A,
    recipient_user_id: VALID_UUID_B,
  });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects when NEITHER conversation_id nor recipient_user_id provided", () => {
  const r = validateBody({ content: "hi" });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects non-UUID conversation_id", () => {
  const r = validateBody({ content: "hi", conversation_id: "not-a-uuid" });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: rejects non-UUID recipient_user_id", () => {
  const r = validateBody({ content: "hi", recipient_user_id: "not-a-uuid" });
  assertEquals(r.ok, false);
});

Deno.test("validateBody: accepts conversation_id-only path", () => {
  const r = validateBody({ content: "hi", conversation_id: VALID_UUID_A });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.conversation_id, VALID_UUID_A);
  assertEquals(r.body.recipient_user_id, null);
});

Deno.test("validateBody: accepts recipient_user_id-only path", () => {
  const r = validateBody({ content: "hi", recipient_user_id: VALID_UUID_B });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.recipient_user_id, VALID_UUID_B);
  assertEquals(r.body.conversation_id, null);
});

Deno.test("validateBody: null fields treated as absent (not both-provided)", () => {
  const r = validateBody({
    content: "hi",
    conversation_id: null,
    recipient_user_id: VALID_UUID_A,
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.recipient_user_id, VALID_UUID_A);
});

// ─────────────────────────── isUuid ───────────────────────────

Deno.test("isUuid: accepts valid v4 UUID", () => {
  assertEquals(isUuid(VALID_UUID_A), true);
});

Deno.test("isUuid: rejects non-string", () => {
  assertEquals(isUuid(123), false);
  assertEquals(isUuid(null), false);
  assertEquals(isUuid(undefined), false);
});

Deno.test("isUuid: rejects malformed shapes", () => {
  assertEquals(isUuid(""), false);
  assertEquals(isUuid("1234"), false);
  assertEquals(isUuid("11111111-1111-1111-1111-11111111111"), false); // short
});

// ─────────────────────────── escapeRegex ───────────────────────────

Deno.test("escapeRegex: escapes regex metacharacters", () => {
  assertEquals(escapeRegex("a.b*c+d?"), "a\\.b\\*c\\+d\\?");
});

Deno.test("escapeRegex: leaves plain alphanumerics alone", () => {
  assertEquals(escapeRegex("hello123"), "hello123");
});

Deno.test("escapeRegex: a metachar-bearing keyword 'pass.word' matches literally but not 'passXword'", () => {
  // Load-bearing property of escapeRegex: regex metacharacters become
  // literal. Without it, `pass.word` would compile as "pass" + any
  // char + "word" — matching "passXword" (false positive) or
  // "pass!word" (also false positive). With it, `.` becomes `\.` and
  // only the literal "pass.word" string matches.
  const escaped = escapeRegex("pass.word");
  const re = new RegExp("\\b" + escaped + "\\b", "i");
  assertEquals(re.test("my pass.word is hello"), true);
  assertEquals(re.test("my passXword is hello"), false);
});

Deno.test("escapeRegex: a malformed-leading keyword '(broken' compiles without throwing (load-bearing crash safety)", () => {
  // Without escapeRegex, `new RegExp("\\b(broken\\b", "i")` throws
  // SyntaxError on the unmatched group. With escapeRegex the pattern
  // compiles cleanly — it may or may not MATCH the input (the `\b`
  // before `\(` doesn't fire at a non-word char), but the scanner
  // does NOT crash. Crash safety is the load-bearing contract; match
  // semantics on non-word-leading keywords are a separate concern
  // KAN-124 addresses via the full taxonomy + phrase patterns.
  const escaped = escapeRegex("(broken");
  // Smoke that the pattern compiles (the constructor would throw if not):
  const re = new RegExp("\\b" + escaped + "\\b", "i");
  // And `re.test` returns a boolean — neither throw nor undefined.
  assertEquals(typeof re.test("anything"), "boolean");
});

// ─────────────────────────── sortParticipants ───────────────────────────

Deno.test("sortParticipants: lower UUID first", () => {
  const r = sortParticipants(VALID_UUID_B, VALID_UUID_A);
  assertEquals(r.participant_a, VALID_UUID_A);
  assertEquals(r.participant_b, VALID_UUID_B);
});

Deno.test("sortParticipants: order-independent (commutative)", () => {
  const r1 = sortParticipants(VALID_UUID_A, VALID_UUID_B);
  const r2 = sortParticipants(VALID_UUID_B, VALID_UUID_A);
  assertEquals(r1.participant_a, r2.participant_a);
  assertEquals(r1.participant_b, r2.participant_b);
});

Deno.test("sortParticipants: throws on self-pair (participant_a < participant_b CHECK protects DB)", () => {
  assertThrows(() => sortParticipants(VALID_UUID_A, VALID_UUID_A), Error, "self");
});

// ─────────────────────────── scanKeywordBlocklist ───────────────────────────

Deno.test("scanKeywordBlocklist: empty env → flagged=false", () => {
  assertEquals(
    scanKeywordBlocklist("any content", undefined),
    { flagged: false, flag_reason: null },
  );
  assertEquals(
    scanKeywordBlocklist("any content", ""),
    { flagged: false, flag_reason: null },
  );
});

Deno.test("scanKeywordBlocklist: whitespace-only / comma-only env → flagged=false (no spurious empty-keyword match)", () => {
  // Without the filter, "" would compile to /\b\b/ which matches every
  // string — guarding here is the load-bearing safety net.
  assertEquals(
    scanKeywordBlocklist("any content", ",,,"),
    { flagged: false, flag_reason: null },
  );
  assertEquals(
    scanKeywordBlocklist("any content", "   ,   ,  "),
    { flagged: false, flag_reason: null },
  );
});

Deno.test("scanKeywordBlocklist: matches whole-word keyword (word-boundary regex)", () => {
  const r = scanKeywordBlocklist(
    "please send the location now",
    "location,passport",
  );
  assertEquals(r.flagged, true);
  assertEquals(r.flag_reason, KEYWORD_FLAG_REASON);
});

Deno.test("scanKeywordBlocklist: case-insensitive", () => {
  const r = scanKeywordBlocklist("Send the LOCATION immediately", "location");
  assertEquals(r.flagged, true);
});

Deno.test("scanKeywordBlocklist: word-boundary respected — no substring match", () => {
  // "location" in "collocation" does NOT match — per SEC alert-fatigue
  // ruling that drove the word-boundary requirement.
  const r = scanKeywordBlocklist("we discussed collocation strategy", "location");
  assertEquals(r.flagged, false);
});

Deno.test("scanKeywordBlocklist: no match → flag_reason=null", () => {
  const r = scanKeywordBlocklist("a perfectly fine message", "passport,location");
  assertEquals(r.flagged, false);
  assertEquals(r.flag_reason, null);
});

Deno.test("scanKeywordBlocklist: any match short-circuits with the stub reason (KAN-124 will collect-all)", () => {
  const r = scanKeywordBlocklist(
    "send location and passport now",
    "passport,location",
  );
  assertEquals(r.flagged, true);
  assertEquals(r.flag_reason, KEYWORD_FLAG_REASON);
});

Deno.test("scanKeywordBlocklist: metachar keyword 'pa.ss' is literal — does NOT match 'paXss'", () => {
  // Load-bearing escapeRegex property: regex metacharacters do not
  // turn into wildcard matches. False-positive containment is the
  // SEC concern that drove this discipline.
  const r1 = scanKeywordBlocklist("we said paXss aloud", "pa.ss");
  assertEquals(r1.flagged, false);
  const r2 = scanKeywordBlocklist("we said pa.ss aloud", "pa.ss");
  assertEquals(r2.flagged, true);
});

Deno.test("scanKeywordBlocklist: regex-meta keyword '(' does not crash the scanner (escapeRegex crash safety)", () => {
  // Without escapeRegex, `new RegExp("\\b(\\b", "i")` would throw
  // SyntaxError and the scanner would crash on the first message
  // that hit it. With escapeRegex, the scan completes cleanly — the
  // match outcome is false (\b doesn't fire at non-word chars), but
  // crash safety is the load-bearing guarantee.
  const r = scanKeywordBlocklist("anything at all", "(");
  // Must not throw. We don't assert on flagged value — the contract
  // is "no crash"; \b semantics at non-word boundaries are a separate
  // concern KAN-124 takes up.
  assertEquals(typeof r.flagged, "boolean");
});

Deno.test("scanKeywordBlocklist: trims keyword whitespace ('  passport  ' → 'passport')", () => {
  const r = scanKeywordBlocklist("show me your passport", "  passport  ,  location  ");
  assertEquals(r.flagged, true);
});
