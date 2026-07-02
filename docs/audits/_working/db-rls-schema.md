# Replant — DB / RLS / Schema Security Audit (Pre-UAT)

**Scope:** Live Postgres security posture of Supabase project `jiyetphxxvyiicrnwlnx` (production, live leader data).
**Method:** READ-ONLY `SELECT` via Supabase MCP `execute_sql`. No writes; `audit_log` not probed.
**Date:** 2026-07-01. **Auditor lane:** Database-security / Postgres-RLS SME.
**Context:** Life-safety. Real persecuted-Church leaders live since 2026-06-28. A schema leak can get a leader imprisoned or killed.

---

## LANE VERDICT: **NEEDS-FIX** (one P0 secret-disclosure primitive blocks UAT)

The underground-identity protection layer — CHECK constraints, triggers, UG masking in read RPCs, storage lockdown, append-only audit — is **excellent and, in most places, gold-standard**. The blocker is **not** in the UG-identity layer. It is a single anon-executable secret-disclosure function (`get_secret_by_name`) that hands the entire Supabase Vault — including the heartcry encryption key and the Resend API key — to any unauthenticated caller. That must be closed before UAT. Two mutable-search_path crypto helpers compound it. Everything else is P2/P3 hardening.

---

# P0 — UAT BLOCKER

## P0-1. `get_secret_by_name(text)` is EXECUTE-granted to `anon` and returns any Vault secret

**Evidence — function definition:**
```
CREATE OR REPLACE FUNCTION public.get_secret_by_name(secret_name text)
 RETURNS text LANGUAGE sql SECURITY DEFINER
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = secret_name LIMIT 1;
$function$
```
- `prosecdef = true`, **no `SET search_path`** (mutable).
- `proacl = {postgres=X/postgres, anon=X/postgres, service_role=X/postgres}` → **anon holds EXECUTE**.
- `has_function_privilege('anon', 'public.get_secret_by_name(text)', 'EXECUTE') = true`.

**Evidence — what it exposes (Vault secret names, values NOT read):**
```
heartcry_encryption_key      — "Heartcry content encryption key — do not rotate without migrating existing records"
heartcry_triage_lead_email
replant_system_user_id
resend_api_key               — production transactional email key (send scope, whole account)
welcome_dm_internal_token    — shared bearer token for the send-message /internal route
```

**Impact (catastrophic):** An unauthenticated client (the anon publishable key ships in the mobile app) can call:
- `get_secret_by_name('heartcry_encryption_key')` → plaintext heartcry encryption key. Every heartcry ciphertext that ever leaks by any path (log, over-fetch, one compromised account reading its own row) is now decryptable by anyone. Defense-in-depth on the most sensitive content type in the platform is nullified.
- `get_secret_by_name('resend_api_key')` → send email as `projectreplant.org` (phishing persecuted leaders from a trusted domain).
- `get_secret_by_name('welcome_dm_internal_token')` → forge the `/internal` welcome-DM route and impersonate the "Replant Team" system user to any leader.

The body schema-qualifies `vault.decrypted_secrets`, so mutable search_path does not redirect the *table* — but that is irrelevant; the grant itself is the breach. This is a direct, trivially-exploitable, unauthenticated full-secret disclosure.

**Recommendation (P0, pre-UAT):**
1. `REVOKE EXECUTE ON FUNCTION public.get_secret_by_name(text) FROM anon, authenticated, public;` — leave only `service_role` (and `postgres`). Edge functions run as service_role and are unaffected.
2. Add `SET search_path = ''` (or `pg_catalog`) and fully-qualify (`vault.decrypted_secrets` already is).
3. Rotate `welcome_dm_internal_token` and `resend_api_key` and re-key `heartcry_encryption_key` per its migration note **if** access logs cannot rule out exploitation during the exposure window. (Treat as possibly-compromised: the grant has been live.)
4. SEC to confirm no other consumer relies on anon/authenticated reaching this function (mobile client should never call it directly; only edge functions should).

---

# P1 — SHIP-BLOCKER SOON

## P1-1. `decrypt_heartcry_content` / `encrypt_heartcry_content` — anon EXECUTE + mutable search_path (privilege-escalation + key-capture vector)

