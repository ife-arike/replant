// KAN-304 submit-report Edge Function — leader-facing report intake wrapper.
//
// STORE BLOCKER: Apple 1.2(b) + Play UGC — in-app reporting on every surface.
//
// ── Architecture (panel-ratified) ──
// The transactional core is the SECURITY DEFINER RPC submit_content_report
// (BE lane §3: native auth context + single transaction — audit-first, dedupe,
// UG auto-route, snapshot all commit-or-rollback together). This edge function
// is the THIN wrapper the SEC/CONTENT/register lanes assign to the intake
// surface for the two things the RPC cannot do:
//   1. The fail-OPEN-alarmed rate limiter (register §C C-3 — a deliberate,
//      Founder-ruled DEVIATION from signup's fail-CLOSED: blocking a report
//      during a limiter outage silences a raised hand; intake is authenticated
//      and post-hoc, and the PRIMARY bombing control is the DB-side dedupe which
//      survives a Redis outage). On limiter INFRA failure we ACCEPT + ALARM.
//   2. The free-text FLAG_TAXONOMY scan (the TS matcher lives in _shared/... ;
//      Postgres has no matcher). We pass matched code NAMES only into the RPC —
//      never patterns (AC-12 / SEC c.11750). Scan failure never blocks
//      (DELIVER-ALWAYS): a scan error degrades to an empty match set.
//
// ── Load-bearing invariants ──
//   • verify_jwt = true at the platform (config.toml). A forged/expired JWT is
//     rejected before this handler runs. The RPC is called through the CALLER's
//     JWT (Authorization forwarded) so auth.uid() resolves the real reporter;
//     no service-role client is used here.
//   • ZERO content-row writes: this function only calls the RPC; the RPC touches
//     no content row (SEC §1.1).
//   • UNIFORM response (anti-oracle, SEC §1.2): the HTTP body is identical across
//     new / duplicate / invalid / not-visible — always {ok:true}. The only honest
//     deviations are 429 (the reporter's OWN rate) and 503 (a genuine write
//     failure — a safety signal must never be silently dropped). not_authenticated
//     / not_verified map to 401 (pre-intake auth, not a target oracle).
//   • SAFE-LOG: structured logs carry event + counters only — never reporter id,
//     target id, reason, or free text.
//
// verify_jwt change requires a fresh SEC ruling.

import { createClient } from "@supabase/supabase-js";
import { collectMatches } from "../send-message/matcher.ts";
import { loadTaxonomy, type Taxonomy } from "../send-message/taxonomy.ts";

// ── Rate-limit calibration (SEC §7.3; panel-tunable) ──
const RL_WINDOW_SECONDS = 24 * 60 * 60; // 24h rolling window
const RL_MAX_REQUESTS = 10; // 10 reports / 24h / reporter
const RL_BURST_WINDOW_SECONDS = 10 * 60; // 10 min
const RL_BURST_MAX = 3; // 3 reports / 10 min / reporter

const VALID_TARGET_TYPES = new Set([
  "dm_message",
  "branch_message",
  "prayer_request",
  "testimony",
  "comment",
  "church_profile",
]);
const VALID_REASONS = new Set([
  "locate_identify",
  "threats",
  "asking_for_money",
  "impersonation",
  "false_teaching",
  "spam",
  "wellbeing_concern",
  "something_else",
]);
const DETAIL_MAX = 500;

// ── Eager taxonomy load at cold-start (mirrors send-message) ──
const taxonomy: Taxonomy | null = loadTaxonomy(Deno.env.get("FLAG_TAXONOMY"));

const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

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

/**
 * Fail-OPEN-ALARMED reporter rate limiter (register §C C-3).
 *
 * Two fixed windows keyed by the reporter's auth subject (NOT ip — one leader's
 * throttle must never block another's report; SEC §7.3):
 *   - 10 / 24h  · 3 / 10min burst.
 * On Upstash INFRA failure we return allowed=true AND emit an ALARM-level log
 * (the SOC alarm path) — the report is accepted, the outage is flagged. This is
 * the deliberate deviation from the house fail-closed-on-abuse posture; the DB
 * dedupe (RPC) remains the primary bombing control during the outage.
 */
