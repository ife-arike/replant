-- KAN-338 / kan338_0003 — frozen-byline completion (queue step: byline)
--
-- Founder rulings 2026-07-25 (KAN-338 c.16476): named leaders must actually
-- render named (the show_name publish branch wrote source_label NULL and the
-- in-app resolver is deleted, so every viewer saw "A leader in the network");
-- and the feed's frozen bylines get their retraction path (Monotone
-- Protection Ratchet: tightening automatic + retroactive).
--
-- Authored against LIVE definitions pulled 2026-07-25 (content_submission_
-- publish, resolve_display_name, audit_log_action_check with 93 tokens).
-- Parts:
--   1. announcements.source_sublabel + DB length CHECKs (live max label = 29).
--   2. role_display_label(text) — THE canonical role→label map (12 values +
--      replant_staff, both fallbacks 'Minister' per the 2026-06-02 ruling).
--   3. content_role_region_label rewrite — canonical labels + A/An grammar.
--   4. content_named_leader_label(uuid) — show_name byline composer wrapping
--      the LIVE resolve_display_name (7-arg signature; known F11 middle-name
--      quirk rides until the platform-wide fix — v3 wave).
--   5. audit_log_action_check 93 → 95 tokens: + announcement_edited (the
--      tracked M6 94th-token open item) + announcement_byline_recomposed.
--   6. recompose_frozen_bylines(uuid) — the retraction path. Targets through
--      content_submissions.published_announcement_id (admin-only linkage)
--      because announcements.author_id is the system user after this
--      migration (correlation-key closure); legacy leader-PK rows are also
--      normalized to the system user on recompose.
--   7. Ratchet triggers: users identity changes + churches UG transitions
--      auto-recompose. UG un-anonymize is already blocked upstream by
--      trg_guard_users_anonymity_axis (kan338_0001), so no loosening can
--      arrive from underground rows.
--   8. content_submission_publish show_name branch fixed: byline + sublabel
--      composed and FROZEN at publish; author_id = system Team user.
--
-- Backfill note: zero live rows need recomposition (the only 2 leader-typed
-- announcements are Team-user seeds with frozen role_region labels).
--
-- APPLIED LIVE 2026-07-25 via execute_sql. Not in supabase_migrations by
-- this wave's batch convention.

BEGIN;

-- 1. Sublabel + caps. Generous 120 deliberately: the byline must never RAISE
--    at publish (DELIVER-ALWAYS); visual truncation is the FE's concern.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS source_sublabel text;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_source_label_len
    CHECK (source_label IS NULL OR char_length(source_label) <= 120),
  ADD CONSTRAINT announcements_source_sublabel_len
    CHECK (source_sublabel IS NULL OR char_length(source_sublabel) <= 120);

COMMENT ON COLUMN public.announcements.source_sublabel IS
  'Frozen secondary byline (church/ministry for show_name publications; empty for sealed). '
  'Composed server-side at publish; recomposed only by recompose_frozen_bylines. '
  'Never resolved client-side.';

