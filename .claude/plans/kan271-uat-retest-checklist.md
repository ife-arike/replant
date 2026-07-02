# KAN-271 Post-Batch Re-Test Checklist (A–O)

**Status**: Batch shipped — `replant-admin` at `eb1b193`, `replant` migrations at `8de770b`. Wait for Netlify deploy (~2–3 min from push), then walk through this checklist.

**Before starting**:
1. ☐ **Sign out + sign back in** — fresh JWT picks up the F3 hook patch. Without this, the tier label will still read wrong.
2. ☐ **Set accounts@ name** via Account page → Edit: first_name="Replant", last_name="Operations". Verify bottom-left nav reflects.
3. Caffeinate is running (PID 71073). Kill with `kill 71073` when done with this pass.

---

## A · Bottom-left nav + Account click-target

- ☐ Bottom-left identity area shows: avatar (initials of first name) + first name + tier label as **plain text** (no pill, no dot, no monospace caps)
- ☐ Tier label reads "Overseer" for you (not "Super admin") — F3 hook fix
- ☐ accounts@ shows "Replant" not "UAT" (post step 2 above)
- ☐ Hover on identity block: subtle background wash + faint border + chevron `›` fades in on the right
- ☐ Click the identity block → routes to `/account`
- ☐ NO "PERSONAL" nav section in the side nav (F4 removed)
- ☐ Sign-out link still visible above the identity block, unchanged

---

## B · Account page (`/account`)

- ☐ Page header: full name as title; identity card with avatar + name + tier label (plain text) + email + "read-only" tag
- ☐ NO tier-blind descriptive paragraph ("You can approve proposals...") — F6 removed
- ☐ Name fields: default = read-only display. "Edit" button reveals two text inputs + Save + Cancel
- ☐ Edit → enter values → Save → optimistic update + toast confirms; bottom-left nav reflects new first name immediately
- ☐ Edit → Cancel reverts without saving
- ☐ Validation: empty field shows plain-English error inline (e.g., "First name is required.") — NOT raw "first_name_required"
- ☐ TOTP section: status card + "Reset TOTP" button (if enrolled). Reset → confirm → re-enroll flow
- ☐ "Coming soon" shells render for: Active sessions · Recent activity · Preferences — muted, NOT interactive (cursor: not-allowed)
- ☐ NO deactivation section anywhere
- ☐ Sign-out button at bottom of page

---

## C · Team Management decoupling

