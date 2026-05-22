// KAN-12 create-account — handler tests with mocked deps.
//
// Per dispatch minimums:
//   - Layer 3 duplicate detection: both-exist path → user_already_exists
//   - Layer 3 auth-only path → resume (skip createAuthUser, complete INSERT)
//   - Layer 3 neither path → fresh flow (createAuthUser + INSERT)
//   - Capacity guard: count ≥ 2 blocks before INSERT
//   - anonymous defaults false when absent (logic.ts already covers this;
//     handler test pins end-to-end pass-through)
//   - field validation rejects missing required fields → validation_error
//   - full_name trim format pass-through
//   - Compensating DELETE on INSERT failure when authUserCreatedThisRun
//   - No compensating DELETE on INSERT failure when resumed from existing auth

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type AuthUserRef,
  createHandler,
  type Deps,
  type InsertPublicUserRow,
} from "./handler.ts";

const FIXED_NOW = new Date("2026-05-19T12:00:00.000Z");
const FIXED_CHURCH_ID = "11111111-2222-3333-4444-555555555555";

interface Calls {
  findAuthUserByEmail: number;
  findPublicUserByAuthId: number;
  createAuthUser: number;
  deleteAuthUser: number;
  countActiveUsersInChurch: number;
  insertPublicUser: number;
  sendWelcomeEmail: number;
  sendNewChurchEmail: number;
  rateLimit: number;
  insertedRows: InsertPublicUserRow[];
  deletedAuthIds: string[];
  welcomeArgs: { email: string; firstName: string }[];
  newChurchArgs: { churchId: string; leaderEmail: string; leaderFullName: string }[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeCalls(): Calls {
  return {
    findAuthUserByEmail: 0,
    findPublicUserByAuthId: 0,
    createAuthUser: 0,
    deleteAuthUser: 0,
    countActiveUsersInChurch: 0,
    insertPublicUser: 0,
    sendWelcomeEmail: 0,
    sendNewChurchEmail: 0,
    rateLimit: 0,
    insertedRows: [],
    deletedAuthIds: [],
    welcomeArgs: [],
    newChurchArgs: [],
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
    countActiveUsersInChurch: overrides.countActiveUsersInChurch ?? (async () => {
      calls.countActiveUsersInChurch += 1;
      return 0;
    }),
    insertPublicUser: overrides.insertPublicUser ?? (async (row) => {
      calls.insertPublicUser += 1;
      calls.insertedRows.push(row);
      return { id: "public-new-id" };
    }),
    sendWelcomeEmail: overrides.sendWelcomeEmail ?? (async (args) => {
      calls.sendWelcomeEmail += 1;
      calls.welcomeArgs.push(args);
    }),
    sendNewChurchEmail: overrides.sendNewChurchEmail ?? (async (args) => {
      calls.sendNewChurchEmail += 1;
      calls.newChurchArgs.push(args);
    }),
    // Finalization fix 4 — default test impl returns null (no
    // contact_email set) so existing happy-path tests fall back to
    // the personal auth email. Tests asserting ministry-email
    // routing override this with a stub that returns a string.
    getChurchContactEmail: overrides.getChurchContactEmail ?? (async () => null),
    rateLimit: overrides.rateLimit ?? (async () => {
      calls.rateLimit += 1;
      return { allowed: true as const, count: 1 };
    }),
    getIp: overrides.getIp ?? ((_req: Request) => "1.2.3.4"),
    now: overrides.now ?? (() => FIXED_NOW),
    log: overrides.log ?? ((level, event, fields) => {
      calls.logs.push({ level, event, fields });
    }),
  };
  return { deps, calls };
}

const validPayload = {
  firstName: "Ife",
  lastName: "James",
  email: "office@maranatha.test",
  password: "Sup3rSecret",
  role: "pastor",
  anonymous: false,
  churchId: FIXED_CHURCH_ID,
  isNewChurch: false,
};

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/create-account", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Helper: drain microtasks so fire-and-forget emails (void/.then chains)
// have a chance to run before assertions.
async function flushMicrotasks() {
  // Two ticks: one for the void Promise chain, one for any .catch.
  await Promise.resolve();
  await Promise.resolve();
}

// ── Method / body shape ────────────────────────────────────────────────

Deno.test("handler — non-POST returns 405", async () => {
  const { deps } = makeDeps();
  const h = createHandler(deps);
  const res = await h(new Request("https://example.test/x", { method: "GET" }));
  assertEquals(res.status, 405);
});

Deno.test("handler — non-JSON body returns 400 validation_error", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "validation_error");
  // Rate-limit consumed on parse-failure path too (IP-only bucket).
  assertEquals(calls.rateLimit, 1);
  assertEquals(calls.createAuthUser, 0);
});

