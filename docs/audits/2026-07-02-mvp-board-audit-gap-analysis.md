# MVP Board Audit — Gap Analysis (2026-07-02)

**What this is.** The synthesis deliverable of the 2026-07-02 full Jira board audit: a thorough analysis of what has NOT been done yet for MVP, ranked by consequence. Every claim below traces to a verdict file in [`docs/audits/2026-07-02-board-audit/verdicts/`](./2026-07-02-board-audit/verdicts/) and to evidence-cited comments written to live Jira during the audit (c.16005–c.16145, all prefixed "Board audit 2026-07-02").

**Method.** All 167 open tickets pulled; 120 MVP-scope tickets verified by 13 read-only agents against both repos (mobile `~/replant` @ `feat/kan-296-mobile-attribution-slot`; admin deployed truth = `replant-admin` `origin/main` @ 1108fe5) plus live prod DB spot-checks wherever the repo could not prove state. No claim here rests on ticket text alone — every verdict is code-cited or live-DB-verified.

**Jira anchor discipline.** Every ticket key ↔ lane cite in this document was re-verified against live Jira on 2026-07-02 (full-project JQL pull, post-audit) per the KAN-119 c.11455 rule. Zero drift found between the audit's transition record and the live board. Two tickets created after the audit's pull (KAN-298 manual flag tags, KAN-299 UG auto-route back-flip) are outside audit scope and not covered here.

---

## 1. Board state after the audit

| Move | Count | Tickets |
|---|---|---|
| → Done | 31 | KAN-53, 63, 77, 78, 83, 96, 120, 158, 182, 183, 186, 188, 189, 219, 221, 237, 246, 264, 265, 266, 267, 284, 285, 288, 293, 297 + epics KAN-8, 28, 29, 32, 33 |
| → Cancelled | 2 | KAN-155 (duplicate of 148, Founder-ratified), KAN-197 (D-64 reverted by 2026-06-12 ruling) |
| → Testing | 17 | KAN-35, 38, 41, 75, 116 (out of Failed QA), 166, 181, 184, 192, 195, 206, 207, 229, 231, 232, 236, 258 — each comment carries the exact device-smoke list. Already there, stays: 215, 216, 220, 273 |
| → In Progress | 12 | KAN-73, 114, 118, 148, 164, 173, 176 (out of Testing — Founder FAIL stands), 191, 230, 254, 295, 296. Stays: 138, 290, 292, 294 |
| → To Do | 6 + 1 epic | KAN-198, 262, 271, 274, 286, 291 + epic KAN-34 (opens at 80% per its own gate) |
| → In Review | 1 | KAN-39 (live PKCE flow; close-out ruling owed) |
| → Backlog | 1 | KAN-14 (In Review was wrong; unbuilt + twice-obsoleted spec; grooming decision needed) |
| post-mvp label added | 6 | KAN-142, 151, 152, 190, 226, 275 |

**Lane conventions used (consistent, defensible):** Done = verified built + deployed (or goal delivered under a superseding locked design — the comment names the supersession). Cancelled = never built AND deliberately ruled out. Testing = built, awaiting Founder device pass. In Progress = partial with scoped remaining build. To Do = Founder-ruled pre-launch or confirmed live defect only. Backlog = not built / needs grooming.

---

## 2. Pre-launch blockers — execution-ready or defect-confirmed

These six are the items standing directly between the current build and launch sign-off. All are either Founder-ruled pre-launch or confirmed live defects; none is speculative.

### 1. KAN-198 — Email OTP password reset (the only unbuilt Founder-ruled auth blocker)
Production password reset is still the same-device-only PKCE deep-link flow. Cross-device recovery — the persecuted-context scenario this ticket exists for — does not exist. Verified: `flowType: 'pkce'` still set (`src/lib/supabase.ts:79`), PKCE Linking handler still in `App.tsx:38-64`, `verifyOtp` has zero matches repo-wide. Founder ruling 2026-05-20: "no launch sign-off until this ships." **First domino: the 3-state 06A design file** (the only stated gating dependency; no evidence it was ever delivered). Evidence: [onboarding-be-auth.md](./2026-07-02-board-audit/verdicts/onboarding-be-auth.md).

