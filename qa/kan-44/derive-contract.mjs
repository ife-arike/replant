#!/usr/bin/env node
// Validate qa/kan-44/contract.json against types/auth.ts.
// Drift detector — exits non-zero if the source-of-truth interfaces and the
// committed oracle diverge. Uses Node built-ins only (no npm deps required).
//
// Usage: node derive-contract.mjs --check

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

const errors = [];
function fail(msg) { errors.push(msg); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

const TYPES_PATH = join(REPO_ROOT, "types", "auth.ts");
const CONTRACT_PATH = join(__dirname, "contract.json");

let typesSrc, contract;
try {
  typesSrc = readFileSync(TYPES_PATH, "utf8");
} catch (e) {
  console.error(`FATAL: cannot read ${TYPES_PATH}: ${e.message}`);
  process.exit(2);
}
try {
  contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
} catch (e) {
  console.error(`FATAL: cannot parse ${CONTRACT_PATH}: ${e.message}`);
  process.exit(2);
}

console.log("Checking contract.json drift against types/auth.ts...");

// VerificationStatus enum
const vsMatch = typesSrc.match(/export type VerificationStatus = ([^;]+);/);
if (!vsMatch) fail("types/auth.ts missing 'export type VerificationStatus = ...'");
else {
  const declared = (vsMatch[1].match(/"([^"]+)"/g) || []).map(s => s.replaceAll('"', ""));
  const expected = contract.verification_status_enum;
  if (declared.join("|") !== expected.join("|")) {
    fail(`VerificationStatus enum drift. types: [${declared.join(",")}]  contract: [${expected.join(",")}]`);
  } else ok(`VerificationStatus enum matches: [${declared.join(", ")}]`);
}

// AuthStatusErrorCode enum
const ecMatch = typesSrc.match(/export type AuthStatusErrorCode = ([^;]+);/);
if (!ecMatch) fail("types/auth.ts missing 'export type AuthStatusErrorCode = ...'");
else {
  const declared = (ecMatch[1].match(/"([^"]+)"/g) || []).map(s => s.replaceAll('"', ""));
  const expected = contract.error_code_enum;
  if (declared.join("|") !== expected.join("|")) {
    fail(`AuthStatusErrorCode enum drift. types: [${declared.join(",")}]  contract: [${expected.join(",")}]`);
  } else ok(`AuthStatusErrorCode enum matches: [${declared.join(", ")}]`);
}

// AuthStatusResponse interface keys
const respMatch = typesSrc.match(/export interface AuthStatusResponse \{([^}]+)\}/);
if (!respMatch) fail("types/auth.ts missing 'export interface AuthStatusResponse'");
else {
  const fields = [...respMatch[1].matchAll(/(\w+):\s*([^;]+);/g)].map(m => m[1]).sort();
  const expected = [...contract.responses["200_pending_template"].body_keys_sorted].sort();
  if (fields.join(",") !== expected.join(",")) {
    fail(`AuthStatusResponse field drift. types: [${fields.join(",")}]  contract: [${expected.join(",")}]`);
  } else ok(`AuthStatusResponse field set matches: [${fields.join(", ")}]`);
}

// AuthStatusErrorResponse interface keys
const errMatch = typesSrc.match(/export interface AuthStatusErrorResponse \{([^}]+)\}/);
if (!errMatch) fail("types/auth.ts missing 'export interface AuthStatusErrorResponse'");
else {
  const fields = [...errMatch[1].matchAll(/(\w+):\s*([^;]+);/g)].map(m => m[1]).sort();
  const expected401 = Object.keys(contract.responses["401_unauthorized"].body).sort();
  const expected500 = Object.keys(contract.responses["500_internal_error"].body).sort();
  if (fields.join(",") !== expected401.join(",") || fields.join(",") !== expected500.join(",")) {
    fail(`AuthStatusErrorResponse field drift. types: [${fields.join(",")}]  401-oracle: [${expected401.join(",")}]  500-oracle: [${expected500.join(",")}]`);
  } else ok(`AuthStatusErrorResponse field set matches: [${fields.join(", ")}]`);
}

// 200_active and 200_deactivated body shapes — must be the same null-pattern
for (const k of ["200_active", "200_deactivated"]) {
  const r = contract.responses[k];
  const keys = Object.keys(r.body).sort();
  const expected = ["days_remaining", "verification_deadline", "verification_status"];
  if (keys.join(",") !== expected.join(",")) {
    fail(`${k} body keys drift. got: [${keys.join(",")}]  expected: [${expected.join(",")}]`);
  }
  if (r.body.verification_deadline !== null || r.body.days_remaining !== null) {
    fail(`${k} must have verification_deadline=null and days_remaining=null`);
  }
}
ok("200_active and 200_deactivated body shapes have explicit nulls (no undefined)");

// 401 / 500 fixed strings
const exp401 = "Invalid or expired session";
const exp500 = "Status check failed";
if (contract.responses["401_unauthorized"].body.error !== exp401) fail(`401 error string drift: ${contract.responses["401_unauthorized"].body.error}`);
else ok(`401 body.error matches: "${exp401}"`);
if (contract.responses["500_internal_error"].body.error !== exp500) fail(`500 error string drift: ${contract.responses["500_internal_error"].body.error}`);
else ok(`500 body.error matches: "${exp500}"`);

if (errors.length > 0) {
  console.error("\nDRIFT DETECTED:");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("\nNo drift detected. contract.json is in sync with types/auth.ts.");
process.exit(0);
