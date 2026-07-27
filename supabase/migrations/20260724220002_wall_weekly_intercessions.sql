-- ─────────────────────────────────────────────────────────────────────
-- Prayer Wall rebuild — trailing-7-day intercession count.
-- NOT YET APPLIED — ships in feat/prayer-wall-new; apply with the FE.
--
-- Founder 2026-07-24: the design's "Interceding now" live-presence
-- count cannot be computed honestly without presence infrastructure,
-- so the slot reads INTERCESSIONS THIS WEEK instead — a truthful count
-- from data we already write.
--
-- Semantics (documented so the label stays honest):
--   COUNT(*) of prayer_request_prayed_by rows created in the trailing
--   7 days. stand_in_the_gap is a toggle — releasing deletes the row —
--   so this counts intercessions taken up this week AND still standing.
--   The FE renders "—" until this function exists, and 0 only when the
--   server says 0. Network-wide aggregate; exposes no identities.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_wall_weekly_intercessions()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COUNT(*)::integer
  FROM public.prayer_request_prayed_by pb
  WHERE pb.created_at >= now() - interval '7 days';
$$;

REVOKE ALL ON FUNCTION public.get_wall_weekly_intercessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wall_weekly_intercessions() TO authenticated;
