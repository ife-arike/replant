// KAN-12 create-account — logic tests. Pure validator coverage.
//
// Per dispatch minimums:
//   - `anonymous` defaults `false` when absent
//   - field validation rejects missing required fields
//   - full_name trim format (DBA c.13321 Q3 — single ASCII space)
//   - role enum values (12 canonical)

import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CHURCH_LEADER_CAP,
  computeVerificationDeadline,
  ERROR_CODES,
  exceedsCapacity,
  MAX_NAME_PART,
  MAX_PASSWORD,
  MIN_PASSWORD,
  parsePayload,
  rateLimitKey,
  ROLES,
  VERIFICATION_WINDOW_DAYS,
} from "./logic.ts";

function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Ife",
    lastName: "James",
    email: "office@maranatha.test",
    password: "Sup3rSecret",
    role: "pastor",
    anonymous: false,
    churchId: "11111111-2222-3333-4444-555555555555",
    isNewChurch: false,
    ...overrides,
  };
}

// ── Canonical enums + error codes ──────────────────────────────────────

Deno.test("ROLES — exactly 12 canonical user_role values in locked order", () => {
  assertEquals(ROLES, [
    "pastor",
    "apostle",
    "prophet",
    "evangelist",
    "teacher",
    "elder",
    "bishop",
    "reverend",
    "intercessor",
    "psalmist",
    "ministry_leader",
    "other",
  ]);
  assertEquals(ROLES.length, 12);
});

Deno.test("ERROR_CODES — stable string codes pinned for FE mapping", () => {
  assertEquals(ERROR_CODES.USER_ALREADY_EXISTS, "user_already_exists");
  assertEquals(ERROR_CODES.LEADER_CAP_EXCEEDED, "LEADER_CAP_EXCEEDED");
  assertEquals(ERROR_CODES.VALIDATION_ERROR, "validation_error");
  assertEquals(ERROR_CODES.INTERNAL_ERROR, "internal_error");
});

Deno.test("constants — capacity + window pinned to dispatch", () => {
  assertEquals(CHURCH_LEADER_CAP, 2);
  assertEquals(VERIFICATION_WINDOW_DAYS, 30);
  assertEquals(MIN_PASSWORD, 8);
  assertEquals(MAX_PASSWORD, 64);
  assertEquals(MAX_NAME_PART, 100);
});

// ── parsePayload happy path ────────────────────────────────────────────

Deno.test("parsePayload — valid payload returns normalised input", () => {
  const r = parsePayload(basePayload());
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.input.email, "office@maranatha.test");
  assertEquals(r.input.role, "pastor");
  assertEquals(r.input.anonymous, false);
  assertEquals(r.input.isNewChurch, false);
  assertEquals(r.input.firstName, "Ife");
  assertEquals(r.input.lastName, "James");
  assertEquals(r.input.churchId, "11111111-2222-3333-4444-555555555555");
});

