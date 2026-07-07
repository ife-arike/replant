import { assertEquals, assertThrows, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AuthStatusResponse,
  type AuditLogRow,
  buildAuditRow,
  buildResponse,
  daysRemaining,
  decodeJwtPayload,
  isSuperAdmin,
  resolveBranchSubstate,
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

// Full church-embed shape helper (2026-06-22 substate fields + KAN-205).
// Explicit nulls matter: the substate resolver's strict `!== null` checks
// treat `undefined` as "set".
const ch = (
  overrides: Partial<NonNullable<UserStatusRow["church"]>> = {},
): NonNullable<UserStatusRow["church"]> => ({
  verification_status: null,
  verification_deadline: null,
  soft_deleted_at: null,
  last_outcome_modal_kind: null,
  ...overrides,
});

const baseRow = (overrides: Partial<UserStatusRow> = {}): UserStatusRow => ({
  id: "11111111-1111-1111-1111-111111111111",
  verification_status: "verified",
  deactivated_at: null,
  is_active: true,
  church_id: "22222222-2222-2222-2222-222222222222",
  // KAN-205 — user-level soft-delete columns, null by default.
  soft_deleted_at: null,
  soft_delete_reason: null,
  hard_delete_scheduled_at: null,
  user_verification_deadline: null,
  church: ch(),
  ...overrides,
});

Deno.test("resolveStatus — DB 'verified' maps to active", () => {
  const row = baseRow({ verification_status: "verified" });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), { kind: "active" });
});

Deno.test("resolveStatus — DB 'deactivated' with NULL deadline (baseRow default) → support_contact", () => {
  // baseRow defaults church.verification_deadline to null. Per c.14235 #6,
  // NULL deadline on a deactivated row resolves to support_contact (no
  // verification_renewal can apply when the window itself never existed).
  const row = baseRow({ verification_status: "deactivated", deactivated_at: "2026-04-01T00:00:00.000Z" });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), {
    kind: "deactivated",
    recovery_path: "support_contact",
  });
});

Deno.test("resolveStatus — DB 'deactivated' with PAST deadline → verification_renewal (cron-flipped pattern)", () => {
  // c.14235 #2 — past, non-NULL deadline on a deactivated row is the
  // cron-flipped fingerprint (or a prior login-check write). Resolves
  // to verification_renewal.
  const row = baseRow({
    verification_status: "deactivated",
    deactivated_at: "2026-04-15T00:00:00.000Z",
    church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
  });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), {
    kind: "deactivated",
    recovery_path: "verification_renewal",
  });
});

Deno.test("resolveStatus — DB 'deactivated' with FUTURE deadline → support_contact (admin-flipped pattern)", () => {
  // Admin-manual deactivation of a user whose window had not yet closed.
  // No deadline-trigger signal in the row, so recovery_path = support_contact.
  const row = baseRow({
    verification_status: "deactivated",
    deactivated_at: "2026-05-04T00:00:00.000Z",
    church: ch({ verification_deadline: "2026-06-01T00:00:00.000Z" }),
  });
  assertEquals(resolveStatus(row, "2026-05-05T12:00:00.000Z"), {
    kind: "deactivated",
    recovery_path: "support_contact",
  });
});

Deno.test("resolveStatus — pending + future deadline returns pending with computed days", () => {
  const row = baseRow({
    verification_status: "pending",
    church: ch({ verification_deadline: "2026-05-19T12:00:00.000Z" }),
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
    church: ch({ verification_deadline: t }),
  });
  const r = resolveStatus(row, t);
  assertEquals(r.kind, "pending_past_deadline_needs_write");
});

Deno.test("resolveStatus — pending + past deadline returns pending_past_deadline_needs_write", () => {
  const row = baseRow({
    verification_status: "pending",
    church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
  });
  const r = resolveStatus(row, "2026-05-05T12:00:00.000Z");
  assertEquals(r.kind, "pending_past_deadline_needs_write");
  if (r.kind === "pending_past_deadline_needs_write") {
    assertEquals(r.verification_deadline, "2026-04-01T00:00:00.000Z");
  }
});

