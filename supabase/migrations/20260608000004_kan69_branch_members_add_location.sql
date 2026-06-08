-- KAN-69 — extend get_branch_members with ministry_city + ministry_country
--
-- DROP + CREATE required: PostgreSQL rejects CREATE OR REPLACE when the
-- RETURNS TABLE signature changes (new columns added). Same pattern as the
-- create_branch param-rename in 20260608000002.
--
-- The MembersSheet needs to display church location alongside ministry name
-- so leaders can tell churches apart (e.g. two "Grace Fellowship" churches in
-- different countries). churches.city and churches.country are both text and
-- already available in the JOIN on churches c ON c.id = bm.ministry_id.
--
-- Replaces get_branch_members from 20260608000003 (alias hotfix). The
-- caller-gate alias fix (_bm) and qualification are preserved verbatim.
--
-- Anchored by KAN-69.

DROP FUNCTION IF EXISTS public.get_branch_members(uuid);

CREATE FUNCTION public.get_branch_members(p_branch_id uuid)
RETURNS TABLE (
  user_id                  uuid,
  ministry_id              uuid,
  ministry_name            text,
  ministry_city            text,
  ministry_country         text,
  full_name                text,
  display_name_preference  text,
  role                     text,
  anonymous                boolean,
  is_host                  boolean,
  consent_status           text,
  consented_at             timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Use alias _bm to avoid ambiguity: user_id / consent_status are both
  -- RETURNS TABLE output columns AND branch_members columns. Without a
  -- table qualifier, PostgreSQL raises "column reference is ambiguous".
  -- See 20260608000003 for the root-cause explanation.
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members AS _bm
    WHERE _bm.branch_id      = p_branch_id
      AND _bm.user_id        = v_caller_id
      AND _bm.consent_status <> 'left'
  ) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  RETURN QUERY
  SELECT
    bm.user_id,
    bm.ministry_id,
    c.name::text                   AS ministry_name,
    c.city::text                   AS ministry_city,
    c.country::text                AS ministry_country,
    u.full_name,
    u.display_name_preference,
    u.role::text                   AS role,
    u.anonymous,
    bm.is_host,
    bm.consent_status,
    bm.consented_at
  FROM public.branch_members bm
  JOIN public.users    u ON u.id = bm.user_id
  JOIN public.churches c ON c.id = bm.ministry_id
  WHERE bm.branch_id = p_branch_id
    AND bm.consent_status <> 'left'
  ORDER BY bm.is_host DESC, bm.invited_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_branch_members(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_branch_members(uuid) TO authenticated;
