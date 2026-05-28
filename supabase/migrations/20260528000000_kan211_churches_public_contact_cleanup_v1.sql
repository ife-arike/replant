-- KAN-211 — Remove contact_email + contact_phone from churches_public.
--
-- churches_public pre-existed (before KAN-208) exposing contact_email and
-- contact_phone to any authenticated leader via a direct SELECT. Contact
-- data is meant to be admin-only (churches_admin) + surfaced conditionally
-- by get_church_profile when show_contact_on_profile = true. This drops the
-- two columns from the public view.
--
-- Order is load-bearing: RPC first, view second. get_church_profile reads
-- contact_email from churches_public today; that read is switched to the
-- base public.churches table (same pattern already used for address) BEFORE
-- the columns leave the view, so the function never breaks.
--
-- Live verified 2026-05-27 (KAN-211 Step 0): no objects depend on
-- churches_public; the function is plpgsql (runtime-resolved, not a catalog
-- dependency). DROP VIEW is therefore safe without CASCADE.

-- ─────────────────────────────────────────────────────────────────────
-- 1a. get_church_profile — contact_email now read from base public.churches
--     (lockstep with / before the view rewrite). Explicit DROP before
--     CREATE per schema-facts rule (avoid overload accumulation). Only
--     change vs live: contact_email source moves view → base table. The
--     corrected jsonb merge (KAN-208 c.14782) is preserved verbatim.
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_church_profile(uuid);

CREATE FUNCTION public.get_church_profile(p_church_id uuid)
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
  v_result        json;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Explicit column list (SEC c.14780 obs #1): excludes contact_phone.
  -- KAN-211: contact_email no longer read from the view (dropped below);
  -- it is read from the base table inside the contact block instead.
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
    -- contact_email + address both read from the base table now.
    SELECT contact_email, address
    INTO v_contact_email, v_address
    FROM public.churches
    WHERE id = p_church_id;

    -- json has no || operator; merge through jsonb then cast back.
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

-- ─────────────────────────────────────────────────────────────────────
-- 1b. churches_public — drop contact_email + contact_phone. Column removal
--     can't be done with CREATE OR REPLACE VIEW, so DROP + CREATE. All
--     other columns keep their order; underground exclusion + is_active
--     filter + all 5 KAN-208 enrichment columns preserved. Grants
--     re-applied to match the pre-existing access posture (DROP VIEW
--     drops them).
-- ─────────────────────────────────────────────────────────────────────
DROP VIEW public.churches_public;

CREATE VIEW public.churches_public AS
  SELECT
    id,
    name,
    type,
    city,
    country,
    lat,
    lng,
    state_declaration,
    rag_status,
    needs,
    verified,
    verification_deadline,
    verification_status,
    is_active,
    deactivated_at,
    created_at,
    website_url,
    primary_language,
    denomination_affiliation,
    congregation_size_range,
    show_contact_on_profile,
    resources,
    has_emergency_plan,
    open_to_collaboration
  FROM churches
  WHERE ((is_active = true) AND (type <> 'underground'::church_type));

-- Restore pre-existing grants (matched live KAN-211 Step 0).
GRANT ALL ON public.churches_public TO anon, authenticated, service_role;
