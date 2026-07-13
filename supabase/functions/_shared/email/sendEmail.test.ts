// KAN-80 Batch 2 — sendEmail contract tests.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { claim, dispatch, send } from "./sendEmail.ts";
import { EmailContractError, type SendArgs } from "./types.ts";

const BASE: SendArgs = {
  template: "test_template",
  to: "x@example.org",
  subject: "s",
  html: "<p>h</p>",
  text: "t",
  logUserId: "user-1",
};

// ─── Fake client ───

interface FakeOpts {
  insertError?: { code: string; message: string } | null;
  existingRow?: { id: string; resend_id: string | null } | null;
  notificationsEnabled?: boolean;
}

function fakeClient(opts: FakeOpts = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    email_notifications_enabled: opts.notificationsEnabled ?? true,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, ...row });
          const chain = {
            select: () => ({
              single: () =>
                Promise.resolve(
                  opts.insertError
                    ? { data: null, error: opts.insertError }
                    : { data: { id: "log-1" }, error: null },
                ),
            }),
            // bare insert (suppression record) resolves as a thenable
            then(resolve: (v: unknown) => void) {
              resolve({ error: null });
            },
          };
          return chain;
        },
        select(_cols: string) {
          const chain: any = {
            eq: () => chain,
            maybeSingle: () =>
              Promise.resolve({ data: opts.existingRow ?? null, error: null }),
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          updates.push({ table, ...patch });
          return {
            eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        },
      };
    },
    _inserts: inserts,
    _updates: updates,
  };
  return client;
}

function fetchStub(responses: Array<{ status: number; id?: string }>) {
  let i = 0;
  return (_url: string | URL | Request, _init?: RequestInit) => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return Promise.resolve(
      new Response(JSON.stringify({ id: r.id ?? "re_test" }), {
        status: r.status,
      }),
    );
  };
}

// ─── claim ───

Deno.test("claim: happy path returns claimed + logId", async () => {
  const c = fakeClient();
  const res = await claim(c, BASE);
  assertEquals(res, { status: "claimed", logId: "log-1" });
  assertEquals(c._inserts[0].outcome, "queued");
});

Deno.test("claim: missing anchor throws EmailContractError", async () => {
  const c = fakeClient();
  await assertRejects(
    () => claim(c, { ...BASE, logUserId: null }),
    EmailContractError,
  );
});

Deno.test("claim: malformed idempotency key throws", async () => {
  const c = fakeClient();
  await assertRejects(
    () => claim(c, { ...BASE, idempotencyKey: "wrong_prefix:x" }),
    EmailContractError,
  );
});

Deno.test("claim: namespaced idempotency key accepted, null user ok", async () => {
  const c = fakeClient();
  const res = await claim(c, {
    ...BASE,
    logUserId: null,
    idempotencyKey: "test_template:event-9",
  });
  assertEquals(res.status, "claimed");
});

Deno.test("claim: unique violation → duplicate with existing resend_id", async () => {
  const c = fakeClient({
    insertError: { code: "23505", message: "dup" },
    existingRow: { id: "log-0", resend_id: "re_prev" },
  });
  const res = await claim(c, BASE);
  assertEquals(res, { status: "duplicate", logId: "log-0", resendId: "re_prev" });
});

Deno.test("claim: notification-class + toggle off → suppressed + logged", async () => {
  const c = fakeClient({ notificationsEnabled: false });
  const res = await claim(c, { ...BASE, notificationClass: true });
  assertEquals(res, { status: "suppressed", reason: "notifications_disabled" });
  assertEquals(c._inserts[0].outcome, "suppressed_pre_send");
});

Deno.test("claim: transactional class ignores toggle", async () => {
  const c = fakeClient({ notificationsEnabled: false });
  const res = await claim(c, BASE); // notificationClass omitted = transactional
  assertEquals(res.status, "claimed");
});

// ─── dispatch ───

Deno.test("dispatch: 200 → sent + resend_id recorded", async () => {
  const c = fakeClient();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchStub([{ status: 200, id: "re_ok" }]) as typeof fetch;
  try {
    const res = await dispatch(c, "re_key", "log-1", BASE, () => Promise.resolve());
    assertEquals(res, { success: true, resendId: "re_ok", outcome: "sent" });
    assertEquals(c._updates[0].outcome, "sent");
    assertEquals(c._updates[0].attempt_count, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("dispatch: 500 then 200 → sent after retry, attempts=2", async () => {
  const c = fakeClient();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchStub([{ status: 500 }, { status: 200, id: "re_2" }]) as typeof fetch;
  try {
    const res = await dispatch(c, "re_key", "log-1", BASE, () => Promise.resolve());
    assertEquals(res.success, true);
    assertEquals(c._updates[0].attempt_count, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("dispatch: 422 payload bug → failed WITHOUT retry", async () => {
  const c = fakeClient();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchStub([{ status: 422 }]) as typeof fetch;
  try {
    const res = await dispatch(c, "re_key", "log-1", BASE, () => Promise.resolve());
    assertEquals(res, { success: false, outcome: "failed", reason: "http_422" });
    assertEquals(c._updates[0].outcome, "failed");
    assertEquals(c._updates[0].attempt_count, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("dispatch: double 500 → failed, attempts=2", async () => {
  const c = fakeClient();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchStub([{ status: 500 }, { status: 502 }]) as typeof fetch;
  try {
    const res = await dispatch(c, "re_key", "log-1", BASE, () => Promise.resolve());
    assertEquals(res.success, false);
    assertEquals(c._updates[0].attempt_count, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ─── send ───

Deno.test("send: duplicate claim short-circuits without POST", async () => {
  const c = fakeClient({
    insertError: { code: "23505", message: "dup" },
    existingRow: { id: "log-0", resend_id: "re_prev" },
  });
  const realFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = ((..._a: unknown[]) => {
    fetchCalled = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  try {
    const res = await send(c, "re_key", BASE);
    assertEquals(res, { success: true, resendId: "re_prev", outcome: "duplicate" });
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("send: suppressed short-circuits without POST", async () => {
  const c = fakeClient({ notificationsEnabled: false });
  const res = await send(c, "re_key", { ...BASE, notificationClass: true });
  assertEquals(res.success, false);
  assertEquals(res.outcome, "suppressed");
});
