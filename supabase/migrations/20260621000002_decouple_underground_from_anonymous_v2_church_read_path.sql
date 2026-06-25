-- decouple_underground_from_anonymous_v2_church_read_path
--
-- Follow-up to v1 (20260621000001). v1 fixed the leader-name disclosure
-- but kept church_name gated on the write-time `mask_reason` enum.
-- Because post_comment writes mask_reason='anon' (not 'underground') when
-- the leader is anonymous — even if the leader's church IS underground —
-- the v1 RPC was disclosing the real underground church name for those
-- comments. This violates the underground threat model: an anon flag
-- should never relax church-side masking.
--
-- Fix: read church masking from the live churches row (ac.type +
-- ac.show_church_name) rather than the write-time mask_reason tag.
-- Author-name gating stays on users.anonymous (also read live).
--
-- Result: the two axes are now fully independent at the read path.
--
--   author_name:
--     - NULL when leader is anonymous (au.anonymous = true)
--     - NULL when no_church row (full safe mask)
--     - else real au.full_name (server-composed via resolve_display_name)
--
--   church_name:
--     - NULL when no_church row
--     - real ac.name when church is NOT underground
--     - real ac.name when underground + show_church_name = true (brave)
--     - NULL when underground + show_church_name = false (safe)
--     - masked_region (written at post time) carries the region fallback
--
--   role:
--     - returned for every row except no_church

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
    CASE
      WHEN c.mask_reason = 'no_church'   THEN NULL
      WHEN COALESCE(au.anonymous, false) THEN NULL
      ELSE au.full_name
    END AS author_name,
    CASE
      WHEN c.mask_reason = 'no_church'                                 THEN NULL
      WHEN ac.type IS NULL                                             THEN NULL
      WHEN ac.type <> 'underground'                                    THEN ac.name
      WHEN COALESCE(ac.show_church_name, false)                        THEN ac.name
      ELSE NULL
    END AS church_name,
    CASE WHEN c.mask_reason <> 'no_church' THEN au.role::text
    END AS role
  FROM public.comments c
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
