-- kan137_pastoral_digest_v1: schema v1.31.0 → v1.32.0
--
-- KAN-137 pastoral notification infrastructure:
--   1. pg_net extension enabled (required for emit_pastoral_digest's
--      outbound Resend call — standard Supabase pattern for HTTP from
--      a SECURITY DEFINER RPC).
--   2. email_log.outcome column for emit-outcome observability
--      (sent | suppressed_empty_queue | suppressed_rate_limit |
--      failed_resend_emit).
--   3. audit_log_action_check 28 → 29 (adds pastoral_digest_emitted).
--   4. emit_pastoral_digest() RPC — hardened per ADR-009:
--      SECURITY DEFINER + SET search_path + REVOKE PUBLIC + GRANT EXECUTE
--      TO service_role only. Advisory-lock idempotent on concurrent
--      invocation. RAISE WARNING (not EXCEPTION) on Resend failure —
--      cron never throws.
--   5. pg_cron daily schedule at 09:00 UTC, idempotent re-schedule.
--
-- SM rulings folded in (post-KAN-137 dispatch / Founder-ratified):
--   - Resend FROM/TO = info@projectreplant.org (OPS c.11752 deviation;
--     supersedes ticket text 'connect@'; ratified before this build).
--   - email_log.user_id internal forensic anchor = the pastoral lead
--     user (single lead per D-26 at MVP; resolved via email lookup on
--     ruth@projectreplant.org). The Resend payload's TO carries the
--     shared inbox address; email_log.user_id is the internal user
--     attribution. When the pastoral lead changes (multi-lead post-MVP),
--     this lookup target bumps.
--   - Upstash key for T1 emit rate limit (pastoral-t1-email-emit:{leader_id})
--     lives in the ~/replant-admin handler scope; out of this migration.
--
-- SEC c.11750 hardening conditions satisfied by this RPC:
--   #1 (no leader-identifying data in any payload) — Resend body
--      carries AGGREGATE counts only (t1_count, t2_count, deferred_count)
--      + opaque deep link. No leader_id, message_id, content, flag_reason.
--   #2 (ADR-009 SECURITY DEFINER hardening) — SET search_path = pg_catalog,
--      public + REVOKE PUBLIC + GRANT service_role only.
--   #4 (failure containment) — RAISE WARNING only; never RAISE EXCEPTION.
--   #5 (advisory-lock idempotency) — pg_try_advisory_lock at function
--      entry; concurrent invocation exits cleanly.
--   #6 (cross-definer chain audit) — chain documented in function
--      comment: pg_cron → emit_pastoral_digest → net.http_post → Resend.
--      No sensitive data in chain at any layer.

-- ============================================================
-- Part 1: pg_net extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- Part 2: email_log.outcome column
-- ============================================================
ALTER TABLE public.email_log
  ADD COLUMN outcome TEXT NOT NULL DEFAULT 'sent'
  CHECK (outcome IN (
    'sent',
    'suppressed_empty_queue',
    'suppressed_rate_limit',
    'failed_resend_emit'
  ));

COMMENT ON COLUMN public.email_log.outcome IS
  'KAN-137 emit-outcome observability. sent = Resend enqueue succeeded; suppressed_empty_queue = cron digest skipped (no pending pastoral signals); suppressed_rate_limit = T1 alert skipped (per-leader hourly cap hit upstream in BE); failed_resend_emit = enqueue / Resend API error (RAISE WARNING fired in RPC; cron continued).';

-- ============================================================
-- Part 3: audit_log_action_check 28 → 29
-- ============================================================
-- DROP/ADD pattern per KAN-130/132/KAN-125 P1.1 precedent. Pre-flight
-- verified 2026-05-11: existing constraint has 28 actions ending with
-- pastoral_signal_seen + pastoral_signal_dispositioned + pastoral_
-- context_expanded (KAN-125 P1.1; note: third name is pastoral_context_
-- expanded with NO `_signal_` middle word — confirmed against live DB).
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'read_region'::text,
    'read_heartcry'::text,
    'verify_church'::text,
    'reject_church'::text,
    'flag_cleared'::text,
    'flag_escalated'::text,
    'flag_read'::text,
    'pii_scrubbed'::text,
    'deactivate_church'::text,
    'deactivate_user'::text,
    'announcement_deleted'::text,
    'team_member_added'::text,
    'team_member_removed'::text,
    'rag_overridden'::text,
    'rag_override_removed'::text,
    'reinstate_church'::text,
    'super_admin_granted'::text,
    'super_admin_revoked'::text,
    'admin_session_refreshed'::text,
    'admin_password_reset'::text,
    'admin_step_up_reauth'::text,
    'heartcry_responded'::text,
    'flag_queue_opened'::text,
    'underground_oversight_opened'::text,
    'announcement_created'::text,
    'pastoral_signal_seen'::text,
    'pastoral_signal_dispositioned'::text,
    'pastoral_context_expanded'::text,
    'pastoral_digest_emitted'::text  -- KAN-137 #29
  ]));

