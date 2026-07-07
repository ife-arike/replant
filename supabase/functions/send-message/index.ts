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
import {
  createInternalHandler,
  type InternalDeps,
} from "./internal-handler.ts";
import {
  classifyLoadFailure,
  loadTaxonomy,
  type Taxonomy,
} from "./taxonomy.ts";

// Module-level boot constants. Read once at cold-start; consumed by both
// makeDeps (external path) and the /internal boot below. Throws if any
// env var is missing — refuse-to-start posture is consistent with the
// existing function-startup discipline.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL");
if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !SUPABASE_DB_URL
) {
  throw new Error("Missing Supabase environment configuration");
}
const ADMIN_CLIENT: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

function makeDeps(): Deps {
  const supabaseUrl = SUPABASE_URL!;
  const anonKey = SUPABASE_ANON_KEY!;
  const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY!;
  const dbUrl = SUPABASE_DB_URL!;

  const adminClient: SupabaseClient = ADMIN_CLIENT;
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

  // KAN-124 — eager-load FLAG_TAXONOMY at cold-start. Cached in module
  // scope for the lifetime of this isolate. On missing / malformed,
  // log loud and degrade fail-open: matcher sees null → returns no
  // matches → flagged=false on every message. DELIVER-ALWAYS preserved
  // even when the taxonomy is unavailable; SOC sees the alarm.
  const taxonomyRaw = Deno.env.get("FLAG_TAXONOMY");
  const taxonomy: Taxonomy | null = loadTaxonomy(taxonomyRaw);
  if (!taxonomy) {
    const reason = classifyLoadFailure(taxonomyRaw);
    console.warn(JSON.stringify({
      level: "warn",
      event: "send-message.taxonomy-unavailable",
      reason,
      ts: new Date().toISOString(),
    }));
  } else {
    // Confirmation log at boot — visible in deploy logs so OPS can
    // verify the secret rolled out. Code count + taxonomy_version only;
    // no patterns.
    console.log(JSON.stringify({
      level: "info",
      event: "send-message.taxonomy-loaded",
      taxonomy_version: taxonomy.taxonomy_version,
      code_count: taxonomy.codes.length,
      auto_active_count: taxonomy.codes.filter(
        (c) => c.source_prefix === "auto" && c.patterns.length > 0,
      ).length,
      ts: new Date().toISOString(),
    }));
  }

  // ────────────────────────────────────────────────────────────────
  // KAN-137 — T1 emit boot-cache + helper.
  // ────────────────────────────────────────────────────────────────
  // Lazy-loaded once per isolate. Resend API key + pastoral lead user
  // id are needed ONLY on T1-fire paths; most messages won't trigger
  // emit, so deferring the Vault RPC + users lookup keeps cold-start
  // fast. On first T1 emit per isolate, both load together.
  //
  // SM ruling: pastoral lead = ruth@projectreplant.org (D-26 single
  // lead at MVP). The Resend payload TO is the shared inbox address
  // info@projectreplant.org (OPS c.11752 deviation); the email_log
  // user_id is the lead's internal id for forensic attribution.
  interface T1BootCache {
    resendApiKey: string;
    pastoralLeadUserId: string;
  }
  let t1BootCachePromise: Promise<T1BootCache> | null = null;
  async function ensureT1BootCache(): Promise<T1BootCache> {
    if (!t1BootCachePromise) {
      t1BootCachePromise = (async (): Promise<T1BootCache> => {
        const [keyRes, userRes] = await Promise.all([
          adminClient.rpc("get_resend_api_key"),
          adminClient
            .from("users")
            .select("id")
            .eq("email", "ruth@projectreplant.org")
            .maybeSingle(),
        ]);
        if (keyRes.error || typeof keyRes.data !== "string" || keyRes.data.length === 0) {
          throw new Error("get_resend_api_key returned no key");
        }
        if (userRes.error || !userRes.data) {
          throw new Error("pastoral lead user lookup failed (ruth@projectreplant.org)");
        }
        return {
          resendApiKey: keyRes.data,
          pastoralLeadUserId: userRes.data.id as string,
        };
      })().catch((err) => {
        // Reset the cache on failure so the next T1 fire retries the
        // bootstrap rather than persistently failing on a transient.
        t1BootCachePromise = null;
        throw err;
      });
    }
    return t1BootCachePromise;
  }

  // ─── Upstash REST helpers (per-leader hourly rate limit) ───
  // AC-3 key: pastoral-t1-email-emit:{leader_id} (SM ruling; distinct
  // from KAN-125 AC-7 pastoral-t1-context-expand:{leader_id}). Flow:
  // GET first; if key exists, suppress with outcome='suppressed_rate_
  // limit'. On Resend success, SET NX EX 3600 (failed emits do NOT
  // consume the cap — operator-friendly retry posture). Env-absent →
  // log warning + skip rate limit (fail-open per DELIVER-ALWAYS; SOC
  // visibility via the warn log).
  const upstashUrl   = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  async function upstashGet(key: string): Promise<string | null> {
    if (!upstashUrl || !upstashToken) return null;
    const res = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    if (!res.ok) throw new Error(`Upstash GET ${res.status}`);
    const body = await res.json() as { result: string | null };
    return body.result ?? null;
  }
  async function upstashSetNxEx(key: string, ttlSeconds: number): Promise<boolean> {
    if (!upstashUrl || !upstashToken) return false;
    // Upstash REST: SET key value EX seconds NX. Returns "OK" on set, null on key-exists.
    const res = await fetch(`${upstashUrl}/set/${encodeURIComponent(key)}/1?EX=${ttlSeconds}&NX=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    if (!res.ok) throw new Error(`Upstash SET ${res.status}`);
    const body = await res.json() as { result: string | null };
    return body.result === "OK";
  }

  // emitPastoralT1Alert — Resend Template 9 fire with per-leader hourly
  // cap + email_log + audit_log writes. Never throws. SEC c.11750
  // condition #1 + #6: no leader_id / message_id / content / flag_reason
  // in Resend body, log lines, email_log.template, or audit_log.meta.
  // The leader_id appears ONLY as the Upstash key suffix (necessary
  // for per-leader rate-limiting; never persisted in DB tables here).
  async function emitPastoralT1Alert(leaderId: string): Promise<void> {
    let cache: T1BootCache;
    try {
      cache = await ensureT1BootCache();
    } catch (e) {
      // Bootstrap failure (Vault unavailable or pastoral lead user
      // missing). Log + skip. Message has already committed.
      console.error(JSON.stringify({
        level: "error",
        event: "send-message.t1-boot-cache-failed",
        error_class: (e as Error)?.name ?? "Error",
        ts: new Date().toISOString(),
      }));
      return;
    }

    const upstashKey = `pastoral-t1-email-emit:${leaderId}`;

    // ─── Rate-limit check (GET) ───
    let rateLimited = false;
    try {
      const existing = await upstashGet(upstashKey);
      rateLimited = existing !== null;
    } catch (e) {
      // Upstash unavailable — log + fail-open. The alert proceeds
      // (DELIVER-ALWAYS posture: prefer over-alerting to under-alerting
      // for life-safety). SOC sees the warn.
      console.warn(JSON.stringify({
        level: "warn",
        event: "send-message.t1-upstash-get-failed",
        error_class: (e as Error)?.name ?? "Error",
        ts: new Date().toISOString(),
      }));
    }

    if (rateLimited) {
      // Suppress: write email_log row with outcome='suppressed_rate_limit'.
      // No audit_log row — suppression is not an emit event.
      const { error: logErr } = await adminClient.from("email_log").insert({
        user_id:   cache.pastoralLeadUserId,
        template:  "pastoral_signal_alert_t1",
        sent_date: new Date().toISOString().slice(0, 10),
        sent_at:   new Date().toISOString(),
        resend_id: null,
        outcome:   "suppressed_rate_limit",
      });
      if (logErr) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "send-message.t1-email-log-suppress-failed",
          error_class: logErr.message ?? "error",
          ts: new Date().toISOString(),
        }));
      }
      return;
    }

    // ─── Resend Template 9 fire ───
    // Body carries ONLY the opaque deep_link template_data. No leader_id,
    // no message_id, no content, no flag_reason. Subject is literal.
    let resendId: string | null = null;
    let emitOutcome: "sent" | "failed_resend_emit" = "sent";
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cache.resendApiKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    "info@projectreplant.org",
          to:      ["info@projectreplant.org"],
          subject: "Pastoral signal — Tier 1 (immediate review)",
          template_id:   "6e417a13-cd5d-4d2f-8534-d16406b0e429",
          template_data: { deep_link: "https://admin.projectreplant.org/pastoral" },
        }),
      });
      if (!resendRes.ok) {
        emitOutcome = "failed_resend_emit";
        console.error(JSON.stringify({
          level: "error",
          event: "send-message.t1-resend-failed",
          status: resendRes.status,
          ts: new Date().toISOString(),
        }));
      } else {
        const body = await resendRes.json().catch(() => ({})) as { id?: string };
        resendId = typeof body.id === "string" ? body.id : null;
        // ─── Mark the leader rate-limited for the next hour ───
        // Failed emits do NOT consume the cap (skipped above on error).
        try {
          await upstashSetNxEx(upstashKey, 3600);
        } catch (e) {
          console.warn(JSON.stringify({
            level: "warn",
            event: "send-message.t1-upstash-set-failed",
            error_class: (e as Error)?.name ?? "Error",
            ts: new Date().toISOString(),
          }));
        }
      }
    } catch (e) {
      emitOutcome = "failed_resend_emit";
      console.error(JSON.stringify({
        level: "error",
        event: "send-message.t1-resend-threw",
        error_class: (e as Error)?.name ?? "Error",
        ts: new Date().toISOString(),
      }));
    }

    // ─── email_log + audit_log writes ───
    const nowIso = new Date().toISOString();
    const { error: emailLogErr } = await adminClient.from("email_log").insert({
      user_id:   cache.pastoralLeadUserId,
      template:  "pastoral_signal_alert_t1",
      sent_date: nowIso.slice(0, 10),
      sent_at:   nowIso,
      resend_id: resendId,
      outcome:   emitOutcome,
    });
    if (emailLogErr) {
      console.warn(JSON.stringify({
        level: "warn",
        event: "send-message.t1-email-log-failed",
        error_class: emailLogErr.message ?? "error",
        ts: new Date().toISOString(),
      }));
    }

    // audit_log row: NO leader_id, NO message_id (SEC #1 + #6). Surface
    // + template_id + outcome only. Per-leader forensic linkage lives
    // in moderation_state (RLS-bounded per axis).
    const { error: auditErr } = await adminClient.from("audit_log").insert({
      action:       "pastoral_digest_emitted",
      accessed_by:  null,
      triggered_by: "system",
      meta: {
        surface:     "t1_emit",
        template_id: "6e417a13-cd5d-4d2f-8534-d16406b0e429",
        outcome:     emitOutcome,
      },
    });
    if (auditErr) {
      console.warn(JSON.stringify({
        level: "warn",
        event: "send-message.t1-audit-log-failed",
        error_class: auditErr.message ?? "error",
        ts: new Date().toISOString(),
      }));
    }
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
        .select("id, participant_a, participant_b, is_secure_replant_thread")
        .eq("id", conversationId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id as string,
        participant_a: data.participant_a as string,
        participant_b: data.participant_b as string,
        is_secure_replant_thread: data.is_secure_replant_thread === true,
      };
    },

    // KAN-305 — block gate. Symmetric pair check via the fn_is_blocked
    // SECURITY DEFINER helper (service_role EXECUTE only — this admin client
    // holds it). Replant Team secure threads are exempt (moderation channel
    // never severed); the caller passes that flag so we short-circuit without
    // a DB round-trip. Fail-CLOSED on a lookup error: prefer refusing a send
    // over risking delivery into a block (the trigger would reject it anyway,
    // so returning "blocked" here just yields the clean 403 instead of a 500).
    async isBlockedPair({ senderId, receiverId, isSecureReplantThread }) {
      if (isSecureReplantThread) return false;
      const { data, error } = await adminClient.rpc("fn_is_blocked", {
        p_a: senderId,
        p_b: receiverId,
      });
      if (error) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "send-message.is-blocked-check-failed",
          error_class: error.message ?? "error",
          ts: new Date().toISOString(),
        }));
        // Fail-closed: treat an errored check as blocked. The DB trigger is
        // the guarantee regardless; this keeps the surface a clean 403.
        return true;
      }
      return data === true;
    },

    async sendInTransaction(input) {
      // Single transaction: lazy-create-or-reuse conversation (if
      // applicable), INSERT message, UPDATE conversation.last_message_at.
      // Full rollback on any throw inside the begin() block.
      try {
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
      } catch (e) {
        // KAN-305 — the BEFORE INSERT block guard (trg_messages_block_guard)
        // raises 'blocked_pair' if a block landed in the TOCTOU window between
        // the handler's explicit isBlockedPair check and this INSERT. Map it
        // to the same generic 403 the explicit check produces so the trigger
        // path is byte-identical to the clean path — the blocked sender still
        // learns nothing (silence guarantee). Any other error propagates
        // unchanged.
        const msg = (e as Error)?.message ?? "";
        if (msg.includes("blocked_pair")) {
          const mapped = new Error("blocked_pair");
          (mapped as { httpStatus?: number }).httpStatus = 403;
          throw mapped;
        }
        throw e;
      }
    },

    getTaxonomy() {
      return taxonomy;
    },

    // ────────────────────────────────────────────────────────────────
    // KAN-137 AC-6 — postCommitFlagEffects: moderation_state INSERTs
    // per routing axis + T1 pastoral alert dispatch.
    //
    // Cross-definer chain (SEC c.11750 #6 audit for the BE path):
    //   send-message.handler → THIS DEP → [moderation_state INSERTs +
    //   conditional emitT1Alert → Upstash GET / SET + Resend fetch].
    //
    // DELIVER-ALWAYS: every I/O failure is caught here and logged;
    // never propagated to the handler. The message has already
    // committed by the time this runs; nothing here can un-deliver
    // it. The function returns void on every path.
    //
    // No leader_id in: any log line, the Resend payload body, the
    // email_log row text columns, or the audit_log meta. The
    // leader_id ONLY appears as the Upstash key suffix (necessary
    // for per-leader rate-limiting) and inside moderation_state
    // (via message_id FK — bounded by axis-aware RLS per KAN-125
    // watched-invariant #15).
    // ────────────────────────────────────────────────────────────────
    async postCommitFlagEffects({ messageId, senderId, plan }) {
      // ─── 1. moderation_state INSERTs per axis ───
      for (const axisPayload of plan.axes) {
        try {
          const { error: msErr } = await adminClient
            .from("moderation_state")
            .insert({
              message_id: messageId,
              axis: axisPayload.axis,
              status: "pending",
              actor: null, // system-flagged; no admin actor
              meta: {
                routing: axisPayload.axis,
                tier: axisPayload.tier,
                matched_codes: axisPayload.matched_codes,
              },
            });
          if (msErr) {
            // PK collision (message_id, axis) on retry path — graceful:
            // 23505 means a prior invocation already wrote the row.
            // Any other error → log + continue (do not throw).
            if ((msErr as { code?: string }).code !== "23505") {
              console.warn(JSON.stringify({
                level: "warn",
                event: "send-message.moderation-state-insert-failed",
                axis: axisPayload.axis,
                conversation_id: null,
                error_class: msErr.message ?? "error",
                ts: new Date().toISOString(),
              }));
            }
          }
        } catch (e) {
          console.warn(JSON.stringify({
            level: "warn",
            event: "send-message.moderation-state-insert-threw",
            axis: axisPayload.axis,
            error_class: (e as Error)?.name ?? "Error",
            ts: new Date().toISOString(),
          }));
        }
      }

      // ─── 2. T1 pastoral alert (AC-1 trigger) ───
      if (plan.fire_pastoral_t1_alert) {
        try {
          await emitPastoralT1Alert(senderId);
        } catch (e) {
          // emitPastoralT1Alert is internally try/catch'd; this is
          // defense-in-depth. Never throw upward.
          console.error(JSON.stringify({
            level: "error",
            event: "send-message.t1-emit-threw",
            error_class: (e as Error)?.name ?? "Error",
            ts: new Date().toISOString(),
          }));
        }
      }
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

// ────────────────────────────────────────────────────────────────────────
// KAN-217 /internal boot — SEC c.15285 Item 3 sub-items.
//
// (3c) sender_id resolved from Vault (replant_system_user_id) at function
//      startup. Loaded ONCE per isolate via get_secret_by_name SECURITY
//      DEFINER RPC. Frozen for the lifetime of the isolate; never read
//      again, never accepted from request body. Boot fails if the secret
//      is missing or empty — refuse-to-start.
// (3a) (3b) The /internal handler validates the welcome_dm_internal_token
//      + X-Replant-Internal sentinel in constant time (internal-auth.ts).
//      device-pass-fixes-1 (2026-05-30): source shifted from
//      SUPABASE_SERVICE_ROLE_KEY to a dedicated Vault secret
//      (`welcome_dm_internal_token`) — scoped to this route, decoupled
//      from Supabase key rotation. SEC AC-3 amendment stamped.
// (3d) (3f) Internal token NEVER logged, never in any response payload.
//      Vault-resident + Netlify env only.
// ────────────────────────────────────────────────────────────────────────
async function loadReplantSystemUserId(): Promise<string> {
  const { data, error } = await ADMIN_CLIENT.rpc("get_secret_by_name", {
    secret_name: "replant_system_user_id",
  });
  if (error || typeof data !== "string" || data.length === 0) {
    throw new Error("Failed to load replant_system_user_id from Vault");
  }
  return data;
}

async function loadWelcomeDmInternalToken(): Promise<string> {
  const { data, error } = await ADMIN_CLIENT.rpc("get_secret_by_name", {
    secret_name: "welcome_dm_internal_token",
  });
  if (error || typeof data !== "string" || data.length === 0) {
    // Refuse to start — /internal route cannot authenticate without this
    // secret. Mirrors replant_system_user_id posture: prefer a clean
    // startup failure over silently accepting any Bearer token.
    throw new Error("Failed to load welcome_dm_internal_token from Vault");
  }
  return data;
}

const deps = makeDeps();
const [systemSenderId, internalToken] = await Promise.all([
  loadReplantSystemUserId(),
  loadWelcomeDmInternalToken(),
]);
console.log(JSON.stringify({
  level: "info",
  event: "send-message.internal.boot-loaded",
  // Public-knowledge UUID, safe to log. Internal token NEVER logged.
  system_sender_id: systemSenderId,
  ts: new Date().toISOString(),
}));

const internalDeps: InternalDeps = {
  internalToken,
  systemSenderId,
  fetchConversation: deps.fetchConversation,
  sendInTransaction: deps.sendInTransaction,
  getTaxonomy: deps.getTaxonomy,
  postCommitFlagEffects: deps.postCommitFlagEffects,
  log: deps.log,
};

const externalHandler = createHandler(deps);
const internalHandler = createInternalHandler(internalDeps);

Deno.serve(async (req: Request): Promise<Response> => {
  // URL.pathname tells us which sub-route was hit. The platform deploys
  // this function at /functions/v1/send-message; /internal sub-path is
  // /functions/v1/send-message/internal. Anything else routes to the
  // existing external (user-JWT) handler.
  const url = new URL(req.url);
  if (url.pathname.endsWith("/internal")) {
    return await internalHandler(req);
  }
  return await externalHandler(req);
});
