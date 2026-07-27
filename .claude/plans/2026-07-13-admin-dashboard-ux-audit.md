# Admin Dashboard — Comprehensive UX / Visual / Error-Flow Audit

**Date:** 2026-07-13 · **Surface:** admin.projectreplant.org (`replant-admin` repo) · **Posture:** read-only audit — no code changed, nothing pushed, no Jira writes.

**Method:** 4 audit lanes over the codebase (routes+notifications · auth/AAL2 · prior artifacts+audits · visual system), a live pass of the public surface (login page desktop/mobile, auth-guard, headers, console), Jira cross-reference, and spot-verification of every load-bearing finding against `origin/main` (`21d6db5`, PR #80 merged). File cites are from the current checkout (`feat/flagged-mirror-pastoral`); items marked **(main-verified)** were re-checked on production main — line numbers there are main's.

**Classification note:** this document contains security-posture detail (step-up gaps, UG endpoint tiering). It belongs with the audit corpus destined for `replant-ops` per the R1 relocation ruling — keep it out of any public-repo commit.

---

## 1. Executive summary

1. **The verification popups are the healthy part.** TotpChallengeModal / StepUpTotpModal / enrollment are well-built: autofocus, paste handling, auto-submit on 6th digit, attempt lockout (5 tries → 15 min, survives reload), submit-guarded ESC/backdrop, in-modal errors, voice-compliant copy. The rot is the **error and success notification layer** around them.
2. **No test account is hardcoded — anywhere.** Login is a plain Supabase password sign-in + inline TOTP elevation. No credentials in source, tests, scripts, or bundle; `.env*` untracked; the shipped bundle carries only the public-by-design anon key. The two UUID literals (Founder guard, system sender) are identifiers, not secrets, and are gitleaks-documented. Nothing needs removing before launch.
3. **"Constant AAL2" has a precise root cause — and it is not the locked freshness tiers.** The six verification-queue workhorses (approve/reject-church, verify/reject-leader, edit-pending, update-church-details) are gated by **5-minute step-up tokens**, not the 30-minute "regular destructive" freshness window the 2026-06-27 ruling filed them under (that tier is advisory/unused in code — `src/lib/aal2.js:11-15`). Three compounders make it feel worse: the token cache is keyed **per action** (approve church → verify leader → reject church = 3 prompts within minutes), the cache is **memory-only** (any reload = re-prompt), and there is **no visible countdown** anywhere, so prompts feel random. The relief mechanism already exists on main: `STEP_UP_TTL_OVERRIDES_MS` (`src/lib/action-names.js:169`, KAN-118 Item 2) — raising those six to your own floated 10 minutes is a config-level change awaiting your ruling + a SEC mini-panel.
4. **Toasts are as bad as you feel they are.** 14+ call sites, bottom-right, 3.5 s, no dismiss button, no stacking (rapid actions clobber each other). Five sites push **raw `err.message`** (engineering strings) into red toasts. Worse: **successful destructive actions are styled as red error toasts** — church deactivate (`ChurchManagement.jsx:116` main), church reject (`Queue.jsx:246` main), leader reject — "done" is dressed as "failed." The pattern propagated into the newest merged code (leader deactivate/reinstate, RequestInfoPanel). **(main-verified)**
5. **The inline error-routing ruling (2026-06-24) was never fully built.** The ratified mechanism — `registerErrorSink` / `routeError` / `api.js call({ errorContext })` — has **zero hits** in the codebase. What exists is a partial module (`classify` / `messageForKey` in `src/lib/error-routing.js`) adopted by only **6 files**. Everyone else does `setError(err.message)` → the shared top ErrorBanner, or → raw toast. The banner is serving as a catch-all for **action** errors on ~8 screens, squarely outside the reserved scope you ratified (page-load fail · AAL2 page-entry fallback · network down · auth lockout).
6. **The 2026-06-30 /team success ruling only half-landed.** Promote/Approve/Deny/Sponsor use the sanctioned in-modal checkmark; **Demote and Revoke still fire the retired green top banner** (`TeamManagement.jsx:687,694`). Legacy green success banners also persist on `Scripture.jsx:376` and `Announcements.jsx:709`. Success acknowledgment currently exists in **four competing patterns** (checkmark / green banner / toast / nothing).
7. **TOTP unenroll uses a native `window.confirm()`** (`Account.jsx:453`) — a browser dialog for a lock-yourself-out security action, wholly outside the app's modal system.
8. **Modal jank is systematic, not random.** TierModalShell + the TOTP modals are the gold standard. The ~18 bespoke `.ov` modals (underground/escalated/pastoral/flagged) can't be closed with ESC, mostly lack autofocus/focus-trap, and several allow **backdrop-dismiss mid-submit** (dialog tears down while the mutation is still running): `DeclineProposalModal.jsx:141`, `HardDeleteConfirmModal.jsx:47`, `VisibilityOverrideModal.jsx:117`, `ForceUnmarkModal.jsx:55`, `CancelProposalModal.jsx:49`.
9. **Two silent failures ship today:** after Reach-Out, the follow-up close-signal call failure is swallowed (`PastoralQueue.jsx:1460`); after Escalate, the clear-flag failure is swallowed (`Flagged.jsx:555`). The operator believes the item is handled; it silently reappears.
10. **Visual system: one healthy foundation, five forks riding on it.** Single token `:root` + shared shell + 13-screen EmptyState/Skeleton adoption is genuinely good. But: **two full button systems** (`.rp-btn` ×304 vs `.btn` ×72 — byte-identical primaries), **three table systems**, **five pill vocabularies**, four success patterns, a 24-use rogue hex layer (`#cfcabd` et al.), `:focus-visible` on exactly **one** element in 3,108 lines of CSS, and default muted text `#555` on `#080808` at **2.6:1 contrast** (fails AA). The Content Section handoff CSS is token-based, class-scoped, and adoptable as the unifier — that's the sanctioned direction, not a new system.
11. **Login page (live pass):** placeholder email domain is stale/wrong — `you@replant.network` (`Login.jsx:209`); "Recover access via ops" is **plain text, not a link** (`Login.jsx:219`) and the footer "Contact ops to request credentials" (`Login.jsx:274`) names no channel — a brand-new admin has no actionable path. Headers are strong (CSP, HSTS, X-Frame-Options DENY, nosniff, noindex). One threat-model item: **Google Fonts loads from Google's CDN** (`index.html:10-12`, CSP-whitelisted in `netlify.toml:40`) — admin-console visits are visible to a third party, and typography breaks where Google is blocked. Self-host the three families.
12. **This is the dashboard's first real pass.** The test-strategy artifact names the click-through admin pass as owed; QA to date drove the DB by SQL. 28 admin items are already tracked (§7) — this audit confirms several live and adds the net-new layer above.

---

## 2. Your three questions, answered

### 2.1 Login — "test account hardcoded in, I presume?"

**No.** The presumption is safe to drop:

1. `Login.jsx:48-49` calls `supabase.auth.signInWithPassword({ email, password })` from form state. No literals, no bypass path, no dev backdoor, no hidden route.
2. Repo-wide credential sweep (src, netlify, scripts, tests, index.html): zero hardcoded passwords/tokens/test accounts. The only identity literals are the Founder auth UUID (`ded45949…` — used for Founder-protection guards in `TeamManagement.jsx:55`, `revoke-admin.js:50`, `send-password-reset.js:71`) and the "Replant Team" system-sender UUID — identifiers, not secrets, both gitleaks-documented.
3. `.env` / `.env.local` are gitignored and untracked (only `.env.example` is committed); the built bundle carries only the anon key, which is public by design. `dist/` greps clean for service-role/JWT-secret material.

**How I run logged-in passes without ever touching credentials:** you sign in once in my Browser pane (password + TOTP stay yours alone — entering credentials is a hard boundary I won't cross), then I drive the authenticated session: read every screen, exercise layouts, screenshot, and log findings. Read-only browsing fires **zero** TOTP prompts (binary AAL2 or 30-min windows cover it; idle watchdog allows 30 min between interactions, 8 h cap). Anything destructive we either do together or leave to you. Same procedure works on a local `vite` preview if you'd rather not audit against prod. I do **not** recommend persisting an admin session file (Playwright `storageState`) — an exported admin session is a theft target; a fresh login per pass is the right trade.

**Login-screen fixes while we're here:** correct the placeholder domain (`Login.jsx:209` → e.g. `you@projectreplant.org`); either make "Recover access via ops" meaningful (it's dead text at `Login.jsx:219` — the actual mechanism is admin-triggered reset via `send-password-reset`) or drop it; give "Contact ops" a real channel or accept it as deliberate opacity (your call — but today it reads as a dead end to a locked-out admin).

### 2.2 "Constant AAL2" — diagnosis and levers

Two separate systems gate admin actions, and the pain lives in the gap between them:

1. **AAL2 freshness tiers** (the locked 2026-06-27 ruling): Browse 30 min / Regular destructive 30 min / Sensitive destructive 5 min / Life-safety 90 s. Implemented faithfully in both twins (`src/lib/aal2.js:26-29` ↔ `netlify/functions/_lib/aal2-check.js:62-65`).
2. **Step-up tokens** (per-action TOTP mint, `X-StepUp-Token`): default TTL **5 minutes** (`action-names.js:163`), cached per `(user, action)` in memory.

The six queue workhorses — `approve-church`, `reject-church`, `verify-leader`, `reject-leader`, `edit-pending`, `update-church-details` — are gated by **system 2**, not system 1. The ruling's "30 minutes for regular destructive" never applies to them; their real re-prompt cadence is the 5-minute token TTL. That's your "every 5 minutes." Compounders, in order:

1. **Per-action cache keys** — approve a church, then verify a leader, then reject a church: three different action names, three separate prompts, even within the same minute (`src/hooks/useStepUp.js:30-31`, `step-up-cache.js:28`).
2. **Memory-only cache** — any reload or hard navigation drops all tokens (`useStepUp.js:37`); next action re-prompts regardless of elapsed time.
3. **No window visibility** — nothing anywhere shows "verification valid for ~Xm," so every prompt feels arbitrary.

Ruled **out** with evidence: session refresh dropping AAL2 (it survives; `RefreshAuditor` only logs), the modal failing to retry the original action (it retries once with the fresh JWT — `api.js:78-94` — and step-up prompts fire *before* the call, so **no form state is ever lost**), tokens being single-use (they're reusable within TTL), browse pages gated as sensitive (none; all drift is lenient).

**Levers, smallest first:**

1. **Raise the six queue actions to a 10-min step-up TTL** via `STEP_UP_TTL_OVERRIDES_MS` in both twins (`src/lib/action-names.js:169` + `netlify/functions/_lib/action-names.js`). This is your own standing lever, verbatim ("seriously considering raising destructive to 10 mins… pulling out your phone every 5 minutes is really frustrating," 2026-06-30). It does **not** touch the locked freshness ruling (step-up TTL is separate by that ruling's own text). Sensitive stays 5 min, heartcry stays 90 s. Needs: your ruling + SEC mini-panel (auth-posture change; per the SEC-on-crypto/auth-panels rule). Deliberately **not** recommended: raising the global default — it would push sensitive endpoints' cached tokens out of phase with their 5-min freshness window and spawn a *different* prompt.
2. **Persist the step-up cache in `sessionStorage`** (survives reload within the tab, dies with the tab). Pure UX-cache change; the backend still enforces TTL + binding — no security-boundary movement.
3. **Show the window** — a quiet "verification active · ~8m" chip near the action area (or on the topbar) so re-prompts are predictable instead of surprising.
4. **Voice slip:** `TotpChallengeModal.jsx:183` eyebrow says "Step-up · Two-Factor" — "step-up" is internal vocabulary; the sibling modal's "Two-factor · Confirm action" is the compliant register.
5. **Latent dependency to pin with a test:** the whole freshness model assumes Supabase stamps a **new** `amr` totp timestamp on every `mfa.verify` of an already-AAL2 session (`ElevationModalHost.jsx:11-14`). It evidently works in practice, but no test exercises real GoTrue behavior — worth one integration test so an upstream change can't silently strand the 5-min/90-s tiers.
6. **For the SEC panel agenda (posture drift, not prompt frequency — all lenient):** a family of endpoints is gated at 30-min windows the ruling would leave binary (`list-escalated-cases`, `reach-out-*`, escalated propose/reject/close, UG read/claim/evidence family); `underground-claim`/`underground-release-claim` are *mutations* sitting at the loosest tier; `send-team-reply` (named in the ruling's regular-destructive list) has **no step-up and no freshness** — binary AAL2 only.

### 2.3 Toasts and banners — why they feel broken

Because three different notification systems are competing, none finished:

1. **Toasts** (`RpToast`, bottom-right, 3.5 s, no dismiss, no stacking — one slot per screen, rapid actions overwrite each other): 14+ sites on Queue/ChurchManagement/LeadersTab/ChurchProfileCard (+ new ones merged with PR #80). Five sites emit raw `err.message`. Two+ style **successful** destructive outcomes as red **error** toasts.
2. **Top banners**: the shared ErrorBanner is scoped by your ruling to 4 cases but receives **action** errors from ~8 screens (`Scripture.jsx:319,355`, `ChurchManagement.jsx:318`, `UndergroundDetail.jsx:357,481,486`, `PastoralQueue.jsx:989`, `Underground.jsx:282` …) — raw strings on the wrong surface. Plus three top **green success** banners that survived their own retirement ruling.
3. **In-modal checkmark** (the sanctioned pattern): adopted by the escalated/pastoral/flagged/tier ceremonies — and it's good.

The fix is not "better toasts." It's finishing the consolidation you already ruled: **inline where the action lives; modal for ceremonies; banner only for the reserved four; success acknowledged in place.** §3 specifies it.

---

## 3. Target design — notifications, errors, verification

Principles (all already locked, just unevenly applied): SEC-register copy — what happened + what to do, two sentences, TOTP/2FA fine, AAL2/JWT/RLS/SQLSTATE never; the confirm **is** the action (no "Are you sure?"); honest mechanism (never claim "recorded" when the backend dropped it); nothing important lives in a surface that vanishes on a timer.

**The four sanctioned surfaces (and the only four):**

1. **In-modal ceremony** — every destructive/two-eyes/step-up action. Standard = TierModalShell semantics everywhere: autofocus first field · ESC + backdrop both guarded while submitting · in-modal error slot (dictionary copy + copyable `request_id`) · in-modal success checkmark, auto-close ~5 s (28 px icon, serif title — the TierModalShell rendition, not the 56 px `btn`-family fork in `ProposeActionModal.jsx:82-99`).
2. **Inline affordance state** — every non-modal mutation (saves, toggles, row actions): error renders in a slot **next to the control that failed**, via the dictionary (`messageForKey`); success renders as a quiet in-place confirmation ("Saved" micro-state on the control, or the row visibly changing state — LeaderSlots-style pill + confirm-strip is the established ceremony for row-level actions).
3. **Top banner** — the reserved four only: initial page-load failure · AAL2 page-entry gate fallback · network-down · auth lockout. Everything else that currently lands there moves to surface 1 or 2.
4. **Full-screen gates** — enrollment, tier-block, session-expired (already correct).

**Toasts: retire the component** (recommendation — your ratification, question 1). Every current site maps cleanly:

| Current toast | Replacement |
|---|---|
| Approve/reject church, verify/reject leader (Queue/LeadersTab) | These flow through step-up modals already → in-modal checkmark; row leaves the queue / state pill updates in place |
| Church deactivate/reinstate, RAG override (ChurchManagement) | In-modal checkmark on their confirm modals; detail-panel status pill updates |
| Leader deactivate/reinstate (new, main) | Already has LeaderSlots confirm-strip → strip collapses into the updated row pill (per the gap-5 panel design) |
| Church/leader profile & details saves | Inline "Saved" state on the edit strip (`EditChurchStrip`, `ChurchProfileCard`) |
| Request-info sent (RequestInfoPanel, main) | Inline confirmation within the panel ("Question sent · awaiting reply" state it already renders) |
| All error toasts | Inline slot at the failing control, dictionary copy |

If you'd rather keep a toast lane, constrain it to: success-only, never destructive outcomes, dismiss button, ≥6 s, stacking, and dictionary copy — but my recommendation is a clean kill; two surfaces doing one job is how this drift started.

**Error copy pipeline — close the raw-string hole at the source:** wrap the error path in `api.js` so anything surfaced to a user goes through the dictionary; unmapped keys render a safe generic ("That didn't go through. Try again, or note the reference below." + `request_id`) and log the raw string to console for ops. That single chokepoint makes `setError(err.message)` impossible to reintroduce, instead of chasing 50 call sites forever. (Whether to also build the full per-affordance sink registry from the 2026-06-24 panel, or do a pragmatic per-screen inline-slot adoption, is question 3 — the chokepoint is needed either way.)

**Known copy/mechanism debts to fold in:** the 19 backend functions returning raw Supabase `error.message` (tracked, §7 item 11); the false "Recorded to the audit log" success on pastoral close-case while the note is dropped (KAN-295 — the worst single trust defect in the app); `UndergroundAccessDenied.jsx:25` rendering the literal column name `is_underground_admin` in user-facing copy; the `api.js:574` deprecation string that would render raw; `window.confirm` at `Account.jsx:453` → proper modal with typed confirmation ("unenroll" or church-name pattern) given it's a lock-yourself-out action.

**Verification popups (your "properly functioning" ask):** they already function properly — keep them exactly as they are mechanically. Polish list only: the voice slip (§2.2 item 4), true focus-trap (Tab can currently escape the dialog), merge the ~90%-duplicated TotpChallengeModal/StepUpTotpModal logic into one component with two skins, and the window-remaining chip (§2.2 item 3) so the *next* prompt is never a surprise.

---

## 4. Per-page walkthrough

Format per page: what it is → what I found → suggestions (numbered). Known/tracked items are tagged with their Jira key and not re-proposed as new.

### 4.1 `/login` (Login.jsx)
Clean, calm, responsive at 375 px; zero console errors; strong headers. Findings: stale placeholder domain `you@replant.network` (:209); "Recover access via ops" is dead text (:219); "Contact ops" names no channel (:274); Google Fonts third-party load (index.html:10-12); session-expired banner works. Suggestions: 1) fix placeholder; 2) make recovery text honest (name the mechanism: "Access resets are issued by Replant Operations") or link a `mailto:accounts@projectreplant.org`; 3) self-host the three font families (drop the CSP entries entirely — cleaner and threat-model-correct); 4) add `:focus-visible` rings (login is where keyboard users start).

### 4.2 `/set-password` (SetPassword.jsx)
Server-side activation path is architecturally right (avoids the AAL2 trap on recovery links). Suggestions: 1) verify expired/consumed-link error copy reads in dictionary voice, not raw GoTrue strings; 2) on success, the `/login?activated=true` landing should confirm explicitly ("Password set. Sign in.") — confirm live in the logged-in pass.

