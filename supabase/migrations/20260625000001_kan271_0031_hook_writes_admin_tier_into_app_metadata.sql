-- KAN-271 / F3 — patch custom_access_token_hook to ALSO write admin_tier
-- inside claims.app_metadata so supabase-js exposes it as session.user.app_metadata.admin_tier.
--
-- Symptom: FE TierChip reads session.user.app_metadata.admin_tier → undefined →
-- falls through to legacy role='super_admin' → labels Overseers (Ruth + accounts@)
-- as "Super admin" instead of "Overseer".
--
-- Root cause: existing hook wrote admin_tier as TOP-LEVEL claim via
--   jsonb_set(claims, '{admin_tier}', ...)
-- but did NOT write it into claims.app_metadata. supabase-js only exposes
-- claims.app_metadata as session.user.app_metadata.
--
-- Fix: keep the top-level admin_tier claim (RLS / server-side depend on it)
-- AND add a second jsonb_set into the app_metadata path. Both populated →
-- FE resolution works, RLS-on-top-level claim still works.
--
-- After deploy: Founder MUST sign out + back in to mint a fresh JWT carrying
-- the new app_metadata.admin_tier claim.
--
-- Applied to remote via MCP apply_migration on 2026-06-25.

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

  -- Top-level admin_tier claim (preserved — RLS + server-side reads).
  IF v_resolved_tier IS NULL THEN
    claims := jsonb_set(claims, '{admin_tier}', 'null'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{admin_tier}', to_jsonb(v_resolved_tier));
  END IF;

  -- KAN-271 / F3 NEW — ALSO write admin_tier inside app_metadata path.
  -- supabase-js exposes claims.app_metadata as session.user.app_metadata,
  -- which is where the FE TierChip reads from. create_missing=true so the
  -- key is inserted into app_metadata even when not previously present.
  IF v_resolved_tier IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata, admin_tier}', 'null'::jsonb, true);
  ELSE
    claims := jsonb_set(claims, '{app_metadata, admin_tier}', to_jsonb(v_resolved_tier), true);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;
