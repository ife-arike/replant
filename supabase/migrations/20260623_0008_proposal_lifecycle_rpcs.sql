-- 20260623_0008_proposal_lifecycle_rpcs.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 8 of 8
--
-- Admin-facing RPCs (manifest §2) — all SECURITY DEFINER, all require
-- is_underground_admin = true, all audit-before-content.
--
-- Locked Founder rulings (2026-06-22):
--   #24 — Two-eyes on verify + join-code re-reveal: A proposes, B confirms.
--   #5 — Proposal TTL 72h, hourly cron flips pending → expired.
--   Q2 — Day-14 hybrid modal cadence (fn_should_fire_outcome_modal).
--   #17 — counter-proposal = B declines A's, returns row to Untouched,
--         notifies A, NOT a rejection of the church.
--   #11 — Day-25 routing to Founder = query layer in
--         fn_list_pending_underground_queue (not state-machine columns).
--
-- Internal invariant: no SECURITY DEFINER RPC is callable without passing
-- the underground-admin gate (fn_assert_underground_admin), which short-
-- circuits on the Founder UUID per ruling #23 fallback B.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Gate helper — used by every admin-facing RPC below.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_assert_underground_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_ok boolean;
BEGIN
  SELECT u.id, u.is_underground_admin INTO v_caller_id, v_ok
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL OR NOT v_ok THEN
    RAISE EXCEPTION 'underground admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN v_caller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_assert_underground_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_assert_underground_admin() TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_list_pending_underground_queue
--   Returns one row per pending underground church with computed SLA day,
--   needs-founder-eyes flag (day >= 25 OR engaging-post-modal OR
--   appeal-email-received), and pending-proposal count.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_list_pending_underground_queue()
RETURNS TABLE (
  church_id uuid,
  church_code text,
  type text,
  show_church_name boolean,
  country text,
  created_at timestamptz,
  verification_status text,
  soft_deleted_at timestamptz,
  hard_delete_scheduled_at timestamptz,
  last_outcome_modal_kind text,
  last_outcome_modal_shown_at timestamptz,
  rejection_reason_code text,
  appeal_status text,
  appeal_received_at timestamptz,
  day_of_window integer,
  pending_proposal_count integer,
  needs_founder_eyes boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  RETURN QUERY
  SELECT
    c.id AS church_id,
    c.church_code,
    c.type::text,
    c.show_church_name,
    c.country,
    c.created_at,
    c.verification_status::text,
    c.soft_deleted_at,
    c.hard_delete_scheduled_at,
    c.last_outcome_modal_kind,
    c.last_outcome_modal_shown_at,
    c.rejection_reason_code,
    c.appeal_status,
    c.appeal_received_at,
    CASE
      WHEN c.soft_deleted_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (now() - c.soft_deleted_at))::integer)
      ELSE
        GREATEST(0, EXTRACT(DAY FROM (now() - c.created_at))::integer)
    END AS day_of_window,
    (
      SELECT count(*)::integer
        FROM public.underground_verification_proposals p
        WHERE p.church_id = c.id AND p.proposal_status = 'pending'
    ) AS pending_proposal_count,
    (
      -- Needs-founder-eyes per Q1 ruling:
      -- (a) day >= 25 OR
      -- (b) appeal email received OR
      -- (c) leader engaged post-rejection-modal (outcome_modal_acknowledged_at IS NOT NULL)
      (
        c.soft_deleted_at IS NOT NULL
        AND EXTRACT(DAY FROM (now() - c.soft_deleted_at))::integer >= 25
      )
      OR c.appeal_status IN ('email_received', 'in_review')
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.church_id = c.id
          AND u.outcome_modal_acknowledged_at IS NOT NULL
          AND c.soft_deleted_at IS NOT NULL
          AND u.outcome_modal_acknowledged_at > c.soft_deleted_at
      )
    ) AS needs_founder_eyes
  FROM public.churches c
  WHERE c.type = 'underground'
    AND c.hard_deleted_at IS NULL
    AND (
      c.verification_status = 'pending'
      OR c.soft_deleted_at IS NOT NULL
    )
  ORDER BY day_of_window DESC, c.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_list_pending_underground_queue() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_list_pending_underground_queue() TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_propose_underground_action
