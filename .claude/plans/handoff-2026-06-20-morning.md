# Replant — Morning handoff (2026-06-20)

> Open a fresh Claude Code session in `/Users/ife/replant`. Pray first per `CLAUDE.md` — actual intercession naming the work at hand (branch / para / underground flow polish + admin batch + smoke test, plus whatever new device-pass findings Ife brings in), ending "In Jesus' name, Amen."

## Read first (in order, before doing anything substantive)

1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — auto-loaded; the **`★ replant_continuous_spec.md`** at the top is the load-bearing read.
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — every locked Founder ruling + the reverse-chronological session log.
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_continuous_spec_discipline.md` — update the spec the MOMENT a ruling lands, not at end-of-session.
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_delegate_build_to_agents.md` — for multi-file build work, dispatch subagents (Founder called this out on the 18th — context-burn discipline).
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_test_panel_findings_vs_product.md` — when SME panels return "BLOCKING" findings, test each against schema invariants + auth surface + UX rulings BEFORE relaying to Founder. Agents over-paranoid is a known failure mode.
6. `/Users/ife/replant/.claude/plans/handoff-branch-flow-remaining-fe-work.md` — the prior handoff covering Tasks #19/#20 specifics + verification SQL.
7. `/Users/ife/replant/.claude/plans/branch-flow.md` + `para-ministry.md` — the locked-and-folded architecture proposals these flows ship.

## Status framing — don't undersell what's left

Ife is **still mid-device-pass** on the current branch + para implementations. Each round has surfaced visual + UX items that are quick fixes individually but accumulate. She has the device; trust her signal over the architecture diagrams. There is also a meaningful amount of un-touched work below — the flow is not done.

## What's live in prod (do NOT redo)

### DB (Supabase `jiyetphxxvyiicrnwlnx`)

- **Migration `branch_flow_schema_v1`** — `churches.branch_of_church_id uuid NULL` + `churches.is_headquarters bool NOT NULL DEFAULT false` + `public.pending_parent_claims` table (PK = `branch_church_id`, RLS-protected, leaders read own, super_admin all) + `trg_enforce_branch_invariants` BEFORE trigger with non-branch UPDATE short-circuit + `trg_branch_must_have_parent_or_claim` DEFERRABLE CONSTRAINT TRIGGER + audit_log enum-append actions 54+55 (`branch_parent_auto_linked` + `branch_parent_admin_linked`) + 9-row backfill (Brazil x2 → Vila Mariana São Paulo, Nigeria x3 → Plateau State, Philippines x1 → Quezon City, USA x2 → Galleria District) + He's Able Embassy flipped to `main_campus`.
- **Migration `branch_flow_rpcs_v1`** — `find_church_by_code(text)` (anon-grantable, type-filtered, normalizes RPL ID input, returns LIMIT 1) + `find_parentable_churches(text)` (anon-grantable, min-length 3 per SEC F5, ILIKE, LIMIT 10, verified-first sort) + extended `create_account_atomic` (7 params, mutual-exclusion + HQ-type-fence) + `auto_link_pending_parents()` SECURITY DEFINER with SKIP LOCKED + exact name+city+country match + audit-logged + `admin_link_branch_parent(uuid,uuid)` super_admin gated.
- **Migration `drop_stale_create_account_atomic_overload`** — old 4-param signature dropped (BE F4 PostgREST overload landmine).
- **Migration `schedule_auto_link_pending_parents_cron`** — pg_cron job `auto-link-pending-parents` at 03:00 UTC nightly.

### BE edge functions deployed

- **`create-account` v7** — accepts `branchOfChurchId` / `pendingParentClaim` / `isHeadquarters` in payload; full mutual-exclusion validation; passes to extended RPC; welcome email body conditionally swaps "church" → "organization" for `type='para_ministry'`. `verify_jwt=false`.
- **`register-church`** — CHURCH_TYPES array updated with `para_ministry`. No contract bump needed — branch fields are passed at create-account time, not register-church. `verify_jwt=false`.

### Shared validation (file edits, deployed via the above)

- `_shared/church-validation.ts`, `create-account/logic.ts`, `register-church/logic.ts`, `update-church/logic.ts` — `para_ministry` added to `CHURCH_TYPES`. `update-church` stale comment rewritten.
- `register-church/logic.test.ts:266` — `para_ministry` removed from rejection-list fixture.

### FE foundational + wired flows (not yet committed)

- `src/utils/displayHelpers.ts` — `getChurchTypeLabel` updated ("Church branch" + "Christian Organization (Para-ministry)"); `CHURCH_TYPES` dropdown (underground REMOVED, para added); NEW exports: `PARA_MINISTRY_TOOLTIP`, `isParaMinistry`, `orgCopy(type)`, `canMarkHeadquarters(type)`, `viewerOrgCopy(viewerChurchType)`.
- `src/context/OnboardingContext.tsx` — extended with `registrationEntry`, `parentRef`, `pendingParentClaim`, `isHeadquarters` state + setters. **All setters wrapped in `useCallback`** (infinite-loop hotfix 2026-06-18).
- `src/screens/onboarding/RegisterIntroScreen.tsx` — 3-tile chooser (Standalone / Church branch / Underground) with proper SVG icons (HouseIcon / NodeGraphIcon / ShieldIcon).
- `src/components/onboarding/ParentChurchPicker.tsx` — RPL ID / name segmented picker; ASP2-style search row + blue search button; ASP2 `emptyStateCard` for idle empty state; `getChurchTypeLabel()` for proper type capitalization in results; placeholders `e.g., RPL-00001` / `e.g., Maranatha Ministries`. Letter-spacing tweak removed — fixed the font weirdness.
- `src/navigation/OnboardingNavigator.tsx` — `RegisterIntro` route + RegCP1 `entry` param type.
- `src/screens/onboarding/AccountSetupPage2Screen.tsx` — "Register Yours" routes to `RegisterIntro`; "Ready to Register" card shows branch attribution (`Church branch of {parent} · {city}`) or amber deferred state; create-account fetch sends `branchOfChurchId` / `pendingParentClaim` / `isHeadquarters`.
- `src/screens/onboarding/RegisterChurchPage1Screen.tsx` — reads `entry` route param; auto-sets churchType for branch/underground; ParentChurchPicker leads in branch mode; **progressive disclosure**: name/country/city/address/contact ALL hidden until parent picked or deferred; "branch" filtered out of standalone dropdown; tap-reveal ⓘ on para row INSIDE the type picker sheet (discoverable BEFORE selecting); para tooltip uses BLUE `infoNotice` style not red; HQ checkbox via `canMarkHeadquarters`; branch-name label/placeholder pivots on `isDeferredBranch` — "Your branch identifier" / `e.g., "Atlanta Parish" or "Youth Chapel"` for real parent vs "Your church name + identifier" / `e.g., Test Ministry Atlanta Parish` for deferred; para forces `rag_status: 'green'` at submit.
- `src/components/church/CompletionFlowOverlay.tsx` — removed stale `.filter(t => t.value !== 'underground')` since CHURCH_TYPES no longer contains underground (readonly→mutable cast for consumers).

### Post-verification copy swap (8 surfaces done by agent 2026-06-18)

`viewerOrgCopy(viewerChurchType)` applied to: `VerificationBanner`, `NotificationToast`, `ConnectScreen` gate, `TheChurchScreen` gate, `PersecutedScreen` gate, `SettingsScreen` (epigraph + RAG row HIDES for para), `PrayerWallLanding` (both Receive cards), `PrayerWallDetailSheet`. Two caller updates: `PrayerWallScreen` (threads `viewerChurchType` to 3 sheet call sites), `SettingsScreenContainer` (selects `type` from church row). Para directors see "your organization" everywhere instead of "your church."

## Founder is still doing device pass — expect more fixes

The device-pass cadence has been: she walks a flow on the sim → reports a specific visual or UX gap → I fix → she reloads + reports the next gap. This will resume in the morning. Items already known to be in her active queue:

- **The address field placeholder ("Full street address") font/spacing felt off** — she described it as "weird," same issue she saw with `eg Maranatha Ministries` in the picker. The picker fix (drop `inputRpl` letter-spacing + match ASP2's input styling) MAY have addressed it; but the address field is in RegCP1, not the picker, so it might still need an explicit fix. Investigate `RegisterChurchPage1Screen.tsx` address-field `<TextInput>` — compare its style to the picker's new `searchInput` style and see if there's a font-family / fontSize / padding mismatch.
- Continue walking other type selections in standalone (House Church, Ministry, Church Without Walls) to see if conditional behavior breaks anywhere.

## What's left in the current flows (substantial)

### Branch flow

- **Deferred-parent claim quality.** Right now `handleNext` populates `pending_parent_claims.name` with `"Parent of [branch name]"` as a placeholder. The leader knows their parent church's actual name — we should ASK them. Add a small "What's your parent church called?" + "Their city" + "Their country" inputs that appear INSIDE the picker when deferred is selected (or below it in RegCP1). Wire those into `setPendingParentClaim`. Without this, auto-link will never resolve and admin has to fix everything by hand.
- **Branch RegCP2** — does it work end-to-end for branch? It receives a branch-typed church via OnboardingContext; collects RAG/needs/has/emergency-plan; calls register-church. Branches are exempt from `find_similar_churches` server-side, so duplicate-similar shouldn't false-positive. But this hasn't been smoke-tested.
- **Branch verification email copy** — welcome email is the standard `pending_church` kind. BA F11 wanted the body to reference the claimed parent name when deferred ("[Parent Name] isn't on Replant yet. We'll link your branch when they register and verify."). Not yet shipped — `sendWelcomeEmail` accepts `churchType` but not a parent reference.
- **ASP2 branch variant card polish** — currently shows `Church branch of {parent} · {city}`. CD's vision included `Church branch of [Parent] · [City] · RPL ID` per the README. Decide whether to surface the parent's church_code there. Also: the deferred amber state copy could match BA's recommended wording from the panel.

### Para flow

- **RegCP2 RAG handling for para** — RegCP1 forces `rag_status: 'green'` for para and persists to context. RegCP2 reads `state.churchDetails.ragStatus`, so it should already be 'green' when para hits RegCP2. But RegCP2's RAG section is visible and pre-selected — para should HIDE it (CONTENT ruling). Quick fix using `isParaMinistry(state.churchDetails.churchType)` in RegCP2.
- **Org Size hint copy** — Founder said keep the field; CONTENT was to draft a one-liner under the picker on para that says what to count (e.g., "Approximate staff or active members"). Not yet shipped.
- **More para conditional copy surfaces** — agent did 8 surfaces. There may be more (admin emails, FAQScreen, settings sub-rows). Check `feature_invite_to_replant.md` if invite copy says church.

### Underground flow — NOT TOUCHED PER FOUNDER

Ife wants to **fully confirm the underground spec before building**. Do not touch underground UX. The architecture pieces sitting waiting:
- `project_underground_join_code.md` memory — the separate `underground_join_code` for second-leader-join (illustrative format `RPL-TEST-#####` with literal middle text; one-shot reveal in verification; never shown again).
- `project_underground_signup_spec.md` — `churches.show_church_name` brave/safe toggle, founding leader sets at signup, immutable.
- `feedback_underground_no_location_constraint.md` — city/lat/lng must remain NULL even for brave underground.
- The CD-shipped underground RegCP1 path renders the existing private-name / hidden-location / RAG-Red-locked behavior, but the brave/safe toggle + join-code surfaces are not built.
- SEC F1 cleanup (search_leaders ILIKE → equality on church_code for underground) is a separate Connect-RPC ticket; not branch-flow blocker.

