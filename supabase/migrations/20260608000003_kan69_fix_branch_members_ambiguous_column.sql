-- KAN-69 hotfix: get_branch_members — resolve ambiguous column references
--
-- Root cause: in a RETURNS TABLE function, output column names
-- (user_id, consent_status, is_host, ministry_id, consented_at) become
-- implicit OUT parameter names. Unqualified references to those names
-- inside SQL sub-statements inside the function body are ambiguous between
-- the OUT param and the table column — PostgreSQL raises:
--   "ERROR: column reference 'user_id' is ambiguous"
-- This caused every get_branch_members call to return HTTP 400.
--
-- Fix: add table alias _bm in the IF NOT EXISTS caller-gate subquery and
-- qualify every column reference that shares a name with a RETURNS TABLE
-- output column. The RETURN QUERY already uses the `bm.*` alias throughout
-- — no change needed there.
--
-- Pre-existing bug: the ambiguity existed in the function from its first
-- deployment (20260529000001); it was carried forward verbatim in the
-- 20260608000002 rebase. This migration corrects it.
--
-- Anchored by KAN-69.

CREATE OR REPLACE FUNCTION public.get_branch_members(p_branch_id uuid)
RETURNS TABLE (
  user_id                  uuid,
  ministry_id              uuid,
  ministry_name            text,
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
