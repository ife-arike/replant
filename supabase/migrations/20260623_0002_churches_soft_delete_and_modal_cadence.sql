-- 20260623_0002_churches_soft_delete_and_modal_cadence.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 2 of 8
--
-- Locked Founder rulings (2026-06-22):
--   Q1 — soft-delete trio mirror on churches (last-active-leader trigger
--        defers to fn_soft_delete_my_account orchestration).
--   Q2 — server-side modal cadence (Day-14 hybrid). DBA F8 — last_outcome_*
--        columns survive reinstall/device-swap.
--   Q3 — rejection_reason_code (8-value), appeal lifecycle (5-value).
--   Reasons matrix uses same 6-value enum as users (manifest §1).
--
-- Reference: docs/build_manifest_underground_queue.md §1 (public.churches).
-- =============================================================================

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS soft_delete_reason text,
  ADD COLUMN IF NOT EXISTS hard_delete_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS hard_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outcome_modal_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outcome_modal_kind text,
  ADD COLUMN IF NOT EXISTS rejection_reason_code text,
  ADD COLUMN IF NOT EXISTS rejection_reason_meta jsonb,
  ADD COLUMN IF NOT EXISTS appeal_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS appeal_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_email_thread_id text;

-- soft_delete_reason — 6 values (matches users).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.churches'::regclass
      AND conname = 'churches_soft_delete_reason_check'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_soft_delete_reason_check
      CHECK (soft_delete_reason IS NULL OR soft_delete_reason IN (
        'leader_initiated',
        'admin_deactivation',
        'verification_lapse',
        'underground_join_code_compromised',
        'reported_violation',
        'safety_evacuation'
      ));
  END IF;
END $$;

-- last_outcome_modal_kind — 6 values per manifest §1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.churches'::regclass
      AND conname = 'churches_last_outcome_modal_kind_check'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_last_outcome_modal_kind_check
      CHECK (last_outcome_modal_kind IS NULL OR last_outcome_modal_kind IN (
        'verified',
        'rejected',
        'request_info',
        'pre_removal_day_23',
        'visibility_flipped',
        'join_code_rotated'
      ));
  END IF;
END $$;

-- rejection_reason_code — 8 values per manifest §1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.churches'::regclass
      AND conname = 'churches_rejection_reason_code_check'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_rejection_reason_code_check
      CHECK (rejection_reason_code IS NULL OR rejection_reason_code IN (
        'identity_unconfirmed',
        'church_unconfirmed',
        'insufficient_evidence',
        'contact_unreachable',
        'out_of_scope',
        'safety_concern',
        'duplicate_registration',
        'other'
      ));
  END IF;
END $$;

-- appeal_status — 5 values per manifest §1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.churches'::regclass
      AND conname = 'churches_appeal_status_check'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_appeal_status_check
      CHECK (appeal_status IN (
        'none',
        'email_received',
        'in_review',
        'resolved_restore',
        'resolved_uphold'
      ));
  END IF;
END $$;

-- Coherence: hard_deleted_at implies soft_deleted_at + hard_delete_scheduled_at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.churches'::regclass
      AND conname = 'churches_hard_delete_implies_soft_delete'
  ) THEN
    ALTER TABLE public.churches
      ADD CONSTRAINT churches_hard_delete_implies_soft_delete
      CHECK (
        hard_deleted_at IS NULL
        OR (soft_deleted_at IS NOT NULL AND hard_delete_scheduled_at IS NOT NULL)
      );
  END IF;
END $$;

-- Sweeper performance — find expired soft-deleted churches.
CREATE INDEX IF NOT EXISTS idx_churches_hard_delete_due
  ON public.churches (hard_delete_scheduled_at)
  WHERE hard_deleted_at IS NULL AND hard_delete_scheduled_at IS NOT NULL;

-- Queue performance — pending underground rejections by appeal status.
CREATE INDEX IF NOT EXISTS idx_churches_appeal_status_active
  ON public.churches (appeal_status, soft_deleted_at)
  WHERE soft_deleted_at IS NOT NULL AND hard_deleted_at IS NULL;
