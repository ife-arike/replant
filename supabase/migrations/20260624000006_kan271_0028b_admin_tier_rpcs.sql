-- KAN-271 / Workstream A — admin-tier RPC family.
-- Pattern: SECURITY DEFINER, search_path locked, RAISE EXCEPTION with sqlstate
-- on every guard failure. Caller identity resolved via auth.uid() → public.users.id.
-- AAL2 + step-up enforcement happens at the Netlify endpoint layer (per existing
-- pattern in underground RPCs); these RPCs receive the server-observed timestamps
-- and store them for audit replay (per manifest §1 Migration 0025).
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

-- ── fn_invite_admin ──────────────────────────────────────────────────────
-- DESIGN NOTE: SQL cannot create auth.users rows. The Netlify endpoint must:
--   1. create the auth.users row via supabaseAdmin.auth.admin.inviteUserByEmail()
--      with app_metadata = { admin_tier: 'regular', role: null }
--   2. capture the returned auth_id
--   3. call this RPC with p_auth_id to write the public.users row
-- This split keeps the DB free of auth.admin coupling while keeping the public.users
-- row + audit log atomic at the SQL boundary.
CREATE OR REPLACE FUNCTION public.fn_invite_admin(
  p_auth_id   uuid,
  p_email     text,
  p_first_name text,
  p_last_name  text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_new_id uuid;
  v_full_name text;
BEGIN
  v_caller_id := public.fn_assert_super_admin();   -- top-tier OR super admin
  IF p_auth_id IS NULL THEN RAISE EXCEPTION 'missing_field:auth_id' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_email), '') = '' THEN RAISE EXCEPTION 'missing_field:email' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_first_name), '') = '' THEN RAISE EXCEPTION 'missing_field:first_name' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_last_name), '') = '' THEN RAISE EXCEPTION 'missing_field:last_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_first_name) > 80 THEN RAISE EXCEPTION 'field_too_long:first_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_last_name)  > 80 THEN RAISE EXCEPTION 'field_too_long:last_name'  USING ERRCODE='22023'; END IF;

  v_full_name := public.fn_compose_full_name(
    p_first_name, '', p_last_name, NULL, NULL, false, false
  );

  INSERT INTO public.users (
    auth_id, email, first_name, middle_name, last_name, full_name,
    include_middle_name, last_name_first, role, is_active,
    is_underground_admin, is_top_tier_admin, church_id
  ) VALUES (
    p_auth_id, lower(trim(p_email)), trim(p_first_name), '', trim(p_last_name), v_full_name,
    false, false, 'other'::user_role, true,
    false, false, NULL
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_invite_sent', v_caller_id, 'user'::text,
            jsonb_build_object('invited_user_id', v_new_id, 'invited_email', lower(trim(p_email))));

  RETURN v_new_id;
END;
$$;

-- ── fn_request_admin_promotion ───────────────────────────────────────────
-- Super admin sponsor initiates promotion of a Regular admin to Super admin.
-- Inserts admin_tier_promotions row (pending, 48h TTL). Audit: admin_tier_promotion_requested.
CREATE OR REPLACE FUNCTION public.fn_request_admin_promotion(
  p_candidate_user_id uuid,
  p_sponsor_aal2_fresh_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_candidate_tier text;
  v_promotion_id uuid;
BEGIN
  v_caller_id := public.fn_assert_super_admin();
  IF p_candidate_user_id IS NULL THEN RAISE EXCEPTION 'missing_field:candidate_user_id' USING ERRCODE='22023'; END IF;
  IF p_sponsor_aal2_fresh_at IS NULL THEN RAISE EXCEPTION 'missing_field:sponsor_aal2_fresh_at' USING ERRCODE='22023'; END IF;
  IF p_candidate_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_sponsor' USING ERRCODE='42501'; END IF;

  -- Candidate must currently be a Regular admin (app_metadata.admin_tier='regular',
  -- not already super_admin or top_tier).
  SELECT au.raw_app_meta_data ->> 'admin_tier' INTO v_candidate_tier
    FROM public.users u JOIN auth.users au ON au.id = u.auth_id
    WHERE u.id = p_candidate_user_id
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_candidate_tier IS DISTINCT FROM 'regular' THEN
    RAISE EXCEPTION 'candidate_not_regular_admin' USING ERRCODE='22023';
  END IF;

  -- No existing pending request for this candidate.
  IF EXISTS (SELECT 1 FROM public.admin_tier_promotions
             WHERE candidate_user_id = p_candidate_user_id AND state = 'pending') THEN
    RAISE EXCEPTION 'promotion_already_pending' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.admin_tier_promotions
    (candidate_user_id, sponsor_user_id, sponsor_aal2_fresh_at)
    VALUES (p_candidate_user_id, v_caller_id, p_sponsor_aal2_fresh_at)
    RETURNING id INTO v_promotion_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_tier_promotion_requested', v_caller_id, 'user'::text,
            jsonb_build_object('promotion_id', v_promotion_id, 'candidate_user_id', p_candidate_user_id));

  RETURN v_promotion_id;
END;
$$;