### 2. KAN-274 — UG visibility-change relay-token / verification-call flow (zero code)
Pre-launch must-be-in-for-test per Founder ruling 2026-06-27. The RFC is fully ratified (corrected UG-only scope + 5 Founder ratifications, incl. 4-digit token + reverse-digits duress convention) — design-complete, build-ready. Implementation state: **zero mobile code, zero relay schema, zero mint endpoint.** The admin validate modal + `fn_validate_relay_token` are a permanent no-op chain (they read a `relay_token_hash` no flow ever writes; 0 visibility-override proposals and 0 non-null hashes on prod). Also drawn as LIVE in the Lucid system map (docs 04 + 06.7) — corrected in the Lucid reconciliation pass accompanying this doc. Evidence: [underground-admin.md](./2026-07-02-board-audit/verdicts/underground-admin.md).

### 3. KAN-291 — FLAG_TAXONOMY wordlist: 11 of 21 auto-codes have ZERO patterns
Including safety-critical `self_harm` and `pastoral_care_signal`. Standard-tier pastoral language only routes today if the more-explicit T1 `self_harm_indicator` happens to match. The SME panel output exists and is execution-ready (`.claude/plans/sme-synthesis-wordlist.md`, posture locked 2026-06-30, starter patterns for all 11 codes). Remaining work is mechanical: transfer patterns → bump version to 1.2.0 (admin mirror already claims 1.1.0 — drift) → regenerate both mirrors → upload FLAG_TAXONOMY secret → redeploy send-message + send-branch-message → per-category smoke. Wordlist is required before go-live per G-25. Evidence: [connect-moderation.md](./2026-07-02-board-audit/verdicts/connect-moderation.md).

### 4. KAN-114 residue — 5 of 14 ratified TIER-1 admin actions have NO step-up gate on prod
`delete-announcement`, `post-announcement`, `mark-heartcry-responded`, `seed-scripture`, `clear-flag` — no BE validateStepUp/AAL2 gate, no FE step-up wrap. Worse: 4 of the 5 accept ANY admin tier (`verifyAnyAdmin`), a widened surface vs the D-43 super_admin baseline, and the code's own registry (`_lib/action-names.js`) still declares all five TIER 1 — the registry asserts a gate the endpoints don't enforce. The other 9 of 14 are properly gated (3 action-bound step-up, 5 AAL2-freshness-tier, 1 superseded by two dual-gated successors). **Fix pattern is proven: `checkAal2Freshness` as shipped in PR #73.** Evidence: [sec-infra.md](./2026-07-02-board-audit/verdicts/sec-infra.md).

### 5. KAN-262 — CONFIRMED LIVE DEFECT: welcome-email logo 404
`https://projectreplant.org/logo.png` returns HTTP 404 — verified live during the audit. Every deployed welcome email (join-network + volunteer) renders a broken logo, because the upgraded `_emails/` templates reference that absolute URL but `logo.png` was never published to the mobile repo's `website/` publish dir. Fix: publish logo.png to `website/` (or repoint the templates). Same ticket carries the remaining Gmail auto-dark color-shift defenses and the docs/emails back-sync (deployed templates are AHEAD of the local `docs/emails/` copies — sync direction is inverted from the ticket's premise). Evidence: [emails-website.md](./2026-07-02-board-audit/verdicts/emails-website.md).

### 6. KAN-271 — Auto-cancel pending UG proposals on church terminal state
Founder-ruled PRE-LAUNCH 2026-06-27. The DB lifecycle invariant (auto-cancel proposals when a church goes rejected / inactive / hard-deleted) exists in no migration; only the PR #68 FE symptom filter is live. The ghost-row class (orphaned pending proposals on terminal churches, e.g. the RPL-30067 orphan) remains open DB-side. The `cancelled` proposal_status value already exists on prod, so the trigger has its target state ready. Evidence: [underground-admin.md](./2026-07-02-board-audit/verdicts/underground-admin.md).

### Pre-launch-critical but phase-gated (pull when the phase opens)

