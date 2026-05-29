-- KAN-214 Branch RPCs v1 — Migration 2 of 3
--
-- Six SECURITY DEFINER RPCs that own every write path into branches /
-- branch_members and every read of the branches + members + thread view.
-- The tables in Migration 1 have RLS enabled with SELECT-only policies;
-- this is the entire authorized write surface.
--
-- Conventions (every function in this file):
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = ''                          ← all object refs schema-qualified
--   REVOKE EXECUTE FROM PUBLIC, anon
--   GRANT EXECUTE TO authenticated
--
-- Caller-gate is the same on every RPC: caller must resolve from
-- auth.uid() → public.users with is_active=true AND verification_status
-- ='verified'. Rationale: only verified active leaders participate in
-- branches (matches DM gate in send-message). Failures raise
-- 'not_authorized'.
--
-- Audit policy: each RPC writes ONE primary audit_log row reflecting its
-- canonical action. respond_to_branch_invite + remove_ministry_from_branch
-- + (no-invitee) create_branch may additionally write 'branch_activated'
-- when the activation gate flips.
-- triggered_by='user' (audit_log_triggered_by_check) on every row.

BEGIN;

-- ─── 1. create_branch ──────────────────────────────────────────────
-- Inputs: trimmed branch name (1..48 chars), invitee user_id array.
-- Outputs: new branch_id.
-- Errors:
--   'not_authorized'      → caller is not verified/active
--   'branch_cap_exceeded' → array_length(invitees) > 6 (host + 6 = 7 cap)
--   'self_invite'         → caller id appears in invitees
--   'unverified_invitee'  → any invitee is not verified+active
-- Effects:
--   INSERT branches (status='forming', created_by=caller)
--   INSERT host into branch_members (is_host=true, consent_status='joined')
--   INSERT each invitee into branch_members (consent_status='invited')
--   If zero invitees: UPDATE branches→active + audit 'branch_activated'
--   Audit: 'branch_created' (always)
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
    -- A verified leader missing church_id is a data integrity break;
    -- surface as not_authorized to the client (don't leak schema state).
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_invitee_count := COALESCE(array_length(p_invited_user_ids, 1), 0);

  -- Cap: host occupies 1 of 7 slots; invitees max 6.
  IF v_invitee_count > 6 THEN
    RAISE EXCEPTION 'branch_cap_exceeded';
  END IF;

  -- Self-invite guard. (Belt-and-suspenders: the UNIQUE (branch_id,
  -- user_id) constraint would also reject this on the second INSERT,
  -- but a clean exception name beats a 23505 surfacing.)
  IF v_caller_id = ANY (p_invited_user_ids) THEN
    RAISE EXCEPTION 'self_invite';
  END IF;

  -- All invitees must be verified+active leaders (mirror DM gate).
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

  -- Create branch (CHECK on name length+non-empty enforces validation).
  INSERT INTO public.branches (name, status, created_by)
  VALUES (trim(p_name), 'forming', v_caller_id)
  RETURNING id INTO v_branch_id;

  -- Host row — joined at insert time, no invitation cycle.
  INSERT INTO public.branch_members (
    branch_id, user_id, ministry_id,
    is_host, consent_status, consented_at
  ) VALUES (
    v_branch_id, v_caller_id, v_caller_church_id,
    true, 'joined', now()
  );

  -- Invitee rows — ministry_id snapshot at invite time.
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

  -- Zero-invitee path: branch is born active (solo host).
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

REVOKE EXECUTE ON FUNCTION public.create_branch(text, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_branch(text, uuid[]) TO authenticated;

-- ─── 2. respond_to_branch_invite ───────────────────────────────────
-- Inputs: branch_id, response in ('joined','declined').
-- Outputs: new branch status ('forming' or 'active').
-- Errors:
--   'not_authorized'   → caller is not verified/active
--   'invalid_response' → response not in allowed set
--   'not_invited'      → caller has no row with consent_status='invited'
-- Effects:
--   UPDATE branch_members SET consent_status=response, consented_at=now()
--   If response='joined' AND all members joined: branches→active
--     + audit 'branch_activated'
--   Audit: 'branch_invite_responded' (always)
CREATE OR REPLACE FUNCTION public.respond_to_branch_invite(
  p_branch_id uuid,
  p_response  text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id      uuid;
  v_pending_count  int;
  v_new_status     text;
BEGIN
  IF p_response NOT IN ('joined', 'declined') THEN
    RAISE EXCEPTION 'invalid_response';
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Must have an open invitation. Already-joined / already-declined
  -- rows are idempotent no-ops at the FE — but at the RPC layer we
  -- reject them so a stale FE doesn't silently overwrite a consent
  -- decision the leader already made.
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND consent_status = 'invited'
  ) THEN
    RAISE EXCEPTION 'not_invited';
  END IF;

  UPDATE public.branch_members
  SET consent_status = p_response,
      consented_at   = now()
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  -- Activation gate: only triggers on 'joined' (a decline can't unlock
  -- a branch). Counts all rows whose consent_status is NOT joined; if
  -- zero, every member is in.
  IF p_response = 'joined' THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND consent_status <> 'joined';
    IF v_pending_count = 0 THEN
      UPDATE public.branches SET status = 'active' WHERE id = p_branch_id;
      INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES (
        'branch_activated', v_caller_id, 'user',
        jsonb_build_object('branch_id', p_branch_id, 'cause', 'final_consent')
      );
    END IF;
  END IF;

  SELECT status INTO v_new_status
  FROM public.branches WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_invite_responded', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',               p_branch_id,
      'response',                p_response,
      'resulting_branch_status', v_new_status
    )
  );

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) TO authenticated;

