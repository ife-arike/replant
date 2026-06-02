-- Home tab comments layer — Migration 1 of 3: announcement enrichment columns
--
-- D-64 (2 June 2026): announcements.author_type = 'leader' creates a named
-- exception to D-56. For leader-authored network posts, the author's
-- public.users.full_name and church name surface to verified leaders in-app.
-- author_id remains audit-only and is NEVER returned to clients directly.
-- Founder-approved as part of the Home tab redesign (home-tab-handoff,
-- 2026-06-02).
--
-- D-56 context (unchanged): mobile shows "Replant Team" for all admin-authored
-- posts. author_type='admin' is the default and preserves that behaviour. The
-- 'leader' value is the sole new exception, and only the author's name + church
-- (never author_id) surface — see get_comments / leader-word rendering.
--
-- Three columns added to public.announcements:
--   link_url       — nullable external resource URL (LinkCard renders a framed
--                    link block when present). Admin-seeded.
--   author_type    — 'admin' (default, D-56 "Replant Team") | 'leader' (D-64).
--   comment_count  — denormalised count, kept in sync by the after_comment_insert
--                    trigger (Migration 3). NEVER written directly by clients;
--                    there is no client write path to announcements at all.

BEGIN;

ALTER TABLE public.announcements
  ADD COLUMN link_url text NULL;

ALTER TABLE public.announcements
  ADD COLUMN author_type text NOT NULL DEFAULT 'admin'
    CHECK (author_type IN ('admin', 'leader'));

ALTER TABLE public.announcements
  ADD COLUMN comment_count int4 NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.announcements.link_url IS
  'External resource URL (partner story / briefing). Nullable. Admin-seeded; mobile renders a framed link block when present.';
COMMENT ON COLUMN public.announcements.author_type IS
  'D-56/D-64: admin => "Replant Team"; leader => author full_name + church name surface to verified leaders (named D-56 exception). author_id stays audit-only.';
COMMENT ON COLUMN public.announcements.comment_count IS
  'Denormalised comment count. Maintained by after_comment_insert trigger only — never written by clients.';

COMMIT;
