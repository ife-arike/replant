-- KAN-293/295/296/292 — Escalated Cases parent table
--
-- Escalated Cases surface (super_admin + Manager only, anti-gossip rule).
-- Rows here come from two provenance paths:
--   1. Regular admin escalates from /pastoral or /flagged (source_axis='pastoral'|'flagged')
--   2. UG-touched message auto-routes at write-time via trigger (source_axis='auto_underground')
--
-- Deny-all RLS; access ONLY via SECURITY DEFINER RPCs gated by tier helper.

CREATE TABLE public.escalated_cases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id_seq           bigserial UNIQUE,
  source_axis           text NOT NULL,
  source_message_id     uuid REFERENCES public.messages(id),
  leader_user_id        uuid REFERENCES public.users(id),
  receiver_user_id      uuid REFERENCES public.users(id),
  state                 text NOT NULL DEFAULT 'open',
  reach_out_message_id  uuid REFERENCES public.messages(id),
  escalation_reason     text NOT NULL,
  escalation_context    text NOT NULL,
  escalated_by_user_id  uuid REFERENCES public.users(id),
  escalated_by_tier     text,
  auto_routed           boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  closed_at             timestamptz,
  closed_by_user_id     uuid REFERENCES public.users(id),
  closed_disposition    text,
  closed_note           text,

  CONSTRAINT escalated_cases_state_check CHECK (
    state = ANY (ARRAY['open','awaiting','replied','pending_proposal','closed'])
  ),
  CONSTRAINT escalated_cases_source_axis_check CHECK (
    source_axis = ANY (ARRAY['flagged','pastoral','auto_underground'])
  ),
  CONSTRAINT escalated_cases_escalation_reason_check CHECK (
    escalation_reason = ANY (ARRAY[
      'destructive_needed','pattern_multi_flag','pastoral_judgment',
      'cross_tier','unsure','auto_underground'
    ])
  ),
  CONSTRAINT escalated_cases_disposition_check CHECK (
    closed_disposition IS NULL OR closed_disposition = ANY (ARRAY[
      'resolved_by_reach_out','resolved_no_outreach','false_signal',
      'routing_misclassification','access_revoked','restriction_applied',
      'escalated_to_higher','pending_external'
    ])
  ),
  CONSTRAINT escalated_cases_context_len CHECK (
    char_length(escalation_context) >= 30
  ),
  CONSTRAINT escalated_cases_close_note_len CHECK (
    closed_note IS NULL OR char_length(closed_note) >= 30
  ),
  CONSTRAINT escalated_cases_closed_consistency CHECK (
    (state = 'closed' AND closed_at IS NOT NULL AND closed_disposition IS NOT NULL
     AND closed_note IS NOT NULL AND closed_by_user_id IS NOT NULL)
    OR
    (state <> 'closed' AND closed_at IS NULL)
  ),
  CONSTRAINT escalated_cases_auto_route_consistency CHECK (
    (auto_routed = true AND source_axis = 'auto_underground' AND escalated_by_user_id IS NULL)
    OR
    (auto_routed = false AND source_axis <> 'auto_underground' AND escalated_by_user_id IS NOT NULL)
  )
);

CREATE INDEX idx_escalated_cases_open
  ON public.escalated_cases (created_at DESC) WHERE state <> 'closed';
CREATE INDEX idx_escalated_cases_leader
  ON public.escalated_cases (leader_user_id) WHERE state <> 'closed';
CREATE INDEX idx_escalated_cases_source_msg
  ON public.escalated_cases (source_message_id);

ALTER TABLE public.escalated_cases ENABLE ROW LEVEL SECURITY;
-- Deny-all from JS; access only via SECURITY DEFINER RPCs gated by tier helper.
