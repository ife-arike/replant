-- KAN-271 Migration 0030b — existing-leader → admin path
-- Founder ratified 2026-06-24: an existing Replant leader (with church_id,
-- ministry_leader-style role) who is approved for admin keeps their existing
-- row + role + church_id; only admin_tier gets set. They can use BOTH mobile
-- (as leader) AND dashboard (as admin). This is the Founder's own case.
--
-- Endpoint owns the auth.admin.updateUserById({app_metadata.admin_tier='regular'})
-- call. This RPC validates + writes audit; SECURITY DEFINER cannot touch auth.*.

-- 1) Add admin_grant_to_existing_user to audit_log CHECK constraint
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    'read_region','read_heartcry','verify_church','reject_church','flag_cleared',
    'flag_escalated','flag_read','pii_scrubbed','deactivate_church','deactivate_user',
    'announcement_deleted','team_member_added','team_member_removed','rag_overridden',
    'rag_override_removed','reinstate_church','super_admin_granted','super_admin_revoked',
    'admin_session_refreshed','admin_password_reset','admin_step_up_reauth','heartcry_responded',
    'flag_queue_opened','underground_oversight_opened','announcement_created','pastoral_signal_seen',
    'pastoral_signal_dispositioned','pastoral_context_expanded','pastoral_digest_emitted',
    'church_details_updated','admin_aal2_elevation','admin_mfa_factor_reset','underground_aal2_gate',
    'heartcry_aal2_gate','admin_password_reset_sent','prayer_request_withdrawn',
    'heartcry_feed_consent_retracted','church_location_updated','branch_created','branch_invite_responded',
    'branch_member_removed','branch_activated','verify_leader','reject_leader','edit_pending',
    'welcome_dm_sent','replant_team_reply_sent','comment_posted','heartcry_feed_approved',
    'branch_left','branch_name_edited','branch_leader_removed','branch_deleted',
    'branch_parent_auto_linked','branch_parent_admin_linked','admin_tier_promotion_requested',
    'admin_tier_promotion_approved','admin_tier_promotion_denied','admin_tier_promotion_expired',
    'admin_invite_sent','admin_demote','admin_revoke','account_name_updated',
    'admin_grant_to_existing_user'
  ])
);

-- 2) fn_grant_admin_to_existing_user — for existing Replant leaders
CREATE OR REPLACE FUNCTION public.fn_grant_admin_to_existing_user(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
  v_target_id uuid;
  v_target_role public.user_role;
  v_target_active boolean;
BEGIN
  v_caller_id := public.fn_assert_super_admin();

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_field:user_id' USING ERRCODE='22023';
  END IF;

  SELECT id, role, is_active INTO v_target_id, v_target_role, v_target_active
    FROM public.users WHERE id = p_user_id;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE='22023';
  END IF;

  IF NOT v_target_active THEN
    RAISE EXCEPTION 'user_inactive' USING ERRCODE='22023';
  END IF;

  IF v_target_role = 'replant_staff'::user_role THEN
    RAISE EXCEPTION 'already_replant_staff' USING ERRCODE='22023';
  END IF;

  IF v_caller_id = v_target_id THEN
    RAISE EXCEPTION 'no_self_grant' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_grant_to_existing_user', v_caller_id, 'user'::text,
            jsonb_build_object(
              'target_user_id', v_target_id,
              'preserved_role', v_target_role::text,
              'tier_granted', 'regular'
            ));

  RETURN v_target_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_grant_admin_to_existing_user(uuid) TO authenticated;
