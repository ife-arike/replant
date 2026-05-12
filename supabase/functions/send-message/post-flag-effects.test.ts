// KAN-137 — pure-logic tests for classifyMatches.
// No I/O — synthetic TaxonomyCode fixtures only.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyMatches } from "./post-flag-effects.ts";
import { type TaxonomyCode } from "./taxonomy.ts";

const adminT1: TaxonomyCode = { code: "synth_admin_t1", source_prefix: "auto", tier: 1, routing: "admin", patterns: ["X"] };
const adminT2: TaxonomyCode = { code: "synth_admin_t2", source_prefix: "auto", tier: 2, routing: "admin", patterns: ["Y"] };
const adminT3: TaxonomyCode = { code: "synth_admin_t3", source_prefix: "auto", tier: 3, routing: "admin", patterns: ["Z"] };
const pastoralT1: TaxonomyCode = { code: "synth_pastoral_t1", source_prefix: "auto", tier: 1, routing: "pastoral", patterns: ["A"] };
const pastoralT2: TaxonomyCode = { code: "synth_pastoral_t2", source_prefix: "auto", tier: 2, routing: "pastoral", patterns: ["B"] };

Deno.test("classifyMatches: empty input → empty plan, no T1 fire", () => {
  const r = classifyMatches([]);
  assertEquals(r.axes.length, 0);
  assertEquals(r.fire_pastoral_t1_alert, false);
});

Deno.test("classifyMatches: admin-only matches → admin axis only, no T1 fire", () => {
  const r = classifyMatches([adminT1, adminT3]);
  assertEquals(r.axes.length, 1);
  assertEquals(r.axes[0].axis, "admin");
  assertEquals(r.axes[0].tier, 1); // min of {1,3}
  assertEquals(r.axes[0].matched_codes.sort(), ["synth_admin_t1", "synth_admin_t3"]);
  assertEquals(r.fire_pastoral_t1_alert, false);
});

Deno.test("classifyMatches: pastoral-only T2 matches → pastoral axis, NO T1 fire", () => {
  const r = classifyMatches([pastoralT2]);
  assertEquals(r.axes.length, 1);
  assertEquals(r.axes[0].axis, "pastoral");
  assertEquals(r.axes[0].tier, 2);
  assertEquals(r.fire_pastoral_t1_alert, false);
});

Deno.test("classifyMatches: pastoral T1 match → T1 fire flag true (AC-1 trigger)", () => {
  const r = classifyMatches([pastoralT1]);
  assertEquals(r.axes.length, 1);
  assertEquals(r.axes[0].axis, "pastoral");
  assertEquals(r.axes[0].tier, 1);
  assertEquals(r.fire_pastoral_t1_alert, true);
});

Deno.test("classifyMatches: cross-axis (admin T1 + pastoral T1) → BOTH axes + T1 fire (AC-17)", () => {
  // The highest-stakes collision: urgent_safety_request + self_harm_indicator
  // produces moderation_state rows on BOTH axes (per-axis dual-route),
  // AND fires the pastoral T1 alert. Admin queue surfaces via its own
  // axis filter (KAN-112); pastoral queue via its own (KAN-125).
  const r = classifyMatches([adminT1, pastoralT1]);
  assertEquals(r.axes.length, 2);
  assertEquals(r.axes.map((a) => a.axis).sort(), ["admin", "pastoral"]);
  assertEquals(r.fire_pastoral_t1_alert, true);
});

Deno.test("classifyMatches: cross-axis with pastoral T2 only → no T1 fire", () => {
  const r = classifyMatches([adminT1, pastoralT2]);
  assertEquals(r.axes.length, 2);
  // Admin axis has T1, pastoral axis has T2. T1 fire is pastoral-only, so false.
  assertEquals(r.fire_pastoral_t1_alert, false);
});

Deno.test("classifyMatches: per-axis tier is the MIN within that axis", () => {
  const r = classifyMatches([adminT3, adminT1, adminT2, pastoralT2]);
  const admin = r.axes.find((a) => a.axis === "admin")!;
  const pastoral = r.axes.find((a) => a.axis === "pastoral")!;
  assertEquals(admin.tier, 1);     // min of {3,1,2}
  assertEquals(pastoral.tier, 2);  // single T2
});

Deno.test("classifyMatches: axes order is deterministic — admin then pastoral", () => {
  // Stable ordering matters for downstream INSERT order (handler logs
  // admin then pastoral). Even if matches come in pastoral-first, the
  // output axes are admin-first.
  const r = classifyMatches([pastoralT1, adminT2]);
  assertEquals(r.axes[0].axis, "admin");
  assertEquals(r.axes[1].axis, "pastoral");
});

Deno.test("classifyMatches: matched_codes preserves input order within axis", () => {
  const r = classifyMatches([adminT3, adminT1, adminT2]);
  // Iterated in input order through admin filter:
  assertEquals(r.axes[0].matched_codes, ["synth_admin_t3", "synth_admin_t1", "synth_admin_t2"]);
});

Deno.test("classifyMatches: T1 pastoral with multiple matches → still fires once (idempotency at handler layer via Upstash)", () => {
  // Two T1 pastoral codes — fire flag is true once, not twice. Caller
  // calls emit once; per-leader Upstash NX cap further bounds to
  // 1 emit per hour regardless.
  const p1a: TaxonomyCode = { code: "p_t1_a", source_prefix: "auto", tier: 1, routing: "pastoral", patterns: [] };
  const p1b: TaxonomyCode = { code: "p_t1_b", source_prefix: "auto", tier: 1, routing: "pastoral", patterns: [] };
  const r = classifyMatches([p1a, p1b]);
  assertEquals(r.fire_pastoral_t1_alert, true);
  assertEquals(r.axes[0].matched_codes.length, 2);
});
