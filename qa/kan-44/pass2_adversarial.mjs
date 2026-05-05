#!/usr/bin/env node
// Pass 2 — Adversarial tests for KAN-44 auth-status-check.
// Per QA's design (escalation 10932): subtests 2.1 day-boundary sweep,
// 2.2 concurrent Option-B race, 2.3 JWT edge cases, 2.4 DB edge cases,
// 2.5 rapid-fire shape integrity (50–100x), 2.6 forge attempt,
// 2.7 timing P50/P95.
//
// Usage:
//   node pass2_adversarial.mjs <artifacts_dir>
//
// Requires: jsonwebtoken (npm install in qa/kan-44/ before live execution).
// Gracefully degrades when SUPABASE_SERVICE_ROLE_KEY is absent — subtests
// requiring DB writes (2.1, 2.2, 2.4) are skipped and noted in the artifact.
//
// This script does NOT execute in dry-run mode. run.sh --dry-run validates
// presence + node parse only.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const artifactsDir = process.argv[2];
if (!artifactsDir) {
  console.error("ERROR: artifacts dir required as argv[2]");
  process.exit(2);
}
mkdirSync(artifactsDir, { recursive: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FN = `${SUPABASE_URL}/functions/v1/auth-status-check`;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("ERROR: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY required");
  process.exit(2);
}

// Lazy-load jsonwebtoken so structural validation (parse only) doesn't require
// the dep — only live execution does.
async function getJwt() {
  try {
    return (await import("jsonwebtoken")).default;
  } catch (e) {
    console.error("ERROR: jsonwebtoken not installed. Run `cd qa/kan-44 && npm install` first.");
    throw e;
  }
}

async function callFn(jwt, label) {
  const t0 = performance.now();
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
  });
  const elapsed = performance.now() - t0;
  const body = await res.text();
  return { label, status: res.status, body, elapsed_ms: Math.round(elapsed) };
}

