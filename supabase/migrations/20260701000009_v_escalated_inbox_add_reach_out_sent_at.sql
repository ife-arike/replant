-- KAN-296 follow-up (2026-07-01 morning smoke)
-- Adds `reach_out_sent_at` column to v_escalated_inbox VIEW so the drawer's
-- "Reach out sent by Replant Team" cue can show WHEN the reach-out was sent
-- (admin needs it to cross-reference the Team Inbox thread).
--
-- LEFT JOINs messages on ec.reach_out_message_id and exposes the message's
-- created_at. Drops + recreates because CREATE OR REPLACE rejects a column
-- addition mid-list (same posture as the mid-smoke enrichment on 2026-06-30).

DROP VIEW public.v_escalated_inbox;

CREATE VIEW public.v_escalated_inbox
WITH (security_invoker = true) AS
SELECT
  ec.id                    AS case_id,
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
  reach_out_msg.created_at AS reach_out_sent_at,
  ecp.id                   AS proposal_id,
  ecp.action               AS proposal_action,
  ecp.reasoning            AS proposal_reasoning,
  ecp.proposer_id          AS proposal_proposer_id,
  ecp.proposer_tier        AS proposal_proposer_tier,
  ecp.created_at           AS proposal_created_at,
  ecp.expires_at           AS proposal_expires_at,
  proposer_u.full_name     AS proposal_proposer_name,
  EXTRACT(epoch FROM now() - ec.created_at) / 86400.0 AS age_days,
  leader_u.full_name       AS leader_full_name,
  leader_u.role            AS leader_role,
  leader_c.name            AS leader_church,
  leader_c.type            AS leader_church_type,
  receiver_u.full_name     AS receiver_full_name,
  receiver_u.role          AS receiver_role,
  receiver_c.name          AS receiver_church,
  receiver_c.type          AS receiver_church_type,
  escalated_by_u.full_name AS escalated_by_name,
  msg.flag_reason          AS message_flag_reason,
  msg.content              AS message_content,
  msg.created_at           AS message_created_at,
  msg_sender.full_name     AS message_sender_name,
  msg_sender.role          AS message_sender_role
FROM escalated_cases ec
LEFT JOIN escalated_case_proposals ecp ON ecp.case_id = ec.id AND ecp.proposal_status = 'pending'::text
LEFT JOIN users proposer_u                  ON proposer_u.id      = ecp.proposer_id
LEFT JOIN users leader_u                    ON leader_u.id        = ec.leader_user_id
LEFT JOIN churches leader_c                 ON leader_c.id        = leader_u.church_id
LEFT JOIN users receiver_u                  ON receiver_u.id      = ec.receiver_user_id
LEFT JOIN churches receiver_c               ON receiver_c.id      = receiver_u.church_id
LEFT JOIN users escalated_by_u              ON escalated_by_u.id  = ec.escalated_by_user_id
LEFT JOIN messages msg                      ON msg.id             = ec.source_message_id
LEFT JOIN users msg_sender                  ON msg_sender.id      = msg.sender_id
LEFT JOIN messages reach_out_msg            ON reach_out_msg.id   = ec.reach_out_message_id
WHERE ec.state <> 'closed'::text;