-- ============================================================
-- Part 4: emit_pastoral_digest() RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_pastoral_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  lock_acquired         boolean;
  t1_count              integer;
  t2_count              integer;
  deferred_count        integer;
  pending_total         integer;
  surfaceable_total     integer;
  resend_api_key        text;
  pastoral_lead_user_id uuid;
  resend_request_id     bigint;
  email_log_outcome     text;
BEGIN
  -- ─── SEC #5: advisory-lock idempotency ───
  SELECT pg_try_advisory_lock(hashtext('emit_pastoral_digest')::bigint)
    INTO lock_acquired;
  IF NOT lock_acquired THEN
    RAISE WARNING 'emit_pastoral_digest: concurrent invocation detected, exiting';
    RETURN;
  END IF;

  -- ─── Resolve email_log forensic anchor (pastoral lead user) ───
  -- D-26: single pastoral lead at MVP. Multi-lead post-MVP triggers a
  -- re-design (this lookup target bumps). The Resend payload's TO is
  -- the shared inbox address (info@projectreplant.org per OPS c.11752);
  -- email_log.user_id is internal user attribution.
  SELECT id INTO pastoral_lead_user_id
  FROM public.users
  WHERE email = 'ruth@projectreplant.org'
  LIMIT 1;
  IF pastoral_lead_user_id IS NULL THEN
    RAISE WARNING 'emit_pastoral_digest: pastoral lead user not found (email=ruth@projectreplant.org)';
    PERFORM pg_advisory_unlock(hashtext('emit_pastoral_digest')::bigint);
    RETURN;
  END IF;

  -- ─── Count aggregates (NO row-level identifiers per SEC #1 + #6) ───
  SELECT
    count(*) FILTER (WHERE status = 'pending' AND meta ->> 'tier' = '1'),
    count(*) FILTER (WHERE status = 'pending' AND meta ->> 'tier' = '2'),
    count(*) FILTER (WHERE status = 'deferred')
    INTO t1_count, t2_count, deferred_count
  FROM public.moderation_state
  WHERE axis = 'pastoral';

  pending_total := t1_count + t2_count;
  surfaceable_total := pending_total + deferred_count;

  -- ─── AC-2: empty-queue suppression ───
  IF surfaceable_total = 0 THEN
    INSERT INTO public.email_log (user_id, template, sent_date, sent_at, resend_id, outcome)
    VALUES (
      pastoral_lead_user_id,
      'pastoral_signal_digest_t2',
      CURRENT_DATE,
      now(),
      NULL,
      'suppressed_empty_queue'
    );
    PERFORM pg_advisory_unlock(hashtext('emit_pastoral_digest')::bigint);
    RETURN;
  END IF;

  -- ─── Resolve Resend API key from Vault (KAN-66 pattern) ───
  resend_api_key := public.get_resend_api_key();
  IF resend_api_key IS NULL OR length(resend_api_key) = 0 THEN
    RAISE WARNING 'emit_pastoral_digest: Resend API key unavailable from Vault';
    INSERT INTO public.email_log (user_id, template, sent_date, sent_at, resend_id, outcome)
    VALUES (
      pastoral_lead_user_id,
      'pastoral_signal_digest_t2',
      CURRENT_DATE,
      now(),
      NULL,
      'failed_resend_emit'
    );
    PERFORM pg_advisory_unlock(hashtext('emit_pastoral_digest')::bigint);
    RETURN;
  END IF;

  -- ─── Resend emit via pg_net (async; fire-and-forget) ───
  -- net.http_post returns request_id immediately; HTTP response lands
  -- in net._http_response asynchronously. Acceptable for once-daily
  -- cron — OPS monitors net._http_response for actual delivery status.
  -- email_log.outcome records the ATTEMPT (sent = enqueued OK).
  -- SEC #6: payload body carries AGGREGATE counts + opaque deep_link
  -- only. No leader_id, message_id, content, or flag_reason anywhere.
  BEGIN
    SELECT net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_api_key,
        'Content-Type',  'application/json'
      ),
      body := jsonb_build_object(
        'from',        'info@projectreplant.org',
        'to',          jsonb_build_array('info@projectreplant.org'),
        'subject',     format('Pastoral queue digest — %s signal(s) pending', pending_total),
        'template_id', 'b410b64e-db33-46da-8111-9ace427f3678',
        'template_data', jsonb_build_object(
          't1_count',       t1_count,
          't2_count',       t2_count,
          'deferred_count', deferred_count,
          'deep_link',      'https://admin.projectreplant.org/pastoral'
        )
      )
    ) INTO resend_request_id;
    email_log_outcome := 'sent';
  EXCEPTION WHEN OTHERS THEN
    -- SEC #4: contained — RAISE WARNING (not EXCEPTION). Cron never throws.
    RAISE WARNING 'emit_pastoral_digest: Resend emit failed: %', SQLERRM;
    resend_request_id := NULL;
    email_log_outcome := 'failed_resend_emit';
  END;

  -- ─── email_log + audit_log writes ───
  INSERT INTO public.email_log (user_id, template, sent_date, sent_at, resend_id, outcome)
  VALUES (
    pastoral_lead_user_id,
    'pastoral_signal_digest_t2',
    CURRENT_DATE,
    now(),
    CASE WHEN resend_request_id IS NOT NULL
         THEN resend_request_id::text
         ELSE NULL END,
    email_log_outcome
  );

  -- audit_log row only on actual emit attempt (sent OR failed-after-
  -- enqueue). The suppressed_empty_queue path returned above without
  -- writing audit_log — empty cron tick is not an emit event.
  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'pastoral_digest_emitted',
    NULL,
    'cron',
    jsonb_build_object(
      'surface',        'digest_emit',
      'template_id',    'b410b64e-db33-46da-8111-9ace427f3678',
      'outcome',        email_log_outcome,
      'pending_total',  pending_total,
      'deferred_count', deferred_count
      -- NO leader_id, NO message_id, NO content (SEC #1 + #6)
    )
  );

  PERFORM pg_advisory_unlock(hashtext('emit_pastoral_digest')::bigint);
