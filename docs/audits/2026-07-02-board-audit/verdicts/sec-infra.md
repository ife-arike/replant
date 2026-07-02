# sec-infra cluster verdicts — 13 tickets (audited 2026-07-02)

Evidence bases: mobile `/Users/ife/replant` (branch feat/kan-296-mobile-attribution-slot; `supabase/migrations/` = prod mirror), admin `/Users/ife/replant-admin` read via `git show origin/main:` (deployed truth = 1108fe5, PR #73 squash). No DB/network calls made.

## KAN-85 — [OPS] verify_jwt=true load-bearing-security note — deploy-checklist + SECURITY.md
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No deploy-checklist doc exists in either repo (`find` across both for *deploy*check*/*checklist* → only an unrelated `.claude/plans/kan271-uat-retest-checklist.md`).
- `/Users/ife/replant/SECURITY.md` is a stale pre-build placeholder ("No production system exists yet") — no verify_jwt content.
- Admin `SECURITY.md` (origin/main) is the real KAN-46-era policy (admin password reset ops procedure) — zero `verify_jwt` / Edge-Function-auth-pattern section (grep: 0 hits).
- No "10955"/KAN-44 forensics citation anywhere in either repo's docs. No `supabase/config.toml` exists in the mobile repo (verify_jwt is set at deploy time — CLI `--no-verify-jwt` quirk per project memory), which makes the written note the ONLY guardrail — and it doesn't exist.
MISSING: AC-1 (deploy-checklist note — the checklist itself doesn't exist), AC-2 (SECURITY.md note in either repo), AC-3 (cross-refs to SEC 10955/KAN-44/v2 §03), AC-4 (auth-surface fn inventory — 15 edge fns now live incl. auth-status-check), AC-5 (SEC sign-off), AC-6 (deployment).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Neither repo carries the verify_jwt load-bearing note; no deploy-checklist document exists anywhere to host AC-1.
- Mobile SECURITY.md is a pre-build placeholder that predates the entire production system; admin SECURITY.md (KAN-46 era) has no Edge Function auth section.
- Auth-surface inventory has grown to 15 edge functions (`supabase/functions/`) since the ticket was filed — AC-4 list needs re-confirmation at write time.
- Zero-code docs task; all 6 ACs open.

## KAN-86 — [SEC/DBA] Harden custom_access_token_hook to gate super_admin claim on users.is_active
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Latest hook definition = `supabase/migrations/20260625000004_kan271_0035_hook_security_definer_fix.sql:34-38` — `super_admin: true` minted purely from `app_metadata.role = 'super_admin'`; NO `is_active` predicate anywhere (0 hits across all 3 hook migrations 20260624000004 / 20260625000001 / 20260625000004).
- Hook shape has drifted far beyond the ticket's assumptions: it now also mints `is_underground_admin`, `is_top_tier_admin` (read live from `public.users` column), and resolved `admin_tier` — AC-1 DBA introspection must re-run before AC-2/3 wording is valid.
- KAN-44's function-level suspenders remain the only is_active enforcement: `supabase/functions/auth-status-check/index.ts:76,102,121,164` still reads/downgrades on `is_active`.
- Adjacent-but-different: P0-2 guard trigger (20260702031920) now blocks client writes TO `is_active`/`role` columns — it protects the hook's inputs from tampering, but does not gate the claim mint on is_active.
MISSING: AC-1 through AC-15 (all): no introspection comment, no hook predicate, no forward/revert SQL pair, no SEC/Founder sign-off, no local-first tests, no constructed-account post-deploy verification.
DEPLOYED: n/a (nothing to deploy)
NEEDS-LIVE-DB: optional confirm live hook matches repo mirror: `SELECT pg_get_functiondef('public.custom_access_token_hook(jsonb)'::regprocedure);` — grep result for `is_active` (expect 0)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Deployed hook (migration 20260625000004, KAN-271 0035) mints super_admin from app_metadata.role with no is_active gate — ticket's core AC-2 not built.
- Hook has since grown admin_tier / is_top_tier_admin / is_underground_admin mint paths (KAN-271); AC-1 introspection is stale and must re-run before any wording locks.
- Defense-in-depth belt still absent; KAN-44's auth-status-check function-level is_active read remains the sole enforcement (verified present).
- P0-2 (2026-07-02) hardened the hook's input columns against client writes (guard_users_privilege_cols trigger) — related but does not satisfy this ticket.

## KAN-100 — [OPS/SEC] Aggressive refresh-event anomaly detection — new IP/UA on admin_session_refreshed
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Data source shipped (KAN-46 dependency met): `netlify/functions/log-session-refresh.js:44-49` (origin/main) writes `action='admin_session_refreshed'` with `meta.ip` + `meta.user_agent`; action whitelisted at `_lib/supabase-admin.js:60`.
- Zero detection: repo-wide grep for anomaly/known-set/new-IP-UA logic → 0 hits in netlify/ + src/.
- Only scheduled jobs on origin/main are the two UG evidence daemons (`netlify.toml` [functions."scheduled-underground-*"] @daily) — no polling job exists.
MISSING: all 6 ACs — polling job, per-admin known-set (30d), P2 alert trigger + payload, /24 subnet tunable, runbook entry.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Forensic feedstock live since KAN-46: admin_session_refreshed rows carry ip + user_agent on prod.
- No anomaly-detection job, known-set store, alerting, or runbook exists in the admin repo; only scheduled functions are the two underground-evidence cleanup daemons.
- Ticket remains pure forward work; nothing partially started.

## KAN-101 — [Auth/Arch] Server-side per-role refresh TTL — long-term right-fix
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Required first step (DBA + SEC design pass ruling on approaches A/B/C) never ran — 0 comments on ticket, no design memo in either repo.
- Only session-cap enforcement is CLIENT-side: `src/lib/session-watchdog.js:6` `MAX_SESSION_MS = 8h` + `session_cap` reason (line 28) — this is the KAN-46 interim the ticket explicitly builds beyond.
- No per-role exp override in `custom_access_token_hook` (migration 20260625000004 — no exp manipulation), no second Supabase project, no server-side rotation check in any Netlify function.
MISSING: all ACs — design-pass ruling, post-design ACs, implementation, replay validation, audit action name.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Design pass (gate for all other ACs) never executed; no approach chosen among hook-exp / separate-project / app-layer rotation.
- 8-hour cap exists only as the client-side watchdog (KAN-46 interim); an exfiltrated admin refresh token still lives the project-global 168h window server-side.
- Mitigating context since filing: step-up became TOTP-based (Option C+) and destructive surfaces carry 5-min/90-sec AAL2 freshness gates, so the threat-model bar ("step-up is the bar until then") is still the operative posture.

## KAN-107 — Forward-track: Netlify functions smoke harness
CURRENT LANE: Backlog (COO DEFER 2026-05-14 standing)
VERDICT: NOT_BUILT
EVIDENCE:
- No `qa/` dir on origin/main (AC5). CI = `.github/workflows/update-changelog.yml` only (AC7).
- What DOES exist: `tests/functions/` — 21 vitest endpoint contract-test files (announcements, approve-church, reject-church, revoke-admin, read-region, heartcry-inbox, underground-oversight, custom-access-token-hook, etc.), wired into `npm test` via vite.config.mjs test.include.
- Disqualifier vs this ticket's goal: those tests inject FAKE auth deps (e.g. `tests/functions/approve-church.test.js:151` stubs `verifySuperAdmin`), so the real `verifySuperAdmin()` — the exact layer whose silent breakage (KAN-106) motivated this ticket — is never exercised. No 200/401/403 three-caller matrix, no real-JWT smoke.
MISSING: AC1 (17-endpoint sweep — endpoint set is now ~87 functions, so scope itself is stale), AC2 (3-caller auth matrix), AC3 (verifySuperAdmin fail-fast — it is bypassed by fakes), AC4 (SEC test-JWT concurrence), AC5 (qa/ README), AC6 (stamp), AC7 (CI gate).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- The specced smoke harness (real-auth 200/401/403 matrix over verifySuperAdmin endpoints) does not exist; CI runs no tests (changelog workflow only).
- A substantial vitest contract suite (tests/functions/, 21 endpoints + 5 _lib unit suites) shipped since filing, but it stubs verifySuperAdmin — it cannot catch the KAN-106 class this ticket exists for.
- Endpoint inventory grew from 17 to ~87 Netlify functions; AC1's coverage list needs re-scoping before build.
- COO DEFER (2026-05-14) still standing — do not dispatch without COO ruling.

## KAN-109 — Forward-track: TypeScript migration for netlify/functions/_lib/
CURRENT LANE: Backlog (COO DEFER 2026-05-14 standing)
VERDICT: NOT_BUILT
EVIDENCE:
- `git ls-tree -r origin/main` → zero `.ts`/`.tsx`/tsconfig files in the entire admin repo.
- `_lib/` on origin/main = 22 files, all `.js` (incl. `supabase-admin.js`, `validate-step-up.js`, `aal2-check.js`).
- `package.json` scripts = dev/build/preview/test/test:watch — no `typecheck` (AC1.3/1.4).
MISSING: AC1.1–AC1.6 (all of Phase 1); Phase 2 by extension.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Zero TypeScript anywhere in replant-admin on origin/main; no tsconfig, no typecheck script, no CI type gate.
- Partial risk-mitigation arrived by another route: _lib auth helpers now carry vitest unit suites (validate-step-up.test.js, aal2-check.test.js, rate-limit.test.js, audit-meta.test.js) — runtime coverage, not the compile-time goal this ticket specs.
- The auth-critical surface (_lib) has tripled in size since filing (22 modules) — migration cost grows the longer this waits.
- COO DEFER (2026-05-14) still standing.

## KAN-114 — Step-up consumer wiring sweep — FE handlers + BE enforcement
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Gated on origin/main — 9 of the 14 D-43-ratified TIER-1 actions: `approve-church.js:57` + `reject-church.js:46` + `read-heartcry.js` (validateStepUp action-bound; read-heartcry also `checkAal2Freshness life_safety` 90s); `deactivate-church.js:15`, `reinstate-church.js:15`, `rag-override.js:16`, `revoke-admin.js:98` (checkAal2Freshness `sensitive_destructive` 5-min, PR #73); `read-region.js` via `makeUndergroundGatedHandler` (super_admin + AAL2 browse 30-min + is_underground_admin claim, P0-3); `grant-admin` superseded by `invite-admin.js` + `grant-admin-to-existing.js` (BOTH AAL2 + validateStepUp).
- UNGATED — 5 of 14: `delete-announcement.js:8` (verifyAnyAdmin only), `post-announcement.js:77` (verifyAnyAdmin only), `mark-heartcry-responded.js:8` (verifySuperAdmin only), `seed-scripture.js:8` (verifyAnyAdmin only), `clear-flag.js:8` (verifyAnyAdmin only). No FE step-up either (`src/screens/Announcements.jsx`: 0 stepUp/aal2 refs). Note 4 of the 5 accept ANY admin tier.
- The code's own registry contradicts the gap: `_lib/action-names.js` lists all five under "TIER 1 (require step-up)" — drift, not re-design (no re-ratification found).
- Mechanism evolution is SEC-sanctioned: password re-entry → TOTP `mfa.challenge/verify` + AAL2 assertion (Option C+ 2026-06-27, documented request-step-up.js:17-56) + 4-tier freshness (`_lib/aal2-check.js:62-76` = locked 30min/30min/5min/90s ruling).
- Plumbing ACs done: AC5 `src/lib/api.js:37` X-StepUp-Token; AC10 `admin_step_up_reauth` rows (request-step-up.js:122, validate-step-up.js:174); FE `useStepUp(ACTIONS.X)` wired across 25 files (Queue.jsx:86-87, Heartcry, tier/underground/escalated modals).
MISSING: AC2+AC3 for delete-announcement, post-announcement, mark-heartcry-responded, seed-scripture, clear-flag (no FE wrap, no BE validateStepUp/AAL2 gate); escalate-flag TIER 2 unchanged (correct per D-43).
DEPLOYED: yes (all gated wiring is on origin/main = prod)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- 9/14 D-43 TIER-1 actions enforce fresh-credential gates on deployed main (3 action-bound step-up, 5 AAL2-freshness-tier, grant-admin superseded by two dual-gated successors).
- 5/14 have NO step-up or AAL2 gate at BE or FE: delete-announcement, post-announcement, mark-heartcry-responded, seed-scripture, clear-flag — and 4 of those are verifyAnyAdmin (any admin tier), a widened surface vs the D-43 super_admin baseline.
- _lib/action-names.js still declares those five TIER 1 — registry asserts a gate the endpoints don't enforce; classic FE/BE-drift the SEC ratification warned about.
- Step-up mechanism upgraded per Option C+ (TOTP mfa.verify + AAL2 assertion replaces password probe) + locked 4-tier AAL2 freshness — supersedes the ticket's literal password-modal spec, exceeds its intent.
- SM comment 2026-05-10 said "KAN-114 itself remains closed" but live status is Backlog; recommend In Progress with the 5-action residue as the explicit remaining scope.

## KAN-118 — KAN-114 forward-track hardening — shared constants + per-action TTL + request-step-up rate-limit
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Item 1 SHIPPED: `netlify/functions/_lib/action-names.js` (CJS, header: "KAN-118 Item 1") + ESM twin `src/lib/action-names.js`, HARD RULE same-commit banner; consumed by FE requireStepUp call sites and BE validateStepUp expectedAction.
- Item 2 SHIPPED: same module — `STEP_UP_TTL_OVERRIDES_MS = { 'read-heartcry': 90_000 }`, `STEP_UP_DEFAULT_TTL_MS = 300_000`, `ttlForAction()` consumed by request-step-up.js.
- Item 3 SUPERSEDED-IN-MECHANISM, disposition undocumented: Option C+ replaced the password probe with TOTP `mfa.challenge/verify`; request-step-up.js:33-37 header documents Supabase Auth's non-customizable IP token bucket on `/auth/v1/factors/:id/verify` as the rate limit. No app-layer limiter on request-step-up (`_lib/rate-limit.js` exists and gates aal2-gate + 5 list endpoints — request-step-up is not a consumer). No SEC-acceptable-disposition comment on this ticket (AC3's documentation requirement).
MISSING: AC3 (SEC-acceptable disposition documented on ticket — the code comment is not the ticket record), AC4 (SEC re-review per item — KAN-114 c. 2026-05-08 asked Founder+SEC to "confirm or flag" the duplicated-constants approach; no confirmation on file), Item 1 consolidation follow-up (CJS/ESM twins still duplicated).
DEPLOYED: yes (Items 1+2 on origin/main = prod)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Items 1+2 verifiably deployed: shared ACTIONS constants (CJS+ESM twins with hard-rule banner) + per-action TTL with read-heartcry 90s / default 5-min.
- Item 3's threat changed under Option C+: mint path is TOTP mfa.verify (Supabase-side IP token-bucket rate limit, non-customizable), not password signin probe — the brute-force-the-password scenario no longer exists as specced.
- Remaining to close: post the SEC-acceptable Item-3 disposition on-ticket, and SEC confirmation of the duplicated-constants-with-banner approach (or fold into KAN-109 TS literal-union upgrade).
- P1 escalation clause ("no rate limit at any layer") does NOT fire — a layer exists (Supabase Auth) and is documented in code.

## KAN-122 — Forward-track: strict-atomicity SECURITY DEFINER RPC for admin-read Path B endpoints
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No `*_with_audit` SECURITY DEFINER RPC exists: 0 hits for "with_audit" across `/Users/ife/replant/supabase/migrations/` (prod mirror).
- Both enumerated endpoints still run the ratified two-call application-layer pattern with the distinguishable 500 tag intact: `list-flagged-messages.js:64` + `list-underground-churches.js:64` `AUDIT_FAIL_TAG = 'audit_log_write_failed:<endpoint>'` (Trigger-2 alert precondition present).
- This is correct-by-design: the umbrella migrates per-surface only when a trigger fires. Trigger 1 (launch-readiness review) has not occurred — project is in QA; no evidence of Trigger 2 (would surface as the tagged 500) or Trigger 3 in repo.
- AC10 retrospective drift found: the Path B family has grown to 7 endpoints emitting `audit_log_write_failed:*` tags (adds expand-pastoral-context.js, heartcry-inbox.js, list-escalated-cases.js, list-pastoral-queue.js, triage-pastoral-action.js) — the ticket's enumeration still lists only 2.
MISSING: nothing is DUE yet (trigger-gated); AC10 enumeration amendment for the 5 unlisted Path B endpoints is the one live obligation.
DEPLOYED: n/a (application-layer posture deployed and ratified; RPC intentionally unbuilt)
NEEDS-LIVE-DB: Trigger-3 tracking (optional, quarterly per ticket): `SELECT action, count(*) FROM audit_log WHERE action IN ('flag_queue_opened','underground_oversight_opened') AND created_at > now() - interval '30 days' GROUP BY action;`
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No strict-atomicity RPC exists and none is due — no migration trigger has fired; both enumerated surfaces still run the SEC-ratified application-layer contract with the AUDIT_FAIL_TAG 500 path in place.
- Trigger 1 is a mandatory launch-readiness line item per surface — must enter the pre-launch checklist; project is still in QA so it has not been reached.
- AC10 retro-amendment due: 5 newer endpoints ship the same Path B pattern (expand-pastoral-context, heartcry-inbox, list-escalated-cases, list-pastoral-queue, triage-pastoral-action) and are absent from the ticket's enumeration — SM should amend per AC10's no-ceremony clause.
- Umbrella must stay OPEN; cannot close without per-surface implementation or founder-documented re-ratification.

## KAN-160 — SEC ANALYSIS: Concurrent admin session blocking — POC and feasibility
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Deliverable is an analysis memo posted on-ticket; only comment is the SM-REVIEW routing note — no SEC analysis, no recommendation, no founder approval.
- No POC code: 0 hits for `BroadcastChannel` / `navigator.locks` in origin/main src/.
- Current posture unchanged and matches the ticket's description: per-tab `src/lib/session-watchdog.js` (30-min idle + 8h cap), no cross-tab signaling, no server-side session nonce.
MISSING: the entire deliverable (threat-model answer, implementation-option evaluation, UX recommendation, audit-implication review, founder approval).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Analysis never run; no memo, no POC, no recommendation on file.
- Deployed posture is exactly as the ticket describes (independent per-tab watchdogs, silent Tab-B drop on global signOut) — description remains accurate as of origin/main 1108fe5.
- Threat-model inputs have since shifted (TOTP AAL2 freshness gates on destructive actions reduce what a second stolen tab can do) — SEC analysis should account for the Option C+ posture when scheduled.

## KAN-221 — [SEC] Harden users_update_own RLS — column-scope WITH CHECK before GA
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (protective goal fully met by a stronger mechanism; literal WITH CHECK route not used)
EVIDENCE:
- `supabase/migrations/20260702021338_p0_2_breakglass_revoke_privilege_column_writes.sql:17-23` — wholesale `REVOKE UPDATE ON public.users FROM authenticated, anon` + re-GRANT of exactly 20 non-privilege columns; every column the ticket names (is_active, verification_status, church_id, auth_id) plus role/is_top_tier_admin/is_underground_admin is excluded. Wholesale-then-narrow chosen because the grant was TABLE-level — a column-only REVOKE would silently no-op (documented in-file). Churches privilege columns revoked same pass (lines 25-30).
- `supabase/migrations/20260702031920_guard_users_privilege_columns_trigger.sql` — `guard_users_privilege_cols()` BEFORE-UPDATE trigger (SECURITY INVOKER) raising 42501 when authenticated/anon changes any of the 7 privilege columns; in-file verification that every legitimate writer is a postgres-owned SECURITY DEFINER fn.
- Gap was proven LIVE-exploitable first (P0-2: PATCH is_top_tier_admin → hook mints top_tier on refresh), then closed — ticket comment 2026-07-01 (c.15971) records exploit + both migrations.
- Note: plain RLS WITH CHECK cannot express per-column scoping (row predicate only); grants + trigger is the technically correct realization of the ticket's intent, and blocks at the privilege layer before RLS even runs.
MISSING: n/a for the vuln. Deferred hygiene (explicitly out of the close): `update_leader_settings` SECURITY DEFINER RPC + SettingsScreen cutover + dropping the residual 20-column grant.
DEPLOYED: yes (both migrations in prod mirror = applied to jiyetphxxvyiicrnwlnx per repo rule; ticket comment confirms live apply + advisor clean)
NEEDS-LIVE-DB: optional spot-check: `SELECT grantee, column_name FROM information_schema.column_privileges WHERE table_schema='public' AND table_name='users' AND privilege_type='UPDATE' AND grantee IN ('authenticated','anon') ORDER BY 1,2;` (expect exactly the 20 safe columns, authenticated only) and `SELECT tgname FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='trg_guard_users_privilege_cols';`
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Ticket's protective goal (leader cannot self-write privilege columns) is closed on prod via two layers: column-scoped UPDATE grants (20 safe columns re-granted after wholesale revoke) + guard_users_privilege_cols BEFORE-UPDATE trigger (blocks is_top_tier_admin / is_underground_admin / role / verification_status / church_id / is_active / auth_id for authenticated/anon).
- The literal mechanism specced (column-scope WITH CHECK on users_update_own) was not used — RLS WITH CHECK can't column-scope; grants+trigger is the correct realization and also survived the table-level-grant trap that would have no-op'd a column REVOKE.
- Exploitability was proven live 2026-07-01 (self-promote to Manager via is_top_tier_admin PATCH) and reverted; fix verified, security advisor clean.
- Residual hygiene deferred by design: update_leader_settings SECURITY DEFINER RPC + SettingsScreen cutover as the durable choke-point.
- Safe to move to Done on goal-met basis; Founder owns the transition (per c.15971).

## KAN-272 — Spike: audit-log page-load record granularity for AAL2-gated surfaces
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Spike deliverables (report, recommendation, follow-up ticket, TTL decision) do not exist: 0 ticket comments; no granularity spike doc in mobile docs/ or .claude/plans; nothing in admin repo.
- The PR #68 stopgap the spike is meant to replace IS live on origin/main: `_lib/aal2-gate.js:49-54,165-195` — Upstash `SET NX EX`, `DEDUPE_TTL_SEC = 3600`, pass-path deduped per (session_id, action), fail-path always writes, dedupe falls through open if Redis env absent.
- Ticket-key drift caution: "KAN-272" is cited in repo artifacts for two OTHER scopes (`_lib/action-names.js` UNDERGROUND_CONFIRM_PROPOSAL comment; `docs/build_manifest_admin_tier_bundle.md:14` "KAN-272 Rejected detail page") — spot-check live Jira per the KAN-119 c.11455 rule before posting any closing comment.
MISSING: entire spike — threat-model query review, compliance review, granularity-tier comparison, target-posture recommendation, migration path off the 1h-TTL dedupe.
DEPLOYED: n/a (stopgap deployed; spike is a paper deliverable)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Spike not run; no report, no follow-up ticket, no ratified granularity decision.
- Interim posture live and stable: per-session pass dedupe (1h Upstash bucket) + per-event fail rows, exactly the PR #68 Option C+ stopgap.
- Open decision the spike owns: keep 1h TTL vs session-lifetime (8h) vs replace mechanism (e.g. surface_access_metrics aggregation).
- Verify the ticket key against live Jira before commenting — repo artifacts use "KAN-272" for two unrelated scopes.

## KAN-289 — Pre-launch hardening — make DevTools console + sources opaque
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Correctly unstarted per its own gate: Founder scoped it "post-QA, post-UAT signoff. Pre-launch only. Not for current sprint" — project is in QA.
- No opacity pass has shipped: `vite.config.mjs` (origin/main) has NO build block — Vite defaults apply (esbuild minify ON, sourcemaps NOT emitted); no console-strip/drop config; no eslint config exists at all (so no no-console lint rule); no Phase 1 over-fetch audit doc, no Phase 4 pen-test artifact.
- Incidental baseline already decent (facts for the eventual sweep): 0 `console.log`/`console.debug` in src on origin/main (only console.warn RefreshAuditor.jsx:25 + console.error Login.jsx:63); netlify.toml ships CSP + X-Frame-Options DENY + nosniff + Referrer-Policy for /*.
- Doctrine anchor holds: BE gates are the load-bearing layer (per console-opacity doctrine); Phase 1 overlaps KAN-288's UG sweep, portions of which landed via PR #73 (read-region full-de-mask gating).
MISSING: all 4 phases — BE over-fetch/authz audit, FE minification-policy + strip + lint rule, network-response polish, outside pen-test pass.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- By design not started — Founder gated this behind QA + UAT signoff; gate has not been reached.
- Baseline posture already present without a dedicated pass: default Vite minification, no shipped sourcemaps, zero console.log/debug in FE source, CSP/XFO/nosniff headers on all routes.
- Load-bearing layer (BE data-return discipline) is being advanced under KAN-288/PR #73 (e.g. read-region UG de-mask now AAL2+claim gated); this ticket's Phases 2–4 remain the "looks airtight" deterrent layer.
- No eslint config exists in the repo — the planned no-console lint rule has nothing to attach to yet.