**Evidence:**
```
decrypt_heartcry_content(ciphertext text, key text)  SECURITY DEFINER, no SET search_path
  → SELECT extensions.pgp_sym_decrypt(decode(ciphertext,'base64'), key);
  proacl: {postgres, anon, service_role}  → anon EXECUTE = true

encrypt_heartcry_content(plaintext text, key text)    SECURITY DEFINER, no SET search_path
  → SELECT encode(pgp_sym_encrypt(plaintext, key), 'base64');   -- UNQUALIFIED pgp_sym_encrypt
  proacl: {=X, postgres, anon, authenticated, service_role} → anon AND authenticated EXECUTE = true
```

**Impact:**
- **Mutable search_path on SECURITY DEFINER** = classic privilege-escalation. `encrypt_heartcry_content` calls **unqualified `pgp_sym_encrypt`**. A role able to create a function in any schema that resolves ahead of `extensions`/`pg_catalog` on the definer's path could shadow `pgp_sym_encrypt(text,text)` and capture both plaintext and key. `decrypt_heartcry_content` qualifies `extensions.pgp_sym_decrypt` (safer) but still lacks a pinned path.
- Combined with P0-1, anon has both the key (via `get_secret_by_name`) and the decrypt primitive. Closing P0-1 removes the key path; this remains a defense-in-depth and escalation concern.
- These raw crypto helpers should not be anon/authenticated-callable at all. Heartcry encryption/decryption belongs behind service-role edge functions and the `get_my_heartcries` RPC (which correctly never returns `content`).

**Recommendation:** `REVOKE EXECUTE ... FROM anon, authenticated, public` on both; add `SET search_path = ''` and fully-qualify `pgp_sym_encrypt` → `extensions.pgp_sym_encrypt`. Keep `service_role` only.

## P1-2. `find_similar_churches` does NOT exclude underground churches (existence oracle by name/email/phone)

**Evidence:** `find_church_by_code` and `find_parentable_churches` both filter `c.type NOT IN ('branch','para_ministry','underground')`. `find_similar_churches` filters only `c.type <> 'branch'` and returns `c.name, c.city, c.verification_status, match_reason`. It is SECURITY DEFINER with pinned `search_path='public','pg_temp'`, anon-executable, used in signup duplicate-detection.

**Impact:** A caller who supplies a matching name / `contact_email` / `contact_phone` gets back the underground church's **name** + verification status — an existence-and-identity oracle for underground congregations by contact detail. Mitigants: (a) `underground_no_location` CHECK forces `city = NULL`, so no location leaks; (b) the caller must already know a matching identifier. But UG church *names* are protected assets (governed by `show_church_name`), and duplicate-detection returning them to an unauthenticated signer is a real disclosure. Lower than P0 because it is name/existence (not location) and requires prior knowledge, but it is a genuine UG-identity leak on a life-safety surface.

**Recommendation:** Add `AND c.type <> 'underground'` (ideally the same 3-type exclusion as the sibling finders) to `find_similar_churches`. If UG duplicate-detection is genuinely needed at signup, it must run server-side under service_role with results never returned to the client. Route to SEC.

---

# Ground-truth invariant verification (all PASS)

Every load-bearing invariant in the audit brief was checked against live catalog and **matches**:

**Views (Investigation 1):**
- `churches_public`: `WHERE ((is_active = true) AND (type <> 'underground'::church_type))` — **UG excluded ✓**.
- `churches_admin`: `WHERE (type <> 'underground'::church_type)` — **UG excluded ✓**.
- Both are `security_mode = definer(default)` (no `security_invoker`). **Verdict on SECURITY DEFINER here: acceptable, not a risk.** Both views are hard-filtered to exclude underground and expose only non-sensitive church columns; `churches_public` additionally requires `is_active`. Neither view carries lat/lng for UG (impossible — UG rows are filtered out entirely). Because the views themselves enforce the UG exclusion in their own WHERE clause, definer semantics do not widen exposure beyond intent. **Recommendation (P3):** consider `security_invoker=on` for belt-and-suspenders so the querying user's RLS on `churches` also applies, but this is hardening, not a defect. `churches_admin` exposes `lat/lng/contact_email/admin_notes` — confirm only admin surfaces query it (it is not itself role-gated; it relies on the caller's grants/RLS on the base table).