// ── Validation routing ────────────────────────────────────────────────

Deno.test("handler — missing required fields → 400 validation_error", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  // Finalization fix 4 — churchId removed from required list. Missing
  // churchId is the skip-flow path (handled below by a separate test).
  for (const field of ["firstName", "lastName", "email", "password", "role"]) {
    const p: Record<string, unknown> = { ...validPayload };
    delete p[field];
    const res = await h(jsonReq(p));
    assertEquals(res.status, 400, `expected 400 for missing ${field}`);
    const body = await res.json();
    assertEquals(body.error, "validation_error");
  }
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.insertPublicUser, 0);
});

// ── KAN finalization (skip flow + welcome email routing) ───────────────

Deno.test("handler — KAN finalization: skip-flow accepts missing churchId, inserts with church_id null, skips capacity check", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  assertEquals(calls.countActiveUsersInChurch, 0, "skip path → no capacity check");
  assertEquals(calls.insertPublicUser, 1);
  assertEquals(calls.insertedRows[0].church_id, null, "row.church_id is null on skip");
});

Deno.test("handler — KAN finalization: welcome email routes to church contact_email when present", async () => {
  const { deps, calls } = makeDeps({
    getChurchContactEmail: async () => "office@maranatha.test",
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({
    ...validPayload,
    email: "personal.leader@example.test",
  }));
  assertEquals(res.status, 200);
  // Fire-and-forget — yield a microtask so the welcome email .catch wrapper
  // settles before assertion.
  await Promise.resolve();
  assertEquals(calls.welcomeArgs[0]?.email, "office@maranatha.test", "ministry email used");
});

Deno.test("handler — KAN finalization: welcome email falls back to personal email when contact_email is null", async () => {
  const { deps, calls } = makeDeps({
    getChurchContactEmail: async () => null,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({
    ...validPayload,
    email: "personal.leader@example.test",
  }));
  assertEquals(res.status, 200);
  await Promise.resolve();
  assertEquals(calls.welcomeArgs[0]?.email, "personal.leader@example.test", "fallback to personal");
});

Deno.test("handler — KAN finalization: skip-flow welcome email uses personal email (no church to look up)", async () => {
  const { deps, calls } = makeDeps({
    // Should not be called on the skip path — return a fake to verify it isn't.
    getChurchContactEmail: async () => "should-not-be-used@example.test",
  });
  const h = createHandler(deps);
  const p: Record<string, unknown> = { ...validPayload, email: "personal@example.test" };
  delete p.churchId;
  const res = await h(jsonReq(p));
  assertEquals(res.status, 200);
  await Promise.resolve();
  assertEquals(calls.welcomeArgs[0]?.email, "personal@example.test", "skip path → personal email");
});

// ── Rate-limit gating ──────────────────────────────────────────────────

Deno.test("handler — rate-limit exceeded → 429 with retry_after_seconds", async () => {
  const { deps, calls } = makeDeps({
    rateLimit: async () => ({ allowed: false, retryAfterSeconds: 1200 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 1200);
  // No Auth or DB work attempted when rate-limited.
  assertEquals(calls.findAuthUserByEmail, 0);
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.insertPublicUser, 0);
});

// ── Layer 3 — duplicate detection paths ────────────────────────────────

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
  assertEquals(calls.insertPublicUser, 0);
  assertEquals(calls.deleteAuthUser, 0);
});

Deno.test("Layer 3 (B) — auth exists but public missing → resume, NO new auth create, INSERT proceeds", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => ({ id: "auth-orphan-id", email: "office@maranatha.test" }),
    findPublicUserByAuthId: async () => null, // public.users absent
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.createAuthUser, 0); // <-- key invariant
  assertEquals(calls.insertPublicUser, 1);
  // Inserted row carries the resumed auth_id.
  assertEquals(calls.insertedRows[0].auth_id, "auth-orphan-id");
});

