# Build Manifest — Underground Verification Queue

**Status:** Locked 2026-06-22. All naming below is the contract surface across 3 subagents (DBA / Admin BE+FE / Leader Mobile). Do NOT deviate from this manifest unless you HALT_REQUEST first and get approval.

Source docs (REQUIRED reading before writing code):
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — all locked Founder rulings
- `/Users/ife/replant/docs/design_handoff_underground_queue_admin/README.md` + `source/*.jsx` — admin CD scaffolds
- `/Users/ife/replant/docs/design_handoff_underground_touchpoints/README.md` + `source/*.tsx` — leader CD scaffolds

---

## 1 · Database schema additions

### Columns on `public.users`

```sql
ALTER TABLE public.users
  ADD COLUMN soft_deleted_at timestamptz,
  ADD COLUMN soft_delete_reason text CHECK (soft_delete_reason IN (
    'leader_initiated',
    'admin_deactivation',
    'verification_lapse',
    'underground_join_code_compromised',
    'reported_violation',
    'safety_evacuation'
  )),
  ADD COLUMN hard_delete_scheduled_at timestamptz,
  ADD COLUMN hard_deleted_at timestamptz,
  ADD COLUMN outcome_modal_acknowledged_at timestamptz,
  ADD COLUMN last_seen_at timestamptz;
```

### Columns on `public.churches`

```sql
ALTER TABLE public.churches
  ADD COLUMN soft_deleted_at timestamptz,
  ADD COLUMN soft_delete_reason text CHECK (soft_delete_reason IN (
    'leader_initiated', 'admin_deactivation', 'verification_lapse',
    'underground_join_code_compromised', 'reported_violation', 'safety_evacuation'
  )),
  ADD COLUMN hard_delete_scheduled_at timestamptz,
  ADD COLUMN hard_deleted_at timestamptz,
  ADD COLUMN last_outcome_modal_shown_at timestamptz,
  ADD COLUMN last_outcome_modal_kind text CHECK (last_outcome_modal_kind IN (
    'verified', 'rejected', 'request_info',
    'pre_removal_day_23', 'visibility_flipped', 'join_code_rotated'
  )),
  ADD COLUMN rejection_reason_code text CHECK (rejection_reason_code IN (
    'identity_unconfirmed', 'church_unconfirmed', 'insufficient_evidence',
    'contact_unreachable', 'out_of_scope', 'safety_concern',
    'duplicate_registration', 'other'
  )),
  ADD COLUMN rejection_reason_meta jsonb,
  ADD COLUMN appeal_status text NOT NULL DEFAULT 'none' CHECK (appeal_status IN (
    'none', 'email_received', 'in_review', 'resolved_restore', 'resolved_uphold'
  )),
  ADD COLUMN appeal_received_at timestamptz,
  ADD COLUMN appeal_email_thread_id text;
```

### New table `public.underground_verification_proposals`

```sql
CREATE TABLE public.underground_verification_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE NO ACTION,
  action text NOT NULL CHECK (action IN (
    'verify', 'reject', 'rotate_join_code', 'visibility_override',
    'hard_delete', 'restore'
  )),
  proposer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  confirmer_id uuid REFERENCES public.users(id) ON DELETE NO ACTION,
  proposal_status text NOT NULL DEFAULT 'pending' CHECK (proposal_status IN (
    'pending', 'confirmed', 'declined', 'expired'
  )),
  rejection_reason text CHECK (rejection_reason IN (
    'identity_unconfirmed', 'church_unconfirmed', 'insufficient_evidence',
    'contact_unreachable', 'out_of_scope', 'safety_concern',
    'duplicate_registration', 'other'
  )),
  contact_channel text CHECK (contact_channel IN (
    'signal', 'wire', 'in_person', 'letter', 'referring_leader_relay'
  )),
  evidence_tier text CHECK (evidence_tier IN ('t1_referral', 't2_live_call')),
  visibility_direction text CHECK (visibility_direction IN ('visible_to_hidden', 'hidden_to_visible')),
  relay_token_hash text,
  admin_notes text NOT NULL CHECK (char_length(admin_notes) >= 30),
  counter_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  confirmed_at timestamptz,
  CONSTRAINT no_self_confirm CHECK (proposer_id IS DISTINCT FROM confirmer_id)
);

CREATE INDEX idx_uvp_church_pending ON public.underground_verification_proposals (church_id)
  WHERE proposal_status = 'pending';
CREATE INDEX idx_uvp_expires_pending ON public.underground_verification_proposals (expires_at)
  WHERE proposal_status = 'pending';
```

### Append-only trigger on proposals (no UPDATE on terminal states)

```sql
CREATE TRIGGER prevent_proposal_terminal_update
  BEFORE UPDATE ON public.underground_verification_proposals
  FOR EACH ROW
  WHEN (OLD.proposal_status IN ('confirmed', 'declined', 'expired'))
  EXECUTE FUNCTION raise_immutable_violation('proposal terminal state immutable');
```

