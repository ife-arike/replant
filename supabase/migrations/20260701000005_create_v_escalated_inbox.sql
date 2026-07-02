-- KAN-293/295/296/292 — v_escalated_inbox VIEW
--
-- LEFT JOIN escalated_cases + escalated_case_proposals (pending only) so the
-- inbox surface has both case + proposal state in one row.
--
-- security_invoker=true so caller's RLS applies (denied for JS clients by
-- deny-all RLS on the underlying tables; access flows through SECURITY DEFINER
-- RPCs which run as postgres role).
--
-- Excludes closed cases — Founder ruling 2026-06-30 "no Resolved register".

CREATE OR REPLACE VIEW public.v_escalated_inbox
WITH (security_invoker = true) AS
SELECT
  ec.id              AS case_id,
  ec.case_id_seq,
  ec.source_axis,
  ec.source_message_id,
  ec.state,
  ec.escalation_reason,
  ec.escalation_context,
  ec.escalated_by_user_id,
  ec.escalated_by_tier,
  ec.auto_routed,
  ec.created_at,
  ec.leader_user_id,
  ec.receiver_user_id,
  ec.reach_out_message_id,
  ecp.id             AS proposal_id,
  ecp.action         AS proposal_action,
  ecp.reasoning      AS proposal_reasoning,
  ecp.proposer_id    AS proposal_proposer_id,
  ecp.proposer_tier  AS proposal_proposer_tier,
  ecp.created_at     AS proposal_created_at,
  ecp.expires_at     AS proposal_expires_at,
  EXTRACT(EPOCH FROM (now() - ec.created_at)) / 86400.0 AS age_days
FROM public.escalated_cases ec
LEFT JOIN public.escalated_case_proposals ecp
  ON ecp.case_id = ec.id AND ecp.proposal_status = 'pending'
WHERE ec.state <> 'closed';