### 4.3 `/network` (NetworkOverview.jsx)
Read-only stats; banner use is INSIDE scope (page load) except manual-refresh failures also land there (:188). Suggestions: 1) refresh failure → inline at the refresh control; 2) this is the default landing page — in the logged-in pass, judge whether it earns that slot (most sessions start with queue work; consider "Queue" as post-login default or a prominent queue-count card here); 3) skeletons over spinner for the stat grid.

### 4.4 `/queue` (Queue.jsx — Churches/Leaders tabs, ChurchProfileCard, RequestInfoPanel)
The workhorse — and the epicenter of both complaints: success-as-error toast on reject (:246 main), raw `err.message` toasts on every save path, and the 5-min step-up cadence on all six actions. Suggestions: 1) apply §3 toast retirement (rows already leave the queue on decision — that *is* the confirmation; add the in-modal checkmark for approve/reject); 2) the AAL2 lever (§2.2) transforms this page's feel; 3) RequestInfoPanel: keep thread state inline (already does), route send-failures inline; 4) KAN-300 (branch parent link display) and KAN-176 (windowed pagination) land here — fold into the same pass; 5) logged-in pass to check: empty states per tab, long-name overflow, decision-dropdown affordance clarity (mixed dropdown/button pattern), keyboard operability of per-row menus.

