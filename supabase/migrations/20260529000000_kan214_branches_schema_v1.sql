-- KAN-214 Branches schema v1 — Migration 1 of 3
--
-- Lays the foundation tables for branches (church-to-church group chats
-- per John 15:5 — up to 7 ministries gathered into one conversation),
-- the consent-status pivot table (branch_members), the messages FK to
-- branches, and the OQ-1 path (a) constraint reshape that lets a single
-- `messages` row be EITHER a 1:1 conversation message OR a branch
-- message — never both, never neither.
--
-- Locked OQ rulings driving this migration (see KAN-214 c.14955):
--   OQ-1 path (a): receiver_id becomes nullable; no_self_message extended
--     to tolerate NULL; new 3-way `message_belongs_to_one` CHECK enforces
--     exactly-one of (conversation_id + receiver_id) | (branch_id).
--   OQ-5: audit_log_action_check goes 38 → 42 with branch lifecycle
--     actions. Baked into THIS migration so the RPCs in Migration 2
--     never hit a constraint-violation window on first write.
--
-- RLS posture: SELECT-only policies for `authenticated`. No INSERT /
-- UPDATE / DELETE policies on either table — all writes flow through
-- SECURITY DEFINER RPCs in Migration 2. That keeps the consent model
-- centralized: clients cannot bypass the cap, the self-invite guard,
-- or the host-only ministry-removal rule by hand-crafting a query.

BEGIN;

-- ─── 1. branches ───────────────────────────────────────────────────
-- One row per branch. status='forming' until every invited member has
-- joined, then transitions to 'active'. 'cancelled' is reserved for a
-- future host-initiated tear-down (not exposed in MVP RPCs).
-- last_message_at is bumped by send-branch-message on every send;
-- get_branch_list reads it for sort ordering on the Ministries sub-tab.
CREATE TABLE public.branches (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL
                               CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 48),
  status           text        NOT NULL DEFAULT 'forming'
                               CHECK (status IN ('forming', 'active', 'cancelled')),
  created_by       uuid        NOT NULL REFERENCES public.users(id),
  last_message_at  timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. branch_members ─────────────────────────────────────────────
-- Consent-status pivot: one row per (branch_id, user_id). is_host marks
-- the leader who started the branch (consent_status='joined' implicitly
-- at insert time). All others start 'invited' and transition to
-- 'joined' or 'declined' via respond_to_branch_invite.
-- ministry_id is denormalized off public.users.church_id at invite time
-- so a leader who later changes ministry doesn't silently re-affiliate
-- the branch.
CREATE TABLE public.branch_members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES public.users(id),
  ministry_id      uuid        NOT NULL REFERENCES public.churches(id),
  is_host          boolean     NOT NULL DEFAULT false,
  consent_status   text        NOT NULL DEFAULT 'invited'
                               CHECK (consent_status IN ('invited', 'joined', 'declined')),
  invited_at       timestamptz NOT NULL DEFAULT now(),
  consented_at     timestamptz NULL,
  UNIQUE (branch_id, user_id)
);

-- ─── 3. messages.branch_id + OQ-1 path (a) ─────────────────────────
ALTER TABLE public.messages ADD COLUMN branch_id uuid NULL
  REFERENCES public.branches(id);

-- Drop NOT NULL on receiver_id so a branch message can omit it (a
-- branch message has no single receiver — every joined member receives
-- via the Realtime broadcast on `messages`).
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;

-- Extend no_self_message to tolerate NULL receiver_id (branch messages
-- have no receiver to compare against; the existing check would
-- evaluate `sender_id <> NULL` → NULL → reject all branch rows).
ALTER TABLE public.messages DROP CONSTRAINT no_self_message;
ALTER TABLE public.messages ADD CONSTRAINT no_self_message
  CHECK (receiver_id IS NULL OR sender_id <> receiver_id);

-- 3-way exclusivity: a message belongs to exactly ONE of:
--   conversation (conversation_id + receiver_id, branch_id NULL)
--   branch       (branch_id, conversation_id + receiver_id NULL)
-- No row may have both. No row may have neither. KAN-71 + KAN-214
-- queries can rely on this invariant rather than defensive joins.
ALTER TABLE public.messages ADD CONSTRAINT message_belongs_to_one
  CHECK (
    (conversation_id IS NOT NULL AND receiver_id IS NOT NULL AND branch_id IS NULL)
    OR
    (conversation_id IS NULL     AND receiver_id IS NULL     AND branch_id IS NOT NULL)
  );

-- Index for the hot get_branch_messages path: per-branch chronological
-- scan. Most branches will be small, but a busy ministry-network branch
-- can produce hundreds of rows per week — keep the seqscan off the
-- thread view.
CREATE INDEX messages_branch_id_created_at_idx
  ON public.messages (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

-- ─── 4. RLS ────────────────────────────────────────────────────────
ALTER TABLE public.branches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members ENABLE ROW LEVEL SECURITY;

-- branches SELECT: a verified active leader sees branches they belong to.
-- "Belong to" = ANY consent_status (invited, joined, declined). An
-- invited leader needs to see the branch row to render the InviteCard
-- (screen-ministries.jsx). A declined leader sees nothing else because
-- the RPCs gate on consent_status='joined' for reads of members/messages.
CREATE POLICY branches_select ON public.branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.branch_members bm
      JOIN public.users u ON u.id = bm.user_id
      WHERE bm.branch_id = branches.id
        AND u.auth_id = auth.uid()
        AND u.is_active = true
    )
  );

-- branch_members SELECT: a leader sees all members of any branch they
-- belong to. The MembersSheet view needs every member row (including
-- pending and declined leaders, with consent badges) so consent
-- visibility is symmetric.
CREATE POLICY branch_members_select ON public.branch_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.branch_members self_bm
      JOIN public.users u ON u.id = self_bm.user_id
      WHERE self_bm.branch_id = branch_members.branch_id
        AND u.auth_id = auth.uid()
        AND u.is_active = true
    )
  );

-- No INSERT / UPDATE / DELETE policies on either table.
-- All writes are SECURITY DEFINER RPCs (Migration 2). Direct table
-- writes from `authenticated` return permission-denied — the consent
-- model cannot be bypassed by hand-crafted PostgREST calls.

-- ─── 5. audit_log_action_check: 38 → 42 ────────────────────────────
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN (
    'read_region', 'read_heartcry', 'verify_church', 'reject_church',
    'flag_cleared', 'flag_escalated', 'flag_read', 'pii_scrubbed',
    'deactivate_church', 'deactivate_user', 'announcement_deleted',
    'team_member_added', 'team_member_removed', 'rag_overridden',
    'rag_override_removed', 'reinstate_church', 'super_admin_granted',
    'super_admin_revoked', 'admin_session_refreshed', 'admin_password_reset',
    'admin_step_up_reauth', 'heartcry_responded', 'flag_queue_opened',
    'underground_oversight_opened', 'announcement_created',
    'pastoral_signal_seen', 'pastoral_signal_dispositioned',
    'pastoral_context_expanded', 'pastoral_digest_emitted',
    'church_details_updated', 'admin_aal2_elevation',
    'admin_mfa_factor_reset', 'underground_aal2_gate',
    'heartcry_aal2_gate', 'admin_password_reset_sent',
    'prayer_request_withdrawn', 'heartcry_feed_consent_retracted',
    'church_location_updated',
    -- KAN-214 additions (38 → 42)
    'branch_created',
    'branch_invite_responded',
    'branch_member_removed',
    'branch_activated'
  ));

COMMIT;
