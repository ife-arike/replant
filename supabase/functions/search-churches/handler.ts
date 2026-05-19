// KAN-12 search-churches — handler factory (createHandler pattern).
//
// Mirrors check-email-available / register-church. Deps are injected so
// the handler is unit-testable without supabase-js, Upstash, or Deno.
// index.ts wires real deps; handler.test.ts wires fakes.
//
// Response contract:
//   200 { results: ChurchResult[] }                  — search success
//   400 { error: "<reason>" }                        — body shape / query length
//   429 { error: "...", retry_after_seconds }        — rate limit exceeded
//   500 { error: "Church search failed" }            — anything server-side

import {
  type ChurchResult,
  parsePayload,
  rateLimitKey,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  SEARCH_RESULT_LIMIT,
} from "./logic.ts";

export interface Deps {
  /**
   * Run the live search. Returns up to `SEARCH_RESULT_LIMIT` rows from
   * `churches_public` matching `query` (substring against `name` OR
   * `city`), each annotated with the server-computed `at_capacity`
   * boolean (active leader count ≥ 2).
   *
   * The handler does not inspect the results — that's the search
   * implementation's contract.
   */
  searchChurches(query: string): Promise<ChurchResult[]>;

  rateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
  >;

  getIp(req: Request): string;

  log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error400 = (msg: string) => json(400, { error: msg });
const error405 = () => json(405, { error: "Method not allowed" });
const error429 = (retryAfterSeconds: number) =>
  json(429, {
    error: "Too many requests. Please try again later.",
    retry_after_seconds: retryAfterSeconds,
  });
const error500 = () => json(500, { error: "Church search failed" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return error405();

      // Rate-limit BEFORE body parsing — a malformed-payload spammer is
      // still subject to the cap. Pulls IP from the dep, not the raw
      // request, so tests stay deterministic.
      const ip = deps.getIp(req);
      const rl = await deps.rateLimit(ip);
      if (!rl.allowed) {
        deps.log("warn", "search_churches_rate_limited", {
          ip_hash: hashIp(ip),
          retry_after_seconds: rl.retryAfterSeconds,
        });
        return error429(rl.retryAfterSeconds);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error400("Request body must be valid JSON");
      }

      const parsed = parsePayload(body);
      if (!parsed.ok) return error400(parsed.error);

      let results: ChurchResult[];
      try {
        results = await deps.searchChurches(parsed.query);
      } catch (e) {
        deps.log("error", "search_churches_query_failed", {
          ip_hash: hashIp(ip),
          query_length: parsed.query.length,
          message: (e as Error).message,
        });
        return error500();
      }

      // Defense-in-depth: even if the search implementation forgets the
      // LIMIT, hard-truncate before responding. Cheaper than re-querying.
      const truncated = results.slice(0, SEARCH_RESULT_LIMIT);

      deps.log("info", "search_churches_success", {
        ip_hash: hashIp(ip),
        query_length: parsed.query.length,
        result_count: truncated.length,
        rate_count: rl.count,
      });

      return json(200, { results: truncated });
    } catch (e) {
      deps.log("error", "search_churches_unexpected", {
        message: (e as Error).message,
      });
      return error500();
    }
  };
}

// djb2 hash — non-cryptographic. Keeps raw IPs out of structured logs
// while preserving the ability to correlate repeated failures from the
// same source. 8 hex chars caps log volume.
function hashIp(ip: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < ip.length; i++) {
    h = (((h << 5) + h) ^ ip.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Re-export so index.ts has a single import surface.
export {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  rateLimitKey,
  SEARCH_RESULT_LIMIT,
};
