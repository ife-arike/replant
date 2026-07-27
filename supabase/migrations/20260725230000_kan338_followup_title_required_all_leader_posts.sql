-- KAN-338 follow-up — content_submission_create: title required for ALL
-- leader posts (Founder ruling 2026-07-25, PR #85 smoke).
--
-- A titleless word_for_today published under the "A word for today" default
-- title, duplicating the card kicker on the feed. The guard that covered
-- testimonies now covers both types; the error token consolidates to
-- 'title_required' (was 'title_required_for_testimony'). The ATN compose
-- enforces the same client-side (ComposeView titleRequired = true), and the
-- publish-time default remains as a final fallback for legacy rows.
--
-- Full function body = the LIVE definition (pulled 2026-07-25) with only the
-- guard changed. APPLIED LIVE 2026-07-25 via execute_sql; verified
-- (title_required present, testimony-only token gone). Not in
-- supabase_migrations by this wave's batch convention.

BEGIN;

CREATE OR REPLACE FUNCTION public.content_submission_create(p_type text, p_title text, p_body text, p_attribution text DEFAULT 'show_name'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    RAISE EXCEPTION 'type_not_allowed';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  -- KAN-338 follow-up (Founder 2026-07-25): title required for ALL leader
  -- posts. A titleless word_for_today published as the "A word for today"
  -- default, duplicating the card kicker.
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title_required';
  END IF;
  SELECT count(*) INTO v_open
    FROM public.content_submissions
   WHERE submitter_user_id = v_caller_id
     AND status IN ('pending', 'edits_pending_leader');
  IF v_open >= 2 THEN
    RAISE EXCEPTION 'open_submission_cap_reached';
  END IF;
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
$function$;

COMMIT;