// KAN-36 (Founder Option Y, SEC c.14194, locked 2026-05-21) — NULL
// deadline = fail-closed. Both NULL-source variants (no church
// attached, or church attached with NULL deadline) must resolve to
// kind: "deactivated" WITHOUT the write path firing. The two tests
// below previously asserted a throw; they now lock the fail-closed
// behaviour and the no-write guarantee.

Deno.test("resolveStatus — pending + no church (skip-flow) resolves to deactivated/support_contact, no write", () => {
  // c.14235 #6 — NULL-deadline fail-closed MUST map to support_contact.
  const row = baseRow({ verification_status: "pending", church: null });
  const r = resolveStatus(row, "2026-05-05T12:00:00.000Z");
  assertEquals(r, { kind: "deactivated", recovery_path: "support_contact" });
  // Belt-and-suspenders: explicitly confirm we are NOT returning the
  // write-triggering variant.
  assertEquals(r.kind === "pending_past_deadline_needs_write", false);
});

Deno.test("resolveStatus — pending + church row with null deadline resolves to deactivated/support_contact, no write", () => {
  // c.14235 #6 — NULL-deadline fail-closed MUST map to support_contact.
  const row = baseRow({
    verification_status: "pending",
    church: ch(),
  });
  const r = resolveStatus(row, "2026-05-05T12:00:00.000Z");
  assertEquals(r, { kind: "deactivated", recovery_path: "support_contact" });
  assertEquals(r.kind === "pending_past_deadline_needs_write", false);
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

Deno.test("buildResponse — deactivated/support_contact shape has explicit nulls + recovery_path", () => {
  const body = buildResponse({ kind: "deactivated", recovery_path: "support_contact" });
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "support_contact",
  });
});

Deno.test("buildResponse — deactivated/verification_renewal shape has explicit nulls + recovery_path", () => {
  const body = buildResponse({ kind: "deactivated", recovery_path: "verification_renewal" });
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "verification_renewal",
  });
});

// ─── TC-44.7 v2 (c.14235 #7) ─────────────────────────────────────────────
// Original TC-44.7 asserted byte-identical regardless of cause. The
// amendment relaxes that to "byte-identical except for the single
// recovery_path binary lifecycle field." Inside the same recovery_path
// bucket the non-leak guarantee is preserved; across buckets the
// distinction is intentional.

Deno.test("TC-44.7 v2 (c.14235 #7) — login-check and cron both past-deadline → byte-identical", () => {
  // SEC drift guard preserved within the renewal bucket. The login-check
  // path that just flipped a pending user is indistinguishable from the
  // cron path that flipped the user earlier — same trigger (deadline),
  // same response bytes.
  const loginCheck = buildResponse({
    kind: "pending_past_deadline_needs_write",
    verification_deadline: "2026-04-01T00:00:00.000Z",
    isSkipFlow: false,
  });
  const cron = buildResponse({ kind: "deactivated", recovery_path: "verification_renewal" });
  assertEquals(JSON.stringify(loginCheck), JSON.stringify(cron));
});

Deno.test("TC-44.7 v2 (c.14235 #7c/e) — admin-deactivated and NULL-deadline → byte-identical (support bucket)", () => {
  // c.14235 #7(c) + #7(e) + #3 (uniform support bucket). All non-deadline
  // paths emit identical bytes — admin-manual, NULL-deadline fail-closed,
  // super_admin downgrade, future settings-initiated. The FE cannot tell
  // them apart, by design.
  const adminFlipped = buildResponse({ kind: "deactivated", recovery_path: "support_contact" });
  const nullDeadline = buildResponse({ kind: "deactivated", recovery_path: "support_contact" });
  assertEquals(JSON.stringify(adminFlipped), JSON.stringify(nullDeadline));
});