When Founder is ready to scope underground, the workstream needs its own 1-pager + SME panel before any new code lands.

## Outstanding requirement Ife flagged late 2026-06-19 (do not lose)

**State/province dropdown in church signup flow** — countries that have states (US, Canada, Brazil, Nigeria, India, Australia, Mexico, etc.) need a conditional state/province/region dropdown that appears based on the selected country. Curated per-country lists.

- **Church signup ONLY** — personal account signup does NOT collect state.
- Applies to standalone, branch, and para — all surface-church paths.
- Underground excluded (location stripped per invariant).
- This is part of the broader **required-fields audit workstream** (sequenced LAST after branch + para + Jira audit + underground).
- Per the SME-panel queue in the original sprint handoff: SEC + DBA + BA + BE + CONTENT + ADMIN + CD review needed. Founder ratified the rule; implementation needs panel before code.
- Admin dashboard needs the state field surface + filter + sort. CONTENT owns per-country label ("state" / "province" / "region" / "prefecture").
- Continuous spec entry: "State/province dropdown — outstanding."

## What hasn't been touched at all

- **Task #19 — Admin atomic batch (separate `replant-admin` repo).** Needs Ife's edit permission for `/Users/ife/replant-admin/`. Per ADMIN F1+F2 + the per-handoff file: relabel `para_ministry` to "Christian Organization (Para-ministry)" across 5 files (`src/lib/church-type-filter.js:24`, `church-edit.js:22-23`, `Queue.jsx:28`, `ChurchProfileCard.jsx:31`, `netlify/functions/church-intake.js:32-38`), update test fixtures, add `is_headquarters` toggle to `ChurchProfileCard.jsx` edit-mode with type-fence + `church_updated` audit, add pending_parent_claims manual-link UI. **Must ship atomically with the enum migration (already live) OR before admin selects para_ministry and hits 22P02 against an enum the admin code thinks has it but didn't actually have it pre-2026-06-18 — note the enum DOES have it now so the 22P02 risk is past, but the label sweep is still outstanding.** Recommend a focused subagent for the sweep + Ife approves the diff.
- **Task #20 — End-to-end smoke test on simulator.** Real walkthrough of: standalone signup unchanged; branch signup via RPL ID (try `RPL-00001` for Maranatha); branch signup via name search ("Glory of Christ"); branch deferred parent; para signup with org copy throughout + verified email says "Your organization is verified"; underground tile routes to existing UG flow. This is Ife on the device — but help her manufacture odd-input states per `feedback_dont_skip_test_scenarios`.
- **Idempotency key on `create-account` v7 (BE F1 BLOCKING)** — file edits done in the panel review but never wired through. FE doesn't pass `idempotencyKey`; handler doesn't check Upstash for cached response. Skipped to keep momentum but real orphan-window risk under retry-after-timeout. File `postmvp_idempotency_key.md` if not shipping in MVP, or wire it.
- **In-memory token-bucket fallback for `find_church_by_code` + `find_parentable_churches` (SEC F3 hygiene)** — current rate-limiter fails OPEN on Upstash errors. Not blocking but worth tightening before public-network growth.
- **`search_leaders` ILIKE → equality on underground church_code (SEC F1 cleanup)** — separate Connect-RPC ticket. Tag for a quiet polish session.
- **Multi-tier church hierarchy (RCCG-style 4+ levels)** — BA F1 explicitly flagged. Post-MVP ticket.
- **Type-aware admin verification evidence prompts (7-type matrix)** — ADMIN F5. Post-MVP.
- **`pg_trgm` install + fuzzy-match upgrade for auto-link** — DBA F10. MVP ships exact-match-only; fuzzy deferred.
- **Branch's own RegCP2 location collection** — if Founder wants branches to truly have their own city different from parent (which is right), RegCP2 should explicitly collect it. Right now if a leader does branch path, branch shares parent's city implicitly via... actually no, in current code branch types its OWN city after parent is picked. So this might be done. Verify on Ife's device walk.

