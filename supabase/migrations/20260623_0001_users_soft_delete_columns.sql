-- 20260623_0001_users_soft_delete_columns.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 1 of 8
--
-- Locked Founder ruling (2026-06-22, Q1 — Soft-delete window login):
--   YES-WITH-CONDITIONS. Soft-delete trio added to public.users.
--   Existing sessions stay live; fresh logins route to gated shell.
--   See replant_continuous_spec.md §2026-06-22 mini-panel rulings.
--
-- Reference: docs/build_manifest_underground_queue.md §1 (public.users columns).
--
-- Decoupling invariant: auth.users ↔ public.users have NO FK. The hard-delete
-- sweeper orchestrates BOTH deletes in fn_hard_delete_expired_soft_deletes
-- (migration 0007). DO NOT add an FK here.
--
-- Founder UUID anchor: bb6c6385-236a-402a-9a6c-66ca3468fdf5 (Ruth James /
-- Maranatha Ministries / super_admin / ministry_leader). Per ruling #23 +
-- fallback B, Founder is_underground_admin = true by default.
-- =============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS soft_delete_reason text,
  ADD COLUMN IF NOT EXISTS hard_delete_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS hard_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_modal_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 6-value CHECK on soft_delete_reason (manifest §1). Idempotent via NOT EXISTS guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_soft_delete_reason_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_soft_delete_reason_check
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

-- Coherence: hard_deleted_at implies soft_deleted_at + hard_delete_scheduled_at populated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_hard_delete_implies_soft_delete'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_hard_delete_implies_soft_delete
      CHECK (
        hard_deleted_at IS NULL
        OR (soft_deleted_at IS NOT NULL AND hard_delete_scheduled_at IS NOT NULL)
      );
  END IF;
END $$;

-- Sweeper performance — find expired soft-deletes by scheduled timestamp.
CREATE INDEX IF NOT EXISTS idx_users_hard_delete_due
  ON public.users (hard_delete_scheduled_at)
  WHERE hard_deleted_at IS NULL AND hard_delete_scheduled_at IS NOT NULL;

-- Founder is_underground_admin = true (ruling #23, fallback B). Locked anchor.
UPDATE public.users
  SET is_underground_admin = true
  WHERE id = 'bb6c6385-236a-402a-9a6c-66ca3468fdf5'
    AND is_underground_admin = false;

COMMIT;

-- Verification (run from execute_sql, NOT inside the migration):
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='users'
--       AND column_name IN ('soft_deleted_at','soft_delete_reason',
--         'hard_delete_scheduled_at','hard_deleted_at',
--         'outcome_modal_acknowledged_at','last_seen_at');
--   SELECT is_underground_admin FROM public.users
--     WHERE id='bb6c6385-236a-402a-9a6c-66ca3468fdf5';
