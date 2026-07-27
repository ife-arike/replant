# Build Manifest — Escalated Cases bundle (KAN-293 / KAN-295 / KAN-296 / KAN-292)

**Status:** awaiting mini-panel review before 3-lane build dispatch
**Author:** SM, 2026-06-30
**Locks reference:** [`/Users/ife/replant/.claude/plans/sme-synthesis-escalated-bundle.md`](../.claude/plans/sme-synthesis-escalated-bundle.md) + [`/Users/ife/replant/.claude/plans/cd-prompt-escalated-cases.md`](../.claude/plans/cd-prompt-escalated-cases.md) + Founder ratifications 2026-06-30 + 3-lane mini-panel convergence
**CD scaffolds:** [`/Users/ife/replant/docs/design_handoff_escalated_cases/`](./design_handoff_escalated_cases/)

---

## ⚠️ DEPLOY DISCIPLINE — feature branch only, NEVER main

Per [[feedback-preview-first-deploy]] + [[feedback-all-pushes-need-greenlight]]:

- All admin BE + FE work lands on a **feature branch** in `replant-admin` (e.g. `feat/kan-293-escalated-cases`)
- Push to feature branch → **Netlify preview deploy** auto-triggers
- Founder smokes the preview link FIRST
- Founder herself merges to main when ready — that's the production deploy
- **NEVER push to main, NEVER auto-merge.** Build agents must open a PR + paste the preview URL when complete.

