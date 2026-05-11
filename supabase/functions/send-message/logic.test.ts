// Pure-logic unit tests for send-message body validation + participant
// sort + UUID shape check. KAN-124 moved the matcher tests to
// matcher.test.ts (synthetic taxonomy fixtures only — patterns never
// inlined here per AC-12). Mirrors submit-heartcry/logic.test.ts.

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isUuid,
  MAX_CONTENT_LENGTH,
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

// escapeRegex tests moved with the function to matcher.ts /
// matcher.test.ts (KAN-124 reorg). scanKeywordBlocklist deleted —
// replaced by the full taxonomy matcher per the same ticket.

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

// scanKeywordBlocklist tests removed — function deleted in KAN-124.
// Full taxonomy matcher coverage lives at matcher.test.ts (synthetic
// fixtures; never inlines real patterns per AC-12).
