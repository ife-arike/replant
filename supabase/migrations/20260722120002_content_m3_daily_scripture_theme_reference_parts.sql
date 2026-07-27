-- KAN-324 / KAN-326 — Content section, M3: daily_scripture theme + reference parts
--
-- Adds a curated `theme` axis (nullable; curated later, not backfilled here)
-- plus structured book/chapter/verse columns parsed from the canonical
-- `reference` string. `reference` stays NOT NULL and is the source of truth;
-- the parts are derived for filtering/sorting.
--
-- Backfill parse (verified read-only 2026-07-22 against all 108 live rows):
--   107 rows match  <book> <chapter>:<verse_start>[-<verse_end>]  and parse
--       cleanly (book captures numeric-prefixed names like "1 Corinthians").
--     1 row is  'Psalm 90:2,4'  (a comma, non-contiguous verse list): it gets
--       book + chapter only; verse_start/verse_end stay NULL, since a comma
--       list cannot be expressed as a single start-end range.
--     0 chapter-only rows exist.
--
-- Semantics: verse_end IS NULL denotes a single verse (= verse_start);
-- a non-null verse_end denotes an inclusive range.
--
-- theme is nullable + CHECK-guarded (NULL allowed) and is NOT backfilled;
-- existing rows keep theme NULL until an admin curates them.
--
-- Live schema verified read-only before authoring: theme / book / chapter /
-- verse_start / verse_end all absent; reference NOT NULL; scripture_date UNIQUE.
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

-- theme: curated vocabulary, nullable (NULL = uncurated). 20 values.
ALTER TABLE public.daily_scripture ADD COLUMN theme text;

ALTER TABLE public.daily_scripture ADD CONSTRAINT daily_scripture_theme_check
  CHECK (theme IS NULL OR theme = ANY (ARRAY[
    'Perseverance','Suffering','Joy','Boldness','Faith','Grace','Endurance',
    'Hope','Courage','Comfort','Forgiveness','Unity','Prayer','Witness',
    'Provision','Protection','Peace','Love','Truth','Rest'
  ]));

-- Structured reference parts (all nullable; reference remains canonical).
ALTER TABLE public.daily_scripture ADD COLUMN book        text;
ALTER TABLE public.daily_scripture ADD COLUMN chapter     integer;
ALTER TABLE public.daily_scripture ADD COLUMN verse_start integer;
ALTER TABLE public.daily_scripture ADD COLUMN verse_end   integer;

-- Pass 1 — clean rows: <book> <chapter>:<verse_start>[-<verse_end>]
-- regexp_match groups: [1]=book [2]=chapter [3]=verse_start
-- [4]=verse_end (NULL for a single verse). Correlated per-row on reference.
UPDATE public.daily_scripture
   SET book        = (regexp_match(reference, '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'))[1],
       chapter     = (regexp_match(reference, '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'))[2]::int,
       verse_start = (regexp_match(reference, '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'))[3]::int,
       verse_end   = (regexp_match(reference, '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'))[4]::int
 WHERE reference ~ '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$';

-- Pass 2 — reference that is NOT a clean single/range but still carries a
-- parseable book+chapter (the 'Psalm 90:2,4' comma-list row): book + chapter
-- only, verses left NULL.
UPDATE public.daily_scripture
   SET book    = (regexp_match(reference, '^(.+?)\s+(\d+):'))[1],
       chapter = (regexp_match(reference, '^(.+?)\s+(\d+):'))[2]::int
 WHERE reference !~ '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'
   AND reference ~  '^(.+?)\s+(\d+):';

-- Sanity: no scripture row is left mis-parsed (guards the data leaders see).
DO $$
DECLARE
  v_bad_parts  integer;
  v_bad_verses integer;
BEGIN
  SELECT count(*) INTO v_bad_parts
    FROM public.daily_scripture
   WHERE reference ~ '^(.+?)\s+(\d+):'
     AND (book IS NULL OR chapter IS NULL);
  IF v_bad_parts > 0 THEN
    RAISE EXCEPTION 'daily_scripture: % row(s) with parseable reference left NULL book/chapter', v_bad_parts;
  END IF;

  SELECT count(*) INTO v_bad_verses
    FROM public.daily_scripture
   WHERE reference ~ '^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$'
     AND verse_start IS NULL;
  IF v_bad_verses > 0 THEN
    RAISE EXCEPTION 'daily_scripture: % clean-reference row(s) left NULL verse_start', v_bad_verses;
  END IF;
END $$;

COMMIT;
