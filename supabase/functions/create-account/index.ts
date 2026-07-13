// create-account v8 Edge Function — atomic signup write + underground hardening.
//
// v8 changes (Founder rulings 2026-06-19/20):
//   - Idempotency key REQUIRED on every signup (ruling #28). Header
//     `Idempotency-Key` preferred, falls back to body `idempotencyKey`.
//     Successful 200 responses cached in Upstash with 1h TTL.
//   - Underground founder hardening:
//       • Force rag_status='red' server-side (don't trust FE).
//       • Strip city/lat/lng/address (defense-in-depth on top of the
//         underground_no_location CHECK).
//       • Accept optional show_church_name (default false).
//       • Welcome email = generic underground_pending body — no church
//         type, role, region, country, or "underground" mention
//         (ruling #5 + CONTENT B2).
//       • NO connect@ admin email — underground-pending admin queue
//         picks up via DB row + audit_log_underground only.
//       • No join code auto-generated at signup (Founder ratification
//         2026-06-20: reveal-on-tap, lazy. Hash columns stay NULL until
//         the founding leader explicitly triggers reveal).
//       • is_underground_admin defaults FALSE per ruling #23.
//
// v4-v7 history preserved below.
//
// Per SME-reviewed orphan-prevention architecture (2026-06-14):
// create-account is now the single write boundary for signup. The
// optional newChurch payload is INSERTed atomically alongside the
// public.users row via public.create_account_atomic, which holds the
// transaction open across both inserts. Orphan windows eliminated.
//
// SEC-locked invariants:
//   - verify_jwt = false (pre-auth surface)
//   - Service-role Supabase client used ONLY for: auth admin (create /
//     delete user, list users for resume path), churches contact_email
//     read, and the create_account_atomic RPC
//   - SERVICE_ROLE_KEY never leaves this function's environment
//   - No audit_log writes
//   - Two-layer rate limit: per-IP-only (anti-enumeration) and
//     per-IP-per-email (anti-bruteforce on a single account)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHandler,
  type Deps,
  type CreateAccountAtomicResult,
} from "./handler.ts";
import {
  PER_IP_RATE_LIMIT_MAX,
  perIpRateLimitKey,
  rateLimitKey,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "./logic.ts";
import { send as sendEmailShared } from "../_shared/email/sendEmail.ts";

const FROM = "Replant <noreply@projectreplant.org>";
const TEAM = "connect@projectreplant.org";

interface Cache { resendApiKey: string; }
let cp: Promise<Cache | null> | null = null;

async function loadCache(c: SupabaseClient): Promise<Cache | null> {
  try {
    const { data, error } = await c.rpc("get_resend_api_key");
    if (error || typeof data !== "string" || !data.length) return null;
    return { resendApiKey: data };
  } catch { return null; }
}

function makeDeps(): Deps {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing env");
  const ac: SupabaseClient = createClient(url, key);
  const uu = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const ut = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  async function incr(k: string): Promise<number | null> {
    if (!uu || !ut) return null;
    const r = await fetch(`${uu}/incr/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${ut}` } });
    if (!r.ok) throw new Error(`Upstash INCR ${r.status}`);
    return ((await r.json()) as { result: number }).result;
  }
  async function expire(k: string, s: number): Promise<void> {
    if (!uu || !ut) return;
    const r = await fetch(`${uu}/expire/${encodeURIComponent(k)}/${s}`, { headers: { Authorization: `Bearer ${ut}` } });
    if (!r.ok) throw new Error(`Upstash EXPIRE ${r.status}`);
  }
  async function ttl(k: string): Promise<number> {
    if (!uu || !ut) return RATE_LIMIT_WINDOW_SECONDS;
    const r = await fetch(`${uu}/ttl/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${ut}` } });
    if (!r.ok) throw new Error(`Upstash TTL ${r.status}`);
    const { result } = (await r.json()) as { result: number };
    return result > 0 ? result : RATE_LIMIT_WINDOW_SECONDS;
  }

  // v8 — idempotency cache. GET returns null on miss / no backend. SETEX
  // stores with explicit TTL (one round-trip vs SET + EXPIRE).
  async function idempGet(k: string): Promise<string | null> {
    if (!uu || !ut) return null;
    const r = await fetch(`${uu}/get/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash GET ${r.status}`);
    const { result } = (await r.json()) as { result: string | null };
    return result ?? null;
  }
  async function idempSetEx(k: string, v: string, sec: number): Promise<void> {
    if (!uu || !ut) return;
    const r = await fetch(`${uu}/setex/${encodeURIComponent(k)}/${sec}/${encodeURIComponent(v)}`, {
      headers: { Authorization: `Bearer ${ut}` },
    });
    if (!r.ok) throw new Error(`Upstash SETEX ${r.status}`);
  }
  function cache(): Promise<Cache | null> {
    if (!cp) {
      cp = loadCache(ac).catch(() => { cp = null; return null; });
    }
    return cp;
  }
  return {
    async findAuthUserByEmail(e) {
      let p = 1;
      const pp = 200;
      while (true) {
        const { data, error } = await ac.auth.admin.listUsers({ page: p, perPage: pp });
        if (error) throw new Error(`listUsers: ${error.message}`);
        const u = data?.users ?? [];
        const h = u.find(x => (x.email ?? "").toLowerCase() === e);
        if (h) return { id: h.id, email: h.email ?? e };
        if (u.length < pp) return null;
        p++;
        if (p > 50) return null;
      }
    },
    async findPublicUserByAuthId(id) {
      const { data, error } = await ac.from("users").select("id").eq("auth_id", id).maybeSingle();
      if (error) throw new Error(`public lookup: ${error.message}`);
      return data ? { id: data.id as string } : null;
    },
    async createAuthUser({ email, password }) {
      const { data, error } = await ac.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data?.user) throw new Error(error?.message ?? "no user");
      return { id: data.user.id, email: data.user.email ?? email };
    },
    async deleteAuthUser(id) {
      const { error } = await ac.auth.admin.deleteUser(id);
      if (error) throw new Error(`deleteUser: ${error.message}`);
    },
    async createAccountAtomic(
      authId,
      leader,
      newChurch,
      existingChurchId,
      branchOfChurchId,
      pendingParentClaim,
      isHeadquarters,
    ): Promise<CreateAccountAtomicResult> {
      const { data, error } = await ac.rpc("create_account_atomic", {
        p_auth_id: authId,
        p_leader: leader,
        p_new_church: newChurch,
        p_existing_church_id: existingChurchId,
        p_branch_of_church_id: branchOfChurchId ?? null,
        p_pending_parent_claim: pendingParentClaim ?? null,
        p_is_headquarters: isHeadquarters ?? false,
      });
      if (error) {
        // Re-throw with PostgrestError shape preserved so the handler
        // can map ERRCODEs without losing context.
        const wrapped = new Error(error.message) as Error & {
          code?: string; details?: string; hint?: string;
        };
        if (error.code) wrapped.code = error.code;
        if (error.details) wrapped.details = error.details;
        if (error.hint) wrapped.hint = error.hint;
        throw wrapped;
      }
      // RPC returns SETOF (user_id, church_id). PostgREST surfaces as array.
      const row = Array.isArray(data) && data.length > 0
        ? (data[0] as { user_id?: string; church_id?: string | null })
        : null;
      if (!row || !row.user_id) {
        throw new Error("create_account_atomic: empty result");
      }
      return {
        userId: row.user_id,
        churchId: row.church_id ?? null,
      };
    },
    async getChurchInfo(id) {
      const { data, error } = await ac
        .from("churches")
        .select("contact_email, verification_status, verification_deadline")
        .eq("id", id)
        .single();
      if (error || !data) return null;
      const row = data as {
        contact_email: string | null;
        verification_status: string;
        verification_deadline: string | null;
      };
      return {
        contact_email: row.contact_email ?? null,
        verification_status: row.verification_status,
        verification_deadline: row.verification_deadline ?? null,
      };
    },
    async sendWelcomeEmail({ email, firstName, userId, kind, daysRemaining, churchType }) {
      // Copy RATIFIED Founder 2026-07-13 (G14 copy review). Written for
      // the leader whose FIRST-EVER Replant touchpoint may be this email
      // (came via social / word of mouth, never saw the website): each
      // body says what Replant IS before saying what to do next.
      // Sign-off is "— The Replant Team" per the no-liturgical-signoff
      // ruling; John 17:21 closes as a scripture block (identity, not
      // signature). Plain text mirrors the existing send pattern.
      //
      // CONTENT F6 (2026-06-18): conditional "church" → "organization" swap
      // for para_ministry. A missions agency director receiving "Your church
      // is verified" reads wrong day-one.
      const churchOrOrg = churchType === "para_ministry" ? "organization" : "church";

      // Shared identity line — pending + skip audiences may know nothing
      // about Replant yet; verified leaders join an established church
      // and get the tour instead.
      const identity =
        `Replant is a space for leaders like you — those who carry a congregation, ` +
        `a calling, or a work the Lord has placed in their hands — to stand together ` +
        `with the Body of Christ across the globe.`;

      const helpLine =
        `If anything is unclear, write to us at accounts@projectreplant.org — we're glad to help.`;

      const close =
        `We're grateful you've come. See you in the network.\n\n` +
        `— The Replant Team\n\n` +
        `"That they all may be one, as thou, Father, art in me, and I in thee, ` +
        `that they also may be one in us: that the world may believe that thou hast sent me."\n` +
        `John 17:21 — KJV`;

      let body: string;
      let subject = "Welcome to Replant";
      if (kind === "underground_pending") {
        // v8 (Founder ruling #5 + CONTENT B2, 2026-06-19) — generic
        // pending body for underground founders AND underground
        // join-by-code second leaders. Used VERBATIM. Email channel is
        // treated as compromised by default: NO church name, no role,
        // no region, no country, no "underground" word, no first-name
        // personalization (a hostile reader of the inbox should learn
        // nothing about the recipient). Status comms move in-app.
        subject = "Your Replant registration";
        body =
          `Hello,\n\n` +
          `Thank you for completing your registration with Replant.\n\n` +
          `Your application is being reviewed by our team. You will receive a\n` +
          `follow-up message once the review is complete. This typically takes\n` +
          `up to 30 days.\n\n` +
          `To check your status, please sign in to the Replant app.\n\n` +
          `We are praying for you.\n\n` +
          `— The Replant Team\n` +
          `projectreplant.org`;
      } else if (kind === "skip") {
        // "7 days" hardcode is accurate — this email fires at second
        // zero of account creation (Founder-confirmed 2026-07-13).
        body =
          `Welcome to Replant, ${firstName}.\n\n` +
          `We're glad you're here. ${identity}\n\n` +
          `Your account is set up. You have 7 days to register your church or ` +
          `organization, or to join one already on Replant — the app will walk you through it.\n\n` +
          `While you look around:\n\n` +
          `Visit the Prayer Wall to see what leaders around the world have been ` +
          `burdened with, and lift one of them up. Keep track of what's moving in ` +
          `the body through the Home feed. This network runs on intercession before ` +
          `anything else.\n\n` +
          `${helpLine}\n\n` +
          close;
      } else if (kind === "verified_church") {
        body =
          `Welcome to Replant, ${firstName}.\n\n` +
          `Your ${churchOrOrg} is verified, and the network is open to you. ` +
          `The Replant team will reach out shortly to confirm your account.\n\n` +
          `Now that you're in:\n\n` +
          `Take a look around. Explore the Church at Large and see where the body ` +
          `is standing. Reach out to a leader across the globe in the Connect tab. ` +
          `Bring what your people are carrying to the Prayer Wall. This space is ` +
          `just the beginning — the Body of Christ connecting at a scale many of ` +
          `us were never able to reach before.\n\n` +
          close;
      } else {
        // pending_church
        const dayWord = daysRemaining === 1 ? "day" : "days";
        const safeDays = daysRemaining ?? 30;
        body =
          `Welcome to Replant, ${firstName}.\n\n` +
          `We're excited you've joined. ${identity}\n\n` +
          `Your ${churchOrOrg} is being reviewed by our team, and we'll reach out ` +
          `within ${safeDays} ${dayWord}. Your account stays active the whole time.\n\n` +
          `While you wait:\n\n` +
          `Visit the Prayer Wall to see what leaders around the world have been ` +
          `burdened with, and lift one of them up. Keep track of what's moving in ` +
          `the body through the Home feed. The full network opens the moment your ` +
          `${churchOrOrg} is verified.\n\n` +
          `${helpLine}\n\n` +
          close;
      }

      // KAN-80 G14 — routed through the shared sendEmail contract:
      // email_log-anchored (per-day dedup on user+tag), webhook
      // delivery-tracked; opaque tags per the ratified map. Bodies are
      // the Founder-ratified 2026-07-13 copy (underground body verbatim
      // per the 2026-06-19 lock — untouched).
      const WELCOME_TAGS: Record<string, string> = {
        skip: "welcome_t23",
        pending_church: "welcome_t14",
        verified_church: "welcome_t29",
        underground_pending: "welcome_t08",
      };
      const c = await cache();
      if (!c) return;
      const result = await sendEmailShared(ac, c.resendApiKey, {
        template: WELCOME_TAGS[kind] ?? "welcome_t14",
        to: email,
        subject,
        text: body,
        from: FROM,
        logUserId: userId,
      });
      if (!result.success) throw new Error(`sendEmail: ${result.reason}`);
    },
    async sendNewChurchEmail({ churchId, leaderEmail, leaderFullName, triggeredByUserId }) {
      const c = await cache();
      if (!c) return;
      const result = await sendEmailShared(ac, c.resendApiKey, {
        template: "notify_t36",
        to: TEAM,
        subject: "New church registered — Replant",
        text: `New church registered in onboarding.\n\nChurch ID: ${churchId}\nLeader: ${leaderFullName} <${leaderEmail}>\n\n— create-account`,
        from: FROM,
        logUserId: null,
        idempotencyKey: `notify_t36:${churchId}`,
        triggeredBy: triggeredByUserId,
      });
      if (!result.success) throw new Error(`sendEmail: ${result.reason}`);
    },
    async rateLimit(ip, email) {
      const k = rateLimitKey(ip, email);
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
          level: "warn", event: "upstash-failed", message: (e as Error).message,
          ts: new Date().toISOString(),
        }));
        // Strict fail-CLOSED (pre-UAT audit 2026-07-01): was fail-open — reject on Upstash outage.
        return { allowed: false, backendError: true };
      }
    },
    async perIpRateLimit(ip) {
      const k = perIpRateLimitKey(ip);
      try {
        const n = await incr(k);
        if (n === null) return { allowed: true, count: 0 };
        if (n === 1) await expire(k, RATE_LIMIT_WINDOW_SECONDS);
        if (n > PER_IP_RATE_LIMIT_MAX) {
          const s = await ttl(k).catch(() => RATE_LIMIT_WINDOW_SECONDS);
          return { allowed: false, retryAfterSeconds: s };
        }
        return { allowed: true, count: n };
      } catch (e) {
        console.warn(JSON.stringify({
          level: "warn", event: "upstash-per-ip-failed", message: (e as Error).message,
          ts: new Date().toISOString(),
        }));
        // Strict fail-CLOSED (pre-UAT audit 2026-07-01): was fail-open — reject on Upstash outage.
        return { allowed: false, backendError: true };
      }
    },
    async idempotencyCacheGet(k: string): Promise<string | null> {
      return await idempGet(k);
    },
    async idempotencyCacheSet(k: string, v: string, sec: number): Promise<void> {
      await idempSetEx(k, v, sec);
    },
    getIp(req: Request): string {
      const x = req.headers.get("x-forwarded-for");
      if (x) return x.split(",")[0].trim();
      const r = req.headers.get("x-real-ip");
      if (r) return r.trim();
      return "unknown";
    },
    now() { return new Date(); },
    log(l, e, f) {
      const line = JSON.stringify({ level: l, event: e, ...f, ts: new Date().toISOString() });
      if (l === "error") console.error(line);
      else if (l === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

const handler = createHandler(makeDeps());
Deno.serve(handler);
