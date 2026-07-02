-- KAN-293/295/296/292 — Escalated Case proposals (1-sponsor-1-manager approval ceremony)
--
-- Sub-table holding the propose/approve ceremony that mirrors the /underground pattern.
-- Race guard: partial unique index enforces one pending proposal per case at the DB level.
-- Self-approve guard: ecp_no_self_approve CHECK is the safety net;
-- BE code is the load-bearing layer.

CREATE TABLE public.escalated_case_proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL REFERENCES public.escalated_cases(id) ON DELETE RESTRICT,
  action              text NOT NULL,
  reasoning           text NOT NULL,
  proposer_id         uuid NOT NULL REFERENCES public.users(id),
  proposer_tier       text NOT NULL,
  approver_id         uuid REFERENCES public.users(id),
  proposal_status     text NOT NULL DEFAULT 'pending',
  rejection_reason    text,
  action_taken        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  approved_at         timestamptz,
  rejected_at         timestamptz,

  CONSTRAINT ecp_action_check CHECK (
    action = ANY (ARRAY['restrict_temporarily','revoke_access','escalate_to_manager'])
  ),
  CONSTRAINT ecp_status_check CHECK (
    proposal_status = ANY (ARRAY['pending','approved','rejected','expired','cancelled'])
  ),
  CONSTRAINT ecp_proposer_tier_check CHECK (
    proposer_tier = ANY (ARRAY['super_admin','top_tier'])
  ),
  CONSTRAINT ecp_reasoning_len CHECK (char_length(reasoning) >= 30 AND char_length(reasoning) <= 500),
  CONSTRAINT ecp_no_self_approve CHECK (proposer_id IS DISTINCT FROM approver_id)
);

CREATE UNIQUE INDEX uniq_ecp_one_pending_per_case
  ON public.escalated_case_proposals (case_id) WHERE proposal_status = 'pending';
CREATE INDEX idx_ecp_expires_pending
  ON public.escalated_case_proposals (expires_at) WHERE proposal_status = 'pending';

ALTER TABLE public.escalated_case_proposals ENABLE ROW LEVEL SECURITY;