### Audit action additions (to `audit_log_underground`)

15 new action names:
- `underground_propose_verify` / `underground_propose_reject` / `underground_propose_rotate_join_code` / `underground_propose_visibility_override` / `underground_propose_hard_delete` / `underground_propose_restore`
- `underground_confirm_verify` / `underground_confirm_reject` / `underground_confirm_rotate_join_code` / `underground_confirm_visibility_override` / `underground_confirm_hard_delete` / `underground_confirm_restore`
- `underground_decline_proposal` / `underground_request_info_sent` / `underground_appeal_received` / `underground_restore_initiated` / `underground_hard_delete_executed` / `underground_outcome_modal_shown`

### RLS write-policy hardening

Sweep every WRITE policy + write-RPC across these tables and add `is_active = true` predicate (so soft-deleted leaders can READ their own state but cannot WRITE):
- `public.users` (own UPDATE policy)
- `public.prayer_requests` (insert/update)
- `public.comments` (insert)
- `public.connection_requests` (insert)
- `public.intercession_holds` (insert)
- `public.heartcries` (insert)
- `public.testimonies` (insert)
- `public.messages` (insert) — if exists

SELECT policies stay OPEN (leader needs to render gated-shell Home).

---

## 2 · RPC names + signatures

All SECURITY DEFINER, all write `audit_log` or `audit_log_underground` BEFORE returning content. All use lowercase snake_case parameter prefixes (`p_*`).

```sql
-- Leader-facing
fn_acknowledge_outcome_modal(p_church_id uuid) RETURNS void
fn_soft_delete_my_account(p_reason text) RETURNS void  -- p_reason = 'leader_initiated' only via this path
fn_restore_my_account() RETURNS void  -- only within 30-day window AND not hard-deleted
fn_send_reply_to_team(p_question_id uuid, p_reply_text text) RETURNS void

-- Admin-facing (require is_underground_admin)
fn_list_pending_underground_queue() RETURNS TABLE (...)  -- the Pending tab data source
fn_propose_underground_action(p_church_id uuid, p_action text, p_payload jsonb) RETURNS uuid  -- returns proposal_id
fn_confirm_underground_proposal(p_proposal_id uuid) RETURNS void  -- two-eyes commit
fn_decline_underground_proposal(p_proposal_id uuid, p_counter_notes text) RETURNS void  -- returns church to Untouched
fn_request_info_underground(p_church_id uuid, p_question_text text) RETURNS void  -- single-admin
fn_initiate_restore_underground(p_church_id uuid) RETURNS void  -- single-admin initiate
fn_validate_relay_token(p_church_id uuid, p_token_hash text) RETURNS boolean  -- visibility override gate

-- System / cron
fn_hard_delete_expired_soft_deletes() RETURNS integer  -- daily 03:00 UTC, returns count
fn_expire_stale_proposals() RETURNS integer  -- hourly, marks proposals 'expired' when expires_at < now()

-- Outcome-modal cadence helper (called by leader-mobile on Home launch)
fn_should_fire_outcome_modal(p_church_id uuid) RETURNS jsonb  -- returns {fire: bool, kind: text, day_of_window: int}
```

### Modal-cadence logic (in `fn_should_fire_outcome_modal`)

Implements the locked **Day-14 hybrid**:
```
day_of_window = days since churches.soft_deleted_at
acknowledged = users.outcome_modal_acknowledged_at IS NOT NULL

IF NOT acknowledged AND day_of_window IN (0, 14) → fire=true, kind='rejected'
ELSE IF day_of_window = 23 AND last_outcome_modal_kind != 'pre_removal_day_23' → fire=true, kind='pre_removal_day_23'
ELSE fire=false
```

(Day 0 = first launch after rejection; Day 14 = the gentle conditional re-fire; Day 23 = locked pre-removal warning.)

---

## 3 · Netlify functions (admin BE)

Path: `/Users/ife/replant-admin/netlify/functions/`. All require AAL2 + `is_underground_admin` per `_lib/aal2-gate.js` pattern. All thin wrappers around RPCs above + audit-before-content.

| Function file | Method | Body | Returns |
|---|---|---|---|
| `list-pending-underground.js` | POST | `{}` | `{ rows: [...] }` from `fn_list_pending_underground_queue()` |
| `propose-underground.js` | POST | `{ church_id, action, payload }` | `{ proposal_id }` |
| `confirm-underground-proposal.js` | POST | `{ proposal_id }` | `{ ok: true, action_taken: text }` |
| `decline-underground-proposal.js` | POST | `{ proposal_id, counter_notes }` | `{ ok: true }` |
| `request-info-underground.js` | POST | `{ church_id, question_text }` | `{ ok: true }` |
| `hard-delete-underground-confirm.js` | POST | `{ proposal_id, typed_code }` | `{ ok: true }` — validates typed_code matches `churches.church_code` |
| `initiate-restore-underground.js` | POST | `{ church_id }` | `{ ok: true }` |
| `confirm-restore-underground.js` | POST | `{ proposal_id }` | `{ ok: true }` |
| `validate-relay-token.js` | POST | `{ church_id, token_4digit }` | `{ valid: bool }` |
| `list-deactivated-underground.js` | POST | `{}` | `{ rows: [...] }` |

