-- 20260623_0007_hard_delete_sweeper.sql
-- =============================================================================
-- Underground Verification Queue — DBA migration 7 of 8
--
-- Locked Founder ruling (2026-06-22, Q3 — PATTERN B+ tombstone within window):
--   Day 30 hard-delete = PII scrub on public.users (full_name/phone/email
--   rewritten to deleted+<uuid>@projectreplant.org to free unique slot;
--   location/photo/honorific nulled) + skeleton row stays + auth.users
--   row DELETED. Tombstone preserves audit_log_underground FKs (Psalm 56:8 —
--   tears in the bottle).
--
-- Critical invariants (per dispatch §CRITICAL DESIGN INVARIANTS):
--   - auth.users ↔ public.users are DECOUPLED (no FK). The sweeper
--     orchestrates BOTH deletes in one SECURITY DEFINER transaction.
--   - users_email_key is UNCONDITIONAL UNIQUE — tombstone email MUST be
--     rewritten to deleted+<uuid>@projectreplant.org to free the slot.
--   - audit_log_underground.accessed_by FK is ON DELETE NO ACTION —
--     physically blocks DELETE of public.users. Tombstone via UPDATE preserves
--     the FK. We DO NOT delete public.users.
--   - Audit-before-content: write 'underground_hard_delete_executed' BEFORE
--     the destructive operation.
--   - 5 CASCADE FKs on public.users(id) (comments, heartcry_holds,
--     intercession_holds, prayer_request_prayed_by, testimony_celebrated_by)
--     will NEVER fire — we tombstone (UPDATE), never DELETE the users row.
--
-- Schedule: pg_cron daily at 03:00 UTC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_hard_delete_expired_soft_deletes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  v_user RECORD;
  v_is_underground boolean;
  v_remaining_active_leaders integer;
BEGIN
  -- Find all users whose hard-delete is due and not yet executed.
  FOR v_user IN
    SELECT u.id, u.auth_id, u.church_id, u.email, u.soft_delete_reason
      FROM public.users u
      WHERE u.hard_delete_scheduled_at IS NOT NULL
        AND u.hard_delete_scheduled_at <= now()
        AND u.hard_deleted_at IS NULL
      ORDER BY u.hard_delete_scheduled_at
  LOOP
    v_is_underground := EXISTS (
      SELECT 1 FROM public.churches WHERE id = v_user.church_id AND type = 'underground'
    );

    -- AUDIT BEFORE CONTENT (invariant). Underground deletions go to
    -- audit_log_underground; we capture the about-to-be-scrubbed identity
    -- in meta so the bottle still holds the tears.
    IF v_is_underground THEN
      INSERT INTO public.audit_log_underground (action, church_id, accessed_by, triggered_by, meta)
        VALUES (
          'underground_hard_delete_executed',
          v_user.church_id,
          v_user.id,
          NULL,
          jsonb_build_object(
            'soft_delete_reason', v_user.soft_delete_reason,
            'scrubbed_email_hash', encode(digest(coalesce(v_user.email, ''), 'sha256'), 'hex'),
            'scrubbed_at', now()
          )
        );
    END IF;

    -- CONTENT step 1: scrub PII on public.users (tombstone, preserve FKs).
    -- Email rewrite frees the UNIQUE slot for re-signup.
    UPDATE public.users
      SET full_name = '[redacted]',
          first_name = '[redacted]',
          middle_name = '',
          last_name = '[redacted]',
          honorific = NULL,
          suffix = NULL,
          phone = NULL,
          email = 'deleted+' || v_user.id::text || '@projectreplant.org',
          hard_deleted_at = now()
      WHERE id = v_user.id;

    -- CONTENT step 2: delete auth.users row. JWT can't refresh; sessions die
    -- naturally on next refresh cycle. Decoupled — no FK to navigate.
    IF v_user.auth_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = v_user.auth_id;
    END IF;

    -- CONTENT step 3: if this was the last active leader on an underground
    -- (or any) church, tombstone the church row too.
    IF v_user.church_id IS NOT NULL THEN
      SELECT count(*) INTO v_remaining_active_leaders
        FROM public.users
        WHERE church_id = v_user.church_id
          AND hard_deleted_at IS NULL
          AND is_active = true
          AND soft_deleted_at IS NULL;
      IF v_remaining_active_leaders = 0 THEN
        UPDATE public.churches
          SET hard_deleted_at = now()
          WHERE id = v_user.church_id
            AND hard_deleted_at IS NULL
            AND soft_deleted_at IS NOT NULL
            AND hard_delete_scheduled_at IS NOT NULL
            AND hard_delete_scheduled_at <= now();
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_hard_delete_expired_soft_deletes() FROM public;
-- No GRANT to authenticated — system-only.

-- ---------------------------------------------------------------------------
-- Schedule: daily 03:00 UTC via pg_cron. Idempotent — unschedule prior job
-- by name (if any) then schedule fresh.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='underground_hard_delete_sweeper_daily') THEN
    PERFORM cron.unschedule('underground_hard_delete_sweeper_daily');
  END IF;
END $$;

SELECT cron.schedule(
  'underground_hard_delete_sweeper_daily',
  '0 3 * * *',
  $$SELECT public.fn_hard_delete_expired_soft_deletes();$$
);