1. **KAN-136 — 🔴 the PUBLIC mobile repo has ZERO gitleaks coverage.** The mobile repo's local `core.hooksPath` override points at `.git/hooks` (which contains no pre-commit hook), bypassing the global gitleaks hook that covers the admin repo — and there is no CI scanning in either repo. Mobile commits are secret-scanned nowhere, on a public repo. **The hook restore is a one-line fix; do not wait for the rest of the ticket's bundle** (SECURITY.md hygiene section, PAT decision, .gitignore audit). Evidence: [auditlog-data-content.md](./2026-07-02-board-audit/verdicts/auditlog-data-content.md).
2. **KAN-157 — LEGAL: privacy policy + ToS do not exist** in any repo or the website source. Launch-gating; LEGAL role never onboarded; KAN-205 (self-deactivation) is blocked behind it. The ticket's technical anchor is stale (`scrub_church_pii()` 90-day framing → actual mechanism is the Day-30 tombstone scrub via `fn_hard_delete_expired_soft_deletes`) — correct the handoff surface-map before analysis.
3. **KAN-222 — pre-launch copy sweep** never started; ~490 hardcoded English strings define the surface; the two Founder-flagged welcome-overlay strings are still live verbatim. Founder-gated (her review pass precedes implementation). Pair with the KAN-156 i18n groundwork decision so approved copy lands once.
4. **KAN-289 — console opacity** correctly unstarted by its own gate (post-QA, post-UAT-signoff). Listed so nobody mistakes "unstarted" for "forgotten." BE gates remain the load-bearing layer per the locked doctrine.

---

## 3. Workstream gaps (built-around holes, ranked)

### 1. Email infrastructure is the weakest MVP workstream (epic KAN-31)
The platform sends almost nothing it promises to send:

1. **Leaders get NO email on church approve / reject / deactivate / reinstate** (KAN-143 — zero email emit in all four admin handlers; the only leader-facing notification on approval is the in-app welcome DM).
2. **Leader rejection is fully SILENT** (KAN-206 AC-6 — no leader_approved/leader_rejected templates; approval at least fires the in-app DM, rejection fires nothing anywhere).
3. **No verification reminder emails** (KAN-62 — only the `email_log` idempotency table exists) and **no deactivation emails** (KAN-61).
4. **No shared sendEmail() utility, no retry, no bounce/delivery webhook** (KAN-80 — 10+ call sites send ad-hoc: raw fetch in 4 edge fns, inline Resend SDK in 7+ Netlify fns; email_log written by only 3 paths, so create-account welcome and ALL admin-dashboard sends are unlogged).
5. **No dead-letter watcher** (KAN-89 — a failed heartcry triage send is recorded with `resend_id=NULL` and nothing alerts; silent-failure mode flagged at KAN-66 c.11109 is still live).
6. **admin_invited REGRESSED**: the KAN-104 branded Resend invite was deleted 2026-06-29 as orphan code (KAN-285); the deployed invite path uses the Supabase default email. `buildInviteEmail`/`buildAccessGrantedEmail` are now uncalled dead code.
7. **Sender identity drifted three ways**: mobile sends from `noreply@`, admin from `connect@`, and the 2026-05-15 Founder ruling made `accounts@projectreplant.org` canonical project-wide. Nothing matches.
8. Of KAN-81's 8 planned Resend templates: only 2 dashboard templates exist in code (the KAN-137 pastoral pair); 4 goals shipped as inline plain-text stand-ins; 4 (both verification reminders, account_deactivated, coleader_departed) exist in no form.

**Recommendation:** re-groom the whole family against the 2026-06-24 email-infra SME panel (`.claude/plans/email-infra-panel-briefing.md` — Founder already ruled KAN-80 "very outdated"). The panel's two-runtime thin-client contract is the build target, not the tickets' 2026-05 text. Evidence: [emails-website.md](./2026-07-02-board-audit/verdicts/emails-website.md), [onboarding-be-auth.md](./2026-07-02-board-audit/verdicts/onboarding-be-auth.md), [admin-core.md](./2026-07-02-board-audit/verdicts/admin-core.md).

