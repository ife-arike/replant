import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type CallerRow, type Deps } from "./handler.ts";

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.${"x".repeat(43)}`;
}

const bearer = () => ({
  headers: { Authorization: `Bearer ${makeJwt({ role: "authenticated" })}` },
});

const post = (init: RequestInit = {}) =>
  new Request("http://t/", { method: "POST", ...bearer(), ...init });

const caller = (overrides: Partial<CallerRow> = {}): CallerRow => ({
  id: "user-uuid-1",
  email: "leader@example.org",
  first_name: "Amara",
  church_id: "church-uuid-1",
  is_underground: false,
  soft_deleted_at: null,
  soft_delete_reason: null,
  ...overrides,
});

interface Calls {
  softDelete: number;
  revoke: number;
  emails: { email: string; firstName: string | null; kind: "standard" | "underground" }[];
  emailLogs: { userId: string; outcome: string }[];
}

function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = { softDelete: 0, revoke: 0, emails: [], emailLogs: [] };
  const validateJwt =
    overrides.validateJwt ?? (async () => ({ authUid: "auth-uid-1", role: "authenticated" }));
  const fetchCaller = overrides.fetchCaller ?? (async () => caller());
  const softDeleteAsCaller =
    overrides.softDeleteAsCaller ?? (async () => ({ ok: true }) as const);
  const revokeAllSessions = overrides.revokeAllSessions ?? (async () => {});
  const sendDeletionStartedEmail = overrides.sendDeletionStartedEmail ?? (async () => {});
  const logEmailOutcome = overrides.logEmailOutcome ?? (async () => {});

  const deps: Deps = {
    validateJwt,
    fetchCaller,
    softDeleteAsCaller: async (h) => {
      calls.softDelete++;
      return softDeleteAsCaller(h);
    },
    revokeAllSessions: async (t) => {
      calls.revoke++;
      return revokeAllSessions(t);
    },
    sendDeletionStartedEmail: async (args) => {
      calls.emails.push(args);
      return sendDeletionStartedEmail(args);
    },
    logEmailOutcome: async (args) => {
      calls.emailLogs.push({ userId: args.userId, outcome: args.outcome });
      return logEmailOutcome(args);
    },
    log: () => {},
  };
  return { deps, calls };
}

// --- auth gates -----------------------------------------------------------

Deno.test("405 — non-POST rejected before any work", async () => {
  const { deps, calls } = makeDeps();
  const res = await createHandler(deps)(new Request("http://t/", { method: "GET", ...bearer() }));
  assertEquals(res.status, 405);
  assertEquals(calls.softDelete, 0);
});

Deno.test("401 — missing Authorization header", async () => {
  const { deps, calls } = makeDeps();
  const res = await createHandler(deps)(new Request("http://t/", { method: "POST" }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "UNAUTHORIZED");
  assertEquals(calls.softDelete, 0);
});

Deno.test("401 — validateJwt null (invalid/expired)", async () => {
  const { deps, calls } = makeDeps({ validateJwt: async () => null });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 401);
  assertEquals(calls.softDelete, 0);
});

Deno.test("401 — anon role explicitly rejected (SEC defense-in-depth)", async () => {
  const { deps, calls } = makeDeps({
    validateJwt: async () => ({ authUid: "anon-uid", role: "anon" }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 401);
  assertEquals(calls.softDelete, 0);
});

// --- happy paths ----------------------------------------------------------

Deno.test("200 — standard leader: RPC + global revoke + standard email + email_log 'sent'", async () => {
  const { deps, calls } = makeDeps();
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(calls.softDelete, 1);
  assertEquals(calls.revoke, 1);
  assertEquals(calls.emails.length, 1);
  assertEquals(calls.emails[0].kind, "standard");
  assertEquals(calls.emails[0].email, "leader@example.org");
  assertEquals(calls.emailLogs, [{ userId: "user-uuid-1", outcome: "sent" }]);
});

Deno.test("200 — underground leader gets the information-free variant", async () => {
  const { deps, calls } = makeDeps({
    fetchCaller: async () => caller({ is_underground: true }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(calls.emails.length, 1);
  assertEquals(calls.emails[0].kind, "underground");
});

Deno.test("200 — email send failure NEVER fails the deletion (DELIVER-ALWAYS); outcome logged", async () => {
  const { deps, calls } = makeDeps({
    sendDeletionStartedEmail: async () => {
      throw new Error("Resend 500");
    },
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(calls.softDelete, 1);
  assertEquals(calls.emailLogs, [{ userId: "user-uuid-1", outcome: "failed_resend_emit" }]);
});

Deno.test("200 — email_log write failure (same-day dedup) is swallowed", async () => {
  const { deps } = makeDeps({
    logEmailOutcome: async () => {
      throw new Error("duplicate key value violates unique constraint email_log_dedup");
    },
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
});

Deno.test("200 — global revoke failure is non-fatal (FE global signOut + Day-30 are the backstops)", async () => {
  const { deps, calls } = makeDeps({
    revokeAllSessions: async () => {
      throw new Error("gotrue admin 503");
    },
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(calls.softDelete, 1);
  // Email still fires — teardown failures don't mute the Founder-ruled notice.
  assertEquals(calls.emails.length, 1);
});

Deno.test("200 — caller with no email: deletion proceeds, no send attempted", async () => {
  const { deps, calls } = makeDeps({
    fetchCaller: async () => caller({ email: null }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(calls.softDelete, 1);
  assertEquals(calls.emails.length, 0);
  assertEquals(calls.emailLogs.length, 0);
});

// --- idempotency ----------------------------------------------------------

Deno.test("200 idempotent — already leader_initiated-soft-deleted: no RPC, no email, revoke completes teardown", async () => {
  const { deps, calls } = makeDeps({
    fetchCaller: async () =>
      caller({
        soft_deleted_at: "2026-07-01T00:00:00.000Z",
        soft_delete_reason: "leader_initiated",
      }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, already_deleted: true });
  assertEquals(calls.softDelete, 0);
  assertEquals(calls.emails.length, 0);
  assertEquals(calls.revoke, 1);
});

Deno.test("409 — admin-reason soft-deleted account flows to the RPC and maps NOT_ACTIVE (no idempotent bypass)", async () => {
  const { deps, calls } = makeDeps({
    fetchCaller: async () =>
      caller({
        soft_deleted_at: "2026-07-01T00:00:00.000Z",
        soft_delete_reason: "admin_deactivation",
      }),
    softDeleteAsCaller: async () => ({ ok: false, message: "no active user found for caller" }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.code, "NOT_ACTIVE");
  assertEquals(calls.emails.length, 0);
  assertEquals(calls.revoke, 0);
});

// --- RPC error mapping ------------------------------------------------------

Deno.test("429 — 'deletion limit reached' maps to DELETION_LIMIT; no revoke, no email", async () => {
  const { deps, calls } = makeDeps({
    softDeleteAsCaller: async () => ({ ok: false, message: "deletion limit reached" }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.code, "DELETION_LIMIT");
  assertEquals(calls.revoke, 0);
  assertEquals(calls.emails.length, 0);
});

Deno.test("500 — unknown RPC error returns generic body with no detail leak", async () => {
  const { deps } = makeDeps({
    softDeleteAsCaller: async () => ({
      ok: false,
      message: "connection to db.internal:5432 refused with secret xyz",
    }),
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ["code", "error"]);
  assertEquals(body.code, "INTERNAL_ERROR");
  assertEquals(body.error, "Account deletion failed");
  assertNotEquals(body.error.includes("5432"), true);
  assertNotEquals(body.error.includes("secret"), true);
});

Deno.test("500 — fetchCaller null (missing users row) → generic error", async () => {
  const { deps, calls } = makeDeps({ fetchCaller: async () => null });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 500);
  assertEquals(calls.softDelete, 0);
});

Deno.test("500 — unhandled throw is caught and generic", async () => {
  const { deps } = makeDeps({
    fetchCaller: () => {
      throw new Error("boom with internals");
    },
  });
  const res = await createHandler(deps)(post());
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Account deletion failed");
});

Deno.test("Content-Type is application/json on every path", async () => {
  const cases: { setup: () => ReturnType<typeof makeDeps>; req: Request }[] = [
    { setup: () => makeDeps(), req: new Request("http://t/", { method: "POST" }) }, // 401
    { setup: () => makeDeps(), req: post() }, // 200
    { setup: () => makeDeps({ fetchCaller: async () => null }), req: post() }, // 500
  ];
  for (const c of cases) {
    const { deps } = c.setup();
    const res = await createHandler(deps)(c.req);
    assertEquals(res.headers.get("Content-Type"), "application/json");
  }
});
