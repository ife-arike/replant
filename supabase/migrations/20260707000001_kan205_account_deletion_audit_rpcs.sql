-- 20260707000001_kan205_account_deletion_audit_rpcs.sql
-- =============================================================================
-- KAN-205 — In-app account deletion (Founder-ratified 2026-07-03; SEC lane
-- design .claude/plans/2026-07-03-kan205-deletion-panel-sec.md; consolidated
-- ratification .claude/plans/2026-07-03-panel-ratification-consolidated.md §B).
--
-- ⚠ MIRROR-ON-FILE — DO NOT AUTO-APPLY. Live apply is Founder-controlled.
--
-- What this migration does (all ratified):
--   1. audit_log action CHECK — append-only extension with the three
--      non-UG account-lifecycle actions:
--        account_soft_deleted · account_restored · account_hard_deleted
--      (SEC §7 — today a standard/skip-flow leader's self-deletion,
--      restore, and hard-deletion write NO audit row anywhere.)
--   2. Hygiene (SEC §7 nit): revoke the stray column-level UPDATE grant on
--      users.soft_delete_reason from authenticated (inert but asymmetric
--      with its sibling soft-delete columns).
--   3. fn_soft_delete_my_account — non-UG audit row (audit-before-content)
--      + the ratified delete/restore cycle rate shape (expert call #4:
--      3 per 30 days, then the team steps in). UG accounts keep routing
--      audit to audit_log_underground unchanged (no UG leakage into the
--      broader log).
--   4. fn_restore_my_account — non-UG audit row + SEC §5.5 guard: a
--      leader self-restore must not un-schedule an ADMIN-expedited
--      hard-delete. Restore itself is never rate-limited (expert call #3
--      — never block a lawful restore; cap-of-2 over-restore stays
--      allowed, no cap check added by design).
--   5. fn_hard_delete_expired_soft_deletes — non-UG 'account_hard_deleted'
--      audit row mirroring the UG shape (scrubbed-email hash in meta).
--   6. fn_confirm_underground_proposal — SEC §5.4 one-line guard: the
--      'verify' branch must not verify a church that soft-deleted
--      mid-proposal. Function body is otherwise LIVE-VERBATIM as of
--      2026-07-07 (live has drifted past migration 20260623_0008: it now
--      carries rejected_by, in_review_* clears, the users verify-cascade,
--      and underground_detail_events inserts — all preserved here).
--   7. fn_my_deletion_preview() — NEW self-scoped SECURITY DEFINER read
--      (SEC build slice #3): the FE cannot read co-leader counts under
--      current RLS, and the confirm screen must know whether to fire the
--      sole-leader church-cascade disclosure. Additive field beyond the
--      SEC list: show_church_name (drives the CONTENT §6.3 hidden-name
--      "your fellowship" copy variant).
--
-- Evidence discipline: the audit_log_action_check action list below was
-- read from LIVE via pg_get_constraintdef on 2026-07-07 (73 actions —
-- includes 'case_escalated_to_manager', which postdates the repo's
-- 20260701000004 file). Do not trust repo migration files for this
-- constraint; live is the source of truth (append-only invariant).
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. audit_log action CHECK — 73 live actions verbatim + 3 appended.
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    -- Existing 73 actions (verbatim from live pg_get_constraintdef 2026-07-07)
    'read_region',
    'read_heartcry',
    'verify_church',
    'reject_church',
    'flag_cleared',
    'flag_escalated',
    'flag_read',
    'pii_scrubbed',
    'deactivate_church',
    'deactivate_user',
    'announcement_deleted',
    'team_member_added',
    'team_member_removed',
    'rag_overridden',
    'rag_override_removed',
    'reinstate_church',
    'super_admin_granted',
    'super_admin_revoked',
    'admin_session_refreshed',
    'admin_password_reset',
    'admin_step_up_reauth',
    'heartcry_responded',
    'flag_queue_opened',
    'underground_oversight_opened',
    'announcement_created',
    'pastoral_signal_seen',
    'pastoral_signal_dispositioned',
    'pastoral_context_expanded',
    'pastoral_digest_emitted',
    'church_details_updated',
    'admin_aal2_elevation',
    'admin_mfa_factor_reset',
    'underground_aal2_gate',
    'heartcry_aal2_gate',
    'admin_password_reset_sent',
    'prayer_request_withdrawn',
    'heartcry_feed_consent_retracted',
    'church_location_updated',
    'branch_created',
    'branch_invite_responded',
    'branch_member_removed',
    'branch_activated',
    'verify_leader',
    'reject_leader',
    'edit_pending',
    'welcome_dm_sent',
    'replant_team_reply_sent',
    'comment_posted',
    'heartcry_feed_approved',
    'branch_left',
    'branch_name_edited',
    'branch_leader_removed',
    'branch_deleted',
    'branch_parent_auto_linked',
    'branch_parent_admin_linked',
    'admin_tier_promotion_requested',
    'admin_tier_promotion_approved',
    'admin_tier_promotion_denied',
    'admin_tier_promotion_expired',
    'admin_invite_sent',
    'admin_demote',
    'admin_revoke',
    'account_name_updated',
    'admin_grant_to_existing_user',
    'escalated_case_created',
    'escalated_case_auto_routed',
    'escalated_proposal_proposed',
    'escalated_proposal_approved',
    'escalated_proposal_rejected',
    'escalated_case_closed',
    'escalated_inbox_opened',
    'escalated_case_reach_out_sent',
    'case_escalated_to_manager',
    -- NEW for KAN-205 (append-only discipline)
    'account_soft_deleted',
    'account_restored',
    'account_hard_deleted'
  ])
);

