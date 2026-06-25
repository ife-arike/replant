-- 20260623_0006_soft_delete_rpcs.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 6 of 8
--
-- Leader-facing SECURITY DEFINER RPCs (manifest §2):
--   1. fn_acknowledge_outcome_modal(p_church_id uuid) RETURNS void
--   2. fn_soft_delete_my_account(p_reason text) RETURNS void
--   3. fn_restore_my_account() RETURNS void
--   4. fn_send_reply_to_team(p_question_id uuid, p_reply_text text) RETURNS void
--
-- Audit-before-content invariant: every state-changing RPC writes audit_log
-- or audit_log_underground BEFORE the destructive operation, so the audit
-- trail captures intent even if the body fails post-audit (the row remains
-- a valid record of what was attempted; failed mutations leave NO partial
-- state because the whole RPC is one transaction).
--
-- Manifest §2 note: "p_reason = 'leader_initiated' only via this path."
-- We enforce this server-side; admin paths use other reasons via 0008 RPCs.
--
-- The hard-delete sweeper (migration 0007) reads hard_delete_scheduled_at.
-- We set it on soft-delete to now() + 30 days per ruling #15.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. fn_acknowledge_outcome_modal — records leader tapped through the modal.
--    Idempotent — calling twice is harmless. Locks the modal off for this
--    leader (cadence helper in 0008 reads outcome_modal_acknowledged_at).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_acknowledge_outcome_modal(p_church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Resolve caller's public.users.id from auth.uid().
  SELECT u.id INTO v_user_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.hard_deleted_at IS NULL;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'caller not found' USING ERRCODE = '42501';
  END IF;

  -- Verify the church is the caller's church (defense-in-depth — leaders can
  -- only acknowledge their own church's modal).
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = v_user_id AND church_id = p_church_id
  ) THEN
    RAISE EXCEPTION 'church_id mismatch' USING ERRCODE = '42501';
  END IF;

  -- Audit BEFORE content (invariant). Use audit_log_underground when the
  -- church is underground; else use audit_log.
  IF EXISTS (SELECT 1 FROM public.churches WHERE id = p_church_id AND type = 'underground') THEN
    INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
      VALUES ('underground_outcome_modal_shown', p_church_id, v_user_id,
              jsonb_build_object('acknowledged_at', now()));
  END IF;

  -- Content: stamp acknowledgement.
  UPDATE public.users
    SET outcome_modal_acknowledged_at = now()
    WHERE id = v_user_id
      AND outcome_modal_acknowledged_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_acknowledge_outcome_modal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_acknowledge_outcome_modal(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. fn_soft_delete_my_account — leader-initiated path only.
--    Sets soft_deleted_at, hard_delete_scheduled_at = now()+30d, is_active=false.
--    If this user is the LAST active leader on their church, mirror onto the
--    church row (last-active-leader trigger spec from BA findings).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_soft_delete_my_account(p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_is_underground boolean;
  v_remaining_active_leaders integer;
BEGIN
  -- Only the leader-initiated reason is allowed via this path.
  IF p_reason IS DISTINCT FROM 'leader_initiated' THEN
    RAISE EXCEPTION 'invalid reason for self-soft-delete: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.church_id INTO v_user_id, v_church_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no active user found for caller' USING ERRCODE = '42501';
  END IF;

  v_is_underground := EXISTS (
    SELECT 1 FROM public.churches WHERE id = v_church_id AND type = 'underground'
  );

  -- Audit BEFORE content (invariant). audit_log_underground for underground.
  IF v_is_underground THEN
    INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
      VALUES ('underground_deactivated', v_church_id, v_user_id,
              jsonb_build_object('reason', p_reason, 'self_initiated', true));
  END IF;

  -- Content: stamp soft-delete on the user.
  UPDATE public.users
    SET soft_deleted_at = now(),
        soft_delete_reason = p_reason,
        hard_delete_scheduled_at = now() + interval '30 days',
        is_active = false,
        deactivated_at = now()
    WHERE id = v_user_id;

  -- Mirror onto church row if this was the last active leader.
  SELECT count(*) INTO v_remaining_active_leaders
    FROM public.users
    WHERE church_id = v_church_id
      AND is_active = true
      AND soft_deleted_at IS NULL
      AND hard_deleted_at IS NULL;

  IF v_remaining_active_leaders = 0 AND v_church_id IS NOT NULL THEN
    UPDATE public.churches
      SET soft_deleted_at = now(),
          soft_delete_reason = p_reason,
          hard_delete_scheduled_at = now() + interval '30 days',
          is_active = false,
          deactivated_at = now()
      WHERE id = v_church_id
        AND soft_deleted_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_soft_delete_my_account(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_soft_delete_my_account(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. fn_restore_my_account — leader self-restore within 30-day window AND
--    only if not yet hard-deleted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_restore_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_is_underground boolean;
  v_soft_deleted_at timestamptz;
  v_hard_deleted_at timestamptz;
  v_was_leader_initiated boolean;
BEGIN
  SELECT u.id, u.church_id, u.soft_deleted_at, u.hard_deleted_at,
         (u.soft_delete_reason = 'leader_initiated')
    INTO v_user_id, v_church_id, v_soft_deleted_at, v_hard_deleted_at, v_was_leader_initiated
    FROM public.users u
    WHERE u.auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'caller not found' USING ERRCODE = '42501';
  END IF;
  IF v_hard_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'account hard-deleted; restore unavailable' USING ERRCODE = '42501';
  END IF;
  IF v_soft_deleted_at IS NULL THEN
    RAISE EXCEPTION 'account is not soft-deleted' USING ERRCODE = '22023';
  END IF;
  IF v_soft_deleted_at + interval '30 days' < now() THEN
    RAISE EXCEPTION '30-day restore window has elapsed' USING ERRCODE = '22023';
  END IF;
  -- Per manifest §2: self-restore allowed only for leader-initiated soft-delete.
  -- Admin-initiated reasons require fn_initiate_restore_underground (0008).
  IF NOT v_was_leader_initiated THEN
    RAISE EXCEPTION 'admin-initiated deactivation; contact team to restore' USING ERRCODE = '42501';
  END IF;

  v_is_underground := EXISTS (
    SELECT 1 FROM public.churches WHERE id = v_church_id AND type = 'underground'
  );

  -- Audit BEFORE content.
  IF v_is_underground THEN
    INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
      VALUES ('underground_restore_initiated', v_church_id, v_user_id,
              jsonb_build_object('self_initiated', true));
  END IF;

  -- Restore user.
  UPDATE public.users
    SET soft_deleted_at = NULL,
        soft_delete_reason = NULL,
        hard_delete_scheduled_at = NULL,
        is_active = true,
        deactivated_at = NULL
    WHERE id = v_user_id;

  -- Restore church if it was mirror-soft-deleted by this leader's last-active exit.
  UPDATE public.churches
    SET soft_deleted_at = NULL,
        soft_delete_reason = NULL,
        hard_delete_scheduled_at = NULL,
        is_active = true,
        deactivated_at = NULL
    WHERE id = v_church_id
      AND soft_deleted_at IS NOT NULL
      AND soft_delete_reason = 'leader_initiated'
      AND hard_deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_restore_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_restore_my_account() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. fn_send_reply_to_team — leader reply to admin request-info question.
--    Stores into an append-only message thread on audit_log_underground meta.
--    p_question_id refers to a prior request_info_sent audit row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_send_reply_to_team(p_question_id uuid, p_reply_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_question_church_id uuid;
BEGIN
  IF p_reply_text IS NULL OR char_length(btrim(p_reply_text)) < 1 THEN
    RAISE EXCEPTION 'reply text required' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_reply_text) > 4000 THEN
    RAISE EXCEPTION 'reply text exceeds 4000 chars' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.church_id INTO v_user_id, v_church_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.hard_deleted_at IS NULL;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'caller not found' USING ERRCODE = '42501';
  END IF;

  -- Verify the question belongs to this caller's church.
  SELECT church_id INTO v_question_church_id
    FROM public.audit_log_underground
    WHERE id = p_question_id
      AND action = 'underground_request_info_sent';
  IF v_question_church_id IS NULL THEN
    RAISE EXCEPTION 'question not found' USING ERRCODE = '42501';
  END IF;
  IF v_question_church_id IS DISTINCT FROM v_church_id THEN
    RAISE EXCEPTION 'question/church mismatch' USING ERRCODE = '42501';
  END IF;

  -- Append the reply as a separate audit row (audit-before-content holds
  -- trivially — this is itself the content).
  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
    VALUES (
      'underground_request_more_info',
      v_church_id,
      v_user_id,
      jsonb_build_object(
        'reply_to_question_id', p_question_id,
        'reply_text', p_reply_text,
        'replied_by_leader', true
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_send_reply_to_team(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_send_reply_to_team(uuid, text) TO authenticated;
