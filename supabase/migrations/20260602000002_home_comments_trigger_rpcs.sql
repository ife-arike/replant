-- Home tab comments layer — Migration 3 of 3: trigger + audit action + RPCs
--
-- Conventions (every function in this file), matching KAN-214:
--   LANGUAGE plpgsql · SECURITY DEFINER · SET search_path = ''
--   REVOKE EXECUTE FROM PUBLIC, anon · GRANT EXECUTE TO authenticated
--   Caller gate: auth.uid() -> public.users on auth_id, is_active=true,
--   verification_status='verified'. Failure raises 'not_authorized'.
--
-- Masking covenant: post_comment derives is_masked / masked_region from the
-- caller's church type (underground => masked). The client supplies neither and
-- cannot override the rule — there is no client INSERT path to public.comments.
-- get_comments never returns author_id (D-56 / D-64) and returns null name/church
-- for masked rows, only the coarse macro-region label.
--
-- audit_log_action_check: 47 -> 48 (adds 'comment_posted'). The full live
-- action list was read from pg_get_constraintdef before this migration; the
-- whole set is rebuilt below so the constraint never opens a violation window.

BEGIN;

-- ─── 1. audit_log_action_check: 47 -> 48 ──────────────────────────
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
    -- KAN-214
    'branch_created', 'branch_invite_responded',
    'branch_member_removed', 'branch_activated',
    -- KAN-213 / Welcome-DM family
    'verify_leader', 'reject_leader', 'edit_pending',
    'welcome_dm_sent', 'replant_team_reply_sent',
    -- Home tab comments layer (47 -> 48)
    'comment_posted'
  ));

-- ─── 2. comment-count trigger ─────────────────────────────────────
-- AFTER INSERT on public.comments: bump the denormalised count on the parent
-- announcement. SECURITY DEFINER so it can write announcements regardless of
-- the inserting context (post_comment already runs as definer, but keeping the
-- trigger definer is defence-in-depth and keeps the count authoritative).
CREATE OR REPLACE FUNCTION public.tg_after_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.announcements
  SET comment_count = comment_count + 1
  WHERE id = NEW.announcement_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_comment_insert
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_after_comment_insert();

-- ─── 3. post_comment ──────────────────────────────────────────────
-- Inputs: announcement id, body (1..500 — also CHECK-enforced on the table).
-- Returns: the inserted comment row.
-- Errors:
--   'not_authorized'        -> caller not verified/active
--   'announcement_not_open' -> announcement not posted (is_active + published)
-- Effects:
--   Derive is_masked / masked_region from caller's church type (underground =>
--     masked, region = humanised macro_region label, else NULL).
--   INSERT public.comments (trigger bumps announcements.comment_count).
--   Audit 'comment_posted' (accessed_by=auth.uid(), church_id from caller,
--     triggered_by='user').
CREATE OR REPLACE FUNCTION public.post_comment(
  p_announcement_id uuid,
  p_body            text
)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_pk          uuid;
  v_church_id        uuid;
  v_church_type      public.church_type;
  v_macro_region     public.macro_region;
  v_is_masked        boolean := false;
  v_masked_region    text    := NULL;
  v_row              public.comments;
BEGIN
  -- Caller gate. Join on auth_id (codebase pattern); capture the app-PK + church.
  SELECT u.id, u.church_id
    INTO v_user_pk, v_church_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_user_pk IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Announcement must be posted.
  IF NOT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.is_active = true
      AND a.published_at <= now()
  ) THEN
    RAISE EXCEPTION 'announcement_not_open';
  END IF;

  -- Determine masking from the caller's church type. A verified leader with no
  -- church_id cannot be confirmed non-underground; mask defensively (fail safe
  -- toward protection, never toward exposure).
  IF v_church_id IS NULL THEN
    v_is_masked     := true;
    v_masked_region := NULL;  -- no region to disclose; identity fully withheld
  ELSE
    SELECT c.type, c.region_admin_only
      INTO v_church_type, v_macro_region
    FROM public.churches c
    WHERE c.id = v_church_id;

    IF v_church_type = 'underground' THEN
      v_is_masked := true;
      -- Coarse macro-region label only — no city, country, church, or name.
      v_masked_region := CASE v_macro_region
        WHEN 'north_america'               THEN 'North America'
        WHEN 'latin_america_caribbean'     THEN 'Latin America & Caribbean'
        WHEN 'western_europe'              THEN 'Western Europe'
        WHEN 'eastern_europe_central_asia' THEN 'Eastern Europe & Central Asia'
        WHEN 'middle_east_north_africa'    THEN 'Middle East & North Africa'
        WHEN 'sub_saharan_africa'          THEN 'Sub-Saharan Africa'
        WHEN 'south_asia'                  THEN 'South Asia'
        WHEN 'east_southeast_asia'         THEN 'East & Southeast Asia'
        WHEN 'oceania_pacific'             THEN 'Oceania & Pacific'
        ELSE NULL  -- region unknown => withhold entirely rather than guess
      END;
    END IF;
  END IF;

  INSERT INTO public.comments (
    announcement_id, author_id, body, is_masked, masked_region
  ) VALUES (
    p_announcement_id, auth.uid(), p_body, v_is_masked, v_masked_region
  )
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (action, accessed_by, church_id, triggered_by, meta)
  VALUES (
    'comment_posted', auth.uid(), v_church_id, 'user',
    jsonb_build_object('announcement_id', p_announcement_id)
  );

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_comment(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.post_comment(uuid, text) TO authenticated;

-- ─── 4. get_comments ──────────────────────────────────────────────
-- Inputs: announcement id.
-- Returns: comments oldest-first. NEVER returns author_id (D-56 / D-64).
--   Non-masked rows: author full_name + church name.
--   Masked rows: is_masked=true, masked_region label, NULL name + NULL church.
-- Errors:
--   'not_authorized' -> caller not verified/active.
--
-- The masked branch resolves name/church to NULL at the SQL level — the join to
-- users/churches is gated on (NOT is_masked) so a masked author's real identity
-- is never even read into the result, let alone returned.
CREATE OR REPLACE FUNCTION public.get_comments(p_announcement_id uuid)
RETURNS TABLE (
  id            uuid,
  body          text,
  created_at    timestamptz,
  is_masked     boolean,
  masked_region text,
  author_name   text,
  church_name   text
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
    CASE WHEN c.is_masked THEN NULL ELSE au.full_name END AS author_name,
    CASE WHEN c.is_masked THEN NULL ELSE ac.name      END AS church_name
  FROM public.comments c
  -- Identity joins only fire for non-masked rows; a masked author's name/church
  -- is never read.
  LEFT JOIN public.users    au ON au.auth_id = c.author_id AND c.is_masked = false
  LEFT JOIN public.churches ac ON ac.id      = au.church_id AND c.is_masked = false
  WHERE c.announcement_id = p_announcement_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_comments(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_comments(uuid) TO authenticated;

COMMIT;
