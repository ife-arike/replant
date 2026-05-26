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
//     from Vault at first-request boot and cached in Deno isolate scope. SEC
//     concurs the cache pattern post-deploy (KAN-66 RESUME ruling); a Vault
//     accessor failure invalidates the cache so the next call re-loads.
//   - Triage-lead resolution: vault.decrypted_secrets[heartcry_triage_lead_email]
//     joined to public.users.email at boot. If the JOIN returns 0 rows the
//     function 5xx's startup — refusing to insert orphan heartcries with null
//     triage_lead_id, per HALT-comment 11096 reasoning.
//   - audit_log NO-WRITE on submission per v2.2 (admin reads in KAN-67 are the
//     audit surface).
//
// References: KAN-66 description AC; KAN-44 auth-status-check pattern for JWT
// validation, env wiring, and 401 path split (comments 10920, 10927, 10955).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
import {
  createHandler,
  type Deps,
  type EmailLogRow,
  type InsertHeartcryRow,
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

let bootCachePromise: Promise<BootCache> | null = null;

async function loadBootCache(adminClient: SupabaseClient, dbUrl: string): Promise<BootCache> {
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

  const ensureCache = (): Promise<BootCache> => {
    if (!bootCachePromise) {
      bootCachePromise = loadBootCache(adminClient, dbUrl).catch((err) => {
        // Reset so the next request re-tries — better than poisoning the worker.
        bootCachePromise = null;
        throw err;
      });
    }
    return bootCachePromise;
  };

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
          data.verification_status as "pending" | "verified" | "rejected" | "deactivated",
      };
    },

    async encryptContent(plaintext) {
      const cache = await ensureCache();
      const { data, error } = await adminClient.rpc("encrypt_heartcry_content", {
        plaintext,
        key: cache.encryptionKey,
      });
      if (error || typeof data !== "string" || data.length === 0) {
        throw new Error("encrypt_heartcry_content failed");
      }
      return data;
    },

    async insertHeartcry(row: InsertHeartcryRow) {
      // status defaults to 'received' at the column level — omitted here so the
      // function can't accidentally override it. Same for id, created_at.
      // feed_approved is admin-only (column default false handles the insert);
      // it is intentionally absent from this payload so a forged client body
      // can never bypass admin review.
      const { error } = await adminClient.from("heartcries").insert({
        church_id: row.church_id,
        user_id: row.user_id,
        content: row.content,
        severity: row.severity,
        request_type: row.request_type,
        triage_lead_id: row.triage_lead_id,
        post_to_feed: row.post_to_feed,
      });
      if (error) throw new Error(`heartcries insert failed: ${error.code ?? error.message}`);
    },

    async resolveTriageLeadId() {
      return (await ensureCache()).triageLeadId;
    },

    async resolveTriageLeadEmail() {
      return (await ensureCache()).triageLeadEmail;
    },

    async sendTriageEmail(to): Promise<ResendSendResult> {
      const cache = await ensureCache();
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
          return { ok: false, resend_id: null, error: `Resend HTTP ${res.status}` };
        }
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, resend_id: typeof body.id === "string" ? body.id : null };
      } catch (e) {
        return { ok: false, resend_id: null, error: (e as Error).message };
      }
    },

    async logEmail(row: EmailLogRow) {
      const nowISO = new Date().toISOString();
      const { error } = await adminClient.from("email_log").insert({
        user_id: row.user_id,
        template: row.template,
        sent_date: nowISO.slice(0, 10),
        sent_at: nowISO,
        resend_id: row.resend_id,
      });
      if (error) {
        // Best-effort observability; do NOT throw — submission is committed.
        console.warn(`[submit-heartcry] email_log insert failed: ${error.message}`);
      }
    },

    log(level, event, fields) {
      // Structured single-line JSON for log aggregation. Caller is responsible
      // for ensuring `fields` contains no plaintext content / severity /
      // request_type / church_id per AC.
      const line = JSON.stringify({ level, event, ...fields, ts: new Date().toISOString() });
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    },
  };
}

// Surface TRIAGE_TEMPLATE / TRIAGE constants so a future refactor can pull them
// into config. Currently used only by handler via deps.logEmail.
void TRIAGE_TEMPLATE;

const handler = createHandler(makeDeps());
Deno.serve(handler);
