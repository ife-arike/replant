-- 20260707000002_kan305_0001_blocked_users_table_guard_and_rpcs.sql
-- =============================================================================
-- KAN-305 — Block User: enforcement layer, file 1 of 3.
--
-- Store blocker (Apple 1.2(c) "the ability to block abusive users from the
-- service" + Google Play 1:1-interaction blocking requirement). Founder-
-- ratified 2026-07-03. Design lanes:
--   .claude/plans/2026-07-03-kan305-block-panel-sec.md   (semantics + protections)
--   .claude/plans/2026-07-03-kan305-block-panel-dba.md   (enforcement mechanism)
--   .claude/plans/2026-07-03-panel-ratification-consolidated.md  §D + §E (locked calls)
--
-- ⚠ MIRROR-ON-FILE — DO NOT AUTO-APPLY. Live apply is Founder-controlled and
--    must be byte-identical to this file, confirmed via the migration ledger.
--
-- Apply ordering: this file is authored to land AFTER 20260707000001 (KAN-205
-- account-lifecycle), which is its build baseline — live already reflects
-- KAN-205 (its 3 audit actions are in the live CHECK, verified 2026-07-07).
--
-- Doctrine (console-opacity, locked): BE gates are load-bearing. Enforcement
-- holds at the DB/RPC/edge layer even against a modified client. The BEFORE
-- INSERT trigger on public.messages is the layer no client can strip — the DM
-- send path is service-role (postgres-js over SUPABASE_DB_URL) and bypasses
-- RLS, so a policy predicate would be decorative exactly where it matters.
--
-- This file lands:
--   1. public.blocked_users            — the pair table (green-field; confirmed
--                                          absent live 2026-07-07: no relation,
--                                          no RPC, no prior migration).
--   2. fn_is_blocked(a,b)              — symmetric STABLE check, service_role
--                                          EXECUTE only (no client pair-probing).
--   3. fn_is_blocked_identity_known    — directory-suppression variant that
--                                          honours the SEC §3.3 de-masking-oracle
--                                          rule (masked-context blocks do NOT
--                                          suppress named directory rows).
--   4. fn_messages_block_guard + trigger — the unstrippable send-path backstop.
--   5. block_user / unblock_user       — owner-scoped SECURITY DEFINER RPCs
--                                          (cap 200, auto-decline/-withdraw
--                                          pending requests, audit rows).
--   6. get_blocked_users               — masked blocked-list read RPC.
--   7. audit_log action CHECK          — append-only extension with
--                                          user_blocked / user_unblocked.
--
-- Evidence discipline: the audit_log_action_check action list below was read
-- from LIVE via pg_get_constraintdef on 2026-07-07 — 76 actions (the 73 live
-- pre-KAN-205 + the 3 KAN-205 account-lifecycle actions landed by migration
-- 20260707000001). Repo migration files predate this; live is the source of
-- truth for the append-only constraint. Re-verify at apply time; if live
-- carries actions beyond this list, rebase the array onto live before applying
-- (never drop an action — append-only invariant).
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table.
--    Direction matters: unblock removes ONLY the blocker's own row; a mutual
--    block is two rows. No LEAST/GREATEST canonicalisation. Composite PK is the
--    uniqueness constraint (no surrogate id, no duplicate-pair bloat).
--
--    acquired_via — the surface the block was placed from. Load-bearing for
--    SEC §3.3: directory suppression is keyed to acquisition context so that
--    blocking a MASKED handle (anon DM, UG-masked identity) cannot be used to
--    diff named-directory-before vs -after and resolve the mask to a real
--    leader. 'identity_known' surfaces (named thread, search profile) suppress
--    the directory; masked surfaces do not. The CONTACT plane is stopped for
--    every value regardless (the trigger + consent gates use fn_is_blocked,
--    which ignores acquired_via).
-- ----------------------------------------------------------------------------
CREATE TABLE public.blocked_users (
  blocker_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  acquired_via text NOT NULL DEFAULT 'identity_known',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_pkey PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocked_users_acquired_via_check CHECK (
    acquired_via = ANY (ARRAY[
      'identity_known',   -- named thread / search profile / named request
      'masked_dm',        -- anon or UG-masked DM thread
      'masked_prayer',    -- anon prayer/testimony card
      'masked_other'      -- any other masked-context surface
    ])
  )
);

-- Reverse-direction index for the symmetric pair check at send frequency.
-- PK (blocker_id, blocked_id) serves the a->b probe; this serves b->a.
CREATE INDEX blocked_users_reverse_idx
  ON public.blocked_users (blocked_id, blocker_id);

-- Fail-closed: RLS enabled, ZERO policies, ZERO grants. Even if a grant
-- drifts in later, the table is unreadable/unwritable to clients. All access
-- is via the SECURITY DEFINER RPCs below (owner-scoped) and the service_role
-- helper. Mirrors the blocked-list-is-never-a-raw-table posture (SEC §3.4).
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_users FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. fn_is_blocked — symmetric contact-plane check.
--    STABLE SECURITY DEFINER, search_path pinned empty. NULL-safe (NULL args
--    yield false). EXECUTE revoked from clients so no leader can probe an
--    arbitrary pair; SECURITY DEFINER RPCs and the postgres-role edge-fn
--    connection call it regardless of the client grant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_a AND blocked_id = p_b
  ) OR EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = p_b AND blocked_id = p_a
  );