-- ─── 3. remove_ministry_from_branch ────────────────────────────────
-- Host-only "continue without them" path off the declined-ministry
-- prompt (screen-branch.jsx DeclineConfirm + proceedWithout).
-- Inputs: branch_id, ministry_id.
-- Outputs: new branch status.
-- Errors:
--   'not_authorized'         → caller not verified/active
--   'not_host'               → caller is not is_host=true on this branch
--   'branch_not_found'       → no such branch
--   'branch_already_active'  → branch is not in 'forming'
--   'ministry_not_in_branch' → no rows deleted (defensive)
-- Effects:
--   DELETE all branch_members WHERE branch_id, ministry_id
--   If all remaining rows joined AND any remain: branches→active
--     + audit 'branch_activated'
--   Audit: 'branch_member_removed' (always)
CREATE OR REPLACE FUNCTION public.remove_ministry_from_branch(
  p_branch_id   uuid,
  p_ministry_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id     uuid;
  v_branch_status text;
  v_removed_count int;
  v_remaining     int;
  v_pending       int;
  v_new_status    text;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND is_host   = true
  ) THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  SELECT status INTO v_branch_status
  FROM public.branches WHERE id = p_branch_id;
  IF v_branch_status IS NULL THEN
    RAISE EXCEPTION 'branch_not_found';
  END IF;
  IF v_branch_status <> 'forming' THEN
    RAISE EXCEPTION 'branch_already_active';
  END IF;

  -- Host cannot remove their own ministry — that would orphan the
  -- branch. The FE doesn't surface this option (host chip is locked),
  -- but defense-in-depth at the RPC layer:
  IF EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND ministry_id = p_ministry_id
      AND is_host = true
  ) THEN
    RAISE EXCEPTION 'cannot_remove_host_ministry';
  END IF;

  DELETE FROM public.branch_members
  WHERE branch_id   = p_branch_id
    AND ministry_id = p_ministry_id;
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;

  IF v_removed_count = 0 THEN
    RAISE EXCEPTION 'ministry_not_in_branch';
  END IF;

  -- Recompute activation gate after the removal.
  SELECT COUNT(*) INTO v_remaining
  FROM public.branch_members WHERE branch_id = p_branch_id;
  SELECT COUNT(*) INTO v_pending
  FROM public.branch_members
  WHERE branch_id = p_branch_id AND consent_status <> 'joined';

  IF v_remaining > 0 AND v_pending = 0 THEN
    UPDATE public.branches SET status = 'active' WHERE id = p_branch_id;
    INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES (
      'branch_activated', v_caller_id, 'user',
      jsonb_build_object('branch_id', p_branch_id, 'cause', 'continue_without')
    );
  END IF;

  SELECT status INTO v_new_status FROM public.branches WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_member_removed', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',     p_branch_id,
      'ministry_id',   p_ministry_id,
      'removed_count', v_removed_count
    )
  );

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_ministry_from_branch(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_ministry_from_branch(uuid, uuid) TO authenticated;

-- ─── 4. get_branch_list ────────────────────────────────────────────
-- Caller-scoped list for the Ministries sub-tab.
-- Each row: branch + counts + last-message preview + caller's consent
-- + (only when caller_consent_status='invited') invited_by_ministry_name
-- for the InviteCard.
--
-- unread_count: returned as 0 at MVP. Per-branch last_read tracking is
-- a follow-up — see KAN-214 follow-up note. Returning 0 here keeps the
-- shape stable for the FE so a later read-receipts ticket flips it on
-- without a contract change.
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
    SELECT bm.branch_id, bm.consent_status
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
    0::bigint                                                         AS unread_count,
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

-- ─── 5. get_branch_members ─────────────────────────────────────────
-- Caller-scoped: any member (any consent_status) can read the full
-- members list of branches they belong to. Used by MembersSheet on
-- screen-branch.jsx to show consent badges per leader.
--
-- Name composition: schema stores public.users.full_name + display_
-- name_preference (no first_name/last_name split). Return these raw
-- so FE getLeaderDisplayName helper composes the right rendering
-- (anon vs underground vs full_name).
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

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
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
  ORDER BY bm.is_host DESC, bm.invited_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_branch_members(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_branch_members(uuid) TO authenticated;

-- ─── 6. get_branch_messages ────────────────────────────────────────
-- Joined-members-only thread fetch. Returns the most recent 30 messages
-- in descending time; p_before is the cursor for paging back (FE passes
-- the oldest created_at seen so far).
--
-- KAN-70 leader-opacity contract: `flagged` is NEVER returned to the
-- leader. The admin moderation queue sees flagged; the leader's app
-- treats every delivered message identically. Returned columns are
-- (message_id, sender_id, content, created_at) only.
CREATE OR REPLACE FUNCTION public.get_branch_messages(
  p_branch_id uuid,
  p_before    timestamptz DEFAULT NULL
)
RETURNS TABLE (
  message_id uuid,
  sender_id  uuid,
  content    text,
  created_at timestamptz
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

  -- Only joined members can read the thread. Invited/declined members
  -- can see the branch row + members sheet but NOT messages. This
  -- mirrors the FE's "composer locked while forming" contract: nothing
  -- to read while consent is still being collected.
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND consent_status = 'joined'
  ) THEN
    RAISE EXCEPTION 'not_a_joined_member';
  END IF;

  RETURN QUERY
  SELECT
    m.id          AS message_id,
    m.sender_id,
    m.content,
    m.created_at
  FROM public.messages m
  WHERE m.branch_id = p_branch_id
    AND m.is_active = true
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT 30;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_branch_messages(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_branch_messages(uuid, timestamptz) TO authenticated;

COMMIT;
