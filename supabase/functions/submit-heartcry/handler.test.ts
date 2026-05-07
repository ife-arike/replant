// Drift-guard tests for submit-heartcry safe-log envelope — KAN-66 ITERATION 2
// per SEC item-4(c) ruling.
//
// Each test invokes one error path (or the success path) with a fully-mocked
// Deps, captures every emitted log line, and asserts:
//   (a) operation_id is present and non-empty
//   (b) NO log line contains any of the forbidden fields:
//       content, severity, request_type, church_id, user_id, auth_uid
//
// A drift-guard self-test (`assertNoForbiddenFields` rejects an injected
// forbidden field) confirms the assertion itself works — fail-mode demo.
//
// Run: `deno test --no-check handler.test.ts`

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps, type LogFields } from "./handler.ts";

interface CapturedLog {
  level: "info" | "warn" | "error";
  event: string;
  fields: LogFields;
}

type MockOverrides = Partial<Deps>;

function makeMockDeps(overrides: MockOverrides = {}): {
  deps: Deps;
  logs: CapturedLog[];
} {
  const logs: CapturedLog[] = [];
  const baseDeps: Deps = {
    validateJwt: async (_h) => ({ authUid: "auth-uid-1", role: "authenticated" }),
    fetchSubmitter: async (_a) => ({
      id: "submitter-uuid",
      church_id: "church-uuid",
      verification_status: "verified",
    }),
    encryptContent: async (_p) => "ciphertext-bytes",
    insertHeartcry: async (_r) => {},
    resolveTriageLeadId: async () => "triage-lead-uuid",
    resolveTriageLeadEmail: async () => "triage@example.test",
    sendTriageEmail: async (_t) => ({ ok: true, resend_id: "re_test_xxx" }),
    logEmail: async (_r) => ({ ok: true }),
    log: (level, event, fields) => {
      logs.push({ level, event, fields });
    },
    newOperationId: () => "test-op-id-fixed",
  };
  return { deps: { ...baseDeps, ...overrides }, logs };
}

// Forbidden fields per SEC item-4 ruling. ANY of these in a safe-log envelope
// is a drift; the assertion below fails the test if found.
const FORBIDDEN_FIELDS = [
  "content",
  "severity",
  "request_type",
  "church_id",
  "user_id",
  "auth_uid",
] as const;

function assertNoForbiddenFields(logs: CapturedLog[]): void {
  for (const l of logs) {
    for (const f of FORBIDDEN_FIELDS) {
      assert(
        !Object.prototype.hasOwnProperty.call(l.fields, f),
        `Forbidden field "${f}" present in log envelope "${l.event}": ${
          JSON.stringify(l.fields)
        }`,
      );
    }
  }
}

function assertOperationIdPresent(logs: CapturedLog[]): void {
  assert(logs.length > 0, "Expected at least one log line — none emitted");
  for (const l of logs) {
    const opId = (l.fields as Record<string, unknown>).operation_id;
    assert(
      typeof opId === "string" && opId.length > 0,
      `Log "${l.event}" missing operation_id: ${JSON.stringify(l.fields)}`,
    );
  }
}

function makeRequest(
  method: string,
  body: string | null,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/submit-heartcry", {
    method,
    headers: new Headers({ "Content-Type": "application/json", ...headers }),
    body,
  });
}

const validBody = JSON.stringify({
  content: "smoke",
  severity: "informational",
  request_type: null,
});
const validAuth = "Bearer aaa.bbb.ccc";

// ─── 405 METHOD_NOT_ALLOWED ──────────────────────────────────────────────────
Deno.test("405 — non-POST emits log with operation_id, no forbidden fields", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest("GET", null));
  assertEquals(res.status, 405);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

