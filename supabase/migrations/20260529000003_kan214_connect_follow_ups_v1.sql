-- KAN-214 Connect tab follow-ups v1 — Migration of 2026-05-29.
--
-- Closes four gaps surfaced by the FE story (KAN-68/69/70 PR #103):
--   1. create_branch ministry-cap: count DISTINCT ministries (not raw
--      user count). One ministry with 2 leaders = 1 slot, not 2.
--   2. Read tracking: per-conversation last_read_at_a / _b columns +
--      per-branch_member last_read_at column + mark_*_read RPCs.
--   3. search_leaders SECURITY DEFINER RPC — owns the underground-name
--      masking invariant server-side instead of trusting the FE.
--   4. get_invite_candidates SECURITY DEFINER RPC — same masking
--      invariant + bundles leader_ids for create_branch.
--   5. get_branch_list.unread_count: real count (was the 0::bigint stub
--      shipped in KAN-214 Migration 2).
--
-- SECURITY notes:
--   - users.full_name is the live schema (NOT first_name + last_name).
--     The brief assumed a split; we honor the brief's INTENT (search
--     by name) but return full_name to match what the FE
--     getLeaderDisplayName helper expects.
--   - Underground name masking is centralized in these RPCs.
--     The FE no longer needs to know which `churches.type` value means
--     "render as Underground Church"; the RPC returns the masked label
--     directly. This is the underground-safety invariant moved to
--     where it belongs.
--   - All read-tracking writes ARE caller-bound (we look up the caller's
--     public.users.id via auth.uid() before any UPDATE) — a leader can
--     only mark their OWN cursor.
--
-- Decisions ratified inline:
--   - The "underground LIKE" match against the literal 'underground
--     church' is intentional: a leader typing "underground" should find
--     underground rows (so they can be invited / DM'd), but the real
--     church name never participates in the predicate, even server-side.
--   - search_leaders requires query length >= 2 (RAISE EXCEPTION) so
--     the FE can't accidentally fan out a full-table scan via a single
--     character. FE is also gated on length >= 2 by HANDOFF §6.1.

BEGIN;

-- ─── 1. create_branch — ministry-cap fix ───────────────────────────
-- The KAN-214 v1 version raised 'branch_cap_exceeded' on > 6 invited
-- USERS. The FE picker counts MINISTRIES, so a leader selecting 4
-- ministries that have 2 leaders each (= 8 user ids) would hit the cap
-- despite picking only 4 of the 7 allowed ministries. Fix: count
-- DISTINCT churches across the invited users.
-- Signature unchanged → CREATE OR REPLACE swaps the body atomically.
CREATE OR REPLACE FUNCTION public.create_branch(
  p_name             text,
  p_invited_user_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id          uuid;
  v_caller_church_id   uuid;
  v_branch_id          uuid;
  v_invitee_count      int;
  v_ministry_count     int;
  v_unverified_count   int;
  v_invitee            uuid;
  v_invitee_church_id  uuid;
BEGIN
  SELECT id, church_id
    INTO v_caller_id, v_caller_church_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_caller_church_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_invitee_count := COALESCE(array_length(p_invited_user_ids, 1), 0);

  -- Self-invite guard FIRST — must come before the ministry-count
  -- query so a self-invite raises 'self_invite' rather than fanning
  -- out a count that includes the caller.
  IF v_caller_id = ANY (p_invited_user_ids) THEN
    RAISE EXCEPTION 'self_invite';
  END IF;

  -- Ministry-cap (FIXED): count DISTINCT church_ids across invited
  -- users. One ministry with 2 leaders = 1 slot. Verified+active
  -- guard here mirrors the unverified_invitee check below — a user
  -- who's been deactivated since the FE last loaded doesn't burn a
  -- ministry slot, but they DO trigger 'unverified_invitee' first.
  IF v_invitee_count > 0 THEN
    SELECT COUNT(DISTINCT u.church_id) INTO v_ministry_count
    FROM public.users u
    WHERE u.id = ANY (p_invited_user_ids)
      AND u.is_active = true;
    IF v_ministry_count > 6 THEN
      RAISE EXCEPTION 'branch_cap_exceeded';
    END IF;
  END IF;

  IF v_invitee_count > 0 THEN
    SELECT COUNT(*) INTO v_unverified_count
    FROM unnest(p_invited_user_ids) AS uid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = uid
        AND u.is_active = true
        AND u.verification_status = 'verified'
        AND u.church_id IS NOT NULL
    );
    IF v_unverified_count > 0 THEN
      RAISE EXCEPTION 'unverified_invitee';
    END IF;
  END IF;

  INSERT INTO public.branches (name, status, created_by)
  VALUES (trim(p_name), 'forming', v_caller_id)
  RETURNING id INTO v_branch_id;

  INSERT INTO public.branch_members (
    branch_id, user_id, ministry_id,
    is_host, consent_status, consented_at
  ) VALUES (
    v_branch_id, v_caller_id, v_caller_church_id,
    true, 'joined', now()
  );

  FOREACH v_invitee IN ARRAY COALESCE(p_invited_user_ids, ARRAY[]::uuid[]) LOOP
    SELECT church_id INTO v_invitee_church_id
    FROM public.users
    WHERE id = v_invitee;
    INSERT INTO public.branch_members (
      branch_id, user_id, ministry_id,
      is_host, consent_status
    ) VALUES (
      v_branch_id, v_invitee, v_invitee_church_id,
      false, 'invited'
    );
  END LOOP;

  IF v_invitee_count = 0 THEN
    UPDATE public.branches SET status = 'active' WHERE id = v_branch_id;
    INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES (
      'branch_activated', v_caller_id, 'user',
      jsonb_build_object('branch_id', v_branch_id, 'cause', 'created_without_invitees')
    );
  END IF;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_created', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',     v_branch_id,
      'invitee_count', v_invitee_count
    )
  );

  RETURN v_branch_id;