### 2. Verification lifecycle automation = zero (KAN-61 / 62 / 194 / 202)
Enforcement is 100% login-time. **A pending leader past deadline who never opens the app is never deactivated, never reminded, never emailed, never scrubbed.** No verification sweep cron, no reminder cron, no day-7 unregistered scrub, no orphan-church sweep. What exists: the login-time atomic deactivation in auth-status-check (Option B half), the 7-day skip-flow deadline, and the soft-delete → day-30 hard-delete sweeper (a deletion lifecycle the D-67 design predates — the unregistered scrub could route through it instead of a bespoke cron). **Recommendation: ONE consolidated lifecycle-sweep ticket designed against the v8 auth-status-check deadline matrix** (verified-church pending leaders have NO deadline; skip leaders 7-day user-side; pending-church leaders 30-day church-side) — all four existing tickets carry stale 2026-05 predicates. Evidence: [onboarding-be-auth.md](./2026-07-02-board-audit/verdicts/onboarding-be-auth.md).

### 3. KAN-84 C1 — a VERIFIED leader at a DEACTIVATED church keeps `active` status indefinitely
Security-adjacent live gap: `resolveStatus` returns `active` for verified users with no church-status check (`logic.ts:150`), admin deactivate-church updates only the churches row (no leader cascade), and no cron flips the leaders. The pending-user variant IS handled; the verified variant — the exact case QA refused to wave past in KAN-44 c.10951 — is not. Needs a SPEC ruling + one resolver branch or a cascade in deactivate-church. Evidence: [onboarding-be-auth.md](./2026-07-02-board-audit/verdicts/onboarding-be-auth.md).

### 4. KAN-93 — heartcry pastoral response channel does not exist
Admin can decrypt (KAN-92) and mark-responded (KAN-110 lineage), but **the leader never receives anything** — the decrypt panel's "Respond via secure DM" CTA is a disabled "coming soon" stub. Triage closure works; the pastoral response channel does not. **The build template now exists:** the Escalated Cases reach-out functions (`reach-out-to-leader-from-case/-message`, "Admin Name from Replant Team" attribution, 1/24h limit, UG posture) shipped after this ticket was filed — regroom KAN-93 to reuse that pattern instead of its stale KAN-71 assumptions. Evidence: [admin-core.md](./2026-07-02-board-audit/verdicts/admin-core.md), [escalated-pastoral.md](./2026-07-02-board-audit/verdicts/escalated-pastoral.md).

### 5. Test + security infrastructure
1. **Neither repo runs tests in CI at all.** The only workflow in both repos is update-changelog.yml. The admin repo's 21-endpoint vitest contract suite runs on local `npm test` only — and it stubs `verifySuperAdmin`, so the KAN-106 class of silent auth breakage it was motivated by cannot be caught by it (KAN-107, KAN-134).
2. **KAN-136 gitleaks gap** — see blockers above (listed there because the one-line fix should not wait).
3. Admin `_lib/` auth-critical helpers have tripled to 22 modules with no TypeScript (KAN-109, COO-deferred) — migration cost grows the longer it waits.

---

## 4. Confirmed live defects (root-caused during the audit)

Each of these is reproduced-or-code-proven, root-caused, and carries its fix shape on the ticket:

