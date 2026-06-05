-- KAN-32 Day 3 — Heartcry hold persistence.
--
-- Adds:
--   1. heartcry_holds table (composite PK: heartcry_id + user_id)
--   2. RLS policies for direct table access
--   3. hold_heartcry_in_prayer(uuid) toggle RPC (mirrors stand_in_the_gap pattern)
--   4. get_heartcry_feed updated RETURNS TABLE: +hold_count, +viewer_held
--
-- Design spec: each HeartcryCard shows "X.Xk praying" count and a toggle
-- that persists across sessions. Prior implementation was in-memory only.

-- ─── 1. Table ────────────────────────────────────────────────────────

CREATE TABLE public.heartcry_holds (
  heartcry_id uuid NOT NULL REFERENCES public.heartcries(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (heartcry_id, user_id)
);

CREATE INDEX idx_heartcry_holds_heartcry ON public.heartcry_holds (heartcry_id);

ALTER TABLE public.heartcry_holds ENABLE ROW LEVEL SECURITY;

-- ─── 2. RLS ──────────────────────────────────────────────────────────

CREATE POLICY "authenticated_select_holds"
  ON public.heartcry_holds FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "verified_insert_own_holds"
  ON public.heartcry_holds FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid() AND verification_status = 'verified'
    )
  );

CREATE POLICY "delete_own_holds"
  ON public.heartcry_holds FOR DELETE TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ─── 3. Toggle RPC ──────────────────────────────────────────────────
-- Mirrors stand_in_the_gap: race-safe insert with ON CONFLICT, toggle
-- semantics, returns action + held + hold_count.

CREATE FUNCTION public.hold_heartcry_in_prayer(p_heartcry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id       uuid;
  v_caller_id     uuid;
  v_rows_inserted integer;
  v_hold_count    bigint;
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

  -- Verify heartcry is visible in the feed
  IF NOT EXISTS (
    SELECT 1 FROM public.heartcries
    WHERE id = p_heartcry_id
      AND user_id IS NOT NULL
      AND post_to_feed = true
      AND feed_approved = true
      AND feed_content IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'heartcry_not_found');
  END IF;

  -- Race-safe toggle: attempt insert on composite PK
  INSERT INTO public.heartcry_holds (heartcry_id, user_id)
  VALUES (p_heartcry_id, v_caller_id)
  ON CONFLICT ON CONSTRAINT heartcry_holds_pkey DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted = 0 THEN
    DELETE FROM public.heartcry_holds
    WHERE heartcry_id = p_heartcry_id
      AND user_id = v_caller_id;

    SELECT count(*) INTO v_hold_count
    FROM public.heartcry_holds
    WHERE heartcry_id = p_heartcry_id;

    RETURN jsonb_build_object(
      'action', 'removed',
      'held', false,
      'hold_count', v_hold_count
    );
  ELSE
    SELECT count(*) INTO v_hold_count
    FROM public.heartcry_holds
    WHERE heartcry_id = p_heartcry_id;

    RETURN jsonb_build_object(
      'action', 'added',
      'held', true,
      'hold_count', v_hold_count
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hold_heartcry_in_prayer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hold_heartcry_in_prayer(uuid) TO authenticated;

-- ─── 4. get_heartcry_feed — add hold_count + viewer_held ─────────────
-- Signature changes (RETURNS TABLE gains two columns) → DROP + CREATE.
-- All existing invariants preserved verbatim from 20260528000008.

DROP FUNCTION public.get_heartcry_feed(integer, integer, text);

CREATE FUNCTION public.get_heartcry_feed(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_region text    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  severity     text,
  created_at   timestamp with time zone,
  feed_content text,
  continent    text,
  region       text,
  hold_count   bigint,
  viewer_held  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_verified boolean := false;
  v_viewer_id       uuid;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100 (got %)', p_limit
      USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'p_offset must be >= 0 (got %)', p_offset
      USING ERRCODE = '22023';
  END IF;

  SELECT u.id, (u.verification_status = 'verified' AND u.is_active = true)
    INTO v_viewer_id, v_caller_verified
  FROM public.users u
  WHERE u.auth_id = auth.uid();

  IF v_caller_verified IS NULL OR v_caller_verified = false THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      h.id,
      h.severity::text       AS severity,
      h.created_at,
      h.feed_content,
      m.continent::text      AS continent,
      CASE
        WHEN ch.country IN (
          'Syria','Iraq','Iran','Jordan','Lebanon','Saudi Arabia','Yemen',
          'Oman','United Arab Emirates','Kuwait','Qatar','Bahrain',
          'Turkey','Palestine','Gaza'
        ) THEN 'Middle East'
        WHEN ch.country IN (
          'Afghanistan','Pakistan','Kazakhstan','Uzbekistan','Tajikistan',
          'Turkmenistan','Kyrgyzstan'
        ) THEN 'Central Asia'
        WHEN ch.country IN (
          'Egypt','Libya','Algeria','Tunisia','Morocco','Sudan',
          'Eritrea','Mauritania','Mali','Niger','Chad'
        ) THEN 'North Africa'
        WHEN ch.country IN (
          'China','North Korea','Mongolia','Vietnam','Taiwan',
          'Japan','South Korea'
        ) THEN 'East Asia'
        WHEN ch.country IN (
          'India','Bangladesh','Sri Lanka','Nepal','Bhutan',
          'Maldives','Myanmar'
        ) THEN 'South Asia'
        WHEN ch.country IN (
          'Indonesia','Malaysia','Philippines','Cambodia','Laos',
          'Thailand','Singapore'
        ) THEN 'Southeast Asia'
        ELSE 'Other'
      END AS region
    FROM public.heartcries h
    INNER JOIN public.churches              ch ON ch.id          = h.church_id
    INNER JOIN public.country_continent_map m  ON m.country_name = ch.country
    WHERE h.user_id        IS NOT NULL
      AND h.post_to_feed   = true
      AND h.feed_approved  = true
      AND h.feed_content   IS NOT NULL
  )
  SELECT
    b.id, b.severity, b.created_at, b.feed_content, b.continent, b.region,
    COALESCE((SELECT count(*) FROM public.heartcry_holds hh WHERE hh.heartcry_id = b.id), 0)::bigint AS hold_count,
    EXISTS(SELECT 1 FROM public.heartcry_holds hh WHERE hh.heartcry_id = b.id AND hh.user_id = v_viewer_id) AS viewer_held
  FROM base b
  WHERE p_region IS NULL OR b.region = p_region
  ORDER BY b.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_heartcry_feed(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_heartcry_feed(integer, integer, text) TO authenticated;
