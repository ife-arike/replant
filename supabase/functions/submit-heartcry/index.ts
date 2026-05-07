// submit-heartcry edge function — KAN-66 entry point.
//
// SEC-locked invariants (mirror auth-status-check's preamble):
//   - verify_jwt=true at the platform is load-bearing security: any forged JWT
//     is rejected before this handler runs. Any change to verify_jwt OR to
//     auth-validation below requires a fresh SEC ruling before deploy.
//   - Plaintext heartcry content NEVER touches the heartcries row. Encryption
//     happens via encrypt_heartcry_content(plaintext, key) RPC; the ciphertext
//     is what writes.
//   - Encryption key, Resend API key, and triage_lead resolution are loaded
//     from Vault at first-request boot and cached in this Deno isolate's memory
//     only — see BOOT_CACHE_TTL_MS / cachedEntry doc-block below.
//   - Triage-lead resolution: vault.decrypted_secrets[heartcry_triage_lead_email]
//     joined to public.users.email at boot. If the JOIN returns 0 rows the
//     function 5xx's startup — refusing to insert orphan heartcries with null
//     triage_lead_id, per HALT-comment 11096 reasoning.
//   - audit_log NO-WRITE on submission per v2.2 (admin reads in KAN-67 are the
//     audit surface). Per SEC item-4 ruling, every safe log line nonetheless
//     carries an operation_id (random per-request UUID) so future audit-writing
//     handlers can correlate without leaking user_id into the log surface.
//
// References: KAN-66 description AC; KAN-44 auth-status-check pattern for JWT
// validation, env wiring, and 401 path split (comments 10920, 10927, 10955);
// KAN-66 ITERATION 2 SEC ruling (items 2 + 4) for the cache + log changes.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {
  createHandler,
  type Deps,
  type EmailLogRow,
  type EmailLogResult,
  type InsertHeartcryRow,
  type LogFields,
  type ResendSendResult,
} from "./handler.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM = "Replant <noreply@projectreplant.org>";
const RESEND_SUBJECT = "New heartcry received — Replant";
const ADMIN_DASHBOARD_URL = "https://admin.projectreplant.org/heartcries";
const TRIAGE_TEMPLATE = "heartcry_triage_notification";

interface BootCache {
  encryptionKey: string;
  resendApiKey: string;
  triageLeadEmail: string;
  triageLeadId: string;
}

// ─── Boot cache — TTL coexists with reset-on-failure ────────────────────────
//
// The cache lives in THIS Deno isolate's memory only. No disk persistence, no
// cross-instance sharing — Supabase Edge Functions spin up isolates per region
// / warm pool, and each gets its own boot cycle.
//
// Per SEC item-2 ruling: TTL and failure-reset BOTH fire. Neither swallows the
// other.
//
//   (1) Fresh hit (within TTL):     return cachedEntry.value (no I/O)
//   (2) Stale (TTL expired):        cachedEntry treated as miss → loadBootCache()
//                                   re-runs; on success cachedEntry is replaced.
//                                   Bounds the key-rotation window to ≤1h.
//   (3) Load failure:               BOTH cachedEntry AND inflight are nulled
//                                   so the next request retries cleanly. Catches
//                                   mid-window rotations (e.g. OPS rotates the
//                                   Resend key 30 minutes in; the next request
//                                   sees the failure and re-loads), independent
//                                   of TTL state.
//
// inflight gates concurrent loads: a stampede of first-requests share one Vault
// round-trip rather than each issuing its own.
const BOOT_CACHE_TTL_MS = 60 * 60 * 1000; // 1h soft TTL — bounds rotation window

interface CachedEntry {
  value: BootCache;
  fetchedAt: number; // ms epoch (Date.now())
}

let cachedEntry: CachedEntry | null = null;
let inflight: Promise<BootCache> | null = null;

