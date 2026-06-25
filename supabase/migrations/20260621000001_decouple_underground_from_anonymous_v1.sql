-- decouple_underground_from_anonymous_v1
--
-- Problem: get_comments was using `mask_reason = 'none'` as the single gate
-- for revealing the leader's name. Because post_comment writes
-- mask_reason='underground' for ALL underground-church leaders (regardless of
-- whether they personally toggled `users.anonymous = true`), this conflated
-- two independent axes:
--
--   1. users.anonymous     → mask the LEADER's name (personal anonymity)
--   2. churches.type='underground' AND NOT show_church_name
--                          → mask the CHURCH (name, city, country)
--
-- An underground leader who did NOT toggle anonymous was still being erased
-- to "A fellow {role}" against their will. Underground is a CHURCH-side
-- threat-model protection; it must not silently override the leader's own
-- choice to be known by name.
--
-- Fix (read-path only): get_comments now decides name disclosure by reading
-- `users.anonymous` directly. mask_reason is preserved as the historical
-- write-time tag (post_comment's enum priority unchanged for backward
-- compat). is_masked stays as the GENERATED column for legacy readers.
--
-- Disclosure matrix after this migration:
--
--   author_name:
--     - real `au.full_name` when au.anonymous = false AND mask_reason <> 'no_church'
--     - NULL when au.anonymous = true OR mask_reason = 'no_church'
--
--   church_name (UNCHANGED — already correct):
--     - real `ac.name` when mask_reason IN ('none','anon')
--     - real `ac.name` when mask_reason='underground' AND show_church_name=true (brave)
--     - NULL when mask_reason='underground' AND show_church_name=false (safe)
--     - NULL when mask_reason='no_church'
--
--   role (UNCHANGED):
--     - returned for all mask_reason values except 'no_church'
--
-- Threat-model invariants preserved:
--   - Underground church identity (name + city + country) still masked when
--     show_church_name=false. The masked_region fallback still applies.
--   - no_church rows still disclose nothing.
--   - author_id is still never returned (D-56 / D-64).

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
    -- author_name: gated on the LEADER's own anonymity flag, not church type.
    -- Underground leaders who did NOT toggle anonymous still surface their
    -- real name here. NULL only when the leader chose anonymous OR when the
    -- row has no church on record (no_church safe full mask).
    -- author_id is NEVER returned (D-56 / D-64).
    CASE
      WHEN c.mask_reason = 'no_church'        THEN NULL
      WHEN COALESCE(au.anonymous, false)      THEN NULL
      ELSE au.full_name
    END AS author_name,
    -- church_name: gated on church-side threat model.
    --   none / anon → real church name (church always shown for public anon)
    --   underground + show_church_name=true (brave) → real church name
    --   underground + show_church_name=false (safe) → NULL (masked_region carries region label)
    --   no_church → NULL
    CASE
      WHEN c.mask_reason IN ('none', 'anon')
        THEN ac.name
      WHEN c.mask_reason = 'underground' AND COALESCE(ac.show_church_name, false)
        THEN ac.name
      ELSE NULL
    END AS church_name,
    -- role: returned for all rows except no_church so the FE can render
    -- "A fellow {role}" when the leader is anonymous.
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