### 4.5 `/underground` (Underground.jsx — Pending/Verified/Deactivated/Inbox subviews)
Per-row region-expand errors go raw to the top banner (:282 — OUTSIDE scope). SLA banner correctly gray per ruling. Suggestions: 1) region-expand failure → inline on the row; 2) subviews are in-file tabs, not routes — deep-linking/refresh loses your tab (make them query-param routes: `/underground?tab=deactivated`); 3) logged-in pass: verify the AAL2 page-entry gate banner (:408) reads in dictionary voice and the TotpChallengeModal path in from it is smooth.

### 4.6 `/underground/pending/:id` (UndergroundDetail.jsx + ~12 action modals)
Highest raw-`setError` density in the app (15 sites); force-unmark/signed-URL/delete-evidence failures land raw in the top banner (:357,:481,:486); claim conflicts route inline correctly. The 12 modals are the two-eyes ceremony heart — mechanically sound (submit-guarded), but most lack ESC and some allow mid-submit backdrop dismissal (§1.8). Suggestions: 1) full §3 surface-2 adoption (this page is the pilot candidate for inline routing); 2) modal standardization pass (ESC + backdrop + focus-trap parity with TierModalShell); 3) NotifyChannelDownBanner is correctly scoped — keep; 4) evidence upload: verify progress/failure states in logged-in pass (upload flows are where silent failures hurt most).

