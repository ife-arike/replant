-- KAN-??? search_leaders RPC — three Founder-ruled changes (2026-06-08)
--
-- Ruled changes:
--   1. REMOVE church_name as a search criterion.
--      Leaders must NOT be discoverable by their church name.
--      Removes both the surface-church LIKE arm and the underground
--      literal 'underground church' LIKE arm from the WHERE predicate.
--      NOTE: the underground literal-match arm was intentional design in
--      the original (see 20260529000003 comment: "a leader typing
--      'underground' should find underground rows so they can be
--      invited/DM'd"). This ruling OVERRIDES that original intent —
--      underground rows are now only findable by the leader's name or
--      RPL Network ID. Confirm with Founder before applying if that
--      downstream effect is acceptable.
--
--   2. ADD RPL Network ID (churches.church_code) as a search criterion.
--      Column is public.churches.church_code (text, format RPL-00001).
--      The column is already in scope via the existing JOIN on
--      public.churches c. No new column or migration dependency needed.
--      ILIKE used (case-insensitive) since church_code has uppercase prefix.
--
--   3. Underground leaders in results: return macro-region label
--      instead of the generic 'Underground Church' string as church_name.
--      Source: churches.region_admin_only (type public.macro_region).
--      Humanised via public.macro_region_label() — IMMUTABLE helper
--      introduced in migration 20260605000002.
--      If region_admin_only IS NULL (church created before region capture
--      was required), falls back to 'Underground Church' — never leaks
--      the real name, never returns a null label to the FE.
--      FE contract unchanged: church_name column still present in return
--      table; FE reads r.church_name for the subtitle. Zero FE change needed.
--
-- SECURITY notes (underground invariant maintained):
--   - The real c.name of an underground church still NEVER appears in the
--     predicate (church_code is a public network identifier, not the
--     church name). Searching "RPL-00042" finds that church's leaders
--     without exposing their church's real name anywhere.
--   - church_name in the return set is still masked for underground:
--     now returns region label (e.g. "South Asia") rather than
--     "Underground Church". This is a MORE informative but still safe
--     disclosure — it matches the pattern used by post_comment masking
--     (masked_region carries macro-region for underground rows).
--   - church_code IS a public identifier per KAN-20 (20260528000001):
--     "church_code is a public network identifier (not contact PII),
--     so it is returned unconditionally." SEC re-stamp not required
--     for adding it to a predicate-only position (it is never returned
--     in the result set of this function; it only participates in WHERE).
--
-- CREATE OR REPLACE: safe upgrade path. No DROP+CREATE needed because
-- the RETURNS TABLE signature is unchanged (same column names and types).
-- Existing GRANTs persist across CREATE OR REPLACE.
--
-- DO NOT APPLY without SM + Founder review.
-- See DBA stamp at bottom of this file.

CREATE OR REPLACE FUNCTION public.search_leaders(
  p_query text
)
RETURNS TABLE (
  user_id        uuid,
  full_name      text,
  role           text,
  anonymous      boolean,
  church_id      uuid,
  church_name    text,
  underground    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_q         text := lower(trim(COALESCE(p_query, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RAISE EXCEPTION 'query_too_short';
  END IF;

  -- Caller resolution is OPTIONAL for search — an unverified user
  -- shouldn't be searching (HANDOFF §8 soft gate), but a missing row
  -- here doesn't break the function. We still exclude the caller
  -- when v_caller_id is non-null.
  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid() AND is_active = true
  LIMIT 1;

  RETURN QUERY
  SELECT
    u.id                                                              AS user_id,
    u.full_name                                                       AS full_name,
    u.role::text                                                      AS role,
    u.anonymous                                                       AS anonymous,
    c.id                                                              AS church_id,
    -- Underground: return macro-region label (e.g. "South Asia") rather
    -- than the old generic 'Underground Church' string. Falls back to
    -- 'Underground Church' only if region_admin_only is NULL (data gap
    -- on legacy rows). Real church name NEVER returned.
    CASE
      WHEN c.type = 'underground'
        THEN COALESCE(
               public.macro_region_label(c.region_admin_only),
               'Underground Church'
             )
      ELSE c.name
    END                                                               AS church_name,
    (c.type = 'underground')                                          AS underground
  FROM public.users u
  JOIN public.churches c ON c.id = u.church_id
  WHERE u.verification_status = 'verified'
    AND u.is_active = true
    AND c.is_active = true
    AND (v_caller_id IS NULL OR u.id <> v_caller_id)
    AND (
      -- RPL Network ID match — applies to ALL church types including underground.
      -- church_code is a public identifier (not the church name). Safe to use here.
      c.church_code ILIKE '%' || p_query || '%'

      -- Name match — surface (non-underground) leaders only.
      -- Underground leaders are NOT searchable by name until they opt in
      -- during the underground signup flow (Founder ruling 2026-06-08).
      -- When name opt-in is built, this guard will be relaxed to check
      -- a per-leader flag (e.g. churches.show_leader_name_in_search).
      OR (c.type <> 'underground' AND lower(u.full_name) LIKE '%' || v_q || '%')
    )
  ORDER BY u.full_name
  LIMIT 30;
END;
$$;

-- GRANTs: CREATE OR REPLACE preserves existing grants, but we re-issue
-- them explicitly here as a belt-and-suspenders guard against any future
-- DROP+CREATE that might inadvertently skip this file's grant block.
REVOKE EXECUTE ON FUNCTION public.search_leaders(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_leaders(text) TO authenticated;

-- ─── DBA STAMP ──────────────────────────────────────────────────────────────
-- Status : APPROVED — APPLIED
-- Author : DBA agent (Claude Code)
-- Date   : 2026-06-08
--
-- Concern 1 resolved: underground leaders are NOT searchable by name (only by
--   church_code). Name opt-in deferred to underground signup flow
--   (Founder ruling 2026-06-08). The WHERE predicate now guards name matching
--   with c.type <> 'underground' so underground leaders can only be found via
--   their public church_code (RPL Network ID). Safe.
--
-- Concern 2 — church_code ILIKE vs lower() normalisation:
--   The name predicate uses lower(u.full_name) LIKE '%' || v_q || '%' where
--   v_q is already lowercased. The church_code predicate uses ILIKE directly
--   with the raw p_query (not v_q) to preserve case-insensitive matching
--   without double-lowercasing. This is correct but inconsistent in style.
--   Alternative: lower(c.church_code) LIKE '%' || v_q || '%' — same behaviour,
--   more consistent. Either is safe; flagged for Founder/SM style preference.
--
-- Concern 3 — NULL church_code rows:
--   churches.church_code is assigned on verification. Pending/unverified
--   churches may have church_code = NULL. ILIKE against NULL evaluates to NULL
--   (not true, not false), so NULL church_code rows simply don't match the
--   church_code arm — correct behaviour, no crash risk. The name arm still
--   works for those leaders (if they're verified users of a verified church,
--   their church should have a church_code — but the null case is handled).
--
-- Concern 4 — FE hint copy in LeaderSearch.tsx (line 228):
--   Currently reads: "Search the network by a leader's name, church name,
--   or RPL Network ID." After this migration, church name searching is removed.
--   A FE copy update is required to drop "church name" from that hint.
--   This is a zero-risk cosmetic change but should accompany the migration deploy.
--
-- No new tables. No DROP. No data mutation. CREATE OR REPLACE only.
-- SAFE TO APPLY once Concern 1 (underground discoverability intent) is
-- confirmed by Founder.
