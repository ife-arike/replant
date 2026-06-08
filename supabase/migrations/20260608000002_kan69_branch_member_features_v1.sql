-- KAN-69 Branch member features v1 — leave / co-host auto-add / host admin
--
-- Extends the KAN-214 branch (Ministries) foundation with the member-
-- lifecycle and host-admin capabilities the covenant between gathered
-- church leaders requires:
--
--   Area 1 — Soft-leave: branch_members.consent_status gains 'left' +
--            a left_at timestamp. Leaving preserves the audit chain
--            (who was ever in the branch, when they left) instead of
--            hard-deleting the row and orphaning audit_log references.
--   Area 2 — create_branch becomes MINISTRY-level: invitations are
--            addressed to ministries (churches), every verified active
--            leader of an invited ministry is added; every OTHER verified
--            active leader of the HOST's ministry is auto-added as co-host.
--   Area 3 — leave_branch: a non-host leader voluntarily leaves (soft).
--   Area 4 — edit_branch_name: host renames the branch.
--   Area 5 — remove_branch_leader: host hard-removes ONE leader (admin act).
--   Area 6 — delete_branch: host soft-deletes the branch (status=cancelled).
--
-- ACTIVATION-GATE SEMANTIC CHANGE (Area 1 interaction):
--   The KAN-214 gate counted `consent_status <> 'joined'` as "pending".
--   With 'left' and 'declined' now both meaning "not blocking", the gate
--   is redefined to count ONLY `consent_status = 'invited'` — i.e. leaders
--   still waiting to respond. A declined or left leader never blocks
--   activation. Applied in respond_to_branch_invite, remove_ministry_from_
--   branch, and the new remove_branch_leader.
--
-- DRIFT-AWARE REBASE (locked per CLAUDE.md live-source rule):
--   These CREATE OR REPLACE bodies are rebased on the LIVE function
--   definitions (pg_get_functiondef on jiyetphxxvyiicrnwlnx), NOT the
--   20260529000001 source file, which has since drifted:
--     * respond_to_branch_invite carries the KAN-69 fail-open system-
--       message INSERT (20260608000001) — PRESERVED here verbatim.
--     * get_branch_list computes real unread_count off branch_members.
--       last_read_at — PRESERVED here; only member_count is changed to
--       exclude 'left'.
--     * create_branch is fully redefined per Area 2 (ministry-level).
--
-- AUDIT CONSTRAINT (verified live before edit):
--   audit_log_action_check holds 46 actions live (spot-checked via
--   pg_get_constraintdef). This migration adds exactly 4 →  50 total:
--     'branch_left', 'branch_name_edited', 'branch_leader_removed',
--     'branch_deleted'. The constraint is append-only (prevent_audit_log_
--     mutation trigger); the full 50-action list is re-stated below so the
--     drop/re-add is atomic within this transaction.
--
-- SECURITY: every function LANGUAGE plpgsql, SECURITY DEFINER, SET
-- search_path = '', REVOKE FROM PUBLIC, anon + GRANT TO authenticated.
-- Caller gate unchanged: auth.uid() → public.users, is_active=true AND
-- verification_status='verified'.
--
-- Anchored by KAN-69.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. Schema: consent_status gains 'left' + left_at column
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.branch_members
  ADD COLUMN IF NOT EXISTS left_at timestamptz NULL;

ALTER TABLE public.branch_members
  DROP CONSTRAINT IF EXISTS branch_members_consent_status_check;
ALTER TABLE public.branch_members
  ADD CONSTRAINT branch_members_consent_status_check
  CHECK (consent_status IN ('invited', 'joined', 'declined', 'left'));

