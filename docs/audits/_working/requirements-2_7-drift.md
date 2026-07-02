# Requirements Doc v2.7 (internal v4.0) — Drift Audit vs Live State

**Audited file:** `/Users/ife/replant/docs/replant-requirements-v2_7.html`
**Audit date:** 2026-07-01 · **Auditor:** BA (pre-UAT audit, read-only)
**Doc's own latest content date:** 2026-06-18 (title says "v4.0"; filename says `v2_7`; header changelogs run v2.6→v4.0 out of order)

> **Framing.** The doc has strong coverage of everything **up to 2026-06-18** (atomic signup v6, Connect, Prayer Wall, Persecuted multipage, admin dashboard through KAN-220). The drift is almost entirely **post-2026-06-18 workstream that the doc has zero rows for**: the admin 3-tier RBAC + access matrix, the Overseer→Manager rename, `escalated_cases`, the underground join-code / second-leader join, `para_ministry` in the *canonical* enum tables, and the Content Section architecture. Live schema facts were re-confirmed against `jiyetphxxvyiicrnwlnx` on 2026-07-01 (15 edge fns; `church_type` 7-value enum; `evidence_tier` CHECK; `escalated_cases.state` CHECK; UG join-code columns; admin tier columns).

---

## PRIORITY DELTAS — doc describes a SAFER posture than the code enforces

These are the ones to fix first. In each case a reader trusting the doc would believe a protection exists (or is stronger) than what ships.

### P-1 — Admin access is described as "super-admin only" everywhere; live code has a 3-tier model where **regular admins** can read Verification / Pastoral / Flagged / Content
- **Doc says:** Global Rules row — *"Admin dashboard … Super-admin only."* Admin Dashboard intro — *"Super-admin only."* Screen 00 — *"No self-registration"* + super_admin JWT claim as the sole gate. Every admin screen is implicitly "any admin = super_admin."
- **Live:** three tiers — `regular` / `manager` (DB enum `top_tier`) / `super_admin`. Locked access matrix (2026-06-30): Verification / Pastoral / Flagged / Content = **all admins including regular**; Heartcry / Underground / Team = super_admin + manager only; approve-promotion = **manager only** (super_admin NEVER approves). Enforced via `users.role` + `is_top_tier_admin` / `is_underground_admin` **column-authoritative** checks (`fn_assert_top_tier_admin`, `fn_assert_underground_admin`), not a single super_admin boolean.
- **Why it's a safety delta:** the doc understates *who can read leader data*. A reader would assume only the founder-tier sees any admin surface; in reality a regular admin can open Flagged Messages (DM content) and the Verification Queue (leader PII). The access boundary that actually protects leaders is the tier matrix, and it is undocumented.

### P-2 — Heartcry Inbox + Underground Oversight documented as plain "super-admin" gated; live gate is **super_admin + manager**, and the matrix — not a single role — is the control
- **Doc says:** Screen 02 (Underground Oversight) and Screen 03 (Heartcry Inbox) describe AAL2/TOTP step-up but frame the *authorization* as super-admin-only.
- **Live:** these are the "elevated" surfaces — super_admin **and** manager can read them; regular admins are locked out. This is a *different* boundary than "super-admin only" and than the "all admins" surfaces in P-1.
- **Why it matters:** the doc neither documents that a manager (non-founder) can decrypt heartcries and read underground oversight, nor that regular admins cannot. Both halves are load-bearing for a persecuted-leader threat model.

### P-3 — Underground protection: doc omits the **second-leader join-code** surface entirely (a new way a second person gets inside an underground church's private space)
- **Doc says:** Underground churches — 2-leader cap via generic `LEADER_CAP_EXCEEDED`; nothing about join codes. The only join path documented is name/RPL-ID search (ASP2), which by design cannot surface underground churches.
- **Live:** `reveal-join-code` + `join-underground-church` edge functions are live; `churches` carries `underground_join_code_hash`, `underground_join_code_issued_at`, `underground_join_code_revealed_at`, `underground_join_code_rotated_at`. A second leader joins an underground church by code (since it never appears in search). This is a genuine security-relevant flow (code issuance / reveal / rotation) that the doc does not describe at all.
- **Why it matters:** the mechanism by which a second identity enters an underground church's protected space is undocumented — exactly the kind of surface a safety review must see.

