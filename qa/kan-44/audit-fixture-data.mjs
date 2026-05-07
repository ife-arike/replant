#!/usr/bin/env node
// Fixture-data audit (per SEC 10933). For each [TEST-KAN44]-* user, verify:
//   1. linked church name + verification_status + church.type, AND count of OTHER
//      (non-test) users in that church (must be 0)
//   2. heartcries authored / linked (must be 0)
//   3. messages where they're sender or receiver (must be 0)
//   4. network_updates in their church (must be 0)
//   5. prayer_requests authored / linked (must be 0)
//   6. email_log entries (must be 0)
//   7. announcements authored (must be 0)
//   8. conversations they participate in (must be 0)
//   9. underground / persecution-tag association — count of [TEST-KAN44] churches
//      with type='underground' (must be 0; underground is the persecution flag)
//
// Uses PostgREST when SUPABASE_SERVICE_ROLE_KEY is set. When absent, prints WARN
// and exits 0 with a SKIPPED status — operator should run the equivalent SQL via
// MCP execute_sql from their seat.
//
// Usage:  node audit-fixture-data.mjs [<artifacts_dir>]
// Exits non-zero if any check returns non-zero (HALT for SEC + Ife).

import { writeFileSync, mkdirSync } from "node:fs";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TEST_PREFIX_LIKE = "%5BTEST-KAN44%5D%25"; // [TEST-KAN44]% URL-encoded
const TEST_PREFIX = "[TEST-KAN44]";
const out = process.argv[2] || null;

if (!URL || !SERVICE_ROLE) {
  console.log("FIXTURE AUDIT — SKIPPED");
  if (!URL)          console.log("  Reason: EXPO_PUBLIC_SUPABASE_URL not set.");
  if (!SERVICE_ROLE) console.log("  Reason: SUPABASE_SERVICE_ROLE_KEY not set.");
  console.log("  Operator: run the equivalent execute_sql via MCP from your seat,");
  console.log("            OR export both env vars and re-run.");
  console.log("  Allowed in dry-run; LIVE execution must have audit results.");
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/audit-fixture-data.json`, JSON.stringify({ status: "SKIPPED", reason: !URL ? "missing EXPO_PUBLIC_SUPABASE_URL" : "missing SUPABASE_SERVICE_ROLE_KEY" }, null, 2)); }
  process.exit(0);
}

const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

async function pgGet(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

async function pgCount(table, filterQS) {
  const res = await fetch(`${URL}/rest/v1/${table}?${filterQS}`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact" },
  });
  const range = res.headers.get("Content-Range") || "0-0/0";
  const total = parseInt(range.split("/").pop() || "0", 10);
  return Number.isFinite(total) ? total : 0;
}

console.log(`FIXTURE AUDIT — running against ${URL}`);

// 1. linked-church + other-user check
const linkedUsers = await pgGet(
  `users?full_name=like.${TEST_PREFIX_LIKE}&select=id,full_name,church_id,church:churches(id,name,type,verification_status,rag_status)`,
);

const userIds = linkedUsers.map(u => u.id);
const churchIds = [...new Set(linkedUsers.map(u => u.church_id).filter(Boolean))];

const linkedChurchTable = [];
let nonTestUsersInChurches = 0;
let undergroundChurches = 0;
for (const u of linkedUsers) {
  const c = Array.isArray(u.church) ? u.church[0] : u.church;
  let otherUsers = 0;
  if (c) {
    const totalInChurch = await pgCount("users", `church_id=eq.${c.id}`);
    const testInChurch = await pgCount("users", `church_id=eq.${c.id}&full_name=like.${TEST_PREFIX_LIKE}`);
    otherUsers = totalInChurch - testInChurch;
    nonTestUsersInChurches += otherUsers;
    if (c.type === "underground") undergroundChurches++;
  }
  linkedChurchTable.push({
    full_name: u.full_name,
    user_id: u.id,
    church_id: c?.id ?? null,
    church_name: c?.name ?? null,
    church_type: c?.type ?? null,
    verification_status: c?.verification_status ?? null,
    rag_status: c?.rag_status ?? null,
    other_users_in_church: otherUsers,
  });
}

// 2-8. counts of sensitive tables
const userIdsCsv = userIds.join(",");
const churchIdsCsv = churchIds.join(",");

const counts = {
  heartcries_user:           userIds.length    ? await pgCount("heartcries",    `user_id=in.(${userIdsCsv})`)    : 0,
  heartcries_church:         churchIds.length  ? await pgCount("heartcries",    `church_id=in.(${churchIdsCsv})`) : 0,
  messages_sender:           userIds.length    ? await pgCount("messages",      `sender_id=in.(${userIdsCsv})`)   : 0,
  messages_receiver:         userIds.length    ? await pgCount("messages",      `receiver_id=in.(${userIdsCsv})`) : 0,
  network_updates_church:    churchIds.length  ? await pgCount("network_updates", `church_id=in.(${churchIdsCsv})`) : 0,
  prayer_requests_user:      userIds.length    ? await pgCount("prayer_requests", `user_id=in.(${userIdsCsv})`)    : 0,
  prayer_requests_church:    churchIds.length  ? await pgCount("prayer_requests", `church_id=in.(${churchIdsCsv})`) : 0,
  email_log_user:            userIds.length    ? await pgCount("email_log",     `user_id=in.(${userIdsCsv})`)     : 0,
  announcements_authored:    userIds.length    ? await pgCount("announcements", `author_id=in.(${userIdsCsv})`)   : 0,
  conversations_a:           userIds.length    ? await pgCount("conversations", `participant_a=in.(${userIdsCsv})`) : 0,
  conversations_b:           userIds.length    ? await pgCount("conversations", `participant_b=in.(${userIdsCsv})`) : 0,
};

const results = {
  generated_at: new Date().toISOString(),
  fixture_count: linkedUsers.length,
  linked_churches: linkedChurchTable,
  sensitive_data_counts: counts,
  underground_churches_count: undergroundChurches,
  non_test_users_in_test_churches: nonTestUsersInChurches,
};

console.log("\nLinked churches per fixture:");
for (const r of linkedChurchTable) {
  console.log(`  ${r.full_name.padEnd(36)} → church.type=${r.church_type}  verification_status=${r.verification_status}  other_users=${r.other_users_in_church}`);
}
console.log("\nSensitive-data association counts (must all be 0):");
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(28)} = ${v}`);
}
console.log(`\n  underground_churches_count       = ${undergroundChurches}`);
console.log(`  non_test_users_in_test_churches  = ${nonTestUsersInChurches}`);

const failedKeys = Object.entries(counts).filter(([_, v]) => v > 0).map(([k]) => k);
if (undergroundChurches > 0) failedKeys.push("underground_churches_count");
if (nonTestUsersInChurches > 0) failedKeys.push("non_test_users_in_test_churches");

if (out) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/audit-fixture-data.json`, JSON.stringify({ status: failedKeys.length === 0 ? "PASS" : "HOLD", failed_keys: failedKeys, results }, null, 2)); }

if (failedKeys.length > 0) {
  console.log(`\nHOLD — non-zero counts: ${failedKeys.join(", ")}`);
  console.log("Per SEC 10933: HALT for SEC + Ife before live execution.");
  process.exit(1);
}

console.log("\nALL ZERO — fixture-data audit clean.");
process.exit(0);
