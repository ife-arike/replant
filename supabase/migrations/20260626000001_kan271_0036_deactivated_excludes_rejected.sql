-- KAN-271 Migration 0036 — fn_list_deactivated_underground excludes rejected
--
-- Founder Q3 (Option A — 2026-06-25): rejected churches belong on the
-- Rejected tab ONLY. The reject branch of fn_confirm_underground_proposal
-- sets BOTH verification_status='rejected' AND soft_deleted_at=now() +
-- hard_delete_scheduled_at=now()+30d for data hygiene. The Deactivated
-- tab's filter was `soft_deleted_at IS NOT NULL`, which caught rejected
-- churches alongside genuinely-deactivated (previously-verified) ones.
--
-- F15 added a FE-side `r => r.verification_status !== 'rejected'` filter,
-- but the RPC doesn't project verification_status — so the filter
-- evaluated against `undefined` and was a no-op. Founder's 2026-06-26
-- pre-UAT pass found RPL-30067 still showing in Deactivated.
--
-- Fix: enforce the data taxonomy server-side. DROP+CREATE because adding
-- verification_status to RETURNS TABLE changes the shape (Postgres
-- requires DROP for shape changes).

DROP FUNCTION IF EXISTS public.fn_list_deactivated_underground();

CREATE FUNCTION public.fn_list_deactivated_underground()
 RETURNS TABLE(
   church_id uuid,
   church_code text,
   region_admin_only text,
   soft_deleted_at timestamp with time zone,
   soft_delete_reason text,
   hard_delete_scheduled_at timestamp with time zone,
   hard_deleted_at timestamp with time zone,
   last_admin_name text,
   verification_status text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  RETURN QUERY
  SELECT
    c.id,
    c.church_code,
    c.region_admin_only::text,
    c.soft_deleted_at,
    c.soft_delete_reason,
    c.hard_delete_scheduled_at,
    c.hard_deleted_at,
    (
      SELECT u.full_name
        FROM public.underground_verification_proposals p
        JOIN public.users u ON u.id = COALESCE(p.confirmer_id, p.proposer_id)
        WHERE p.church_id = c.id
          AND p.proposal_status = 'confirmed'
        ORDER BY p.confirmed_at DESC NULLS LAST
        LIMIT 1
    ),
    c.verification_status::text
  FROM public.churches c
  WHERE c.type = 'underground'
    AND c.soft_deleted_at IS NOT NULL
    AND c.verification_status != 'rejected'
  ORDER BY c.soft_deleted_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_list_deactivated_underground() TO authenticated;
