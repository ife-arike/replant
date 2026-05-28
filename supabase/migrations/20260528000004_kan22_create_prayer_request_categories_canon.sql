-- KAN-22 — patch create_prayer_request's category whitelist to the
-- canonical 8-value Founder-locked set.
--
-- The first cut of this RPC (migration 20260528000003) shipped with a
-- 5-value whitelist (Healing, Protection, Provision, Unity, Other)
-- inherited from a stale dispatch. That set conflicts with the live
-- Founder-locked CATEGORIES constant in
-- src/components/prayer/PrayerWallLogic.ts:42 (Founder lock 2026-05-24,
-- 8 values, no 'Other'), and would have:
--   - rejected leaders posting Salvation / Guidance / Endurance /
--     Laborers (all canonical),
--   - admitted 'Other' as a write, which can't be filtered on the
--     KAN-23 surface and doesn't belong on the wall.
--
-- This migration replaces the whitelist with the canonical 8. Order is
-- preserved verbatim from CATEGORIES so the two stay in lockstep. No
-- prod rows have been created via this RPC yet (no FE caller existed
-- between the first migration and this one), so no data backfill is
-- needed for the dropped 'Other' value.
--
-- Everything else about the function is unchanged — same signature,
-- same SECURITY DEFINER posture, same search_path, same auth/verify/
-- content guards, same column targets, same REVOKE/GRANT.

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
  -- VALID_CATEGORIES — mirror of the FE CATEGORIES constant at
  -- src/components/prayer/PrayerWallLogic.ts:42 (Founder lock
  -- 2026-05-24). Order matters: keep these two arrays in the same
  -- order so a diff between the two surfaces is a one-line check.
  v_valid_categories text[] := ARRAY[
    'Healing',
    'Protection',
    'Provision',
    'Salvation',
    'Unity',
    'Guidance',
    'Endurance',
    'Laborers'
  ];

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

  SELECT u.id, u.church_id, u.anonymous, u.verification_status::text
  INTO   v_user_id, v_church_id, v_anonymous, v_verification
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_verification <> 'verified' THEN
    RAISE EXCEPTION 'not_verified';
  END IF;

  v_trimmed := trim(p_content);
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'content_required';
  END IF;
  IF char_length(v_trimmed) > 300 THEN
    RAISE EXCEPTION 'content_too_long';
  END IF;

  IF p_category IS NULL OR NOT (p_category = ANY (v_valid_categories)) THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  INSERT INTO public.prayer_requests (
    user_id, church_id, content, category, urgent, anonymous
  ) VALUES (
    v_user_id, v_church_id, v_trimmed, p_category,
    COALESCE(p_urgent, false), COALESCE(v_anonymous, false)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_prayer_request(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prayer_request(text, text, boolean) TO authenticated;
