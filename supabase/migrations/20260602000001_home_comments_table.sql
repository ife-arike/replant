-- Home tab comments layer — Migration 2 of 3: public.comments + RLS
--
-- The comments thread on Home-tab announcement / leader-word / link cards.
-- This table holds the words leaders speak to one another under network posts.
-- Some of those leaders serve underground; their identity is a covering, not a
-- preference. Masking here is SERVER-ENFORCED in the post_comment RPC
-- (Migration 3) and can never be overridden by a client. is_masked +
-- masked_region are written by the RPC from the caller's church type — the
-- client supplies neither.
--
-- RLS posture mirrors KAN-214 branches: SELECT-only for authenticated verified
-- leaders. No INSERT / UPDATE / DELETE policies — the ONLY write path is the
-- post_comment SECURITY DEFINER RPC. A hand-crafted PostgREST insert from
-- `authenticated` returns permission-denied, so the masking rule cannot be
-- bypassed by a client forging is_masked=false.

BEGIN;

CREATE TABLE public.comments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  uuid        NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  -- Spec: author_id references auth.users(id). Audit-only — NEVER returned to
  -- a client (D-56 / D-64). get_comments resolves display identity server-side.
  author_id        uuid        NOT NULL REFERENCES auth.users(id),
  body             text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Held-identity covering. Set by post_comment from the caller's church type.
  is_masked        boolean     NOT NULL DEFAULT false,
  -- Region LABEL only (e.g. "Sub-Saharan Africa") when masked; NULL otherwise.
  -- Never a city, country, church name, or leader name.
  masked_region    text        NULL
);

-- Hot path: get_comments scans one announcement's thread chronologically.
CREATE INDEX comments_announcement_id_created_at_idx
  ON public.comments (announcement_id, created_at ASC);

COMMENT ON TABLE public.comments IS
  'Home-tab announcement comments. Writes only via post_comment RPC. is_masked/masked_region are server-enforced for underground leaders; clients cannot set them.';
COMMENT ON COLUMN public.comments.author_id IS
  'auth.users(id). Audit-only — never returned to clients (D-56/D-64). Display identity resolved server-side in get_comments.';
COMMENT ON COLUMN public.comments.masked_region IS
  'Coarse macro-region label only when is_masked. No city/country/church/name. Protects underground authors.';

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated verified leaders may read all comments on POSTED
-- announcements (is_active = true AND published_at <= now()). Join to
-- public.users on auth_id = auth.uid() (the established codebase pattern;
-- public.users.id is the app PK, auth_id is the auth.users reference) and
-- require verification_status = 'verified'.
--
-- Note: although the SELECT policy permits direct reads of posted-announcement
-- comments, the client path is get_comments (Migration 3), which additionally
-- strips author_id and resolves masked display identity. The policy is the
-- backstop; the RPC is the contract.
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_active = true
        AND u.verification_status = 'verified'
    )
    AND EXISTS (
      SELECT 1
      FROM public.announcements a
      WHERE a.id = comments.announcement_id
        AND a.is_active = true
        AND a.published_at <= now()
    )
  );

-- INSERT: blocked directly. All inserts flow through post_comment (Migration 3),
-- which runs SECURITY DEFINER and applies the masking rule. No INSERT policy is
-- defined, so direct inserts from `authenticated` are denied.

-- UPDATE / DELETE: blocked for all roles. No policies defined; comments are
-- immutable from the client. (ON DELETE CASCADE from announcements still applies
-- at the table level for admin announcement teardown.)

COMMIT;
