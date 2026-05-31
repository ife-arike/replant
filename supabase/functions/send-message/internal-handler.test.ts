// KAN-217 — /internal route handler unit tests. Targets SEC c.15285 Item 3
// sub-items (3a)–(3f) and DELIVER-ALWAYS (D-45 clause 3) preservation.
//
// Synthetic taxonomy fixtures only — no real pattern strings inlined
// (AC-12 of KAN-124 carries over from matcher tests).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createInternalHandler,
  type InternalDeps,
} from "./internal-handler.ts";
import type { Taxonomy } from "./taxonomy.ts";

const SR = "test-service-role-key-jwt-shaped-xxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const SYS = "028be745-8014-4314-a7cf-36b0a4d52b46";
const LEADER = "33333333-3333-4333-8333-333333333333";
const CONV = "44444444-4444-4444-4444-444444444444";
const OTHER_USER = "55555555-5555-4555-8555-555555555555";

interface LogEntry {
  level: "info" | "warn" | "error";
  event: string;
  fields: Record<string, unknown>;
}

interface SendCall {
  senderId: string;
  conversationId: string | null;
  participantA: string | null;
  participantB: string | null;
  content: string;
  receiverId: string;
  flagged: boolean;
  flag_reason: string | null;
}

interface Capture {
  logs: LogEntry[];
  sendCalls: SendCall[];
  postCommitCalls: Array<{ messageId: string; senderId: string }>;
}

function makeDeps(opts: {
  taxonomy?: Taxonomy | null;
  conversationOverride?: (
    id: string,
  ) => Promise<
    | { id: string; participant_a: string; participant_b: string }
    | null
  >;
  sendThrows?: Error;
} = {}): { deps: InternalDeps; capture: Capture } {
  const capture: Capture = {
    logs: [],
    sendCalls: [],
    postCommitCalls: [],
  };
  const deps: InternalDeps = {
    internalToken: SR,
    systemSenderId: SYS,
    fetchConversation: opts.conversationOverride ?? (async (id: string) => {
      if (id === CONV) {
        return {
          id: CONV,
          participant_a: SYS,
          participant_b: LEADER,
        };
      }
      return null;
    }),
    sendInTransaction: async (input) => {
      capture.sendCalls.push(input);
      if (opts.sendThrows) throw opts.sendThrows;
      return {
        id: "00000000-0000-4000-8000-000000000001",
        conversation_id: input.conversationId ?? CONV,
        created_at: "2026-05-30T21:00:00.000Z",
        flagged: input.flagged,
      };
    },
    getTaxonomy: () => opts.taxonomy ?? null,
    postCommitFlagEffects: async ({ messageId, senderId }) => {
      capture.postCommitCalls.push({ messageId, senderId });
    },
    log: (level, event, fields) => {
      capture.logs.push({ level, event, fields });
    },
  };
  return { deps, capture };
}

// device-pass-fixes-1 (2026-05-31): the /internal token rides on the
// X-Internal-Token request header (not Authorization Bearer). makeReq's
// `internalToken` field maps to that header. An optional `auth` field
// remains for tests that want to assert presence/absence of the
// Authorization header — but the function code under test does NOT
// validate Authorization (the platform gateway handles that upstream).
function makeReq(opts: {
  method?: string;
  url?: string;
  internalToken?: string | null;
  auth?: string | null;
  sentinel?: string | null;
  body?: unknown;
  rawBody?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (opts.auth) headers["Authorization"] = opts.auth;
  if (opts.internalToken) headers["X-Internal-Token"] = opts.internalToken;
  if (opts.sentinel) headers["X-Replant-Internal"] = opts.sentinel;
  if (opts.body !== undefined || opts.rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return new Request(
    opts.url ?? "https://example.com/send-message/internal",
    {
      method: opts.method ?? "POST",
      headers,
      body: opts.rawBody !== undefined
        ? opts.rawBody
        : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
    },
  );
}

// AC-3(d) helper: assert no log line carries the internal-token value.
function assertNoSrKeyInLogs(capture: Capture): void {
  for (const log of capture.logs) {
    const serialized = JSON.stringify(log.fields);
    if (serialized.includes(SR)) {
      throw new Error(
        `AC-3(d) VIOLATION: log event ${log.event} leaked internal token`,
      );
    }
  }
}

const WELCOME_BODY = {
  conversation_id: CONV,
  content: "Welcome to the network.",
};

// ──────────────────── method gate ────────────────────

Deno.test("internal: non-POST returns 405", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({ method: "GET", internalToken: SR, sentinel: "true" }));
  assertEquals(res.status, 405);
});