**CHECK constraints (Investigations 6):**
- `underground_no_location`: `CHECK ((type <> 'underground') OR ((lat IS NULL) AND (lng IS NULL) AND (city IS NULL)))` ✓ — brave UG (show_church_name=true) still gets NO location.
- `join_code_only_underground`: `CHECK ((type = 'underground') OR (underground_join_code_hash IS NULL))` ✓
- `non_underground_requires_country` ✓
- Partial UNIQUE: `churches_underground_join_code_hash_unique ON (underground_join_code_hash) WHERE (underground_join_code_hash IS NOT NULL)` ✓
- `underground_verification_proposals`: `no_self_confirm` (proposer_id IS DISTINCT FROM confirmer_id) ✓; `admin_notes >= 30` ✓; **`evidence_tier IN ('t1_referral','t2_live_call')` — T3 photo tier NOT accepted ✓ (explicitly confirmed: no 't3' value anywhere in the CHECK)**; `proposal_status IN (pending,confirmed,declined,expired,cancelled)` ✓; bonus `pinned_admin_not_proposer` ✓.
- `escalated_case_proposals`: `ecp_no_self_approve` ✓; `ecp_reasoning_len` (30–500) ✓; `ecp_proposer_tier IN ('super_admin','top_tier')` ✓; `ecp_category_required_for_escalate_check` (category NOT NULL when action='escalate_to_manager') ✓; `ecp_status IN (pending,approved,rejected,expired,cancelled)` ✓.
- `audit_log`: `actor_must_be_identified CHECK ((accessed_by IS NOT NULL) OR (triggered_by IS NOT NULL))` ✓.

**Triggers (Investigation 6):**
- `trg_prevent_underground_join_code_hash_change` (BEFORE UPDATE on churches) ✓
- `audit_log_immutable` (BEFORE UPDATE OR DELETE) ✓
- `trg_audit_log_underground_no_delete` + `trg_audit_log_underground_no_update` ✓
- `trg_underground_claim_events_no_delete` + `_no_update` ✓
- `trg_underground_evidence_files_metadata_immutable` (BEFORE UPDATE) ✓
- `prevent_proposal_terminal_update` + `trg_assert_counter_propose_distinct_action` on uvp ✓
- `trg_admin_tier_promotions_no_terminal_update` ✓

**custom_access_token_hook (Investigation 8):** `prosecdef = true` ✓; `proconfig = search_path=public, pg_temp` (pinned) ✓.
- `is_top_tier_admin`: re-derived every mint from `public.users.is_top_tier_admin` **column** ✓ (column-authoritative, drift-free — matches locked ruling).
- `super_admin` and `is_underground_admin`: derived from `claims -> 'app_metadata'` (JWT-side), NOT re-read from `public.users` columns. See P2-1.

**Storage (Investigation 10):**
- Bucket `underground_evidence`: `public = false` ✓.
- `underground_evidence_deny_anon` (ALL, anon): `bucket_id <> 'underground_evidence'` (USING + WITH CHECK) ✓
- `underground_evidence_deny_authenticated` (ALL, authenticated): same ✓
- Base-table grants on `underground_evidence_files`: anon/authenticated SELECT+INSERT = **false** (grants revoked — defense-in-depth beyond RLS) ✓. Access only via `fn_underground_get_evidence_signed_url` (UG-admin-gated, TTL 300s, append-only audited). **Gold standard.**

---

# P2 — POST-UAT

## P2-1. Token hook derives `super_admin` / `is_underground_admin` from JWT app_metadata, not from `public.users` columns (asymmetry vs `is_top_tier_admin`)
`custom_access_token_hook` self-heals `is_top_tier_admin` from the column on every mint, but takes `super_admin` and `is_underground_admin` from the incoming `app_metadata`. This is the mechanism behind the already-documented `is_underground_admin` dual-source behavior (memory: `ug_flag_dual_source_bug.md`): a grant/revoke that updates the `public.users` column but not `app_metadata` leaves the JWT claim stale until app_metadata is rewritten and the token re-minted. Runtime enforcement (`fn_assert_underground_admin()`) reads the **column**, so authorization decisions are column-authoritative and safe; the risk is a stale JWT claim used by client-side UI gating (e.g. the `full_name` reveal branch in `get_prayer_wall`/`get_landing_testimonies`, which reads `app_metadata.role`). **Recommendation:** confirm every UG/super_admin grant+revoke path writes BOTH column and app_metadata (or refactor the hook to re-derive both from columns like it does for top_tier). Verify with SEC.