Deno.test("Layer 3 (C) — neither auth nor public exists → fresh flow (createAuthUser + INSERT)", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => null,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.createAuthUser, 1);
  assertEquals(calls.insertPublicUser, 1);
  assertEquals(calls.insertedRows[0].auth_id, "auth-new-id");
});

// ── Capacity guard ─────────────────────────────────────────────────────

Deno.test("capacity guard — count >= 2 → LEADER_CAP_EXCEEDED before INSERT", async () => {
  const { deps, calls } = makeDeps({
    countActiveUsersInChurch: async () => 2, // full
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "LEADER_CAP_EXCEEDED");
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.insertPublicUser, 0);
});

Deno.test("capacity guard — count = 1 → allowed, INSERT proceeds", async () => {
  const { deps, calls } = makeDeps({
    countActiveUsersInChurch: async () => 1,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  assertEquals(calls.insertPublicUser, 1);
});

// ── Atomic boundary — Step 4 INSERT failure ────────────────────────────

Deno.test("INSERT failure after Step 1 success → compensating DELETE of new auth row", async () => {
  const { deps, calls } = makeDeps({
    insertPublicUser: async () => {
      throw new Error("postgres: violates unique constraint");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "internal_error");
  // Raw postgres detail NOT leaked.
  assertEquals(body.error.includes("unique constraint"), false);
  // Compensation: delete the auth row we just created in this run.
  assertEquals(calls.createAuthUser, 1);
  assertEquals(calls.deleteAuthUser, 1);
  assertEquals(calls.deletedAuthIds, ["auth-new-id"]);
});

Deno.test("INSERT failure on RESUME path → NO compensating DELETE (auth pre-existed)", async () => {
  const { deps, calls } = makeDeps({
    findAuthUserByEmail: async () => ({ id: "auth-orphan-id", email: "office@maranatha.test" }),
    findPublicUserByAuthId: async () => null,
    insertPublicUser: async () => {
      throw new Error("postgres: connection reset");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 500);
  // Key invariant: we don't delete an auth row we didn't create this run.
  assertEquals(calls.createAuthUser, 0);
  assertEquals(calls.deleteAuthUser, 0);
});

// ── Insert row contract (DBA c.13321 honored) ──────────────────────────

Deno.test("INSERT row carries declaration_affirmed=true + verification_status='pending' + 30-day deadline", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  const row = calls.insertedRows[0];
  assertEquals(row.declaration_affirmed, true);
  assertEquals(row.verification_status, "pending");
  // 30 days after 2026-05-19T12:00:00Z = 2026-06-18T12:00:00Z.
  assertEquals(row.verification_deadline, "2026-06-18T12:00:00.000Z");
  assertEquals(row.declaration_date, "2026-05-19T12:00:00.000Z");
});

Deno.test("INSERT row carries full_name = 'firstName lastName' single ASCII space (DBA c.13321 Q3)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq({ ...validPayload, firstName: "  Ife  ", lastName: "  James  " }));
  assertEquals(calls.insertedRows[0].full_name, "Ife James");
});

Deno.test("INSERT row honors anonymous=true and defaults to false when absent", async () => {
  const fixtures: Array<{ payload: Record<string, unknown>; expected: boolean }> = [
    { payload: { ...validPayload, anonymous: true }, expected: true },
    { payload: { ...validPayload, anonymous: false }, expected: false },
    { payload: (() => { const p = { ...validPayload } as Record<string, unknown>; delete p.anonymous; return p; })(), expected: false },
  ];
  for (const f of fixtures) {
    const { deps, calls } = makeDeps();
    const h = createHandler(deps);
    await h(jsonReq(f.payload));
    assertEquals(calls.insertedRows[0]?.anonymous, f.expected);
  }
});

Deno.test("INSERT row does NOT include any country column (DBA c.13321 Q2)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq(validPayload));
  const row = calls.insertedRows[0] as unknown as Record<string, unknown>;
  assertEquals("country" in row, false);
});

// ── Success response shape ─────────────────────────────────────────────

Deno.test("success → 200 { userId } with the inserted public.users.id", async () => {
  const { deps } = makeDeps({
    insertPublicUser: async () => ({ id: "expected-public-id" }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.userId, "expected-public-id");
});

// ── Steps 6-7 fire-and-forget ──────────────────────────────────────────

Deno.test("Step 6 — welcome email fired on success (fire-and-forget, NOT awaited)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  assertEquals(res.status, 200);
  await flushMicrotasks();
  assertEquals(calls.sendWelcomeEmail, 1);
  assertEquals(calls.welcomeArgs[0].email, "office@maranatha.test");
  assertEquals(calls.welcomeArgs[0].firstName, "Ife");
});

Deno.test("Step 7 — new-church email ONLY when isNewChurch === true", async () => {
  // isNewChurch = false (default) → no Step 7
  {
    const { deps, calls } = makeDeps();
    const h = createHandler(deps);
    await h(jsonReq(validPayload));
    await flushMicrotasks();
    assertEquals(calls.sendNewChurchEmail, 0);
  }
  // isNewChurch = true → Step 7 fires
  {
    const { deps, calls } = makeDeps();
    const h = createHandler(deps);
    await h(jsonReq({ ...validPayload, isNewChurch: true }));
    await flushMicrotasks();
    assertEquals(calls.sendNewChurchEmail, 1);
    assertEquals(calls.newChurchArgs[0].churchId, FIXED_CHURCH_ID);
    assertEquals(calls.newChurchArgs[0].leaderFullName, "Ife James");
  }
});

Deno.test("Step 6 failure does NOT roll back account (COO c.10131 fire-and-forget)", async () => {
  const { deps, calls } = makeDeps({
    sendWelcomeEmail: async () => {
      throw new Error("Resend 503");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validPayload));
  // 200 — request succeeds despite Resend failure.
  assertEquals(res.status, 200);
  await flushMicrotasks();
  // INSERT still happened.
  assertEquals(calls.insertPublicUser, 1);
  // No compensating delete.
  assertEquals(calls.deleteAuthUser, 0);
  // Warn-level log captured.
  assertEquals(calls.logs.some((l) => l.event === "create_account_welcome_email_failed"), true);
});

// ── Auth Admin createUser failure path ─────────────────────────────────

Deno.test("Step 1 (createAuthUser) failure → 500 internal_error, no INSERT, no delete", async () => {
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
  // Raw auth detail not leaked.
  assertEquals(body.error.includes("invalid email"), false);
  assertEquals(calls.insertPublicUser, 0);
  assertEquals(calls.deleteAuthUser, 0);
});

// ── Auth lookup failure → 500 ──────────────────────────────────────────

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

// ── Email canonicalisation passes through to INSERT ────────────────────

Deno.test("INSERT row carries lowercased trimmed email (DBA / auth canonical compare)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq({ ...validPayload, email: "  OFFICE@Maranatha.TEST  " }));
  assertEquals(calls.insertedRows[0].email, "office@maranatha.test");
});
