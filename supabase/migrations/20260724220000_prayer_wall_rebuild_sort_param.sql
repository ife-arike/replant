-- ─────────────────────────────────────────────────────────────────────
-- Prayer Wall rebuild (design_handoff_prayer_wall_NEW) — p_sort param.
-- NOT YET APPLIED — ships in feat/prayer-wall-new; apply with the FE.
--
-- Adds an optional p_sort to get_prayer_wall:
--   NULL      → legacy order (urgent DESC, created_at DESC) — exactly
--               what every already-shipped client gets today. NULL is
--               the default so old builds see no behaviour change.
--   'newest'  → created_at DESC              (rebuild Feed default)
--   'most'    → prayed_count DESC, newest    ("Most interceding")
--   'urgent'  → urgent DESC, newest          ("Urgent first")
--
-- Postgres note: adding a parameter changes the signature, and CREATE
-- OR REPLACE would create an OVERLOAD — PostgREST named-arg calls
-- {page_offset, filter_urgent, filter_categories} would then match two
-- candidates and fail with an ambiguity error. So: DROP the 3-param
-- function and CREATE the single 4-param one. Legacy named-arg calls
-- still resolve (p_sort takes its default).
--
-- Body is otherwise byte-for-byte the 20260702024300 version (P0-4
-- underground masking posture unchanged — church_id NULL for UG rows,
-- leader_role NULL when masked). The FE calls with p_sort first and
-- falls back to the legacy arg-set if this migration is not deployed.
-- ─────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_prayer_wall(integer, boolean, text[]);

CREATE OR REPLACE FUNCTION public.get_prayer_wall(
  page_offset       integer DEFAULT 0,
  filter_urgent     boolean DEFAULT NULL::boolean,
  filter_categories text[]  DEFAULT NULL::text[],
  p_sort            text    DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, church_name text, church_type church_type, country text, category text, prayer_text text, urgency boolean, created_at timestamp with time zone, church_id uuid, leader_display_name text, leader_role text, prayed_count integer, i_prayed boolean, rag_status text)
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
    CASE WHEN c.type = 'underground' THEN NULL ELSE c.rag_status::text END
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
