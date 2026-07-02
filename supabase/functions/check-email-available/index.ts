// KAN-11 check-email-available Edge Function — Screen 03 onboarding email
// uniqueness check (fired on Next tap, BEFORE Page 2).
//
// SEC-locked invariants:
//   - verify_jwt = false at the platform (config.toml). This endpoint is
//     called BEFORE the user's auth.users row exists. JWT enforcement would
//     break onboarding. Any change requires a fresh SEC ruling.
//   - 10 req/hr per IP cap via Upstash. Hostile probes attempting email
//     enumeration are throttled at the gateway layer.
//   - No audit_log writes — observability is structured-log-only (Logs UI).
//   - No SECURITY DEFINER RPC calls, no Vault accessors, no Resend emails.
//     The function is a thin validate → rate-limit → lookup → return.
//   - Logic that needs vetting lives in logic.ts (parsePayload + rate-limit
//     key derivation); handler.ts owns wiring + the 405/400/429/500 surface.
//   - Email enumeration: response surface is intentionally minimal
//     (`{ available: boolean }`), no timing equalisation at MVP, 10/hr
//     bound on probes. If enumeration becomes a vector, revisit with SEC.
//
// Contract source: KAN-11 dispatch (build for Account Setup Page 1).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHandler,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  rateLimitKey,
  type Deps,
} from "./handler.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── Upstash REST helpers (per-IP hourly rate limit) ───
  //
  // Mirrors the pattern in send-message/index.ts. We INCR the per-IP key on
  // every request; on the first INCR we EX the key to RATE_LIMIT_WINDOW_SECONDS
  // so the count resets exactly one hour after the first request in the window
  // (fixed-window, not sliding). If INCR returns >RATE_LIMIT_MAX_REQUESTS,
  // disallow and surface the remaining TTL as retry_after_seconds.
  //
  // Rate-limit backend posture (updated by the pre-UAT audit 2026-07-01):
  //   - Upstash NOT configured (env absent, e.g. local dev): fail-OPEN — the
  //     request proceeds unthrottled (the `count === null` branch below).
  //   - Upstash configured but the call ERRORS (outage/unreachable): fail-CLOSED
  //     — reject with 503 rather than silently dropping the enumeration cap
  //     (the catch below). Founder ruling: strict fail-closed on outage.
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  async function upstashIncr(key: string): Promise<number | null> {
    if (!upstashUrl || !upstashToken) return null;
    const res = await fetch(`${upstashUrl}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    if (!res.ok) throw new Error(`Upstash INCR ${res.status}`);
    const { result } = (await res.json()) as { result: number };
    return result;
  }

  async function upstashExpire(key: string, ttlSeconds: number): Promise<void> {
    if (!upstashUrl || !upstashToken) return;
    const res = await fetch(
      `${upstashUrl}/expire/${encodeURIComponent(key)}/${ttlSeconds}`,
      { headers: { Authorization: `Bearer ${upstashToken}` } },
    );
    if (!res.ok) throw new Error(`Upstash EXPIRE ${res.status}`);
  }

  async function upstashTtl(key: string): Promise<number> {
    if (!upstashUrl || !upstashToken) return RATE_LIMIT_WINDOW_SECONDS;
    const res = await fetch(`${upstashUrl}/ttl/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    if (!res.ok) throw new Error(`Upstash TTL ${res.status}`);
    const { result } = (await res.json()) as { result: number };
    // TTL returns -1 if no expiry, -2 if missing. In our flow we always set
    // an expiry on the first INCR, so a -1/-2 means the EX raced or got
    // wiped — fall back to the full window for the retry hint.
    return result > 0 ? result : RATE_LIMIT_WINDOW_SECONDS;
  }

  return {
    async findUserByEmail(email: string): Promise<boolean> {
      // auth.admin.listUsers default perPage=50, max 200. Loop until a
      // page returns fewer than perPage rows. In-memory filter — there
      // is no `?email=` query on the Auth admin API (pre-2.105).
      // Email is canonical-lowercased by parsePayload AND by auth.users
      // itself, so direct === compare is safe.
      let page = 1;
      const perPage = 200;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
        const users = data?.users ?? [];
        if (users.some((u) => (u.email ?? "").toLowerCase() === email)) {
          return true;
        }
        if (users.length < perPage) return false;
        page += 1;
        // Safety guard against runaway pagination on a hostile fixture.
        // Replant has <10k auth users at MVP; >50 pages of 200 = 10k → STOP.
        if (page > 50) return false;
      }
    },

    async rateLimit(ip) {
      const key = rateLimitKey(ip);
      try {
        const count = await upstashIncr(key);
        if (count === null) {
          // Upstash not configured — fail-open per SEC posture above.
          return { allowed: true, count: 0 };
        }
        if (count === 1) {
          // First hit in this window — set the TTL.
          await upstashExpire(key, RATE_LIMIT_WINDOW_SECONDS);
        }
        if (count > RATE_LIMIT_MAX_REQUESTS) {
          const retryAfterSeconds = await upstashTtl(key).catch(
            () => RATE_LIMIT_WINDOW_SECONDS,
          );
          return { allowed: false, retryAfterSeconds };
        }
        return { allowed: true, count };
      } catch (e) {
        // Strict fail-CLOSED (pre-UAT audit 2026-07-01): was fail-open — an Upstash outage silently
        // disabled this email-enumeration rate limit. Reject (503) instead; the FE surfaces "try again".
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "check-email-available.upstash-failed",
            message: (e as Error).message,
            ts: new Date().toISOString(),
          }),
        );
        return { allowed: false, backendError: true };
      }
    },

    getIp(req: Request): string {
      // Supabase Edge Runtime sets x-forwarded-for; first value is the
      // client. Fallbacks chosen so an IP-less request gets a stable
      // bucket rather than a randomly-different one per call.
      const xff = req.headers.get("x-forwarded-for");
      if (xff) return xff.split(",")[0].trim();
      const real = req.headers.get("x-real-ip");
      if (real) return real.trim();
      return "unknown";
    },

    log(level, event, fields) {
      const line = JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

const handler = createHandler(makeDeps());

Deno.serve(handler);
