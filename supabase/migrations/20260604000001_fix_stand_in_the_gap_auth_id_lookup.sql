-- Fix: stand_in_the_gap was looking up public.users WHERE id = auth.uid()
-- but Replant's public.users.id is NOT the same as auth.users.id.
-- The correct join is WHERE auth_id = auth.uid(), matching get_prayer_wall
-- which correctly uses: pb.leader_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
--
-- Before this fix: the verification gate always returned 'not_verified' for
-- every caller, so the DB was never written and prayer state never persisted.
--
-- Changes:
--   1. Resolve public.users.id via auth_id, not id
--   2. Use resolved v_caller_id (public.users.id) for the prayer_request_prayed_by insert
--   3. Self-prayer gate checks prayer_requests.user_id = v_caller_id (public.users.id) — correct

CREATE OR REPLACE FUNCTION public.stand_in_the_gap(p_prayer_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id       UUID;
  v_caller_id     UUID;  -- public.users.id (NOT auth.uid())
  v_rows_inserted INTEGER;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Resolve the public.users.id from the auth.uid(). This is the correct
  -- join pattern — auth_id references auth.users.id; public.users.id is
  -- an independent UUID. Also gates on verification_status in one query.
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = v_auth_id
    AND verification_status = 'verified';

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_verified');
  END IF;

  -- Gate: self-prayer blocked. prayer_requests.user_id = public.users.id.
  IF EXISTS (
    SELECT 1 FROM public.prayer_requests
    WHERE id = p_prayer_request_id AND user_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('error', 'self_interaction_blocked');
  END IF;

  -- Race-safe toggle: attempt insert on PK composite (prayer_request_id, leader_id).
  INSERT INTO public.prayer_request_prayed_by (prayer_request_id, leader_id)
  VALUES (p_prayer_request_id, v_caller_id)
  ON CONFLICT ON CONSTRAINT prayer_request_prayed_by_pkey DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted = 0 THEN
    -- Row already existed — toggle off (un-pray).
    DELETE FROM public.prayer_request_prayed_by
    WHERE prayer_request_id = p_prayer_request_id
      AND leader_id = v_caller_id;

    UPDATE public.prayer_requests
    SET prayed_count = GREATEST(0, prayed_count - 1)
    WHERE id = p_prayer_request_id;

    RETURN jsonb_build_object('action', 'removed', 'prayed', false);
  ELSE
    -- Row inserted — toggle on.
    UPDATE public.prayer_requests
    SET prayed_count = prayed_count + 1
    WHERE id = p_prayer_request_id;

    RETURN jsonb_build_object('action', 'added', 'prayed', true);
  END IF;
END;
$$;

-- Grants unchanged — authenticated only.
REVOKE ALL ON FUNCTION public.stand_in_the_gap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stand_in_the_gap(uuid) TO authenticated;
