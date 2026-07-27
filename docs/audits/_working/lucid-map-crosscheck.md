# Lucid System-Map ↔ Code/Schema Cross-Check

**Audit date:** 2026-07-01
**Auditor role:** Senior systems architect, Replant pre-UAT audit (READ-ONLY)
**Lucid folder:** `Replant — System Map (2026-06-30)` (id `445090016`, 18 diagrams)
**Live schema ref:** Supabase `jiyetphxxvyiicrnwlnx`, pulled 2026-07-01
**Scope note:** Prioritized the security/safety-critical diagrams (01, 04, 05, 06.5, 06.7, 08, 10, 11). Diagrams 00, 02, 03, 06.1–06.4, 06.6, 07, 09 were not fetched in full this pass (00/02/03 Realtime overstatement is already-known drift, self-corrected inside doc 11).

Legend: **MATCHES** = diagram agrees with live code/schema · **DRIFT** = diagram disagrees with live · severity = does the drift mislead a future builder into a safety mistake.

---

## TOP-LINE: the finding that matters most (safety-critical)

**A verified leader can self-elevate and self-verify via direct PostgREST — and this contradicts the "admin-only" invariants asserted by diagrams 04, 05, 08, and 10.**

This is a live schema/RLS posture finding (generalizes audit fact (e), "a schema gap lets leaders self-verify"). It is not drift *inside* one diagram, but it makes the "admin-gated" framing across four security diagrams misleading to anyone who trusts the map. Evidence, all live 2026-07-01:

- `public.users` has RLS enabled, but the only write policy is
  `users_update_own` — `USING/WITH CHECK = (auth.uid() = auth_id AND is_active AND soft_deleted_at IS NULL)`.
  **No column-level restriction in the policy.**
- Table-level `UPDATE` on `public.users` is granted to **both `authenticated` and `anon`**.
- Column-level `UPDATE` is *additionally* granted to `authenticated` **and `anon`** on:
  `verification_status`, `verification_deadline`, `role`, `is_top_tier_admin`, `is_underground_admin`.
- Only trigger on `users` is `enforce_leader_cap` (BEFORE) — a member-count guard, **not** a privilege guard.

Consequence: a leader whose JWT satisfies the row predicate (verified, active) can issue
`UPDATE users SET is_top_tier_admin=true, is_underground_admin=true, verification_status='verified' WHERE auth_id=auth.uid()`
directly against PostgREST. `is_underground_admin` and `is_top_tier_admin` are **column-authoritative** for their gate functions (`fn_assert_underground_admin()` reads the column per `ug_flag_dual_source_bug`; top_tier column feeds the JWT hook), so writing the column is a real tier grant, not cosmetic. (`role` enum has no `super_admin` value — its members are ministry roles + `replant_staff` — so the `role` grant is the *least* dangerous of the five; the two boolean admin columns are the severe ones.)

**`public.churches` has the identical open surface, and it is reachable by a verified leader:**
- `churches_update_own` — `USING = id IN (SELECT church_id FROM users WHERE auth_id=auth.uid() AND is_active AND verification_status='verified')`, **`WITH CHECK` = none**.
- Column `UPDATE` granted to `authenticated` **and `anon`** on: `verified`, `verification_status`, `show_church_name`, `rag_status`, `type`, `city`, `church_code`.

Consequence: a **verified** leader can `UPDATE` their own church row to set `verified=true`, mint their own `church_code` (RPL ID), flip `type` off `underground`, set `city`, or **flip `show_church_name`** — the exact underground name-hiding flag that diagram 04 labels *"immutable via app · admin change only"* and that KAN-274's whole ceremony (docs 04, 06.7) exists to gate behind an admin-mediated safety call.

The `anon` grants are largely inert in practice (both `_update_own` policies require a matching authenticated user row via `auth.uid()`), so the realistic actor is a **verified authenticated leader**, not a pre-auth anon. First real leaders are live (2026-06-28), so "build-mode" assumptions no longer cover this.