-- ── fn_approve_admin_promotion ───────────────────────────────────────────
-- Top-tier admin approves a pending promotion. Validates no-self-approve.
-- Patches auth.users.raw_app_meta_data to set admin_tier='super_admin' AND role='super_admin'
-- (the dual write keeps existing super_admin RLS working — see migration 0027 deviation note).
CREATE OR REPLACE FUNCTION public.fn_approve_admin_promotion(
  p_promotion_id uuid,
  p_approver_aal2_fresh_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_p RECORD;
  v_candidate_auth_id uuid;
BEGIN
  v_caller_id := public.fn_assert_top_tier_admin();
  IF p_promotion_id IS NULL THEN RAISE EXCEPTION 'missing_field:promotion_id' USING ERRCODE='22023'; END IF;
  IF p_approver_aal2_fresh_at IS NULL THEN RAISE EXCEPTION 'missing_field:approver_aal2_fresh_at' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_p FROM public.admin_tier_promotions WHERE id = p_promotion_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF v_p.state <> 'pending' THEN RAISE EXCEPTION 'promotion_already_%', v_p.state USING ERRCODE='22023'; END IF;
  IF v_p.expires_at <= now() THEN RAISE EXCEPTION 'promotion_expired' USING ERRCODE='22023'; END IF;
  IF v_p.sponsor_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_approve' USING ERRCODE='42501'; END IF;

  -- Update promotion row → approved.
  UPDATE public.admin_tier_promotions
    SET state = 'approved', resolved_at = now(),
        approver_user_id = v_caller_id,
        approver_aal2_fresh_at = p_approver_aal2_fresh_at
    WHERE id = p_promotion_id;

  -- Patch candidate's auth.users.raw_app_meta_data — dual write (role + admin_tier).
  SELECT auth_id INTO v_candidate_auth_id FROM public.users WHERE id = v_p.candidate_user_id;
  UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                            || jsonb_build_object('role', 'super_admin', 'admin_tier', 'super_admin')
    WHERE id = v_candidate_auth_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_tier_promotion_approved', v_caller_id, 'user'::text,
            jsonb_build_object('promotion_id', p_promotion_id,
                               'candidate_user_id', v_p.candidate_user_id,
                               'sponsor_user_id', v_p.sponsor_user_id));
END;
$$;

-- ── fn_deny_admin_promotion ──────────────────────────────────────────────
-- Top-tier admin denies. Requires ≥30-char reason.
CREATE OR REPLACE FUNCTION public.fn_deny_admin_promotion(
  p_promotion_id uuid,
  p_denial_reason text,
  p_approver_aal2_fresh_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_p RECORD;
BEGIN
  v_caller_id := public.fn_assert_top_tier_admin();
  IF p_promotion_id IS NULL THEN RAISE EXCEPTION 'missing_field:promotion_id' USING ERRCODE='22023'; END IF;
  IF p_approver_aal2_fresh_at IS NULL THEN RAISE EXCEPTION 'missing_field:approver_aal2_fresh_at' USING ERRCODE='22023'; END IF;
  IF p_denial_reason IS NULL OR char_length(trim(p_denial_reason)) < 30 THEN
    RAISE EXCEPTION 'field_too_short:denial_reason' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_p FROM public.admin_tier_promotions WHERE id = p_promotion_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF v_p.state <> 'pending' THEN RAISE EXCEPTION 'promotion_already_%', v_p.state USING ERRCODE='22023'; END IF;
  IF v_p.expires_at <= now() THEN RAISE EXCEPTION 'promotion_expired' USING ERRCODE='22023'; END IF;
  IF v_p.sponsor_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_approve' USING ERRCODE='42501'; END IF;

  UPDATE public.admin_tier_promotions
    SET state = 'denied', resolved_at = now(),
        approver_user_id = v_caller_id,
        approver_aal2_fresh_at = p_approver_aal2_fresh_at,
        denial_reason = trim(p_denial_reason)
    WHERE id = p_promotion_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_tier_promotion_denied', v_caller_id, 'user'::text,
            jsonb_build_object('promotion_id', p_promotion_id,
                               'candidate_user_id', v_p.candidate_user_id,
                               'sponsor_user_id', v_p.sponsor_user_id,
                               'denial_reason', trim(p_denial_reason)));
END;
$$;