-- ════════════════════════════════════════════════════════════════════
-- 2. audit_log_action_check: 46 → 50 (append-only; full list re-stated)
--    New: branch_left, branch_name_edited, branch_leader_removed,
--         branch_deleted
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'read_region', 'read_heartcry', 'verify_church', 'reject_church',
    'flag_cleared', 'flag_escalated', 'flag_read', 'pii_scrubbed',
    'deactivate_church', 'deactivate_user', 'announcement_deleted',
    'team_member_added', 'team_member_removed', 'rag_overridden',
    'rag_override_removed', 'reinstate_church', 'super_admin_granted',
    'super_admin_revoked', 'admin_session_refreshed', 'admin_password_reset',
    'admin_step_up_reauth', 'heartcry_responded', 'flag_queue_opened',
    'underground_oversight_opened', 'announcement_created',
    'pastoral_signal_seen', 'pastoral_signal_dispositioned',
    'pastoral_context_expanded', 'pastoral_digest_emitted',
    'church_details_updated', 'admin_aal2_elevation',
    'admin_mfa_factor_reset', 'underground_aal2_gate',
    'heartcry_aal2_gate', 'admin_password_reset_sent',
    'prayer_request_withdrawn', 'heartcry_feed_consent_retracted',
    'church_location_updated',
    -- KAN-214 branch lifecycle
    'branch_created', 'branch_invite_responded', 'branch_member_removed',
    'branch_activated',
    -- KAN-213 / KAN-217 leader + comment lifecycle
    'verify_leader', 'reject_leader', 'edit_pending', 'welcome_dm_sent',
    'replant_team_reply_sent', 'comment_posted',
    -- KAN-65 heartcry feed
    'heartcry_feed_approved',
    -- KAN-69 branch member features (46 → 50)
    'branch_left',
    'branch_name_edited',
    'branch_leader_removed',
    'branch_deleted'
  ));

-- ════════════════════════════════════════════════════════════════════
-- 3. get_branch_members — exclude 'left' members from the sheet
--    (rebased on live def; only the WHERE clause changes)
-- ════════════════════════════════════════════════════════════════════
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

  -- Caller must be a CURRENT member (not 'left') to read the sheet.
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND consent_status <> 'left'
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

-- ════════════════════════════════════════════════════════════════════
-- 4. get_branch_list — member_count excludes 'left'
--    (rebased on LIVE def: preserves last_read_at unread_count logic)
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

-- ════════════════════════════════════════════════════════════════════
-- 5. create_branch — ministry-level invitations + co-host auto-add
--    SIGNATURE CHANGE: p_invited_user_ids → p_invited_ministry_ids.
--    Parameter rename requires DROP before CREATE (PostgreSQL does not
--    allow CREATE OR REPLACE to change param names on same signature).
--
--    Cap   : 6 invited ministries + 1 host ministry = 7 total.
--    Host  : caller's ministry. ALL other verified active leaders of the
--            host ministry are auto-added as co-hosts (is_host=true,
--            joined). ON CONFLICT DO NOTHING guards the caller's own row.
--    Invite: every verified active leader of each invited ministry is
--            added (is_host=false, invited).
--    Guards: self_invite (host ministry in invite list), branch_cap_
--            exceeded (>6 ministries), unverified_invitee (an invited
--            ministry with ZERO verified active leaders → ghost ministry).
--    Zero-invitee path: branch born active (solo host ministry).
-- ════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.create_branch(text, uuid[]);