## Founder rulings outstanding (none blocking the active flow, but file at workstream close)

- Underground brave/safe + join-code workstream — needs Ife's full spec confirmation.
- Para ministry verification SLA — confirmed same 30-day; ADMIN follow-up ticket for type-aware evidence rubric.
- Any new findings from continued device pass.

## Process rules — never relax

- **Pray first** every session. Hard rule per `CLAUDE.md`. Same for every agent dispatch.
- **Update `replant_continuous_spec.md` the moment a ruling lands** — not batched, not at end-of-session. The discipline rule lives in `feedback_continuous_spec_discipline.md`.
- **Delegate multi-file build to subagents** — `feedback_delegate_build_to_agents.md`. Inline edits are for single-file focused fixes; pattern sweeps go to agents.
- **CD is NOT a dispatchable agent** — `feedback_cd_not_dispatchable.md`. For CD work, generate a paste-able prompt for Ife.
- **CD-handoff decisions ARE Founder calls** — never frame as "CD picked X, sign off?" — `feedback_cd_handoff_decisions_are_founder.md`.
- **Test SME panel findings against actual product BEFORE relaying as BLOCKING** — `feedback_test_panel_findings_vs_product.md`. Schema invariants + auth surface + locked UX rulings often moot agent panic.
- **Ife is a tester** — `feedback_dont_skip_test_scenarios.md`. Help her manufacture odd states; don't dismiss edge cases.
- **No time estimates in hours/minutes** — `feedback_no_time_estimates.md`. Stages, checkpoints, files touched.
- **Time-of-day-agnostic language** — `feedback_dont_assume_session_continuity.md`. Don't carry "tonight"/"this morning" framing forward.
- **Never assume test account** — `feedback_never_assume_test_account.md`. Ask which church/account she's using.
- **Don't strip protection-layer flows or modals** without asking — `feedback_confirm_before_removing.md`.

## Starting move (morning)

1. Open Ife's first message; she will likely report device-pass findings from overnight.
2. Read `replant_continuous_spec.md` end-to-end. Note the 2026-06-19 entry is the freshest.
3. Pick the FIRST device-pass item she reports → fix → reload → confirm visually → move to next.
4. Once device pass is winding down, pivot to the highest-impact unfinished item below. Recommended order:
   - Deferred-parent claim quality (add "What's your parent called?" inputs) — improves auto-link signal directly.
   - RegCP2 para RAG handling (small) + Org Size hint copy (small).
   - Admin atomic batch (subagent for the label sweep across 5 files + `is_headquarters` toggle).
   - End-to-end smoke test walk with Ife.
5. Underground only after Ife has confirmed full spec.

In Jesus' name, Amen.