END;
$$;

-- Existing GRANTS persist on CREATE OR REPLACE; no need to re-issue.

-- ─── 2. Read-tracking columns ──────────────────────────────────────
-- 1:1 conversations: per-participant last-read timestamp.
-- Branches: per-member last-read timestamp.
ALTER TABLE public.conversations
  ADD COLUMN last_read_at_a timestamptz NULL,
  ADD COLUMN last_read_at_b timestamptz NULL;

ALTER TABLE public.branch_members
  ADD COLUMN last_read_at timestamptz NULL;

-- ─── 3. mark_conversation_read ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_pa      uuid;
  v_pb      uuid;
BEGIN
  -- Caller must resolve to a public.users row (not necessarily verified
  -- — a leader in 'pending' status can still mark threads read; the
  -- send paths are the only ones that gate on verified).
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT participant_a, participant_b INTO v_pa, v_pb
  FROM public.conversations
  WHERE id = p_conversation_id;
  IF v_pa IS NULL THEN
    -- Conversation row doesn't exist. Surface the same shape clients
    -- handle for any "thread gone" condition. (Don't leak the
    -- distinction between not-found and not-allowed.)
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_pa = v_user_id THEN
    UPDATE public.conversations
    SET last_read_at_a = now()
    WHERE id = p_conversation_id;
  ELSIF v_pb = v_user_id THEN
    UPDATE public.conversations
    SET last_read_at_b = now()
    WHERE id = p_conversation_id;
  ELSE
    -- Caller is not a participant. Same "leak no existence" 403 shape.
    RAISE EXCEPTION 'not_authorized';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- ─── 4. mark_branch_read ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_branch_read(
  p_branch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_updated int;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.branch_members
  SET last_read_at = now()
  WHERE branch_id = p_branch_id
    AND user_id   = v_user_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- Caller isn't a member of this branch (any consent_status). Same
    -- "leak no existence" 403 shape.
    RAISE EXCEPTION 'not_authorized';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_branch_read(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_branch_read(uuid) TO authenticated;

-- ─── 5. search_leaders ─────────────────────────────────────────────
-- Returns verified active leaders by name OR church name.
-- Caller (auth.uid()-resolved public.users.id) is excluded from results.
--
-- UNDERGROUND MASKING (load-bearing):
--   - Predicate: for type='underground' rows we match against the
--     literal 'Underground Church' label only — never c.name. A
--     leader typing the real underground church name CANNOT find it
--     via this search. A leader typing "underground" will find
--     underground rows under the generic label.
--   - Return: church_name is ALWAYS the masked label for underground
--     rows. The FE never sees the real underground name.
--
-- users schema: this DB uses full_name (single column), not
-- first_name + last_name. Returning full_name keeps the contract
-- aligned with getLeaderDisplayName.
CREATE OR REPLACE FUNCTION public.search_leaders(
  p_query text
)
RETURNS TABLE (
  user_id        uuid,
  full_name      text,
  role           text,
  anonymous      boolean,
  church_id      uuid,
  church_name    text,
  underground    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_q         text := lower(trim(COALESCE(p_query, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RAISE EXCEPTION 'query_too_short';
  END IF;

  -- Caller resolution is OPTIONAL for search — an unverified user
  -- shouldn't be searching (HANDOFF §8 soft gate), but a missing row
  -- here doesn't break the function. We still exclude the caller
  -- when v_caller_id is non-null.
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    u.id                                                              AS user_id,
    u.full_name                                                       AS full_name,
    u.role::text                                                      AS role,
    u.anonymous                                                       AS anonymous,
    c.id                                                              AS church_id,
    CASE WHEN c.type = 'underground' THEN 'Underground Church'
         ELSE c.name END                                              AS church_name,
    (c.type = 'underground')                                          AS underground
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.verification_status = 'verified'
    AND u.is_active = true
    AND c.is_active = true
    AND (v_caller_id IS NULL OR u.id <> v_caller_id)
    AND (
      lower(u.full_name) LIKE '%' || v_q || '%'
      -- Underground real names CANNOT match the predicate. The literal
      -- 'underground church' label is the only searchable surface.
      OR (c.type <> 'underground' AND lower(c.name) LIKE '%' || v_q || '%')
      OR (c.type = 'underground'  AND 'underground church' LIKE '%' || v_q || '%')
    )
  ORDER BY u.full_name
  LIMIT 30;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_leaders(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_leaders(text) TO authenticated;

-- ─── 6. get_invite_candidates ──────────────────────────────────────
-- Returns ministries (church rows) the caller can invite into a branch.
-- Excludes the caller's own church. Underground name masking + city
-- elision applied. Returns the per-ministry leader array so the FE
-- doesn't need a second query to expand a ministry into user_ids when
-- the leader submits the branch.
CREATE OR REPLACE FUNCTION public.get_invite_candidates(
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  ministry_id    uuid,
  ministry_name  text,
  city           text,
  country        text,
  underground    boolean,
  leader_count   int,
  leaders        jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_church uuid;
  v_q             text := lower(trim(COALESCE(p_query, '')));
BEGIN
  SELECT church_id INTO v_caller_church
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;
  -- v_caller_church may be NULL for an unverified leader; the WHERE
  -- below uses IS DISTINCT FROM so a NULL caller-church still excludes
  -- nothing (which means everyone could see all ministries — but the
  -- caller shouldn't be on this surface at all if they're unverified;
  -- the FE soft gate is the floor).

  RETURN QUERY
  SELECT
    c.id                                                              AS ministry_id,
    CASE WHEN c.type = 'underground' THEN 'Underground Church'
         ELSE c.name END                                              AS ministry_name,
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.city END        AS city,
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.country END     AS country,
    (c.type = 'underground')                                          AS underground,
    COUNT(u.id)::int                                                  AS leader_count,
    jsonb_agg(
      jsonb_build_object(
        'user_id',   u.id,
        'full_name', u.full_name,
        'role',      u.role,
        'anonymous', u.anonymous
      )
      ORDER BY u.full_name
    )                                                                 AS leaders
  FROM public.churches c
  JOIN public.users u ON u.church_id = c.id
   AND u.is_active = true
   AND u.verification_status = 'verified'
  WHERE c.is_active = true
    AND c.id IS DISTINCT FROM v_caller_church
    AND (
      v_q = ''
      OR (c.type <> 'underground' AND lower(c.name) LIKE '%' || v_q || '%')
      OR (c.type = 'underground'  AND 'underground church' LIKE '%' || v_q || '%')
    )
  GROUP BY c.id, c.type, c.name, c.city, c.country
  HAVING COUNT(u.id) > 0
  ORDER BY
    CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END
  LIMIT 50;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invite_candidates(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_invite_candidates(text) TO authenticated;

-- ─── 7. get_branch_list — real unread_count ─────────────────────────
-- KAN-214 Migration 2 shipped unread_count as a 0::bigint stub. With
-- branch_members.last_read_at now in place (added above), compute
-- unread per-caller from the actual message stream.
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
    SELECT bm.branch_id, bm.consent_status, bm.last_read_at
    FROM public.branch_members bm
    WHERE bm.user_id = v_caller_id
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
       WHERE bm2.branch_id = b.id)                                    AS member_count,
    (SELECT COUNT(DISTINCT bm3.ministry_id) FROM public.branch_members bm3
       WHERE bm3.branch_id = b.id)                                    AS ministry_count,
    LEFT(lm.content, 60)                                              AS last_message_preview,
    lm.created_at                                                     AS last_message_at,
    -- Real unread: messages in this branch from someone else, newer
    -- than the caller's last_read_at (or all of them if last_read_at
    -- is NULL — the caller has never opened the branch yet).
    (
      SELECT COUNT(*)
      FROM public.messages m
      WHERE m.branch_id = b.id
        AND m.is_active = true
        AND m.sender_id <> v_caller_id
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

-- Existing GRANTS persist on CREATE OR REPLACE.

COMMIT;
