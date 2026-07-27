# Lucid System Map — Post-Audit Reconciliation (2026-07-02)

**What this is.** The apply-in-place instruction sheet for reconciling the Lucid system map (folder `Replant — System Map (2026-06-30)`, id `445090016`) to post-audit reality. Sources: pre-UAT audit §11 doc-drift list + [`docs/audits/_working/lucid-map-crosscheck.md`](../audits/_working/lucid-map-crosscheck.md) (2026-07-01) + the 2026-07-02 board audit ([gap analysis](../audits/2026-07-02-mvp-board-audit-gap-analysis.md)).

**Current state.** A companion **reconciliation page now lives INSIDE the Lucid folder** — [`RECONCILIATION 2026-07-02`](https://lucid.app/lucidchart/548cfdbd-a080-4d91-b511-50ee2833f4fc/edit) (doc id `548cfdbd-a080-4d91-b511-50ee2833f4fc`) — carrying every correction below as red/amber/green bands. Until the corrections are applied in place, that page overrides the affected docs.

**Why not applied in place.** The Lucid MCP connector's OAuth scope in the 2026-07-02 session (same as 2026-07-01) returns **403 on `lucid_edit_item`, `lucid_add_block`, and all comment endpoints for the pre-existing docs**. Document creation and `lucid_update_document` (rename/move) work. Two ways to close this out:

1. **Ruth applies by hand** in the Lucid UI from the list below (each item is a text edit or one added note box).
2. **A future session with content-edit scope** applies them surgically — item IDs and exact replacement text are below. Delete the reconciliation page (`548cfdbd-…`) once everything is applied.

---

## Doc 06.7 — Visibility-change call coordination (KAN-274)
`ab9b8008-cb83-4b9f-ad23-30210bd51200` · [edit](https://lucid.app/lucidchart/ab9b8008-cb83-4b9f-ad23-30210bd51200/edit)

**ADD a full-width red banner at the top of the page:**

> ⛔ NOT BUILT — ROADMAP · KAN-274 (To Do · RFC ratified 2026-06-27 · zero code on mobile/BE/schema, re-confirmed by board audit 2026-07-02). Everything on this page is design intent, not live. `fn_validate_relay_token` + the admin validate modal exist but are a dead chain — no flow ever writes `relay_token_hash`; 0 visibility_override proposals and 0 non-null hashes on prod.

(Sequence-diagram text is not searchable via the MCP — the banner is an added block, not an edit.)

## Doc 04 — Connect Tab + Underground Sub-flows
`a2db612c-0c43-427d-8abf-29460d46289b` · [edit](https://lucid.app/lucidchart/a2db612c-0c43-427d-8abf-29460d46289b/edit) — item IDs captured 2026-07-02:

1. **`sb126821a_16`** (KAN-274 section container, x1780 y1400): PREPEND to its text →
   `⛔ NOT BUILT — ROADMAP · KAN-274 (To Do · RFC ratified 2026-06-27 · zero code — board audit 2026-07-02)` and set the container border `stroke_style=dashed`.
2. **`sb126821a_21`** (UG Sub-flow invariants box): change the bullet
   `• 3-tier verification evidence (T1 referral · T2 live call · T3 photo w/ EXIF strip)` →
   `• 2-tier verification evidence LIVE (CHECK = t1_referral · t2_live_call) · T3 photo tier = ROADMAP (file infra only; CHECK extension + admin gate + proposal wiring unbuilt; own SEC panel — deferred 2026-06-27)`.
   Keep the following `Photo tier OFF…` bullet (it is the roadmap design).
3. **`sb126821a_13`** (NEW UG registrant-path box): after the line `immutable via app · admin change only` append →
   ` — ENFORCED at DB since 2026-07-02 (P0-2: client UPDATE on churches privilege columns REVOKED + guard trigger; rag_status is the only client-writable churches column)`.
4. **`sb126821a_7`** (Replant Team Inbox box): change `from Escalated Cases (7-day fallback)` →
   `from Escalated Cases (7-day email fallback NOT BUILT — KAN-296; reach-out DM itself live)`.

## Doc 08 — Verification Lifecycle end-to-end
`b56365d5-e3b5-471e-a7c2-93891c8f934e` · [edit](https://lucid.app/lucidchart/b56365d5-e3b5-471e-a7c2-93891c8f934e/edit)

**ADD one green annotation box** (the diagram content itself verified exact — do not change existing states):

> **Enforcement + cascade update (2026-07-02).** (1) The admin-only framing of every verified-transition write on this page is now DB-ENFORCED — P0-2 revoked client UPDATE on all privilege columns of `users` + `churches` (users re-granted 20 safe columns only) and added the `guard_users_privilege_cols` BEFORE-UPDATE trigger. On 2026-07-01 a verified leader could still self-write `verification_status` / `verified` / `church_code`; that gap is closed. (2) UG verify path: `fn_confirm_underground_proposal`'s verify branch now CASCADES verification to ALL non-deleted leaders of the church (un-strand fix, 2026-07-02). (3) The 4 anon signup RPCs rate-limit FAIL-CLOSED (503 on Upstash outage).

## Doc 06.5 — Admin tier promotion (Sponsor + Manager-approve)
`52649f8c-089f-4bda-811d-b9b1a53c053f` · [edit](https://lucid.app/lucidchart/52649f8c-089f-4bda-811d-b9b1a53c053f/edit)

1. **Fix the gate string**: the `request-admin-promotion` sequence step reads `assertAtLeast("super_admin")`, contradicting the actor label `Sponsor (super_admin or Manager)` and the locked ruling (Managers MAY sponsor). Reconcile the step text to the actor label. (String lives in sequence-message text — not MCP-searchable; find it on the request step.)
2. **ADD an annotation box**:
   > `is_top_tier_admin` is COLUMN-authoritative (`public.users`) + hook-derived — `custom_access_token_hook` re-mints the JWT claim from the column on every token mint, so the UG dual-source drift class cannot occur here. NO promote-to-Manager path exists at MVP (seed-only; `fn_demote_admin`/`fn_revoke_admin` RAISE on Manager targets). Any future promote path MUST dual-write column + `raw_app_meta_data.admin_tier` per the KAN-284 template. P0-2 (2026-07-02) locked the column from client write.

## Doc 05 — Admin Dashboard Surfaces + Tier Access Matrix
`20e9d9ea-05ba-4724-b0ad-54bdea453759` · [edit](https://lucid.app/lucidchart/20e9d9ea-05ba-4724-b0ad-54bdea453759/edit)

1. **Fix the Escalated Cases state list**: `5-state case machine — open · awaiting · replied · pending_proposal · closed` →
   `6-state case machine (CHECK) — open · awaiting · replied · pending_proposal · manager_review · closed. manager_review live in prod rows (KAN-292 M10, 4 NOT-NULL companion columns); awaiting CHECK-legal but unused in live rows.`
2. **ADD near the tier matrix**: `Ceremonies this matrix asserts are DB-enforced since P0-2 (2026-07-02) — privilege columns (is_top_tier_admin · is_underground_admin · role · verification_status · church_id · is_active · auth_id) are no longer client-writable.`

## Doc 11 — Realtime + Notification Stack Architecture
`550e56a1-3253-49e4-a2ac-05d8b7fa5ec7` · [edit](https://lucid.app/lucidchart/550e56a1-3253-49e4-a2ac-05d8b7fa5ec7/edit)

1. **Remove `conversations` from the published-tables list** (it appears in the `conversations · branches · branch_members · connection_requests — All in supabase_realtime pub` group and in the RLS matrix). Live publication = 7 tables: `admin_tier_promotions · branch_members · branches · connection_requests · messages · underground_admin_inbox_events · underground_detail_events`.
2. Move `conversations` to the polling/on-focus column; attribute thread-list reordering to `messages` INSERT (which IS published), not `conversations` UPDATE broadcasts.

## Doc 00 — System Architecture Overview
`470b362d-a4af-42f7-a3a3-6277f69cd3f9` · [edit](https://lucid.app/lucidchart/470b362d-a4af-42f7-a3a3-6277f69cd3f9/edit)

**EXTEND the `Upstash Redis` block** (currently `rate-limit token bucket…`):

> 9 functions ride Upstash (anon-RPC rate limits · idempotency replay cache · step-up token cache · AAL2 audit dedupe). Since 2026-07-02 the 4 anon signup RPCs FAIL CLOSED (503) on an Upstash outage; not-configured local dev stays fail-open; `join-underground-church` carries an in-memory token-bucket fallback. ⚠ Upstash free DBs auto-delete on inactivity — the April 2026 DB silently died (rate limiting non-functional platform-wide) until re-provisioned 2026-07-02 (us-east-1). If rate limiting misbehaves, check the Upstash console FIRST.

---

*Once every correction above is applied in place, delete the reconciliation page (`548cfdbd-a080-4d91-b511-50ee2833f4fc`) and remove the pending-corrections banner from the README. In Jesus' name.*
