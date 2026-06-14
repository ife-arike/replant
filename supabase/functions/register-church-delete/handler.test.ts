// KAN-192 register-church-delete — handler tests. Mocked deps; covers
// request shape, validation routing, rate-limit, and the full set of
// DeleteOutcome → HTTP status mappings (200/403/404/409/410/500).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import type { DeleteChurchPayload, DeleteOutcome } from "./logic.ts";

const VALID_UUID = "ded45949-438e-422e-9dbf-9dadb2ee4f84";
const validBody = {
  churchId: VALID_UUID,
  contactEmail: "office@maranatha.test",
};

interface Calls {
  attempts: DeleteChurchPayload[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeDeps(
  overrides: Partial<Deps> = {},
  outcome: DeleteOutcome = { kind: "deleted" },
): { deps: Deps; calls: Calls } {
  const calls: Calls = { attempts: [], logs: [] };
  const attemptDelete = overrides.attemptDelete ??
    (async (p: DeleteChurchPayload) => {
      calls.attempts.push(p);
      return outcome;
    });
  const rateLimit = overrides.rateLimit ??
    (async (_ip: string) => ({ allowed: true as const, count: 1 }));
  const getIp = overrides.getIp ?? (() => "203.0.113.7");
  const log = overrides.log ??
    ((level, event, fields) => calls.logs.push({ level, event, fields }));
  return { deps: { attemptDelete, rateLimit, getIp, log }, calls };
}

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/register-church-delete", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ── Method / body shape ────────────────────────────────────────────────

Deno.test("handler — non-POST methods rejected with 405", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const res = await h(new Request("https://example.test/x", { method }));
    assertEquals(res.status, 405);
  }
  assertEquals(calls.attempts.length, 0);
});

Deno.test("handler — non-JSON body returns 400", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  assertEquals(calls.attempts.length, 0);
});

Deno.test("handler — invalid payload returns 400 (no attempt)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ churchId: "nope", contactEmail: "x@y.z" }));
  assertEquals(res.status, 400);
  assertEquals(calls.attempts.length, 0);
});

// ── Rate limit ─────────────────────────────────────────────────────────

Deno.test("handler — rate-limit denial returns 429 before parse", async () => {
  const { deps, calls } = makeDeps({
    rateLimit: async () => ({ allowed: false, retryAfterSeconds: 1200 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 1200);
  assertEquals(calls.attempts.length, 0);
});

// ── DeleteOutcome → HTTP status mapping ────────────────────────────────

Deno.test("handler — outcome 'deleted' → 200 { deleted: true }", async () => {
  const { deps, calls } = makeDeps({}, { kind: "deleted" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.deleted, true);
  assertEquals(calls.attempts.length, 1);
  assertEquals(calls.attempts[0].churchId, VALID_UUID);
});

Deno.test("handler — outcome 'not_found' → 404", async () => {
  const { deps } = makeDeps({}, { kind: "not_found" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 404);
});

Deno.test("handler — outcome 'ownership_mismatch' → 403", async () => {
  const { deps } = makeDeps({}, { kind: "ownership_mismatch" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 403);
});

Deno.test("handler — outcome 'session_expired' → 410", async () => {
  const { deps } = makeDeps({}, { kind: "session_expired" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 410);
});

Deno.test("handler — outcome 'leader_linked' → 409", async () => {
  const { deps } = makeDeps({}, { kind: "leader_linked" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 409);
});

Deno.test("handler — outcome 'unknown_failure' → 500", async () => {
  const { deps } = makeDeps({}, { kind: "unknown_failure" });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 500);
});

// ── Attempt-throw → 500 ────────────────────────────────────────────────

Deno.test("handler — attemptDelete throws → 500 with error log", async () => {
  const { deps, calls } = makeDeps({
    attemptDelete: async () => {
      throw new Error("DB unreachable");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 500);
  const errorLog = calls.logs.find(
    (l) => l.event === "register_church_delete_db_failed",
  );
  assertEquals(errorLog?.level, "error");
});