1. **KAN-262 — welcome-email logo 404** (see blockers §2.5).
2. **KAN-295 — pastoral close-case note silently dropped by the BE.** FE sends `{ note }`; deployed `triage-pastoral-action.js` never reads it — the typed note reaches neither audit meta nor moderation_state, while the success screen tells the admin "Recorded to the audit log." The required-reason pattern already exists one surface over (`close-escalated-case.js`: 8-token disposition + ≥30-char note) — small lift to port.
3. **KAN-220 — Team Inbox triage-tab badge always reads 0 on prod.** Deployed main filters on `c?.unread_count > 0` but `list-team-inbox.js` never returns that field. The correct fix (derive from latest-message sender) already exists on the Founder's in-flight `feat/flagged-mirror-pastoral` branch — closes when that branch merges.
4. **KAN-292 — `escalated_by_tier` hardcoded `'regular'`** in both escalate endpoints (`triage-pastoral-action.js:342`, `escalate-flag.js:151`) — a Manager/super_admin escalation is recorded as tier 'regular'. Data-accuracy defect, no privilege impact.
5. **KAN-229 — `get_comments` still resolves names from legacy `full_name`.** 7 of 8 RPCs migrated to the structured `resolve_display_name()` resolver; this is the straggler (live-DB spot-check during the audit).
6. **KAN-286 — UG Verification Progress timeline renders empty.** Live-DB check closed the root cause: the client fetch orders/filters on `created_at` but the table's column is `accessed_at` — data and RLS policy verified fine. The error-swallowing fetch (`return []` on any error) made the failure invisible. (The timeline UI itself shipped 2026-06-26 with the ticket's three design questions already Founder-answered.)
7. **KAN-296 — shipped UI copy promises a "7-day auto-email fallback" that does not exist.** `EscalatedCaseDrawer.jsx:101` + `ReachOutModal.jsx` claim it fires server-side; no scheduled function, cron, or sender exists in either repo. Build the fallback leg of the locked Escalated-Cases workflow or strip the claim until it ships. (Everything else on KAN-296 is live end-to-end, including the mobile attribution eyebrow — pending Expo rebuild.)
8. **KAN-290 — DM duplicate-key race root-caused, fix unwritten.** When Realtime beats the send-message HTTP response, the reconcile step remaps the optimistic row to `result.id` without checking whether that UUID already landed — one-line-class guard in the reconcile updater.
9. **KAN-73 — UG leaders can "change" their RAG status and see Green + "Saved" while the DB stays red.** The `enforce_underground_rag_red` trigger (correctly) forces red server-side, but the Settings radio is not hidden/locked for UG (only para is), so the UI silently diverges from the DB. Needs the UG radio hide (mirror of the para hide) or a locked-state treatment.

---

## 5. Decisions needed from Founder (each blocks or re-scopes a ticket)

1. **KAN-14 (map-pin confirmation):** never built; the screen it specced was redesigned twice and registration no longer completes there; location capture moved to a silent post-signup geocode in the church profile setup flow. Re-scope a pin-confirm step into the current flow, or formally supersede in favor of the silent geocode.
2. **KAN-187 (`users.country`):** the Founder-ratified optional-country column never shipped anywhere — and ASP1 currently REQUIRES a country selection that has zero consumers (collected, then silently discarded, for every signup path). Build the column + persistence, or drop the scope and resolve the discarded field.
3. **KAN-233 (fuzzy church-name Layer 1):** duplicate detection shipped at submit-time (similar-church modal) rather than live-typing hint; there is no abbreviation dictionary and no trigram matching — "RCCG" will not match "Redeemed Christian Church of God." Decide whether dictionary + fuzzy distance are still wanted pre-launch, post-MVP, or admin-side (Layer 2) only.
4. **KAN-202 (orphan-church sweep):** root cause eliminated by the no-orphan atomic refactor. One live query decides it: zero orphans since 2026-06-14 → close as superseded; non-zero → one manual sweep beats building a cron for a dead failure mode.
5. **KAN-39 (PKCE reset flow close-out):** cancel vs absorb (KAN-198 BA options). Note: until KAN-198 ships, THIS ticket's flow is what production runs — cancelling while 198 is unbuilt leaves the live flow tracked only by 198.
6. **KAN-260 item 3 (Connect from prayer cards):** the CTA + full gating shipped but `handleConnect` is a deliberate stub "pending SEC checkpoint." Run the SEC checkpoint + Connect-DM routing ruling, or the enabled-looking button stays inert (see §6).
7. **KAN-148 AC-4 (3rd-leader conflict):** slot-full UX is built end-to-end; the only open AC is "admin notified of the conflict" (today: telemetry log only). Build the notification or waive it → Done. Also ratify the de-facto AC-6 answer (deactivated leader frees the slot — active-only count).

