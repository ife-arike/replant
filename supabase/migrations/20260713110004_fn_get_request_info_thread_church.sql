-- Flow-gaps gap-3 (2026-07-13) — surface-church request-info thread
-- reader (admin dashboard).
--
-- Twin of fn_get_request_info_thread (UG) reading the SURFACE store
-- (audit_log 'request_info_sent' / 'request_info_reply'). Actor model per
-- Panel A: invoked via SERVICE ROLE from get-request-info-thread-church.js
-- (verifyAnyAdmin-gated) — no in-body assert is possible for surface
-- admins (no public.users flag; auth.uid() NULL under service role), so
-- EXECUTE is REVOKEd from authenticated/anon (SEC BLOCKER 1: an
-- authenticated-executable reader would let any leader read other
-- churches' verification Q&A).

CREATE OR REPLACE FUNCTION public.fn_get_request_info_thread_church(p_church_id uuid)
RETURNS TABLE(audit_id uuid, action text, accessed_at timestamp with time zone, actor_name text, message text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    al.id AS audit_id,
    al.action,
    al.accessed_at,
    COALESCE(u.full_name, 'The Replant team') AS actor_name,
    COALESCE(al.meta->>'question_text', al.meta->>'reply_text') AS message,
    (al.action = 'request_info_sent') AS is_admin
  FROM public.audit_log al
  LEFT JOIN public.users u ON u.id = al.accessed_by
  WHERE al.church_id = p_church_id
    AND al.action IN ('request_info_sent', 'request_info_reply')
  ORDER BY al.accessed_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_get_request_info_thread_church(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_get_request_info_thread_church(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_get_request_info_thread_church(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_request_info_thread_church(uuid) TO service_role;
