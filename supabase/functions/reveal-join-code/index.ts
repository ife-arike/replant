// reveal-join-code Edge Function — lazy one-shot reveal of the
// underground join code for the founding leader.
//
// Per Founder ratification 2026-06-20 (tap-through, not auto-revealed):
//   - auth-status-check reports underground_join_code_pending_reveal:true
//     when (church verified) AND (caller is founding leader) AND (no
//     prior reveal). FE shows "code ready to view" prompt.
//   - Leader taps through a 2-step gate ("I'm somewhere private" → "Show
//     me the code"). FE calls THIS function on the final tap.
//   - This function calls public.reveal_underground_join_code(p_church_id)
//     which mints + hashes + sets revealed_at + audits, returns plaintext.
//   - The plaintext goes back to the FE in a single response and is
//     NEVER stored anywhere — not in logs, not in Sentry, not in
//     Upstash. The idempotency cache stores a tombstone { revealed: true }
//     — NOT the plaintext.
//   - Subsequent calls (any path) raise 'already_revealed' from the RPC.
//     We map to 410 code_already_consumed. Admin rotation is the only
//     recovery path.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ERROR_CODES = {
  IDEMPOTENCY_KEY_REQUIRED: "idempotency_key_required",
  VALIDATION_ERROR: "validation_error",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  NOT_AUTHORIZED: "not_authorized",
  CODE_ALREADY_CONSUMED: "code_already_consumed",
  INTERNAL_ERROR: "internal_error",
  METHOD_NOT_ALLOWED: "method_not_allowed",
} as const;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.+/=]{16,128}$/;
const IDEMPOTENCY_CACHE_TTL_SECONDS = 3600;

function isValidIdempotencyKey(v: unknown): v is string {
  return typeof v === "string" && IDEMPOTENCY_KEY_RE.test(v);
}
function idempotencyCacheKey(rawKey: string): string {
  return `reveal-join-code:idemp:${rawKey}`;
}

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const err = (s: number, code: string) =>
  json(s, { error: code });

function djb2(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceRoleKey) throw new Error("Missing Supabase env");

const adminClient: SupabaseClient = createClient(url, serviceRoleKey);

const uu = Deno.env.get("UPSTASH_REDIS_REST_URL");
const ut = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

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

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>): void {
  // Defensive scrub — never emit plaintext-shaped fields. The body of
  // this function intentionally never passes plaintext into log fields,
  // but a future drift could. Drop suspicious keys as a backstop.
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
}