## P2-2. Realtime publication includes PII-bearing tables (`messages`, `connection_requests`, `branches`, `branch_members`) — safe only because Supabase Realtime enforces SELECT RLS per subscriber
**Evidence — `supabase_realtime` members:** `admin_tier_promotions`, `branch_members`, `branches`, `connection_requests`, `messages`, `underground_admin_inbox_events`, `underground_detail_events`.
- `messages` carries `content` (plaintext DM body), `sender_id`, `receiver_id`, `flag_reason`, `attribution_display_name`.
- `connection_requests` carries `message` (free-text), `sender_id`, `recipient_id`.
- `branches` carries `name`, `created_by`; `branch_members` carries `user_id`, `branch_id`.

RLS policies confirmed scoped:
- `messages_select_own`: `sender_id IN (my users) OR receiver_id IN (my users)`.
- `connection_requests_recipient_select` / `_sender_select`: recipient/sender = me.
- `branches_select` / `branch_members_select`: member-of-branch via `branch_members` + `users.auth_id = auth.uid()`.

Supabase `postgres_changes` re-checks the SELECT policy per subscriber before delivering a row, so a subscriber only receives changes they could already read. This is why it is P2, not P0. **Two residual concerns:** (1) This departs from the stated invariant that *only* event-only tables (no PII) may be published; the safety now depends entirely on Realtime's RLS-on-broadcast staying correct and on these policies never regressing — a policy edit that loosens `messages_select_own` becomes a live WAL broadcast leak. (2) **Branch-thread messages**: `messages_select_own` only matches on `sender_id`/`receiver_id`; a branch message (populated `branch_id`, likely NULL `receiver_id`) has no branch-scoped SELECT policy, so non-sender branch members cannot SELECT it and will NOT receive it over Realtime — either branch messaging relies on an RPC/event-table (correct) or branch-thread realtime is silently broken for recipients. **Recommendation:** SEC to ratify the "PII tables in realtime, gated by RLS" posture explicitly (it contradicts the written invariant); prefer migrating DM/branch realtime to the event-table pattern already used for `underground_detail_events`/`underground_admin_inbox_events` so no PII column ever enters WAL. Confirm branch-thread delivery path. `replident = 'd'` (default/PK) on all published tables — fine for RLS-gated realtime (no full-row OLD image on UPDATE/DELETE beyond PK).

## P2-3. 14 SECURITY DEFINER functions have mutable search_path
**Evidence (SECURITY DEFINER, no pinned search_path):** `decrypt_heartcry_content`, `encrypt_heartcry_content` (see P1-1); `get_secret_by_name` (see P0-1); `expire_rag_overrides`; `protect_region_admin_only`; `prevent_audit_log_mutation`; `prevent_audit_log_underground_mutation`; and `st_estimatedextent` ×3 (PostGIS — accepted false positive, not app code). The trigger functions (`prevent_audit_log_mutation`, `prevent_audit_log_underground_mutation`, `protect_region_admin_only`) are lower-risk (invoked as triggers in a controlled context) but should still be pinned. **Recommendation:** add `SET search_path = ''` (fully-qualifying referenced objects) to all app-owned SECURITY DEFINER functions as a blanket hardening pass. Matches the Supabase advisor `function_search_path_mutable`.

## P2-4. `escalated_cases` / `escalated_case_proposals` rely on RLS-deny-all with no defense-in-depth grant revoke
Both tables: RLS **enabled, zero policies** → fail-closed deny-all for anon/authenticated (correct; implements the anti-gossip lockout). But `has_table_privilege('anon'/'authenticated', ..., 'SELECT'/'INSERT') = true` — the base grants exist; only RLS stops access. `underground_evidence_files` shows the stronger pattern (grants revoked AND RLS). **Recommendation (hardening):** `REVOKE` base grants from anon/authenticated on both escalated tables so a future accidental `CREATE POLICY ... USING (true)` cannot open them. Not exposed today.

---

# P3 — NICE-TO-HAVE

