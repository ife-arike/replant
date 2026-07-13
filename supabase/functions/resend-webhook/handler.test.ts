// KAN-80 Batch 2 — resend-webhook handler tests: event mapping, lifecycle
// transitions, replay claim semantics, signature verification.

import { assertEquals } from "jsr:@std/assert@1";
import { eventToOutcome, processEvent, recordReplayClaim } from "./handler.ts";
import { verifySvixSignature } from "../_shared/email/webhook-verify.ts";

// ─── eventToOutcome mapping ───

Deno.test("email.sent → sent", () => {
  assertEquals(eventToOutcome({ type: "email.sent" }), "sent");
});

Deno.test("email.delivered → delivered", () => {
  assertEquals(eventToOutcome({ type: "email.delivered" }), "delivered");
});

Deno.test("email.bounced Permanent → hard_bounced", () => {
  assertEquals(
    eventToOutcome({ type: "email.bounced", data: { bounce: { type: "Permanent" } } }),
    "hard_bounced",
  );
});

Deno.test("email.bounced Transient → soft_bounced", () => {
  assertEquals(
    eventToOutcome({ type: "email.bounced", data: { bounce: { type: "Transient" } } }),
    "soft_bounced",
  );
});

Deno.test("email.bounced missing bounce.type → soft_bounced (conservative)", () => {
  assertEquals(eventToOutcome({ type: "email.bounced" }), "soft_bounced");
});

Deno.test("email.complained → complained", () => {
  assertEquals(eventToOutcome({ type: "email.complained" }), "complained");
});

Deno.test("email.opened → null (unsubscribed event type)", () => {
  assertEquals(eventToOutcome({ type: "email.opened" }), null);
});

// ─── Fake client for transition tests ───

function fakeClient(row: { id: string; outcome: string } | null) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _v: string) {
              return {
                maybeSingle: () => Promise.resolve({ data: row, error: null }),
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          updates.push({ table, ...patch });
          return {
            eq(_c: string, _v: string) {
              return { eq: (_c2: string, _v2: string) => Promise.resolve({ error: null }) };
            },
          };
        },
        upsert(_row: Record<string, unknown>, _opts: Record<string, unknown>) {
          return {
            select: () => Promise.resolve({ data: [{ event_id: "x" }], error: null }),
          };
        },
      };
    },
    _updates: updates,
  };
  return client;
}

Deno.test("sent→delivered applies", async () => {
  const c = fakeClient({ id: "r1", outcome: "sent" });
  const res = await processEvent(c, { type: "email.delivered", data: { email_id: "re_1" } });
  assertEquals(res, { handled: true, transition: "sent→delivered" });
  assertEquals(c._updates.length, 1);
});

Deno.test("soft_bounced→delivered applies (transient recovered)", async () => {
  const c = fakeClient({ id: "r1", outcome: "soft_bounced" });
  const res = await processEvent(c, { type: "email.delivered", data: { email_id: "re_1" } });
  assertEquals(res, { handled: true, transition: "soft_bounced→delivered" });
});

Deno.test("delivered→sent rejected (no regression)", async () => {
  const c = fakeClient({ id: "r1", outcome: "delivered" });
  const res = await processEvent(c, { type: "email.sent", data: { email_id: "re_1" } });
  assertEquals(res, { handled: false, reason: "invalid_transition" });
  assertEquals(c._updates.length, 0);
});

Deno.test("hard_bounced is terminal — delivered rejected", async () => {
  const c = fakeClient({ id: "r1", outcome: "hard_bounced" });
  const res = await processEvent(c, { type: "email.delivered", data: { email_id: "re_1" } });
  assertEquals(res, { handled: false, reason: "invalid_transition" });
});

Deno.test("delivered→complained applies (post-delivery complaint)", async () => {
  const c = fakeClient({ id: "r1", outcome: "delivered" });
  const res = await processEvent(c, { type: "email.complained", data: { email_id: "re_1" } });
  assertEquals(res, { handled: true, transition: "delivered→complained" });
});

Deno.test("missing email_id → no_email_id", async () => {
  const c = fakeClient(null);
  const res = await processEvent(c, { type: "email.delivered" });
  assertEquals(res, { handled: false, reason: "no_email_id" });
});

Deno.test("replay claim: fresh insert returns true", async () => {
  const c = fakeClient(null);
  assertEquals(await recordReplayClaim(c, "msg_1"), true);
});

// ─── Signature verification ───

async function signPayload(secretB64: string, id: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(secretB64), (ch) => ch.charCodeAt(0)).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${ts}.${body}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const TEST_SECRET_B64 = btoa("test-signing-secret-material-32b");

Deno.test("valid signature verifies", async () => {
  const now = 1_800_000_000;
  const body = '{"type":"email.delivered"}';
  const sig = await signPayload(TEST_SECRET_B64, "msg_1", String(now), body);
  const headers = new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": String(now),
    "svix-signature": `v1,${sig}`,
  });
  const res = await verifySvixSignature(headers, body, `whsec_${TEST_SECRET_B64}`, now);
  assertEquals(res, { ok: true, svixId: "msg_1" });
});

Deno.test("tampered body rejected", async () => {
  const now = 1_800_000_000;
  const sig = await signPayload(TEST_SECRET_B64, "msg_1", String(now), '{"a":1}');
  const headers = new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": String(now),
    "svix-signature": `v1,${sig}`,
  });
  const res = await verifySvixSignature(headers, '{"a":2}', `whsec_${TEST_SECRET_B64}`, now);
  assertEquals(res, { ok: false, reason: "bad_signature" });
});

Deno.test("stale timestamp rejected (>5min)", async () => {
  const now = 1_800_000_000;
  const staleTs = String(now - 6 * 60);
  const body = "{}";
  const sig = await signPayload(TEST_SECRET_B64, "msg_1", staleTs, body);
  const headers = new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": staleTs,
    "svix-signature": `v1,${sig}`,
  });
  const res = await verifySvixSignature(headers, body, `whsec_${TEST_SECRET_B64}`, now);
  assertEquals(res, { ok: false, reason: "stale_timestamp" });
});

Deno.test("missing headers rejected", async () => {
  const res = await verifySvixSignature(new Headers(), "{}", `whsec_${TEST_SECRET_B64}`);
  assertEquals(res, { ok: false, reason: "missing_headers" });
});

Deno.test("multiple space-separated signatures — any v1 match passes", async () => {
  const now = 1_800_000_000;
  const body = "{}";
  const good = await signPayload(TEST_SECRET_B64, "msg_1", String(now), body);
  const headers = new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": String(now),
    "svix-signature": `v1,AAAA v1,${good}`,
  });
  const res = await verifySvixSignature(headers, body, `whsec_${TEST_SECRET_B64}`, now);
  assertEquals(res, { ok: true, svixId: "msg_1" });
});
