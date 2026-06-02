-- Home tab comments layer — get_comments returns commenter role
--
-- The comment display format is "Role + first name" (e.g. "Evangelist Ife",
-- "Minister Ruth"). That requires the commenter's public.users.role alongside
-- full_name (already returned). This migration adds `role text` to get_comments.
--
-- Masking covenant (unchanged, reinforced): for masked rows (underground / no
-- church) role is returned NULL, exactly like author_name + church_name — a
-- masked commenter's title is never surfaced. The identity join stays gated on
-- `c.is_masked = false` so a masked author's role is never even read into the
-- result set (defence-in-depth). author_id is still NEVER returned (D-56 / D-64).
--
-- public.users.role is the user_role enum; cast ::text so the column matches the
-- RETURNS TABLE signature. Raw enum labels (pastor, evangelist, bishop, …) are
-- returned as-is; the client humanises them.

BEGIN;

-- RETURNS TABLE gains a column (role text); Postgres forbids changing an existing
-- function's return type via CREATE OR REPLACE, so drop the old signature first.
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
DECLARE
  v_user_pk uuid;
BEGIN
  SELECT u.id INTO v_user_pk
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_user_pk IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

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