### 4.7 `/underground/siblings` + `/underground/second-leader/:id`
Claim/approve/reject ceremony mirrors the church flow. Suggestions: 1) same inline-error + modal-parity treatment; 2) logged-in pass: confirm sibling approve/reject success acknowledgment is the in-modal checkmark (it should inherit the ceremony pattern).

### 4.8 `/underground/rejected/:id` + Deactivated subview
Read-heavy with restore/hard-delete ceremonies (5-min sensitive tier — correct per ruling). Suggestions: 1) hard-delete confirm modal is one of the unguarded-backdrop offenders — fix first among the modal batch (it's the most destructive control in the app); 2) verify the restore two-step (initiate → confirm) communicates the pending state between the two AAL2 ceremonies.

### 4.9 UG Inbox (UndergroundInbox.jsx)
Load-error banner INSIDE scope; ⚑ pinned-for-you chips per the hybrid-pin ruling. Suggestions: 1) logged-in pass: unread/pin affordances, empty state, and whether inbox events deep-link to the right detail tab.

### 4.10 `/heartcry` (Heartcry.jsx)
Life-safety surface; 90-s window is intentional and stays. Gate banners at :364/:390 are legitimate. New "Mark as Responded" confirm strip (merged) awaits your canned-line ratification (tracked). Suggestions: 1) decrypt step-up modal already carries the tightest ceremony — add the window-remaining chip here first (90 s is where surprise expiry stings); 2) per-card decrypt failures inline on the card, never the top banner; 3) logged-in pass: triage flow end-to-end with the new respond strip.

### 4.11 `/triage/pastoral` (PastoralQueue.jsx — Signals)
The "Keep this surface safe" notice banner is good. Findings: triage-action failures land raw in the top banner (:989); the Reach-Out → close-signal second call fails **silently** (:1460); KAN-295's false "Recorded to the audit log" success is the deepest trust defect (backend drops the note). Suggestions: 1) fix KAN-295 backend-first, then make the success copy honest; 2) surface the close-signal failure on the signal row ("Reach-out sent · close failed — Retry close"); 3) inline triage errors at the action bar; 4) rate-limit copy ("X/10 remaining this hour") is a good pattern — keep.

### 4.12 `/triage/flagged` (Flagged.jsx)
Same silent second-call failure on escalate → clear-flag (:555). Escalation correctly removes the case from the escalating admin's view (anti-gossip — do not "improve" this). Suggestions: 1) surface clear-flag failure with a retry affordance on the row; 2) KAN-298 (manual flag taxonomy) will land here — design its tag picker on the shared pill vocabulary, not a sixth variant; 3) KAN-292/294 escalate verb/gate copy work is in flight — don't double-touch.

### 4.13 `/triage/team-inbox` (PastoralQueue.jsx — Inbox)
Load failure replaces the whole surface (crude early-return); triage-tab badge always reads 0 on prod (KAN-220, fix in flight). Suggestions: 1) load failure → standard in-place banner + retry, preserving chrome; 2) reply send failures inline at the composer; 3) logged-in pass: thread ordering, unread affordance, reply round-trip.

### 4.14 `/triage/escalated` (EscalatedCases.jsx — super_admin only)
SLA banner + tier gating correct; ceremony modals use the checkmark pattern. Known in-flight: KAN-292/295/296 (verb/gate, close-note, 7-day-fallback honesty — `EscalatedCaseDrawer.jsx:101` promises an email leg that doesn't exist). Suggestions: 1) strip or build the 7-day-fallback claim before UAT (trust copy); 2) modal ESC/backdrop parity batch; 3) `list-escalated-cases` sits at browse tier (30-min window) — binary-vs-browse is on the SEC agenda (§2.2 item 6), not a UX change.

### 4.15 `/churches` (ChurchManagement.jsx + LeaderSlots)
Dense workhorse; highest inline-style count (77) and toast dependence; deactivate success styled as error (:116 main); RAG/deactivate/reinstate failures split between banner and toast on the same screen. LeaderSlots now carries the ratified per-row deactivate/reinstate ceremony (mis-click hazard was the panel's top named risk). Suggestions: 1) full §3 treatment (this page and Queue are where the toast kill pays off most); 2) status changes acknowledge in the detail panel (pill flips + confirm strip collapse), no floating surfaces; 3) KAN-210 (geocoding + profile field editing) should ride the same redesign; 4) logged-in pass: the two-"Deactivate" adjacency (leader row vs church) — verify the built ceremony reads unambiguous at a glance.

### 4.16 `/scripture` (Scripture.jsx)
Legacy pattern double-violation: green success banner (:376) + action errors to top banner (:319,:355). Content Section handoff makes this a rebuild target, not a patch target. Suggestions: 1) adopt the `cs-*` shell here + Announcements first (greenfield-closest, per the visual lane); 2) until then, one-line fixes: success → in-editor confirmation, errors → inline at composer; 3) publish-lock + "Draft a correction" semantics come with the shell (locked architecture).

