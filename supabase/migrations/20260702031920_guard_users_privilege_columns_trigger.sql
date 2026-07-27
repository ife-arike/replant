-- P0-2 durable backstop (pre-UAT audit 2026-07-01): defense-in-depth so a FUTURE grant regression can't
-- re-open the self-promote-to-Manager class. Blocks a DIRECT client (authenticated/anon) UPDATE that
-- changes any privilege/safety column on public.users. SECURITY INVOKER (NOT definer) so current_user
-- reflects the real caller: inside a SECURITY DEFINER function (owner postgres) current_user='postgres';
-- a service_role admin write runs as 'service_role'; only a direct PostgREST write is 'authenticated'/'anon'.
-- VERIFIED: every function that writes these columns is SECURITY DEFINER owned by postgres, so none are
-- caught by this guard (fn_confirm_underground_proposal, update_leader_role, fn_revoke_admin,
-- fn_soft_delete_my_account, fn_restore_my_account, fn_ug_second_leader_approve, scrub_user_pii, ...).
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702031920).
CREATE OR REPLACE FUNCTION public.guard_users_privilege_cols()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.is_top_tier_admin    IS DISTINCT FROM OLD.is_top_tier_admin
    OR NEW.is_underground_admin  IS DISTINCT FROM OLD.is_underground_admin
    OR NEW.role                  IS DISTINCT FROM OLD.role
    OR NEW.verification_status   IS DISTINCT FROM OLD.verification_status
    OR NEW.church_id             IS DISTINCT FROM OLD.church_id
    OR NEW.is_active             IS DISTINCT FROM OLD.is_active
    OR NEW.auth_id               IS DISTINCT FROM OLD.auth_id
  ) THEN
    RAISE EXCEPTION 'privilege column mutation denied' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_users_privilege_cols ON public.users;
CREATE TRIGGER trg_guard_users_privilege_cols
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_privilege_cols();