-- ── fn_demote_admin ──────────────────────────────────────────────────────
-- Single-eye demote (Top-tier only, no two-eyes ceremony). Demoting cannot cross
-- MIN_SUPER_ADMINS=3 floor (top-tier seats excluded from count per ratification A-#2).
-- Sets target app_metadata.admin_tier='regular' AND role=NULL.
CREATE OR REPLACE FUNCTION public.fn_demote_admin(
  p_target_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_target_auth_id uuid;
  v_target_app_role text;
  v_target_is_top boolean;
  v_super_count integer;
BEGIN
  v_caller_id := public.fn_assert_top_tier_admin();
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'missing_field:target_user_id' USING ERRCODE='22023'; END IF;
  IF p_target_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_demote' USING ERRCODE='42501'; END IF;

  SELECT u.auth_id, u.is_top_tier_admin, au.raw_app_meta_data ->> 'role'
    INTO v_target_auth_id, v_target_is_top, v_target_app_role
    FROM public.users u JOIN auth.users au ON au.id = u.auth_id
    WHERE u.id = p_target_user_id;
  IF v_target_auth_id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF v_target_is_top = true THEN
    RAISE EXCEPTION 'cannot_demote_top_tier' USING ERRCODE='42501';
  END IF;
  IF v_target_app_role <> 'super_admin' THEN
    RAISE EXCEPTION 'target_not_super_admin' USING ERRCODE='22023';
  END IF;

  -- Floor check: current super_admins excluding top-tier must stay ≥ 3 after demote.
  v_super_count := public.fn_count_active_super_admins_excluding_top_tier();
  IF v_super_count <= 3 THEN
    RAISE EXCEPTION 'min_super_admins_floor' USING ERRCODE='22023';
  END IF;

  UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                            - 'role'
                            || jsonb_build_object('admin_tier', 'regular')
    WHERE id = v_target_auth_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_demote', v_caller_id, 'user'::text,
            jsonb_build_object('target_user_id', p_target_user_id));
END;
$$;

-- ── fn_revoke_admin ──────────────────────────────────────────────────────
-- Top-tier revokes a Regular admin (loses all admin access). Per ratification #11,
-- super admins must be demoted to Regular FIRST, then revoked.
-- Sets app_metadata.admin_tier=null AND is_active=false on public.users row.
CREATE OR REPLACE FUNCTION public.fn_revoke_admin(
  p_target_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_target_auth_id uuid;
  v_target_app_role text;
  v_target_app_tier text;
  v_target_is_top boolean;
BEGIN
  v_caller_id := public.fn_assert_top_tier_admin();
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'missing_field:target_user_id' USING ERRCODE='22023'; END IF;
  IF p_target_user_id = v_caller_id THEN RAISE EXCEPTION 'no_self_revoke' USING ERRCODE='42501'; END IF;

  SELECT u.auth_id, u.is_top_tier_admin,
         au.raw_app_meta_data ->> 'role', au.raw_app_meta_data ->> 'admin_tier'
    INTO v_target_auth_id, v_target_is_top, v_target_app_role, v_target_app_tier
    FROM public.users u JOIN auth.users au ON au.id = u.auth_id
    WHERE u.id = p_target_user_id;
  IF v_target_auth_id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
  IF v_target_is_top = true THEN
    RAISE EXCEPTION 'cannot_revoke_top_tier' USING ERRCODE='42501';
  END IF;
  IF v_target_app_role = 'super_admin' THEN
    RAISE EXCEPTION 'cannot_revoke_super_admin_demote_first' USING ERRCODE='22023';
  END IF;

  UPDATE auth.users
    SET raw_app_meta_data = (COALESCE(raw_app_meta_data, '{}'::jsonb) - 'admin_tier') - 'role'
    WHERE id = v_target_auth_id;

  UPDATE public.users SET is_active = false WHERE id = p_target_user_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_revoke', v_caller_id, 'user'::text,
            jsonb_build_object('target_user_id', p_target_user_id));
END;
$$;

-- ── fn_update_admin_name ─────────────────────────────────────────────────
-- Self-service first/last name edit (Account page Identity section).
-- Caller can only update their own row. No AAL2/step-up (low-stakes self-edit).
CREATE OR REPLACE FUNCTION public.fn_update_admin_name(
  p_first text, p_last text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_row RECORD;
  v_new_full text;
BEGIN
  IF COALESCE(trim(p_first), '') = '' THEN RAISE EXCEPTION 'missing_field:first' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_last),  '') = '' THEN RAISE EXCEPTION 'missing_field:last'  USING ERRCODE='22023'; END IF;
  IF char_length(p_first) > 80 THEN RAISE EXCEPTION 'field_too_long:first' USING ERRCODE='22023'; END IF;
  IF char_length(p_last)  > 80 THEN RAISE EXCEPTION 'field_too_long:last'  USING ERRCODE='22023'; END IF;

  SELECT id, middle_name, honorific, suffix, include_middle_name, last_name_first
    INTO v_row FROM public.users WHERE auth_id = auth.uid();
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  v_caller_id := v_row.id;

  v_new_full := public.fn_compose_full_name(
    trim(p_first), v_row.middle_name, trim(p_last),
    v_row.honorific, v_row.suffix, v_row.include_middle_name, v_row.last_name_first
  );

  UPDATE public.users
    SET first_name = trim(p_first),
        last_name  = trim(p_last),
        full_name  = v_new_full
    WHERE id = v_caller_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('account_name_updated', v_caller_id, 'user'::text,
            jsonb_build_object('new_first', trim(p_first), 'new_last', trim(p_last)));
END;
$$;

-- Grants for the authenticated role (RPCs are SECURITY DEFINER but PostgREST
-- needs EXECUTE to expose them).
GRANT EXECUTE ON FUNCTION public.fn_invite_admin(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_admin_promotion(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_admin_promotion(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_deny_admin_promotion(uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_demote_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_revoke_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_update_admin_name(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assert_top_tier_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assert_super_admin() TO authenticated;
