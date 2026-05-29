// KAN-207 update-church Edge Function — authenticated church edit.
//
// SEC-locked invariants (mirror register-church + the JWT addition):
//   - verify_jwt = true at the platform (config.toml). Caller must
//     present a valid bearer token. The handler additionally verifies
//     ownership server-side before any UPDATE.
//   - No audit_log writes from this function — admins observe queue
//     changes directly.
//   - No SECURITY DEFINER RPC calls, no Vault accessors, no Resend.
//   - Underground type-coercion of city / lat / lng happens in
//     parseUpdatePayload (logic.ts) — identical to the register-church
//     c.10167 invariant.
//
// Why a separate function and not "register-church handles both":
//   register-church is verify_jwt = false (it runs pre-auth during
//   onboarding). The edit path requires JWT. Conflating the two would
//   either break onboarding (if we flipped to true) or weaken the edit
//   surface (if we kept false). KAN-207 splits cleanly.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHandler, type Deps } from "./handler.ts";
import type { UpdateChurchRow } from "./logic.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    async getAuthUser(token) {
      const { data, error } = await adminClient.auth.getUser(token);
      if (error || !data?.user?.id) return null;
      return { id: data.user.id };
    },

    async checkOwnership(authUserId, churchId) {
      // SELECT id FROM public.users
      //   WHERE auth_id = $authUserId
      //     AND church_id = $churchId
      //     AND is_active = true
      // Single row → owner. .maybeSingle() so an absent row returns
      // null + no error (vs .single() which errors on 0 rows).
      const { data, error } = await adminClient
        .from("users")
        .select("id")
        .eq("auth_id", authUserId)
        .eq("church_id", churchId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },

    async updateChurch(churchId, row) {
      // Partial-update pattern: strip null/undefined fields so we only
      // UPDATE the columns the leader actually edited. Keeps the BE
      // honest about intent — an absent field stays absent in the DB.
      const updateFields = Object.fromEntries(
        Object.entries(row).filter(
          ([, v]) => v !== null && v !== undefined,
        ),
      ) as Partial<UpdateChurchRow>;

      // Empty edit (leader hit submit on an unchanged form) → no-op.
      // Returning silently rather than firing an UPDATE that sets
      // nothing avoids a spurious updated_at bump in the DB.
      if (Object.keys(updateFields).length === 0) return;

      const { error } = await adminClient
        .from("churches")
        .update(updateFields)
        .eq("id", churchId);
      if (error) {
        throw new Error(`churches update failed: ${error.code ?? error.message ?? "unknown"}`);
      }
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
