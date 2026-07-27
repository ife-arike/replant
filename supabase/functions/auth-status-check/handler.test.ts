import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import type { UserStatusRow } from "./logic.ts";

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.${"x".repeat(43)}`;
}

const FIXED_NOW = new Date("2026-05-05T12:00:00.000Z");

interface Calls {
  validateJwt: number;
  fetchUserStatus: number;
  deactivateAtomically: number;
  deactivateArgs: { userId: string; churchId: string | null; nowISO: string }[];
}

function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = {
    validateJwt: 0,
    fetchUserStatus: 0,
    deactivateAtomically: 0,
    deactivateArgs: [],
  };
  const validateJwt = overrides.validateJwt ?? (async () => ({ authUid: "auth-uid-1", role: "authenticated" }));
  const fetchUserStatus = overrides.fetchUserStatus ?? (async () => null);
  const deactivateAtomically = overrides.deactivateAtomically ??
    (async () => ({ wrote: true }));
  const now = overrides.now ?? (() => FIXED_NOW);

  const fetchUndergroundRevealContext = overrides.fetchUndergroundRevealContext ??
    (async () => null);

  const deps: Deps = {
    validateJwt: async (h) => {
      calls.validateJwt++;
      return validateJwt(h);
    },
    fetchUserStatus: async (uid) => {
      calls.fetchUserStatus++;
      return fetchUserStatus(uid);
    },
    deactivateAtomically: async (userId, churchId, nowISO) => {
      calls.deactivateAtomically++;
      calls.deactivateArgs.push({ userId, churchId, nowISO });
      return deactivateAtomically(userId, churchId, nowISO);
    },
    fetchUndergroundRevealContext: async (userId, churchId) => {
      return fetchUndergroundRevealContext(userId, churchId);
    },
    now,
  };
  return { deps, calls };
}

// Full church-embed shape helper. The 2026-06-22 branch_substate fields
// (soft_deleted_at / last_outcome_modal_kind) MUST be present as explicit
// nulls — the resolver's strict `!== null` checks treat `undefined` as
// "set", which is exactly the mock-drift bug that broke 8 body-equality
// tests here when the substate decoration shipped (fixed with KAN-205).
const ch = (
  overrides: Partial<NonNullable<UserStatusRow["church"]>> = {},
): NonNullable<UserStatusRow["church"]> => ({
  verification_status: null,
  verification_deadline: null,
  soft_deleted_at: null,
  last_outcome_modal_kind: null,
  ...overrides,
});

const userRow = (overrides: Partial<UserStatusRow> = {}): UserStatusRow => ({
  id: "user-uuid-1",
  verification_status: "verified",
  deactivated_at: null,
  is_active: true,
  church_id: "church-uuid-1",
  // KAN-205 — user-level soft-delete columns, null by default.
  soft_deleted_at: null,
  soft_delete_reason: null,
  hard_delete_scheduled_at: null,
  user_verification_deadline: null,
  church: ch({ verification_deadline: "2026-06-01T00:00:00.000Z" }),
  ...overrides,
});

const bearer = (claims: Record<string, unknown> = { role: "authenticated" }) => ({
  headers: { Authorization: `Bearer ${makeJwt(claims)}` },
});

// --- 401 paths -----------------------------------------------------------

Deno.test("401 — no Authorization header", async () => {
  const { deps, calls } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", {}));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "UNAUTHORIZED");
  assertEquals(body.error, "Invalid or expired session");
  assertEquals(calls.validateJwt, 0);
});

Deno.test("401 — Authorization header missing 'Bearer '", async () => {
  const { deps, calls } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", { headers: { Authorization: "Basic abc" } }));
  assertEquals(res.status, 401);
  assertEquals(calls.validateJwt, 0);
});

Deno.test("401 — Bearer with empty token", async () => {
  const { deps, calls } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", { headers: { Authorization: "Bearer " } }));
  assertEquals(res.status, 401);
  assertEquals(calls.validateJwt, 0);
});

Deno.test("401 — validateJwt returns null (invalid/expired)", async () => {
  const { deps } = makeDeps({ validateJwt: async () => null });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 401);
});

Deno.test("401 — validateJwt returns role='anon' (explicit SEC rejection)", async () => {
  const { deps } = makeDeps({
    validateJwt: async () => ({ authUid: "anon-uid", role: "anon" }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 401);
});

Deno.test("401 — malformed JWT body (decodeJwtPayload throws)", async () => {
  const { deps, calls } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", { headers: { Authorization: "Bearer aaa.bbb" } }));
  assertEquals(res.status, 401);
  assertEquals(calls.fetchUserStatus, 0);
});

// --- super_admin path (DBA 10924 — read is_active and downgrade) --------

Deno.test("super_admin happy-path — is_active=true with past deadline → active (verification_deadline bypassed)", async () => {
  // SEC 10920 + DBA 10924: super_admin still bypasses church.verification_deadline
  // (church verification doesn't apply to super_admins). Must NOT bypass is_active.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        is_active: true,
        verification_status: "pending",
        church: ch({ verification_deadline: "2020-01-01T00:00:00.000Z" }), // far in past
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "active",
    verification_deadline: null,
    days_remaining: null,
  });
  assertEquals(calls.fetchUserStatus, 1);
  // super_admin must NOT trigger Option-B writes — DBA 10924 explicitly forbids
  // auto-deactivation on this path. The is_active=false branch returns 'deactivated'
  // without writing; is_active=true (this case) returns 'active'.
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("super_admin downgrade — is_active=false → deactivated/support_contact, no Option-B write", async () => {
  // DBA 10924: pre-deactivation JWTs remain valid until expiry; the endpoint must
  // catch the lag window by reading is_active at call time. Do NOT auto-deactivate
  // via Option-B — the user is already deactivated by definition.
  // KAN-36 v2 (c.14235): super_admin downgrade is admin-initiated by construction,
  // so recovery_path is always "support_contact" on this path.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({ is_active: false, verification_status: "deactivated" }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "support_contact",
  });
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("super_admin — fetchUserStatus returns null → 500", async () => {
  // Super_admin without a users row is an integrity gap; surface as 500 rather
  // than fabricate either active or deactivated.
  const { deps } = makeDeps({ fetchUserStatus: async () => null });
  const handler = createHandler(deps);
  const res = await handler(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  assertEquals(res.status, 500);
});

// --- regular user routing -----------------------------------------------

Deno.test("active — DB 'verified' → 200 active shape", async () => {
  const { deps } = makeDeps({
    fetchUserStatus: async () => userRow({ verification_status: "verified" }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "active",
    verification_deadline: null,
    days_remaining: null,
  });
});

Deno.test("pending in window — 200 pending with computed days_remaining", async () => {
  const { deps } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-05-19T12:00:00.000Z" }),
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "pending",
    verification_deadline: "2026-05-19T12:00:00.000Z",
    days_remaining: 14,
  });
});

Deno.test("deactivated — pre-existing DB 'deactivated' with future deadline → 200 deactivated/support_contact, no atomic write", async () => {
  // userRow default carries church.verification_deadline: "2026-06-01" (future
  // from FIXED_NOW 2026-05-05). c.14235 #2 — no past-deadline signal means
  // recovery_path = "support_contact" (treated as admin-initiated absent any
  // deadline-trigger fingerprint in the row).
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({ verification_status: "deactivated", deactivated_at: "2026-04-01T00:00:00.000Z", is_active: false }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "support_contact",
  });
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("deactivated — pre-existing DB 'deactivated' with PAST deadline → 200 deactivated/verification_renewal", async () => {
  // c.14235 #2 — cron-flipped fingerprint (deactivated + past, non-NULL
  // deadline). Resolves to verification_renewal so the FE can render the
  // renewal-specific copy.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
        // Panel-B predicate (2026-07-13): the renewal fingerprint now also
        // requires the church to still be PENDING.
        church: ch({ verification_status: "pending", verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "verification_renewal",
  });
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("F4 (2026-07-13) — pending user on a REJECTED church → 200 deactivated/support_contact + lockout_reason church_rejected", async () => {
  // Flow-gaps F4/G10 wire pin: the rejection decoration must survive the
  // full handler path (fetch → resolve → buildResponse) and appear on the
  // wire exactly once, with recovery_path untouched.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_status: "rejected", verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "support_contact",
    lockout_reason: "church_rejected",
  });
  // A rejected-church leader must never trip the deadline write.
  assertEquals(calls.deactivateAtomically, 0);
});

// --- Option B atomic deactivation --------------------------------------

Deno.test("Option B — pending+past → calls deactivateAtomically, returns deactivated/verification_renewal", async () => {
  // c.14235 #2 — login-check just-flipped past-deadline collapses with cron
  // to recovery_path: "verification_renewal".
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }), // past
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "verification_renewal",
  });
  assertEquals(calls.deactivateAtomically, 1);
  assertEquals(calls.deactivateArgs[0], {
    userId: "user-uuid-1",
    churchId: "church-uuid-1",
    nowISO: FIXED_NOW.toISOString(),
  });
});

Deno.test("Option B idempotency (TC-44.3a) — deactivateAtomically reports wrote=false → 200 deactivated/verification_renewal", async () => {
  // Concurrent caller already wrote (race-loser scenario). The transaction guard
  // (WHERE verification_status='pending') makes the UPDATE affect 0 rows; no audit
  // INSERT runs inside the same tx. Response shape is still deactivated.
  // c.14235 #2 — same renewal-bucket bytes as the win-the-race case.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
    deactivateAtomically: async () => ({ wrote: false }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verification_status, "deactivated");
  assertEquals(body.recovery_path, "verification_renewal");
  assertEquals(calls.deactivateAtomically, 1);
});

Deno.test("Transaction rollback — deactivateAtomically throws → 500, response carries no detail", async () => {
  // SEC 10920 invariant: no deactivation may persist without its audit row. When
  // the audit INSERT fails inside the transaction, the impl rolls back the UPDATE
  // and re-throws. The handler's catch-all returns 500. The DB stays in pre-
  // deactivation state, so the next call retries cleanly.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
    deactivateAtomically: async () => {
      throw new Error("audit_log INSERT failed: violates check constraint at server.internal:5432");
    },
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ["code", "error"]);
  assertEquals(body.code, "INTERNAL_ERROR");
  assertEquals(body.error, "Status check failed");
  // Internal detail must not leak.
  assertNotEquals(body.error.includes("audit_log"), true);
  assertNotEquals(body.error.includes("constraint"), true);
  assertNotEquals(body.error.includes("5432"), true);
  assertEquals(calls.deactivateAtomically, 1);
});

Deno.test("Transaction rollback — second call after rollback still sees pre-deactivation state and retries cleanly", async () => {
  // Models the integration-level invariant: after a rolled-back failure, the user
  // remains 'pending' in DB. A subsequent call goes through Option-B again. Test
  // simulates by holding the fetch state constant — first call's deactivation
  // throws, second call's deactivation succeeds.
  let attempt = 0;
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
    deactivateAtomically: async () => {
      attempt++;
      if (attempt === 1) throw new Error("audit insert failed");
      return { wrote: true };
    },
  });
  const handler = createHandler(deps);

  const res1 = await handler(new Request("http://t/", bearer()));
  assertEquals(res1.status, 500);

  const res2 = await handler(new Request("http://t/", bearer()));
  assertEquals(res2.status, 200);
  const body2 = await res2.json();
  assertEquals(body2.verification_status, "deactivated");
  assertEquals(calls.deactivateAtomically, 2);
});

// --- TC-44.7 v2 / SEC c.14235 #7: path-equality within each bucket ------
// Drift guard preserved: within the renewal bucket (login-check vs cron,
// both past-deadline), bytes must stay identical. Within the support
// bucket (super_admin downgrade vs admin-flipped row with no past-
// deadline signal), bytes must also stay identical. Only the renewal vs
// support distinction is intentionally exposed.

Deno.test("TC-44.7 v2 — Option B and cron-with-past-deadline → byte-identical renewal-bucket bytes", async () => {
  // Both paths are deadline-driven. Option B is login-check just-flipped;
  // cron-with-past-deadline is the row a prior cron run produced. Same
  // recovery_path bucket → indistinguishable wire response.
  const optionB = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
  });
  const cron = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
        church: ch({ verification_status: "pending", verification_deadline: "2026-04-01T00:00:00.000Z" }), // past + still-pending (Panel-B predicate)
      }),
  });

  const optionBRes = await createHandler(optionB.deps)(new Request("http://t/", bearer()));
  const cronRes = await createHandler(cron.deps)(new Request("http://t/", bearer()));

  const optionBBody = await optionBRes.text();
  const cronBody = await cronRes.text();
  assertEquals(optionBBody, cronBody);
  assertEquals(optionBRes.status, cronRes.status);
});

Deno.test("TC-44.7 v2 — super_admin downgrade and admin-flipped (no past-deadline) → byte-identical support-bucket bytes", async () => {
  // Both paths are admin-initiated by construction (super_admin downgrade
  // ignores church.verification_deadline; admin-flipped on future deadline
  // has no deadline-trigger signal). Same recovery_path bucket →
  // indistinguishable wire response.
  const superAdminDown = makeDeps({
    fetchUserStatus: async () => userRow({ is_active: false, verification_status: "deactivated" }),
  });
  const adminFlipped = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
        // default future deadline kept → support bucket
      }),
  });

  const superAdminRes = await createHandler(superAdminDown.deps)(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  const adminFlippedRes = await createHandler(adminFlipped.deps)(new Request("http://t/", bearer()));

  assertEquals(await superAdminRes.text(), await adminFlippedRes.text());
});

Deno.test("c.14235 #7 cross-bucket — renewal and support bodies differ only on recovery_path", async () => {
  // The single intentional leak. Diff the JSON-parsed objects to confirm
  // the only-differing key is recovery_path.
  const renewal = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
        church: ch({ verification_status: "pending", verification_deadline: "2026-04-01T00:00:00.000Z" }),
      }),
  });
  const support = makeDeps({
    fetchUserStatus: async () => userRow({ is_active: false, verification_status: "deactivated" }),
  });

  const renewalRes = await createHandler(renewal.deps)(new Request("http://t/", bearer()));
  const supportRes = await createHandler(support.deps)(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );

  const renewalBody = await renewalRes.json();
  const supportBody = await supportRes.json();
  assertEquals(renewalRes.status, supportRes.status);
  assertEquals(Object.keys(renewalBody).sort(), Object.keys(supportBody).sort());
  assertEquals(renewalBody.recovery_path, "verification_renewal");
  assertEquals(supportBody.recovery_path, "support_contact");
  // Every other field must match across the cross-bucket pair.
  assertEquals(renewalBody.verification_status, supportBody.verification_status);
  assertEquals(renewalBody.verification_deadline, supportBody.verification_deadline);
  assertEquals(renewalBody.days_remaining, supportBody.days_remaining);
});

// --- 500 paths -----------------------------------------------------------

Deno.test("500 — fetchUserStatus returns null (user row missing)", async () => {
  const { deps } = makeDeps({ fetchUserStatus: async () => null });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.code, "INTERNAL_ERROR");
});

Deno.test("pending without church_id → 200 deactivated/support_contact (fail-closed per Founder Option Y)", async () => {
  // Stale pre-KAN-36-v1 expectation was 500. KAN-36 v1 (SEC c.14194 + Founder
  // Option Y, locked 2026-05-21) made NULL-deadline fail-closed: resolve to
  // deactivated without throwing. KAN-36 v2 (SEC c.14235 #6) further locks
  // recovery_path on this branch to support_contact. Aligns with the
  // resolveStatus tests at logic.test.ts:169-186.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({ verification_status: "pending", church: null, church_id: null }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, {
    verification_status: "deactivated",
    verification_deadline: null,
    days_remaining: null,
    recovery_path: "support_contact",
  });
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("500 — internal error response body has no detail leak", async () => {
  const { deps } = makeDeps({
    fetchUserStatus: () => {
      throw new Error("DB connection refused at db.internal:5432 with secret xyz");
    },
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ["code", "error"]);
  assertEquals(body.code, "INTERNAL_ERROR");
  assertEquals(body.error, "Status check failed");
  assertNotEquals(body.error.includes("DB connection"), true);
  assertNotEquals(body.error.includes("secret"), true);
  assertNotEquals(body.error.includes("5432"), true);
});

Deno.test("Response Content-Type is application/json on every path", async () => {
  const cases: { name: string; setup: () => ReturnType<typeof makeDeps>; req: Request }[] = [
    {
      name: "401",
      setup: () => makeDeps(),
      req: new Request("http://t/"),
    },
    {
      name: "200 active",
      setup: () =>
        makeDeps({ fetchUserStatus: async () => userRow({ verification_status: "verified" }) }),
      req: new Request("http://t/", bearer()),
    },
    {
      name: "500",
      setup: () => makeDeps({ fetchUserStatus: async () => null }),
      req: new Request("http://t/", bearer()),
    },
  ];
  for (const c of cases) {
    const { deps } = c.setup();
    const res = await createHandler(deps)(c.req);
    assertEquals(res.headers.get("Content-Type"), "application/json", `case ${c.name}`);
  }
});

// --- KAN-205 — self_deleted substate (SEC panel 2026-07-03, ratified) ----
// The blocker fix: auth-status-check must SEE user-level soft-deletion.
// Wire contract: top-level verification_status 'pending' (never
// 'deactivated' — the FE deactivation modal fires on that before substate
// mapping) + branch_substate 'self_deleted'. No deadline write may run.

const SELF_DELETED_WIRE_BODY = {
  verification_status: "pending",
  verification_deadline: null,
  days_remaining: null,
  branch_substate: "self_deleted",
};

Deno.test("KAN-205 — self-deleted VERIFIED leader (second-leader case) → self_deleted body, no write", async () => {
  // The headline blocker: church stays live (co-leader remains), user row
  // is verified + self-deleted. Pre-fix this resolved 'active' and the
  // leader saw a working-looking app where every write failed on RLS.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "verified",
        is_active: false,
        soft_deleted_at: "2026-05-01T00:00:00.000Z",
        soft_delete_reason: "leader_initiated",
        hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
        deactivated_at: "2026-05-01T00:00:00.000Z",
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), SELF_DELETED_WIRE_BODY);
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("KAN-205 — self-deleted PENDING leader with lapsed church deadline → self_deleted body, deactivateAtomically NOT called", async () => {
  // Pre-fix this was the clobber path: pending_past_deadline_needs_write
  // fired deactivateAtomically over the self-deletion state.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        is_active: false,
        soft_deleted_at: "2026-05-01T00:00:00.000Z",
        soft_delete_reason: "leader_initiated",
        hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
        church: ch({ verification_deadline: "2026-04-01T00:00:00.000Z" }), // past
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), SELF_DELETED_WIRE_BODY);
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("KAN-205 — self-deleted SKIP-FLOW leader (no church) → self_deleted body (previously excluded from substates)", async () => {
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        is_active: false,
        church: null,
        church_id: null,
        soft_deleted_at: "2026-05-01T00:00:00.000Z",
        soft_delete_reason: "leader_initiated",
        hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
        user_verification_deadline: "2026-04-20T00:00:00.000Z", // lapsed — must NOT write
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), SELF_DELETED_WIRE_BODY);
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("KAN-205 — self-deleted super_admin → self_deleted body (not the deactivated/support modal)", async () => {
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        is_active: false,
        soft_deleted_at: "2026-05-01T00:00:00.000Z",
        soft_delete_reason: "leader_initiated",
        hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), SELF_DELETED_WIRE_BODY);
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("KAN-205 — ADMIN-reason soft-deleted user keeps the church-derived 'soft_deleted' rejection surface", async () => {
  // Two-eyes admin reject mirrors soft-delete onto users AND church with
  // reason 'admin_deactivation'. That lifecycle must stay on the existing
  // rejection ceremony ('soft_deleted'), NOT the self-restore screen.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        is_active: false,
        soft_deleted_at: "2026-05-01T00:00:00.000Z",
        soft_delete_reason: "admin_deactivation",
        hard_delete_scheduled_at: "2026-05-31T00:00:00.000Z",
        church: ch({
          verification_status: "rejected",
          soft_deleted_at: "2026-05-01T00:00:00.000Z",
        }),
      }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.branch_substate, "soft_deleted");
  assertEquals(body.verification_status, "deactivated");
  // The deadline write path must not fire for ANY soft-deleted row.
  assertEquals(calls.deactivateAtomically, 0);
});

Deno.test("KAN-205 — NON-deleted leader is untouched by the new branch (regression guard)", async () => {
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () => userRow({ verification_status: "verified" }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verification_status, "active");
  assertEquals("branch_substate" in body, false);
  assertEquals(calls.deactivateAtomically, 0);
});
