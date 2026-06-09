-- 20260609000009_remove_branch_bypass_from_conversation_permit_v1.sql
--
-- Founder ruling (2026-06-09): branch membership does NOT bypass the
-- connection request gate. A leader joins a branch without seeing who
-- else is in it; shared branch membership must NOT open an unrequested
-- 1:1 DM path to them. Same church_id only.
--
-- Removes the shared-active-branch EXISTS check from
-- get_or_create_conversation_if_permitted. Only same church_id
-- bypasses the request flow.

CREATE OR REPLACE FUNCTION public.get_or_create_conversation_if_permitted(
  p_recipient_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id    uuid;
  v_caller_church uuid;
  v_recip_church  uuid;
  v_recip_ok      boolean;
  v_a             uuid;
  v_b             uuid;
  v_conv_id       uuid;
BEGIN
  -- Resolve caller.
  SELECT u.id, u.church_id
    INTO v_caller_id, v_caller_church
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_caller_id THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;

  -- Validate recipient.
  SELECT (u.verification_status = 'verified' AND u.is_active = true),
         u.church_id
    INTO v_recip_ok, v_recip_church
  FROM public.users u
  WHERE u.id = p_recipient_id;

  IF v_recip_ok IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;
  IF v_recip_ok = false THEN
    RAISE EXCEPTION 'recipient_not_verified';
  END IF;

  -- In-network check: same church only.
  -- Branch membership does NOT bypass — a leader may join a branch
  -- without knowing who else is in it, so shared branch membership
  -- must not open an unrequested 1:1 DM path (Founder ruling 2026-06-09).
  IF v_caller_church IS NULL
     OR v_recip_church IS NULL
     OR v_caller_church <> v_recip_church THEN
    RAISE EXCEPTION 'requires_connection_request';
  END IF;

  -- Same church — find or create the conversation.
  v_a := LEAST(v_caller_id, p_recipient_id);
  v_b := GREATEST(v_caller_id, p_recipient_id);

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.participant_a = v_a AND c.participant_b = v_b;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_a, participant_b, last_message_at)
    VALUES (v_a, v_b, now())
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation_if_permitted(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_or_create_conversation_if_permitted(uuid) TO authenticated;
