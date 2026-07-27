# Build Manifest — Admin Tier + Rejected Detail + Underground Inline-Error Posture

**Status:** Locked 2026-06-24 evening. All naming below is the contract surface across 3 build subagents (DBA / Admin BE+FE / Mobile lane SKIPPED — no leader-side touchpoints). Do NOT deviate from this manifest unless you HALT_REQUEST first and get approval.

**Source docs (REQUIRED reading before writing code):**
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — all locked Founder rulings (esp. 2026-06-24 + 2026-06-24 evening + 2026-06-24 evening II entries).
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_replant_admin_copy_voice.md` — voice ruling (LOAD-BEARING for all user-facing copy in this bundle).
- `/Users/ife/replant/docs/build_manifest_in_review.md` + `/Users/ife/replant/docs/build_manifest_proposal_flow.md` — prior sprints' manifests; this one composes with them (do NOT re-implement what's already shipped).
- `/Users/ife/replant/docs/design_handoff_in_review/source/EvidenceUpload.jsx` — CD scaffold for progress + completion + error states (lift, don't redesign).

**Bundle scope (3 concurrent workstreams, single commit, single push to `replant-admin`):**

1. **KAN-271 admin tier** — three-tier admin model (Top-tier hardcoded Ruth + Replant Ops / Super admin promoted from Regular / Regular admin = default invite). 11 ratifications.
2. **KAN-272 Rejected detail page** — dedicated read-only Rejected view + new route. 6 ratifications.
3. **KAN-273 Underground inline-error posture** — error-routing dictionary + voice rewrite + step-up modal portal fix + EvidenceUpload progress/completion states. Architecture from BE panel + voice from Founder ruling.

**Critical discipline:** SINGLE commit + SINGLE push to `replant-admin` after all three workstreams pass. NO mid-build pushes. Netlify monthly promo credits at 50% — every separate push burns build minutes against Founder's quota.

---

## A · KAN-271 admin tier — locked ratifications

1. **Option B promotion ceremony** — super-admin requests promotion (with own AAL2 step-up) → top-tier admin approves (with their own AAL2 step-up).
2. **`MIN_SUPER_ADMINS = 3`** — floor that cannot be crossed by demote/revoke. Top-tier seats do NOT count toward this floor.
3. **48h pending TTL** on promotion requests. Sweeper cron expires stale pendings.
4. **Ruth + Replant Ops interchangeable** as approver or requester for any top-tier promotion ceremony. No-self-approve enforced at DB.
5. **Real-time cross-notify** between Ruth and Replant Ops on every top-tier action (promotion request created, approved, denied, expired, regular admin invited, super admin demoted).
6. **Regular admins respond to heartcries** (life-safety override; every response audit-logged).
7. **Source-of-truth = `app_metadata.admin_tier`** (Option b — matches existing `super_admin` pattern). Valid values: `'top_tier'`, `'super_admin'`, `'regular'`.
8. **Single-eye demote; two-eyes promote.** A super admin can be demoted to Regular by ANY top-tier admin alone. Promotion (Regular → Super) requires the two-step ceremony in #1.
9. **No secure-pass mechanism.** AAL2 + step-up + two-eyes is sufficient. Do NOT introduce a separate passphrase/secret-handshake layer.
10. **Existing-Super initiates promotion** (self-request post-MVP). Means: a Top-tier admin can NOT spontaneously promote someone from Regular; the Regular's super-admin sponsor initiates, then Top-tier approves.
11. **Demote vs revoke distinct**: Super → Regular = demote (still has admin access). Regular → revoked = revoke (no admin access at all).

**Regular admin scope (locked):**
- Full Network + Content access.
- Full Ops EXCEPT underground (Verification Queue + Underground Oversight + Rejected/Verified/Deactivated detail pages all gated).
- Heartcry: read + respond (every response logged).
- Compliance: read-only.
- Team Management: HIDDEN from nav entirely.

**Critical BE finding (B01 — block):** the Netlify hook must mint a NEW `admin` claim, NOT widen the existing `super_admin` claim. Existing `grant-admin.js` becomes top-tier-only break-glass (reserved for emergency direct super_admin grant). Super admins get new `/invite-admin` (creates Regular) + `/promote-admin-request` (initiates two-step ceremony).

---

## B · Rejected detail page — locked ratifications

1. **Rejected-by strip shows BOTH proposer (A) and confirmer (B)** — *"Rejected by Ruth · proposed by accounts@"* pattern. Both names surface.
2. **Denormalized `churches.rejected_by` column** — add column + FK to `public.users(id)` + backfill from `audit_log_underground` + patch `fn_confirm_underground_proposal` to write in reject branch + clear in restore branch.
3. **New audit action `view_rejected_underground_church`** (action #47) — distinct from `view_underground_church`.
4. **Server-side 409 `church_rejected_read_only` guards** on 8 write Netlify fns.
5. **New component `UndergroundRejectedDetail.jsx`** (NOT a `readOnly` prop on existing `UndergroundDetail.jsx`).
6. **Parameterized back-link via shared `Shell` `backTo` prop NOW.**

**Standing posture (SEC):** AAL2 same as pending; NO step-up needed (reads of terminal records don't clear that bar). Underground location-masking helpers MUST be reused (not forked). No Realtime subscription at MVP (terminal row). Indefinite retention OK for MVP.

---

## C · Underground inline-error posture — locked architecture + rulings

**Architecture (BE):** new `src/lib/error-routing.js` with `registerErrorSink(contextId, setter)` + `humanize(raw)` prefix-match dictionary + `routeError(contextId, err)`. Extend `api.js` `call()` with `{ errorContext }` opt-in. Per-affordance React-state sinks with cleanup on unmount.

**Top-banner reserved scope (everything else routes inline):**
1. Initial page-load failures (list endpoints, detail hydration).
2. AAL2 gate failures at page entry (already modal-routed; banner is fallback).
3. Network-down / fetch-throw with no `res`.
4. Auth lockout (`Not authenticated`).

**SEC hardening (must layer in):**
1. Strip raw payload (SQLSTATE / table names / row payloads) before any client console/Sentry sink. Full raw stays server-side only.
2. Preserve `request_id` — surface copyable next to rewritten error for incident-response correlation.
3. Failed actions STILL log to `audit_log_underground` regardless of error placement — verify BE writes audit BEFORE returning error.
4. Inline-at-affordance OK with caveat: abstract affordance label in step-up message (*"This action…"* not *"Approving an underground church…"*) — same words across all TIER 1 affordances.

**SEC over-disclosure rules (override CONTENT's friendlier defaults — locked):**
| Class | Locked copy |
|---|---|
| RLS denial / row gated / genuine 404 | *"Not found."* (collapsed — never confirm a row exists but is gated) |
| `unique constraint church_code` | *"This code can't be used. Try a different one."* |
| `no_proposal_in_flight` | *"This proposal is no longer active. Refresh to see the latest state."* |
| FK violation on user reference | *"Couldn't complete this action. Refresh and try again."* |

**Step-up modal z-index bug:** step-up modal currently renders BEHIND `ConfirmProposalModal`. Fix: mount step-up modal as a React portal at root, NOT nested inside parent modal render tree. Verify after fix that step-up overlays every TIER 1 confirm modal.

---

## 1 · Database schema additions (DBA lane)

All migrations are additive. Ship sequentially. No destructive changes to shipped objects.

### Migration 0024 — `users.admin_tier_promoted_at` + `churches.rejected_by`

```sql
-- Rejected detail denormalization (workstream B, ratification #2)
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_churches_rejected_by
  ON public.churches(rejected_by) WHERE rejected_by IS NOT NULL;

-- Backfill from audit_log_underground (latest underground_confirm_reject per church)
UPDATE public.churches c
   SET rejected_by = sub.accessed_by
  FROM (
    SELECT DISTINCT ON (church_id) church_id, accessed_by
      FROM public.audit_log_underground
      WHERE action = 'underground_confirm_reject'
      ORDER BY church_id, accessed_at DESC
  ) sub
 WHERE c.id = sub.church_id
   AND c.rejected_at IS NOT NULL
   AND c.rejected_by IS NULL;
```

### Migration 0025 — Admin-tier promotion table

```sql
CREATE TABLE public.admin_tier_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id uuid NOT NULL REFERENCES public.users(id),
  sponsor_user_id uuid NOT NULL REFERENCES public.users(id),      -- the super admin initiating
  approver_user_id uuid REFERENCES public.users(id),               -- top-tier admin who approved/denied
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  sponsor_aal2_fresh_at timestamptz NOT NULL,   -- SERVER-OBSERVED at request time
  approver_aal2_fresh_at timestamptz,            -- SERVER-OBSERVED at approve/deny time
  denial_reason text,                            -- ≥30 chars required on deny
  CONSTRAINT no_self_sponsor CHECK (candidate_user_id <> sponsor_user_id),
  CONSTRAINT no_self_approve CHECK (approver_user_id IS NULL OR approver_user_id <> sponsor_user_id)
);

