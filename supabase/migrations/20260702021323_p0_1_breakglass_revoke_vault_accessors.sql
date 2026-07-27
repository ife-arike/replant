-- P0-1 BREAK-GLASS (pre-UAT audit 2026-07-01): anon could read the entire Vault via
-- public.get_secret_by_name(text) (SECURITY DEFINER, anon-EXECUTE, no search_path).
-- The anon/publishable key ships in the mobile bundle, so this was an UNAUTHENTICATED Vault read
-- (heartcry_encryption_key, resend_api_key, welcome_dm_internal_token, ...).
-- Every legitimate caller uses the service-role client (verified), which retains EXECUTE.
--
-- Applied to prod via Supabase MCP apply_migration; this file mirrors it into the repo
-- (remote version 20260702021323). Reference: docs/audits/2026-07-01-P0-1-vault-breakglass-runbook.md
REVOKE EXECUTE ON FUNCTION public.get_secret_by_name(text)              FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrypt_heartcry_content(text, text)  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.encrypt_heartcry_content(text, text)  FROM anon, authenticated, public;

-- Pin search_path on these SECURITY DEFINER functions (hardening).
-- encrypt_heartcry_content calls BARE pgp_sym_encrypt, so 'extensions' (pgcrypto's schema)
-- MUST remain on its path or heartcry encryption breaks. decrypt_ uses the qualified
-- extensions.pgp_sym_decrypt; get_secret_by_name uses the qualified vault.decrypted_secrets.
ALTER FUNCTION public.get_secret_by_name(text)             SET search_path = pg_catalog, public;
ALTER FUNCTION public.decrypt_heartcry_content(text, text) SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.encrypt_heartcry_content(text, text) SET search_path = pg_catalog, public, extensions;
