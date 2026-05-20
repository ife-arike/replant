// KAN-13 register-church — logic tests. Pure validator coverage.
//
// Pins the c.10167 contract:
//   - 6 church_type values, 3 rag_status values, all required-fields enforced
//   - Underground type force-strips city / lat / lng on insert
//   - Email basic regex; empty/whitespace-only required strings rejected
//   - state_declaration accepted as ANY non-empty string (no "true" gate)
//   - Optional empty strings collapse to null (no '' rows in DB)
//   - verification_deadline = now + 90 days

import { assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSuccessBody,
  CHURCH_TYPES,
  computeVerificationDeadline,
  parsePayload,
  RAG_STATUSES,
} from "./logic.ts";

// Build a payload from a minimal valid base — tests override specific fields.
function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Maranatha Fellowship",
    type: "main_campus",
    country: "Kenya",
    city: "Nairobi",
    contact_email: "office@maranatha.test",
    rag_status: "green",
    state_declaration: "I affirm the Replant Declaration of Faith.",
    ...overrides,
  };
}

// ── Canonical enums ─────────────────────────────────────────────────────

Deno.test("CHURCH_TYPES is the canonical 6-value set from c.10167", () => {
  assertEquals(CHURCH_TYPES, [
    "main_campus",
    "branch",
    "house_church",
    "ministry",
    "without_walls",
    "underground",
  ]);
});

Deno.test("RAG_STATUSES is green/amber/red, in spec order", () => {
  assertEquals(RAG_STATUSES, ["green", "amber", "red"]);
});

// ── Happy path ─────────────────────────────────────────────────────────

