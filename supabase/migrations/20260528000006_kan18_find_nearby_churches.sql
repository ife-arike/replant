-- KAN-18 — find_nearby_churches SECURITY DEFINER RPC.
--
-- Backs the get-nearby-churches edge function. Centralises the PostGIS
-- distance query against churches_public so the edge function can
-- focus on auth-gate, masking, and rate-limit. supabase-js cannot
-- issue raw SQL from an edge function — adminClient.rpc() is the
-- supported path; that requires a server-side function.
--
-- Schema notes (verified live 2026-05-28):
--   - public.users has `anonymous boolean` (not `anonymous_mode`),
--     `full_name text` (not first_name/last_name), `auth_id uuid`.
--   - Per-leader first_name = split_part(full_name, ' ', 1).
--     last_name = everything after the first whitespace (NULLIF on
--     empty so single-token names report NULL).
--   - churches_public.type / rag_status / verification_status are enum
--     types; cast to text for the JSON payload.
--   - churches_public already excludes underground (KAN-211) and
--     filters is_active = true. find_nearby_churches keeps the same
--     posture and ADDS verification_status = 'verified' since the FE
--     only surfaces verified churches on the local map.
--
-- Hardened pattern (matches get_church_profile / get_prayer_wall):
--   SECURITY DEFINER + SET search_path = pg_catalog, public, extensions
--   (extensions schema is required so PostGIS functions resolve under
--   an empty user search_path posture).
--   REVOKE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated.

CREATE OR REPLACE FUNCTION public.find_nearby_churches(
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
