# Handoff — 2026-06-27 — MFA Architecture Fix (Option C+ pending CD return)

## TL;DR for the next session

The current Replant admin dashboard has a **load-bearing auth gap**: `Login.jsx` calls `signInWithPassword` and stops there. Every admin session lands at AAL1. Every per-action AAL2 gate (23 BE endpoints + 14 FE call sites) rejects with `AAL2_REQUIRED` on fresh sign-ins. Founder hit this in pre-UAT pass; SEC + BE panels ran today; **Option C+ is locked**.

CD brief delivered (Founder pasted to CD chat). When CD returns, the implementation work is the Option C+ plan below. **Do not start implementation until CD returns** — the build depends on the BlockingEnrollmentGate + StepUpTotpModal designs.

## Repo state (verified 2026-06-27 end-of-session)

| Repo | Branch | HEAD | Working tree |
|---|---|---|---|
| `replant-admin` | main | `11810f2` (pass 5) | CLEAN — everything committed + pushed; Netlify deployed |
| `~/replant` | `fix/connect-composer-height-members-remove-icons` | 26 commits ahead of main | 127 files showing (home-tab WIP + untracked plans/migrations) |
| `~/replant` | origin/main | `9eb885c` | Up to date — all KAN-271 migration source-mirrors landed |

**Critical**: do NOT push admin without Founder greenlight (Netlify deploy cost). ~/replant pushes are LAX. Per [[feedback-all-pushes-need-greenlight]].

## The auth gap, in one paragraph

`Login.jsx:34` calls `await supabase.auth.signInWithPassword(...)` and stops. Supabase does NOT auto-elevate AAL even when the user has a verified TOTP factor — the FE must explicitly call `mfa.challenge` + `mfa.verify` to elevate to AAL2. Login.jsx never does. So every admin sits at AAL1 with a JWT that lacks `aal: 'aal2'` and `amr.totp.timestamp`. The 23 BE endpoints that check `checkAal2Freshness(jwt)` correctly reject these sessions — but the user sees "I just signed in, why am I locked out?" There's nothing to recover with because the error renders raw (`AAL2_REQUIRED`).

## Locked decisions from this session

### 1. Architectural verdict: Option C+ (per SEC + BE parallel panels)

- **A**: fix Login.jsx to chain `mfa.challenge` + `mfa.verify` after password sign-in
- **+**: retrofit `request-step-up.js` to verify TOTP code (not password) — SEC flagged the password re-probe as architecturally weak ("re-proves what the session already proved by existing; doesn't establish second-factor possession")
- **C** humanizer entries for AAL2_REQUIRED / AAL2_EXPIRED / stale_aal2 / enrollment_missing / factor_revoked / verification_failed
- **NOT option B** (strip step-up + AAL2 gates) — explicitly rejected; would collapse defense-in-depth for an admin surface holding underground identities

### 2. 4-tier AAL2 freshness windows — [[locked-tiered-mfa-freshness]]

| Tier | Window | Action class |
|---|---|---|
| Browse | 30 min | Underground oversight page loads ONLY |
| Regular destructive | 30 min | verify-leader, reject-leader, approve-church, reject-church, edit-pending, update-church-details, send-team-reply |
| Sensitive destructive | 5 min strict | Underground actions, admin-tier mutations, expand-pastoral-context |
| Life-safety | 90 sec strict | read-heartcry / admin-open-heartcry |

**Founder explicitly removed freshness gates from**: heartcry-inbox list, pastoral signals, flagged messages. Those endpoints just check `aal === 'aal2'` binary on the JWT now that Login.jsx will properly elevate.

**Endpoints that KEEP browse-tier freshness (30 min)**: `list-underground-churches`, `underground-oversight`, `list-pending-underground` family (pending/verified/rejected/deactivated tabs) — these are the UG oversight surface. `list-underground-churches` IS the oversight page's list endpoint. Per [[locked-tiered-mfa-freshness]].

### 3. BlockingEnrollmentGate posture: **hard block**

When `factorId === null` after sign-in, render TotpEnrollmentScreen with **NO escape hatch** — no sidebar, no nav, no other routes accessible. Only escape: small "Sign out" link in the corner. Per Founder explicit ratification.

### 4. Step-up TOTP retrofit: **fold in IF properly done**

Founder ratified the step-up password → TOTP change is in scope for the next batch.

## CD brief delivered

Founder pasted to CD chat. CD will deliver:

```
docs/design_handoff_mfa_login_gate/
├── README.md                        # rationale, copy log, open Qs
├── preview/
│   └── index.html                   # interactive preview, both surfaces
└── source/
    ├── BlockingEnrollmentGate.jsx   # full-screen wrapper + Welcome chrome
    └── StepUpTotpModal.jsx          # refreshed step-up (TOTP-code variant)
```

