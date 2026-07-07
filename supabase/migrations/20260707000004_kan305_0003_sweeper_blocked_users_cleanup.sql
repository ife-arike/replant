-- 20260707000004_kan305_0003_sweeper_blocked_users_cleanup.sql
-- =============================================================================
-- KAN-305 — Block User: enforcement layer, file 3 of 3.
--
-- Extend the Day-30 hard-delete sweeper to remove block rows for a scrubbed
-- account (DBA §8.1). This is REQUIRED, not belt-and-braces: the sweeper
-- UPDATE-scrubs public.users in place (tombstone name/email, set
-- hard_deleted_at) and only DELETEs auth.users. The public.users row is never
-- deleted, so the blocked_users FK `ON DELETE CASCADE` NEVER fires. Without
-- this explicit cleanup:
--   - the deleted account's own outbound blocks would linger (moot — the
--     account is gone), and
--   - OTHER leaders' blocks OF the scrubbed tombstone would ghost-populate
--     their blocked lists (a '[redacted]' entry that can never be unblocked
--     meaningfully).
-- Delete BOTH directions inside the per-user loop.
--
-- ⚠ MIRROR-ON-FILE — DO NOT AUTO-APPLY.
--
-- Dependency + baseline: this CREATE OR REPLACE carries the fn body
-- LIVE-VERBATIM as of 2026-07-07 (the KAN-205 version landed by migration
-- 20260707000001 — non-UG account_hard_deleted audit row, scrubbed-email hash,
-- structured-name tombstone) PLUS the two block-cleanup DELETEs. It is authored
-- to apply AFTER 20260707000001. Authoring the whole body (rather than a bare
-- ALTER) keeps this file self-consistent and re-diffable against live; if live
-- has drifted further, re-diff before applying. The pg_cron job (jobid 5,
-- `0 3 * * *`) calls this function by name — no re-schedule needed.
-- =============================================================================

BEGIN;

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

    -- AUDIT BEFORE CONTENT (invariant). UG rows keep the underground sink;
    -- non-UG rows land in the main audit_log (KAN-205 / SEC §7).
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
    ELSE
      INSERT INTO public.audit_log (accessed_by, triggered_by, action, church_id, meta)
        VALUES (
          NULL,
          'system',
          'account_hard_deleted',
          v_user.church_id,
          jsonb_build_object(
            'user_id', v_user.id,
            'soft_delete_reason', v_user.soft_delete_reason,
            'scrubbed_email_hash', encode(digest(coalesce(v_user.email, ''), 'sha256'), 'hex'),
            'scrubbed_at', now()
          )
        );
    END IF;

    -- CONTENT step 1: scrub PII on public.users (tombstone, preserve FKs).
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

    -- CONTENT step 1b (KAN-305): remove this account's block rows in BOTH
    -- directions. The FK CASCADE cannot fire (the row is scrubbed, not
    -- deleted), so this is the only cleanup. Removing the reverse direction
    -- prevents a scrubbed tombstone from ghosting in other leaders' lists.
    DELETE FROM public.blocked_users
      WHERE blocker_id = v_user.id OR blocked_id = v_user.id;

    -- CONTENT step 2: delete auth.users row.
    IF v_user.auth_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = v_user.auth_id;
    END IF;

    -- CONTENT step 3: last-leader church tombstone.
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
-- No GRANT to authenticated — system-only (pg_cron).

COMMIT;
