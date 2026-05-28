// KAN-13 register-church Edge Function — Screen 05 onboarding entry point.
//
// SEC-locked invariants:
//   - verify_jwt = false at the platform (config.toml). This is the ONLY
//     register-church endpoint and it is called BEFORE the user's auth.users
//     row exists. A JWT requirement here would break onboarding. Any change
//     requires a fresh SEC ruling.
//   - No audit_log writes from this function — admins observe new pending
//     registrations via the Verification Queue (KAN-47 surface).
//   - No SECURITY DEFINER RPC calls, no Vault accessors, no Resend emails.
//     The function is a thin validate-and-INSERT. Logic that needs vetting
//     lives in logic.ts (parsePayload, computeVerificationDeadline) and is
//     covered by logic.test.ts.
//   - Underground type-coercion of city / lat / lng happens in parsePayload
//     (logic.ts) — per c.10167 invariant "absent for underground — not sent,
//     not written." The BE force-strips on insert even if the FE leaks them.
//
// Contract source: KAN-13 c.10167. Live churches schema verified 2026-05-19;
// churches.address column added by migration 20260519140000.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHandler, type Deps } from "./handler.ts";

function makeDeps(): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment configuration");
  }
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    async insertChurch(row, verificationDeadline) {
      // Explicit verification_status='pending' even though the column default
      // already supplies it — keeps intent visible in code review and
      // protects against a future migration that changes the default.
      const { data, error } = await adminClient
        .from("churches")
        .insert({
          name: row.name,
          type: row.type,
          country: row.country,
          city: row.city,
          address: row.address,
          contact_name: row.contact_name,
          contact_email: row.contact_email,
          contact_phone: row.contact_phone,
          rag_status: row.rag_status,
          state_declaration: row.state_declaration,
          lat: row.lat,
          lng: row.lng,
          needs: row.needs,
          resources: row.resources,
          // Finalization fix 7 — emergency preparedness columns.
          has_emergency_plan: row.has_emergency_plan,
          open_to_collaboration: row.open_to_collaboration,
          // KAN-208 — enrichment. website_url/primary_language/
          // denomination_affiliation are nullable text. congregation_size_range
          // and show_contact_on_profile are NOT NULL DEFAULT, so they are
          // OMITTED when null (below) — passing explicit null would violate
          // NOT NULL rather than fall through to the column default.
          website_url: row.website_url,
          primary_language: row.primary_language,
          denomination_affiliation: row.denomination_affiliation,
          ...(row.congregation_size_range !== null
            ? { congregation_size_range: row.congregation_size_range }
            : {}),
          ...(row.show_contact_on_profile !== null
            ? { show_contact_on_profile: row.show_contact_on_profile }
            : {}),
          verification_status: "pending",
          verification_deadline: verificationDeadline,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`churches insert failed: ${error?.code ?? error?.message ?? "no row returned"}`);
      }
      return { id: data.id as string };
    },

    now() {
      return new Date();
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
