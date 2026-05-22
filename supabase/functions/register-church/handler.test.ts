// KAN-13 register-church — handler tests. Mocked deps; covers request shape,
// validation routing, insert failure → 500, success → canonical body.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import type { InsertChurchRow } from "./logic.ts";

const FIXED_NOW = new Date("2026-05-19T12:00:00.000Z");

interface Calls {
  insertChurch: number;
  insertArgs: { row: InsertChurchRow; verificationDeadline: string }[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = { insertChurch: 0, insertArgs: [], logs: [] };
  const insertChurch = overrides.insertChurch ?? (async (row: InsertChurchRow, vd: string) => {
    calls.insertChurch += 1;
    calls.insertArgs.push({ row, verificationDeadline: vd });
    return { id: "00000000-1111-2222-3333-444444444444" };
  });
  const now = overrides.now ?? (() => FIXED_NOW);
  const log = overrides.log ?? ((level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => {
    calls.logs.push({ level, event, fields });
  });
  return {
    deps: { insertChurch, now, log },
    calls,
  };
}

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/register-church", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// KAN-13 v2 — contact_name now required at the BE.
const validBody = {
  name: "Maranatha Fellowship",
  type: "main_campus",
  country: "Kenya",
  city: "Nairobi",
  contact_name: "Ife James",
  contact_email: "office@maranatha.test",
  rag_status: "green",
  state_declaration: "I affirm the Replant Declaration of Faith.",
};

// ── Method / body shape ────────────────────────────────────────────────

Deno.test("handler — non-POST methods rejected with 405", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const res = await h(new Request("https://example.test/x", { method }));
    assertEquals(res.status, 405);
  }
  assertEquals(calls.insertChurch, 0);
});

Deno.test("handler — non-JSON body returns 400 'Request body must be valid JSON'", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Request body must be valid JSON");
  assertEquals(calls.insertChurch, 0);
});

// ── Validation routing ────────────────────────────────────────────────

Deno.test("handler — invalid payload returns 400 with logic.ts error string (no insert)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ ...validBody, type: "urban" })); // bad enum
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(typeof body.error, "string");
  assertEquals(body.error.includes("type must be one of"), true);
  assertEquals(calls.insertChurch, 0);
});

// ── Success path ──────────────────────────────────────────────────────

Deno.test("handler — valid payload inserts and returns canonical c.10167 body", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.church_id, "00000000-1111-2222-3333-444444444444");
  assertEquals(body.verification_status, "pending");
  // 90 days from FIXED_NOW (2026-05-19T12:00:00Z) → 2026-08-17T12:00:00Z
  assertEquals(body.verification_deadline, "2026-08-17T12:00:00.000Z");
  assertEquals(body.message, "Church registered — pending verification");

  assertEquals(calls.insertChurch, 1);
  assertEquals(calls.insertArgs[0].row.type, "main_campus");
  assertEquals(calls.insertArgs[0].verificationDeadline, "2026-08-17T12:00:00.000Z");
});

Deno.test("handler — Underground payload force-strips city/lat/lng before insert", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  // FE accidentally leaks city/lat/lng on UG — handler must NOT write them.
  const res = await h(jsonReq({
    ...validBody,
    type: "underground",
    rag_status: "red",
    city: "Tehran",
    lat: 35.69,
    lng: 51.38,
  }));
  assertEquals(res.status, 200);
  assertEquals(calls.insertChurch, 1);
  const written = calls.insertArgs[0].row;
  assertEquals(written.type, "underground");
  assertEquals(written.city, null);
  assertEquals(written.lat, null);
  assertEquals(written.lng, null);
});

// ── Insert failure → 500, never raw Postgres error ──────────────────

Deno.test("handler — insertChurch throw maps to 500 (no Postgres details leaked)", async () => {
  const { deps, calls } = makeDeps({
    insertChurch: async () => {
      throw new Error("duplicate key value violates unique constraint \"churches_pkey\"");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq(validBody));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Church registration failed");
  // Confirm the raw Postgres message did NOT travel to the response.
  assertEquals(body.error.includes("duplicate key"), false);
  // Structured log captured the cause for ops.
  assertEquals(calls.logs.some((l) => l.event === "register_church_insert_failed"), true);
});
