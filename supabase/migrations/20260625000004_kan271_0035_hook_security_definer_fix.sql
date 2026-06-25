-- KAN-271 Migration 0035 — make custom_access_token_hook SECURITY DEFINER
-- Root cause: the hook ran as SECURITY INVOKER (default), executing as
-- supabase_auth_admin. That role lacks SELECT on public.users, so the
-- is_top_tier_admin lookup threw permission_denied; the EXCEPTION WHEN
-- OTHERS catch swallowed it and defaulted to false. Result: top-tier
-- admins were resolved as super_admin tier in the JWT.
--
-- Fix: SECURITY DEFINER + explicit search_path. Hook owner (postgres)
-- has full read access. Hook still triggered by supabase_auth_admin via
-- the existing EXECUTE grant; just runs with postgres privileges inside.
-- This is the canonical Supabase pattern for custom access token hooks
-- that need to read app schema (per docs.supabase.com/guides/auth/auth-hooks).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  claims jsonb;
  user_app_role text;
  user_app_admin_tier text;
  user_app_is_underground_admin boolean;
  v_auth_user_id uuid;
  v_is_top_tier_admin boolean;
  v_resolved_tier text;
BEGIN
  claims := event -> 'claims';
  user_app_role := claims -> 'app_metadata' ->> 'role';
  user_app_admin_tier := claims -> 'app_metadata' ->> 'admin_tier';

  IF user_app_role = 'super_admin' THEN
    claims := jsonb_set(claims, '{super_admin}', 'true'::jsonb);
  ELSE
    claims := jsonb_set(claims, '{super_admin}', 'false'::jsonb);
  END IF;

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
    claims := jsonb_set(claims, '{app_metadata, admin_tier}', 'null'::jsonb, true);
  ELSE
    claims := jsonb_set(claims, '{admin_tier}', to_jsonb(v_resolved_tier));
    claims := jsonb_set(claims, '{app_metadata, admin_tier}', to_jsonb(v_resolved_tier), true);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;

-- Re-grant EXECUTE (CREATE OR REPLACE preserves grants but defensive)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
