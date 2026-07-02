// register-church v6 Edge Function — validation-only mode.
//
// Per SME-reviewed orphan-prevention architecture (2026-06-14):
// register-church no longer writes to public.churches. It validates the
// payload, runs a same-room-race soft-warning check via the
// `find_similar_churches` RPC, and returns a structured response that
// drives the FE bypass card.
//
// The actual church write happens inside create-account v4's atomic
// RPC call to `public.create_account_atomic`, which inserts the church
// AND the leader in a single transaction. No orphan window.
//
// SEC-locked invariants (preserved):
//   - verify_jwt = false (pre-auth surface)
//   - Service-role Supabase client used ONLY to invoke
//     find_similar_churches (REVOKE FROM PUBLIC + GRANT TO service_role)
//   - No audit_log writes
//   - No Vault reads, no Resend
//   - No DB write of any kind (this is the load-bearing v6 invariant)
//   - Per-IP rate limit defeats validation-oracle enumeration

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHandler, type Deps, type SimilarChurch } from "./handler.ts";

const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function rateLimitKey(ip: string): string {
  return `register-church:ratelimit:${ip}`;
}

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const uu = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const ut = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  async function incr(k: string): Promise<number | null> {
    if (!uu || !ut) return null;
    const r = await fetch(`${uu}/incr/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash INCR ${r.status}`);
    return ((await r.json()) as { result: number }).result;
  }
  async function expire(k: string, s: number): Promise<void> {
    if (!uu || !ut) return;
    const r = await fetch(`${uu}/expire/${encodeURIComponent(k)}/${s}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash EXPIRE ${r.status}`);
  }
  async function ttl(k: string): Promise<number> {
    if (!uu || !ut) return RATE_LIMIT_WINDOW_SECONDS;
    const r = await fetch(`${uu}/ttl/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash TTL ${r.status}`);
    const { result } = (await r.json()) as { result: number };
    return result > 0 ? result : RATE_LIMIT_WINDOW_SECONDS;
  }

  return {
    async findSimilarChurches({ name, country, city, contactEmail, contactPhone, limit = 3 }): Promise<SimilarChurch[]> {
      const { data, error } = await adminClient.rpc("find_similar_churches", {
        p_name: name,
        p_country: country,
        p_city: city ?? "",
        p_contact_email: contactEmail ?? "",
        p_contact_phone: contactPhone ?? "",
        p_limit: limit,
      });
      if (error) throw new Error(`find_similar_churches: ${error.message}`);
      const rows = (data ?? []) as Array<{
        id: string;
        name: string;
        city: string | null;
        verification_status: string;
        match_reason: string;
      }>;
      return rows;
    },
    async rateLimit(ip) {
      const k = rateLimitKey(ip);
      try {
        const n = await incr(k);
        if (n === null) return { allowed: true, count: 0 };
        if (n === 1) await expire(k, RATE_LIMIT_WINDOW_SECONDS);
        if (n > RATE_LIMIT_MAX_REQUESTS) {
          const s = await ttl(k).catch(() => RATE_LIMIT_WINDOW_SECONDS);
          return { allowed: false, retryAfterSeconds: s };
        }
        return { allowed: true, count: n };
      } catch (e) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "upstash-failed",
          message: (e as Error).message,
          ts: new Date().toISOString(),
        }));
        // Strict fail-CLOSED (pre-UAT audit 2026-07-01): was fail-open {allowed:true} — an Upstash
        // outage silently disabled rate limiting on this anon write RPC. Reject (503) instead.
        return { allowed: false, backendError: true };
      }
    },
    getIp(req) {
      const x = req.headers.get("x-forwarded-for");
      if (x) return x.split(",")[0].trim();
      const r = req.headers.get("x-real-ip");
      if (r) return r.trim();
      return "unknown";
    },
    now() { return new Date(); },
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
