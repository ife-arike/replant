-- KAN-271 / F14 — fix LATERAL ambiguity in fn_list_pending_underground_queue.
--
-- Symptom: Underground Oversight Pending tab + Rejected tab error:
--   "column reference 'church_id' is ambiguous"
--
-- Root cause: RETURNS TABLE(church_id uuid, ...) introduces church_id as an
-- OUT parameter inside the function body. The LATERAL subquery (added by
-- migration 0028c for rejected_proposer_id) referenced church_id, action,
-- proposal_status, confirmed_at UNQUALIFIED. Postgres can't disambiguate
-- between OUT param and table column → ERRCODE 42702.
--
-- Audit of full RETURN QUERY body (~80 lines): the ONLY unqualified
-- reference that collides with an OUT param is `WHERE church_id = c.id` in
-- the LATERAL. Other subqueries (p2.church_id, al_reply.church_id,
-- u.church_id) are already correctly aliased. Other refs in the LATERAL
-- (action, proposal_status, confirmed_at, proposer_id) do not collide with
-- any OUT param name in this signature — but qualifying ALL of them is
-- defense-in-depth against future OUT param additions reintroducing
-- ambiguity. So this patch aliases the table and qualifies every column
-- referenced inside the LATERAL.
--
-- RETURN TABLE shape unchanged — function body-only patch via CREATE OR
-- REPLACE (no DROP+CREATE needed since signature is stable).
--
-- Applied to remote via MCP apply_migration on 2026-06-25.

CREATE OR REPLACE FUNCTION public.fn_list_pending_underground_queue()
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
    SELECT uvp.proposer_id
      FROM public.underground_verification_proposals uvp
      WHERE uvp.church_id = c.id
        AND uvp.action = 'reject'
        AND uvp.proposal_status = 'confirmed'
      ORDER BY uvp.confirmed_at DESC NULLS LAST
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
