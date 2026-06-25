-- 20260623_0005_audit_action_additions.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 5 of 8
--
-- Locked Founder rulings (2026-06-22):
--   All new audit actions go to audit_log_underground (separate stricter
--   table per ruling #7) — NOT public.audit_log.
--
-- Per the manifest §1 bullets, 18 new actions:
--   propose × 6 / confirm × 6 / decline / request_info_sent / appeal_received /
--   restore_initiated / hard_delete_executed / outcome_modal_shown.
--
-- audit_log_underground.action is a text column with a CHECK constraint
-- (verified via pg_constraint introspection). Append the new values to the
-- CHECK by dropping + recreating it (atomic in one ALTER).
-- =============================================================================

ALTER TABLE public.audit_log_underground
  DROP CONSTRAINT IF EXISTS audit_log_underground_action_check;

ALTER TABLE public.audit_log_underground
  ADD CONSTRAINT audit_log_underground_action_check
  CHECK (action = ANY (ARRAY[
    -- Existing 12 actions (preserved verbatim)
    'underground_join_code_issued',
    'underground_join_code_revealed',
    'underground_join_code_redeemed',
    'underground_join_code_rotated',
    'underground_verified',
    'underground_rejected',
    'underground_brave_toggled_by_admin',
    'underground_deactivated',
    'underground_admin_note_added',
    'underground_request_more_info',
    'underground_two_eyes_confirmed',
    'admin_underground_recovery',
    -- 6 new propose actions
    'underground_propose_verify',
    'underground_propose_reject',
    'underground_propose_rotate_join_code',
    'underground_propose_visibility_override',
    'underground_propose_hard_delete',
    'underground_propose_restore',
    -- 6 new confirm actions
    'underground_confirm_verify',
    'underground_confirm_reject',
    'underground_confirm_rotate_join_code',
    'underground_confirm_visibility_override',
    'underground_confirm_hard_delete',
    'underground_confirm_restore',
    -- 6 new lifecycle actions
    'underground_decline_proposal',
    'underground_request_info_sent',
    'underground_appeal_received',
    'underground_restore_initiated',
    'underground_hard_delete_executed',
    'underground_outcome_modal_shown'
  ]::text[]));
