-- KAN-22 — create_prayer_request SECURITY DEFINER RPC.
--
-- Centralised write surface for the Prayer Wall pull-up (KAN-22 modal).
-- Every other prayer-wall write goes through a vetted DEFINER (e.g.
-- stand_in_the_gap); a direct table insert via RLS would be the only
-- exception and would need a SEC ruling to justify it (Founder call
-- 2026-05-28). Wrapping the existing prayer_requests_insert RLS path
-- in a DEFINER lets DBA centralise validation + audit and matches the
-- codebase posture.
--
-- Hardened pattern (matches get_church_profile / get_prayer_wall):
--   SECURITY DEFINER + SET search_path = pg_catalog, public
--   auth.uid() guard → 'not_authenticated'
--   REVOKE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated
--
-- Schema deltas vs dispatch draft (verified live, c.14806 trail):
--   - category column is TEXT (no prayer_request_category enum exists);
--     validation is an explicit whitelist of the AC #12 values, not an
--     enum cast.
--   - column is `urgent` not `is_urgent` (param renamed to match).
--   - anonymous is inherited from users.anonymous at post time
--     (the modal does not surface an anonymous toggle).
--
-- Error codes raised (consumed by the FE for surfaced error messaging):
--   not_authenticated  · auth.uid() is null
--   user_not_found     · no active public.users row for caller
--   not_verified       · users.verification_status <> 'verified'
--   content_required   · trimmed content is empty
--   content_too_long   · content > 300 chars
--   invalid_category   · category not in the AC #12 whitelist

CREATE OR REPLACE FUNCTION public.create_prayer_request(
  p_content  text,
  p_category text,
  p_urgent   boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id      uuid;
  v_church_id    uuid;
  v_anonymous    boolean;
  v_verification text;
  v_trimmed      text;
  v_new_id       uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Resolve caller's own public.users row + the church id + the
  -- anonymous setting that the row will inherit from the leader.
  SELECT u.id, u.church_id, u.anonymous, u.verification_status::text
  INTO   v_user_id, v_church_id, v_anonymous, v_verification
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Verification gate — only verified leaders may post.
  IF v_verification <> 'verified' THEN
    RAISE EXCEPTION 'not_verified';
  END IF;

  -- Content: required, trimmed, length-capped at 300 chars.
  v_trimmed := trim(p_content);
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'content_required';
  END IF;
  IF char_length(v_trimmed) > 300 THEN
    RAISE EXCEPTION 'content_too_long';
  END IF;

  -- Category: required + whitelisted. The live column is plain text
  -- (no enum), so the whitelist IS the enforcement boundary.
  IF p_category IS NULL
     OR p_category NOT IN ('Healing','Protection','Provision','Unity','Other') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  -- Other columns rely on table defaults: id (gen_random_uuid),
  -- is_active (true), status ('open'), created_at (now()),
  -- prayed_count (0).
  INSERT INTO public.prayer_requests (
    user_id,
    church_id,
    content,
    category,
    urgent,
    anonymous
  ) VALUES (
    v_user_id,
    v_church_id,
    v_trimmed,
    p_category,
    COALESCE(p_urgent, false),
    COALESCE(v_anonymous, false)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_prayer_request(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prayer_request(text, text, boolean) TO authenticated;
