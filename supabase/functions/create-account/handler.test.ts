// create-account — handler tests with mocked deps, reconciled to the
// v8 handler API (2026-07-13; was drifted at the v2/v3 KAN-12 shape and
// failed type-checking for weeks — 18 errors, suite couldn't run).
//
// What moved OUT of the handler since the old suite was written (and is
// therefore NOT tested here — it lives in public.create_account_atomic,
// covered by DB-side review): capacity guard, row construction
// (full_name join, declaration fields, deadlines), church INSERT.
//
// What this suite pins (the handler's actual remaining jobs):
//   - method / body / idempotency-key gates + cache replay
//   - per-IP and per-IP-per-email rate limits (incl. fail-closed 503)
//   - Layer-3 duplicate detection: both-exist / resume / fresh
//   - createAccountAtomic arg passing + RPC-error mapping (P0001 cap,
//     contact-email unique → 409, generic → 500)
//   - compensating auth DELETE only when created-this-run
//   - welcome-email routing: kind (skip / pending_church /
//     verified_church / underground_pending), recipient swap to church
//     contact_email on existing-church join, dynamic daysRemaining
//   - new-church admin email: fires only for non-underground new-church
//     registrations, carries triggeredByUserId (KAN-80 G14)
//   - fire-and-forget: email failure never rolls back the account
//   - success body { userId, churchId } + idempotency cacheSet

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";

const FIXED_NOW = new Date("2026-05-19T12:00:00.000Z");
const FIXED_CHURCH_ID = "11111111-2222-3333-4444-555555555555";
const RESULT_USER_ID = "99999999-8888-7777-6666-555555555555";
const RESULT_CHURCH_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
// Deliberately low-entropy dummy (16+ chars per IDEMPOTENCY_KEY_RE) so
// secret scanners don't false-positive on a test fixture.
const IDEMP_KEY = "aaaa-aaaa-aaaa-aaaa-0001";

type WelcomeArgs = Parameters<Deps["sendWelcomeEmail"]>[0];
type NewChurchArgs = Parameters<Deps["sendNewChurchEmail"]>[0];
type AtomicArgs = Parameters<Deps["createAccountAtomic"]>;

