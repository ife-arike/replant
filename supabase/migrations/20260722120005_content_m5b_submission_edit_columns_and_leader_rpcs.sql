-- KAN-328 / KAN-337 — Content section, M5b: submission edit columns +
-- leader-consent RPCs (addendum to M5 `content_submissions`).
--
-- SEQUENCING: applies AFTER M5 (20260722120003 content_submissions) and
-- M6 (20260722120004 audit_log content actions), which land on the
-- content-section branch (commit e948c7d). Files-only; not applied here.
--
-- WHY THIS FILE EXISTS
--   M5 (20260722120003) shipped the intake table but WITHOUT the two
--   columns the approve-with-edits flow needs to stage an admin's proposed
--   text for the leader's confirmation:
--       proposed_title, proposed_body
--   KAN-328's approve-submission-with-edits writes those two, flips status
--   to 'edits_pending_leader', and the leader confirms via the
--   content_submission_publish RPC below. Those two columns are the named
--   deliverable of this addendum.
--
--   Two further columns are added because the source rules + leader-consent
--   loop cannot be honoured without them (flagged for DBA/SEC review):
--       attribution          — 'show_name' | 'role_region'. The approve
--                              publish path and the publish RPC both need a
--                              DURABLE home for the leader's attribution
--                              choice. Underground authors are FORCED to
--                              role_region at publish regardless of this
--                              value (defence in depth); this column only
--                              carries the SURFACE leader's show_name vs
--                              role_region election. Without it, every
--                              non-UG leader silently defaults to show_name
--                              and the design's "Role and region" option is
--                              unreachable.
--       leader_change_request — the note a leader attaches when they ask the
--                              team for further changes (content_submission_
--                              request_changes). Surfaced on the admin ATN
--                              sub-tab; the Team thread carries NONE of this
--                              workflow (ruling_team_thread_is_support).
--
-- FUNCTIONS
--   content_role_region_label(uuid)      — SINGLE SOURCE OF TRUTH for the
--                                          frozen "A {Role} from {Region}"
--                                          byline. Mirrors search_leaders'
--                                          macro_region_label() mask so the
--                                          UG byline is identical whether the
--                                          admin approve endpoint (via
--                                          service-role rpc) or the leader
--                                          publish RPC produces it. NEVER
--                                          resolves a name or city.
--   content_submission_create(...)       — leader intake RPC. "Never direct
--                                          client insert" + 2-open cap per
--                                          leader, enforced server-side. This
--                                          is the KAN-337 mobile attach point
--                                          and the home of the cap-2 rule;
--                                          included here so the leader-consent
--                                          RPC surface is coherent (create <->
--                                          publish/withdraw). Admin-side
--                                          intake is submit-on-behalf.js,
--                                          which enforces the same cap.
--   content_submission_publish(uuid)     — leader confirms the proposed edits;
--                                          publishes into announcements with
--                                          the frozen source rules, sets the
--                                          published_announcement_id backlink,
--                                          status -> 'approved_with_edits'.
--   content_submission_request_changes   — leader asks for more changes; note
--                                          stored, status -> 'pending'.
--   content_submission_withdraw(uuid)    — leader removes their submission,
--                                          freeing a slot.
--
-- Security posture: every RPC is SECURITY DEFINER, SET search_path = '',
-- asserts caller = submitter via auth.uid(), and validates state. RLS on
-- content_submissions stays deny-all (M5); these DEFINER RPCs are the only
-- leader-facing write path. EXECUTE granted to `authenticated` only. The
-- byline helper is REVOKEd from anon/authenticated (service-role + internal
-- DEFINER callers only).
--
-- Live schema verified read-only before authoring (2026-07-22):
-- public.macro_region_label(macro_region) and public.churches.region_admin_only
-- (type macro_region) confirmed live (search_leaders 20260608000001).
-- public.users.role is enum public.user_role.
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
ALTER TABLE public.content_submissions
  ADD COLUMN proposed_title        text,
  ADD COLUMN proposed_body         text,
  ADD COLUMN attribution           text,
  ADD COLUMN leader_change_request text;

ALTER TABLE public.content_submissions
  ADD CONSTRAINT content_submissions_attribution_check
    CHECK (attribution IS NULL OR attribution = ANY (ARRAY['show_name','role_region']));

COMMENT ON COLUMN public.content_submissions.proposed_title IS
  'KAN-328 approve-with-edits: admin-proposed replacement title, awaiting leader confirmation. NULL keeps the original title.';
COMMENT ON COLUMN public.content_submissions.proposed_body IS
  'KAN-328 approve-with-edits: admin-proposed replacement body, awaiting leader confirmation via content_submission_publish.';
COMMENT ON COLUMN public.content_submissions.attribution IS
  'Leader attribution election: show_name | role_region. Underground authors are FORCED role_region at publish regardless of this value.';
