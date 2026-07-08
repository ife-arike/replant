-- KAN-304 — Leader-facing report mechanism (STORE BLOCKER: Apple 1.2(b) + Play UGC)
-- Migration 1/2: schema — content_reports table, RLS/grants/indexes,
--                escalated_cases additive columns, and the CHECK/enum extensions.
--
-- Panel-ratified (2026-07-03): SEC + MOD + BE+ADMIN + CONTENT lanes; register §C.
-- Author: BE (Replant). Build agent: KAN-304 worktree fix/kan-304-report-mechanism.
--
-- ORDERING: timestamp 20260707223000 sorts AFTER the KAN-205 account-deletion
-- migration (live version 20260707221207, applied 2026-07-07, which adds the
-- account_soft_deleted/restored/hard_deleted audit tokens) and the 20260702*
-- client-write hardening — all already applied to LIVE (verified against
-- supabase_migrations.schema_migrations 2026-07-07). This file's CHECK rebuilds
-- are keyed to that live constraint state (what the migration actually executes
-- against). Apply order: KAN-205 (already live) → this. (Deploy checklist item 1.)
--
-- NON-NEGOTIABLE INVARIANTS honoured by this migration (SEC lane §1):
--   1. Report intake writes ZERO bytes to any content row — all report state
--      lives HERE, in a new table with deny-all client RLS. Never added to any
--      Realtime publication (a report-time content-row touch would push-notify
--      the reported party via messages' realtime + own-sender RLS).
--   2. Reporter-scoped, polymorphic six-surface target; snapshot-at-intake (the
--      content text is copied server-side so edit/delete cannot evade review).
--   3. UG-involved cases are born straight into Escalated (never 'open'); the
--      RPC (migration 2) determines UG-involvement server-side.
--
-- LIVE-VERIFIED BASELINE (jiyetphxxvyiicrnwlnx, SELECT-only, 2026-07-07):
--   • audit_log_action_check currently ends with account_soft_deleted /
--     account_restored / account_hard_deleted (KAN-205, applied to live ahead of
--     its migration file landing in this branch). Rebuilt VERBATIM below + 6 new.
--   • audit_log_triggered_by_check = ('user','cron','system','webhook') — so
--     report audit rows use triggered_by='user' (reporter) / 'system' (auto-route).
--     There is NO 'leader_report' triggered_by value; SEC's illustrative token is
--     carried in meta.origin instead (see migration 2). Deviation logged.
--   • escalated_cases.source_axis CHECK = ('flagged','pastoral','auto_underground');
--     escalation_reason CHECK lacks a report token; auto_route_consistency couples
--     auto_routed=true ⇔ source_axis='auto_underground' ∧ escalated_by_user_id NULL.
--     UG-report auto-route therefore reuses source_axis='auto_underground'
--     (satisfies the locked consistency CHECK verbatim, per BE lane §3.5); a NEW
--     'report' source_axis + 'report_safety_class' escalation_reason serve the
--     ADMIN-escalated (non-auto) path only. Consistency CHECK is NOT touched.
--   • churches.type='underground' is the UG predicate. Content columns:
--     messages.content, prayer_requests.content, testimony.content, comments.body.
--     Author FKs: messages.sender_id, prayer_requests.user_id, testimony.user_id,
--     comments.author_id. comments has NO soft-delete column (hard-delete only) —
--     snapshotting is load-bearing there.
--
-- NOTHING IN THIS FILE IS APPLIED BY THE AGENT. Migration file only.

-- ============================================================================
-- 1. content_reports — one row per report (reporter EVENT), six surfaces
-- ============================================================================

CREATE TABLE public.content_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reporter: public.users.id (comments.author_id precedent — public PK, not auth.uid()).
  reporter_id      uuid NOT NULL REFERENCES public.users(id),

  -- Polymorphic target. NO FK by design: existence + the reporter's own
  -- visibility are enforced in the RPC (uniform not_found on failure, §1.2),
  -- and a church target has no author, so a single typed FK cannot cover all six.
  target_type      text NOT NULL CHECK (target_type IN
                     ('dm_message','branch_message','prayer_request',
                      'testimony','comment','church_profile')),
  target_id        uuid NOT NULL,

  -- Resolved server-side at intake; NEVER accepted from the client.
  -- NULL iff target_type='church_profile' (a church has no authoring leader).
  target_author_id uuid REFERENCES public.users(id),
  -- Author's church, or (for church_profile) the reported church itself.
  -- Drives UG detection + admin context. NULL only if the author has no church.
  target_church_id uuid REFERENCES public.churches(id),

  -- Public leader-facing reason vocabulary (MOD/CONTENT §2, 8 reasons R1–R8).
  -- Mapped onto internal taxonomy codes for queue rendering inside the RPC;
  -- reasons name CATEGORIES, never patterns (FLAG_TAXONOMY secrecy AC-12 intact).
  reason_code      text NOT NULL CHECK (reason_code IN
                     ('locate_identify',        -- R1 identity/location probe (always Escalated)
                      'threats',                -- R2 threat/intimidation/pressure
                      'asking_for_money',       -- R3 financial solicitation (KAN-261 folded)
                      'impersonation',          -- R4 not who they claim to be
                      'false_teaching',         -- R5 human-only lane, never auto-actioned
                      'spam',                   -- R6 spam / scam link
                      'wellbeing_concern',      -- R7 concern-shaped; routes Pastoral
                      'something_else')),        -- R8 free text required (enforced in RPC)

  -- Optional free-text ('note' / 'detail'). scrubAndCap'd + length-guarded in the
  -- RPC; REQUIRED only for reason_code='something_else' (enforced server-side).
  detail           text CHECK (detail IS NULL OR char_length(detail) BETWEEN 1 AND 500),

  -- Server-captured verbatim snapshot at intake (once per case; NULL for church
  -- targets, which have no single content row). Retained indefinitely per the
  -- 2026-07-03 Founder ruling; admin-only under deny-all RLS below.
  content_snapshot text,
  -- {target_created_at, conversation_id|branch_id|announcement_id,
  --  attribution_as_reporter_saw_it, is_masked, church profile fields for
  --  church targets, matched_codes[] from the free-text scan}. Never content.
  snapshot_meta    jsonb,

  -- Computed at intake: reporter OR author OR DM counterparty OR reported church
  -- is underground. Drives Escalated auto-route + regular-queue exclusion.
  ug_involved      boolean NOT NULL DEFAULT false,

  -- Report lifecycle (per BE lane §6.1). UG-involved reports are born 'escalated'.
  status           text NOT NULL DEFAULT 'open' CHECK (status IN
                     ('open','cleared','escalated')),
  -- Escalated-case linkage (existing machinery owns resolution from here).
  case_id          uuid REFERENCES public.escalated_cases(id),

  -- Coordinated-burst reviewer cue (§4.2): set true on shape triggers; NEVER
  -- auto-actions content — a skepticism hint, not a severity boost.
  burst_flagged    boolean NOT NULL DEFAULT false,

  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES public.users(id),   -- NULL on UG auto-route (system)

  -- Lifecycle consistency (mirrors escalated_cases_closed_consistency style):
  --   open      → no review, no case
  --   cleared   → reviewed by a named admin
  --   escalated → linked to a case (reviewer NULL when auto-routed by system)
  CONSTRAINT content_reports_status_consistency CHECK (
    (status = 'open'      AND reviewed_at IS NULL AND reviewed_by IS NULL AND case_id IS NULL) OR
    (status = 'cleared'   AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR
    (status = 'escalated' AND case_id IS NOT NULL)),

  -- A church target has no author; every other surface does (resolved server-side).
  CONSTRAINT content_reports_church_author CHECK (
    (target_type =  'church_profile' AND target_author_id IS NULL) OR
    (target_type <> 'church_profile' AND target_author_id IS NOT NULL)),

  -- something_else requires free text (belt; the RPC also enforces it before insert).
  CONSTRAINT content_reports_something_else_detail CHECK (
    reason_code <> 'something_else'
    OR (detail IS NOT NULL AND char_length(btrim(detail)) >= 1))
);

COMMENT ON TABLE public.content_reports IS
  'KAN-304 leader-facing reports. Reporter-scoped; deny-all client RLS; never in any Realtime publication. One row per report; N reports on one target dedupe into one open row via uniq_content_reports_open_per_reporter_target and aggregate in v_moderation_inbox. UG-involved rows are born status=escalated and never appear in a regular-admin-visible state.';

-- ─── Indexes (house conventions: partial queue index + partial-unique dedupe) ──

-- Regular-queue read path: open, non-UG, newest first.
CREATE INDEX idx_content_reports_open
  ON public.content_reports (created_at DESC)
  WHERE status = 'open' AND ug_involved = false;

-- Aggregate-by-target (queue GROUP BY + burst-shape + actor-pattern windows).
CREATE INDEX idx_content_reports_target
  ON public.content_reports (target_type, target_id);

-- Actor-level pattern window (per reported author, 30d) + rate-count support.
CREATE INDEX idx_content_reports_author_recent
  ON public.content_reports (target_author_id, created_at DESC)
  WHERE target_author_id IS NOT NULL;

-- Reporter rate window (DB-side COUNT over trailing 24h; the primary limiter
-- lives in the edge function, this backs the in-DB belt + burst check).
CREATE INDEX idx_content_reports_reporter_recent
  ON public.content_reports (reporter_id, created_at DESC);

-- Double-tap idempotency: one OPEN report per (reporter, target). A second tap
-- ON CONFLICT DO NOTHING returns the existing row — success, not error (§4.1).
-- This DB-side dedupe is the PRIMARY bombing control and survives limiter outage.
CREATE UNIQUE INDEX uniq_content_reports_open_per_reporter_target
  ON public.content_reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

-- ─── RLS: enabled, ZERO client policies (service-role / SECURITY DEFINER only) ──
-- Console-opacity doctrine: BE gates are load-bearing. Report status is a
-- moderation outcome; exposing it to reporters violates the anti-gossip rule.
-- The client only ever sees the RPC's synchronous "received" response.

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_reports FROM anon, authenticated;
-- No CREATE POLICY. Reads: service-role Netlify functions. Writes: the definer RPC.

-- ============================================================================
-- 2. escalated_cases — additive columns for non-message report targets
-- ============================================================================
-- Message-target report cases keep their live view joins via source_message_id
-- (set by the RPC when the target is a message). The five non-message surfaces
-- link through these new columns; report→case linkage is on content_reports.case_id.

ALTER TABLE public.escalated_cases
  ADD COLUMN IF NOT EXISTS source_target_type text
    CHECK (source_target_type IS NULL OR source_target_type IN
      ('dm_message','branch_message','prayer_request','testimony','comment','church_profile')),
  ADD COLUMN IF NOT EXISTS source_target_id uuid,
  ADD COLUMN IF NOT EXISTS report_snapshot_content text,
  ADD COLUMN IF NOT EXISTS report_snapshot_meta jsonb;

COMMENT ON COLUMN public.escalated_cases.source_target_type IS
  'KAN-304: non-message report surface driving this case. NULL for flag/pastoral/auto_underground message cases (which use source_message_id).';

-- Case dedupe for report targets: at most one non-closed case per target, so an
-- escalation onto a live case LINKS (content_reports.case_id) instead of forking.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_escalated_cases_open_report_target
  ON public.escalated_cases (source_target_type, source_target_id)
  WHERE source_target_type IS NOT NULL AND state <> 'closed';

-- ============================================================================
-- 3. CHECK extensions — rebuilt VERBATIM from live + appended (DROP/ADD pattern,
--    precedent 20260701000004). Token lists copied from pg_get_constraintdef
--    against jiyetphxxvyiicrnwlnx on 2026-07-07.
-- ============================================================================

-- ─── 3a. escalated_cases.source_axis: + 'report' (admin-escalated report cases) ──
ALTER TABLE public.escalated_cases DROP CONSTRAINT escalated_cases_source_axis_check;
ALTER TABLE public.escalated_cases ADD CONSTRAINT escalated_cases_source_axis_check CHECK (
  source_axis = ANY (ARRAY[
    'flagged'::text,
    'pastoral'::text,
    'auto_underground'::text,
    'report'::text            -- NEW (KAN-304): admin-escalated leader report
  ])
);

-- ─── 3b. escalated_cases.escalation_reason: + 'report_safety_class' ──
-- For admin-escalated report cases and auto-opened safety-class cases (R1/R2-direct).
-- UG auto-route continues to use 'auto_underground' (consistency CHECK unchanged).
ALTER TABLE public.escalated_cases DROP CONSTRAINT escalated_cases_escalation_reason_check;
ALTER TABLE public.escalated_cases ADD CONSTRAINT escalated_cases_escalation_reason_check CHECK (
  escalation_reason = ANY (ARRAY[
    'destructive_needed'::text,
    'pattern_multi_flag'::text,
    'pastoral_judgment'::text,
    'cross_tier'::text,
    'unsure'::text,
    'auto_underground'::text,
    'report_safety_class'::text   -- NEW (KAN-304): safety-class report (R1 / own-thread R2)
  ])
);

-- ─── 3c. audit_log.action: + 6 report-lifecycle tokens ──
-- Rebuilt VERBATIM from live (includes the KAN-205 account_* trio at the tail).
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    -- Live token list (pg_get_constraintdef 2026-07-07) — verbatim
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
    'pastoral_digest_emitted'::text,
    'church_details_updated'::text,
    'admin_aal2_elevation'::text,
    'admin_mfa_factor_reset'::text,
    'underground_aal2_gate'::text,
    'heartcry_aal2_gate'::text,
    'admin_password_reset_sent'::text,
    'prayer_request_withdrawn'::text,
    'heartcry_feed_consent_retracted'::text,
    'church_location_updated'::text,
    'branch_created'::text,
    'branch_invite_responded'::text,
    'branch_member_removed'::text,
    'branch_activated'::text,
    'verify_leader'::text,
    'reject_leader'::text,
    'edit_pending'::text,
    'welcome_dm_sent'::text,
    'replant_team_reply_sent'::text,
    'comment_posted'::text,
    'heartcry_feed_approved'::text,
    'branch_left'::text,
    'branch_name_edited'::text,
    'branch_leader_removed'::text,
    'branch_deleted'::text,
    'branch_parent_auto_linked'::text,
    'branch_parent_admin_linked'::text,
    'admin_tier_promotion_requested'::text,
    'admin_tier_promotion_approved'::text,
    'admin_tier_promotion_denied'::text,
    'admin_tier_promotion_expired'::text,
    'admin_invite_sent'::text,
    'admin_demote'::text,
    'admin_revoke'::text,
    'account_name_updated'::text,
    'admin_grant_to_existing_user'::text,
    'escalated_case_created'::text,
    'escalated_case_auto_routed'::text,
    'escalated_proposal_proposed'::text,
    'escalated_proposal_approved'::text,
    'escalated_proposal_rejected'::text,
    'escalated_case_closed'::text,
    'escalated_inbox_opened'::text,
    'escalated_case_reach_out_sent'::text,
    'case_escalated_to_manager'::text,
    'account_soft_deleted'::text,
    'account_restored'::text,
    'account_hard_deleted'::text,
    -- KAN-305 block tokens (this CHECK rebuild runs AFTER 20260707000002 in
    -- timestamp order; that migration added these two. Reproduced here so this
    -- later DROP+ADD does not silently drop them — reconciliation, 2026-07-07.)
    'user_blocked'::text,
    'user_unblocked'::text,
    -- NEW (KAN-304 report lifecycle) — 6 tokens
    'content_report_submitted'::text,   -- accepted intake (meta: report_id, target_type, reason, dedup, ug_involved); NO reporter/target-author id in meta for UG-involved
    'content_report_rejected'::text,    -- invalid / not-visible target; validation fail (rejection class only)
    'content_report_opened'::text,      -- admin opens the report drawer (flag_read sibling)
    'content_report_cleared'::text,     -- per-target clear (incl. no-violation — deciding not to act IS the record)
    'content_report_escalated'::text,   -- admin-escalated to a case
    'content_report_reporter_viewed'::text  -- §2 justified >=50-char identity expand (SA+Manager), audit-permanent
  ])
);

-- ── End of migration 1/2. Migration 2 defines submit_content_report + helpers. ──
