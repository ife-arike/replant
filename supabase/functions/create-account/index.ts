// KAN-12 create-account Edge Function — atomic account creation entry point.
//
// SEC-locked invariants:
//   - verify_jwt = false at the platform (config.toml). This function
//     CREATES the leader's auth.users row — there is no JWT at call
//     time by definition. Any change requires a fresh SEC ruling.
//   - Service-role key is used for both `auth.admin.createUser`
//     (privileged Auth surface) and the `public.users` INSERT
//     (RLS-bypassing write). NEVER expose service-role outside this
//     function or the other admin-only edge functions.
//   - 3 req/hr per IP+email via Upstash. Write surface; SEC bar.
//   - Three-layer duplicate detection (SPEC c.10175): this function
//     implements Layer 3. Auth-only mid-transaction state → resume
//     and complete the INSERT. Both rows present → reject as duplicate.
//   - Compensating DELETE on Step 1-after-success-Step-4-failure path:
//     only delete the auth row when it was created in THIS request,
//     never delete a pre-existing auth row from a prior partial attempt.
//   - Capacity guard server-side at write time, mirroring the
//     search-churches `at_capacity` flag. Race window with concurrent
//     submits is bounded by the 3/hr rate-limit; DBA-side trigger is
//     a separate follow-up (out-of-scope for this ticket).
//   - users.country MUST NOT be written — column does not exist (DBA
//     c.13321 Q2).
//   - users.church_id is part of the single INSERT (DBA c.13321 Bonus —
//     no association table).
//   - users.full_name = `${firstName.trim()} ${lastName.trim()}` per DBA
//     c.13321 Q3. FE validates both parts non-empty pre-submit; BE
//     re-validates in parsePayload.
//   - Resend Steps 6-7 are fire-and-forget per COO c.10131. Email
//     failures DO NOT roll back account creation. Vault boot cache for
//     the Resend API key is lazy + fault-tolerant — failure to load
//     the Vault key downgrades Steps 6-7 to no-ops rather than blocking
//     account creation.
//
// Vault pattern source: `supabase/functions/submit-heartcry/index.ts`
// (KAN-66 RESUME ruling). The KAN-12 dispatch cited `check-email-available`
// for this pattern, but that function explicitly disclaims Vault use; the
// canonical pattern lives in submit-heartcry. Surfaced in anchor report.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHandler,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  rateLimitKey,
  type Deps,
  type InsertPublicUserRow,
} from "./handler.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM = "Replant <noreply@projectreplant.org>";
const WELCOME_SUBJECT = "Welcome to Replant";
const NEW_CHURCH_SUBJECT = "New church registered — Replant";
// Team destination for Step 7. MVP hardcode; KAN-31 follows-up with a
// Vault key (e.g. `team_notifications_email`) once the template is built.
const TEAM_NOTIFICATIONS_TO = "connect@projectreplant.org";

interface ResendBootCache {
  resendApiKey: string;
}

let resendCachePromise: Promise<ResendBootCache | null> | null = null;

