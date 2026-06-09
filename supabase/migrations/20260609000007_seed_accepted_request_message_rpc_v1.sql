-- 20260609000007_seed_accepted_request_message_rpc_v1.sql
--
-- Connect tab — seed the accepted request's first message.
--
-- Background: respond_to_connection_request (20260609000004) deliberately does
-- NOT insert the original request message into public.messages — SEC ruled the
-- request message MUST transit FLAG_TAXONOMY scanning first. The new
-- accept-connection-request edge fn does the scan, calls
-- respond_to_connection_request(..., 'accept') to flip status + get the
-- conversation_id, then calls THIS RPC with the scan verdict to write the
-- already-scanned message into the conversation.
--
-- Authorship: the seeded message is attributed to the ORIGINAL requester
-- (v_req.sender_id), not to the accepting recipient (the caller). The accepting
-- leader is the receiver. This preserves the truth that the requester is the
-- one who spoke first.
--
-- messages.flag_reason is a single text column (comma-joined `auto:` codes,
-- FLAG_REASON_MAX_LEN=500 convention). The edge fn passes the scan verdict as
-- text[]; we collapse it to the column's text shape.
--
-- Idempotency: the edge fn is the single caller and runs once per accept, but
-- we guard against a double-seed by checking for an existing requester-authored
-- message in the conversation before inserting.
--
-- Covering prayer offered before authoring. Replant is a secure communication
-- platform for Christian leaders globally; guard this insert so no scanned
-- verdict is lost and no message is seeded twice.

CREATE OR REPLACE FUNCTION public.seed_accepted_request_message(
  p_request_id  uuid,
  p_flagged     boolean,
  p_flag_reason text[]
)
RETURNS TABLE(
  message_id      uuid,
  conversation_id uuid,
  sender_id       uuid,
  content         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id  uuid;
  v_req        public.connection_requests%ROWTYPE;
  v_conv_id    uuid;
  v_a          uuid;
  v_b          uuid;
  v_reason     text;
  v_msg_id     uuid;
BEGIN
  -- 1. Resolve + verify caller (active + verified).
  SELECT u.id INTO v_caller_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- 2. Load the request row.
  SELECT * INTO v_req
  FROM public.connection_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- 3. Caller must be the recipient who accepted.
  IF v_req.recipient_id <> v_caller_id THEN
    RAISE EXCEPTION 'not_recipient';
  END IF;

  -- 4. Request must already be in 'accepted' state (set by
  --    respond_to_connection_request before this call).
  IF v_req.status <> 'accepted' THEN
    RAISE EXCEPTION 'request_not_accepted';
  END IF;

  -- 6. Find the conversation for the sorted pair (created by the accept RPC).
  v_a := LEAST(v_req.sender_id, v_req.recipient_id);
  v_b := GREATEST(v_req.sender_id, v_req.recipient_id);

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.participant_a = v_a AND c.participant_b = v_b;
  IF v_conv_id IS NULL THEN
    RAISE EXCEPTION 'conversation_not_found';
  END IF;

  -- 5. Idempotency guard: if the requester-authored seed message already
  --    exists in this conversation, return it instead of double-seeding.
  SELECT m.id INTO v_msg_id
  FROM public.messages m
  WHERE m.conversation_id = v_conv_id
    AND m.sender_id = v_req.sender_id
    AND m.content = v_req.message
    AND m.is_active = true
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_msg_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_msg_id, v_conv_id, v_req.sender_id, v_req.message;
    RETURN;
  END IF;

  -- Collapse the scan verdict text[] into the single-text flag_reason column
  -- (comma-joined, bounded to the FLAG_REASON_MAX_LEN=500 convention).
  IF p_flagged AND p_flag_reason IS NOT NULL
     AND array_length(p_flag_reason, 1) IS NOT NULL THEN
    v_reason := LEFT(array_to_string(p_flag_reason, ','), 500);
  ELSE
    v_reason := NULL;
  END IF;

  -- 7. Insert the (already-scanned) seed message, attributed to the ORIGINAL
  --    requester. The accepting leader (caller) is the receiver.
  INSERT INTO public.messages (
    sender_id, receiver_id, content, conversation_id,
    is_active, flagged, flag_reason
  )
  VALUES (
    v_req.sender_id, v_req.recipient_id, v_req.message, v_conv_id,
    true, COALESCE(p_flagged, false), v_reason
  )
  RETURNING id INTO v_msg_id;

  -- 8. Bump conversation activity timestamp.
  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = v_conv_id;

  -- 9. Return the seeded message details for edge-fn confirmation.
  RETURN QUERY
  SELECT v_msg_id, v_conv_id, v_req.sender_id, v_req.message;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.seed_accepted_request_message(uuid, boolean, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seed_accepted_request_message(uuid, boolean, text[]) TO authenticated;
