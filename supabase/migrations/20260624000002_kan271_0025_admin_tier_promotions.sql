-- KAN-271 / Workstream A ratification #1 + #2 + #3 — promotion ceremony table.
-- Option B: super admin sponsors (with own AAL2 step-up at request time) →
-- top-tier admin approves (with own AAL2 step-up at approve time). 48h TTL.
-- No-self-approve enforced at DB layer (ratification #4 — Ruth + Replant Ops
-- interchangeable but can't approve their own request as sponsor).
--
-- Applied to remote via MCP apply_migration on 2026-06-24.

CREATE TABLE IF NOT EXISTS public.admin_tier_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid NOT NULL REFERENCES public.users(id),
  sponsor_user_id   uuid NOT NULL REFERENCES public.users(id),
  approver_user_id  uuid REFERENCES public.users(id),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  -- Server-observed freshness stamps. Captured by RPC at request/approve time
  -- after gating on the caller's AAL2 + step-up. Stored for audit replay.
  sponsor_aal2_fresh_at  timestamptz NOT NULL,
  approver_aal2_fresh_at timestamptz,
  -- ≥30 chars enforced at RPC layer; column allows null until denied.
  denial_reason text,
  CONSTRAINT no_self_sponsor CHECK (candidate_user_id <> sponsor_user_id),
  CONSTRAINT no_self_approve CHECK (approver_user_id IS NULL OR approver_user_id <> sponsor_user_id)
);

CREATE INDEX IF NOT EXISTS admin_tier_promotions_candidate_idx
  ON public.admin_tier_promotions(candidate_user_id, state);

CREATE INDEX IF NOT EXISTS admin_tier_promotions_pending_idx
  ON public.admin_tier_promotions(expires_at) WHERE state = 'pending';

-- Append-only on terminal states (mirrors audit_log_underground pattern).
-- Once approved/denied/expired/cancelled, row body is frozen — no retconning.
CREATE OR REPLACE FUNCTION public.prevent_admin_tier_promotion_terminal_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.state IN ('approved', 'denied', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'admin_tier_promotions row in terminal state cannot be modified'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_tier_promotions_no_terminal_update
  ON public.admin_tier_promotions;
CREATE TRIGGER trg_admin_tier_promotions_no_terminal_update
  BEFORE UPDATE ON public.admin_tier_promotions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_tier_promotion_terminal_mutation();

-- RLS: top-tier admin OR sponsor OR candidate may SELECT. Only SECURITY DEFINER
-- RPCs INSERT/UPDATE. Live hook mints is_top_tier_admin top-level claim sourced
-- from public.users.is_top_tier_admin — that's the canonical top-tier signal here.
ALTER TABLE public.admin_tier_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_tier_promotions_select ON public.admin_tier_promotions;
CREATE POLICY admin_tier_promotions_select ON public.admin_tier_promotions
  FOR SELECT TO authenticated USING (
    COALESCE((auth.jwt() ->> 'is_top_tier_admin')::boolean, false) = true
    OR sponsor_user_id  = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR candidate_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

COMMENT ON TABLE public.admin_tier_promotions IS
  'KAN-271 admin tier — two-step promotion ceremony rows. Pending entries auto-expire '
  'in 48h via fn_expire_pending_admin_promotions (cron). Terminal rows are append-only '
  'via prevent_admin_tier_promotion_terminal_mutation trigger.';
