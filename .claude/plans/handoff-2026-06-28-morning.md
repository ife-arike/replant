# Handoff — 2026-06-28 morning — Post-Option-C+ ship, KAN-274 implementation pickup

## TL;DR for the next session

Option C+ MFA architecture is **live in production** as of last night. The dashboard's per-action AAL2 gates finally enforce what their code has been claiming. 4 pre-launch tickets filed; 1 (KAN-274) has a ratified RFC + CD deliverable ready to implement; 3 (KAN-271, 272, 273) are DBA / spike / multi-site work.

**Most likely next move:** start KAN-274 mobile-side implementation, threaded with the BE/DBA work the SME panel called for. CD's design is paste-ready at `/Users/ife/replant/docs/design_handoff_visibility_change_flow/` (6 surfaces, source scaffolds + interactive preview + locked copy).

**Open Founder ratifications** (5 from CD + a few from the panel) must close before implementation. List + my recommendations at the end of this handoff.

**Do not start mobile code without:**
- Reading the CD `README.md` and opening `preview/index.html` to ratify visual intent
- Founder closing the 5 CD open Qs (window granularity, admin identity reveal, call channel, duress reminder cadence, reversibility asymmetry)
- DBA committing the relay-token mint table migration (KAN-274 is build-from-scratch on this; the existing `relay_token_hash` column is wrongly placed per audit)

---

## What's live in production (merged 2026-06-27 evening)