$$;

REVOKE EXECUTE ON FUNCTION public.fn_is_blocked(uuid, uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_is_blocked(uuid, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. fn_is_blocked_identity_known — directory-suppression variant (SEC §3.3).
--    True only when a block exists in either direction AND that block was
--    placed from an identity-known surface. A masked-context block returns
--    FALSE here, so the named person is NOT removed from search/invite
--    directories — the blocker cannot diff the directory to de-mask them.
--    Contact from either identity surface is still hard-stopped at the pair
--    level by fn_is_blocked (which this does not replace).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_blocked_identity_known(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE acquired_via = 'identity_known'
      AND (
        (blocker_id = p_a AND blocked_id = p_b)
        OR
        (blocker_id = p_b AND blocked_id = p_a)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.fn_is_blocked_identity_known(uuid, uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_is_blocked_identity_known(uuid, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Messages block guard — the unstrippable backstop (DBA §2.2 layer 1).
--    BEFORE INSERT on public.messages. Fires for every writer including the
--    service-role send path, /internal welcome DM, and seed_accepted_request_
--    message. Branch messages (receiver_id IS NULL) pass untouched — group
--    space is out of the v1 contact plane (SEC 1.12 / DBA 12.1).
--    Raises a bare 'blocked_pair' (SQLSTATE P0001); the send-message edge fn
--    catches it and maps to the existing generic 403 so the word "blocked"
--    NEVER reaches the blocked sender (silence guarantee, SEC §2).
--
--    Replant Team carve-out: secure-thread DMs are authored by the system
--    sender / admin replies through this same table. A leader CAN hold a block
--    row against a staff account (refusing the block would itself leak who is
--    staff — SEC 1.13), but the moderation channel must never be severed. The
--    guard therefore exempts any message whose conversation is a secure
--    Replant Team thread — the block row may exist, the secure surface is
--    exempt.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_messages_block_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.receiver_id IS NOT NULL
     AND NEW.conversation_id IS NOT NULL
     AND public.fn_is_blocked(NEW.sender_id, NEW.receiver_id)
     -- Replant Team secure threads are surface-exempt (SEC 1.13 / DBA §5.5).
     AND NOT EXISTS (
       SELECT 1 FROM public.conversations c
       WHERE c.id = NEW.conversation_id
         AND c.is_secure_replant_thread = true
     )
  THEN
    RAISE EXCEPTION 'blocked_pair';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_block_guard ON public.messages;
CREATE TRIGGER trg_messages_block_guard
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_messages_block_guard();

-- ----------------------------------------------------------------------------
-- 5a. block_user — owner-scoped block placement.
--     - caller resolved from auth.uid(); must be active + not soft/hard-deleted.
--       Verification is NOT required: blocking is protective, and a pending or
--       just-deactivated leader must still be able to close the door.
--     - target must exist in public.users (any status — you may block someone
--       who has since deactivated).
--     - cap 200 active blocks per blocker (Founder-ratified; SEC 4.3 / DBA 11.4).
--     - idempotent: ON CONFLICT DO NOTHING; re-blocking a just-unblocked pair
--       is always allowed (no cooldown — never make a frightened leader wait).
--     - at block time, clear the consent surface both directions:
--         * incoming pending request from target  -> declined (normal decline;
--           starts the existing 30-day cooldown; sender sees an ordinary
--           decline — a non-oracle event).  SEC 1.3 / D-5.
--         * outgoing pending request to   target  -> withdrawn (vanishes from
--           the recipient inbox exactly like any withdrawal).  SEC 1.3.
--     - audit row: 'user_blocked', id only, NEVER a name, NEVER the mask
--       resolution (SEC §6). No escalated_cases / admin-inbox side effect
--       (SEC 3.5) — audit_log only.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(
  p_target       uuid,
  p_acquired_via text DEFAULT 'identity_known'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_caller_id     uuid;
  v_target_exists boolean;
  v_active_count  integer;
  v_inserted      integer := 0;
BEGIN
  IF p_acquired_via IS NULL OR p_acquired_via NOT IN
       ('identity_known','masked_dm','masked_prayer','masked_other') THEN
    RAISE EXCEPTION 'invalid_acquired_via';
  END IF;

  -- Resolve caller. Active + not deleted; verification NOT required.
  SELECT u.id INTO v_caller_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.soft_deleted_at IS NULL
    AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_target IS NULL OR p_target = v_caller_id THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  SELECT true INTO v_target_exists
  FROM public.users u
  WHERE u.id = p_target;
  IF v_target_exists IS NULL THEN
    -- Non-oracle: same class a nonexistent/deleted user produces elsewhere.
    RAISE EXCEPTION 'target_not_found';
  END IF;

  -- Cap check counts the caller's own active block rows.
  SELECT count(*) INTO v_active_count
  FROM public.blocked_users
  WHERE blocker_id = v_caller_id;
  -- Allow a no-op re-block of an existing pair even at the cap (idempotent);
  -- only a NEW pair beyond the cap is refused.
  IF v_active_count >= 200
     AND NOT EXISTS (
       SELECT 1 FROM public.blocked_users
       WHERE blocker_id = v_caller_id AND blocked_id = p_target
     ) THEN
    RAISE EXCEPTION 'block_cap_reached';
  END IF;

  INSERT INTO public.blocked_users (blocker_id, blocked_id, acquired_via)
  VALUES (v_caller_id, p_target, p_acquired_via)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Auto-decline an incoming pending request FROM the target (clears the
  -- blocker's inbox instantly; ordinary decline semantics for the sender).
  UPDATE public.connection_requests
  SET status = 'declined', declined_at = now(), responded_at = now()
  WHERE status = 'pending'
    AND sender_id = p_target
    AND recipient_id = v_caller_id;

  -- Auto-withdraw an outgoing pending request TO the target (vanishes from
  -- the target's inbox like any withdrawal; no oracle).
  UPDATE public.connection_requests
  SET status = 'withdrawn', responded_at = now()
  WHERE status = 'pending'
    AND sender_id = v_caller_id
    AND recipient_id = p_target;

  -- Audit only on an actual new row (idempotent re-block writes no duplicate
  -- audit noise). id only — never a name, never the mask resolution.
  IF v_inserted > 0 THEN
    INSERT INTO public.audit_log (accessed_by, triggered_by, action, meta)
    VALUES (
      v_caller_id, 'user', 'user_blocked',
      jsonb_build_object('blocked_user_id', p_target, 'acquired_via', p_acquired_via)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.block_user(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5b. unblock_user — deletes ONLY the caller's own row (never the reverse).
--     Idempotent: silent no-op when absent; audit only on an actual delete.
--     No cooldown. Auto-declined/withdrawn requests are NOT resurrected —
--     unblock does not restore consent (SEC §5); the 30-day decline cooldown
--     continues to govern re-requests under normal semantics.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unblock_user(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_caller_id uuid;
  v_deleted   integer;
BEGIN
  SELECT u.id INTO v_caller_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.soft_deleted_at IS NULL
    AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_target IS NULL THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  DELETE FROM public.blocked_users
  WHERE blocker_id = v_caller_id AND blocked_id = p_target;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    INSERT INTO public.audit_log (accessed_by, triggered_by, action, meta)
    VALUES (
      v_caller_id, 'user', 'user_unblocked',
      jsonb_build_object('blocked_user_id', p_target)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. get_blocked_users — masked blocked-list read (SEC §3.2, DBA §6).
--    Returns ONLY the caller's own rows. Masking mirrors get_leader_thread_list
--    exactly: anonymous -> display_name NULL (FE composes "A fellow [Role]");
--    underground church -> literal 'Underground Church' (NEVER name/city/
--    region/lat/lng for UG); otherwise resolve_display_name. No email, no
--    auth_id, no verification_status through this surface.
--
--    Renders the person as they were lawful to see; for a masked-context
--    block the FE relies on role + anonymity to compose the mask. We surface
--    role + anonymous + underground so the FE reuses its existing masking
--    pipeline. A scrubbed/tombstoned target (hard-deleted) resolves to the
--    '[redacted]' name already stamped on the users row — harmless; such rows
--    are also swept (file 3).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_blocked_users()
RETURNS TABLE (
  blocked_user_id uuid,
  display_name    text,
  role            text,
  anonymous       boolean,
  church_name     text,
  underground     boolean,
  acquired_via    text,
  blocked_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  SELECT u.id INTO v_caller_id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.is_active = true
    AND u.soft_deleted_at IS NULL
    AND u.hard_deleted_at IS NULL;
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    b.blocked_id                                            AS blocked_user_id,
    CASE
      WHEN COALESCE(u.anonymous, false) = true THEN NULL
      ELSE public.resolve_display_name(
        u.first_name, u.middle_name, u.last_name,
        u.honorific, u.role::text,
        u.display_name_preference, u.last_name_first
      )
    END                                                     AS display_name,
    COALESCE(u.role::text, 'other')                         AS role,
    COALESCE(u.anonymous, false)                            AS anonymous,
    CASE
      WHEN ch.type = 'underground' THEN 'Underground Church'
      ELSE ch.name
    END                                                     AS church_name,
    COALESCE(ch.type = 'underground', false)                AS underground,
    b.acquired_via                                          AS acquired_via,
    b.created_at                                            AS blocked_at
  FROM public.blocked_users b
  JOIN public.users u          ON u.id  = b.blocked_id
  LEFT JOIN public.churches ch ON ch.id = u.church_id
  WHERE b.blocker_id = v_caller_id
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_blocked_users() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_blocked_users() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. audit_log action CHECK — append-only extension.
--    Base = 76 live actions (73 pre-KAN-205 + the 3 KAN-205 actions landed by
--    20260707000001) read from live pg_get_constraintdef 2026-07-07. Append
--    user_blocked / user_unblocked. Live is the source of truth (the append-
--    only invariant means repo files drift). Re-verify with pg_get_constraintdef
--    at apply time; if live carries actions beyond this list, rebase this array
--    onto live before applying (do not drop anything).
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    -- 73 pre-KAN-205 live actions (verbatim)
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
    -- KAN-205 (landed by 20260707000001)
    'account_soft_deleted',
    'account_restored',
    'account_hard_deleted',
    -- NEW for KAN-305 (append-only discipline)
    'user_blocked',
    'user_unblocked'
  ])
);

-- ----------------------------------------------------------------------------
-- 8. §E cross-cutting security find — REVOKE client INSERT on conversations.
--    (Register #2 §E; SEC §4.4; DBA §10.1 — both block lanes flagged this
--    independently and the Founder authorised it to ride this migration,
--    contingent on an FE grep confirming zero legitimate client inserts.)
--
--    FE GREP CONFIRMED (2026-07-07): the ONLY `.from('conversations')` uses in
--    the mobile app are SELECT reads — src/screens/main/ConnectScreen.tsx:381
--    (participant-pair lookup) — plus the service-role edge fn
--    supabase/functions/send-message/index.ts:402. There is ZERO client INSERT
--    / upsert on conversations anywhere in src/. All conversation CREATION
--    flows through service-role / SECURITY DEFINER paths:
--      - send-message edge fn (postgres-js, RLS-bypassing lazy-create)
--      - get_or_create_conversation_if_permitted (SECURITY DEFINER)
--      - respond_to_connection_request (SECURITY DEFINER, accept path)
--    None of these relies on the `authenticated` INSERT grant.
--
--    Today `authenticated` holds full INSERT/UPDATE/DELETE on conversations
--    with a participant-only WITH CHECK, so a modified client can mint a
--    conversation shell with any counterparty — a consent-layer bypass, and a
--    block bypass were any gate to key on conversation existence. The new
--    messages trigger already pair-gates blocked sends regardless, but
--    conversation existence should regain meaning. Scope this REVOKE to INSERT
--    (the mint vector) per the ratified §E wording. Residual: UPDATE/DELETE
--    grants remain (last_message_at bump is done by service-role paths; the
--    broader stranger-consent revoke of UPDATE/DELETE is tracked as an
--    adjacent-findings item, KAN-320, not scoped here).
-- ----------------------------------------------------------------------------
REVOKE INSERT ON public.conversations FROM authenticated;

COMMIT;
