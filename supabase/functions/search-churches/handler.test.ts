// KAN-12 search-churches — handler tests with mocked deps.
//
// Per dispatch minimums:
//   - query-too-short rejected (400)
//   - well-formed response shape on success
//   - at_capacity: true when count ≥ 2 (search dep returns it precomputed)
//   - at_capacity: false when count < 2
//   - empty results array when no match
//   - LIMIT 20 respected (handler hard-truncates defensively)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createHandler, type Deps } from "./handler.ts";
import { type ChurchResult, SEARCH_RESULT_LIMIT } from "./logic.ts";

interface Calls {
  searchChurches: number;
  searchArgs: string[];
  rateLimit: number;
  rateLimitArgs: string[];
  logs: { level: string; event: string; fields: Record<string, unknown> }[];
}

function makeDeps(
  overrides: Partial<Deps> = {},
  fixedIp = "10.0.0.1",
): { deps: Deps; calls: Calls } {
  const calls: Calls = {
    searchChurches: 0,
    searchArgs: [],
    rateLimit: 0,
    rateLimitArgs: [],
    logs: [],
  };
  const searchChurches =
    overrides.searchChurches ??
    (async (q: string) => {
      calls.searchChurches += 1;
      calls.searchArgs.push(q);
      return [] as ChurchResult[];
    });
  const rateLimit =
    overrides.rateLimit ??
    (async (ip: string) => {
      calls.rateLimit += 1;
      calls.rateLimitArgs.push(ip);
      return { allowed: true as const, count: 1 };
    });
  const getIp = overrides.getIp ?? ((_req: Request) => fixedIp);
  const log =
    overrides.log ??
    ((level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => {
      calls.logs.push({ level, event, fields });
    });
  return {
    deps: { searchChurches, rateLimit, getIp, log },
    calls,
  };
}

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("https://example.test/search-churches", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeRow(overrides: Partial<ChurchResult> = {}): ChurchResult {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Maranatha Ministries",
    type: "main_campus",
    city: "Nairobi",
    country: "Kenya",
    rag_status: "green",
    verification_status: "verified",
    at_capacity: false,
    leader_count: 0,
    ...overrides,
  };
}

// ── Method / body shape ────────────────────────────────────────────────

Deno.test("handler — non-POST rejected with 405 (no search, no rate-limit)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    const res = await h(new Request("https://example.test/x", { method }));
    assertEquals(res.status, 405);
  }
  assertEquals(calls.searchChurches, 0);
  assertEquals(calls.rateLimit, 0);
});

Deno.test("handler — non-JSON body returns 400 'Request body must be valid JSON'", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq("not-json{}"));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Request body must be valid JSON");
  // Rate-limit IS consumed even on bad JSON — spammers cannot bypass.
  assertEquals(calls.rateLimit, 1);
  assertEquals(calls.searchChurches, 0);
});

// ── Validation routing ────────────────────────────────────────────────

Deno.test("handler — query-too-short returns 400 (no search call)", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "ab" })); // 2 chars
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "query must be at least 3 characters");
  assertEquals(calls.searchChurches, 0);
});

Deno.test("handler — missing query returns 400 'query is required'", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  const res = await h(jsonReq({}));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "query is required");
  assertEquals(calls.searchChurches, 0);
});

// ── Rate-limit gating ─────────────────────────────────────────────────

Deno.test("handler — rate-limit exceeded returns 429 (no search)", async () => {
  const { deps, calls } = makeDeps({
    rateLimit: async () => ({ allowed: false, retryAfterSeconds: 1800 }),
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Maranatha" }));
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.retry_after_seconds, 1800);
  assertEquals(calls.searchChurches, 0);
  assertEquals(calls.logs.some((l) => l.event === "search_churches_rate_limited"), true);
});

// ── Success path — response shape ──────────────────────────────────────

Deno.test("handler — well-formed response: { results: ChurchResult[] }", async () => {
  const row = makeRow();
  const { deps } = makeDeps({
    searchChurches: async () => [row],
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Maranatha" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Array.isArray(body.results), true);
  assertEquals(body.results.length, 1);
  assertEquals(body.results[0], row);
});

Deno.test("handler — at_capacity: true surfaces unchanged to client", async () => {
  const fullChurch = makeRow({ at_capacity: true });
  const { deps } = makeDeps({
    searchChurches: async () => [fullChurch],
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Maranatha" }));
  const body = await res.json();
  assertEquals(body.results[0].at_capacity, true);
});

Deno.test("handler — at_capacity: false surfaces unchanged to client", async () => {
  const openChurch = makeRow({ at_capacity: false });
  const { deps } = makeDeps({
    searchChurches: async () => [openChurch],
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Maranatha" }));
  const body = await res.json();
  assertEquals(body.results[0].at_capacity, false);
});

Deno.test("handler — empty array on no match", async () => {
  const { deps } = makeDeps({
    searchChurches: async () => [],
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "ZZZZZZZ" }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.results, []);
});

// ── LIMIT 20 defensive truncation ──────────────────────────────────────

Deno.test("handler — LIMIT 20 enforced even if search dep over-returns", async () => {
  // Simulate a buggy/forgetful implementation that drops the LIMIT.
  const fakeRows: ChurchResult[] = Array.from({ length: 30 }, (_, i) =>
    makeRow({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      name: `Church ${i}`,
    }),
  );
  const { deps } = makeDeps({
    searchChurches: async () => fakeRows,
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Church" }));
  const body = await res.json();
  assertEquals(body.results.length, SEARCH_RESULT_LIMIT);
  assertEquals(body.results.length, 20);
});

// ── Search dep failure → 500 ───────────────────────────────────────────

Deno.test("handler — search throw maps to 500 (no raw error leaked)", async () => {
  const { deps, calls } = makeDeps({
    searchChurches: async () => {
      throw new Error("postgres: relation churches_public does not exist");
    },
  });
  const h = createHandler(deps);
  const res = await h(jsonReq({ query: "Maranatha" }));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Church search failed");
  assertEquals(body.error.includes("relation"), false);
  assertEquals(calls.logs.some((l) => l.event === "search_churches_query_failed"), true);
});

Deno.test("handler — query passed through to search dep, trimmed", async () => {
  const { deps, calls } = makeDeps();
  const h = createHandler(deps);
  await h(jsonReq({ query: "  Maranatha  " }));
  assertEquals(calls.searchArgs, ["Maranatha"]);
});