- ☐ Personal TOTP section NOT on Team Management (removed; only on Account page now)
- ☐ NO one-line pointer to Account (Founder ruled it isn't needed)

---

## D · Tier Management → CONSOLIDATED into Team Management (F12)

- ☐ NO separate "Tier Management" link in nav (sunset per consolidation)
- ☐ `/tier` URL → redirects to `/team`
- ☐ Team Management has Roster · Invite · Tier operations sections (or tabs)
- ☐ Header: "X admins" with tier breakdown (NOT "X super_admins · Server-side claim only")
- ☐ Warning banner copy: tier-model aware (NOT legacy super_admin JWT claim copy)
- ☐ Seed Overseers (Ruth + Replant Operations) marked with "Seeded" indicator
- ☐ Per-row Actions column present (Overseer sees promote/demote/revoke; Super admin sees Sponsor; Regular admin doesn't see the page)

---

## E · Invite Admin Modal (2-path flow)

Open Team Management → Invite.

- ☐ **Step 1**: email input + Continue button
- ☐ **Path A — unknown email**: progressive disclosure of First name + Last name fields; CTA "Send invite"; submits → toast "Invite sent to {{email}}"
- ☐ **Path B — existing leader email**: confirmation card with their name + role + church name + email; CTA "Grant admin access"; triggers step-up; on confirm → toast "Admin access granted to {{first_name}}"
- ☐ Edge: already-admin email → shows "Already an admin" with link to Tier ops
- ☐ Edge: already-replant_staff email → shows "Already registered as Replant staff"
- ☐ Edge: deactivated user → inline message BEFORE step-up
- ☐ Edge: self email → blocks with no-self-grant error
- ☐ "Use a different email" back-link works in steps 2 + 3 (no dead-end)

---

## F · Promotion ceremony (two-step) — needs a Regular admin to test against

Create a test Regular admin via Invite first.

- ☐ **Super admin step**: Team Management → Sponsor promotion → PromoteAdminModal → step-up → request created
- ☐ **Overseer cross-notify**: open dashboard as accounts@ in second tab → pending request appears live (Realtime)
- ☐ **Overseer approval**: ApprovePromotionModal → step-up (NEW — F-tier-hardening) → approve
- ☐ **Candidate's tier flips**: candidate signs out + back in → JWT carries `admin_tier=super_admin` → tier label updates to "Super admin"
- ☐ **F27 verification**: after approval, candidate's existing sessions are invalidated (forced sign-out)
- ☐ **Deny path**: DenyPromotionModal → reason ≥30 chars required → step-up → deny → audit row
- ☐ **48h TTL**: pending request expires after 48h (cron every 4h; can SQL-verify on `admin_tier_promotions`)

---

## G · Demote + Revoke — needs a Super admin or Regular admin to test against

- ☐ **Demote** (Overseer single-eye, requires step-up — F-tier-hardening): DemoteAdminModal → step-up → super_admin flips to Admin (regular). Target's sessions invalidated (F27)
- ☐ **MIN_SUPER_ADMINS=3 floor**: if super_admin count excluding top-tier seats is at 3, demote attempt fails with floor error
- ☐ **Revoke** (Overseer, requires step-up): RevokeAdminModal → step-up → target loses admin access. Target's sessions invalidated (F27)
- ☐ **Self-demote / self-revoke**: ATTEMPTING these on yourself fails with `no_self_demote` / `no_self_revoke` — Founder ruled this should NEVER be possible

---

## H · Rejected detail page

Click a rejected church (e.g., RPL-30067).

- ☐ Pending tab loads without "column reference ambiguous" error (F14 fix)
- ☐ Rejected tab loads without error
- ☐ RPL-30067 appears in Rejected tab, NOT Deactivated (F15 filter exclusion)
- ☐ Click rejected row → URL becomes `/underground/rejected/<id>` (NOT `/pending/<id>`)
- ☐ Top-right strip: "Rejected on <date>" + "Rejected by Ruth · proposed by accounts@"
- ☐ For historical rejected churches (pre-KAN-271): `Rejected by —` (F33 null-handle)
- ☐ NO Day counter, NO Untouched chip, NO Mark-as-in-review checkbox
- ☐ NO Admin Notes composer (read-only past notes only)
- ☐ NO Ask-a-question composer (read-only past thread only)
- ☐ NO Propose verify / Propose reject / Visibility override action buttons
- ☐ EvidenceUpload lock banner: "Evidence is locked — this church was rejected on {{date}}. View-only."
- ☐ Back-link reads "Back to Rejected" → routes to `/underground?tab=rejected`

---

## I · Inline-error posture (Underground screens)

For each, force an error and verify it renders **inline at the affordance**, NOT in top banner:

- ☐ Evidence upload: wrong file type → inline at widget
- ☐ Evidence upload: oversized file (>25 MB) → inline
- ☐ Evidence upload: per-file progress bar against the file row during upload
- ☐ Evidence upload: success → drop-zone briefly replaced with confirmation
- ☐ Narrative note: force fail → inline below textarea
- ☐ Request-info send: force fail → inline at composer
- ☐ Propose verify / Propose reject: force fail → inline in modal
- ☐ Cancel proposal: force fail → inline
- ☐ Confirm proposal: force fail → inline
- ☐ Claim race: another admin races you → inline at claim affordance
- ☐ Try to act on a rejected church (8 write paths) → 409 `church_rejected_read_only` → inline: "This church was rejected. Refresh to see the rejected detail page."

---

## J · Top-banner reserved scope (everything ELSE inline)

Top banner ONLY shows for:

- ☐ Initial page-load failures (kill network, reload → top banner)
- ☐ AAL2 gate at page entry (modal-routed; banner fallback)
- ☐ Network drop mid-action
- ☐ Auth lockout / session expired

If a top banner appears anywhere else (e.g., upload failure, propose error), regression.

---

## K · Step-up modal (z-index + copy)

- ☐ Trigger any TIER 1 destructive action (Confirm verify/reject, Schedule for permanent removal, Initiate restore, Force-unmark, Demote, Revoke, Approve/Deny promotion)
- ☐ Step-up modal renders ON TOP of the confirm modal (NOT behind it)
- ☐ Header: `STEP-UP VERIFICATION`
- ☐ Title: `Confirm your password`
- ☐ Body: `This action requires a fresh password check.` (NO `underground-confirm-proposal` token leak)
- ☐ Footer: `Step-up verification expires after 5 minutes.`
- ☐ Wrong password → `Invalid password. Try again.` (inline in modal)
- ☐ Expired token → `Your step-up verification expired. Re-enter your password to continue.`

---

## L · AAL2 family copy

- ☐ Try opening Underground without TOTP fresh → `Sign in again with TOTP to access underground oversight.`
- ☐ Wait 30 min after TOTP → try TIER 1 action → `Your TOTP verification window has expired. Re-enter your code to continue.` (time-based, NOT action-triggered framing)
- ☐ Enter wrong TOTP → `Invalid TOTP code. Try again.`
- ☐ NO "AAL2" / "stale_aal2" / "freshness" anywhere in the UI

---

## M · Hard-delete + Reinstate (the big one)

### Pre-action modals (F16 + F19)

- ☐ Click "Schedule for permanent removal..." on a Deactivated row (NOT "Hard-delete")
- ☐ Pre-proposal modal opens (NOT silent fire): eyebrow `STARTING PERMANENT-REMOVAL PROPOSAL`, title, body explaining escalation, REQUIRED admin_notes field (≥50 chars)
- ☐ Submit empty notes → inline validation error
- ☐ Submit valid notes → step-up ceremony fires → on success → proposal created + email sent to other Overseer
- ☐ Typed-confirm modal opens as SECOND step (type church_code to actually execute)
- ☐ Modal subtitle: `destructive · cannot be undone` (NO "Two-eyes")
- ☐ Modal body ends after "...cannot be reinstated after this commits." (NO "One church at a time — no bulk select")

- ☐ Click Reinstate on a Deactivated row
- ☐ Pre-action modal opens (NOT silent fire): eyebrow `INITIATING RESTORE`, title, body explaining escalation, REQUIRED admin_notes field (≥50 chars)
- ☐ Submit valid notes → step-up → on success → "Restore initiated" toast + "Restore pending" pill appears on row
- ☐ Email sent to other Overseer

### F25 — Cancel pending action affordance

- ☐ As accounts@: stale pending hard-delete `c8a524f4` on RPL-30067 — verify cancel affordance appears on the row (since accounts@ is the proposer; `pending_proposal_is_mine=true`)
- ☐ Cancel the stale proposal → audit row + clean state

### F24 — Awaiting scrub pill

- ☐ After hard-delete is fully confirmed (Admin B types church_code): row shows "Awaiting scrub" pill until daily sweeper runs (`hard_delete_scheduled_at <= now()` AND `hard_deleted_at IS NULL`)

### F20 — Email verification

- ☐ Initiate restore → email arrives at other underground admin (subject: "Restore initiated — your confirmation needed")
- ☐ Confirm restore (other admin) → email arrives at initiator (subject: "Restore accepted")
- ☐ Confirm hard-delete (Admin B) → email arrives at initiator (subject: "Permanent removal accepted")

### F6 — CancelProposalModal copy

- ☐ Cancel a proposal → body reads "The proposal will be withdrawn and the case returns to your claim." (NO "two-eyes" jargon)

### Where pending proposals surface

- ☐ Underground Oversight → Inbox tab loads pending items per-admin (Realtime-filtered)
- ☐ Stale `c8a524f4` proposal visible in Ruth's Inbox (since she's the second eye)

---

## N · JWT claim sanity check

Paste in devtools console on `admin.projectreplant.org` while signed in:

```js
(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
  if (!k) return console.error('Not signed in.');
  const session = JSON.parse(localStorage.getItem(k));
  const payload = JSON.parse(atob(session.access_token.split('.')[1]));
  console.log({
    admin_tier:           payload.admin_tier,
    super_admin:          payload.super_admin,
    is_top_tier_admin:    payload.is_top_tier_admin,
    is_underground_admin: payload.is_underground_admin,
    legacy_role:          payload.app_metadata?.role,
    app_metadata_tier:    payload.app_metadata?.admin_tier,
    email:                payload.email,
  });
})();
```

Expected post sign-out + sign-in:
- ☐ `admin_tier: "top_tier"`
- ☐ `app_metadata_tier: "top_tier"` (NEW — F3 hook patch — this is what the FE TierChip now reads)

---

## O · Audit log spot-check

Open Audit Log page (or query directly via SQL).

- ☐ `account_name_updated` fires when you save name via Account page
- ☐ `admin_invite_sent` fires when you invite a new admin
- ☐ `admin_grant_to_existing_user` fires when you grant admin to an existing leader
- ☐ `admin_tier_promotion_requested / _approved / _denied / _expired` fire on the ceremony
- ☐ `admin_demote` / `admin_revoke` fire on demote / revoke
- ☐ `view_rejected_underground_church` fires on rejected detail page load
- ☐ `underground_propose_hard_delete` (pre-existing pattern) still fires on Hard-delete pre-proposal submit
- ☐ `underground_initiate_restore` fires on Reinstate pre-action submit

---

## What's NOT in this batch (don't test for these)

- Mobile-side dashboard-only sign-in gate (replant_staff blocked from mobile) — next follow-up KAN
- Mobile signup role-dropdown filtering of `replant_staff` — same follow-up KAN
- Final admin notification email copy — placeholders with TODO; parallel email session will redesign
- Active sessions / Recent activity / Preferences on Account page — "Coming soon" shells only

## Known pre-existing test failures (NOT regressions)

If you run `npm test` in `replant-admin`, 3 tests fail (920/923 passing). These predate this bundle and are unchanged:
- 2× aal2-check freshness window tests (5min→30min ruling, tests not yet updated)
- 1× canonical-actions count guard (drifts every time DBA adds new audit actions)