-- 2. Canonical role label. 13th live enum value replant_staff falls to the
--    safe generic with the rest; never initcap a raw enum into a byline.
CREATE OR REPLACE FUNCTION public.role_display_label(p_role text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_role
    WHEN 'pastor'          THEN 'Pastor'
    WHEN 'apostle'         THEN 'Apostle'
    WHEN 'prophet'         THEN 'Prophet'
    WHEN 'evangelist'      THEN 'Evangelist'
    WHEN 'teacher'         THEN 'Teacher'
    WHEN 'elder'           THEN 'Elder'
    WHEN 'bishop'          THEN 'Bishop'
    WHEN 'reverend'        THEN 'Reverend'
    WHEN 'intercessor'     THEN 'Intercessor'
    WHEN 'psalmist'        THEN 'Psalmist'
    WHEN 'ministry_leader' THEN 'Minister'   -- Founder ruling 2026-06-02
    WHEN 'other'           THEN 'Minister'   -- Founder ruling 2026-06-02
    WHEN 'replant_staff'   THEN 'Minister'   -- 13th live value; safe generic
    ELSE 'Minister'
  END;
$$;

-- 3. Frozen role+region byline, corrected: canonical labels + A/An grammar.
CREATE OR REPLACE FUNCTION public.content_role_region_label(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT left(
    CASE WHEN public.role_display_label(u.role::text) ~* '^[aeiou]' THEN 'An ' ELSE 'A ' END
    || public.role_display_label(u.role::text)
    || COALESCE(' from ' || public.macro_region_label(c.region_admin_only), ''),
    120)
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.id = p_user_id;
$$;

-- 4. Named-leader byline composer. UG sublabel branch is defensive only:
--    UG submitters are force-routed to role_region at publish.
CREATE OR REPLACE FUNCTION public.content_named_leader_label(p_user_id uuid)
RETURNS TABLE (label text, sublabel text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    left(COALESCE(
      NULLIF(btrim(public.resolve_display_name(
        u.first_name, u.middle_name, u.last_name, u.honorific,
        u.role::text, u.display_name_preference, u.last_name_first)), ''),
      public.role_display_label(u.role::text)), 120),
    left(CASE
      WHEN c.type = 'underground' THEN ''
      ELSE COALESCE(c.name, '')
    END, 120)
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.content_role_region_label(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.content_named_leader_label(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.role_display_label(text) FROM anon;
-- The admin publish twin (content-publish.js) runs as service_role, which
-- holds no implicit grant once PUBLIC is stripped — grant it explicitly.
GRANT EXECUTE ON FUNCTION public.content_named_leader_label(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.content_role_region_label(uuid)  TO service_role;

-- 5. Audit token registry: 93 live tokens + announcement_edited (M6's tracked
--    94th) + announcement_byline_recomposed. Rebuilt from the LIVE constraint.
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'read_region','read_heartcry','verify_church','reject_church','flag_cleared',
    'flag_escalated','flag_read','pii_scrubbed','deactivate_church','deactivate_user',
    'announcement_deleted','team_member_added','team_member_removed','rag_overridden',
    'rag_override_removed','reinstate_church','super_admin_granted','super_admin_revoked',
    'admin_session_refreshed','admin_password_reset','admin_step_up_reauth','heartcry_responded',
    'flag_queue_opened','underground_oversight_opened','announcement_created','pastoral_signal_seen',
    'pastoral_signal_dispositioned','pastoral_context_expanded','pastoral_digest_emitted',
    'church_details_updated','admin_aal2_elevation','admin_mfa_factor_reset','underground_aal2_gate',
    'heartcry_aal2_gate','admin_password_reset_sent','prayer_request_withdrawn',
    'heartcry_feed_consent_retracted','church_location_updated','branch_created',
    'branch_invite_responded','branch_member_removed','branch_activated','verify_leader',
    'reject_leader','edit_pending','welcome_dm_sent','replant_team_reply_sent','comment_posted',
    'heartcry_feed_approved','branch_left','branch_name_edited','branch_leader_removed',
    'branch_deleted','branch_parent_auto_linked','branch_parent_admin_linked',
    'admin_tier_promotion_requested','admin_tier_promotion_approved','admin_tier_promotion_denied',
    'admin_tier_promotion_expired','admin_invite_sent','admin_demote','admin_revoke',
    'account_name_updated','admin_grant_to_existing_user','escalated_case_created',
    'escalated_case_auto_routed','escalated_proposal_proposed','escalated_proposal_approved',
    'escalated_proposal_rejected','escalated_case_closed','escalated_inbox_opened',
    'escalated_case_reach_out_sent','case_escalated_to_manager','account_soft_deleted',
    'account_restored','account_hard_deleted','user_blocked','user_unblocked',
    'content_report_submitted','content_report_rejected','content_report_opened',
    'content_report_cleared','content_report_escalated','content_report_reporter_viewed',
    'request_info_sent','request_info_reply','deactivate_leader','reinstate_leader',
    'verification_window_extended','submission_approved','submission_declined',
    'correction_posted','content_notify_email_sent',
    'announcement_edited','announcement_byline_recomposed'
  ]));

-- 6. Retraction path. Targets via the admin-only submissions linkage (works
--    with author_id = system user); normalizes legacy leader-PK author_ids.
CREATE OR REPLACE FUNCTION public.recompose_frozen_bylines(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_is_ug  boolean;
  v_anon   boolean;
  v_label  text;
  v_sub    text;
  v_n      integer := 0;
BEGIN
  SELECT (c.type = 'underground'), COALESCE(u.anonymous, false)
    INTO v_is_ug, v_anon
    FROM public.users u JOIN public.churches c ON c.id = u.church_id
   WHERE u.id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_is_ug OR v_anon THEN
    -- Safety posture tightened: seal. Name comes OFF published cards.
    v_label := public.content_role_region_label(p_user_id);
    UPDATE public.announcements a
       SET source_label    = v_label,
           source_sublabel = '',
           author_type     = 'admin',
           author_id       = '028be745-8014-4314-a7cf-36b0a4d52b46'::uuid,
           card_type       = 'standard'
     WHERE (a.id IN (SELECT cs.published_announcement_id
                       FROM public.content_submissions cs
                      WHERE cs.submitter_user_id = p_user_id
                        AND cs.published_announcement_id IS NOT NULL)
            OR (a.author_id = p_user_id AND a.author_type = 'leader'));
  ELSE
    -- Surface leader, name permitted now: refresh the frozen byline (their
    -- own election governs their own name; name changes propagate).
    SELECT nl.label, nl.sublabel INTO v_label, v_sub
      FROM public.content_named_leader_label(p_user_id) nl;
    UPDATE public.announcements a
       SET source_label = v_label, source_sublabel = v_sub
     WHERE a.id IN (SELECT cs.published_announcement_id
                      FROM public.content_submissions cs
                     WHERE cs.submitter_user_id = p_user_id
                       AND cs.published_announcement_id IS NOT NULL)
       AND a.author_type = 'leader';
  END IF;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('announcement_byline_recomposed', auth.uid(), 'system',
            jsonb_build_object('user_id', p_user_id, 'rows', v_n,
                               'sealed', (v_is_ug OR v_anon)));
  END IF;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.recompose_frozen_bylines(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompose_frozen_bylines(uuid) TO service_role;

-- 7. Ratchet triggers. Users: any identity-bearing change recomposes (seal on
--    anonymize; refresh on rename/preference change; re-name on a surface
--    leader's own un-anonymize — UG un-anonymize cannot reach here, the
--    kan338_0001 guard blocks it upstream). Churches: UG transitions seal
--    every member's bylines; the brave ceremony refreshes sublabels.
CREATE OR REPLACE FUNCTION public.tg_recompose_on_user_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.recompose_frozen_bylines(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompose_on_user_identity_change ON public.users;
CREATE TRIGGER trg_recompose_on_user_identity_change
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.anonymous IS DISTINCT FROM NEW.anonymous
     OR OLD.first_name IS DISTINCT FROM NEW.first_name
     OR OLD.middle_name IS DISTINCT FROM NEW.middle_name
     OR OLD.last_name IS DISTINCT FROM NEW.last_name
     OR OLD.honorific IS DISTINCT FROM NEW.honorific
     OR OLD.display_name_preference IS DISTINCT FROM NEW.display_name_preference
     OR OLD.last_name_first IS DISTINCT FROM NEW.last_name_first)
  EXECUTE FUNCTION public.tg_recompose_on_user_identity_change();

CREATE OR REPLACE FUNCTION public.tg_recompose_on_church_ug_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid;
BEGIN
  FOR v_uid IN SELECT u.id FROM public.users u WHERE u.church_id = NEW.id LOOP
    PERFORM public.recompose_frozen_bylines(v_uid);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompose_on_church_ug_transition ON public.churches;
CREATE TRIGGER trg_recompose_on_church_ug_transition
  AFTER UPDATE ON public.churches
  FOR EACH ROW
  WHEN ((OLD.type IS DISTINCT FROM NEW.type AND NEW.type = 'underground')
     OR OLD.show_church_name IS DISTINCT FROM NEW.show_church_name)
  EXECUTE FUNCTION public.tg_recompose_on_church_ug_transition();

-- 8. Publish RPC: the show_name branch composes + freezes; author_id is the
--    system Team user on BOTH branches (correlation-key closure, SEC F-7).
--    Body = the LIVE definition with only these changes.
CREATE OR REPLACE FUNCTION public.content_submission_publish(p_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id       uuid;
  v_sub             public.content_submissions%ROWTYPE;
  v_is_ug           boolean;
  v_attr            text;
  v_author_type     text;
  v_author_id       uuid;
  v_source_label    text;
  v_source_sublabel text;
  v_card_type       text;
  v_topic           text;
  v_title           text;
  v_body            text;
  v_ann_id          uuid;
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
    -- KAN-338: byline composed + FROZEN at publish (was NULL, "resolves
    -- in-app" — that resolver is deleted). author_id = system user; the
    -- submitter linkage for retraction lives on content_submissions.
    v_author_type := 'leader';
    v_author_id   := '028be745-8014-4314-a7cf-36b0a4d52b46'::uuid;
    SELECT nl.label, nl.sublabel INTO v_source_label, v_source_sublabel
      FROM public.content_named_leader_label(v_sub.submitter_user_id) nl;
    v_card_type   := CASE v_sub.type WHEN 'word_for_today' THEN 'leader_word' ELSE 'standard' END;
  ELSE
    v_author_type     := 'admin';
    v_author_id       := '028be745-8014-4314-a7cf-36b0a4d52b46'::uuid;
    v_source_label    := public.content_role_region_label(v_sub.submitter_user_id);
    v_source_sublabel := '';
    v_card_type       := 'standard';
  END IF;
  INSERT INTO public.announcements
    (title, body, source_label, source_sublabel, author_id, author_type, card_type, topic, badge, published_at, is_active)
  VALUES
    (left(v_title, 100), left(v_body, 1000), v_source_label, v_source_sublabel, v_author_id, v_author_type,
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
$function$;

COMMIT;
