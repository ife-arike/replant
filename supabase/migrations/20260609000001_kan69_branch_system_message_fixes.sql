-- KAN-69 branch system message fixes — messaging polish
--
-- Two targeted fixes to respond_to_branch_invite, rebased on the LIVE
-- definition from 20260608000002_kan69_branch_member_features_v1.sql
-- (the activation-gate = 'invited' predicate is PRESERVED verbatim):
--
--   FIX #2 (deduplicate ministry-joined messages):
--     Maranatha has 2 leaders. When both accept the same invite, the
--     "<ministry> joined this branch." system message fired TWICE.
--     The message represents the MINISTRY joining, not each individual
--     leader. Guard the INSERT so it only posts when no OTHER leader
--     from the same ministry has already joined. The caller's own row is
--     already 'joined' by the time this runs (the UPDATE above), so the
--     dedup check explicitly excludes the caller via bm2.user_id <>
--     v_caller_id.
--
--   FIX #1 (all-joined celebration message):
--     When the final leader joins and the branch flips forming → active,
--     the composer silently unlocked with no signal. Insert a system
--     message — "All leaders have joined. The branch is now open." — at
--     the moment of activation so the unlock is announced in-thread.
--
-- Both new INSERTs are wrapped in fail-open BEGIN...EXCEPTION WHEN OTHERS
-- THEN NULL; END; blocks so a system-message failure NEVER rolls back the
-- consent UPDATE or the activation flip.
--
-- All other logic (caller verification, not_invited gate, pending-count
-- check, audit log) is reproduced VERBATIM from 20260608000002.
--
-- Anchored by KAN-69.

BEGIN;

DROP FUNCTION IF EXISTS public.respond_to_branch_invite(uuid, text);

CREATE FUNCTION public.respond_to_branch_invite(
  p_branch_id uuid,
  p_response  text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id        uuid;
  v_caller_ministry  uuid;
  v_pending_count    int;
  v_new_status       text;
BEGIN
  IF p_response NOT IN ('joined', 'declined') THEN
    RAISE EXCEPTION 'invalid_response';
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND consent_status = 'invited'
  ) THEN
    RAISE EXCEPTION 'not_invited';
  END IF;

  -- Caller's ministry on this branch — needed for the dedup guard below.
  SELECT ministry_id INTO v_caller_ministry
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  UPDATE public.branch_members
  SET consent_status = p_response,
      consented_at   = now()
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  -- ─── KAN-69: system message on join (fail-open, DEDUPLICATED) ─────
  -- Post "<ministry> joined this branch." into the thread — ONCE per
  -- ministry. The message represents the MINISTRY joining, not each
  -- leader, so a multi-leader ministry (e.g. Maranatha) must only fire
  -- it on the FIRST leader to accept. The caller's own row is already
  -- 'joined' (UPDATE above), so the guard excludes the caller via
  -- bm2.user_id <> v_caller_id and only suppresses the message when
  -- ANOTHER leader of the same ministry already joined. Wrapped so any
  -- failure here NEVER rolls back the consent UPDATE above.
  IF p_response = 'joined' THEN
    DECLARE
      v_system_user_id constant uuid := '028be745-8014-4314-a7cf-36b0a4d52b46';
      v_ministry_name  text;
      v_already_joined boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.branch_members bm2
        WHERE bm2.branch_id      = p_branch_id
          AND bm2.ministry_id    = v_caller_ministry
          AND bm2.user_id        <> v_caller_id
          AND bm2.consent_status = 'joined'
      ) INTO v_already_joined;

      IF NOT v_already_joined THEN
        SELECT c.name
          INTO v_ministry_name
        FROM public.branch_members bm
        JOIN public.churches c ON c.id = bm.ministry_id
        WHERE bm.branch_id = p_branch_id
          AND bm.user_id   = v_caller_id;

        INSERT INTO public.messages (sender_id, branch_id, content)
        VALUES (
          v_system_user_id,
          p_branch_id,
          COALESCE(v_ministry_name, 'A ministry') || ' joined this branch.'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  -- ─────────────────────────────────────────────────────────────────

  -- Activation gate: only triggers on 'joined' (a decline can't unlock a
  -- branch). Pending = leaders still 'invited'; declined/left never block.
  IF p_response = 'joined' THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND consent_status = 'invited';
    IF v_pending_count = 0 THEN
      UPDATE public.branches SET status = 'active' WHERE id = p_branch_id;
      INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES (
        'branch_activated', v_caller_id, 'user',
        jsonb_build_object('branch_id', p_branch_id, 'cause', 'final_consent')
      );

      -- ─── KAN-69: all-joined celebration message (fail-open) ──────
      -- The branch just flipped forming → active because the LAST
      -- invited leader accepted. Announce the unlock in-thread so the
      -- composer doesn't silently open. Wrapped so any failure here
      -- NEVER rolls back the activation flip above.
      BEGIN
        INSERT INTO public.messages (sender_id, branch_id, content)
        VALUES (
          '028be745-8014-4314-a7cf-36b0a4d52b46',
          p_branch_id,
          'All leaders have joined. The branch is now open.'
        );
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      -- ───────────────────────────────────────────────────────────
    END IF;
  END IF;

  SELECT status INTO v_new_status
  FROM public.branches WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_invite_responded', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',               p_branch_id,
      'response',                p_response,
      'resulting_branch_status', v_new_status
    )
  );

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) TO authenticated;

COMMIT;
