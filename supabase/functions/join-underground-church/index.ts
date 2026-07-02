// join-underground-church Edge Function — second-leader underground attach.
//
// SEC-locked invariants (Founder rulings 2026-06-19/20):
//   - verify_jwt = false (pre-auth surface)
//   - Service-role admin client used ONLY for: auth.admin.createUser,
//     auth.admin.deleteUser, the public.users INSERT/UPDATE/DELETE, and
//     the active-leaders count.
//   - User-scoped anon client carrying the new user's JWT used ONLY for
//     the redeem RPC call (where auth.uid() is consulted).
//   - SERVICE_ROLE_KEY never leaves this function's environment.
//   - Idempotency key REQUIRED on every call (ruling #28).
//   - Per-IP rate limit 5/hr (ruling #27). Fail-CLOSED via in-memory
//     token bucket per worker on Upstash backend failure.
//   - Single generic error string on EVERY failure (ruling #4) —
//     invalid_or_consumed_code. Do NOT branch on internal subcodes.
//   - Welcome email = generic underground_pending body (ruling #5) —
//     NO church name, role, region, country, or "underground" word.
//   - Plaintext join code is NEVER logged. Not in console, not in
//     Sentry, not in Upstash. Logs use rpc error code only.
//   - Underground church names are NEVER logged. Church IDs only,
//     and even those are omitted from the routine success log line.
//   - Auth user creation must be comp-deletable on any subsequent
//     failure (orphan prevention — Founder lock).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHandler,
  type Deps,
  PER_IP_RATE_LIMIT_MAX,
  PER_IP_RATE_LIMIT_WINDOW_SECONDS,
  perIpRateLimitKey,
} from "./handler.ts";

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Replant <noreply@projectreplant.org>";

interface ResendCache { resendApiKey: string; }
let resendCacheP: Promise<ResendCache | null> | null = null;

async function loadResendCache(c: SupabaseClient): Promise<ResendCache | null> {
  try {
    const { data, error } = await c.rpc("get_resend_api_key");
    if (error || typeof data !== "string" || !data.length) return null;
    return { resendApiKey: data };
  } catch { return null; }
}

// ── In-memory token bucket for rate-limit fail-CLOSED fallback ─────
//
// When Upstash is unreachable, we fall back to a per-worker, per-IP
// bucket. This is the FAIL-CLOSED guarantee in Founder ruling #27 +
// the universal panel locks ("Rate-limit fail-CLOSED on all anon RPCs
// with in-memory token bucket fallback per worker on Upstash error").
// Buckets are evicted when their window expires. Per-worker isolation
// is acceptable — multiple workers each enforce the cap independently,
// which UNDER-counts the attacker's true rate; that's still strictly
// safer than fail-open.
interface Bucket { count: number; resetAt: number; }
const inMemBuckets: Map<string, Bucket> = new Map();
const IN_MEM_MAX = PER_IP_RATE_LIMIT_MAX;
const IN_MEM_WINDOW_MS = PER_IP_RATE_LIMIT_WINDOW_SECONDS * 1000;

function inMemRateCheck(ip: string, now: number): { allowed: boolean; retryAfterSeconds: number; count: number } {
  const key = perIpRateLimitKey(ip);
  let bucket = inMemBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + IN_MEM_WINDOW_MS };
    inMemBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > IN_MEM_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      count: bucket.count,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, count: bucket.count };
}

