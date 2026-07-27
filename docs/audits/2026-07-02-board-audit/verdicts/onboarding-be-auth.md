# Cluster: onboarding-be-auth — 15 tickets (audited 2026-07-02)

Repos read-only. Mobile truth = `feat/kan-296-mobile-attribution-slot` tree; admin truth = `origin/main` (1108fe5). No DB/network calls made.

---

## KAN-38 — Login Screen — Sign In with Status Routing
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- `/Users/ife/replant/src/screens/onboarding/LoginScreen.tsx` — Screen 06 complete: anti-enumeration single copy `ERROR_INVALID_CREDS` (line 60), network + rate-limit copies (61–62), `inFlight` ref submit gate, `secureTextEntry` + SHOW/HIDE reset on submit, both-fields-required `canSubmit` (98), links → ForgotPassword (184) + DeclarationOfFaith (188).
- `/Users/ife/replant/src/contexts/AuthProvider.tsx` — SIGNED_IN → `callAuthStatusCheck` always runs post-credential (445–448); deactivated response → `DeactivationModal` + signOut (284–315; modal mounted App.tsx:124 — KAN-36 v2 modal replaced the routed popup).
- `/Users/ife/replant/src/navigation/RootNavigator.tsx:65-148` — branch routing: active|pending → Tabs, unauthenticated → Login, password_recovery → SetNewPasswordScreen.
- 06A `ForgotPasswordScreen.tsx` + 06B `SetNewPasswordScreen.tsx` (3 states form/success/expired) + PKCE Linking handler `App.tsx:38-64` + `flowType: 'pkce'` `src/lib/supabase.ts:79` — the full 06/06A/06B flow from PRs #29/31/33/36/37 verified present in tree.
MISSING (micro-gaps, not blocking): (1) show/hide does NOT revert on app-background — no AppState listener in LoginScreen (0 grep matches); submit-revert only. (2) AC "status-check 5xx → signOut + 'Something went wrong'" superseded by SEC ruling 11015 #3a — 5xx retains session, falls back to gated `pending` branch with 3s retry (AuthProvider 263–281). (3) KAN-87-inherited AC-10/12 runtime captures (tab exercise + network capture) not evidenced on ticket.
DEPLOYED: mobile-tree (FE); auth-status-check edge fn deployed (v8-era code in `supabase/functions/auth-status-check/`)
NEEDS-LIVE-DB: none
NEEDS-SIM: UAT pass on full login flow 06/06A/06B (last SM stamp: "Founder Done after UAT pass")
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Screen 06 shipped across PRs #29/31/33 (merge 524b755, a277578, 5ab7413); 06A/06B + PKCE handler via #36/#37 (28ce180) — all verified in current tree.
- Anti-enumeration verified in code: all credential errors map to one string (LoginScreen.tsx:60,127–171).
- Status routing is AuthProvider-owned: login never navigates; branch flips on auth-status-check result; deactivation surfaces as modal per KAN-36 v2 (supersedes this ticket's popup AC).
- Two AC deviations: no app-background mask revert; 5xx-on-status-check now retains session per SEC 11015 #3a (deliberate re-ruling, fail-safe to gated pending).
- Remaining gate is UAT execution only — code-complete since 2026-05-20.

---

## KAN-39 — Forgot Password — Request Reset Email
CURRENT LANE: In Progress
VERDICT: BUILT (and formally superseded — Founder cancel pending per SM 2026-05-21)
EVIDENCE:
- `/Users/ife/replant/src/screens/onboarding/ForgotPasswordScreen.tsx` — 2 states (form/success); `resetPasswordForEmail(email, { redirectTo: 'replant://reset-password' })` (82–84); anti-enumeration: `finally → setViewState('success')` regardless of outcome (91–95); back-to-sign-in routes to Login (98–102).
- `src/lib/supabase.ts:79` `flowType: 'pkce'` + `App.tsx:38-64` deep-link handler — PKCE remains the LIVE production flow; `verifyOtp` has 0 matches repo-wide, so KAN-198's OTP replacement is NOT implemented.
MISSING (AC deviations in shipped code): rate-limit copy AC ("Too many requests…") and network-failure copy AC ("No connection…") NOT implemented — ALL errors are swallowed into the success state (stronger anti-enumeration, weaker feedback); submit gated on EMAIL_REGEX format (AC specified value-only gate); success copy wording differs slightly from AC string.
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Review — Founder ratifies close-out path (SM 2026-05-21: "Founder to cancel this ticket. KAN-198 is the active path"; KAN-198 BA options a/b/c). Note: until KAN-198 ships, THIS ticket's PKCE flow is what production runs.
COMMENT-FACTS:
- 06A request-reset flow is live on main (PR #36 lineage) and is the current production password-reset entry.
- Shipped error posture diverges from AC: every failure (rate-limit, network, unknown email) lands on the same success view — deliberate anti-enumeration hardening beyond spec.
- Ticket declared superseded by KAN-198 (Email OTP, Founder ruling 2026-05-20); KAN-198 verified NOT built (flowType 'pkce' still set; no verifyOtp anywhere) — PKCE deep-link remains live.
- Close-out decision owed: cancel vs absorb (KAN-198 BA comment options a/b/c). Cancelling while KAN-198 is unbuilt leaves the live flow tracked only by KAN-198.

---

## KAN-41 — Session Restoration on App Launch
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- `/Users/ife/replant/src/contexts/AuthProvider.tsx:358-403` `initialize()` — getSession from SecureStore-backed storage; no session → `unauthenticated`; session present → `callAuthStatusCheck` ALWAYS runs (valid JWT never sufficient alone).
- 401 path → ordered clear-and-route SEC 11015 #4 (abort in-flight → clear memory → signOut/SecureStore wipe → branch flip) at 192–215; cross-endpoint 401 listener 469–471; AppState 'active' re-check 455–463 (lag-window catcher, DBA 10924).
- `src/lib/supabase.ts:67-79` — `storage: secureStorageAdapter` (AES-key-wrapped SecureStore), `autoRefreshToken: true`, `persistSession: true`.
- Deferred offline-signout revocation (SEC KAN-41 ruling): `PENDING_SIGNOUT_KEY` retry on launch (AuthProvider 364–373) + `src/utils/signOutAndClear.ts`.
- Session config applied per ticket OPS comments 2026-05-05: 7-day time-box, single-session OFF (multi-device per v2 §15), compromised-refresh-token detection ON — dashboard config, documented on ticket.
MISSING: none functional. One AC superseded: "network failure during status check → route to Login" replaced by SEC 11015 #3a — session retained, cold-start falls back to gated `pending` branch (initialize 395–401); no silent unverified access (pending is RLS/edge-fn gated everywhere).
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: cold-start restore + airplane-mode launch check if formal QA evidence wanted (behavior exercised daily on Founder device)
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Full restoration sequence shipped in AuthProvider: SecureStore session → refresh via SDK → mandatory auth-status-check → branch routing; expired/revoked JWT (401) triggers ordered clear-and-route.
- SEC 11015 superseded the network-failure AC: 5xx/network keeps session and falls back to the gated pending branch instead of bouncing to Login — fail-safe, not fail-open.
- SecureStore adapter is AES-key-wrap (`src/lib/secure-storage.ts`), not plaintext AsyncStorage; autoRefreshToken + persistSession on.
- Offline-signout deferred revocation (SEC mitigation) implemented via PENDING_SIGNOUT_KEY retry at launch.
- Supabase session config (7d time-box, multi-device) applied + documented on ticket 2026-05-05.

---

## KAN-61 — [KAN-37a] Verification Deadline Sweep Cron
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No verification-sweep pg_cron job or function anywhere: `cron.schedule` appears only in kan137 pastoral digest, 20260623_0007 hard-delete sweeper, 20260623_0008 proposal lifecycle, 20260624000008 admin-tier sweeper migrations.
- Pre-UAT audit (`docs/audits/2026-07-01-pre-uat-comprehensive-audit.md` line 359) enumerates live cron/maintenance fns: `scrub_user_pii`, `scrub_church_pii`, `fn_hard_delete_expired_soft_deletes`, `expire_*` — no verification sweep fn exists on prod as of 2026-07-01.
- The login-time half of the KAN-36 Option B pair EXISTS: `auth-status-check` `deactivateAtomically` (handler.ts:115-121) — atomic users UPDATE + audit_log `deactivate_user` / `meta.trigger:'login_check'` (logic.ts:373-386). Users who never log in stay pending-past-deadline in the DB.
- No "Account deactivated" / "Co-leader departed" Resend sends anywhere (grep across supabase/ + docs/emails/: 0 matches beyond unrelated kan69 text).
MISSING: the cron job itself; both Resend emails; `triggered_by` cron-path audit entries. Note the 2026-06-18 resolver ruling changed the target set: verified-church pending leaders have NO deadline (admin owns transition), skip leaders have a 7-day user-side deadline, pending-church leaders the 30-day church deadline — a sweep must be designed against the v8 matrix, not this ticket's 2026-05 text.
DEPLOYED: n/a
NEEDS-LIVE-DB: `SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;` — confirm no unmirrored verification-sweep job on prod (repo mirror is incomplete pre-2026-05-12).
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Sweep cron never authored; only login-time Option-B deactivation exists (auth-status-check atomic flip + audit row).
- Consequence: a pending leader past deadline who never opens the app is never deactivated and never emailed.
- Neither deactivation email exists (Account deactivated / Co-leader departed — copy was approved 2026-05-03 but no template or send path shipped).
- Ticket needs re-scope before build: the 2026-06-18 auth-status-check root-fix exempted verified-church pending leaders from any deadline, so the sweep predicate in the AC is stale.

---

## KAN-62 — [KAN-37b] Verification Reminder Emails — Day 23 / Day 29
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `email_log` table IS live (created v1.21.0 per DBA ticket comment 2026-05-02; independently proven by `supabase/migrations/20260512000000_kan137_pastoral_digest_v1.sql` which ALTERs `email_log` adding `outcome`) — the idempotency substrate exists.
- No reminder cron, function, or template anywhere: grep `verification_reminder|reminder_7d|reminder_1d` across mobile supabase/ → 0; admin origin/main scheduled functions are only `scheduled-underground-evidence-exif-scrub.js` + `scheduled-underground-orphan-bytes.js`.
MISSING: Day-7 and Day-1 triggers, sends, audit entries, idempotency wiring — the entire deliverable except the `email_log` table.
DEPLOYED: n/a (email_log table live; feature absent)
NEEDS-LIVE-DB: `SELECT jobname FROM cron.job;` — confirm no unmirrored reminder job.
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Only the `email_log` idempotency table shipped (v1.21.0, live — kan137 migration alters it); zero reminder logic exists.
- No pg_cron job, no edge function, no Resend template for day-7/day-1 warnings in either repo.
- Same re-scope caveat as KAN-61: reminder predicates must follow the v8 auth-status-check deadline matrix (church-deadline vs 7-day skip vs no-deadline Leader N).

---

## KAN-63 — [KAN-37c] PII Scrub Cron — 90-Day Post-Deactivation
CURRENT LANE: TESTING
VERDICT: BUILT (first-run verification evidence never posted)
EVIDENCE:
- `scrub_user_pii()` + `scrub_church_pii()` confirmed LIVE on prod 2026-07-01: pre-UAT audit line 359 names both as live cron/maintenance fns (with a P3: they're anon-EXECUTEable with no internal gate — REVOKE recommended as defense-in-depth).
- Ticket DBA BUILD SUMMARY 2026-05-18: migration `kan63_pii_scrub_cron_v1` applied via MCP (`success: true`); `cron.job` registry jobid 2 `church-pii-scrub` 03:15 UTC + jobid 3 `user-pii-scrub` 03:16 UTC, both `active = true`. (Migration is NOT in the repo mirror — applied via apply_migration; mirror discipline started later. Absence of file ≠ not applied here; live-fn evidence above covers it.)
- Founder ruling 2026-05-18 on ticket: dual retention windows intentional (deactivated 90d + rejected 7d).
MISSING: nothing structural. Open items: (a) first-clean-run `cron.job_run_details` check never posted (last ticket comment 2026-05-23: "Not tested."); (b) cosmetic ROW_COUNT-after-LOOP logging bug (DBA Finding 1) — no fix migration found; (c) schedule is 03:15/03:16 UTC not the AC's 02:00 (staggered per dispatch — fine).
DEPLOYED: yes (live DB functions + registered cron jobs)
NEEDS-LIVE-DB: `SELECT jobid, jobname, status, return_message, start_time, end_time FROM cron.job_run_details WHERE jobname IN ('church-pii-scrub','user-pii-scrub') ORDER BY start_time DESC LIMIT 10;` and `SELECT count(*) FILTER (WHERE meta->>'scrub_type'='church_pii') AS church, count(*) FILTER (WHERE meta->>'scrub_type' IN ('user_pii','user_pii_90d')) AS "user" FROM public.audit_log WHERE action='pii_scrubbed' AND triggered_by='cron';`
NEEDS-SIM: none
RECOMMENDED LANE: Testing (stay) — one live query closes it to Done.
COMMENT-FACTS:
- Both scrub functions + both cron registrations live since 2026-05-18 (jobids 2/3, 03:15/03:16 UTC, active) — independently re-confirmed live by the 2026-07-01 pre-UAT audit.
- 7-day rejected window Founder-ratified 2026-05-18 alongside the 90-day deactivated window.
- Done gate = one `cron.job_run_details` query showing a clean run; never executed (ticket note 2026-05-23 "Not tested.").
- Follow-ups spotted: pre-UAT P3 recommends REVOKE anon/authenticated EXECUTE on the scrub fns; cosmetic loop-count logging bug still unfixed.

---

## KAN-84 — [QA] auth-status-check edge-case follow-up — deactivated church + TZ day-boundary
CURRENT LANE: Backlog
VERDICT: NOT_BUILT (ticket = test execution + SPEC ruling; none of it happened — 0 comments)
EVIDENCE:
- No SPEC v2.5 §03 ruling, no SEC JWT mint, no DBA fixtures, no QA curl-and-capture on the ticket (comments: 0). All eight sign-off-chain steps unstarted.
- Category 2 (TZ/day-boundary) is now partially covered at UNIT level by the v8 function: `supabase/functions/auth-status-check/logic.test.ts:58-102` (deadline==now→0, 24h→1, 23h59m→0, TZ-equivalent equality, floor semantics) and `:175` "pending + deadline exactly now returns past-deadline write" — the predicate is locked `dl <= now` (deactivate side, matching the BA lean). Live integration tests never ran.
- Category 1 (deactivated church + VERIFIED user) is STILL A LIVE GAP: `resolveStatus` returns `active` for a verified user with no church-status check (logic.ts:150); admin `deactivate-church.js` (origin/main) updates ONLY the churches row — no leader cascade; no cron flips the leaders. A verified leader at a deactivated church keeps active status indefinitely. (The PENDING-user variant IS handled: church rejected|deactivated → deactivated/support_contact, logic.ts:253-259.)
- Category 3.1 (pending + NULL church) is now a legitimate designed state (skip-flow, user-side 7-day deadline — logic.ts:210-233), superseding the "anomaly" framing.
MISSING: everything the ticket asks for; plus the C1 behavior question it was created to settle remains unresolved in code.
DEPLOYED: n/a
NEEDS-LIVE-DB: none (the gap is verifiable in code; a live PoC would be: deactivate a test church, call auth-status-check as its verified leader, observe `active`)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (re-scope against the v8 contract; C1 is the substantive remaining risk)
COMMENT-FACTS:
- Zero execution: no SPEC ruling, no JWT mint, no fixtures, no test runs since filing (2026-05-18).
- The function was rewritten under it (v8 comprehensive matrix 2026-06-18): boundary semantics now locked `deadline <= now` with unit coverage; skip-flow NULL-church is a designed state.
- Highest-priority variant (deactivated church + verified leader) is still unhandled: resolver returns `active` without a church check and deactivate-church has no leader cascade — the exact case QA refused to wave past in KAN-44 c.10951.
- Recommend re-scoping the ticket to: (1) SPEC ruling on C1, (2) resolver branch or deactivation cascade, (3) live test — drop the stale C2/C3 items already covered by v8 unit tests and design.

---

## KAN-194 — Day-7 unregistered account scrub — pg_cron + audit literal + SEC remediations (D-67)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `account_scrubbed_unregistered` literal: 0 matches anywhere in supabase/ (constraint never extended; audit literal absent from the 20260623_0005 and 20260701000004 audit-action migrations).
- No 7-day unregistered scrub cron or function exists. The nearest mechanism, `fn_hard_delete_expired_soft_deletes` (20260623_0007), deletes public.users + auth.users with pre-delete audit — but only for `hard_delete_scheduled_at` rows (soft-delete lifecycle), NOT the `church_id IS NULL AND pending AND created_at <= now()-7d` predicate.
- Partial goal coverage by different design: create-account sets a 7-day `users.verification_deadline` for skip leaders (`SKIP_VERIFICATION_WINDOW_DAYS = 7`, create-account/logic.ts:246-248); auth-status-check deactivates past-deadline skip leaders at login (isSkipFlow → support_contact). Deactivation-at-login only — no scrub/DELETE, and never-logging-in accounts persist.
- SEC remediation 3 (re-registration friction) was never ratified (build dispatch was HELD on it); remediation 4 is moot-by-absence — `check-email-available` returns bare `{available: boolean}` (logic.ts:6) and no scrub state exists to leak.
MISSING: AC 1–9 in full (cron, delete order, pre-scrub audit, SECURITY DEFINER hardening, friction, constraint literal).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Nothing from D-67 shipped: no cron, no audit literal (constraint check confirms absence), no friction mechanism, no delete-order function.
- The 7-day window IS enforced at login via the skip-flow deadline + auth-status-check atomic deactivation — but that deactivates, never scrubs, and misses accounts that never sign in.
- Build was formally HELD on SEC ratifying the re-registration friction mechanism (AC 5) — that ratification never happened.
- Re-evaluate scope before build: the soft-delete → hard-delete sweeper (20260623_0007) now provides a deletion lifecycle the D-67 design predates; the unregistered scrub could route through `hard_delete_scheduled_at` instead of a new bespoke cron.

---

## KAN-195 — Pending state action gating — verification_status + RLS + edge function guards (D-68/D-70/D-71)
CURRENT LANE: Backlog
VERDICT: BUILT (layered mechanism, equivalent-or-stronger than the specced WITH CHECK approach)
EVIDENCE:
- Edge-fn guards (AC 5): `submit-heartcry/logic.ts:145`, `send-message/logic.ts:146` (sender) + `:248` (recipient), `send-branch-message/logic.ts:87` — all `verification_status === "verified"`.
- DB write gates (AC 4): `create_prayer_request` raises `not_verified` (20260528000003:27); prayer-request write RPCs check verified (20260605000010:85); `post_comment` verified+active (20260602000002:110).
- Direct-write bypass closed: `20260702031830_harden_client_write_surface…` REVOKEs INSERT/UPDATE/DELETE on `prayer_requests, testimony, messages, connection_requests` + `churches` from anon/authenticated — all writes forced through the gated RPC/edge-fn layer (stronger than per-policy WITH CHECK).
- Persecuted hard block (AC 2/6): FE `PersecutedScreen.tsx:93` — `verification_status !== 'verified'` → gated view; BE heartcry feed RPC verified-caller gate returns empty for non-verified (20260528000008:62-68). Defense in depth present.
- Lookup gates (AC 3): non-UG — `churches.church_code` NULL until verification (D-71 reading (b) migration applied live 2026-05-20 per ticket) + `search-churches` code-path lookup (`.eq("church_code", …)`, index.ts:111); UG branch superseded — `redeem_underground_join_code` ceremony with post-verification reveal (`underground_join_code_revealed_at`; `isUndergroundJoinCodePendingReveal` requires church verified) replaced the `underground_network_id` predicate (KAN-182 path).
- AC 1 allowances hold: pending leaders keep own-profile read/update (users_select_own/update_own preserved; privileged columns write-revoked by P0-2), auth-status-check countdown + VerificationBanner, read-only announcements/prayer-wall reads.
MISSING: none material. AC 7 honored (enum unchanged: pending|verified|rejected|deactivated).
DEPLOYED: yes (migrations mirrored = prod; edge fns deployed; FE mobile-tree)
NEEDS-LIVE-DB: none
NEEDS-SIM: pending-account sentinel pass — attempt prayer post / DM / heartcry / Persecuted tab on a pending test account; expect all four gated.
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Full pending-vs-verified gating matrix is live: edge-fn verified checks (heartcry/DM/branch-DM), RPC verified predicates (prayer post/comment), and the 2026-07-02 client-write REVOKE sweep closing direct-INSERT bypasses.
- Persecuted tab is hard-blocked both sides: FE gate on users.verification_status + BE heartcry-feed RPC returns empty for non-verified callers.
- Non-UG lookup gate live via church_code-NULL-until-verified (D-71 reading (b), applied 2026-05-20); UG branch shipped as the join-code ceremony (reveal only post-verification) instead of KAN-182's underground_network_id — same goal, different mechanism.
- Specced RLS WITH-CHECK approach was replaced by SECURITY DEFINER RPCs + grant revocation — strictly stronger posture (pre-UAT P0-2 remediation lineage).

---

## KAN-198 — Password Reset — replace PKCE deep-link with Email OTP (pre-launch blocker)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `src/lib/supabase.ts:79` — `flowType: 'pkce'` still present (AC 9 not done).
- `App.tsx:38-64` — PKCE Linking handler + `exchangeCodeForSession` still present (AC 8 not done).
- `src/screens/onboarding/ForgotPasswordScreen.tsx` — 2 states only (form/success); CTA is "Send Reset Link" flow with deep-link `redirectTo`; no code-entry state, no numeric input, no `verifyOtp` — `verifyOtp` has 0 matches across src/ (AC 1–6 not done).
- AC 11/12 baseline intact by default: AuthProvider `password_recovery` branch + SetNewPasswordScreen 3-state unchanged.
MISSING: AC 1–10 in full (third screen state, Send Code copy, verifyOtp call, PKCE removal, dashboard template `{{ .Token }}` step).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do (Founder-ruled pre-launch blocker, 2026-05-20; "no launch sign-off until this ships" — only stated gating dep is the UI-UX 06A 3-state design file)
COMMENT-FACTS:
- Zero OTP code exists; production password reset is still the same-device-only PKCE deep-link flow this ticket exists to replace.
- All three PKCE anchors verified still in place: flowType 'pkce' (supabase.ts:79), App.tsx Linking/exchangeCodeForSession handler, ForgotPasswordScreen deep-link redirect.
- This is a Founder-ruled pre-launch blocker (cross-device recovery for persecuted-context leaders) — highest-priority unbuilt item in this cluster.
- Gating dependency per ticket: UI-UX design file for the 3-state 06A; no evidence it was delivered.

---

## KAN-202 — Orphaned church auto-scrub — pg_cron sweep
CURRENT LANE: Backlog
VERDICT: NOT_BUILT (cron); root cause eliminated by the KAN-236 no-orphan refactor
EVIDENCE:
- No orphan-church cron or `church_orphan_purge` literal anywhere in supabase/.
- Root cause gone: `create-account/handler.ts:4-7` — "Church creation moves out of register-church (now validation-only at v6) and into this function's single RPC call to `public.create_account_atomic`" — church + leader written in one transaction; signup can no longer produce orphans. `register-church/handler.ts:1-8` confirms "NO DB WRITE" validation-only mode.
- The ticket's alternative AC (compensating DELETE inside create-account) is moot under atomicity — transaction rollback covers every failure path.
- ASP2 comments confirm the FE Switch/Delete affordance is a pure context-clear (AccountSetupPage2Screen.tsx:611-615) — no orphan row is created to clean.
MISSING: the cron itself (residual value: janitor for pre-refactor legacy rows; 9 were manually swept 2026-05-22).
DEPLOYED: n/a
NEEDS-LIVE-DB: `SELECT count(*) FROM public.churches c WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.church_id = c.id) AND c.created_at < now() - interval '7 days';` — if 0 since the refactor, close as superseded.
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (Low/Post-MVP by its own metadata; candidate for Founder close-as-superseded if the live orphan count is 0)
COMMENT-FACTS:
- Cron never built; but KAN-236's atomic create_account_atomic removed the orphan-generation mechanism entirely (register-church is validation-only, writes nothing).
- The compensating-delete alternative in the AC is structurally covered by transaction rollback.
- One live query decides the ticket's fate: zero orphans since 2026-06-14 → close as superseded; non-zero → a one-shot manual sweep beats building a cron for a dead failure mode.

---

## KAN-206 — Individual leader verification — Leader N joining existing verified church
CURRENT LANE: Backlog
VERDICT: PARTIAL (core workflow BUILT + deployed; AC 6 emails missing; AC 4 semantics superseded)
EVIDENCE:
- Admin queue deployed on origin/main: `netlify/functions/pending-leaders.js` (pending+active leaders at verified non-UG churches, oldest-first, church context fields); FE `src/components/LeadersTab.jsx` (545 lines — name/role/email/masked-phone-with-reveal/church_code columns, edit-pending flow) wired into `src/screens/Queue.jsx`.
- `verify-leader.js` — verifyAnyAdmin + TIER 1 step-up (action-bound token) + PII-scrubbed note + audit-log-FIRST + users mutation; clears `verification_deadline` on verify; fires in-app welcome DM via `claim_welcome_dm`. `reject-leader.js` + `edit-pending.js` (two-gate step-up per SEC ruling) also on origin/main.
- DB: `kan206_leader_verification_audit_actions_v1` applied 2026-05-30 (42→45 literals: verify_leader/reject_leader/edit_pending — DBA-AUDIT on ticket with pre/post/negative tests); action-names.js BE+FE twins + `maskPhone` merged (86239d2) and pushed.
- AC 5 gate enforcement: every verified-leader-only surface checks `users.verification_status='verified'` (send-message, submit-heartcry, heartcry feed RPC, PersecutedScreen:93); no auto-promote path exists anywhere (AC 4 SEC condition satisfied).
- AC 4 superseded: pending leader at a VERIFIED church now has NO countdown — auth-status-check nulls deadline/days ("admin owns the transition", logic.ts:239-251, Founder root-fix 2026-06-18); deactivate-on-expiry no longer applies to Leader N.
MISSING: AC 6 — leader_approved/leader_rejected EMAIL notifications: no Resend template or send in verify-leader.js/reject-leader.js (grep 0); the SM-ruled KAN-143 extension never landed. (AC 1's "days remaining" column is moot post-AC-4 supersession.)
DEPLOYED: yes (admin origin/main + live DB migration)
NEEDS-LIVE-DB: none
NEEDS-SIM: DoD round-trip if not already covered by KAN-218 QA: Leader N signup → queue appears → approve → Persecuted access; and reject → access denied.
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- The security gap this ticket names is CLOSED in production: self-assigned Leader N stays pending with no countdown and cannot reach verified-leader surfaces until an admin verifies via the deployed LeadersTab queue + verify-leader (TIER 1 step-up).
- Full approve/reject/edit workflow live on admin origin/main (KAN-218 implementation); audit literals migration applied + verified 2026-05-30.
- AC 4's 30-day deactivate-on-expiry was superseded by the 2026-06-18 ruling: Leader N has no clock; admin owns the transition; deadline cleared on verify. No auto-promote path exists.
- Open item: approval/rejection emails (AC 6 / KAN-143 extension) never built — leaders currently learn of approval via in-app welcome DM only, rejection silently.

---

## KAN-219 — auth-status-check church_verified field + State B copy across 4 mobile gate surfaces
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (goal met by different design)
EVIDENCE:
- Specced `church_verified: boolean` response field NOT added: absent from `AuthStatusResponse` (auth-status-check/logic.ts:13-51) and the AuthProvider mirror (AuthProvider.tsx:131-153).
- Shipped replacement mechanism: (a) BE resolver — pending leader + verified church → `pending` with NULL deadline/days ("admin owns the transition", logic.ts:239-251); (b) FE hook `src/hooks/useChurchVerifiedStatus.ts` — reads `churches.verification_status` via the users FK join when branch==='pending' (bug-fixed 2026-06-14: rag_status → verification_status).
- State B copy live: `VerificationBanner.tsx:120` 'leader' variant ("…is verified. Your leader access opens once the Replant team confirms your account.") selected by `HomeScreen.tsx:299` `variant={churchVerified === true ? 'leader' : 'church'}`; `TheChurchScreen.tsx:108-114` + `ConnectScreen.tsx:182-188` isLeaderPending ternaries ("Your access is being confirmed." / "…already part of the Replant network. Once the team confirms your account…").
- PersecutedScreen keeps neutral gate copy valid for both states (GATE_LINE_1, PersecutedScreen.tsx:47) — the AC-10-style option (a) resolution applied to that surface.
- Gating dependency satisfied: KAN-218's verify-leader.js is deployed on origin/main, so State B is reachable in production.
MISSING: (as spec'd) the BE field + lockstep-PR contract — replaced, not omitted. CONTENT copy-lock ceremony (AC 11) has no evidence; shipped copy is in-voice but was not run through the specced CONTENT gate.
DEPLOYED: mobile-tree (FE) + deployed edge fn (BE resolver)
NEEDS-LIVE-DB: none
NEEDS-SIM: pending-leader-on-verified-church account → confirm 'leader' banner on Home + State B gate copy on TheChurch/Connect; State A regression on a pending-church account.
RECOMMENDED LANE: Done (as superseded/absorbed — Founder ratify)
COMMENT-FACTS:
- The State B experience this ticket specs is LIVE: pending leader at a verified church sees "your church is in, your account is being confirmed" framing on Home banner, TheChurch, and Connect; Persecuted uses neutral both-state copy.
- Mechanism differs from spec: no church_verified response field — a client hook (useChurchVerifiedStatus) reads churches.verification_status directly, and the BE resolver signals the state via pending-with-null-countdown.
- The 2026-06-14 hook bug-fix (was reading rag_status) is the lineage proof this shipped and was Founder-exercised.
- KAN-218 dependency shipped (verify-leader deployed) — State B is a reachable production state.
- Residual nit: the AC 11 CONTENT lock ceremony has no paper trail; copy shipped in-voice regardless.

---

## KAN-237 — Lock down register-church endpoint to admin-only post no-orphan refactor
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (threat eliminated by different design; specced change unimplemented AND now counterproductive)
EVIDENCE:
- Specced change NOT made: `register-church/config.toml` still `verify_jwt = false` (with a LOAD-BEARING comment requiring a fresh SEC ruling to change); no admin role check in handler.ts.
- Ticket premise stale in two ways: (1) register-church is v6/v7 VALIDATION-ONLY — "Return { valid: … }. NO DB WRITE" (handler.ts:1-8); the unauthenticated `INSERT INTO churches` attack surface the ticket describes no longer exists (church creation lives inside create-account's atomic RPC). (2) The signup flow STILL calls register-church pre-auth for validation (leader has no JWT until ASP2) — flipping verify_jwt=true would break onboarding, and no admin-direct-register caller exists (admin origin/main grep for register-church: 0 matches).
- Residual exposure is the pre-auth validation oracle (similar-church name/city/status), which is per-IP rate-limited and fail-closed (handler.ts:44, pre-UAT-audit remediation).
MISSING: n/a — the described work should not be done as written.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Review — Founder close as superseded (or re-scope to a SEC review of the validation-oracle exposure if wanted).
COMMENT-FACTS:
- The vulnerability this ticket targets (publicly callable church INSERT) was eliminated by the KAN-236 refactor: register-church writes nothing; church creation is atomic inside create-account.
- The specced fix (verify_jwt=true + admin gate) was never applied — and applying it now would break signup, which still calls the endpoint pre-auth for validation.
- No admin-direct-register surface exists; the ticket's "only legitimate remaining caller" assumption never materialized.
- Remaining surface is a rate-limited, fail-closed validation oracle — already SEC-reviewed in the v6/v7 handler lineage; close or re-scope.

---

## KAN-238 — register-church-delete deprecation review (90d post no-orphan refactor)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT (calendar marker — review not yet due)
EVIDENCE:
- KAN-236 shipped ~2026-06-14/18; the 90-day soak ends ~mid-September 2026. Today is 2026-07-02 — inside the soak window, so performing the review now would violate the ticket's own design.
- Endpoint still present and deployed-in-tree: `supabase/functions/register-church-delete/` (verify_jwt=false, KAN-192 handler).
- Zero live callers confirmed: ASP2's Switch/Delete affordance is a pure OnboardingContext clear ("register-church-delete is dead code under the orphan-prevention architecture… Edge function deployment stays one cycle as defense; removed in a follow-up cleanup PR" — AccountSetupPage2Screen.tsx:66-70, 611-615; RegisterChurchPage2Screen.tsx:49); no fetch/URL constant remains.
MISSING: the review itself (correctly — not due).
DEPLOYED: n/a (review); the vestigial endpoint itself is deployed
NEEDS-LIVE-DB: none now; at review time: `get_logs service=edge-function` filtered to register-church-delete over the soak window (per ticket step 1).
NEEDS-SIM: none
RECOMMENDED LANE: Backlog (schedule the review ~2026-09-15)
COMMENT-FACTS:
- Review is intentionally future-dated; soak window runs to ~mid-September 2026 — no action due yet.
- Code-level pre-check already favors retirement: FE has zero callers (context-clear only) and its own comments mark the endpoint dead code pending a cleanup PR.
- At review time: confirm zero 2xx calls in edge-function logs across the soak window, then delete the function dir + `supabase functions delete register-church-delete` + drop any dedicated rate-limit bucket.

---

# Cluster rollup

| Ticket | Lane now | Verdict | Recommended |
|---|---|---|---|
| KAN-38 | Backlog | BUILT | Testing |
| KAN-39 | In Progress | BUILT (superseded — Founder cancel pending) | In Review |
| KAN-41 | Backlog | BUILT | Testing |
| KAN-61 | Backlog | NOT_BUILT | Backlog |
| KAN-62 | Backlog | NOT_BUILT | Backlog |
| KAN-63 | Testing | BUILT (needs first-run query) | Testing |
| KAN-84 | Backlog | NOT_BUILT (C1 gap still live) | Backlog |
| KAN-194 | Backlog | NOT_BUILT | Backlog |
| KAN-195 | Backlog | BUILT | Testing |
| KAN-198 | Backlog | NOT_BUILT (pre-launch blocker) | To Do |
| KAN-202 | Backlog | NOT_BUILT (root cause gone) | Backlog |
| KAN-206 | Backlog | PARTIAL (emails missing) | Testing |
| KAN-219 | Backlog | SUPERSEDED (goal met) | Done |
| KAN-237 | Backlog | SUPERSEDED (threat gone) | In Review |
| KAN-238 | Backlog | NOT_BUILT (not due until ~Sep) | Backlog |

Cross-cutting findings surfaced by this cluster:
1. **KAN-198 is the only unbuilt pre-launch BLOCKER here** — production password reset is still same-device-only PKCE.
2. **No verification-lifecycle crons exist at all** (KAN-61/62/194/202): enforcement is 100% login-time. Leaders who never open the app are never deactivated, reminded, or scrubbed. One consolidated "lifecycle sweep" ticket designed against the v8 auth-status-check matrix would replace four stale ones.
3. **Verified-leader-on-deactivated-church returns `active`** (KAN-84 C1) — deactivate-church has no leader cascade and the resolver never checks church status for verified users. Needs a SPEC ruling + one resolver branch or a cascade in deactivate-church.
4. **Leader rejection is silent** (KAN-206 AC 6) — no email template exists for leader_approved/leader_rejected.
