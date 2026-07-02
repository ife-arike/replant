-- P0-4 (pre-UAT audit 2026-07-01): get_open_prayers was anon-EXECUTE + SECURITY DEFINER + took a
-- caller-supplied p_church_id and returned resolve_display_name UNCONDITIONALLY (no anonymous mask).
-- Fix (Founder ruling: option a): drop the param, derive the church from auth.uid() (own-church only),
-- add the anonymous mask + super_admin parity, revoke anon EXECUTE. Return columns unchanged.
-- The two mobile callers drop the p_church_id arg in the same change (PrayerWallLanding, MyOpenPrayersView).
-- Applied to prod via Supabase MCP apply_migration (remote version 20260702024556).
DROP FUNCTION IF EXISTS public.get_open_prayers(uuid);

CREATE OR REPLACE FUNCTION public.get_open_prayers()
  RETURNS TABLE(id uuid, category text, prayer_text text, urgency boolean,
                created_at timestamp with time zone, prayed_count integer,
                author_display_name text, author_role text)
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $function$
  SELECT
    pr.id, pr.category, pr.content, pr.urgent, pr.created_at, pr.prayed_count,
    CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin' THEN u.full_name
      WHEN pr.anonymous = true THEN NULL
      ELSE public.resolve_display_name(
        u.first_name, u.middle_name, u.last_name,
        u.honorific, u.role::text,
        u.display_name_preference, u.last_name_first
      )
    END,
    CASE WHEN pr.anonymous = true THEN NULL ELSE u.role::text END
  FROM public.prayer_requests pr
  INNER JOIN public.users u ON u.id = pr.user_id
  WHERE pr.church_id = (
          SELECT church_id FROM public.users
          WHERE auth_id = auth.uid() AND is_active = true AND soft_deleted_at IS NULL
          LIMIT 1
        )
    AND pr.is_active = true
    AND pr.status = 'open'
  ORDER BY pr.urgent DESC, pr.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_open_prayers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_open_prayers() TO authenticated;
