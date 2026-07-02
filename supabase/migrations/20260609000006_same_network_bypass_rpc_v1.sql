-- 20260609000006_same_network_bypass_rpc_v1.sql
--
-- Connect tab — same-network DM bypass.
--
-- When two leaders are already "in network" (same church, or co-members of an
-- active branch) the consent/connection-request layer is unnecessary: they may
-- open a direct conversation immediately. This RPC enforces that gate
-- server-side and find-or-creates the conversation for permitted pairs.
--
-- Pairs that are NOT in-network are rejected with `requires_connection_request`
-- so the FE knows to fall back to send_connection_request instead.
--
-- Covering prayer offered before authoring. Replant is a secure communication
-- platform for Christian leaders globally; this gate keeps the consent layer
-- intact for strangers while letting brethren in the same fold speak freely.

CREATE OR REPLACE FUNCTION public.get_or_create_conversation_if_permitted(
  p_recipient_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id     uuid;
  v_caller_church uuid;
  v_recip_active  boolean;
  v_recip_church  uuid;
  v_in_network    boolean := false;
  v_conv_id       uuid;
  v_a             uuid;
  v_b             uuid;
BEGIN
  -- 1. Resolve + verify caller (active + verified).
  SELECT u.id, u.church_id
    INTO v_caller_id, v_caller_church
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- 2. Validate recipient argument.
  IF p_recipient_id IS NULL OR p_recipient_id = v_caller_id THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;

  -- 3. Recipient must exist, be active, and be verified.
  SELECT (u.verification_status = 'verified' AND u.is_active = true),
         u.church_id
    INTO v_recip_active, v_recip_church
  FROM public.users u
  WHERE u.id = p_recipient_id;
  IF v_recip_active IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found';
  END IF;
  IF v_recip_active = false THEN
    -- Distinguish inactive from unverified: an inactive-but-existing row is
    -- still surfaced as recipient_not_verified for the FE's purposes, but an
    -- explicitly unverified row is the common case.
    RAISE EXCEPTION 'recipient_not_verified';
  END IF;

  -- 4. In-network check (either condition grants bypass).
  --    (a) Same church.
  IF v_caller_church IS NOT NULL AND v_caller_church = v_recip_church THEN
    v_in_network := true;
  END IF;

  --    (b) Shared active branch.
  IF NOT v_in_network THEN
    IF EXISTS (
      SELECT 1
      FROM public.branch_members bm1
      JOIN public.branch_members bm2
        ON bm1.branch_id = bm2.branch_id
      WHERE bm1.user_id = v_caller_id
        AND bm2.user_id = p_recipient_id
        AND bm1.consent_status = 'active'
        AND bm2.consent_status = 'active'
    ) THEN
      v_in_network := true;
    END IF;
  END IF;

  -- 5. Not in-network => caller must use the connection-request flow.
  IF NOT v_in_network THEN
    RAISE EXCEPTION 'requires_connection_request';
  END IF;

  -- 6. In-network => find or create the conversation for the sorted pair.
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
