// Pure-logic unit tests for send-message body validation + participant
// sort + UUID shape check. KAN-124 moved the matcher tests to
// matcher.test.ts (synthetic taxonomy fixtures only — patterns never
// inlined here per AC-12). Mirrors submit-heartcry/logic.test.ts.

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isUuid,
  MAX_CONTENT_LENGTH,
  resolveInternalReceiverId,
  sortParticipants,
  validateBody,
  validateInternalBody,
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

// ───────────────────── validateInternalBody (KAN-217) ─────────────────────

const SYSTEM_UUID = "028be745-8014-4314-a7cf-36b0a4d52b46";
const LEADER_UUID = "33333333-3333-4333-8333-333333333333";

Deno.test("validateInternalBody: rejects null", () => {
  const r = validateInternalBody(null);
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects array", () => {
  const r = validateInternalBody([]);
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects body containing sender_id (impersonation guard)", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "hi",
    sender_id: LEADER_UUID,
  });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.detail.includes("sender_id"), true);
});

Deno.test("validateInternalBody: rejects body containing sender_id even when null", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "hi",
    sender_id: null,
  });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects body containing recipient_user_id", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "hi",
    recipient_user_id: LEADER_UUID,
  });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects missing conversation_id", () => {
  const r = validateInternalBody({ content: "hi" });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects non-UUID conversation_id", () => {
  const r = validateInternalBody({
    conversation_id: "not-a-uuid",
    content: "hi",
  });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects missing content", () => {
  const r = validateInternalBody({ conversation_id: VALID_UUID_A });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: rejects empty content after trim", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "   ",
  });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: trims content", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "  hi  ",
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.content, "hi");
});

Deno.test("validateInternalBody: rejects content over MAX_CONTENT_LENGTH", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "x".repeat(MAX_CONTENT_LENGTH + 1),
  });
  assertEquals(r.ok, false);
});

Deno.test("validateInternalBody: accepts well-formed body", () => {
  const r = validateInternalBody({
    conversation_id: VALID_UUID_A,
    content: "Welcome to the network.",
  });
  if (!r.ok) throw new Error(r.detail);
  assertEquals(r.body.conversation_id, VALID_UUID_A);
  assertEquals(r.body.content, "Welcome to the network.");
});

// ─────────────────── resolveInternalReceiverId (KAN-217) ───────────────────

Deno.test("resolveInternalReceiverId: returns B when system is A", () => {
  const id = resolveInternalReceiverId(
    { participant_a: SYSTEM_UUID, participant_b: LEADER_UUID },
    SYSTEM_UUID,
  );
  assertEquals(id, LEADER_UUID);
});

Deno.test("resolveInternalReceiverId: returns A when system is B", () => {
  const id = resolveInternalReceiverId(
    { participant_a: LEADER_UUID, participant_b: SYSTEM_UUID },
    SYSTEM_UUID,
  );
  assertEquals(id, LEADER_UUID);
});

Deno.test("resolveInternalReceiverId: returns null when system is not a participant", () => {
  const id = resolveInternalReceiverId(
    { participant_a: LEADER_UUID, participant_b: VALID_UUID_A },
    SYSTEM_UUID,
  );
  assertEquals(id, null);
});