### 4.17 `/announcements` (Announcements.jsx)
Same double-violation (:709 banner; `flashError` :418). Composer is the most copy-heavy admin surface. Suggestions: 1) rebuild on the Content Section shell (segmented top-level · workflow tabs · collapsed cards · drawer chassis · pagination-10 · publish-lock/correction — all locked); 2) WYSIWYG preview must render the real leader card component (locked direction); 3) KAN-240 (leader submissions review queue) lands here as a filtered sub-surface (`Submissions · N`), not a new nav entry — per the CD calls.

### 4.18 `/pii-scrub` (PiiHistory.jsx)
Read-only; banner INSIDE scope. Suggestions: 1) logged-in pass only (density/empty state); low priority.

### 4.19 `/audit` (AuditLog.jsx)
Read-only viewer; banner INSIDE scope; KAN-311 (filters/facets/scoped export at scale) already tracks the real gap. Suggestions: 1) when KAN-311 lands, keep the append-only posture visually explicit (no affordance that even hints at edit); 2) tier metadata in AAL2-failure rows is a forensic asset — surface it in the row detail.

### 4.20 `/team` (TeamManagement.jsx — super_admin only)
The 2026-06-30 ruling's own screen, half-migrated: Demote (:687) and Revoke (:694) still fire the retired green banner via `handleModalDone`; Promote/Approve/Deny/Sponsor use the checkmark. Regular-tier block banner (:333) is correct. Suggestions: 1) finish the migration (route Demote/Revoke through in-modal success; delete `DismissibleBanner tone="success"` + `setSuccess`); 2) broken token fallback `var(--rp-sky, #6bb5e8)` (:83) → `var(--rp-sky)`; 3) promotion ceremony (1-sponsor-1-Manager, 48-h expiry) — logged-in pass should walk both sides of it end-to-end (it has never been click-tested).

### 4.21 `/account` (Account.jsx)
Cleanest error-dictionary adopter (with PromoteAdminModal) — the model for everyone else. Findings: TOTP unenroll via `window.confirm` (:453); KAN-173 (factor management) is the tracked home for this work. Suggestions: 1) replace `window.confirm` with the ceremony modal + typed confirmation; 2) unenroll copy must state the consequence plainly ("You will be signed out and cannot sign back in until Operations re-issues enrollment" — if that's the true mechanism; verify against the reset path); 3) enrollment gate is good — keep the hard block.

---

## 5. Visual pass

### 5.1 Live (public surface — done)
Login desktop + 375 px mobile: clean, centered, no horizontal scroll, calm hierarchy, consistent with the token palette. Auth guard on protected routes redirects instantly to login with no content flash observed. No console errors. Headers: CSP + HSTS + X-Frame-Options DENY + nosniff + Referrer-Policy + `noindex,nofollow`. Third-party fonts finding at §1.11.

### 5.2 Code-level visual audit (full report from the visual lane, condensed)
Foundation is healthy: one `:root` token set, shared RpFrame/RpSidebar/RpTopbar, EmptyState + SkeletonRows adopted on 13 screens, one icon system (~70 inline-SVG glyphs, consistent stroke), real responsive work (slide-over nav ≤1023 px; tables scroll-x with 680 px min). On top of it, the forks:

1. Two full button systems — `.rp-btn*` (304 sites) vs `.btn*` (72 sites, 27 underground/escalated/pastoral files); `.btn-primary` is byte-identical to `.rp-btn-primary`.
2. Three table systems (`.rp-table` / `.q-table` / `.ec-table`) with drifted header specs.
3. Five pill/badge vocabularies (+ a 12-rule `!important` override stack on `.sla-pill`).
4. Two modal chromes (`.mdl` vs TierModalShell-inline) — handoff adds a third (`.cs-modal`) → converge, don't accrete.
5. Four success patterns (§1.6).
6. Rogue hex layer: `#cfcabd` ×24 (should be a `--rp-text-dim` token), `#e8a39e` ×9 (retired by KAN-116 for `--rp-red`, still present), hand-mixed tints; broken fallbacks `var(--rp-accent, #6BB5E8)` where `--rp-accent` doesn't exist (`InviteAdminModal.jsx:395`, `EvidenceUpload.jsx:112`).
7. Inline-style density on the big screens (PastoralQueue 116 / ChurchManagement 77 / Flagged 67) — spacing decisions live per-file, not in the system.
8. Accessibility: `:focus-visible` styled on exactly one element in 3,108 CSS lines; `--rp-muted #555` on `#080808` ≈ **2.6:1** as the default for table headers, nav labels, eyebrows (fails AA 4.5:1); 17 px checkboxes in the handoff pattern are below the 24 px hit-target floor.

**Ranked visual fixes (impact ÷ effort):** 1) global `:focus-visible` ring (2 px `--rp-sky`, offset 2) on all interactive classes; 2) finish /team success migration; 3) kill the two legacy green banners (Scripture/Announcements); 4) tokenize `#cfcabd` → `--rp-text-dim` + sweep rogue hexes; 5) fix the phantom `--rp-accent` fallbacks; 6) merge `.btn*` → `.rp-btn*` (alias, then codemod 72 sites); 7) unify the success checkmark on the TierModalShell rendition; 8) lift `--rp-muted` for text roles (or split token: `#555` stays for borders, text gets ≥`#8a8a8a`) — wide blast radius, do as its own pass; 9) collapse pill vocabularies toward `.cs-state`; 10) pilot the Content Section `cs-*` shell on Announcements + Scripture, then generalize (the handoff CSS is token-based and class-scoped — built to be adopted; strip its prototype harness classes).

**Dark-only is fine** (single hardcoded dark theme, no `prefers-color-scheme`) — an admin console may legitimately commit to one look; just make it official by declaring `color-scheme: dark` so form controls/scrollbars match.

### 5.3 Logged-in visual pass (pending your login assist — §2.1)
Per-screen checklist ready: hierarchy + density at real data volumes · empty/loading/error states per tab · long-content overflow (names, regions, notes) · 768 px + 375 px behavior per screen · keyboard walk (Tab order, ESC, focus return after modal close) · the two-"Deactivate" adjacency on ChurchManagement · promotion ceremony end-to-end · dictionary-voice check on every error we can safely trigger.

---

## 6. Verification popups — status detail

Solid today (keep mechanics): 6-cell OTP, autofocus, paste, auto-submit, disabled-while-verifying, 5-attempt → 15-min lockout persisted per factor, in-modal wrong-code copy with attempts remaining, step-up modal states the action + target and "can't be undone," cancel aborts without losing page state (login-context cancel signs out — correct there). Polish only: voice slip on the challenge eyebrow; true focus-trap; merge the two ~90%-duplicated modals; window-remaining chip; integration test for the `amr`-refresh assumption.

---

## 7. Already-tracked register (do not re-file)