### P-4 — Message-flag taxonomy count stated as "17 auto + 3 manual = 20"; **live self_harm + pastoral_care_signal are pastoral-routed**, and the doc's own body already contradicts its summary
- **Doc says:** D-45 clause 2 and the Post-MVP rows say *"17-code `auto:` + 3-code `manual:`-only"* (=20). But the Connect Screen-18 flagging body **and** D-46 enumerate 6+3+6 admin auto (15) **+ 2 pastoral auto** (`self_harm`, `pastoral_care_signal`) + 3 manual = 20, where the 2 pastoral codes route to a **separate pastoral-care queue (KAN-125), not the Heartcry inbox**.
- **Why it matters:** "17 auto" blurs the pastoral-routing split. `self_harm` routing to a pastoral surface distinct from admin moderation is a safety-of-life design decision; the summary line hides it. Not "code less safe than doc," but the doc is internally inconsistent on a life-safety routing rule — reconcile to the D-46 body.

---

## STRUCTURAL DELTAS — features shipped since the doc was frozen (no rows exist)

### D-A — `escalated_cases` 6-state machine — **entirely absent**
- **Live:** `escalated_cases` table with `state text` CHECK = `open · awaiting · replied · pending_proposal · manager_review · closed` (6 states; **not** a named enum — plain text column with a CHECK). Companion `escalated_case_proposals` (propose/approve mirror of the UG flow) with `category`, `proposal_status`, `approver_id`, `expires_at`. Migrations live (KAN-292/293/295/296), PR #71 merged. M11 auto-flips `awaiting → replied` on leader reply; M10 adds `manager_review` state + metadata. Reach Out via Connect DM with 7-day auto-email fallback; "Admin Name from Replant Team" attribution.
- **Jira caveat (per CLAUDE.md live-Jira rule):** KAN-292/293/295/296 are described as *still Backlog* in Jira despite merged code — do **not** cite them as Done in the doc; cite the migration/PR state.
- **Doc has:** nothing. Admin dashboard is still an 11-screen (00–11) list; there is no escalation-workflow surface.

### D-B — Overseer → **Manager** rename (display-wide, 2026-06-30) — not reflected
- **Live:** "Manager" replaced "Overseer" as the display name for DB enum value `top_tier`, everywhere in the dashboard. DB enum value unchanged (`top_tier`).
- **Doc has:** no "Overseer" or "Manager" terminology at all (predates the tier UI), so this lands as *new content to add*, not a find-replace. Note the enum-value-vs-display-name distinction explicitly so no one "fixes" the DB.

### D-C — `para_ministry` church type missing from the **canonical** enum tables (present only in D-51 and an "IN FLIGHT" note)
- **Live:** `church_type` enum = `main_campus, branch, house_church, ministry, without_walls, underground, para_ministry` (**7 values**, confirmed live).
- **Doc says:** Global Rules enum table (§01) lists **6**; Screen 09 "Church Types (6)" lists 6; RegCP1 field list lists 6; BA-Flags item #3 asserts *"canonical enum is 6 types … This is final."* Only D-51 (Verification Queue) and the §03 "IN FLIGHT" note acknowledge para_ministry.
- **Delta:** the doc's *canonical* church-type references are stale at 6. `para_ministry` shipped (enum migration + downstream). BA-Flags #3's "6 types … final" is now wrong.

### D-D — Branch as a first-class church type + branch registration flow — under-documented as a church type
- **Live:** branch church type shipped; branches excluded from similar-church matching (§05b already covers *this* correctly). Connect "branches" (group threads) are well documented. But the *church-type* "Church (Branch)" is inside the stale 6-enum tables (see D-C).
- **Delta:** minor — folds into D-C. The Connect-branch content is current; only the church-type enum table is stale.

### D-E — KAN-213 Church Profile Setup Flow — doc doesn't state it is **non-underground only**
- **Live:** Church profile setup flow (KAN-213) is **non-underground only** (audit-confirmed). Underground excluded from the type picker; `update_leader_role` RPC hard-rejects underground.
- **Doc says:** §05 + Founder-Answers describe KAN-213 rulings (AC14/AC15/AC2) and note "Underground excluded from picker — RPC hard-rejects it" in the *resolved founder Q*, but the **screen-level spec** and Global Rules never state the flow is non-underground-scoped. Partial coverage; make the scope explicit.

### D-F — KAN-274 UG visibility-flip — **spec'd but UNBUILT on mobile**; doc has no row at all
- **Live:** KAN-274 (underground visibility flip) is specified but **not built** on mobile.
- **Doc has:** nothing — no forward-track row, no Open-Gaps row. Should be added as an explicit "spec'd, unbuilt" item so it isn't assumed shipped.