// ─── 401 UNAUTHORIZED ────────────────────────────────────────────────────────
Deno.test("401 — missing Authorization header", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest("POST", validBody));
  assertEquals(res.status, 401);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("401 — malformed Authorization (no Bearer prefix)", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: "Basic xxx" }),
  );
  assertEquals(res.status, 401);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("401 — empty bearer token", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: "Bearer " }),
  );
  assertEquals(res.status, 401);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("401 — validateJwt returns null", async () => {
  const { deps, logs } = makeMockDeps({
    validateJwt: async (_h) => null,
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 401);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("401 — anon role on well-formed JWT", async () => {
  const { deps, logs } = makeMockDeps({
    validateJwt: async (_h) => ({ authUid: "anon-uid", role: "anon" }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 401);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

// ─── 400 VALIDATION_FAILED ───────────────────────────────────────────────────
Deno.test("400 — invalid JSON body", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", "not json{", { Authorization: validAuth }),
  );
  assertEquals(res.status, 400);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("400 — schema validation failure (bad severity)", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest(
      "POST",
      JSON.stringify({ content: "x", severity: "bogus" }),
      { Authorization: validAuth },
    ),
  );
  assertEquals(res.status, 400);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

// ─── 403 FORBIDDEN_NOT_VERIFIED ──────────────────────────────────────────────
Deno.test("403 — submitter not found (no users row)", async () => {
  const { deps, logs } = makeMockDeps({
    fetchSubmitter: async (_a) => null,
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 403);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("403 — submitter is pending", async () => {
  const { deps, logs } = makeMockDeps({
    fetchSubmitter: async (_a) => ({
      id: "submitter-uuid",
      church_id: "church-uuid",
      verification_status: "pending",
    }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 403);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("403 — submitter is deactivated", async () => {
  const { deps, logs } = makeMockDeps({
    fetchSubmitter: async (_a) => ({
      id: "submitter-uuid",
      church_id: "church-uuid",
      verification_status: "deactivated",
    }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 403);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

// ─── 5xx INTERNAL_ERROR ──────────────────────────────────────────────────────
Deno.test("500 — encryptContent throws", async () => {
  const { deps, logs } = makeMockDeps({
    encryptContent: async (_p) => {
      throw new Error("boom");
    },
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 500);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("500 — insertHeartcry throws", async () => {
  const { deps, logs } = makeMockDeps({
    insertHeartcry: async (_r) => {
      throw new Error("constraint violation");
    },
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 500);
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

// ─── 200 OK ──────────────────────────────────────────────────────────────────
Deno.test("200 — success path emits .ok log with operation_id + resend_ok, no forbidden fields", async () => {
  const { deps, logs } = makeMockDeps();
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
  const okLog = logs.find((l) => l.event === "submit-heartcry.ok");
  assert(okLog, "Expected a submit-heartcry.ok log line");
  assertEquals(okLog!.fields.resend_ok, true);
});

Deno.test("200 — email_log failure routes through centralized warn log (no inline console.warn)", async () => {
  const { deps, logs } = makeMockDeps({
    logEmail: async (_r) => ({ ok: false, error: "duplicate key" }),
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 200); // submission succeeds even when email_log fails
  const events = logs.map((l) => l.event);
  assert(
    events.includes("submit-heartcry.email_log_failed"),
    `Expected email_log_failed warn in events: ${events.join(", ")}`,
  );
  assert(events.includes("submit-heartcry.ok"));
  assertOperationIdPresent(logs);
  assertNoForbiddenFields(logs);
});

Deno.test("200 — Resend send throws but submission still succeeds (fire-and-forget)", async () => {
  const { deps, logs } = makeMockDeps({
    sendTriageEmail: async (_t) => {
      throw new Error("network");
    },
  });
  const handler = createHandler(deps);
  const res = await handler(
    makeRequest("POST", validBody, { Authorization: validAuth }),
  );
  assertEquals(res.status, 200);
  const okLog = logs.find((l) => l.event === "submit-heartcry.ok");
  assert(okLog);
  assertEquals(okLog!.fields.resend_ok, false);
  assertNoForbiddenFields(logs);
});

// ─── DRIFT-GUARD SELF-TEST ───────────────────────────────────────────────────
// Demonstrates that assertNoForbiddenFields actually catches forbidden fields.
// If a future edit accidentally weakens the helper (e.g. removes "user_id"
// from FORBIDDEN_FIELDS), this self-test fails — the helper is broken.
Deno.test("drift-guard self-test — assertNoForbiddenFields catches injected user_id", () => {
  const badLogs: CapturedLog[] = [{
    level: "info",
    event: "demo.injected_user_id",
    // Deliberately injecting a forbidden field via cast — this is what a
    // future drift would look like (a developer adds `user_id` to a log).
    fields: { operation_id: "test", user_id: "leak-1234" } as unknown as LogFields,
  }];
  let threw: Error | null = null;
  try {
    assertNoForbiddenFields(badLogs);
  } catch (e) {
    threw = e as Error;
  }
  assert(
    threw !== null,
    "Drift-guard FAILED to catch user_id field — the helper is broken",
  );
  assert(
    threw!.message.includes("user_id"),
    `Drift-guard caught a violation but didn't mention user_id: ${threw!.message}`,
  );
});

Deno.test("drift-guard self-test — assertNoForbiddenFields catches injected content", () => {
  const badLogs: CapturedLog[] = [{
    level: "info",
    event: "demo.injected_content",
    fields: {
      operation_id: "test",
      content: "this would be the heartcry plaintext",
    } as unknown as LogFields,
  }];
  let threw: Error | null = null;
  try {
    assertNoForbiddenFields(badLogs);
  } catch (e) {
    threw = e as Error;
  }
  assert(threw !== null);
  assert(threw!.message.includes("content"));
});
