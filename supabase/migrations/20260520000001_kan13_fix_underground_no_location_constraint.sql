-- KAN-13 bug fix: relax underground_no_location constraint to allow country.
--
-- Original constraint required country IS NULL for underground churches.
-- Product decision (KAN-13, 2026-05-19): country is retained for internal
-- categorisation only — never shown publicly. The original constraint was
-- applied before this product ruling and was never updated to match it.
--
-- New constraint: underground churches must have lat / lng / city = NULL,
-- but country is permitted (admin-only, never surfaced to other leaders).

ALTER TABLE public.churches
  DROP CONSTRAINT underground_no_location;

ALTER TABLE public.churches
  ADD CONSTRAINT underground_no_location
  CHECK (
    (type <> 'underground'::church_type)
    OR (lat IS NULL AND lng IS NULL AND city IS NULL)
  );
