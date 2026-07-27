-- KAN-338 identity-masking regression pins
--
-- Panel-ordered (SEC + DBA lanes, 2026-07-25): the register that keeps the
-- identity wave from silently regressing. Every RAISE EXCEPTION below is a
-- regression — do NOT "fix" a pin by loosening it; fix the thing it caught.
--
-- Run: paste into the Supabase SQL editor (or execute_sql) after ANY
-- migration touching users / churches / comments / announcements or any
-- identity RPC. Green run ends with the "all pins pass" NOTICE.
--
-- Two pin classes:
--   ENFORCED  — asserts shipped state; raises on violation.
--   DEFERRED  — pre-written for KAN-340/KAN-341 (Founder-gated ⛔ pre-launch,
--               pen-test window). Emits a NOTICE today; flip the marked
--               RAISE NOTICE to RAISE EXCEPTION the day that ticket ships.
--
-- Verified green live 2026-07-27.

DO $pins$
DECLARE
  v_txt text;
  v_n   int;
BEGIN

-- ── users / churches RLS posture ─────────────────────────────────────

-- PIN 1 (ENFORCED): users SELECT is exactly self + super_admin. The whole
-- identity architecture assumes users is fail-closed to cross-tier readers.
SELECT count(*) INTO v_n FROM pg_policies
 WHERE schemaname='public' AND tablename='users' AND cmd IN ('SELECT','ALL');
IF v_n <> 2 THEN
  RAISE EXCEPTION 'PIN 1: users SELECT policy count = % (expected 2)', v_n;
END IF;

IF EXISTS (
  SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='users' AND cmd IN ('SELECT','ALL')
     AND qual NOT ILIKE '%auth.uid()%' AND qual NOT ILIKE '%super_admin%'
) THEN
  RAISE EXCEPTION 'PIN 2: a users SELECT policy is neither self- nor super_admin-scoped';
END IF;

-- PIN 3 (ENFORCED): the RESTRICTIVE underground gate on churches survives.
IF NOT EXISTS (
  SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='churches'
     AND policyname='churches_underground_restrict'
     AND permissive='RESTRICTIVE' AND qual ILIKE '%underground%'
) THEN
  RAISE EXCEPTION 'PIN 3: churches_underground_restrict missing, made permissive, or predicate changed';
END IF;

-- ── column-level exposure (kan338_0005) ──────────────────────────────

-- PIN 4 (ENFORCED): the precise-location + admin-region leaves are NOT
-- client-readable. `city` is deliberately NOT in this list: surface
-- churches display their city throughout the app (branch naming, church
-- profile, directory), and underground rows carry NO city at all — see
-- PIN 4c, which is the invariant that actually protects them. Revoking
-- city would break surface display and buy nothing.
FOR v_txt IN SELECT unnest(ARRAY['region_admin_only','lat','lng'])
LOOP
  IF has_column_privilege('authenticated','public.churches',v_txt,'SELECT') THEN
    RAISE EXCEPTION 'PIN 4: authenticated can SELECT churches.%', v_txt;
  END IF;
  IF has_column_privilege('anon','public.churches',v_txt,'SELECT') THEN
    RAISE EXCEPTION 'PIN 4b: anon can SELECT churches.%', v_txt;
  END IF;
END LOOP;

-- PIN 4c (ENFORCED): the underground location invariant — the CHECK that
-- makes `city` safe to expose. Underground churches carry NO city, lat, or
-- lng, enforced by the database, not by a projection. Locked ruling:
-- underground never exposes location, ever.
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
   WHERE conrelid='public.churches'::regclass AND conname='underground_no_location'
) THEN
  RAISE EXCEPTION 'PIN 4c: the underground_no_location CHECK is gone — city/lat/lng are no longer forced NULL for underground';
END IF;

SELECT count(*) INTO v_n FROM public.churches
 WHERE type='underground' AND (city IS NOT NULL OR lat IS NOT NULL OR lng IS NOT NULL);
IF v_n > 0 THEN
  RAISE EXCEPTION 'PIN 4d: % underground church(es) carry location data', v_n;
END IF;

-- PIN 5 (ENFORCED): comments is RPC-only for clients. get_comments is the
-- contract; a direct table read would hand out author_id per row.
IF has_table_privilege('authenticated','public.comments','SELECT')
   OR has_table_privilege('anon','public.comments','SELECT') THEN
  RAISE EXCEPTION 'PIN 5: a client role holds direct SELECT on public.comments';
END IF;

-- PIN 6 (DEFERRED — KAN-341): announcements.author_id is still client-
-- readable. The REVOKE is gated behind the admin endpoint rework, Founder-
-- ruled ⛔ pre-launch / pen-test window. Exposure today is a stable
-- pseudonymous UUID, NOT a name: every submission-published card carries
-- the system Team user (see PIN 12), so no leader PK rides these rows.
-- FLIP THIS TO `RAISE EXCEPTION` WHEN KAN-341 SHIPS.
IF has_column_privilege('authenticated','public.announcements','author_id','SELECT') THEN
  RAISE NOTICE 'PIN 6 (deferred, KAN-341): announcements.author_id is still client-readable — expected until that ticket ships';
END IF;

-- ── SECURITY DEFINER hygiene ─────────────────────────────────────────

