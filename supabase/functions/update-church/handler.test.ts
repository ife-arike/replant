// KAN-207 update-church — handler tests.
// Mocks deps; covers request shape, auth gate, ownership gate,
// validation routing, update failure → 500, success → canonical body,
// and the underground UG-strip invariant.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import type { UpdateChurchRow } from "./logic.ts";

const VALID_TOKEN = "valid-token";
const AUTH_USER_ID = "11111111-2222-3333-4444-555555555555";
const CHURCH_ID = "00000000-1111-2222-3333-444444444444";

interface Calls {
  getAuthUser: number;
  checkOwnership: number;
  checkOwnershipArgs: { authUserId: string; churchId: string }[];
  updateChurch: number;
  updateArgs: { churchId: string; row: Partial<UpdateChurchRow> }[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = {
    getAuthUser: 0,
    checkOwnership: 0,
    checkOwnershipArgs: [],
    updateChurch: 0,
    updateArgs: [],
    logs: [],
  };
  const getAuthUser = overrides.getAuthUser ?? (async (token: string) => {
    calls.getAuthUser += 1;
    return token === VALID_TOKEN ? { id: AUTH_USER_ID } : null;
  });
  const checkOwnership = overrides.checkOwnership ?? (async (authUserId: string, churchId: string) => {
    calls.checkOwnership += 1;
    calls.checkOwnershipArgs.push({ authUserId, churchId });
    return authUserId === AUTH_USER_ID && churchId === CHURCH_ID;
  });
  const updateChurch = overrides.updateChurch ?? (async (churchId: string, row: Partial<UpdateChurchRow>) => {
    calls.updateChurch += 1;
    calls.updateArgs.push({ churchId, row });
  });
  const log = overrides.log ?? ((level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => {
    calls.logs.push({ level, event, fields });
  });
  return {
    deps: { getAuthUser, checkOwnership, updateChurch, log },
    calls,
  };
}

function jsonReq(body: unknown, opts: { method?: string; auth?: string | null } = {}): Request {
  const { method = "POST", auth = `Bearer ${VALID_TOKEN}` } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth !== null) headers["Authorization"] = auth;
  return new Request("https://example.test/update-church", {
    method,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  church_id: CHURCH_ID,
  name: "Maranatha Fellowship (renamed)",
};

// ── Method / auth gates ──

Deno.test("handler — non-POST methods rejected with 405", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const res = await h(new Request("https://example.test/x", { method }));
    assertEquals(res.status, 405);
  }
  assertEquals(calls.updateChurch, 0);
});

Deno.test("handler — missing Authorization header → 401", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody, { auth: null }));
  assertEquals(res.status, 401);
  assertEquals(calls.getAuthUser, 0);
  assertEquals(calls.updateChurch, 0);
});

Deno.test("handler — invalid JWT (getAuthUser returns null) → 401", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody, { auth: "Bearer bad-token" }));
  assertEquals(res.status, 401);
  assertEquals(calls.getAuthUser, 1);
  assertEquals(calls.checkOwnership, 0);
  assertEquals(calls.updateChurch, 0);
});

// ── Body / validation ──

Deno.test("handler — non-JSON body returns 400", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  assertEquals(calls.updateChurch, 0);
});

Deno.test("handler — missing church_id returns 400", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ name: "Renamed" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.includes("church_id"), true);
  assertEquals(calls.checkOwnership, 0);
  assertEquals(calls.updateChurch, 0);
});

Deno.test("handler — bad enum (type) returns 400", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ church_id: CHURCH_ID, type: "urban" }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error.includes("type must be one of"), true);
  assertEquals(calls.checkOwnership, 0);
  assertEquals(calls.updateChurch, 0);
});

// ── Ownership ──

Deno.test("handler — valid JWT, caller does NOT own church → 403", async () => {
  const { deps, calls } = makeDeps({
    checkOwnership: async (authUserId, churchId) => {
      calls.checkOwnershipArgs.push({ authUserId, churchId });
      return false;
    },
  } as Partial<Deps>);
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 403);
  assertEquals(calls.updateChurch, 0);
  // Forbidden path logs at warn (auditable but not an error).
  const warn = calls.logs.find((l) => l.event === "update_church_forbidden");
  assertEquals(warn?.level, "warn");
});

// ── Success path ──

Deno.test("handler — valid JWT, owns church, valid payload → 200 + updateChurch called with row", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.church_id, CHURCH_ID);
  assertEquals(calls.updateChurch, 1);
  assertEquals(calls.updateArgs[0].churchId, CHURCH_ID);
  assertEquals(calls.updateArgs[0].row.name, "Maranatha Fellowship (renamed)");
});

// ── Underground invariant ──

Deno.test("handler — type='underground' nulls city/lat/lng on the row passed to updateChurch", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({
    church_id: CHURCH_ID,
    type: "underground",
    city: "Tehran",
    lat: 35.6892,
    lng: 51.389,
  }));
  assertEquals(res.status, 200);
  assertEquals(calls.updateChurch, 1);
  const row = calls.updateArgs[0].row;
  assertEquals(row.type, "underground");
  assertEquals(row.city, null);
  assertEquals(row.lat, null);
  assertEquals(row.lng, null);
});

// ── Failure path ──

Deno.test("handler — updateChurch throws → 500", async () => {
  const { deps, calls } = makeDeps({
    updateChurch: async () => {
      throw new Error("db is down");
    },
  } as Partial<Deps>);
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 500);
  const err = calls.logs.find((l) => l.event === "update_church_failed");
  assertEquals(err?.level, "error");
});
