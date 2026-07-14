# Leader-only deactivation (G9/C8) — panel-synthesized design for Founder ratification

**Date:** 2026-07-13 · **STATUS UPDATE (same day):** Founder ruled "go ahead" → **Part 1 is BUILT** (deactivate-leader + reinstate-leader + LeaderSlots UI + target-bound step-up + CHECK migration, on the PR #80 branch; divergences resolved per the recommendations: verified-only scope → reinstate-to-verified; allow-with-warning; new audit tokens). **Part 2 (grace-window cascade, appended below) is DESIGN-ONLY awaiting her ratification** — its SEC+DBA mini-panel returned APPROVE-WITH-CHANGES with two hard blockers. The P1 resolver belt both lanes required is BUILT + DEPLOYED (auth-status-check v17).
**Panel:** SEC + DBA + BA, all three lanes returned genuine **APPROVE-WITH-CHANGES** on the same skeleton (no lane rejected; no verdict forced). Full lane reports live in the session transcript; this doc is the synthesis.
**Sibling scopes held:** KAN-234 (remove leader / free slot) ≠ this. KAN-148 (3rd-leader conflict) untouched. KAN-61 (deadline sweep) sequences AFTER this and adopts the same state model wholesale (DBA-verified fit). KAN-205 soft-delete is DISQUALIFIED as the mechanism (it schedules hard-purge; deactivation must be reversible) — all three lanes concur.

## 1. The flow in one paragraph

An admin ends ONE leader's access — sign-out to the existing "Account deactivated" lockout — while the church, its other leader, and all its data stay untouched. Reversible via a sibling reinstate action. The leader sees only the existing support_contact copy ("Your account has been deactivated… reach out to us at accounts@projectreplant.org" — verified correct as-is for this case: it says "your account," not "your church"). The reason is mandatory, PII-scrubbed, audit-only — never shown to the leader (coercion/compromise threat model).

## 2. State model — APPROVED by all lanes

Reuse the existing user-level triple on the ONE user row; church untouched:

1. `verification_status = 'deactivated'` — gates the login resolver (the ONLY thing that locks the session; the resolver never reads is_active for normal leaders).
2. `is_active = false` — gates the write plane (RLS hardening 20260623_0003 keys writes on `is_active=true AND soft_deleted_at IS NULL`) and makes the leader invisible to fan-outs (welcome-DM, approve cascade, lifecycle emails all filter `is_active=true`).
3. `deactivated_at = now()` — forensic anchor, consistent with churches contract + login-check writer + KAN-61.

No new columns, no new enum values, no users CHECK constraint (DBA: deliberately none — `is_active=false` is multi-lifecycle across deactivation and soft-delete; app-layer atomicity in one UPDATE mirrors reject-leader precedent).

## 3. Endpoint spec — `deactivate-leader.js` (admin repo)

Guard stack (SEC-specified, top to bottom):

1. `verifySuperAdmin` (NOT verifyAnyAdmin — deactivating a real active leader is super-admin territory; matches deactivate-church).
2. **UG hard-refuse (SEC BLOCKER 1):** load target leader's church; when `church.type='underground'` → 409, route to the UG lane. Rationale: verifySuperAdmin never checks `is_underground_admin`; without this refuse, a non-UG super_admin could unilaterally deactivate a UG leader, bypassing the UG gate, two-eyes ceremony, rate limits, and UG audit surface. Life-safety class.
3. AAL2 freshness, tier `sensitive_destructive` (matches deactivate-church).
4. TIER-1 step-up token — action-bound to NEW key `DEACTIVATE_LEADER: 'deactivate-leader'` (both action-names twins, byte-for-byte), user-bound to `user.auth_id` (never user.id — null for pure admins), and **TARGET-bound to the leaderId (SEC BLOCKER 2):** today's step-up contract deliberately excludes target from the JWT, so one TOTP would authorize unlimited deactivations for 5 minutes — a single-TOTP region-kill switch. Target-binding caps one TOTP to exactly one leader. This is a scoped, Founder-ratified departure from the "action+user is the replay boundary" contract (decision 4 below).
5. **Velocity tripwire, fail-CLOSED (SEC):** per-actor rate limit (single-digit per rolling hour recommended; Founder sets the number). Deliberate divergence from the existing fail-open limiters: on limiter degradation this endpoint DENIES + alerts. Every trip writes an audit row.
6. Mandatory reason — `scrubAndCap`, audit-meta only (reject-leader posture, NOT deactivate-church's optional `reason || ''`). Never disclosed to the leader.
7. Audit-FIRST, then the guarded UPDATE:
   `UPDATE users SET verification_status='deactivated', deactivated_at=now(), is_active=false WHERE id=? AND is_active=true AND verification_status IN (…scope per decision 1…) AND soft_deleted_at IS NULL RETURNING id`
8. **0-row classification (DBA BLOCKER 2):** empty RETURNING → follow-up SELECT → 404 (no row) / 409 mid-deletion ("this account is already being removed by the leader") / 409 already-deactivated / 409 rejected. Never a silent 200.
9. Best-effort email INSERTION POINT after commit — single leader, "your account" personal variant of notify_t09; **copy = comms track, Founder-ratified; nothing authored here.** No reason/actor in the body.

Audit row shape: `church_id` = leader's church (makes within-church sweeps a GROUP BY — SEC), meta: actor_email, ip, target_user_id, scrubbed reason (+ `prior_status` if decision 2 lands on exact-restore).

## 4. Resolver fix — RELEASE GATE for this flow (and a live copy defect today)

All three lanes flag it; DBA stamped the exact predicate. In `auth-status-check/logic.ts`, the user-deactivated branch currently returns the "verification window expired" renewal copy whenever the church carries any past deadline — and verified churches routinely carry stale past deadlines. An admin-deactivated leader on a verified church would be told her church's window expired: a fabricated cause. The one load-bearing change (panel-stamped, KAN-61-safe):

```
if (deactDeadline !== null)  →  if (churchStatus === "pending" && deactDeadline !== null)
```

Case matrix verified by DBA: admin-deactivation on verified church → support_contact (fixed); KAN-61/login-check sweep on pending church → verification_renewal (preserved); skip-flow → support_contact (preserved); deactivated/rejected church → support_contact (more correct than a looser predicate).

**Batching note:** this predicate rides the gap-2 auth-status-check edit (same file, same branch of the resolver, same deploy) and is a correctness fix for states reachable TODAY — it ships with the flow-gaps batch, clearly labeled for Founder review, while the gap-5 endpoint itself stays unbuilt pending ratification.

## 5. Reinstate sibling — `reinstate-leader.js`

Same privileged stack as deactivate. No reason required (asymmetry matches reinstate-church; the deactivation carries the context). Restores `is_active=true` + `deactivated_at=null` + verification_status per decision 2. Also null the user-side `verification_deadline` defensively (DBA: prevents the login-check instantly re-deactivating the just-reinstated leader on a stale window).

## 6. Admin dashboard UX (BA-specified)

1. **Placement:** per-leader affordance ON the leader's row in `LeaderSlots` (ChurchManagement detail panel) — NOT a second panel-level button. The church-level Deactivate already lives at that panel's foot; two panel-level "Deactivate" meanings on one screen is the top mis-click hazard (an admin intending to end one leader takes the whole church offline). Name-scoped, spatially separated. Founder sees a mock before build (decision 12).
2. **LeaderSlots gains a deactivated state:** today it tags only `verified` — a deactivated leader would render as a normal slot. Required: `deactivated` pill + dimmed row + Reinstate affordance on that row.
3. **Ceremony:** inline confirm-strip (the established pattern), reason mandatory, Confirm disabled until non-empty, then TOTP step-up. Draft microcopy (BA, SEC register; CONTENT reviews at build; explicitly must NOT carry the church strip's "90-day PII countdown" line — that countdown is church-scoped and would be a false promise here):
   > **End {leader name}'s access?**
   > Signs them out and shows the account-deactivated notice. Their church stays active; other leaders are unaffected. Reversible via Reinstate. Reason required — audit-logged.
4. **Open escalated cases:** surface the leader's open `escalated_cases` count in the strip — warn-and-proceed, never hard-block, never auto-close (BA+SEC+DBA aligned).

## 7. Comms flags (trigger + audience only — comms track owns copy)

1. Leader-only deactivation email: fires from deactivate-leader commit, best-effort; audience = the one deactivated leader; personal-variant twin of notify_t09 ("your account"). Precedent proven: notify_t26 already ships church + personal variants.
2. Reinstate-leader email: notify_t29-family personal variant.
3. `coleader_departed` (body already approved 2026-05-03; only trigger today is the unbuilt KAN-61 cron): should admin-manual leader deactivation also notify the remaining active leader? (decision 6).

## 8. Cross-lane findings flagged OUTSIDE this scope (for Founder awareness / tickets)

1. **P1-class hole (DBA, verified in deployed v15): a VERIFIED leader on a DEACTIVATED church still resolves ACTIVE** — the resolver short-circuits on user-verified before any church check, and deactivate-church never cascades to user rows. A deactivated church's verified leaders keep full app access (session + RLS writes, which key on user-level is_active). Church-deactivation lockout only works for pending/rejected leaders. Needs its own ticket + fix ruling (resolver church-check for verified users vs endpoint cascade); NOT built in this batch.
2. deactivate-church has no step-up token (its comment calls it a "paired FE follow-up" that never landed) — consider back-filling for symmetry with this new endpoint (SEC; separate ticket).

## 9. Consolidated Founder decisions (merged from all three lanes; recommendations marked)

1. **Deactivation scope:** verified-leaders-only (BA rec — pending leaders already have Reject in the queue; makes the state machine mirror the church one) vs verified+pending (brief's original). BA rec: **verified-only.**
2. **Reinstate target status** — linked to decision 1: if scope is verified-only, prior status is always verified and the lanes converge on **restore to verified**. If pending is in scope: DBA recommends **pending** (fail-closed; always-verified would promote a never-verified leader — privilege escalation through the restore door), SEC requires never-auto-promote (prior-status via audit meta.prior_status acceptable).
3. **Target-bound step-up token** (departure from the "action+user is the replay boundary" contract) — SEC BLOCKER; ratify or name an alternative mass-deactivation containment.
4. **UG hard-refuse in v1** (UG leader deactivation deferred to the UG lane's two-eyes ceremony) — SEC BLOCKER; all lanes recommend **defer + hard-refuse**.
5. **Velocity tripwire:** threshold (leaders per actor per rolling hour — SEC suggests single-digit) + fail-CLOSED posture.
6. **Remaining co-leader notification:** fire coleader_departed on admin-manual leader deactivation? BA rec: **yes** (copy exists; comms wires).
7. **Last-active-leader guard — genuine lane divergence, your call:** SEC leans **BLOCK** (fail-closed; forces the conscious church-level decision; avoids leaderless-verified-church limbo). BA recommends **ALLOW-with-loud-warning** (the sole-leader-compromise scenario — arrest, coercion — is exactly when you must lock one person out while keeping the church alive; blocking forces a false binary).
8. **Audit token — genuine lane divergence, your call:** SEC recommends **reuse `deactivate_user`** (`triggered_by='user'` + `meta.trigger='admin_manual'`; zero migration on both the JS gate and the DB CHECK). DBA recommends **new `deactivate_leader` + `reinstate_leader` tokens** (one CHECK-extension migration; matches the codebase's leader-vs-church token convention — reject_leader ≠ reject_church; cleaner forensics than meta-filtering).
9. **Leader-side surface:** generic support_contact modal suffices (all lanes confirm the copy reads correctly); leader cannot distinguish leader-only from church-wide deactivation — ratify that this minimal disclosure is intended.
10. **Reason mandatory + audit-only** (never shown to the leader; differs from deactivate-church's optional reason) — ratify.
11. **Open-case handling:** warn-and-proceed with open-case count in the strip (all lanes aligned) — ratify.
12. **Admin placement mock:** per-leader row affordance in LeaderSlots + deactivated visual state — see a mock before build (two-Deactivate mis-click hazard).
13. **Resolver copy on the rare admin-deactivation-on-pending-church edge:** accept the benign "renewal" lean (DBA rec for v1) vs invest in an explicit reason signal now.
14. **Separate tickets to open (not this flow):** the §8.1 verified-leader-on-deactivated-church hole (P1-class — belt SHIPPED v17; grace cascade = Part 2 below); deactivate-church step-up backfill; optional users deactivated_has_timestamp CHECK hardening (DBA: not needed v1).

---

# PART 2 — Church-deactivation grace-window cascade (Founder hypothesis; SEC+DBA mini-panel synthesis; AWAITING RATIFICATION)

**Founder's hypothesis (2026-07-13, verbatim intent):** on church deactivation, verified leaders are "brought back to no church — you have 7 days to link to a church or you'll be deactivated."

**Panel verdict: both lanes APPROVE-WITH-CHANGES.** The direction is right — more humane than instant lockout AND more privacy-preserving (routes to the generic register surface, which does not confirm to an adversary holding coerced credentials that Replant took adverse action). The mechanism is elegant: the target state is byte-identical to the existing skip-flow pending state, so resolver, 7-day enforcement, and banner machinery are essentially free. It is NOT shippable as scoped today.

## What shipped NOW (both lanes required it): the resolver belt

auth-status-check v17 (deployed 2026-07-13): the verified→active short-circuit now consults the already-fetched church row — verified leader on a REJECTED church → support_contact + church_rejected ratified copy; on a DEACTIVATED church → generic support_contact. Zero query cost; live population in the state at ship time = 0 (purely protective). The belt closes the P1 hole for EVERY path (endpoint, out-of-band SQL, tooling); the cascade later replaces the belt's lockout with the grace path on the sanctioned endpoint. The belt also closes the reject-church sister hole automatically.

## The two hard blockers on the cascade

1. **The 7-day window is a promise the app cannot keep today: NO in-app re-link surface exists for an authenticated churchless leader.** Register/join screens are pre-auth (onboarding navigator only); the churchless banner has no CTA (mailto only); no RPC attaches church_id to an existing session. Six churchless pending leaders already live in prod with no path. Without the surface, the cascade is a 7-day-delayed lockout with wrong copy. Both lanes: build the surface WITH the cascade or gate the cascade on it.
2. **Reinstate reversibility must ship WITH the cascade:** once church_id is nulled without capture, every deactivation in the gap is permanently un-restorable. DBA-recommended spine: `users.previous_church_id uuid` set atomically by the cascade; guarded set-based relink on reinstate (tolerating the leader-cap trigger per-row); leaders who lapsed or re-linked elsewhere are excluded (honest cost: they are NOT auto-recoverable).

## The one genuine lane fork (Founder decision)

**Grace-state `is_active`:** SEC requires **false** (write-freeze — with is_active true the RLS write plane stays open: messages, connection requests, prayer posts, comments all keyed on is_active only, so a for-cause-deactivated church's leaders could harvest/contact for 7 days; the re-link then needs one purpose-built is_active-exempt SECURITY DEFINER RPC that re-activates ONLY on successful attach). DBA modeled **true** (exact skip-flow parity, simpler, no exempt RPC needed). SEC's threat case is strong for this platform; DBA's is simpler. **Recommendation: SEC's write-freeze.**

## Panel-required changes (converged)

1. Cascade = ONE atomic SECURITY DEFINER RPC (`fn_deactivate_church_cascade`): church flip + set-based leader UPDATE + per-leader audit rows in one transaction (the JS two-write pattern multiplies partial-failure shapes, and a partial cascade re-opens the exact P1 hole). Emails stay best-effort outside.
2. Cascade predicate: `church_id=<church> AND is_active=true AND verification_status='verified' AND soft_deleted_at IS NULL AND deactivated_at IS NULL` — never touches gap-5-deactivated, self-deleted, or pending leaders (pending keep today's lockout; parity question flagged as decision 6 below).
3. New state: `church_id=NULL, previous_church_id=<old>, verification_status='pending', verification_deadline=now()+7d` (+ is_active per the fork above).
4. NEW audit tokens (`church_cascade_unlink` / `church_cascade_relink` or similar) — NOT deactivate_user (grace ≠ deactivation; forensically false) and NOT deactivate_leader (collides with gap-5's admin-manual lane). Rides the same CANONICAL_ACTIONS + CHECK serialization chain (live-derive; now at 88).
5. UG excluded v1 + a `type <> 'underground'` guard ON deactivate-church itself (nulling church_id on a UG leader threatens anon-identity masking + join-code integrity; UG has its own deactivation ceremony; any UG grace design = own SEC panel).
6. deactivate-church step-up hardening BEFORE the cascade lands (post-cascade, one call transitions N accounts — same region-kill class gap-5's target-binding addressed; import action-bound step-up + consider the fail-closed velocity tripwire).
7. Comms flags (trigger/audience only — comms track owns copy): (a) t09 audience must SPLIT — the current fan-out would email grace leaders "your account has been deactivated," which is false (and DBA: after the unlink the current query returns zero leaders anyway — capture the cohort from the RPC RETURNING); (b) NEW grace-window email kind; (c) **the reminder cron is NOT inert here** — `emit_verification_reminder_emails` keys on users.verification_deadline with no church filter, so grace leaders would get "your church's review window" copy on day-0/day-6 — needs a copy fork or cohort exclusion; (d) grace banner copy — the skip-flow "7 days from account creation" line has the wrong anchor and masks the countdown.
8. Render seams (DBA sweep — no structural breakage since church_id is denormalized on content tables and messages have no church FK): COALESCE-on-null-church needed at get_leader_thread_list + anon-identity "+ church" renders; grace leaders drop out of Browse Leaders (acceptable, mirrors pending); branch_members rows are an un-swept seam (low risk, flagged); prayer_requests insert dead-ends on NOT-NULL church_id (fail-closed, UX note).

## Founder decisions for the cascade (consolidated, deduped)

1. Ship the cascade + re-link surface TOGETHER (both lanes: hard gate) — confirm scope appetite; until then the v17 belt (lockout, support_contact) is the standing behavior.
2. Grace-state access: write-frozen (SEC rec) vs skip-flow parity (DBA model).
3. Reinstate spine: previous_church_id + guarded auto-relink (both lanes rec) vs one-way.
4. reject-church sister: extend the grace cascade to rejected churches too, or belt-only (rejected is admin-terminal — grace may be the wrong shape there)? Belt already covers it fail-closed.
5. Cascade audit token name (new, distinct — panel rec) — ratify.
6. Pending leaders on a deactivated church: keep today's instant support-lockout (both lanes rec) — note the asymmetry vs verified leaders' grace.
7. Step-up hardening on deactivate-church (action-bound token + velocity) before the cascade — ratify.
8. Comms handoffs (7 above) — acknowledge for the comms track's queue.
