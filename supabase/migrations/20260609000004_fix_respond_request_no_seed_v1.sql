-- 20260609000004_fix_respond_request_no_seed_v1.sql
--
-- SEC condition (APPROVED_WITH_CONDITIONS ruling, connect-request-flow
-- workflow): the request message MUST transit the send-message edge fn
-- for FLAG_TAXONOMY keyword scanning + postCommitFlagEffects. Inserting
-- directly into public.messages with flagged=false bypasses the scanner
-- entirely — exactly the carve-out SEC ruled impermissible.
--
-- Fix: remove the direct INSERT INTO public.messages from
-- respond_to_connection_request. The FE calls send-message edge fn with
-- the returned conversation_id + the requestMessage it already holds
-- (passed as a prop on DMThreadView). The message then travels the same
-- scan path as every other DM.
--
-- The respond_to_connection_request RPC now only:
--   1. Validates the request + caller
--   2. Creates/reuses the conversation row
--   3. Sets request status = 'accepted' + responded_at
--   4. Returns the conversation_id
-- Message seeding is the FE's responsibility via send-message.

CREATE OR REPLACE FUNCTION public.respond_to_connection_request(
  p_request_id uuid,
  p_action     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_req       public.connection_requests%ROWTYPE;
  v_conv_id   uuid;
  v_a         uuid;
  v_b         uuid;
BEGIN
  -- Resolve caller.
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Validate action.
  IF p_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  -- Load and lock the request row.
  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_req.recipient_id <> v_caller_id THEN
    RAISE EXCEPTION 'not_recipient';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF p_action = 'decline' THEN
    UPDATE public.connection_requests
    SET status = 'declined', declined_at = now(), responded_at = now()
    WHERE id = v_req.id;
    RETURN NULL;
  END IF;

  -- accept: create/reuse conversation. Do NOT seed messages here —
  -- the FE calls send-message edge fn so the message gets keyword
  -- scanning (SEC condition, 20260609000004 ruling).
  v_a := LEAST(v_req.sender_id, v_req.recipient_id);
  v_b := GREATEST(v_req.sender_id, v_req.recipient_id);

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE participant_a = v_a AND participant_b = v_b;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_a, participant_b, last_message_at)
    VALUES (v_a, v_b, now())
    RETURNING id INTO v_conv_id;
  ELSE
    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = v_conv_id;
  END IF;

  UPDATE public.connection_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = v_req.id;

  RETURN v_conv_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, text) TO authenticated;
