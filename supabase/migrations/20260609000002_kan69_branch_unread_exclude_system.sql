-- ════════════════════════════════════════════════════════════════════
-- KAN-69 — branch unread_count must exclude system messages
--
-- get_branch_list previously counted ALL active messages newer than the
-- caller's last_read_at (excluding only the caller's own sends) toward
-- unread_count. Branch-join system messages (authored by the synthetic
-- BRANCH_SYSTEM_USER_ID '028be745-8014-4314-a7cf-36b0a4d52b46') were
-- therefore inflating the Connect tab badge — e.g. 6 join events read as
-- 6 unread notifications. System events are not leader messages and must
-- never drive the unread badge.
--
-- Fix: add one predicate to the unread_count subquery excluding the
-- branch system user. Signature unchanged → CREATE OR REPLACE (no DROP).
-- Rebased verbatim on the LIVE def from 20260608000002.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_branch_list()
RETURNS TABLE (
  branch_id                uuid,
  name                     text,
  status                   text,
  member_count             bigint,
  ministry_count           bigint,
  last_message_preview     text,
  last_message_at          timestamptz,
  unread_count             bigint,
  caller_consent_status    text,
  invited_by_ministry_name text
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

  RETURN QUERY
  WITH my_branches AS (
    -- Caller's own membership rows that still count (a 'left' caller no
    -- longer sees the branch in their list).
    SELECT bm.branch_id, bm.consent_status, bm.last_read_at
    FROM public.branch_members bm
    WHERE bm.user_id = v_caller_id
      AND bm.consent_status <> 'left'
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.branch_id)
      m.branch_id,
      m.content,
      m.created_at
    FROM public.messages m
    WHERE m.branch_id IN (SELECT mb.branch_id FROM my_branches mb)
      AND m.is_active = true
    ORDER BY m.branch_id, m.created_at DESC
  )
  SELECT
    b.id                                                              AS branch_id,
    b.name                                                            AS name,
    b.status                                                          AS status,
    (SELECT COUNT(*) FROM public.branch_members bm2
       WHERE bm2.branch_id = b.id
         AND bm2.consent_status <> 'left')                            AS member_count,
    (SELECT COUNT(DISTINCT bm3.ministry_id) FROM public.branch_members bm3
       WHERE bm3.branch_id = b.id
         AND bm3.consent_status <> 'left')                            AS ministry_count,
    LEFT(lm.content, 60)                                              AS last_message_preview,
    lm.created_at                                                     AS last_message_at,
    (
      SELECT COUNT(*)
      FROM public.messages m
      WHERE m.branch_id = b.id
        AND m.is_active = true
        AND m.sender_id <> v_caller_id
        AND m.sender_id <> '028be745-8014-4314-a7cf-36b0a4d52b46'
        AND (mb.last_read_at IS NULL OR m.created_at > mb.last_read_at)
    )                                                                 AS unread_count,
    mb.consent_status                                                 AS caller_consent_status,
    CASE
      WHEN mb.consent_status = 'invited' THEN (
        SELECT c.name
        FROM public.users u
        JOIN public.churches c ON c.id = u.church_id
        WHERE u.id = b.created_by
      )
      ELSE NULL
    END                                                               AS invited_by_ministry_name
  FROM public.branches b
  JOIN my_branches mb ON mb.branch_id = b.id
  LEFT JOIN last_msg lm ON lm.branch_id = b.id
  ORDER BY COALESCE(lm.created_at, b.created_at) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_branch_list() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_branch_list() TO authenticated;