COMMENT ON COLUMN public.content_submissions.leader_change_request IS
  'KAN-337: leader''s note back to the team when requesting further changes. Surfaced on the admin ATN sub-tab, never in the Team thread.';

-- ---------------------------------------------------------------------
-- 2. Frozen byline resolver — single source of truth for "A {Role} from {Region}"
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_role_region_label(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'A ' ||
    CASE u.role::text
      WHEN 'pastor'           THEN 'Pastor'
      WHEN 'senior_pastor'    THEN 'Senior Pastor'
      WHEN 'associate_pastor' THEN 'Associate Pastor'
      WHEN 'bishop'           THEN 'Bishop'
      WHEN 'elder'            THEN 'Elder'
      WHEN 'deacon'           THEN 'Deacon'
      WHEN 'minister'         THEN 'Minister'
      WHEN 'evangelist'       THEN 'Evangelist'
      WHEN 'missionary'       THEN 'Missionary'
      WHEN 'worship_leader'   THEN 'Worship Leader'
      WHEN 'youth_pastor'     THEN 'Youth Pastor'
      WHEN 'ministry_leader'  THEN 'Ministry Leader'
      ELSE initcap(replace(u.role::text, '_', ' '))
    END
    || COALESCE(' from ' || public.macro_region_label(c.region_admin_only), '')
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.id = p_user_id;
$$;

COMMENT ON FUNCTION public.content_role_region_label(uuid) IS
  'Frozen role+region byline for content publishing (e.g. "A Pastor from South Asia"). Mirrors search_leaders'' macro_region_label mask. NEVER returns a name, church, or city. Region omitted when region_admin_only is NULL.';

-- ---------------------------------------------------------------------
-- 3. Leader intake RPC — never direct client insert; 2-open cap per leader
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_submission_create(
  p_type        text,
  p_title       text,
  p_body        text,
  p_attribution text DEFAULT 'show_name'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_is_ug     boolean;
  v_open      integer;
  v_attr      text;
  v_id        uuid;
BEGIN
  SELECT id INTO v_caller_id
    FROM public.users
   WHERE auth_id = auth.uid() AND is_active = true
   LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_type NOT IN ('word_for_today', 'testimony') THEN
    RAISE EXCEPTION 'type_not_allowed';   -- family_word is coming-soon; not intakeable
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  IF p_type = 'testimony' AND (p_title IS NULL OR btrim(p_title) = '') THEN
    RAISE EXCEPTION 'title_required_for_testimony';   -- Founder ruling 1
  END IF;

  -- 2-open cap (concurrency, not a rate). Open = pending | edits_pending_leader.
  SELECT count(*) INTO v_open
    FROM public.content_submissions
   WHERE submitter_user_id = v_caller_id
     AND status IN ('pending', 'edits_pending_leader');
  IF v_open >= 2 THEN
    RAISE EXCEPTION 'open_submission_cap_reached';
  END IF;

  -- Underground authors are FORCED to role_region (identity strip at intake).
  SELECT (c.type = 'underground') INTO v_is_ug
    FROM public.users u JOIN public.churches c ON c.id = u.church_id
   WHERE u.id = v_caller_id;
  v_attr := CASE
              WHEN v_is_ug THEN 'role_region'
              WHEN p_attribution IN ('show_name', 'role_region') THEN p_attribution
              ELSE 'show_name'
            END;

  INSERT INTO public.content_submissions
    (source, type, submitter_user_id, title, body, attribution, status)
  VALUES
    ('leader', p_type, v_caller_id, left(btrim(p_title), 100), left(btrim(p_body), 1000), v_attr, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Leader publish RPC — confirm proposed edits, publish into announcements
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_submission_publish(p_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id    uuid;
  v_sub          public.content_submissions%ROWTYPE;
  v_is_ug        boolean;
  v_attr         text;
  v_author_type  text;
  v_author_id    uuid;
  v_source_label text;
  v_card_type    text;
  v_topic        text;
  v_title        text;
  v_body         text;
  v_ann_id       uuid;
BEGIN
  SELECT id INTO v_caller_id
    FROM public.users
   WHERE auth_id = auth.uid() AND is_active = true
   LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_sub FROM public.content_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_sub.submitter_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'not_your_submission';
  END IF;
  IF v_sub.status <> 'edits_pending_leader' THEN
    RAISE EXCEPTION 'not_awaiting_leader_publish';
  END IF;
  IF v_sub.type NOT IN ('word_for_today', 'testimony') THEN
    RAISE EXCEPTION 'type_not_publishable';
  END IF;

  SELECT (c.type = 'underground') INTO v_is_ug
    FROM public.users u JOIN public.churches c ON c.id = u.church_id
   WHERE u.id = v_sub.submitter_user_id;
  v_attr := CASE WHEN v_is_ug THEN 'role_region' ELSE COALESCE(v_sub.attribution, 'show_name') END;

  v_topic := CASE v_sub.type WHEN 'word_for_today' THEN 'word_for_today' ELSE 'testimony' END;
  v_title := COALESCE(
               NULLIF(btrim(COALESCE(v_sub.proposed_title, v_sub.title)), ''),
               CASE v_sub.type WHEN 'word_for_today' THEN 'A word for today' ELSE 'A testimony' END
             );
  v_body  := COALESCE(NULLIF(btrim(COALESCE(v_sub.proposed_body, v_sub.body)), ''), v_sub.body);

  IF v_attr = 'show_name' THEN
    v_author_type  := 'leader';
    v_author_id    := v_sub.submitter_user_id;   -- audit-only; name resolves in-app
    v_source_label := NULL;
    v_card_type    := CASE v_sub.type WHEN 'word_for_today' THEN 'leader_word' ELSE 'standard' END;
  ELSE
    -- role_region (leader-chosen) OR underground (forced): Team seal, frozen byline.
    v_author_type  := 'admin';
    -- announcements.author_id is NOT NULL on live (verified 2026-07-22).
    -- System Replant Team user per the platform SYSTEM_USER_ID convention;
    -- NEVER the leader (SEC F1).
    v_author_id    := '028be745-8014-4314-a7cf-36b0a4d52b46'::uuid;
    v_source_label := public.content_role_region_label(v_sub.submitter_user_id);
    v_card_type    := 'standard';
  END IF;

  INSERT INTO public.announcements
    (title, body, source_label, author_id, author_type, card_type, topic, badge, published_at, is_active)
  VALUES
    (left(v_title, 100), left(v_body, 1000), v_source_label, v_author_id, v_author_type,
     v_card_type, v_topic, 'none', now(), true)
  RETURNING id INTO v_ann_id;

  UPDATE public.content_submissions
     SET status                    = 'approved_with_edits',
         published_announcement_id = v_ann_id,
         reviewed_at               = COALESCE(reviewed_at, now()),
         updated_at                = now()
   WHERE id = p_submission_id;

  RETURN v_ann_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Leader request-changes RPC — bounce back to the team with a note
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_submission_request_changes(
  p_submission_id uuid,
  p_note          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_status    text;
  v_owner     uuid;
BEGIN
  SELECT id INTO v_caller_id
    FROM public.users WHERE auth_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT status, submitter_user_id INTO v_status, v_owner
    FROM public.content_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_owner IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'not_your_submission'; END IF;
  IF v_status <> 'edits_pending_leader' THEN RAISE EXCEPTION 'not_awaiting_leader_review'; END IF;

  UPDATE public.content_submissions
     SET status                = 'pending',
         leader_change_request = left(btrim(COALESCE(p_note, '')), 1000),
         updated_at            = now()
   WHERE id = p_submission_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Leader withdraw RPC — remove the submission, free a slot
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_submission_withdraw(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_status    text;
  v_owner     uuid;
BEGIN
  SELECT id INTO v_caller_id
    FROM public.users WHERE auth_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT status, submitter_user_id INTO v_status, v_owner
    FROM public.content_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_owner IS DISTINCT FROM v_caller_id THEN RAISE EXCEPTION 'not_your_submission'; END IF;
  IF v_status NOT IN ('pending', 'edits_pending_leader', 'declined') THEN
    RAISE EXCEPTION 'cannot_withdraw_in_status';
  END IF;

  DELETE FROM public.content_submissions WHERE id = p_submission_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Grants — leader RPCs to authenticated; byline helper stays internal
-- ---------------------------------------------------------------------
-- List RPC — the leader's own submissions for the My Submissions surface.
-- (Reconciliation add: the mobile lane requires a read path; RLS is deny-all
-- so reads must flow through this SECURITY DEFINER as well.)
CREATE OR REPLACE FUNCTION public.content_submissions_list_mine()
RETURNS TABLE (
  id uuid, type text, title text, body text,
  proposed_title text, proposed_body text, status text,
  decline_reason text, leader_change_request text,
  created_at timestamptz, updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT s.id, s.type, s.title, s.body,
         s.proposed_title, s.proposed_body, s.status,
         s.decline_reason, s.leader_change_request,
         s.created_at, s.updated_at
    FROM public.content_submissions s
    JOIN public.users u ON u.id = s.submitter_user_id
   WHERE u.auth_id = auth.uid()
   ORDER BY s.created_at DESC;
$fn$;

REVOKE ALL ON FUNCTION public.content_role_region_label(uuid)                      FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.content_submission_create(text, text, text, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.content_submission_publish(uuid)                      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.content_submission_request_changes(uuid, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.content_submission_withdraw(uuid)                     FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.content_submissions_list_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_submissions_list_mine() TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_submission_create(text, text, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_submission_publish(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_submission_request_changes(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_submission_withdraw(uuid)                  TO authenticated;

COMMIT;
