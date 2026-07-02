-- P1 (pre-UAT audit 2026-07-01): find_similar_churches is anon-EXECUTE + SECURITY DEFINER and
-- excluded only 'branch', not 'underground' — a signup existence/contact oracle for UG churches.
-- Exclude underground entirely. Applied to prod via Supabase MCP apply_migration (remote 20260702024153).
CREATE OR REPLACE FUNCTION public.find_similar_churches(p_name text, p_country text, p_city text, p_contact_email text, p_contact_phone text, p_limit integer DEFAULT 3)
 RETURNS TABLE(id uuid, name text, city text, verification_status text, match_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH normalised AS (
    SELECT
      lower(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')) AS query_name_norm,
      lower(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')) AS query_city_norm,
      lower(trim(coalesce(p_contact_email, ''))) AS query_email_norm,
      right(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g'), 10) AS query_phone_norm,
      coalesce(p_country, '') AS country_norm
  )
  SELECT
    c.id,
    c.name,
    c.city,
    c.verification_status::text,
    CASE
      WHEN n.query_email_norm <> '' AND lower(c.contact_email) = n.query_email_norm THEN 'contact_email'
      WHEN n.query_phone_norm <> '' AND right(regexp_replace(coalesce(c.contact_phone, ''), '[^0-9]', '', 'g'), 10) = n.query_phone_norm THEN 'contact_phone'
      ELSE 'name_city'
    END AS match_reason
  FROM public.churches c, normalised n
  WHERE c.country = n.country_norm
    AND c.type <> 'branch'
    AND c.type <> 'underground'   -- pre-UAT audit: no UG existence/contact oracle
    AND (
      (
        n.query_name_norm <> ''
        AND n.query_city_norm <> ''
        AND lower(regexp_replace(coalesce(c.city, ''), '\s+', ' ', 'g')) = n.query_city_norm
        AND (
          lower(regexp_replace(c.name, '\s+', ' ', 'g')) = n.query_name_norm
          OR lower(c.name) ILIKE '%' || n.query_name_norm || '%'
          OR n.query_name_norm ILIKE '%' || lower(c.name) || '%'
        )
      )
      OR (n.query_email_norm <> '' AND lower(c.contact_email) = n.query_email_norm)
      OR (n.query_phone_norm <> '' AND right(regexp_replace(coalesce(c.contact_phone, ''), '[^0-9]', '', 'g'), 10) = n.query_phone_norm)
    )
  ORDER BY
    CASE
      WHEN n.query_email_norm <> '' AND lower(c.contact_email) = n.query_email_norm THEN 0
      WHEN n.query_phone_norm <> '' AND right(regexp_replace(coalesce(c.contact_phone, ''), '[^0-9]', '', 'g'), 10) = n.query_phone_norm THEN 1
      ELSE 2
    END,
    char_length(c.name)
  LIMIT GREATEST(coalesce(p_limit, 3), 1);
$function$;
