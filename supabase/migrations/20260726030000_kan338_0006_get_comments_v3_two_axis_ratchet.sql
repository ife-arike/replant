-- KAN-338 / kan338_0006 — get_comments v3 + two-axis consent record
--
-- The Monotone Protection Ratchet lands on the comment surface. Authored
-- against LIVE definitions (post_comment + get_comments pulled 2026-07-26;
-- the repo 0621 files were confirmed drifted and are NOT the source).
--
--   1. comments.author_anon_at_write + church_hidden_at_write (fail-closed
--      defaults) — the two consent axes the priority-ordered mask_reason
--      enum could not record (anon+underground collapsed to 'anon').
--   2. Backfill from the priority order; the 'anon' rows are the single
--      documented RECONSTRUCTION (current UG-safe state, hidden when
--      unresolvable). Verified live: 4 anon_at_write / 6 church_hidden of 49.
--   3. post_comment v3 writes both axes at the moment of speech.
--   4. get_comments v3 (DROP + CREATE in one transaction):
--      - CALLER GATE restored (P0-A): active + not soft-deleted + not
--        rejected. Verification NOT required (2026-06-03 ruling: pending
--        leaders read threads).
--      - ANNOUNCEMENT-OPEN GATE restored (P0-A): is_active + published.
--      - Name ratchet: disclose iff permitted at write AND now.
--      - Church ratchet with the single authorized release valve: live
--        UG + brave (two-admin ceremony) discloses; leaving UG does not.
--      - Composed display columns for the FE cutover (display_name,
--        name_held, church_label, church_held, is_underground) + the legacy
--        9-column passthrough with ratchet-corrected values so the in-field
--        app keeps working. author_name now arrives COMPOSED via
--        resolve_display_name (honorific/role-prefixed) instead of raw
--        full_name.
--
-- APPLIED LIVE 2026-07-26 via execute_sql; verified: gates + grants +
-- backfill distribution + zero ratchet breaches across all 49 live rows
-- (no anon row named, no write-floor violation, every held UG row carries
-- a region label, no over-masking of clean rows).
-- Not in supabase_migrations by this wave's batch convention.

BEGIN;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS author_anon_at_write   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS church_hidden_at_write boolean NOT NULL DEFAULT true;

UPDATE public.comments c SET
  author_anon_at_write = CASE c.mask_reason
      WHEN 'none'        THEN false
      WHEN 'underground' THEN false
      ELSE true END,
  church_hidden_at_write = CASE c.mask_reason
      WHEN 'none'        THEN false
      WHEN 'underground' THEN true
      WHEN 'no_church'   THEN true
      ELSE COALESCE((SELECT ch.type = 'underground' AND NOT COALESCE(ch.show_church_name, false)
                       FROM public.users au LEFT JOIN public.churches ch ON ch.id = au.church_id
                      WHERE au.id = c.author_id), true) END;

CREATE OR REPLACE FUNCTION public.post_comment(p_announcement_id uuid, p_body text)
 RETURNS comments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_pk          uuid;
  v_church_id        uuid;
  v_is_anon          boolean := false;
  v_church_type      public.church_type;
  v_show_church      boolean := false;
  v_macro_region     public.macro_region;
  v_mask_reason      public.mask_reason := 'none';
  v_masked_region    text    := NULL;
  v_anon_at_write    boolean := true;
  v_church_hidden    boolean := true;
  v_row              public.comments;
BEGIN
  SELECT u.id, u.church_id, COALESCE(u.anonymous, false)
    INTO v_user_pk, v_church_id, v_is_anon
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_user_pk IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.is_active = true
      AND a.published_at <= now()
  ) THEN
    RAISE EXCEPTION 'announcement_not_open';
  END IF;

  IF v_is_anon THEN
    v_mask_reason := 'anon';
  ELSIF v_church_id IS NULL THEN
    v_mask_reason := 'no_church';
  ELSE
    SELECT c.type, COALESCE(c.show_church_name, false), c.region_admin_only
      INTO v_church_type, v_show_church, v_macro_region
    FROM public.churches c
    WHERE c.id = v_church_id;

    IF v_church_type = 'underground' THEN
      v_mask_reason := 'underground';
      v_masked_region := public.macro_region_label(v_macro_region);
    END IF;
  END IF;

  v_anon_at_write := v_is_anon OR v_church_id IS NULL;
  v_church_hidden := (v_church_id IS NULL)
                  OR (v_church_type = 'underground' AND NOT v_show_church);

  INSERT INTO public.comments (
    announcement_id, author_id, body, mask_reason, masked_region,
    author_anon_at_write, church_hidden_at_write
  ) VALUES (
    p_announcement_id, v_user_pk, p_body, v_mask_reason, v_masked_region,
    v_anon_at_write, v_church_hidden
  )
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (action, accessed_by, church_id, triggered_by, meta)
  VALUES (
    'comment_posted', auth.uid(), v_church_id, 'user',
    jsonb_build_object('announcement_id', p_announcement_id)
  );

  RETURN v_row;