Deno.test("parsePayload — full_name format: '${firstName.trim()} ${lastName.trim()}' (DBA c.13321 Q3)", () => {
  const r = parsePayload(basePayload({ firstName: "  Ife  ", lastName: "  James  " }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  // Per-part trim, single ASCII space (U+0020) join, no DB-side trim.
  assertEquals(r.input.fullName, "Ife James");
  // ASCII space — not non-breaking, not tab, not multi-space.
  assertStrictEquals(r.input.fullName.charCodeAt(3), 0x20);
});

Deno.test("parsePayload — email canonicalised to lowercase + trimmed for Layer 3 compare", () => {
  const r = parsePayload(basePayload({ email: "  Office@Maranatha.Test  " }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.input.email, "office@maranatha.test");
});

Deno.test("parsePayload — anonymous DEFAULTS to false when absent (DBA c.13321 forward-compat)", () => {
  const p = basePayload();
  delete p.anonymous;
  const r = parsePayload(p);
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.input.anonymous, false);
});

Deno.test("parsePayload — anonymous defaults to false when non-boolean (defense-in-depth)", () => {
  for (const bad of [null, undefined, "true", 1, 0, "", "yes"]) {
    const r = parsePayload(basePayload({ anonymous: bad }));
    assertEquals(r.ok, true, `expected accept for anonymous=${String(bad)}`);
    if (r.ok) assertEquals(r.input.anonymous, false);
  }
});

Deno.test("parsePayload — anonymous: true honored when boolean", () => {
  const r = parsePayload(basePayload({ anonymous: true }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.input.anonymous, true);
});

Deno.test("parsePayload — isNewChurch defaults to false when absent", () => {
  const p = basePayload();
  delete p.isNewChurch;
  const r = parsePayload(p);
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.input.isNewChurch, false);
});

Deno.test("parsePayload — accepts all 12 canonical roles", () => {
  for (const role of ROLES) {
    const r = parsePayload(basePayload({ role }));
    assertEquals(r.ok, true, `expected accept for role=${role}`);
    if (r.ok) assertEquals(r.input.role, role);
  }
});

// ── parsePayload rejection paths ───────────────────────────────────────

Deno.test("parsePayload — null / non-object body rejected", () => {
  assertEquals(parsePayload(null).ok, false);
  assertEquals(parsePayload(undefined).ok, false);
  assertEquals(parsePayload("string body").ok, false);
  assertEquals(parsePayload(42).ok, false);
});

Deno.test("parsePayload — missing required fields rejected", () => {
  for (const field of ["firstName", "lastName", "email", "password", "role", "churchId"]) {
    const p = basePayload();
    delete p[field];
    const r = parsePayload(p);
    assertEquals(r.ok, false, `expected reject when ${field} missing`);
  }
});

Deno.test("parsePayload — empty / whitespace-only firstName / lastName rejected", () => {
  for (const field of ["firstName", "lastName"]) {
    assertEquals(parsePayload(basePayload({ [field]: "" })).ok, false);
    assertEquals(parsePayload(basePayload({ [field]: "   " })).ok, false);
  }
});

Deno.test("parsePayload — malformed email rejected", () => {
  for (const bad of ["no-at", "missing@tld", "@nolocal.test", "two@@signs.test"]) {
    const r = parsePayload(basePayload({ email: bad }));
    assertEquals(r.ok, false, `expected reject for email=${bad}`);
  }
});

Deno.test("parsePayload — password length bounds enforced", () => {
  // Too short
  assertEquals(parsePayload(basePayload({ password: "Sh0rt" })).ok, false);
  assertEquals(parsePayload(basePayload({ password: "" })).ok, false);
  // Too long
  assertEquals(parsePayload(basePayload({ password: "A".repeat(65) })).ok, false);
  // Boundary: 8 OK, 64 OK
  assertEquals(parsePayload(basePayload({ password: "Aa1aaaaa" })).ok, true);
  assertEquals(parsePayload(basePayload({ password: "A".repeat(64) })).ok, true);
});

Deno.test("parsePayload — password NOT trimmed (trailing space is a valid char)", () => {
  const r = parsePayload(basePayload({ password: "S3cret  " }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  // Whitespace preserved end-to-end.
  assertEquals(r.input.password, "S3cret  ");
});

Deno.test("parsePayload — bad role rejected (must be in canonical set)", () => {
  for (const bad of ["", "Pastor", "PASTOR", "leader", "minister", "para_ministry"]) {
    const r = parsePayload(basePayload({ role: bad }));
    assertEquals(r.ok, false, `expected reject for role=${bad}`);
  }
});

Deno.test("parsePayload — non-UUID churchId rejected", () => {
  for (const bad of ["", "not-a-uuid", "11111111-2222-3333-4444", "Z1111111-2222-3333-4444-555555555555"]) {
    const r = parsePayload(basePayload({ churchId: bad }));
    assertEquals(r.ok, false, `expected reject for churchId=${bad}`);
  }
});

// ── exceedsCapacity ─────────────────────────────────────────────────────

Deno.test("exceedsCapacity — blocks at count >= 2", () => {
  assertEquals(exceedsCapacity(2), true);
  assertEquals(exceedsCapacity(3), true);
});

Deno.test("exceedsCapacity — allows count < 2", () => {
  assertEquals(exceedsCapacity(0), false);
  assertEquals(exceedsCapacity(1), false);
});

// ── computeVerificationDeadline ────────────────────────────────────────

Deno.test("computeVerificationDeadline — exactly 30 days from now in ISO", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");
  // 30 days after 2026-05-19 = 2026-06-18 (May has 31 days, so May 19 + 30 days = June 18)
  assertEquals(computeVerificationDeadline(now), "2026-06-18T12:00:00.000Z");
});

// ── Rate-limit key ─────────────────────────────────────────────────────

Deno.test("rateLimitKey — namespaced AND scoped by IP+email (write-surface bar)", () => {
  assertEquals(
    rateLimitKey("1.2.3.4", "leader@example.test"),
    "create-account:ratelimit:1.2.3.4:leader@example.test",
  );
  // Different IP, same email → different bucket
  assertEquals(
    rateLimitKey("1.2.3.4", "x@a.test") === rateLimitKey("9.9.9.9", "x@a.test"),
    false,
  );
  // Same IP, different email → different bucket
  assertEquals(
    rateLimitKey("1.2.3.4", "a@x.test") === rateLimitKey("1.2.3.4", "b@x.test"),
    false,
  );
});