CREATE INDEX admin_tier_promotions_candidate_idx
  ON public.admin_tier_promotions(candidate_user_id, state);

CREATE INDEX admin_tier_promotions_pending_idx
  ON public.admin_tier_promotions(expires_at) WHERE state = 'pending';

-- Append-only on terminal states (mirrors audit_log_underground pattern)
CREATE OR REPLACE FUNCTION prevent_admin_tier_promotion_terminal_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.state IN ('approved', 'denied', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'admin_tier_promotions row in terminal state cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_tier_promotions_no_terminal_update
  BEFORE UPDATE ON public.admin_tier_promotions
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_tier_promotion_terminal_mutation();

-- RLS: top-tier admin OR sponsor OR candidate can SELECT; only RPCs write.
ALTER TABLE public.admin_tier_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_tier_promotions_select ON public.admin_tier_promotions
  FOR SELECT TO authenticated USING (
    ((auth.jwt() -> 'app_metadata' ->> 'admin_tier') = 'top_tier')
    OR (sponsor_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
    OR (candidate_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  );
```

### Migration 0026 — Audit action CHECK additions (split across two tables)

**`audit_log_underground` (underground-only) — ADD:**
- `view_rejected_underground_church` (workstream B, ratification #3) — action #47.

**`audit_log` (general admin-tier + account actions) — ADD:**
- `admin_tier_promotion_requested`
- `admin_tier_promotion_approved`
- `admin_tier_promotion_denied`
- `admin_tier_promotion_expired`
- `admin_invite_sent`
- `admin_demote`
- `admin_revoke`
- `account_name_updated` (workstream A — Account page self-service name edit)

(Exact action #s pulled from live at apply time via introspection; do NOT duplicate existing. Live introspect both CHECK constraints first.)

### Migration 0027 — `custom_access_token_hook` patch

Mint NEW `admin` claim (BE finding B01); do NOT widen `super_admin`. Read `app_metadata.admin_tier`:
- If `top_tier` → mint top-level claim `admin_tier = 'top_tier'` + keep `super_admin = true` for backwards compat with existing RLS.
- If `super_admin` → mint `admin_tier = 'super_admin'` + `super_admin = true`.
- If `regular` → mint `admin_tier = 'regular'` + `super_admin = false`.
- If unset → mint `admin_tier = null` + leave `super_admin` as-is.

**Hook test:** add `~/replant-admin/netlify/functions/custom-access-token-hook.test.js` covering all 4 cases + the unset-fallback. Block deploy if test fails.

### Migration 0028 — Admin-tier RPCs

```
fn_invite_admin(p_email text, p_first_name text, p_last_name text)
  -- Top-tier OR super admin calls. Creates auth user + sets app_metadata.admin_tier='regular'.
  -- Writes users row with first_name + last_name + composed full_name (same heuristic as fn_update_admin_name).
  -- Audit: admin_invite_sent. Returns invite token.

fn_request_admin_promotion(p_candidate_user_id uuid, p_sponsor_aal2_fresh_at timestamptz)
  -- Super admin sponsor calls. Inserts admin_tier_promotions(state='pending', expires_at=now()+48h).
  -- Validates: candidate is currently 'regular'; sponsor is currently 'super_admin'; no existing pending.
  -- Audit: admin_tier_promotion_requested.
  -- Emits Realtime event to top-tier admins.

fn_approve_admin_promotion(p_promotion_id uuid, p_approver_aal2_fresh_at timestamptz)
  -- Top-tier admin calls. Validates: state='pending', not expired, approver != sponsor.
  -- Updates state='approved', resolved_at=now(), approver_user_id=caller.
  -- Patches app_metadata.admin_tier='super_admin' on candidate (via auth.admin).
  -- Audit: admin_tier_promotion_approved.
  -- Emits Realtime cross-notify to other top-tier admin + the candidate + the sponsor.

fn_deny_admin_promotion(p_promotion_id uuid, p_denial_reason text, p_approver_aal2_fresh_at timestamptz)
  -- Top-tier admin calls. Validates: state='pending', not expired, reason ≥30 chars.
  -- Updates state='denied', resolved_at=now(), denial_reason=p_denial_reason.
  -- Audit: admin_tier_promotion_denied.

fn_demote_admin(p_target_user_id uuid)
  -- Top-tier admin calls (single-eye per ratification #8).
  -- Validates: target is currently 'super_admin'; demoting would not violate MIN_SUPER_ADMINS=3 floor
  --   (top-tier seats EXCLUDED from count).
  -- Updates target app_metadata.admin_tier='regular'.
  -- Audit: admin_demote.

fn_revoke_admin(p_target_user_id uuid)
  -- Top-tier admin calls. Target must be 'regular' (never directly revoke a super_admin — demote first).
  -- Sets app_metadata.admin_tier=null + is_active=false.
  -- Audit: admin_revoke.

fn_update_admin_name(p_first text, p_last text)
  -- Self-service: caller updates their own row (WHERE auth_id = auth.uid()).
  -- Atomic: updates users.first_name + users.last_name + recomputes users.full_name using
  --   existing signup-sprint composition heuristic (respects include_middle_name +
  --   last_name_first + honorific + suffix on the row; middle_name treated as '' if
  --   include_middle_name=false).
  -- Validates: both fields non-empty, each ≤80 chars.
  -- No AAL2/step-up required (low-stakes self-edit).
  -- Audit: account_name_updated (audit_log, not audit_log_underground).

fn_confirm_underground_proposal — PATCH existing
  -- Reject branch: add `rejected_by = v_caller_id` to UPDATE churches SET ... (ratification B-#2).
  -- Restore branch: add `rejected_by = NULL` to UPDATE churches SET ...

fn_list_pending_underground_queue — PATCH existing
  -- Project additional fields for Rejected tab rendering:
  --   rejected_by_user_id (from churches.rejected_by)
  --   rejected_by_name (join users.full_name)
  --   rejected_proposer_id (from underground_verification_proposals.proposer_id where status='rejected')
  --   rejected_proposer_name (join users.full_name)
  -- Existing `verification_status` filter remains unchanged.
```

### Migration 0029 — 48h pending TTL sweeper cron

```sql
CREATE OR REPLACE FUNCTION public.fn_expire_pending_admin_promotions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.admin_tier_promotions
     SET state = 'expired', resolved_at = now()
   WHERE state = 'pending' AND expires_at <= now();
  -- audit_log emit per affected row via separate SELECT INTO loop if needed
END;
$$;

-- pg_cron daily
SELECT cron.schedule(
  'admin_tier_promotions_expire_daily',
  '0 */4 * * *',                                   -- every 4h; promotions are time-sensitive
  $$SELECT public.fn_expire_pending_admin_promotions();$$
);
```

---

## 2 · Netlify functions (Admin BE+FE lane)

### New endpoints (workstream A — admin tier)

| Endpoint | Auth gate | Calls |
|---|---|---|
| `invite-admin.js` | top-tier OR super admin, AAL2 | `fn_invite_admin` + email send |
| `request-admin-promotion.js` | super admin, AAL2 + step-up | `fn_request_admin_promotion` |
| `approve-admin-promotion.js` | top-tier, AAL2 + step-up | `fn_approve_admin_promotion` |
| `deny-admin-promotion.js` | top-tier, AAL2 + step-up | `fn_deny_admin_promotion` |
| `demote-admin.js` | top-tier, AAL2 + step-up | `fn_demote_admin` |
| `revoke-admin.js` | top-tier, AAL2 + step-up | `fn_revoke_admin` |
| `list-admin-tier-promotions.js` | top-tier OR sponsor OR candidate | direct SELECT on `admin_tier_promotions` |
| `update-account-name.js` | any authenticated admin (own row only) | `fn_update_admin_name` |

### Existing endpoints to PATCH

**Server-side 409 `church_rejected_read_only` guards (workstream B, ratification #4)** on 8 write fns:
- `request-info-underground.js`
- `underground-narrative-note.js`
- `underground-evidence-create-intent.js`
- `underground-evidence-delete.js`
- `propose-underground.js`
- `counter-propose-underground.js`
- `underground-claim.js`
- `underground-force-unmark-claim.js`

Guard pattern (insert after AAL2 check, before main RPC call):
```js
const { data: church, error: chErr } = await supa
  .from('churches').select('verification_status').eq('id', church_id).single()
if (chErr || !church) return jsonError(404, 'not_found')
if (church.verification_status === 'rejected') {
  return jsonError(409, 'church_rejected_read_only')
}
```

**Hook**: `custom-access-token-hook.js` — patch to read `app_metadata.admin_tier` and mint the new claim (per Migration 0027 spec).

**`grant-admin.js`** — restrict caller to top-tier only (was previously open to super_admin). Add `requireTopTier` gate. Keep as break-glass.

### Step-up modal portal mount (workstream C — z-index fix)

Locate the step-up modal component (likely `~/replant-admin/src/components/StepUpModal.jsx` or similar; if nested inside another modal's children, hoist it to root). Mount via React portal:
```js
import { createPortal } from 'react-dom'
// In render:
return createPortal(<div className="rp-modal rp-modal--stepup">…</div>, document.body)
```
Add CSS `z-index: 9999` on `.rp-modal--stepup` (vs `9000` on other modals) to guarantee stacking. Verify on every TIER 1 confirm flow.

---

## 3 · Admin frontend (FE lane)

### New components

| Component | Path |
|---|---|
| `UndergroundRejectedDetail.jsx` | `~/replant-admin/src/screens/UndergroundRejectedDetail.jsx` |
| `AdminTierPanel.jsx` | `~/replant-admin/src/screens/AdminTierPanel.jsx` (lives under Team Management for super_admin+) |
| `PromoteAdminModal.jsx` | `~/replant-admin/src/components/admin/PromoteAdminModal.jsx` |
| `ApprovePromotionModal.jsx` | `~/replant-admin/src/components/admin/ApprovePromotionModal.jsx` |
| `DenyPromotionModal.jsx` | `~/replant-admin/src/components/admin/DenyPromotionModal.jsx` |
| `DemoteAdminModal.jsx` | `~/replant-admin/src/components/admin/DemoteAdminModal.jsx` |
| `InviteAdminModal.jsx` | `~/replant-admin/src/components/admin/InviteAdminModal.jsx` |
| `TierChip.jsx` | `~/replant-admin/src/components/admin/TierChip.jsx` (overseer / super-admin / admin pill — user-facing labels) |
| `AccountPage.jsx` | `~/replant-admin/src/screens/AccountPage.jsx` (MVP baseline — see §3.5) |
| `src/lib/error-routing.js` | NEW — workstream C |

### Components to PATCH

| Component | Change |
|---|---|
| `Shell.jsx` (~line 327) | Add `backTo` prop pattern (object `{path, label}` or string path); deprecate hardcoded "Back to Pending" |
| `App.jsx` (~line 96) | Add route `/underground/rejected/:id` → `UndergroundRejectedDetail`; add `/admin-tier` → `AdminTierPanel` |
| `UndergroundRejected.jsx` (~line 81) | Change `navigate('/underground/pending/${row.id}')` → `'/underground/rejected/${row.id}'` |
| `UndergroundDetail.jsx` | Wire 24 `setError` sites to error-routing (per BE inventory); rip top-banner-bubbling pattern. Use `errorContext` per affordance: `'evidence_upload'`, `'narrative_note'`, `'request_info'`, `'propose_verify'`, `'propose_reject'`, `'counter_propose'`, `'confirm_proposal'`, `'cancel_proposal'`, `'claim'`, `'release_claim'`, `'request_release'`, `'force_unmark'`, `'mark_in_review'`, `'unmark_in_review'`, `'evidence_view'`, `'evidence_delete'` |
| `Underground.jsx` (~line 282) | Wire claim/release from-row inline (errorContext `'queue_claim'`) |
| `UndergroundDeactivated.jsx` (lines 72, 89) | Wire restore + propose hard-delete inline |
| `SecondLeaderDetail.jsx` | Wire claim/approve/reject/force-unmark inline |
| `EvidenceUpload.jsx` | (1) Add per-file progress bar against file row (lift from CD scaffold). (2) Add success-replaces-drop-zone state. (3) Lock-banner copy must vary by state: `lockReason` prop accepts `'proposal_in_flight'` (existing copy) or `'rejected'` (*"Evidence is locked — this church was rejected on {date}. View-only."*). |
| `NarrativeComposer.jsx` | Add `error` prop slot; render inline below textarea (replaces top-banner) |
| `ClaimAffordance.jsx` | Add `error` prop slot; render inline below claim button |
| `StepUpModal.jsx` (or wherever step-up renders) | Portal mount + z-index 9999 + new copy (see §5) |
| `ConfirmProposalModal.jsx` | No change to modal itself; verify step-up overlays correctly after portal fix |
| Nav config | Add `Admin tier` link under Team Management (super_admin+ only); HIDE Team Management entirely from regular admins |
| User-avatar area (bottom-left of `Shell.jsx`) | Wrap the entire avatar block (circle + name + role area) in a `<Link to="/account">`. Visible to ALL admin tiers (Overseer / Super admin / Admin). Sign-out link stays above, unchanged. |

### 3.5 · Account page (MVP baseline — CD design ratified 2026-06-24)

CD design package: `/Users/ife/replant/docs/design_handoff_account_page/` (README + `preview/index.html` + `source/AccountPage.jsx` + `source/TierChip.jsx`). **Lift scaffolds verbatim** — render shell + section tree from `source/`; lift visual details from `preview/index.html` markup. Built on live `globals.css` `rp-*` tokens — NO new design tokens.

New page at `/account`, accessible to all admin tiers via the bottom-left avatar click-target. Single column, sectioned cards, ~760px measure, dark, clinical register, rendered inside `RpFrame`.

**MVP baseline sections (ship in this bundle):**
1. **Identity** — admin's first + last name (EDITABLE) + tier chip (Overseer / Super admin / Admin) + email (`read-only` tag — admin-mediated edit only for MVP, NOT self-service per Founder ruling 2026-06-24).
2. **Two-factor authentication (the hero)** — render `TotpEnrollmentScreen` verbatim when `factorId === null` (existing component; `onEnrolled={loadFactor}` re-resolves); render `TotpStatusCard` with a guarded `Reset TOTP` button when enrolled. Reset opens a confirm modal, runs existing `unenrollTotpFactor`, re-mounts the enrollment flow.
3. **Account footer** — Sign out (mirrors nav for on-page discoverability).

**Self-service first/last name editing — added per Founder ruling 2026-06-24:**

Live schema already has `first_name` / `middle_name` / `last_name` / `full_name` / `suffix` / `honorific` / `include_middle_name` / `last_name_first` (signup sprint shipped these; no migration needed in this bundle). `full_name` is an independent column — NOT auto-generated; must be recomputed on edit.

- **New RPC `fn_update_admin_name(p_first text, p_last text)`** — atomic SECURITY DEFINER fn. Updates `users.first_name` + `users.last_name` + recomputes `users.full_name` using existing signup-sprint composition heuristic (respects `include_middle_name` + `last_name_first` + `honorific` + `suffix` if set on the row, treats middle as `''` if `include_middle_name=false`). Caller can only update their own row (`auth_id = auth.uid()`).
- **New Netlify endpoint `update-account-name.js`** — JSON `{ first, last }` body; calls `fn_update_admin_name`. AAL2 NOT required (low-stakes self-edit). Audit row written.
- **New audit action** `account_name_updated` (action #55 — add to migration 0026 CHECK list).
- **Account page Identity section UX:** First name + Last name shown by default; "Edit" button reveals inline editor (two text inputs + Save / Cancel). Validation: both fields required, max 80 chars each. On Save: optimistic update + revert on error. Toast confirms save.
- **NO middle / suffix / honorific / display-preference editing in this bundle** — those are owned by the future Settings surface (signup sprint's territory). Stays inside the MVP Account page scope.

**Post-MVP sections (deferred — Founder ratified 2026-06-24):**
- **Active sessions** — list of active sessions + "Sign out other devices" with confirm + audit.
- **Recent account activity** — THIS admin's own sign-ins / TOTP changes / session events only. Never leader-identifying. NOT the global audit log.
- **Preferences** — timezone, language, in-app + email notifications, plus an always-on "Overseer cross-notify" status block (only renders for Overseer tier — Ruth ↔ Replant Ops realtime).
- ~~Deactivation request~~ — **DROPPED entirely per Founder ruling 2026-06-24.** No self-service deactivation. Admins who leave are revoked by another admin via existing revoke flow.

**Post-MVP rendering ratified 2026-06-24:** ship the MVP page with section shells for Active sessions / Recent activity / Preferences rendered as muted "Coming soon" placeholders (signals future shape; nicer onboarding). Drop the deactivation section entirely — no shell, no placeholder, doesn't exist.

**Team Management decoupling (ratified — pull personal TOTP OUT of Team Management):**
- Remove the personal TOTP enrollment + status section from `TeamManagement.jsx` ([lines ~484–510](../replant-admin/src/screens/TeamManagement.jsx)).
- Replace with a one-line pointer at the top of Team Management: *"Manage your own two-factor authentication on your **[Account page →](/account)**"*. Pointer stays during transition; remove in a future cleanup.
- Team Management = managing *others* (Super / Admin grants, invites, demotes). Account = self. Clean separation.

**Click-target wiring (Shell.jsx — adapted from CD spec; Founder ruling: FIRST name above role, NOT full name):**
```jsx
// in NavBody, .rp-side-foot — sign out row UNCHANGED above this
<Link to="/account" className="rp-id rp-id-link">
  <div className="rp-id-avatar">{initials(user?.first_name || user?.full_name)}</div>
  <div>
    <div className="rp-id-name">{user?.first_name || user?.full_name}</div>
    <TierChip tier={user?.app_metadata?.admin_tier} size="sm" />
  </div>
</Link>
```
Add `.rp-id-link { text-decoration:none; cursor:pointer }` + hover treatment from `docs/design_handoff_account_page/preview/account-cd.css .adm-id`. The current static `super_admin` badge becomes the tier-aware `<TierChip>` (lift mapping from CD's `source/TierChip.jsx`). The fallback to `full_name` covers any legacy row that somehow lacks a `first_name` (shouldn't happen post-signup-sprint, but defensive).

**TierChip component (verbatim from CD `source/TierChip.jsx`):**
```js
const TIER_MAP = {
  top_tier:    { label: 'Overseer',    cls: 'tier-overseer' },  // restrained gold
  super_admin: { label: 'Super admin', cls: 'tier-super' },     // sky
  regular:     { label: 'Admin',       cls: 'tier-admin' },     // neutral
}
```
Quiet chip pattern — small dot carries the only color; chip text + border are neutral. Sizes: `md` (default) + `sm` (for nav).

**Graceful states:** Identity + TOTP NEVER block on a fetch (read session in hand). Sessions + Activity sections (when shipped) resolve through live `SkeletonRows` / `EmptyState` / `ErrorBanner`.

**Audit posture:** Reset TOTP, Sign out other devices (post-MVP), Deactivation request (post-MVP) are all sensitive — each opens a confirm modal AND writes an audit row.

**Files touched:**
- NEW: `~/replant-admin/src/screens/AccountPage.jsx` (lift from CD `source/AccountPage.jsx`)
- NEW: `~/replant-admin/src/components/admin/TierChip.jsx` (lift from CD `source/TierChip.jsx`)
- NEW: `~/replant-admin/netlify/functions/update-account-name.js` (self-service name edit endpoint)
- Route add: `~/replant-admin/src/App.jsx` (add `/account` → `AccountPage`)
- Shell click-target: `~/replant-admin/src/components/Shell.jsx` (wrap identity block in `<Link>`; replace static `super_admin` badge with `<TierChip>`; switch display from `full_name` → `first_name`)
- Team Management decoupling: `~/replant-admin/src/screens/TeamManagement.jsx` (remove personal-TOTP section ~lines 484–510; add one-line pointer)
- CSS merge: rules from `docs/design_handoff_account_page/preview/account-cd.css` (`.tier-chip`, `.acct-*`, `.adm-id` hover) merge into `~/replant-admin/src/styles/globals.css`
- DBA: new RPC `fn_update_admin_name(p_first, p_last)` in migration 0028 alongside admin-tier RPCs
- Audit: new action `account_name_updated` added to migration 0026 CHECK list

### New `src/lib/error-routing.js` (full spec)

```js
const ROUTES = new Map() // contextId -> setError fn

export function registerErrorSink(contextId, setter) {
  ROUTES.set(contextId, setter)
  return () => ROUTES.delete(contextId)
}

const TAGS = {
  // Format errors
  'missing_uuid:':          'Something on this row is out of date. Refresh and try again.',
  'missing_field:':         'A required field is empty.',
  'invalid_enum:':          "That option isn't valid here.",
  'field_too_short:':       'Add a bit more detail before saving.',
  'field_too_long:':        "That's longer than the field allows. Shorten it.",
  'invalid_json_body':      "The request didn't come through cleanly. Try again.",

  // Underground domain
  'claim_failed':                   "Couldn't put this church under your review. Another admin may have just claimed it — refresh to check.",
  'no_proposal_in_flight':          'This proposal is no longer active. Refresh to see the latest state.',
  'church_rejected_read_only':      'This church was rejected. Refresh to see the rejected detail page.',
  'evidence_intent_failed':         "We couldn't get the upload ready. Try again.",
  'evidence_confirm_failed':        "The file didn't finish uploading. Check your connection and try the upload again.",
  'invalid_mime_type':              "That file type isn't supported. Use JPG, PNG, HEIC, WebP, PDF, MP3, M4A, or Word.",
  'invalid_size_bytes':             'This file is over the 25 MB limit. Compress it or split it before uploading.',
  'evidence_delete_failed':         "We couldn't remove this file. Try again.",
  'narrative_note_failed':          "We couldn't save your note. Try again.",
  'request_info_send_failed':       "We couldn't send your message. Try again.",
  'counter_propose_same_action':    'A counter-proposal has to be a different action than the original. Pick another above.',
  'counter_propose_visibility_branch': 'Visibility override needs the relay-token flow. Decline this proposal first, then start a Visibility override from your claim.',
  'relay_token_mismatch':           "This code doesn't match what was captured on the call. Confirm it with the leader and try again.",

  // Auth + step-up
  'stale_aal2':                'Your TOTP verification window has expired. Re-enter your code to continue.',
  'no_aal2':                   'Sign in again with TOTP to access underground oversight.',
  'enrollment_missing':        'Set up TOTP on your authenticator app to access the underground screens.',
  'factor_revoked':            'Your TOTP was reset. Re-enroll your authenticator app to continue.',
  'verification_failed':       'Invalid TOTP code. Try again.',
  'step_up_required':          'This action requires elevated verification. Re-enter your TOTP code to continue.',
  'step_up_expired':           'Your step-up verification expired. Re-enter your password to continue.',
  'invalid_password':          'Invalid password. Try again.',
  'unauthorized':              'Your session has expired. Sign in again to continue.',
  'forbidden_underground_admin': "You don't have access to the underground oversight screens. If this is wrong, ask another admin to check your permissions.",

  // SEC over-disclosure collapses
  'rls_denied':                'Not found.',
  'not_found':                 'Not found.',
  'fk_violation':              "Couldn't complete this action. Refresh and try again.",

  // Generic
  'audit_log_write_failed:':   "Something went wrong on our side. The action wasn't recorded — please try again. If it keeps happening, contact the Replant team.",
  'TypeError: Failed to fetch': 'Network dropped. Check your connection and try again.',
}

export function humanize(raw) {
  if (!raw) return 'Something went wrong. Try again.'
  for (const [k, v] of Object.entries(TAGS)) {
    if (raw === k || raw.startsWith(k)) return v
  }
  return raw // fallback: caller already passed human copy
}

export function routeError(contextId, err) {
  const sink = ROUTES.get(contextId)
  const msg = humanize(err?.message)
  if (sink) { sink(msg); return true }
  return false // caller falls through to top banner
}
```

### `api.js` `call()` patch

```js
async function call(path, body, { stepUpToken, errorContext } = {}) {
  // …existing fetch + json parse…
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`)
    err.status = res.status
    err.request_id = json.request_id   // preserve for incident correlation
    err.errorContext = errorContext
    // SEC: scrub raw before any console/Sentry sink
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(new Error(humanize(json.error)), {
        tags: { request_id: json.request_id, status: res.status }
      })
    }
    throw err
  }
  return json
}
```

---

## 4 · Locked copy (verbatim — DO NOT INVENT or paraphrase)

### Step-up modal (workstream C — z-index fix + copy swap)
- Header: `STEP-UP VERIFICATION`
- Title: `Confirm your password`
- Body: `This action requires a fresh password check.`
- Footer: `Step-up verification expires after 5 minutes.`
- Wrong-password error: `Invalid password. Try again.`
- Expired token error: `Your step-up verification expired. Re-enter your password to continue.`
- Network error: `Couldn't verify your password. Check your connection and try again.`
- The token name `underground-confirm-proposal` (or any action-token string) MUST NOT appear in user-facing copy.

### AAL2 family (workstream C — TOTP / session-level reauth)
- Required: `This action requires elevated verification. Re-enter your TOTP code to continue.`
- Window expired (time-based, NOT action-triggered): `Your TOTP verification window has expired. Re-enter your code to continue.`
- Wrong code: `Invalid TOTP code. Try again.`
- Session-level not satisfied: `Sign in again with TOTP to access underground oversight.`
- `enrollment_missing`: `Set up TOTP on your authenticator app to access the underground screens.`
- `factor_revoked`: `Your TOTP was reset. Re-enroll your authenticator app to continue.`

### Hard-delete (workstream B — honest about scheduling)
- Action label: `Schedule for permanent removal` (NOT "Hard delete" — internal component name stays)
- Modal body: `This church will be permanently removed in 30 days. It can be restored from the Deactivated tab until then.`
- Failure error: `We couldn't schedule the removal. Try again.`

### Rejected detail page (workstream B)
- Top-right strip: `Rejected on Jun 24` (date format matches existing `expires Jun 27` pattern)
- Rejected-by line: `Rejected by Ruth · proposed by accounts@` (ratification B-#1)
- Back-link: `Back to Rejected`
- EvidenceUpload lock-banner on Rejected: `Evidence is locked — this church was rejected on Jun 24. View-only.`
- Hidden on Rejected (must NOT render): Day counter, Untouched/Claimed chip, Mark-as-in-review checkbox, Admin Notes composer, Ask-a-question composer, entire ACTIONS footer (Propose verify / Propose reject / Visibility override).
- Shown on Rejected (read-only): Profile · Claimed card, Evidence Packet card, prior Admin Notes log, prior Request-info messages, Evidence Files card.

### Admin tier (workstream A)

**Internal DB enum stays:** `'top_tier' | 'super_admin' | 'regular'`. **User-facing labels everywhere are:** Overseer · Super admin · Admin (per TierChip mapping in §3.5). Build agents MUST use the user-facing labels in every user-visible string; the DB values appear only in code/SQL, never in copy.

**Tier chips (user-facing labels per Founder ruling 2026-06-24):**
- `top_tier` → `OVERSEER` (restrained gold)
- `super_admin` → `SUPER ADMIN` (sky)
- `regular` → `ADMIN` (neutral)

**Invite admin modal:**
- Title: `Invite a new admin`
- Body: `New admins start with standard admin access. A Super admin can sponsor them for promotion later.`
- Fields: `Email` + `First name` + `Last name`
- CTA: `Cancel · Send invite`

**Promote admin modal (super admin initiates):**
- Title: `Request promotion for {{full_name}}`
- Body: `This will request Overseer approval to promote {{full_name}} from Admin to Super admin. Either Overseer can approve. The request expires in 48 hours.`
- CTA: `Cancel · Request promotion`

**Approve promotion modal (Overseer approves):**
- Title: `Approve promotion of {{full_name}}?`
- Body: `{{sponsor_name}} requested this promotion on {{requested_at}}. Approving makes {{full_name}} a Super admin immediately.`
- CTA: `Cancel · Approve promotion`

**Deny promotion modal (Overseer denies):**
- Title: `Deny promotion of {{full_name}}?`
- Body: `Add a reason (at least 30 characters). The sponsor will see this reason in their audit trail.`
- Field: `Denial reason` (textarea, min 30 chars)
- CTA: `Cancel · Deny promotion`

**Demote admin modal (single-eye, Overseer-only):**
- Title: `Demote {{full_name}} to Admin?`
- Body: `{{full_name}} will lose Super admin access immediately. They will keep Admin access. The minimum of 3 Super admins still applies.`
- CTA: `Cancel · Demote to Admin`

**Revoke admin modal:**
- Title: `Revoke admin access for {{full_name}}?`
- Body: `{{full_name}} will lose all admin access immediately. This does not delete their leader account.`
- CTA: `Cancel · Revoke admin access`

**Locked-out empty state (Admin hitting Underground or Team Management):**
- `This area is restricted. Ask a Super admin if you need access.`

**Sign-out badge text (when admin_tier changes mid-session):**
- `Your admin permissions changed. Sign out and sign in again to refresh.`

**Approval email subject:** `Your Replant admin role was updated`
**Approval email body:** `{{candidate_full_name}}, your account is now a Super admin on Replant. Sign in to see the new capabilities. — The Replant team`

### Account page — Identity section copy (workstream A, §3.5)
- Section header: `Identity`
- Email row tag: `read-only` (admin-mediated edit only — not self-service)
- Edit affordance: `Edit name` button when not editing
- Inline editor fields: `First name` + `Last name` (both required, max 80 chars each)
- Save CTA: `Save · Cancel`
- Save success toast: `Name updated.`
- Save failure inline (routed via error-routing.js): handled by dictionary humanize — generic fallback `We couldn't save your name. Try again.`
- Email-edit pointer line (under email row): `Need to change your email? Ask another admin.`

### Account page — TOTP section copy (workstream A, §3.5)
- Section header: `Two-factor authentication`
- Enrolled status card title: `TOTP enrolled`
- Enrolled status card body: `Your authenticator app is set up. You're asked for a code on sensitive actions.`
- Reset button: `Reset TOTP`
- Reset confirm modal title: `Reset TOTP?`
- Reset confirm modal body: `You'll set up your authenticator app again from scratch. Until you do, you won't be able to perform actions that require a code.`
- Reset confirm CTA: `Cancel · Reset TOTP`

### Account page — Coming-soon placeholders (workstream A, §3.5)
Each post-MVP section renders its section header + a muted card with body text only:
- Active sessions: `Coming soon — see and sign out from other devices.`
- Recent account activity: `Coming soon — review your recent sign-ins and account changes.`
- Preferences: `Coming soon — timezone, language, and notification settings.`

### Team Management pointer (workstream A — decoupling)
- Line at top of Team Management screen: `Manage your own two-factor authentication on your [Account page →](/account).`

---

## 5 · Realtime publication additions

Add to publication:
- `admin_tier_promotions` (so top-tier admins see new pending requests live)
- Existing `underground_admin_inbox_events` continues to handle underground cross-notify.

NO change to `audit_log` or `audit_log_underground` publication state.

---

## 6 · Halt conditions (HALT_REQUEST and stop if you encounter any of these)

1. Live `audit_log` action set doesn't match the 7 new entries above (some already added by prior sprint).
2. `custom_access_token_hook` source not findable in repo, or its current behavior diverges from what migration 0027 patches assume.
3. Step-up modal component path differs from the StepUpModal.jsx assumption — find it and HALT before refactoring.
4. `Shell.jsx` back-link pattern differs from the line-327 assumption — find it and HALT before parameterizing.
5. `accounts@projectreplant.org` user UUID not findable in live `public.users` — needed for top-tier seed.
6. Any test in `~/replant-admin/tests/` fails after a patch — HALT, don't paper over.
7. Any place the manifest's spec doesn't survive contact with live schema or live code.

DO NOT write `audit_log` or `audit_log_underground` probe rows. Use introspection (`pg_get_constraintdef`, `pg_get_functiondef`, `pg_get_triggerdef`, `list_tables`).

---

## 7 · Output format (each subagent's final response)

```
VERDICT: shipped | shipped-with-deviations | halted
MIGRATIONS APPLIED: [0024, 0025, 0026, 0027, 0028, 0029]
RPCS CREATED: [fn_invite_admin, fn_request_admin_promotion, fn_approve_admin_promotion, fn_deny_admin_promotion, fn_demote_admin, fn_revoke_admin, fn_expire_pending_admin_promotions, fn_update_admin_name]
RPCS PATCHED: [fn_confirm_underground_proposal, fn_list_pending_underground_queue]
NETLIFY ENDPOINTS ADDED: [invite-admin, request-admin-promotion, approve-admin-promotion, deny-admin-promotion, demote-admin, revoke-admin, list-admin-tier-promotions, update-account-name]
NETLIFY ENDPOINTS EDITED: [custom-access-token-hook, grant-admin, request-info-underground, underground-narrative-note, underground-evidence-create-intent, underground-evidence-delete, propose-underground, counter-propose-underground, underground-claim, underground-force-unmark-claim]
COMPONENTS CREATED: [UndergroundRejectedDetail, AdminTierPanel, PromoteAdminModal, ApprovePromotionModal, DenyPromotionModal, DemoteAdminModal, RevokeAdminModal, InviteAdminModal, TierChip, AccountPage, error-routing.js]
COMPONENTS EDITED: [Shell, App, UndergroundRejected, UndergroundDetail, Underground, UndergroundDeactivated, SecondLeaderDetail, EvidenceUpload, NarrativeComposer, ClaimAffordance, StepUpModal, ConfirmProposalModal, TeamManagement, api.js, nav config, globals.css]
REALTIME PUBLICATION ADDITIONS: [admin_tier_promotions]
DEVIATIONS FROM MANIFEST: <list each + reason>
HALT_REQUESTS: <list each + context>
FILES TOUCHED: <full path list>
COMMIT SHA RANGE: <first..last on replant-admin main>
```

In Jesus' name, Amen.
