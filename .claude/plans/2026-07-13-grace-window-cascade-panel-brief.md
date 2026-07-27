# Mini-panel brief — church-deactivation grace-window cascade (SEC + DBA)

**Date:** 2026-07-13 · **Dispatcher:** flow-gaps session · **Lanes:** SEC, DBA (2 agents, opus, PRAY FIRST naming this work — non-negotiable)
**Deliverable per lane:** verdict (APPROVE / APPROVE-WITH-CHANGES / REJECT-WITH-ALTERNATIVE) on the Founder's design hypothesis below, with blockers, required changes, and open Founder decisions. GENUINE verdicts only.

## The hole being fixed (P1, verified 2026-07-13)

`deactivate-church.js` flips only the church row. `auth-status-check` (deployed v16 — source of truth = `~/replant` branch `feat/flow-gaps-mobile`, `supabase/functions/auth-status-check/logic.ts`) short-circuits `verification_status === "verified" → active` BEFORE any church check. So a VERIFIED leader on a DEACTIVATED church keeps a fully working session + working RLS writes (RLS hardening keys on user-level `is_active`). Church deactivation only locks out pending/rejected leaders.

## Founder's design hypothesis (2026-07-13, verbatim intent — CHASE THIS FIRST)

> "shouldn't leader be brought back to no church, you have 7 days to link to a church or you'll be deactivated"

I.e. on church deactivation, verified leaders are NOT hard-locked and NOT left active-attached: they are returned to a **churchless state with a 7-day grace window** to link to another church; if the window lapses, they are deactivated (existing machinery).

## Existing machinery the hypothesis maps onto (verify each against live/branch code)

1. **Skip-flow pending state:** `users.church_id` is nullable; a churchless leader with `verification_status='pending'` + `users.verification_deadline` set routes through the resolver's skip-flow branch: countdown → past-deadline → `deactivateAtomically` (login-check) → `support_contact` lockout (isSkipFlow → support, not renewal). A 7-day window = `verification_deadline = now() + interval '7 days'`.
2. **KAN-61 interlock (continuous-spec 2026-07-13 XV/XVI):** the deadline sweep is CHURCH-level flag-for-admin-confirm; admin confirm runs `deactivate-church`. Any cascade added to deactivate-church ALSO fires on that path. KAN-61 XV explicitly assigns "skip-flow expired leaders" to this lane.
3. **Verification banner copy:** the skip-flow pending leader sees the locked "register your church" banner variant (days === null masks countdown — CHECK: the 7-day leader would see NO countdown under current masking; is that acceptable, or does this state need its own copy? FLAG, don't author).
4. **Linking surface — CRITICAL PREREQUISITE CHECK:** does a signed-in churchless leader have an in-app path to link/register a church TODAY? (KAN-192 built join-existing-verified-church at ONBOARDING; RegCP flow exists post-ASP2.) If no in-app surface exists for an EXISTING session, the 7-day window may be a promise the app can't keep — establish ground truth and weigh it. (Mobile repo: `~/replant` branch feat/flow-gaps-mobile.)
5. **t09 email:** deactivate-church's fan-out emails `account_deactivated` (ratified body "Your Replant account has been deactivated…") to ALL active leaders. Under the hypothesis that body becomes FALSE for verified leaders (they enter grace, not deactivation). Comms implication — FLAG trigger/audience split (grace-window leaders need a DIFFERENT, yet-unwritten email; body = comms track). Do NOT author copy.
6. **Sister action (propagate-to-sister rule):** `reject-church` strands verified leaders identically (church rejected; leader verified → active short-circuit — same hole, and F4's church_rejected lockout only fires for PENDING leaders). Rule on whether the cascade covers rejected churches too, or flag as follow-up.

## Questions the panel must answer

1. Is the grace-window cascade SOUND as the P1 fix (vs instant lockout / vs resolver-only check)? Evaluate the Founder's hypothesis FIRST; alternatives only if it fails.
2. Exact cascade write (in deactivate-church, after the church update): which user rows (verified only? active only? `is_active=true AND verification_status='verified' AND soft_deleted_at IS NULL`?), and what do they become? Candidate: `church_id=NULL, verification_status='pending', verification_deadline=now()+7d` + audit rows per leader. What happens to pending leaders on the same church (today they lock out via the pending branch — does the cascade change them)?
3. Does unlinking `church_id` break referential/data integrity anywhere load-bearing (messages, conversations, prayer_requests, comments, heartcries, branch tables, escalated_cases.leader_user_id, admin views)? DBA sweeps.
4. Reinstate-church symmetric restore: how does a reinstated church get its leaders BACK (church_id was nulled — snapshot in audit meta? a `previous_church_id` column? or accept one-way)? This is the hardest part of the hypothesis — be honest about the cost.
5. UG scope: underground churches deactivate via the UG lane — does the cascade apply, and does nulling church_id on UG leaders violate any UG invariant (join-code, region masking)? Recommend v1 scope.
6. Resolver: with the cascade in place, is a resolver-side church check for verified users still needed as a belt (the hole stays open for any OTHER path that deactivates a church without the cascade — e.g. direct SQL), or does the cascade suffice? Cost of the belt: verified-branch reads church on every check.
7. Interaction with gap-5 leader-only deactivation (deactivate-leader, being built now): any conflicts with the state triple / audit tokens / reinstate-leader semantics?

## Ground rules

Production posture; read-only investigation (NO writes); cite file:line for every load-bearing claim; number everything; consolidate Founder decisions at the end; no time estimates; the ratified t09 body and all email copy are comms-track property — flag, never author.