-- PIN 7 (ENFORCED): every identity RPC is DEFINER with a pinned empty
-- search_path (no schema-resolution hijack).
FOR v_txt IN
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('get_comments','post_comment','search_leaders',
                       'content_submission_publish','content_submission_create',
                       'content_role_region_label','content_named_leader_label',
                       'role_display_label','my_attribution_preview',
                       'recompose_frozen_bylines','macro_region_label')
     AND ((p.prosecdef = false AND p.provolatile <> 'i')
          OR p.proconfig IS NULL
          OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path=%')
LOOP
  RAISE EXCEPTION 'PIN 7: % is not (SECURITY DEFINER | IMMUTABLE) with a pinned empty search_path', v_txt;
END LOOP;

-- PIN 8 (ENFORCED): anon executes no identity RPC.
FOR v_txt IN
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('get_comments','post_comment','search_leaders',
                       'content_submission_publish','content_submission_create',
                       'content_role_region_label','content_named_leader_label',
                       'recompose_frozen_bylines','my_attribution_preview')
     AND has_function_privilege('anon', p.oid, 'EXECUTE')
LOOP
  RAISE EXCEPTION 'PIN 8: anon holds EXECUTE on %', v_txt;
END LOOP;

-- PIN 9 (ENFORCED): the byline composers + the retraction ratchet stay
-- internal. A client that could call them directly would have an identity
-- oracle keyed on user id — the shape the panel REJECTED.
FOR v_txt IN
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('content_role_region_label','content_named_leader_label',
                       'recompose_frozen_bylines')
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
LOOP
  RAISE EXCEPTION 'PIN 9: authenticated holds EXECUTE on internal helper %', v_txt;
END LOOP;

-- ── get_comments v3 contract (kan338_0006) ───────────────────────────

-- PIN 10 (ENFORCED): the drift pin. Guards every defect the panel found.
SELECT pg_get_functiondef('public.get_comments(uuid)'::regprocedure) INTO v_txt;
IF v_txt ~* 'auth_id\s*=\s*c\.author_id' THEN
  RAISE EXCEPTION 'PIN 10a: get_comments regressed to the auth_id join (the 2026-06-11 defect)';
END IF;
IF v_txt !~* 'not_authorized' THEN
  RAISE EXCEPTION 'PIN 10b: get_comments lost its caller gate (P0-A)';
END IF;
IF v_txt !~* 'announcement_not_open' THEN
  RAISE EXCEPTION 'PIN 10c: get_comments lost its announcement-open gate (P0-A)';
END IF;
IF v_txt !~* 'author_anon_at_write' OR v_txt !~* 'church_hidden_at_write' THEN
  RAISE EXCEPTION 'PIN 10d: get_comments no longer applies the two-axis write-time floor (ratchet broken)';
END IF;
IF v_txt ~* '\mau\.full_name\M' THEN
  RAISE EXCEPTION 'PIN 10e: get_comments regressed to legacy raw full_name';
END IF;

-- PIN 11 (ENFORCED): the consent axes exist and fail closed. Defaults are
-- what protect any writer that bypasses post_comment.
FOR v_txt IN SELECT unnest(ARRAY['author_anon_at_write','church_hidden_at_write'])
LOOP
  IF NOT EXISTS (
    SELECT 1
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = 'public.comments'::regclass
       AND a.attname  = v_txt
       AND a.attnotnull
       AND pg_get_expr(d.adbin, d.adrelid) = 'true'
  ) THEN
    RAISE EXCEPTION 'PIN 11: comments.% is missing, nullable, or no longer defaults true (fail-open)', v_txt;
  END IF;
END LOOP;

-- ── data invariants ──────────────────────────────────────────────────

-- PIN 12 (ENFORCED): no underground leader is the author_id of a leader-
-- typed card. SEC F1 — UG words publish under the Team seal.
SELECT count(*) INTO v_n
  FROM public.announcements a
  JOIN public.users u    ON u.id = a.author_id
  JOIN public.churches c ON c.id = u.church_id
 WHERE a.author_type='leader' AND c.type='underground';
IF v_n > 0 THEN
  RAISE EXCEPTION 'PIN 12: % underground author(s) on author_type=leader (SEC F1 breach)', v_n;
END IF;

-- PIN 13 (ENFORCED): no underground member is un-anonymised (kan338_0001).
SELECT count(*) INTO v_n
  FROM public.users u JOIN public.churches c ON c.id = u.church_id
 WHERE c.type='underground' AND COALESCE(u.anonymous,false)=false
   AND u.soft_deleted_at IS NULL;
IF v_n > 0 THEN
  RAISE EXCEPTION 'PIN 13: % underground member(s) are un-anonymised', v_n;
END IF;

-- PIN 14 (ENFORCED): the UG anonymity guards are live.
SELECT count(*) INTO v_n FROM pg_trigger
 WHERE tgrelid='public.users'::regclass AND NOT tgisinternal
   AND tgname IN ('trg_guard_users_anonymity_axis','trg_users_force_ug_anonymity');
IF v_n <> 2 THEN
  RAISE EXCEPTION 'PIN 14: UG anonymity guard triggers missing (found %, expected 2)', v_n;
END IF;

-- PIN 15 (ENFORCED): the retraction ratchet is wired on both axes.
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.users'::regclass
                AND NOT tgisinternal AND tgname='trg_recompose_on_user_identity_change')
   OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.churches'::regclass
                   AND NOT tgisinternal AND tgname='trg_recompose_on_church_ug_transition') THEN
  RAISE EXCEPTION 'PIN 15: a byline-recompose trigger is missing (feed retraction broken)';
END IF;

-- PIN 16 (ENFORCED): no published leader-voice card carries an empty byline
-- (the show_name-publishes-masked defect).
SELECT count(*) INTO v_n FROM public.announcements
 WHERE author_type='leader' AND is_active
   AND published_at IS NOT NULL AND published_at <= now()
   AND COALESCE(btrim(source_label),'') = '';
IF v_n > 0 THEN
  RAISE EXCEPTION 'PIN 16: % leader card(s) published with no frozen byline', v_n;
END IF;

RAISE NOTICE 'KAN-338 identity pins: all ENFORCED pins pass.';
END $pins$;