function makeDeps(): Deps {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Missing Supabase env");

  const adminClient: SupabaseClient = createClient(url, serviceRoleKey);

  const uu = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const ut = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  async function upstashIncr(k: string): Promise<number | null> {
    if (!uu || !ut) return null;
    const r = await fetch(`${uu}/incr/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash INCR ${r.status}`);
    return ((await r.json()) as { result: number }).result;
  }
  async function upstashExpire(k: string, s: number): Promise<void> {
    if (!uu || !ut) return;
    const r = await fetch(`${uu}/expire/${encodeURIComponent(k)}/${s}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash EXPIRE ${r.status}`);
  }
  async function upstashTtl(k: string): Promise<number> {
    if (!uu || !ut) return PER_IP_RATE_LIMIT_WINDOW_SECONDS;
    const r = await fetch(`${uu}/ttl/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash TTL ${r.status}`);
    const { result } = (await r.json()) as { result: number };
    return result > 0 ? result : PER_IP_RATE_LIMIT_WINDOW_SECONDS;
  }
  async function upstashGet(k: string): Promise<string | null> {
    if (!uu || !ut) return null;
    const r = await fetch(`${uu}/get/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash GET ${r.status}`);
    const { result } = (await r.json()) as { result: string | null };
    return result ?? null;
  }
  async function upstashSetEx(k: string, v: string, sec: number): Promise<void> {
    if (!uu || !ut) return;
    const r = await fetch(`${uu}/setex/${encodeURIComponent(k)}/${sec}/${encodeURIComponent(v)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash SETEX ${r.status}`);
  }

  function resendCache(): Promise<ResendCache | null> {
    if (!resendCacheP) {
      resendCacheP = loadResendCache(adminClient).catch(() => {
        resendCacheP = null;
        return null;
      });
    }
    return resendCacheP;
  }

  async function resendPost(body: Record<string, unknown>): Promise<void> {
    const c = await resendCache();
    if (!c) return;
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
  }

  return {
    async createAuthUser({ email, password }) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data?.user) throw new Error(error?.message ?? "no user");
      return { id: data.user.id };
    },

    async deleteAuthUser(id) {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) throw new Error(`deleteUser: ${error.message}`);
    },

    async signInWithPassword({ email, password }) {
      // Mint a user-scoped session by signing in. We use a separate
      // ephemeral anon client so adminClient's session state is not
      // mutated.
      const sessionClient = createClient(url, anonKey);
      const { data, error } = await sessionClient.auth.signInWithPassword({ email, password });
      if (error || !data?.session?.access_token) {
        throw new Error(error?.message ?? "no session");
      }
      return { accessToken: data.session.access_token };
    },

    async insertPublicUserNoChurch(o) {
      const { data, error } = await adminClient
        .from("users")
        .insert({
          auth_id: o.authId,
          email: o.email,
          full_name: o.fullName,
          first_name: o.firstName,
          middle_name: o.middleName,
          last_name: o.lastName,
          phone: o.phone || null,
          include_middle_name: o.includeMiddleName,
          role: o.role,
          church_id: null,
          anonymous: o.anonymous,
          declaration_affirmed: true,
          declaration_date: new Date().toISOString(),
          verification_status: "pending",
          // No user-side deadline: this leader is attaching to a
          // verified-or-pending underground church via redeem; the
          // church-side deadline drives the surface. The skip-flow
          // 7-day clock does not apply.
          verification_deadline: null,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "insert failed");
      return { id: data.id as string };
    },

    async deletePublicUserById(id) {
      const { error } = await adminClient.from("users").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async redeemJoinCodeAsUser({ accessToken, code }) {
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      const { data, error } = await userClient.rpc("redeem_underground_join_code", {
        p_code: code,
      });
      if (error) throw new Error(error.message);
      if (typeof data !== "string") throw new Error("redeem returned non-string");
      return { churchId: data };
    },

    async countActiveLeaders(churchId) {
      const { count, error } = await adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async attachUserToChurch({ userId, churchId }) {
      const { error } = await adminClient
        .from("users")
        .update({ church_id: churchId })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    },

    async sendUndergroundPendingEmail({ email }) {
      // VERBATIM body per Founder ruling #5 + CONTENT B2 (2026-06-19).
      // Identical to create-account v8's underground_pending kind —
      // intentional. The email channel must not differentiate
      // founder vs. second-leader (no signal an observer of an inbox
      // could use to infer underground church membership).
      const body =
        `Hello,\n\n` +
        `Thank you for completing your registration with Replant.\n\n` +
        `Your application is being reviewed by our team. You will receive a\n` +
        `follow-up message once the review is complete. This typically takes\n` +
        `up to 30 days.\n\n` +
        `To check your status, please sign in to the Replant app.\n\n` +
        `We are praying for you.\n\n` +
        `— The Replant Team\n` +
        `projectreplant.org`;
      await resendPost({
        from: FROM,
        to: email,
        subject: "Your Replant registration",
        text: body,
      });
    },

    async idempotencyCacheGet(k) {
      return await upstashGet(k);
    },
    async idempotencyCacheSet(k, v, sec) {
      await upstashSetEx(k, v, sec);
    },

    async perIpRateLimit(ip) {
      const k = perIpRateLimitKey(ip);
      try {
        const n = await upstashIncr(k);
        if (n === null) {
          // No Upstash env configured at all — strict fail-CLOSED via
          // in-memory bucket. (This shouldn't happen in prod; the env
          // is part of the standard deploy posture.)
          const m = inMemRateCheck(ip, Date.now());
          return m.allowed
            ? { allowed: true, count: m.count }
            : { allowed: false, retryAfterSeconds: m.retryAfterSeconds };
        }
        if (n === 1) await upstashExpire(k, PER_IP_RATE_LIMIT_WINDOW_SECONDS);
        if (n > PER_IP_RATE_LIMIT_MAX) {
          const s = await upstashTtl(k).catch(() => PER_IP_RATE_LIMIT_WINDOW_SECONDS);
          return { allowed: false, retryAfterSeconds: s };
        }
        return { allowed: true, count: n };
      } catch (e) {
        // Upstash backend error — FAIL-CLOSED via in-memory bucket.
        // (We log the failure but never fall through to allowed=true.)
        console.warn(JSON.stringify({
          level: "warn",
          event: "upstash-rate-limit-failed-fallback-inmem",
          message: (e as Error).message,
          ts: new Date().toISOString(),
        }));
        const m = inMemRateCheck(ip, Date.now());
        return m.allowed
          ? { allowed: true, count: m.count }
          : { allowed: false, retryAfterSeconds: m.retryAfterSeconds };
      }
    },

    getIp(req) {
      const x = req.headers.get("x-forwarded-for");
      if (x) return x.split(",")[0].trim();
      const r = req.headers.get("x-real-ip");
      if (r) return r.trim();
      return "unknown";
    },

    log(level, event, fields) {
      // Defensive scrub — never emit a `plaintext`/`join_code`/`code`
      // field. The handler doesn't pass these, but a future drift could.
      // Drop any field with a suspicious key as a backstop.
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        const lk = k.toLowerCase();
        if (lk === "code" || lk === "plaintext" || lk.includes("join_code") || lk.includes("joincode")) {
          continue;
        }
        sanitized[k] = v;
      }
      const line = JSON.stringify({ level, event, ...sanitized, ts: new Date().toISOString() });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

const handler = createHandler(makeDeps());
Deno.serve(handler);