async function handle(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") return err(405, ERROR_CODES.METHOD_NOT_ALLOWED);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return err(401, ERROR_CODES.UNAUTHORIZED);
    }

    // Validate JWT via user-scoped client.
    const userClient = createClient(url!, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return err(401, ERROR_CODES.UNAUTHORIZED);
    const authUid = userData.user.id;
    if ((userData.user.role ?? "anon") === "anon") return err(401, ERROR_CODES.UNAUTHORIZED);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return err(400, ERROR_CODES.VALIDATION_ERROR);
    }

    const headerKey = req.headers.get("Idempotency-Key");
    const bodyKey = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).idempotencyKey
      : undefined;
    const rawIdempKey = (typeof headerKey === "string" && headerKey.length > 0)
      ? headerKey.trim()
      : (typeof bodyKey === "string" ? bodyKey.trim() : "");
    if (!isValidIdempotencyKey(rawIdempKey)) {
      return err(400, ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
    }

    // Idempotency cache: if we've already seen this key, we MUST NOT
    // re-call the RPC (it'd raise already_revealed). Tombstone-only —
    // never the plaintext.
    const idempKey = idempotencyCacheKey(rawIdempKey);
    try {
      const cached = await upstashGet(idempKey);
      if (cached) {
        log("info", "reveal_idempotency_replay", {
          auth_uid_hash: djb2(authUid),
        });
        // Per spec: "If the leader retries with the same idempotency
        // key, return code_already_consumed." We never replay the
        // plaintext from cache; only an already-consumed answer.
        return err(410, ERROR_CODES.CODE_ALREADY_CONSUMED);
      }
    } catch (e) {
      log("warn", "idempotency_cache_get_failed", { message: (e as Error).message });
    }

    // Resolve caller's church via admin client. Confirm:
    //   - viewer's church type = 'underground'
    //   - viewer is the founding leader (oldest active leader)
    //   - church is verified
    //   - church not already revealed
    // (The RPC also enforces founding-leader + underground + not-revealed,
    // but we pre-check here so we can return precise 401/404 errors
    // instead of the RPC's generic exception strings.)
    const { data: userRow, error: userRowErr } = await adminClient
      .from("users")
      .select("id, church_id, is_active")
      .eq("auth_id", authUid)
      .maybeSingle();
    if (userRowErr || !userRow) return err(401, ERROR_CODES.UNAUTHORIZED);
    if (userRow.is_active !== true) return err(401, ERROR_CODES.UNAUTHORIZED);
    if (!userRow.church_id) return err(404, ERROR_CODES.NOT_FOUND);

    const callerUserId = userRow.id as string;
    const churchId = userRow.church_id as string;

    const { data: churchRow, error: churchRowErr } = await adminClient
      .from("churches")
      .select("id, type, verification_status, underground_join_code_revealed_at")
      .eq("id", churchId)
      .single();
    if (churchRowErr || !churchRow) return err(404, ERROR_CODES.NOT_FOUND);
    if (churchRow.type !== "underground") return err(403, ERROR_CODES.NOT_AUTHORIZED);
    if (churchRow.verification_status !== "verified") {
      return err(403, ERROR_CODES.NOT_AUTHORIZED);
    }
    if (churchRow.underground_join_code_revealed_at !== null) {
      return err(410, ERROR_CODES.CODE_ALREADY_CONSUMED);
    }

    // Founding leader = oldest active leader on this church.
    const { data: foundingRows, error: foundingErr } = await adminClient
      .from("users")
      .select("id")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1);
    if (foundingErr || !foundingRows || foundingRows.length === 0) {
      return err(403, ERROR_CODES.NOT_AUTHORIZED);
    }
    const foundingLeaderId = foundingRows[0].id as string;
    if (foundingLeaderId !== callerUserId) {
      return err(403, ERROR_CODES.NOT_AUTHORIZED);
    }

    // Call the RPC AS the caller (user-scoped client carries the JWT;
    // the RPC enforces auth.uid() === founding leader internally as
    // belt-and-suspenders).
    let plaintext: string;
    try {
      const { data: rpcData, error: rpcError } = await userClient.rpc(
        "reveal_underground_join_code",
        { p_church_id: churchId },
      );
      if (rpcError) {
        const msg = (rpcError.message || "").toLowerCase();
        // Map the RPC's exception strings WITHOUT logging the strings
        // themselves where the plaintext could plausibly slip in.
        if (msg.includes("already_revealed")) {
          return err(410, ERROR_CODES.CODE_ALREADY_CONSUMED);
        }
        if (msg.includes("not_authorized")) {
          return err(403, ERROR_CODES.NOT_AUTHORIZED);
        }
        if (msg.includes("not_underground") || msg.includes("church_not_found")) {
          return err(404, ERROR_CODES.NOT_FOUND);
        }
        log("error", "rpc_unexpected_error", {
          auth_uid_hash: djb2(authUid),
          // Intentionally NOT including the full message — could be safe
          // but we keep the surface minimal.
          rpc_error_short: msg.slice(0, 64),
        });
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }
      if (typeof rpcData !== "string" || rpcData.length === 0) {
        log("error", "rpc_no_plaintext", { auth_uid_hash: djb2(authUid) });
        return err(500, ERROR_CODES.INTERNAL_ERROR);
      }
      plaintext = rpcData;
    } catch (e) {
      log("error", "rpc_threw", {
        auth_uid_hash: djb2(authUid),
        message_short: ((e as Error).message || "").slice(0, 64),
      });
      return err(500, ERROR_CODES.INTERNAL_ERROR);
    }

    // Cache the TOMBSTONE — never the plaintext.
    try {
      await upstashSetEx(
        idempKey,
        JSON.stringify({ revealed: true }),
        IDEMPOTENCY_CACHE_TTL_SECONDS,
      );
    } catch (e) {
      log("warn", "idempotency_cache_set_failed", { message: (e as Error).message });
    }

    log("info", "reveal_success", {
      auth_uid_hash: djb2(authUid),
      // church_id intentionally omitted from telemetry.
    });

    // Single response. Plaintext is in the body and is never persisted
    // here. The FE displays it in a one-shot modal and the leader
    // dismisses with "I have saved this."
    return new Response(JSON.stringify({ joinCode: plaintext }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Defensive — don't let intermediaries cache.
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
      },
    });
  } catch (e) {
    log("error", "unexpected", { message: (e as Error).message });
    return err(500, ERROR_CODES.INTERNAL_ERROR);
  }
}

Deno.serve(handle);
