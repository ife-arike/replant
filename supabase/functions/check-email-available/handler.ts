// KAN-11 check-email-available — handler factory (createHandler pattern).
//
// Mirrors register-church / submit-heartcry / auth-status-check: deps are
// injected so the handler is unit-testable without the Supabase client,
// Upstash, or the Deno runtime. index.ts wires real deps; handler.test.ts
// wires fakes.
//
// Response contract (per KAN-11 dispatch):
//   200 { available: true }                  — email is NOT registered
//   200 { available: false }                 — email IS already registered
//   400 { error: "<reason>" }                — body shape / email format
//   429 { error: "...", retry_after_seconds } — rate limit exceeded (AC #11)
//   500 { error: "Email check failed" }      — anything server-side

import { parsePayload, rateLimitKey, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS } from "./logic.ts";

export interface Deps {
  // Returns true if a user with this email already exists in auth.users.
  // Implementations: real (auth.admin.listUsers + in-memory filter, looped
  // for pagination) and fake (Set lookup) in tests.
  findUserByEmail(email: string): Promise<boolean>;

  // Per-IP rate limit. Implementations return:
  //   { allowed: true, count }                — under cap, proceed
  //   { allowed: false, retryAfterSeconds }   — over cap, return 429
  // The handler is agnostic to the underlying store (Upstash REST in prod,
  // an in-memory Map in tests).
  rateLimit(ip: string): Promise<
    | { allowed: true; count: number }
    | { allowed: false; retryAfterSeconds: number }
  >;

  // IP extraction is dep-injected so tests can drive the rate-limit path
  // deterministically without manufacturing real request headers.
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
const error500 = () => json(500, { error: "Email check failed" });

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return error405();

      // Rate limit BEFORE body parsing — a malformed-payload spammer should
      // also be subject to the 10/hr cap. Pulls IP from the dep, not the raw
      // request, so tests stay deterministic.
      const ip = deps.getIp(req);
      const rl = await deps.rateLimit(ip);
      if (!rl.allowed) {
        deps.log("warn", "check_email_rate_limited", {
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

      let exists: boolean;
      try {
        exists = await deps.findUserByEmail(parsed.email);
      } catch (e) {
        // Never surface raw Postgres / Auth API errors to the caller. Log
        // structured for observability; return a generic 500.
        deps.log("error", "check_email_lookup_failed", {
          ip_hash: hashIp(ip),
          message: (e as Error).message,
        });
        return error500();
      }

      deps.log("info", "check_email_success", {
        ip_hash: hashIp(ip),
        available: !exists,
        rate_count: rl.count,
      });

      return json(200, { available: !exists });
    } catch (e) {
      deps.log("error", "check_email_unexpected", {
        message: (e as Error).message,
      });
      return error500();
    }
  };
}

// Non-cryptographic IP hash for logs — keeps raw IPs out of structured
// logs while preserving the ability to correlate a single attacker's
// repeated 429s. Length is bounded to 16 hex chars (8 bytes) for log
// volume control.
function hashIp(ip: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < ip.length; i++) {
    h = (((h << 5) + h) ^ ip.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Re-export so index.ts can pull the rate-limit constants without
// double-importing from logic.
export { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS, rateLimitKey };