END;
$fn$;

-- ADR-009 hardening per get_resend_api_key reference. Supabase's
-- default-privileges grants EXECUTE on public-schema functions to
-- anon + authenticated automatically; REVOKE PUBLIC alone is
-- insufficient — must REVOKE from each role explicitly. Reference
-- function get_resend_api_key (KAN-66 c.11098) has only postgres +
-- service_role; this RPC matches that posture.
REVOKE ALL    ON FUNCTION public.emit_pastoral_digest() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_pastoral_digest() FROM anon;
REVOKE EXECUTE ON FUNCTION public.emit_pastoral_digest() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.emit_pastoral_digest() TO service_role;

COMMENT ON FUNCTION public.emit_pastoral_digest() IS
  'KAN-137 AC-2. Daily pastoral digest emit (Resend Template 10) fired by pg_cron at 09:00 UTC.

Cross-definer chain (SEC c.11750 #6 audit):
  pg_cron.job → THIS FN (SECURITY DEFINER as service_role) → net.http_post → Resend API.

Payload carries AGGREGATE counts only (t1_count, t2_count, deferred_count) + opaque deep link. No leader_id, message_id, content, or flag_reason in payload, log line, audit_log meta, or email_log row. Per-leader identification stays inside moderation_state where RLS + axis-aware policies bound the surface (KAN-125 row #15).

Idempotent on concurrent invocation via pg_try_advisory_lock. RAISE WARNING (never EXCEPTION) on any Resend failure — cron continues, OPS sees the warning, email_log.outcome captures the failure mode.';

-- ============================================================
-- Part 5: pg_cron schedule (idempotent re-schedule)
-- ============================================================
-- cron.unschedule(name) is the official API; safe to re-apply this
-- migration. Direct DELETE FROM cron.job requires elevated role and
-- fails under the migration runner's grants.
DO $$
BEGIN
  PERFORM cron.unschedule('pastoral-daily-digest');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist OR caller lacks visibility; either way safe to
  -- proceed to re-schedule. cron.schedule will create the new entry.
  NULL;
END $$;

SELECT cron.schedule(
  'pastoral-daily-digest',
  '0 9 * * *',
  $$SELECT public.emit_pastoral_digest();$$
);
