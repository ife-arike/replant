// auth-status-check edge function — SEC-locked invariants
//
// 401 PATH SPLIT — load-bearing; do NOT assume a uniform 401 shape.
//
// Gateway 401 (Supabase verify_jwt=true rejects before this code runs):
//   - missing Authorization header, malformed JWT, expired JWT, legacy JWT,
//     no-sub JWT, future-iat JWT, signature-invalid JWT (incl. forged
//     super_admin claims signed with the wrong key).
//   - Response shape: platform default —
//       { code: "UNAUTHORIZED_INVALID_JWT_FORMAT" | "UNAUTHORIZED_LEGACY_JWT" | …,
//         message: "Invalid JWT" }
//     NOT this function's UNAUTHORIZED shape.
//
// Function 401 (this code returns):
//   - JWT is well-formed and signature-valid but auth.role() === "anon"
//     (anon-key calls). Explicit entry-point rejection per SEC 10302.
//   - Response shape: { error: "Invalid or expired session", code: "UNAUTHORIZED" }.
//
// verify_jwt=true at the platform is load-bearing security: it is the only
// reason a forged super_admin JWT is rejected before reaching the handler
// (a forged claim cannot be read until the signature validates). Any change
// to verify_jwt config OR to the auth-validation pattern below requires a
// fresh SEC ruling before deploy.
//
// Cross-references: KAN-44 comments 10920 (initial SEC review), 10927
// (re-review post-rework), 10955 (re-concurrence on the deployed
// gateway-vs-function 401 pattern).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createHandler, type Deps } from "./handler.ts";
import type { UserStatusRow } from "./logic.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !dbUrl) {
    throw new Error("Missing Supabase environment configuration");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClientFor = (authHeader: string): SupabaseClient =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

  // Single direct DB connection per worker for the atomic-transaction path.
  // supabase-js can't wrap UPDATE + INSERT in a single PG transaction, so the
  // deactivation path uses postgres-js with sql.begin() to satisfy SEC 10920's
  // non-negotiable invariant: no deactivation may persist without its audit row.
  const sql = postgres(dbUrl, { ssl: "require", max: 1, idle_timeout: 20 });

  return {
    async validateJwt(authHeader) {
      const client = userClientFor(authHeader);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { authUid: data.user.id, role: data.user.role ?? "anon" };
    },

    async fetchUserStatus(authUid) {
      // KAN-TBD 2026-06-18 root fix — both user.verification_deadline AND
      // church.verification_status are now load-bearing for resolveStatus.
      // Top-level `verification_deadline` is users.*; `church.*` is the
      // embedded join. resolveStatus branches on church.verification_status
      // BEFORE reading church.verification_deadline (stale deadlines on
      // verified churches were auto-deactivating every new leader).
      // Underground Verification Queue (2026-06-22): churches.soft_deleted_at
      // and churches.last_outcome_modal_kind added to drive branch_substate.
      // Both nullable; the resolver treats absent values as "no substate."
      // KAN-205 (2026-07-07): the USER's own soft_deleted_at /
      // soft_delete_reason / hard_delete_scheduled_at are now selected too
      // — resolveBranchSubstate checks USER-level soft-delete FIRST to
      // derive the 'self_deleted' substate (the ratified blocker fix).
      const { data, error } = await adminClient
        .from("users")
        .select(
          "id, verification_status, deactivated_at, is_active, church_id, verification_deadline, soft_deleted_at, soft_delete_reason, hard_delete_scheduled_at, church:churches!users_church_id_fkey(verification_status, verification_deadline, soft_deleted_at, last_outcome_modal_kind)",
        )
        .eq("auth_id", authUid)
        .maybeSingle();
      if (error || !data) return null;

      // supabase-js types embedded relations as arrays even for many-to-one FKs and
      // the runtime shape varies across versions — normalize to a single row.
      type ChurchEmbed = {
        verification_status: string | null;
        verification_deadline: string | null;
        soft_deleted_at: string | null;
        last_outcome_modal_kind: string | null;
      };
      const churchRaw = (data as Record<string, unknown>).church;
      let church: ChurchEmbed | null = null;
      if (Array.isArray(churchRaw)) {
        church = (churchRaw[0] as ChurchEmbed | undefined) ?? null;
      } else if (churchRaw !== null && churchRaw !== undefined) {
        church = churchRaw as ChurchEmbed;
      }

      return {
        id: data.id as string,
        verification_status: data.verification_status as UserStatusRow["verification_status"],
        deactivated_at: (data.deactivated_at as string | null) ?? null,
        is_active: data.is_active as boolean,
        church_id: (data.church_id as string | null) ?? null,
        // KAN-205 — normalize absent to null so the resolver's strict
        // null checks never see undefined (the pre-2026-07 test-mock
        // drift bug was exactly an undefined-vs-null mismatch).
        soft_deleted_at: (data.soft_deleted_at as string | null) ?? null,
        soft_delete_reason: (data.soft_delete_reason as string | null) ?? null,
        hard_delete_scheduled_at: (data.hard_delete_scheduled_at as string | null) ?? null,
        user_verification_deadline: (data.verification_deadline as string | null) ?? null,
        church,
      };
    },

    async deactivateAtomically(userId, churchId, nowISO) {
      // sql.begin runs the closure inside a transaction. ANY error thrown inside —
      // including the audit INSERT failing a constraint — rolls back the UPDATE.
      // postgres-js re-throws after rollback so the handler's catch-all returns 500.
      return await sql.begin(async (tx: postgres.TransactionSql) => {
        // Idempotency guard: WHERE verification_status='pending' ensures a concurrent
        // caller that already wrote 'deactivated' affects 0 rows here, so the audit
        // INSERT below only fires for the request that performed the write.
        const updated = await tx`
          UPDATE users
          SET verification_status = 'deactivated',
              deactivated_at = ${nowISO},
              is_active = false
          WHERE id = ${userId} AND verification_status = 'pending'
          RETURNING id
        `;

        if (updated.length === 0) {
          return { wrote: false };
        }

        await tx`
          INSERT INTO audit_log (accessed_by, triggered_by, action, church_id, accessed_at, meta)
          VALUES (
            NULL,
            'system',
            'deactivate_user',
            ${churchId},
            ${nowISO}::timestamptz,
            ${tx.json({ trigger: "login_check", user_id: userId })}
          )
        `;

        return { wrote: true };
      });
    },

    async fetchUndergroundRevealContext(userId, churchId) {
      // Read the church's underground fields + look up the founding
      // leader (oldest active user on the church). Both queries are
      // cheap point-lookups. Returns null on lookup failure or when
      // the church type is not underground (cheap short-circuit so we
      // don't waste a leaders query on standard rows).
      const { data: churchRow, error: churchErr } = await adminClient
        .from("churches")
        .select("type, verification_status, underground_join_code_revealed_at")
        .eq("id", churchId)
        .maybeSingle();
      if (churchErr || !churchRow) return null;
      if (churchRow.type !== "underground") return null;

      const { data: founders, error: founderErr } = await adminClient
        .from("users")
        .select("id")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1);
      if (founderErr) return null;
      const foundingLeaderId =
        founders && founders.length > 0 ? (founders[0].id as string) : null;

      return {
        churchType: churchRow.type as string | null,
        churchVerificationStatus: churchRow.verification_status as string | null,
        undergroundJoinCodeRevealedAt: (churchRow.underground_join_code_revealed_at as string | null) ?? null,
        foundingLeaderId,
      };
    },

    now() {
      return new Date();
    },
  };
}

const handler = createHandler(makeDeps());

Deno.serve(handler);
