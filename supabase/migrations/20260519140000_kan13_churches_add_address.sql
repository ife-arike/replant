-- kan13_churches_add_address: additive column for free-text street address.
--
-- KAN-13 register-church BE contract (c.10167) accepts `address` as an
-- optional string. The live `public.churches` schema had no such column,
-- which would have forced the BE function to silently discard the value
-- on insert (Underground path is fine — address is never collected for
-- Underground — but the KAN-14 non-Underground path WILL collect it and
-- the discard would be a hidden data loss).
--
-- DBA ruling (Founder, 2026-05-19): additive only, nullable, no default,
-- no index, no existing-data backfill. Single DBA stamp covers both
-- KAN-13 (this PR) and KAN-14 (future map-pin screen).
--
-- Schema version: v1.32.0 → v1.33.0.

ALTER TABLE public.churches
  ADD COLUMN address text NULL;
