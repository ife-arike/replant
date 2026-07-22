-- KAN-324 / KAN-326 — Content section, M5: content_submissions intake table
--
-- New table for content proposed INTO the Content section from three sources:
--   leader  — a verified leader's own word_for_today / testimony / family_word
--   partner — a partner ministry (org identity)
--   blog    — syndicated blog content (org identity)
--
-- A submission is reviewed by an admin and, on approval, published into
-- public.announcements (published_announcement_id back-links the result).
--
-- Security posture: RLS ENABLED with NO policies -> deny-all for anon and
-- authenticated. All access is service_role (edge functions) / SECURITY
-- DEFINER RPCs, which bypass RLS. Client grants are also revoked as
-- defense-in-depth, matching the 2026-07-01 client-write-surface sweep.
--
-- Live schema verified read-only before authoring (2026-07-22):
-- public.content_submissions absent; users PK = id uuid; announcements present.
--
-- UNAPPLIED — files-only, pending DBA/SEC review. Not run against any database.

BEGIN;

CREATE TABLE public.content_submissions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                     text NOT NULL,
  type                       text NOT NULL,
  submitter_user_id          uuid REFERENCES public.users(id),
  submitter_org_name         text,
  submitter_email            text,
  title                      text,
  body                       text NOT NULL,
  link_url                   text,
  proposed_topic             text,
  status                     text NOT NULL DEFAULT 'pending',
  decline_reason             text,
  reviewed_by                uuid REFERENCES public.users(id),
  reviewed_at                timestamptz,
  published_announcement_id  uuid REFERENCES public.announcements(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz DEFAULT now(),

  CONSTRAINT content_submissions_source_check
    CHECK (source = ANY (ARRAY['leader','partner','blog'])),
  CONSTRAINT content_submissions_type_check
    CHECK (type = ANY (ARRAY['word_for_today','testimony','family_word'])),
  CONSTRAINT content_submissions_status_check
    CHECK (status = ANY (ARRAY[
      'pending','edits_pending_leader','approved','approved_with_edits','declined'
    ])),
  CONSTRAINT content_submissions_link_url_scheme
    CHECK (link_url IS NULL OR link_url ~* '^https?://'),
  -- A declined submission must carry a reason.
  CONSTRAINT content_submissions_decline_reason_present
    CHECK (status <> 'declined'
           OR (decline_reason IS NOT NULL AND btrim(decline_reason) <> '')),
  -- Submitter identity must be present per source:
  --   leader        -> submitter_user_id
  --   partner/blog  -> submitter_org_name OR submitter_email
  CONSTRAINT content_submissions_submitter_identity
    CHECK (
      (source = 'leader' AND submitter_user_id IS NOT NULL)
      OR (source IN ('partner','blog')
          AND (submitter_org_name IS NOT NULL OR submitter_email IS NOT NULL))
    )
);

CREATE INDEX idx_content_submissions_status_created_at
  ON public.content_submissions (status, created_at DESC);

-- Deny-all: RLS on with no policies; service_role bypasses. Revoke client
-- grants as belt-and-suspenders (REVOKE of an ungranted privilege is a no-op).
ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_submissions FROM anon, authenticated;

COMMIT;