| # | Item | Where it lands | Key/status |
|---|---|---|---|
| 1 | Escalate verb/gate per tier | Escalated/Flagged | KAN-292/294 In Progress |
| 2 | Close-case note dropped + false "Recorded" success | Pastoral | KAN-295 |
| 3 | Team Inbox badge always 0 | Team Inbox | KAN-220 (fix in flight) |
| 4 | 7-day fallback email promised, unbuilt | Escalated drawer | KAN-296 In Progress |
| 5 | `escalated_by_tier` hardcoded 'regular' | Escalated | KAN-292 |
| 6 | UG verification timeline renders empty (silent catch) | UG detail | KAN-286 |
| 7 | 5 TIER-1 actions missing step-up (announcements/scripture/heartcry-responded/clear-flag) | Content/Heartcry/Flagged | KAN-114 residue |
| 8 | deactivate/reinstate-church + rag-override missing step-up | ChurchManagement | pre-UAT punch list |
| 9 | UG endpoints missing `is_underground_admin` + AAL2 (incl. `read-region`) | UG | KAN-288 |
| 10 | `list-pending-underground` over-fetches precise UG country to browser | UG pending | KAN-289 |
| 11 | 19 fns return raw Supabase `error.message` | backend-wide | P2 roadmap |
| 12 | "Overseer" leftover in PromoteAdminModal:178 | Team | P3 rename |
| 13 | 903 KB monolithic bundle, no code-splitting | app-wide | P2 perf |
| 14 | Admin fn CORS `ACAO:*`; (HSTS since landed — verified live today) | headers | P2 |
| 15 | Keyboard/a11y pass owed | app-wide | KAN-34/KAN-317 |
| 16 | UG founding leader stranded (no queue surface) | UG | UAT blocker |
| 17 | Rejection-specific lockout copy | mobile+admin | ruling locked, building |
| 18 | Leader deactivate/reinstate ceremony | ChurchManagement | shipped PR #80 |
| 19 | RequestInfoPanel on Queue | Queue | shipped PR #80 |
| 20 | Heartcry respond strip + canned line | Heartcry | shipped; line awaits ratification |
| 21 | Content Section shell | Scripture/Announcements | design locked, build target |
| 22 | Admin promotion emails unwired | Team | KAN-31/104 |
| 23 | Block-user UI | moderation | KAN-301 set |
| 24 | Leader report mechanism (UGC) | moderation | new ticket per compliance audit |
| 25 | Audit-log filters/facets/export | Audit | KAN-311 |
| 26 | Verification lifecycle emails | Queue side-effects | KAN-61/62/143/206 |
| 27 | Windowed pagination all lists | app-wide | KAN-176 In Progress |
| 28 | Responsive shell residuals | app-wide | KAN-161 |

---

## 8. Staged build plan (sequence, not estimates)

- **Stage 0 — one-liners (no panel needed):** success-as-error toast types; login placeholder + recovery text; challenge-modal eyebrow voice; phantom `--rp-accent` fallbacks; Overseer string; `color-scheme: dark`; kill the two legacy green banners' worst sting (route those two screens' success into their editors).
- **Stage 1 — AAL2 relief (your ruling + SEC mini-panel):** 10-min TTL override for the six queue actions (both twins); sessionStorage step-up cache; window-remaining chip; the amr-refresh integration test.
- **Stage 2 — notification/error overhaul (SME panel required: BE + SEC + CONTENT + BA, genuine verdicts):** api.js dictionary chokepoint; toast retirement + per-site replacement map (§3); banner reserved-scope enforcement across the 8 offender screens; the two silent-failure fixes; window.confirm replacement.
- **Stage 3 — modal standardization:** ESC/backdrop/focus-trap/success parity on the ~18 bespoke modals; merge the TOTP modal twins; one modal chrome.
- **Stage 4 — visual unification:** focus-visible ring; token sweep; button/table/pill consolidation; muted-contrast token split; then Content Section `cs-*` shell pilot on Announcements + Scripture and rollout. Design-first rule applies — CD artifacts exist for Content Section/Escalated/UG queue; net-new screen redesigns beyond those need CD passes.
- **Stage 5 — the logged-in pass (with your one login) + keyboard/a11y sweep**, closing the owed click-through QA pass (KAN-34/317 fold-in).

---

## 9. Live logged-in pass — findings (2026-07-13, Founder-authenticated session)

Founder signed in once in the Browser pane; I drove every page at ~1280 px (plus the 800 px tablet shell and the 375 px login). Deliberately NOT exercised: any approve/reject/deactivate/RAG/tier action, UG row reveals or detail pages, heartcry decrypt/respond, sign-out. Runtime health was excellent: **zero console errors and zero failed network requests across the entire pass.** Every claim below was observed live.

### 9.1 Deploy-state (highest priority)

1. **Production is running a pre-PR-#80 bundle.** Two independent proofs: the Verification Queue's expanded church profile has **no RequestInfoPanel** (page text sweep: no "Request info" anywhere), and the Church Management detail panel's LeaderSlots has **no per-leader deactivate/reinstate ceremony** (panel buttons: Edit, ×, Reveal, Expand×2, RAG green/amber/red, one church-level Deactivate). The merged flow-gaps admin work (heartcry respond strip, request-info UI, leader deactivate/reinstate + their endpoints) is **not live**, while its DB migrations ARE live. The continuous-spec record says "all admin flows LIVE" — that assumption is wrong on the dashboard side. Action: check/trigger the Netlify production deploy off `main` (21d6db5) and re-verify.

### 9.2 Confirmed-live known defects

2. **KAN-220 confirmed:** Replant Team Inbox tab shows **no badge** while the surface itself says "1 unread thread" (sibling tabs show 2/3/5).
3. Test fixtures pollute prod queues and stats: "Test Church Flow One Again," "A11y Audit Test Church T16," a second "Maranatha Ministries" (Austria), "Test Challenge"/"Ruth Satest" as UG reviewers — the 24-pending/15-overdue numbers are mostly fixture noise. UAT data hygiene item (re-seed plan exists).

### 9.3 New findings — flow/affordance