interface Calls {
  findAuthUserByEmail: number;
  findPublicUserByAuthId: number;
  createAuthUser: number;
  deleteAuthUser: number;
  createAccountAtomic: number;
  sendWelcomeEmail: number;
  sendNewChurchEmail: number;
  getChurchInfo: number;
  rateLimit: number;
  perIpRateLimit: number;
  cacheGet: number;
  cacheSet: number;
  atomicArgs: AtomicArgs[];
  deletedAuthIds: string[];
  welcomeArgs: WelcomeArgs[];
  newChurchArgs: NewChurchArgs[];
  cacheSetArgs: { key: string; value: string; ttl: number }[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeCalls(): Calls {
  return {
    findAuthUserByEmail: 0,
    findPublicUserByAuthId: 0,
    createAuthUser: 0,
    deleteAuthUser: 0,
    createAccountAtomic: 0,
    sendWelcomeEmail: 0,
    sendNewChurchEmail: 0,
    getChurchInfo: 0,
    rateLimit: 0,
    perIpRateLimit: 0,
    cacheGet: 0,
    cacheSet: 0,
    atomicArgs: [],
    deletedAuthIds: [],
    welcomeArgs: [],
    newChurchArgs: [],
    cacheSetArgs: [],
    logs: [],
  };
}

function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls = makeCalls();
  const deps: Deps = {
    findAuthUserByEmail: overrides.findAuthUserByEmail ?? (async () => {
      calls.findAuthUserByEmail += 1;
      return null;
    }),
    findPublicUserByAuthId: overrides.findPublicUserByAuthId ?? (async () => {
      calls.findPublicUserByAuthId += 1;
      return null;
    }),
    createAuthUser: overrides.createAuthUser ?? (async ({ email }) => {
      calls.createAuthUser += 1;
      return { id: "auth-new-id", email };
    }),
    deleteAuthUser: overrides.deleteAuthUser ?? (async (authId: string) => {
      calls.deleteAuthUser += 1;
      calls.deletedAuthIds.push(authId);
    }),
    createAccountAtomic: overrides.createAccountAtomic ?? (async (...args: AtomicArgs) => {
      calls.createAccountAtomic += 1;
      calls.atomicArgs.push(args);
      // churchId in the result mirrors reality: null on skip, the new
      // row's id on new-church, the joined id on existing-church.
      const [, , newChurch, existingChurchId] = args;
      const churchId = newChurch !== null
        ? RESULT_CHURCH_ID
        : (existingChurchId ?? null);
      return { userId: RESULT_USER_ID, churchId };
    }),
    sendWelcomeEmail: overrides.sendWelcomeEmail ?? (async (args) => {
      calls.sendWelcomeEmail += 1;
      calls.welcomeArgs.push(args);
    }),
    getChurchInfo: overrides.getChurchInfo ?? (async () => {
      calls.getChurchInfo += 1;
      return null;
    }),
    sendNewChurchEmail: overrides.sendNewChurchEmail ?? (async (args) => {
      calls.sendNewChurchEmail += 1;
      calls.newChurchArgs.push(args);
    }),
    rateLimit: overrides.rateLimit ?? (async () => {
      calls.rateLimit += 1;
      return { allowed: true as const, count: 1 };
    }),
    perIpRateLimit: overrides.perIpRateLimit ?? (async () => {
      calls.perIpRateLimit += 1;
      return { allowed: true as const, count: 1 };
    }),
    idempotencyCacheGet: overrides.idempotencyCacheGet ?? (async () => {
      calls.cacheGet += 1;
      return null;
    }),
    idempotencyCacheSet: overrides.idempotencyCacheSet ?? (async (key, value, ttl) => {
      calls.cacheSet += 1;
      calls.cacheSetArgs.push({ key, value, ttl });
    }),
    getIp: overrides.getIp ?? ((_req: Request) => "1.2.3.4"),
    now: overrides.now ?? (() => FIXED_NOW),
    log: overrides.log ?? ((level, event, fields) => {
      calls.logs.push({ level, event, fields });
    }),
  };
  return { deps, calls };
}

// Existing-church join payload (the most common test base).
const validPayload = {
  firstName: "Ife",
  lastName: "James",
  email: "office@maranatha.test",
  password: "Sup3rSecret",
  role: "pastor",
  anonymous: false,
  churchId: FIXED_CHURCH_ID,
  idempotencyKey: IDEMP_KEY,
};

// Minimal valid newChurch payloads (parseChurchPayload requirements:
// name, country, contact_name, contact_email|contact_phone,
// state_declaration, type, rag_status).
const newChurchSurface = {
  name: "Test Fellowship",
  country: "Nigeria",
  contact_name: "Ife James",
  contact_email: "contact@fellowship.test",
  state_declaration: "We declare our state before the Lord.",
  type: "main_campus",
  rag_status: "green",
};

const newChurchUnderground = {
  name: "Hidden Fellowship",
  country: "Testland",
  contact_name: "A Servant",
  contact_email: "servant@hidden.test",
  state_declaration: "We declare our state before the Lord.",
  type: "underground",
  rag_status: "red",
};

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/create-account", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Drain microtasks so fire-and-forget emails settle before assertions.
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// ── Method / body / idempotency gates ─────────────────────────────────

Deno.test("handler — non-POST returns 405", async () => {
  const { deps } = makeDeps();
  const h = createHandler(deps);
  const res = await h(new Request("https://example.test/x", { method: "GET" }));
  assertEquals(res.status, 405);
});

Deno.test("handler — non-JSON body returns 400 validation_error (per-IP + invalid-body buckets consumed)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "validation_error");
  assertEquals(calls.perIpRateLimit, 1);
  assertEquals(calls.rateLimit, 1);
  assertEquals(calls.createAuthUser, 0);
});

Deno.test("handler — missing idempotency key → 400 idempotency_key_required, no downstream work", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload };
  delete p.idempotencyKey;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "idempotency_key_required");
  assertEquals(calls.findAuthUserByEmail, 0);
  assertEquals(calls.createAuthUser, 0);
});

