# SME Panel Synthesis — Pastoral + Flagged Pre-Launch Bundle

**Bundle:** [KAN-293](https://projectreplant.atlassian.net/browse/KAN-293) (new Manager-tier surface) + [KAN-295](https://projectreplant.atlassian.net/browse/KAN-295) (dispose modal + reason) + [KAN-296](https://projectreplant.atlassian.net/browse/KAN-296) (reach out wiring) + [KAN-292](https://projectreplant.atlassian.net/browse/KAN-292) (per-tier escalate verb)
**Panel:** SEC + ADMIN + BE + DBA + CONTENT (5 lanes, all returned, genuine verdicts per [[feedback-sme-genuine-verdict]])
**Author:** SM, 2026-06-30
**Status:** awaiting Founder ratification before CD brief

---

## Overall verdict

The bundle is the right work to do. All 5 lanes agree on direction. Three conflicts are big enough to need explicit Founder ratification before any design or code starts; the rest of the synthesis is convergent enough to lock.

**The single most consequential finding** is BE's scope-split recommendation: pull revoke + temp-ban OUT of this bundle, into a separate "Leader Suspension Lifecycle" ticket with its own SEC + DBA panel and a two-eyes ceremony design. Replant has NO leader-level deactivation primitive in the codebase today (`deactivate-church.js` operates on churches; `deactivate_user` is in the canonical action set but no endpoint emits it). Inventing that lifecycle as a side-quest on the surface that ships the queue is too much. If you accept the scope-split, several other conflicts collapse (temp-ban model becomes a separate-ticket discussion, the destructive AAL2 + idempotency posture moves with it, the dispose-pathways simplify).

Per [[feedback-dont-default-to-mvp]] this isn't a "ship the lesser thing." It's "ship the queue + reach-out + dispose right, and ship suspension right separately, instead of half-shipping both together."

---

## Cross-lane scoreboard at a glance

| Topic | ADMIN | SEC | BE | DBA | CONTENT |
|---|---|---|---|---|---|
| Surface name | "Escalations" (R5) | — | — | — | **"Escalated Cases"** |
| Surface placement | New `/escalated` sibling page in Operations | — | — | — | `Operations / Sensitive` lineage (mirrors Pastoral + Underground) |
| Structure | Two sections by source axis | — | Two separate endpoints | SQL VIEW UNION | (didn't dispute split) |
| Scope: revoke + temp-ban | IN (named in action set) | IN (canonical helper) | **OUT — scope-split** | IN (user_bans table) | IN (Restrict + Revoke modals drafted) |
| Reach Out channel | A. Email | B. Connect DM default | A. Email with guardrails | flexible | B. Connect DM |
| Temp-ban model | mute/restrict/ban graduated | Manual reinstate, NO cron | (moves to separate ticket) | Dedicated `user_bans` + pg_cron 1-min auto-lift | "Restrict" + auto-lift implied |
| Tier-gate primitive | — | New `verifyManagerOrSuperAdmin` helper | Use existing `assertAtLeast('super_admin')` | (NO SQL helper exists) | — |
| List endpoint shape | — | — | **Two endpoints + FE compose** | **SQL VIEW** | — |
| Verbs (KAN-292) | original brief OK | original brief OK | one BE action, FE label only | — | **Rewrite both** — "Escalate this case" / "Add to escalated cases" |
| Dispose verb | "Dispose" | — | — | — | **"Close case"** |
| Dispose taxonomy | basic | category + freeform | — | category + freeform | **8 tokens, excludes "abusive" intentionally** |
| AAL2 for destructive | 5min sensitive | 5min sensitive | 5min sensitive (when ships) | — | — |

---

## CONFLICTS — explicit Founder ratification needed

### Conflict 1 — Scope: revoke + temp-ban IN or OUT?

**BE's position (BLOCKING if accepted):** OUT. Replant has no leader-level deactivation primitive today. Inventing it inside this PR means inventing the schema (column on `users` vs new `user_bans` table), the lifecycle (how a banned leader appears in feeds / branch DMs / Prayer Wall / Heartcry — each is a separate dataflow), the recovery (who reinstates, two-eyes vs single, auto-lift vs manual), and the audit shape (`deactivate_user` is in the canonical set but never emitted — meta contract undefined). Founder is being asked to invent a leader-soft-deactivation lifecycle on the same surface that ships the queue.

**SEC, DBA, CONTENT positions (assumed IN):** SEC produced canonical helper design (4-guard target check, dual-source sync, session-kill, 6 audit actions). DBA produced `user_bans` table DDL + pg_cron auto-lift function. CONTENT produced "Restrict temporarily" + "Revoke access" modal copy with leader-side notices. All 3 assumed the bundle ships destructive actions.

**My synthesis read:** BE is right. The three other lanes did excellent forward-work on what suspension SHOULD look like; that work doesn't get thrown away, it goes into the separate ticket's design. This PR ships the queue + dispose + reach-out. Suspension ships next, with its own SEC + DBA panel + two-eyes ceremony, design done before the destructive endpoint ships per [[feedback-confirm-before-removing]] applied forward.

**Founder ratification asked.** If you accept scope-split:
- The Escalated Cases surface ships in this PR with action buttons for Reach Out + Dispose + Close
- Revoke / Restrict buttons render stubbed-disabled with "coming in [next ticket]"
- All the SEC + DBA + CONTENT work on suspension design carries forward intact to the next ticket

If you reject scope-split: keep the bundle as-briefed; accept the gauntlet; SEC + DBA + CONTENT designs are foundational.

---

### Conflict 2 — List endpoint shape: SQL VIEW or two endpoints?

**DBA's position:** ONE SQL VIEW (`v_escalated_inbox`) with `security_invoker=true` UNIONing the two sources at the database. Sub-ms at 100K messages. Real-time correctness for safety surface. RLS composition free. BE-side query is simpler.

**BE's position:** TWO endpoints (`list-escalated-flagged-messages.js` + `list-escalated-pastoral-items.js`). FE composes — two concurrent fetches, merge in JS. Reasons: the two sources have *diverged audit semantics* (different `*_queue_opened` actions = different reconnaissance signal), *diverged schemas* (flagged-escalated carries `flag_reason`; pastoral-axis carries `meta.escalation_reason` + chain back to original pastoral row), *diverged future evolution* (KAN-293 may grow new escalation sources; UNION becomes a god-route).

**Common ground:** Both lanes agree the surface presents two source axes. The conflict is where the join happens.

**My synthesis read:** BE wins on Replant-specific grounds — every surface in this codebase is audit-shaped, and the `*_queue_opened` reconnaissance signal needs to be source-distinguishable for forensic clarity. DBA's "VIEW is sub-ms" is correct but doesn't address the audit-shape question. DBA's view design also requires the `escalate-flag.js` migration (SEC F7) to land first so both sources write to `moderation_state` — that migration is needed anyway, but it's an additional dependency.

**Founder ratification asked.** Lean BE.

---

### Conflict 3 — Reach Out channel: A (email) or B (Connect DM)?

**Lane votes:**

- **A (email):** ADMIN + BE
- **B (Connect DM):** SEC + CONTENT
- **flexible:** DBA

Rounds 1-2 looked like 3-of-4 voting B against your A lean. BE's return changed the calculus. Both A and B have real risks:

**Risks of A (email):**
- Resend logs retain `to` / `subject` / `timestamp` / `delivery_status` indefinitely in Resend's infra under their retention policy, not Replant's
- Underground leader's `contact_email` is real-name PII; even with body hygiene, email metadata is a connection trace
- Subject lines visible in lock-screen previews + downstream mail filters
- Five months of Replant work minimizing Resend exposure gets partially reversed

**Risks of B (Connect DM via KAN-220):**
- Requires welcome DM conversation to EXIST between system user and leader. Reliable for verified leaders; flaky for in-between states (verified-but-no-welcome-DM-yet, deactivated leader, etc.)
- The leader has to OPEN the app to see it — if they're in distress and may not check in for days, email reach is broader
- KAN-220 `send-team-reply.js`'s system-user fronting needs extending for admin freeform composition

**BE's reconciling proposal — Option A with guardrails:**

1. UG-identity scrub on subject + body server-side (extend `scrubAndCap` family with a UG-identity-leak check for any leader whose `church.type='underground'`)
2. React Email template sandbox — admin types into a `body` field; system fills `subject`, `from`, footer. Admin gets at most: optional subject hint + body
3. From: `Replant Team <connect@projectreplant.org>` — NEVER admin's personal email
4. Audit-first ordering — write `pastoral_reach_out_sent` with `meta.resend_id: null` placeholder BEFORE send; UPDATE row's meta with `resend_id` from Resend response (or INSERT a second `pastoral_reach_out_delivered` row on Resend 200)
5. Per-leader rate limit (1 reach-out per 24h per leader_user_id) — pastoral discipline against carpet-bombing a brother having a hard week

If A wins with these guardrails, SEC + CONTENT's metadata-leak concerns are mitigated (no UG identity in subject/body; admin freeform sandboxed; React Email template controls). The remaining risk is the Resend log row existing at all — but that's the same risk every existing leader-targeting email already carries.

CONTENT also drafted the full email template (subject locked to generic "Reaching out — Replant team"; body template with grace-and-peace framing) as the fallback if Founder rules A. That template is ready to lift.

**Option C (disposition-only): REJECTED unanimously** — a Reach Out surface with no actual outbound is worse than the current `/pastoral` queue.

**My synthesis read:** A with BE's full guardrails. SEC + CONTENT's reasoning is fully addressed by BE's guardrails. Founder's UX-on-any-device instinct + the Resend infrastructure already wired makes A the more reliable channel.

**Founder ratification asked.**

---

## CONVERGENCES — lockable unless you object

### C1 — Surface lineage: `Operations / Sensitive` (NOT `/ Moderation`)

CONTENT argued; no lane disagreed. Sensitive lineage mirrors Pastoral + Underground (account-level destructive paths). Moderation lineage is Flagged (message-level actions). Escalated Cases acts on the leader's account standing → Sensitive.

### C2 — Surface name: "Escalated Cases"

CONTENT pushed (dissent #1). ADMIN's R5 leaned away from "Inbox" too. No lane defended "Inbox." Cases reads as a standing register of leader-level dispositions; Inbox reads as a message queue awaiting reply (which Replant Team Inbox already owns on the Pastoral surface).

### C3 — Per-tier verbs (KAN-292)

CONTENT pushed back on BOTH original verbs. Lock:

- **Regular admin:** `Escalate this case` (matches existing Flagged.jsx Escalate verb admins are trained on; no recipient implied)
- **Manager / super_admin:** `Add to escalated cases` (placement language; honest about establishing case-level state)

Both buttons → same BE action (`escalate_to_admin` extended to accept either FE-label) per BE F6. NO new BE enum unless FE needs to disambiguate for audit comprehension.

### C4 — Dispose verb: "Close case"

CONTENT argument: "Dispose carries warehouse-disposal energy. A case isn't garbage; it's a leader's record being closed because the situation resolved." No lane defended "Dispose."

### C5 — Temp-ban renaming: "Restrict temporarily"

CONTENT: *"We don't ban leaders. That's a register from social platforms that have an adversarial relationship with their users. Replant has a pastoral relationship with leaders, even ones who escalated. A restriction is something a parent or a pastor does; a ban is something Reddit does."* If destructive actions ship in this bundle (Conflict 1 IN), use "Restrict." If they go to a separate ticket, the naming carries.

### C6 — Dispose taxonomy (KAN-295)

CONTENT's 8-token set with strong exclusions:

1. `resolved_by_reach_out` — leader replied; situation closed
2. `resolved_no_outreach` — case resolved itself
3. `false_signal` — flag shouldn't have been raised
4. `routing_misclassification` — belonged on another queue
5. `access_revoked` — case acted on (suspension ticket)
6. `restriction_applied` — case acted on (suspension ticket)
7. `escalated_to_super_admin` — out of this register's scope
8. `pending_external` — follow-up offline

**Deliberately excluded:** "abusive — pattern of behavior" (would tempt admins to close without taking the destructive action the pattern demands); "leader requested closure" (leaders have no visibility into the case register).

Required: structured category (enum) + freeform supplement (≥30 chars, scrubAndCap'd, mirrors `ForceUnmarkModal.jsx` pattern).

### C7 — AAL2 freshness tier per endpoint

Per [[locked-tiered-mfa-freshness]]:

- List endpoints (`list-escalated-flagged-messages` + `list-escalated-pastoral-items`): **browse** (30 min) — mirrors `list-flagged-messages` today
- `dispose-escalated-item`: **regular_destructive** (30 min) — non-life-safety mutation
- `pastoral-reach-out-email`: **regular_destructive** (30 min) — email is destructive-in-irreversible sense
- `revoke-leader-access` + `temp-ban-leader` (when shipped): **sensitive_destructive** (5 min) + action-bound step-up

### C8 — Audit-first ordering on all destructive paths

Per KAN-117 Third Option. Audit row written BEFORE side-effects. Failed-action paths still write audit rows with `meta.failure_reason`. New `AUDIT_FAIL_TAG` per endpoint module.

### C9 — UG exclusion check on list endpoints (BE Rec E)

Both list endpoints must explicitly exclude messages where sender or receiver is in an `underground` church UNLESS calling admin has `is_underground_admin=true` (dual-source check per [[ug-flag-dual-source-bug]] — JWT claim AND `public.users.is_underground_admin` column). Skipping this risks surfacing a flagged UG message to a non-UG admin → top-tier invariant violation per [[replant-load-bearing-invariants]].

### C10 — `escalate-flag.js` migration to write admin-axis row

SEC F7 + DBA F-4 + BE F1 all imply this. Currently `escalate-flag.js` only sets `messages.flag_status='escalated'`. The Escalated Cases surface needs both sources to write `moderation_state axis='admin' status='pending'` so the queue query is uniform. Migration includes one-shot backfill of historical `flag_status='escalated'` rows that don't yet have a corresponding `moderation_state` admin-axis row.

### C11 — Per-leader rate limit on reach-out

BE Rec B: 1 reach-out per 24h per `leader_user_id`. Above-limit = 429 + audit with `failure_reason: 'leader_target_rate_limit'`. Pastoral discipline.

### C12 — Two-eyes ceremony for destructive leader actions (when they ship)

SEC R4 + BE Rec A + DBA implicit. Mirrors underground proposal flow (KAN-272 confirm-proposal pattern). Anchored biblically in 1 Timothy 5:19 ("Do not entertain an accusation against an elder unless brought by two or three witnesses"). Lands with the suspension-lifecycle ticket if scope-split accepted.

### C13 — Tier-gate primitive: extend existing `assertAtLeast`

BE F7. Use `_lib/admin-tier-gate.js` `assertAtLeast(authHeader, 'super_admin')` after `verifyAnyAdmin`. Admits `top_tier` (Founder) + `super_admin` (Manager display). Blocks regulars. One line at each callsite. NO new `verifyManagerOrSuperAdmin` helper.

SEC's worry about tier-denied reconnaissance audit rows still holds — both list endpoints write `tier_denied` audit rows on the failed-`assertAtLeast` path (mirror rate-limit-denied pattern). Minimal action proliferation: reuse `escalated_inbox_opened` with `meta.failure_reason: 'insufficient_tier'`.

### C14 — Listen-first action order (CONTENT pastoral framing)

Per Proverbs 18:13. Action buttons arranged: Reach out → Restrict → Revoke → Close. Visual flow nudges right disposition without writing a single instruction.

### C15 — Audit canonical actions (3 new in this bundle if scope-split accepted)

Minimal set, rich meta:

1. `escalated_inbox_opened` — meta: `source: 'flagged' | 'pastoral'`, `count_returned`, standard ip/UA/session_id, `failure_reason?` for tier-denied + rate-limit-denied
2. `escalated_item_disposed` — meta: `source`, `message_id`, `disposition_category` (8-enum), `disposition_reason` (scrubAndCap), `original_axis`
3. `pastoral_reach_out_sent` — meta: `leader_user_id`, `channel: 'email'`, `message_id` (the original flagged), `template_id`, `resend_id` (post-send)

DBA-naming convention preferred (`escalated_item_disposed` vs SEC's `escalated_row_dispositioned` — both fine; pick one for consistency).

Suspension-lifecycle ticket adds: `user_access_revoked`, `user_temp_banned` (or `user_restricted`), `user_ban_lifted` (or `user_restriction_lifted`), `leader_reinstated`. Naming TBD when that ticket scopes.

Migration: ADD-ONLY to live CHECK constraint (currently 65 actions per DBA, NOT 47 as spec §07 states — spec drift to address separately).

---

## Action set on the Escalated Cases surface (post-synthesis)

If scope-split accepted (Conflict 1 = OUT):

| Action | Verb | What it does | Notes |
|---|---|---|---|
| 1 | Reach out | Open compose modal → send email via `pastoral-reach-out-email` | Per-leader 1/24h rate limit; React Email sandboxed; UG-identity scrub |
| 2 | Restrict temporarily | **STUBBED-DISABLED** | "Coming in [suspension-lifecycle ticket]" |
| 3 | Revoke access | **STUBBED-DISABLED** | "Coming in [suspension-lifecycle ticket]" |
| 4 | Close case | Dispose modal with 8-enum + freeform reason | DB-state-as-idempotency (terminal-status returns 409 on re-action) |

If scope-split rejected (Conflict 1 = IN):

| Action | Verb | Lane positions |
|---|---|---|
| 1 | Reach out | Same as above |
| 2 | Restrict temporarily | SEC: manual reinstate, no cron. DBA: `user_bans` + pg_cron 1-min auto-lift. CONTENT: auto-lift implied. → Founder pick |
| 3 | Revoke access | SEC canonical helper (4-guard target check, dual-source UG sync, session-kill, audit-first); CONTENT modal copy ready |
| 4 | Close case | Same as above |

---

## Ratification asks (numbered, all in one list per [[feedback-consolidate-questions-at-end]])

1. **Conflict 1 — Scope:** revoke + temp-ban OUT (BE recommendation; ship suspension as separate ticket with two-eyes ceremony) or IN (keep bundle as briefed)?
2. **Conflict 2 — List endpoint shape:** two endpoints + FE compose (BE) or one SQL VIEW (DBA)?
3. **Conflict 3 — Reach Out channel:** A (email, with BE's full guardrails) or B (Connect DM via KAN-220, with welcome-DM dependency)?
4. **Convergence C2 — Surface name** "Escalated Cases" — agree or override?
5. **Convergence C3 — Per-tier verbs** "Escalate this case" / "Add to escalated cases" — agree or override?
6. **Convergence C4 — Dispose verb** "Close case" — agree or override?
7. **Convergence C5 — "Restrict temporarily"** (vs "Temp ban") — agree?
8. **Convergence C6 — Dispose taxonomy** 8-token set excluding "abusive" and "leader requested closure" — agree or add/remove tokens?
9. **Convergence C14 — Listen-first action order** Reach out → Restrict → Revoke → Close — agree?
10. **`escalate_to_manager` BE action** — keep one BE action (`escalate_to_admin`) and rename FE label only, or fork BE enum for audit comprehension? BE leans one-action.
11. **Per-leader rate limit on reach-out** — 1/24h or other cadence? Founder-only override flag for crisis cases?
12. **SLA buckets on the aggregate banner** — 3/7/14 days illustrative; lock these or other thresholds?
13. **Case ID convention** — `EC-XXXXXX` register (mirrors `RPL-XXXXX`), or no new ID surface and just use `message_id`?
14. **Reach-out identity surfaced to leader** — admin's personal name OR shared "Replant Team" identity? CONTENT drafted for admin's name; KAN-220 precedent is "Replant Team."
15. **Spec §07 drift remediation** — 47-action figure is stale (live is 65). File a separate cleanup ticket?

---

## What lands next (after ratification)

- CD brief drafted from these locks → saved to `.claude/plans/cd-prompt-escalated-cases.md` for paste-ready use
- Build manifest drafted to `docs/build_manifest_escalated_bundle.md` mirroring the In Review v2 structure
- Mini-panel pass on the manifest before code dispatch per [[feedback-sme-panel-required]]
- 3-lane build (BE + FE + DBA) once manifest locked; mobile lane skipped (no leader-side surface changes in this bundle if reach-out channel = A)

---

## Mini-panel updates 2026-06-30 (post-CD return)

After CD delivered scaffolds at `/Users/ife/replant/docs/design_handoff_escalated_cases/`, 3-lane mini-panel (SEC + DBA + BE) reviewed for security gaps + schema implications + BE endpoint shape. **All 3 lanes converged.**

### Cross-lane converged calls (Founder-ratified 2026-06-30)

- **2 NEW tables required.** `moderation_state` alone can't carry the 5-state case machine. DBA provided full DDL:
  - `escalated_cases` — case-level entity with state machine (`open` / `awaiting` / `replied` / `pending_proposal` / `closed`), source axis enum (`flagged` / `pastoral` / `auto_underground`), 5-enum escalation_reason, EC-XXXXXX case_id_seq, full closed-state consistency CHECKs
  - `escalated_case_proposals` — proposal sub-table mirroring `underground_verification_proposals`. **`CHECK (proposer_id IS DISTINCT FROM approver_id)`** at DB floor for 1-approval-non-self ceremony. **Partial unique `(case_id) WHERE proposal_status='pending'`** for concurrent-proposal race protection (BE catches 23505 → 409 PROPOSAL_EXISTS)
- **UG auto-routing happens at WRITE time** (NOT read time). DBA's trigger model on `messages` flag_status flip: when sender or receiver in `church.type='underground'` → INSERT escalated_cases row with `auto_routed=true`, `source_axis='auto_underground'`, `escalated_by=NULL`. Same path for pastoral_signals via parallel trigger. UG content NEVER lands on `/pastoral` or `/flagged` for non-UG admins because never written there. BE F5 confirms; SEC F1 architectural fix.
- **Single SQL VIEW** (`v_escalated_inbox` with `security_invoker=true`) over the new tables — single endpoint, LEFT JOIN on pending proposal, server-computed `age_days`. **Revisited and supersedes prior C2 lock (two endpoints + FE compose)** — with the new table, divergent audit semantics collapse into `source_axis` column.
- **6 new audit actions** (verified live constraint is 64, NOT 65 as prior docs claimed):
  - `escalated_case_created` · `escalated_case_auto_routed` · `escalated_proposal_proposed` · `escalated_proposal_approved` · `escalated_proposal_rejected` · `escalated_case_closed`
  - Plus retain `escalated_inbox_opened` + `escalated_case_reach_out_sent` from C15
- **1-approval-non-self at DB CHECK** — not just FE / not just BE — defense in depth. FE deters; BE re-enforces via JWT-derived caller identity (NOT client-supplied proposer_id); DB CHECK is the floor
- **`approveEscalatedProposal` raised to `sensitive_destructive` (5 min) + action-bound step-up token** — supersedes prior C7 lock at 30 min. Approve IS the load-bearing ceremony preventing 1-Manager destructive action; mirrors `confirm-underground-proposal.js`. Step-up `expectedAction: 'approve-escalated-proposal'`. **Founder noted post-launch consideration: raise destructive AAL2 freshness from 5 → 10 min once ground-truth interrupt data lands.**
- **`reasoning` field on proposals** + **`context` field on escalations** + **`note` field on close**: all scrubAndCap-bound + UG-identity scrub when case touches a UG leader + 500-char cap. Modal placeholders updated to *"Describe in your own words. Don't paste message content."* (mirrors F8 wordlist mitigation).
- **`escalateCaseFromQueue` is NOT a new endpoint** — BE F3 recommendation: extend `triage-pastoral-action.js` (action=`escalate_to_admin`) and `escalate-flag.js` with the 5-enum `escalationReasonCategory` + `escalationContext` fields. Avoids god-route; preserves source-distinguishable reconnaissance signals (BE F6 prior).
- **UG auto-routing destination — Option A (Founder ratified 2026-06-30):** UG cases land in Escalated Cases tab, filtered to UG admins via `isUndergroundAdmin` dual-source check ([[ug-flag-dual-source-bug]]). Non-UG super_admin / Manager sees `omitted_count` field instead of the rows. CD's scaffolds aligned to Option A already.
- **Reach Out sender attribution (Founder ratified 2026-06-30):** Option (b) — sequence mobile-FE attribution change BEFORE Escalated Cases BE build. Task #21 filed.

### Per-endpoint posture table (SEC F3 + BE F2-F6 consolidated)

| Endpoint | Gate | AAL2 | Step-up | Rate limit | Notes |
|---|---|---|---|---|---|
| `listEscalatedCases` (single endpoint over `v_escalated_inbox` VIEW) | `verifyAnyAdmin` + `assertAtLeast('super_admin')` + UG dual-source filter | browse (30 min) | — | 60/min admin | `escalated_inbox_opened` audit-first with `meta.omitted_underground_count` rounded to bucket; tier-denied path writes audit row with `meta.failure_reason='insufficient_tier'` |
| `escalateCaseFromQueue` (NOT new — extends existing) | `verifyAnyAdmin` (regular OK) | regular_destructive (30 min) | — | existing | Extends `triage-pastoral-action.js` + `escalate-flag.js` with 5-enum + scrubAndCap context |
| `reachOutToLeader` | `verifyAnyAdmin` + `assertAtLeast('super_admin')` + UG dual-source + per-leader 1/24h | regular_destructive (30 min) | — | 1/24h per leader | Audit-first then KAN-220 extended `send-team-reply.js` with admin attribution mode (gated on Task #21 mobile-FE) |
| `proposeEscalatedAction` | `verifyAnyAdmin` + `assertAtLeast('super_admin')` | regular_destructive (30 min) | — | 30/min admin | DB partial-unique enforces 1-pending-per-case; `count < 2 Managers` returns 409 `manager_quorum_required` |
| `approveEscalatedProposal` | `verifyAnyAdmin` + `assertAtLeast('top_tier')` | **sensitive_destructive (5 min)** | **REQUIRED** `expectedAction: 'approve-escalated-proposal'` | 10/min admin | DB CHECK prevents self-approve; row lock `FOR UPDATE` on proposal; calls suspension-lifecycle endpoint (stubbed per Task #17) |
| `rejectEscalatedProposal` | `verifyAnyAdmin` + `assertAtLeast('top_tier')` | regular_destructive (30 min) | — | 30/min admin | Reason ≥30 chars + scrubAndCap |
| `closeEscalatedCase` | `verifyAnyAdmin` + `assertAtLeast('super_admin')` | regular_destructive (30 min) | — | 30/min admin | DB row lock + already-closed 409 with existing disposition for UX; row leaves `v_escalated_inbox` (no Resolved register per Founder) |

### Open items for build manifest

- Task #21 (mobile-FE attribution slot) sequenced before Task #11 BE build
- Reconcile with Task #20 (SEC F1+F2+F3 backwards-compat fixes for `list-flagged-messages` / `open-flagged-message` / etc.) — they're independent BE tracks but share architectural intent; UG auto-routing handles new flagged messages, Task #20 handles existing-pre-launch flagged messages

---

## Pastoral wisdom held by the panel

Three lanes brought scripture; converged on the same anchor.

**Galatians 6:1** (SEC + BE + CONTENT) — *"Brothers and sisters, if someone is caught in a sin, you who live by the Spirit should restore that person gently. But watch yourselves, or you also may be tempted."*

CONTENT's gloss: *"The escalation flow is, in effect, the admin equivalent of this verse. We don't ban; we restore. We don't dispose; we close cases with care. 'Watch yourselves' lands hardest on the admin — the very act of administering discipline has its own tempting energy. The clinical register we're holding here is a structural defense against the admin's own temptation to use the surface punitively. The copy carries that."*

**1 Timothy 5:19** (SEC) — *"Do not entertain an accusation against an elder unless it is brought by two or three witnesses."* The two-eyes ceremony for destructive leader actions is the Pauline pattern transposed into software.

**Proverbs 18:13** (CONTENT + BE) — *"To answer before listening — that is folly and shame."* The action ordering on the surface (Reach out FIRST, then Restrict, then Revoke, then Close) reflects the verse: listen first, act only when listening doesn't suffice.

**Proverbs 27:5** (DBA) — *"Better is open rebuke than hidden love."* A ban without an audit trail is hidden love — a punishment whose reasoning dies with the admin who set it. A ban with rich history is open rebuke — visible, accountable, repentance-shaped.

May the gate hold. In Jesus' name, Amen.