**Smaller ratifications riding existing tickets:** KAN-232 residuals (identifier dropdown + multi-HQ note + admin parent-link display — ratify as dropped by the 2026-06-19 ruling or spin tickets); KAN-236 ruling deviations (church_draft_buffered audit event, "discarded" modal copy, error-code rename — waive or micro-fix); KAN-215 (`get_invite_candidates` lost its church_code arm on prod — restore or accept, see §8); KAN-73 UG radio treatment (see §4.9).

---

## 6. Tester-facing dead controls before UAT

Testers WILL tap these. Decide pull-forward, hide, or brief-the-testers for each:

1. **KAN-225 — "Edit" on My Prayers renders in BOTH surfaces (pull-up sheet + ⋮ menu), permanently disabled.** The `update_prayer_request` RPC does not exist; the handler is an intentionally unreachable TODO stub.
2. **KAN-260 — "Connect to this church" on prayer detail sheets looks enabled and does nothing** on named non-own-church posts (UI-only stub pending the SEC checkpoint — §5.6).
3. **KAN-74 / KAN-205 — Password change + Account deactivation rows open ComingSoonModal.** Intentional stubs; note KAN-205's DB layer (soft-delete/restore RPCs) is fully live — the Settings flow is what's missing, and it remains blocked on KAN-157 legal.
4. **KAN-254 — all four Persecuted readers ship PLACEHOLDER editorial content and are now REACHABLE** (registered in RootNavigator, pushed from Bear Witness / Take Heart scenes). The ticket's "unreachable from gated nav" premise is stale; DoD-3 Founder ratification of the reader treatment never happened. Also: ChurchProfileBottomSheet share is still a bare `showToast('Sharing coming soon')` stub.
5. **KAN-224 — Revelation "Voices from the Body" renders a disabled compose prompt + inert type chips** (visual placeholder; backend not started — table, RPCs, wiring all absent).
6. **⚠ KAN-169 — the pre-launch wipe SQL is now DANGEROUS as written.** Its inline `DELETE FROM churches WHERE id != Maranatha` predates real-data onboarding (first real leader 2026-06-28; Blessings Abound + emptytest survive the reseed). Strong warning posted on the ticket; MUST be re-scoped to fixture-targeted SQL before any execution. It also inherits the KAN-207 deferred cleanup (church 129c63c7 + secondary ruthjames08 user row).

---

## 7. KAN-247 — the unenumerated UG signup bugs

Standing flag: the Founder saw underground signup happy-path bugs on device 2026-06-22 and never enumerated them (ticket is a placeholder in Backlog, post-mvp-labeled but explicitly pre-UAT-holding). The UG signup flow verdicts in this audit are code-verdicts — they cannot clear device-observed bugs nobody wrote down. **Before UG UAT: Founder re-walks the UG happy path and either enumerates the bugs onto KAN-247 or closes it as no-longer-reproducible.**

---

## 8. Ops / data notes

1. **4 orphan pending UG churches on prod are SEED fixtures** (Damascus / Khartoum / Tashkent / Caracas) — queued for disposition on KAN-169, not evidence of a live signup defect.
2. **Two redundant region INSERT triggers coexist on `churches`** (May `trg_churches_set_region_admin_only` + June `churches_set_region_on_insert`) — harmless double-fire; dedupe someday; neither is mirrored in repo migrations.
3. **KAN-215: the Founder-ratified 2026-06-22 search tightening is NOT live** (UG church_code substring → exact equality; drop the `underground` boolean from the return shape), and **`get_invite_candidates` lost its church_code arm entirely** under the live-only `underground_safety_hardening_v1` apply. Rule: restore the arm or accept its removal (§5 smaller ratifications).
4. **Unmirrored-migration debt is a recurring audit tax.** Multiple live objects exist only as MCP applies with no repo mirror: the 2026-06-10→14 signup-sprint window, the 2026-06-23 UG waves (incl. `audit_log_underground` policies), kan63 PII crons, kan216 composite index, both region triggers, `underground_safety_hardening_v1`. Every one of these cost live-DB queries to verify this audit. Adopt mirror-on-apply as standing discipline (the 2026-07-02 P0 remediation already models it).
5. **Blog (KAN-228):** scaffold phases 1–4 committed and clean; Phase 5 (first real post, About copy, og image, Netlify site + DNS binding) is all Founder-gated.

