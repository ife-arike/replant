-- KAN-324 / KAN-326 — Content section, M1: announcements core
--
-- Additive schema for the Content section that carries scripture, testimony,
-- and corrections to leaders. Three changes on public.announcements:
--   1. topic         NOT NULL classification (backfilled 'update' for the
--                    existing feed; every announcement declares a topic).
--   2. correction_of self-FK so a 'correction' card can point at the row it
--                    corrects; ON DELETE SET NULL (a purged original must not
--                    cascade-delete the correction record).
--   3. author_type   CHECK widened admin|leader -> admin|leader|partner|blog.
--
-- Live schema verified read-only before authoring (2026-07-22): topic and
-- correction_of absent; author_type CHECK = (admin, leader).
--
-- Rollout note: topic is NOT NULL with NO default (by design; badge in M2
-- carries the only default). Every INSERT path into announcements MUST set
-- topic explicitly once this is applied, or the insert fails. Coordinate the
-- app change with this migration.
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

-- 1. topic: add nullable, backfill the existing feed, then lock NOT NULL + CHECK.
ALTER TABLE public.announcements ADD COLUMN topic text;

UPDATE public.announcements SET topic = 'update' WHERE topic IS NULL;

ALTER TABLE public.announcements ALTER COLUMN topic SET NOT NULL;

ALTER TABLE public.announcements ADD CONSTRAINT announcements_topic_check
  CHECK (topic = ANY (ARRAY[
    'prayer','event','update','testimony','correction','word_for_today'
  ]));

-- 2. correction_of: self-referential FK; ON DELETE SET NULL keeps the
--    correction row if the corrected original is later removed. Partial index
--    (corrections are sparse) to look up "what corrects announcement X".
ALTER TABLE public.announcements ADD COLUMN correction_of uuid
  REFERENCES public.announcements(id) ON DELETE SET NULL;

CREATE INDEX idx_announcements_correction_of
  ON public.announcements (correction_of)
  WHERE correction_of IS NOT NULL;

-- 3. author_type: widen to admit partner + blog authorship.
ALTER TABLE public.announcements DROP CONSTRAINT announcements_author_type_check;

ALTER TABLE public.announcements ADD CONSTRAINT announcements_author_type_check
  CHECK (author_type = ANY (ARRAY['admin','leader','partner','blog']));

COMMIT;