5 open questions in the CD brief for Founder ratification on return:
1. Welcome copy variations
2. Sign-out affordance placement
3. Surface 2 chrome decision (modal overlay vs replace-body vs side panel)
4. Loading state between password and TOTP challenge — needed?
5. Recovery flow ("Lost your authenticator?") — confirmed post-MVP

## What to build when CD returns

Single commit (no waves needed — scope is bounded). Files affected:

### FE — implementation

1. **`src/screens/Login.jsx`** — chain `mfa.challenge` + `mfa.verify` after `signInWithPassword`. Mount TotpChallengeModal inline (not navigated-to). On modal cancel → `supabase.auth.signOut()` to prevent AAL1 session wandering. ~40 lines. **BE panel wrote out the exact code in its verdict — read that before starting.** Lives in the panel report at `/private/tmp/claude-501/.../tasks/a33a3d3251533ff4b.output` (may have rolled off — re-dispatch if missing).
2. **`src/screens/Account.jsx`** — add BlockingEnrollmentGate wrapper when `location.state?.mustEnrollTotp === true` AND `factorId === null`. Lift the existing inline TotpEnrollmentScreen render into the new gate. ~30 lines + the CD-designed wrapper.
3. **NEW `src/components/BlockingEnrollmentGate.jsx`** — full-screen layout per CD design. Logo-only chrome, centered card, sign-out link.
4. **NEW `src/components/StepUpTotpModal.jsx`** — replacement for StepUpModal (which becomes legacy or gets renamed). 6-digit input mirroring TotpChallengeModal's pattern, action-named copy. Per CD design.
5. **`src/lib/api.js`** — `requestStepUp(...)` helper signature change: accept `{ totpCode, action }` instead of `{ password, action }`.
6. **`src/components/StepUpModal.jsx`** — either delete or repurpose if SEC's plus is in scope (Founder ratified yes — delete + replace with StepUpTotpModal).
7. **All 14 FE useStepUp call sites** — verify they still work after the BE retrofit. Should be no-op at FE call layer; only the modal swap changes UX.
8. **`src/lib/aal2.js`** — add the 4 tier constants (`TOTP_FRESHNESS_BROWSE_MS`, `TOTP_FRESHNESS_REGULAR_MS`, `TOTP_FRESHNESS_SENSITIVE_MS`, `TOTP_FRESHNESS_LIFE_SAFETY_MS`).
9. **`src/lib/error-routing.js`** — humanizer entries for the 6 AAL2 reason keys (stale_aal2 → inline TotpChallengeModal; enrollment_missing → redirect to enrollment; factor_revoked → enrollment; verification_failed → force signout).
10. **(Optional cleanup)** — drop the brittle `getEnrolledTotpFactor` factor inference in favor of `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. BE panel flagged as more semantic. Post-UAT polish; not required.

### BE — implementation

1. **`netlify/functions/request-step-up.js`** — replace `signInWithPassword(...password)` probe with `mfa.challenge` + `mfa.verify(...totpCode)`. Verify against actor's enrolled factor. Keep 5-min TTL + action-binding contract identical. Per SEC's recommended pattern.
2. **`netlify/functions/_lib/aal2-check.js`** — replace single `TOTP_FRESHNESS_WINDOW_MS` constant with 4 named tier constants. Extend `checkAal2Freshness(jwt, tier)` to accept tier hint; default to most restrictive.
3. **All 23 BE files calling `checkAal2Freshness`** — pass tier explicitly per the [[locked-tiered-mfa-freshness]] table. Examples:
   - `verify-leader.js`, `reject-leader.js`, `approve-church.js`, `reject-church.js` → `'regular_destructive'`
   - `invite-admin.js`, `confirm-underground-proposal.js`, `underground-force-unmark-claim.js` → `'sensitive_destructive'`
   - `read-heartcry.js` → `'life_safety'`
   - Underground oversight page entries → `'browse'`
4. **`Login.jsx` triggers `log-aal2-elevation.js`** post-verify — write `admin_aal2_elevation` audit row (action already exists per KAN-97).

### Audit ratifications worth re-confirming when implementing

- `expand-pastoral-context` is **sensitive destructive** (5 min) per Founder ruling
- `send-team-reply` is **regular destructive** (30 min) per Founder ruling
- Heartcry inbox LIST page drops freshness gate entirely (only `read-heartcry` keeps the 90-sec life-safety window)
- Pastoral Signals page drops freshness gate entirely
- Flagged Messages page drops freshness gate entirely

## What's already shipped and live

- Pre-UAT pass 5 (`11810f2`) — fixed:
  - `update-account-name.js` userClient swap (Founder can now save names through the editor)
  - `confirm-underground-proposal.js` + `underground-force-unmark-claim.js` validateStepUp signature
  - Nav firstName localStorage cache (no more `ruth` → `Ruth` flash)
  - `.dt-col` min-width: 0 grid fix (Profile · Claimed card no longer squished on content-heavy detail pages)
  - Invite-admin reorder + Layer 1 gate stack + ON CONFLICT idempotency
- DBA migrations through 0038 all live + source-mirrored
- KAN-271 admin tier bundle (Account page, Tier Management consolidation, sponsor flow, icon polish) all live
- Regular admin onboarding G1-G7 fixes all live
- Verification Progress timeline + evidence UX polish live

## Open ratifications + items to surface when CD returns

1. **CD's 5 open Qs** (above)
2. **Tier constant naming** — confirm `'browse' | 'regular_destructive' | 'sensitive_destructive' | 'life_safety'` is the right vocabulary (BE flag for naming polish)
3. **Heartcry decrypt** — Founder confirmed stays 90-sec life-safety. Re-verify when wiring.
4. **Idle timeout** — SEC flagged: session TTL (8hr) and AAL2 TTL (30min) are independent today. Worth post-MVP idle-session-timeout (e.g., 15-min inactivity → force re-elevate). FILE post-MVP.
5. **WebAuthn / hardware tokens** — SEC's post-MVP recommendation: phishing-resistant MFA (YubiKey) for global persecuted-church admin surface. TOTP is socially engineerable; WebAuthn isn't. FILE post-MVP.
6. **No `mfa.getAuthenticatorAssuranceLevel` usage anywhere** — codebase infers AAL via `listFactors()` + JWT decode. Functional but inelegant. Post-UAT cleanup.
7. **`request-step-up.js` doesn't enforce AAL2** — a compromised AAL1 session can mint a step-up token by replaying a captured password (under current behavior). Defer to post-UAT; the TOTP retrofit in this work changes the threat model.
8. **Centralized AAL2 interceptor** — today, scattered handling in TeamManagement.jsx + Underground.jsx re-prompts via TotpChallengeModal on stale AAL2. Post-UAT consolidation: one root-mounted interceptor listening for `{AAL2_REQUIRED, AAL2_EXPIRED, no_aal2, stale_aal2}` 401s, opens modal, retries action.

## Test surface after Option C+ deploys

Re-test order:
1. Sign out + sign in fresh as Founder (Ruth) — should hit TotpChallengeModal inline on Login → enter TOTP → land on dashboard. JWT now AAL2.
2. Sign in as accounts@ (Replant Operations) — same flow. accounts@ name is already updated per Pass 5 deploy — should display correctly.
3. Invite a new test admin (`ruthjames08+admin@gmail.com` or similar). After invitation lands, click magic link → /set-password → sign in → BlockingEnrollmentGate hard-renders → enroll TOTP → unlocks dashboard.
4. As Founder, confirm a pending verify proposal (regular church) — should work in the 30-min window without re-TOTP friction.
5. As Founder, confirm an underground proposal → step-up TOTP modal prompts → enter code → action lands.
6. Wait 30+ min, try another action — should get inline re-challenge modal (not redirect to login).
7. Demote / revoke / promote — all the tier-mutation flows that have been broken with AAL2_REQUIRED.

## Memory + plan files of note (read first next session)

- `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — load-bearing index (compacted to 17.2KB this session)
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — running spec
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/locked_tiered_mfa_freshness.md` — the 4-tier table
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_replant_admin_copy_voice.md` — voice ruling
- `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_all_pushes_need_greenlight.md` — push discipline by repo
- `/Users/ife/replant/.claude/plans/kan271-uat-fixes.md` — pre-UAT tracker from this week's sessions
- `/Users/ife/replant/docs/design_handoff_mfa_login_gate/` — CD output (when it lands)

