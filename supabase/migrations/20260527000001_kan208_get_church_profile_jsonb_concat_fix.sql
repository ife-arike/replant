-- KAN-208 fix — get_church_profile contact-on path used `json || json`,
-- which has no operator (|| is jsonb-only) → ERROR 42883. The
-- show_contact_on_profile=false path never reached it, so the original
-- apply + false-path tests passed; the break only surfaced when the true
-- path was exercised against live data (KAN-208 c.14782).
--
-- Merge through jsonb and cast back. No change to exposure semantics:
-- still exactly contact_email + address, gated on show_contact_on_profile;
-- contact_phone / contact_name never emitted.
CREATE OR REPLACE FUNCTION public.get_church_profile(p_church_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_church    record;
  v_leaders   json;
  v_rag_label text;
  v_address   text;
  v_result    json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Explicit column list (SEC c.14780 obs #1): excludes contact_phone.
  SELECT
    id, name, type, rag_status, city, country, state_declaration,
    needs, resources, has_emergency_plan, open_to_collaboration,
    website_url, primary_language, denomination_affiliation,
    congregation_size_range, show_contact_on_profile,
    created_at, contact_email, verification_status
  INTO v_church
  FROM churches_public
  WHERE id = p_church_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

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
        'display_name', CASE
          WHEN u.anonymous = true THEN
            u.role::text || ' at ' || v_church.name
          WHEN u.display_name_preference = 'full_name' THEN
            u.full_name || ' · ' || u.role::text
          ELSE
            split_part(u.full_name, ' ', 1) || ' · ' || u.role::text
        END,
        'role', u.role
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
    SELECT address INTO v_address
    FROM public.churches
    WHERE id = p_church_id;

    -- json has no || operator; merge through jsonb then cast back.
    v_result := (v_result::jsonb || jsonb_build_object(
      'contact_email', v_church.contact_email,
      'address',       v_address
    ))::json;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_church_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_church_profile(uuid) TO authenticated;
