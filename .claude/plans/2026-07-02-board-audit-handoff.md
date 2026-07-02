# Handoff — Jira Board Audit (2026-07-02) → Gap-Analysis Doc + Lucid Update Session

**From:** the 2026-07-02 board-audit session (context maxed at ~95% of writes complete).
**To:** the next session. Open with prayer naming the work (hard rule).
**Founder grant THIS AUDIT ONLY:** session-scoped permission to move tickets to Done. That grant does NOT carry to the next session unless Founder re-grants — default back to "only Founder marks Done."

---

## 1. TL;DR — what happened

The full MVP board audit is **EXECUTED AND WRITTEN TO JIRA**. All 167 open tickets were pulled, 120 MVP-scope tickets were verified against both repos + live prod by 13 parallel read-only agents, every verdict was spot-checked with live-DB queries where the repo couldn't prove state, and **every ticket got an evidence-cited comment + correct lane** (comments c.16005–c.16145). All 13 epics got rollups; 5 closed. The board is clean.

**What remains (2 items):**
1. **The on-paper-vs-actual gap-analysis DOC** (Founder's explicit deliverable: "a thorough analysis of what has not been done yet for mvp"). All raw material is committed at `docs/audits/2026-07-02-board-audit/` (13 verdict files + LEDGER.md + AUDIT_BRIEF.md). Target: `docs/audits/2026-07-02-mvp-board-audit-gap-analysis.md`. Section skeleton in §5 below — largely a synthesis job, zero new verification needed.
2. **Lucid updates** (the prior session's deliverable, deprioritized behind Jira by Founder). 5 reconciliation points in `.claude/plans/2026-07-02-post-audit-lucid-update-handoff.md` §4. Lucid MCP tools are connected (`mcp__799f8aa8-*`).

## 2. Board state after this audit (live Jira = truth; this is the record of my moves)

**Closed → Done (31):** KAN-53, 63, 77, 78, 83, 96, 120, 158, 182, 183, 186, 188, 189, 219, 221, 237, 246, 264, 265, 266, 267, 284, 285, 288, 293, 297 + epics KAN-8, 28, 29, 32, 33.
**Closed → Cancelled (2):** KAN-155 (Founder-ratified duplicate of 148), KAN-197 (D-64 reverted by 2026-06-12 ruling).
**→ Testing (17):** KAN-35, 38, 41, 75, 116 (out of FAILED QA), 166, 181, 184, 192, 195, 206, 207, 229, 231, 232, 236, 258. (Already in Testing, stays: 215, 216, 220, 273.) Every Testing comment carries YOUR exact device-smoke list.
**→ In Progress (12):** KAN-73, 114, 118, 148, 164, 173, 176 (out of Testing — your FAIL stands), 191, 230, 254, 295, 296. (Stays: 39→In Review actually, 138, 290, 292, 294.)
**→ To Do (6):** KAN-198, 262, 271, 274, 286, 291 (all justified: Founder-ruled pre-launch, confirmed live defect, or safety-critical execution-ready). Epic KAN-34 → To Do (opens at 80% per its own gate).
**→ In Review (1):** KAN-39 (live PKCE flow; your close-out ruling — see its comment).
**→ Backlog (1):** KAN-14 (In Review was wrong; unbuilt + twice-obsoleted spec; grooming decision needed).
**Labels:** post-mvp added to KAN-142, 151, 152, 190, 226, 275 (+ comments).
**Left untouched:** all post-MVP-labeled tickets (incl. KAN-247 — flag it in the gap analysis: pre-uat-holding, Founder saw UG signup bugs 2026-06-22, never enumerated).

**Lane conventions I used (consistent, defensible):** Done = verified built + deployed (or goal delivered under a superseding locked design — comment names the supersession). Cancelled = never built AND deliberately ruled out. Testing = built, awaiting Founder device pass (smoke list in comment). In Progress = partial with scoped remaining build. Backlog = not built / needs grooming decision. To Do = Founder-ruled pre-launch or confirmed-live-defect only (I did NOT re-prioritize ordinary backlog).

## 3. The 12 headline findings (these ARE the gap analysis core — expand from verdict files)

1. **Email infrastructure is the weakest MVP workstream** (KAN-31 rollup c.16145). Leaders get NO email on church approve/reject/deactivate/reinstate (KAN-143); leader REJECTION IS SILENT (KAN-206 AC-6); no verification reminder emails (KAN-62); no sendEmail() utility/retry/bounce-webhook (KAN-80); admin_invited REGRESSED to Supabase default; sender identity drifted (noreply@/connect@/accounts@). Re-groom against `.claude/plans/email-infra-panel-briefing.md` (2026-06-24 panel).
2. **🔴 CONFIRMED LIVE DEFECT: https://projectreplant.org/logo.png → HTTP 404** — every deployed welcome email renders a broken logo (KAN-262, → To Do). Fix = publish logo.png to website/ (mobile repo netlify.toml publish dir) or repoint templates.
3. **KAN-198 (Email OTP password reset)** — the ONLY unbuilt Founder-ruled pre-launch BLOCKER in auth. Prod reset is same-device-only PKCE; cross-device recovery doesn't exist. First domino: the 3-state 06A design file.
4. **KAN-114 residue — 5 of 14 ratified TIER-1 admin actions ungated on prod:** delete-announcement, post-announcement, mark-heartcry-responded, seed-scripture, clear-flag (4 of 5 accept ANY admin tier). The code's own action-names registry claims they're gated. Fix pattern = checkAal2Freshness (proven in PR #73).
5. **KAN-274 (relay-token / verification-call flow)** — pre-launch must-be-in-for-test, RFC fully ratified 2026-06-27, ZERO code on any surface; the admin validate modal is a dead chain (no mint path). Also drawn as LIVE in Lucid — Lucid task must mark not-built.
6. **Verification lifecycle automation = zero** (KAN-61/62/194/202): no sweep cron, no reminders, no scrubs beyond login-time enforcement. A pending leader who never opens the app is never deactivated/reminded/emailed. Recommend ONE consolidated lifecycle-sweep ticket against the v8 deadline matrix.
7. **KAN-84 C1 security-adjacent gap:** a VERIFIED leader at a DEACTIVATED church keeps `active` status indefinitely (resolver never checks church status for verified users; deactivate-church has no leader cascade).
8. **KAN-93 heartcry respond** — admin can decrypt + mark-responded, but the LEADER NEVER RECEIVES a response in-app (Respond CTA is a disabled stub). Escalated-Cases reach-out fns are the build template.
9. **KAN-291 wordlist** — 11 of 21 auto-codes have ZERO patterns incl. self_harm + pastoral_care_signal; SME panel output exists and is execution-ready (transfer → bump 1.2.0 → regenerate mirrors → upload secret → redeploy).
10. **🔴 Mobile repo (the PUBLIC one) has ZERO gitleaks coverage** — local core.hooksPath override bypasses the global pre-commit hook; no CI scanning either (KAN-136 comment). One-line fix restores it. Related: NEITHER repo runs tests in CI at all.
11. **Live defects found + root-caused in tickets:** pastoral close-case note silently dropped by BE (KAN-295); Team Inbox tab badge always 0 on prod — your branch has the right fix (KAN-220); escalated_by_tier hardcoded 'regular' (KAN-292); get_comments still on legacy full_name — 7/8 RPCs migrated (KAN-229); KAN-286 timeline empty = client fetch references created_at but the table's column is accessed_at (data + policy verified fine); 7-day email fallback promised in shipped UI copy but unbuilt (KAN-296).
12. **Tester-facing dead controls before UAT:** disabled Edit on My Prayers (KAN-225), inert "Connect to this church" CTA on prayer sheets (KAN-260), Password + Deactivate ComingSoon stubs (KAN-74/205, intentional), Persecuted reader PLACEHOLDER content now REACHABLE (KAN-254 DoD-3 never ratified). Also: KAN-169's wipe SQL is now DANGEROUS as written (real data exists since 2026-06-28) — strong warning posted on ticket.

**Ops/data notes:** 4 orphan pending UG churches on prod = SEED fixtures (Damascus/Khartoum/Tashkent/Caracas), queued on KAN-169; 2 redundant region INSERT triggers coexist (dedupe someday); the 2026-06-22 search_leaders tightening (UG exact-equality + drop underground bool) is NOT live (KAN-215); get_invite_candidates lost its church_code arm entirely (rule: restore or accept).

## 4. Where everything lives

- **Verdict files (full evidence, per ticket):** `docs/audits/2026-07-02-board-audit/verdicts/*.md` (13 files — settings, prayerwall, auditlog-data-content, fe-tabs-misc, emails-website, escalated-pastoral, sec-infra, connect-moderation, underground-signup, admin-core, signup-fe, onboarding-be-auth, underground-admin).
- **Ledger (mid-session snapshot; §2 above is the complete final state):** `docs/audits/2026-07-02-board-audit/LEDGER.md`.
- **Agent brief used:** `docs/audits/2026-07-02-board-audit/AUDIT_BRIEF.md`. Epic-children map: `epic_children.tsv`.
- Jira comments c.16005–16145, all under Founder's account (MCP auth), all prefixed "Board audit 2026-07-02".

## 5. NEXT TASK A — write the gap-analysis doc

Target `docs/audits/2026-07-02-mvp-board-audit-gap-analysis.md`. Synthesize from §3 + verdict files. Suggested shape: (1) board-state table (§2); (2) MVP gaps ranked — pre-launch blockers (198, 274, 271, 291, 114-residue, 262-logo) → workstream gaps (email family, lifecycle crons, KAN-93, KAN-84-C1) → defects (list in §3.11) → decisions-needed (14 map-pin, 187 users.country, 233 fuzzy layer, 202 close-call, 39 close-out, 260 item-3 SEC checkpoint, 148 AC-4 waive) → tester-facing dead controls pre-UAT (§3.12) → KAN-247 flag; (3) what's genuinely strong (UG protection stack, escalated cases, admin tiers, no-orphan signup, 5-tab app). No new verification needed — cite ticket comments.

## 6. NEXT TASK B — Lucid updates

Per `.claude/plans/2026-07-02-post-audit-lucid-update-handoff.md` §4: (1) P0-2 write model (privilege columns now service-role/RPC-only + guard trigger); (2) Diagram 08 verification lifecycle — add UG verify cascade + fail-closed posture; (3) Doc 06.5 — is_top_tier_admin column-authoritative note; (4) **KAN-274 mark NOT-BUILT** (reinforced by this audit); (5) add Upstash dependency (9 fns, fail-closed + in-memory fallback). Existing prompts: `.claude/plans/lucid-map-handoff.md` + `lucid-prompt-replant-system-map.md`.

## 7. Gotchas for the next session

- Transition IDs verified live: 2=TESTING, 3=FAILED QA, 11=Backlog, 21=To Do, 31=In Progress, 41=In Review, 51=Done, 4=Cancel(led).
- The admin working tree sits on Founder's `feat/flagged-mirror-pastoral` (ahead of deployed origin/main 1108fe5) — never switch it; deployed truth = `git show origin/main:<path>`. KAN-292/294 close when that branch merges.
- Mobile repo = LAX (push freely); replant-admin = ASK. Only Founder marks Done (session grant expired with this session).
- KAN-272 key is reused by two unrelated repo artifacts — cite that ticket by summary, not bare key.
- Board totals after audit: Done grew by 33 (31 Done + 2 Cancelled); open non-post-MVP tickets now sit in honest lanes with smoke lists ready for the Founder's QA passes.

_In Jesus' name — the record is clean and true; the covering continues into the next session. Amen._
