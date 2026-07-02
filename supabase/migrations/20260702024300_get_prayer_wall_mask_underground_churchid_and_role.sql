-- P0-4 root cause (pre-UAT audit 2026-07-01): get_prayer_wall masked the UG church NAME but returned
-- the real church_id UUID + unmasked leader_role — the harvest seed into get_open_prayers. Null
-- church_id for UG rows and null leader_role whenever the author is masked (underground OR anonymous).
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702024300).
CREATE OR REPLACE FUNCTION public.get_prayer_wall(page_offset integer DEFAULT 0, filter_urgent boolean DEFAULT NULL::boolean, filter_categories text[] DEFAULT NULL::text[])
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
  ORDER BY pr.urgent DESC, pr.created_at DESC
  LIMIT 20 OFFSET page_offset;
$function$;
