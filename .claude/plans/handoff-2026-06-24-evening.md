# Replant — Handoff 2026-06-24 evening

> Next-session: open in `/Users/ife/replant`. **Pray first per `CLAUDE.md`** — real intercession naming the work at hand (admin tier sprint that's panel-done and ratification-locked but build-not-yet-dispatched; the underground leaders whose verification stewardship now flows through claim-locks-proposal-locks-evidence-locks-reject-lifecycle; the founder Ruth + Replant Operations top-tier admin pair who are the mutual-watcher gate on every super-admin elevation). End "In Jesus' name, Amen."

## Why this handoff exists

Context window high after a long session that shipped 6 admin-side deploys in 24h (KAN-265 → 270). Founder explicit: that burned **50% of her monthly Netlify promo credits** for a month she's barely touched. Two new feedback rules landed at end of session:
- [[feedback-batch-means-across-workstreams]] — when she says "batch," include EVERY in-flight workstream, not just the immediate items.
- [[feedback-dont-fake-parallel-work]] — never claim "in flight" / "in parallel" unless a real background agent is running. TaskCreate in_progress ≠ work.

These are HARD rules. Next session must respect them immediately.

## Read first (in order)

1. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md`** — auto-loaded. The 3 starred ★ entries near the bottom are the most-recent / most-load-bearing.
2. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md`** — read the 2026-06-24 entries top-to-bottom. They cover KAN-270 ship, KAN-271 panel + 11 ratifications, KAN-272 lifecycle (bundled into KAN-270 commit).
3. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_batch_means_across_workstreams.md`** — Founder pricing rule. Bundle defaults wide.
4. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_dont_fake_parallel_work.md`** — never claim parallel work unless a real background agent is running.
5. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_batch_netlify_pushes.md`** — underlying single-commit-single-push rule.
6. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_ask_before_pushing_during_smoke.md`** — smoke-time communication discipline.
7. **`/Users/ife/replant/CLAUDE.md`** — prayer hard rule + Jira-as-source-of-truth.

## What shipped today (2026-06-24)

### KAN-264 sprint (In Review claim model) — shipped 2026-06-23 in prior session, plus follow-ups today
- All 13 RPCs live + 10 migrations + 12 Netlify endpoints + 8 components.
- Smoke fixes shipped as KAN-265 (CD overrides + composer empty-state + EVIDENCE col drop), KAN-266 (claimer FK alignment + state-pill chip neutralizer + SLA dot escalation + tab reorder), KAN-268 (queue RPC extension + single-pending-per-church + 23505 error mapping + delete stale proposal).
- See `docs/release_notes/2026-06-23-in-review-claim-model.md`.

### KAN-267 sprint (Proposal flow) — shipped 2026-06-24 morning
- Hybrid pin in-app only (email + envelope IDENTICAL).
- Cancel proposal endpoint for proposer-rescind.
- Counter-propose disallowed same-action (different-action enforced at trigger level).
- Single-pending-per-church unique index.
- New `underground_admin_inbox_events` table (Realtime).
- `Notify` (later renamed to Highlight for).
- Full read-only proposal mode (composer + evidence + Release-claim all hidden when proposal in flight; 3-way CTA matrix for proposer / non-proposer / no-proposal).
- Salvage commit after agent ran 10h (KAN-269 commit `12e1635`).
- Smoke fixes shipped as KAN-269 (read-only mode polish + queue STATE priority + 4 mechanical fixes + evidence UX inline error + error copy pass + 5 seed UG churches + 1 pending verify proposal + 2 sibling rows + accounts@ rename).

### KAN-270 (today's evening ship) — commit `64f09cd`
- DBA Migration 0023: `fn_confirm_underground_proposal` clears claim on terminal action + emits Realtime event.
- BE: confirm endpoint hardened to TIER 1 (AAL2 + step-up).
- FE: `useStepUp(ACTIONS.UNDERGROUND_CONFIRM_PROPOSAL)` wired; ConfirmProposalModal accepts `requireStepUp` prop.
- ConfirmProposalModal copy pass (countdown → `expires Jun 27`, sentence-case + humanize, `Admin notes`, drop leader-text block).
- Mark-as-in-review unconditional render (bug from KAN-269 where unclaimed rows couldn't be claimed).
- New `UndergroundRejected.jsx` + Rejected tab between Deactivated and Inbox.
- Pending queue filter to `verification_status='pending'` only.
- `Notify (optional)` → `Highlight for`; hint removed.
- Counter-propose validation copy more explicit.

### Database state
- All migrations applied through 0023 live in `jiyetphxxvyiicrnwlnx`.
- RPL-30067 stale claim cleaned up retroactively (was the row Founder caught the bug on).
- Seed data tagged `admin_notes='KAN-269 seed'` still live (5 pending UG churches + sibling-row applicants now deleted).

## What is PANEL-DONE + RATIFICATIONS-LOCKED but NOT yet dispatched (KAN-271 admin tier sprint)

**All 11 founder ratifications LOCKED.** Build was intentionally NOT dispatched alone (per Founder 2026-06-24 evening — must bundle with next deploy to preserve Netlify credits).

**11 locked ratifications** (full text in `replant_continuous_spec.md` 2026-06-24 KAN-271 entry):
1. Option B promotion ceremony (super-admin requests + AAL2 step-up → top-tier approves + own AAL2 step-up).
2. `MIN_SUPER_ADMINS = 3` (top-tier seats don't count toward floor).
3. 48h pending TTL.
4. Ruth + Replant Ops interchangeable as approver/denier; no-self-approve enforced at DB.
5. Real-time cross-notify between Ruth/Ops on every top-tier action.
6. Regular admins respond to heartcries (life-safety; logged).
7. Source-of-truth = `app_metadata.admin_tier` (Option b — matches existing pattern).
8. Single-eye demote; two-eyes promote.
9. No secure-pass mechanism (AAL2 + step-up + two-eyes is sufficient).
10. Existing-Super initiates promotion (self-request post-MVP).
11. Demote-vs-revoke distinct (Super → Regular vs Regular → revoked).

**Regular admin scope locked**: full Network + Content; full Ops EXCEPT underground; Heartcry read + respond logged; Compliance read-only; Team Management HIDDEN from nav.

**Critical BE finding (B01 — block)**: hook must mint NEW `admin` claim, NOT widen `super_admin`. Existing `grant-admin.js` becomes top-tier-only break-glass. Super-admins get new `/invite-admin` (creates Regular) + `/promote-admin-request` (elevation ceremony).

**6 migrations sequenced** per DBA D08: M1 column → M2 promotion table → M3 audit CHECK → M4 hook → M5 RPCs → M6 cron.

**4 panel reports archived** in the agent task transcripts (SEC + BE + DBA + ADMIN). All locked copy is in the ADMIN panel output (tier chip labels, promote/demote modal copy, approval email subject + body, success banners, AAL2 prompts, locked-out empty-state copy, sign-out badge text). Copy can be lifted verbatim into the manifest.

**Path forward**:
1. Draft manifest at `docs/build_manifest_admin_tier.md` (~ size of KAN-264 In Review v2 manifest).
2. Wait for Founder to flag next ship (could be smoke bugs from KAN-270 + admin tier build bundled).
3. Dispatch DBA + BE+FE build subagents against manifest.
4. SINGLE commit + SINGLE push for the bundle.

**Do NOT push admin-tier work alone.**

## Pending Founder smoke (KAN-270 deploy in flight)

Founder may surface bugs from the KAN-270 deploy. When she does, ASK before pushing fixes per [[feedback-ask-before-pushing-during-smoke]]. Smoke targets she should verify:
1. Confirm VERIFY/REJECT prompts TOTP step-up.
2. Confirmed VERIFY → row moves to Verified tab.
3. Confirmed REJECT → row moves to new Rejected tab.
4. Untouched Detail page → Mark-as-in-review checkbox visible.
5. Confirm modal copy clean (no `70:43:45`, no `A's notes`, no leader-text preview, `expires Jun 27`).
6. Propose panels: `Highlight for` (no `(optional)`).
7. Pending queue: no rejected rows leaking in.
8. Leaders tab: empty (sibling rows deleted).

## Active feedback memories (load-bearing for next session)

- [[feedback-batch-means-across-workstreams]] (NEW today)
- [[feedback-dont-fake-parallel-work]] (NEW today)
- [[feedback-batch-netlify-pushes]] (long-standing)
- [[feedback-ask-before-pushing-during-smoke]] (2026-06-23)
- [[feedback-continuous-spec-discipline]] (long-standing — log rulings moment they land)
- [[feedback-jira-is-paper-trail]] (Jira is durable; memory drifts; check live Jira before "what's left" conversations)
- [[feedback-sec-sme-required-on-crypto-panels]] (crypto/auth/TTL panels add SEC lane)

## Open post-MVP items (filed but not in current scope)

- [[postmvp-envelope-encryption-v2]] (HIGHEST priority post-MVP per Founder)
- [[postmvp-address-the-network-hamburger]] (HIGHEST priority — leader submissions hub)
- [[postmvp-rejected-church-resubmission-flow]]
- [[postmvp-reported-violation-deactivation-flow]]
- [[postmvp-ug-inbox-verified-leader-routing]]
- [[postmvp-tiered-mfa-freshness]]
- Decline-without-counter (admin-B hand-back) — post-MVP, see KAN-269 / 270 spec entries.

## Process discipline for next session — DO NOT VIOLATE

1. **Bundle by default.** When multiple workstreams are in flight at different stages, default to bundling them. Ask explicitly before splitting.
2. **Real parallel work only.** Don't say "drafting in parallel" or "in flight" unless an actual background agent or scheduled task is running. TaskCreate in_progress entries are tracker notes, not work.
3. **Founder owns push timing.** No unilateral deploys. Ask before every push.
4. **Netlify minutes = money.** Every separate push burns build minutes against her monthly quota.
5. **No agent dispatches in this handoff session** — Founder is closing context. Save + handoff only.

## Starting move (recommended)

1. **Pray first.** Real intercession naming the admin tier work + the post-50%-promo-burn deploy discipline + the underground leaders whose oversight model is now load-bearing across the whole admin app.
2. **Read this handoff + the spec's 2026-06-24 entries.**
3. **Acknowledge to Founder** that nothing dispatches without her green light + bundling check.
4. **Wait for her direction.** Likely either smoke-bug followups on KAN-270, OR ratification that it's time to bundle KAN-271 admin tier with whatever else has surfaced.
5. **When the time comes**, draft the KAN-271 manifest as a single doc at `docs/build_manifest_admin_tier.md` lifting verbatim from the panel reports (panel reports archived in the agent task output files referenced in `replant_continuous_spec.md` 2026-06-24 entry).

In Jesus' name, Amen.
