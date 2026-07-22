-- KAN-324 / KAN-326 — Content section, M6: audit_log action tokens
--
-- Adds four Content-section audit actions:
--   submission_approved       — admin approves a content_submission
--   submission_declined       — admin declines a content_submission
--   correction_posted         — a 'correction' announcement is published
--   content_notify_email_sent — submitter notified of the decision by email
--
-- The action array below is the LIVE audit_log_action_check set captured
-- read-only on 2026-07-22 (89 tokens) with the four new tokens appended
-- (93 total). Captured from LIVE via pg_get_constraintdef, NOT from any older
-- migration file: the prior extend_..._leader_deactivation file carried 88
-- tokens and predates 'verification_window_extended' (the live 89th).
--
-- One CHECK-touching migration at a time (DBA convention). Tripwire below
-- aborts on any clobber of the live set.
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY[
  -- live set (89 tokens, verbatim from prod 2026-07-22):
  'read_region'::text, 'read_heartcry'::text, 'verify_church'::text, 'reject_church'::text,
  'flag_cleared'::text, 'flag_escalated'::text, 'flag_read'::text, 'pii_scrubbed'::text,
  'deactivate_church'::text, 'deactivate_user'::text, 'announcement_deleted'::text,
  'team_member_added'::text, 'team_member_removed'::text, 'rag_overridden'::text,
  'rag_override_removed'::text, 'reinstate_church'::text, 'super_admin_granted'::text,
  'super_admin_revoked'::text, 'admin_session_refreshed'::text, 'admin_password_reset'::text,
  'admin_step_up_reauth'::text, 'heartcry_responded'::text, 'flag_queue_opened'::text,
  'underground_oversight_opened'::text, 'announcement_created'::text, 'pastoral_signal_seen'::text,
  'pastoral_signal_dispositioned'::text, 'pastoral_context_expanded'::text,
  'pastoral_digest_emitted'::text, 'church_details_updated'::text, 'admin_aal2_elevation'::text,
  'admin_mfa_factor_reset'::text, 'underground_aal2_gate'::text, 'heartcry_aal2_gate'::text,
  'admin_password_reset_sent'::text, 'prayer_request_withdrawn'::text,
  'heartcry_feed_consent_retracted'::text, 'church_location_updated'::text, 'branch_created'::text,
  'branch_invite_responded'::text, 'branch_member_removed'::text, 'branch_activated'::text,
  'verify_leader'::text, 'reject_leader'::text, 'edit_pending'::text, 'welcome_dm_sent'::text,
  'replant_team_reply_sent'::text, 'comment_posted'::text, 'heartcry_feed_approved'::text,
  'branch_left'::text, 'branch_name_edited'::text, 'branch_leader_removed'::text,
  'branch_deleted'::text, 'branch_parent_auto_linked'::text, 'branch_parent_admin_linked'::text,
  'admin_tier_promotion_requested'::text, 'admin_tier_promotion_approved'::text,
  'admin_tier_promotion_denied'::text, 'admin_tier_promotion_expired'::text,
  'admin_invite_sent'::text, 'admin_demote'::text, 'admin_revoke'::text,
  'account_name_updated'::text, 'admin_grant_to_existing_user'::text, 'escalated_case_created'::text,
  'escalated_case_auto_routed'::text, 'escalated_proposal_proposed'::text,
  'escalated_proposal_approved'::text, 'escalated_proposal_rejected'::text,
  'escalated_case_closed'::text, 'escalated_inbox_opened'::text, 'escalated_case_reach_out_sent'::text,
  'case_escalated_to_manager'::text, 'account_soft_deleted'::text, 'account_restored'::text,
  'account_hard_deleted'::text, 'user_blocked'::text, 'user_unblocked'::text,
  'content_report_submitted'::text, 'content_report_rejected'::text, 'content_report_opened'::text,
  'content_report_cleared'::text, 'content_report_escalated'::text,
  'content_report_reporter_viewed'::text, 'request_info_sent'::text, 'request_info_reply'::text,
  'deactivate_leader'::text, 'reinstate_leader'::text, 'verification_window_extended'::text,
  -- new (M6, Content section):
  'submission_approved'::text, 'submission_declined'::text, 'correction_posted'::text,
  'content_notify_email_sent'::text
])));

DO $$
DECLARE
  v_def   text;
  v_count integer;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conname = 'audit_log_action_check'
     AND conrelid = 'public.audit_log'::regclass;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'audit_log_action_check missing after re-create';
  END IF;
  IF v_def NOT LIKE '%submission_approved%'
     OR v_def NOT LIKE '%submission_declined%'
     OR v_def NOT LIKE '%correction_posted%'
     OR v_def NOT LIKE '%content_notify_email_sent%' THEN
    RAISE EXCEPTION 'audit_log_action_check missing the new Content-section tokens';
  END IF;
  v_count := (length(v_def) - length(replace(v_def, '::text', ''))) / length('::text');
  IF v_count < 93 THEN
    RAISE EXCEPTION 'audit_log_action_check token count % < 93 — live-set clobber detected', v_count;
  END IF;
END $$;

COMMIT;
