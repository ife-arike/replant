-- Flow-gaps gap-3 (2026-07-13) — surface branch for the leader's
-- request-info reply RPC.
--
-- ⚠ LIVE-DRIFT NOTE (Panel A BLOCKER, verified 2026-07-13): the in-repo
-- 20260623_0006 version of this fn LACKS the modal-state-clear that live
-- carries — authoring from the repo file would regress the UG flow. This
-- file reproduces the LIVE body verbatim (pg_get_functiondef 2026-07-13)
-- and adds the surface branch.
--
-- Surface changes vs live:
--   1. Branch on the CALLER's own church type (strict store isolation —
--      SEC Panel A): underground validates + writes audit_log_underground
--      exactly as live; everything else validates the question against
--      audit_log 'request_info_sent' and writes the reply as
--      'request_info_reply' with the mirrored meta shape.
--   2. Church-match guard reproduced on the surface branch (SEC Panel A
--      BLOCKER 2): the question row's church_id must equal the caller's
--      own resolved church — a leader can never reply into another
--      church's thread by guessing a question id.
--   3. The state-clear UPDATE is unchanged and shared by both branches
--      (reply closes the request_info state; admin re-ask re-opens).
-- Caller remains the AUTHENTICATED leader (auth.uid()-resolved) — the
-- client contract fn_send_reply_to_team(p_question_id, p_reply_text) is
-- untouched, so the church-type-agnostic mobile flow needs zero changes.

CREATE OR REPLACE FUNCTION public.fn_send_reply_to_team(p_question_id uuid, p_reply_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_church_type public.church_type;
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

  SELECT c.type INTO v_church_type
    FROM public.churches c
    WHERE c.id = v_church_id;

  IF v_church_type = 'underground' THEN
    -- ── Underground branch — byte-identical to live ──
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
  ELSE
    -- ── Surface branch (flow-gaps gap-3) — mirrored shape, surface store ──
    SELECT church_id INTO v_question_church_id
      FROM public.audit_log
      WHERE id = p_question_id
        AND action = 'request_info_sent';
    IF v_question_church_id IS NULL THEN
      RAISE EXCEPTION 'question not found' USING ERRCODE = '42501';
    END IF;
    IF v_question_church_id IS DISTINCT FROM v_church_id THEN
      RAISE EXCEPTION 'question/church mismatch' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.audit_log (action, church_id, accessed_by, triggered_by, meta)
      VALUES (
        'request_info_reply',
        v_church_id,
        v_user_id,
        'user',
        jsonb_build_object(
          'reply_to_question_id', p_question_id,
          'reply_text', p_reply_text,
          'replied_by_leader', true
        )
      );
  END IF;

  -- 2026-06-22 fix (live, preserved): clear the request_info state on the
  -- church so:
  --   (1) fn_should_fire_outcome_modal no longer returns fire=true for the
  --       request_info case (kind is no longer = 'request_info')
  --   (2) auth-status-check's branch_substate computation returns to plain
  --       'pending' (not 'request_info') → verified-gate timeline shows
  --       again on TheChurchScreen + Connect; the leader is back to normal
  --       "your verification is in progress" state.
  -- Admin can send another question (fn_request_info_underground /
  -- fn_request_info_church) which re-sets kind = 'request_info' +
  -- shown_at = NULL → modal re-fires.
  UPDATE public.churches
    SET last_outcome_modal_kind = NULL,
        last_outcome_modal_shown_at = now()
    WHERE id = v_church_id
      AND last_outcome_modal_kind = 'request_info';
END;
$function$;