**PR:** [replant-admin#68](https://github.com/ife-arike/replant-admin/pull/68) merged to main at commit `1e90766` (17 substantive commits preserved, ~2900 LOC, 80 files).

**Production URL:** `admin.projectreplant.org` — Netlify deploy completed last night.

### Option C+ — what landed (one-liner each)

1. **Login.jsx AAL2 elevation chain** — every admin session elevates to AAL2 inline via `mfa.challenge` + `mfa.verify` after `signInWithPassword`. Closes the load-bearing auth gap.
2. **4-tier AAL2 freshness windows** locked — browse 30min / regular_destructive 30min / sensitive_destructive 5min strict / life_safety 90sec. Per-endpoint distribution in `[[locked-tiered-mfa-freshness]]`.
3. **`request-step-up.js` retrofit** — password re-probe → TOTP code verify. SEC FLAG addressed: explicit `aal === 'aal2'` assertion at mint endpoint closes captured-AAL1-cookie-plus-phished-OTP replay path.
4. **`BlockingEnrollmentGate.jsx`** — hard-block for admins with no verified TOTP factor. Only escape is corner Sign out link. CD-designed.
5. **`StepUpTotpModal.jsx`** — replaces `StepUpModal.jsx`. 6-cell OTP, action-bound context line, action-binding contract preserved.
6. **Centralized AAL2 elevation interceptor** — `src/lib/api.js`'s `call()` catches recoverable 401s (`stale_aal2` / `AAL2_EXPIRED` / `aal2_expired_life_safety` / `no_aal2` / `aal1_session`), opens `ElevationModalHost` globally, retries original request after verify. **Founder never loses composer work to a freshness-window expiry.**
7. **`useCheckpointedState` hook** — debounce-persists composer state to localStorage; restores on mount; clears on save. Applied to `NarrativeComposer` (had load-bearing optimistic-clear bug).
8. **`AuthElevationGuard`** mounted at App.jsx root — catches stale AAL1 sessions from before deploy.
9. **Full UG endpoint tier re-audit** — only 7 endpoints stayed at sensitive_destructive (the actual verdict commits + UG identity exposure). 12 dropped to browse / regular_destructive after Founder ratification. The 5-min strict tier is now reserved for what it should be.
10. **`is_underground_admin` ↔ super_admin symmetric** — auto-set on grant + approve-promotion; auto-cleared on demote + revoke-tier. Founder ruling: super admins always have UG access.
11. **6 smoke batches** — heartcry audit action, list-admin-tier-promotions schema drift, sponsor in-modal success, reset-pwd modal, revoke copy, TOTP autoFocus, Day-pill removal, tier copy fixes, verify success modal, "not found" softening, terminal-state action-bar gate, pre-activation soft warning, audit-row dedupe.

### Post-deploy smoke surface to verify yourself

If you have a window before pickup, walk these on prod:
- Sign in → TotpChallengeModal mounts inline → AAL2 elevation lands on /network
- Invite admin → StepUpTotpModal → invite sends
- Sponsor promotion → in-modal success (no green banner)
- Reject church → action bar hides on terminal state; verified detail loads
- UG oversight → no TOTP re-prompt while session is fresh (browse tier 30min)
- Admin notes save → no longer wipes the composer on 401; opens elevation modal + retries
- Heartcry read → 90-sec re-prompt fires; humanizer says "TOTP verification window has expired for this action"

---

## Outstanding pre-launch tickets

### [KAN-271](https://projectreplant.atlassian.net/browse/KAN-271) — Auto-cancel pending UG proposals on terminal state

**Status:** RFC filed. **DBA work required.**

**Why pre-launch:** RPL-30067 surfaced this — a pending UG proposal can outlive its parent church's verification lifecycle. Symptom fix shipped (FE filter in `UndergroundInbox.jsx` excludes terminal-state churches). Real fix is a DB trigger: on `churches.verification_status → 'rejected'` OR `is_active → false` OR `hard_deleted_at IS NOT NULL`, auto-cancel open `pending` proposals + write audit row.

**Backfill required:** RPL-30067's orphan proposal `c8a524f4-c2be-4cd6-8a52-a28bd4791c9e` should transition to `cancelled` in the migration.

**Next step:** dispatch DBA. RFC body has the suggested trigger shape + backfill spec.

### [KAN-272](https://projectreplant.atlassian.net/browse/KAN-272) — Spike on audit-log page-load record granularity

**Status:** Spike filed. **Threat-model research + compliance review required.**

**Stopgap shipped in PR #68:** per-session Upstash SET-NX 1hr TTL dedupe on UG gate-event audit rows (pass path only; fail path always writes). Founder noted volume was excessive during smoke.

**Spike scope:** determine the correct granularity for AAL2 gate page-load audit records. Per-page-load (KAN-149 original)? Per-session (current stopgap)? Per-day? Hybrid? Spike answers; implementation ticket follows.

### [KAN-273](https://projectreplant.atlassian.net/browse/KAN-273) — Spurious "action needed" emails on failed audit rows

**Status:** P1 pre-launch. Multi-site after audit.

**Root cause hypothesis:** a DB trigger on `audit_log_underground` (and possibly `audit_log`) emits an "action needed" notification regardless of whether the audited row was a successful action or a failed attempt. Founder hit this when `validate-relay-token` returned false but she still got the email. Subsequent audit found 5 more sites with the same shape: `list-flagged-messages` rate-limit denials, `list-underground-churches` denials, etc.

**DBA needed urgently:** the trigger isn't findable in repo migrations. Either hand-applied in prod (drift), or it's somewhere I missed. DBA verifies + repairs.

### [KAN-274](https://projectreplant.atlassian.net/browse/KAN-274) — Mobile visibility-change flow + admin retrofit

**Status:** RFC ratified by 5 SME panels (SEC + BA + BE + DBA + Mobile-FE) + DBA verdict-locked + CD deliverable READY. **Implementation pickup is the main work for next session.**

See the dedicated section below.

---

## KAN-274 — Implementation plan

### What the SME panel + DBA audit nailed down

- **Verdict (b) confirmed high confidence**: the visibility-override flow has NEVER run end-to-end in production. `fn_validate_relay_token` exists server-side but reads `underground_verification_proposals.relay_token_hash` — a column that's chicken-and-egg with the validate-then-propose call order. FE currently sends `relay_token_hash: null`; BE requires 16-256 char hash. Whole chain unshipped.
- **Scope is build, not fix** — there's no existing flow to wire into.
- **Architectural fix:** move `relay_token_hash` OFF the proposal row to a dedicated `underground_relay_tokens` (or `visibility_change_relays`) table with state machine + TTL + audit. Proposal row becomes the two-eyes COMMIT record; relay table is the source of truth for mint + validate's anchor.
- **Scope is UG-only.** Regulars do not need this flow; do not over-design for universal.
- **Endgame copy LOCKED verbatim:** *"Your church now shows in the network."* / *"You're now hidden in the network."* — no green checks, sky/muted only.

### What CD delivered (paste-ready, in `/Users/ife/replant/docs/design_handoff_visibility_change_flow/`)

**6 mobile surfaces** as React Native `.tsx` source scaffolds + interactive HTML preview + locked CSS:

| # | Surface | Component | Lives in |
|---|---|---|---|
| 01 | Entry affordance | `ChurchVisibilityRow.tsx` | Inside `SettingsScreen`'s `'church'` section |
| 02 | Schedule picker | `VisibilityChangeScheduleScreen.tsx` | First card of `VisibilityChangeStack` |
| 03 | Safety briefing (one-shot) | `FirstCallSafetyBriefing.tsx` | Between lobby "I'm ready" and active, first call only |
| 04 | Lobby | `VisibilityChangeLobbyScreen.tsx` | Off root, surfaces at T-15 |
| 05 | Active (code) | `VisibilityChangeActiveScreen.tsx` | Off root, during the call |
| 06 | Complete | `VisibilityChangeCompleteScreen.tsx` | Terminal outcome |

**Open `preview/index.html` first** — CD calls it the source of truth for visual + interaction intent. View-as toggles cycle: Surface 01 (Hidden / Visible / Call scheduled), Surface 05 (revealed / over-shoulder hide / idle timeout / admin delayed / validating).

**Security floor on Active screen — non-negotiable:**
- `expo-screen-capture` `preventScreenCaptureAsync()` on focus (blocks Android screenshots; iOS blank in app-switcher); released on blur
- 90-sec idle drops plaintext to `••••`; tap-to-reveal
- Persistent "Hide code" top-right (one-tap over-shoulder defense)
- Never `AsyncStorage`; only `expo-secure-store` 30-min TTL for force-quit recovery
- No copy-to-clipboard anywhere
- `beforeRemove` blocks the back-gesture; Android hardware back intercepted while `status === 'in_call'`

**Duress via social convention** (CD's word-for-word approach, Founder ratified):
- Taught once in `FirstCallSafetyBriefing`: *"if anyone is with you and forcing this change, read the digits in reverse"*
- BE detects reversed submission → returns success to admin UI + silently flags account for human review
- Active screen carries only a coded jog: *"Read them in the order shown"* — innocuous to a room observer
- Invisible to room observer. Detectable server-side.

### Implementation breakdown

**DBA wave (BLOCKS mobile + admin work):**
1. New table `underground_relay_tokens` (or rename per Founder pref) — schema: `id`, `church_id`, `direction` (hidden_to_visible / visible_to_hidden), `status` (pending / revealed / in_call / validated / expired / failed), `window_start`, `window_end`, `code_hash`, `reverse_code_hash` (duress channel), `minted_at`, `revealed_at`, `validated_at`, `expires_at`, `actor_user_id` (admin who claimed), `requester_user_id` (leader who scheduled).
2. RPC `fn_request_visibility_change(p_church_id, p_direction, p_window_start, p_window_end)` — leader-initiated; writes pending row.
3. RPC `fn_claim_visibility_slot(p_relay_id)` — admin-initiated; transitions pending → revealed at T-15 push trigger.
4. RPC `fn_mint_visibility_code(p_relay_id)` — fires when leader's lobby calls "I'm ready"; mints 4-digit + computes reverse-digit hash; sets revealed → in_call; sets short TTL (15 min).
5. RPC `fn_validate_visibility_code(p_relay_id, p_token_hash)` — replaces current `fn_validate_relay_token`; compares against code_hash (normal) and reverse_code_hash (duress); returns `{ ok, outcome: 'success' | 'duress_detected' | 'invalid' }`.
6. Replace `fn_validate_relay_token` callers + retire the relay_token_hash column on `underground_verification_proposals`.
7. Backfill / cleanup migration: VO-action proposals stay as commit records but lose the orphaned hash column.

**BE wave (parallel to DBA, depends on DBA migration):**
- New Netlify functions: `request-visibility-change.js` (leader-side mobile), `claim-visibility-slot.js` (admin-side), `mint-visibility-code.js` (leader-side, fired by lobby pre-arm), `validate-visibility-code.js` (admin-side; replaces validate-relay-token.js).
- Update admin's `VisibilityOverrideModal.jsx` — replace `validateRelayToken` call with `validate-visibility-code` against the new table.
- **Delete the false comment** at `VisibilityOverrideModal.jsx:105` — *"server re-hashes from p_payload if needed; see propose-underground.js"*. The comment was materially wrong and was the root cause this gap went unnoticed.
- Edge function for T-15 silent data push to leader's app.

**Mobile-FE wave (depends on DBA + BE wave):**
- Lift CD's 6 `.tsx` scaffolds verbatim into `src/screens/` or appropriate directories (CD already names the locations).
- Mount `VisibilityChangeStack` off root in `RootNavigator` — `gestureEnabled: false`, `animation: 'fade'`, beside `JoinCodeReveal`. Screens: `Schedule`, `SafetyBriefing`, `Lobby`, `Active`, `Complete`, `Cancel`.
- `AuthProvider` gains `visibilityChangeRequest` state: `{ status, direction, windowLabel, code? }`. T-15 push handler flips `pending → revealed`.
- `ChurchVisibilityRow` reads `viewerChurchType === 'underground'` → render the entry; else render nothing.
- Wire `expo-screen-capture`, `expo-secure-store`, push handlers, Supabase client calls per the scaffolds.

**Tests + smoke:**
- Vitest for the new BE functions (mint + validate + reverse-digit duress detection)
- BE unit test for the existing CANONICAL_ACTIONS set — new actions need to be added
- Mobile-side: scaffolds include comments noting the test points
- End-to-end smoke once on prod: leader app + admin dashboard simultaneously, both Founder + a test-leader account, one full visibility flip per direction

---

## Open Founder ratifications (close BEFORE mobile code)

CD surfaced 5; the SME panel surfaced 2 more. All listed for one-pass review:

| # | Source | Question | CD/Panel lean | Founder ratify |
|---|---|---|---|---|
| 1 | CD Q1 | Window-picker granularity — 2-hour blocks vs 30-min slots vs leader-defined | 2-hour blocks (CD) | |
| 2 | CD Q2 | Does the leader see who the admin is on the call? Nothing vs name vs avatar vs "Replant team member" | Nothing (CD; leak-free + symmetric) | |
| 3 | CD Q3 | Surface the call channel? Plain phone vs in-app voice vs dialed-number link | Plain phone, no channel UI (CD) | |
| 4 | CD Q4 | Duress reminder cadence — taught-once-in-briefing-only vs coded-jog-every-call | Coded jog every call (CD) | |
| 5 | CD Q5 | Reversibility asymmetry — does the in-flow allow Visible → Hidden self-initiate? Onboarding makes that admin-only | Same flow both directions (CD; both behind the same call) | |
| 6 | Panel | Token length — 4 digits (current admin code) vs 6 (panel recommended) | Founder ratified **4 digits** during prior conversation; preserved in the locked endgame | LOCKED |
| 7 | Panel | Duress code communication — two codes side-by-side vs social convention (reverse the digits) vs hidden gesture | Founder ratified **social convention (b)** — invisible to room observer; reverse-digit submission detected server-side | LOCKED |

---

## CD deliverable summary (paste-ready)

- **Path:** `/Users/ife/replant/docs/design_handoff_visibility_change_flow/`
- **Source-of-truth:** `preview/index.html` — open in browser, walk the View-as toggles
- **Sources to lift:** all 6 `.tsx` files in `source/`
- **Locked endgame copy:** *"Your church now shows in the network."* / *"You're now hidden in the network."* — verbatim, roman (NOT italic)
- **Voice ruling honored** per `[[feedback-replant-admin-copy-voice]]`: banned vocabulary includes "TOTP", "token", "AAL2", "duress" (in user-facing copy)
- **Italic reserved for scripture only** per `[[typography-ruling]]` — even though the brief quotes endgame in italics, render roman
- **Mobile placement:** `SettingsScreen` → Church section → `ChurchVisibilityRow`. UG-only — render nothing for regular churches.
- **State machine:** `pending → revealed → in_call → validated | expired | failed`

CD's README is comprehensive; quote it during implementation discussions if anyone questions a design choice.

---

## Memory files to read first (next session)

**Load-bearing, every session:**
- `[[replant-continuous-spec]]` — running spec, last updated 2026-06-27 evening with the full Option C+ summary at top

**Critical for KAN-274 work specifically:**
- `[[locked-tiered-mfa-freshness]]` — per-endpoint tier table
- `[[feedback-replant-admin-copy-voice]]` — voice ruling
- `[[typography-ruling]]` — italic reserved for scripture
- `[[feedback-underground-no-location-constraint]]` — underground location rules
- `[[feedback-underground-vs-anonymous-independent-axes]]` — `users.anonymous` ≠ `churches.type='underground'`

**New rulings locked this past session:**
- `[[locked-tiered-mfa-freshness]]` — the 4-tier table
- `[[feedback-push-implies-pr]]` — "push" includes opening the PR
- `[[feedback-propagate-to-sister-actions]]` — when changing one action, consider/ask about its twin
- `[[feedback-preview-first-deploy]]` — preview→smoke→merge=prod cadence
- `[[feedback-dont-default-to-mvp]]` — right-the-first-time framing
- `[[cd-only-doesnt-see-memory]]` — in-workspace agents have memory access; only CD is external
- `[[paste-ready-artifacts-to-file]]` — CD briefs go to `.claude/plans/` `.md` files
- `[[feedback-dont-speculate-ship]]` — updated with web admin addendum

---

## Pickup order recommendation

1. **Open `/Users/ife/replant/docs/design_handoff_visibility_change_flow/preview/index.html`** in a browser — get the visual + interaction model into your head before reading anything else.
2. **Ratify the 7 open Qs above** with Founder. CD work doesn't start without ratification.
3. **Dispatch DBA** for the relay-token-mint table migration (KAN-274 dependency #1) — schema design + backfill plan. Inline-quote the locked panel decisions in the prompt.
4. **Parallel: file the KAN-273 DBA trigger investigation** — that work is independent.
5. **Once DBA migration is locked, dispatch BE** for the four new Netlify functions + the admin retrofit.
6. **Lift CD's mobile scaffolds verbatim** into the mobile repo. Wire the AuthProvider state + RootNavigator + screen-capture/secure-store calls.
7. **End-to-end smoke**: leader app + admin dashboard simultaneously, full flip per direction. Verify duress channel via reversed-digit submission.
8. **THEN address KAN-271 + KAN-272** with their own dispatches (independent of KAN-274; can be parallel).

---

## Process notes for the new session

- Open with prayer per `CLAUDE.md` hard rule — name the visibility-change build + the underground leaders whose anti-coercion gate this is.
- Per `[[feedback-preview-first-deploy]]`: replant-admin work goes preview → Founder smokes → SHE merges. Do not push to main yourself.
- Per `[[feedback-paste-ready-artifacts-to-file]]`: handoffs and CD briefs go to `.md` files under `.claude/plans/`, not chat dumps.
- Per `[[feedback-cd-is-not-agent-paste-only]]`: do NOT dispatch CD as an Agent. If new CD work is needed (e.g., admin-side visibility detail card if the panel decides one is required), draft a CD brief in `/Users/ife/replant/.claude/plans/cd-prompt-*.md` for Founder to paste.
- Per `[[feedback-dont-speculate-ship]]`: investigate first. The KAN-274 misframe in the prior session happened because I didn't ground the panel prompt in `VisibilityOverrideModal.jsx`'s file comments. Don't repeat.
- Per `[[feedback-propagate-to-sister-actions]]`: when changing the relay-token system, consider impact on sister actions (rotate_join_code, visibility_override counter, etc.).

---

## End-of-session state (2026-06-27)

- ✅ Production deploy live on `admin.projectreplant.org`
- ✅ All 30 in-session tasks completed (per task list)
- ✅ KAN-271 / 272 / 273 / 274 all filed with detailed RFCs
- ✅ CD delivered for KAN-274 (6 surfaces ready to lift)
- ✅ Memory updated through end-of-session: `replant_continuous_spec.md` + 8 new/updated feedback files
- ⏳ 7 open Founder ratifications waiting (5 CD + 2 panel-residual)
- ⏳ KAN-271 DBA dispatch pending
- ⏳ KAN-272 spike pending
- ⏳ KAN-273 DBA trigger investigation pending
- ⏳ KAN-274 mobile + BE + DBA implementation pending Founder ratifications

In Jesus' name, Amen.