4. **Network Overview "Needs Attention": 3 of 4 rows are dead text.** Only "Replant Team Inbox" is a real button; Pending Verification (24), Pastoral Signals (3), Flagged Messages (6) are styled like clickable rows but aren't. The dashboard's own front door doesn't route to the work.
5. **Pastoral Signals rows: the ONLY expand target is a ~13 px chevron icon.** The row itself has no click handler, no button role, no keyboard path (rows are absent from the a11y tree). Opening a distress case — the most important click on the surface — is a precision shot; even automation missed it repeatedly. Same row-role gap on Church Management rows (mouse-clickable there, but invisible to keyboard/AT).
6. **Escalated Cases: the Escalation Reason column truncates to ~2 words** ("Explicit distress…", "Language has…"). The decision-relevant field is unreadable at rest.
7. **Team Management roster actions are icon-only** — trash = revoke admin, ↓ = demote, ↑ = promote, circular arrow = reset — no labels on the most dangerous controls in the product; the promote arrow renders pre-highlighted (reads as active/selected). GRANTED and LAST SIGN-IN columns wrap mid-token ("2026-06-\n29", "LAST SIGN-\nIN").
8. **Heartcry card renders a wall of raw base64 ciphertext** — pure noise that invites copying (the banner itself says don't relay contents); replace with an "Encrypted — decrypt to read" placeholder block. **"Mark as Responded" is offered before any read/decrypt** — a respond-without-reading hazard. Date filters are unlabeled native `mm/dd/yyyy` inputs whose calendar icon is near-invisible on dark (native `WindowText` SVG confirmed in network log).
9. **Underground Oversight:** header metric shows "30 verified" while on the Pending tab (header not tab-aware); two unexplained ref formats (`RPL-30037` vs `UG-80BD`); count pill on the Verified tab only. Restricted-access banner and gray SLA band are correct per rulings.
10. **Queue:** STATUS column shows "Pending" on all 24 rows of a pending-only tab (the Leaders tab correctly drops it); Leaders tab's green dot next to church names carries no label or legend (mystery meat); type-filter chips are exposed to AT as seven *unnamed* tabs while the real Churches/Leaders tabs are plain buttons (inverted semantics).
11. **Church Management:** MEMBERS column reads "—" on every row (dead column; also "—" in the detail panel); RAG is a color-only unlabeled dot; a hidden mobile variant of the detail panel lives in the DOM alongside desktop (`rp-cm-detail-mobile`) with RAG buttons accessibly named just "green/amber/red" — dual-render drift risk made concrete.
12. **Announcements:** byline renders the raw role enum — "Posted under ruth · super_admin" — while the sidebar chip says MANAGER (raw enum + tier-display contradiction on screen simultaneously). Posted cards offer direct Edit/Delete with **no publish-lock** — divergent from the locked post-publish-lock + "Draft a correction" architecture (the Content-Section rebuild closes this).
13. **Daily Scripture:** H1 says "Daily Scripture Seeding" (internal vocabulary); primary CTA renders truncated as "Schedule for …"; per-row red trash delete on scheduled verses (delete-scripture is already on the KAN-114 no-step-up list); composer labels UTC while the header speaks "06:00 local."
14. **Audit Log:** ACTION pills mix raw snake_case (`escalated_inbox_opened`) with humanized ("Pastoral Signal Viewed") in the same column; TARGET column often just repeats the action token instead of naming the target entity; pastoral-signal views are attributed to "system" rather than the viewing admin (forensics muddied). All fold into KAN-311.
15. **PII Scrub History:** "RECENT RUNS · LAST 7 NIGHTS" actually lists the last 7 runs-with-records spanning six weeks; `scrub_church_pii()` function syntax rendered in the banner. Otherwise the most honest screen in the app ("no actions on this screen").
16. **Account:** three stacked COMING SOON placeholder cards (Sessions / Activity / Preferences) read unfinished for a prod console; TOTP factor ID hex surfaced ("ID ee606767…"); no unenroll affordance visible on the deployed build (KAN-173 scope).
17. **Flagged Messages:** taxonomy pills are properly humanized here ("Location Disclosure") — which makes Pastoral's raw `auto:self_harm_indicator` an inconsistency, not a system gap; internal footer "Taxonomy v1.1.0 — for forensic FP audit" renders to users.
18. **Date formats: five-plus coexist** across sibling surfaces — "49d" elapsed (Queue), ISO `2026-06-30` (Flagged), "joined May 21, 2026" (Leaders), `6/24/2026` (Escalated), `23/06/2026, 22:00 UTC` (Announcements), "14d ago" relative (Team/Inbox). Pick one system (relative + absolute-on-hover, or the reverse).

### 9.4 New findings — perf/platform

19. Hashed assets (`/assets/index-*.js|css`) ship with `max-age=0, must-revalidate` — every full navigation re-validates (often re-downloads) the 903 KB chunk. Content-hashed filenames should be `max-age=31536000, immutable` (one-line `netlify.toml` headers change).
20. Opening any triage tab fires all four list endpoints (badges), with duplicate bursts of the same endpoint within one navigation — redundant fetching worth a look when the Content-Section shell work touches these screens.

### 9.5 What's genuinely good (keep)

21. Zero console errors; zero failed requests; instant auth-guard redirect. Security-posture copy is the best writing in the app: UG restricted-access banner, heartcry life-safety banner, append-only audit banner, "Do not leave this device unattended while signed in." footer. Gray SLA bands per ruling. Masked phone + Reveal (audited) on profiles. Escalated Cases register (provenance grouping, state pills, oldest-first note) is the strongest screen design. Pastoral care banner + Team invite explainer copy are exactly the right voice. The serif-numeral stat cards on Network Overview are distinctive and calm.

## 10. Questions for the Founder

1. **Deploy check (new, first):** production dashboard is running a pre-PR-#80 bundle (§9.1) while the #80 migrations are live in the DB — shall I verify/trigger the Netlify deploy off main and re-smoke the three flows (request-info panel, leader deactivate/reinstate, heartcry respond strip), or do you want to drive that yourself?
2. **Toasts:** retire the toast component entirely per §3 (recommended), or keep a constrained success-only toast lane (dismissable, ≥6 s, never destructive outcomes)?
3. **AAL2 lever:** approve the six queue actions moving to a **10-minute** step-up TTL (your 2026-06-30 number) + the sessionStorage cache + window chip, ratified through a SEC mini-panel? (Freshness tiers stay locked as-is; sensitive 5 min and heartcry 90 s untouched.)
4. **Error routing depth:** build the full per-affordance sink registry from the 2026-06-24 panel spec, or the pragmatic version — api.js dictionary chokepoint + per-screen inline slots (recommended; same user outcome, less machinery)?
5. **Plan:** approve the staged plan (§8) + dispatch the Stage-2 SME panel? (Stage-0 one-liners — now including the live-pass copy/label fixes from §9.3 — I can prep as a batch for your review whenever you say.)
6. **SEC agenda add-ons:** fold the lenient tier-drift list + browse-tier UG mutations + `send-team-reply` binary gap (§2.2 item 6) into the same SEC mini-panel?
7. **Data hygiene:** the prod queues carry ~10 test-fixture churches inflating SLA/overdue stats (§9.2) — fold the re-seed/empty-state plan into pre-UAT, or leave fixtures until after the dashboard pass you're planning?

## 11. Rulings received (2026-07-14)

All seven questions ruled by the Founder; recorded verbatim in the continuous spec same turn. Summary: 1) Claude owns admin deploys, HOLD until the full fix batch is gathered; 2) toasts RETIRED — replacement must be genuinely good-looking; 3) AAL2 10-min override GO (SEC mini-panel ratifies); 4) chokepoint routing GO; 5) staged plan + Stage-2 panel GO; 6) SEC add-ons GO; 7) fixtures stay. Question 8 followed: deeper visual ambition demanded → §12.

