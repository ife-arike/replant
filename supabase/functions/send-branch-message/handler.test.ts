// send-branch-message handler tests — KAN-214.
//
// Run: deno test --allow-env supabase/functions/send-branch-message/handler.test.ts
//
// SECURITY POSTURE coverage:
//   - 405 on non-POST
//   - 401 paths (missing auth, invalid JWT, anon role)
//   - 400 paths (bad payload, oversize content)
//   - 403 paths (not joined / not verified)
//   - 200 happy path (verifies INSERT args)
//   - DELIVER-ALWAYS: flagged content still delivers (200 + flagged=true in INSERT)
//   - SAFE-LOG: success log line does NOT contain content text

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import { type Taxonomy } from "./taxonomy.ts";

// ─── test fixtures ────────────────────────────────────────────────
const VALID_SENDER_ID = "11111111-1111-1111-1111-111111111111";
const VALID_BRANCH_ID = "22222222-2222-2222-2222-222222222222";
const VALID_AUTH_UID = "33333333-3333-3333-3333-333333333333";

interface RecordedInsert {
  senderId: string;
  branchId: string;
  content: string;
  flagged: boolean;
  flag_reason: string | null;
}

interface LogLine {
  level: "info" | "warn" | "error";
  event: string;
  fields: Record<string, unknown>;
}

function makeDeps(overrides: Partial<Deps> = {}): {
  deps: Deps;
  inserts: RecordedInsert[];
  logs: LogLine[];
} {
  const inserts: RecordedInsert[] = [];
  const logs: LogLine[] = [];

  // Synthetic taxonomy: one `auto` admin T1 code with one pattern.
  // Used by the flagged-delivery test only; other tests pass a null
  // taxonomy from getTaxonomy() so the matcher folds to no-matches.
  const baseDeps: Deps = {
    validateJwt: async () => ({ authUid: VALID_AUTH_UID, role: "authenticated" }),
    fetchSender: async () => ({
      id: VALID_SENDER_ID,
      verification_status: "verified",
    }),
    isCallerJoinedMember: async () => true,
    insertBranchMessage: async (input) => {
      inserts.push(input);
      return { id: "msg-" + (inserts.length) };
    },
    getTaxonomy: () => null,
    log: (level, event, fields) => {
      logs.push({ level, event, fields });
    },
  };

  return { deps: { ...baseDeps, ...overrides }, inserts, logs };
}

function makeRequest(opts: {
  method?: string;
  authHeader?: string | null;
  body?: unknown;
  bodyRaw?: string;
} = {}): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = opts.authHeader === undefined
    ? `Bearer test-token-${VALID_AUTH_UID}`
    : opts.authHeader;
  if (authHeader !== null) headers["Authorization"] = authHeader;

  const body = opts.bodyRaw !== undefined
    ? opts.bodyRaw
    : (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);

  return new Request("https://example.test/send-branch-message", {
    method: opts.method ?? "POST",
    headers,
    body,
  });
}

// ── 1. Non-POST → 405 ─────────────────────────────────────────────
Deno.test("405 on non-POST", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.code, "METHOD_NOT_ALLOWED");
});

// ── 2. Missing auth → 401 ─────────────────────────────────────────
Deno.test("401 on missing Authorization header", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({ authHeader: null }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "UNAUTHORIZED");
});

// ── 3. Invalid JWT → 401 (validateJwt returns null) ───────────────
Deno.test("401 on invalid JWT (validateJwt returns null)", async () => {
  const { deps } = makeDeps({
    validateJwt: async () => null,
  });
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: "hello" },
  }));
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "UNAUTHORIZED");
});

// ── 3b. anon role → 401 (function-level reject) ───────────────────
Deno.test("401 on anon role token", async () => {
  const { deps } = makeDeps({
    validateJwt: async () => ({ authUid: VALID_AUTH_UID, role: "anon" }),
  });
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: "hello" },
  }));
  assertEquals(res.status, 401);
});

// ── 4. Caller not a joined member → 403 ───────────────────────────
Deno.test("403 when caller is not a joined branch member", async () => {
  const { deps } = makeDeps({
    isCallerJoinedMember: async () => false,
  });
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: "hello" },
  }));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.code, "FORBIDDEN");
});

