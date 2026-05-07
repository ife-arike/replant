import { assertEquals, assertThrows, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AuthStatusResponse,
  type AuditLogRow,
  buildAuditRow,
  buildResponse,
  daysRemaining,
  decodeJwtPayload,
  isSuperAdmin,
  resolveStatus,
  type ResolvedStatus,
  type UserStatusRow,
} from "./logic.ts";

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = enc({ alg: "HS256", typ: "JWT" });
  const body = enc(payload);
  const signature = "x".repeat(43);
  return `${header}.${body}.${signature}`;
}

Deno.test("decodeJwtPayload — extracts claims from a well-formed token", () => {
  const token = makeJwt({ sub: "user-123", role: "authenticated", super_admin: false });
  const claims = decodeJwtPayload(token);
  assertEquals(claims.sub, "user-123");
  assertEquals(claims.role, "authenticated");
  assertEquals(claims.super_admin, false);
});

Deno.test("decodeJwtPayload — handles base64url padding", () => {
  const token = makeJwt({ a: 1 });
  const claims = decodeJwtPayload(token);
  assertEquals(claims.a, 1);
});

Deno.test("decodeJwtPayload — throws on malformed token (wrong segment count)", () => {
  assertThrows(() => decodeJwtPayload("only.two"), Error, "Malformed JWT");
  assertThrows(() => decodeJwtPayload("a.b.c.d"), Error, "Malformed JWT");
  assertThrows(() => decodeJwtPayload(""), Error, "Malformed JWT");
});

Deno.test("decodeJwtPayload — throws on non-JSON payload", () => {
  const bad = `${btoa("hdr")}.${btoa("not-json{{")}.sig`;
  assertThrows(() => decodeJwtPayload(bad));
});

Deno.test("isSuperAdmin — true only for boolean true", () => {
  assertEquals(isSuperAdmin({ super_admin: true }), true);
  assertEquals(isSuperAdmin({ super_admin: false }), false);
  assertEquals(isSuperAdmin({}), false);
  assertEquals(isSuperAdmin({ super_admin: "true" }), false);
  assertEquals(isSuperAdmin({ super_admin: 1 }), false);
  assertEquals(isSuperAdmin({ super_admin: null }), false);
});

Deno.test("daysRemaining — exact 14-day window returns 14", () => {
  const now = "2026-05-05T12:00:00.000Z";
  const deadline = "2026-05-19T12:00:00.000Z";
  assertEquals(daysRemaining(deadline, now), 14);
});

Deno.test("daysRemaining — 23h59m remaining returns 0", () => {
  const now = "2026-05-05T12:00:00.000Z";
  const deadline = "2026-05-06T11:59:00.000Z";
  assertEquals(daysRemaining(deadline, now), 0);
});

Deno.test("daysRemaining — exact 24h remaining returns 1", () => {
  const now = "2026-05-05T12:00:00.000Z";
  const deadline = "2026-05-06T12:00:00.000Z";
  assertEquals(daysRemaining(deadline, now), 1);
});

Deno.test("daysRemaining — deadline equal to now returns 0", () => {
  const t = "2026-05-05T12:00:00.000Z";
  assertEquals(daysRemaining(t, t), 0);
});

Deno.test("daysRemaining — deadline in past returns 0 (no negatives)", () => {
  const now = "2026-05-05T12:00:00.000Z";
  const deadline = "2026-05-04T12:00:00.000Z";
  assertEquals(daysRemaining(deadline, now), 0);
});

Deno.test("daysRemaining — TZ-equivalent timestamps are equal", () => {
  // Same instant expressed two ways: UTC vs +05:30 offset.
  const nowUtc = "2026-05-05T12:00:00.000Z";
  const deadlineUtc = "2026-05-19T12:00:00.000Z";
  const deadlineIst = "2026-05-19T17:30:00.000+05:30";
  assertEquals(daysRemaining(deadlineUtc, nowUtc), daysRemaining(deadlineIst, nowUtc));
  assertEquals(daysRemaining(deadlineIst, nowUtc), 14);
});

Deno.test("daysRemaining — clock skew of seconds rounds via floor", () => {
  const now = "2026-05-05T12:00:00.500Z";
  const deadline = "2026-05-06T12:00:00.000Z"; // 23h 59m 59.5s
  assertEquals(daysRemaining(deadline, now), 0);
});

Deno.test("daysRemaining — throws on invalid timestamp", () => {
  assertThrows(() => daysRemaining("not-a-date", "2026-05-05T12:00:00Z"));
  assertThrows(() => daysRemaining("2026-05-05T12:00:00Z", "garbage"));
});

const baseRow = (overrides: Partial<UserStatusRow> = {}): UserStatusRow => ({
  id: "11111111-1111-1111-1111-111111111111",
  verification_status: "verified",
  deactivated_at: null,
  is_active: true,
  church_id: "22222222-2222-2222-2222-222222222222",
  church: { verification_deadline: null },
  ...overrides,
});

Deno.test("resolveStatus — DB 'verified' maps to active", () => {
  const row = baseRow({ verification_status: "verified" });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), { kind: "active" });
});

Deno.test("resolveStatus — DB 'deactivated' maps to deactivated", () => {
  const row = baseRow({ verification_status: "deactivated", deactivated_at: "2026-04-01T00:00:00.000Z" });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), { kind: "deactivated" });
});

