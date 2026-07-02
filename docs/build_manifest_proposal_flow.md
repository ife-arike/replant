# Build Manifest — Underground proposal-flow workstream

**Status:** Locked after 4-lane MINI panel (BE + SEC + ADMIN + DBA) + 10 Founder ratifications. All naming below is the contract surface across 2 build subagents (DBA / Admin BE+FE). Mobile lane: SKIPPED (no leader-side touchpoints). Do NOT deviate from this manifest unless you HALT_REQUEST first.

Source docs (REQUIRED reading before writing code):
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — the 2026-06-24 entry has all 10 ratifications + auto-folds verbatim.
- `/Users/ife/replant/docs/build_manifest_in_review.md` — In Review v2 manifest this one extends. The claim model + Realtime Option A pattern + atomic primitive idioms are reused here.
- `/Users/ife/replant/docs/build_manifest_underground_queue.md` — original verification queue manifest where `underground_verification_proposals` was specced.

This sprint LAYERS on the underground In Review claim model (shipped 2026-06-23). It adds: visible in-flight propose state on the Detail page; atomic counter-propose with claim reassignment; proposer-rescind cancel path; hybrid pin (in-app only); fail-loud notify; Inbox surfacing of pending proposals; per-admin Realtime channel; uploader-only evidence delete.

**Locked ratifications (2026-06-24):**
1. Notify channel-down banner copy locked verbatim.
2. Hybrid pin = IN-APP ONLY (email + envelope identical across all admins).
3. Inbox row identifier: masked `UG-XXXX`.
4. Cancel-proposal endpoint for proposer-rescind.
5. Counter-propose = normal two-eyes (no AAL2, no top-tier).
6. Same-action counter-propose DISALLOWED.
7. Pinned-admin Inbox indicator (`⚑ pinned for you` for pinned only).
8. Day-25 routing banner add-on copy.
9. New `'cancelled'` `proposal_status` value.
10. `fn_underground_delete_evidence` privilege patch (uploader-only).

---

## 1 · Database schema additions

All migrations additive. Migration ordering matters; ship `0015` → `0019` sequentially.

### Migration 0015 — Columns on `public.underground_verification_proposals`

```sql
ALTER TABLE public.underground_verification_proposals
  ADD COLUMN pinned_admin_id uuid REFERENCES public.users(id) ON DELETE NO ACTION,
  ADD COLUMN declined_from_proposal_id uuid REFERENCES public.underground_verification_proposals(id) ON DELETE NO ACTION;

-- CHECK: pinned admin must not be the proposer themselves.
ALTER TABLE public.underground_verification_proposals
  ADD CONSTRAINT pinned_admin_not_proposer
  CHECK (pinned_admin_id IS NULL OR pinned_admin_id <> proposer_id);

-- Counter-propose action-difference guard (ruling #6):
-- if declined_from_proposal_id IS NOT NULL (this is a counter), the new
-- action must differ from the original's action. Enforced via trigger
-- because the parent's action requires a lookup.
CREATE OR REPLACE FUNCTION public.fn_assert_counter_propose_distinct_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_parent_action text;
BEGIN
  IF NEW.declined_from_proposal_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT action INTO v_parent_action
    FROM public.underground_verification_proposals
    WHERE id = NEW.declined_from_proposal_id;
  IF v_parent_action IS NULL THEN
    RAISE EXCEPTION 'declined_from_proposal_id references missing row';
  END IF;
  IF NEW.action = v_parent_action THEN
    RAISE EXCEPTION 'counter-propose must use a different action (parent action: %)', v_parent_action
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assert_counter_propose_distinct_action
  BEFORE INSERT ON public.underground_verification_proposals
  FOR EACH ROW EXECUTE FUNCTION public.fn_assert_counter_propose_distinct_action();

-- Partial index supporting Inbox query "proposals awaiting MY confirmation"
-- (filter is proposer_id <> auth_uid_resolved_to_public_id).
CREATE INDEX idx_uvp_pending_by_proposer
  ON public.underground_verification_proposals (proposer_id)
  WHERE proposal_status = 'pending';

-- Index supporting counter-propose lineage rendering on FE.
CREATE INDEX idx_uvp_counter_lineage
  ON public.underground_verification_proposals (declined_from_proposal_id)
  WHERE declined_from_proposal_id IS NOT NULL;
```

