// send-message Edge Function — KAN-71 entry point.
//
// SEC-locked invariants (mirror submit-heartcry / auth-status-check):
//   - verify_jwt=true at the platform is load-bearing security: any forged
//     JWT is rejected before this handler runs. Any change to verify_jwt
//     OR to auth-validation below requires a fresh SEC ruling before
//     deploy.
//   - Message content NEVER appears in any log statement. Zero exceptions.
//   - DELIVER-ALWAYS (D-45 clause 3): keyword match writes `flagged` and
//     `flag_reason` columns ONLY. It does NOT gate the INSERT, the
//     Realtime broadcast, or the 200 response. A HOLD requires explicit
//     admin action — never automatic here. The matcher returns only a
//     { flagged, flag_reason } record; this code path MUST NOT branch
//     delivery on that record.
//   - Canonical UUID participant sort: every conversations lookup AND
//     insert sorts (sender, recipient) before any DB call. The
//     participant_order CHECK + unique_participant_pair UNIQUE constraints
//     enforce this at the DB; the API layer enforces it before issuing
//     queries so duplicates / ordering rejects surface as clean errors
//     rather than 500s.
//   - Single transaction wraps message INSERT + conversations
//     last_message_at UPDATE + lazy conversation INSERT (if applicable).
//     Full rollback on any failure. postgres-js .begin() owns the
//     transaction; supabase-js admin client handles non-transactional
//     reads (sender/recipient lookup, conversation participant check).
//   - Realtime fires automatically because public.messages is in
//     supabase_realtime publication (kan71_messages_realtime_publication_v1).
//     No manual broadcast call required.
//
// References: submit-heartcry/index.ts boot pattern + dependency-
// injection shape; logic.ts pure helpers; handler.ts HTTP envelope.

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.105.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import { createHandler, type Deps } from "./handler.ts";

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

  // postgres-js connection pool — owns the transaction-wrapped
  // INSERT path. `max: 2` is conservative for an Edge Function:
  // each isolate handles one request at a time, and the pool only
  // needs to handle the inner BEGIN..COMMIT plus the occasional
  // small lookup that benefits from raw SQL. `idle_timeout: 5`
  // releases connections quickly so cold-Edge restarts don't hold
  // sockets.
  const sql = postgres(dbUrl, {
    ssl: "require",
    max: 2,
    idle_timeout: 5,
  });

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
          .verification_status as "pending" | "verified" | "deactivated",
      };
    },

    async fetchRecipient(recipientId) {
      const { data, error } = await adminClient
        .from("users")
        .select("id, verification_status")
        .eq("id", recipientId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id as string,
        verification_status: data
          .verification_status as "pending" | "verified" | "deactivated",
      };
    },

    async fetchConversation(conversationId) {
      const { data, error } = await adminClient
        .from("conversations")
        .select("id, participant_a, participant_b")
        .eq("id", conversationId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id as string,
        participant_a: data.participant_a as string,
        participant_b: data.participant_b as string,
      };
    },

    async sendInTransaction(input) {
      // Single transaction: lazy-create-or-reuse conversation (if
      // applicable), INSERT message, UPDATE conversation.last_message_at.
      // Full rollback on any throw inside the begin() block.
      return await sql.begin(async (tx) => {
        let conversationId: string;

        if (input.conversationId) {
          // Existing conversation path — already verified at handler layer.
          conversationId = input.conversationId;
        } else {
          if (!input.participantA || !input.participantB) {
            // Defensive: handler should have set these for the recipient
            // path. Throw with a structured shape so handler 500s cleanly.
            const e = new Error("Missing participants for lazy thread create");
            (e as { httpStatus?: number }).httpStatus = 500;
            throw e;
          }
          // Find-or-create. Race-safe: SELECT first; if not found, INSERT
          // ON CONFLICT DO NOTHING; if RETURNING is empty (another
          // request won the race in the same window), re-SELECT.
          const existing = await tx`
            SELECT id::text AS id
            FROM public.conversations
            WHERE participant_a = ${input.participantA}::uuid
              AND participant_b = ${input.participantB}::uuid
            LIMIT 1
          `;
          if (existing.length > 0) {
            conversationId = String(existing[0].id);
          } else {
            const inserted = await tx`
              INSERT INTO public.conversations (participant_a, participant_b)
              VALUES (${input.participantA}::uuid, ${input.participantB}::uuid)
              ON CONFLICT (participant_a, participant_b) DO NOTHING
              RETURNING id::text AS id
            `;
            if (inserted.length === 0) {
              const retried = await tx`
                SELECT id::text AS id
                FROM public.conversations
                WHERE participant_a = ${input.participantA}::uuid
                  AND participant_b = ${input.participantB}::uuid
                LIMIT 1
              `;
              if (retried.length === 0) {
                const e = new Error("conversation lookup race could not resolve");
                throw e;
              }
              conversationId = String(retried[0].id);
            } else {
              conversationId = String(inserted[0].id);
            }
          }
        }

        // Single message INSERT. Realtime publication on public.messages
        // fires automatically on commit — no manual broadcast needed.
        const insertedMessage = await tx`
          INSERT INTO public.messages (
            conversation_id,
            sender_id,
            receiver_id,
            content,
            flagged,
            flag_reason
          )
          VALUES (
            ${conversationId}::uuid,
            ${input.senderId}::uuid,
            ${input.receiverId}::uuid,
            ${input.content},
            ${input.flagged},
            ${input.flag_reason}
          )
          RETURNING id::text AS id, created_at, flagged
        `;
        if (insertedMessage.length === 0) {
          throw new Error("messages INSERT returned no row");
        }
        const row = insertedMessage[0];

        // last_message_at bump for thread ordering on FE.
        await tx`
          UPDATE public.conversations
          SET last_message_at = now()
          WHERE id = ${conversationId}::uuid
        `;

        return {
          id: String(row.id),
          conversation_id: conversationId,
          created_at: new Date(row.created_at as string).toISOString(),
          flagged: Boolean(row.flagged),
        };
      });
    },

    readKeywordBlocklist() {
      // Deno.env.get is the canonical way to read Supabase Edge
      // Function secrets — supabase secrets set KEYWORD_BLOCKLIST=...
      // surfaces here. Same accessor pattern as SUPABASE_URL above;
      // confirmed working in the existing submit-heartcry edge function.
      return Deno.env.get("KEYWORD_BLOCKLIST");
    },

    log(level, event, fields) {
      // Structured single-line JSON for log aggregation. Caller is
      // responsible for ensuring `fields` carries NO message content
      // and NO recipient identifiers beyond the conversation_id handle
      // (which is the forensic anchor).
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
