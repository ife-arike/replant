-- KAN-292 morning smoke refactor (2026-07-01)
--
-- Founder ruling: Escalate to Manager should NOT be a proposal (Manager
-- doesn't approve being escalated to; they see a notification and act).
--
-- Adds:
--   * 'manager_review' state on escalated_cases
--   * 4 metadata columns (by, at, category, reasoning)
--   * compound CHECK that state='manager_review' requires all 4 populated
--   * category enum CHECK
--   * reasoning length CHECK (30–500 chars)
--   * 'case_escalated_to_manager' audit action
--
-- Migrates any existing pending 'escalate_to_manager' proposal → cancels
-- the proposal + writes metadata onto the case + flips state to
-- 'manager_review'. Approved-in-history escalate_to_manager proposals
-- stay as-is (old flow, historical record).
--
-- VIEW recreated to expose the new columns.

-- ─── 1. State CHECK ────────────────────────────────────────────────
ALTER TABLE public.escalated_cases DROP CONSTRAINT escalated_cases_state_check;
ALTER TABLE public.escalated_cases ADD CONSTRAINT escalated_cases_state_check
  CHECK (state = ANY (ARRAY['open'::text, 'awaiting'::text, 'replied'::text, 'pending_proposal'::text, 'manager_review'::text, 'closed'::text]));

-- ─── 2. Metadata columns + CHECKs ────────────────────────────────
ALTER TABLE public.escalated_cases
  ADD COLUMN manager_review_by_user_id uuid REFERENCES public.users(id),
  ADD COLUMN manager_review_at         timestamptz,
  ADD COLUMN manager_review_category   text,
  ADD COLUMN manager_review_reasoning  text;

ALTER TABLE public.escalated_cases
  ADD CONSTRAINT escalated_cases_manager_review_category_check
  CHECK (
    manager_review_category IS NULL
    OR manager_review_category IN ('destructive_needed','pattern_multi_flag','pastoral_judgment','cross_tier','unsure')
  );

ALTER TABLE public.escalated_cases
  ADD CONSTRAINT escalated_cases_manager_review_reasoning_len_check
  CHECK (
    manager_review_reasoning IS NULL
    OR (char_length(manager_review_reasoning) >= 30 AND char_length(manager_review_reasoning) <= 500)
  );

ALTER TABLE public.escalated_cases
  ADD CONSTRAINT escalated_cases_manager_review_state_populated_check
  CHECK (
    state <> 'manager_review'
    OR (manager_review_by_user_id IS NOT NULL
        AND manager_review_at         IS NOT NULL
        AND manager_review_category   IS NOT NULL
        AND manager_review_reasoning  IS NOT NULL)
  );

-- ─── 3. Extend audit_log_action_check ────────────────────────────
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    'read_region', 'read_heartcry', 'verify_church', 'reject_church',
    'flag_cleared', 'flag_escalated', 'flag_read', 'pii_scrubbed',
    'deactivate_church', 'deactivate_user', 'announcement_deleted',
    'team_member_added', 'team_member_removed', 'rag_overridden',
    'rag_override_removed', 'reinstate_church', 'super_admin_granted',
    'super_admin_revoked', 'admin_session_refreshed', 'admin_password_reset',
    'admin_step_up_reauth', 'heartcry_responded', 'flag_queue_opened',
    'underground_oversight_opened', 'announcement_created', 'pastoral_signal_seen',
    'pastoral_signal_dispositioned', 'pastoral_context_expanded', 'pastoral_digest_emitted',
    'church_details_updated', 'admin_aal2_elevation', 'admin_mfa_factor_reset',
    'underground_aal2_gate', 'heartcry_aal2_gate', 'admin_password_reset_sent',
    'prayer_request_withdrawn', 'heartcry_feed_consent_retracted', 'church_location_updated',
    'branch_created', 'branch_invite_responded', 'branch_member_removed',
    'branch_activated', 'verify_leader', 'reject_leader', 'edit_pending',
    'welcome_dm_sent', 'replant_team_reply_sent', 'comment_posted',
    'heartcry_feed_approved', 'branch_left', 'branch_name_edited',
    'branch_leader_removed', 'branch_deleted', 'branch_parent_auto_linked',
    'branch_parent_admin_linked', 'admin_tier_promotion_requested',
    'admin_tier_promotion_approved', 'admin_tier_promotion_denied',
    'admin_tier_promotion_expired', 'admin_invite_sent', 'admin_demote',
    'admin_revoke', 'account_name_updated', 'admin_grant_to_existing_user',
    'escalated_case_created', 'escalated_case_auto_routed',
    'escalated_proposal_proposed', 'escalated_proposal_approved',
    'escalated_proposal_rejected', 'escalated_case_closed',
    'escalated_inbox_opened', 'escalated_case_reach_out_sent',
    'case_escalated_to_manager'
  ])
);

-- ─── 4. Migrate existing pending escalate_to_manager proposals ────
WITH src AS (
  SELECT id, case_id, proposer_id, created_at, category, reasoning
  FROM public.escalated_case_proposals
  WHERE action = 'escalate_to_manager' AND proposal_status = 'pending'
)
UPDATE public.escalated_cases ec
SET
  state = 'manager_review',
  manager_review_by_user_id = src.proposer_id,
  manager_review_at         = src.created_at,
  manager_review_category   = COALESCE(src.category, 'unsure'),
  manager_review_reasoning  = src.reasoning
FROM src
WHERE ec.id = src.case_id;

UPDATE public.escalated_case_proposals
SET proposal_status = 'cancelled'
WHERE action = 'escalate_to_manager' AND proposal_status = 'pending';

-- ─── 5. Recreate VIEW with new columns ────────────────────────────
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