async function loadBootCache(
  adminClient: SupabaseClient,
  dbUrl: string,
): Promise<BootCache> {
  // Open a short-lived postgres-js connection only for the cross-schema
  // vault.decrypted_secrets read. supabase-js handles the SECURITY DEFINER
  // RPC calls without needing a direct DB connection.
  const sql = postgres(dbUrl, { ssl: "require", max: 1, idle_timeout: 5 });
  try {
    const [encRes, resendRes, triageRows] = await Promise.all([
      adminClient.rpc("get_heartcry_encryption_key"),
      adminClient.rpc("get_resend_api_key"),
      sql`
        SELECT u.id::text AS triage_lead_id, v.decrypted_secret AS triage_email
        FROM vault.decrypted_secrets v
        JOIN public.users u ON u.email = v.decrypted_secret
        WHERE v.name = 'heartcry_triage_lead_email'
        LIMIT 1
      `,
    ]);
    if (encRes.error || typeof encRes.data !== "string" || encRes.data.length === 0) {
      // Error message is a constant string — does NOT echo the cached key value.
      throw new Error("get_heartcry_encryption_key returned no key");
    }
    if (resendRes.error || typeof resendRes.data !== "string" || resendRes.data.length === 0) {
      throw new Error("get_resend_api_key returned no key");
    }
    if (triageRows.length === 0) {
      throw new Error(
        "Triage lead resolution failed: heartcry_triage_lead_email Vault entry missing or no matching public.users row",
      );
    }
    return {
      encryptionKey: encRes.data,
      resendApiKey: resendRes.data,
      triageLeadEmail: String(triageRows[0].triage_email),
      triageLeadId: String(triageRows[0].triage_lead_id),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function ensureCache(
  adminClient: SupabaseClient,
  dbUrl: string,
): Promise<BootCache> {
  // (1) TTL-hit path — fresh entry, no I/O.
  if (cachedEntry && Date.now() - cachedEntry.fetchedAt < BOOT_CACHE_TTL_MS) {
    return cachedEntry.value;
  }
  // (2) Cache-miss path: cold boot OR TTL expired. inflight gates concurrent loads
  // so a stampede shares one Vault round-trip.
  if (!inflight) {
    inflight = loadBootCache(adminClient, dbUrl)
      .then((value) => {
        cachedEntry = { value, fetchedAt: Date.now() };
        inflight = null;
        return value;
      })
      .catch((err) => {
        // (3) Failure-reset path — clears BOTH cachedEntry and inflight so the
        // next request re-attempts from scratch. Independent of (1): even if
        // a prior fresh entry exists, a load triggered for any reason that
        // fails poisons nothing — we just discard the in-progress promise.
        cachedEntry = null;
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

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

  return {
    async validateJwt(authHeader) {
      const client = userClientFor(authHeader);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { authUid: data.user.id, role: data.user.role ?? "anon" };
    },

    async fetchSubmitter(authUid) {
      const { data, error } = await adminClient
        .from("users")
        .select("id, church_id, verification_status")
        .eq("auth_id", authUid)
        .maybeSingle();
      if (error || !data) return null;
      // heartcries.church_id is NOT NULL — submitters without a church_id
      // can't insert a heartcry. Treat as 403 (defense-in-depth; FE already
      // gates verified users behind onboarding).
      if (!data.church_id) return null;
      return {
        id: data.id as string,
        church_id: data.church_id as string,
        verification_status:
          data.verification_status as "pending" | "verified" | "deactivated",
      };
    },

    async encryptContent(plaintext) {
      const cache = await ensureCache(adminClient, dbUrl);
      const { data, error } = await adminClient.rpc("encrypt_heartcry_content", {
        plaintext,
        key: cache.encryptionKey,
      });
      if (error || typeof data !== "string" || data.length === 0) {
        // Constant-string error — does NOT include the cache value.
        throw new Error("encrypt_heartcry_content failed");
      }
      return data;
    },

    async insertHeartcry(row: InsertHeartcryRow) {
      // status defaults to 'received' at the column level — omitted here so the
      // function can't accidentally override it. Same for id, created_at.
      const { error } = await adminClient.from("heartcries").insert({
        church_id: row.church_id,
        user_id: row.user_id,
        content: row.content,
        severity: row.severity,
        request_type: row.request_type,
        triage_lead_id: row.triage_lead_id,
      });
      if (error) {
        // Error.code is a Postgres SQLSTATE (e.g. "23505") or a supabase-js
        // string code; error.message is the DB error message. Neither contains
        // any cached secret material.
        throw new Error(`heartcries insert failed: ${error.code ?? error.message}`);
      }
    },

    async resolveTriageLeadId() {
      return (await ensureCache(adminClient, dbUrl)).triageLeadId;
    },

    async resolveTriageLeadEmail() {
      return (await ensureCache(adminClient, dbUrl)).triageLeadEmail;
    },

    async sendTriageEmail(to): Promise<ResendSendResult> {
      const cache = await ensureCache(adminClient, dbUrl);
      try {
        const res = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cache.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [to],
            subject: RESEND_SUBJECT,
            // Static body — no church name, no leader name, no content, no
            // severity, no preview (D-26, SEC G-24 closed).
            html: `<p>A new heartcry has been received.</p>
<p><a href="${ADMIN_DASHBOARD_URL}">Review in the admin dashboard</a></p>`,
            text: `A new heartcry has been received.

Review in the admin dashboard: ${ADMIN_DASHBOARD_URL}`,
          }),
        });
        if (!res.ok) {
          // Status code only — no header echo, no key.
          return { ok: false, resend_id: null, error: `Resend HTTP ${res.status}` };
        }
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, resend_id: typeof body.id === "string" ? body.id : null };
      } catch (e) {
        return { ok: false, resend_id: null, error: (e as Error).message };
      }
    },

    async logEmail(row: EmailLogRow): Promise<EmailLogResult> {
      // Per SEC item-4(b) ruling: logEmail no longer logs inline (no
      // console.warn). It returns a structured result; the handler routes
      // failure through the centralized deps.log path so every safe-log
      // line carries operation_id.
      const nowISO = new Date().toISOString();
      const { error } = await adminClient.from("email_log").insert({
        user_id: row.user_id,
        template: row.template,
        sent_date: nowISO.slice(0, 10),
        sent_at: nowISO,
        resend_id: row.resend_id,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },

    log(level, event, fields: LogFields) {
      // Centralized SAFE-LOG helper. EVERY safe-log line in the request flow
      // routes through here. Callers MUST include operation_id in `fields`
      // and MUST NOT include content / severity / request_type / church_id /
      // user_id (drift-guarded by handler.test.ts).
      //
      // The runtime emission is deliberately the only place that calls
      // console.{error,warn,log}; nothing else in the function bypasses this
      // surface (per SEC item-4(b) verification grep evidence in ITERATION 2
      // SUMMARY).
      const line = JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },

    newOperationId() {
      return crypto.randomUUID();
    },
  };
}

// Surface TRIAGE_TEMPLATE so a future refactor can pull it into shared config.
// Currently used only by handler via the literal `'heartcry_triage_notification'`.
void TRIAGE_TEMPLATE;

const handler = createHandler(makeDeps());
Deno.serve(handler);
