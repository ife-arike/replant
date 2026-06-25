-- 20260623_0004_underground_verification_proposals_table.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 4 of 8
--
-- Locked Founder rulings (2026-06-22):
--   #24 — Two-eyes confirmation on verify + join-code re-reveal. Admin A
--         proposes, admin B confirms. Modeled here.
--   Ruling #5 — Proposal TTL 72h, auto-cancel via cron.
--   no_self_confirm CHECK — proposer cannot be confirmer (SME panel
--         convergent finding (b) — DB-level CHECK on proposer_id <> confirmer_id).
--
-- Reference: docs/build_manifest_underground_queue.md §1 table definition.
--
-- Terminal-state immutability: once status is 'confirmed' | 'declined' |
--   'expired', the row cannot be UPDATEd. Trigger enforces this without
--   depending on raise_immutable_violation (which does not exist in this
--   project — verified via pg_proc lookup).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.underground_verification_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  action text NOT NULL CHECK (action IN (
    'verify',
    'reject',
    'rotate_join_code',
    'visibility_override',
    'hard_delete',
    'restore'
  )),
  proposer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  confirmer_id uuid REFERENCES public.users(id) ON DELETE NO ACTION,
  proposal_status text NOT NULL DEFAULT 'pending' CHECK (proposal_status IN (
    'pending', 'confirmed', 'declined', 'expired'
  )),
  rejection_reason text CHECK (rejection_reason IS NULL OR rejection_reason IN (
    'identity_unconfirmed', 'church_unconfirmed', 'insufficient_evidence',
    'contact_unreachable', 'out_of_scope', 'safety_concern',
    'duplicate_registration', 'other'
  )),
  contact_channel text CHECK (contact_channel IS NULL OR contact_channel IN (
    'signal', 'wire', 'in_person', 'letter', 'referring_leader_relay'
  )),
  evidence_tier text CHECK (evidence_tier IS NULL OR evidence_tier IN ('t1_referral', 't2_live_call')),
  visibility_direction text CHECK (visibility_direction IS NULL OR visibility_direction IN ('visible_to_hidden', 'hidden_to_visible')),
  relay_token_hash text,
  admin_notes text NOT NULL CHECK (char_length(admin_notes) >= 30),
  counter_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  confirmed_at timestamptz,
  CONSTRAINT no_self_confirm CHECK (proposer_id IS DISTINCT FROM confirmer_id)
);

-- Partial indexes — open work surface.
CREATE INDEX IF NOT EXISTS idx_uvp_church_pending
  ON public.underground_verification_proposals (church_id)
  WHERE proposal_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_uvp_expires_pending
  ON public.underground_verification_proposals (expires_at)
  WHERE proposal_status = 'pending';

-- Two-eyes integrity: at most one PENDING proposal per (church_id, action)
-- (SME panel convergent (b)). Prevents the race where two admins simultaneously
-- propose the same action on the same church.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_uvp_pending_per_church_action
  ON public.underground_verification_proposals (church_id, action)
  WHERE proposal_status = 'pending';

-- Terminal-state immutability trigger.
CREATE OR REPLACE FUNCTION public.fn_prevent_uvp_terminal_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.proposal_status IN ('confirmed', 'declined', 'expired') THEN
    RAISE EXCEPTION 'underground_verification_proposals terminal state immutable (status=%, id=%)',
      OLD.proposal_status, OLD.id
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_proposal_terminal_update ON public.underground_verification_proposals;
CREATE TRIGGER prevent_proposal_terminal_update
  BEFORE UPDATE ON public.underground_verification_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_uvp_terminal_update();

-- RLS: super_admin + is_underground_admin only.
ALTER TABLE public.underground_verification_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uvp_underground_admin_select ON public.underground_verification_proposals;
CREATE POLICY uvp_underground_admin_select
  ON public.underground_verification_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.is_underground_admin = true
        AND u.is_active = true
        AND u.soft_deleted_at IS NULL
    )
    OR ((auth.jwt() ->> 'super_admin')::boolean = true)
  );

-- All writes go through SECURITY DEFINER RPCs (migration 0008). Block any
-- direct INSERT/UPDATE/DELETE outside the RPC path.
DROP POLICY IF EXISTS uvp_no_direct_write ON public.underground_verification_proposals;
CREATE POLICY uvp_no_direct_write
  ON public.underground_verification_proposals
  FOR ALL
  USING (false)
  WITH CHECK (false);
