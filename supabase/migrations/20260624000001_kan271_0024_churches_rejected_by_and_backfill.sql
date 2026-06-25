-- KAN-271 / Workstream B ratification #2 — denormalize rejected_by onto churches
-- so the Rejected detail page can render "Rejected by X · proposed by Y" without
-- always re-joining audit_log_underground. FK to public.users(id) (matches the
-- denormalization pattern already used elsewhere on churches: profile_completion_done_by,
-- verified_by, etc.).
--
-- Applied to remote via MCP apply_migration on 2026-06-24; this file mirrors the
-- change into source control so the migration history stays canonical.

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_churches_rejected_by
  ON public.churches(rejected_by) WHERE rejected_by IS NOT NULL;

-- Backfill from audit_log_underground (latest underground_confirm_reject per church).
-- DISTINCT ON pattern: ORDER BY church_id, accessed_at DESC takes the most recent
-- confirm-reject actor as the denormalized rejected_by. Safe: append-only table,
-- ordering is stable.
UPDATE public.churches c
   SET rejected_by = sub.accessed_by
  FROM (
    SELECT DISTINCT ON (church_id) church_id, accessed_by
      FROM public.audit_log_underground
      WHERE action = 'underground_confirm_reject'
      ORDER BY church_id, accessed_at DESC
  ) sub
 WHERE c.id = sub.church_id
   AND c.rejected_at IS NOT NULL
   AND c.rejected_by IS NULL;

COMMENT ON COLUMN public.churches.rejected_by IS
  'KAN-272 Rejected detail page — denormalized confirmer (B) of the rejection. '
  'Pair with underground_verification_proposals.proposer_id for the "Rejected by '
  'X · proposed by Y" strip. Set by fn_confirm_underground_proposal reject branch; '
  'cleared by restore branch.';