### Migration 0016 — `proposal_status` CHECK extension (add `'cancelled'`)

Single `ALTER TABLE` with both DROP and ADD as comma-separated subcommands — atomic inside the ACCESS EXCLUSIVE lock; no window where the constraint is absent.

```sql
ALTER TABLE public.underground_verification_proposals
  DROP CONSTRAINT underground_verification_proposals_proposal_status_check,
  ADD CONSTRAINT underground_verification_proposals_proposal_status_check
    CHECK (proposal_status = ANY (ARRAY['pending', 'confirmed', 'declined', 'cancelled', 'expired']));
```

Also update the existing append-only / terminal-state trigger (`fn_prevent_uvp_terminal_update`) to treat `'cancelled'` as terminal (same posture as `'declined'` / `'confirmed'` / `'expired'`). Verify via `pg_get_functiondef` before patching.

### Migration 0017 — `audit_log_underground.action` CHECK extension (4 new actions)

Single `ALTER TABLE` DROP+ADD:

```sql
ALTER TABLE public.audit_log_underground
  DROP CONSTRAINT audit_log_underground_action_check,
  ADD CONSTRAINT audit_log_underground_action_check
    CHECK (action = ANY (ARRAY[
      /* ... 41 existing values verbatim from pg_get_constraintdef ... */,
      'underground_proposal_declined_with_counter',
      'underground_proposal_counter_created',
      'underground_claim_reassigned_via_counter',
      'underground_proposal_cancelled_by_proposer',
      'underground_propose_notify_dropped'
    ]));
```

(5 new actions; the last one `underground_propose_notify_dropped` supports the fail-loud notify forensic trail.)

### Migration 0018 — `underground_detail_events.kind` CHECK extension (2 new kinds)

```sql
ALTER TABLE public.underground_detail_events
  DROP CONSTRAINT underground_detail_events_kind_check,
  ADD CONSTRAINT underground_detail_events_kind_check
    CHECK (kind = ANY (ARRAY[
      /* ... 10 existing values verbatim ... */,
      'proposal_declined',
      'proposal_counter_created'
    ]));
```