-- ----------------------------------------------------------------------------
-- 2. Hygiene — users.soft_delete_reason stray UPDATE grant (SEC §7 nit).
--    Inert today (RLS blocks writes once soft-deleted; RPCs overwrite it)
--    but revoked for symmetry with soft_deleted_at / hard_delete_* siblings.
-- ----------------------------------------------------------------------------
REVOKE UPDATE (soft_delete_reason) ON public.users FROM authenticated;

-- ----------------------------------------------------------------------------
-- 3. fn_soft_delete_my_account — cycle rate shape + non-UG audit row.
--    Semantics otherwise identical to live (verified against prosrc
--    2026-07-07). Audit-before-content invariant preserved.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_soft_delete_my_account(p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_is_underground boolean;
  v_remaining_active_leaders integer;
  v_recent_cycles integer;
BEGIN
  -- Only the leader-initiated reason is allowed via this path.
  IF p_reason IS DISTINCT FROM 'leader_initiated' THEN
    RAISE EXCEPTION 'invalid reason for self-soft-delete: %', p_reason
      USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.church_id INTO v_user_id, v_church_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no active user found for caller' USING ERRCODE = '42501';
  END IF;

  v_is_underground := EXISTS (
    SELECT 1 FROM public.churches WHERE id = v_church_id AND type = 'underground'
  );

  -- KAN-205 expert call #4 (ratified 2026-07-03): 3 delete/restore cycles
  -- per 30 days, then the team steps in. Counted from the audit trail the
  -- soft-delete path itself writes — no new counter column, fully audited.
  -- Enforced at DELETE time only; fn_restore_my_account is deliberately
  -- NOT rate-limited (expert call #3 — never block a lawful restore).
  IF v_is_underground THEN
    SELECT count(*) INTO v_recent_cycles
      FROM public.audit_log_underground
      WHERE action = 'underground_deactivated'
        AND accessed_by = v_user_id
        AND (meta->>'self_initiated')::boolean IS TRUE
        AND accessed_at > now() - interval '30 days';
  ELSE
    SELECT count(*) INTO v_recent_cycles
      FROM public.audit_log
      WHERE action = 'account_soft_deleted'
        AND accessed_by = v_user_id
        AND accessed_at > now() - interval '30 days';
  END IF;
  IF v_recent_cycles >= 3 THEN
    -- Message is a load-bearing contract: the delete-account edge function
    -- string-matches 'deletion limit reached' to shape its 429 response.
    RAISE EXCEPTION 'deletion limit reached' USING ERRCODE = '54000';
  END IF;

  -- Audit BEFORE content (invariant). UG keeps routing to
  -- audit_log_underground unchanged; non-UG now writes the main
  -- audit_log row that was missing pre-KAN-205 (SEC §7).
  IF v_is_underground THEN
    INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
      VALUES ('underground_deactivated', v_church_id, v_user_id,
              jsonb_build_object('reason', p_reason, 'self_initiated', true));
  ELSE
    INSERT INTO public.audit_log (accessed_by, triggered_by, action, church_id, meta)
      VALUES (v_user_id, 'user', 'account_soft_deleted', v_church_id,
              jsonb_build_object('reason', p_reason, 'self_initiated', true));
  END IF;

  -- Content: stamp soft-delete on the user.
  UPDATE public.users
    SET soft_deleted_at = now(),
        soft_delete_reason = p_reason,
        hard_delete_scheduled_at = now() + interval '30 days',
        is_active = false,
        deactivated_at = now()
    WHERE id = v_user_id;

  -- Mirror onto church row if this was the last active leader.
  SELECT count(*) INTO v_remaining_active_leaders
    FROM public.users
    WHERE church_id = v_church_id
      AND is_active = true
      AND soft_deleted_at IS NULL
      AND hard_deleted_at IS NULL;

  IF v_remaining_active_leaders = 0 AND v_church_id IS NOT NULL THEN
    UPDATE public.churches
      SET soft_deleted_at = now(),
          soft_delete_reason = p_reason,
          hard_delete_scheduled_at = now() + interval '30 days',
          is_active = false,
          deactivated_at = now()
      WHERE id = v_church_id
        AND soft_deleted_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_soft_delete_my_account(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_soft_delete_my_account(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. fn_restore_my_account — expedited-hard-delete guard + non-UG audit row.
--    Semantics otherwise identical to live (verified against prosrc
--    2026-07-07). No cap-of-2 check added — transient over-cap restore is
--    the ratified posture (expert call #3); it surfaces via the admin queue.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_restore_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_is_underground boolean;
  v_soft_deleted_at timestamptz;
  v_hard_deleted_at timestamptz;
  v_hard_delete_scheduled_at timestamptz;
  v_was_leader_initiated boolean;
BEGIN
  SELECT u.id, u.church_id, u.soft_deleted_at, u.hard_deleted_at,
         u.hard_delete_scheduled_at,
         (u.soft_delete_reason = 'leader_initiated')
    INTO v_user_id, v_church_id, v_soft_deleted_at, v_hard_deleted_at,
         v_hard_delete_scheduled_at, v_was_leader_initiated
    FROM public.users u
    WHERE u.auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'caller not found' USING ERRCODE = '42501';
  END IF;
  IF v_hard_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'account hard-deleted; restore unavailable' USING ERRCODE = '42501';
  END IF;
  IF v_soft_deleted_at IS NULL THEN
    RAISE EXCEPTION 'account is not soft-deleted' USING ERRCODE = '22023';
  END IF;
  IF v_soft_deleted_at + interval '30 days' < now() THEN
    RAISE EXCEPTION '30-day restore window has elapsed' USING ERRCODE = '22023';
  END IF;
  -- Per manifest §2: self-restore allowed only for leader-initiated soft-delete.
  -- Admin-initiated reasons require the admin two-eyes restore lane (0008).
  IF NOT v_was_leader_initiated THEN
    RAISE EXCEPTION 'admin-initiated deactivation; contact team to restore' USING ERRCODE = '42501';
  END IF;
  -- KAN-205 SEC §5.5 — an ADMIN-expedited hard-delete schedule must not be
  -- un-scheduled by self-restore. The natural leader-initiated schedule is
  -- exactly soft_deleted_at + 30 days (both stamped from the same now() in
  -- one transaction); any strictly-earlier schedule is an admin expedite.
  IF v_hard_delete_scheduled_at IS NOT NULL
     AND v_hard_delete_scheduled_at < v_soft_deleted_at + interval '30 days' THEN
    RAISE EXCEPTION 'restore unavailable; contact team' USING ERRCODE = '42501';
  END IF;

  v_is_underground := EXISTS (
    SELECT 1 FROM public.churches WHERE id = v_church_id AND type = 'underground'
  );

  -- Audit BEFORE content. UG unchanged; non-UG row added (SEC §7).
  IF v_is_underground THEN
    INSERT INTO public.audit_log_underground (action, church_id, accessed_by, meta)
      VALUES ('underground_restore_initiated', v_church_id, v_user_id,
              jsonb_build_object('self_initiated', true));
  ELSE
    INSERT INTO public.audit_log (accessed_by, triggered_by, action, church_id, meta)
      VALUES (v_user_id, 'user', 'account_restored', v_church_id,
              jsonb_build_object('self_initiated', true));
  END IF;

  -- Restore user.
  UPDATE public.users
    SET soft_deleted_at = NULL,
        soft_delete_reason = NULL,
        hard_delete_scheduled_at = NULL,
        is_active = true,
        deactivated_at = NULL
    WHERE id = v_user_id;

  -- Restore church if it was mirror-soft-deleted by this leader's last-active exit.
  UPDATE public.churches
    SET soft_deleted_at = NULL,
        soft_delete_reason = NULL,
        hard_delete_scheduled_at = NULL,
        is_active = true,
        deactivated_at = NULL
    WHERE id = v_church_id
      AND soft_deleted_at IS NOT NULL
      AND soft_delete_reason = 'leader_initiated'
      AND hard_deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_restore_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_restore_my_account() TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. fn_hard_delete_expired_soft_deletes — non-UG 'account_hard_deleted'
--    audit row (SEC §7), mirroring the UG shape (scrubbed-email hash).
--    accessed_by NULL + triggered_by 'system' + meta.user_id follows the
--    house deactivate_user system-row precedent. Semantics otherwise
--    identical to live (verified against prosrc 2026-07-07). The pg_cron
--    job calls this by name — no re-schedule needed.
-- ----------------------------------------------------------------------------
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
    -- non-UG rows now land in the main audit_log (KAN-205 / SEC §7 — the
    -- bottle holds every tear, not only the underground ones).
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

-- ----------------------------------------------------------------------------
-- 6. fn_confirm_underground_proposal — SEC §5.4 guard on the 'verify'
--    branch (do not verify a church that soft-deleted mid-proposal).
--    Body is LIVE-VERBATIM 2026-07-07 otherwise — live drifted past the
--    repo's 20260623_0008 (rejected_by, in_review_* clears, users
--    verify-cascade, underground_detail_events); all preserved.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_confirm_underground_proposal(p_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_caller_id uuid; v_p RECORD; v_audit_action text;
BEGIN
  v_caller_id := public.fn_assert_underground_admin();
  SELECT * INTO v_p FROM public.underground_verification_proposals WHERE id=p_proposal_id FOR UPDATE;
  IF v_p IS NULL OR v_p.id IS NULL THEN RAISE EXCEPTION 'proposal not found' USING ERRCODE='42501'; END IF;
  IF v_p.proposal_status <> 'pending' THEN RAISE EXCEPTION 'proposal already %', v_p.proposal_status USING ERRCODE='22023'; END IF;
  IF v_p.expires_at < now() THEN RAISE EXCEPTION 'proposal expired' USING ERRCODE='22023'; END IF;
  IF v_p.proposer_id = v_caller_id THEN RAISE EXCEPTION 'proposer cannot self-confirm' USING ERRCODE='42501'; END IF;

  v_audit_action := 'underground_confirm_' || v_p.action;

  INSERT INTO public.audit_log_underground (action, church_id, accessed_by, triggered_by, meta)
    VALUES (v_audit_action, v_p.church_id, v_caller_id, v_p.proposer_id, jsonb_build_object(
      'proposal_id', v_p.id, 'action', v_p.action, 'rejection_reason', v_p.rejection_reason));

  UPDATE public.underground_verification_proposals
    SET proposal_status='confirmed', confirmer_id=v_caller_id, confirmed_at=now()
    WHERE id=p_proposal_id;

  IF v_p.action = 'verify' THEN
    UPDATE public.churches
      SET verification_status='verified', verified=true, verified_at=now(),
          in_review_claimed_by=NULL, in_review_claimed_at=NULL, in_review_routed_to_founder_at=NULL
      WHERE id=v_p.church_id
        -- KAN-205 SEC §5.4 — a church that soft-deleted mid-proposal (its
        -- last leader self-deleted, or an admin lane acted first) must not
        -- be flipped to verified by a lagging confirm. The proposal still
        -- terminates + audits above; the church state is left untouched.
        AND soft_deleted_at IS NULL;
    -- Cascade: verify ALL non-deleted leaders on the church so the founding leader is not stranded
    -- at 'pending' with no admin recovery surface. Mirrors the reject/restore predicate exactly.
    -- Runs in SECURITY DEFINER context (owner postgres) so the authenticated column allowlist does
    -- not gate it. enforce_leader_cap is safe here (it counts OTHER active leaders, <= 1 < cap).
    UPDATE public.users
      SET verification_status='verified'
      WHERE church_id=v_p.church_id
        AND hard_deleted_at IS NULL
        AND soft_deleted_at IS NULL
        -- KAN-205 SEC §5.4 companion — leaders are only cascade-verified
        -- when the church itself is still standing (not soft-deleted).
        AND EXISTS (
          SELECT 1 FROM public.churches c
          WHERE c.id = v_p.church_id AND c.soft_deleted_at IS NULL
        );
  ELSIF v_p.action = 'reject' THEN
    UPDATE public.churches
      SET verification_status='rejected', rejected_at=now(),
          rejected_by=v_caller_id,
          rejection_reason_code=v_p.rejection_reason,
          soft_deleted_at=now(),
          soft_delete_reason=CASE WHEN v_p.rejection_reason='safety_concern' THEN 'safety_evacuation' ELSE 'admin_deactivation' END,
          hard_delete_scheduled_at=now()+interval '30 days', last_outcome_modal_kind='rejected',
          last_outcome_modal_shown_at=NULL, is_active=false, deactivated_at=now(),
          in_review_claimed_by=NULL, in_review_claimed_at=NULL, in_review_routed_to_founder_at=NULL
      WHERE id=v_p.church_id;
    UPDATE public.users
      SET soft_deleted_at=now(),
          soft_delete_reason=CASE WHEN v_p.rejection_reason='safety_concern' THEN 'safety_evacuation' ELSE 'admin_deactivation' END,
          hard_delete_scheduled_at=now()+interval '30 days', is_active=false, deactivated_at=now()
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL AND soft_deleted_at IS NULL;
  ELSIF v_p.action = 'rotate_join_code' THEN
    UPDATE public.churches SET underground_join_code_rotated_at=now(),
      last_outcome_modal_kind='join_code_rotated', last_outcome_modal_shown_at=NULL
      WHERE id=v_p.church_id;
  ELSIF v_p.action = 'visibility_override' THEN
    UPDATE public.churches SET show_church_name=(v_p.visibility_direction='hidden_to_visible'),
      last_outcome_modal_kind='visibility_flipped', last_outcome_modal_shown_at=NULL
      WHERE id=v_p.church_id;
  ELSIF v_p.action = 'hard_delete' THEN
    UPDATE public.churches SET hard_delete_scheduled_at=now() WHERE id=v_p.church_id;
    UPDATE public.users SET hard_delete_scheduled_at=now()
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL;
  ELSIF v_p.action = 'restore' THEN
    UPDATE public.churches SET soft_deleted_at=NULL, soft_delete_reason=NULL,
      hard_delete_scheduled_at=NULL, is_active=true, deactivated_at=NULL,
      verification_status='pending', rejected_at=NULL,
      rejected_by=NULL,
      appeal_status='resolved_restore'
      WHERE id=v_p.church_id;
    UPDATE public.users SET soft_deleted_at=NULL, soft_delete_reason=NULL,
      hard_delete_scheduled_at=NULL, is_active=true, deactivated_at=NULL
      WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL;
  END IF;

  INSERT INTO public.underground_detail_events (church_id, kind, ref_id)
    VALUES (v_p.church_id, 'proposal_confirmed', v_p.id);

  IF v_p.action IN ('verify', 'reject') THEN
    INSERT INTO public.underground_detail_events (church_id, kind, ref_id)
      VALUES (v_p.church_id, 'claim_changed', v_p.church_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_confirm_underground_proposal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_confirm_underground_proposal(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. fn_my_deletion_preview — NEW (SEC build slice #3). Self-scoped read
--    powering the deletion confirm screen's disclosures:
--      is_last_active_leader       → sole-leader church-cascade warning
--      pending_co_leader           → suppresses the church-deletion promise
--                                    (a pending co-leader counts as active
--                                    and blocks the church mirror — SEC
--                                    §5.3(e))
--      church_type                 → underground copy variants
--      church_verification_status  → informational
--      show_church_name            → CONTENT §6.3 hidden-name "your
--                                    fellowship" variant (additive beyond
--                                    the SEC field list — logged deviation)
--    The FE cannot derive any of this under current RLS (no co-leader
--    row visibility). SECURITY DEFINER, caller-scoped, read-only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_my_deletion_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_church_id uuid;
  v_other_active integer;
  v_pending_co_leader boolean := false;
  v_church_type text;
  v_church_verification_status text;
  v_show_church_name boolean;
BEGIN
  SELECT u.id, u.church_id INTO v_user_id, v_church_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.is_active = true
      AND u.soft_deleted_at IS NULL
      AND u.hard_deleted_at IS NULL;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no active user found for caller' USING ERRCODE = '42501';
  END IF;

  IF v_church_id IS NULL THEN
    -- Skip-flow leader: no church to cascade, nothing to disclose.
    RETURN jsonb_build_object(
      'is_last_active_leader', false,
      'church_type', NULL,
      'church_verification_status', NULL,
      'pending_co_leader', false,
      'show_church_name', NULL
    );
  END IF;

  -- OTHER active leaders on the caller's church. A pending co-leader is
  -- is_active=true and therefore counts here (SEC §5.3(e)) — the church
  -- mirror will NOT fire while they stand, so the sole-leader disclosure
  -- must stay silent.
  SELECT count(*) INTO v_other_active
    FROM public.users
    WHERE church_id = v_church_id
      AND id <> v_user_id
      AND is_active = true
      AND soft_deleted_at IS NULL
      AND hard_deleted_at IS NULL;

  SELECT EXISTS (
    SELECT 1 FROM public.users
      WHERE church_id = v_church_id
        AND id <> v_user_id
        AND is_active = true
        AND soft_deleted_at IS NULL
        AND hard_deleted_at IS NULL
        AND verification_status = 'pending'
  ) INTO v_pending_co_leader;

  SELECT c.type, c.verification_status, c.show_church_name
    INTO v_church_type, v_church_verification_status, v_show_church_name
    FROM public.churches c
    WHERE c.id = v_church_id;

  RETURN jsonb_build_object(
    'is_last_active_leader', (v_other_active = 0),
    'church_type', v_church_type,
    'church_verification_status', v_church_verification_status,
    'pending_co_leader', v_pending_co_leader,
    'show_church_name', v_show_church_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_my_deletion_preview() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_my_deletion_preview() TO authenticated;

COMMIT;

-- Post-apply verification (run via execute_sql, NOT inside the migration):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid='public.audit_log'::regclass AND conname='audit_log_action_check';
--   SELECT grantee, privilege_type FROM information_schema.column_privileges
--     WHERE table_schema='public' AND table_name='users'
--       AND column_name='soft_delete_reason' AND grantee='authenticated';
--   SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--     WHERE n.nspname='public' AND proname='fn_my_deletion_preview';
