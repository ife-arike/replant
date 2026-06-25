-- KAN-271 / KAN-272 — extend audit action CHECK constraints on BOTH tables.
-- Split per manifest §1 Migration 0026:
--   audit_log_underground gains: view_rejected_underground_church (workstream B #3)
--   audit_log gains: admin_tier_promotion_{requested,approved,denied,expired},
--                    admin_invite_sent, admin_demote, admin_revoke, account_name_updated
-- Drop-and-recreate is the standard pattern for CHECK constraint extension
-- (Postgres has no ALTER CHECK ADD VALUE). Live introspection captured pre-change.
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

-- ---- audit_log_underground -----------------------------------------------
ALTER TABLE public.audit_log_underground
  DROP CONSTRAINT IF EXISTS audit_log_underground_action_check;

ALTER TABLE public.audit_log_underground
  ADD CONSTRAINT audit_log_underground_action_check CHECK (action = ANY (ARRAY[
    'underground_join_code_issued', 'underground_join_code_revealed',
    'underground_join_code_redeemed', 'underground_join_code_rotated',
    'underground_verified', 'underground_rejected',
    'underground_brave_toggled_by_admin', 'underground_deactivated',
    'underground_admin_note_added', 'underground_request_more_info',
    'underground_two_eyes_confirmed', 'admin_underground_recovery',
    'underground_propose_verify', 'underground_propose_reject',
    'underground_propose_rotate_join_code', 'underground_propose_visibility_override',
    'underground_propose_hard_delete', 'underground_propose_restore',
    'underground_confirm_verify', 'underground_confirm_reject',
    'underground_confirm_rotate_join_code', 'underground_confirm_visibility_override',
    'underground_confirm_hard_delete', 'underground_confirm_restore',
    'underground_decline_proposal', 'underground_request_info_sent',
    'underground_appeal_received', 'underground_restore_initiated',
    'underground_hard_delete_executed', 'underground_outcome_modal_shown',
    'underground_claim_marked', 'underground_claim_released',
    'underground_claim_force_unmarked', 'underground_claim_routed_day_25',
    'underground_request_release_pinged', 'underground_evidence_intent',
    'underground_evidence_confirmed', 'underground_evidence_deleted',
    'underground_evidence_signed_url_minted',
    'ug_second_leader_submitted', 'ug_second_leader_approved', 'ug_second_leader_rejected',
    'underground_proposal_declined_with_counter', 'underground_proposal_counter_created',
    'underground_claim_reassigned_via_counter', 'underground_proposal_cancelled_by_proposer',
    'underground_propose_notify_dropped',
    -- KAN-272 — Rejected detail page view event
    'view_rejected_underground_church'
  ]));

-- ---- audit_log -----------------------------------------------------------
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (action = ANY (ARRAY[
    'read_region', 'read_heartcry', 'verify_church', 'reject_church',
    'flag_cleared', 'flag_escalated', 'flag_read', 'pii_scrubbed',
    'deactivate_church', 'deactivate_user', 'announcement_deleted',
    'team_member_added', 'team_member_removed', 'rag_overridden',
    'rag_override_removed', 'reinstate_church', 'super_admin_granted',
    'super_admin_revoked', 'admin_session_refreshed', 'admin_password_reset',
    'admin_step_up_reauth', 'heartcry_responded', 'flag_queue_opened',
    'underground_oversight_opened', 'announcement_created', 'pastoral_signal_seen',
    'pastoral_signal_dispositioned', 'pastoral_context_expanded',
    'pastoral_digest_emitted', 'church_details_updated', 'admin_aal2_elevation',
    'admin_mfa_factor_reset', 'underground_aal2_gate', 'heartcry_aal2_gate',
    'admin_password_reset_sent', 'prayer_request_withdrawn',
    'heartcry_feed_consent_retracted', 'church_location_updated',
    'branch_created', 'branch_invite_responded', 'branch_member_removed',
    'branch_activated', 'verify_leader', 'reject_leader', 'edit_pending',
    'welcome_dm_sent', 'replant_team_reply_sent', 'comment_posted',
    'heartcry_feed_approved', 'branch_left', 'branch_name_edited',
    'branch_leader_removed', 'branch_deleted', 'branch_parent_auto_linked',
    'branch_parent_admin_linked',
    -- KAN-271 admin tier ceremony
    'admin_tier_promotion_requested', 'admin_tier_promotion_approved',
    'admin_tier_promotion_denied', 'admin_tier_promotion_expired',
    'admin_invite_sent', 'admin_demote', 'admin_revoke',
    -- KAN-271 Account page self-service name edit
    'account_name_updated'
  ]));