Deno.test("handler — Idempotency-Key header accepted as the key source", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload };
  delete p.idempotencyKey;
  const req = new Request("https://example.test/create-account", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": IDEMP_KEY },
    body: JSON.stringify(p),
  });
  const res = await h(req);
  assertEquals(res.status, 200);
  assertEquals(calls.createAccountAtomic, 1);
});

Deno.test("handler — idempotency cache hit replays cached 200 verbatim, no downstream work", async () => {
  const cachedBody = JSON.stringify({ userId: "cached-user", churchId: null });
  const { deps, calls } = makeDeps({
    idempotencyCacheGet: async () => cachedBody,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), cachedBody);
  assertEquals(calls.findAuthUserByEmail, 0);
  assertEquals(calls.createAccountAtomic, 0);
});

Deno.test("handler — cache backend failure falls through to a fresh call (no short-circuit)", async () => {
  const { deps, calls } = makeDeps({
    idempotencyCacheGet: async () => {
      throw new Error("upstash down");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.createAccountAtomic, 1);
  assertEquals(calls.logs.some((l) => l.event === "idempotency_cache_get_failed"), true);
});

// ── Validation routing ────────────────────────────────────────────────

Deno.test("handler — missing required fields → 400 validation_error", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  for (const field of ["firstName", "lastName", "email", "password", "role"]) {
    const p: Record<string, unknown> = { ...validPayload };
    delete p[field];
    const res = await h(jsonReq(p));
    assertEquals(res.status, 400, `expected 400 for missing ${field}`);
    const body = await res.json();
    assertEquals(body.error, "validation_error");
  }
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.createAccountAtomic, 0);
});

Deno.test("handler — newChurch AND churchId together → 400 validation_error (mutual exclusion)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ ...validPayload, newChurch: newChurchSurface }));
  assertEquals(res.status, 400);
  assertEquals(calls.createAccountAtomic, 0);
});

// ── Rate-limit gating ─────────────────────────────────────────────────

Deno.test("per-IP rate-limit exceeded → 429 before any body parsing work", async () => {
  const { deps, calls } = makeDeps({
    perIpRateLimit: async () => ({ allowed: false, retryAfterSeconds: 900 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 900);
  assertEquals(calls.findAuthUserByEmail, 0);
  assertEquals(calls.createAuthUser, 0);
});

Deno.test("per-IP rate-limit backend down → 503 fail-closed (pre-UAT audit posture)", async () => {
  const { deps, calls } = makeDeps({
    perIpRateLimit: async () => ({ allowed: false, backendError: true }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 503);
  const body = await res.json();
  assertEquals(body.error, "rate_limit_unavailable");
  assertEquals(calls.findAuthUserByEmail, 0);
});

Deno.test("per-IP-per-email rate-limit exceeded → 429 with retry_after_seconds", async () => {
  const { deps, calls } = makeDeps({
    rateLimit: async () => ({ allowed: false, retryAfterSeconds: 1200 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 1200);
  assertEquals(calls.findAuthUserByEmail, 0);
  assertEquals(calls.createAccountAtomic, 0);
});

// ── Layer 3 — duplicate detection paths ───────────────────────────────

Deno.test("Layer 3 (A) — both auth and public exist → user_already_exists, NO writes", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => ({ id: "auth-existing", email: "office@maranatha.test" }),
    findPublicUserByAuthId: async () => ({ id: "public-existing" }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "user_already_exists");
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.createAccountAtomic, 0);
  assertEquals(calls.deleteAuthUser, 0);
});

Deno.test("Layer 3 (B) — auth exists, public missing → resume: no new auth, atomic gets resumed authId", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => ({ id: "auth-orphan-id", email: "office@maranatha.test" }),
    findPublicUserByAuthId: async () => null,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.createAuthUser, 0); // key invariant
  assertEquals(calls.createAccountAtomic, 1);
  assertEquals(calls.atomicArgs[0][0], "auth-orphan-id");
});

Deno.test("Layer 3 (C) — neither exists → fresh flow: createAuthUser + atomic with new authId", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.createAuthUser, 1);
  assertEquals(calls.atomicArgs[0][0], "auth-new-id");
});

// ── Atomic RPC arg contract ───────────────────────────────────────────

Deno.test("atomic args — existing-church join passes churchId, null newChurch, canonical leader", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq({ ...validPayload, email: "  OFFICE@Maranatha.TEST  ", firstName: "  Ife  ", lastName: "  James  " }));
  const [, leader, newChurch, existingChurchId] = calls.atomicArgs[0];
  assertEquals(newChurch, null);
  assertEquals(existingChurchId, FIXED_CHURCH_ID);
  // Email canonicalisation + name trim + single-space full_name join
  // happen in parsePayload and pass through to the RPC payload.
  assertEquals(leader.email, "office@maranatha.test");
  assertEquals(leader.firstName, "Ife");
  assertEquals(leader.fullName, "Ife James");
  // Attached leader → no personal verification deadline.
  assertEquals(leader.verificationDeadline, null);
});

