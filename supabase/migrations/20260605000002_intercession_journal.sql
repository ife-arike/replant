-- KAN-23 — Intercession Journal: intercession_holds + prayed_by timestamp
--           + 4 RPCs + create_prayer_request anon override
--
-- Changes:
--   1. intercession_holds table — leaders' active church intercession list (max 10)
--   2. prayer_request_prayed_by.created_at — timestamp when leader stood in gap
--   3. add_intercession_hold(uuid) — SECURITY DEFINER RPC; inserts or returns 'list_full'
--   4. remove_intercession_hold(uuid) — SECURITY DEFINER; deletes own hold by hold id
--   5. get_intercession_holds()       — SECURITY DEFINER; returns caller's hold list
--   6. get_standing_in_gap_history()  — SECURITY DEFINER; returns caller's prayed-for log
--   7. create_prayer_request updated  — adds p_anonymous_override param; drops old 3-param sig

-- ─── 1. intercession_holds ────────────────────────────────────────────────

CREATE TABLE public.intercession_holds (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  church_id   uuid        NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leader_id, church_id)
);

CREATE INDEX idx_intercession_holds_leader ON public.intercession_holds (leader_id);

ALTER TABLE public.intercession_holds ENABLE ROW LEVEL SECURITY;

-- Authenticated leaders see only their own holds.
CREATE POLICY "select_own_holds"
  ON public.intercession_holds FOR SELECT TO authenticated
  USING (
    leader_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Inserts are guarded by the RPC (SECURITY DEFINER); direct inserts
-- are intentionally blocked to keep the 10-hold cap in the authoritative path.
CREATE POLICY "no_direct_insert"
  ON public.intercession_holds FOR INSERT TO authenticated
  WITH CHECK (false);

-- Leaders may delete their own holds directly (the RPC also does this, but
-- allowing direct DELETE via RLS enables the FE optimistic-delete pattern
-- without a round-trip through a DEFINER wrapper).
CREATE POLICY "delete_own_holds"
  ON public.intercession_holds FOR DELETE TO authenticated
  USING (
    leader_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ─── 2. prayer_request_prayed_by.created_at ──────────────────────────────

ALTER TABLE public.prayer_request_prayed_by
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─── 3. add_intercession_hold(p_church_id uuid) ──────────────────────────

CREATE OR REPLACE FUNCTION public.add_intercession_hold(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id    uuid;
  v_caller_id  uuid;
  v_hold_count integer;
  v_rows       integer;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = v_auth_id
    AND verification_status = 'verified';

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_verified');
  END IF;

  -- Count existing holds.
  SELECT COUNT(*) INTO v_hold_count
  FROM public.intercession_holds
  WHERE leader_id = v_caller_id;

  -- Check if already holding this church.
  IF EXISTS (
    SELECT 1 FROM public.intercession_holds
    WHERE leader_id = v_caller_id AND church_id = p_church_id
  ) THEN
    RETURN jsonb_build_object('action', 'already_held', 'hold_count', v_hold_count);
  END IF;

  IF v_hold_count >= 10 THEN
    RETURN jsonb_build_object('error', 'list_full', 'hold_count', v_hold_count);
  END IF;

  INSERT INTO public.intercession_holds (leader_id, church_id)
  VALUES (v_caller_id, p_church_id);

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'action', 'added',
    'hold_count', v_hold_count + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_intercession_hold(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_intercession_hold(uuid) TO authenticated;

-- ─── 4. remove_intercession_hold(p_hold_id uuid) ─────────────────────────

CREATE OR REPLACE FUNCTION public.remove_intercession_hold(p_hold_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id   uuid;
  v_caller_id uuid;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = v_auth_id;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  -- Verify ownership before delete.
  IF NOT EXISTS (
    SELECT 1 FROM public.intercession_holds
    WHERE id = p_hold_id AND leader_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  DELETE FROM public.intercession_holds
  WHERE id = p_hold_id AND leader_id = v_caller_id;

  RETURN jsonb_build_object('action', 'removed');
END;
$$;

REVOKE ALL ON FUNCTION public.remove_intercession_hold(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_intercession_hold(uuid) TO authenticated;

-- ─── 5. get_intercession_holds() ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_intercession_holds()
RETURNS TABLE (
  id          uuid,
  church_id   uuid,
  church_name text,
  city        text,
  country     text,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id   uuid;
  v_caller_id uuid;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = v_auth_id;

  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ih.id,
    ih.church_id,
    c.name::text,
    c.city::text,
    c.country::text,
    ih.created_at
  FROM public.intercession_holds ih
  INNER JOIN public.churches c ON c.id = ih.church_id
  WHERE ih.leader_id = v_caller_id
  ORDER BY ih.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_intercession_holds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_intercession_holds() TO authenticated;

-- ─── 6. get_standing_in_gap_history() ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_standing_in_gap_history()
RETURNS TABLE (
  prayer_request_id uuid,
  prayer_text       text,
  church_name       text,
  city              text,
  country           text,
  prayed_at         timestamptz,
  prayed_count      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id   uuid;
  v_caller_id uuid;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = v_auth_id;

  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pb.prayer_request_id,
    pr.content::text,
    c.name::text,
    c.city::text,
    c.country::text,
    pb.created_at,
    pr.prayed_count
  FROM public.prayer_request_prayed_by pb
  INNER JOIN public.prayer_requests pr ON pr.id = pb.prayer_request_id
  INNER JOIN public.churches c ON c.id = pr.church_id
  WHERE pb.leader_id = v_caller_id
  ORDER BY pb.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_standing_in_gap_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_standing_in_gap_history() TO authenticated;

-- ─── 7. create_prayer_request — add p_anonymous_override ─────────────────
--
-- Drop the existing 3-param signature and recreate with a 4th optional param.
-- The new param defaults to NULL, meaning "inherit from users.anonymous" —
-- preserving backward compatibility (old callers pass 3 args and get the
-- same behaviour). Underground churches always post anonymously regardless
-- of the override.

DROP FUNCTION IF EXISTS public.create_prayer_request(text, text, boolean);

CREATE FUNCTION public.create_prayer_request(
  p_content            text,
  p_category           text,
  p_urgent             boolean DEFAULT false,
  p_anonymous_override boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_valid_categories text[] := ARRAY[
    'Healing','Protection','Provision','Salvation',
    'Unity','Guidance','Endurance','Laborers'
  ];
  v_user_id      uuid;
  v_church_id    uuid;
  v_anonymous    boolean;
  v_church_type  text;
  v_verification text;
  v_trimmed      text;
  v_new_id       uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT u.id, u.church_id, u.anonymous, u.verification_status::text
  INTO   v_user_id, v_church_id, v_anonymous, v_verification
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_verification <> 'verified' THEN
    RAISE EXCEPTION 'not_verified';
  END IF;

  -- Get church type for underground override.
  SELECT type::text INTO v_church_type
  FROM public.churches
  WHERE id = v_church_id;

  -- Resolve anonymous: underground always true; otherwise honour the
  -- override if supplied, else fall back to the leader's stored setting.
  IF v_church_type = 'underground' THEN
    v_anonymous := true;
  ELSIF p_anonymous_override IS NOT NULL THEN
    v_anonymous := p_anonymous_override;
  ELSE
    v_anonymous := COALESCE(v_anonymous, false);
  END IF;

  v_trimmed := trim(p_content);
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'content_required';
  END IF;
  IF char_length(v_trimmed) > 300 THEN
    RAISE EXCEPTION 'content_too_long';
  END IF;

  IF p_category IS NULL OR NOT (p_category = ANY (v_valid_categories)) THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  INSERT INTO public.prayer_requests (
    user_id, church_id, content, category, urgent, anonymous
  ) VALUES (
    v_user_id, v_church_id, v_trimmed, p_category,
    COALESCE(p_urgent, false), v_anonymous
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_prayer_request(text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prayer_request(text, text, boolean, boolean) TO authenticated;
