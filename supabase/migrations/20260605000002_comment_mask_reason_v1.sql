-- Two-axis masking — schema migration (CC ruling 2026-06-05).
--
-- Root cause: a single is_masked boolean conflated name masking + church masking
-- + reason, which made it impossible to show the church name for public-anon
-- leaders while still masking their identity. Fix: replace with a mask_reason
-- enum as the single source of truth; is_masked becomes a GENERATED column
-- (backward compat for existing readers and the invariant test).
--
-- New cases:
--   none        → not masked at all
--   anon        → public leader with users.anonymous=true (name hidden, CHURCH SHOWN)
--   underground → underground church type (name hidden, church OR region per
--                 churches.show_church_name)
--   no_church   → no church_id on record; safe full mask; should not occur in
--                 production with a healthy sign-up flow
--
-- Also adds:
--   churches.show_church_name — underground display preference, set by the
--     founding leader at sign-up, immutable without admin action.
--   public.macro_region_label() — IMMUTABLE helper, deduplicated from post_comment.
--   CHECK: masked_region IS NULL OR mask_reason = 'underground'

BEGIN;

-- ─── 1. mask_reason enum ─────────────────────────────────────────────────────
CREATE TYPE public.mask_reason AS ENUM ('none', 'anon', 'underground', 'no_church');

-- ─── 2. macro_region_label helper ────────────────────────────────────────────
-- IMMUTABLE so it can be used safely in any context including generated columns.
CREATE OR REPLACE FUNCTION public.macro_region_label(r public.macro_region)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE r
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
$$;

-- ─── 3. churches.show_church_name ────────────────────────────────────────────
-- Underground display preference. Set by the founding leader at sign-up.
-- Immutable after creation unless Replant admin changes it.
-- true  → show church name in the app.
-- false → show region label only (region MUST always display if church is withheld).
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS show_church_name boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.churches.show_church_name IS
  'Underground display preference: true = show church name; false = show region label only. Set by founding leader at sign-up, immutable without admin action.';

-- ─── 4. Add mask_reason to comments ──────────────────────────────────────────
-- is_masked still exists at this point (plain boolean) so the backfill can read it.
ALTER TABLE public.comments
  ADD COLUMN mask_reason public.mask_reason NOT NULL DEFAULT 'none';

-- ─── 5. Backfill ─────────────────────────────────────────────────────────────
-- Derive mask_reason from the existing is_masked + masked_region + user.anonymous.
-- masked_region IS NOT NULL → was set only for underground (per original logic).
UPDATE public.comments c
SET mask_reason = CASE
  WHEN NOT c.is_masked                  THEN 'none'::public.mask_reason
  WHEN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_id = c.author_id
      AND u.anonymous = true
  )                                     THEN 'anon'::public.mask_reason
  WHEN c.masked_region IS NOT NULL      THEN 'underground'::public.mask_reason
  ELSE                                       'no_church'::public.mask_reason
END;

-- ─── 6. Check constraint ─────────────────────────────────────────────────────
-- masked_region is only ever written for underground rows. Enforce it as an
-- invariant so a future bug can never leak region for an anon or no_church row.
ALTER TABLE public.comments
  ADD CONSTRAINT comments_masked_region_only_underground
  CHECK (masked_region IS NULL OR mask_reason = 'underground');

-- ─── 7. Replace is_masked with GENERATED column ──────────────────────────────
-- Drop the stored boolean; re-add as a computed column derived from mask_reason.
-- All existing reads of is_masked continue to work. Writes to is_masked are now
-- a compile-time error (generated columns can't be written), which is correct —
-- all masking must go through mask_reason.
ALTER TABLE public.comments DROP COLUMN is_masked CASCADE;

ALTER TABLE public.comments
  ADD COLUMN is_masked boolean
  GENERATED ALWAYS AS (mask_reason <> 'none') STORED;

COMMENT ON COLUMN public.comments.mask_reason IS
  'Single source of truth for row masking. is_masked is derived from this. See mask_reason enum for case semantics.';

COMMIT;
