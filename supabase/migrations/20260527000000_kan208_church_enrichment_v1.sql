-- KAN-208 — Church schema enrichment + get_church_profile RPC
--
-- Live schema verified 2026-05-27 against project jiyetphxxvyiicrnwlnx
-- (Step 0 halt-if gates, KAN-208 comment 14778). Two corrections vs the
-- original dispatch, ratified before draft:
--   * Blocker 1 — public.users has only `full_name` (no first_name/
--     last_name). Leader display mirrors the canonical get_prayer_wall
--     pattern: full_name, or split_part(full_name,' ',1) for first-name.
--   * Blocker 2 — get_church_profile needs resources / has_emergency_plan
--     / open_to_collaboration / address, none of which are in
--     churches_public today. Resolution (KAN-208): expose the three
--     NON-sensitive fields via churches_public; read `address` from the
--     base table inside the DEFINER function ONLY, gated on
--     show_contact_on_profile, so street addresses never leak through the
--     public view.

-- ─────────────────────────────────────────────────────────────────────
-- 1a. Enum (create before the column ALTER)
-- ─────────────────────────────────────────────────────────────────────
CREATE TYPE congregation_size_enum AS ENUM (
  'under_50', '50_to_200', '200_to_500', 'over_500', 'not_specified'
);

-- ─────────────────────────────────────────────────────────────────────
-- 1b. New columns on public.churches (all nullable / safe defaults)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.churches
  ADD COLUMN website_url              text NULL,
  ADD COLUMN primary_language         text NULL,
  ADD COLUMN denomination_affiliation text NULL,
  ADD COLUMN congregation_size_range  congregation_size_enum NOT NULL DEFAULT 'not_specified',
  ADD COLUMN show_contact_on_profile  boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at              timestamptz NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 1c. New column on public.users
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN church_card_flow_seen boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────
-- 1d. Extend audit_log_action_check: 37 → 38 (append church_location_updated)
--     37 existing values transcribed verbatim from the live constraint.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'read_region',
    'read_heartcry',
    'verify_church',
    'reject_church',
    'flag_cleared',
    'flag_escalated',
    'flag_read',
    'pii_scrubbed',
    'deactivate_church',
    'deactivate_user',
    'announcement_deleted',
    'team_member_added',
    'team_member_removed',
    'rag_overridden',
    'rag_override_removed',
    'reinstate_church',
    'super_admin_granted',
    'super_admin_revoked',
    'admin_session_refreshed',
    'admin_password_reset',
    'admin_step_up_reauth',
    'heartcry_responded',
    'flag_queue_opened',
    'underground_oversight_opened',
    'announcement_created',
    'pastoral_signal_seen',
    'pastoral_signal_dispositioned',
    'pastoral_context_expanded',
    'pastoral_digest_emitted',
    'church_details_updated',
    'admin_aal2_elevation',
    'admin_mfa_factor_reset',
    'underground_aal2_gate',
    'heartcry_aal2_gate',
    'admin_password_reset_sent',
    'prayer_request_withdrawn',
    'heartcry_feed_consent_retracted',
    'church_location_updated'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 1e. Recreate churches_public.
--     CREATE OR REPLACE requires the original 18 columns in the same
--     order; new columns appended at the end. underground exclusion and
--     is_active filter preserved verbatim. Added: the 5 enrichment cols +
--     resources / has_emergency_plan / open_to_collaboration (the 3
--     non-sensitive fields the profile RPC needs). NOT added: address,
--     verified_at, contact_name (address read from base in the RPC only).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.churches_public AS
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
    contact_email,
    contact_phone,
    verified,
    verification_deadline,
    verification_status,
    is_active,
    deactivated_at,
    created_at,
    -- appended (KAN-208) —
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

-- ─────────────────────────────────────────────────────────────────────
-- 1f. get_church_profile RPC (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────
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
  -- Unauthenticated guard
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- churches_public excludes underground at the view level; a non-existent
  -- or underground id yields NOT FOUND → NULL.
  -- Explicit column list (SEC c.14780 obs #1): pull only the columns the
  -- RPC emits/branches on — notably EXCLUDES contact_phone — so future
  -- view-column additions can't drift into the loaded record.
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

  -- RAG plain-language label (pending / null → verification in progress)
  v_rag_label := CASE v_church.rag_status
    WHEN 'green' THEN 'Freely Operating'
    WHEN 'amber' THEN 'Operating with Limitations'
    WHEN 'red'   THEN 'Not Operating Freely'
    ELSE              'Verification in progress'
  END;

  -- Leaders — empty array if pending; anon-safe display otherwise.
  -- Blocker 1 fix: full_name / split_part (no first_name/last_name column).
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

  -- Base result
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

  -- Contact fields — only on opt-in. `contact_email` comes from the view;
  -- `address` is read from the base table here (Blocker 2 resolution) so it
  -- never leaves via churches_public.
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