## 12. The visual vision — "Vigil"

§5 was hygiene: tokens, contrast, consistency. This section is the actual design idea — what the dashboard should *be*, visually, and why. Everything here respects the threat-model constraints (§D of the intelligence brief) and builds on the identity the app already half-owns (near-black canvas, Cormorant display, JetBrains machine-text, one sky accent).

**The concept.** This dashboard is a night watch. A small number of shepherds keeping vigil, at odd hours, over a network that includes people in danger. The room should feel like that: dark, calm, lit only where something needs you. Not a SaaS analytics tool with a dark theme — a watch room. Every visual decision follows from four laws: darkness is the canvas, **light is information**; red is never decoration; motion is scarce and deliberate; and everything done here is *written down* — the interface behaves like a ledger, because the product's soul is an append-only audit log.

**The ten moves:**

1. **Lamps — one light grammar for all status.** Today status is flat dots and red text in five competing pill systems. Replace with a single "lamp" primitive: a small glow with calibrated rest states — green steady, amber breathing almost imperceptibly, red bright with a soft halo. The same lamp renders RAG, SLA severity, unread, expedited. Rules: never color alone (each lamp carries a letterform/label for AT and colorblind admins — closes the live-pass mystery-dot findings), at most one breathing element per viewport, `prefers-reduced-motion` freezes everything. The Overview's "1 open heartcry" becomes the brightest object in the room — an ember you cannot not see. Points of light in darkness is the truest possible visual metaphor for this network.
2. **Age as a wick, not a scream.** The live queue renders "49d" in red on fifteen rows — urgency as wallpaper, which is how urgency dies. Replace elapsed-age text with a thin hairline under each row/card that lengthens and warms (sky → amber → red) as it approaches SLA breach. The page stays quiet; the oldest cases still pull the eye; exact day-counts live in mono on hover and in the dossier. One glance now ranks the whole queue preattentively.
3. **Casework as dossiers, not CRUD rows.** Verification is casework, and the expanded SUBMITTED PROFILE block is already 80% of the right idea. Commit to it: a fixed dossier anatomy — identity line (serif), machine line (mono: ref · submitted-via · date), evidence line (WHAT WE HAVE / WHAT WE NEED as two small completeness bars), one primary affordance. Reuse the same anatomy in Queue rows, Underground detail, Leader profiles, and the Escalated drawer, so an admin's eye learns one shape. Whole row = click target (chevron becomes an indicator, not the target — closes the 13px-chevron finding).
4. **The Ledger — the toast successor.** Three parts, no floating ephemera anywhere: (a) *in-place truth* — the acted-on row itself changes state (pill morphs; a decided queue card exhales out over ~200ms); (b) *the seal* — ceremonies end inside the modal with a drawn checkmark and a mono receipt line: "Recorded — audit ref \#… · 14:32," copyable, honest (it IS an audit row); (c) *the session ledger* — a topbar book icon opens a right drawer listing this session's actions (action · target · time · ref), fed by the same audit responses. Nothing important ever appears in a surface that deletes itself after 3.5 seconds; the UI's memory mirrors the audit log's memory. Failures render inline at the failing control with dictionary copy + request-id chip — never floating, never top-of-page.
5. **Three voices, enforced — the type liturgy.** The trio already exists; make it law. Cormorant Garamond: names and numbers that matter (people, churches, the big counts). JetBrains Mono: machine facts (refs, timestamps, codes — humanized words, machine dress). DM Sans: working prose. Every text style in the app declares its voice; anything that can't is a bug. Concretely: ONE date system everywhere (relative "14d" in registers, absolute mono on hover/detail — killing the five-format chaos), `tabular-nums` on all numerics, `scriptureItalic` appears in exactly one chrome context (see move 6) and nowhere else.
6. **Empty states as benedictions.** The night watch's quiet moments should feel like grace, not absence: "The watch is quiet. No signals need you tonight." — optionally a single short verse, the app's one sanctioned scripture-italic moment in chrome. Skeletons mirror final geometry exactly (no reflow). Error states get the same dignity: what happened, what to do, the reference to quote.
7. **The room knows who's in it.** Topbar right: tier chip, AAL2 window chip ("Verified · 22m" — the §2.2 visibility fix as a *designed* object), environment mark. Sidebar nav items gain quiet count-embers (Queue 24 · Signals 3 · Flagged 6) — replacing the Overview's dead "Needs Attention" text with living scent that's clickable by construction. Team Management moves out of COMPLIANCE into a "Governance" group (IA honesty).
8. **Three ceremony weights.** All modals collapse into one shell with three weights: **Note** (read/acknowledge), **Act** (single-eye action: reason field, confirm), **Seal** (two-eyes/step-up: the backdrop deepens further, TOTP, seal success). Visual gravity scales with consequence — an admin should *feel* the difference between closing a flag and hard-deleting an underground church before reading a word. ESC/backdrop/focus behavior identical across weights (the 18-modal jank fixed as a system, not as bugs).
9. **The constellation.** Replace the Overview's macro-region bar list with a constellation panel: each macro-region a cluster of faint stars — one per church; verified steady, pending dim, red-RAG warm. No geography below macro-region, no coordinates, no shapes of countries: a star chart, not a map — beautiful precisely because it refuses to locate anyone. This is the emotional anchor of the product: the network you keep watch over, rendered as lights held in the dark.
10. **The craft floor (hygiene, restated as law).** Focus ring (2px sky, offset 2) on every interactive element; 24px minimum targets; `#555` demoted to borders-only with a new `--rp-text-dim ≥ #8f8f8f`; destructive controls never icon-only (fixes the Team roster trash/arrows); native date inputs replaced by a tokenized date field (fixes the invisible calendar glyphs); `color-scheme: dark` declared; the two success-as-error toasts die with the toast system itself.

**Sequencing note.** Per the design-first rule, screen-level mockups are CD's to formalize — this section is the direction for that brief. Fast path: I render a living direction board (HTML on the real `--rp-*` tokens: lamp states, wick, dossier card, seal moment, ledger drawer, constellation sketch) for your gut-check, you strike or keep moves, then the CD brief carries the locked direction and the Stage-2 panel reviews the whole notification+visual overhaul before code.
