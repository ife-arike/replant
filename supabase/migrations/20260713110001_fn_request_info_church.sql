-- Flow-gaps gap-3 (2026-07-13) — surface-church Request Info write RPC.
-- Twin of fn_request_info_underground with the Panel-A-mandated
-- divergences:
--   1. Actor model: invoked via SERVICE ROLE from the Netlify endpoint
--      (request-info-church.js, verifyAnyAdmin-gated). auth.uid() is NULL
--      under service role and surface admins may have no public.users row,
--      so the actor arrives as parameters (p_admin_id nullable public id +
--      p_actor_email backstop — send-team-reply identity posture).
--   2. EXECUTE is REVOKEd from authenticated/anon (SEC Panel A BLOCKER 1):
--      without an in-body admin assert, an authenticated-executable
--      version would let any leader inject request-info questions at
--      other churches.
--   3. Guards: NOT underground (UG stays on its gated two-eyes lane) AND
--      still pending (request-info is a pre-decision nudge; Panel A DBA —
--      deliberate asymmetry with the UG fn, flagged to Founder).
-- Writes the question as a regular audit_log row (audit-log-as-thread,
-- mirroring the UG store shape) + flips the SAME generic churches modal
-- columns the mobile client already reads.

CREATE OR REPLACE FUNCTION public.fn_request_info_church(
  p_church_id uuid,
  p_question_text text,
  p_admin_id uuid,
  p_actor_email text,
  p_ip text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type public.church_type;
  v_status public.verification_status_enum;
  v_audit_id uuid;
BEGIN
  IF p_question_text IS NULL OR char_length(btrim(p_question_text)) < 1 THEN
    RAISE EXCEPTION 'question text required' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_question_text) > 4000 THEN
    RAISE EXCEPTION 'question text exceeds 4000 chars' USING ERRCODE = '22023';
  END IF;

  SELECT c.type, c.verification_status INTO v_type, v_status
    FROM public.churches c
    WHERE c.id = p_church_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'church not found' USING ERRCODE = '22023';
  END IF;
  IF v_type = 'underground' THEN
    -- Route-to-UG-lane hard refuse: the UG path carries its own gate,
    -- audit surface, and ceremony. Never serve UG through this fn.
    RAISE EXCEPTION 'underground churches use the underground request-info path' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request-info is a pre-decision action; church is not pending' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_log (action, church_id, accessed_by, triggered_by, meta)
    VALUES (
      'request_info_sent',
      p_church_id,
      p_admin_id,
      'user',
      jsonb_build_object('question_text', p_question_text, 'actor_email', p_actor_email)
        || CASE WHEN p_ip IS NOT NULL THEN jsonb_build_object('ip', p_ip) ELSE '{}'::jsonb END
    )
    RETURNING id INTO v_audit_id;

  UPDATE public.churches
    SET last_outcome_modal_kind = 'request_info',
        last_outcome_modal_shown_at = NULL
    WHERE id = p_church_id;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_request_info_church(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_request_info_church(uuid, text, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_request_info_church(uuid, text, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_info_church(uuid, text, uuid, text, text) TO service_role;
