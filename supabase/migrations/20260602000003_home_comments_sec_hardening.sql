-- Home tab comments layer — SEC hardening follow-up (3 non-blocking gaps)
--
-- SEC stamped Migrations 1–3 (table + RLS, trigger + RPCs) with three
-- non-blocking hardening observations. This migration closes all three.
--
--   Fix A — comment_count decrement on DELETE. The insert trigger bumps the
--           denormalised announcements.comment_count, but nothing decremented
--           it. ON DELETE CASCADE from announcements tears the whole row down
--           so the count is moot there, but a single comment delete (admin
--           teardown of one comment, or future moderation) left the count
--           stale. Companion AFTER DELETE trigger, floored at 0.
--
--   Fix B — link_url scheme allowlist. announcements.link_url is admin-seeded
--           only, but a DB-layer CHECK that permits only http(s) blocks
--           javascript:/data:/file: and other dangerous schemes as
--           defence-in-depth, independent of any application-layer guard.
--
--   Fix C — explicit REVOKE on public.comments. Supabase defaults grant
--           INSERT/UPDATE/DELETE to authenticated + anon. These are inert
--           under the current RLS (no permissive write policy exists — the
--           sole write path is the post_comment SECURITY DEFINER RPC), but
--           explicit revocation makes the no-direct-write posture durable: a
--           future accidental permissive policy cannot silently activate them.

BEGIN;

-- ─── Fix A. comment_count decrement trigger ───────────────────────
-- AFTER DELETE on public.comments: decrement the parent announcement's
-- denormalised count, floored at 0 so it can never go negative. SECURITY
-- DEFINER + search_path='' to mirror tg_after_comment_insert exactly.
CREATE OR REPLACE FUNCTION public.tg_after_comment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.announcements
  SET comment_count = GREATEST(comment_count - 1, 0)
  WHERE id = OLD.announcement_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER after_comment_delete
  AFTER DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_after_comment_delete();

-- ─── Fix B. link_url scheme allowlist CHECK ───────────────────────
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_link_url_scheme CHECK (
    link_url IS NULL OR link_url ~* '^https?://'
  );

-- ─── Fix C. explicit REVOKE of direct writes on public.comments ───
REVOKE INSERT, UPDATE, DELETE ON public.comments FROM authenticated, anon;

COMMIT;
