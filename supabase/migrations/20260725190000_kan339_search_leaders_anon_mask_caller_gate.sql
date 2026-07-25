-- KAN-339 — search_leaders: server-side anonymous masking + fail-closed caller gate
--
-- Rescoped after VERIFY-LIVE (KAN-338 c.16477/16478): the live function was
-- already substantially hardened (safe-UG names NULL, UG church rendered as
-- macro-region label, UG excluded from name-matching, self + blocked-identity
-- filtering). Two gaps survived, closed here:
--
--   1. Surface ANONYMOUS leaders' full_name shipped raw; masking lived only
--      in LeaderSearch.tsx (console-opacity violation: FE is deterrent, BE
--      gates are load-bearing). The name CASE gains the anonymous term.
--      FE-invisible: the app renders "A fellow {role}" + AnonGlyph off the
--      `anonymous` flag and never reads full_name for anon rows.
--   2. The caller gate failed OPEN: an unresolvable caller (v_caller_id NULL)
--      skipped both the self-exclusion and the blocked-identity filter. It
--      now raises not_authorized, matching the get_comments v3 gate register.
--
-- Authored against the LIVE pg_get_functiondef (pulled 2026-07-25), NOT the
-- stale repo 20260608 file — the live body carries KAN-305-era hardening the
-- repo lacks. Monotone Protection Ratchet applies (disclose only if permitted
-- at write AND now; search is a live surface, so live state governs).
--
-- Raw anonymous/underground discriminator columns are retained THIS pass
-- (the FE's render contract needs them); the minimal-shape contract change
-- rides the get_comments v3 FE cutover wave.
--
-- APPLIED LIVE 2026-07-25 via execute_sql immediately after authoring
-- (Founder ruling 4, 2026-07-25: KAN-339 sequenced first). Not in
-- supabase_migrations by this wave's batch convention.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_leaders(p_query text)
 RETURNS TABLE(user_id uuid, full_name text, role text, anonymous boolean, church_id uuid, church_name text, underground boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid;
  v_q         text := lower(trim(COALESCE(p_query, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RAISE EXCEPTION 'query_too_short';
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;

  -- Fail closed (KAN-339): a caller we cannot resolve gets nothing, not an
  -- unfiltered directory. Blocks deleted/inactive sessions and guarantees
  -- the self + blocked-identity filters below always bind.
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id                                                              AS user_id,
    CASE
      WHEN c.type = 'underground' AND COALESCE(c.show_church_name, false) = false
        THEN NULL
      -- KAN-339: anonymity masks the name at the source. The FE already
      -- renders "A fellow {role}" off the anonymous flag.
      WHEN COALESCE(u.anonymous, false)
        THEN NULL
      ELSE u.full_name
    END                                                               AS full_name,
    u.role::text                                                      AS role,
    u.anonymous                                                       AS anonymous,
    c.id                                                              AS church_id,
    CASE
      WHEN c.type = 'underground' AND COALESCE(c.show_church_name, false) = true
        THEN c.name
      WHEN c.type = 'underground'
        THEN COALESCE(
               public.macro_region_label(c.region_admin_only),
               'Underground Church'
             )
      ELSE c.name
    END                                                               AS church_name,
    (c.type = 'underground')                                          AS underground
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.verification_status = 'verified'
    AND u.is_active = true
    AND c.is_active = true
    AND u.id <> v_caller_id
    AND NOT public.fn_is_blocked_identity_known(v_caller_id, u.id)
    AND (
      c.church_code ILIKE '%' || p_query || '%'
      OR (c.type <> 'underground' AND lower(u.full_name) LIKE '%' || v_q || '%')
    )
  ORDER BY u.full_name NULLS LAST
  LIMIT 30;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_leaders(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_leaders(text) TO authenticated;

COMMIT;
