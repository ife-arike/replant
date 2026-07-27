# P0-2 Remediation Runbook — leader self-promotion to Manager (privilege escalation)

**Prepared by:** audit consultant (Claude Fable 5), 2026-07-01. **For:** Ruth (+ DBA) to execute.
**This is the #1 pre-UAT blocker.** Unlike P0-1, the *durable* fix has a small design decision (the safe-column allowlist) — but the break-glass REVOKE that stops the escalation is safe to run now.

## What / why
`public.users` and `public.churches` grant `UPDATE` to `authenticated` (and `anon`) on every column, and the `_update_own` RLS policies are row-scoped with no column scoping. So any authenticated leader can `PATCH` their own row and set privilege/safety columns directly. Worst path: `users.is_top_tier_admin=true` → `custom_access_token_hook` mints `admin_tier='top_tier'` from the column on next refresh → **the leader is a Manager** (heartcry decryption, team management, approve promotions). Also: self-verify account/church, self-grant `is_underground_admin` (DB-RPC layer), flip `churches.rag_status`/`show_church_name`.

## Pre-flight — which privileged columns does the FE write directly? (verified 2026-07-01)
Grep of both frontends for direct `.from('users'|'churches').update(...)`:
- **mobile `users` writes (all SAFE display/preference columns):** `display_name_preference`, `last_name_first`, `include_middle_name`, `honorific`, `suffix`, `anonymous` (`SettingsScreen.tsx:545–685`).
- **mobile `churches` write:** ONLY `rag_status` (`SettingsScreen.tsx:709–712`, no underground guard).
- **admin FE:** no direct `users`/`churches` writes (all via Netlify functions / RPCs).
- **The FE writes NONE of the catastrophic columns** (`is_top_tier_admin`, `is_underground_admin`, `verification_status`, `verified`, `church_id`, `role`, `is_active`, `auth_id`, `show_church_name`, `type`). → **Revoking those is FE-safe with zero breakage.**

## STEP 1 — Break-glass REVOKE (safe to run now; closes the escalation)
```sql
-- users: the privilege/safety columns the FE never writes
REVOKE UPDATE (is_top_tier_admin, is_underground_admin, verification_status,
               church_id, role, is_active, auth_id, verification_deadline,
               deactivated_at, soft_deleted_at, hard_delete_scheduled_at,
               hard_deleted_at, rejected_at, email)
  ON public.users FROM authenticated, anon;

-- churches: privilege/safety columns the FE never writes (rag_status handled in STEP 3)
REVOKE UPDATE (verification_status, verified, verified_at, show_church_name, type,
               church_code, region_admin_only, is_active, is_headquarters,
               branch_of_church_id, verification_deadline, deactivated_at,
               soft_deleted_at, hard_delete_scheduled_at, hard_deleted_at,
               rejected_at, underground_join_code_hash)
  ON public.churches FROM authenticated, anon;
```
(`auth_id` is already CHECK-pinned, and several churches columns already have protective triggers — revoking is belt-and-suspenders and harmless. Keep the display/preference columns writable so Settings keeps working.)

## STEP 2 — Verify the escalation is closed
```sql
-- Should return ZERO rows for the privilege columns
SELECT table_name, column_name, grantee
FROM information_schema.column_privileges
WHERE table_schema='public' AND privilege_type='UPDATE' AND grantee IN ('authenticated','anon')
  AND ( (table_name='users'    AND column_name IN ('is_top_tier_admin','is_underground_admin','verification_status','church_id','role','is_active'))
     OR (table_name='churches' AND column_name IN ('verification_status','verified','show_church_name','type')) )
ORDER BY 1,2,3;
```
Then confirm a leader token can no longer `PATCH` `is_top_tier_admin` (manual, non-prod, or trust the grant check above).

## STEP 3 — `rag_status` + the RAG-Red-for-underground bypass (do NOT skip)
The mobile Settings RAG toggle (`SettingsScreen.tsx:709`) writes `churches.rag_status` directly, and there is **no DB trigger enforcing RAG-Red for underground** (the invariant lives only in `create-account`). So an underground leader can currently flip their church off Red post-signup — a locked-invariant bypass (P1, folded here).
Fix (pick one, DBA call):
- **(a) Preferred:** add a `BEFORE UPDATE` trigger on `churches` that forces `rag_status='red'` when `type='underground'` (defense-in-depth, matches the create-account rule), keep the column client-writable for non-underground, AND hide/lock the RAG toggle for underground viewers in `SettingsScreen`. Then no REVOKE of `rag_status` needed.
- **(b)** Move the Settings RAG write to a SECURITY DEFINER RPC (`update_church_rag`) that enforces the underground lock, then `REVOKE UPDATE (rag_status) ON public.churches FROM authenticated, anon`.

## STEP 4 — Durable fix (the real close-out, SME/DBA session)
- Introduce a `update_leader_settings(...)` SECURITY DEFINER RPC that whitelists ONLY the safe self-editable columns (`display_name_preference`, `last_name_first`, `include_middle_name`, `honorific`, `suffix`, `anonymous`, phone, preferred_radius) and repoint `SettingsScreen` at it; then the `users` UPDATE grant to `authenticated` can be dropped entirely (RPC-only writes), matching the `update_leader_role` / `update_church_profile` pattern already in place.
- Column-scope the `users_update_own` / `churches_update_own` WITH CHECK as a second layer (grants + RLS both).
- **Sweep every other client-exposed table** (`comments`, `prayer_requests`, `testimonies`, `connection_requests`, etc.) for the same "broad column grant + row-only WITH CHECK" shape.
- Update KAN-221 (Backlog → done-with-this) and correct the `top_tier_admin_column_authoritative` memory.

## Rollback
STEP 1 is reversible (`GRANT UPDATE (col) … TO authenticated`) but should not be needed — no FE flow writes the revoked columns.
