// KAN-192 register-church-delete — logic tests. Pure validator +
// classifier coverage. Pins the c.15743 contract:
//   - churchId required + valid UUID
//   - contactEmail required + valid email + normalised lowercase + trimmed
//   - Session window = 3600s
//   - classifyDeleteFailure dispatches on (row presence, email match,
//     age, linked-users) → discriminated DeleteOutcome union

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyDeleteFailure,
  normaliseEmail,
  parsePayload,
  rateLimitKey,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  SESSION_WINDOW_SECONDS,
} from "./logic.ts";

// ── Constants ─────────────────────────────────────────────────────────

Deno.test("SESSION_WINDOW_SECONDS is 1 hour", () => {
  assertEquals(SESSION_WINDOW_SECONDS, 3600);
});

Deno.test("rate-limit is tighter than search-churches (5/hr vs 10/hr)", () => {
  assertEquals(RATE_LIMIT_MAX_REQUESTS, 5);
  assertEquals(RATE_LIMIT_WINDOW_SECONDS, 3600);
});

Deno.test("rateLimitKey namespaces by function id + IP", () => {
  assertEquals(
    rateLimitKey("203.0.113.7"),
    "register-church-delete:ratelimit:203.0.113.7",
  );
});

// ── normaliseEmail ─────────────────────────────────────────────────────

Deno.test("normaliseEmail downcases and trims", () => {
  assertEquals(normaliseEmail("  Office@Maranatha.Test  "), "office@maranatha.test");
});

// ── parsePayload — happy path ──────────────────────────────────────────

const VALID_UUID = "ded45949-438e-422e-9dbf-9dadb2ee4f84";

Deno.test("parsePayload — happy path", () => {
  const r = parsePayload({ churchId: VALID_UUID, contactEmail: "Office@maranatha.test" });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.payload.churchId, VALID_UUID);
    // contactEmail downcased in normalisation
    assertEquals(r.payload.contactEmail, "office@maranatha.test");
  }
});

// ── parsePayload — rejection cases ─────────────────────────────────────

Deno.test("parsePayload rejects non-object body", () => {
  assertEquals(parsePayload(null).ok, false);
  assertEquals(parsePayload("string").ok, false);
  assertEquals(parsePayload(42).ok, false);
});

Deno.test("parsePayload rejects missing churchId", () => {
  const r = parsePayload({ contactEmail: "x@y.z" });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "churchId is required");
});

Deno.test("parsePayload rejects non-UUID churchId", () => {
  const r = parsePayload({ churchId: "not-a-uuid", contactEmail: "x@y.z" });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "churchId must be a UUID");
});

Deno.test("parsePayload rejects missing contactEmail", () => {
  const r = parsePayload({ churchId: VALID_UUID });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "contactEmail is required");
});

Deno.test("parsePayload rejects malformed contactEmail", () => {
  const r = parsePayload({ churchId: VALID_UUID, contactEmail: "not-an-email" });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "contactEmail is not a valid email address");
});

Deno.test("parsePayload rejects empty contactEmail after trim", () => {
  const r = parsePayload({ churchId: VALID_UUID, contactEmail: "   " });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "contactEmail length is invalid");
});

// ── classifyDeleteFailure ──────────────────────────────────────────────

const PAYLOAD = { churchId: VALID_UUID, contactEmail: "office@maranatha.test" };
const NOW = new Date("2026-06-12T12:00:00Z");
const FRESH_ROW_AT = new Date("2026-06-12T11:30:00Z").toISOString(); // 30 min ago
const STALE_ROW_AT = new Date("2026-06-12T10:00:00Z").toISOString(); // 2 hr ago

Deno.test("classify — row missing → not_found", () => {
  const r = classifyDeleteFailure(PAYLOAD, null, false, NOW);
  assertEquals(r.kind, "not_found");
});

Deno.test("classify — email mismatch → ownership_mismatch", () => {
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: "different@church.org", created_at: FRESH_ROW_AT },
    false,
    NOW,
  );
  assertEquals(r.kind, "ownership_mismatch");
});

Deno.test("classify — email comparison normalises case", () => {
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: "Office@Maranatha.Test", created_at: FRESH_ROW_AT },
    false,
    NOW,
  );
  // Both sides normalise to lowercase → match → continue checking other guards
  // No linked users + fresh → unknown_failure (means the DELETE should have
  // succeeded but didn't — defensive 500 path).
  assertEquals(r.kind, "unknown_failure");
});

Deno.test("classify — null contact_email → ownership_mismatch", () => {
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: null, created_at: FRESH_ROW_AT },
    false,
    NOW,
  );
  assertEquals(r.kind, "ownership_mismatch");
});

Deno.test("classify — row older than session window → session_expired", () => {
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: PAYLOAD.contactEmail, created_at: STALE_ROW_AT },
    false,
    NOW,
  );
  assertEquals(r.kind, "session_expired");
});

Deno.test("classify — fresh row + linked users → leader_linked", () => {
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: PAYLOAD.contactEmail, created_at: FRESH_ROW_AT },
    true,
    NOW,
  );
  assertEquals(r.kind, "leader_linked");
});

Deno.test("classify — fresh row + email match + no users → unknown_failure", () => {
  // This branch should not normally execute in production — if the DB
  // says all three guards pass and there are no linked users, the DELETE
  // would have succeeded. The unknown_failure outcome exists as a
  // defensive 500 in case the diagnostic round disagrees with the DELETE.
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: PAYLOAD.contactEmail, created_at: FRESH_ROW_AT },
    false,
    NOW,
  );
  assertEquals(r.kind, "unknown_failure");
});

Deno.test("classify — session boundary is inclusive at exact window edge", () => {
  // A row created EXACTLY SESSION_WINDOW_SECONDS ago should still pass
  // (now - created == window → not yet expired). Anything strictly
  // older expires.
  const edgeAt = new Date(NOW.getTime() - SESSION_WINDOW_SECONDS * 1000)
    .toISOString();
  const r = classifyDeleteFailure(
    PAYLOAD,
    { contact_email: PAYLOAD.contactEmail, created_at: edgeAt },
    false,
    NOW,
  );
  // Edge case lands on unknown_failure (all guards pass) — confirms
  // session window did not trigger.
  assertEquals(r.kind, "unknown_failure");
});
