// KAN-12 search-churches Edge Function — onboarding church picker.
//
// SEC-locked invariants:
//   - verify_jwt = false at the platform (config.toml). This endpoint is
//     called BEFORE the user's auth.users row exists. Any change requires
//     a fresh SEC ruling.
//   - Source view: `public.churches_public` (live def: `is_active = true
//     AND type <> 'underground'`). Underground churches are invisible to
//     this search by design (admin-only path per D-16 / BA Flags 30 Apr).
//   - No write operations. Read-only SELECT against churches_public
//     joined to public.users for capacity computation.
//   - Capacity check is server-side: the FE receives `at_capacity:
//     boolean`, not a raw leader count, so the client cannot lie about
//     capacity. The atomic capacity guard in `create-account` re-runs
//     this check at write time as defense-in-depth.
//   - 10 req/hr per IP via Upstash. Read-only surface gets a generous
//     cap (a leader typing through "Maranatha Ministries" debounced is
//     ~6-8 calls); write surface `create-account` gets a much tighter cap.
//
// Contract source: KAN-12 description + DBA c.13321 (Bonus: direct FK,
// not association table).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createHandler,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  rateLimitKey,
  SEARCH_RESULT_LIMIT,
  type Deps,
} from "./handler.ts";
import { type ChurchResult, isAtCapacity } from "./logic.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── Upstash REST helpers (per-IP hourly rate limit) ───
  //
  // Same pattern as check-email-available — INCR + EX on first hit,
  // disallow once count > MAX. Fail-open if Upstash unreachable; the
  // cap is a brake on enumeration probes, not a hard correctness
  // boundary.
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
    async searchChurches(query: string): Promise<ChurchResult[]> {
      // KAN-192 — RPL Network ID format detect. Founder confirmed
      // (2026-06-12, c.15743) that the church-search input also accepts
      // the canonical RPL-XXXXX church_code. When the query matches the
      // format we route through a two-step lookup: first resolve the
      // church_code → id against public.churches (church_code is NOT
      // exposed on the churches_public view), then SELECT the church
      // row from churches_public by id. The second step still filters
      // out underground / inactive churches because churches_public
      // bakes that filter into its definition — i.e. a leader searching
      // an underground RPL ID gets zero results, same as a search by
      // name/city.
      let churches:
        | Array<{
          id: string;
          name: string;
          type: string;
          city: string;
          country: string;
          rag_status: string;
          verification_status: string;
        }>
        | null = null;
      let searchErr: { message?: string } | null = null;

      if (RPL_ID_RE.test(query.trim())) {
        const normalised = query.trim().toUpperCase();
        const { data: codeMatch, error: codeErr } = await adminClient
          .from("churches")
          .select("id")
          .eq("church_code", normalised)
          .maybeSingle();
        if (codeErr) {
          searchErr = codeErr;
        } else if (!codeMatch) {
          churches = [];
        } else {
          const { data: rows, error: rowErr } = await adminClient
            .from("churches_public")
            .select("id, name, type, city, country, rag_status, verification_status")
            .eq("id", codeMatch.id as string)
            .limit(1);
          churches = rows ?? null;
          searchErr = rowErr ?? null;
        }
      } else {
        // KAN-192 (Founder, 2026-06-12) — search is church-name-only
        // (or RPL Network ID via the branch above). City matches were
        // dropped on Founder's call so the search surface stays focused
        // on the two canonical identifiers a leader knows about.
        // ILIKE bracket-escapes via the supabase-js .ilike() helper —
        // the user input is bound, not concatenated, so wildcards in
        // the user's typed string are treated as literal `%` / `_`
        // characters only against the substring delimiters (`%query%`)
        // that we control.
        const pattern = `%${escapeLikeWildcards(query)}%`;
        const { data: rows, error: rowErr } = await adminClient
          .from("churches_public")
          .select("id, name, type, city, country, rag_status, verification_status")
          .ilike("name", pattern)
          .order("name", { ascending: true })
          .limit(SEARCH_RESULT_LIMIT);
        churches = rows ?? null;
        searchErr = rowErr ?? null;
      }

      if (searchErr) {
        throw new Error(`churches_public search: ${searchErr.message}`);
      }
      const rows = churches ?? [];
      if (rows.length === 0) return [];

      // Round 2 — fetch active leaders for the result set in one shot.
      // We pull one row per active leader (not a server-side GROUP BY,
      // since PostgREST can't express that cleanly) and count in JS.
      // Worst-case row count: 20 churches × 2 leaders = 40 rows. Cheap.
      const ids = rows.map((r) => r.id as string);
      const { data: leaders, error: leadersErr } = await adminClient
        .from("users")
        .select("church_id")
        .in("church_id", ids)
        .eq("is_active", true);

      if (leadersErr) {
        throw new Error(`users leader-count: ${leadersErr.message}`);
      }

      const countByChurch = new Map<string, number>();
      for (const l of leaders ?? []) {
        const cid = l.church_id as string;
        countByChurch.set(cid, (countByChurch.get(cid) ?? 0) + 1);
      }

      return rows
        .map((r) => {
          const leaderCount = countByChurch.get(r.id as string) ?? 0;
          return {
            id: r.id as string,
            name: r.name as string,
            type: r.type as string,
            city: r.city as string,
            country: r.country as string,
            rag_status: r.rag_status as string,
            verification_status: r.verification_status as string,
            at_capacity: isAtCapacity(leaderCount),
            leader_count: leaderCount,
          };
        })
        // KAN-203 B33/B34 — filter out churches with no active leader.
        // Orphan sources: (1) RegCP1 edit-flow calls register-church on
        // every Apply Changes, creating new public.churches rows and
        // leaving prior ones leaderless (B33); (2) ASP2 Clear / Replace
        // drops FE state but doesn't delete the DB row (B34). DBA
        // confirmed leader_count is join-computed, active-only
        // (is_active = true), never null (KAN-12 c.14156). Full fix —
        // register-church PATCH + a DELETE path for cleared loopbacks
        // — is Post-MVP (KAN-202 tracks the pg_cron scrub). This filter
        // is the near-term mitigation: rows remain in DB but are
        // invisible to the search surface.
        .filter((r) => r.leader_count > 0);
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
        // Upstash unavailable — fail-open + warn.
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "search-churches.upstash-failed",
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
      const line = JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

/**
 * Escape PostgREST's ILIKE wildcards in user input so a typed `%` or `_`
 * matches literally rather than as a wildcard. The function-controlled
 * `%query%` delimiters are NOT escaped (those are our wildcards, not the
 * user's).
 *
 * Bracketed-escape via Postgres' LIKE escape syntax: ``\%`` and ``\_``,
 * with the ``\`` itself first escaped to ``\\``. Order matters — backslash
 * must be done first.
 */
function escapeLikeWildcards(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// KAN-192 — RPL Network ID format. Mirrors FE detection in
// AccountSetupPage2Screen.tsx (isRplIdQuery). Format: `RPL-` followed
// by 4+ alphanumeric chars, case-insensitive. The lookup against
// churches.church_code is case-insensitive via uppercase normalisation
// because admin-dash displays IDs uppercase and seeds enforce that.
const RPL_ID_RE = /^RPL-[A-Z0-9]{4,}$/i;

const handler = createHandler(makeDeps());

Deno.serve(handler);
