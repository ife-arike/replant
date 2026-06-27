-- KAN-271 Migration 0038 — fn_invite_admin idempotency hardening.
--
-- Panel finding (DBA + BE + SEC 2026-06-26): the post-P11 invite-admin
-- flow has a window where Netlify times out AFTER fn_invite_admin
-- successfully commits but BEFORE the response reaches the dashboard.
-- The Overseer retries the invite, the inviteUserByEmail call no-ops
-- (Supabase de-dups on email), the existing auth_id is resolved, and
-- the RPC fires again — at which point the unique constraint on
-- users.auth_id RAISEs, the BE maps to the misleading "already on the
-- admin roster" 409, and the Overseer is told their successful invite
-- failed.
--
-- Fix: ON CONFLICT (auth_id) DO NOTHING + return-existing-id branch.
-- A second call for the same auth_id returns the same public.users.id
-- without writing a duplicate audit row. The first call's audit row
-- is the genuine record; the retry is a network-layer re-send, not a
-- second invite event.
--
-- users_auth_id_key (UNIQUE INDEX on public.users(auth_id)) is the
-- conflict target — verified live via pg_indexes pre-apply.
--
-- Companion to invite-admin.js reorder (writes fn_invite_admin LAST).
-- Reorder closes the "earlier step failed, RPC never fired" class;
-- this closes the "RPC fired, response lost in flight" class.

CREATE OR REPLACE FUNCTION public.fn_invite_admin(p_auth_id uuid, p_email text, p_first_name text, p_last_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
  v_new_id uuid;
  v_full_name text;
BEGIN
  v_caller_id := public.fn_assert_super_admin();
  IF p_auth_id IS NULL THEN RAISE EXCEPTION 'missing_field:auth_id' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_email), '') = '' THEN RAISE EXCEPTION 'missing_field:email' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_first_name), '') = '' THEN RAISE EXCEPTION 'missing_field:first_name' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_last_name), '') = '' THEN RAISE EXCEPTION 'missing_field:last_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_first_name) > 80 THEN RAISE EXCEPTION 'field_too_long:first_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_last_name)  > 80 THEN RAISE EXCEPTION 'field_too_long:last_name'  USING ERRCODE='22023'; END IF;

  v_full_name := public.fn_compose_full_name(
    p_first_name, '', p_last_name, NULL, NULL, false, false
  );

  -- ON CONFLICT idempotency: retry-of-successful-call returns the same
  -- id without duplicate audit. Genuine-first-insert sets RETURNING id.
  INSERT INTO public.users (
    auth_id, email, first_name, middle_name, last_name, full_name,
    include_middle_name, last_name_first, role, is_active,
    is_underground_admin, is_top_tier_admin, church_id
  ) VALUES (
    p_auth_id, lower(trim(p_email)), trim(p_first_name), '', trim(p_last_name), v_full_name,
    false, false, 'replant_staff'::user_role, true,
    false, false, NULL
  )
  ON CONFLICT (auth_id) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    -- Retry of a prior successful-but-disconnected call. Resolve the
    -- existing row and return its id. Skip the audit insert — the
    -- first call already wrote admin_invite_sent for this auth_id.
    SELECT id INTO v_new_id FROM public.users WHERE auth_id = p_auth_id;
    RETURN v_new_id;
  END IF;

  -- First-insert path only.
  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_invite_sent', v_caller_id, 'user'::text,
            jsonb_build_object('invited_user_id', v_new_id, 'invited_email', lower(trim(p_email)), 'kind', 'new_staff'));

  RETURN v_new_id;
END;
$function$;
