-- KAN-21 — add rag_status to get_prayer_wall.
--
-- The CD pull-up intercession card (PullUpInterCard) renders a coloured
-- dot in the loc row per the church's RAG status. Until now the FE has
-- had no source for that signal: PrayerRow does not carry rag_status
-- and the pull-up renders the dot neutral with a TODO(DBA) flag. This
-- migration adds the single missing column to the existing
-- get_prayer_wall return shape.
--
-- Dispatch DBA-2 ("add viewer_has_prayed boolean using prayer_stands")
-- is INTENTIONALLY skipped. Live verification (2026-05-28) shows:
--   * The `prayer_stands` table does NOT exist in this schema.
--   * The function already returns `i_prayed boolean` via an EXISTS
--     subquery on public.prayer_request_prayed_by with identical
--     semantics: leader_id IN (SELECT id FROM users WHERE auth_id =
--     auth.uid()).
--   * PrayerRow already has i_prayed: boolean.
-- Adding a `viewer_has_prayed` column would duplicate i_prayed under a
-- new name. The FE will read row.i_prayed instead.
--
-- RETURNS TABLE shape changes → DROP FUNCTION first (Postgres rejects
-- a CREATE OR REPLACE that changes the return-type signature).
--
-- Underground masking is preserved per the existing pattern: rag_status
-- is NULL for underground rows, alongside church_name='Underground
-- Church' + country=NULL. So a leader viewing the wall never sees an
-- underground church's RAG signal even when their request appears.

DROP FUNCTION IF EXISTS public.get_prayer_wall(integer, boolean, text[]);

CREATE OR REPLACE FUNCTION public.get_prayer_wall(
  page_offset       integer  DEFAULT 0,
  filter_urgent     boolean  DEFAULT NULL,
  filter_categories text[]   DEFAULT NULL
)
RETURNS TABLE (
  id                   uuid,
  church_name          text,
  church_type          public.church_type,
  country              text,
  category             text,
  prayer_text          text,
  urgency              boolean,
  created_at           timestamp with time zone,
  church_id            uuid,
  leader_display_name  text,
  leader_role          text,
  prayed_count         integer,
  i_prayed             boolean,
  rag_status           text  -- NEW (KAN-21 CD pull-up dot color)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pr.id,
    CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END,
    c.type,
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.country END,
    pr.category,
    pr.content,
    pr.urgent,
    pr.created_at,
    pr.church_id,
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin' THEN u.full_name
      WHEN pr.anonymous = true                                       THEN NULL
      WHEN u.display_name_preference = 'full_name'                  THEN u.full_name
      ELSE split_part(u.full_name, ' ', 1)
    END,
    u.role::text,
    pr.prayed_count,
    EXISTS (
      SELECT 1 FROM public.prayer_request_prayed_by pb
      WHERE pb.prayer_request_id = pr.id
        AND pb.leader_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ),
    -- NEW — underground rows mask to NULL alongside name + country.
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.rag_status::text END
  FROM public.prayer_requests pr
  INNER JOIN public.churches c ON c.id = pr.church_id
  INNER JOIN public.users    u ON u.id = pr.user_id
  WHERE
    pr.is_active              = true
    AND pr.status             = 'open'
    AND c.is_active           = true
    AND c.verification_status = 'verified'
    AND (filter_urgent IS NULL OR pr.urgent = filter_urgent)
    AND (filter_categories IS NULL OR pr.category = ANY(filter_categories))
  ORDER BY pr.urgent DESC, pr.created_at DESC
  LIMIT 20
  OFFSET page_offset;
$$;
