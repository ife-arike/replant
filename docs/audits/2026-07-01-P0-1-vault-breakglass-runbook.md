# P0-1 Break-glass Runbook — anon Vault exposure via `get_secret_by_name`

**Prepared by:** audit consultant (Claude Fable 5), 2026-07-01. **For:** Ruth to execute.
**Do NOT delegate the execution to the audit session** — per Replant conventions, production changes are Founder-executed. This runbook is paste-ready SQL for the Supabase SQL editor + a rotation checklist.

## What / why
`public.get_secret_by_name(text)`, `public.decrypt_heartcry_content(text,text)`, and `public.encrypt_heartcry_content(text,text)` are `SECURITY DEFINER` and currently EXECUTE-able by the `anon` role (and `encrypt_` by PUBLIC/`authenticated` too). Because the anon key ships publicly in the mobile app, an unauthenticated caller can `POST /rest/v1/rpc/get_secret_by_name` and read any Vault secret by name — including `heartcry_encryption_key`, `resend_api_key`, `welcome_dm_internal_token`.

## Pre-flight — verified SAFE to revoke (2026-07-01)
Every legitimate caller uses the **service-role** client, which retains EXECUTE after the revoke:
- `supabase/functions/send-message/index.ts:632,642` → `ADMIN_CLIENT.rpc('get_secret_by_name', …)` (service-role)
- `replant-admin/netlify/functions/_lib/welcome-dm.js:82` → `supabaseAdmin.rpc('get_secret_by_name', …)` (service-role)
- `supabase/functions/submit-heartcry/index.ts:56,143` → `adminClient.rpc('get_heartcry_encryption_key' | 'encrypt_heartcry_content', …)` (service-role, `createClient(url, SERVICE_ROLE_KEY)`)
- `replant-admin/netlify/functions/read-heartcry.js` → `decrypt_heartcry_content` + `get_heartcry_encryption_key` (service-role)

No client/edge path calls these with a user JWT. **The revoke will not break heartcry submit, welcome DMs, messaging, or admin heartcry reads.**

## STEP 1 — Stop the bleeding (do this first, immediately)
```sql
REVOKE EXECUTE ON FUNCTION public.get_secret_by_name(text)              FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrypt_heartcry_content(text, text)  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.encrypt_heartcry_content(text, text)  FROM anon, authenticated, public;
```

## STEP 2 — Verify the revoke landed (all three must return f / f)
```sql
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('get_secret_by_name','decrypt_heartcry_content','encrypt_heartcry_content');
```

## STEP 3 — Pin search_path (same window; hardening)
```sql
ALTER FUNCTION public.get_secret_by_name(text)             SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrypt_heartcry_content(text,text)  SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.encrypt_heartcry_content(text,text)  SET search_path = pg_catalog, public, extensions;
```
(`decrypt/encrypt` call `extensions.pgp_sym_*`, so keep `extensions` on their path. Confirm the schema of `pgp_sym_encrypt` before applying — it was `extensions.` in the live body.)

## STEP 4 — Secret rotation (exposure window unknown → assume compromised)
Rotation urgency + difficulty varies by secret. **Do the easy ones now; plan the hard one.**

| Vault secret | Action | Notes |
|---|---|---|
| `resend_api_key` | **Rotate now.** Resend dashboard → new key → update Vault secret value + any Netlify env that holds it. | Straightforward. Also addresses the earlier note that the Resend MCP key was invalid. |
| `welcome_dm_internal_token` | **Rotate now.** Generate a new random token → update the Vault secret value only. | Both producer (`welcome-dm.js`) and validator (`send-message` /internal) read it from Vault via `get_secret_by_name` (service-role), so a single Vault update propagates; new value picked up on next isolate cold-start. |
| `heartcry_encryption_key` | **⚠️ DO NOT naively rotate.** | This is a `pgp_sym` symmetric key. Rotating it makes every existing `heartcries.content` ciphertext undecryptable. Correct path = a planned re-encryption migration: for each heartcry, `decrypt(content, OLD_KEY)` → `encrypt(plaintext, NEW_KEY)` → swap the Vault key, all in one careful transaction (service-role, DBA-owned). The STEP-1 revoke stops *further* key exposure immediately; this re-encryption addresses the *already-exposed-key* risk and is its own small DBA sub-project. Decide with SEC/DBA whether the exposure risk warrants it given heartcry sensitivity. |
| `heartcry_triage_lead_email` | Optional. | An email address, not a credential — low stakes. Change only if you want. |
| `replant_system_user_id` | **Do NOT rotate.** | It's the Replant Team system-user UUID (`028be745-…`), an FK target already documented in memory — not a secret. Rotating would break FKs. |

## Rollback
STEP 1 is reversible if anything unexpected breaks: `GRANT EXECUTE ON FUNCTION public.<fn> TO service_role;` is already in place; you would only ever re-`GRANT` to a client role if a legitimate client caller is discovered (none found). No rollback should be needed.

## After
Fold the permanent version of STEP 1–3 into a migration so it survives environment rebuilds, and close it against KAN-289 (console/opacity) + the KAN-288 sweep. Re-run the audit's P0-1 check to confirm closure.
