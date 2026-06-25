-- KAN-271 / Workstream A — helper functions used by the admin-tier RPC family.
-- Split out as 0028a so 0028b RPCs can reference them without forward-decl noise.
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

-- Assert the caller is a top-tier admin (Overseer). Used by approve/deny/demote/revoke.
-- Returns caller's public.users.id.
CREATE OR REPLACE FUNCTION public.fn_assert_top_tier_admin()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_caller_id uuid; v_ok boolean;
BEGIN
  SELECT u.id, u.is_top_tier_admin INTO v_caller_id, v_ok
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL OR NOT v_ok THEN
    RAISE EXCEPTION 'top-tier admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN v_caller_id;
END;
$$;

-- Assert the caller is a super admin (Super admin OR top-tier — top-tier always qualifies).
-- Used by fn_request_admin_promotion (sponsor) and fn_invite_admin.
CREATE OR REPLACE FUNCTION public.fn_assert_super_admin()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_caller_id uuid;
  v_is_top   boolean;
  v_app_role text;
BEGIN
  -- Top-tier qualifies automatically.
  SELECT u.id, u.is_top_tier_admin INTO v_caller_id, v_is_top
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF v_is_top = true THEN
    RETURN v_caller_id;
  END IF;
  -- Otherwise must have app_metadata.role = 'super_admin'.
  SELECT au.raw_app_meta_data ->> 'role' INTO v_app_role
    FROM auth.users au WHERE au.id = auth.uid();
  IF v_app_role <> 'super_admin' THEN
    RAISE EXCEPTION 'super admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN v_caller_id;
END;
$$;

-- MIN_SUPER_ADMINS floor check. Top-tier seats are NOT counted (ratification A-#2).
-- Returns count of "real" super admins (super_admin role AND NOT top-tier).
-- Used by fn_demote_admin + fn_revoke_admin pre-mutation guard.
CREATE OR REPLACE FUNCTION public.fn_count_active_super_admins_excluding_top_tier()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
    FROM public.users u
    JOIN auth.users au ON au.id = u.auth_id
   WHERE u.is_active = true
     AND u.soft_deleted_at IS NULL
     AND u.hard_deleted_at IS NULL
     AND u.is_top_tier_admin = false        -- exclude top-tier (per ratification A-#2)
     AND au.raw_app_meta_data ->> 'role' = 'super_admin';
  RETURN v_count;
END;
$$;

-- Name composition heuristic — mirrors the signup-sprint pattern (KAN-229).
-- Inputs: row fields. Returns the composed full_name string.
-- Rules:
--   - honorific prefixed if non-null/non-empty
--   - if include_middle_name AND middle_name non-empty → middle inserted between first/last
--   - if last_name_first → "Last First" order (with optional middle)
--   - suffix appended with comma if non-null/non-empty
CREATE OR REPLACE FUNCTION public.fn_compose_full_name(
  p_first text, p_middle text, p_last text,
  p_honorific text, p_suffix text,
  p_include_middle boolean, p_last_name_first boolean
) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_first text := COALESCE(p_first, '');
  v_middle text := COALESCE(p_middle, '');
  v_last text := COALESCE(p_last, '');
  v_hon text := COALESCE(NULLIF(trim(p_honorific), ''), '');
  v_suf text := COALESCE(NULLIF(trim(p_suffix), ''), '');
  v_core text;
  v_out text;
BEGIN
  -- Drop middle if include_middle=false or middle empty.
  IF NOT COALESCE(p_include_middle, false) OR v_middle = '' THEN
    v_middle := '';
  END IF;

  IF COALESCE(p_last_name_first, false) THEN
    -- "Last First Middle" — middle trails first when present.
    v_core := trim(v_last || CASE WHEN v_first <> '' THEN ' ' || v_first ELSE '' END
                          || CASE WHEN v_middle <> '' THEN ' ' || v_middle ELSE '' END);
  ELSE
    -- "First Middle Last"
    v_core := trim(v_first || CASE WHEN v_middle <> '' THEN ' ' || v_middle ELSE '' END
                           || CASE WHEN v_last <> '' THEN ' ' || v_last ELSE '' END);
  END IF;

  v_out := CASE WHEN v_hon <> '' THEN v_hon || ' ' || v_core ELSE v_core END;
  IF v_suf <> '' THEN
    v_out := v_out || ', ' || v_suf;
  END IF;

  RETURN trim(v_out);
END;
$$;

COMMENT ON FUNCTION public.fn_compose_full_name IS
  'KAN-271/KAN-229 — composes users.full_name from structured name parts using '
  'the signup-sprint heuristic. Used by fn_update_admin_name + fn_invite_admin.';