Deno.test("resolveStatus — pending + future deadline returns pending with computed days", () => {
  const row = baseRow({
    verification_status: "pending",
    church: { verification_deadline: "2026-05-19T12:00:00.000Z" },
  });
  const r = resolveStatus(row, "2026-05-05T12:00:00.000Z");
  assertEquals(r.kind, "pending");
  if (r.kind === "pending") {
    assertEquals(r.verification_deadline, "2026-05-19T12:00:00.000Z");
    assertEquals(r.days_remaining, 14);
  }
});

Deno.test("resolveStatus — pending + deadline exactly now returns past-deadline write", () => {
  const t = "2026-05-05T12:00:00.000Z";
  const row = baseRow({
    verification_status: "pending",
    church: { verification_deadline: t },
  });
  const r = resolveStatus(row, t);
  assertEquals(r.kind, "pending_past_deadline_needs_write");
});

Deno.test("resolveStatus — pending + past deadline returns pending_past_deadline_needs_write", () => {
  const row = baseRow({
    verification_status: "pending",
    church: { verification_deadline: "2026-04-01T00:00:00.000Z" },
  });
  const r = resolveStatus(row, "2026-05-05T12:00:00.000Z");
  assertEquals(r.kind, "pending_past_deadline_needs_write");
  if (r.kind === "pending_past_deadline_needs_write") {
    assertEquals(r.verification_deadline, "2026-04-01T00:00:00.000Z");
  }
});

Deno.test("resolveStatus — pending + no church throws (data anomaly)", () => {
  const row = baseRow({ verification_status: "pending", church: null });
  assertThrows(
    () => resolveStatus(row, "2026-05-05T12:00:00.000Z"),
    Error,
    "Pending user has no church verification_deadline",
  );
});

Deno.test("resolveStatus — pending + church row with null deadline throws", () => {
  const row = baseRow({
    verification_status: "pending",
    church: { verification_deadline: null },
  });
  assertThrows(() => resolveStatus(row, "2026-05-05T12:00:00.000Z"));
});

Deno.test("buildResponse — active shape has explicit nulls (not undefined)", () => {
  const body: AuthStatusResponse = buildResponse({ kind: "active" });
  assertEquals(body, {
    verification_status: "active",
    verification_deadline: null,
    days_remaining: null,
  });
  assertStrictEquals(body.verification_deadline, null);
  assertStrictEquals(body.days_remaining, null);
});

Deno.test("buildResponse — pending shape carries deadline + integer days", () => {
  const body = buildResponse({
    kind: "pending",
    verification_deadline: "2026-05-19T12:00:00.000Z",
    days_remaining: 14,
  });
  assertEquals(body, {
    verification_status: "pending",
    verification_deadline: "2026-05-19T12:00:00.000Z",
    days_remaining: 14,
  });
});

Deno.test("buildResponse — deactivated shape has explicit nulls", () => {
  const body = buildResponse({ kind: "deactivated" });
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
  });
});

Deno.test("buildResponse — pending_past_deadline_needs_write returns same shape as deactivated (TC-44.7 non-leak)", () => {
  // Critical SEC assertion: a user deactivated by login_check must be byte-identical
  // in response to a user already deactivated by cron. No distinguishing field.
  const optionBBody = buildResponse({
    kind: "pending_past_deadline_needs_write",
    verification_deadline: "2026-04-01T00:00:00.000Z",
  });
  const cronBody = buildResponse({ kind: "deactivated" });
  assertEquals(JSON.stringify(optionBBody), JSON.stringify(cronBody));
  assertEquals(optionBBody.verification_status, "deactivated");
  assertEquals(optionBBody.verification_deadline, null);
  assertEquals(optionBBody.days_remaining, null);
});

Deno.test("buildResponse — never includes deactivation_reason or triggered_by (SEC: no reason leak)", () => {
  const cases: ResolvedStatus[] = [
    { kind: "active" },
    { kind: "pending", verification_deadline: "2026-05-19T12:00:00.000Z", days_remaining: 14 },
    { kind: "deactivated" },
    { kind: "pending_past_deadline_needs_write", verification_deadline: "2026-04-01T00:00:00.000Z" },
  ];
  for (const c of cases) {
    const body = buildResponse(c);
    const keys = Object.keys(body).sort();
    assertEquals(keys, ["days_remaining", "verification_deadline", "verification_status"]);
  }
});

Deno.test("buildAuditRow — exact shape per SM 10854 ruling", () => {
  const row: AuditLogRow = buildAuditRow(
    "user-uuid-1",
    "church-uuid-1",
    "2026-05-05T12:00:00.000Z",
  );
  assertEquals(row, {
    accessed_by: null,
    triggered_by: "system",
    action: "deactivate_user",
    church_id: "church-uuid-1",
    accessed_at: "2026-05-05T12:00:00.000Z",
    meta: { trigger: "login_check", user_id: "user-uuid-1" },
  });
  assertStrictEquals(row.accessed_by, null);
});

Deno.test("buildAuditRow — accepts null church_id (user with no church affiliation)", () => {
  const row = buildAuditRow("user-uuid-1", null, "2026-05-05T12:00:00.000Z");
  assertStrictEquals(row.church_id, null);
});

Deno.test("buildAuditRow — keys are exactly the canonical 6 (no extra fields)", () => {
  const row = buildAuditRow("u", null, "2026-05-05T12:00:00.000Z");
  const keys = Object.keys(row).sort();
  assertEquals(keys, ["accessed_at", "accessed_by", "action", "church_id", "meta", "triggered_by"]);
  const metaKeys = Object.keys(row.meta).sort();
  assertEquals(metaKeys, ["trigger", "user_id"]);
});