END;
$function$;

DROP FUNCTION public.get_comments(uuid);

CREATE FUNCTION public.get_comments(p_announcement_id uuid)
 RETURNS TABLE(
   id uuid, body text, created_at timestamp with time zone,
   is_masked boolean, mask_reason text, masked_region text,
   author_name text, church_name text, role text,
   display_name text, name_held boolean, church_label text,
   church_held boolean, is_underground boolean)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.auth_id = auth.uid()
       AND u.is_active = true
       AND u.soft_deleted_at IS NULL
       AND u.verification_status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.announcements a
     WHERE a.id = p_announcement_id
       AND a.is_active = true
       AND a.published_at IS NOT NULL
       AND a.published_at <= now()
  ) THEN
    RAISE EXCEPTION 'announcement_not_open';
  END IF;

  RETURN QUERY
  WITH resolved AS (
    SELECT
      c.id AS c_id, c.body AS c_body, c.created_at AS c_created,
      c.is_masked AS c_is_masked, c.mask_reason AS c_reason,
      c.masked_region AS c_region_stored,
      au.role::text AS r_role,
      ac.name AS ch_name,
      (c.author_anon_at_write
        OR COALESCE(au.anonymous, false)
        OR au.id IS NULL)                                   AS r_name_held,
      (au.id IS NULL OR ac.id IS NULL
        OR (ac.type = 'underground' AND NOT COALESCE(ac.show_church_name, false))
        OR (COALESCE(ac.type::text, '') <> 'underground' AND c.church_hidden_at_write)) AS r_church_held,
      (COALESCE(ac.type::text, '') = 'underground'
        OR c.mask_reason = 'underground')                   AS r_is_ug,
      public.macro_region_label(ac.region_admin_only)       AS r_region_live,
      NULLIF(btrim(public.resolve_display_name(
        au.first_name, au.middle_name, au.last_name, au.honorific,
        au.role::text, au.display_name_preference, au.last_name_first)), '') AS r_composed
    FROM public.comments c
    LEFT JOIN public.users    au ON au.id = c.author_id
    LEFT JOIN public.churches ac ON ac.id = au.church_id
    WHERE c.announcement_id = p_announcement_id
  )
  SELECT
    r.c_id, r.c_body, r.c_created,
    r.c_is_masked, r.c_reason::text,
    CASE WHEN r.r_church_held AND r.r_is_ug
         THEN COALESCE(r.r_region_live, r.c_region_stored)
         ELSE r.c_region_stored END,
    CASE WHEN r.r_name_held THEN NULL ELSE r.r_composed END,
    CASE WHEN r.r_church_held THEN NULL ELSE r.ch_name END,
    CASE WHEN r.c_reason = 'no_church' THEN NULL ELSE r.r_role END,
    CASE
      WHEN NOT r.r_name_held AND r.r_composed IS NOT NULL THEN r.r_composed
      WHEN r.r_role IS NOT NULL AND r.c_reason <> 'no_church'
        THEN 'A fellow ' || lower(public.role_display_label(r.r_role))
      ELSE 'A leader in the network'
    END,
    r.r_name_held,
    CASE
      WHEN NOT r.r_church_held THEN COALESCE(r.ch_name, '')
      WHEN r.r_is_ug THEN COALESCE(r.r_region_live, r.c_region_stored, '')
      ELSE ''
    END,
    r.r_church_held,
    r.r_is_ug
  FROM resolved r
  ORDER BY r.c_created ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_comments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_comments(uuid) TO authenticated;

COMMIT;
