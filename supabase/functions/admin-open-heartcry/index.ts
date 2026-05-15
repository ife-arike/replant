// KAN-92 — admin-open-heartcry Edge Function — SEC-locked invariants
//
// PURPOSE — Thin orchestration wrapper around the canonical
// `admin_open_heartcry(p_heartcry_id, p_admin_id, p_operation_id, p_ip,
// p_user_agent) RETURNS json` SECURITY DEFINER RPC (DBA c.12528, live
// in DB at v1.35.0). The RPC owns the atomic contract:
// audit row commits before content reaches the caller, every time.
// This function adds platform-level JWT verification, super_admin
// gating, admin_id resolution, request-context capture, and a generic
// 5xx error envelope.
//
// AUTH BRANCHING — load-bearing; do NOT collapse the three paths.
//
//   Gateway 401 (verify_jwt=true at platform, rejected before handler):
//     - missing Authorization header, malformed JWT, expired JWT,
//       legacy JWT, no-sub JWT, signature-invalid JWT (incl. forged
//       super_admin claims signed with the wrong key).
//     - Response shape: platform default — { code: "...", message: "..." }.
//
//   Function 401 (handler returns):
//     - JWT is well-formed and signature-valid but role === "anon"
//       (anon-key call attempts). Explicit entry-point rejection.
//     - Shape: { error: "unauthorized", code: "UNAUTHORIZED" }.
//
//   Function 403 (handler returns):
//     - Authenticated user, signed JWT, but `super_admin` claim is
//       missing or not strictly === true.
//     - Shape: { error: "forbidden", code: "FORBIDDEN_NOT_SUPER_ADMIN" }.
//
// verify_jwt=true at the platform is the only reason a forged
// super_admin claim is rejected before reaching the handler — the
// claim cannot be read until the signature validates. Any change to
// verify_jwt config OR to the auth-validation pattern below requires
// a fresh SEC ruling before deploy. Mirrors the lock pattern in
// auth-status-check / send-message / submit-heartcry.
//
// SAFE-LOG ENVELOPE — these fields must NEVER appear in any log
// statement emitted by this function:
//     content, severity, request_type, church_id, user_id,
//     heartcry_id, contact_email, leader_display_name, church_name,
//     region_macro.
// Logs carry `operation_id` and a generic event tag only. The
// operation_id is sufficient to correlate a log line with the
// audit_log row the RPC wrote.
//
// p_admin_id RESOLUTION — must be `public.users.id`, NOT `auth.uid()`.
// auth.uid() is `auth.users.id`; the audit_log.accessed_by column
// FKs public.users. Pattern matches auth-status-check.fetchUserStatus:
// resolve via SELECT id FROM public.users WHERE auth_id = jwt.sub.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration");
}

