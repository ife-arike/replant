-- post_comment rewrite — derives mask_reason, not is_masked (CC ruling 2026-06-05).
--
-- Uses macro_region_label() helper (added in migration 20260605000002).
-- Priority order:
--   1. users.anonymous=true          → anon   (name hidden, church SHOWN, no region)
--   2. users.church_id IS NULL        → no_church (full safe mask)
--   3. churches.type = 'underground'  → underground (name hidden, region stored as fallback)
--   4. otherwise                      → none
--
-- INSERT now specifies mask_reason + masked_region (not is_masked, which is generated).

DROP FUNCTION IF EXISTS public.post_comment(uuid, text);

CREATE OR REPLACE FUNCTION public.post_comment(
  p_announcement_id uuid,
  p_body            text
)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_pk          uuid;
  v_church_id        uuid;
  v_is_anon          boolean := false;
  v_church_type      public.church_type;
  v_macro_region     public.macro_region;
  v_mask_reason      public.mask_reason := 'none';
  v_masked_region    text    := NULL;
  v_row              public.comments;
BEGIN
  -- Caller gate: auth_id → public.users, verified + active.
  SELECT u.id, u.church_id, COALESCE(u.anonymous, false)
    INTO v_user_pk, v_church_id, v_is_anon
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_user_pk IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Announcement must be open.
  IF NOT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.is_active = true
      AND a.published_at <= now()
  ) THEN
    RAISE EXCEPTION 'announcement_not_open';
  END IF;

  -- Masking priority.
  IF v_is_anon THEN
    -- Public leader with anonymous=true: hide name, church still shown to readers.
    v_mask_reason := 'anon';
    v_masked_region := NULL;

  ELSIF v_church_id IS NULL THEN
    -- No church on record: safe full mask, should not occur in production.
    v_mask_reason := 'no_church';
    v_masked_region := NULL;

  ELSE
    SELECT c.type, c.region_admin_only
      INTO v_church_type, v_macro_region
    FROM public.churches c
    WHERE c.id = v_church_id;

    IF v_church_type = 'underground' THEN
      v_mask_reason := 'underground';
      -- Store the coarse region label so get_comments can serve it as a
      -- fallback when churches.show_church_name = false.
      v_masked_region := public.macro_region_label(v_macro_region);
    END IF;
    -- else: mask_reason stays 'none'
  END IF;

  INSERT INTO public.comments (
    announcement_id, author_id, body, mask_reason, masked_region
  ) VALUES (
    p_announcement_id, auth.uid(), p_body, v_mask_reason, v_masked_region
  )
  RETURNING * INTO v_row;

  INSERT INTO public.audit_log (action, accessed_by, church_id, triggered_by, meta)
  VALUES (
    'comment_posted', auth.uid(), v_church_id, 'user',
    jsonb_build_object('announcement_id', p_announcement_id)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.post_comment(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.post_comment(uuid, text) TO authenticated;
