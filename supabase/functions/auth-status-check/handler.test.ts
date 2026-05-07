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
    now,
  };
  return { deps, calls };
}

const userRow = (overrides: Partial<UserStatusRow> = {}): UserStatusRow => ({
  id: "user-uuid-1",
  verification_status: "verified",
  deactivated_at: null,
  is_active: true,
  church_id: "church-uuid-1",
  church: { verification_deadline: "2026-06-01T00:00:00.000Z" },
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
        church: { verification_deadline: "2020-01-01T00:00:00.000Z" }, // far in past
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

Deno.test("super_admin downgrade — is_active=false → deactivated, no Option-B write", async () => {
  // DBA 10924: pre-deactivation JWTs remain valid until expiry; the endpoint must
  // catch the lag window by reading is_active at call time. Do NOT auto-deactivate
  // via Option-B — the user is already deactivated by definition.
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
        church: { verification_deadline: "2026-05-19T12:00:00.000Z" },
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

Deno.test("deactivated — pre-existing DB 'deactivated' → 200 deactivated, no atomic write", async () => {
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
  });
  assertEquals(calls.deactivateAtomically, 0);
});

// --- Option B atomic deactivation --------------------------------------

Deno.test("Option B — pending+past → calls deactivateAtomically, returns deactivated", async () => {
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: { verification_deadline: "2026-04-01T00:00:00.000Z" }, // past
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
  });
  assertEquals(calls.deactivateAtomically, 1);
  assertEquals(calls.deactivateArgs[0], {
    userId: "user-uuid-1",
    churchId: "church-uuid-1",
    nowISO: FIXED_NOW.toISOString(),
  });
});

Deno.test("Option B idempotency (TC-44.3a) — deactivateAtomically reports wrote=false → 200 deactivated", async () => {
  // Concurrent caller already wrote (race-loser scenario). The transaction guard
  // (WHERE verification_status='pending') makes the UPDATE affect 0 rows; no audit
  // INSERT runs inside the same tx. Response shape is still deactivated.
  const { deps, calls } = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: { verification_deadline: "2026-04-01T00:00:00.000Z" },
      }),
    deactivateAtomically: async () => ({ wrote: false }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verification_status, "deactivated");
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
        church: { verification_deadline: "2026-04-01T00:00:00.000Z" },
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
        church: { verification_deadline: "2026-04-01T00:00:00.000Z" },
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

// --- TC-44.7 / SEC 10920: path-equality (drift guard) --------------------

Deno.test("Option B vs already-deactivated — response bytes are identical (TC-44.7 / SEC 10920)", async () => {
  // SEC 10920: drift guard. Future edits cannot diverge the two paths' response
  // shapes silently. Compared as text bytes, not just object equality.
  const optionB = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "pending",
        church: { verification_deadline: "2026-04-01T00:00:00.000Z" },
      }),
  });
  const cron = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
      }),
  });

  const optionBRes = await createHandler(optionB.deps)(new Request("http://t/", bearer()));
  const cronRes = await createHandler(cron.deps)(new Request("http://t/", bearer()));

  const optionBBody = await optionBRes.text();
  const cronBody = await cronRes.text();
  assertEquals(optionBBody, cronBody);
  assertEquals(optionBRes.status, cronRes.status);
});

Deno.test("super_admin downgrade vs cron-deactivated — also byte-identical (no path-revealing field)", async () => {
  // Extension of TC-44.7 / SEC 10920: the super_admin downgrade path must also
  // yield a response indistinguishable from the cron-deactivated path.
  const superAdminDown = makeDeps({
    fetchUserStatus: async () => userRow({ is_active: false, verification_status: "deactivated" }),
  });
  const cron = makeDeps({
    fetchUserStatus: async () =>
      userRow({
        verification_status: "deactivated",
        deactivated_at: "2026-04-15T00:00:00.000Z",
        is_active: false,
      }),
  });

  const superAdminRes = await createHandler(superAdminDown.deps)(
    new Request("http://t/", bearer({ role: "authenticated", super_admin: true })),
  );
  const cronRes = await createHandler(cron.deps)(new Request("http://t/", bearer()));

  assertEquals(await superAdminRes.text(), await cronRes.text());
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

Deno.test("500 — pending without church_id (data anomaly throws → catch-all)", async () => {
  const { deps } = makeDeps({
    fetchUserStatus: async () =>
      userRow({ verification_status: "pending", church: null, church_id: null }),
  });
  const handler = createHandler(deps);
  const res = await handler(new Request("http://t/", bearer()));
  assertEquals(res.status, 500);
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