// ──────────────────── AC-3(a) + AC-3(b) — auth gate ────────────────────

Deno.test("AC-3(a): wrong X-Internal-Token returns 401", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: "wrong-key",
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 401);
  assertEquals(capture.sendCalls.length, 0);
  assertNoSrKeyInLogs(capture);
});

Deno.test("AC-3(a): missing X-Internal-Token returns 401", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 401);
  assertEquals(capture.sendCalls.length, 0);
});

Deno.test("AC-3(a): Authorization header value is IGNORED by function code; only X-Internal-Token authenticates", async () => {
  // The platform gateway (verify_jwt=true) validates Authorization upstream;
  // function code under test never reads it. A request with a bogus
  // Authorization but a correct X-Internal-Token + sentinel must pass
  // the auth gate (it'd be the gateway's job to reject it earlier, not
  // ours).
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    auth: `Basic something-the-gateway-would-reject`,
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls.length, 1);
});

Deno.test("AC-3(b): missing X-Replant-Internal sentinel returns 401 even with correct X-Internal-Token", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 401);
  assertEquals(capture.sendCalls.length, 0);
});

Deno.test("AC-3(b): wrong X-Replant-Internal value returns 401", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "yes",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 401);
});

Deno.test("AC-3(b): X-Replant-Internal value is case-sensitive (TRUE rejected)", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "TRUE",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 401);
});

Deno.test("AC-3(d): auth-failed log carries no internal token, no headers, no body", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  await handler(makeReq({
    internalToken: "wrong",
    sentinel: "true",
    body: { conversation_id: CONV, content: "secret payload" },
  }));
  const authLog = capture.logs.find((l) =>
    l.event === "send-message.internal.auth-failed"
  );
  if (!authLog) throw new Error("expected auth-failed log entry");
  // Empty fields object — no headers, no body content, no key.
  assertEquals(Object.keys(authLog.fields).length, 0);
});

// ──────────────────── AC-3(c) — sender_id impersonation guard ────────────────────

Deno.test("AC-3(c): body containing sender_id returns 400 (no INSERT)", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: CONV, content: "hi", sender_id: LEADER },
  }));
  assertEquals(res.status, 400);
  assertEquals(capture.sendCalls.length, 0);
});

Deno.test("AC-3(c): body containing sender_id=null still rejected", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: CONV, content: "hi", sender_id: null },
  }));
  assertEquals(res.status, 400);
});

Deno.test("AC-3(c): body containing recipient_user_id returns 400", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: CONV, content: "hi", recipient_user_id: LEADER },
  }));
  assertEquals(res.status, 400);
  assertEquals(capture.sendCalls.length, 0);
});

Deno.test("AC-3(c): sendInTransaction always called with systemSenderId regardless of body", async () => {
  // Even if validateInternalBody DID accept sender_id (it doesn't),
  // the handler structurally hardcodes deps.systemSenderId. This test
  // documents that contract.
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls.length, 1);
  assertEquals(capture.sendCalls[0].senderId, SYS);
});

// ──────────────────── body validation ────────────────────

Deno.test("validation: missing conversation_id returns 400", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { content: "hi" },
  }));
  assertEquals(res.status, 400);
});

Deno.test("validation: non-UUID conversation_id returns 400", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: "not-a-uuid", content: "hi" },
  }));
  assertEquals(res.status, 400);
});

Deno.test("validation: empty content returns 400", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: CONV, content: "   " },
  }));
  assertEquals(res.status, 400);
});

Deno.test("validation: malformed JSON returns 400", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    rawBody: "{not-valid-json",
  }));
  assertEquals(res.status, 400);
});

// ──────────────────── conversation lookup ────────────────────

Deno.test("conv-not-found returns 403", async () => {
  const { deps } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: {
      conversation_id: "66666666-6666-4666-8666-666666666666",
      content: "hi",
    },
  }));
  assertEquals(res.status, 403);
});