Mobile FE work (Task #21) ships per the looser `~/replant` posture (no Netlify cost; Founder still owns merge).

DBA migrations: apply to live Supabase ONLY after Founder ratifies the migration SQL on a per-migration basis. Use `mcp__supabase__apply_migration` and surface the migration name + intent before applying.

---

## 1. Overview

Build the **Pastoral Care** parent sidebar entry (replaces the existing Pastoral Signals + Flagged Messages siblings) with **4 tabs**: Pastoral Signals · Flagged Messages · Replant Team Inbox · Escalated Cases. The Escalated Cases tab is the new surface (super_admin + Manager only, anti-gossip rule). All 4 tabs share the parent + tab bar; per-tab eyebrow preserved.

**The Escalated Cases tab:**
- Gathers cases promoted from `/pastoral` and `/flagged` (regular admin escalates) AND UG-touched messages auto-routed at write-time (never lands on `/pastoral` or `/flagged`)
- Three-tier visibility (regular locked out; super_admin proposes; Manager approves)
- Propose / approve ceremony mirrors `/underground` confirm-proposal pattern
- Reach Out via Connect DM (KAN-220) with 7-day auto-email fallback
- Close-case with 8-token disposition + reason ≥30 chars; closed cases leave the surface (no Resolved register)

**Scope OUT (separate tickets):**
- Destructive action EXECUTION (revoke / restrict / 3-strikes auto-deactivate) — Task #17 Leader Suspension Lifecycle. ApproveProposal stubs the suspension call with 501 until #17 lands.
- Backwards-compat UG dual-source gates on existing flagged-message viewing endpoints — Task #20 (independent BE track; co-ships with this bundle for consistency).
- Reporting flow + Pastoral Support page — separate workstream after this bundle.

---

## 2. Dependencies + sequencing

| Phase | Work | Gated by |
|---|---|---|
| 1 | DBA migrations (3 new tables / 2 triggers / audit CHECK + VIEW) | None |
| 2 | Mobile FE attribution slot (Task #21) | Phase 1 (uses new message attribution column) |
| 3 | BE endpoints (7 new + 2 extended) | Phase 1 (schema) + Phase 2 (attribution slot for reach-out) |
| 4 | Admin FE wire-up (lift CD scaffolds + nav patch + lib/api wrappers) | Phase 3 (endpoints exist) |
| 5 | Smoke + integration tests | Phases 1-4 complete |

**Parallel track:** Task #20 (SEC F1+F2+F3 backwards-compat fixes on existing endpoints) — independent BE work; can ship same release window for consistency but doesn't block this bundle.

---

## 3. Phase 1 — DBA migrations

All migrations **ADD-ONLY** to live state. Read live `audit_log_action_check` constraint via `pg_get_constraintdef` before authoring Migration 4; copy the 64 existing actions verbatim.

### Migration 1 — `20260701000001_create_escalated_cases.sql`

```sql
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
```

### Migration 2 — `20260701000002_create_escalated_case_proposals.sql`

```sql
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
```

### Migration 3 — `20260701000003_create_ug_auto_route_triggers.sql`

```sql
-- Flagged axis trigger
CREATE OR REPLACE FUNCTION fn_auto_route_ug_flagged()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender_ug boolean;
  v_receiver_ug boolean;
  v_existing uuid;
BEGIN
  IF NEW.flag_status IS DISTINCT FROM 'escalated' THEN RETURN NEW; END IF;
  IF OLD.flag_status = 'escalated' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM escalated_cases WHERE source_message_id = NEW.id;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT (c.type = 'underground') INTO v_sender_ug
    FROM users u JOIN churches c ON c.id = u.church_id
    WHERE u.id = NEW.sender_id;
  SELECT (c.type = 'underground') INTO v_receiver_ug
    FROM users u JOIN churches c ON c.id = u.church_id
    WHERE u.id = NEW.receiver_id;

  IF COALESCE(v_sender_ug, false) OR COALESCE(v_receiver_ug, false) THEN
    INSERT INTO escalated_cases (
      source_axis, source_message_id, leader_user_id, receiver_user_id,
      state, escalation_reason, escalation_context,
      escalated_by_user_id, escalated_by_tier, auto_routed
    ) VALUES (
      'auto_underground', NEW.id, NEW.sender_id, NEW.receiver_id,
      'open', 'auto_underground',
      'Underground party in this exchange — auto-routed past Flagged.',
      NULL, NULL, true
    );

    INSERT INTO audit_log (action, accessed_by, triggered_by, meta) VALUES (
      'escalated_case_auto_routed', NULL, 'trigger:fn_auto_route_ug_flagged',
      jsonb_build_object('message_id', NEW.id, 'sender_ug', v_sender_ug, 'receiver_ug', v_receiver_ug, 'source_axis', 'flagged')
    );
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_auto_route_ug_flagged
  AFTER UPDATE OF flag_status ON public.messages
  FOR EACH ROW EXECUTE FUNCTION fn_auto_route_ug_flagged();

-- Pastoral axis trigger — fires when moderation_state.status flips to 'escalated' AND axis='admin'
CREATE OR REPLACE FUNCTION fn_auto_route_ug_pastoral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg messages%ROWTYPE;
  v_sender_ug boolean;
  v_receiver_ug boolean;
  v_existing uuid;
BEGIN
  IF NEW.axis <> 'admin' OR NEW.status IS DISTINCT FROM 'escalated' THEN RETURN NEW; END IF;
  IF OLD.status = 'escalated' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM escalated_cases WHERE source_message_id = NEW.message_id;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_msg FROM messages WHERE id = NEW.message_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT (c.type = 'underground') INTO v_sender_ug
    FROM users u JOIN churches c ON c.id = u.church_id WHERE u.id = v_msg.sender_id;
  SELECT (c.type = 'underground') INTO v_receiver_ug
    FROM users u JOIN churches c ON c.id = u.church_id WHERE u.id = v_msg.receiver_id;

  IF COALESCE(v_sender_ug, false) OR COALESCE(v_receiver_ug, false) THEN
    INSERT INTO escalated_cases (
      source_axis, source_message_id, leader_user_id, receiver_user_id,
      state, escalation_reason, escalation_context,
      escalated_by_user_id, escalated_by_tier, auto_routed
    ) VALUES (
      'auto_underground', v_msg.id, v_msg.sender_id, v_msg.receiver_id,
      'open', 'auto_underground',
      'Underground party in this exchange — auto-routed past Pastoral.',
      NULL, NULL, true
    );

    INSERT INTO audit_log (action, accessed_by, triggered_by, meta) VALUES (
      'escalated_case_auto_routed', NULL, 'trigger:fn_auto_route_ug_pastoral',
      jsonb_build_object('message_id', v_msg.id, 'sender_ug', v_sender_ug, 'receiver_ug', v_receiver_ug, 'source_axis', 'pastoral')
    );
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_auto_route_ug_pastoral
  AFTER UPDATE OF status ON public.moderation_state
  FOR EACH ROW EXECUTE FUNCTION fn_auto_route_ug_pastoral();
```

### Migration 4 — `20260701000004_extend_audit_log_action_check.sql`

```sql
-- READ LIVE CONSTRAINT FIRST: SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conname = 'audit_log_action_check';
-- COPY THE 64 EXISTING ACTIONS VERBATIM INTO THE ARRAY BELOW.

ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (
  action = ANY (ARRAY[
    -- (64 existing actions — copy from pg_get_constraintdef output)
    -- NEW for KAN-293/295/296/292:
    'escalated_case_created',
    'escalated_case_auto_routed',
    'escalated_proposal_proposed',
    'escalated_proposal_approved',
    'escalated_proposal_rejected',
    'escalated_case_closed',
    'escalated_inbox_opened',
    'escalated_case_reach_out_sent'
  ])
);
```

### Migration 5 — `20260701000005_create_v_escalated_inbox.sql`

```sql
CREATE OR REPLACE VIEW public.v_escalated_inbox
WITH (security_invoker = true) AS
SELECT
  ec.id              AS case_id,
  ec.case_id_seq,
  ec.source_axis,
  ec.source_message_id,
  ec.state,
  ec.escalation_reason,
  ec.escalation_context,
  ec.escalated_by_user_id,
  ec.escalated_by_tier,
  ec.auto_routed,
  ec.created_at,
  ec.leader_user_id,
  ec.receiver_user_id,
  ec.reach_out_message_id,
  ecp.id             AS proposal_id,
  ecp.action         AS proposal_action,
  ecp.reasoning      AS proposal_reasoning,
  ecp.proposer_id    AS proposal_proposer_id,
  ecp.proposer_tier  AS proposal_proposer_tier,
  ecp.created_at     AS proposal_created_at,
  ecp.expires_at     AS proposal_expires_at,
  EXTRACT(EPOCH FROM (now() - ec.created_at)) / 86400.0 AS age_days
FROM public.escalated_cases ec
LEFT JOIN public.escalated_case_proposals ecp
  ON ecp.case_id = ec.id AND ecp.proposal_status = 'pending'
WHERE ec.state <> 'closed';
```

### Migration 6 — `20260701000006_update_existing_escalate_paths.sql`

Migrates `messages.flag_status='escalated'` writes (already happening) to ALSO write a `moderation_state` admin-axis row + INSERT into `escalated_cases` from the BE side (NOT from triggers — done in Phase 3 BE extensions). This migration backfills the historical rows:

```sql
-- One-shot backfill: existing messages with flag_status='escalated' but no escalated_cases row
INSERT INTO escalated_cases (
  source_axis, source_message_id, leader_user_id, receiver_user_id,
  state, escalation_reason, escalation_context,
  escalated_by_user_id, escalated_by_tier, auto_routed
)
SELECT
  'flagged', m.id, m.sender_id, m.receiver_id,
  'open', 'unsure',
  'Backfilled from pre-launch flagged-escalated row.',
  m.flag_reviewed_by, 'super_admin', false
FROM messages m
LEFT JOIN escalated_cases ec ON ec.source_message_id = m.id
WHERE m.flag_status = 'escalated' AND ec.id IS NULL;

-- Audit the backfill (one row, system actor)
INSERT INTO audit_log (action, accessed_by, triggered_by, meta) VALUES (
  'escalated_case_created', NULL, 'migration:20260701000006',
  jsonb_build_object('backfill', true, 'reason', 'pre-launch flagged-escalated rows')
);
```

---

## 4. Phase 2 — Mobile FE sub-sprint (Task #21)

**Goal:** add `attribution.display_name` field to message rows that mobile Connect DM thread renders as `"<First> from Replant Team"` above the message bubble.

### DB sub-step (in same Phase 1 migration window)

Add column to `messages`:

```sql
ALTER TABLE public.messages
  ADD COLUMN attribution_display_name text;

-- No CHECK; nullable; populated by send-team-reply.js extension.
```

### Mobile FE changes

- `src/screens/main/ConnectScreen.tsx` DM thread renderer — when `message.attribution_display_name` is non-null AND sender is `SYSTEM_USER_ID`, render attribution row above the bubble (small caps + muted): `<First> · Replant Team`
- Style: `Typography.eyebrow` register, `--text-muted` color, 4px gap above bubble
- Empty/null attribution → render existing "Replant Team" only (backwards compat)

### BE sub-step

Extend `send-team-reply.js` to accept `{ attribution_display_name?: string }` in the body. Write the value into the new column when present. Falls back to NULL when absent (existing KAN-220 outbound paths unaffected).

### Smoke

- Send a Replant Team reply with `attribution_display_name='Sarah'` → leader sees "Sarah · Replant Team" header on the new message
- Existing pre-Task-#21 messages (NULL column) → leader sees no attribution header, just "Replant Team" thread label as today

---

## 5. Phase 3 — BE endpoints

7 new files in `/Users/ife/replant-admin/netlify/functions/` + 2 extensions to existing files.

All endpoints follow the standard pattern: `verifyAnyAdmin` → `assertAtLeast(...)` → `checkAal2Freshness(...)` → `validateStepUp(...)` (where required) → audit-first → BE work → response.

### BE primitives — verified live 2026-06-30 (use these exact shapes)

Substance pass against actual `_lib/*` files. Use these signatures verbatim — earlier drafts in this manifest used shorthand:

| Primitive | Verified signature |
|---|---|
| `verifyAnyAdmin(authHeader)` | Returns `{ user: { id, email, auth_id }, jwt }` where `user.id` is **public.users.id** (resolved via auth_id lookup). Throws Error with `.status` on failure. |
| `assertAtLeast(authHeader, requiredTier)` | `TIER_RANK = { top_tier: 3, super_admin: 2, regular: 1 }`. `assertAtLeast(authHeader, 'super_admin')` admits Manager + super_admin. `assertAtLeast(authHeader, 'top_tier')` admits Manager only. |
| `checkAal2Freshness(jwt, opts)` | **`opts` is OBJECT, NOT bare tier string.** Use `{ tier: TIER_BROWSE }` / `{ tier: TIER_REGULAR_DESTRUCTIVE }` / `{ tier: TIER_SENSITIVE_DESTRUCTIVE }`. Returns `{ ok, reason }` — DOES NOT throw. Caller checks `.ok` and returns `fail(reason, 401)` on false. |
| `validateStepUp(token, { expectedAction, expectedUserId, event })` | Pre-instantiated export from `supabase-admin.js` (line 356). `expectedUserId` is **public.users.id** (= `user.id` from verifyAnyAdmin), NOT `auth_id`. Returns `{ id, action } \| null`. Audit-logs failures automatically. |
| `writeAuditLog({ action, accessedBy, triggeredBy, churchId, meta })` | `accessedBy` is **public.users.id** (= `user.id` from verifyAnyAdmin), NOT `auth_id`. `churchId` is nullable — escalated_case_* rows pass `null` (case spans leader pairs across churches). `action` MUST be in CANONICAL_ACTIONS Set + DB CHECK constraint or throws 500. |
| `scrubAndCap(text, maxLen = 500)` | Scrubs email/URL/IPv4/IPv6/phone, then caps at 500 with `…[truncated]` marker. |
| `makeRateLimiter({ redis, keyPrefix, limit, windowMs })` | Returns `async (identifier) => { allowed, count, limit, remaining, reset, degraded? }`. `keyPrefix` is the namespace (e.g. `'reach-out'`), identifier is per-call (e.g. `leader_user_id`). Full key becomes `<keyPrefix>:<identifier>:<bucket>`. **Fails OPEN with `degraded: true` if Upstash unreachable** — accept as residual risk per existing platform pattern. |
| Step-up token mint | Step-up tokens are minted via `request-step-up.js` after fresh password re-verify. The FE handles the mint flow via `useStepUp(action)` hook + `ElevationModalHost`. BE just calls `validateStepUp` to verify the token sent in `X-StepUp-Token` header. |
| Pattern: catching DB partial-unique 23505 | DO NOT use `ON CONFLICT (case_id) WHERE proposal_status='pending'` in INSERT — Postgres requires constraint-name form for partial-unique ON CONFLICT. Instead: plain INSERT + BE catches `error?.code === '23505'` → returns `fail('PROPOSAL_EXISTS', 409)`. Partial unique index does the DB-level work. |

### 5.1 — `list-escalated-cases.js` (NEW)

```
GET (no body)
Gates: verifyAnyAdmin + assertAtLeast(authHeader, 'super_admin')
       + checkAal2Freshness(jwt, { tier: TIER_BROWSE }) — check .ok
       + UG dual-source filter (only UG admins see UG-touched rows; non-UG get omitted_count)
Rate limit: 60/min per admin via makeRateLimiter({ keyPrefix: 'escalated-inbox', limit: 60, windowMs: 60_000 })
Audit: escalated_inbox_opened (write-first; meta includes count_returned + omitted_underground_count rounded to bucket)
Response: {
  cases: [v_escalated_inbox rows filtered by UG access],
  omitted_underground_count: int (rounded to nearest 10 below 100, nearest 100 below 1000),
  total: int
}
```

Tier-denied path writes `escalated_inbox_opened` with `meta.failure_reason='insufficient_tier'` BEFORE returning 403.

### 5.2 — Extend `triage-pastoral-action.js` (action=`escalate_to_admin`)

Add body fields:
- `escalationReasonCategory` (enum: `destructive_needed`/`pattern_multi_flag`/`pastoral_judgment`/`cross_tier`/`unsure`) — REQUIRED
- `escalationContext` (string ≥30 chars) — REQUIRED, scrubAndCap'd

On action=`escalate_to_admin`, after existing `moderation_state` INSERT, also:

```js
INSERT INTO escalated_cases (
  source_axis: 'pastoral',
  source_message_id: messageId,
  leader_user_id: m.sender_id,
  receiver_user_id: m.receiver_id,
  state: 'open',
  escalation_reason: escalationReasonCategory,
  escalation_context: scrubAndCap(escalationContext, 500),
  escalated_by_user_id: caller.id,
  escalated_by_tier: 'regular',
  auto_routed: false
)
```

Old callers without the new fields: REJECT with 400 `'category_required_post_KAN293'` after the deploy.

### 5.3 — Extend `escalate-flag.js`

Same shape extension. Plus: ALSO write `moderation_state` admin-axis row (was SEC F7 backlog from prior synthesis; now lands here).

### 5.4 — `reach-out-to-leader-from-case.js` (NEW)

```
POST { case_id: uuid, content: string (1..2000) }
Gates: verifyAnyAdmin + assertAtLeast(authHeader, 'super_admin')
       + checkAal2Freshness(jwt, { tier: TIER_REGULAR_DESTRUCTIVE }) — check .ok
       + per-leader 1/24h rate limit: makeRateLimiter({ keyPrefix: 'reach-out', limit: 1, windowMs: 86_400_000 })
         then await rl(leader_user_id) — full key = 'reach-out:<leader_user_id>:<bucket>'
       + UG check (target.church.type='underground' AND !isUndergroundAdmin → 403)
       + Resolve leader's Replant-Team conversation_id (404 'welcome_dm_missing' if absent)

Audit: escalated_case_reach_out_sent (write-first; accessedBy: user.id from verifyAnyAdmin)
Side effects:
  1. UPDATE escalated_cases SET reach_out_message_id, state='awaiting'
  2. INVOKE send-team-reply with attribution_display_name=caller.first_name
  3. UPDATE audit row meta.message_id from the response

Response: { ok, case_id, state: 'awaiting' }
```

### 5.5 — `propose-escalated-action.js` (NEW)

```
POST { case_id: uuid, action: enum, reasoning: string ≥30 }
Gates: verifyAnyAdmin + assertAtLeast(authHeader, 'super_admin')
       + checkAal2Freshness(jwt, { tier: TIER_REGULAR_DESTRUCTIVE }) — check .ok

Validation:
  - action ∈ ('restrict_temporarily','revoke_access','escalate_to_manager')
  - reasoning ≥30, scrubAndCap(reasoning, 500)
  - reasoning UG-identity scan when case touches UG leader → 400 'reasoning_ug_identity_leak'

≥2 Managers floor check:
  SELECT count(*) FROM users WHERE admin_tier='top_tier' AND deleted_at IS NULL
  IF count < 2 → 409 'manager_quorum_required'

DB write (plain INSERT — partial unique index does the race-guard work):
  INSERT INTO escalated_case_proposals (case_id, action, reasoning, proposer_id, proposer_tier)
  ... → BE catches { error?.code === '23505' } → fail('PROPOSAL_EXISTS', 409)
  (DO NOT use ON CONFLICT clause — Postgres partial-unique needs constraint-name form;
   catch-and-translate at the BE is the standard pattern.)

Audit: escalated_proposal_proposed (write-first; accessedBy: user.id from verifyAnyAdmin)
Side effect: UPDATE escalated_cases.state='pending_proposal'

Response: { ok, proposal_id }
```

### 5.6 — `approve-escalated-proposal.js` (NEW)

```
POST { case_id: uuid, proposal_id: uuid }
Headers: X-StepUp-Token REQUIRED

Gates: verifyAnyAdmin + assertAtLeast(authHeader, 'top_tier')   -- Manager ONLY
       + checkAal2Freshness(jwt, { tier: TIER_SENSITIVE_DESTRUCTIVE }) — check .ok (5 min)
       + validateStepUp(token, {
           expectedAction: 'approve-escalated-proposal',
           expectedUserId: user.id,  -- public.users.id from verifyAnyAdmin, NOT auth_id
           event,
         })
         → null return → fail('Step-up authentication required', 401)

TX:
  1. SELECT proposal WHERE proposal_id AND case_id AND state='pending' FOR UPDATE
     → 404 if absent/terminal
  2. IF proposal.proposer_id = user.id → fail('SELF_APPROVE_FORBIDDEN', 403)
     (DB CHECK ecp_no_self_approve is the safety net; BE check is the load-bearing layer)
  3. Audit-first: writeAuditLog({
       action: 'escalated_proposal_approved',
       accessedBy: user.id,
       triggeredBy: 'user',
       churchId: null,  -- case-level, not church-scoped
       meta: { case_id, proposal_id, action_to_take, proposer_id }
     })
  4. IF action ∈ {restrict_temporarily, revoke_access}:
       CALL suspension-lifecycle endpoint (Task #17)
       → if not implemented yet: return fail('suspension_lifecycle_not_implemented', 501)
  5. IF action = 'escalate_to_manager':
       UPDATE proposal.proposal_status='approved', approver_id=user.id, approved_at=now()
       UPDATE escalated_cases.state='open' (re-route into queue)
  6. (auto-close on destructive-approved): UPDATE escalated_cases.state='closed' + disposition

Response: { ok, case_id, action_taken, closed: bool }
```

**Action-name registry:** add `'approve-escalated-proposal'` to `_lib/action-names.js` (BE CJS) + `src/lib/action-names.js` (FE ESM mirror) — both files move together per AC-3.

### 5.7 — `reject-escalated-proposal.js` (NEW)

```
POST { case_id: uuid, proposal_id: uuid, rejection_reason: string ≥30 }
Gates: verifyAnyAdmin + assertAtLeast('top_tier')
       + checkAal2Freshness(jwt, 'regular_destructive')   -- 30 min (non-destructive)
Validation: rejection_reason ≥30, scrubAndCap(rejection_reason, 500)
Audit-first: escalated_proposal_rejected
Side effect: UPDATE proposal.state='rejected', UPDATE escalated_cases.state='open'
Response: { ok, case_id }
```

### 5.8 — `close-escalated-case.js` (NEW)

```
POST { case_id: uuid, disposition: enum (8-token), note: string ≥30 }
Gates: verifyAnyAdmin + assertAtLeast('super_admin')
       + checkAal2Freshness(jwt, 'regular_destructive')
Validation: disposition ∈ 8-enum, note ≥30, scrubAndCap(note, 500)
TX:
  1. SELECT escalated_cases WHERE case_id FOR UPDATE
     → 404 if absent
  2. IF state='closed' → 409 'CASE_ALREADY_CLOSED' with existing disposition + closed_by_name + closed_at
  3. Audit-first: escalated_case_closed
  4. UPDATE escalated_cases SET state='closed', closed_at, closed_by_user_id, closed_disposition, closed_note=scrubAndCap(note, 500)
  5. (If associated pending proposal exists): UPDATE proposal.state='cancelled'

Response: { ok, case_id, disposition }
```

### 5.9 — Add to `_lib/supabase-admin.js` CANONICAL_ACTIONS Set

8 new entries:
```
'escalated_case_created',
'escalated_case_auto_routed',
'escalated_proposal_proposed',
'escalated_proposal_approved',
'escalated_proposal_rejected',
'escalated_case_closed',
'escalated_inbox_opened',
'escalated_case_reach_out_sent'
```

### 5.10 — `_lib/action-names.js`

Add new step-up action:
```js
APPROVE_ESCALATED_PROPOSAL: 'approve-escalated-proposal'
```

Default 5-min TTL.

---

## 6. Phase 4 — Admin FE wire-up

### File lifts (verbatim from CD scaffolds)

- `EscalatedCases.jsx` → `replant-admin/src/screens/`
- `EscalatedCaseDrawer.jsx` → `replant-admin/src/components/escalated/`
- `ReachOutModal.jsx`, `ProposeActionModal.jsx`, `ApproveProposalModal.jsx`, `CloseCaseModal.jsx`, `EscalateThisCaseModal.jsx` → `replant-admin/src/components/escalated/`
- `Shell.nav-patch.jsx` — merge into `replant-admin/src/components/Shell.jsx` (replaces existing Pastoral Signals + Flagged Messages sidebar entries with single Pastoral Care parent)
- `globals.additions.css` — append to `replant-admin/src/styles/globals.css`

### `lib/api.js` — 7 new exports

```js
export async function listEscalatedCases(opts) {...}
export async function escalateCaseFromQueue({ source, sourceRow, reason, context }) {...}
export async function reachOutToLeader(case_id, content) {...}
export async function proposeEscalatedAction(case_id, { action, reasoning }) {...}
export async function approveEscalatedProposal(case_id, proposal_id, stepUpToken) {...}
export async function rejectEscalatedProposal(case_id, proposal_id, { rejection_reason }) {...}
export async function closeEscalatedCase(case_id, { disposition, note }) {...}
```

### Routing — `src/App.jsx`

```jsx
<Route path="/triage" element={<RequireTier min="super_admin"><TriageSurface /></RequireTier>}>
  <Route path="pastoral" element={<PastoralQueue />} />
  <Route path="flagged" element={<Flagged />} />
  <Route path="team-inbox" element={<TeamInbox />} />
  <Route path="escalated" element={<EscalatedCases />} />
</Route>
```

Regular admins get redirected from `/triage/escalated` to `/triage/pastoral` (the first tab they can see).

### `lib/role-humanisation.js` (NEW helper if not present)

```js
export function roleLabel(role) {
  // 12-enum → display title, per [[reference-role-humanisation]]
}
```

---

## 7. Phase 5 — Smoke checklist + integration tests

### Pre-deploy validation

- [ ] `pg_get_constraintdef('audit_log_action_check')` returns the expected 72 actions (64 existing + 8 new)
- [ ] All 4 new tables / VIEW present in `information_schema.tables`
- [ ] Both triggers fire on test message → escalated_cases row appears with `auto_routed=true`
- [ ] CANONICAL_ACTIONS Set in supabase-admin.js matches DB CHECK constraint
- [ ] Step-up action `approve-escalated-proposal` registered in action-names.js (both BE CJS + FE ESM twins)

### Smoke scenarios (end-to-end)

1. **Regular escalates from /pastoral** → case row in escalated_cases (source_axis='pastoral'); row leaves /pastoral; super_admin sees in Escalated Cases tab
2. **Regular escalates from /flagged** → same with source_axis='flagged'
3. **UG-touched flagged message** → trigger fires; case row with auto_routed=true; non-UG admin sees omitted_count in list response, UG admin sees the row with `Auto-routed · underground` badge
4. **Solo Manager tries to propose** → 409 manager_quorum_required (need ≥2 active Managers)
5. **SA proposes restrict** → row state→`pending_proposal`; proposal row in escalated_case_proposals
6. **Manager B approves SA's proposal** → 501 from suspension-lifecycle until Task #17; audit row written; case closed=true after suspension landing
7. **Manager A tries to approve own proposal** → 403 SELF_APPROVE_FORBIDDEN (BE + DB CHECK)
8. **Concurrent SA propose** → second gets 409 PROPOSAL_EXISTS (partial unique catches 23505)
9. **Reach Out fires** → audit row + Replant Team thread receives message with attribution `<First> · Replant Team`; case state='awaiting'
10. **Close case** → row leaves v_escalated_inbox VIEW; audit row permanent; trying to close again 409 CASE_ALREADY_CLOSED
11. **Regular admin direct-call `list-escalated-cases`** → 403 with audit row meta.failure_reason='insufficient_tier'
12. **Self-approve via curl bypass** → BE 403 SELF_APPROVE_FORBIDDEN; DB CHECK would also fire if BE missed

### Test data needed

- 2+ active Manager accounts (for ≥2 floor smoke)
- 1 active super_admin who isn't a Manager
- 1 active regular admin
- 1 UG church + 1 leader in it
- 1 non-UG church + 2 leaders (sender + receiver)

---

## 8. Reconciliation with Task #20

Task #20 (SEC F1+F2+F3 backwards-compat fixes) ships the dual-source UG gate on existing flagged-message admin viewing endpoints (`list-flagged-messages`, `open-flagged-message`, `expand-pastoral-context`, `clear-flag`, `escalate-flag`). 

This bundle handles GOING-FORWARD UG content via the auto-routing trigger — UG messages NEVER land in `/pastoral` or `/flagged` for non-UG admins because the trigger writes them into escalated_cases instead.

Task #20 handles the pre-launch backlog of UG-touched flagged rows that exist in prod RIGHT NOW with no gate. Both ship in the same release window.

---

## 9. Rollback strategy

| Phase | Rollback shape |
|---|---|
| 1 (DB) | Per-migration DROP scripts. Order: VIEW → triggers → CHECK constraint restore → tables. Backfill data (Migration 6) reversible only by restoring from snapshot — accept the risk |
| 2 (mobile) | Feature-flag the attribution slot rendering; revert mobile commit |
| 3 (BE) | Each endpoint independently shippable; Netlify rollback per function. Extensions to triage-pastoral-action + escalate-flag are backwards-compat (new fields optional during phased deploy) |
| 4 (admin FE) | Revert Shell.jsx merge → restore the pre-bundle sibling sidebar entries; remove /triage routes |

---

## 10. Open items

Substance pass against live `_lib/*` code completed 2026-06-30 (in lieu of full mini-panel — see BE primitives table at §5). Verified-correct: `assertAtLeast` tier ranks, `verifyAnyAdmin` user-id resolution, `writeAuditLog` shape, `scrubAndCap` signature, CANONICAL_ACTIONS Set update location, `validateStepUp` factory + pre-instantiated export.

Corrected in-place:
- `checkAal2Freshness(jwt, opts)` takes an OPTIONS OBJECT, returns `{ok, reason}` (doesn't throw)
- `validateStepUp` `expectedUserId` is **public.users.id**, NOT `auth_id`
- `writeAuditLog` `accessedBy` is **public.users.id**, NOT `auth_id`
- Rate limiter `keyPrefix` is the namespace; identifier is per-call
- DB partial-unique → catch 23505 in BE (no `ON CONFLICT` clause)
- `audit_log.church_id` is nullable — case-level rows pass `null`

Locked 2026-06-30:
1. **≥2 Managers floor — HARD-BLOCK.** ruth@ (`bb6c6385-...`) + accounts@ (`19bf5467-...`) both hold top_tier permanently per [[reference-highest-tier-admins]]; the floor is satisfied at all times. `count < 2` returns `409 manager_quorum_required` — no soft-fallback toast needed. Founder noted accounts@ is mid-handoff to a new operator; auth.users row stays, human behind it changes.

Outside this manifest scope but co-shipping:
- Task #20 (SEC F1+F2+F3 backwards-compat BE fixes on existing flagged endpoints) — independent track
- Task #21 (mobile FE attribution slot) — gates Phase 3 reach-out endpoint
- Task #17 stub call on approve-destructive-proposal — returns 501 until the suspension-lifecycle ticket lands

---

*Authored 2026-06-30. Substance pass complete. Ready for 3-lane build dispatch on Founder ratification of the ≥2 Managers floor enforcement posture.*