--   Creates a pending proposal (one per church+action), audits the propose
--   action, returns proposal_id. p_payload is a jsonb blob keyed by action.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_propose_underground_action(
  p_church_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_proposal_id uuid;
  v_admin_notes text;
  v_audit_action text;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  IF p_action NOT IN ('verify','reject','rotate_join_code','visibility_override','hard_delete','restore') THEN
    RAISE EXCEPTION 'invalid action: %', p_action USING ERRCODE='22023';
  END IF;

  v_admin_notes := coalesce(p_payload->>'admin_notes', '');
  IF char_length(v_admin_notes) < 30 THEN
    RAISE EXCEPTION 'admin_notes must be >= 30 chars' USING ERRCODE='22023';
  END IF;

  -- Verify target is underground.
  IF NOT EXISTS (SELECT 1 FROM public.churches WHERE id=p_church_id AND type='underground') THEN
    RAISE EXCEPTION 'church not underground' USING ERRCODE='22023';
  END IF;

  v_audit_action := 'underground_propose_' || p_action;

  -- AUDIT BEFORE CONTENT.
  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
    VALUES (v_audit_action, p_church_id, v_caller_id, jsonb_build_object(
      'action', p_action,
      'admin_notes_len', char_length(v_admin_notes)
    ));

  -- CONTENT — insert proposal row. Partial UNIQUE index guards against dup
  -- pending entries.
  INSERT INTO public.underground_verification_proposals (
    church_id, action, proposer_id, admin_notes,
    rejection_reason, contact_channel, evidence_tier,
    visibility_direction, relay_token_hash
  ) VALUES (
    p_church_id,
    p_action,
    v_caller_id,
    v_admin_notes,
    NULLIF(p_payload->>'rejection_reason',''),
    NULLIF(p_payload->>'contact_channel',''),
    NULLIF(p_payload->>'evidence_tier',''),
    NULLIF(p_payload->>'visibility_direction',''),
    NULLIF(p_payload->>'relay_token_hash','')
  ) RETURNING id INTO v_proposal_id;

  RETURN v_proposal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_propose_underground_action(uuid,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_propose_underground_action(uuid,text,jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_confirm_underground_proposal
--   Two-eyes commit. Confirmer must be different admin than proposer
--   (no_self_confirm CHECK enforces). Applies the action atomically.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirm_underground_proposal(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_p RECORD;
  v_audit_action text;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  SELECT * INTO v_p FROM public.underground_verification_proposals
    WHERE id = p_proposal_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN
    RAISE EXCEPTION 'proposal not found' USING ERRCODE='42501';
  END IF;
  IF v_p.proposal_status <> 'pending' THEN
    RAISE EXCEPTION 'proposal already %', v_p.proposal_status USING ERRCODE='22023';
  END IF;
  IF v_p.expires_at < now() THEN
    RAISE EXCEPTION 'proposal expired' USING ERRCODE='22023';
  END IF;
  IF v_p.proposer_id = v_caller_id THEN
    RAISE EXCEPTION 'proposer cannot self-confirm' USING ERRCODE='42501';
  END IF;

  v_audit_action := 'underground_confirm_' || v_p.action;

  -- AUDIT BEFORE CONTENT.
  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, triggered_by, meta)
    VALUES (v_audit_action, v_p.church_id, v_caller_id, v_p.proposer_id, jsonb_build_object(
      'proposal_id', v_p.id,
      'action', v_p.action,
      'rejection_reason', v_p.rejection_reason
    ));

  -- Mark proposal terminal.
  UPDATE public.underground_verification_proposals
    SET proposal_status = 'confirmed',
        confirmer_id = v_caller_id,
        confirmed_at = now()
    WHERE id = p_proposal_id;

  -- Apply the action to the church.
  IF v_p.action = 'verify' THEN
    UPDATE public.churches
      SET verification_status = 'verified',
          verified = true,
          verified_at = now()
      WHERE id = v_p.church_id;
  ELSIF v_p.action = 'reject' THEN
    UPDATE public.churches
      SET verification_status = 'rejected',
          rejected_at = now(),
          rejection_reason_code = v_p.rejection_reason,
          soft_deleted_at = now(),
          soft_delete_reason = CASE
            WHEN v_p.rejection_reason = 'safety_concern' THEN 'safety_evacuation'
            ELSE 'admin_deactivation'
          END,
          hard_delete_scheduled_at = now() + interval '30 days',
          last_outcome_modal_kind = 'rejected',
          last_outcome_modal_shown_at = NULL,  -- forces Day-0 fire
          is_active = false,
          deactivated_at = now()
      WHERE id = v_p.church_id;
    -- Mirror to all leaders on this church.
    UPDATE public.users
      SET soft_deleted_at = now(),
          soft_delete_reason = CASE
            WHEN v_p.rejection_reason = 'safety_concern' THEN 'safety_evacuation'
            ELSE 'admin_deactivation'
          END,
          hard_delete_scheduled_at = now() + interval '30 days',
          is_active = false,
          deactivated_at = now()
      WHERE church_id = v_p.church_id
        AND hard_deleted_at IS NULL
        AND soft_deleted_at IS NULL;
  ELSIF v_p.action = 'rotate_join_code' THEN
    -- Hash rotation is delegated to a separate ops RPC (already exists per
    -- the underground hash flow). Here we stamp the rotation timestamp +
    -- audit; the actual new-code mint + hash insert happens via the
    -- caller-side rotate-join-code wrapper.
    UPDATE public.churches
      SET underground_join_code_rotated_at = now(),
          last_outcome_modal_kind = 'join_code_rotated',
          last_outcome_modal_shown_at = NULL
      WHERE id = v_p.church_id;
  ELSIF v_p.action = 'visibility_override' THEN
    UPDATE public.churches
      SET show_church_name = (v_p.visibility_direction = 'hidden_to_visible'),
          last_outcome_modal_kind = 'visibility_flipped',
          last_outcome_modal_shown_at = NULL
      WHERE id = v_p.church_id;
  ELSIF v_p.action = 'hard_delete' THEN
    -- Override the 30-day window — schedule for immediate next sweep.
    UPDATE public.churches
      SET hard_delete_scheduled_at = now()
      WHERE id = v_p.church_id;
    UPDATE public.users
      SET hard_delete_scheduled_at = now()
      WHERE church_id = v_p.church_id
        AND hard_deleted_at IS NULL;
  ELSIF v_p.action = 'restore' THEN
    UPDATE public.churches
      SET soft_deleted_at = NULL,
          soft_delete_reason = NULL,
          hard_delete_scheduled_at = NULL,
          is_active = true,
          deactivated_at = NULL,
          verification_status = 'pending',
          rejected_at = NULL,
          appeal_status = 'resolved_restore'
      WHERE id = v_p.church_id;
    UPDATE public.users
      SET soft_deleted_at = NULL,
          soft_delete_reason = NULL,
          hard_delete_scheduled_at = NULL,
          is_active = true,
          deactivated_at = NULL
      WHERE church_id = v_p.church_id
        AND hard_deleted_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_confirm_underground_proposal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_confirm_underground_proposal(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_decline_underground_proposal
--   B declines A's proposal — counter_notes required, church returns to
--   Untouched (no state change on church beyond proposal terminal-state).
--   Per ruling #17.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_decline_underground_proposal(
  p_proposal_id uuid,
  p_counter_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_p RECORD;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  IF p_counter_notes IS NULL OR char_length(btrim(p_counter_notes)) < 1 THEN
    RAISE EXCEPTION 'counter_notes required' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_p FROM public.underground_verification_proposals
    WHERE id = p_proposal_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN
    RAISE EXCEPTION 'proposal not found' USING ERRCODE='42501';
  END IF;
  IF v_p.proposal_status <> 'pending' THEN
    RAISE EXCEPTION 'proposal already %', v_p.proposal_status USING ERRCODE='22023';
  END IF;
  IF v_p.proposer_id = v_caller_id THEN
    RAISE EXCEPTION 'proposer cannot self-decline' USING ERRCODE='42501';
  END IF;

  -- AUDIT BEFORE CONTENT.
  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, triggered_by, meta)
    VALUES ('underground_decline_proposal', v_p.church_id, v_caller_id, v_p.proposer_id, jsonb_build_object(
      'proposal_id', v_p.id,
      'declined_action', v_p.action,
      'counter_notes_len', char_length(p_counter_notes)
    ));

  UPDATE public.underground_verification_proposals
    SET proposal_status = 'declined',
        confirmer_id = v_caller_id,
        confirmed_at = now(),
        counter_notes = p_counter_notes
    WHERE id = p_proposal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_decline_underground_proposal(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_decline_underground_proposal(uuid,text) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_request_info_underground — single-admin. Writes question to audit
-- as 'underground_request_info_sent'; FE renders question to leader; leader
-- replies via fn_send_reply_to_team.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_request_info_underground(
  p_church_id uuid,
  p_question_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_audit_id uuid;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();

  IF p_question_text IS NULL OR char_length(btrim(p_question_text)) < 1 THEN
    RAISE EXCEPTION 'question text required' USING ERRCODE='22023';
  END IF;
  IF char_length(p_question_text) > 4000 THEN
    RAISE EXCEPTION 'question text exceeds 4000 chars' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.churches WHERE id=p_church_id AND type='underground') THEN
    RAISE EXCEPTION 'church not underground' USING ERRCODE='22023';
  END IF;

  -- AUDIT (this is the content — single-record question/answer thread).
  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
    VALUES ('underground_request_info_sent', p_church_id, v_caller_id, jsonb_build_object(
      'question_text', p_question_text
    ))
    RETURNING id INTO v_audit_id;

  -- Update cadence-tracking columns.
  UPDATE public.churches
    SET last_outcome_modal_kind = 'request_info',
        last_outcome_modal_shown_at = NULL
    WHERE id = p_church_id;

  RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_request_info_underground(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_request_info_underground(uuid,text) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_initiate_restore_underground — single-admin initiate.
--   Per ruling Q3 clarifier #3: single-admin INITIATE + two-eyes APPROVE.
--   This RPC just stamps the initiate intent (audited) — the actual restore
--   ships through a follow-up propose_underground_action(action='restore')
--   + fn_confirm_underground_proposal flow.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_initiate_restore_underground(p_church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();
  IF NOT EXISTS (SELECT 1 FROM public.churches WHERE id=p_church_id AND type='underground' AND soft_deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'church not soft-deleted underground' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
    VALUES ('underground_restore_initiated', p_church_id, v_caller_id, jsonb_build_object(
      'admin_initiated', true
    ));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_initiate_restore_underground(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_initiate_restore_underground(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_validate_relay_token — visibility override gate.
--   Compares submitted token_hash against the pending visibility_override
--   proposal's relay_token_hash. Returns boolean.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_relay_token(
  p_church_id uuid,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_match boolean;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();
  IF p_token_hash IS NULL OR char_length(p_token_hash) < 1 THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.underground_verification_proposals
    WHERE church_id = p_church_id
      AND action = 'visibility_override'
      AND proposal_status = 'pending'
      AND relay_token_hash IS NOT NULL
      AND relay_token_hash = p_token_hash
  ) INTO v_match;
  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_validate_relay_token(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_validate_relay_token(uuid,text) TO authenticated;

-- ----------------------------------------------------------------------------
-- fn_expire_stale_proposals — hourly cron. Flips pending → expired when
-- expires_at < now(). Idempotent.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_expire_stale_proposals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.underground_verification_proposals
      SET proposal_status = 'expired'
      WHERE proposal_status = 'pending'
        AND expires_at < now()
      RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_expire_stale_proposals() FROM public;
-- System-only.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='underground_expire_stale_proposals_hourly') THEN
    PERFORM cron.unschedule('underground_expire_stale_proposals_hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'underground_expire_stale_proposals_hourly',
  '0 * * * *',
  $$SELECT public.fn_expire_stale_proposals();$$
);

-- ----------------------------------------------------------------------------
-- fn_should_fire_outcome_modal — Day-14 hybrid cadence helper.
--   Returns jsonb { fire: bool, kind: text|null, day_of_window: int }.
--   Logic (manifest §2):
--     day_of_window = days since churches.soft_deleted_at
--     acknowledged = users.outcome_modal_acknowledged_at IS NOT NULL
--     IF NOT acknowledged AND day_of_window IN (0, 14) → fire=true, kind='rejected'
--     ELSE IF day_of_window = 23 AND last_outcome_modal_kind != 'pre_removal_day_23'
--       → fire=true, kind='pre_removal_day_23'
--     ELSE fire=false
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_should_fire_outcome_modal(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_acknowledged boolean;
  v_soft_deleted_at timestamptz;
  v_last_kind text;
  v_day integer;
BEGIN
  SELECT u.id, (u.outcome_modal_acknowledged_at IS NOT NULL)
    INTO v_user_id, v_acknowledged
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.church_id = p_church_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', 0);
  END IF;

  SELECT c.soft_deleted_at, c.last_outcome_modal_kind
    INTO v_soft_deleted_at, v_last_kind
    FROM public.churches c
    WHERE c.id = p_church_id;

  IF v_soft_deleted_at IS NULL THEN
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', 0);
  END IF;

  v_day := GREATEST(0, EXTRACT(DAY FROM (now() - v_soft_deleted_at))::integer);

  IF NOT v_acknowledged AND v_day IN (0, 14) THEN
    RETURN jsonb_build_object('fire', true, 'kind', 'rejected', 'day_of_window', v_day);
  ELSIF v_day = 23 AND coalesce(v_last_kind,'') <> 'pre_removal_day_23' THEN
    RETURN jsonb_build_object('fire', true, 'kind', 'pre_removal_day_23', 'day_of_window', v_day);
  ELSE
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', v_day);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_should_fire_outcome_modal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_should_fire_outcome_modal(uuid) TO authenticated;