Add to `/Users/ife/replant-admin/src/lib/api.js` with matching function exports.

---

## 4 · React Native components (leader mobile)

Path: `/Users/ife/replant/src/`. Existing folder conventions:
- `components/home/*` — Home-tab modals/banners
- `components/underground/*` — underground-only modals (new folder)
- `screens/main/*` — top-level tabs (Home, Connect, TheChurch, Persecuted, PrayerWall)

### New files

| File path | Source scaffold |
|---|---|
| `src/components/home/RequestInfoModal.tsx` | `docs/design_handoff_underground_touchpoints/source/RequestInfoModal.tsx` |
| `src/components/home/ReplyComposer.tsx` | `docs/design_handoff_underground_touchpoints/source/ReplyComposer.tsx` |
| `src/components/home/VerificationOutcomeModal.tsx` | `.../VerificationOutcomeModal.tsx` |
| `src/components/home/PreRemovalModal.tsx` | `.../PreRemovalModal.tsx` |
| `src/components/underground/VisibilityFlipModal.tsx` | from `.../VisibilityAndJoinModals.tsx` |
| `src/components/underground/JoinCodeRotationModal.tsx` | from `.../VisibilityAndJoinModals.tsx` |

### Edited files

| File | Edit |
|---|---|
| `src/components/home/VerificationBanner.tsx` | Add `outcome` state per `.../VerificationBanner.outcome.tsx` — banner copy + tap → reopens outcome modal |
| `src/screens/main/HomeScreen.tsx` | On focus: call `fn_should_fire_outcome_modal` + render appropriate modal (RequestInfo / VerificationOutcome / PreRemoval / Visibility / JoinCode). Pass `kind` to modal. On dismiss: call `fn_acknowledge_outcome_modal` + `record_outcome_modal_shown`. Banner stays. |
| `src/contexts/AuthProvider.tsx` (or wherever `branch` state lives) | Add branch states: `'request_info'`, `'soft_deleted'`. Derived from server (RPC or auth-status-check extension). |
| `src/screens/main/TheChurchScreen.tsx` | Suppress verified-gate phrase (gateTiny) when `branch === 'request_info'` |
| `src/screens/main/ConnectScreen.tsx` | Gate to read-only (or hide push-compose) when `branch === 'soft_deleted'` |
| `src/screens/main/PrayerWallScreen.tsx` | Read-only mode when `branch === 'soft_deleted'` (no posting; reading + praying OK) |
| `src/screens/main/PersecutedScreen.tsx` | UNCHANGED — Persecuted full-read for soft-deleted (per BA Q1 ruling) |

---

## 5 · React (admin FE) deliverables

Path: `/Users/ife/replant-admin/src/`. Extend the existing `Underground.jsx` viewer into a 3-tab surface.

| File | Action | Notes |
|---|---|---|
| `src/screens/Underground.jsx` | EDIT | Add 3-tab bar (Pending / Verified / Deactivated). Verified tab = existing read-only viewer. Pending + Deactivated are new. |
| `src/screens/UndergroundPending.jsx` | NEW | List view + filter chips + SLA aggregate banner. Lifts from CD `preview/index.html` §1. |
| `src/screens/UndergroundDeactivated.jsx` | NEW | List view + countdown column + reinstate + hard-delete buttons. CD §7. |
| `src/screens/UndergroundDetail.jsx` | NEW | Dedicated route `/underground/pending/:id`. Evidence Packet + Profile + Admin Notes thread + Request-info thread + sticky Action Bar. CD §3. |
| `src/components/underground/SlaPill.jsx` | NEW | Lift from `docs/design_handoff_underground_queue_admin/source/SlaPill.jsx` verbatim. |
| `src/components/underground/ProposeVerifyPanel.jsx` | NEW | CD §4. |
| `src/components/underground/ProposeRejectPanel.jsx` | NEW | CD §4. |
| `src/components/underground/ConfirmProposalModal.jsx` | NEW | Admin B's view per CD §5. Shows exact leader-facing text. 72h TTL countdown. |
| `src/components/underground/DeclineProposalModal.jsx` | NEW | CD §5. counter_notes required. |
| `src/components/underground/VisibilityOverrideModal.jsx` | NEW | Lift from `docs/design_handoff_underground_queue_admin/source/VisibilityOverrideModal.jsx`. 4-digit relay token cells. |
| `src/components/underground/JoinCodePanel.jsx` | NEW | State machine: hashed → rotate → re-reveal. CD §6. |
| `src/components/underground/HardDeleteConfirmModal.jsx` | NEW | CD §7. Typed church_code field validates against displayed ref. |
| `src/components/underground/UndergroundAccessDenied.jsx` | LIFT | From `docs/design_handoff_underground_queue_admin/source/UndergroundAccessDenied.jsx` verbatim. |
| `src/styles/globals.css` | EDIT | Add 5 SLA tokens (`--sla-neutral`, `--sla-yellow`, `--sla-amber`, `--sla-red`, `--sla-red-pulse`) per CD CSS. |
| `src/lib/api.js` | EDIT | Add 10 new function exports matching the Netlify endpoints in §3. |
| `src/App.jsx` | EDIT | Add routes for `/underground/pending/:id` (+ no sidebar entry — keep existing `/underground` entry; the 3-tab bar is inside). |

