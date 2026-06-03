-- get_comments rewrite — returns mask_reason + role + correct church_name
-- (CC ruling 2026-06-05).
--
-- Key contract changes vs prior version:
--   + mask_reason text  — 'none'|'anon'|'underground'|'no_church'
--   + role text         — returned for none/anon/underground; NULL for no_church
--   ~ church_name       — now non-null for 'anon' rows (church always shown for
--                         public anonymous leaders); for underground: church name
--                         if churches.show_church_name=true, else NULL (masked_region
--                         carries location)
--   = is_masked         — still returned (backward compat); derived from mask_reason
--
-- JOINs are no longer gated on is_masked=false. Each disclosed field is gated
-- on the specific mask_reason(s) that permit disclosure.

BEGIN;

DROP FUNCTION IF EXISTS public.get_comments(uuid);

CREATE OR REPLACE FUNCTION public.get_comments(p_announcement_id uuid)
RETURNS TABLE (
  id            uuid,
  body          text,
  created_at    timestamptz,
  is_masked     boolean,
  mask_reason   text,
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
    c.mask_reason::text,
    c.masked_region,
    -- author_name: only for fully-attributed rows.
    -- author_id is NEVER returned (D-56 / D-64).
    CASE WHEN c.mask_reason = 'none' THEN au.full_name
    END AS author_name,
    -- church_name:
    --   none        → real church name
    --   anon        → real church name (public anon: church ALWAYS shown)
    --   underground → church name only if show_church_name=true; else NULL
    --                 (masked_region carries location in that case)
    --   no_church   → NULL
    CASE
      WHEN c.mask_reason IN ('none', 'anon')
        THEN ac.name
      WHEN c.mask_reason = 'underground' AND COALESCE(ac.show_church_name, true)
        THEN ac.name
      ELSE NULL
    END AS church_name,
    -- role: available for none/anon/underground so the FE can build
    -- "A fellow [Role]". NULL only for no_church (full safe mask).
    CASE WHEN c.mask_reason <> 'no_church' THEN au.role::text
    END AS role
  FROM public.comments c
  -- JOINs fire for all rows except no_church (which discloses nothing).
  LEFT JOIN public.users    au ON au.auth_id = c.author_id
                               AND c.mask_reason <> 'no_church'
  LEFT JOIN public.churches ac ON ac.id = au.church_id
                               AND c.mask_reason <> 'no_church'
  WHERE c.announcement_id = p_announcement_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_comments(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_comments(uuid) TO authenticated;

COMMIT;
