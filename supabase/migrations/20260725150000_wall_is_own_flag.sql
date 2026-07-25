-- ─────────────────────────────────────────────────────────────────────
-- Prayer Wall — is_own flag on get_prayer_wall.
--
-- Founder ruling 2026-07-25: self-intercede stays blocked (Ezek 22:30 —
-- standing in the gap is on another's behalf; the count must mean
-- OTHERS). The FE therefore needs to know which rows are the viewer's
-- own so it can swap the Intercede button for the quiet
-- "YOUR CHURCH'S REQUEST" state instead of offering a tap the server
-- will always decline (self_interaction_blocked).
--
-- is_own is AUTHOR-level — pr.user_id vs the caller's public.users.id —
-- mirroring stand_in_the_gap's guard exactly. The author id itself
-- still never ships to the client (SEC Obs D posture); only the
-- boolean does. Computed with the same caller-resolution pattern as
-- i_prayed. Appended as the LAST column; everything before it is
-- byte-for-byte the 20260724220000 version.
--
-- Signature (args) is unchanged, but the return type grows a column —
-- Postgres requires DROP + CREATE for that. Applied via
-- `supabase db query` (migration-history drift — see PR #112 notes);
-- guards below keep a future history replay safe.
-- ─────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_prayer_wall(integer, boolean, text[], text);

CREATE OR REPLACE FUNCTION public.get_prayer_wall(
  page_offset       integer DEFAULT 0,
  filter_urgent     boolean DEFAULT NULL::boolean,
  filter_categories text[]  DEFAULT NULL::text[],
  p_sort            text    DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, church_name text, church_type church_type, country text, category text, prayer_text text, urgency boolean, created_at timestamp with time zone, church_id uuid, leader_display_name text, leader_role text, prayed_count integer, i_prayed boolean, rag_status text, is_own boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    pr.id,
    CASE WHEN c.type = 'underground' THEN 'Underground Church' ELSE c.name END,
    c.type,
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.country END,
    pr.category,
    pr.content,
    pr.urgent,
    pr.created_at,
    CASE WHEN c.type = 'underground' THEN NULL ELSE pr.church_id END,
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin' THEN u.full_name
      WHEN pr.anonymous = true THEN NULL
      ELSE public.resolve_display_name(
        u.first_name, u.middle_name, u.last_name,
        u.honorific, u.role::text,
        u.display_name_preference, u.last_name_first
      )
    END,
    CASE WHEN c.type = 'underground' OR pr.anonymous = true THEN NULL ELSE u.role::text END,
    pr.prayed_count,
    EXISTS (
      SELECT 1 FROM public.prayer_request_prayed_by pb
      WHERE pb.prayer_request_id = pr.id
        AND pb.leader_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    ),
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.rag_status::text END,
    pr.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  FROM public.prayer_requests pr
  INNER JOIN public.churches c ON c.id = pr.church_id
  INNER JOIN public.users    u ON u.id = pr.user_id
  WHERE pr.is_active = true
    AND pr.status = 'open'
    AND c.is_active = true
    AND c.verification_status = 'verified'
    AND (filter_urgent IS NULL OR pr.urgent = filter_urgent)
    AND (filter_categories IS NULL OR pr.category = ANY(filter_categories))
  ORDER BY
    -- 'urgent' + legacy NULL float urgent rows first; 'newest'/'most' do not.
    CASE WHEN p_sort IS NULL OR p_sort = 'urgent' THEN pr.urgent ELSE FALSE END DESC,
    CASE WHEN p_sort = 'most' THEN pr.prayed_count ELSE NULL END DESC NULLS LAST,
    pr.created_at DESC
  LIMIT 20 OFFSET page_offset;
$function$;

REVOKE ALL ON FUNCTION public.get_prayer_wall(integer, boolean, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_prayer_wall(integer, boolean, text[], text) TO authenticated;
