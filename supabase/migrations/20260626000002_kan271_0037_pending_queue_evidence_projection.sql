-- KAN-271 Migration 0037 — fn_list_pending_underground_queue projects
-- evidence_files + evidence_used_mb. P4 + P5 from Founder's 2026-06-26
-- pre-UAT pass.
--
-- Bug: FE reads `found.evidence_files` and `found.evidence_used_mb`
-- from the list payload. RPC never projected either. Result: Evidence
-- Packet section perpetually empty + storage indicator stuck at 0 MB
-- regardless of upload success. The reload() after upload runs fine;
-- the data simply isn't returned.
--
-- Fix: aggregate from underground_evidence_files filtered to
-- confirmed (confirmed_at IS NOT NULL) + not-soft-deleted (deleted_at
-- IS NULL). Build a JSONB array per church + sum size_bytes.
-- DROP+CREATE required for RETURNS TABLE shape change.

DROP FUNCTION IF EXISTS public.fn_list_pending_underground_queue();

CREATE FUNCTION public.fn_list_pending_underground_queue()
 RETURNS TABLE(
   church_id uuid, church_code text, region_admin_only text, type text,
   show_church_name boolean, country text, created_at timestamp with time zone,
   verification_status text, soft_deleted_at timestamp with time zone,
   hard_delete_scheduled_at timestamp with time zone, last_outcome_modal_kind text,
   last_outcome_modal_shown_at timestamp with time zone, rejection_reason_code text,
   appeal_status text, appeal_received_at timestamp with time zone,
   day_of_window integer, pending_proposal_count integer, needs_founder_eyes boolean,
   leader_reply_pending boolean,
   in_review_claimed_by uuid, in_review_claimed_by_name text,
   in_review_claimed_at timestamp with time zone, in_review_routed_to_founder_at timestamp with time zone,
   pending_proposal_id uuid, pending_proposal_action text,
   pending_proposal_proposer_id uuid, pending_proposal_proposer_name text,
   pending_proposal_pinned_admin_id uuid, pending_proposal_pinned_admin_name text,
   pending_proposal_created_at timestamp with time zone,
   pending_proposal_expires_at timestamp with time zone,
   pending_proposal_admin_notes text, pending_proposal_evidence_tier text,
   pending_proposal_contact_channel text, pending_proposal_rejection_reason text,
   pending_proposal_is_mine boolean,
   rejected_at timestamp with time zone, rejected_by_user_id uuid,
   rejected_by_name text, rejected_proposer_id uuid, rejected_proposer_name text,
   evidence_files jsonb, evidence_used_mb numeric
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
    (p.proposer_id IS NOT NULL AND p.proposer_id = v_caller_id) AS pending_proposal_is_mine,
    c.rejected_at,
    c.rejected_by AS rejected_by_user_id,
    rb.full_name AS rejected_by_name,
    rp.proposer_id AS rejected_proposer_id,
    rp_user.full_name AS rejected_proposer_name,
    -- P4: evidence files JSONB array. ORDER BY confirmed_at ASC so the
    -- FE renders oldest-first (matching the natural "evidence accumulated
    -- over time" reading). Filter: confirmed (intent rows without a
    -- confirm are orphan placeholders) + not soft-deleted.
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id',              ef.id,
          'filename',        ef.filename,
          'mime_type',       ef.mime_type,
          'size_bytes',      ef.size_bytes,
          'contact_channel', ef.contact_channel,
          'summary',         ef.summary,
          'linked_audit_id', ef.linked_audit_id,
          'uploader_id',     ef.uploader_id,
          'confirmed_at',    ef.confirmed_at
        ) ORDER BY ef.confirmed_at ASC)
        FROM public.underground_evidence_files ef
        WHERE ef.church_id = c.id
          AND ef.confirmed_at IS NOT NULL
          AND ef.deleted_at IS NULL
      ),
      '[]'::jsonb
    ) AS evidence_files,
    -- P5: used storage in MB, two-decimal precision for display.
    COALESCE(
      (
        SELECT ROUND((SUM(ef.size_bytes)::numeric / 1048576.0)::numeric, 2)
        FROM public.underground_evidence_files ef
        WHERE ef.church_id = c.id
          AND ef.confirmed_at IS NOT NULL
          AND ef.deleted_at IS NULL
      ),
      0::numeric
    ) AS evidence_used_mb
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
