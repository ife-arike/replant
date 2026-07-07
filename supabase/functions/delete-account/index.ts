// delete-account edge function — deps wiring. KAN-205.
//
// SEC-locked invariants (mirror auth-status-check):
//   - verify_jwt = true at the platform (no config.toml here — the
//     platform default applies; deploy WITHOUT --no-verify-jwt). The
//     gateway rejects missing/expired/forged JWTs before this code runs;
//     the handler's anon-role rejection is defense-in-depth.
//   - Service-role client used ONLY for: caller lookup, auth-admin
//     global sign-out, email_log write, get_resend_api_key.
//   - The soft-delete RPC executes under the CALLER's JWT (user-scoped
//     client) so fn_soft_delete_my_account's own auth.uid() gate stays
//     the single authorization boundary.
//   - SAFE-LOG: no email addresses, names, or ids in log lines.
//
// Email discipline (Founder override of CONTENT B-1, consolidated
// ratification 2026-07-03 item 5):
//   - Standard variant: CLEAR — deletion started, 30-day restore
//     guidance, accounts@ for help. Reuses the ratified CONTENT copy
//     set's phrases so the email and the in-app screens speak with one
//     voice.
//   - Underground variant: byte-disciplined to the locked create-account
//     underground_pending pattern — same From family the leader already
//     receives, neutral subject, NO "underground", NO church, NO
//     deletion specifics. "A change was made… if this wasn't you, sign
//     in soon." The domain fingerprint was accepted at welcome; content
//     discipline is the protection.
//   - email_log template is ONE string for both variants (no UG
//     fingerprint inside the broader table); dedup (user_id, template,
//     sent_date) tolerated as best-effort.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import { createHandler, type CallerRow, type Deps } from "./handler.ts";

const RESEND_URL = "https://api.resend.com/emails";
// Same From family as create-account — the sender the leader already knows.
const FROM = "Replant <noreply@projectreplant.org>";
const EMAIL_TEMPLATE = "account_deletion_started";

interface Cache { resendApiKey: string; }
let cp: Promise<Cache | null> | null = null;

async function loadCache(c: SupabaseClient): Promise<Cache | null> {
  try {
    const { data, error } = await c.rpc("get_resend_api_key");
    if (error || typeof data !== "string" || !data.length) return null;
    return { resendApiKey: data };
  } catch {
    return null;
  }
}

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClientFor = (authHeader: string): SupabaseClient =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

  function cache(): Promise<Cache | null> {
    if (!cp) {
      cp = loadCache(adminClient).catch(() => {
        cp = null;
        return null;
      });
    }
    return cp;
  }

  return {
    async validateJwt(authHeader) {
      const client = userClientFor(authHeader);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { authUid: data.user.id, role: data.user.role ?? "anon" };
    },

    async fetchCaller(authUid) {
      const { data, error } = await adminClient
        .from("users")
        .select(
          "id, email, first_name, church_id, soft_deleted_at, soft_delete_reason, church:churches!users_church_id_fkey(type)",
        )
        .eq("auth_id", authUid)
        .maybeSingle();
      if (error || !data) return null;

      // Embedded relation shape varies (array vs object) across client
      // versions — normalize (auth-status-check precedent).
      const churchRaw = (data as Record<string, unknown>).church;
      let churchType: string | null = null;
      if (Array.isArray(churchRaw)) {
        churchType = (churchRaw[0] as { type?: string } | undefined)?.type ?? null;
      } else if (churchRaw !== null && churchRaw !== undefined) {
        churchType = (churchRaw as { type?: string }).type ?? null;
      }

      const row: CallerRow = {
        id: data.id as string,
        email: (data.email as string | null) ?? null,
        first_name: (data.first_name as string | null) ?? null,
        church_id: (data.church_id as string | null) ?? null,
        is_underground: churchType === "underground",
        soft_deleted_at: (data.soft_deleted_at as string | null) ?? null,
        soft_delete_reason: (data.soft_delete_reason as string | null) ?? null,
      };
      return row;
    },

    async softDeleteAsCaller(authHeader) {
      const client = userClientFor(authHeader);
      const { error } = await client.rpc("fn_soft_delete_my_account", {
        p_reason: "leader_initiated",
      });
      if (error) return { ok: false, message: error.message ?? "rpc error" };
      return { ok: true };
    },

    async revokeAllSessions(accessToken) {
      // GoTrue admin sign-out with scope=global revokes every refresh
      // token belonging to the presented session's user. supabase-js v2
      // exposes it as auth.admin.signOut(jwt, scope).
      const { error } = await adminClient.auth.admin.signOut(accessToken, "global");
      if (error) throw error;
    },

    async sendDeletionStartedEmail({ email, firstName, kind }) {
      const c = await cache();
      if (!c) throw new Error("Resend key unavailable");

      let subject: string;
      let body: string;

      if (kind === "underground") {
        // LOCKED information-free pattern (create-account underground_pending
        // discipline, Founder ruling #5 + CONTENT B2; re-affirmed for
        // deletion in the 2026-07-03 B-1 override). A hostile reader of
        // this inbox learns NOTHING: no name, no church, no "underground",
        // no mention of deletion. The signal for the leader is the
        // "sign in soon" line — the in-app RestoreScreen carries the rest.
        subject = "Your Replant account";
        body =
          `Hello,\n\n` +
          `A change was made to your account. No action is needed.\n\n` +
          `If this wasn't you, please sign in to the Replant app soon.\n\n` +
          `— The Replant Team\n` +
          `projectreplant.org`;
      } else {
        // Standard variant — Founder-ruled CLEAR: deletion started, 30-day
        // restore guidance, accounts@ for help. Phrases align with the
        // ratified CONTENT copy set (§2/§4/§5) so email and app speak with
        // one voice.
        const greetName = firstName && firstName.trim() ? ` ${firstName.trim()}` : "";
        subject = "Your Replant account deletion has started";
        body =
          `Hello${greetName},\n\n` +
          `You asked us to delete your Replant account, and the process has now started.\n\n` +
          `Deletion completes in 30 days. If you change your mind before then, sign in to the Replant app within the window and your account can be restored — everything as you left it.\n\n` +
          `After 30 days the deletion is permanent. Your name, email address, and phone number are removed from Replant, and you will no longer be able to sign in.\n\n` +
          `If something is wrong that we could help with, we would like to hear it. Write to accounts@projectreplant.org.\n\n` +
          `In Jesus' name,\n` +
          `Replant`;
      }

      const r = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to: email, subject, text: body }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}`);
    },

    async logEmailOutcome({ userId, outcome }) {
      const nowIso = new Date().toISOString();
      const { error } = await adminClient.from("email_log").insert({
        user_id: userId,
        template: EMAIL_TEMPLATE,
        sent_date: nowIso.slice(0, 10),
        sent_at: nowIso,
        resend_id: null,
        outcome,
      });
      // email_log_dedup UNIQUE(user_id, template, sent_date) makes a
      // same-day repeat insert fail — best-effort by contract; throw so
      // the handler warns without failing the deletion.
      if (error) throw new Error(error.message);
    },

    log(level, event, fields) {
      const line = JSON.stringify({
        level,
        event,
        ...(fields ?? {}),
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
