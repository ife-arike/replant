// KAN-192 register-church-delete Edge Function — onboarding bypass-card
// user-initiated delete of a just-registered church.
//
// SEC-locked invariants (mirrors register-church + search-churches):
//   - verify_jwt = false at the platform (config.toml). This endpoint
//     is called BEFORE the leader's auth.users row exists. Any change
//     requires a fresh SEC ruling.
//   - DELETE is gated by three orthogonal proof-of-ownership signals:
//     contact_email match + session window + zero linked users.
//   - No SECURITY DEFINER RPC calls, no audit_log writes — the row's
//     full lifecycle (created → deleted in same session) is internal
//     to onboarding and not an administrative action.
//   - 5 req/hr per IP via Upstash. Tighter than search-churches'
//     10/hr because the delete surface is rare.
//
// Contract source: KAN-192 c.15743 (Founder scope rulings 2026-06-12).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  classifyDeleteFailure,
  type DeleteChurchPayload,
  type DeleteOutcome,
  normaliseEmail,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  rateLimitKey,
  SESSION_WINDOW_SECONDS,
} from "./logic.ts";
import { createHandler, type Deps } from "./handler.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── Upstash REST helpers (per-IP hourly rate limit) ───
  //
  // Same pattern as search-churches. INCR + EX on first hit, deny once
  // count > MAX. Fail-open if Upstash unreachable; the cap is a brake
  // on enumeration probes, not a hard correctness boundary.
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

  return {
    async attemptDelete(payload: DeleteChurchPayload): Promise<DeleteOutcome> {
      // Round 1 — guarded DELETE. We don't try the delete WITHOUT the
      // guards first because the FK from users.church_id will block
      // any DELETE referenced by a user anyway (NO ACTION → 23503).
      // Instead we run a single DELETE with all three invariants in
      // the WHERE clause; on a 0-row miss the diagnostic round below
      // tells us WHY.
      const sessionCutoff = new Date(
        Date.now() - SESSION_WINDOW_SECONDS * 1000,
      ).toISOString();

      const { data: deleted, error: delErr } = await adminClient
        .from("churches")
        .delete()
        .eq("id", payload.churchId)
        .gte("created_at", sessionCutoff)
        // Comparison is case-sensitive at the DB layer; payload is
        // already normalised by logic.ts but we normalise again
        // here defensively (mirrors what register-church writes).
        .eq("contact_email", payload.contactEmail)
        .select("id");

      if (delErr) {
        // 23503 = foreign_key_violation. The most likely cause is a
        // race with create-account where the user row was inserted
        // between our row read and the delete. Translate to
        // `leader_linked` (409) without further diagnostic rounds.
        if (
          typeof delErr.code === "string" &&
          delErr.code === "23503"
        ) {
          return { kind: "leader_linked" };
        }
        throw new Error(
          `churches delete: ${delErr.code ?? ""} ${delErr.message ?? ""}`,
        );
      }
      if (deleted && deleted.length > 0) {
        return { kind: "deleted" };
      }

      // Round 2 — diagnostic SELECT. We need to know whether the row
      // is missing (404), the contact_email mismatched (403), the
      // session expired (410), or it has linked users (409).
      const { data: row, error: rowErr } = await adminClient
        .from("churches")
        .select("contact_email, created_at")
        .eq("id", payload.churchId)
        .maybeSingle();

      if (rowErr) {
        throw new Error(
          `churches diagnostic select: ${rowErr.code ?? ""} ${rowErr.message ?? ""}`,
        );
      }

      // Round 3 — linked-user check (only if row exists). Cheap, one
      // row fetch with .limit(1) — we only need a boolean.
      let hasLinkedUsers = false;
      if (row) {
        const { data: linked, error: linkedErr } = await adminClient
          .from("users")
          .select("id", { count: "exact", head: false })
          .eq("church_id", payload.churchId)
          .limit(1);
        if (linkedErr) {
          throw new Error(
            `users linked check: ${linkedErr.code ?? ""} ${linkedErr.message ?? ""}`,
          );
        }
        hasLinkedUsers = !!linked && linked.length > 0;
      }

      return classifyDeleteFailure(
        payload,
        row
          ? {
            contact_email: row.contact_email as string | null,
            created_at: row.created_at as string,
          }
          : null,
        hasLinkedUsers,
        new Date(),
      );
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
            event: "register-church-delete.upstash-failed",
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

    log(level, event, fields) {
      const line = JSON.stringify({
        level,
        event,
        ...fields,
        ts: new Date().toISOString(),
      });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

// normaliseEmail is exported by logic.ts for reuse by the FE — re-export
// here is intentional to keep handler.ts free of the dep.
void normaliseEmail;

const handler = createHandler(makeDeps());

Deno.serve(handler);
