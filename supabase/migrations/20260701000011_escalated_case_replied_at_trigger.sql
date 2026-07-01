-- KAN-296 morning smoke (2026-07-01)
--
-- Founder observed a case sitting at state='awaiting' even though the
-- leader had already replied in the Replant Team conversation. No
-- mechanism watched for the reply.
--
-- Adds:
--   * escalated_cases.replied_at timestamptz column
--   * Compound CHECK: state='replied' requires replied_at populated
--   * fn_flip_escalated_case_on_leader_reply() trigger function
--   * AFTER INSERT trigger on public.messages
--   * Backfill: any awaiting case with an existing leader reply is
--     flipped to 'replied' with replied_at = MIN(reply.created_at)
--   * v_escalated_inbox VIEW recreated to expose replied_at
--
-- Trigger semantics: skip system-authored messages (SYSTEM_USER_ID via
-- Vault; hardcoded here per the same shape as admin/reach-out endpoints).
-- For every non-system INSERT on messages, look for an escalated case
-- whose reach_out_message_id belongs to the same conversation_id and
-- whose state is still 'awaiting'; flip that case.

ALTER TABLE public.escalated_cases
  ADD COLUMN replied_at timestamptz;

ALTER TABLE public.escalated_cases
  ADD CONSTRAINT escalated_cases_replied_at_check
  CHECK (state <> 'replied' OR replied_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.fn_flip_escalated_case_on_leader_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  system_user_id uuid := '028be745-8014-4314-a7cf-36b0a4d52b46';
BEGIN
  IF NEW.sender_id = system_user_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.escalated_cases ec
  SET state      = 'replied',
      replied_at = NEW.created_at
  WHERE ec.state = 'awaiting'
    AND ec.reach_out_message_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = ec.reach_out_message_id
        AND m.conversation_id = NEW.conversation_id
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_flip_escalated_case_on_leader_reply
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION fn_flip_escalated_case_on_leader_reply();

-- Backfill: any awaiting case with an existing leader reply post-reach-out.
WITH replies AS (
  SELECT ec.id AS case_id,
         MIN(m.created_at) AS first_reply_at
  FROM public.escalated_cases ec
  JOIN public.messages ro ON ro.id = ec.reach_out_message_id
  JOIN public.messages m  ON m.conversation_id = ro.conversation_id
  WHERE ec.state = 'awaiting'
    AND m.sender_id <> '028be745-8014-4314-a7cf-36b0a4d52b46'
    AND m.created_at > ro.created_at
    AND m.is_active = true
  GROUP BY ec.id
)
UPDATE public.escalated_cases ec
SET state = 'replied', replied_at = replies.first_reply_at
FROM replies
WHERE ec.id = replies.case_id;

-- Recreate v_escalated_inbox with replied_at exposed.
DROP VIEW public.v_escalated_inbox;
CREATE VIEW public.v_escalated_inbox WITH (security_invoker = true) AS
SELECT
  ec.id                        AS case_id,
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
  reach_out_msg.created_at     AS reach_out_sent_at,
  ec.replied_at,
  ec.manager_review_by_user_id,
  ec.manager_review_at,
  ec.manager_review_category,
  ec.manager_review_reasoning,
  mgr_esc_by.full_name         AS manager_review_by_name,
  ecp.id                       AS proposal_id,
  ecp.action                   AS proposal_action,
  ecp.reasoning                AS proposal_reasoning,
  ecp.proposer_id              AS proposal_proposer_id,
  ecp.proposer_tier            AS proposal_proposer_tier,
  ecp.created_at               AS proposal_created_at,
  ecp.expires_at               AS proposal_expires_at,
  proposer_u.full_name         AS proposal_proposer_name,
  EXTRACT(epoch FROM now() - ec.created_at) / 86400.0 AS age_days,
  leader_u.full_name           AS leader_full_name,
  leader_u.role                AS leader_role,
  leader_c.name                AS leader_church,
  leader_c.type                AS leader_church_type,
  receiver_u.full_name         AS receiver_full_name,
  receiver_u.role              AS receiver_role,
  receiver_c.name              AS receiver_church,
  receiver_c.type              AS receiver_church_type,
  escalated_by_u.full_name     AS escalated_by_name,
  msg.flag_reason              AS message_flag_reason,
  msg.content                  AS message_content,
  msg.created_at               AS message_created_at,
  msg_sender.full_name         AS message_sender_name,
  msg_sender.role              AS message_sender_role
FROM escalated_cases ec
LEFT JOIN escalated_case_proposals ecp   ON ecp.case_id = ec.id AND ecp.proposal_status = 'pending'::text
LEFT JOIN users proposer_u               ON proposer_u.id     = ecp.proposer_id
LEFT JOIN users mgr_esc_by               ON mgr_esc_by.id     = ec.manager_review_by_user_id
LEFT JOIN users leader_u                 ON leader_u.id       = ec.leader_user_id
LEFT JOIN churches leader_c              ON leader_c.id       = leader_u.church_id
LEFT JOIN users receiver_u               ON receiver_u.id     = ec.receiver_user_id
LEFT JOIN churches receiver_c            ON receiver_c.id     = receiver_u.church_id
LEFT JOIN users escalated_by_u           ON escalated_by_u.id = ec.escalated_by_user_id
LEFT JOIN messages msg                   ON msg.id            = ec.source_message_id
LEFT JOIN users msg_sender               ON msg_sender.id     = msg.sender_id
LEFT JOIN messages reach_out_msg         ON reach_out_msg.id  = ec.reach_out_message_id
WHERE ec.state <> 'closed'::text;