(`claim_changed` is already in the CHECK — covers counter-propose's claim-reassignment event.)

### Migration 0019 — `public.underground_admin_inbox_events` (per-admin Realtime channel)

```sql
CREATE TABLE public.underground_admin_inbox_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  kind text NOT NULL CHECK (kind IN (
    'proposal_awaiting_confirmation',
    'proposal_resolved',
    'proposal_pinned_to_you',
    'proposal_cancelled'
  )),
  ref_id uuid,  -- proposal_id; null for non-proposal future kinds
  emitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX underground_admin_inbox_events_admin_idx
  ON public.underground_admin_inbox_events (admin_id, emitted_at DESC);

ALTER TABLE public.underground_admin_inbox_events ENABLE ROW LEVEL SECURITY;

-- Admin can read their own inbox events; gated by is_underground_admin claim
-- as belt-and-suspenders (the row-level scoping already prevents cross-admin reads).
CREATE POLICY underground_admin_inbox_events_self_select
  ON public.underground_admin_inbox_events FOR SELECT TO authenticated
  USING (
    admin_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    AND COALESCE((auth.jwt() ->> 'is_underground_admin')::boolean, false) = true
  );

REVOKE ALL ON public.underground_admin_inbox_events FROM authenticated, anon;
-- (SECURITY DEFINER RPCs INSERT; reads bypass via the SELECT policy + RLS.)

-- Add ONLY this table to the publication (Option A pattern, ruling #2 of 2026-06-23).
ALTER PUBLICATION supabase_realtime ADD TABLE public.underground_admin_inbox_events;
```

NO PII columns. Even on a misconfigured Realtime subscription, an attacker sees only `admin_id + kind + ref_id + emitted_at`.

---

## 2 · RPC names + signatures

All SECURITY DEFINER, `SET search_path = ''`, JWT preamble (`is_underground_admin` assertion), audit + `underground_detail_events` + `underground_admin_inbox_events` writes inside same transaction.

**CRITICAL GOTCHA carried over from In Review hotfix:** any call to `gen_random_uuid()` MUST be qualified as `extensions.gen_random_uuid()` — pgcrypto lives in the `extensions` schema on this project, and `SET search_path = ''` won't resolve unqualified calls.

### `fn_underground_counter_propose` (NEW — atomic 5-step txn)

```sql
fn_underground_counter_propose(
  p_original_proposal_id uuid,
  p_new_action text,
  p_new_payload jsonb,
  p_pinned_admin_id uuid DEFAULT NULL
) RETURNS jsonb;  -- { new_proposal_id, action_taken: 'counter_proposed' }
```

**Atomic body** (UPDATE-then-INSERT order is load-bearing — `uniq_uvp_pending_per_church_action` enforces per-statement; reordering breaks the txn):

1. JWT preamble: assert `is_underground_admin`.
2. Resolve `v_caller_id` via `fn_assert_underground_admin()` (FK-aligned to `public.users.id`).
3. `SELECT FOR UPDATE` original proposal; assert `proposal_status = 'pending'` AND `proposer_id <> v_caller_id` (decliner cannot be proposer — the cancel endpoint is the proposer-rescind path).
4. `UPDATE` original → `proposal_status = 'declined'`, `confirmer_id = v_caller_id` (decliner held in confirmer slot per existing decline pattern), `counter_notes = <reason>`. Trigger `fn_prevent_uvp_terminal_update` allows `pending → declined`.
5. `SELECT FOR UPDATE` the church row; `UPDATE churches.in_review_claimed_by = v_caller_id, in_review_claimed_at = now()` (reassign claim).
6. `INSERT` new proposal: `proposer_id = v_caller_id`, `action = p_new_action`, `declined_from_proposal_id = p_original_proposal_id`, `pinned_admin_id = p_pinned_admin_id`, payload + admin_notes. Trigger `fn_assert_counter_propose_distinct_action` enforces ruling #6 (different action).
7. INSERT three audit rows: `underground_proposal_declined_with_counter`, `underground_claim_reassigned_via_counter`, `underground_proposal_counter_created`. Also INSERT one `underground_claim_events` row (`event = 'claimed', prev_claimed_by = original proposer, reason_code = 'case_re_routed', reason_supplement = 'Reassigned via counter-propose on proposal {id}'`).
8. INSERT `underground_detail_events` rows: `claim_changed` + `proposal_declined` + `proposal_counter_created`.
9. INSERT `underground_admin_inbox_events` rows for every OTHER underground admin (broadcast) — `kind = 'proposal_awaiting_confirmation'`. If pinned, an additional row for the pinned admin with `kind = 'proposal_pinned_to_you'`.
10. RETURN `{ new_proposal_id, action_taken: 'counter_proposed' }`.

### `fn_underground_cancel_proposal` (NEW — proposer-rescind)

```sql
fn_underground_cancel_proposal(
  p_proposal_id uuid,
  p_cancel_reason text  -- ≥ 30 chars
) RETURNS void;
```

Body:
1. JWT preamble + assert `is_underground_admin`.
2. `v_caller_id := fn_assert_underground_admin()`.
3. `SELECT FOR UPDATE` proposal; assert `proposer_id = v_caller_id` (proposer-only); assert `proposal_status = 'pending'`; assert `length(p_cancel_reason) >= 30`.
4. `UPDATE` proposal → `proposal_status = 'cancelled'`, `confirmer_id = v_caller_id` (proposer-as-self-canceller for audit symmetry), `counter_notes = p_cancel_reason`. Trigger allows `pending → cancelled`.
5. INSERT `audit_log_underground` row: `underground_proposal_cancelled_by_proposer` with meta `{ proposal_id, reason: p_cancel_reason }`.
6. INSERT `underground_detail_events` row: `proposal_declined` (reuse the kind — cancellation surfaces to subscribers as "no longer pending").
7. INSERT `underground_admin_inbox_events` rows for every OTHER admin who had received the `proposal_awaiting_confirmation` notification — `kind = 'proposal_cancelled'`.

### `fn_propose_underground_action` (EXTEND — add `pinned_admin_id` param)

```sql
fn_propose_underground_action(
  -- existing params ...,
  p_pinned_admin_id uuid DEFAULT NULL  -- NEW
) RETURNS jsonb;  -- existing return shape + emit inbox events
```

Body changes:
1. Accept new param; validate via the table CHECK (`pinned_admin_not_proposer`) — if violated, RAISE.
2. If `p_pinned_admin_id IS NOT NULL`, additionally verify the pinned target has `is_underground_admin = true` in their `app_metadata` (lookup against `auth.users`). If not, RAISE.
3. After the existing proposal INSERT, write `underground_admin_inbox_events` rows for every OTHER underground admin (broadcast) — `kind = 'proposal_awaiting_confirmation'`. If pinned, one additional row for the pinned admin with `kind = 'proposal_pinned_to_you'`.

### `fn_underground_delete_evidence` (PATCH — uploader-only)

One-line predicate change in the existing RPC body:

```sql
-- BEFORE: IF v_current_claimer <> v_caller_id THEN RAISE EXCEPTION ...
-- AFTER:  IF v_row.uploader_id <> v_caller_id THEN RAISE EXCEPTION 'only the original uploader can delete this evidence' USING ERRCODE = '42501';
```

Audit row meta gains `{ "uploader_check": "self" }` for forensic clarity.

### `fn_list_admin_inbox_underground_proposals` (NEW — Inbox surface query)

```sql
fn_list_admin_inbox_underground_proposals() RETURNS TABLE (
  proposal_id uuid,
  church_id uuid,
  church_ref text,                -- masked UG-XXXX (NOT church_code per ruling #3)
  action text,
  proposer_id uuid,
  proposer_name text,             -- "R. James" format per existing convention
  pinned_admin_id uuid,
  is_pinned_to_me boolean,        -- TRUE iff pinned_admin_id matches resolved viewer public id
  expires_at timestamptz,
  created_at timestamptz
);
```

Body:
1. JWT preamble + `is_underground_admin` assertion.
2. Resolve viewer's `public.users.id` from `auth.uid()`.
3. SELECT pending proposals where `proposer_id <> v_viewer_id` (exclude proposer's own).
4. Order: `is_pinned_to_me` DESC, then `pinned_admin_id IS NULL` DESC (broadcasts before others' pins), then `created_at` ASC (oldest first).
5. Render `church_ref` as `'UG-' || upper(substring(church_id::text, 1, 4))` (matches existing masked-ref convention).

---

## 3 · RLS write-policy notes

No new column GRANTs needed — `underground_verification_proposals` writes already gated by SECURITY DEFINER RPCs. `underground_admin_inbox_events` REVOKEd from authenticated/anon per Migration 0019.

The existing `fn_prevent_uvp_terminal_update` trigger needs verification it allows `pending → cancelled` (new state). Verify via `pg_get_functiondef` before relying on it.

---

## 4 · Storage — N/A (no storage changes this workstream)

---

## 5 · pg_cron — N/A (no new cron this workstream)

---

## 6 · Netlify functions (admin BE) — 4 endpoint changes + 1 new

| # | Endpoint                                  | Method | Change | RPC backing                              | Rate limit |
|---|-------------------------------------------|--------|--------|------------------------------------------|------------|
| 1 | `/propose-underground`                    | POST   | EXTEND | `fn_propose_underground_action` (+ pin)  | existing   |
| 2 | `/confirm-underground-proposal`           | POST   | UNCHANGED | existing                              | existing   |
| 3 | `/decline-underground-proposal`           | POST   | DEPRECATE + ALIAS | wraps `fn_underground_counter_propose` for back-compat | existing |
| 4 | `/counter-propose-underground`            | POST   | NEW    | `fn_underground_counter_propose`         | `ug:counter-propose` (10/min/admin) |
| 5 | `/cancel-underground-proposal`            | POST   | NEW    | `fn_underground_cancel_proposal`         | `ug:cancel-proposal` (10/min/admin) |
| 6 | `/list-admin-inbox-underground-proposals` | POST   | NEW    | `fn_list_admin_inbox_underground_proposals` | read-only, no rate limit |

### `/propose-underground` extension

Body accepts new optional `pinned_admin_id: uuid|null`. Validate before RPC call: must be a known underground admin (cross-check via `supabaseAdmin.auth.admin.listUsers` with the existing `is_underground_admin` filter); must not equal proposer's id; 400 on either violation.

**Response shape change** (per BE B02 fail-loud):

```js
{
  proposal_id: '...',
  notify: {
    targeted: 3,   // other admins that should have been emailed
    sent: 0,       // actual successful sends
    failed: 0,     // resend send errors
    channel_down: true  // RESEND_API_KEY missing OR all sends failed
  }
}
```

`notifyOtherAdmins` returns `{ sent, failed, targeted }` instead of void. Endpoint awaits the result, sets `channel_down = (sent === 0 && targeted > 0)`. If `channel_down`, also write an `underground_propose_notify_dropped` audit row (forensic trail).

**Hybrid pin email parity (ruling #2):** `notifyOtherAdmins` MUST NOT differentiate subject / body / envelope by pin state. Single-recipient `to:` per send (no Bcc gymnastics). Pin is purely an in-app affordance. Add a unit-test invariant asserting subject + body are exact string literals.

### `/counter-propose-underground` (NEW)

Body: `{ original_proposal_id, new_action, new_payload, pinned_admin_id? }`. Calls `fn_underground_counter_propose`. Same notify pattern as propose (emits inbox events server-side; ALSO sends emails to other admins per the same `notifyOtherAdmins` shape — including the original proposer so they learn their proposal was countered).

### `/cancel-underground-proposal` (NEW)

Body: `{ proposal_id, cancel_reason }`. Calls `fn_underground_cancel_proposal`. ALSO sends an email to every admin who had received the original `proposal_awaiting_confirmation` notification (identical fixed-string subject/body — same security posture as propose).

### `/list-admin-inbox-underground-proposals` (NEW)

Body: `{}`. POST per existing platform convention. Returns the RPC's table rows.

### `src/lib/api.js` exports

```js
export const counterProposeUnderground = (args) =>
  call('counter-propose-underground', args)
export const cancelUndergroundProposal = (proposal_id, cancel_reason) =>
  call('cancel-underground-proposal', { proposal_id, cancel_reason })
export const listAdminInboxUndergroundProposals = () =>
  call('list-admin-inbox-underground-proposals', {})
// EXTEND existing proposeUnderground export to thread optional pinned_admin_id
```

---

## 7 · React (admin FE) deliverables

### New components

| File path | Description |
|---|---|
| `replant-admin/src/components/underground/PinnedAdminSelect.jsx` | Dropdown for "Notify (optional)" — default "All underground admins (broadcast)" + alphabetical list of other admins by name. NO last-choice memory. |
| `replant-admin/src/components/underground/CancelProposalModal.jsx` | One-modal ceremony per ratification #4. Required `cancel_reason` textarea (≥30 chars). Title/body/CTA verbatim from locked copy below. |
| `replant-admin/src/components/underground/NotifyChannelDownBanner.jsx` | Yellow banner rendered on Detail page when `notify.channel_down || notify.sent === 0` after a propose / counter-propose / cancel response. Locked copy: *"Email notice failed to send. Please reach out to an admin directly to ensure action is taken."* |

### Edited components

| File path | Edits |
|---|---|
| `src/screens/UndergroundDetail.jsx` | (1) Replace `navigate('/underground')` at lines 631/638 with `await reload()` so proposer lands on in-flight state. (2) Drop the `{!claim && <StatePill .../>}` guard at line ~462; the composite In Review pill (Ask 1) handles all states. (3) Compose `<InReviewPill ... awaitingConfirm={{ admin_name, expires_at }} />` when `pending_proposal_id` is present. (4) Insert in-flight banner above Action Bar with copy variants (broadcast / pinned / Day-25-routed). (5) Insert `Cancel proposal` CTA inside the in-flight banner (proposer-only). (6) 3-way disabled-CTA tooltip per the locked-CTA matrix (proposer / non-proposer / claim-lock). (7) Subscribe to per-admin Realtime channel `underground_admin_inbox_events` and re-fetch the Inbox tab badge on event. |
| `src/components/underground/ClaimAffordance.jsx` | Extend `InReviewPill` to accept `awaitingConfirm={{ admin_name, expires_at }}` prop. Render composite when present: `In review by R. James · awaiting confirm by Admin B · expires Jun 26`. Staleness hue rules unchanged. |
| `src/components/underground/DeclineProposalModal.jsx` | Rewrite per ratification + ADMIN copy lock. Title: `"Decline · counter-propose"`. Body: `"Declining this proposal hands the case to you as the active reviewer. R. James's notes and evidence remain visible but cannot be edited — you can add your own under your claim. After declining, file your counter-proposal from the action bar."` Submit CTA: `"Cancel · Decline · take over case"`. Now accepts a new_action + new_payload + optional pinned_admin_id (full proposal-collecting modal, not just decline reason). Calls `/counter-propose-underground`. |
| `src/components/underground/ConfirmProposalModal.jsx` | Add the one-modal ceremony (title, body, CTA per ADMIN copy lock). No typed-name (ceremony reserved for destructive). |
| `src/components/underground/ProposeVerifyPanel.jsx` + `ProposeRejectPanel.jsx` + `VisibilityOverrideModal.jsx` | Add `<PinnedAdminSelect>` to each. On success: `await reload()` (NOT `navigate`). If response has `notify.channel_down`, render `<NotifyChannelDownBanner>` on the Detail page. |
| `src/screens/UndergroundInbox.jsx` | Extend to surface pending proposals via `listAdminInboxUndergroundProposals()`. Row state pill: amber. Row label: `Proposed VERIFY` / `Proposed REJECT` (or other action). For rows where `is_pinned_to_me === true`, prepend small monospace eyebrow `⚑ pinned for you · ` above the Ref cell. |
| `src/styles/globals.css` | Add `.notify-channel-down-banner` (yellow + warm border), `.inflight-banner` (sky-tinted + composite layout), `.inbox-pinned-eyebrow` (mono eyebrow style), `.proposal-action-label` (uppercase verb for `Proposed VERIFY`). |

---

## 8 · Realtime channel — `underground_admin_inbox_events`

Per-admin subscription pattern. FE subscribes on app boot (or Inbox tab mount — pick): `supabase.channel('admin_inbox:' + viewerPublicUserId)` filtered on `admin_id` via the table RLS (no client-side filter needed since RLS scopes the rows).

Events received:
- `proposal_awaiting_confirmation` → increment Inbox badge, re-fetch on next Inbox tab visit.
- `proposal_pinned_to_you` → increment Inbox badge + show subtle in-app toast `"R. James pinned you to review a proposal."` (toast copy lock).
- `proposal_resolved` → decrement Inbox badge.
- `proposal_cancelled` → decrement Inbox badge.

NEVER trust the event payload as authoritative state — re-fetch by ID.

---

## 9 · Cross-lane dependency graph

```
DBA lane (0015 → 0019)
   │
   ├─→ blocks BE lane (RPCs must exist before endpoints can wire)
   │
   └─→ blocks Realtime publication add (channel can't subscribe to non-existent table)

BE lane (gate → 4 endpoint changes + 1 new + notifyOtherAdmins refactor)
   │
   └─→ blocks FE component wiring
```

**Suggested subagent split:**
- **DBA subagent:** owns migrations 0015–0019, the new RPCs (`fn_underground_counter_propose`, `fn_underground_cancel_proposal`, `fn_list_admin_inbox_underground_proposals`), the `fn_propose_underground_action` extension, the `fn_underground_delete_evidence` patch, trigger updates, Realtime publication add.
- **Admin BE+FE subagent:** owns 4 endpoint changes + 1 new endpoint + `notifyOtherAdmins` refactor + 3 new components + 7 edited components/screens + globals.css additions + Realtime subscription pattern.

Mobile lane: SKIPPED.

---

## 10 · HALT-IF protocol (both subagents)

Stop and HALT_REQUEST when ANY of:

1. A spec-locked Founder ruling appears to conflict with the manifest as written.
2. `fn_prevent_uvp_terminal_update` trigger does NOT allow `pending → cancelled` transition (must be patched before Migration 0016 lands).
3. The atomic counter-propose RPC's UPDATE-then-INSERT ordering doesn't satisfy the `uniq_uvp_pending_per_church_action` partial unique index (contained test required — DO NOT test against real church rows; create a temporary table mirror).
4. `notifyOtherAdmins` cannot be refactored to return a result shape without breaking shipped callers (audit shipped callsites first).
5. Realtime publication add fails on `underground_admin_inbox_events`.
6. `auth.admin.listUsers` cannot validate the pinned admin's `is_underground_admin` flag (rate limit, auth schema change).
7. Any RPC body needs `gen_random_uuid()` and the qualified `extensions.gen_random_uuid()` doesn't resolve.
8. Any other situation where the manifest's spec doesn't survive contact with live schema.

DO NOT write `audit_log_underground` or `audit_log` probe rows. Use introspection (`pg_get_constraintdef`, `pg_get_functiondef`, `pg_get_triggerdef`).

---

## 11 · Locked copy (verbatim from ADMIN panel — no invention)

### Composite top-right pill
- Proposer + Admin B not yet acted: `In review by R. James · awaiting confirm by Admin B · expires Jun 26`
- Day-25 routed variant: `In review by R. James · awaiting confirm — routed to Founder · expires Jun 26`

### Banner above Action Bar
- **Broadcast (no pin):**
  - Title: `You proposed VERIFY on Jun 23.`
  - Body: `All underground admins have been notified to confirm or counter-propose. Primary actions are paused while the proposal is in flight.`
- **Pinned variant:**
  - Title: `You proposed VERIFY on Jun 23.`
  - Body: `Maria S (your pinned reviewer) has been notified; all other underground admins can also confirm. Primary actions are paused while the proposal is in flight.`
- **Day-25 routed add-on line** (appended to body):
  - `This case has been routed to Founder review. The Founder can confirm or counter-propose your proposal.`

### Disabled-CTA tooltips
- **Proposer's own view (proposal in flight):** `Proposal in flight — waiting on Admin B. Cancel the proposal to take a different action.`
- **Other admin's view (proposal in flight, not pinned, not proposer):** `R. James has a proposal in flight. Confirm or decline it from the action bar above.`
- **Existing claim-lock case (unchanged):** `Locked — Maria S is reviewing this case. Use Request release to coordinate.`

### Confirm-proposal modal
- Title: `Confirm VERIFY on UG-6D86?` / `Confirm REJECT on UG-6D86?`
- Body: `This will execute the action proposed by R. James on Jun 23. The case will be marked verified and the leader will be notified.` (reject variant: `... marked rejected; the leader will receive the templated rejection email.`)
- CTA: `Cancel · Confirm verify` / `Cancel · Confirm reject`

### Counter-propose modal (replaces current DeclineProposalModal)
- Title: `Decline · counter-propose`
- Body: `Declining this proposal hands the case to you as the active reviewer. R. James's notes and evidence remain visible but cannot be edited — you can add your own under your claim. After declining, file your counter-proposal from the action bar.`
- CTA: `Cancel · Decline · take over case`

### Cancel-proposal modal
- Title: `Cancel your VERIFY proposal?`
- Body: `The proposal will be withdrawn and the case returns to your claim with no two-eyes step in flight. Admin B will be notified that you cancelled.`
- CTA: `Keep proposal · Cancel proposal`

### Notify channel-down banner
- `Email notice failed to send. Please reach out to an admin directly to ensure action is taken.`

### Inbox row label
- `Proposed VERIFY` / `Proposed REJECT` (uppercase action, sentence-case verb)

### Inbox pinned prefix (pinned admin only)
- `⚑ pinned for you · ` (small monospace eyebrow above Ref cell)

### Notify (optional) dropdown default
- `All underground admins (broadcast)`

### Pinned-toast (in-app, on receipt of `proposal_pinned_to_you` Realtime event)
- `R. James pinned you to review a proposal.`

---

## 12 · Output format (each subagent's final response)

```
VERDICT: shipped | shipped-with-deviations | halted
MIGRATIONS APPLIED: [0015, 0016, 0017, 0018, 0019]
RPCS CREATED: [...]
RPCS PATCHED: [fn_propose_underground_action, fn_underground_delete_evidence, fn_prevent_uvp_terminal_update?]
NETLIFY ENDPOINTS ADDED: [...]
NETLIFY ENDPOINTS EDITED: [...]
COMPONENTS CREATED: [...]
COMPONENTS EDITED: [...]
REALTIME PUBLICATION ADDITIONS: [underground_admin_inbox_events]
DEVIATIONS FROM MANIFEST: <list each + reason>
HALT_REQUESTS: <list each + context>
FILES TOUCHED: <full path list>
COMMIT SHA RANGE: <first..last on replant-admin main>
```

In Jesus' name, Amen.
