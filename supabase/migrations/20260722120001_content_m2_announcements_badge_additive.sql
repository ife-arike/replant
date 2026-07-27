-- KAN-324 / KAN-326 — Content section, M2: announcements badge (ADDITIVE)
--
-- Introduces a dedicated `badge` axis for the visual pip on a card
-- (none | new | urgent), decoupled from the legacy `tag_type`.
--
-- tag_type is DELIBERATELY LEFT UNTOUCHED. The live mobile feed still
-- projects tag_type; renaming or dropping it now is an outage. This migration
-- only ADDS badge and backfills it from tag_type. Both columns coexist until
-- the feed reads badge.
--
-- Backfill mapping (tag_type -> badge):
--   urgent        -> urgent
--   new           -> new
--   notice        -> none
--   update        -> none
--   none / NULL   -> none   (already set by the column DEFAULT)
--
-- LATER-DROP PLAN (separate migration, gated on the mobile feed cutover):
--   1. Ship the feed reading `badge` (and topic/author_type from M1).
--   2. Confirm no code path references announcements.tag_type.
--   3. Then, in its own migration: ALTER TABLE public.announcements
--      DROP COLUMN tag_type;  (drops announcements_tag_type_check with it).
--   Do NOT fold that drop into this file.
--
-- Live schema verified read-only before authoring (2026-07-22): badge absent;
-- tag_type CHECK = (urgent, update, notice, new, none).
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

ALTER TABLE public.announcements
  ADD COLUMN badge text NOT NULL DEFAULT 'none';

ALTER TABLE public.announcements ADD CONSTRAINT announcements_badge_check
  CHECK (badge = ANY (ARRAY['none','new','urgent']));

-- Backfill: urgent/new map identically from tag_type; every other tag_type
-- value (notice, update, none, NULL) keeps the DEFAULT 'none'.
UPDATE public.announcements
   SET badge = tag_type
 WHERE tag_type IN ('urgent','new');

COMMIT;
