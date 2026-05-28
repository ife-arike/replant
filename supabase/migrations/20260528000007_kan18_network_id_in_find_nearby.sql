-- KAN-18 — add network_id (church_code) to find_nearby_churches return.
-- DROP + CREATE required: adding a column to RETURNS TABLE under
-- CREATE OR REPLACE registers a new overload rather than replacing the
-- existing one. Drop the old signature explicitly first.
-- church_code is a public network identifier — not PII, no masking needed.
--
-- JOIN target: public.churches.church_code. The churches_public view
-- does not surface church_code (it's a network-id, not a public profile
-- field), so we join the base table by id. Underground exclusion and
-- is_active filtering stay on churches_public per the original posture.

DROP FUNCTION public.find_nearby_churches(double precision, double precision, integer);

CREATE FUNCTION public.find_nearby_churches(
  p_viewer_lng    double precision,
  p_viewer_lat    double precision,
  p_radius_meters integer
)
RETURNS TABLE (
  id                  uuid,
  name                text,
  type                text,
  city                text,
  country             text,
  lat                 double precision,
  lng                 double precision,
  rag_status          text,
  verification_status text,
  distance_km         double precision,
  network_id          text,
  leaders             jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    cp.id,
    cp.name,
    cp.type::text,
    cp.city,
    cp.country,
    cp.lat,
    cp.lng,
    cp.rag_status::text,
    cp.verification_status::text,
    ST_Distance(
      ST_MakePoint(cp.lng, cp.lat)::geography,
      ST_MakePoint(p_viewer_lng, p_viewer_lat)::geography
    ) / 1000 AS distance_km,
    ch.church_code AS network_id,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'role',       u.role::text,
          'first_name', CASE WHEN u.anonymous
                              THEN NULL
                              ELSE split_part(u.full_name, ' ', 1)
                          END,
          'last_name',  CASE WHEN u.anonymous
                              THEN NULL
                              ELSE NULLIF(regexp_replace(u.full_name, '^\S+\s*', ''), '')
                          END,
          'anon',       u.anonymous
        )
        ORDER BY u.created_at ASC
      )
      FROM public.users u
      WHERE u.church_id = cp.id
        AND u.verification_status = 'verified'
        AND u.is_active           = true
    ) AS leaders
  FROM public.churches_public cp
  JOIN public.churches ch ON ch.id = cp.id
  WHERE cp.verification_status = 'verified'
    AND cp.lat IS NOT NULL
    AND cp.lng IS NOT NULL
    AND ST_DWithin(
          ST_MakePoint(cp.lng, cp.lat)::geography,
          ST_MakePoint(p_viewer_lng, p_viewer_lat)::geography,
          p_radius_meters
        )
  ORDER BY distance_km ASC;
$$;

REVOKE ALL ON FUNCTION public.find_nearby_churches(double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_nearby_churches(double precision, double precision, integer) TO authenticated;
