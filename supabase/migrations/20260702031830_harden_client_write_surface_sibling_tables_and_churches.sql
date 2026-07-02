-- P1 (pre-UAT audit 2026-07-01, RLS client-surface sweep): the 6 client-facing content tables granted
-- INSERT/UPDATE/DELETE to anon AND authenticated, with RLS default-deny the ONLY thing blocking UPDATE
-- on 5 of 6 (no UPDATE policy exists on any). Every legitimate write goes through a SECURITY DEFINER RPC
-- owned by postgres or a service_role edge function; mobile FE grep shows ZERO raw client mutations.
-- Revoking direct client writes removes the latent self-edit vectors (self-set prayed_count/status/
-- flag_status; direct message INSERT bypassing DELIVER-ALWAYS flagging + branch-membership).
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702031830).
REVOKE INSERT, UPDATE, DELETE ON
  public.prayer_requests, public.testimony, public.messages, public.connection_requests,
  public.prayer_request_prayed_by, public.comments
  FROM anon, authenticated;

-- churches: registration/profile writes are service_role edge functions (register-church/update-church)
-- + create_account_atomic (definer). Only legit client write is rag_status (Settings toggle;
-- enforce_underground_rag_red forces UG -> red regardless).
REVOKE INSERT, UPDATE, DELETE ON public.churches FROM anon, authenticated;
GRANT  UPDATE (rag_status) ON public.churches TO authenticated;

-- Drop the admin_region_read landmine: RESTRICTIVE UPDATE policy, always-true USING
-- (super_admin OR authenticated), NULL WITH CHECK -> imposes NO constraint today (churches_update_own
-- alone governs); a future PERMISSIVE UPDATE policy would combine with it to open churches writes.
DROP POLICY IF EXISTS admin_region_read ON public.churches;
