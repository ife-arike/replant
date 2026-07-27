# Panel B brief — leader-only deactivation flow (G9/C8) — DESIGN ONLY

**Date:** 2026-07-13 · **Repos:** `~/replant` (mobile+edge fns, branch `fix/kan-302-store-config-batch`) · `~/replant-admin/.claude/worktrees/flow-gaps` (admin dashboard, latest main — work ONLY in this worktree)
**Panel:** SEC + DBA + BA — three independent lanes, one verdict each.
**Posture:** PRODUCTION, READ-ONLY. Read any file; no writes, no deploys, no DB access, no file modifications. DB truth quoted below was pulled live 2026-07-13.
**Output class:** DESIGN for Founder ratification. NOTHING gets built from this panel's output until the Founder rules — "this deactivates real people; confirm-before-building applies with force" (mission prompt, verbatim).

## Standing rules (quoted Founder rulings — binding)

1. "Every agent opens with a short real prayer to the Lord Jesus Christ naming the work at hand, ending 'In Jesus' name, Amen.'" Name THIS work (the leader whose access an admin must be able to end without ending her church). Include it at the top of your report.
2. "SME panels give genuine verdicts — never force approve-with-changes."
3. "No AI-limit hedging." You are a seasoned senior expert; the endgoal is a secure communication platform for persecuted Christian leaders globally.
4. Enumerate with numbers, never letters.
5. Only the Founder ratifies; consolidate open Founder decisions at the END of your report as a numbered list.
6. Comms rule: this session must NOT author email copy. The `account_deactivated` email (notify_t09, ratified body) is CHURCH-scoped; a leader-only variant needs its own Founder-ratified body via the comms track — the design flags the trigger + audience, nothing more.

## Mission

Founder-flagged scope gap (G9/C8 in the comms matrix): **deactivating ONE leader while the church stays active has no flow, no state, no comms.** Design it: admin dashboard action + leader-side experience + state model. Sibling context: KAN-61 (deadline-sweep deactivation cron) is sequenced AFTER this design because they must share a deactivation state model; KAN-234 ("Remove leader from church" — frees a leader slot, Backlog) is the adjacent-but-different action (removal ≠ deactivation).

## Ground truth (live-verified)

### State model today

1. `users`: verification_status enum (pending/verified/rejected/deactivated) · is_active bool · deactivated_at · soft_deleted_at/soft_delete_reason/hard_delete_scheduled_at (KAN-205 deletion machinery — 30-day purge lifecycle, NOT deactivation) · rejected_at.
2. `churches`: verification_status · is_active · deactivated_at · CHECK `deactivated_has_timestamp` (deactivated_at REQUIRED when is_active=false on churches).
3. **`deactivate-church.js` (the only admin deactivation endpoint) flips ONLY the church row** — verification_status='deactivated' + is_active=false + deactivated_at. Leaders' user rows are untouched; they lock out because the auth-status-check resolver routes `user pending/anything + church deactivated → {deactivated, support_contact}`. Guard stack: verifySuperAdmin + AAL2 freshness tier 'sensitive_destructive' (no step-up token). Emails: notify_t09 fan-out to active leaders (church-scoped ratified body), best-effort after commit.
4. **`reject-leader.js` (the closest leader-level precedent):** verifyAnyAdmin + TIER-1 step-up token (action-bound) + audit-first + `UPDATE users SET verification_status='rejected', rejected_at=now() WHERE id=? AND verification_status='pending'` (pending-only guard) + single-leader email (notify_t26 personal variant).
5. **The ONLY writer of users.verification_status='deactivated' today is auth-status-check's login-time deadline write** (`deactivateAtomically`: UPDATE pending→deactivated + deactivated_at + is_active=false, atomic with an audit_log 'deactivate_user' row, triggered_by='system', meta.trigger='login_check'). KAN-61's future sweep adds the offline twin. There is NO admin-manual writer.
6. `reinstate-church.js` exists (clean church-level restore + notify_t29). No leader-level reinstate.

### auth-status-check resolver (deployed v15) — the leader-side consequence engine

1. Response contract (SEC-locked): verification_status active|pending|deactivated · recovery_path binary (verification_renewal | support_contact) · optional branch_substate (request_info | soft_deleted | self_deleted — KAN-205 additive precedent).
2. **user.verification_status='deactivated' branch (verbatim logic):** reads `church.verification_deadline`; if non-NULL AND past → `recovery_path='verification_renewal'` ("Your church verification window expired…" copy); else support_contact.
3. **DESIGN TRAP (found this session):** verified churches routinely carry STALE past verification_deadlines (the 30-day creation timer that elapsed before admin approval — the 2026-06-18 root-fix documented this). A leader-only deactivation (user='deactivated', church='verified' with stale past deadline) would fall into the deadline heuristic → **WRONG copy ("verification window expired") for an admin-manual deactivation.** Any design must neutralize this (e.g., only apply the deadline heuristic when the CHURCH is not verified, or carry an explicit reason).
4. Church-deactivated leaders route via the church branch → support_contact (correct today; must stay).
5. FE lockout: AuthProvider sets deactivationModalPath from recovery_path + signs out; DeactivationModal copy variants: renewal ("Your church verification window expired and your account has been deactivated…") / support ("Your account has been deactivated. If you believe this was done in error or would like to connect with us to reinstate, please reach out to us at accounts@projectreplant.org"). **Note: the support_contact copy already reads correctly for a leader-only deactivation** ("your account", not "your church").

