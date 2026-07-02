# Underground-admin cluster — audit verdicts (2026-07-02)

Verified against admin deployed truth `origin/main` = 1108fe5 (PR #73 squash). Working tree branch `feat/flagged-mirror-pastoral` diverges from origin/main ONLY in 3 non-UG files (TriageTabBar, FlaggedCloseCaseModal, Flagged.jsx) and was cut from 905a90b — for the 8 files PR #73 touched, `git show origin/main:` was used; everything else in the working tree is byte-identical to origin/main. Mobile truth = `/Users/ife/replant` current branch. Key structural fact: the KAN-264/265/267 DB waves were applied to prod via Supabase MCP and are NOT mirrored in `supabase/migrations/` — their live existence is proven indirectly (mirrored later migrations reference `churches.in_review_*` and `underground_verification_proposals.pinned_admin_id` and applied cleanly on prod; production smokes in KAN-271/273/286 exercised the RPCs) with residual live-DB checks listed per ticket.

## KAN-264 — Underground "Mark as In Review" admin workflow — claim model + narrative + evidence + force-unmark + Realtime + sibling queue
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- All 12 BE endpoints on origin/main (`git ls-tree`): underground-claim / release-claim / force-unmark-claim / request-release / narrative-note / evidence-create-intent / -confirm / -delete / -signed-url / sibling-approve / sibling-reject / list-siblings; plus both scheduled fns with `@daily` in `netlify.toml:28-32`.
- All 8 components exist + wired: `UndergroundDetail.jsx:701` renders ClaimAffordance unconditionally (claim checkbox + "In review by" pill); staleness `ir-stale` ≥3d / `ir-vstale` ≥7d (`ClaimAffordance.jsx:35-38`) = A/C 6; MarkInReviewSoftModal + ClaimConflictModal wired in Detail; `App.jsx:141-150` routes `/underground/siblings` + second-leader detail + `state-dots-colored` body class.
- A/C 4 force-unmark: BE `underground-force-unmark-claim.js:127-128` asserts `is_top_tier_admin` JWT claim + `tier: 'sensitive_destructive'` (5-min server-checked — mechanism is Option C+ JWT-amr freshness, superseding the ticket's "against auth.sessions" wording); FE modal enforces typed claimer-name exact match + 4-value structured reason + ≥30-char supplement + Day-25 variant (`ForceUnmarkModal.jsx:7-13,43-50`).
- A/C 2: `underground-narrative-note.js:49` requires `contact_channel` enum; `EvidenceUpload.jsx:3-5` required channel + summary, optional link-to-note (`linked_audit_id`); claimer-only gating in `NarrativeComposer.jsx:116`.
- A/C 8: Realtime subscription on `underground_detail_events` filter `church_id=eq.` (`UndergroundDetail.jsx:255-263`). DB schema live-proven: mirrored `20260624000007_kan271_0028c` SETs/projects `in_review_claimed_by/at/routed_to_founder_at` and applied cleanly on prod.
MISSING: n/a (3 known smoke issues in the description were fixed by KAN-265/266)
DEPLOYED: yes
NEEDS-LIVE-DB: `SELECT p.proname FROM pg_proc p WHERE p.proname IN ('fn_underground_claim','fn_underground_force_unmark_claim','fn_underground_add_narrative_note','fn_ug_second_leader_approve','fn_list_pending_ug_siblings');` · `SELECT jobname, schedule FROM cron.job;` (expect orphan-intent hourly + Day-25 daily 09:00 UTC) · `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename LIKE 'underground%';` (expect ONLY event tables, no corpus) · `SELECT id, public FROM storage.buckets WHERE id='underground_evidence';` (expect private)
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- 12/12 BE endpoints + 8/8 components + 2 scheduled fns verified on deployed origin/main; siblings queue live as "Leaders" tab + preserved deep-link route.
- Force-unmark gate verified: is_top_tier_admin JWT + sensitive_destructive (5-min) server tier + typed-name/structured-reason/≥30-char FE ceremony.
- claim columns proven live on prod via mirrored 20260624000007 which references them.
- The 3 known smoke issues in the description were closed by KAN-265/KAN-266 (verified separately).
- AAL2 check mechanism is Option C+ JWT-amr freshness, not an auth.sessions lookup — same guarantee, newer locked design.
- Residual live-DB confirmations listed (cron jobs, Realtime publication scope, bucket privacy) — MCP-applied, unmirrored.

## KAN-265 — [KAN-264 follow-up] In Review smoke fixes r1 — SLA pill colors + tooltip CSS + composer empty-state + lock icon + EVIDENCE column + sibling-CREATE wiring
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- Item 1: CD SLA override block at `globals.css:2021-2038` — neutral chips, dot-only escalation with `!important` overrides on band-yellow/amber/red/past.
- Items 2-3: `.ab-claim` family `globals.css:2407-2415`; `.btn-tipwrap`/`.btn-tip` + hover reveal `globals.css:2418-2432`.
- Item 4: `.ev-enc-foot .lock { width: 11px; height: 11px; flex-shrink: 0; }` `globals.css:2527`.
- Item 5: `NarrativeComposer.jsx:116-142` three-way branch — claimer → composer; non-claimer+claimerName → "X is reviewing"; unclaimed → "Claim this case to log narrative notes." (no more "Another admin…" on unclaimed rows).
- Item 6: `UndergroundPending.jsx:260-264` table is exactly 5 columns Ref/Macro-region/Submitted/SLA/State — EVIDENCE column gone.
- Item 7 (sibling-CREATE): NOT verifiable from repo — the `redeem_underground_join_code` patch migration is not mirrored; the caller exists (mobile edge fn `supabase/functions/join-underground-church/index.ts:222`).
MISSING: item 7 unproven from repo (see NEEDS-LIVE-DB) — everything else verified in code
DEPLOYED: yes (items 1-6)
NEEDS-LIVE-DB: `SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.proname='redeem_underground_join_code';` — expect `INSERT INTO public.ug_second_leader` + `underground_detail_events` kind='sibling_state_changed'
NEEDS-SIM: none
RECOMMENDED LANE: Testing (promote to Done the moment the one live-DB function-def check confirms the sibling INSERT)
COMMENT-FACTS:
- 6 of 7 scope items verified in deployed code at exact spec (CSS blocks, three-way composer branch, 5-column Pending table).
- Item 7 (redeem → ug_second_leader row) is a prod-only DB patch with no repo mirror; one `pg_get_functiondef` check closes it.
- Sibling queue FE (Leaders tab + /underground/siblings) is live and will populate the moment redeem inserts rows.

## KAN-266 — [KAN-264 follow-up #2] In Review smoke fixes r2 — claimer comparison + state pill chip + SLA dot escalation + tab reorder/rename
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- Item 1: `src/lib/useViewerPublicUserId.js` exists; consumed in `UndergroundPending.jsx:19,101` and `UndergroundDetail.jsx:15,147` — claimer comparison now uses public.users.id.
- Item 2: `UndergroundDetail.jsx:693-695` — standalone StatePill renders only when `!claim && !hasPendingProposal`.
- Item 3: chip neutralizer under `body.state-dots-colored` at `globals.css:2573-2589` (colored dots, transparent chips).
- Item 4: dot escalation `globals.css:2025-2033` — yellow→muted, amber, red, `band-past` red + `sla-pulse` animation (+ reduced-motion guard :2038).
- Items 5-8: aggregate banner neutral (`sla-agg-neutral`) with bucket stats at >15 (plain) / >25 (`is-amber`) / >28 (`is-red`) `UndergroundPending.jsx:142-146,182-191`; tab order Pending → Leaders → Verified → Deactivated → Inbox-last (`Underground.jsx:418-443,470-478`; KAN-272 later inserted a Rejected tab before Inbox — intentional addition, not a regression).
MISSING: n/a
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- All 8 items verified in deployed code, including the FK-mismatch claimer fix via the new useViewerPublicUserId hook.
- Day-51-style late cases now hit band-past red + pulsating dot per Founder's ruling.
- Tab bar ships as Pending/Leaders/Verified/Deactivated/Rejected/Inbox — Rejected added later by KAN-272 between Deactivated and Inbox.

## KAN-267 — Underground proposal flow — counter-propose + cancel + hybrid pin + fail-loud notify + Inbox surfacing + per-admin Realtime
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- 5 new BE fns on origin/main: counter-propose-underground, cancel-underground-proposal, list-admin-inbox-underground-proposals, list-underground-admins, `_lib/underground-notify.js`; propose-underground extended (pin validation :94-96, 4-arg RPC `p_pinned_admin_id` :15, notify AFTER successful RPC :160-164); decline-underground-proposal ships as a documented 410 GONE stub (true thin-alias impossible — legacy body lacked action/payload; FE wrapper throws deprecation `api.js:574`).
- FE: composite pill via `awaitingConfirm` (`ClaimAffordance.jsx:53-85`, passed at `UndergroundDetail.jsx:597,705,724`); 3-way CTA matrix + pinned-name disabled tooltip (:587); CancelProposalModal + NotifyChannelDownBanner imported (:46-47); Realtime on `underground_detail_events` (:255-263) + per-admin `underground_admin_inbox_events` channel (:275-279); reload-on-success throughout; DeclineProposalModal rewritten as counter-propose with ERRCODE-22023 → "must use a different action" mapping (:131-132); PinnedAdminSelect wired in ProposeVerify/ProposeReject/VisibilityOverride panels; Inbox `⚑ Proposed <action> · pinned to you` chip (`UndergroundInbox.jsx:102-103`).
- DB live-proof: `pinned_admin_id` projected by mirrored prod-applied migrations (20260624000007 :107,187,205; also 0032/0034/0037); BE calls `fn_underground_counter_propose` / `fn_underground_cancel_proposal` / `fn_list_admin_inbox_underground_proposals` / 4-arg `fn_propose_underground_action`; KAN-286's 06-29 prod smoke shows the propose pipeline live.
- Post-ship delta: cancel's email notify was REMOVED 2026-06-29 (commit 0be92b6, KAN-273) — cancel now audit + inbox-events only; ticket text describing cancel-notify is superseded.
MISSING: n/a
DEPLOYED: yes
NEEDS-LIVE-DB: `SELECT p.proname, pg_get_function_identity_arguments(p.oid) FROM pg_proc p WHERE p.proname IN ('fn_underground_counter_propose','fn_underground_cancel_proposal','fn_list_admin_inbox_underground_proposals','fn_propose_underground_action');` (expect propose = single 4-arg overload) · `SELECT to_regclass('public.underground_admin_inbox_events');`
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- All 5 new endpoints + 3 new components + 7 edited surfaces verified on deployed origin/main; copy matches locked strings (one nit: inbox chip reads "pinned to you" vs manifest's "pinned for you").
- pinned_admin_id column proven live via mirrored prod migrations that project it.
- Notify fires only AFTER a successful proposal INSERT; pin has zero effect on email envelope (in-app only) per SEC S01.
- Cancel-notify was later removed under KAN-273 — cancellation is audit-trail + inbox-event visible only.
- decline endpoint = intentional 410 GONE with migration guidance, not a silent alias.

## KAN-271 — Auto-cancel pending UG proposals when church transitions to terminal state (PRE-LAUNCH)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No migration creates a churches terminal-state trigger touching `underground_verification_proposals` — the only `SET proposal_status='cancelled'` in the repo (`20260701000010:107`) targets `escalated_case_proposals` (different feature).
- No backfill migration for the RPL-30067 orphan (`c8a524f4-…`).
- Symptom-level FE filter from PR #68 IS live: `UndergroundInbox.jsx:61-65` requires `verification_status !== 'rejected'` in `isOtherAdminProposal`.
MISSING: DB lifecycle trigger/RPC; audit rows on auto-cancel; backfill; smoke (done criteria 1-3 all absent)
DEPLOYED: n/a (FE symptom filter only)
NEEDS-LIVE-DB: `SELECT proposal_status, expires_at FROM underground_verification_proposals WHERE id='c8a524f4-c2be-4cd6-8a52-a28bd4791c9e';` (has natural expiry since flipped it?) · `SELECT tgname FROM pg_trigger WHERE tgrelid='public.churches'::regclass AND NOT tgisinternal;` (confirm no auto-cancel trigger appeared via unmirrored apply)
NEEDS-SIM: none
RECOMMENDED LANE: To Do (Founder ruled PRE-LAUNCH 2026-06-27; Backlog understates it)
COMMENT-FACTS:
- Root DB invariant (auto-cancel on rejected/is_active=false/hard_deleted_at) not present in any migration; ghost-row class remains DB-side.
- FE defense-in-depth filter from PR #68 confirmed live in UndergroundInbox.
- KAN-267's 'cancelled' proposal_status value exists on prod, so the trigger work has its target state ready.

## KAN-273 — Failed relay-token validation should not broadcast "action needed" emails
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- Email mechanism identified: BE-side only — `_lib/underground-notify.js:19` SUBJECT is the exact string 'Action needed — please sign in to review' (Resend). No DB trigger emails: zero `CREATE TRIGGER` on audit tables and zero pg_net/http/email calls in any mirrored migration; audit_log rows are inert w.r.t. email.
- Call sites on origin/main: propose-underground.js:164 (AFTER successful proposal INSERT), counter-propose-underground.js:107, initiate-restore-underground.js — all proposal-landing events that legitimately need review. `validate-relay-token.js` contains NO notify call; failed validation structurally cannot email.
- Cancel leak closed by commit 0be92b6 (2026-06-29, "drop cancel-notify — spurious 'action needed' emails (KAN-273)") — notify import + fan-out removed, modal copy now says audit-trail visibility.
- Widened scope (rate-limit denial rows in list-flagged-messages/list-underground-churches; read_region/list-load audit rows): all write audit rows only — with no trigger mechanism, none can broadcast. A/C-2's gate ("only propose-class actions email") holds by architecture.
MISSING: A/C-1's live trigger inspection never run against prod (repo proves no MIRRORED trigger; the UG waves were hand-applied, so drift is possible); smoke sequence (a)-(d) not evidenced
DEPLOYED: yes
NEEDS-LIVE-DB: `SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('public.audit_log_underground','public.audit_log');` — expect zero email-bearing triggers
NEEDS-SIM: none (smoke is on the deployed dashboard: wrong token → no email; rate-limit → no email; open oversight → no email; propose → exactly one email)
RECOMMENDED LANE: Testing (guard verified in code; the 4-step no-email smoke + one live trigger check close it)
COMMENT-FACTS:
- The "action needed" sender is netlify BE underground-notify (Resend), not a DB trigger — the ticket's trigger hypothesis is disproven for the mirrored schema; one live pg_trigger check guards against unmirrored drift.
- Emails now fire from exactly 3 proposal-landing endpoints, always after the RPC succeeds; validate/cancel/list/read paths are email-free.
- Founder's original symptom likely came from the (since-removed) cancel fan-out or an adjacent propose in the same smoke window — validate-relay-token never had a notify call.
- Stale comment persists at validate-relay-token.js:17-20 claiming the RPC writes an audit row per attempt (DBA found no such INSERT) — one-line cleanup candidate.

## KAN-274 — PRE-LAUNCH: mobile relay-token reveal + verification-call coordination flow (corrected scope: UG visibility-change relay)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Mobile grep across `/Users/ife/replant/src` for relay_token / relayToken / visibility_change_relay / VisibilityChangeLobby|Active|Complete / fn_validate_relay / verification_call: ZERO hits — matches the 2026-07-01 audit. Only adjacent surfaces exist: `src/screens/onboarding/NameVisibilityChoiceScreen.tsx` (one-shot signup choice) and `src/components/underground/VisibilityFlipModal.tsx` (post-flip notice; does not participate in the call).
- No `visibility_change_relays` (or relay/mint) migration in `supabase/migrations/`; no mint endpoint in admin `netlify/functions/` (origin/main ls-tree).
- Admin-side artifacts exist but are end-to-end dead per the DBA ground-truth comment: `fn_validate_relay_token` (mirrored `20260623_0008:496-520`) reads `relay_token_hash` off a pending visibility_override proposal that no flow ever writes pre-validate; FE sends null hash. 0 VO proposals and 0 non-null hashes in prod.
- RFC status: corrected scope + 5 Founder ratifications are locked in the ticket (UG-only, 4-digit, reverse-digits duress convention, hybrid leader-initiated, new relay table recommended) — design ready, zero implementation.
MISSING: everything in done-criteria 2-6 — mobile 3-screen stack, mint/arm/state-machine BE + relay table, admin readiness surface, e2e smoke
DEPLOYED: n/a
NEEDS-LIVE-DB: none (DBA already confirmed prod state in-ticket)
NEEDS-SIM: none (nothing to sim)
RECOMMENDED LANE: To Do (Founder ruled PRE-LAUNCH must-be-in-for-test; RFC is ratified so it is build-ready, not Backlog-shaped)
COMMENT-FACTS:
- Zero mobile code, zero relay schema, zero mint endpoint — unbuilt on every surface; only the (broken) admin validate modal exists.
- Existing VisibilityOverrideModal + fn_validate_relay_token are a permanent no-op chain until the mint/relay table from the ratified RFC lands.
- Done-criterion 1 (RFC ratified) is complete: corrected scope + 5 ratifications locked 2026-06-27; remaining criteria 2-6 all open.

## KAN-284 — approve-admin-promotion never auto-sets is_underground_admin (conditional always false)
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- `approve-admin-promotion.js:87-104` (origin/main via PR #70): the always-false `(data||'').toString()==='super_admin'` conditional is gone — UG auto-grant is UNCONDITIONAL with an in-code KAN-284 rationale block, merging app_metadata to preserve admin_tier.
- Follow-up (dual-source) also in: `:112-123` flips `public.users.is_underground_admin` column (the one `fn_assert_underground_admin()` actually reads), then invalidates sessions via admin DELETE `/users/:id/sessions` so the fresh JWT mints correctly.
- Sister syncs verified: `demote-admin.js:101-115` and `revoke-admin-tier.js:94-108` clear BOTH app_metadata claim and column.
MISSING: n/a
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Root cause (RETURNS void RPC vs string compare) eliminated; auto-grant now unconditional per the 2026-06-26 sponsor-flow-only ruling.
- Both sources synced on approve (JWT app_metadata + public.users column) + session invalidation; demote/revoke symmetrically clear both.
- +totadmin's manual MCP patch masked the first end-to-end test — one fresh invite → sponsor → approve ceremony would demonstrate the fixed path cleanly, but the code path is verified.

## KAN-285 — grant-admin.js is_underground_admin dual-source sync → re-scoped to "delete dead code"
CURRENT LANE: TESTING
VERDICT: BUILT
EVIDENCE:
- `netlify/functions/grant-admin.js` ABSENT from origin/main function tree (ls-tree) — deleted.
- `tests/functions/` contains no grant-admin.test.js — deleted.
- `src/lib/api.js:365` tombstone comment "KAN-285 (2026-06-29) — grantAdmin wrapper REMOVED"; no grantAdmin export remains (grantAdminToExisting at :425 is the separate, legitimate existing-leader path).
- `GRANT_ADMIN: 'grant-admin'` KEPT in both `netlify/functions/_lib/action-names.js:24` and `src/lib/action-names.js:27` (+ humanisation row :122) for historical audit_log integrity — exactly per the re-locked scope.
MISSING: n/a
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Endpoint + test + FE wrapper all deleted on deployed main; GRANT_ADMIN enum retained for audit-history rendering.
- The c.12549 phantom-column question is moot — zero callers remain; all super_admin grants flow through invite → sponsor → approve, which syncs both is_underground_admin sources (KAN-284).

## KAN-286 — UG Detail "Verification Progress" panel only shows in-flight proposal; expected full history thread
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- The full-history thread is ALREADY BUILT and deployed, pre-dating this ticket: `VerificationTimeline.jsx` (P19, commit 3fb0a44, 2026-06-26, on origin/main) — curated 21-action label set (propose/confirm × 6 actions, counter/cancel/decline, deactivate, hard-delete, restore, legacy), newest-first, in-flight row on top, history list below; wired in `UndergroundDetail.jsx:42,196-197,747-755`. The ticket's 3 open design questions were already answered by the 2026-06-26 Founder-ratified shape (curated set — request-info and admin notes deliberately excluded because they have their own panels; newest-first; in-flight row sits above history).
- The bug is the DATA PATH, not a missing panel: `fetchVerificationTimeline` (`VerificationTimeline.jsx:90-101`) reads `audit_log_underground` DIRECTLY from the browser client and silently returns `[]` on any error (`if (error || !Array.isArray(rows)) return []`). The in-flight proposal on UG-A972 necessarily has its own `underground_propose_verify` audit row (RPC writes audit before returning) — that row not appearing in history means the client SELECT is being denied/empty, most plausibly missing RLS SELECT for admin JWTs on `audit_log_underground` (table + policies live only in the unmirrored 2026-06-23 wave; no policy exists in any mirrored migration).
MISSING: working history data on prod (root cause to confirm live); error-swallow makes the failure invisible
DEPLOYED: yes (panel); data path broken per Founder's 2026-06-29 smoke
NEEDS-LIVE-DB: `SELECT polname, cmd, roles, qual FROM pg_policies WHERE schemaname='public' AND tablename='audit_log_underground';` · then as an admin-JWT (not service-role): `SELECT count(*) FROM audit_log_underground WHERE action LIKE 'underground_propose%';` — 0 rows via JWT with >0 via service-role confirms RLS denial
NEEDS-SIM: none (repro is on the deployed dashboard: open any UG detail with a proposal — history should at minimum echo the propose event)
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- History thread UI already exists (P19 timeline, live since 06-26) with the ticket's design questions pre-answered by Founder ratification — this is not a design-scoping ticket anymore.
- Symptom indicates the client-side audit_log_underground read silently returns empty (likely missing/mis-scoped RLS SELECT for admin JWTs); the fetch swallows errors so it looks like "no history".
- Note: admin notes will NEVER appear in this thread by ratified design — they live in the Admin Notes panel; expectation-setting for re-test.
- Fix shape options: add the RLS SELECT policy for UG admins, or (better per console-opacity doctrine KAN-289) move the fetch behind a makeUndergroundGatedHandler BE endpoint.

## KAN-288 — UG endpoint audit — verify every BE function reading UG data also checks is_underground_admin
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- The two sweep-flagged gaps are fixed and DEPLOYED in origin/main (PR #73 squash 1108fe5): `read-region.js` now `makeUndergroundGatedHandler` tier 'browse' with in-file P0-3 rationale (was verifySuperAdmin alone, no AAL2) and audit-before-return; `underground-oversight.js` same wrapper tier 'browse' (was AAL2-only, no UG claim).
- Independent full sweep of origin/main confirms coverage: 29 fns behind makeUndergroundGatedHandler (27 in tree + the 2 PR #73 conversions); `list-underground-churches.js` verifySuperAdmin + inline `is_underground_admin` claim check at :191; `decline-underground-proposal` is a dataless 410 stub; `pending-leaders.js` excludes UG at query level; `list-pastoral-queue.js:140` + `list-flagged-messages.js:229` filter UG both directions; `church-intake.js:97` rejects UG; escalated family is UG-aware (`list-escalated-cases` uses isUndergroundAdmin + bucketed omitted_underground_count; `reach-out-to-leader-from-{case,message}` hard-403 UG targets for non-UG admins at :141-142/:135-137; `propose-escalated-action.js:180-183` blocks UG identity leakage in reasoning); scheduled fns service-role by design.
- Residual stragglers (honest): (1) `update-church-details.js` — verifySuperAdmin + TIER-1 step-up but NO is_underground_admin check and no `type='underground'` exclusion: a non-UG super_admin who knows a UG church UUID can WRITE to the UG row (including flipping `type`, which would strip UG protections). Response leaks no data (returns changed-keys only), so it is a write-surface gap, not a read unmask — but it violates the ticket's "every endpoint that touches type='underground'" model. (2) `read-heartcry.js` — verifySuperAdmin + AAL2 life_safety (90s), no UG claim; touches heartcry (not underground_*) so outside this ticket's literal scope, noting because the ticket listed it as a candidate.
MISSING: update-church-details UG-write guard (follow-up-sized; not a read leak)
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (file the update-church-details UG-write guard as its own small ticket)
COMMENT-FACTS:
- Sweep executed + both flagged P0 gaps (read-region full de-mask, underground-oversight) closed via makeUndergroundGatedHandler tier browse — live on deployed main 1108fe5.
- Independent re-enumeration of every UG-touching fn on origin/main confirms the posture matrix; DB-side companion fixes (get_open_prayers, get_prayer_wall, find_similar_churches) are mirrored in the mobile repo migrations.
- One residual: update-church-details permits writes to UG church rows on super_admin + step-up alone (no UG claim, no type exclusion) — no data returned, but recommend a one-line UG guard or gated-handler conversion as follow-up.
- read-heartcry gates at life_safety 90-sec without a UG claim — by design (separate surface), recorded for completeness.

## KAN-246 — [POST-MVP] Tiered AAL2 / TOTP freshness — 30min browse / 5min destructive for admin underground surface
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (goal fully delivered by the locked 4-tier implementation — Option C+ commit 82bddd7 2026-06-27 + PR #73)
EVIDENCE:
- FE: `src/lib/aal2.js:26-35` ships `TOTP_FRESHNESS_BROWSE_MS` (30min — the exact constant the ticket specs) + REGULAR (30min) + SENSITIVE (5min) + LIFE_SAFETY (90s) with `TIER_WINDOW` map; `isAal2Fresh(session,{tier})` defaults to browse and fails closed on unknown tiers (:131-134).
- BE mirror: `_lib/aal2-check.js` 4-tier windows (locked ruling cited in-file), default sensitive_destructive fail-closed; `makeAal2GatedHandler` + `makeUndergroundGatedHandler` accept `tier` (aal2-gate.js:89,105; underground-admin-gate.js:74-78).
- Tier assignment across UG surface matches/supersedes the ticket's table: browse on all UG reads (list-pending/deactivated/oversight/read-region/claim/release/request-release/narrative-note/notes-thread/info-thread/inbox/admins/siblings-list/evidence-intent/signed-url); sensitive_destructive 5-min on propose/confirm/counter/hard-delete/initiate-restore/confirm-restore/force-unmark (+ validate-relay-token via fail-closed default); regular_destructive 30-min on request-info/evidence-confirm/-delete/sibling-approve/-reject per the NEWER locked 4-tier ruling; Heartcry went STRICTER than the ticket (life_safety 90s on read-heartcry + approve-heartcry-feed).
- Re-challenge A/C: `src/lib/elevation.js` reactive interceptor catches stale_aal2/AAL2_EXPIRED/AAL2_REQUIRED/aal2_expired_life_safety → single-mount TotpChallengeModal, dedupes concurrent hits — the "modal re-challenges on lapsed freshness" behavior, delivered globally instead of per-modal.
- PR #73 added the server-side freshness checks the ticket's model implies to 4 more actions: deactivate-church/reinstate-church/rag-override (sensitive 5-min) + approve-heartcry-feed (90s).
MISSING: n/a for the goal; two tier assignments diverge from the ticket's 2026-06-23 table by design of the newer ruling (request-info at 30-min regular_destructive, not 5-min) plus one worth a second look: cancel-underground-proposal runs at tier 'browse' (30-min) — a mutation, albeit proposer-only self-rescind behind the UG gate + rate limit
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (close as delivered-by-supersession; if the cancel-at-browse tier bothers SEC, that is a one-line follow-up, not a reopen)
COMMENT-FACTS:
- The ticket's Option-2 goal shipped 2026-06-27 as the richer locked 4-tier system (browse 30m / regular 30m / sensitive 5m / life-safety 90s), FE + BE mirrored, default fail-closed.
- Every UG list/read runs browse 30-min; every two-eyes destructive runs 5-min server-checked; Heartcry ended up stricter (90s) than the ticket's "stay 5 min".
- Global reactive re-challenge (elevation interceptor + TotpChallengeModal) replaced the per-modal tier-hint design — same UX outcome, single implementation.
- Two deliberate divergences from the 06-23 table under the newer ruling: request-info at regular_destructive 30-min; cancel-proposal at browse 30-min (proposer-only self-rescind) — flag the latter to SEC if desired.
- Label/lane housekeeping: ticket is labeled post-mvp but its scope is already live in production.
