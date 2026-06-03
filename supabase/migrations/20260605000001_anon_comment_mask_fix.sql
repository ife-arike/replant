-- Anon comment mask fix (anon bug Priority-0)
--
-- post_comment previously derived is_masked solely from church type
-- (underground → masked). Leaders with users.anonymous=true but a
-- non-underground church posted with is_masked=false, causing their
-- real name to be returned by get_comments.
--
-- Fix:
--   1. post_comment: check users.anonymous before church-type masking.
--      Anonymous leaders → is_masked=true, masked_region=NULL.
--      Underground logic is unchanged (defence-in-depth for non-anon leaders).
--   2. Backfill: mask any existing comments from anonymous, non-underground
--      leaders that were incorrectly stored with is_masked=false.
--
-- No audit_log constraint change — 'comment_posted' already present.
-- No new RPC signature — DROP/REPLACE kept in sync with existing grants.

BEGIN;

-- ─── 1. Backfill existing comments ──────────────────────────────────────────
-- Mask comments already posted by anonymous leaders (non-underground) that were
-- stored with is_masked=false. masked_region=NULL: we disclose no region for
-- a leader who explicitly chose anonymity (vs underground where macro-region is
-- intentionally surfaced as a coarse location signal).
UPDATE public.comments c
SET    is_masked     = true,
       masked_region = NULL
WHERE  c.is_masked = false
  AND  EXISTS (
         SELECT 1
         FROM   public.users u
         WHERE  u.auth_id  = c.author_id
           AND  u.anonymous = true
       );

-- ─── 2. Replace post_comment ─────────────────────────────────────────────────
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
  v_is_masked        boolean := false;
  v_masked_region    text    := NULL;
  v_row              public.comments;
BEGIN
  -- Caller gate. Capture app-PK + church + anonymous flag.
  SELECT u.id, u.church_id, COALESCE(u.anonymous, false)
    INTO v_user_pk, v_church_id, v_is_anon
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.verification_status = 'verified';
  IF v_user_pk IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Announcement must be posted.
  IF NOT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.is_active = true
      AND a.published_at <= now()
  ) THEN
    RAISE EXCEPTION 'announcement_not_open';
  END IF;

  -- Masking priority:
  --   1. Anonymous profile flag   → masked, no region (leader chose anonymity)
  --   2. No church on record      → masked, no region (can't confirm non-underground)
  --   3. Underground church type  → masked, macro-region label only
  --   4. Otherwise                → not masked
  IF v_is_anon THEN
    v_is_masked     := true;
    v_masked_region := NULL;
  ELSIF v_church_id IS NULL THEN
    v_is_masked     := true;
    v_masked_region := NULL;
  ELSE
    SELECT c.type, c.region_admin_only
      INTO v_church_type, v_macro_region
    FROM public.churches c
    WHERE c.id = v_church_id;

    IF v_church_type = 'underground' THEN
      v_is_masked     := true;
      v_masked_region := CASE v_macro_region
        WHEN 'north_america'               THEN 'North America'
        WHEN 'latin_america_caribbean'     THEN 'Latin America & Caribbean'
        WHEN 'western_europe'              THEN 'Western Europe'
        WHEN 'eastern_europe_central_asia' THEN 'Eastern Europe & Central Asia'
        WHEN 'middle_east_north_africa'    THEN 'Middle East & North Africa'
        WHEN 'sub_saharan_africa'          THEN 'Sub-Saharan Africa'
        WHEN 'south_asia'                  THEN 'South Asia'
        WHEN 'east_southeast_asia'         THEN 'East & Southeast Asia'
        WHEN 'oceania_pacific'             THEN 'Oceania & Pacific'
        ELSE NULL
      END;
    END IF;
  END IF;

  INSERT INTO public.comments (
    announcement_id, author_id, body, is_masked, masked_region
  ) VALUES (
    p_announcement_id, auth.uid(), p_body, v_is_masked, v_masked_region
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

COMMIT;