Deno.test("parsePayload — valid main_campus payload returns ok with trimmed row", () => {
  const r = parsePayload(basePayload({ name: "  Riverside Chapel  " }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.row.name, "Riverside Chapel");
  assertEquals(r.row.type, "main_campus");
  assertEquals(r.row.country, "Kenya");
  assertEquals(r.row.city, "Nairobi");
  assertEquals(r.row.rag_status, "green");
});

Deno.test("parsePayload — Underground payload accepted without city/lat/lng", () => {
  const r = parsePayload(basePayload({ type: "underground", city: undefined, rag_status: "red" }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.row.type, "underground");
  assertStrictEquals(r.row.city, null);
  assertStrictEquals(r.row.lat, null);
  assertStrictEquals(r.row.lng, null);
});

Deno.test("parsePayload — Underground FORCE-STRIPS city/lat/lng if FE accidentally sent them (c.10167 invariant)", () => {
  const r = parsePayload(
    basePayload({
      type: "underground",
      city: "Tehran",
      lat: 35.6892,
      lng: 51.389,
    }),
  );
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertStrictEquals(r.row.city, null);
  assertStrictEquals(r.row.lat, null);
  assertStrictEquals(r.row.lng, null);
});

Deno.test("parsePayload — non-Underground keeps lat/lng when supplied", () => {
  const r = parsePayload(basePayload({ lat: 4.5, lng: 36.8 }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertEquals(r.row.lat, 4.5);
  assertEquals(r.row.lng, 36.8);
});

Deno.test("parsePayload — address is accepted on every type (column nullable)", () => {
  const r1 = parsePayload(basePayload({ address: "12 Riverside Drive" }));
  assertEquals(r1.ok, true);
  if (r1.ok) assertEquals(r1.row.address, "12 Riverside Drive");

  // c.10167 does not list address as UG-restricted — pass-through if present.
  const r2 = parsePayload(
    basePayload({ type: "underground", city: undefined, address: "internal: ridge cell A" }),
  );
  assertEquals(r2.ok, true);
  if (r2.ok) assertEquals(r2.row.address, "internal: ridge cell A");
});

Deno.test("parsePayload — optional empty-string fields collapse to null", () => {
  const r = parsePayload(basePayload({ city: "   ", address: "", contact_phone: "" }));
  assertEquals(r.ok, true);
  if (!r.ok) return;
  assertStrictEquals(r.row.city, null);
  assertStrictEquals(r.row.address, null);
  assertStrictEquals(r.row.contact_phone, null);
});

// ── KAN-14 — needs[] handling ──────────────────────────────────────────

Deno.test("parsePayload — needs absent → row.needs is null", () => {
  const r = parsePayload(basePayload());
  assertEquals(r.ok, true);
  if (r.ok) assertStrictEquals(r.row.needs, null);
});

Deno.test("parsePayload — needs null → row.needs is null", () => {
  const r = parsePayload(basePayload({ needs: null }));
  assertEquals(r.ok, true);
  if (r.ok) assertStrictEquals(r.row.needs, null);
});

Deno.test("parsePayload — needs valid array of strings → row carries normalised list", () => {
  const r = parsePayload(basePayload({ needs: ["Manpower", "Prayer", "Resources"] }));
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.row.needs, ["Manpower", "Prayer", "Resources"]);
});

Deno.test("parsePayload — needs entries trimmed + empty-filtered defensively", () => {
  const r = parsePayload(basePayload({ needs: [" manpower ", "", "  ", "prayer"] }));
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.row.needs, ["manpower", "prayer"]);
});

Deno.test("parsePayload — needs all-empty after normalisation → row.needs is null", () => {
  const r = parsePayload(basePayload({ needs: ["", "   ", "\t"] }));
  assertEquals(r.ok, true);
  if (r.ok) assertStrictEquals(r.row.needs, null);
});

Deno.test("parsePayload — needs non-array rejected", () => {
  for (const bad of ["not-an-array", 42, true, { a: 1 }]) {
    const r = parsePayload(basePayload({ needs: bad }));
    assertEquals(r.ok, false, `expected reject for needs=${JSON.stringify(bad)}`);
    if (!r.ok) {
      assertEquals(r.error, "needs must be an array of strings when provided");
    }
  }
});

Deno.test("parsePayload — needs with non-string element rejected", () => {
  const r = parsePayload(basePayload({ needs: ["valid", 42, "also valid"] }));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "needs must be an array of strings when provided");
});

// ── Rejection paths ────────────────────────────────────────────────────

Deno.test("parsePayload — null / non-object body rejected", () => {
  assertEquals(parsePayload(null).ok, false);
  assertEquals(parsePayload(undefined).ok, false);
  assertEquals(parsePayload("string body").ok, false);
  assertEquals(parsePayload(42).ok, false);
});

Deno.test("parsePayload — missing required fields rejected", () => {
  for (const field of ["name", "type", "country", "contact_email", "rag_status", "state_declaration"]) {
    const p = basePayload();
    delete p[field];
    const r = parsePayload(p);
    assertEquals(r.ok, false, `expected reject when ${field} missing`);
    if (!r.ok) assertEquals(r.error.toLowerCase().includes(field) || r.error.toLowerCase().includes("must be one of"), true);
  }
});

Deno.test("parsePayload — empty / whitespace-only required strings rejected", () => {
  for (const field of ["name", "country", "contact_email", "state_declaration"]) {
    assertEquals(parsePayload(basePayload({ [field]: "" })).ok, false, `expected reject when ${field} = ''`);
    assertEquals(parsePayload(basePayload({ [field]: "   " })).ok, false, `expected reject when ${field} = whitespace`);
  }
});

Deno.test("parsePayload — type must be one of the canonical 6", () => {
  for (const valid of CHURCH_TYPES) {
    const r = parsePayload(basePayload({ type: valid, city: valid === "underground" ? undefined : "Nairobi", rag_status: valid === "underground" ? "red" : "green" }));
    assertEquals(r.ok, true, `expected accept for type=${valid}`);
  }
  for (const bad of ["urban", "suburban", "rural", "house", "network_hub", "para_ministry", "MAIN_CAMPUS", ""]) {
    const r = parsePayload(basePayload({ type: bad }));
    assertEquals(r.ok, false, `expected reject for type=${bad}`);
  }
});

Deno.test("parsePayload — rag_status must be green/amber/red", () => {
  for (const valid of RAG_STATUSES) {
    assertEquals(parsePayload(basePayload({ rag_status: valid })).ok, true);
  }
  for (const bad of ["GREEN", "Amber", "yellow", "rouge", ""]) {
    assertEquals(parsePayload(basePayload({ rag_status: bad })).ok, false);
  }
});

Deno.test("parsePayload — contact_email basic regex enforced", () => {
  for (const bad of ["", "no-at-sign", "missing@tld", "@nolocal.test", "two@@signs.test", "spaces in@email.test"]) {
    const r = parsePayload(basePayload({ contact_email: bad }));
    assertEquals(r.ok, false, `expected reject for email=${bad}`);
  }
  for (const good of ["a@b.co", "user.name+tag@example.org", "ç@é.test"]) {
    assertEquals(parsePayload(basePayload({ contact_email: good })).ok, true, `expected accept for email=${good}`);
  }
});

Deno.test("parsePayload — state_declaration accepts ANY non-empty string (no 'true' gate per c.10167)", () => {
  for (const good of [
    "I affirm the Replant Declaration of Faith.",
    "yes",
    "Jesus Christ is Lord and Saviour.",
    "true", // also valid — it's a non-empty string
  ]) {
    assertEquals(parsePayload(basePayload({ state_declaration: good })).ok, true);
  }
  for (const bad of ["", "   ", null, undefined, false, true, 0, 1]) {
    assertEquals(parsePayload(basePayload({ state_declaration: bad })).ok, false, `expected reject for state_declaration=${String(bad)}`);
  }
});

Deno.test("parsePayload — lat/lng must be finite numbers when provided", () => {
  for (const v of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "12.34", true]) {
    assertEquals(parsePayload(basePayload({ lat: v })).ok, false, `expected reject for lat=${String(v)}`);
    assertEquals(parsePayload(basePayload({ lng: v })).ok, false, `expected reject for lng=${String(v)}`);
  }
});

// ── Verification deadline + success body ────────────────────────────────

Deno.test("computeVerificationDeadline — exactly 90 days from now in ISO", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");
  assertEquals(computeVerificationDeadline(now), "2026-08-17T12:00:00.000Z");
});

Deno.test("buildSuccessBody — matches c.10167 KAN-13 → KAN-14 handoff shape", () => {
  const body = buildSuccessBody("11111111-2222-3333-4444-555555555555", "2026-08-17T12:00:00.000Z");
  assertEquals(body.success, true);
  assertEquals(body.church_id, "11111111-2222-3333-4444-555555555555");
  assertEquals(body.verification_status, "pending");
  assertEquals(body.verification_deadline, "2026-08-17T12:00:00.000Z");
  assertEquals(body.message, "Church registered — pending verification");
});
