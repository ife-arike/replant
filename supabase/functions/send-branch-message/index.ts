// send-branch-message Edge Function — KAN-214 entry point.
//
// SEC-locked invariants (mirror send-message / KAN-71):
//   - verify_jwt=true at the platform is load-bearing security. Any
//     change to verify_jwt OR to auth-validation below requires a
//     fresh SEC ruling before deploy.
//   - Message content NEVER appears in any log statement. Zero
//     exceptions.
//   - DELIVER-ALWAYS (D-45 clause 3): keyword match writes `flagged`
//     and `flag_reason` columns ONLY. It does NOT gate the INSERT,
//     the Realtime broadcast, or the 200 response. A HOLD requires
//     explicit admin action — never automatic here. The matcher
//     returns only a { flagged, flag_reason } record; this code path
//     MUST NOT branch delivery on that record.
//   - branch_id + receiver_id + conversation_id 3-way CHECK (per OQ-1
//     path (a), KAN-214 Migration 1): a branch message has
//     branch_id NOT NULL, receiver_id NULL, conversation_id NULL.
//     Any other shape would violate `message_belongs_to_one` and
//     raise a constraint violation surfacing as 500 here.
//   - Realtime fires automatically: public.messages is in the
//     supabase_realtime publication (KAN-71 + KAN-214 add-on for
//     branches / branch_members). No manual broadcast call required.

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.105.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createHandler, type Deps } from "./handler.ts";
import {
  classifyLoadFailure,
  loadTaxonomy,
  type Taxonomy,
} from "./taxonomy.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !dbUrl) {
    throw new Error("Missing Supabase environment configuration");
  }

  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);
  const userClientFor = (authHeader: string): SupabaseClient =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

  // postgres-js connection pool for the INSERT + UPDATE pair on the
  // hot send path. max:2 is conservative — each Edge isolate handles
  // one request at a time. idle_timeout:5 releases sockets quickly.
  const sql = postgres(dbUrl, {
    ssl: "require",
    max: 2,
    idle_timeout: 5,
  });

  // FLAG_TAXONOMY cold-start load. Fail-open per DELIVER-ALWAYS — a
  // missing/malformed secret degrades to "no matches" silently, and
  // the SOC sees the warn line at boot.
  const taxonomyRaw = Deno.env.get("FLAG_TAXONOMY");
  const taxonomy: Taxonomy | null = loadTaxonomy(taxonomyRaw);
  if (!taxonomy) {
    const reason = classifyLoadFailure(taxonomyRaw);
    console.warn(JSON.stringify({
      level: "warn",
      event: "send-branch-message.taxonomy-unavailable",
      reason,
      ts: new Date().toISOString(),
    }));
  } else {
    console.log(JSON.stringify({
      level: "info",
      event: "send-branch-message.taxonomy-loaded",
      taxonomy_version: taxonomy.taxonomy_version,
      code_count: taxonomy.codes.length,
      ts: new Date().toISOString(),
    }));
  }

  return {
    async validateJwt(authHeader) {
      const client = userClientFor(authHeader);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { authUid: data.user.id, role: data.user.role ?? "anon" };
    },

    async fetchSender(authUid) {
      const { data, error } = await adminClient
        .from("users")
        .select("id, verification_status")
        .eq("auth_id", authUid)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id as string,
        verification_status: data
          .verification_status as
            | "pending"
            | "verified"
            | "rejected"
            | "deactivated",
      };
    },

    async isCallerJoinedMember(senderId, branchId) {
      // Branch-membership gate. consent_status='joined' is the only
      // shape that authorizes a send — 'invited' / 'declined' / no
      // row all return false. We surface them all as 403 (Forbidden)
      // without distinguishing — the leader doesn't need to know why
      // they can't post, and we don't want to leak branch existence
      // to non-members.
      const { data, error } = await adminClient
        .from("branch_members")
        .select("id")
        .eq("branch_id", branchId)
        .eq("user_id", senderId)
        .eq("consent_status", "joined")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },

    async insertBranchMessage(input) {
      // Single transaction:
      //   1. INSERT into messages (branch_id, sender_id, receiver_id
      //      NULL, conversation_id NULL, content, flagged, flag_reason)
      //   2. UPDATE branches SET last_message_at = now() WHERE id = ?
      // Both fail-or-succeed together. Realtime fires on the INSERT
      // commit automatically (messages is in supabase_realtime).
      return await sql.begin(async (tx) => {
        const insertedMessage = await tx`
          INSERT INTO public.messages (
            branch_id,
            sender_id,
            receiver_id,
            conversation_id,
            content,
            flagged,
            flag_reason
          )
          VALUES (
            ${input.branchId}::uuid,
            ${input.senderId}::uuid,
            NULL,
            NULL,
            ${input.content},
            ${input.flagged},
            ${input.flag_reason}
          )
          RETURNING id::text AS id
        `;
        if (insertedMessage.length === 0) {
          throw new Error("messages INSERT returned no row");
        }

        await tx`
          UPDATE public.branches
          SET last_message_at = now()
          WHERE id = ${input.branchId}::uuid
        `;

        return { id: String(insertedMessage[0].id) };
      });
    },

    getTaxonomy() {
      return taxonomy;
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

const handler = createHandler(makeDeps());
Deno.serve(handler);