async function rateLimit(sub: string): Promise<{ allowed: boolean }> {
  if (!upstashUrl || !upstashToken) {
    // Limiter not configured — accept + alarm (do not silently drop).
    log("error", "submit-report.ratelimit.unconfigured.failopen", { alarm: true });
    return { allowed: true };
  }
  try {
    const dayKey = `report:rl:d:${sub}`;
    const burstKey = `report:rl:b:${sub}`;

    const dayCount = await upstashIncr(dayKey);
    if (dayCount === 1) await upstashExpire(dayKey, RL_WINDOW_SECONDS);
    const burstCount = await upstashIncr(burstKey);
    if (burstCount === 1) await upstashExpire(burstKey, RL_BURST_WINDOW_SECONDS);

    if ((dayCount ?? 0) > RL_MAX_REQUESTS || (burstCount ?? 0) > RL_BURST_MAX) {
      return { allowed: false };
    }
    return { allowed: true };
  } catch (e) {
    // Upstash unreachable — FAIL OPEN + ALARM (register §C C-3).
    log("error", "submit-report.ratelimit.infra.failopen", {
      alarm: true,
      message: (e as Error).message,
    });
    return { allowed: true };
  }
}

// Uniform success response — identical body for new/duplicate/invalid/not-visible.
function uniformOk(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    // verify_jwt=true normally catches this at the gateway; belt for local/dev.
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    log("error", "submit-report.env.missing", {});
    return new Response(JSON.stringify({ error: "write_failed" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  // JWT-scoped client: the RPC's auth.uid() resolves the real reporter. No
  // service-role client — the SECURITY DEFINER RPC does its own privileged work.
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const sub = userData.user.id;

  // ── Parse + validate payload. Malformed input is discarded behind the uniform
  // success (an ID-probing client must learn nothing) — the ONLY exceptions are
  // auth (401) and a genuine downstream write failure (503).
  let body: {
    target_type?: unknown;
    target_id?: unknown;
    reason_code?: unknown;
    detail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return uniformOk();
  }

  const target_type = typeof body.target_type === "string" ? body.target_type : "";
  const target_id = typeof body.target_id === "string" ? body.target_id : "";
  const reason_code = typeof body.reason_code === "string" ? body.reason_code : "";
  let detail = typeof body.detail === "string" ? body.detail : null;

  if (!VALID_TARGET_TYPES.has(target_type) || !VALID_REASONS.has(reason_code) || !target_id) {
    // Malformed — uniform success, nothing learned. (The RPC would also reject.)
    return uniformOk();
  }
  if (detail !== null) {
    detail = detail.trim();
    if (detail.length === 0) detail = null;
    else if (detail.length > DETAIL_MAX) detail = detail.slice(0, DETAIL_MAX);
  }

  // ── Rate limit (reporter-keyed; fail-open-alarmed). A trip is one of the two
  // honest deviations from the uniform response (429 — the reporter's OWN rate).
  const rl = await rateLimit(sub);
  if (!rl.allowed) {
    log("info", "submit-report.ratelimited", {}); // no reporter id in the line
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  // ── Free-text scan → matched code NAMES only (never patterns). DELIVER-ALWAYS:
  // any scan error degrades to an empty set and never blocks the report.
  let matchedCodes: string[] = [];
  if (detail) {
    try {
      const result = collectMatches(detail, taxonomy);
      matchedCodes = result.matches.map((c) => c.code);
    } catch (e) {
      log("warn", "submit-report.scan.failed", { message: (e as Error).message });
      matchedCodes = [];
    }
  }

  // ── Call the transactional intake RPC through the caller's JWT.
  const { data, error } = await client.rpc("submit_content_report", {
    p_target_type: target_type,
    p_target_id: target_id,
    p_reason_code: reason_code,
    p_detail: detail,
    p_ratelimit_ok: true, // the edge limiter already passed (or failed open)
    p_matched_codes: matchedCodes.length > 0 ? matchedCodes : null,
  });

  if (error) {
    // Transport/DB error reaching the RPC — a safety signal must not vanish.
    log("error", "submit-report.rpc.error", { message: error.message });
    return new Response(JSON.stringify({ error: "write_failed" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const envelope = (data ?? {}) as { ok?: boolean; error?: string };

  // Map the RPC's uniform envelope to the uniform HTTP contract.
  if (envelope.error === "rate_limited") {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  if (envelope.error === "not_authenticated" || envelope.error === "not_verified") {
    return new Response(JSON.stringify({ error: envelope.error }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  if (envelope.error === "write_failed") {
    log("error", "submit-report.rpc.write_failed", {});
    return new Response(JSON.stringify({ error: "write_failed" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  // ok:true (new OR duplicate OR silently-discarded invalid) → uniform success.
  // The 'duplicate' flag is intentionally NOT surfaced to the client (anti-oracle):
  // "already reported" is a CLIENT-side in-session hint, never a server signal.
  return uniformOk();
});