Deno.test("system-not-participant returns 403 (defensive against admin BE bugs)", async () => {
  const { deps, capture } = makeDeps({
    conversationOverride: async (id: string) =>
      id === CONV
        ? { id: CONV, participant_a: LEADER, participant_b: OTHER_USER }
        : null,
  });
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 403);
  assertEquals(capture.sendCalls.length, 0);
});

Deno.test("conversation receiver resolution: system as participant_a → receiver is participant_b", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls[0].receiverId, LEADER);
});

Deno.test("conversation receiver resolution: system as participant_b → receiver is participant_a", async () => {
  const { deps, capture } = makeDeps({
    conversationOverride: async (id: string) =>
      id === CONV
        ? { id: CONV, participant_a: LEADER, participant_b: SYS }
        : null,
  });
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls[0].receiverId, LEADER);
});

// ──────────────────── AC-3(e) — DELIVER-ALWAYS / keyword scan ────────────────────

Deno.test("AC-3(e): null taxonomy → no matches → flagged=false → delivery proceeds", async () => {
  const { deps, capture } = makeDeps({ taxonomy: null });
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls[0].flagged, false);
  assertEquals(capture.sendCalls[0].flag_reason, null);
});

Deno.test("AC-3(e): synthetic taxonomy that matches → flagged=true → delivery STILL proceeds", async () => {
  // Synthetic fixture: a single pastoral-routed T1 code with a benign
  // pattern guaranteed to appear in the welcome copy. The point is that
  // matching does NOT gate delivery — flagged=true must still 200.
  const synthetic: Taxonomy = {
    taxonomy_version: "test-1",
    codes: [
      {
        code: "synthetic_test_match",
        tier: 1,
        source_prefix: "auto",
        routing: "pastoral",
        patterns: ["welcome"],
      },
    ],
  };
  const { deps, capture } = makeDeps({ taxonomy: synthetic });
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  assertEquals(capture.sendCalls[0].flagged, true);
  // flag_reason is non-null when at least one match occurred.
  if (capture.sendCalls[0].flag_reason === null) {
    throw new Error("expected flag_reason to be set when a match occurred");
  }
  // postCommitFlagEffects fires when flagged.
  assertEquals(capture.postCommitCalls.length, 1);
  assertEquals(capture.postCommitCalls[0].senderId, SYS);
});

// ──────────────────── AC-3(d) — log discipline ────────────────────

Deno.test("AC-3(d): SR key never appears in any log on happy path", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertNoSrKeyInLogs(capture);
});

Deno.test("AC-3(d): SR key never appears in any log when sendInTransaction throws", async () => {
  const { deps, capture } = makeDeps({
    sendThrows: new Error("simulated DB failure"),
  });
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 500);
  assertNoSrKeyInLogs(capture);
});

Deno.test("AC-3(d): SR key never appears in any log on auth failure", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  await handler(makeReq({
    internalToken: "wrong",
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertNoSrKeyInLogs(capture);
});

Deno.test("AC-3(d): SR key never appears in any log when body contains sender_id", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: { conversation_id: CONV, content: "hi", sender_id: LEADER },
  }));
  assertNoSrKeyInLogs(capture);
});

// ──────────────────── happy path E2E ────────────────────

Deno.test("happy path: 200 with welcome copy → INSERT called with system sender + correct receiver + scan-evaluated flagged", async () => {
  const { deps, capture } = makeDeps();
  const handler = createInternalHandler(deps);
  const res = await handler(makeReq({
    internalToken: SR,
    sentinel: "true",
    body: WELCOME_BODY,
  }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.flagged, false);
  assertEquals(body.conversation_id, CONV);

  // sendInTransaction contract:
  //   senderId === Vault-loaded systemSenderId
  //   conversationId === request body's conversation_id
  //   participantA/B === null (existing-conversation path)
  //   receiverId === the non-system participant
  //   content === trimmed welcome copy
  //   flagged is a boolean (not NULL) — AC-9 keyword scan ran
  assertEquals(capture.sendCalls.length, 1);
  const call = capture.sendCalls[0];
  assertEquals(call.senderId, SYS);
  assertEquals(call.conversationId, CONV);
  assertEquals(call.participantA, null);
  assertEquals(call.participantB, null);
  assertEquals(call.receiverId, LEADER);
  assertEquals(call.content, "Welcome to the network.");
  assertEquals(typeof call.flagged, "boolean");
});
