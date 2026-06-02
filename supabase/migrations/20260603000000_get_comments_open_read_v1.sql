-- Home tab comments layer — open read for unverified (pending) leaders
--
-- Founder ruling (2026-06-03): unverified/pending leaders CAN read the comment
-- thread, but still CANNOT post (the verified-only gate stays in post_comment).
-- get_comments previously gated the CALLER on verification_status = 'verified',
-- which was correct when reading was verified-only. That reader gate is now
-- removed so pending leaders see the full thread.
--
-- This migration ONLY loosens the verification check on the READER. Nothing about
-- the returned data changes:
--   * Masking covenant preserved verbatim — masked (underground / no church) rows
--     return author_name / church_name / role as NULL.
--   * Identity joins stay gated on `c.is_masked = false` so a masked author's
--     name/church/role is never even read into the result set (defence-in-depth).
--   * author_id is still NEVER returned (D-56 / D-64).
--   * REVOKE/GRANT unchanged — only `authenticated` may call; anon never can.

BEGIN;

-- RETURNS TABLE signature is identical to the migration 5 version, but Postgres
-- forbids changing an existing function's return type via CREATE OR REPLACE in
-- some cases; drop first to stay safe and explicit.
DROP FUNCTION IF EXISTS public.get_comments(uuid);

CREATE OR REPLACE FUNCTION public.get_comments(p_announcement_id uuid)
RETURNS TABLE (
  id            uuid,
  body          text,
  created_at    timestamptz,
  is_masked     boolean,
  masked_region text,
  author_name   text,
  church_name   text,
  role          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.body,
    c.created_at,
    c.is_masked,
    c.masked_region,
    -- author_id is NEVER selected into the result set.
    CASE WHEN c.is_masked THEN NULL ELSE au.full_name  END AS author_name,
    CASE WHEN c.is_masked THEN NULL ELSE ac.name       END AS church_name,
    -- Role mirrors the name masking: never surface a masked commenter's title.
    CASE WHEN c.is_masked THEN NULL ELSE au.role::text END AS role
  FROM public.comments c
  -- Identity joins only fire for non-masked rows; a masked author's name/church/
  -- role is never read.
  LEFT JOIN public.users    au ON au.auth_id = c.author_id AND c.is_masked = false
  LEFT JOIN public.churches ac ON ac.id      = au.church_id AND c.is_masked = false
  WHERE c.announcement_id = p_announcement_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_comments(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_comments(uuid) TO authenticated;

COMMIT;