async function execSql(query) {
  if (!SERVICE_ROLE) return { skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY not set" };
  // PostgREST doesn't accept arbitrary SQL — coordinated DB writes for adversarial
  // setup require either pg connection or a deployed RPC. QA / DBA pair this
  // subtest with execute_sql via their MCP seat; pass2 records intent + skip flag.
  return { skipped: true, reason: "Arbitrary SQL not exposed via PostgREST; coordinate via MCP execute_sql" };
}

const results = {};

// 2.1 day-boundary sweep — would move verification_deadline across now()-1ms /
//     now() / now()+1ms / UTC midnight, calling between each move.
async function subtest_2_1() {
  const jwt = process.env.KAN44_JWT_PENDING_EDGE_1;
  if (!jwt) return { status: "SKIPPED", reason: "KAN44_JWT_PENDING_EDGE_1 not provided" };
  const sqlAvailable = await execSql("/* probe */");
  if (sqlAvailable.skipped) {
    return { status: "SKIPPED", reason: `Coordinate with DBA via MCP: ${sqlAvailable.reason}` };
  }
  // Live path: alternate UPDATE ... SET verification_deadline = ... + call_fn ...
  return { status: "STUB", note: "Live path requires MCP-coordinated SQL setup" };
}

// 2.2 concurrent Option-B race — Promise.all parallel calls, expect exactly one
//     audit_log row to be written (idempotency under concurrency).
async function subtest_2_2() {
  const jwt = process.env.KAN44_JWT_PENDING_EDGE_2;
  if (!jwt) return { status: "SKIPPED", reason: "KAN44_JWT_PENDING_EDGE_2 not provided" };
  const N = 5;
  const responses = await Promise.all(Array.from({ length: N }, () => callFn(jwt, "race")));
  const allDeactivated = responses.every(r => {
    try { return JSON.parse(r.body).verification_status === "deactivated"; } catch { return false; }
  });
  return {
    status: allDeactivated ? "PASS-CLIENT-SIDE" : "FAIL",
    note: "Audit-row uniqueness under concurrency must be verified separately by QA via MCP execute_sql (count audit_log rows for this user_id; expect 1)",
    parallel_calls: N,
    all_returned_deactivated: allDeactivated,
    sample_response: responses[0],
  };
}

// 2.3 JWT edge cases — locally construct invalid JWTs (signed with garbage keys).
//     Expectation: platform-level verify_jwt rejection (HTTP 401).
async function subtest_2_3() {
  const jwt = await getJwt();
  const garbageKey = "not-the-real-jwt-secret-just-for-rejection-tests";
  const cases = [
    { label: "expired",     payload: { sub: "fake", exp: Math.floor(Date.now() / 1000) - 60 } },
    { label: "no-sub",      payload: { exp: Math.floor(Date.now() / 1000) + 3600 } },
    { label: "future-iat",  payload: { sub: "fake", iat: Math.floor(Date.now() / 1000) + 3600, exp: Math.floor(Date.now() / 1000) + 7200 } },
  ];
  const out = [];
  for (const c of cases) {
    const token = jwt.sign(c.payload, garbageKey, { algorithm: "HS256" });
    const r = await callFn(token, c.label);
    out.push({ ...r, expected: 401, pass: r.status === 401 });
  }
  return { status: out.every(r => r.pass) ? "PASS" : "FAIL", cases: out };
}

// 2.4 DB edge cases — synthetic NULL church_id / missing public.users / deleted
//     church. Coordinated SQL via MCP from QA's seat.
async function subtest_2_4() {
  const sqlAvailable = await execSql("/* probe */");
  return {
    status: "SKIPPED",
    reason: sqlAvailable.skipped ? sqlAvailable.reason : "Out-of-scope for client-only adversarial pass",
    note: "QA/DBA coordinate via MCP execute_sql — set up synthetic state, call function, assert response, restore state",
  };
}

// 2.5 rapid-fire shape integrity — 50–100x loop across status types,
//     byte-compare each response body against contract.json oracle.
async function subtest_2_5() {
  const contract = JSON.parse(readFileSync(new URL("./contract.json", import.meta.url), "utf8"));
  const tokens = [
    { jwt: process.env.KAN44_JWT_ACTIVE,            oracle: "200_active" },
    { jwt: process.env.KAN44_JWT_PENDING_FUTURE,    oracle: "200_pending_template" },
    { jwt: process.env.KAN44_JWT_DEACTIVATED_CRON,  oracle: "200_deactivated" },
  ].filter(t => t.jwt);
  if (tokens.length === 0) {
    return { status: "SKIPPED", reason: "No JWTs provided" };
  }
  const N = 50;
  const calls = [];
  for (let i = 0; i < N; i++) {
    const t = tokens[i % tokens.length];
    calls.push({ ...await callFn(t.jwt, t.oracle), oracle: t.oracle });
  }
  let matched = 0;
  for (const c of calls) {
    let body;
    try { body = JSON.parse(c.body); } catch { continue; }
    const oracle = contract.responses[c.oracle];
    if (oracle.body) {
      if (JSON.stringify(body) === JSON.stringify(oracle.body)) matched++;
    } else {
      // pending_template — looser check
      const keys = Object.keys(body).sort().join(",");
      const expected = oracle.body_keys_sorted.slice().sort().join(",");
      if (keys === expected && body.verification_status === "pending") matched++;
    }
  }
  return { status: matched === N ? "PASS" : "FAIL", calls: N, matched };
}

// 2.6 forge attempt — locally mint super_admin: true JWT signed with random key.
//     Expectation: platform-level rejection (401), claim NEVER reaches handler.
async function subtest_2_6() {
  const jwt = await getJwt();
  const forgedKey = "totally-not-the-real-secret";
  const token = jwt.sign(
    { sub: "00000000-0000-0000-0000-000000000000", super_admin: true, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 },
    forgedKey,
    { algorithm: "HS256" },
  );
  const r = await callFn(token, "forge-super_admin");
  return {
    status: r.status === 401 ? "PASS" : "FAIL-CRITICAL",
    response: r,
    expected: 401,
    note: "Forged super_admin: true JWT must be rejected at the platform JWT-verify gateway BEFORE reaching the handler — otherwise the super_admin path could be triggered with a forged claim",
  };
}

// 2.7 timing — P50/P95 across all formal TCs (live calls captured here for
//     sample). Production timing should be re-captured by QA in the live run.
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

async function subtest_2_7() {
  const jwts = [process.env.KAN44_JWT_ACTIVE, process.env.KAN44_JWT_PENDING_FUTURE, process.env.KAN44_JWT_DEACTIVATED_CRON].filter(Boolean);
  if (jwts.length === 0) return { status: "SKIPPED", reason: "No JWTs provided" };
  const samples = [];
  for (let i = 0; i < 30; i++) {
    const r = await callFn(jwts[i % jwts.length], "timing");
    samples.push(r.elapsed_ms);
  }
  return {
    status: "PASS",
    samples: samples.length,
    p50_ms: percentile(samples, 0.5),
    p95_ms: percentile(samples, 0.95),
  };
}

const subtests = [
  ["2.1 day-boundary sweep", subtest_2_1],
  ["2.2 concurrent Option-B race", subtest_2_2],
  ["2.3 JWT edge cases", subtest_2_3],
  ["2.4 DB edge cases", subtest_2_4],
  ["2.5 rapid-fire shape integrity", subtest_2_5],
  ["2.6 forge attempt", subtest_2_6],
  ["2.7 timing", subtest_2_7],
];

console.log(`Pass 2 — adversarial`);
console.log(`  Artifacts: ${artifactsDir}`);
console.log(`  Function:  ${FN}`);
console.log(`  Started:   ${new Date().toISOString()}`);
for (const [name, fn] of subtests) {
  try {
    results[name] = await fn();
    console.log(`  → ${name}: ${results[name].status ?? "—"}`);
  } catch (e) {
    results[name] = { status: "ERROR", error: e.message };
    console.error(`  → ${name}: ERROR — ${e.message}`);
  }
}
console.log(`  Finished:  ${new Date().toISOString()}`);
writeFileSync(join(artifactsDir, "pass2-results.json"), JSON.stringify(results, null, 2));
