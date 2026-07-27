-- KAN-338 / kan338_0007 — ATN self-attribution preview (content open item #10)
--
-- The compose screen previewed the byline with a client-side users/churches
-- read + JS composition, degrading to "A Pastor from your region" because
-- the client cannot safely derive a macro-region (UG churches have NULL
-- location by CHECK; region_admin_only is admin-scoped). FE lane F5: the
-- preview promised a shape publish then diverged from.
--
-- my_attribution_preview() is a SELF-view (no p_user_id → no enumeration
-- surface) returning the EXACT strings content_submission_publish stamps,
-- composed by the same server helpers (content_named_leader_label +
-- content_role_region_label, both REVOKE'd from authenticated and reached
-- here only because this DEFINER fn runs as owner). Preview == published
-- artifact, byte-for-byte. Closes the last KAN-338 queue item and content
-- open item #10; the client no longer composes any identity string.
--
-- APPLIED LIVE 2026-07-26 via execute_sql. Verified: SECURITY DEFINER +
-- pinned empty search_path, anon cannot execute, authenticated can, and
-- byline parity with the publish helpers for a surface leader (name +
-- church + role_region) and an underground leader (can_show_name=false,
-- blank sublabel, macro-region-only role_region). Not in supabase_migrations
-- by this wave's batch convention.

BEGIN;

CREATE OR REPLACE FUNCTION public.my_attribution_preview()
RETURNS TABLE (
  show_name_label    text,
  show_name_sublabel text,
  role_region_label  text,
  is_underground     boolean,
  can_show_name      boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    n.label,
    n.sublabel,
    public.content_role_region_label(u.id),
    (c.type = 'underground'),
    (COALESCE(c.type::text, '') <> 'underground' AND NOT COALESCE(u.anonymous, false))
  FROM public.users u
  LEFT JOIN public.churches c ON c.id = u.church_id
  LEFT JOIN LATERAL public.content_named_leader_label(u.id) n ON true
  WHERE u.auth_id = auth.uid() AND u.is_active = true;
$$;

REVOKE ALL     ON FUNCTION public.my_attribution_preview() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_attribution_preview() TO authenticated;

COMMIT;
