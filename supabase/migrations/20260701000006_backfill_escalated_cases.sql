-- KAN-293/295/296/292 — One-shot backfill for pre-launch escalated rows
--
-- Historical messages with flag_status='escalated' but no escalated_cases row
-- need to be materialized into the new table so they appear in v_escalated_inbox.
--
-- CORRECTION vs manifest §3 M6 draft: the backfill MUST detect UG-touched rows
-- (sender OR receiver in churches.type='underground') and set them as
-- auto_underground with escalated_by_user_id=NULL — otherwise they violate the
-- escalated_cases_auto_route_consistency CHECK constraint from M1.
--
-- Two-pass insert: UG-touched → auto_underground; non-UG → flagged.
--
-- Audit: single system-actor row noting the backfill.

-- Pass 1: UG-touched historical rows
INSERT INTO public.escalated_cases (
  source_axis, source_message_id, leader_user_id, receiver_user_id,
  state, escalation_reason, escalation_context,
  escalated_by_user_id, escalated_by_tier, auto_routed
)
SELECT
  'auto_underground', m.id, m.sender_id, m.receiver_id,
  'open', 'auto_underground',
  'Backfilled from pre-launch flagged-escalated row (underground party detected).',
  NULL, NULL, true
FROM public.messages m
LEFT JOIN public.escalated_cases ec ON ec.source_message_id = m.id
LEFT JOIN public.users us ON us.id = m.sender_id
LEFT JOIN public.churches cs ON cs.id = us.church_id
LEFT JOIN public.users ur ON ur.id = m.receiver_id
LEFT JOIN public.churches cr ON cr.id = ur.church_id
WHERE m.flag_status = 'escalated'
  AND ec.id IS NULL
  AND (cs.type = 'underground' OR cr.type = 'underground');

-- Pass 2: Non-UG historical rows
INSERT INTO public.escalated_cases (
  source_axis, source_message_id, leader_user_id, receiver_user_id,
  state, escalation_reason, escalation_context,
  escalated_by_user_id, escalated_by_tier, auto_routed
)
SELECT
  'flagged', m.id, m.sender_id, m.receiver_id,
  'open', 'unsure',
  'Backfilled from pre-launch flagged-escalated row.',
  m.flag_reviewed_by, 'super_admin', false
FROM public.messages m
LEFT JOIN public.escalated_cases ec ON ec.source_message_id = m.id
LEFT JOIN public.users us ON us.id = m.sender_id
LEFT JOIN public.churches cs ON cs.id = us.church_id
LEFT JOIN public.users ur ON ur.id = m.receiver_id
LEFT JOIN public.churches cr ON cr.id = ur.church_id
WHERE m.flag_status = 'escalated'
  AND ec.id IS NULL
  AND (cs.type IS DISTINCT FROM 'underground' AND cr.type IS DISTINCT FROM 'underground')
  AND m.flag_reviewed_by IS NOT NULL;

-- Audit the backfill (one row, system actor)
-- triggered_by='system' per audit_log_triggered_by_check (only allows user/cron/system/webhook);
-- migration identity captured in meta.source
INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta) VALUES (
  'escalated_case_created', NULL, 'system',
  jsonb_build_object(
    'source', 'migration:20260701000006',
    'backfill', true,
    'reason', 'pre-launch flagged-escalated rows'
  )
);