// ── 4b. Unverified sender → 403 ───────────────────────────────────
Deno.test("403 when sender is not verified", async () => {
  const { deps } = makeDeps({
    fetchSender: async () => ({
      id: VALID_SENDER_ID,
      verification_status: "pending",
    }),
  });
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: "hello" },
  }));
  assertEquals(res.status, 403);
});

// ── 5. Bad payload (missing branch_id) → 400 ──────────────────────
Deno.test("400 on missing branch_id", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { content: "hello with no branch_id" },
  }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "validation_failed");
  assertStringIncludes(body.detail, "branch_id");
});

// ── 5b. Bad payload (non-UUID branch_id) → 400 ────────────────────
Deno.test("400 on non-UUID branch_id", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: "not-a-uuid", content: "hello" },
  }));
  assertEquals(res.status, 400);
});

// ── 5c. Bad payload (empty content after trim) → 400 ──────────────
Deno.test("400 on empty content (whitespace-only)", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: "   \n\t  " },
  }));
  assertEquals(res.status, 400);
});

// ── 6. Content over 2000 chars → 400 ──────────────────────────────
Deno.test("400 on content over MAX_CONTENT_LENGTH (2000 chars)", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const oversize = "a".repeat(2001);
  const res = await handler(makeRequest({
    body: { branch_id: VALID_BRANCH_ID, content: oversize },
  }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.detail, "2000");
});

// ── 7. Valid send → 200 + correct INSERT args ─────────────────────
Deno.test("200 on valid send, INSERT args carry trimmed content + sender + branch", async () => {
  const { deps, inserts, logs } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: {
      branch_id: VALID_BRANCH_ID,
      content: "  Praying for your church.  ",
    },
  }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.branch_id, VALID_BRANCH_ID);
  assertEquals(typeof body.message_id, "string");
  assert(body.message_id.startsWith("msg-"));

  // INSERT contract: trimmed content, sender id, branch id, no flag.
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].senderId, VALID_SENDER_ID);
  assertEquals(inserts[0].branchId, VALID_BRANCH_ID);
  assertEquals(inserts[0].content, "Praying for your church.");
  assertEquals(inserts[0].flagged, false);
  assertEquals(inserts[0].flag_reason, null);

  // SAFE-LOG audit: the success log line does NOT contain content.
  const okLog = logs.find((l) => l.event === "send-branch-message.ok");
  assert(okLog, "expected a send-branch-message.ok log line");
  const serialized = JSON.stringify(okLog!.fields);
  assert(
    !serialized.includes("Praying for your church"),
    "SAFE-LOG breach: content text appeared in success log fields",
  );
});

// ── 8. DELIVER-ALWAYS: flagged content still delivered (200) ──────
Deno.test("DELIVER-ALWAYS: flagged content still inserts + returns 200", async () => {
  // Synthetic taxonomy with a single auto admin T1 code that matches "redflag-keyword".
  const taxonomy: Taxonomy = {
    taxonomy_version: "test-1",
    codes: [{
      code: "synthetic_admin_t1",
      source_prefix: "auto",
      tier: 1,
      routing: "admin",
      patterns: ["redflag-keyword"],
    }],
  };
  const { deps, inserts } = makeDeps({
    getTaxonomy: () => taxonomy,
  });
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    body: {
      branch_id: VALID_BRANCH_ID,
      content: "this message contains redflag-keyword inside",
    },
  }));
  // The whole point of DELIVER-ALWAYS: a flagged message returns 200,
  // and the INSERT carries flagged=true + flag_reason populated.
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].flagged, true);
  assertEquals(inserts[0].flag_reason, "auto:synthetic_admin_t1");
});

// ── 9. Malformed JSON body → 400 ──────────────────────────────────
Deno.test("400 on malformed JSON body", async () => {
  const { deps } = makeDeps();
  const handler = createHandler(deps);
  const res = await handler(makeRequest({
    bodyRaw: "{not valid json",
  }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.detail, "JSON");
});
