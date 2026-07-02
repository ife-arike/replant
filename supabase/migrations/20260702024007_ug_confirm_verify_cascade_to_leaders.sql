-- UG-ONBOARDING BLOCKER (pre-UAT audit 2026-07-01, PROVEN live): fn_confirm_underground_proposal's
-- verify branch updated only public.churches, never public.users, so the founding underground leader
-- stayed verification_status='pending' and was gated out of the app with NO admin recovery surface.
-- Fix: cascade verification to ALL non-deleted leaders on the church (Founder ruling), mirroring the
-- reject/restore branches' predicate exactly. Only the verify branch changes.
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702024007).
-- (A one-shot data-fix un-stranded the single already-verified church's founding leader separately.)
CREATE OR REPLACE FUNCTION public.fn_confirm_underground_proposal(p_proposal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_caller_id uuid; v_p RECORD; v_audit_action text;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();
  SELECT * INTO v_p FROM public.underground_verification_proposals WHERE id=p_proposal_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN RAISE EXCEPTION 'proposal not found' USING ERRCODE='42501'; END IF;
  IF v_p.proposal_status <> 'pending' THEN RAISE EXCEPTION 'proposal already %', v_p.proposal_status USING ERRCODE='22023'; END IF;
  IF v_p.expires_at < now() THEN RAISE EXCEPTION 'proposal expired' USING ERRCODE='22023'; END IF;
  IF v_p.proposer_id = v_caller_id THEN RAISE EXCEPTION 'proposer cannot self-confirm' USING ERRCODE='42501'; END IF;

  v_audit_action := 'underground_confirm_' || v_p.action;

  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, triggered_by, meta)
    VALUES (v_audit_action, v_p.church_id, v_caller_id, v_p.proposer_id, jsonb_build_object(
      'proposal_id', v_p.id, 'action', v_p.action, 'rejection_reason', v_p.rejection_reason));

  UPDATE public.underground_verification_proposals
    SET proposal_status='confirmed', confirmer_id=v_caller_id, confirmed_at=now()
    WHERE id=p_proposal_id;

  IF v_p.action = 'verify' THEN
    UPDATE public.churches
      SET verification_status='verified', verified=true, verified_at=now(),
          in_review_claimed_by=NULL, in_review_claimed_at=NULL, in_review_routed_to_founder_at=NULL
      WHERE id=v_p.church_id;
    -- Cascade: verify ALL non-deleted leaders on the church so the founding leader is not stranded
    -- at 'pending' with no admin recovery surface. Mirrors the reject/restore predicate exactly.
    UPDATE public.users
      SET verification_status='verified'
      WHERE church_id=v_p.church_id
        AND hard_deleted_at IS NULL
        AND soft_deleted_at IS NULL;
  ELSIF v_p.action = 'reject' THEN
    UPDATE public.churches
      SET verification_status='rejected', rejected_at=now(),
          rejected_by=v_caller_id,
          rejection_reason_code=v_p.rejection_reason,
          soft_deleted_at=now(),
          soft_delete_reason=CASE WHEN v_p.rejection_reason='safety_concern' THEN 'safety_evacuation' ELSE 'admin_deactivation' END,
          hard_delete_scheduled_at=now()+interval '30 days', last_outcome_modal_kind='rejected',
          last_outcome_modal_shown_at=NULL, is_active=false, deactivated_at=now(),
          in_review_claimed_by=NULL, in_review_claimed_at=NULL, in_review_routed_to_founder_at=NULL
      WHERE id=v_p.church_id;
    UPDATE public.users
      SET soft_deleted_at=now(),
          soft_delete_reason=CASE WHEN v_p.rejection_reason='safety_concern' THEN 'safety_evacuation' ELSE 'admin_deactivation' END,
          hard_delete_scheduled_at=now()+interval '30 days', is_active=false, deactivated_at=now()
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL AND soft_deleted_at IS NULL;
  ELSIF v_p.action = 'rotate_join_code' THEN
    UPDATE public.churches SET underground_join_code_rotated_at=now(),
      last_outcome_modal_kind='join_code_rotated', last_outcome_modal_shown_at=NULL
      WHERE id=v_p.church_id;
  ELSIF v_p.action = 'visibility_override' THEN
    UPDATE public.churches SET show_church_name=(v_p.visibility_direction='hidden_to_visible'),
      last_outcome_modal_kind='visibility_flipped', last_outcome_modal_shown_at=NULL
      WHERE id=v_p.church_id;
  ELSIF v_p.action = 'hard_delete' THEN
    UPDATE public.churches SET hard_delete_scheduled_at=now() WHERE id=v_p.church_id;
    UPDATE public.users SET hard_delete_scheduled_at=now()
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL;
  ELSIF v_p.action = 'restore' THEN
    UPDATE public.churches SET soft_deleted_at=NULL, soft_delete_reason=NULL,
      hard_delete_scheduled_at=NULL, is_active=true, deactivated_at=NULL,
      verification_status='pending', rejected_at=NULL,
      rejected_by=NULL,
      appeal_status='resolved_restore'
      WHERE id=v_p.church_id;
    UPDATE public.users SET soft_deleted_at=NULL, soft_delete_reason=NULL,
      hard_delete_scheduled_at=NULL, is_active=true, deactivated_at=NULL
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL;
  END IF;

  INSERT INTO public.underground_detail_events (church_id, kind, ref_id)
    VALUES (v_p.church_id, 'proposal_confirmed', v_p.id);

  IF v_p.action IN ('verify', 'reject') THEN
    INSERT INTO public.underground_detail_events (church_id, kind, ref_id)
      VALUES (v_p.church_id, 'claim_changed', v_p.church_id);
  END IF;
END;
$function$;