### D-G — Content Section architecture (2026-07-01 lock) — absent
- **Live:** shared Content Section pattern (tabs / collapse / multi-select / publish-lock / filters / pagination-10) + Announcements 4-col reconciliation + Scripture theme + Outreach phased. Content = an all-admin surface per the access matrix.
- **Doc has:** Announcements exists as Screen 08 only; no "Content Section" umbrella. New content.

---

## LOWER-PRIORITY / HOUSEKEEPING DELTAS

- **H-1 — Edge-function count.** Doc references functions piecemeal; live = **15** edge functions (`accept-connection-request, admin-open-heartcry, auth-status-check, check-email-available, create-account, get-nearby-churches, join-underground-church, register-church, register-church-delete, reveal-join-code, search-churches, send-branch-message, send-message, submit-heartcry, update-church`). `register-church-delete`, `reveal-join-code`, `join-underground-church` are new since the doc. (`_shared` is a lib dir, not a function.)
- **H-2 — Function versions drifted.** Doc: `create-account` v6, `register-church` v7, `auth-status-check` v7. Live: `create-account` **v8**, `register-church` **v8**, `auth-status-check` **v9**. The v6/v7 *architecture* description is still accurate; only the version integers are stale. (Flag lightly — versions churn.)
- **H-3 — Admin screen count.** Doc: "11 screens" (00–11). Live adds escalation-workflow + Content Section surfaces. The "11 screens / super-admin only" line in §01 is doubly stale (count + tier).
- **H-4 — Audit action count.** Doc: **47** canonical actions (as of KAN-220). Escalated-cases + manager-review + Content work almost certainly added actions since; **verify `audit_log_action_check` live before re-citing 47** (doc's own standing instruction). Not independently re-counted in this audit.
- **H-5 — T3 UG evidence tier.** Doc never mentions evidence tiers (they're an admin-verification concept newer than the doc). Live `evidence_tier` CHECK accepts only `t1_referral` + `t2_live_call` — **T3 photo is DEFERRED / not in schema**. If evidence-tier language is ever added, it must say 2-tier, not 3.
- **H-6 — `verify_jwt` postures still accurate.** Live confirms `auth-status-check` = true; `create-account` / `register-church` / `check-email-available` / `search-churches` / `register-church-delete` / `join-underground-church` = false. Doc's load-bearing `verify_jwt` claims hold. No change needed (noted so it isn't "fixed" by mistake).
- **H-7 — KAN-213 "pending Founder device pass on Account B."** Doc repeats this in ~3 places. Account B is now `b8f4657c / Blessings Abound` per current memory (doc variously says "What A God Ministries" `236719c3` and "Blessings Abound"); verify current test-account identity before re-citing.

---

# PASTE-READY DELTA BLOCKS

Each block is written to drop into the named section. HTML matches the doc's existing class conventions (`decision-block`, `tag`, `flag`, table rows). Ruth: reconcile against live Jira before locking ticket cites (CLAUDE.md standing rule).

---

## For §01 Global Rules — replace the stale "Admin dashboard" + church-type enum rows

**(a) Replace the `Admin dashboard` row:**

```html
<tr><td>Admin dashboard — tiered access</td><td>Separate web deployment at <code>admin.projectreplant.org</code>. Not part of the React Native app. <strong>Three admin tiers</strong> (locked 2026-06-30): <code>regular</code> · <code>manager</code> (display name for DB enum value <code>top_tier</code>) · <code>super_admin</code>. Access is enforced <strong>column-authoritatively</strong> via <code>users.role</code> + <code>is_top_tier_admin</code> / <code>is_underground_admin</code> (functions <code>fn_assert_top_tier_admin</code>, <code>fn_assert_underground_admin</code>) — NOT a single super_admin boolean. Access matrix: Verification / Pastoral / Flagged / Content = <strong>all admins</strong>; Heartcry / Underground / Team = <strong>super_admin + manager</strong>; approve-promotion = <strong>manager ONLY</strong> (super_admin never approves). "Manager" replaced "Overseer" display-wide 2026-06-30; the DB enum value <code>top_tier</code> is unchanged.</td><td>Admin tier access matrix (locked 2026-06-30)</td></tr>
```

**(b) Replace the church-type enum sub-table (add `para_ministry`, correct "6" to "7"):**

```html
<table style="width:100%;font-size:0.76rem;">
  <tr><th>DB enum value</th><th>UI display name</th></tr>
  <tr><td><code>main_campus</code></td><td>Church (Main Campus)</td></tr>
  <tr><td><code>branch</code></td><td>Church (Branch)</td></tr>
  <tr><td><code>house_church</code></td><td>House Church</td></tr>
  <tr><td><code>ministry</code></td><td>Ministry</td></tr>
  <tr><td><code>without_walls</code></td><td>Church Without Walls</td></tr>
  <tr><td><code>underground</code></td><td>Underground Church</td></tr>
  <tr><td><code>para_ministry</code></td><td>Para Ministry</td></tr>
</table>
<p class="note">Canonical <code>church_type</code> enum = <strong>7 values</strong> (verified live 2026-07-01). <code>para_ministry</code> shipped via enum migration + downstream. Supersedes the earlier "6 types, final" BA-Flags note.</p>
```

**(c) Add a new Global Rules row for the underground join-code surface:**

```html
<tr><td>Underground second-leader join code</td><td>Underground churches never appear in name/RPL-ID search, so a second leader joins via a <strong>join code</strong>. Code is stored hashed (<code>churches.underground_join_code_hash</code>) with issuance / reveal / rotation timestamps (<code>underground_join_code_issued_at</code>, <code>_revealed_at</code>, <code>_rotated_at</code>). Edge functions <code>reveal-join-code</code> (verify_jwt=true) + <code>join-underground-church</code> (verify_jwt=false) govern reveal and redemption. 2-leader cap still enforced.</td><td>Underground signup spec · reveal-join-code / join-underground-church</td></tr>
```

---

## For §13 Admin Dashboard — new tier model + escalation workflow + Content Section

**(a) Replace the intro paragraph's "Super-admin only." with:**

```html
<p style="margin-bottom:1.2rem;font-size:0.82rem;">Separate web deployment — not part of the React Native app. Hosted at <code>admin.projectreplant.org</code>. <strong>Three-tier RBAC (locked 2026-06-30):</strong> regular / manager (display name for DB enum <code>top_tier</code>) / super_admin. Screen visibility follows the access matrix — Verification / Pastoral / Flagged / Content = all admins; Heartcry / Underground / Team = super_admin + manager; approve-promotion ceremony = manager only (1 sponsor + 1 manager; super_admin never approves). Tiers are column-authoritative (<code>fn_assert_top_tier_admin</code> / <code>fn_assert_underground_admin</code>), not a lone super_admin JWT boolean. "Manager" replaced "Overseer" display-wide 2026-06-30 (DB enum value unchanged).</p>
```

**(b) New decision block for the escalation workflow (place after the screen table):**

```html
<div class="decision-block closed">
  <div class="decision-label closed">Locked — Escalated Cases workflow (2026-06-30)</div>
  <div class="decision-title">Escalated Cases — 6-state machine + propose/approve mirror</div>
  <div class="decision-body">
    <p><code>escalated_cases.state</code> (text + CHECK, not a named enum) = <code>open · awaiting · replied · pending_proposal · manager_review · closed</code> (6 states). Companion <code>escalated_case_proposals</code> mirrors the underground propose/approve flow (<code>category</code>, <code>proposal_status</code>, <code>approver_id</code>, <code>expires_at</code>). 3-tier visibility: regulars are <strong>locked out post-escalation</strong> (anti-gossip). Reach Out delivered via Connect DM with a 7-day auto-email fallback; attribution "Admin Name from Replant Team". <code>manager_review</code> requires category + reasoning + reviewer metadata. Leader reply auto-flips <code>awaiting → replied</code>.</p>
    <p class="note">Migrations live (KAN-292/293/295/296); PR #71 merged. <strong>Jira status still Backlog</strong> for these keys as of this audit — cite migration/PR state, not "Done", until live Jira confirms transition.</p>
  </div>
</div>
```

**(c) New decision block for the Content Section:**

```html
<div class="decision-block closed">
  <div class="decision-label closed">Locked — Content Section architecture (2026-07-01)</div>
  <div class="decision-title">Content Section — shared admin pattern (all-admin surface)</div>
  <div class="decision-body">Shared pattern across content surfaces: tabs · collapse · multi-select · publish-lock · filters · pagination-10. Announcements reconciled to a 4-column layout; Scripture themed; Outreach phased. Content is an <strong>all-admin</strong> surface per the access matrix. Screen 08 (Network Announcements) is absorbed under this umbrella.</div>
</div>
```

---

## For §14 All Founder Decisions — new rows (append after D-64)

```html
<tr><td>D-65</td><td>Admin 3-tier RBAC + access matrix (locked 2026-06-30)</td><td>Three tiers: regular / manager (<code>top_tier</code> display name) / super_admin. Verification/Pastoral/Flagged/Content = all admins; Heartcry/Underground/Team = super_admin+manager; approve-promotion = manager only, super_admin never approves. Column-authoritative enforcement.</td><td>30 Jun</td></tr>
<tr><td>D-66</td><td>Overseer → Manager display rename (2026-06-30)</td><td>"Manager" replaces "Overseer" as the display name for DB enum value <code>top_tier</code>, display-wide. DB enum value unchanged. Never refer to "the other Manager".</td><td>30 Jun</td></tr>
<tr><td>D-67</td><td>Escalated Cases — 6-state machine + propose/approve mirror + anti-gossip lockout</td><td>States: open/awaiting/replied/pending_proposal/manager_review/closed. Regulars locked out post-escalation. Reach Out via Connect DM + 7-day email fallback. KAN-292/293/295/296 (migrations live, PR #71 merged; Jira Backlog).</td><td>30 Jun</td></tr>
<tr><td>D-68</td><td><code>para_ministry</code> church type shipped</td><td><code>church_type</code> enum extended to 7 values. Downstream: Verification Queue filter (D-51), registration picker, similar-church matching. Supersedes BA-Flags "6 types final".</td><td>—</td></tr>
<tr><td>D-69</td><td>Underground second-leader join via join code</td><td>Underground churches unsearchable → second leader joins by hashed join code (issue / reveal / rotate). <code>reveal-join-code</code> + <code>join-underground-church</code> edge functions. 2-leader cap preserved.</td><td>—</td></tr>
<tr><td>D-70</td><td>KAN-213 Church Profile Setup Flow is non-underground only</td><td>Underground churches excluded from the profile-completion flow and the type picker; <code>update_leader_role</code> RPC hard-rejects underground.</td><td>—</td></tr>
```

---

## For §16 Open Gaps — new rows

```html
<tr><td>KAN-274 — Underground visibility flip (mobile)</td><td><span class="tag tag-amber">Spec'd — UNBUILT</span></td><td>FE</td><td>UG visibility-flip is specified but not built on mobile. Do not assume shipped.</td></tr>
<tr><td>Escalated Cases — Jira transition lag</td><td><span class="tag tag-amber">Code merged / Jira Backlog</span></td><td>SM</td><td>KAN-292/293/295/296 migrations live + PR #71 merged, but Jira tickets still show Backlog. Reconcile Jira status.</td></tr>
```

---

## For §01 Global Rules — correct the flag-taxonomy internal inconsistency (reconcile summary to D-46 body)

Wherever the doc says the taxonomy is *"17-code `auto:` + 3-code `manual:`"* (D-45 clause 2; two Post-MVP rows), replace with:

```html
20-code taxonomy: <strong>15 admin-routed <code>auto:</code></strong> (Tier 1 persecution ×6, Tier 2 doctrinal ×3, Tier 3 moderation ×6) + <strong>2 pastoral-routed <code>auto:</code></strong> (<code>self_harm</code>, <code>pastoral_care_signal</code> → separate pastoral-care queue, KAN-125, distinct from Heartcry inbox) + <strong>3 <code>manual:</code>-only</strong> (<code>idolatry_promotion</code>, <code>occult_reference</code>, <code>drunkenness</code>). The "17 auto" phrasing conflated the 2 pastoral codes into the admin count — the pastoral-routing split is load-bearing (life-safety) and must stay explicit.
```

---

## Verification appendix (live facts re-confirmed 2026-07-01, project `jiyetphxxvyiicrnwlnx`)

| Fact | Live value |
|---|---|
| `church_type` enum | `main_campus, branch, house_church, ministry, without_walls, underground, para_ministry` (7) |
| `escalated_cases.state` | text + CHECK: `open, awaiting, replied, pending_proposal, manager_review, closed` (6) |
| `escalated_case_proposals` | exists; cols incl. `category, proposal_status, approver_id, expires_at` |
| `evidence_tier` CHECK | `t1_referral, t2_live_call` only (T3 DEFERRED) |
| admin tier columns (`public.users`) | `role`, `is_top_tier_admin`, `is_underground_admin` (no `admin_role` enum; no `manager`/`overseer` enum label) |
| UG join-code columns (`churches`) | `underground_join_code_hash, _issued_at, _revealed_at, _rotated_at`, `show_church_name` |
| edge functions | 15 (see H-1) |
| function versions | `create-account` v8, `register-church` v8, `auth-status-check` v9 |