async function loadResendCache(adminClient: SupabaseClient): Promise<ResendBootCache | null> {
  // Fault-tolerant: a missing Vault key (e.g. KAN-31 not yet shipped on
  // this environment) MUST NOT block account creation. We return null
  // and the caller logs warn + skips the Resend call.
  try {
    const { data, error } = await adminClient.rpc("get_resend_api_key");
    if (error || typeof data !== "string" || data.length === 0) {
      return null;
    }
    return { resendApiKey: data };
  } catch {
    return null;
  }
}

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── Upstash REST helpers (per IP+email hourly rate limit) ───
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
    return result > 0 ? result : RATE_LIMIT_WINDOW_SECONDS;
  }

  // ─── Lazy Resend boot cache (NOT awaited at module load) ───
  function ensureResendCache(): Promise<ResendBootCache | null> {
    if (!resendCachePromise) {
      resendCachePromise = loadResendCache(adminClient).catch(() => {
        // Reset on hard failure so the next request retries — avoids
        // poisoning the isolate.
        resendCachePromise = null;
        return null;
      });
    }
    return resendCachePromise;
  }

  async function postToResend(body: Record<string, unknown>): Promise<void> {
    const cache = await ensureResendCache();
    if (!cache) {
      // Vault key unavailable — skip silently. Caller-side handler.ts
      // catches no exception; the void/.catch wrapper logs warn only on
      // throw. We don't throw here because "send" is a no-op in this state
      // and that's the intentional fire-and-forget posture.
      return;
    }
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cache.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}`);
    }
  }

  return {
    async findAuthUserByEmail(emailLower) {
      // supabase-js doesn't expose a `getUserByEmail` on every version;
      // we use the listUsers admin API and filter in-memory. Page size
      // 200, loop until a partial page or 50 pages reached. Mirrors the
      // pattern in `check-email-available/index.ts`.
      let page = 1;
      const perPage = 200;
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
        const users = data?.users ?? [];
        const hit = users.find((u) => (u.email ?? "").toLowerCase() === emailLower);
        if (hit) return { id: hit.id, email: hit.email ?? emailLower };
        if (users.length < perPage) return null;
        page += 1;
        if (page > 50) return null; // safety guard — never run away
      }
    },

    async findPublicUserByAuthId(authId) {
      const { data, error } = await adminClient
        .from("users")
        .select("id")
        .eq("auth_id", authId)
        .maybeSingle();
      if (error) throw new Error(`public.users lookup: ${error.message}`);
      return data ? { id: data.id as string } : null;
    },

    async createAuthUser({ email, password }) {
      // email_confirm: true — onboarding flow does NOT run the email
      // confirmation step at MVP. Leaders are considered confirmed at
      // account creation; verification of legitimacy happens via the
      // separate `verification_status` column on public.users + the
      // KAN-47 admin Verification Queue.
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data?.user) {
        throw new Error(error?.message ?? "auth.admin.createUser returned no user");
      }
      return { id: data.user.id, email: data.user.email ?? email };
    },

    async deleteAuthUser(authId) {
      const { error } = await adminClient.auth.admin.deleteUser(authId);
      if (error) {
        throw new Error(`auth.admin.deleteUser: ${error.message}`);
      }
    },

    async countActiveUsersInChurch(churchId) {
      const { count, error } = await adminClient
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);
      if (error) throw new Error(`users capacity count: ${error.message}`);
      return count ?? 0;
    },

    async insertPublicUser(row: InsertPublicUserRow) {
      const { data, error } = await adminClient
        .from("users")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`public.users insert: ${error?.code ?? error?.message ?? "no row returned"}`);
      }
      return { id: data.id as string };
    },

    async sendWelcomeEmail({ email, firstName }) {
      await postToResend({
        from: RESEND_FROM,
        to: email,
        subject: WELCOME_SUBJECT,
        // MVP plain-text body. KAN-31 will replace with a templated
        // version (proper HTML, branding, verification CTA, etc.).
        text: `Welcome to Replant, ${firstName}.\n\nYour account is now pending verification. The team will reach out within 30 days.\n\nIn Jesus' name,\nReplant`,
      });
    },

    async sendNewChurchEmail({ churchId, leaderEmail, leaderFullName }) {
      await postToResend({
        from: RESEND_FROM,
        to: TEAM_NOTIFICATIONS_TO,
        subject: NEW_CHURCH_SUBJECT,
        // MVP plain-text. KAN-31 owns template + the destination address
        // moving from this hardcode to a Vault key.
        text: `New church registered in onboarding.\n\nChurch ID: ${churchId}\nLeader: ${leaderFullName} <${leaderEmail}>\n\n— create-account`,
      });
    },

    async rateLimit(ip, emailLower) {
      const key = rateLimitKey(ip, emailLower);
      try {
        const count = await upstashIncr(key);
        if (count === null) {
          return { allowed: true, count: 0 };
        }
        if (count === 1) {
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
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "create-account.upstash-failed",
            message: (e as Error).message,
            ts: new Date().toISOString(),
          }),
        );
        return { allowed: true, count: 0 };
      }
    },

    getIp(req: Request): string {
      const xff = req.headers.get("x-forwarded-for");
      if (xff) return xff.split(",")[0].trim();
      const real = req.headers.get("x-real-ip");
      if (real) return real.trim();
      return "unknown";
    },

    now() {
      return new Date();
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