---

## 9. What's genuinely strong (verified, not vibes)

The audit's job was gaps, but the record should also state what held up under 13 agents + live-DB verification:

1. **The underground protection stack.** UG exclusion verified on every onboarding query path (churches_public view-WHERE, find_church_by_code, find_parentable_churches, find_similar_churches post-P1-fix, search_leaders masking, get_invite_candidates); the join-code ceremony (one-shot reveal, bcrypt-at-rest, constant-time redeem, fail-closed 5/hr rate limit, generic single error, cap-of-2, comp-delete); `underground_no_location` CHECK; `enforce_underground_rag_red` trigger; 29 admin functions behind `makeUndergroundGatedHandler`; UG auto-route triggers keeping UG exchanges out of regular queues. Several protections exceed their tickets' specs.
2. **Escalated Cases (KAN-293) shipped whole.** 3-deep tier gating (tab hidden / route protected / BE assertAtLeast + AAL2 + rate limit + audit-first incl. denied paths), the propose→approve 2-eyes ceremony with self-approve blocked at BE AND DB CHECK, reach-out with mandatory attribution, UG dual-source filtering with bucketed omission counts. The 501-stubbed destructive execution is a deliberate scope-split (Leader Suspension Lifecycle), not a miss.
3. **The admin tier + step-up system.** Locked 4-tier AAL2 freshness (browse 30min / regular 30min / sensitive 5min / life-safety 90s) live FE + BE with fail-closed defaults; Option C+ TOTP step-up; the 1-sponsor-1-Manager promotion ceremony with dual-source sync + session invalidation (KAN-284 root cause eliminated); P0-2 privilege-column lockdown (grants + guard trigger) closing the self-promotion class entirely.
4. **No-orphan signup architecture (KAN-236).** register-church validation-only; church + leader written atomically; compensating auth-delete with resume-path guard; required idempotency keys with 200-replay cache; fail-closed dual rate-limit buckets; kill-the-app-mid-flow leaves zero rows. KAN-195's pending-gating matrix held at every layer checked (edge-fn guards, RPC predicates, and the 2026-07-02 client-write REVOKE sweep).
5. **The 5-tab app is real.** Five epics closed as delivered (Prayer Wall, Hamburger, Tab Bar, Persecuted/Heartcry, Connect); the name-structure foundation (KAN-229) is live end-to-end (structured columns + server-side resolver + FE consumers); mandatory admin MFA (KAN-96) and Team Management (KAN-53) closed under locked designs stronger than their original specs.

---

## 10. Suggested sequencing into UAT

Not a re-prioritization — the Founder owns sequencing. This is the dependency-honest ordering the evidence supports:

1. **One-line + small fixes with outsized risk reduction now:** KAN-136 hook restore; KAN-262 logo publish; KAN-291 wordlist ship (panel output is ready); KAN-114 residue (proven pattern, 5 endpoints).
2. **Founder decision batch (§5)** — most of it unblocks lane moves without code.
3. **Pre-UAT tester hygiene (§6)** — pull forward, hide, or brief; plus KAN-247 enumeration walk.
4. **The two build blockers:** KAN-198 (design file first) and KAN-274 (RFC ratified, build-ready).
5. **Workstream regrooms (§3):** email family against the 2026-06-24 panel; ONE consolidated lifecycle-sweep ticket; KAN-93 against the reach-out pattern; KAN-84 C1 SPEC ruling.
6. **Phase-gated items** stay gated: KAN-157 legal, KAN-222 copy sweep, KAN-289 opacity, secret rotation (behind UAT signoff per the release pipeline).

---

*Sources: 13 verdict files + LEDGER.md + AUDIT_BRIEF.md in [`docs/audits/2026-07-02-board-audit/`](./2026-07-02-board-audit/); Jira comments c.16005–c.16145; live-Jira full-board verification 2026-07-02; pre-UAT comprehensive audit 2026-07-01 for remediation lineage. The board tells the truth; this document is its ledger of what remains. In Jesus' name.*