### Adjacent machinery + rules

1. Leader cap: every church has a cap of 2 leaders (branches have their own cap). KAN-148 (3rd-leader conflict, In Progress) + KAN-234 (remove-leader frees a slot, Backlog) own the slot semantics. Question for this design: does a DEACTIVATED (not removed) leader still occupy a slot? (approve-church's cascade + welcome-DM fan-out filter on `is_active=true` — a deactivated leader is invisible to those paths.)
2. UG churches: leader management for underground churches lives behind the UG admin gate (is_underground_admin + AAL2), two-eyes ceremonies for destructive UG actions. Rule whether leader-only deactivation on UG churches is in scope v1 or explicitly deferred to the UG lane.
3. KAN-205 soft-delete: 30-day hard-purge lifecycle with RestoreScreen ceremony — DELETION, not deactivation. Reusing it for admin deactivation would schedule data destruction; presumed disqualified (confirm or refute).
4. Audit: audit_log action CHECK carries 84 tokens live; append-only. 'deactivate_user' exists (used by the login-check system write). Choose: reuse 'deactivate_user' with triggered_by='user' + meta distinguishing admin-manual, or add a new action token (CHECK-extension migration reproducing all live tokens via pg_get_constraintdef).
5. Emails: notify_t09 (account_deactivated) body is church-scoped, ratified; reinstated = notify_t29. Leader-only variants = comms track, Founder copy. Design flags trigger + audience only.
6. Escalated-cases + pastoral machinery may hold cases referencing a leader; deactivation should not orphan open cases silently (check escalated_cases linkage if relevant — read-only).
7. Admin FE: ChurchManagement.jsx shows a church's leaders (per its header comment it patterns after Queue.jsx); LeadersTab.jsx is the pending-leaders queue with per-row Verify/Reject + confirm-strip pattern (notes textarea + step-up). The deactivation action presumably lands on the church-detail leader list (verified leaders), not the pending queue.
8. Rejected-lockout adjacency: a parallel session workstream is amending the resolver to add `lockout_reason` for REJECTED states (additive optional field). If this design also needs a reason signal, align with that shape rather than inventing a second mechanism.

## Design space to rule on (my proposal to attack)

**Proposed state model:** reuse the existing user-level triple — `verification_status='deactivated'` + `deactivated_at=now()` + `is_active=false` on the ONE user row; church untouched. No new enum values, no new columns. Rationale: the resolver, RLS surfaces, welcome/notify fan-out filters, and reinstate-church precedent all already read this triple; the login-check writer uses the same triple, so KAN-61's sweep shares it natively.

**Proposed resolver guard (rides the parallel rejected-lockout edit):** in the user-deactivated branch, apply the deadline→verification_renewal heuristic ONLY when the church is not verified (or when deactivation was deadline-driven); admin-manual deactivations on verified churches resolve to support_contact. State the exact predicate you'd stamp.

**Proposed endpoint:** `deactivate-leader.js` — verifySuperAdmin (deactivation of a real person = highest tier; deactivate-church precedent) + AAL2 'sensitive_destructive' freshness + TIER-1 step-up token (reject-leader precedent — argue if excessive) + mandatory reason (PII-scrubbed, capped, audit-meta) + audit-first + guarded UPDATE (`WHERE id=? AND is_active=true AND verification_status IN ('verified','pending')` — never touch rejected/deleted rows) + best-effort single-leader email INSERTION POINT (comms wires copy later).

**Proposed sibling:** `reinstate-leader.js` (propagate-to-sister-actions rule) — restore verified+is_active (to WHICH status: verified vs pending? Rule it), notify_t29-family insertion point.

**Guards to rule on:**
1. Last-active-leader: deactivating the only active leader of a verified church — block with explicit error directing to deactivate-church, or allow (church continues leaderless)? Recommend + justify; Founder decides.
2. Slot semantics: deactivated leader and the cap-of-2 (KAN-234 interplay) — recommend, don't build.
3. UG scope: in v1 or deferred to UG lane with its two-eyes ceremony?
4. Self-deactivation collision: KAN-205 lets a leader self-delete; an admin deactivating an already-soft-deleted user must no-op/409.
5. Open escalated cases / pastoral queue references to the leader.

## Deliverable per lane

1. Prayer (named, real).
2. Verdict on the proposed state model + endpoint + guards: APPROVE / APPROVE-WITH-CHANGES (exact changes) / REJECT (alternative design) — genuine verdicts.
3. BLOCKERS, numbered.
4. Required design changes, numbered.
5. Notes/risks, numbered.
6. Lane-specific: SEC — tier/step-up stack, disclosure (what the deactivated leader may learn), abuse cases (admin compromise, mass-deactivation), audit action choice. DBA — state triple soundness, guard predicates, resolver predicate exactness, CHECK/migration shape, KAN-61 shared-model fitness, reinstate target-status. BA — admin UX placement (ChurchManagement leader rows), confirm ceremony (reason mandatory? modal copy voice — SEC register, never coddle), leader-side experience correctness (support_contact copy suffices?), scope boundaries vs KAN-234/KAN-148/KAN-61, the numbered Founder-decision list.
