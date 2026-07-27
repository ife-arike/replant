# Admin-core cluster verdicts — 12 tickets (audited 2026-07-02)

Deployed truth = replant-admin `origin/main` @ 1108fe5 (PR #73). Mobile truth = ~/replant working tree (branch feat/kan-296-mobile-attribution-slot, pushed).

## KAN-51 — [Admin Screen 03] Heartcry Inbox — Decrypt, Triage, Respond
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- `origin/main:src/screens/Heartcry.jsx` — full list view (KAN-91): 5-tier severity pills, severity/status/date multi-select filters, PAGE_SIZE=25, windowedPages pagination, ciphertext-only cards, no church/leader names in list.
- `/Users/ife/replant/supabase/functions/admin-open-heartcry/index.ts` — decrypt path (KAN-92): calls `admin_open_heartcry` SECURITY DEFINER RPC (audit-before-content, live at v1.35.0), super_admin claim + AAL2/TOTP 5-min freshness, SAFE-LOG; `decrypt_heartcry_content` confirmed live prod fn (P0-1 migration 20260702021323 revokes client EXECUTE on it).
- `origin/main:src/components/HeartcryDecryptPanel.jsx` — decrypt panel; status received→seen written by the RPC on first open (KAN-163 optimistic sync in Heartcry.jsx handleDecryptClose).
- Respond: `origin/main:netlify/functions/mark-heartcry-responded.js` — sets `responded_at` + `heartcry_responded` audit action (KAN-110 Q3 ratified, superseding the May COO "no dedicated action" direction). Decrypt panel's "Respond via secure DM" CTA is **disabled**: `title="Coming soon — secure DM channel ships under a separate ticket"` (HeartcryDecryptPanel.jsx:321-325).
MISSING: Respond-via-secure-DM hand-off (compose modal, message into leader's Connect thread, Resend response ping) — the KAN-93 child. Also minor deviations: responded heartcries not reachable via filter (heartcry-inbox.js returns `responded_at IS NULL` only); no severity-desc sort (created_at desc only).
DEPLOYED: yes (built parts on origin/main + deployed edge fn)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (per 2026-05-07 split ruling parent stays open until all 3 children close; KAN-91/92 shipped, KAN-93 open)
COMMENT-FACTS:
- Children KAN-91 (list) + KAN-92 (decrypt) shipped and deployed: Heartcry.jsx list w/ filters + 25/page pagination; admin-open-heartcry Edge Fn → admin_open_heartcry RPC, audit-row-before-content, AAL2 90-sec/5-min gates.
- Status machine live: first decrypt flips received→seen (RPC-side); Mark-as-Responded sets responded_at + `heartcry_responded` audit action (KAN-110 Q3 ratification supersedes the 2 May COO no-dedicated-action direction).
- Respond-via-secure-DM NOT built: decrypt panel CTA is disabled with "coming soon — ships under a separate ticket" (KAN-93).
- List deviations vs A/C: responded items filtered out server-side (not reachable via filter); sort is created_at desc only.
- Parent stays Backlog per the 2026-05-07 split ruling until KAN-93 closes.

## KAN-53 — [Admin Screen 11] Team Management — Add & Remove Super-Admins
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (goal met by richer locked design)
EVIDENCE:
- `origin/main:src/screens/TeamManagement.jsx` — KAN-271 F12/F31 tier-aware roster (Name · Email · Tier · Granted · Last sign-in · Actions), seeded-Overseer pills, Founder row protected (FOUNDER_AUTH_USER_ID), Invite/Promote/Approve/Deny/Demote/Revoke/Reset modals.
- `origin/main:netlify/functions/revoke-admin.js` — self-revoke blocked, founder-protected 403, can_manage_admins gate, AAL2 sensitive-destructive gate, MIN_SUPER_ADMINS=2 server-side, `auth.admin.signOut(userId,'global')` immediate session invalidation, `super_admin_granted`/`super_admin_revoked` audit actions (per SEC ruling on this ticket).
- `origin/main:netlify/functions/invite-admin.js` — Manager-only invite: step-up token, rate limit, `inviteUserByEmail` → redirect `/set-password`, atomic `fn_invite_admin` RPC (public.users + audit in one txn); plus grant-admin-to-existing.js and the full 1-sponsor-1-manager promotion ceremony (request/approve/deny-admin-promotion.js) — PR #70 wave, locked in the 2026-06-30 admin tier access matrix.
MISSING (vs original A/C, superseded not blocking): revocation notification email to removed admin (no Resend send in revoke-admin.js); optional 300-char invitation message (Supabase default invite email used); audit action names shipped as `super_admin_granted/revoked` not `team_member_added/removed`.
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (close with supersession note referencing the tier-matrix design)
COMMENT-FACTS:
- Goal shipped under the 2026-06-30 admin-tier design (PR #70/#73): invite-admin + grant-admin-to-existing + revoke-admin + demote + 1-sponsor-1-manager promotion ceremony, all on origin/main.
- Original SEC rulings honored: server-side claim assignment only; immediate `signOut(…, 'global')` on revoke; grant/revoke audit actions fire unconditionally.
- Self-protection: self-revoke rejected, Founder row hard-protected BE-side, minimum-2 super-admins enforced server-side (MIN_SUPER_ADMINS=2 → 400 MINIMUM_ADMIN_COUNT).
- Setup flow live at /set-password via Supabase invite email redirect.
- Not carried over from 2026-05 spec: revoked-admin notification email; custom invitation message; `team_member_added/removed` action literals (constraint has them; shipped fns use super_admin_granted/revoked).

## KAN-93 — [Admin Screen 03c] admin-respond-heartcry Edge Function + Compose Modal
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `admin-respond-heartcry` absent from `/Users/ife/replant/supabase/functions/` (verified ls) and from `origin/main:netlify/functions/` (full listing).
- No compose modal component on origin/main; decrypt panel CTA disabled: `HeartcryDecryptPanel.jsx:321-325` "Respond via secure DM · coming soon — ships under a separate ticket".
- Interim substitute shipped under KAN-110 lineage: `mark-heartcry-responded.js` (responded_at + heartcry_responded audit) — no DM, no Resend ping to leader.
MISSING: entire ticket — edge function, atomic message-insert + status transition, compose modal, Resend "team has responded" template.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (needs regroom — the admin→leader Connect-DM primitive now exists: reach-out-to-leader-from-case.js / reach-out-to-leader-from-message.js shipped with Escalated Cases; KAN-93 should reuse that pattern instead of KAN-71 send-message assumptions)
COMMENT-FACTS:
- admin-respond-heartcry does not exist in either repo; compose modal not built; decrypt-panel CTA disabled with "coming soon" copy.
- "Mark as Responded" (responded_at + heartcry_responded audit) shipped instead under KAN-110 — triage closure works, pastoral response channel does not.
- Build shortcut now available: Escalated Cases shipped admin→leader Connect DM functions (reach-out-to-leader-from-*) with "Admin Name from Replant Team" attribution — the natural template for this ticket.
- Ticket's KAN-71/KAN-33 dependency notes are stale; regroom against the shipped reach-out pattern before build.

## KAN-116 — Admin UX/UI polish umbrella (post-KAN-110/111 smoke findings)
CURRENT LANE: FAILED QA
VERDICT: BUILT (14 of 15 items verified on origin/main; item 15 explicitly "can come later", no AC)
EVIDENCE:
- Item 1 ✓ `globals.css:207` .rp-id-avatar display:grid + "KAN-116 Item 1" comment. Item 2 ✓ security-claims footer fully removed from Login.jsx/SetPassword.jsx (no "EU-WEST"/"SESSION SECURED" anywhere in src/ — SEC removal-and-replace c.12806 satisfied at root). Item 9 ✓ `ChurchManagement.jsx:640` "KAN-116 Item 9 — Status as styled pill".
- Items 5/6 ✓ `Scripture.jsx:209` pendingOverwrite latch + `:331` startEditFromRow. Item 7 ✓ `Queue.jsx:197/235` success/error toasts. Item 8 ✓ globals.css .rp-error (:620) + rp-fadein keyframes.
- Item 12 ✓ `Queue.jsx:415-488` verb-matched labels ("Confirm approval"/"Confirm rejection") + Approving…/Rejecting… loading states + `:444/477` autoFocus + `:614-616/648-650` Enter-submit/Escape-cancel.
- Items 13/14 ✓ `Flagged.jsx:393` chevron `rotate(-90deg)` collapsed / `rotate(0)` expanded; `:455-480` side-by-side inline-flex action buttons (KAN-55 Founder QA fix comment).
- Items 3/4a superseded by rebuilds (KAN-119 inline drop-downs; KAN-140 CM table: Church|Region|RAG|Members|Joined). Item 4b shipped at DB level via KAN-207 region triggers. Item 4c ✓ `ChurchManagement.jsx:144` name/country/church_code ilike search. Item 10 ✓ `AuditLog.jsx:227` actor_email search + ACTION_FILTER_OPTIONS select (:77,:385) + windowed pagination.
MISSING: Item 15 only (clear-flag confirmation toast on Flagged) — founder-tagged "this can come later"; Flagged is being rewritten on the in-flight feat/flagged-mirror-pastoral branch anyway.
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Testing (FAILED QA is stale; needs founder re-verify per AC7, then Done)
COMMENT-FACTS:
- All 15 items re-audited against origin/main 2026-07-02: 14 verified shipped (items 1,2,3,4a,4b,4c,5,6,7,8,9,10,12,13,14), several via superseding rebuilds (KAN-119 queue drop-downs, KAN-140 CM view, KAN-207 region trigger).
- Item 2 resolved beyond spec: entire "SESSION SECURED · TLS 1.3 · REGION EU-WEST" footer removed; login footer now makes zero operational claims.
- Item 12 fully in: verb-matched confirm labels, loading states, Enter/Escape keyboard handling, textarea autofocus.
- Sole remainder is item 15 (clear-flag toast), founder-classified "can come later"; Flagged screen is mid-rewrite on the Founder's feature branch.
- FAILED QA lane no longer reflects code state — founder re-verification is the only open gate.

## KAN-120 — Test data scaffolding — varied churches/RAG/heartcries/users
CURRENT LANE: In Progress
VERDICT: SUPERSEDED (by the 2026-06 lean-reseed ruling + real-data posture)
EVIDENCE:
- Track 2 script exists and is committed: `/Users/ife/replant/supabase/seeds/seed-test-data.ts` v2.2 (idempotent wipe+seed, [TEST] prefixes, real encrypt_heartcry_content path, RAG/severity variety) — but header targets schema v1.15.0 (May-era); current prod schema has moved far past it (e.g. state_declaration NOT NULL broke a KAN-207 probe INSERT), so it is bit-rotted.
- Track 1 happened historically — KAN-169's description records 41 test fixtures incl. `[TEST-KAN120]` rows receiving church codes.
- Founder ruling later reversed the varied-bulk-data posture: re-seed to lean state (161→10 users, 91→6 churches) for the empty-state QA pass (memory: project_reseed_plan), and "build mode is over" — first real leader onboarded 2026-06-28. `.qa/seed_apply/` (June 11-12) holds the newer targeted content seeds (prayer_requests/comments/testimony).
MISSING: n/a for supersession — ticket-as-written intent (dashboard full of varied fake data) is no longer the locked direction.
DEPLOYED: n/a (data op; script in mobile tree)
NEEDS-LIVE-DB: SELECT verification_status, rag_status, count(*) FROM churches GROUP BY 1,2; SELECT severity, count(*) FROM heartcries GROUP BY 1; — only if Founder wants to re-confirm current variety before closing.
NEEDS-SIM: none
RECOMMENDED LANE: Done (close with supersession note; if a fresh seed is ever needed, seed-test-data.ts must be reconciled to current schema first)
COMMENT-FACTS:
- Track 1 (one-shot varied seed) executed in May (41 fixtures per KAN-169); Track 2 script exists at supabase/seeds/seed-test-data.ts (idempotent, wipe+seed, real heartcry encrypt path).
- Founder's 2026-06 reseed ruling superseded the intent: test data cut to 10 users / 6 churches for the empty-state QA pass; real-leader onboarding began 2026-06-28.
- Track 3 (leader-app ↔ admin integration smoke) is subsumed by the current QA phase device passes.
- seed-test-data.ts targets v1.15.0-era schema and will not run clean against current prod (new NOT NULL/CHECK constraints); treat as archived unless reconciled.

## KAN-161 — Admin responsive shell — remaining mobile/tablet rendering issues post-KAN-145
CURRENT LANE: Backlog
VERDICT: NOT_BUILT (no fixes landed since filing)
EVIDENCE:
- No kan-161 commits on origin/main; latest responsive work remains KAN-145 batches (merge 092f06d) — exactly the state the ticket says is insufficient.
- UAT finding 2 still true in code: `Scripture.jsx:8` imports FiltersTrigger but NOT ClearLink; no ClearLink rendered beside the translation filter (Announcements.jsx:268 has one).
- UAT finding 3 unaddressed: `FilterPrimitives.jsx:257-265` DropdownPanel is `position:absolute; left:0` with no right-edge clamp/align prop — Announcements panel clip persists.
- UAT finding 1: ClearLink (blue link style, FilterPrimitives.jsx:321-331) vs in-panel ghost "Clear filters" buttons (e.g. Heartcry.jsx) — two visual styles coexist.
MISSING: all 3 device issues (Queue cards 390px proportions; sticky thead clip at 768px iPad; date-input width on iOS WebKit) + all 3 UAT filter findings.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: Real-device pass (per ticket: Safari Web Inspector tethered, NOT Playwright): 1) Queue verification cards at 390px, 2) first data row vs sticky header on iPad 768×1024 (Queue/Flagged/Pastoral), 3) Publish Date input width vs siblings on Scripture. Note Queue/Flagged have been rebuilt since 2026-05-14 — re-verify before patching.
RECOMMENDED LANE: Backlog (unchanged; founder marked the UAT findings "deferred — not blocking UAT testers")
COMMENT-FACTS:
- Zero KAN-161-tagged commits on origin/main; the three WebKit device defects from 2026-05-14 have had no targeted fixes.
- 2026-05-18 UAT additions all still open in code: Scripture translation filter lacks ClearLink; DropdownPanel has no right-edge overflow handling (Announcements clip); Clear affordance styles inconsistent.
- Screens named in the device findings (Queue, Flagged) were rebuilt since — a fresh device pass must precede any CSS patch (per the ticket's own no-blind-patching rule).
- Non-blocking for UAT per founder note; keep as post-UAT polish batch.

## KAN-169 — OPS: Pre-launch test data wipe + church_code sequence reset
CURRENT LANE: To Do
VERDICT: NOT_BUILT (operational task, not yet runnable as written — and now stale/dangerous)
EVIDENCE:
- No wipe script/runbook artifact in either repo (`church_code_seq` appears nowhere in ~/replant or ~/replant-admin outside the ticket); the runbook lives inline in the ticket only.
- Landscape has shifted under the ticket: the 2026-06 reseed already cut test data to ~6 churches; the founder's second test account (Blessings Abound), emptytest, and the first REAL leader (2026-06-28) now exist — the ticket's `DELETE FROM churches WHERE id != Maranatha` would destroy real/covenant rows, not just fixtures.
- KAN-207 DBA lane explicitly deferred church `129c63c7` (+ ruthjames08 secondary user row) "to KAN-169 clean-slate" — that disposition is queued on this ticket.
MISSING: safe re-scoped SQL (fixture-targeted, not everything-but-Maranatha), pre-run checklist re-validation, sequence-reset validity check (real churches may already hold codes > RPL-00001).
DEPLOYED: n/a
NEEDS-LIVE-DB: SELECT id, name, church_code, verification_status FROM churches ORDER BY created_at; SELECT last_value FROM church_code_seq; — required to re-scope the wipe before ANY execution.
NEEDS-SIM: none
RECOMMENDED LANE: To Do (unchanged; MUST be re-scoped before the founder trigger — the inline SQL predates real-data onboarding)
COMMENT-FACTS:
- Nothing built or run; runbook exists only as ticket-inline SQL, written when all non-Maranatha rows were fixtures.
- SQL is now unsafe as written: real leader onboarding began 2026-06-28 and founder test accounts (Blessings Abound, emptytest) survive the reseed — blanket delete would hit non-fixture rows.
- `ALTER SEQUENCE … RESTART WITH 2` premise (no real codes issued yet) needs live re-verification before run.
- Inherits the KAN-207 deferred cleanup: church 129c63c7 + secondary ruthjames08 user row.
- Keep gated on explicit Founder go-ahead; re-scope the statements at execution time against live data.

## KAN-173 — [Admin Settings] TOTP factor management — unenroll + re-enroll
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- `origin/main:src/screens/Account.jsx` (KAN-271 F34) — "Two-factor authentication" card with enrolled/not-enrolled states; handleUnenroll (:186-207) → `unenrollTotpFactor` → `supabase.auth.mfa.unenroll()` (src/lib/aal2.js:66-67); re-enroll reuses TotpEnrollmentScreen (AC-5 ✓); recovery-warning banner if unenroll succeeds but re-enroll incomplete; BlockingEnrollmentGate for no-factor logins; self-service only (own factorId; AC-8 ✓).
- AC-3 gap: unenroll is guarded by `window.confirm` only — no TOTP_FRESHNESS_WINDOW_MS check, no TotpChallengeModal pre-unenroll. (Option C+ elevates sessions to AAL2 at login, but that is not the 5-min freshness re-challenge AC-3 specifies against unattended-session factor removal.)
- AC-7 gap: `logAal2Elevation` fires only from TotpChallengeModal (TotpChallengeModal.jsx:117/132); Account unenroll/re-enroll writes NO `admin_aal2_elevation` rows with meta.surface='unenrollment'/'enrollment'.
MISSING: AC-3 (AAL2 freshness gate + TotpChallengeModal on Remove authenticator); AC-7 (both audit rows). Cosmetic: copy is "remove/re-enroll TOTP factor" not the AC's "2FA enabled/disabled" states — equivalent.
DEPLOYED: yes (built parts)
NEEDS-LIVE-DB: SELECT count(*) FROM audit_log WHERE meta->>'surface' IN ('enrollment','unenrollment'); — expected 0, confirming the AC-7 gap.
NEEDS-SIM: none
RECOMMENDED LANE: In Progress (surface shipped via KAN-271 F34; remaining delta is AC-3 freshness challenge + AC-7 audit rows — small hardening pass)
COMMENT-FACTS:
- Self-service unenroll + re-enroll round-trip is live on Account (KAN-271 F34): mfa.unenroll, TotpEnrollmentScreen reuse, lockout-recovery banner, blocking gate for invitees.
- Settings-shell dependency resolved by the Account screen shipping.
- AC-3 not met: no AAL2-freshness TOTP re-challenge before unenroll — only a window.confirm; the unattended-session threat AC-3 targets is unmitigated.
- AC-7 not met: no admin_aal2_elevation audit rows with meta.surface enrollment/unenrollment fire from this flow.
- Recommend a small hardening pass to close AC-3 + AC-7, then founder sign-off.

## KAN-176 — Admin — windowed page-number pagination on all list screens
CURRENT LANE: TESTING
VERDICT: PARTIAL
EVIDENCE:
- `src/lib/pagination.js` shared helper on origin/main; consumed by 5 screens (git grep windowedPages): AuditLog.jsx, ChurchManagement.jsx, Heartcry.jsx, Scripture.jsx, Underground.jsx — all with filled-pill current page, first/last+window, single-page footer hidden.
- Every screen that HAS pagination uses the windowed pattern — no Prev/Next-only screens remain.
- BUT multiple list screens have NO pagination at all (verified no slice/range/limit paging): Queue (Verification), Flagged, PastoralQueue, Announcements, EscalatedCases, UndergroundPending/Inbox/etc., TeamManagement; PiiHistory hard-caps at .limit(100) with no pager. Founder failed the ticket 2026-05-23 ("Not completed/fully tested").
- Content Section architecture lock (2026-07-01) now specs pagination-10 as part of the shared content pattern (Scripture/Announcements/Outreach) — that reconciliation is not on origin/main (Scripture PAGE_SIZE=30; Announcements unpaginated), and the in-flight feature branch adds no pagination (diff checked).
MISSING: pagination (windowed) on the unpaginated list screens the founder expects covered — at minimum Announcements + the queue surfaces as data grows; Content-Section pagination-10 reconciliation for Scripture/Announcements.
DEPLOYED: yes (the 5 covered screens)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Progress (fold the remaining screens into the Content Section rebuild workstream per the 2026-07-01 architecture lock, or re-scope AC-1's screen list with Founder)
COMMENT-FACTS:
- Shared windowedPages helper live; 5 screens on it (AuditLog, ChurchManagement, Heartcry, Scripture, Underground); zero Prev/Next-only screens remain.
- Founder FAIL (2026-05-23) still stands under a strict "ALL list screens" reading: Queue, Flagged, Pastoral, Announcements, EscalatedCases, UG queues, TeamManagement render unbounded lists; PiiHistory silently caps at 100.
- 2026-07-01 Content Section lock specs pagination-10 for content tabs — Scripture (30/page) + Announcements (none) reconcile there.
- Recommend closing this ticket's remainder inside the Content Section workstream rather than a standalone pass, or founder re-scopes which screens require pagination at current data volumes.

## KAN-207 — BUG: Church type edit duplicate orphan queue entries; region NULL
CURRENT LANE: Backlog
VERDICT: BUILT (AC6 deferred by ruling; AC7 founder re-test outstanding)
EVIDENCE:
- Mobile fix deployed: `/Users/ife/replant/supabase/functions/update-church/` (handler.ts ownership check auth_id+church_id+is_active; partial UPDATE via .eq id — no INSERT) + `src/screens/onboarding/RegisterChurchPage2Screen.tsx:44-72` isEditMode branch → UPDATE_CHURCH_URL (KAN-207-tagged). Commits dfd7d12/59d3266 on mobile main (2026-05-29); handler.test.ts present.
- AC4(b) defense-in-depth shipped at DB level: BEFORE INSERT region auto-populate triggers applied live via MCP with DBA stamps — `trg_churches_set_region_admin_only` (kan207_churches_region_insert_trigger_v1, 2026-05-26, 4-scenario spot-check) and `derive_region_from_country()` + `churches_set_region_on_insert` (kan207_auto_populate_region_admin_only_on_insert, 2026-06-12, verified firing). NOT mirrored in repo migrations (MCP-applied) — and the two stamps describe two overlapping INSERT triggers.
- AC3/AC5 closed on prod: orphan 317b1ad9 deleted; Option A cleanup removed 2 zero-user NULL-region rows; orphan probe returned 0 at 2026-06-12 re-verification; 129c63c7 deferred to KAN-169 by Founder ruling.
MISSING: AC6 CI regression test (explicitly deferred to a testing-strategy ticket, 2026-06-12 comment); AC7 founder device re-run of the church-type-edit pass.
DEPLOYED: yes (edge fn deployed; DB triggers live per DBA stamps; mobile FE on main since 2026-05-29 — in any Expo build cut after that date)
NEEDS-LIVE-DB: SELECT trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE event_object_table='churches'; — confirm whether BOTH region INSERT triggers coexist (May trg_churches_set_region_admin_only + June churches_set_region_on_insert = redundant double-fire; harmless but should be deduped). Also re-run the orphan probe: SELECT COUNT(*) FROM churches WHERE verification_status='pending' AND NOT EXISTS (SELECT 1 FROM users WHERE church_id=churches.id);
NEEDS-SIM: Founder AC7 device pass — edit church type (branch→ministry) from mobile, confirm exactly one queue entry, leader attached, region populated.
RECOMMENDED LANE: Testing (root cause fixed + verified live; Done after founder AC7 re-run)
COMMENT-FACTS:
- Root cause named and fixed: leader edit flow INSERTed via register-church; now branches on isEditMode → dedicated update-church edge fn (ownership-checked UPDATE in place).
- Region NULL closed with DB-level defense-in-depth: BEFORE INSERT auto-populate from country (explicit values win; unknown/NULL country stays honestly NULL).
- Orphan cleanup executed under Founder rulings: original orphan + 2 zero-user NULL-region rows deleted; 129c63c7 (+ secondary ruthjames08 user) deferred to KAN-169; orphan probe = 0 (2026-06-12).
- AC6 CI regression deferred by ruling to a testing-strategy ticket; AC7 founder device re-test is the only open gate.
- Housekeeping: live trigger inventory should confirm the May and June region triggers aren't both installed (redundant if so); neither is mirrored in repo migrations.

## KAN-210 — Admin — Church geocoding (Mapbox + manual pin) + verification profile field editing
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Zero Mapbox/geocoding references anywhere on origin/main (src/ + netlify/ grep) — no Location panel, no Find on Map, no manual pin, no inline map, no `church_location_updated` audit action (absent from both action-names.js files).
- Admin church editing remains the KAN-147 6-field allowlist: `update-church-details.js` EDITABLE_FIELDS = name/type/country/city/contact_email/contact_role, with lat/lng explicitly excluded ("NEVER updated through this path").
- 5 enrichment fields exist in schema (KAN-208 dependency shipped — /Users/ife/replant/supabase/migrations/20260527000000_kan208_church_enrichment_v1.sql) but admin renders only congregation_size_range read-only (ChurchManagement.jsx:696); no edit UI for website_url/primary_language/denomination_affiliation/show_contact_on_profile.
- Adjacent fragment (different ticket): ChurchProfileCard edit-pending flow (KAN-218/206) edits address/contact fields on PENDING churches during verification review.
MISSING: entire geocoding panel (Find on Map, manual pin, save-location + audit + underground guard UI); enrichment-field edit panel (incl. congregation dropdown + show_contact toggle); church_location_updated action registration.
DEPLOYED: n/a (KAN-208 schema dependency is deployed)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (dependency KAN-208 cleared; needs grooming — Mapbox token scoping SEC question from BA review still unanswered)
COMMENT-FACTS:
- Nothing from this ticket's A/C is on origin/main: no Mapbox integration, no location panel, no enrichment-field editing, no church_location_updated audit action.
- Hard dependency KAN-208 (5 enrichment columns + get_church_profile RPC) shipped 2026-05-27 — the In-Progress block is lifted.
- Admin can currently edit only the KAN-147 six fields; enrichment fields render read-only (congregation on CM detail); pending-church address edits exist via KAN-218 edit-pending, not this ticket's flow.
- Open pre-build question from BA review: server-side vs public Mapbox token in admin web context (SEC to rule).

## KAN-234 — Admin — "Remove leader from church" action (frees a leader slot)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No remove/unlink-leader function in origin/main netlify/functions (full listing checked); no `admin_unlink_leader` (or equivalent) in action-names.js; no `users.church_id = NULL` write path in any admin endpoint.
- `reject-leader.js`/`verify-leader.js` are verification-queue actions on PENDING leaders (KAN-218) — not slot-freeing removal of an attached leader.
- LeaderSlots.jsx renders slots with no action buttons; no confirmation modal, no removal email template in netlify/functions/_emails/.
MISSING: entire ticket — admin action + confirmation modal, church_id NULL write, audit action + constraint addition, leader notification email, slot-freed behavior.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (unchanged; filed 2026-06-12 to reflect sprint scope — still awaiting its build slot; sibling KAN-148 leader-side conflict UX should be checked before grooming)
COMMENT-FACTS:
- Not built: no endpoint, no UI affordance, no audit action, no email template anywhere on origin/main.
- Existing leader actions (verify-leader/reject-leader) are verification-status mutations, not church-association removal — the 2-leader-cap conflict still has no admin-side release valve.
- DBA scope on build: `admin_unlink_leader` (or canonical equivalent) needs the audit_log_action_check + BE Set sync per watched invariant.
- Email scope decision pending: extend KAN-143 admin-action templates vs sibling ticket.