**Why it's a map problem, not just a schema problem:** diagrams 08 ("users.verification_status='verified' ... on transition" driven by admin verify; "RPL ID assigned ONLY on transition to verified"), 05 (tier matrix: promotion is a 2-person `no_self_approve` ceremony), 04 (`show_church_name` immutable via app), and 10 (UG protections) all present these state changes as admin-exclusive. A builder trusting the map would not know the DB currently lets the subject write them directly. **This should be routed to a SEC+DBA panel as a pre-UAT blocker** (column-scope the grants / add `WITH CHECK` column guards / revoke the direct UPDATE and force writes through the audited edge functions). It is outside the "diagram drift" remit but is the single most important thing this cross-check surfaced.

---

## Per-diagram results

### 01 — Mobile Onboarding + Auth Flow — **MATCHES (no new drift)**
Flow, edge-function names, and invariants line up with the auth/onboarding code contracts (`create-account v8`, `auth-status-check v9`, `join-underground-church v2`, `verify_jwt=false` only on pre-auth fns, UG `rag_status` forced red + city/lat/lng stripped, `show_church_name` default false, dual-ID `auth_id ≠ users.id`). Verification is correctly shown as an **admin-gated status resolved by `auth-status-check`** — the diagram does **not** depict leader self-service verification, so it does not *cause* the top-line regression. Note only: the top-line self-write surface is invisible here because this diagram is scoped to the happy-path signup, which is legitimately server-mediated.

### 04 — Connect Tab + Underground Sub-flows — **DRIFT ×3**
1. **KNOWN (confirmed, as documented):** UG invariants box says *"3-tier verification evidence (T1 · T2 · T3 photo w/ EXIF strip)"*. Live `evidence_tier` CHECK = `(t1_referral | t2_live_call)` only — **T3 not live**. Severity: medium — misleads a builder into thinking a photo-evidence tier exists. (Doc 10 internally corrects this; doc 04 was never updated.)
2. **NEW — safety-relevant:** the KAN-274 visibility-flip block (group_5/7/9) draws the full relay flow — `schedule-visibility-flip`, silent T-15m data push, `VisibilityChangeLobbyScreen`, `FirstCallSafetyBriefing`, duress code — with **no "roadmap/unbuilt" marker**. Per audit fact (f) this is **UNBUILT on mobile**; live schema has **zero** KAN-274 tables (`SELECT ... WHERE tablename ILIKE '%visibility%'|'%relay%'` → none). A builder would assume the endpoints/tables exist. Severity: medium-high (safety feature presented as live).
3. **NEW — contradicted by live grants:** the NEW-UG box asserts `churches.show_church_name` is *"immutable via app · admin change only."* Live `churches_update_own` RLS + column grant let a **verified** UG leader flip `show_church_name` directly (see top-line). Severity: **high** — this is the underground name-hiding flag; the diagram tells a builder it's protected when it isn't.

### 05 — Admin Dashboard Surfaces + Tier Access Matrix — **DRIFT ×1 (known) + strong matches**
- **KNOWN (confirmed, and slightly worse than "5-vs-6"):** the EscalatedCases block says *"5-state case machine — open · awaiting · replied · pending_proposal · closed."* Live `escalated_cases.state` CHECK = **6 values**: `open, awaiting, replied, pending_proposal, manager_review, closed`. The diagram both **omits `manager_review`** (the real 6th, added by the KAN-292 M10 migration) **and** still lists `awaiting`. `manager_review` is not just CHECK-legal — it is present in live rows (`SELECT DISTINCT state` returns `closed, manager_review, open, pending_proposal, replied`). Severity: medium — a builder wiring the case UI off this list would miss the `manager_review` state and its four NOT-NULL companion columns (`manager_review_by_user_id/_at/_category/_reasoning`, enforced by CHECK).
- **MATCHES (verified against live):** tier vocabulary `regular / Manager (top_tier) / super_admin`; "Approve Admin Promotion — Manager ONLY, super_admin never"; `no_self_approve` / `no_self_sponsor` CHECKs on `admin_tier_promotions` exist; `ecp_no_self_approve` CHECK on `escalated_case_proposals` exists; `is_underground_admin` dual-source note; audit-first + `audit_log_underground` stricter RLS. This matrix is accurate and load-bearing — keep it. (One caveat: it too frames verification/promotion as admin-exclusive, which the top-line grant surface undercuts.)

