-- Flow-gaps gap-3 (2026-07-13) — surface branch for the outcome-modal
-- cadence RPC.
--
-- ⚠ LIVE-DRIFT NOTE (Panel A BLOCKER, verified 2026-07-13): the in-repo
-- migration history for this function (20260623_0008) is STALE — it shows
-- an old (p_church_id uuid) signature with no request_info branch. Live
-- carries a NO-ARG version with the request_info branch, and pg_proc
-- confirms the no-arg overload is the ONLY one that exists. This file
-- reproduces the LIVE body verbatim (captured via pg_get_functiondef
-- 2026-07-13) and layers the surface branch on top. Do not author future
-- changes to this fn from repo files — capture live first.
--
-- Surface changes vs live:
--   1. The church SELECT also reads type + verification_status.
--   2. request_info question source branches on the caller's OWN church
--      type: underground → audit_log_underground (byte-identical to
--      live); everything else → audit_log 'request_info_sent'. Strict
--      store isolation (Panel A SEC required change 2) — a surface path
--      never touches the UG store, and vice versa.
--   3. Surface-only stale-state gate (Panel A DBA §4.6): a church no
--      longer pending never re-fires request_info (approve/reject-church
--      also clear the column endpoint-side; this is the single-chokepoint
--      belt). The UG branch is deliberately untouched — behavior-
--      preserving for the UG queue.

CREATE OR REPLACE FUNCTION public.fn_should_fire_outcome_modal()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_acknowledged boolean;
  v_soft_deleted_at timestamptz;
  v_last_kind text;
  v_last_shown_at timestamptz;
  v_church_type public.church_type;
  v_church_status public.verification_status_enum;
  v_day integer;
  v_question_text text;
  v_question_id uuid;
BEGIN
  SELECT u.id, u.church_id, (u.outcome_modal_acknowledged_at IS NOT NULL)
    INTO v_user_id, v_church_id, v_acknowledged
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.hard_deleted_at IS NULL;

  IF v_user_id IS NULL OR v_church_id IS NULL THEN
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', 0);
  END IF;

  SELECT c.soft_deleted_at, c.last_outcome_modal_kind, c.last_outcome_modal_shown_at, c.type, c.verification_status
    INTO v_soft_deleted_at, v_last_kind, v_last_shown_at, v_church_type, v_church_status
    FROM public.churches c
    WHERE c.id = v_church_id;

  -- (1) request_info — ALWAYS return question_text + question_id when
  -- kind='request_info' (regardless of shown_at). FE uses `fire` for
  -- auto-launch, `kind` + `question_text` to render the persistent banner.
  IF v_last_kind = 'request_info' THEN
    IF v_church_type = 'underground' THEN
      SELECT al.id, al.meta->>'question_text'
        INTO v_question_id, v_question_text
        FROM public.audit_log_underground al
        WHERE al.church_id = v_church_id
          AND al.action = 'underground_request_info_sent'
        ORDER BY al.accessed_at DESC
        LIMIT 1;
    ELSE
      -- Flow-gaps gap-3 surface twin. Stale-state gate: a decided church
      -- (approved/rejected/deactivated) never re-fires request_info.
      IF v_church_status IS DISTINCT FROM 'pending' THEN
        RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', 0);
      END IF;
      SELECT al.id, al.meta->>'question_text'
        INTO v_question_id, v_question_text
        FROM public.audit_log al
        WHERE al.church_id = v_church_id
          AND al.action = 'request_info_sent'
        ORDER BY al.accessed_at DESC
        LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
      'fire', (v_last_shown_at IS NULL),
      'kind', 'request_info',
      'day_of_window', 0,
      'question_text', v_question_text,
      'question_id', v_question_id
    );
  END IF;

  -- (2) soft-deleted — rejected (Day 0 + 14) + day-23 pre-removal. Same as 0012.
  IF v_soft_deleted_at IS NULL THEN
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', 0);
  END IF;

  v_day := GREATEST(0, EXTRACT(DAY FROM (now() - v_soft_deleted_at))::integer);

  IF NOT v_acknowledged AND v_day IN (0, 14) THEN
    RETURN jsonb_build_object('fire', true, 'kind', 'rejected', 'day_of_window', v_day);
  ELSIF v_day = 23 AND coalesce(v_last_kind, '') <> 'pre_removal_day_23' THEN
    RETURN jsonb_build_object('fire', true, 'kind', 'pre_removal_day_23', 'day_of_window', v_day);
  ELSE
    RETURN jsonb_build_object('fire', false, 'kind', null, 'day_of_window', v_day);
  END IF;
END;
$function$;
