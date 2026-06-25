-- KAN-271 Migration 0030 — replant_staff role
-- Founder ratified 2026-06-24: new admin invitees with no Replant account get
-- role='replant_staff' (server-set only; never in any public/signup dropdown).
-- Only fn_invite_admin sets this value. Mobile signup dropdown filtering is a
-- follow-up KAN paired with the dashboard-only mobile sign-in gate.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'replant_staff';