Deno.test("no-leak v2 (c.14235 #1/#7) — only recovery_path is added; no triggered_by, no deactivation_source, no other field", () => {
  // The relaxation is strictly bounded: exactly one new key, exactly two
  // values, only present on deactivated bodies. No other distinguishing
  // field may sneak through.
  const cases: { resolved: ResolvedStatus; expectedKeys: string[] }[] = [
    {
      resolved: { kind: "active" },
      expectedKeys: ["days_remaining", "verification_deadline", "verification_status"],
    },
    {
      resolved: { kind: "pending", verification_deadline: "2026-05-19T12:00:00.000Z", days_remaining: 14 },
      expectedKeys: ["days_remaining", "verification_deadline", "verification_status"],
    },
    {
      resolved: { kind: "deactivated", recovery_path: "verification_renewal" },
      expectedKeys: ["days_remaining", "recovery_path", "verification_deadline", "verification_status"],
    },
    {
      resolved: { kind: "deactivated", recovery_path: "support_contact" },
      expectedKeys: ["days_remaining", "recovery_path", "verification_deadline", "verification_status"],
    },
    {
      resolved: { kind: "pending_past_deadline_needs_write", verification_deadline: "2026-04-01T00:00:00.000Z", isSkipFlow: false },
      expectedKeys: ["days_remaining", "recovery_path", "verification_deadline", "verification_status"],
    },
  ];
  for (const c of cases) {
    const body = buildResponse(c.resolved);
    assertEquals(Object.keys(body).sort(), c.expectedKeys);
  }
});

// ─── c.14235 #7 — five new assertions (a-e) ──────────────────────────────

Deno.test("c.14235 #7(a) — cron-deactivated (past-deadline row) → verification_renewal", () => {
  // End-to-end through resolveStatus: row that looks like cron flipped it
  // (verification_status='deactivated' + past, non-NULL deadline) resolves
  // to verification_renewal.
  const row = baseRow({
    verification_status: "deactivated",
    deactivated_at: "2026-04-15T00:00:00.000Z",
    church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
  });
  const body = buildResponse(resolveStatus(row, "2026-05-05T12:00:00.000Z"));
  assertEquals(body.recovery_path, "verification_renewal");
  assertEquals(body.verification_status, "deactivated");
});

Deno.test("c.14235 #7(b) — login-check-deactivated (pending + past deadline) → verification_renewal", () => {
  // The Option-B write-on-login-check path. Resolves to
  // pending_past_deadline_needs_write, which buildResponse collapses
  // into the same renewal-bucket bytes as cron #7(a).
  const row = baseRow({
    verification_status: "pending",
    church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
  });
  const body = buildResponse(resolveStatus(row, "2026-05-05T12:00:00.000Z"));
  assertEquals(body.recovery_path, "verification_renewal");
  assertEquals(body.verification_status, "deactivated");
});

Deno.test("c.14235 #7(c) — admin-deactivated (no past-deadline signal) → support_contact", () => {
  // Admin manually flipped a user with a future or absent past-deadline
  // signal. Row carries no trigger fingerprint → support_contact.
  const row = baseRow({
    verification_status: "deactivated",
    deactivated_at: "2026-05-04T00:00:00.000Z",
    church: ch({ verification_deadline: "2026-06-01T00:00:00.000Z" }),
  });
  const body = buildResponse(resolveStatus(row, "2026-05-05T12:00:00.000Z"));
  assertEquals(body.recovery_path, "support_contact");
  assertEquals(body.verification_status, "deactivated");
});

Deno.test("c.14235 #7(d) — NULL-deadline fail-closed (Option Y) → support_contact", () => {
  // c.14235 #6 explicitly: NULL-deadline routes to the support bucket,
  // not the renewal bucket. Founder Option Y stays fail-closed; the
  // FE-facing path is support, not renewal.
  const row = baseRow({ verification_status: "pending", church: null });
  const body = buildResponse(resolveStatus(row, "2026-05-05T12:00:00.000Z"));
  assertEquals(body.recovery_path, "support_contact");
  assertEquals(body.verification_status, "deactivated");
});

