-- KAN-65 Persecuted Tab v2 — region filter on get_heartcry_feed.
--
-- Adds:
--   • p_region text DEFAULT NULL parameter (NULL → all regions).
--   • region text column in RETURNS TABLE, derived server-side via a
--     CASE on the same ch.country column the existing continent join
--     uses. Six regions per Founder taxonomy; everything else → 'Other'.
--   • CTE-based filter: WHERE p_region IS NULL OR region = p_region.
--     Filtering at the DB so the FE never sees rows outside the
--     active region.
--
-- Preserved verbatim (per dispatch "preserve all existing invariants"):
--   • SECURITY DEFINER, STABLE, LANGUAGE plpgsql
--   • SET search_path TO ''  ← live posture (stricter than dispatch-stated
--     pg_catalog,public,extensions; every reference inside the body is
--     already fully schema-qualified, so the empty path holds. Honored
--     as live-DB-as-source-of-truth, same pattern CLAUDE.md anchors for
--     Jira state.)
--   • p_limit / p_offset validation block (1–100 / >=0)
--   • Verified-leader caller gate via auth.uid() → public.users
--   • Underlying SELECT shape: heartcries × churches × country_continent_map
--     INNER JOIN posture; user_id NOT NULL / post_to_feed / feed_approved
--     / feed_content NOT NULL filters.
--   • REVOKE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated.
--
-- Signature changes → DROP + CREATE required; CREATE OR REPLACE would
-- register a new overload alongside the old one.

DROP FUNCTION public.get_heartcry_feed(integer, integer);

CREATE FUNCTION public.get_heartcry_feed(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_region text    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  severity     text,
  created_at   timestamp with time zone,
  feed_content text,
  continent    text,
  region       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_verified boolean := false;
BEGIN
  -- Pagination range validation (per dispatch CHECK semantics)
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100 (got %)', p_limit
      USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset must be >= 0 (got %)', p_offset
      USING ERRCODE = '22023';
  END IF;

  -- Verified-leader gate (caller, not submitter): empty result if not verified+active
  SELECT (verification_status = 'verified' AND is_active = true)
    INTO v_caller_verified
  FROM public.users
  WHERE auth_id = auth.uid();

  IF v_caller_verified IS NULL OR v_caller_verified = false THEN
    RETURN;  -- empty result set
  END IF;

  -- Main feed query with region derived per-row in a CTE so the region
  -- filter and the country-list-driven mapping live in one place. The
  -- existing continent JOIN is preserved verbatim.
  RETURN QUERY
  WITH base AS (
    SELECT
      h.id,
      h.severity::text       AS severity,
      h.created_at,
      h.feed_content,
      m.continent::text      AS continent,
      CASE
        WHEN ch.country IN (
          'Syria','Iraq','Iran','Jordan','Lebanon','Saudi Arabia','Yemen',
          'Oman','United Arab Emirates','Kuwait','Qatar','Bahrain',
          'Turkey','Palestine','Gaza'
        ) THEN 'Middle East'
        WHEN ch.country IN (
          'Afghanistan','Pakistan','Kazakhstan','Uzbekistan','Tajikistan',
          'Turkmenistan','Kyrgyzstan'
        ) THEN 'Central Asia'
        WHEN ch.country IN (
          'Egypt','Libya','Algeria','Tunisia','Morocco','Sudan',
          'Eritrea','Mauritania','Mali','Niger','Chad'
        ) THEN 'North Africa'
        WHEN ch.country IN (
          'China','North Korea','Mongolia','Vietnam','Taiwan',
          'Japan','South Korea'
        ) THEN 'East Asia'
        WHEN ch.country IN (
          'India','Bangladesh','Sri Lanka','Nepal','Bhutan',
          'Maldives','Myanmar'
        ) THEN 'South Asia'
        WHEN ch.country IN (
          'Indonesia','Malaysia','Philippines','Cambodia','Laos',
          'Thailand','Singapore'
        ) THEN 'Southeast Asia'
        ELSE 'Other'
      END AS region
    FROM public.heartcries h
    INNER JOIN public.churches              ch ON ch.id          = h.church_id
    INNER JOIN public.country_continent_map m  ON m.country_name = ch.country
    WHERE h.user_id        IS NOT NULL
      AND h.post_to_feed   = true
      AND h.feed_approved  = true
      AND h.feed_content   IS NOT NULL
  )
  SELECT id, severity, created_at, feed_content, continent, region
  FROM base
  WHERE p_region IS NULL OR region = p_region
  ORDER BY created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_heartcry_feed(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_heartcry_feed(integer, integer, text) TO authenticated;