---

## 6 · Realtime channels (admin B notification)

Per ruling #12 (in-app badge via Supabase Realtime):

- Channel: `underground_admin:{admin_id}`
- Event: `proposal_pending_confirmation` payload: `{ proposal_id, church_ref, proposer_name }`
- Subscribe in `Underground.jsx` mount; update sidebar badge count.
- Email is sent server-side from `propose-underground.js` (NO UG-identifying body — fixed string from manifest).

---

## 7 · Email auto-reply (CONTENT-locked)

When `accounts@projectreplant.org` receives an email AND the sender's email (hashed) matches a record in `public.users.email_hash` (add column if not exists; backfill is post-MVP, but the hash matching for prior-removed records must work for hard-deleted tombstones since email is rewritten to `deleted+<uuid>@...` after PII scrub — DBA decision needed: do we keep an `original_email_hash` column on the tombstone for THIS lookup?):

**Auto-reply (always, same for matching + non-matching):**
> Thank you for reaching out to the Replant team. Our records have been refreshed, and we would be glad to welcome you back. If you'd like to register again, the sign-up flow is open to you. If you'd like to share more before re-applying, you may reply to this email and a member of our team will be with you. Grace and peace, The Replant team.

**Sending mechanism:** Resend MCP / `connect@projectreplant.org` From-address. Wire via `netlify/functions/inbound-email-handler.js` (NEW) — or out-of-scope for MVP if SES/Resend inbound webhook setup is post-MVP procurement (Founder ruling — DEFAULT: post-MVP, log to memory).

---

## 8 · Cross-lane dependency graph

```
DBA migrations
    ├──► provides columns → Admin BE RPCs depend on
    ├──► provides RPCs → Admin BE functions depend on
    └──► provides cadence helper → Leader mobile depends on

Admin BE/FE
    └──► provides endpoints → Admin FE depends on

Leader mobile
    └──► depends on auth-status-check returning branch state correctly
        ├──► EXISTING: `auth-status-check v8` already returns `underground_join_code_pending_reveal`
        └──► NEW: extend `auth-status-check` to return `branch_substate: {request_info|soft_deleted}` flag
            └──► DBA RPC `fn_resolve_user_branch_state(p_user_id)` → returns jsonb
```

**Build order (suggested but parallel-safe with HALT-IF):**
1. DBA migrations 0001-0008 (foundation)
2. Admin BE Netlify functions (parallel to step 3)
3. Leader mobile components (parallel to step 2)
4. Admin FE (depends on BE endpoints)

DBA + Leader can start immediately. Admin BE can start immediately. Admin FE waits for BE.

---

## 9 · HALT-IF protocol (ALL subagents)

If you encounter ANY of:
1. A constraint conflict with existing data you can't safely backfill
2. A locked spec ambiguity that affects more than 1 deliverable
3. A cross-lane dependency unclear from this manifest
4. A migration or component that requires Founder ruling not yet provided

**STOP and write a `HALT_REQUEST` block at the TOP of your final response in this format:**

```
HALT_REQUEST:
  Question: <one-line>
  Why: <rationale>
  Proposed default: <fallback if you must guess>
  Blocked deliverables: <list>
  Lane: <DBA | Admin | Leader>
```

DO NOT GUESS your way past a halt-worthy question. The Founder + 6-SME + mini-panel cycles cost real cycles; do not unsterilize them with an unauthorized assumption.

---

## 10 · Output format (each subagent's final response)

```
HALT_REQUESTS (if any): <listed at top>
VERDICT: shipped | shipped-with-halts | blocked
FILES_WRITTEN:
  - <path>: <one-line purpose>
VERIFICATION_NOTES: <how you tested / verified migrations / what you eyeballed>
LANE: <DBA | Admin | Leader>
```

In Jesus' name, Amen.
