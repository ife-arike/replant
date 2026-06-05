-- KAN-32 — Add heartcry_feed_approved to audit_log action CHECK constraint.
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action = ANY (ARRAY[
  'read_region','read_heartcry','verify_church','reject_church',
  'flag_cleared','flag_escalated','flag_read','pii_scrubbed',
  'deactivate_church','deactivate_user','announcement_deleted',
  'team_member_added','team_member_removed','rag_overridden',
  'rag_override_removed','reinstate_church','super_admin_granted',
  'super_admin_revoked','admin_session_refreshed','admin_password_reset',
  'admin_step_up_reauth','heartcry_responded','flag_queue_opened',
  'underground_oversight_opened','announcement_created',
  'pastoral_signal_seen','pastoral_signal_dispositioned',
  'pastoral_context_expanded','pastoral_digest_emitted',
  'church_details_updated','admin_aal2_elevation','admin_mfa_factor_reset',
  'underground_aal2_gate','heartcry_aal2_gate','admin_password_reset_sent',
  'prayer_request_withdrawn','heartcry_feed_consent_retracted',
  'church_location_updated','branch_created','branch_invite_responded',
  'branch_member_removed','branch_activated','verify_leader',
  'reject_leader','edit_pending','welcome_dm_sent',
  'replant_team_reply_sent','comment_posted',
  'heartcry_feed_approved'
]));