## Process notes for the next session

- Open with prayer per [[CLAUDE.md]] hard rule — name the MFA work + the underground leaders whose identity protection rests on the gate working.
- Caffeinate from earlier sessions is dead (verified). If dispatching long agents, suggest Founder restart caffeinate.
- All agent dispatches must include prayer instruction + seasoned-senior framing + endgoal stress-test (per [[feedback-role-agents-act-as-seasoned-experts]]).
- CD is paste-only — do NOT attempt to dispatch CD as an Agent. If CD work is needed, draft a brief.
- Step-up modal swap is a SEC-class change — when wiring it, dispatch SEC for ratification on the TOTP-vs-password decision (it's already ratified by this session's panel, but a sanity-check before pushing is cheap and right).
- The 23 BE files getting tier hints is a mechanical change but mass-edit. A focused build agent OR direct edits with a checklist both work. Verify with `npm test` baseline preserved (920/923 expected).

## End-of-session state

- Founder paused before code work to start a fresh session
- CD brief just delivered (paste-ready in the prior chat turn)
- Local working tree: clean on `replant-admin` main; ~/replant on fix branch with home-tab WIP preserved
- No staged or pending pushes
- All decisions from today documented; no outstanding "we talked about it but didn't write it down" items

In Jesus' name, Amen.