// Service-role client for the RPC call + the public.users admin_id
// lookup. The RPC itself is SECURITY DEFINER (runs as the function
// owner, not as the caller) — service-role only needs to reach the
// RPC, not to bypass RLS.
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CORS — admin browser is cross-origin to the Supabase project. With
// verify_jwt=true at the platform, OPTIONS preflights can't go through
// the default gateway path (gateway 401s OPTIONS that lack auth, which
// browsers don't send on preflight). The function must explicitly
// answer the preflight with CORS headers covering the four headers the
// supabase-js client attaches: authorization, apikey, content-type,
// x-client-info.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// Decode JWT payload — verify_jwt=true at the platform has already
// validated the signature, so we only need to read claims. Returns
// null on malformed JWT so the caller falls through to a 401.
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b64.length % 4)) % 4;
    const decoded = atob(b64 + "=".repeat(pad));
    const obj = JSON.parse(decoded) as unknown;
    if (typeof obj !== "object" || obj === null) return null;
    return obj as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  // One operation_id per request. Used both as the RPC's p_operation_id
  // and as the SAFE-LOG correlator. Generated up-front so any
  // pre-RPC error path can still emit it.
  const operationId = crypto.randomUUID();

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return json(405, { error: "method_not_allowed", code: "METHOD_NOT_ALLOWED" });
    }

    // Defensive — gateway should have rejected anything without a
    // Bearer header due to verify_jwt=true, but a missing header here
    // is a clean 401 to keep the contract obvious.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+/i.test(authHeader)) {
      return json(401, { error: "unauthorized", code: "UNAUTHORIZED" });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const claims = decodeJwtClaims(token);
    if (!claims) {
      return json(401, { error: "unauthorized", code: "UNAUTHORIZED" });
    }

    // Auth branch A: signed JWT but role === "anon" (someone hit the
    // function with the public anon key). Reject explicitly so the
    // failure mode is visible in logs as `anon_role`, distinct from
    // a non-super-admin auth user (branch B).
    if (claims.role === "anon") {
      console.log(JSON.stringify({
        event: "admin_open_heartcry.unauthorized",
        operation_id: operationId,
        branch: "anon_role",
      }));
      return json(401, { error: "unauthorized", code: "UNAUTHORIZED" });
    }

    // Auth branch B: authenticated user but missing or false
    // super_admin claim. The claim is minted by
    // custom_access_token_hook from app_metadata.role; a non-admin
    // user JWT will have super_admin omitted entirely. Strict ===
    // true so a string "true" or 1 wouldn't accidentally pass.
    if (claims.super_admin !== true) {
      console.log(JSON.stringify({
        event: "admin_open_heartcry.forbidden",
        operation_id: operationId,
        branch: "not_super_admin",
      }));
      return json(403, {
        error: "forbidden",
        code: "FORBIDDEN_NOT_SUPER_ADMIN",
      });
    }

    // Body parsing — schema { heartcry_id: uuid }. UUID is shape-
    // validated here so the RPC doesn't have to worry about
    // typecast errors; an invalid shape returns a clear 400.
    let body: { heartcry_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, {
        error: "validation_failed",
        detail: "invalid_json",
        code: "VALIDATION_FAILED",
      });
    }
    const heartcryId = body?.heartcry_id;
    if (typeof heartcryId !== "string" || !UUID_RE.test(heartcryId)) {
      return json(400, {
        error: "validation_failed",
        detail: "heartcry_id must be a valid uuid",
        code: "VALIDATION_FAILED",
      });
    }

    // Resolve p_admin_id from public.users. The RPC's p_admin_id
    // parameter expects public.users.id (audit_log.accessed_by FK
    // target); auth.uid() would point at auth.users.id and create
    // FK violations. Pattern matches auth-status-check.fetchUserStatus.
    const authUid = typeof claims.sub === "string" ? claims.sub : null;
    if (!authUid) {
      console.log(JSON.stringify({
        event: "admin_open_heartcry.error",
        operation_id: operationId,
        branch: "jwt_no_sub",
      }));
      return json(500, {
        error: "internal_error",
        code: "INTERNAL_ERROR",
        operation_id: operationId,
      });
    }
    const { data: userRow, error: userErr } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", authUid)
      .maybeSingle();
    if (userErr || !userRow) {
      console.log(JSON.stringify({
        event: "admin_open_heartcry.error",
        operation_id: operationId,
        branch: "admin_id_resolution_failed",
      }));
      return json(500, {
        error: "internal_error",
        code: "INTERNAL_ERROR",
        operation_id: operationId,
      });
    }
    const adminId = userRow.id as string;

    // Request context. x-forwarded-for is the Supabase Edge Runtime's
    // canonical client-IP header; cf-connecting-ip is the Cloudflare
    // fallback. UA capped at 500 chars per RPC contract.
    const ip = req.headers.get("x-forwarded-for")
      ?? req.headers.get("cf-connecting-ip")
      ?? null;
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 500);

    // Call the canonical RPC. The RPC writes the audit_log row
    // atomically before returning content (audit-before-content
    // invariant; KAN-66/67 pattern). On any RPC error we return a
    // generic 5xx with the operation_id correlator only — no RPC
    // internals leak, no SAFE-LOG-excluded fields ever surface in
    // logs from this catch.
    const { data, error: rpcError } = await adminClient.rpc(
      "admin_open_heartcry",
      {
        p_heartcry_id: heartcryId,
        p_admin_id: adminId,
        p_operation_id: operationId,
        p_ip: ip,
        p_user_agent: userAgent,
      },
    );

    if (rpcError) {
      console.log(JSON.stringify({
        event: "admin_open_heartcry.rpc_error",
        operation_id: operationId,
      }));
      return json(500, {
        error: "internal_error",
        code: "INTERNAL_ERROR",
        operation_id: operationId,
      });
    }

    console.log(JSON.stringify({
      event: "admin_open_heartcry.ok",
      operation_id: operationId,
    }));
    // Success — return RPC payload as-is. The RPC's response shape
    // is the canonical contract the FE renders against.
    return json(200, data);
  } catch {
    console.log(JSON.stringify({
      event: "admin_open_heartcry.unhandled",
      operation_id: operationId,
    }));
    return json(500, {
      error: "internal_error",
      code: "INTERNAL_ERROR",
      operation_id: operationId,
    });
  }
});
