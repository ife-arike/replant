-- KAN-272 / Workstream B ratification #2 — patch fn_confirm_underground_proposal
-- to set churches.rejected_by in the reject branch and clear it in the restore branch.
-- All other behavior preserved verbatim from live introspection.
--
-- Also extends fn_list_pending_underground_queue projection with rejected_by +
-- rejection-proposer fields so the Rejected detail page can render
-- "Rejected by X · proposed by Y" without a follow-up join. Rejected churches
-- are surfaced via the existing soft_deleted_at branch in WHERE.
--
-- Applied to remote via MCP apply_migration on 2026-06-24.
-- NOTE: fn_list_pending_underground_queue gets DROP+CREATE because the return
-- TABLE() shape changed (Postgres cannot ALTER RETURNS for set-returning fns).

CREATE OR REPLACE FUNCTION public.fn_confirm_underground_proposal(p_proposal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
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
  ELSIF v_p.action = 'reject' THEN
    UPDATE public.churches
      SET verification_status='rejected', rejected_at=now(),
          rejected_by=v_caller_id,                             -- KAN-272: denormalize confirmer (B)
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
      rejected_by=NULL,                                        -- KAN-272: clear on restore
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

DROP FUNCTION IF EXISTS public.fn_list_pending_underground_queue();

CREATE FUNCTION public.fn_list_pending_underground_queue()
RETURNS TABLE(
  church_id uuid, church_code text, region_admin_only text, type text,
  show_church_name boolean, country text, created_at timestamp with time zone,
  verification_status text, soft_deleted_at timestamp with time zone,
  hard_delete_scheduled_at timestamp with time zone,
  last_outcome_modal_kind text, last_outcome_modal_shown_at timestamp with time zone,
  rejection_reason_code text, appeal_status text, appeal_received_at timestamp with time zone,
  day_of_window integer, pending_proposal_count integer, needs_founder_eyes boolean,
  leader_reply_pending boolean,
  in_review_claimed_by uuid, in_review_claimed_by_name text,
  in_review_claimed_at timestamp with time zone,
  in_review_routed_to_founder_at timestamp with time zone,
  pending_proposal_id uuid, pending_proposal_action text,
  pending_proposal_proposer_id uuid, pending_proposal_proposer_name text,
  pending_proposal_pinned_admin_id uuid, pending_proposal_pinned_admin_name text,
  pending_proposal_created_at timestamp with time zone,
  pending_proposal_expires_at timestamp with time zone,
  pending_proposal_admin_notes text, pending_proposal_evidence_tier text,
  pending_proposal_contact_channel text, pending_proposal_rejection_reason text,
  rejected_at timestamp with time zone,
  rejected_by_user_id uuid,
  rejected_by_name text,
  rejected_proposer_id uuid,
  rejected_proposer_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  RETURN QUERY
  SELECT
    c.id AS church_id,
    c.church_code,
    c.region_admin_only::text AS region_admin_only,
    c.type::text,
    c.show_church_name,
    c.country,
    c.created_at,
    c.verification_status::text,
    c.soft_deleted_at,
    c.hard_delete_scheduled_at,
    c.last_outcome_modal_kind,
    c.last_outcome_modal_shown_at,
    c.rejection_reason_code,
    c.appeal_status,
    c.appeal_received_at,
    CASE
      WHEN c.soft_deleted_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (now() - c.soft_deleted_at))::integer)
      ELSE
        GREATEST(0, EXTRACT(DAY FROM (now() - c.created_at))::integer)
    END AS day_of_window,
    (
      SELECT count(*)::integer
        FROM public.underground_verification_proposals p2
        WHERE p2.church_id = c.id AND p2.proposal_status = 'pending'
    ) AS pending_proposal_count,
    (
      (
        c.soft_deleted_at IS NOT NULL
        AND EXTRACT(DAY FROM (now() - c.soft_deleted_at))::integer >= 25
      )
      OR c.appeal_status IN ('email_received', 'in_review')
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.church_id = c.id
          AND u.outcome_modal_acknowledged_at IS NOT NULL
          AND c.soft_deleted_at IS NOT NULL
          AND u.outcome_modal_acknowledged_at > c.soft_deleted_at
      )
    ) AS needs_founder_eyes,
    EXISTS (
      SELECT 1
      FROM public.audit_log_underground al_reply
      WHERE al_reply.church_id = c.id
        AND al_reply.action = 'underground_request_more_info'
        AND NOT EXISTS (
          SELECT 1
          FROM public.audit_log_underground al_q
          WHERE al_q.church_id = c.id
            AND al_q.action = 'underground_request_info_sent'
            AND al_q.accessed_at > al_reply.accessed_at
        )
    ) AS leader_reply_pending,
    c.in_review_claimed_by,
    claimer.full_name AS in_review_claimed_by_name,
    c.in_review_claimed_at,
    c.in_review_routed_to_founder_at,
    p.id AS pending_proposal_id,
    p.action AS pending_proposal_action,
    p.proposer_id AS pending_proposal_proposer_id,
    proposer.full_name AS pending_proposal_proposer_name,
    p.pinned_admin_id AS pending_proposal_pinned_admin_id,
    pinned.full_name AS pending_proposal_pinned_admin_name,
    p.created_at AS pending_proposal_created_at,
    p.expires_at AS pending_proposal_expires_at,
    p.admin_notes AS pending_proposal_admin_notes,
    p.evidence_tier AS pending_proposal_evidence_tier,
    p.contact_channel AS pending_proposal_contact_channel,
    p.rejection_reason AS pending_proposal_rejection_reason,
    c.rejected_at,
    c.rejected_by AS rejected_by_user_id,
    rb.full_name AS rejected_by_name,
    rp.proposer_id AS rejected_proposer_id,
    rp_user.full_name AS rejected_proposer_name
  FROM public.churches c
  LEFT JOIN public.users claimer ON claimer.id = c.in_review_claimed_by
  LEFT JOIN public.underground_verification_proposals p
    ON p.church_id = c.id AND p.proposal_status = 'pending'
  LEFT JOIN public.users proposer ON proposer.id = p.proposer_id
  LEFT JOIN public.users pinned ON pinned.id = p.pinned_admin_id
  LEFT JOIN public.users rb ON rb.id = c.rejected_by
  LEFT JOIN LATERAL (
    SELECT proposer_id
      FROM public.underground_verification_proposals
      WHERE church_id = c.id
        AND action = 'reject'
        AND proposal_status = 'confirmed'
      ORDER BY confirmed_at DESC NULLS LAST
      LIMIT 1
  ) rp ON true
  LEFT JOIN public.users rp_user ON rp_user.id = rp.proposer_id
  WHERE c.type = 'underground'
    AND c.hard_deleted_at IS NULL
    AND (
      c.verification_status = 'pending'
      OR c.soft_deleted_at IS NOT NULL
    )
  ORDER BY 16 DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_list_pending_underground_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_confirm_underground_proposal(uuid) TO authenticated;