CREATE FUNCTION public.create_branch(
  p_name                 text,
  p_invited_ministry_ids uuid[]
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
  v_ministry_count     int;
  v_ministry_id        uuid;
  v_co_leader          uuid;
  v_invitee            uuid;
  v_pending_count      int;
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
    -- surface as not_authorized (don't leak schema state).
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_ministry_count := COALESCE(array_length(p_invited_ministry_ids, 1), 0);

  -- Cap: host ministry occupies 1 of 7 slots; invited ministries max 6.
  IF v_ministry_count > 6 THEN
    RAISE EXCEPTION 'branch_cap_exceeded';
  END IF;

  -- Self-invite guard: caller's own ministry cannot be in the invite list.
  IF v_caller_church_id = ANY (p_invited_ministry_ids) THEN
    RAISE EXCEPTION 'self_invite';
  END IF;

  -- Every invited ministry must have AT LEAST ONE verified active leader,
  -- otherwise it would add zero invitees → a ghost ministry in the branch.
  FOR v_ministry_id IN
    SELECT unnest(COALESCE(p_invited_ministry_ids, ARRAY[]::uuid[]))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE church_id = v_ministry_id
        AND is_active = true
        AND verification_status = 'verified'
    ) THEN
      RAISE EXCEPTION 'unverified_invitee';
    END IF;
  END LOOP;

  -- Create branch (CHECK on name length+non-empty enforces validation).
  INSERT INTO public.branches (name, status, created_by)
  VALUES (trim(p_name), 'forming', v_caller_id)
  RETURNING id INTO v_branch_id;

  -- Host row — the caller, joined at insert time.
  INSERT INTO public.branch_members (
    branch_id, user_id, ministry_id,
    is_host, consent_status, consented_at
  ) VALUES (
    v_branch_id, v_caller_id, v_caller_church_id,
    true, 'joined', now()
  );

  -- Co-host auto-add: every OTHER verified active leader of the host
  -- ministry joins as a co-host immediately (no invitation cycle — they
  -- share the host ministry's covenant). ON CONFLICT guards the caller.
  FOR v_co_leader IN
    SELECT id FROM public.users
    WHERE church_id = v_caller_church_id
      AND id <> v_caller_id
      AND is_active = true
      AND verification_status = 'verified'
  LOOP
    INSERT INTO public.branch_members (
      branch_id, user_id, ministry_id,
      is_host, consent_status, consented_at
    ) VALUES (
      v_branch_id, v_co_leader, v_caller_church_id,
      true, 'joined', now()
    )
    ON CONFLICT (branch_id, user_id) DO NOTHING;
  END LOOP;

  -- Ministry-level invitations: add every verified active leader of each
  -- invited ministry as a pending invitee.
  FOREACH v_ministry_id IN ARRAY COALESCE(p_invited_ministry_ids, ARRAY[]::uuid[]) LOOP
    FOR v_invitee IN
      SELECT id FROM public.users
      WHERE church_id = v_ministry_id
        AND is_active = true
        AND verification_status = 'verified'
    LOOP
      INSERT INTO public.branch_members (
        branch_id, user_id, ministry_id,
        is_host, consent_status
      ) VALUES (
        v_branch_id, v_invitee, v_ministry_id,
        false, 'invited'
      )
      ON CONFLICT (branch_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Activation gate: branch is active once nobody is still 'invited'.
  -- Zero-invitee path lands here too (no invited rows ever created).
  SELECT COUNT(*) INTO v_pending_count
  FROM public.branch_members
  WHERE branch_id = v_branch_id
    AND consent_status = 'invited';

  IF v_pending_count = 0 THEN
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
      'branch_id',              v_branch_id,
      'invitee_ministry_count', v_ministry_count
    )
  );

  RETURN v_branch_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_branch(text, uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_branch(text, uuid[]) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 6. respond_to_branch_invite — activation gate fix (invited-only)
--    REBASED ON LIVE (20260608000001): the KAN-69 fail-open system-
--    message INSERT block is PRESERVED verbatim. Only the activation
--    pending-count predicate changes from `<> 'joined'` to `= 'invited'`.
-- ════════════════════════════════════════════════════════════════════
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

  -- ─── KAN-69: system message on join (fail-open) ──────────────────
  -- Post "<ministry> joined this branch." into the thread. Wrapped so
  -- any failure here NEVER rolls back the consent UPDATE above.
  IF p_response = 'joined' THEN
    DECLARE
      v_system_user_id constant uuid := '028be745-8014-4314-a7cf-36b0a4d52b46';
      v_ministry_name  text;
    BEGIN
      SELECT c.name
        INTO v_ministry_name
      FROM public.branch_members bm
      JOIN public.churches c ON c.id = bm.ministry_id
      WHERE bm.branch_id = p_branch_id
        AND bm.user_id   = v_caller_id;

      INSERT INTO public.messages (sender_id, branch_id, content)
      VALUES (
        v_system_user_id,
        p_branch_id,
        COALESCE(v_ministry_name, 'A ministry') || ' joined this branch.'
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  -- ─────────────────────────────────────────────────────────────────

  -- Activation gate: only triggers on 'joined' (a decline can't unlock a
  -- branch). Pending = leaders still 'invited'; declined/left never block.
  IF p_response = 'joined' THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND consent_status = 'invited';
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

-- ════════════════════════════════════════════════════════════════════
-- 7. remove_ministry_from_branch — activation gate fix (invited-only)
--    (rebased on live def; only the v_pending predicate changes)
-- ════════════════════════════════════════════════════════════════════
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

  -- Recompute activation gate. Pending = leaders still 'invited'.
  SELECT COUNT(*) INTO v_remaining
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND consent_status <> 'left';
  SELECT COUNT(*) INTO v_pending
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND consent_status = 'invited';

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

-- ════════════════════════════════════════════════════════════════════
-- 8. leave_branch — non-host voluntary leave (SOFT)
--    Soft-delete preserves the audit chain. A host cannot leave their own
--    branch (they must delete it via delete_branch instead).
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.leave_branch(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id      uuid;
  v_is_host        boolean;
  v_consent_status text;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT is_host, consent_status
    INTO v_is_host, v_consent_status
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  IF v_consent_status IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF v_is_host THEN
    RAISE EXCEPTION 'host_cannot_leave';
  END IF;
  IF v_consent_status = 'left' THEN
    RAISE EXCEPTION 'already_left';
  END IF;

  UPDATE public.branch_members
  SET consent_status = 'left',
      left_at        = now()
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_left', v_caller_id, 'user',
    jsonb_build_object('branch_id', p_branch_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_branch(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.leave_branch(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 9. edit_branch_name — host renames the branch
--    The branches.name CHECK (1..48 chars, non-empty) enforces validation.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.edit_branch_name(
  p_branch_id uuid,
  p_name      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_exists    boolean;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id)
    INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'branch_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND is_host   = true
  ) THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  -- branches_name_check enforces 1..48 chars + non-empty after trim.
  UPDATE public.branches
  SET name = trim(p_name)
  WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_name_edited', v_caller_id, 'user',
    jsonb_build_object('branch_id', p_branch_id, 'new_name', trim(p_name))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.edit_branch_name(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.edit_branch_name(uuid, text) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 10. remove_branch_leader — host hard-removes ONE leader (admin act)
--     Hard DELETE (not soft 'left'): this is a host-initiated admin
--     removal, not a voluntary leave. The audit_log entry is the record.
--     Re-checks activation (invited-only pending) after removal.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.remove_branch_leader(
  p_branch_id uuid,
  p_user_id   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id     uuid;
  v_target_host   boolean;
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

  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  -- Target must have a branch_members row. is_host on the target blocks
  -- individual co-host removal (a co-host shares the host covenant).
  SELECT is_host INTO v_target_host
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND user_id   = p_user_id;
  IF v_target_host IS NULL THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;
  IF v_target_host THEN
    RAISE EXCEPTION 'cannot_remove_host';
  END IF;

  DELETE FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND user_id   = p_user_id;
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;
  IF v_removed_count = 0 THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  -- Re-check activation gate. Pending = leaders still 'invited'.
  SELECT COUNT(*) INTO v_remaining
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND consent_status <> 'left';
  SELECT COUNT(*) INTO v_pending
  FROM public.branch_members
  WHERE branch_id = p_branch_id
    AND consent_status = 'invited';

  IF v_remaining > 0 AND v_pending = 0 THEN
    UPDATE public.branches SET status = 'active'
    WHERE id = p_branch_id AND status = 'forming';
    -- Only emit branch_activated if this removal actually flipped status.
    IF FOUND THEN
      INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES (
        'branch_activated', v_caller_id, 'user',
        jsonb_build_object('branch_id', p_branch_id, 'cause', 'leader_removed')
      );
    END IF;
  END IF;

  SELECT status INTO v_new_status FROM public.branches WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_leader_removed', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',       p_branch_id,
      'removed_user_id', p_user_id
    )
  );

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_branch_leader(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_branch_leader(uuid, uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 11. delete_branch — host soft-deletes the branch (status='cancelled')
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_branch(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_status    text;
BEGIN
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT status INTO v_status
  FROM public.branches WHERE id = p_branch_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'branch_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND is_host   = true
  ) THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'already_cancelled';
  END IF;

  UPDATE public.branches SET status = 'cancelled' WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_deleted', v_caller_id, 'user',
    jsonb_build_object('branch_id', p_branch_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_branch(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_branch(uuid) TO authenticated;

COMMIT;