Deno.test("atomic args — skip flow passes null church refs + 7-day personal deadline", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  const [, leader, newChurch, existingChurchId] = calls.atomicArgs[0];
  assertEquals(newChurch, null);
  assertEquals(existingChurchId, null);
  // 7 days after FIXED_NOW.
  assertEquals(leader.verificationDeadline, "2026-05-26T12:00:00.000Z");
});

// ── RPC-error mapping + compensating delete ───────────────────────────

function rpcError(code: string, message = "boom", details = ""): Error {
  const e = new Error(message) as Error & { code?: string; details?: string };
  e.code = code;
  e.details = details;
  return e;
}

Deno.test("RPC P0001 (capacity) → 400 LEADER_CAP_EXCEEDED + comp-delete of fresh auth user", async () => {
  const { deps, calls } = makeDeps({
    createAccountAtomic: async () => {
      throw rpcError("P0001");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "LEADER_CAP_EXCEEDED");
  assertEquals(calls.deleteAuthUser, 1);
  assertEquals(calls.deletedAuthIds, ["auth-new-id"]);
});

Deno.test("RPC 23505 churches contact-email unique → 409 contact_email_taken", async () => {
  const { deps } = makeDeps({
    createAccountAtomic: async () => {
      throw rpcError("23505", "duplicate key", "churches_contact_email_unique_excl_campus");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.error, "contact_email_taken");
});

Deno.test("RPC failure on RESUME path → NO compensating delete (auth pre-existed)", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => ({ id: "auth-orphan-id", email: "office@maranatha.test" }),
    findPublicUserByAuthId: async () => null,
    createAccountAtomic: async () => {
      throw rpcError("XX000", "connection reset");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.deleteAuthUser, 0); // key invariant
});

Deno.test("RPC unknown failure → 500 internal_error, raw postgres detail NOT leaked", async () => {
  const { deps } = makeDeps({
    createAccountAtomic: async () => {
      throw rpcError("XX000", "postgres: violates something internal");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "internal_error");
  assertEquals(JSON.stringify(body).includes("postgres"), false);
});

// ── Auth failure paths ────────────────────────────────────────────────

Deno.test("createAuthUser failure → 500 internal_error, no atomic call, no delete", async () => {
  const { deps, calls } = makeDeps({
    createAuthUser: async () => {
      throw new Error("auth: invalid email format on auth side");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "internal_error");
  assertEquals(calls.createAccountAtomic, 0);
  assertEquals(calls.deleteAuthUser, 0);
});

Deno.test("findAuthUserByEmail throw → 500 internal_error", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => {
      throw new Error("auth admin api 503");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  assertEquals(calls.createAuthUser, 0);
});

// ── Success response + idempotency cacheSet ───────────────────────────

Deno.test("success → 200 { userId, churchId } from the atomic result + cacheSet with same body", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  const bodyText = await res.text();
  const body = JSON.parse(bodyText);
  assertEquals(body.userId, RESULT_USER_ID);
  assertEquals(body.churchId, FIXED_CHURCH_ID);
  assertEquals(calls.cacheSet, 1);
  assertEquals(calls.cacheSetArgs[0].value, bodyText);
  assertEquals(calls.cacheSetArgs[0].key.includes(IDEMP_KEY), true);
});

// ── Welcome-email routing (Step 6) ────────────────────────────────────

Deno.test("welcome — existing-church join swaps recipient to church contact_email, dynamic days", async () => {
  const { deps, calls } = makeDeps({
    getChurchInfo: async () => ({
      contact_email: "office@maranatha.test",
      verification_status: "pending",
      // 10 days after FIXED_NOW → daysRemaining 10.
      verification_deadline: "2026-05-29T12:00:00.000Z",
    }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ ...validPayload, email: "personal.leader@example.test" }));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.welcomeArgs[0].email, "office@maranatha.test");
  assertEquals(calls.welcomeArgs[0].kind, "pending_church");
  assertEquals(calls.welcomeArgs[0].daysRemaining, 10);
  assertEquals(calls.welcomeArgs[0].userId, RESULT_USER_ID);
});

Deno.test("welcome — verified church → kind verified_church, no countdown", async () => {
  const { deps, calls } = makeDeps({
    getChurchInfo: async () => ({
      contact_email: null,
      verification_status: "verified",
      verification_deadline: null,
    }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ ...validPayload, email: "personal.leader@example.test" }));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  // contact_email null → falls back to personal email.
  assertEquals(calls.welcomeArgs[0].email, "personal.leader@example.test");
  assertEquals(calls.welcomeArgs[0].kind, "verified_church");
  assertEquals(calls.welcomeArgs[0].daysRemaining, null);
});

Deno.test("welcome — skip flow → kind skip, 7 days, personal email, church lookup never called", async () => {
  const { deps, calls } = makeDeps({
    getChurchInfo: async () => {
      throw new Error("should not be called on skip path");
    },
  });
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload, email: "personal@example.test" };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.welcomeArgs[0].email, "personal@example.test");
  assertEquals(calls.welcomeArgs[0].kind, "skip");
  assertEquals(calls.welcomeArgs[0].daysRemaining, 7);
});

Deno.test("welcome — underground founder → kind underground_pending, personal email, NO church-info lookup", async () => {
  const { deps, calls } = makeDeps({
    getChurchInfo: async () => {
      throw new Error("should not be called for underground founder");
    },
  });
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload, newChurch: newChurchUnderground, email: "servant@personal.test" };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.welcomeArgs[0].kind, "underground_pending");
  assertEquals(calls.welcomeArgs[0].email, "servant@personal.test");
  assertEquals(calls.welcomeArgs[0].daysRemaining, null);
});

Deno.test("welcome — para-ministry new church passes churchType for the organization copy swap", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = {
    ...validPayload,
    newChurch: { ...newChurchSurface, type: "para_ministry" },
  };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.welcomeArgs[0].churchType, "para_ministry");
});

