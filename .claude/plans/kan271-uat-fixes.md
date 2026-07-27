# KAN-271 Pre-UAT Functionality Pass — Tracker

**Status**: Founder is running her own pre-UAT functionality pass on the shipped KAN-271 bundle. **This is NOT the UAT sprint** — that comes later with real testers. This pass is to surface blocking + correctness issues before UAT begins.

**Discipline**: Each finding has SYMPTOM (Founder's observation), ROOT CAUSE (verified against live code/DB), and RECOMMENDED FIX (specific + lane-assigned). Proactive items found during investigation marked `[PROACTIVE]`. Voice for all copy fixes: clinical, peer-respecting per [[feedback-replant-admin-copy-voice]].

---

## Resolved Founder rulings (locked across blocks)

1. **Q1 (A1 fix path)** — RPC signature mismatch is the root cause; fix endpoint to match RPC, then Founder uses the editor (no direct SQL update for accounts@ data).
2. **Q2 (A2 pill scope)** — Plain text EVERYWHERE. No tier pill anywhere (Shell nav + Tier Management roster + Account header).
3. **Q3 (H2 rejected/deactivated separation)** — Option A. Rejected tab ONLY for rejected churches. Filter Deactivated tab to exclude `verification_status='rejected'`. Keep the 30-day hard-delete hygiene.
4. **Q4 (D1 consolidation)** — Consolidate Tier Management INTO Team Management. Sunset `/tier` route + Compliance-section nav entry.
5. **Q5 (D2 copy)** — "Sponsor promotion for [Regular admin name]" replaces "Request promotion".
6. **M-overall (this morning)** — Hard-delete AND Reinstate both need pre-action modals with: admin_notes input (REQUIRED, free-form), copy explaining "this will be escalated to an Overseer to accept or reject," + step-up gate. Apply same pattern to both.

---

## Founder's investigative questions — answered

### Q-A: Does Reinstate confirmed go to Pending or Verified?

**Verified against `fn_confirm_underground_proposal` body, action='restore' branch:**
- Sets `verification_status='pending'`
- Clears `soft_deleted_at`, `hard_delete_scheduled_at`, `rejected_at`, `rejected_by`, `deactivated_at`
- Sets `is_active=true`
- Sets `appeal_status='resolved_restore'`

**Answer: Pending tab.** The church re-enters the verification queue and must be re-verified through normal flow. Reasonable — restore doesn't blindly mark verified.

### Q-B: Does Hard-delete permanently disappear, or go to PII Scrub?

**Verified against the two-step pipeline:**
1. **Confirmation step** (`fn_confirm_underground_proposal` action='hard_delete'): sets `churches.hard_delete_scheduled_at = now()` + same on `users` rows tied to the church. Does NOT actually delete.
2. **Sweeper cron** (`fn_hard_delete_expired_soft_deletes`, runs daily): scans for rows where `hard_delete_scheduled_at <= now()`, writes `underground_hard_delete_executed` audit row BEFORE scrubbing, then scrubs PII fields + sets `hard_deleted_at = now()`. **Tombstone row REMAINS in DB**.

**Answer: It goes to PII Scrub History.** The row persists in DB with PII fields blanked — the tombstone exists for audit trail continuity. Does NOT row-DROP. Operator can confirm by visiting the PII Scrub History page after the sweeper runs.

**[PROACTIVE] Latency consideration**: from confirmed → actually scrubbed can be up to ~24h depending on when the next sweeper run fires. Should the UI reflect this? Currently the row would still appear in Deactivated tab (since `soft_deleted_at` is still set + `hard_deleted_at IS NULL`) UNTIL the sweeper completes. Possibly confusing — operator confirms hard-delete, expects row to disappear, sees it lingering. Worth a row-state pill: "Awaiting scheduled scrub" until `hard_deleted_at IS NOT NULL`.

---

## Block A — Bottom-left nav + Account page click-target

### A1 — accounts@ name data out of sync
**Symptom**: Founder renamed accounts@ to "Replant Operations" but the bottom-left nav doesn't show "Replant".
**Root cause** (verified live): `public.users` for accounts@ has `first_name='UAT'`, `last_name='Tester'`, `full_name='Replant Operations'`. Only `full_name` was updated (likely directly via Supabase auth UI); `first_name`/`last_name` were never touched. The nav displays `first_name`.
**Fix**: Update via the fixed Account editor (F1 / B0). Once F1 lands, Founder edits her own row to set `first_name="Replant"`, `last_name="Operations"`. `fn_compose_full_name` recomputes `full_name` to match.

### A2 — Tier label renders as colored pill
**Symptom**: Bottom-left shows a quiet pill (border + dot + monospace caps). Founder wants plain text — match the prior static `super_admin` badge.
**Root cause** (verified in CD's `source/TierChip.jsx` + lift): TierChip's design uses `.tier-chip` class with border + dot + monospace styling. Lift preserved this. Founder ruled plain text everywhere (Q2).
**Fix (F2)**: Strip pill styling. Render the tier label as plain text inline. Apply across ALL TierChip render sites: Shell nav, Team Management / Tier Management roster, Account page header.

### A3 — All top-tier admins show "Super admin" instead of "Overseer" — BLOCKING THE TIER DISPLAY
**Symptom**: Both Ruth + accounts@ (`is_top_tier_admin=true`) display "Super admin" in the bottom-left nav.
**Root cause** (verified against live `custom_access_token_hook` body): The hook computes `v_resolved_tier = 'top_tier'` correctly when `is_top_tier_admin=true`, then writes it via `jsonb_set(claims, '{admin_tier}', ...)` — placing it as a **TOP-LEVEL** JWT claim, NOT inside `claims.app_metadata`. supabase-js exposes `claims.app_metadata` as `session.user.app_metadata`. The FE TierChip reads `session.user.app_metadata.admin_tier` → `undefined`. TierChip then falls through to a legacy resolver that reads `session.user.app_metadata.role='super_admin'` → renders "Super admin" for everyone with the legacy role (including top-tier seats).
**Fix (F3)**: Patch the hook to ALSO write under `app_metadata`:
```sql
claims := jsonb_set(claims, '{app_metadata, admin_tier}', to_jsonb(v_resolved_tier));
```
After the patch lands, Founder MUST sign out + back in to mint a fresh JWT carrying the corrected app_metadata claim.
**[PROACTIVE]**: TierChip's fallback ordering needs a code review — even after F3, the order of resolution matters. The resolver should prefer `admin_tier` over legacy `role` so existing super_admins who haven't been touched yet still resolve correctly.

### A4 — Unwanted "PERSONAL" nav section + Account link
**Symptom**: A "PERSONAL" nav section with "Account" link appeared in the side nav. Founder wanted Account accessible ONLY via the bottom-left identity click-target.
**Root cause** (verified in BE+FE wave verdict, deviation #3): the wave agent added an extra `PERSONAL` section in `NAV_SECTIONS` "for discoverability." Not in spec.
**Fix (F4)**: Remove the `PERSONAL` section + `Account` link from `NAV_SECTIONS` in `Shell.jsx`. Keep ONLY the bottom-left identity Link wrap (per CD spec + Founder ruling).

### A5 — Subtle chevron not rendering on hover
**Symptom**: Founder doesn't see the chevron `›` on hover of the identity block.
**Root cause** (likely): the chevron `<span className="adm-id-chev">›</span>` wasn't added to Shell.jsx's identity block, OR the `.adm-id-chev` + `.adm-id:hover .adm-id-chev` CSS rules weren't merged into `globals.css` from CD's `account-cd.css`.
**Fix (F5)**: Verify Shell.jsx renders the chevron span inside the Link block. Verify CSS rules present in `globals.css`. Add whichever is missing.

### A6 — Sign-out visible
**Status**: ✅ Working. Leave alone.

---

## Block B — Account page (`/account`)

### B0 — `fn_update_admin_name` RPC signature mismatch — BLOCKING NAME EDITS
**Symptom**: Saving name on Account page errors: *"Could not find the function public.fn_update_admin_name(p_auth_id, p_first, p_last) in the schema cache"*.
**Root cause** (verified live): RPC signature is `fn_update_admin_name(p_first text, p_last text)` — 2 params, scopes to caller via `auth.uid()` internally. Endpoint [update-account-name.js:52-58](../replant-admin/netlify/functions/update-account-name.js) calls with 3 params including `p_auth_id`. Postgres rejects (no overload matches).
**Fix (F1)**:
1. Drop `p_auth_id: admin.user.auth_id` from the RPC call body. The RPC scopes via `auth.uid()`.
2. Endpoint currently allows `last_name=null` (becomes empty after trim), but RPC raises `missing_field:last`. Either require both names server-side (return 400 `last_name_required`) or have FE block submit on empty last.

### B1 — Page header copy is tier-blind + wrong
**Symptom**: Page top says "Admin" (Founder's reaction: *"like what am i supposed to do with that? it's not my role?"*) + descriptive paragraph reads *"You can approve proposals, manage churches, and act on flagged content. Tier promotion / demotion requires an Overseer."* Assumes the viewer is a Super admin. Ignores Overseer.
**Root cause** (verified in shipped Account.jsx structure): the BE+FE agent inserted a descriptive paragraph not in the CD spec. The paragraph hardcodes Super-admin-tier capabilities + assumes the viewer can't promote.
**Fix (F6)**: Remove the descriptive paragraph entirely. The CD spec uses the page header (RpFrame `title={fullName}`) + identity card (avatar + name + tier chip + email + read-only tag) — no paragraph. Use that pattern verbatim.
**[PROACTIVE]**: After the F2 plain-text TierChip patch, the identity card needs a visual review — without the pill, the tier label should still feel distinct from the email text so the hierarchy reads cleanly.

### B2 — No edit/save reveal pattern; fields always open
**Symptom**: First name + last name fields are always editable. "Save name" button always visible. No Edit button to reveal the editor; no cancel.
**Root cause**: BE+FE wave shipped the form as always-open instead of the locked Edit/Save/Cancel reveal pattern.
**Fix (F7)**: Default state = read-only display of first + last name. "Edit" button to the right. On Edit click → swap to editor (two inputs + Save + Cancel). On Save → call endpoint, optimistic update, toast on success, revert on error. On Cancel → revert to read-only without saving.
**[PROACTIVE]**: This matches the existing KAN-229 mobile Settings pattern — code reuse opportunity. Worth grepping for any shared edit-affordance component already in `replant-admin` before authoring fresh.

### B3 — Validation errors leak raw codes
**Symptom**: Submitting empty fields shows `first_name_required` raw error code (voice-ruling violation).
**Root cause**: Endpoint errors aren't routed through `error-routing.js` humanizer. They display raw to the operator.
**Fix (F8)**: Add humanizer dictionary entries for the account-name error keys. Render inline at the form, not in top banner. Entries:
- `first_name_required` → `First name is required.`
- `last_name_required` → `Last name is required.`
- `field_too_long:first` → `First name is too long (max 80 characters).`
- `field_too_long:last` → `Last name is too long (max 80 characters).`
- `unauthorized` → `Your session has expired. Sign in again to continue.`
- `update_failed` → `Couldn't save the change. Try again.`

### B4 — TOTP not visually hero
**Status**: ⚠️ Cosmetic. Founder OK either way. Skip unless touching the section.

### B5 — Reset TOTP flow
**Status**: ✅ Working. Leave alone.

### B6 — TOTP enrollment on fresh account
**Status**: ⏸️ Founder will check on a fresh regular-admin account once invite flow works.

### B7 — Sign-out button missing on Account page
**Symptom**: Manifest §3.5 called for an on-page sign-out button (mirroring nav for discoverability). Not shipped.
**Root cause**: BE+FE wave skipped this section.
**Fix (F9)**: Add sign-out button at the bottom of the Account page, using existing `supabase.auth.signOut()`. Plain button, plain English label.

### B8 — "Coming soon" placeholders missing
**Symptom**: Page ends at TOTP. No section shells for Active sessions / Recent account activity / Preferences (which Founder ratified as post-MVP placeholder shells on 2026-06-24).
**Root cause**: BE+FE wave skipped these section shells.
**Fix (F10)**: Add three muted "Coming soon" section shells: Active sessions, Recent account activity, Preferences. Use a lower-contrast card style so they read as "future" not "broken." NO deactivation section (dropped per ruling).
**[PROACTIVE]**: Founder ratified Coming-soon as the literal placeholder copy; consider adding a one-line muted descriptor under each header so the operator gets a hint of what's coming (e.g., *"Manage active sessions and sign out other devices"*). Otherwise three identical "Coming soon" cards stack feel empty.

### B9 — No deactivation section
**Status**: ✅ Correctly absent (dropped per ruling).

### B-overall — Page is structurally incomplete
The compounding effect of B1+B2+B7+B8: the BE+FE wave under-delivered on §3.5 spec. Tracker entry F6+F7+F9+F10 together rebuild the page to spec.

---

## Block C — Team Management decoupling

### C1 — Personal TOTP section removal
**Status**: ✅ Confirmed removed.

### C2 — One-line pointer to Account page
**Symptom**: Pointer not added; Founder ruled it isn't needed.
**Fix (F11)**: Drop from spec. No-op (don't add).

### C3 — Grant / revoke flows blocked
**Status**: ⏸️ Blocked on A3 + B0 cascade. Retest after batch.

### C4 — Page is super_admin-centric throughout
**Symptom**: Entire Team Management page uses legacy `super_admin` framing (header *"2 super_admins · Server-side claim only"*, warning banner about `super_admin JWT claim`, audit actions `super_admin_granted`/`super_admin_revoked`).
**Root cause**: Team Management is the OLD KAN-97/KAN-98-era surface. It was never updated for the tier model — the new tier model lives on the separate `/tier` page.
**Fix**: Folds into the F12 consolidation rework below.
**[PROACTIVE]**: Audit actions `super_admin_granted` / `super_admin_revoked` are STILL emitted by the legacy grant-admin path. After consolidation, decide: stop firing legacy actions OR keep emitting them for break-glass continuity. Recommend: keep emitting (legacy actions remain for the top-tier break-glass path; new path emits the new actions). Forensic audit trail then reads both depending on which path was used.

---

## Block D — Tier Management page

### D1 — Should be a tab on Team Management
**Status**: ✅ Locked Option A — consolidate (Q4 above).

### D2 — Tier Management UI wrong for Overseer viewer
**Symptom**: Overseer (Founder) only sees a "Request promotion" button. No promote/demote/revoke actions on roster rows. No Actions column.
**Root cause** (verified in shipped TierManagement.jsx structure + admin-tier.js): the page isn't tier-aware in render. It assumes the viewer is a Super admin seeking promotion. Overseer + Regular admin views weren't built. The "Request promotion" copy is also wrong — the locked semantics (A-#10) are super_admin SPONSORS a Regular admin's promotion to super_admin, NOT a self-request to become a higher tier.
**Fix (folds into F12)**:
- **Overseer view**: Roster + Actions column with per-row actions (approve pending promotion if any · demote Super admin → Admin · revoke Admin).
- **Super admin view**: Roster (read-only) + "Sponsor promotion for [Regular admin]" CTA + their own pending sponsorships.
- **Regular admin view**: page hidden (already gated).
- Copy: "Sponsor promotion for [Regular admin name]" replaces "Request promotion" (Q5 locked).
- No "request promotion" path exists for the Overseer tier — top-tier seats are seed-only. No path from Super → Overseer ever exists in MVP.

### D3 — Regular admin scope
**Status**: ⏸️ Will check on fresh regular-admin account after batch.

### D4 — Actions column missing
**Folds into F12.**

### F12 — Consolidation rework (CRITICAL ARCHITECTURE)
**The work**: rebuild Team Management as a single tier-aware multi-section page. Sunset the separate `/tier` route + nav entry. All legacy super_admin copy rewritten to tier-model copy.

Sections (tabs or stacked, build-team judgment):
1. **Roster** — list all admins with Name · Email · Tier (plain text) · Granted on · Last sign-in · Actions (tier-gated per viewer's tier).
2. **Invite** — opens InviteAdminModal (the 2-path flow — new staff vs. existing leader).
3. **Tier operations** — Sponsor promotion (Super admin view) / Approve pending promotion (Overseer view) / Demote (Overseer view) / Revoke (Overseer view).

**Tier-gated rendering**:
- Overseer: all sections visible + all actions enabled.
- Super admin: Roster (read-only roster); Invite (open); Tier operations → only "Sponsor promotion" CTA.
- Regular admin: page hidden entirely from nav.

**Copy rewrite scope**:
- Header: drop "X super_admins · Server-side claim only" → use "X admins" with tier breakdown subline.
- Warning banner about `super_admin JWT claim`: rewrite to be tier-model aware. Suggested: *"Tier changes are server-side. Promotion to Super admin requires two-Overseer confirmation; demote / revoke is single-Overseer. All actions are audit-logged."*
- All instances of `super_admin` (literal lowercase with underscore) → "Super admin" (display form).
- Cross-reference to legacy `grant-admin.js` endpoint: keep as break-glass; document it ONLY appears for Overseer.

**Files affected**: `TeamManagement.jsx` (rebuild), `TierManagement.jsx` (sunset — file deleted OR redirected to TeamManagement#tier-operations), `App.jsx` (drop `/tier` route, redirect to `/team#tier-operations`), `Shell.jsx` (drop "Tier Management" nav entry from Compliance section).

**[PROACTIVE]**: The Founder identity (`bb6c6385`) and Replant Operations (`19bf5467`) are seeded as Overseers; the roster should display them distinctly (perhaps a "Seeded" marker) so future admins can tell which Overseers are immutable seeds vs. which were promoted. Worth surfacing in roster display.

---

## Block E — Invite Admin Modal
**Status**: ⏸️ Blocked. Tier Management page's Invite affordance not surfaced for Overseer. Will retest after F12 lands and the InviteAdminModal is wired in.

---

## Block F + G — Promotion ceremony + Demote/Revoke
**Status**: ⏸️ Blocked on cascade (no Regular admin to test against + A3 tier-resolution + D2 action surfacing).

---

## Block H — Rejected detail page

### H1 — `fn_list_pending_underground_queue` errors with ambiguous column reference — BLOCKING ALL UNDERGROUND OVERSIGHT TESTING
**Symptom**: Pending tab + Rejected tab both error: *"column reference 'church_id' is ambiguous"*.
**Root cause** (verified live RPC body): The function's `RETURNS TABLE(church_id uuid, ...)` introduces `church_id` as an OUT parameter. The LATERAL subquery (DBA's KAN-271 patch for `rejected_proposer_id`) references `church_id` UNQUALIFIED:
```sql
LEFT JOIN LATERAL (
  SELECT proposer_id
    FROM public.underground_verification_proposals
    WHERE church_id = c.id   -- ← ambiguous: OUT param vs table column
    ...
) rp ON true
```
Other subqueries are correctly table-qualified (`p2.church_id`, `al_reply.church_id`). Only the LATERAL is broken.
**Fix (F14)**: DBA migration. Alias the table inside the LATERAL:
```sql
LEFT JOIN LATERAL (
  SELECT uvp.proposer_id
    FROM public.underground_verification_proposals uvp
    WHERE uvp.church_id = c.id AND uvp.action = 'reject' AND uvp.proposal_status = 'confirmed'
    ORDER BY uvp.confirmed_at DESC NULLS LAST
    LIMIT 1
) rp ON true
```
**[PROACTIVE]**: Same RETURNS-TABLE shadow risk exists in any other place in this RPC. The other subqueries are qualified, but worth a careful re-read of the full function to make sure no other ambiguity lurks (the function is now ~80 lines after the DBA patch).

### H2 — Rejected churches land in Deactivated tab instead of Rejected
**Status**: ✅ Option A locked (Q3). Filter Deactivated to exclude rejected.
**Fix (F15)**: Update the Deactivated tab's row-filter to add `AND verification_status != 'rejected'`. Lives in the FE list-query call (or BE if the RPC does the filter).
**[PROACTIVE]**: Verify whether the Deactivated filter lives in the FE or in `fn_list_pending_underground_queue` (which returns both pending AND deactivated currently). If in the RPC, this needs a DBA patch. If in the FE, FE-only patch. Quick code grep needed during fix.

### H3 — All other Block H tests blocked
**Status**: ⏸️ Top-right strip, hidden composers, action-bar removals, evidence read-only, lock-banner copy, back-link — all blocked on H1 + H2. Retest after batch lands.
**[PROACTIVE — verification queue for after H1 fix]**:
1. Verify `UndergroundRejectedDetail.jsx` actually renders with: NO Day counter, NO Untouched chip, NO Mark-as-in-review checkbox, NO Admin Notes composer, NO Ask-a-question composer, NO action-bar (Propose verify / Propose reject / Visibility override). Confirm read-only chrome: Profile · Claimed card, Evidence Packet read-only, prior Admin Notes log read-only, prior Request-info thread read-only, Evidence Files read-only.
2. Verify Rejected tab list columns show both proposer + confirmer per locked spec ("Rejected by Ruth · proposed by accounts@"). The list-query RPC returns both fields after H1 fix.
3. Verify back-link reads "Back to Rejected" and routes to `/underground?tab=rejected`.
4. Verify EvidenceUpload lock-banner copy when `lockReason='rejected'`: *"Evidence is locked — this church was rejected on {{date}}. View-only."*
5. Verify 8 server-side 409 `church_rejected_read_only` guards actually present on: `request-info-underground`, `underground-narrative-note`, `underground-evidence-create-intent`, `underground-evidence-delete`, `propose-underground`, `counter-propose-underground`, `underground-claim`, `underground-force-unmark-claim`.
6. Verify `view_rejected_underground_church` audit action fires on rejected-detail page load.

---

## Block I — Inline-error posture
**Status**: ⏸️ Blocked on H1 (no rows render).

---

## Block J — Top-banner reserved scope
**Status**: ⏸️ Will test after batch.

---

## Block K — Step-up modal (z-index + copy)
**Status**: ⏸️ Blocked on H1 (no actionable rows to trigger TIER 1 confirms).

---

## Block L — AAL2 family copy
**Status**: ⏸️ Will test with J.

---

## Block M — Hard-delete + Reinstate flows

### M-root — Silent destructive-adjacent fires (THE PATTERN BUG)
**Symptom**: Founder clicked Hard-delete "just to see the modal" — got an email to the other Overseer + a pending proposal in DB. Clicked Reinstate — no modal, no confirmation, action fired silently.
**Root cause** (verified in code + audit trail):

**Hard-delete** (`UndergroundDeactivated.jsx:99-114`):
```js
async function handleStartHardDelete(churchId, churchCode) {
  const { proposal_id } = await proposeUnderground(churchId, 'hard_delete', {
    admin_notes: 'Hard-delete proposal — past the 30-day window or admin-initiated permanent removal. ...',  // HARDCODED
  })   // FIRES IMMEDIATELY — no modal, no step-up, no operator-supplied notes
  setDeleteTarget({ proposalId: proposal_id, churchCode })   // NOW shows typed-confirm modal
}
```

**Reinstate** (`UndergroundDeactivated.jsx:78-94`):
```js
async function handleReinstate(churchId) {
  await initiateRestoreUnderground(churchId)   // FIRES IMMEDIATELY — no modal at all
  setRefreshKey(k => k + 1)
}
```

**The HardDeleteConfirmModal is the SECOND step.** It typed-confirms the church_code to actually execute (after the second Overseer confirms the proposal). But the proposal itself is created on the FIRST click, silently. Same for Reinstate — clicking initiates the restore proposal; the church goes into a "restore awaiting confirm" state with no visible signal.

### M1 — Hard-delete needs a pre-proposal modal (admin notes + step-up + clear "this will be escalated" copy)

**Fix (F16)**: NEW pre-proposal modal that opens on Hard-delete button click. Replaces the current silent-fire `handleStartHardDelete`. Modal includes:

1. **Eyebrow / context line**: `STARTING PERMANENT-REMOVAL PROPOSAL`
2. **Title**: `Permanently remove this church?`
3. **Body**: *"This starts a permanent-removal proposal for review. The other Overseer will receive an email asking them to accept or reject. Once accepted, the church's PII is scrubbed and a tombstone row remains for audit. This cannot be undone after accept."*
4. **Admin notes field (REQUIRED, free-form, ~min 50 chars)**: prompt the operator to give context. Label: `Why is this church being removed?` Helper text: `Visible to the other Overseer when they review. Include the reason and any context needed to decide.`
5. **Action**: Cancel · Continue. Continue triggers step-up modal. On step-up success → fire `proposeUnderground('hard_delete', {admin_notes})` with the operator-supplied notes (NOT hardcoded) + step-up token. On success → open the existing typed-confirm modal (which is now correctly the SECOND step).

### M2 — "Two-eyes ·" subtitle on HardDeleteConfirmModal
**Symptom**: `<div className="mdl-sub">Two-eyes · destructive · cannot be undone</div>` at line 55.
**Fix (F17)**: Remove "Two-eyes ·". Subtitle reads: `destructive · cannot be undone`.

### M3 — "One church at a time — no bulk select." copy
**Symptom**: HardDeleteConfirmModal body line 61 ends with this sentence.
**Fix (F18)**: Drop the sentence. New body: *"This permanently scrubs PII and writes a tombstone row. The record cannot be reinstated after this commits."*

### M4 — Reinstate needs a pre-action modal (same pattern as M1)

**Fix (F19)**: NEW pre-action modal on Reinstate button click. Replaces the silent-fire `handleReinstate`. Modal includes:

1. **Eyebrow / context line**: `INITIATING RESTORE`
2. **Title**: `Restore this church?`
3. **Body**: *"This starts a restore for review. The other Overseer will receive an email asking them to accept or reject. Once accepted, the church returns to the Pending tab and must be re-verified through the normal flow."*
4. **Admin notes field (REQUIRED, free-form, ~min 50 chars)**: `Why is this church being restored?` Helper text: `Visible to the other Overseer when they review.`
5. **Action**: Cancel · Initiate restore. Initiate triggers step-up modal. On step-up success → fire `initiateRestoreUnderground` with admin_notes + step-up token. On success → toast (*"Restore initiated. The other Overseer has been notified."*) + add a "Restore pending" pill on the row in Deactivated tab.

**[PROACTIVE]**: `initiateRestoreUnderground` currently doesn't accept admin_notes or step-up params. Need to extend both the FE wrapper and the BE endpoint + RPC to accept + record admin_notes. Step-up gate needs to be added at endpoint level (matching the destructive-action posture).

### M5 — Reinstate emails missing (both initiate AND confirm)

**Fix (F20)**: Wire two Resend emails. Use the same placeholder-with-TODO pattern as `admin-invite-email.js` so the parallel email session can redesign later.

1. **On `initiate-restore-underground.js` success** → email to OTHER Overseer:
   - Subject: `Restore initiated — your confirmation needed`
   - Body (placeholder): *"{{initiator_name}} initiated a restore for an underground church on Replant. Sign in to admin.projectreplant.org to review and accept or reject. — The Replant team"*
2. **On `confirm-restore-underground.js` success** → email to the INITIATING admin:
   - Subject: `Restore accepted`
   - Body (placeholder): *"The restore you initiated has been accepted by {{confirmer_name}}. The church is back in the Pending queue for re-verification. — The Replant team"*

**[PROACTIVE]**: Same pattern needed for HARD-DELETE. Currently the email Founder received this morning ("action needed — please sign in to review") came from somewhere — likely the propose-underground notification path. Verify there's a hard-delete-CONFIRMED email too:
3. **On `hard-delete-underground-confirm.js` success** → email to the INITIATING admin:
   - Subject: `Permanent removal accepted`
   - Body (placeholder): *"The permanent-removal proposal you initiated has been accepted by {{confirmer_name}}. The church's PII will be scrubbed by the next daily sweeper. The tombstone row remains in PII Scrub History. — The Replant team"*

### M6 — "two-eyes" copy in CancelProposalModal body
**Symptom**: Line 63: *"The proposal will be withdrawn and the case returns to your claim with no two-eyes step in flight."*
**Fix (F21)**: Rewrite without "two-eyes": *"The proposal will be withdrawn and the case returns to your claim."*

### M7 — Row button label still says "Hard-delete"
**Fix (F23)**: Already in batch (per locked hard-delete copy). Rename row action button to *"Schedule for permanent removal..."* (the ellipsis signals "opens a modal" — UX convention).

### M-PROACTIVE-1 — Hard-delete proposal expiry behavior
**[PROACTIVE]**: Per `propose-underground.js` comment ("sits in `pending` for 72h"), proposals expire after 72h. The CURRENT pending hard-delete proposal `c8a524f4...` on RPL-30067 (Founder's silent click) will expire if not actioned. Recommend: Founder explicitly CANCEL this stale proposal before it auto-expires (cleaner audit trail). Cancellation path: the proposer can cancel from the church detail page via `cancel-underground-proposal` endpoint. Worth verifying that path still works on the rejected church (likely 409 because rejected churches are read-only — would need a special exception for proposer-cancel even on rejected).

### M-PROACTIVE-2 — Step-up regression for hard-delete proposal creation
**[PROACTIVE]**: The current `handleStartHardDelete` flow does NOT pass a step-up token to `proposeUnderground`. Hard-delete IS a TIER 1 destructive per locked spec — step-up MUST gate it. F16 fix folds this in (pre-proposal modal triggers step-up before firing). Audit log should also surface step-up freshness as part of the proposal meta — verify after F16 lands.

### M-PROACTIVE-3 — Sweeper latency vs operator expectation
**[PROACTIVE]**: After hard-delete is fully confirmed, the actual PII scrub happens on the next daily sweeper run (up to ~24h later). The row still appears in Deactivated tab with `hard_delete_scheduled_at=now()` until the sweeper completes. Consider adding a row pill: `Awaiting scrub` for rows where `hard_delete_scheduled_at <= now()` AND `hard_deleted_at IS NULL`. Operator sees the action landed + knows scrub is pending. Otherwise it looks like nothing happened.

### M-PROACTIVE-4 — Restore expiry / cancellation symmetry
**[PROACTIVE]**: Verify pending restore proposals also expire at 72h. Verify the proposer can cancel a pending restore from the Deactivated tab (probably needs new affordance — currently only the action buttons exist; no "cancel pending action" affordance per-row).

---

## Block N — JWT claim sanity check (console snippet)

Paste in browser devtools console on `admin.projectreplant.org` while signed in:

```js
(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'));
  if (!k) return console.error('Not signed in (no Supabase session in localStorage).');
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

**Expected after F3 hook patch + Founder signs out + back in:**
- `admin_tier: "top_tier"` (already correct as top-level)
- `app_metadata_tier: "top_tier"` (NEW — populated by F3 patch)

**Currently (pre-F3):** `app_metadata_tier: undefined`. That's the A3 root cause.

---

## Block O — Audit log spot-check
**Status**: ⏸️ Most new actions can't be tested until the flows that trigger them work end-to-end. Underground audit pipeline IS firing correctly (RPL-30067 trail confirms). Audit Log page itself rendering — worth a spot check during the post-batch re-test pass.
**[PROACTIVE]**: After batch lands, verify the Audit Log page renders correctly + new actions appear in its filter/display. Worth a brief code check during fix to make sure the page handles the new action keys gracefully (some audit-log UIs hardcode action lists for filtering — would need the new actions added).

---

## Batch fix list — RENUMBERED (post-rewrite)

Locked rulings + fixes ready to dispatch. Numbered in dependency order (DBA blocking fixes first).

| # | From | Fix | Lane |
|---|---|---|---|
| F1 | A1 / B0 | Drop `p_auth_id` from RPC call in `update-account-name.js`; require both first+last name on endpoint (return 400 `last_name_required`) | BE |
| F2 | A2 / Q2 | TierChip render → plain text everywhere (Shell nav, Roster, Account header). Strip `.tier-chip` pill styling | FE |
| F3 | A3 | DBA patch `custom_access_token_hook` to ALSO write `admin_tier` inside `claims.app_metadata`. After deploy: Founder signs out + back in | DBA |
| F4 | A4 | Remove "PERSONAL" nav section + Account link from `NAV_SECTIONS` in `Shell.jsx` | FE |
| F5 | A5 | Add chevron `›` to Shell.jsx identity block; merge `.adm-id-chev` + `:hover` CSS from CD `account-cd.css` into `globals.css` | FE |
| F6 | B1 | Remove tier-blind descriptive paragraph from Account page header; use CD-spec identity card pattern | FE |
| F7 | B2 | Add Edit / Save / Cancel reveal pattern for name fields. Optimistic update + toast | FE |
| F8 | B3 | Humanize endpoint errors through error-routing dictionary (dictionary entries listed above) | FE |
| F9 | B7 | Add sign-out button to Account page footer | FE |
| F10 | B8 | Add muted "Coming soon" section shells: Active sessions · Recent activity · Preferences (each with a one-line muted descriptor) | FE |
| F11 | C2 | Confirm no-op (don't add the spec'd one-line pointer on Team Management) | FE (verify) |
| F12 | C4 + D1 + D2 + D4 | **Consolidation rework**: rebuild `TeamManagement.jsx` as tier-aware multi-section page (Roster · Invite · Tier operations). Sunset `/tier` route + nav entry. Rewrite all legacy `super_admin` copy. Tier-gate actions per viewer's tier. Move Add-team-member into the new InviteAdminModal flow | FE + BE |
| F13 | D2 copy / Q5 | "Sponsor promotion for [Regular admin name]" replaces "Request promotion" everywhere | FE |
| F14 | H1 | DBA: alias `underground_verification_proposals` in the LATERAL subquery of `fn_list_pending_underground_queue` (e.g., `uvp.church_id`). Audit the rest of the RPC for any other RETURNS-TABLE-shadow ambiguity | DBA |
| F15 | H2 / Q3 | Deactivated tab filter: add `AND verification_status != 'rejected'`. Confirm whether filter is FE-side or RPC-side; patch accordingly | FE or BE |
| F16 | M1 + M-PROACTIVE-2 | NEW pre-proposal modal for Hard-delete: admin_notes input (REQUIRED, ≥50 chars) + step-up gate + clear escalation copy + Cancel/Continue. Replaces silent `handleStartHardDelete` fire | FE + small BE (step-up integration) |
| F17 | M2 | HardDeleteConfirmModal subtitle: remove "Two-eyes · " | FE |
| F18 | M3 | HardDeleteConfirmModal body: remove "One church at a time — no bulk select." | FE |
| F19 | M4 + M-PROACTIVE-3 | NEW pre-action modal for Reinstate: admin_notes input (REQUIRED, ≥50 chars) + step-up gate + clear escalation copy + Cancel/Initiate. Add "Restore pending" row pill once initiated. Extend `initiate-restore-underground` endpoint + RPC to accept admin_notes + step-up | FE + BE + DBA |
| F20 | M5 + M-PROACTIVE-1 | Wire 3 Resend emails (initiate-restore → other Overseer; confirm-restore → initiator; confirm-hard-delete → initiator). Placeholder copy with TODO for email-session redesign | BE |
| F21 | M6 | CancelProposalModal body: remove "two-eyes" framing | FE |
| F22 | (proactive global) | Code audit of ALL `handle*` action handlers across underground/admin screens for any other silent-fire pattern. Add confirmation modals to any other destructive-adjacent action that doesn't have one | FE (audit + small fixes) |
| F23 | M7 / locked copy | Row button label: "Hard-delete" → "Schedule for permanent removal..." | FE |
| F24 | M-PROACTIVE-3 | Add "Awaiting scrub" row pill in Deactivated tab when `hard_delete_scheduled_at <= now()` AND `hard_deleted_at IS NULL`. Operator sees the destruction is scheduled but not yet executed | FE |
| F25 | M-PROACTIVE-4 + M-PROACTIVE-1 | Add "Cancel pending [action]" affordance per-row on Deactivated tab when a pending restore OR hard-delete exists. Allows proposer to cancel before expiry | FE |

---

## Verification queue (after batch deploys, Founder re-tests)

In order (each unblocks the next):
1. **F3 verifies** — sign out + sign in + run Block N console snippet. Confirms `app_metadata.admin_tier='top_tier'`.
2. **F1 verifies** — Account page name edit succeeds. accounts@ updates to first_name="Replant".
3. **F2 / F4 / F5 / F6 / F7 / F8 / F9 / F10 verifies** — full Account page re-walkthrough per Block A + B.
4. **F14 / F15 verifies** — Underground Pending + Rejected tabs load. RPL-30067 appears in Rejected (not Deactivated).
5. **H3 verification queue** (6 items listed under H3 PROACTIVE).
6. **F12 verifies** — Team Management rebuilt page; no separate /tier route. Tier-aware actions per viewer.
7. **F11 / F13 verifies** — copy locked everywhere.
8. **F16 / F17 / F18 / F19 / F20 / F21 / F22 / F23 / F24 / F25 verifies** — full M-block re-walkthrough.
9. **Block I + J + K + L re-test** — inline-error posture across underground screens, AAL2 family copy, step-up modal overlay verification.
10. **Block O re-test** — audit log new actions firing + Audit Log page rendering.
11. **B6 / D3 / F / G / E re-test** — Founder creates a test regular-admin account; verifies the full invite + promote ceremony + demote + revoke flow + TOTP enrollment on a fresh account.

---

## Proactive sweep — additional finds (added 2026-06-25, post-Founder pushback)

Prior pass was Deactivate/Reinstate-heavy. This section surfaces concerns across ALL blocks + system-wide. Each is marked with severity: **🔴 likely bug** | **🟡 UX gap / edge** | **🟢 worth verifying** | **📋 post-MVP candidate**.

### Pre-proposal modal copy clarification (Founder Q)

**Auth gate is `is_underground_admin` (scope), NOT tier.** Currently both seed Overseers (Ruth + accounts@) are the only underground admins, but the gate doesn't require Overseer tier — a future Super admin with `is_underground_admin=true` would also pass. Therefore:

🟡 **F16/F19 copy fix**: "the other Overseer" → **"another underground admin"** in both pre-proposal modals (Hard-delete + Reinstate). Matches the actual gate.

### Where pending proposals surface (M-PROACTIVE-1 follow-up)

🟢 **Verified**: Underground Oversight has an **Inbox** tab (`Underground.jsx:482`) rendering pending items per-admin via `underground_admin_inbox_events` filtered by `admin_id=eq.{viewerUserId}`.

🟡 **F26 (NEW)** — Founder's stale pending hard-delete proposal `c8a524f4...` on RPL-30067 (from this morning's silent click) currently sits in DB awaiting action. Ruth's Inbox SHOULD surface it. Verify Inbox tab loads correctly post-F14 (currently blocked by H1) + shows the pending hard-delete. Then Founder should explicitly CANCEL it before the 72h expiry.

### Block A — Bottom-left identity area

🟡 **A-PROACTIVE-1** — Long-name truncation. If an admin has a long full_name (e.g., "Maximilian Christopher Constantinople"), does the bottom-left layout wrap, truncate, or overflow? Identity card spec uses `min-width: 0` + `flex: 1` but the inner `.rp-id-name` may need explicit `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap`. Verify after F4/F5.

🟡 **A-PROACTIVE-2** — Avatar initials with non-Latin first_name (Chinese, Cyrillic, etc.) — does the `.split(' ').map(s=>s[0])` helper produce sensible output? Probably OK for single chars but worth a code grep on `initials()` helper.

🟢 **A-PROACTIVE-3** — Fresh-login render flicker: Shell mounts before `session.user.app_metadata.admin_tier` hydrates. Identity card may render with blank tier label briefly. Verify the loading state (skeleton or hidden) isn't visually broken.

### Block B — Account page

🔴 **B-PROACTIVE-1** — Reset TOTP mid-flow failure: if `unenrollTotpFactor` succeeds but `TotpEnrollmentScreen` then fails to enroll a new factor, the admin is locked out of all AAL2 surfaces with no factor on file. Verify the existing flow is transactional (or has clear recovery copy: "Old TOTP removed but new not enrolled — sign in via password + re-enroll").

🟡 **B-PROACTIVE-2** — Email field render: spec called for "read-only tag" but current screenshot shows it in an `<input>` styling. Operator might think they can edit it. Use `<span>` + a clear `read-only` chip per CD spec. Folds into F6 cleanup.

🟡 **B-PROACTIVE-3** — Coming Soon cards (F10): operator might click expecting interaction. Add `cursor: not-allowed` + brief muted descriptor per card so they're recognizably "future" not "broken."

🟢 **B-PROACTIVE-4** — Concurrent edit conflict: same admin opens Account in two tabs, both submit name update. Last write wins. Optimistic UI in tab 1 shows stale state. Worth a visibilitychange refetch (small UX detail; not blocking).

### Block C+D / F12 — Team Management consolidation

🔴 **CD-PROACTIVE-1** — Self-demote / self-revoke footgun: can Ruth demote herself? Verify `fn_demote_admin` raises `no_self_demote` (currently DBA spec mentions `no_self_approve` but not `no_self_demote`). Same for `fn_revoke_admin`. Without these CHECKs, an admin could accidentally lock themselves out. CRITICAL.

🔴 **CD-PROACTIVE-2** — MIN_SUPER_ADMINS=3 floor: verify `fn_count_active_super_admins_excluding_top_tier()` actually excludes top-tier seats. Currently `non_top_tier_super_admin_count = 0` per DBA verdict — so no super_admins exist outside Ruth+accounts@. Per A-#2 ratification, demoting any future super_admin when count <= 3 should fail. Live test required when first super_admin gets demoted.

🟢 **CD-PROACTIVE-3** — Cross-admin notification: when Ruth grants admin to a new person, does that person see real-time notification on THEIR dashboard? Cross-notify is only spec'd for top-tier ceremony events. Worth verifying the candidate also sees a fresh-login welcome state.

🟡 **CD-PROACTIVE-4** — Roster pagination: not needed at MVP single-digit admin count, but worth a note. If admin count ever exceeds ~20, roster will need pagination.

🟢 **CD-PROACTIVE-5** — Sort tiebreaker: "Sorted by date added · oldest first" — if two admins have same `date_added`, what's the secondary sort? Verify deterministic ordering (e.g., by id ASC).

🔴 **CD-PROACTIVE-6** — Audit-action routing on consolidated page: F12 must wire the Invite affordance to the NEW `fn_invite_admin` flow (emitting `admin_invite_sent` audit), NOT the legacy `grant-admin.js` (emitting `super_admin_granted`). Critical to avoid audit drift after consolidation. Legacy break-glass path still emits legacy actions — that's fine.

### Block H — Rejected detail (post-F14 verification)

🟡 **H-PROACTIVE-1** — Historical rejected churches (3 pre-KAN-271 rows): `rejected_by=null`, `rejected_proposer_id=null`. UndergroundRejectedDetail must handle null gracefully — show `—` not literal "Rejected by null". Same in Rejected tab list view.

🟡 **H-PROACTIVE-2** — Realtime subscription on Rejected detail page: spec said NO subscription (terminal row). Verify actual implementation doesn't subscribe to `underground_detail_events` for rejected rows (small perf + cost concern).

🟡 **H-PROACTIVE-3** — Audit Notes log on Rejected detail: if old notes reference action keys that no longer exist (e.g., renamed during KAN-270), does the render gracefully handle unknown actions? Worth a quick null/fallback check in the audit-notes renderer.

### Block I + K — Inline-error + step-up (post-F14 verification)

🟡 **IK-PROACTIVE-1** — Add humanizer dictionary entries for ALL new error keys from F16+F19: `restore_already_in_flight`, `hard_delete_already_in_flight`, `admin_notes_too_short`, `step_up_required_for_proposal`, etc. Without these, errors fall through to raw text.

🟡 **IK-PROACTIVE-2** — Modal z-index stack after F16/F19: pre-proposal modals (HardDelete + Reinstate) — what z-index? Step-up at 2000, ConfirmProposalModal at 300, toast at 1000. Pre-proposal modal should sit between ConfirmProposalModal and toast (e.g., z=600). Verify step-up still overlays correctly when triggered from inside a pre-proposal modal.

### Block O — Audit log page

🟡 **O-PROACTIVE-1** — Audit Log page filter list: does it hardcode action keys for filter dropdowns? If yes, the 9 new actions from KAN-271 + F20 (admin_invite_sent, admin_grant_to_existing_user, admin_tier_promotion_requested/approved/denied/expired, admin_demote, admin_revoke, account_name_updated) won't appear in the filter. Code grep needed.

🟢 **O-PROACTIVE-2** — Display name resolution: audit rows store uuid; UI must hydrate to full_name. Verify the page handles the case where `accessed_by` user has been hard-deleted (PII-scrubbed) — should show "(deleted user)" or similar, not crash.

🟢 **O-PROACTIVE-3** — Timezone display: UTC vs local. Verify the page shows audit timestamps in a sensible TZ — UTC for consistency is safest in a multi-admin global product.

### System-wide proactive

🔴 **SYS-PROACTIVE-1 — JWT staleness on tier change**: when Ruth demotes a super_admin → regular, the demoted user's CURRENT JWT still carries super_admin claims until token refresh (~1h Supabase default). They could still act as super_admin in that window. Mitigation paths:
- (a) `auth.admin.invalidateRefreshTokens(userId)` immediately after demote/revoke (forces sign-out on next request)
- (b) Shorter JWT TTL (15min instead of 1h)
- (c) DB-side gate every action against current row state (not just JWT) — most expensive but bulletproof
Recommend (a) for MVP. F27 added to batch.

🟡 **SYS-PROACTIVE-2 — Realtime publication verification**: DBA verdict mentioned `admin_tier_promotions` added to publication. Verify the FE actually subscribes in `TierManagement.jsx` (post-F12: in the consolidated `TeamManagement.jsx`). Without subscription, cross-notify spec'd in ratification A-#5 won't fire live.

🟡 **SYS-PROACTIVE-3 — Email failure handling**: every Resend send (admin invite, grant, promotion approve/deny, restore initiate/confirm, hard-delete confirm) should have graceful error handling — log to Sentry, don't fail the underlying action. Verify all email-emitting endpoints follow this pattern. F20 placeholder copy already does this; verify across all senders.

🟡 **SYS-PROACTIVE-4 — Invited admin first sign-in flow**: After `fn_invite_admin` creates the row + sends Supabase invite, the invitee clicks the magic link → sets password → signs in. At first sign-in, do they cleanly hit TOTP enrollment (since `factorId === null` triggers it)? Verify the flow doesn't dump them on a non-Account page that requires AAL2 (which would lock them out). Recommend: invited admins land on `/account` on first sign-in so TOTP enrollment is the first thing they see.

🔴 **SYS-PROACTIVE-5 — F22 scope tightening**: silent-fire audit. Beyond Hard-delete + Reinstate, enumerate destructive-adjacent actions that need confirmation modals + step-up:
- `cancel-underground-proposal` — currently single-admin cancel; should it require step-up? Probably no (proposer cancelling own proposal is non-destructive).
- `underground-force-unmark-claim` — already has ForceUnmarkModal + step-up per shipped spec. Verify ✓.
- `grant-admin.js` (legacy break-glass) — verify step-up still gates this even after F12 consolidation makes it Overseer-only.
- `revoke-admin-tier.js` + `demote-admin.js` — verify step-up gated.
- `deny-admin-promotion.js` + `approve-admin-promotion.js` — verify step-up gated.
F22 should enumerate ALL handle* functions on Underground + Tier surfaces, NOT just Deactivated tab.

🟡 **SYS-PROACTIVE-6 — Mobile sign-in gate for replant_staff**: filed as follow-up KAN. Until that ships, any `replant_staff` invited admin who tries the mobile app gets stuck in church-selection onboarding. **Recommend Founder NOT invite admin-only people until the mobile gate ships**, OR document the mobile-broken state in the InviteAdminModal body copy so operators don't make promises.

🟢 **SYS-PROACTIVE-7 — Audit_log vs audit_log_underground split**: KAN-271 added new admin actions to `audit_log` (general). Underground actions remain in `audit_log_underground`. Architectural consistency: verify nothing accidentally writes admin-tier events to the underground audit table.

🟡 **SYS-PROACTIVE-8 — EvidenceUpload progress + completion + lockReason states**: BE+FE wave shipped these per spec but Founder hasn't tested. Add to verification queue post-batch — needs a live upload test on an underground church.

🟢 **SYS-PROACTIVE-9 — `is_underground_admin` field lifecycle**: currently set on Ruth + accounts@. No clear set-path documented in the consolidated Team Management. Should F12 expose this as a separate toggle (Overseer can grant `is_underground_admin` to any Super admin)? Worth a future-state ratification — for MVP probably skip and keep it seed-only.

🟢 **SYS-PROACTIVE-10 — Top-tier seed idempotency**: if the DB is migrated/restored, are Ruth + Replant Operations' `is_top_tier_admin=true` preserved by the migrations? Verify the seed migration is idempotent + survives restore. Probably fine but worth a comment.

### Batch fix list — additions from proactive sweep

| # | From | Fix | Lane |
|---|---|---|---|
| F26 | M-PROACTIVE-1 follow-up | Verify Inbox tab loads pending proposals post-F14; verify Founder's stale `c8a524f4` proposal can be cancelled before 72h expiry | FE verification + small fix if needed |
| F27 | SYS-PROACTIVE-1 | After demote / revoke / grant: call `auth.admin.invalidateRefreshTokens(target.auth_id)` to force token refresh. Prevents stale JWT acting as old tier for ~1h | BE |
| F28 | SYS-PROACTIVE-4 | Invited admin first-sign-in lands on `/account` (so TOTP enrollment is the first surface) | FE / routing |
| F29 | SYS-PROACTIVE-5 | F22 scope-tightening: enumerate ALL destructive-adjacent handlers across Underground + Tier surfaces. Audit for step-up + confirmation modals. Specifically verify: grant-admin (legacy), revoke-admin-tier, demote-admin, deny/approve-admin-promotion | FE/BE audit |
| F30 | CD-PROACTIVE-1 | Verify `fn_demote_admin` raises `no_self_demote` + `fn_revoke_admin` raises `no_self_revoke`. Add CHECK if missing | DBA |
| F31 | CD-PROACTIVE-6 | F12 consolidation must route Invite affordance to NEW `fn_invite_admin` flow, NOT legacy `grant-admin.js`. Legacy stays as break-glass only (Overseer-visible only) | FE wiring verification |
| F32 | IK-PROACTIVE-1 | Add humanizer dictionary entries for new error keys from F16/F19/restore/hard-delete flows | FE |
| F33 | H-PROACTIVE-1 | UndergroundRejectedDetail + Rejected tab list: handle null `rejected_by` / `rejected_proposer_id` gracefully (`—` not literal "null") | FE |
| F34 | B-PROACTIVE-1 | Reset TOTP recovery copy: if unenroll succeeds but re-enroll fails, surface a clear recovery message ("Old TOTP removed — re-enroll your authenticator app before signing out") | FE |
| F35 | A-PROACTIVE-1 | Identity-block name truncation: `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap` on `.rp-id-name`. Long full_names don't overflow the side nav | CSS |

---

---

## Block P — Founder's 2026-06-26 pre-UAT testing pass (post-deploy of 50a4167)

### P1 — `fn_invite_admin` RPC signature mismatch (BLOCKING invite flow)
**Symptom**: Invite admin modal shows: *"Could not find the function public.fn_invite_admin(p_auth_id, p_email, p_full_name) in the schema cache"*. Invite email still sent (auth.users created by step 3). User clicks the email's set-password link → succeeds → tries to sign in → "forbidden" (no `public.users` row exists because RPC failed; the user is half-created).
**Root cause** (verified live): RPC takes `(p_auth_id, p_email, p_first_name, p_last_name)` per migration 0030c. Endpoint `invite-admin.js:116-120` calls with `(p_email, p_full_name, p_auth_id)`. Postgres rejects (no matching overload).
**Status**: ✅ **PATCHED LOCALLY** (uncommitted). `invite-admin.js` now passes `p_first_name + p_last_name` correctly.
**Recovery for orphaned auth.users rows from prior failures**: any test invitees who got an auth row but no public.users row need either (a) deletion + re-invite, OR (b) backfill via `fn_invite_admin(auth_id, email, first, last)` directly. Founder ratification on which approach.

### P2 — `stale_aal2` raw error banner (voice violation)
**Symptom**: Rejected tab shows red banner with text *"stale_aal2"*. Same on other underground surfaces after TOTP freshness window expires.
**Root cause** (verified): F32 humanizer dictionary missed the AAL2 family entries entirely.
**Status**: ✅ **PATCHED LOCALLY**. Added to `error-routing.js`: `stale_aal2`, `no_aal2`, `aal2_expired`, `AAL2_REQUIRED`, `AAL2_EXPIRED`, `verification_failed`, `enrollment_missing`, `factor_revoked`. Plus evidence-upload error keys (`invalid_mime_type`, `invalid_size_bytes`, `evidence_intent_failed`, `evidence_confirm_failed`, `evidence_delete_failed`, `evidence_signed_put_url_mint_failed`) since those were also leaking raw. Plus SEC over-disclosure copy (`rls_denied`, `not_found`, `fk_violation`, `forbidden_underground_admin`).

### P3 — RPL-30067 in 3 tabs (Inbox + Rejected + Deactivated)
**Symptom**: Rejected church shows in BOTH Rejected (correct) AND Deactivated (wrong per Q3 Option A). Also Inbox (correct — has pending hard-delete proposal).
**Root cause** (verified): `fn_list_deactivated_underground` doesn't project `verification_status` — so the FE filter `r => r.verification_status !== 'rejected'` evaluates against `undefined` and is a no-op. F15 spec assumed the field was returned; it wasn't.
**Status**: ✅ **PATCHED LIVE** + **SOURCE-MIRRORED**. Migration 0036 applied (DROP+CREATE — adding column changes RETURNS TABLE shape). RPC now filters `verification_status != 'rejected'` server-side AND projects the column. Verified: post-patch, RPL-30067 is the only candidate matching `soft_deleted AND rejected` → now correctly hidden from Deactivated.

### P4 — Evidence packet doesn't populate after upload (BLOCKING upload visibility)
**Symptom**: Upload completes successfully (per banner). Evidence Packet section still shows *"No evidence recorded yet."* Evidence Files section shows *"No evidence files yet."*
**Root cause** (verified): `fn_list_pending_underground_queue` doesn't project `evidence_files` OR `evidence_used_mb`. FE reads `found.evidence_files` from list payload → always `undefined` → defaults to `[]`. Same for `evidence_used_mb` → always `0`. The `await reload()` after upload runs correctly, but the RPC return shape was never populated with these fields.
**Status**: ❌ **PENDING**. Needs DBA patch to extend the RPC's RETURNS TABLE with `evidence_files jsonb` + `evidence_used_mb numeric`, aggregated per church from `underground_evidence_files` (filtered to `confirmed_at IS NOT NULL` + `soft_deleted_at IS NULL`). Sum file sizes for `used_mb`. Adds 2 fields to ~40-col table; DROP+CREATE required for shape change.

### P5 — Storage used indicator stale (same root cause as P4)
**Symptom**: "0 MB of 250 MB" never increments after successful uploads.
**Root cause** (verified): same as P4 — `evidence_used_mb` not projected by list RPC.
**Status**: ❌ **PENDING**. Folds into P4 DBA patch.

### P6 — Duplicate `invalid_mime_type` banner
**Symptom**: Per screenshot, two identical red `invalid_mime_type` banners stacked above the drop zone.
**Root cause** (suspected — needs render-path investigation): probably the EvidenceUpload widget renders a per-file error AND the parent renders a duplicate via `evidenceError` state — both wired to the same error.
**Status**: ❌ **PENDING** investigation.

### P7 — Silent failure on re-add of same file
**Symptom**: After successful upload, attempting to attach the SAME file → nothing happens. File picker accepts the file but the drop-zone stays in empty state. No validation note, no toast, no error.
**Root cause** (suspected): file picker dedupe logic compares the staged file against the just-uploaded file by name + size, silently rejects. OR the staged-file state isn't cleared after a successful upload, so the SAME file is "already staged" → button stays disabled.
**Status**: ❌ **PENDING** investigation. Per Founder voice ruling: user MUST get feedback when an action is rejected — silent UX is a bug.

### P8 — No FE pre-validation for file type (round-trips server only)
**Symptom**: User selects an unsupported file → upload starts → server returns `invalid_mime_type` → banner shows. Should be caught client-side before round-trip.
**Status**: ❌ **PENDING**. FE patch to `EvidenceUpload.jsx`: validate `file.type` against the allowed-mime set BEFORE staging. Show inline error at the drop-zone. Locked allowed types: JPG, PNG, HEIC, WebP, PDF, MP3, M4A, DOCX.

### P9 — Upload UX uses banner pattern instead of CD spec
**Symptom**: "Uploading… please don't close this page. 0%" + "Upload complete." render as full-width banners ABOVE the drop zone. Founder: *"this banner as notification is ugly ui/ux, i dont like it. i thought only the top of page network issues got the banner and that was all."*
**Root cause** (per CD spec): CD's `EvidenceUpload` scaffold called for per-file progress bar AGAINST THE FILE ROW; success replaces drop-zone with brief confirmation; no banner. The shipped version uses a banner pattern.
**Status**: ❌ **PENDING**. FE rebuild of EvidenceUpload's progress + completion states to match CD spec exactly.

### P10 — "Forbidden" after set-password on orphaned invite (cascade of P1)
**Symptom**: Test invitee from P1's failed invite got an email, set password, signed in → "forbidden". Half-created user (auth.users row exists; public.users row missing).
**Root cause**: P1's RPC failure left auth row orphaned. App's tier gate fails because no `public.users` row → no admin_tier → "forbidden."
**Status**: ❌ **PENDING**. Two fixes:
1. Rollback on RPC fail: if step-4 RPC fails, call `auth.admin.deleteUser(authId)` to remove the orphaned auth row.
2. Recovery for existing orphaned rows: Founder ratifies — delete via auth.admin OR backfill via `fn_invite_admin(authId, email, first, last)`.

### P-PROACTIVE-1 — Auth row orphan resilience
**Same as P10 fix #1** but as a general pattern: every "create auth row → call RPC → handle RPC failure" path needs an explicit rollback step. Audit all such endpoints.

### Post-MVP items filed (NOT in this batch)
- **PMV-P1**: Upload multiple evidence files at once (currently one-at-a-time)
- **PMV-P2**: Expand supported file types (currently JPG/PNG/HEIC/WebP/PDF/MP3/M4A/DOCX)
- **PMV-P3**: After file is attached, replace drop-file box with file-name + checkmark indicator (cleaner per-file selection state)
- **PMV-P4**: "at rest by Supabase Storage" copy — Founder flagged as TMI; review during a future copy pass

---

## Local-only changes in this CC session (UNCOMMITTED)
- `netlify/functions/invite-admin.js` — P1 (RPC signature fix) + P10 (orphan rollback on RPC fail; both error + thrown paths)
- `src/lib/error-routing.js` — P2 humanizer dictionary additions (AAL2 family, evidence-upload error keys, SEC over-disclosure)
- `src/components/underground/EvidenceUpload.jsx` — P7 (clear input.value after each pick so re-add works) + P8 (FE pre-validation of allowed mime types with inline error)
- `src/screens/UndergroundDetail.jsx` — P6 (don't set both `evidenceError` AND `evidenceCompletion:{ok:false}` on failure → single banner)
- DBA: live migration 0036 + source-mirror at `/Users/ife/replant/supabase/migrations/20260626000001_kan271_0036_deactivated_excludes_rejected.sql` — P3 fix

## Live DB cleanup (done at Founder request)
- Deleted orphaned auth.users row `b85cc4b0-6c28-4f15-bbbc-bdfa1f5af7cd` (`ruthjames08+admin@gmail.com` / "Ife Atest") — orphan from P1's failed invite attempt. Zero orphans remaining.

## Pending (NOT yet patched — holding for Founder direction)
- **P4 + P5** — DBA RPC patch to extend `fn_list_pending_underground_queue` with `evidence_files jsonb` (aggregated from `underground_evidence_files` where `confirmed_at IS NOT NULL` AND `soft_deleted_at IS NULL`) + `evidence_used_mb numeric` (sum of file sizes). DROP+CREATE required for shape change. Holding because applying this changes live RPC behavior mid-test.
- **P9** — Evidence upload UX rebuild to CD per-row progress pattern (replaces banner-style "Uploading…" + "Upload complete." with per-file row affordance). Chunkier FE rewrite; holding for clean test cycle.

---

## Post-MVP items filed (NOT in this batch)

- [[postmvp-name-change-rate-limit]] — limit name edits to ~2/30 days
- [[postmvp-admin-mobile-app-access]] — walkthrough mode / shared test account for dashboard-only admins
- Mobile-side dashboard-only sign-in gate + `replant_staff` dropdown filtering (next follow-up KAN on mobile lane)
- Audit Log page: pagination + filter UI for large action counts (currently fine at small scale)
- Roster pagination on Team Management when admin count > ~20 (currently fine)
- `is_underground_admin` exposed as a separate manageable scope toggle on Team Management (currently seed-only)
