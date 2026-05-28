-- KAN-21 — get_churches_global + get_underground_count.
--
-- Two SECURITY DEFINER reads that unblock the CAL globe (FE: KAN-21).
--
-- get_churches_global — { id, lat, lng, rag_status } for every active,
-- non-underground church with non-null coordinates. Reads from
-- public.churches_public so the underground/inactive exclusion is
-- inherited at the view level (watched invariant — never replicate the
-- filter in code where a view regression could mask it).
--
-- get_underground_count — count of active underground churches, surfaced
-- as the "+N hidden" honor chip in the globe UI. Kept as a separate RPC
-- (Option B per KAN-21 c.14802) so the count survives an empty dot set —
-- embedding it on every row (Option A) would have lost the count entirely
-- whenever churches_public ∩ coords is empty (the current UAT state).
--
-- Hardened pattern, identical to get_prayer_wall / get_church_profile:
--   - SECURITY DEFINER
--   - SET search_path = '' (every reference fully schema-qualified;
--     pg_catalog is always implicit, so built-ins still resolve)
--   - auth.uid() guard — unauthenticated callers raise, never return data
--   - REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated
--
-- Output contract (locked): only id + coords + rag_status leave this
-- function. No contact_email, no contact_phone, no address, no name, no
-- leader identity, no church_code — and no underground row, ever (the
-- view exclusion is the boundary; the function does not re-filter).

CREATE OR REPLACE FUNCTION public.get_churches_global()
RETURNS TABLE (
  id         uuid,
  lat        double precision,
  lng        double precision,
  rag_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.lat,
    cp.lng,
    cp.rag_status::text
  FROM public.churches_public cp
  WHERE cp.lat IS NOT NULL
    AND cp.lng IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_churches_global() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_churches_global() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_underground_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COUNT(*)::int
  INTO v_count
  FROM public.churches
  WHERE type = 'underground'
    AND is_active = true;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_underground_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_underground_count() TO authenticated;