// ── New-church admin email (Step 7) ───────────────────────────────────

Deno.test("Step 7 — new-church email fires for surface new church, carries result ids (KAN-80 G14)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload, newChurch: newChurchSurface };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.sendNewChurchEmail, 1);
  assertEquals(calls.newChurchArgs[0].churchId, RESULT_CHURCH_ID);
  assertEquals(calls.newChurchArgs[0].leaderFullName, "Ife James");
  assertEquals(calls.newChurchArgs[0].triggeredByUserId, RESULT_USER_ID);
});

Deno.test("Step 7 — NO new-church email on existing-church join", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq(validPayload));
  await flushMicrotasks();
  assertEquals(calls.sendNewChurchEmail, 0);
});

Deno.test("Step 7 — NO new-church email for underground founder (v8 Founder rulings #5 + #22)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload, newChurch: newChurchUnderground };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.sendNewChurchEmail, 0);
});

// ── Fire-and-forget contract ──────────────────────────────────────────

Deno.test("welcome email failure does NOT roll back account (fire-and-forget)", async () => {
  const { deps, calls } = makeDeps({
    sendWelcomeEmail: async () => {
      throw new Error("Resend 503");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.createAccountAtomic, 1);
  assertEquals(calls.deleteAuthUser, 0);
  assertEquals(calls.logs.some((l) => l.event === "welcome_email_failed"), true);
});

Deno.test("church-info lookup failure degrades gracefully — welcome still sent with fallback days", async () => {
  const { deps, calls } = makeDeps({
    getChurchInfo: async () => {
      throw new Error("db hiccup");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.welcomeArgs[0].kind, "pending_church");
  assertEquals(calls.welcomeArgs[0].daysRemaining, 30);
  assertEquals(calls.logs.some((l) => l.event === "church_info_lookup_failed"), true);
});
