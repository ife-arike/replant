// KAN-11 check-email-available — handler tests. Mocked deps; covers
// request shape, validation routing, rate-limit gating, lookup success/fail,
// 429 + 500 surfaces.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";

interface Calls {
  findUserByEmail: number;
  findUserArgs: string[];
  rateLimit: number;
  rateLimitArgs: string[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeDeps(
  overrides: Partial<Deps> = {},
  fixedIp = "1.2.3.4",
): { deps: Deps; calls: Calls } {
  const calls: Calls = {
    findUserByEmail: 0,
    findUserArgs: [],
    rateLimit: 0,
    rateLimitArgs: [],
    logs: [],
  };
  const findUserByEmail =
    overrides.findUserByEmail ??
    (async (email: string) => {
      calls.findUserByEmail += 1;
      calls.findUserArgs.push(email);
      return false;
    });
  const rateLimit =
    overrides.rateLimit ??
    (async (ip: string) => {
      calls.rateLimit += 1;
      calls.rateLimitArgs.push(ip);
      return { allowed: true as const, count: 1 };
    });
  const getIp = overrides.getIp ?? ((_req: Request) => fixedIp);
  const log =
    overrides.log ??
    ((level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => {
      calls.logs.push({ level, event, fields });
    });
  return {
    deps: { findUserByEmail, rateLimit, getIp, log },
    calls,
  };
}

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/check-email-available", {
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
  assertEquals(calls.findUserByEmail, 0);
  assertEquals(calls.rateLimit, 0);
});

Deno.test("handler — non-JSON body returns 400 (after rate-limit consumed)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Request body must be valid JSON");
  // Rate-limit IS consumed even on bad JSON — spammers shouldn't bypass.
  assertEquals(calls.rateLimit, 1);
  assertEquals(calls.findUserByEmail, 0);
});

// ── Validation routing ────────────────────────────────────────────────

Deno.test("handler — invalid payload returns 400 with logic.ts error string (no lookup)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "no-at-sign" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "email is not a valid email address");
  assertEquals(calls.findUserByEmail, 0);
});

Deno.test("handler — missing email returns 400 'email is required'", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({}));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "email is required");
  assertEquals(calls.findUserByEmail, 0);
});

// ── Rate-limit gating ─────────────────────────────────────────────────

Deno.test("handler — rate-limit exceeded returns 429 with retry_after_seconds (no lookup)", async () => {
  const { deps, calls } = makeDeps({
    rateLimit: async () => ({ allowed: false, retryAfterSeconds: 2400 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "spammer@example.test" }));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 2400);
  assertEquals(typeof body.error, "string");
  // No lookup performed when rate-limit blocks.
  assertEquals(calls.findUserByEmail, 0);
  // Structured log captured for ops.
  assertEquals(calls.logs.some((l) => l.event === "check_email_rate_limited"), true);
});

Deno.test("handler — rate-limit dep called with the dep's IP, not raw header", async () => {
  const { deps, calls } = makeDeps({}, "10.20.30.40");
  const h = createHandler(deps);
  await h(jsonReq({ email: "ok@example.test" }));
  assertEquals(calls.rateLimitArgs, ["10.20.30.40"]);
});

// ── Success path ──────────────────────────────────────────────────────

Deno.test("handler — available=true when email not found", async () => {
  const { deps, calls } = makeDeps({
    findUserByEmail: async () => false,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "fresh@example.test" }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { available: true });
  assertEquals(calls.logs.some((l) => l.event === "check_email_success"), true);
});

Deno.test("handler — available=false when email already registered", async () => {
  const seenArgs: string[] = [];
  const { deps } = makeDeps({
    findUserByEmail: async (email: string) => {
      seenArgs.push(email);
      return true;
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "existing@example.test" }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { available: false });
  // Lookup arg is canonicalised (lowercased + trimmed) by logic.ts.
  assertEquals(seenArgs[0], "existing@example.test");
});

Deno.test("handler — uppercase email canonicalised to lowercase before lookup", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "  Ruth@PROJECTREPLANT.org  " }));
  assertEquals(res.status, 200);
  assertEquals(calls.findUserArgs[0], "ruth@projectreplant.org");
});

// ── Lookup failure → 500 (never leak raw error) ───────────────────────

Deno.test("handler — findUserByEmail throw maps to 500 (no raw message leaked)", async () => {
  const { deps, calls } = makeDeps({
    findUserByEmail: async () => {
      throw new Error("connection refused: postgres at db.internal:5432");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ email: "x@example.test" }));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Email check failed");
  // Raw Postgres detail did NOT travel to the response.
  assertEquals(body.error.includes("connection refused"), false);
  // Structured log captured the cause for ops.
  assertEquals(calls.logs.some((l) => l.event === "check_email_lookup_failed"), true);
});