- **P3-1.** `churches_public` / `churches_admin`: switch to `security_invoker=on` so the querying user's RLS on `churches` also applies (belt-and-suspenders; UG already excluded by the view WHERE). Confirm only admin surfaces reach `churches_admin` (it exposes lat/lng/contact_email/admin_notes and is not itself role-gated).
- **P3-2.** Always-true RLS policies reviewed — **all benign:** `daily_scripture` (public scripture read), `country_continent_map` (reference lookup, authenticated), `heartcry_holds` SELECT authenticated=true (hold rows, no PII content), `audit_log_underground` INSERT with_check=true for authenticated (append-only insert path; UPDATE/DELETE blocked by trigger). None expose PII. No action required; documented for completeness.
- **P3-3.** `rls_disabled_in_public` on `spatial_ref_sys` — PostGIS system table, **accepted false positive** (static SRID reference data, no PII). No action.
- **P3-4.** 85 anon-executable SECURITY DEFINER functions enumerated (Investigation 2). Spot-checked the identity-sensitive ones: `find_church_by_code` ✓ (UG excluded, canonicalizes input, no oracle on malformed), `find_parentable_churches` ✓ (UG excluded, min-length-3 per SEC F5), `get_prayer_wall` ✓ (UG name→'Underground Church', country/rag→NULL, verified-only), `get_landing_testimonies` ✓ (same UG masking), `get_my_heartcries` ✓ (self-only, never returns `content`), `get_open_prayers` ✓ (pinned search_path=''), `fn_underground_get_evidence_signed_url` ✓ (UG-admin-gated). The remaining functions are self-scoped RPCs (`send_connection_request`, `withdraw_connection_request`, account lifecycle, admin-tier ceremony) that assert caller identity internally. `find_similar_churches` is the one exception → P1-2. No other anon function found leaking UG name/location or cross-user PII.

---

# What works well (protections correctly in place — protect these)

1. **Underground location is structurally impossible to leak.** `underground_no_location` CHECK forces `lat/lng/city = NULL` on every UG row at the storage layer — even "brave" UG (`show_church_name=true`). Both `churches_public` and `churches_admin` additionally exclude `type='underground'` entirely. Defense is layered (constraint + view filter + RPC masking).

2. **UG masking in every anon read RPC is consistent and correct.** `get_prayer_wall` and `get_landing_testimonies` collapse UG church name to the literal `'Underground Church'`, NULL the country, NULL the RAG status, and only reveal a leader's `full_name` to super_admin (else anonymized display name or NULL when `anonymous=true`). This is textbook tiered masking.

3. **Underground evidence storage is gold-standard locked.** Private bucket + `ALL`-command deny policies on `storage.objects` for both anon and authenticated + base-table grants revoked on `underground_evidence_files` + access only through a UG-admin-gated, TTL-limited, append-only-audited signed-URL RPC. Triple-layered.

4. **Append-only audit is enforced by trigger, not convention.** `audit_log`, `audit_log_underground`, `underground_claim_events` all have BEFORE UPDATE/DELETE guard triggers; `audit_log_underground` additionally runs FORCE RLS. `actor_must_be_identified` CHECK guarantees every audit row names an actor.

5. **The two-person-integrity workflows are constraint-enforced.** `no_self_confirm` (UG proposals) and `ecp_no_self_approve` (escalated cases) make self-approval a database-level impossibility, not an application check. Proposer-tier and reasoning-length gates are also constraints. T3 evidence tier is correctly locked out of the CHECK (deferred feature cannot be smuggled in).

6. **The token hook is column-authoritative where it matters most.** `is_top_tier_admin` is re-derived from the `public.users` column on every JWT mint — no promote-to-Manager path can create drift. Search_path is pinned. (super_admin/UG asymmetry noted as P2-1.)

7. **Escalated-case tables fail closed.** RLS enabled with zero policies = deny-all for client roles, implementing the anti-gossip lockout at the RLS layer with no accidental read path.

8. **Duplicate-code lookup gives no oracle.** `find_church_by_code` returns empty (not an error) on malformed input and excludes branch/para/underground types.

---

## Verdict recap
- **DB layer: NEEDS-FIX for UAT.** Single P0 (`get_secret_by_name` anon grant) is a true blocker — close it and rotate the exposed secrets before any external UAT. Land the two P1s (crypto-helper grants+search_path; `find_similar_churches` UG exclusion) in the same pass. P2/P3 are hardening and can follow UAT.
- The **underground-identity protection layer itself is ready** — it is the strongest part of this schema. The blocker is an unrelated secrets-plumbing grant, not a failure of the UG design.
