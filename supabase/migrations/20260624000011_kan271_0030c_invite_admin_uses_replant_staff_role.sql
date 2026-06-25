-- KAN-271 Migration 0030c — patch fn_invite_admin to use 'replant_staff'
-- (was 'other'). Honors the new role enum value added in 0030.

CREATE OR REPLACE FUNCTION public.fn_invite_admin(p_auth_id uuid, p_email text, p_first_name text, p_last_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id uuid;
  v_new_id uuid;
  v_full_name text;
BEGIN
  v_caller_id := public.fn_assert_super_admin();
  IF p_auth_id IS NULL THEN RAISE EXCEPTION 'missing_field:auth_id' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_email), '') = '' THEN RAISE EXCEPTION 'missing_field:email' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_first_name), '') = '' THEN RAISE EXCEPTION 'missing_field:first_name' USING ERRCODE='22023'; END IF;
  IF COALESCE(trim(p_last_name), '') = '' THEN RAISE EXCEPTION 'missing_field:last_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_first_name) > 80 THEN RAISE EXCEPTION 'field_too_long:first_name' USING ERRCODE='22023'; END IF;
  IF char_length(p_last_name)  > 80 THEN RAISE EXCEPTION 'field_too_long:last_name'  USING ERRCODE='22023'; END IF;

  v_full_name := public.fn_compose_full_name(
    p_first_name, '', p_last_name, NULL, NULL, false, false
  );

  INSERT INTO public.users (
    auth_id, email, first_name, middle_name, last_name, full_name,
    include_middle_name, last_name_first, role, is_active,
    is_underground_admin, is_top_tier_admin, church_id
  ) VALUES (
    p_auth_id, lower(trim(p_email)), trim(p_first_name), '', trim(p_last_name), v_full_name,
    false, false, 'replant_staff'::user_role, true,
    false, false, NULL
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
    VALUES ('admin_invite_sent', v_caller_id, 'user'::text,
            jsonb_build_object('invited_user_id', v_new_id, 'invited_email', lower(trim(p_email)), 'kind', 'new_staff'));

  RETURN v_new_id;
END;
$function$;
