-- KAN-271 / Workstream A — patch custom_access_token_hook to ALSO mint the new
-- admin_tier claim alongside the existing super_admin / is_underground_admin /
-- is_top_tier_admin claims. Preserves all existing behavior verbatim.
--
-- DEVIATION FROM MANIFEST §A-#7: the manifest assumed source-of-truth would be
-- app_metadata.admin_tier. Live state shows top-tier already sourced from the
-- public.users.is_top_tier_admin COLUMN (introduced KAN-273 2026-06-23 panel),
-- and super_admin from app_metadata.role='super_admin'. Adapting:
--   - top_tier  if users.is_top_tier_admin = true  (column wins — single source)
--   - super_admin if app_metadata.role = 'super_admin' (preserves existing RLS)
--   - regular  if app_metadata.admin_tier = 'regular' (NEW — set by fn_invite_admin)
--   - else     admin_tier claim = null
-- This avoids forking truth across two app_metadata fields (role vs admin_tier)
-- for the same identity dimension. Net effect identical to manifest's intent:
-- the admin_tier claim is canonical for FE gating; underlying columns/role
-- string stay the durable write surface for each tier.
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $function$
DECLARE
  claims jsonb;
  user_app_role text;
  user_app_admin_tier text;
  user_app_is_underground_admin boolean;
  v_auth_user_id uuid;
  v_is_top_tier_admin boolean;
  v_resolved_tier text;
BEGIN
  -- Source-of-truth: app_metadata (admin-only writeable, exact-match values)
  -- See SEC ruling KAN-95 item 3: do NOT pivot to user_metadata (user-writeable footgun)
  claims := event -> 'claims';
  user_app_role := claims -> 'app_metadata' ->> 'role';
  user_app_admin_tier := claims -> 'app_metadata' ->> 'admin_tier';

  IF user_app_role = 'super_admin' THEN
    claims := jsonb_set(claims, '{super_admin}', 'true'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{super_admin}', 'false'::jsonb);
  END IF;

  -- 2026-06-22 — Underground Verification Queue surface gate (preserved verbatim).
  BEGIN
    user_app_is_underground_admin :=
      (claims -> 'app_metadata' ->> 'is_underground_admin')::boolean;
  EXCEPTION WHEN OTHERS THEN
    user_app_is_underground_admin := false;
  END;

  IF COALESCE(user_app_is_underground_admin, false) = true THEN
    claims := jsonb_set(claims, '{is_underground_admin}', 'true'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{is_underground_admin}', 'false'::jsonb);
  END IF;

  -- 2026-06-23 — In Review workstream top-tier admin gate (preserved verbatim).
  -- Sourced from public.users.is_top_tier_admin. Looked up by auth_id.
  v_auth_user_id := (event ->> 'user_id')::uuid;
  BEGIN
    SELECT u.is_top_tier_admin INTO v_is_top_tier_admin
    FROM public.users u
    WHERE u.auth_id = v_auth_user_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_is_top_tier_admin := false;
  END;

  IF COALESCE(v_is_top_tier_admin, false) = true THEN
    claims := jsonb_set(claims, '{is_top_tier_admin}', 'true'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{is_top_tier_admin}', 'false'::jsonb);
  END IF;

  -- KAN-271 NEW — admin_tier composite claim. Layered resolution:
  --   1. is_top_tier_admin column  → 'top_tier'  (Overseer)
  --   2. app_metadata.role='super_admin' → 'super_admin'
  --   3. app_metadata.admin_tier='regular' → 'regular' (set by fn_invite_admin)
  --   4. else null (leaf/leader users; existing super_admin/underground admins
  --      who haven't been re-pathed yet keep their tier inferred from #2).
  IF COALESCE(v_is_top_tier_admin, false) = true THEN
    v_resolved_tier := 'top_tier';
  ELSIF user_app_role = 'super_admin' THEN
    v_resolved_tier := 'super_admin';
  ELSIF user_app_admin_tier = 'regular' THEN
    v_resolved_tier := 'regular';
  ELSE
    v_resolved_tier := NULL;
  END IF;

  IF v_resolved_tier IS NULL THEN
    claims := jsonb_set(claims, '{admin_tier}', 'null'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{admin_tier}', to_jsonb(v_resolved_tier));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;