### 06.5 — Admin tier promotion (Sponsor + Manager-approve) — **MATCHES, one internal inconsistency**
DB-level 2-eyes is real (`no_self_approve`, `no_self_sponsor`; dual-source write to `auth.users.raw_app_meta_data` + `public.users` columns; state enum matches). **Minor DRIFT:** the PlantUML step reads `assertAtLeast("super_admin")` on `request-admin-promotion`, which contradicts the diagram's own actor label "Sponsor (super_admin **or** Manager)" and the locked ruling that a Manager may sponsor. Severity: low — an implementer copying the `assertAtLeast` string would wrongly lock sponsorship to super_admin only. Recommend reconciling the gate string to the actor/label.

### 06.7 — Visibility-change call coordination (KAN-274) — **DRIFT (new, same root as 04.2)**
Full two-phase sequence drawn as live: `schedule-visibility-flip`, `validate-relay-token`, `commit-visibility-flip`, silent push T-15m, action-bound step-up, duress branch. **None of it is built** — no KAN-274 tables/endpoints in live schema. No "unbuilt" annotation anywhere on the page. Severity: medium-high. This is the same gap as 04.2 but at endpoint/sequence granularity, so it's the more dangerous of the pair for an implementer. Recommend a bold "ROADMAP — NOT LIVE (KAN-274)" band, mirroring how docs 08/10/11 mark their unbuilt pieces.

