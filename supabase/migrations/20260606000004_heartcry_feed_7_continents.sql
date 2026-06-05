-- KAN-32 — 7-continent region split: Americas → North America / South America.

DROP FUNCTION public.get_heartcry_feed(integer, integer, text);

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
  region       text,
  hold_count   bigint,
  viewer_held  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_verified boolean := false;
  v_viewer_id       uuid;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100 (got %)', p_limit
      USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset must be >= 0 (got %)', p_offset
      USING ERRCODE = '22023';
  END IF;

  SELECT u.id, (u.verification_status = 'verified' AND u.is_active = true)
    INTO v_viewer_id, v_caller_verified
  FROM public.users u
  WHERE u.auth_id = auth.uid();

  IF v_caller_verified IS NULL OR v_caller_verified = false THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      h.id,
      h.severity::text       AS severity,
      h.created_at,
      h.feed_content,
      m.continent::text      AS continent,
      CASE
        WHEN m.continent = 'Americas' THEN
          CASE WHEN ch.country IN (
            'Canada','United States','US','USA','U.S.A.','Mexico',
            'Guatemala','Belize','Honduras','El Salvador','Nicaragua',
            'Costa Rica','Panama','Cuba','Jamaica','Haiti',
            'Dominican Republic','Puerto Rico','Trinidad and Tobago',
            'Bahamas','The Bahamas','Barbados','Saint Lucia','Grenada',
            'Saint Vincent and the Grenadines','Antigua and Barbuda',
            'Dominica','Saint Kitts and Nevis','Greenland',
            'Bermuda','Cayman Islands','Turks and Caicos Islands',
            'British Virgin Islands','US Virgin Islands','Anguilla',
            'Montserrat','Guadeloupe','Martinique','Saint Martin',
            'Saint Barthélemy','Sint Maarten','Bonaire',
            'Curacao','Curaçao','Aruba','Saint Pierre and Miquelon'
          ) THEN 'North America'
          ELSE 'South America'
          END
        ELSE m.continent::text
      END AS region
    FROM public.heartcries h
    INNER JOIN public.churches              ch ON ch.id          = h.church_id
    INNER JOIN public.country_continent_map m  ON m.country_name = ch.country
    WHERE h.user_id        IS NOT NULL
      AND h.post_to_feed   = true
      AND h.feed_approved  = true
      AND h.feed_content   IS NOT NULL
  )
  SELECT
    b.id, b.severity, b.created_at, b.feed_content, b.continent, b.region,
    COALESCE((SELECT count(*) FROM public.heartcry_holds hh WHERE hh.heartcry_id = b.id), 0)::bigint AS hold_count,
    EXISTS(SELECT 1 FROM public.heartcry_holds hh WHERE hh.heartcry_id = b.id AND hh.user_id = v_viewer_id) AS viewer_held
  FROM base b
  WHERE p_region IS NULL OR b.region = p_region
  ORDER BY b.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_heartcry_feed(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_heartcry_feed(integer, integer, text) TO authenticated;