Deno.test("c.14235 #7(e) — admin-deactivated and NULL-deadline responses are shape- and byte-identical", () => {
  // The uniform-support-bucket invariant from c.14235 #3 — distinct
  // upstream causes that both fall outside the renewal trigger must
  // collapse into one indistinguishable wire body.
  const adminRow = baseRow({
    verification_status: "deactivated",
    deactivated_at: "2026-05-04T00:00:00.000Z",
    church: ch({ verification_deadline: "2026-06-01T00:00:00.000Z" }),
  });
  const nullRow = baseRow({ verification_status: "pending", church: null });
  const adminBody = buildResponse(resolveStatus(adminRow, "2026-05-05T12:00:00.000Z"));
  const nullBody = buildResponse(resolveStatus(nullRow, "2026-05-05T12:00:00.000Z"));
  assertEquals(JSON.stringify(adminBody), JSON.stringify(nullBody));
  assertEquals(Object.keys(adminBody).sort(), Object.keys(nullBody).sort());
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

// ─── KAN-205 — resolveBranchSubstate (SEC panel 2026-07-03, ratified) ────
// USER-level leader-initiated soft-delete resolves 'self_deleted' FIRST;
// admin-initiated reasons keep the church-derived 'soft_deleted' ceremony;
// skip-flow leaders are no longer excluded when THEY self-deleted.

Deno.test("KAN-205 substate — leader-initiated user soft-delete → 'self_deleted' (checked before church state)", () => {
  const row = baseRow({
    soft_deleted_at: "2026-05-01T00:00:00.000Z",
    soft_delete_reason: "leader_initiated",
    hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
    is_active: false,
    // Church deliberately ALSO soft-deleted (last-leader mirror case) —
    // the user-level check must still win.
    church: ch({ soft_deleted_at: "2026-05-01T00:00:00.000Z" }),
  });
  assertEquals(resolveBranchSubstate(row), "self_deleted");
});

Deno.test("KAN-205 substate — skip-flow (no church) leader-initiated soft-delete → 'self_deleted'", () => {
  const row = baseRow({
    church: null,
    church_id: null,
    soft_deleted_at: "2026-05-01T00:00:00.000Z",
    soft_delete_reason: "leader_initiated",
    hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
    is_active: false,
  });
  assertEquals(resolveBranchSubstate(row), "self_deleted");
});

Deno.test("KAN-205 substate — admin-reason user soft-delete falls through to church-derived 'soft_deleted'", () => {
  const row = baseRow({
    soft_deleted_at: "2026-05-01T00:00:00.000Z",
    soft_delete_reason: "admin_deactivation",
    hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
    is_active: false,
    church: ch({ soft_deleted_at: "2026-05-01T00:00:00.000Z" }),
  });
  assertEquals(resolveBranchSubstate(row), "soft_deleted");
});

Deno.test("KAN-205 substate — safety_evacuation reason likewise stays on the rejection ceremony", () => {
  const row = baseRow({
    soft_deleted_at: "2026-05-01T00:00:00.000Z",
    soft_delete_reason: "safety_evacuation",
    hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
    is_active: false,
    church: ch({ soft_deleted_at: "2026-05-01T00:00:00.000Z" }),
  });
  assertEquals(resolveBranchSubstate(row), "soft_deleted");
});

Deno.test("KAN-205 substate — pre-existing behaviors unchanged (church soft-delete / request_info / none)", () => {
  // Church-only soft-delete (admin reject, user mirror not yet visible) → soft_deleted.
  assertEquals(
    resolveBranchSubstate(baseRow({ church: ch({ soft_deleted_at: "2026-05-01T00:00:00.000Z" }) })),
    "soft_deleted",
  );
  // request_info modal kind → request_info.
  assertEquals(
    resolveBranchSubstate(baseRow({ church: ch({ last_outcome_modal_kind: "request_info" }) })),
    "request_info",
  );
  // Clean row → no decoration.
  assertEquals(resolveBranchSubstate(baseRow()), undefined);
  // Skip-flow, not deleted → no decoration.
  assertEquals(resolveBranchSubstate(baseRow({ church: null, church_id: null })), undefined);
});