### 08 — Verification Lifecycle end-to-end — **MATCHES (exemplary) — but assumes admin-only verification**
Explicitly "grounded 2026-07-01"; self-documents *"Live enum: pending · verified · rejected · deactivated (4 states only)"* — matches `verification_status_enum` exactly. `rejection_reason_code` 8-code CHECK, `appeal_status` CHECK (`none/email_received/in_review/resolved_restore/resolved_uphold`), timestamp-driven delete pipeline, RPL-ID-at-verify, audit action list — all consistent with schema. This is the model the other diagrams should follow.
**The one caveat (audit fact (e)):** every verified-transition write here (`users.verification_status='verified'`, `churches.verified=true`, `church_code` mint) is drawn as an **admin action only**. Live grants let a verified leader perform all three directly (top-line). So diagram 08 *does* assume verification is admin-only, and that assumption is the one contradicted by the live grant surface. Severity of the assumption: **high** (it's the diagram most likely to convince a builder the verified state is unforgeable). The diagram isn't "wrong" about intent — it's that the DB doesn't yet enforce what the diagram assumes.

### 10 — Underground Evidence Lifecycle — **MATCHES (gold standard)**
Every constraint verified: `evidence_tier` = 2 values with an explicit call-out *"T3 NOT LIVE ... Doc 04 says '3-tier' — that's ROADMAP"* (i.e., doc 10 already flags the doc-04 drift); `mime_type` 9-value CHECK, `size_bytes ≤ 25 MiB`, `summary` 1–500, `contact_channel` 6-value (evidence) vs 5-value (proposal), `underground_verification_proposals` action/status/visibility_direction CHECKs, `no_self_confirm`, timestamp-driven state, `audit_log_underground` vocab, super_admin+break-glass RLS. No drift found. Keep as the schema-truth reference for the UG subsystem.

### 11 — Realtime + Notification Stack — **DRIFT ×1 (new) — otherwise the corrected source-of-truth**
Bills itself as schema-truth ("LIVE schema 2026-07-01 · 7 tables only", corrects docs 00/02/03). Live `supabase_realtime` publication = **7 tables**: `messages, conversations?`… — verified list is `admin_tier_promotions, branch_members, branches, connection_requests, messages, underground_admin_inbox_events, underground_detail_events`.
- **MATCHES:** the 7-count; `messages` DELIVER-ALWAYS with `receiver_id` RLS; `admin_tier_promotions` super_admin-JWT-authoritative RLS; the two UG event tables; the "docs 00/02/03 overstated coverage" correction; polling-fallback tables (announcements/comments/prayer/testimony/heartcry).
- **NEW DRIFT:** the diagram lists **`conversations`** as an 8th subscribed Realtime table in two places (group_18/19 "conversations · branches · branch_members · connection_requests — All in supabase_realtime pub" and the RLS matrix), and attributes thread-list reordering to `conversations` UPDATE broadcasts on `last_message_at`. **Live: `conversations` is NOT in the publication** (`pg_publication_tables` count = 7; `conversations` absent). Functional impact: conversation-row-driven live reordering won't fire (new-message toasts still work via `messages`, which *is* published). Severity: low for safety, **notable for trust** — the flagship "this doc catches that class of table-not-in-publication bug" diagram commits exactly that error about its own subject. Recommend removing `conversations` from the 7-table list or moving it to the polling/on-focus column.

---

## Confirmation of the three KNOWN drifts (per brief)

| # | Known drift | Confirmed live? | Worse than documented? |
|---|---|---|---|
| 1 | Doc 05 shows 5-state escalated machine; live is 6 | **Yes** — live CHECK = 6 (`+manager_review`), and `manager_review` is in live rows | **Slightly** — doc omits `manager_review` AND lists `awaiting`, so the "5" is wrong two ways, not just short by one |
| 2 | Docs 00/02/03 overstate Realtime coverage | **Yes** — live pub = 7 tables; 00/02/03 not re-checked this pass but doc 11 documents+corrects them | Not assessed directly; doc 11 is the correction of record |
| 3 | Doc 04 says "3-tier UG evidence"; live is 2-tier | **Yes** — `evidence_tier` CHECK = `t1_referral, t2_live_call`; T3 absent | No — as documented; doc 10 already annotates it |

---

## NEW drift items (beyond the 3 known)

1. **[HIGH] Live grant surface contradicts the "admin-only" framing of docs 04/05/08/10.** Verified leaders can self-set `users.is_top_tier_admin` / `is_underground_admin` / `verification_status`, and `churches.verified` / `show_church_name` / `church_code` / `type`, via direct PostgREST (RLS has no column guard; broad table+column UPDATE grants to `authenticated`). Route to SEC+DBA as a pre-UAT blocker. (Generalizes audit fact (e); extends it from "self-verify" to "self-elevate to Manager/UG-admin" and "self-flip the underground name-hiding flag".)
2. **[MED-HIGH] Doc 06.7 (and doc 04's KAN-274 block) present the visibility-flip / relay-token flow as live.** It is UNBUILT — no KAN-274 tables or endpoints in live schema. No "roadmap" marker. (Audit fact (f) confirmed.)
3. **[MED] Doc 04's `show_church_name` "immutable via app · admin change only" invariant is false in live schema** (verified UG leader can flip it directly). This is the underground-safety instance of finding #1 and deserves its own callout because of the population it protects.
4. **[LOW-MED] Doc 05's escalated machine omits `manager_review`** (the live 6th state) while still listing `awaiting` — a builder wiring the case UI off this list misses a real state + its 4 NOT-NULL companion columns.
5. **[LOW, trust] Doc 11 lists `conversations` in the Realtime publication; it is not.** The self-declared schema-truth diagram makes the exact error it warns about.
6. **[LOW] Doc 06.5 gate string `assertAtLeast("super_admin")` contradicts its own "sponsor may be Manager" actor/label** and the locked ruling.

## Which diagram would most mislead someone into a security regression
**Diagram 08 (Verification Lifecycle)** — closely followed by **04** and **05**. All three depict verification / RPL-ID minting / tier promotion / UG name-visibility as admin-exclusive, audited, ceremony-gated transitions. The live DB currently lets a verified leader perform every one of those writes directly against their own row. A builder who trusts these diagrams as the enforcement contract would (a) not add the missing column-scope/`WITH CHECK` guards, and (b) reasonably assume the verified/admin state is unforgeable. That gap is the path to a real privilege-escalation / underground-exposure regression. Diagrams 08/10/11 are otherwise the most rigorously schema-grounded in the set; the issue is that their honest depiction of *intended* enforcement outruns what the schema *actually* enforces today.
