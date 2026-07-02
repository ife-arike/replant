# Replant — Morning handoff (2026-06-22)

> Open a fresh Claude Code session in `/Users/ife/replant`. Pray first per `CLAUDE.md` — actual intercession naming the work at hand (the persecuted Church the underground build serves, the leaders walking deferred parent paths, the para-ministry directors waiting on verification, every leader Ife will touch through Replant). End "In Jesus' name, Amen."

## Read first (in order)

1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — auto-loaded; the **`★ replant_continuous_spec.md`** at the top is load-bearing.
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — end-to-end. Every locked Founder ruling + the reverse-chronological log. Yesterday's underground Church-tab work is at the top.
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_underground_protection_focus.md` — Founder's posture for underground work: **architectural protection over copy fingerprint paranoia**. Future SME panels need to be briefed with this distinction. The panel that ran 2026-06-21 over-rotated; Founder explicitly rejected several "fingerprint" recommendations. Don't repeat.
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_underground_vs_anonymous_independent_axes.md` — two orthogonal masking axes; the JOIN-bug pattern that bit us before.
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_continuous_spec_discipline.md` — update the spec the MOMENT a ruling lands.
6. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_delegate_build_to_agents.md` — multi-file build work goes to subagents; inline edits for single-file focused fixes only.
7. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_test_panel_findings_vs_product.md` — test SME findings against actual product before treating as blocking.
8. Previous handoff: `/Users/ife/replant/.claude/plans/handoff-2026-06-20-morning.md` for the branch/para context that fed into the underground sprint.

## Status framing — where we are in the sprint

**Underground + branch + para foundational work is shipped.** Branch flow + para-ministry are fully wired end-to-end; underground flow is fully wired end-to-end including the Church-tab protection that landed 2026-06-21. Ife will continue device-walk and surface gaps as she finds them — that's the default mode.

**Two paths Ife may pick from in the morning:**
- (a) Continue device-walking the underground flow + branch + para + the new Church-tab CAL-only surface for underground. Highest-value catches happen on her device.
- (b) Pick up an unfinished workstream from the pending list below.

Default to (a) unless she signals otherwise.

## What's live in prod (do NOT redo)

### DB migrations (Supabase `jiyetphxxvyiicrnwlnx`)

Recent (2026-06-21):
- `get_church_tab_underground_viewer_v1` — new RPC, no coord inputs, surface dots + underground count.
- `get_comments_fix_author_id_join` — corrected JOIN from `au.auth_id = c.author_id` to `au.id = c.author_id`. Long-standing bug; every commenter was rendering as "A fellow leader" for ~3 weeks of UAT before Founder caught it.
- `decouple_underground_from_anonymous_v1` + `v2_church_read_path` — `get_comments` gates `author_name` on `users.anonymous` (read live), `church_name` on live `churches.type` + `show_church_name` (not write-time `mask_reason` tag).
- `underground_safety_hardening_v1` — `show_church_name` DEFAULT flip to `false`, `get_intercession_holds` mask, `get_invite_candidates` exclude underground, `search_leaders` mask full_name for safe underground, `get_comments` `COALESCE` flip.
- `underground_join_code_v1` (2026-06-20) — schema + `audit_log_underground` separate table + RLS + 4 SECURITY DEFINER RPCs (`reveal_underground_join_code`, `rotate_underground_join_code`, `redeem_underground_join_code`, helpers). `users.is_underground_admin` flag added.

Earlier in the sprint:
- `branch_flow_schema_v1` + `branch_flow_rpcs_v1` + `drop_stale_create_account_atomic_overload` + `schedule_auto_link_pending_parents_cron`.
- Para enum value added + branch trigger + 9-row backfill (Brazil x2, Nigeria x3, Philippines x1, USA x2 + He's Able Embassy flipped to main_campus).

### BE edge functions deployed

| Function | Version | verify_jwt | Notes |
|---|---|---|---|
| `create-account` | v8 | false | atomic create + branch + para + underground; idempotency required; underground welcome-email kind generic body |
| `register-church` | v8 | false | CHURCH_TYPES updated; branch exempt from duplicate-similar |
| `auth-status-check` | v8 | true | `underground_join_code_pending_reveal` field added |
| `join-underground-church` | v2 | false | NEW. Body `{ idempotencyKey, joinCode, leader }`. Single generic error for code failures; distinct `email_already_registered` error per Founder override of #4 for email-collision |
| `reveal-join-code` | v1 | true | NEW. Lightweight wrapper around `reveal_underground_join_code` RPC. Tombstone-only idempotency cache (never caches plaintext) |
| `get-nearby-churches` | v6 | **true** (live) — see DRIFT note in continuous spec | 403 for underground callers; defensive predicate on own-church inject |

**Known drift to resolve:** `get-nearby-churches/config.toml` says `verify_jwt = false` with careful rationale comments; live is `true`. Either revert live or update local. One-liner. Detailed in continuous spec under "Known follow-up." Founder rule needed.

### FE work shipped this sprint

Foundational:
- `displayHelpers.ts` — new `CHURCH_TYPES` labels, `orgCopy` (extends to 5+ keys per CONTENT F7), `viewerOrgCopy`, `canMarkHeadquarters`, `isParaMinistry`, `PARA_MINISTRY_TOOLTIP`, `getRoleLabel`.
- `OnboardingContext` — extended with `registrationEntry`, `parentRef`, `pendingParentClaim`, `isHeadquarters`, `churchDetails.showChurchName`, idempotency-key. **All setters wrapped in `useCallback`** (infinite-loop hotfix 2026-06-18).
- `useChurchesGlobal` — `ViewerContext` extended with `viewerChurchType`; routes underground viewers to the new coord-free RPC.

New screens:
- `RegisterIntroScreen.tsx` — 3-tile chooser (Standalone / Church branch / Underground) with proper SVG icons.
- `UndergroundEntryScreen.tsx` — nested secondary chooser under Underground tile (Register new / Join with code).
- `NameVisibilityChoiceScreen.tsx` — "Show our name" / "Keep our name hidden" with irreversible-commit modal for brave.
- `JoinByCodeScreen.tsx` — second-leader code entry; segmented cells; single generic error for code failures.
- `JoinCodeRevealScreen.tsx` — 3-stage flow (gate / shown / consumed); iOS screenshot detection; Android FLAG_SECURE; MFA leverage prompt placeholder.
- `UndergroundCodeReadyPrompt.tsx` — Home tab generic-chrome prompt routing to JoinCodeReveal when `underground_join_code_pending_reveal=true`.
- `ParentChurchPicker.tsx` — RPL ID / name segmented picker; deferred path supported.

Edited:
- `RegisterChurchPage1Screen.tsx` — entry-mode aware; underground RAG-Red lock + soft-blue note; underground optional needs/share section; HQ checkbox via `canMarkHeadquarters`; branch-name label/placeholder pivots on `isDeferredBranch`; same-as-my-info checkbox hydrates from churchDetails on Edit.
- `RegisterChurchPage2Screen.tsx` — para handling.
- `AccountSetupPage1Screen.tsx` — KAV dropped; idempotency-key wiring; "this would be your login email" framing.
- `AccountSetupPage2Screen.tsx` — branch attribution surfaced on bypass card; deferred-parent amber state; underground reassurance note (safe vs brave variants) below bypass card; underground Edit preserves entry mode.
- `TheChurchScreen.tsx` — CAL-only for underground viewers; horizon switcher suppressed; tutorial early-exits; gate copy unified.
- `CamlView.tsx` — early-return for underground viewers BEFORE any hook fires.
- `ConnectScreen.tsx` — gate copy unified.
- `ChurchProfileBottomSheet.tsx` — "Name withheld" → "A fellow {role}".
- `CommentThread.tsx`, `NetworkFeed.tsx`, `TestimonyCard.tsx`, `PrayerWallLanding.tsx`, `EncouragementCard.tsx` — anon ≠ underground decoupling sweep.
- `VerificationBanner.tsx` — "The Replant team is praying with you and reviewing carefully."

Plus a comprehensive 8-surface post-verification copy swap via `viewerOrgCopy()` from earlier in the sprint (VerificationBanner / NotificationToast / Connect gate / Church gate / Persecuted gate / Settings / PrayerWallLanding / PrayerWallDetailSheet).

## Pending workstreams (in priority order)

### 🚨 URGENT — admin.projectreplant.org "Invalid or expired token" across all queue pages (2026-06-21 EOD)

Ife reported live admin dashboard is broken — 5 pages (Verification Queue / Flagged Messages / Pastoral / Heartcry Inbox / Underground Oversight) all show "Invalid or expired token" inline. The page chrome + count badges render (e.g. "0 pending", "0 open", "0 records" in top right) but the LIST queries fail. She tried sign-out/sign-in; still broken.

**Most likely diagnosis:** AAL2 step-up reauth is required for the elevated list queries — per `reference_ops_docs.md`, KAN-97 added `admin_aal2_elevation` audit action. Plain sign-out/sign-in only refreshes AAL1; the step-up needs the explicit elevation flow.

**Two backup hypotheses:**
- **JWT_SECRET rotation aftershock** — secret was rotated 2026-06-14 per `feedback_dont_pull_netlify_env_vars_via_mcp.md`. If admin Netlify functions still have the old secret, every JWT they verify surfaces as "Invalid or expired token." Check Netlify env vars at `admin.projectreplant.org` site config (via dashboard UI, NOT via MCP — see the memory).
- **Service-role key staleness** — same story for any service-role key used by admin queue Netlify functions.

**Next session must:**
1. Get `replant-admin` repo edit access from Founder (task #19 / #32 was already blocked on this).
2. Investigate admin auth flow in `/Users/ife/replant-admin/`:
   - Look for AAL2 elevation entry point (probably `netlify/functions/admin-step-up-*` or similar).
   - Check JWT verification logic in queue Netlify functions vs the secret currently in Netlify env.
   - Verify the count endpoint (which works) vs list endpoint (which fails) — what differs in their auth?
3. If AAL2 elevation flow exists but isn't being triggered, the FE needs a step-up prompt. If it doesn't exist, the JWT_SECRET / service-role drift theory is the next candidate.
4. Note: ALL real verification work (verifying churches, leaders, processing flagged messages, pastoral signals, heartcries) is BLOCKED until this is fixed. If Ife has pending UAT signups (branch / para / underground) waiting on verification, this is the launch-critical item.

### Task #19 + #32 — Admin atomic batch + underground admin queue (`/Users/ife/replant-admin/`)

**Blocked on edit permission for `/Users/ife/replant-admin/`.** Founder needs to grant the next session permission to write to that directory.

Scope when permission is granted:
- Relabel `para_ministry` to "Christian Organization (Para-ministry)" across 5 files (`src/lib/church-type-filter.js`, `church-edit.js`, `Queue.jsx`, `ChurchProfileCard.jsx`, `netlify/functions/church-intake.js`).
- Update test fixtures.
- Add `is_headquarters` toggle to `ChurchProfileCard.jsx` edit mode with type-fence + `church_updated` audit.
- Build the underground admin queue (BA + ADMIN both said this BLOCKS launch otherwise — no admin can see underground signups today): `PendingUndergroundQueue.jsx` behind AAL2 + `is_underground_admin` flag; underground-variant `ChurchProfileCard`; verify / reject / request-info action bar with rejection-reason enum; two-eyes modal; join-code panel (read state / re-reveal / rotate); admin notes; deactivation flow; SLA monitoring banner.
- pending_parent_claims manual-link UI for the deferred-parent flow.

Dispatch a subagent for the label sweep; Founder approves the admin-queue design choices since they shape the verification operating model. Reference `underground-flow.md` for the locked rulings, especially #22-#26.

### Task #20 — End-to-end smoke test on simulator

Real walkthrough with Ife as tester, prompting odd-input scenarios:
- Standalone signup unchanged.
- Branch signup via RPL ID (Maranatha = `RPL-00001`).
- Branch signup via name search.
- Branch deferred parent (Parent not on Replant yet) — confirm nightly `auto_link_pending_parents` will resolve when parent registers.
- Para signup with "Organization" copy throughout + verified email says "Your organization is verified."
- Underground founder signup via the 3-tile chooser → nested chooser → underground RegCP1 → NameVisibilityChoice → ASP2 with reassurance note → Enter Replant. Verify show_church_name=false on the DB row.
- Underground brave-mode founder signup → NameVisibilityChoice "Show our name" → irreversible-commit modal → submit.
- Underground second-leader join via code (manually generate one via `reveal_underground_join_code` super_admin RPC for testing).
- Underground viewer Church tab — confirm CAL only, no horizon switcher, no GPS prompt, no Mapbox calls.
- Comment thread — confirm named leaders show real names, anon leaders show "A fellow {role}."

Use `feedback_dont_skip_test_scenarios` posture — every odd-input scenario gets walked.

### Smaller follow-ups + hygiene

- `get-nearby-churches/config.toml` `verify_jwt` drift — Founder rule needed: revert live to `false` (matches local + documented intent) OR update local to `true` (accept drift, defense-in-depth at platform level).
- Idempotency key on `create-account` v7 (BE F1 historical) — wired through everywhere now; smoke-test confirms.
- In-memory token-bucket fallback for `find_church_by_code` + `find_parentable_churches` (SEC F3 hygiene from earlier sprint) — Upstash fails OPEN currently for those anon RPCs. Not blocking; worth tightening before public-network growth.
- `search_leaders` ILIKE substring → equality on underground `church_code` (SEC F1 from earlier sprint) — Connect-RPC cleanup; tag for a quiet polish session.
- Multi-tier church hierarchy (RCCG-style 4+ levels) — BA F1 explicitly post-MVP.
- Type-aware admin verification evidence prompts (7-type matrix) — ADMIN F5 post-MVP.
- `pg_trgm` install + fuzzy-match upgrade for auto-link — DBA F10 post-MVP.
- Post-MVP toggle for underground churches that want to be visible on CAML (Founder 2026-06-21 ruling — file when sprint closes).
- Underground viewer tutorial design — post-MVP.

## Process rules — never relax

- **Pray first** every session, every agent dispatch. Hard rule per CLAUDE.md.
- **Update `replant_continuous_spec.md` the moment a ruling lands** — `feedback_continuous_spec_discipline.md`.
- **Delegate multi-file build to subagents** — `feedback_delegate_build_to_agents.md`.
- **CD is NOT a dispatchable agent** — `feedback_cd_not_dispatchable.md`. For CD work, generate paste-able prompt for Ife.
- **CD-handoff decisions ARE Founder calls** — never frame as "CD picked X, sign off?" — `feedback_cd_handoff_decisions_are_founder.md`.
- **Test SME panel findings against actual product BEFORE relaying as BLOCKING** — `feedback_test_panel_findings_vs_product.md`. Schema invariants + auth surface + locked UX rulings often moot agent panic.
- **Don't over-rotate on underground copy fingerprint paranoia** — `feedback_underground_protection_focus.md`. Founder wants architectural protection (location truly unrecoverable, identity truly masked, data exfiltration truly impossible). Honor underground leaders in surface; protect at layer.
- **Underground ≠ anonymous** — `feedback_underground_vs_anonymous_independent_axes.md`. Two orthogonal masking axes. Never conflate. JOIN comment-RPCs on `au.id = c.author_id` (PK), NEVER `auth_id`.
- **Ife is a tester** — `feedback_dont_skip_test_scenarios.md`. Help her manufacture odd states.
- **No time estimates in hours/minutes** — `feedback_no_time_estimates.md`.
- **Time-of-day-agnostic language** — `feedback_dont_assume_session_continuity.md`.
- **Never assume test account** — `feedback_never_assume_test_account.md`.
- **Don't strip protection-layer flows or modals without asking** — `feedback_confirm_before_removing.md`.
- **Don't pull Netlify env vars via MCP** — `feedback_dont_pull_netlify_env_vars_via_mcp.md`.
- **Append-only audit_log** — `feedback_audit_log_append_only.md`. Never write probe rows.
- **Supabase CLI verify_jwt deploy quirk** — `feedback_supabase_cli_verify_jwt.md`. CLI 2.95.4 ignores per-function config.toml verify_jwt=false; pass `--no-verify-jwt` or upgrade to ≥2.100.1.

## Starting move (morning)

1. Open Ife's first message. Most likely she has device-pass items from overnight, OR she signals which workstream to pick up.
2. Read `replant_continuous_spec.md` top-to-bottom — the 2026-06-21 entries are the freshest.
3. If she reports device-pass items: fix → reload → confirm → next. Hard rule: every code change uses `feedback_delegate_build_to_agents` for multi-file work; single-file focused changes can be inline.
4. If she picks an unfinished workstream: see priority list above. Admin atomic batch (#19/#32) is blocked on edit permission. Smoke test (#20) is whenever Ife wants to walk it.
5. If she wants to verify the Church-tab underground work shipped 2026-06-21: have her create a fresh underground signup, verify (or manually flip an existing pending underground to verified via SQL for testing speed), walk the Church tab as that account, confirm: (a) no horizon switcher, (b) no AT MY LOCATION page, (c) no GPS prompt at any point, (d) CAL globe + Regions + Prayer Wall pull-up render normally, (e) tutorial doesn't fire.

In Jesus' name, Amen.
