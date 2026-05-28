-- KAN-20 — add the network ID (RPL-XXXXX) to get_church_profile.
--
-- Additive only: a new `network_id` key in the returned JSON, sourced from
-- public.churches.church_code (assigned on verification; format RPL-00001).
-- Emitted as `network_id` to match the already-wired FE pill (KAN-20
-- ChurchProfileBottomSheet, commit 6f81261) — zero FE change.
--
-- RPC-only (no churches_public change), same pattern as the leaders
-- amendment. church_code is a public network identifier (not contact PII),
-- so it is returned unconditionally, not behind show_contact_on_profile.
-- No exposure of any new sensitive field → no SEC re-stamp (additive).
-- CREATE OR REPLACE: signature unchanged, so no overload risk.
CREATE OR REPLACE FUNCTION public.get_church_profile(p_church_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_church        record;
  v_leaders       json;
  v_rag_label     text;
  v_address       text;
  v_contact_email text;
  v_church_code   text;
  v_result        json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    id, name, type, rag_status, city, country, state_declaration,
    needs, resources, has_emergency_plan, open_to_collaboration,
    website_url, primary_language, denomination_affiliation,
    congregation_size_range, show_contact_on_profile,
    created_at, verification_status
  INTO v_church
  FROM churches_public
  WHERE id = p_church_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Network ID (RPL-XXXXX) — public identifier, read from base, always emitted.
  SELECT church_code INTO v_church_code
  FROM public.churches
  WHERE id = p_church_id;

  v_rag_label := CASE v_church.rag_status
    WHEN 'green' THEN 'Freely Operating'
    WHEN 'amber' THEN 'Operating with Limitations'
    WHEN 'red'   THEN 'Not Operating Freely'
    ELSE              'Verification in progress'
  END;

  IF v_church.verification_status = 'pending' THEN
    v_leaders := '[]'::json;
  ELSE
    SELECT json_agg(
      json_build_object(
        'name', CASE
          WHEN u.anonymous = true THEN NULL
          WHEN u.display_name_preference = 'full_name' THEN u.full_name
          ELSE split_part(u.full_name, ' ', 1)
        END,
        'role', u.role::text,
        'anonymous', u.anonymous
      )
    )
    INTO v_leaders
    FROM public.users u
    WHERE u.church_id = p_church_id
      AND u.is_active = true
      AND u.verification_status = 'verified';

    v_leaders := COALESCE(v_leaders, '[]'::json);
  END IF;

  v_result := json_build_object(
    'id',                       v_church.id,
    'network_id',               v_church_code,
    'name',                     v_church.name,
    'type',                     v_church.type,
    'rag_status',               v_church.rag_status,
    'rag_label',                v_rag_label,
    'city',                     v_church.city,
    'country',                  v_church.country,
    'state_declaration',        v_church.state_declaration,
    'needs',                    v_church.needs,
    'resources',                v_church.resources,
    'has_emergency_plan',       v_church.has_emergency_plan,
    'open_to_collaboration',    v_church.open_to_collaboration,
    'website_url',              v_church.website_url,
    'primary_language',         v_church.primary_language,
    'denomination_affiliation', v_church.denomination_affiliation,
    'congregation_size_range',  v_church.congregation_size_range,
    'show_contact_on_profile',  v_church.show_contact_on_profile,
    'member_since',             v_church.created_at,
    'leaders',                  v_leaders
  );

  IF v_church.show_contact_on_profile THEN
    SELECT contact_email, address
    INTO v_contact_email, v_address
    FROM public.churches
    WHERE id = p_church_id;

    v_result := (v_result::jsonb || jsonb_build_object(
      'contact_email', v_contact_email,
      'address',       v_address
    ))::json;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_church_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_church_profile(uuid) TO authenticated;
