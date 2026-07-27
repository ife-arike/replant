# signup-fe cluster — 15 tickets (audit 2026-07-02)

Repo evidence base: mobile `/Users/ife/replant` @ `feat/kan-296-mobile-attribution-slot` (latest tree); admin deployed truth = `replant-admin` `origin/main` (1108fe5). Note on migration mirrors: `supabase/migrations/` has an unmirrored window 2026-06-10 → 2026-06-14 (signup-sprint remote applies); prod state for that window is corroborated via later mirrored migrations that reference the objects, the 2026-07-01 pre-UAT audit docs (live-prod survey), and edge-function code.

## KAN-83 — Anonymous Mode — SPEC copy lock for inline toggle on AccountSetupPage1 (post-pivot)
CURRENT LANE: In Progress
VERDICT: SUPERSEDED
EVIDENCE:
- `src/screens/onboarding/AccountSetupPage1Screen.tsx:561-579` — inline Anonymous Mode toggle LIVE on ASP1 (KAN-196/D-63), default OFF, wired to `OnboardingContext.personalDetails.anonymous` → create-account payload (ASP2:930)
- Shipped copy: label "Anonymous Mode"; explanation "Hide your name from the network. Other leaders will see your role and church, but not your name. You can change this in Settings."
- SPEC draft in ticket c.2026-05-21 ("Anonymous mode" / "When on, others see your role and ministry only — never your name.") was never Founder-ratified on-ticket and was NOT what shipped
- Standalone `AnonymousModeScreen.tsx` removed (file gone; `src/navigation/OnboardingNavigator.tsx:17,158` documents KAN-196 removal); live identity-preview card added (ASP1:581-608)
MISSING: n/a (superseded) — but note shipped explanation uses "role and church", not "ministry", contradicting this ticket's AC-3 content-voice rule; and it is 3 sentences, not single-line
DEPLOYED: mobile-tree (needs Expo rebuild note)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (close as superseded by KAN-196 shipped build; Founder either retro-ratifies shipped copy or files a one-line copy tweak for the church→ministry voice deviation)
COMMENT-FACTS:
- Inline toggle shipped on ASP1 under KAN-196 (D-63); standalone AnonymousModeScreen removed; value flows context → create-account payload
- Shipped label "Anonymous Mode"; shipped explanation differs from the SPEC draft posted here (draft was never Founder-ratified in comments)
- Shipped copy says "role and church" — AC-3 of this ticket required "ministry" voice; deviation flagged for Founder ruling
- This ticket's remaining deliverable (verbatim string lock for FE consumption) is moot — FE already shipped and no further copy iteration is planned
- KAN-192 AC-7's question (does KAN-83 cover ASP2 strings) was answered in KAN-192 c.2026-06-12: all ASP2 copy locked in-thread, no SPEC sibling needed

## KAN-148 — Leader registration: handle 3rd-leader conflict when church has 2 registered leaders
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- `supabase/functions/search-churches/logic.ts:107-110` — `CHURCH_LEADER_CAP = 2`, `at_capacity` computed server-side from ACTIVE leaders only (`index.ts:162 .eq("is_active", true)`) → deactivated leader re-opens a slot (answers AC 6 by implementation)
- `src/screens/onboarding/AccountSetupPage2Screen.tsx:1361-1363` "Leader slots full" label on capped result rows; `:1235-1241` cap-error card "This church already has 2 leaders. Contact them directly or register a new entry." + `accounts@projectreplant.org` (AC 1+2)
- `:497-502` selection blocked on `at_capacity`; write-time re-check in `create_account_atomic` → P0001 mapped to `LEADER_CAP_EXCEEDED` (`create-account/handler.ts:176-177`), FE maps it back to the cap error (`ASP2:968-974`) — attempt never silently dropped (AC 3)
- No admin notification path on cap conflict found anywhere (handler only telemetry-logs `atomic_failed`) — AC 4 NOT FOUND
MISSING: AC 4 (admin notified of the conflict); AC 6 formal SPEC ruling never posted (implementation de-facto answers it: active-only count)
DEPLOYED: yes (edge fns + RPC live); FE mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do (residual scope = AC 4 admin notification, or Founder waives it → Done; also ratify "deactivated leader frees slot" as the AC-6 ruling)
COMMENT-FACTS:
- Slot-full UX built end-to-end: server-computed at_capacity (active leaders ≥ 2), capped-row label, block-on-select, cap error card with accounts@ contact
- Server re-checks capacity at atomic write; LEADER_CAP_EXCEEDED surfaces the same canonical FE error — no silent drop
- Deactivated leaders excluded from the count (is_active=true), so a freed slot is immediately joinable — de-facto answer to AC 6
- AC 4 (admin notified of 3rd-leader attempts) not built: only a telemetry log line exists
- KAN-155 was Founder-ratified 2026-06-23 as superseded by this ticket

## KAN-155 — SHELL: Leader slot overflow — handle 3rd+ leader attempting to join a full church
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- Ticket c.2026-06-23: Founder-ratified duplicate of KAN-148; "KAN-148 is the canonical ticket. This ticket is superseded." Cancel (transition id 4) already proposed in-comment
- The underlying behaviour is built under KAN-148 evidence (see above)
MISSING: n/a
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Cancel (transition id 4) per Founder-ratified 2026-06-23 supersession — not one of the standard lanes; Founder executes
COMMENT-FACTS:
- Duplicate of KAN-148 (Founder-ratified 2026-06-23 board cleanup); duplicate link established
- Slot-overflow handling itself is largely built — evidence recorded on KAN-148
- Action: transition to Cancelled (id 4)

## KAN-158 — Intake validation: enforce one-leader-one-church constraint at registration
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- Shipped architecture makes duplicate applications structurally impossible: one `public.users` row per identity (`users_auth_id_key` UNIQUE INDEX on users(auth_id) — cited in migration `20260626000003:19`), single `church_id` column, no applications table
- Email enforced at 3 layers: ASP1 `check-email-available` on blur + Next (`AccountSetupPage1Screen.tsx:208-297`); ASP2 Layer-1 pre-check + Layer-2 retry guard (`AccountSetupPage2Screen.tsx:656-675,797-808,985-991`); create-account Layer-3 duplicate detection → `user_already_exists` (`create-account/handler.ts:302-330`) + 23505 users_email mapping (`:165-170`)
- FE message: "An account with this email already exists. Try signing in instead." (ASP2:85-86) — the AC-2 church-name message shape assumed an applications model that never shipped
- AC 3 (rejected/deactivated can re-register): resume path only covers auth-row-without-public-row (`handler.ts:332-352`); soft-deleted (rejected) users hold their email until the day-30 hard-delete sweeper (`20260623_0007`) → same-email re-registration returns user_already_exists during that window
MISSING: AC 3 as specced (re-register while soft-deleted) — overlaps tracked post-MVP memory `postmvp_rejected_church_resubmission_flow` and the Leader Suspension Lifecycle ticket; AC 6 web-intake parity (deployed `netlify/functions/church-intake.js` on origin/main does field validation only — but it creates church rows, not user affiliations, so the one-leader-one-church constraint doesn't arise there)
DEPLOYED: yes (edge fns + constraints live); FE mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (close as superseded by the atomic single-row architecture; the AC-3 re-registration residual is already tracked in the rejected-resubmission post-MVP item + suspension-lifecycle ticket)
COMMENT-FACTS:
- One-leader-one-church is enforced structurally: unique users(auth_id), single church_id FK, atomic create — a "second application" cannot exist
- Email duplication blocked at 3 layers (ASP1 inline check, ASP2 pre-check/retry-guard, server duplicate detection) with clear inline copy
- Race condition (AC 5) covered by unique constraints + v8 idempotency keys instead of the proposed composite constraint
- Residual: a rejected/soft-deleted leader cannot re-register with the same email until the 30-day hard-delete scrub — tracked separately (rejected-resubmission flow, post-MVP)
- Web intake creates church rows only (no user affiliation), so this constraint is N/A on that surface

## KAN-184 — Country dropdown — filter-as-you-type UX polish
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- `AccountSetupPage1Screen.tsx:160-165,676-763` — brand-styled bottom-sheet country picker, real-time case-insensitive substring filter, autoFocus, no-match empty state, keyboard-aware sheet (KAN-184 fix comments 2026-06-12 in-file)
- `RegisterChurchPage1Screen.tsx:314-315,574-576,1097-1145` — same filter-as-you-type sheet on RegCP1 (AC 1 covers both screens)
- Full list renders on open (filter empty → all countries); selection/validation/submit contract unchanged (AC 4/5)
- Styling is the Replant sheet pattern, not the native OS picker (AC 3)
MISSING: AC 6 keyboard navigation (arrow/Enter/Esc) — desktop semantics, N/A on native RN touch UI; BA pre-flagged it droppable in the 2026-05-20 SM-review
DEPLOYED: mobile-tree (needs Expo rebuild note)
NEEDS-LIVE-DB: none
NEEDS-SIM: Open country picker on ASP1 and RegCP1, type a fragment ("nig"), confirm live filtering + empty state on gibberish
RECOMMENDED LANE: Testing (Founder device ratify, then Done)
COMMENT-FACTS:
- Filter-as-you-type country picker live on BOTH AccountSetupPage1 and RegisterChurchPage1; brand bottom-sheet, not native picker
- ASP1 sheet got extra polish: autoFocus, no-match empty state, KeyboardAvoidingView + inset defenses (Founder-reported keyboard occlusion fixed 2026-06-12)
- No data-model/validation/submit changes — pure FE polish as specced
- AC 6 (arrow-key navigation) is desktop web semantics — not applicable to the native sheet; BA had pre-flagged it droppable

## KAN-192 — AccountSetupPage2 — wireframe v4 reconciliation + skip link + Enter Replant CTA (D-65, D-69)
CURRENT LANE: In Progress
VERDICT: BUILT
EVIDENCE:
- AC1: single anchored register-yours card (`ASP2:1381-1393`), duplicate outline button removed (comment :1323-1326). AC2: results cards with name/type/city + status dot from `verification_status` per locked c.15743 mapping (`:93-107,1340-1370`) + "Leader slots full" capacity note. AC3: empty-state card + "Type at least 3 characters to search." hint (`:1089-1091,1313-1321`)
- AC4: "Skip for now" blue text link (`:1402-1411`, `skipLinkText` color=Colors.accent) + protection-layer modal with locked 7-day copy verbatim (`:1476-1479`); no church write, countdown untouched
- AC5/6: full bypass card on loopback (`:1126-1225`) — ribbon + church meta + named `BypassStatusRow` ("Awaiting verification"), Edit → RegCP1 (`:563-589`), Switch/Delete (context-clear under orphan-prevention, `:608-648`); Enter Replant CTA in footer (`:1422-1436`); skip path never renders bypass
- 2026-06-12 ruling item 6: RPL Network ID search — server-side format-detect branch in `search-churches/index.ts:82-128,271` + FE placeholder "Search by church name or Replant ID..."
- Over-scroll bug: root-cause fixed (phantom contentInset defense + flex-flow footer + focus scroll-reset, `:372-389,1007-1037`); commit `0abc408` "Sessions 3-4 polish (KAN-192, over-scroll, register-church-delete)"
MISSING: none of the ruled scope; note `register-church-delete` backend (ruling item 4) shipped then became dead code under the 2026-06-14 orphan-prevention refactor (KAN-236) — Delete is now a pure context clear
DEPLOYED: mobile-tree (needs Expo rebuild note); search-churches RPL branch deployed
NEEDS-LIVE-DB: none
NEEDS-SIM: Founder device pass: search→select→Enter Replant; register→bypass card→Edit/Switch; Skip modal → Home (the board-comment's outstanding re-ratification)
RECOMMENDED LANE: Testing (Founder device re-ratification, then Done)
COMMENT-FACTS:
- All 7 ACs + the 2026-06-12 scope rulings verified in code: verification_status dots (locked mapping), skip blue-link + locked 7-day modal copy, full bypass card with Enter Replant / Edit / Switch, register-yours card, empty states + 3-char hint, RPL-ID search branch live in search-churches
- Over-scroll bug root-caused (phantom iOS contentInset) and fixed in the Session-4 pass; fix commit 0abc408
- register-church-delete shipped per ruling then superseded by the KAN-236 orphan-prevention refactor — bypass Switch is now a pure in-memory discard (no DB row exists pre-Enter-Replant)
- Copy for skip modal / bypass labels locked in-thread 2026-06-12 (no external SPEC ticket needed — resolves the AC-7 / KAN-83 question)
- Remaining: Founder device re-ratification only

## KAN-197 — RegisterChurchPage1 — move needs textarea from Page 2 (D-64)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- `RegisterChurchPage2Screen.tsx:74-86` code comment: "Finalization (Founder ruling 2026-06-12, full revert of SPEC c.13818 additions ACs 8/9/11) — 'What we have' + 'What we need' back as a symmetric paired set on Page 2. Both REQUIRED... The 500-char counter is dropped. Placeholder voice keeps the 'your ministry' framing"
- Shipped regular flow: RAG (Current Status w/ descriptions) + Has/Needs pair on Page 2 (`:88-129,461-540`); comma-split→trim→filter preserved (`:172-179`, AC 3/12 honored); N/A-guidance copy; Page 2 has NO map step at all (lat/lng sent null, `:192-194`) — the D-64 premise ("Page 2 = map pin only") no longer exists
- Underground flow: needs/has textareas ARE on Page 1 (`RegisterChurchPage1Screen.tsx:944-989`, optional, maxLength 500) because UG submits from Page 1 — the only surviving Page-1-needs surface
- "Needs & Offerings" label never shipped (zero matches); RAG for non-UG lives on Page 2 since KAN-13 finalization 2026-05-22, so "below the RAG selector on Page 1" is unbuildable as written
MISSING: n/a (superseded) — D-64 move + c.13818 ACs 8-13 explicitly reverted/replaced by Founder ruling 2026-06-12
DEPLOYED: mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done (close as superseded by Founder ruling 2026-06-12; no residual work — the goal "map step focuses on location" dissolved when the map step was removed entirely)
COMMENT-FACTS:
- Founder ruling 2026-06-12 fully reverted the SPEC c.13818 presentation (label/optional/counter): shipped is a REQUIRED "What we have"/"What we need" pair on Page 2 with N/A guidance, no counter
- The D-64 premise is gone: Page 2 is now the Status+Needs screen (no map-pin step anywhere; lat/lng null at signup)
- Underground path DOES have needs/has on Page 1 (2026-06-20) since UG submits from Page 1
- Comma-split→trim→filter contract and "your ministry" placeholder voice preserved; churches.needs ARRAY schema untouched as specced
- No residual work; recommend closing against the 2026-06-12 ruling

## KAN-229 — Name structure foundation — first/middle/last columns + display preferences + 8 RPC updates
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- Schema live on prod: `first_name/middle_name/last_name/last_name_first/honorific` referenced as existing users columns across mirrored migrations (`20260702021338` P0-2 column list; `20260623_0007` sweeper writes them; `20260614150000` adds `suffix` + `include_middle_name` and cites "the existing last_name_first / honorific writes")
- ASP1: middle-name input (optional, `AccountSetupPage1Screen.tsx:397-410`), Ruling-5 Unicode whitelist sanitizer on all 3 name inputs (`:53-60`), honorifics hint by role picker verbatim "Honorifics can be added in Settings after setup." (`:501-508`)
- Write path structured end-to-end: ASP2 payload sends firstName/middleName/lastName (`ASP2:920-924`) → create-account composes full_name server-side as derived/legacy (`logic.ts:440`) → `create_account_atomic` persists
- Settings: `last_name_first` toggle (`SettingsScreen.tsx:560-574`), `include_middle_name` (`:594-606`), honorific hybrid picker (`:621-641`), suffix w/ Other… free-text (`:648-661`)
- Server-side resolver `public.resolve_display_name(first,middle,last,honorific,role,display_name_preference,last_name_first)` in live RPC defs (`20260702024300` get_prayer_wall, `20260702024556` get_open_prayers, `20260621000002`); AC-10 FE consumers (CommentThread/NetworkFeed/LeadersList/BranchThreadView/DMThreadView) all reference structured fields; only surviving `split(' ')[0]` is a SettingsScreen fallback (`:505`)
MISSING: AC 3 full_name drop — column intentionally kept as derived/legacy (AC permits "until then"); still read in super_admin branch of get_prayer_wall. AC 2 backfill of 198 seeded leaders — mooted by the re-seed to ~10 KEEP users
DEPLOYED: yes (DB + RPCs live); FE mobile-tree
NEEDS-LIVE-DB: spot-check the 8 live RPC bodies use structured fields (mirror gap 2026-06-10→14: get_branch_members/get_church_profile latest mirrors predate KAN-229; get_testimonies/get_landing_testimonies have no mirror): `SELECT p.proname, (pg_get_functiondef(p.oid) ILIKE '%resolve_display_name%' OR pg_get_functiondef(p.oid) ILIKE '%first_name%') AS uses_structured FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_prayer_wall','get_testimonies','get_landing_testimonies','get_open_prayers','get_branch_members','get_church_profile','get_leader_thread_list','get_comments');`
NEEDS-SIM: New signup with middle name → Settings: flip last_name_first + set honorific → verify identical rendering across Comments / Prayer Wall / Connect DM header
RECOMMENDED LANE: Testing (device pass + the DBA 8-RPC spot-check above, then Done)
COMMENT-FACTS:
- Structured name columns (first/middle/last + last_name_first + honorific + suffix + include_middle_name) live on prod; sign-up captures and persists all three fields with the Ruling-5 Unicode whitelist
- Honorifics-in-Settings hint on ASP1 is the Founder-locked string verbatim
- Settings persists last_name_first / include_middle_name / honorific / suffix with optimistic-revert writes
- Canonical server resolver resolve_display_name() confirmed in the live defs of get_prayer_wall/get_open_prayers/get_comments-path; FE split(' ')[0] patterns removed from the 5 named consumers
- full_name retained as server-derived legacy (per the AC's transition clause) — drop is a future cleanup, not a gap
- One DBA spot-check outstanding: confirm all 8 live RPC bodies use the structured resolver (4 of 8 lack post-KAN-229 migration mirrors)

## KAN-230 — Church contact email uniqueness with main/branch campus exception + account-email reuse policy
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- AC 1 constraint live: `create-account/handler.ts:155-163` maps 23505 on `churches_contact_email_unique_excl_campus` → 409 `contact_email_taken` with Founder redirect copy ("...change your church type to Main Campus or Branch..."); KAN-236 ticket records Founder observing the index blocking orphan re-use on prod 2026-06-14
- AC 2 policy shipped: account email checked only against auth.users (`check-email-available`), church contact_email only against churches — no cross-table block; policy documented in the handler copy + validation sites
- Pre-submit surfacing: `find_similar_churches` returns `match_reason='contact_email'` (`20260702024153:24`) → RegCP2 similar-church modal; RegCP2 post-auth edit path surfaces the 409 copy verbatim (`RegisterChurchPage2Screen.tsx:287-293`)
- AC 3 NOT built: no "Possible duplicate" badge in deployed admin `origin/main` (git grep: only UG rejection-reason enums mention duplicates)
- FE gap: ASP2 create-account error mapping has no `contact_email_taken` branch (`ASP2:955-992`) — if the 409 fires at Enter Replant (race past RegCP2 validation), leader sees generic failure copy instead of the Founder-locked redirect copy
MISSING: AC 3 admin queue "Possible duplicate" badge; ASP2 FE mapping for the 409 at Enter Replant (edge case)
DEPLOYED: yes (constraint + edge fns); admin badge absent from origin/main
NEEDS-LIVE-DB: confirm constraint def: `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='churches' AND indexname='churches_contact_email_unique_excl_campus';`
NEEDS-SIM: Register a church with an already-used contact email (non-campus type) → confirm the similar-church modal fires at RegCP2; force-continue → confirm Enter Replant error copy
RECOMMENDED LANE: To Do (residuals: admin badge — fold into admin sprint; ASP2 409 mapping one-liner)
COMMENT-FACTS:
- Partial unique index churches_contact_email_unique_excl_campus enforced at the atomic write; 409 carries Founder-locked redirect copy from create-account
- Account-email vs church-contact-email independence implemented exactly as ruled (no cross-table block); documented at the validation sites
- Pre-submit detection also live: find_similar_churches match_reason='contact_email' drives the RegCP2 similar-church modal
- NOT built: admin verification-queue "Possible duplicate" badge (AC 3) — absent from deployed admin main; data signal exists server-side
- Gap: ASP2 lacks a specific FE mapping for the 409 at Enter Replant — falls to generic error copy (RegCP2 validation normally catches it earlier)

## KAN-231 — AccountSetupPage1 — phone number field + reassurance info note
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- `AccountSetupPage1Screen.tsx:440-454` — optional "Personal Phone" TextInput, `keyboardType="phone-pad"`, placeholder "+234 800 000 0000"
- `:451-453` — reassurance note VERBATIM locked copy: "We will only reach out to you directly if your church contact does not answer." in muted `fieldHint` register
- Wire-through: context (`OnboardingContext.tsx:36-38`) → ASP2 payload `phone` (`ASP2:926-927`) → create-account parses (`logic.ts:436,466`) → `create_account_atomic` persists
- `users.phone` column live on prod: hard-delete sweeper sets `phone = NULL` (`20260623_0007:81`)
MISSING: nothing material. AC 1 placement is below email rather than below country (AC left "final UX placement at build time"); AC 5's Android `inputMode="tel"` is not an RN prop — `keyboardType="phone-pad"` provides the tel keypad on both platforms
DEPLOYED: yes (column + edge fn); FE mobile-tree
NEEDS-LIVE-DB: none (column evidenced by sweeper migration)
NEEDS-SIM: Sign up with a phone number → confirm users.phone populated; sign up without → confirm empty is accepted (Next not blocked)
RECOMMENDED LANE: Testing (Founder device pass + copy ratify per board comment, then Done)
COMMENT-FACTS:
- Optional phone field live on ASP1 with phone-pad keyboard; empty never blocks Next
- Reassurance info note is the Founder-locked 2026-06-08 copy verbatim, rendered in the standard muted microcopy register
- phone flows context → create-account payload → users.phone (nullable, stored as-entered; normalization stays KAN-156)
- users.phone column confirmed on prod (day-30 PII sweeper nulls it)
- Placement is below the email field (AC allowed build-time placement)

## KAN-232 — Branch church sign-up flow — parent campus lookup (RPL Network ID) + identifier dropdown
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- Goal (branch registers under recognized parent) shipped via Founder-ruled 2026-06-18/19 design, not the ticket's Step A/B: `RegisterIntroScreen.tsx` 3-tile chooser (standalone/branch/underground) replaces the Yes/No/Not-Sure question; `ParentChurchPicker.tsx` segmented RPL-ID + name lookup with SelectedCard/HQ badge/deferred-parent claim card
- BE live: FE calls `supabase.rpc('find_church_by_code')` + `find_parentable_churches` (`RegisterChurchPage1Screen.tsx:217,239`); both confirmed on live prod with branch/para/UG exclusion by the 2026-07-01 pre-UAT audit (`docs/audits/_working/db-rls-schema.md:81,159,179`); `create_account_atomic` takes `p_branch_of_church_id/p_pending_parent_claim/p_is_headquarters` (`create-account/index.ts:169-176`) and writes pending_parent_claims (`docs/system-map/README.md:101`)
- RPL-miss inline error shipped ("No church matches that RPL ID..." `ParentChurchPicker.tsx:227-233`); parent lock-display via SelectedCard; ASP2 bypass shows "Church branch of {parent}" or amber "Parent church to be linked" (`ASP2:1171-1181`)
- NOT shipped from original ACs: Step B identifier dropdown + `branch_identifier_type/value` schema (zero matches repo-wide); multi-HQ accounts@ note copy (replaced by self-asserted "Mark as Headquarters" checkbox, `RegCP1:161-178,711-724`); AC 7 admin queue parent-link display (absent from deployed admin origin/main — data persisted only)
- Founder rulings 2026-06-19 locked the architectural shift: branch-parent FK organizational not load-bearing; parentless branches first-class; `trg_branch_must_have_parent_or_claim` DROPPED
MISSING: (as superseded residuals, if Founder still wants them) identifier dropdown + schema; multi-HQ note copy; admin queue parent-link surfacing
DEPLOYED: yes (RPCs + create-account v8 live); FE mobile-tree; admin surfacing absent
NEEDS-LIVE-DB: confirm branch schema objects: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='churches' AND column_name IN ('parent_church_id','is_headquarters','church_code'); SELECT to_regclass('public.pending_parent_claims');`
NEEDS-SIM: Branch signup x3 paths (parent via RPL ID, parent via name, deferred-parent claim) per board comment; verify ParentChurchPicker placeholders ("RPL-00001" / "Maranatha Ministries" — Maranatha is the Founder's own church, not a third-party legal risk)
RECOMMENDED LANE: Testing (Founder device pass; explicitly ratify that identifier-dropdown + multi-HQ note + admin parent display are dropped by the 2026-06-19 ruling or spin residual tickets)
COMMENT-FACTS:
- Branch flow shipped under the 2026-06-18/19 Founder rulings: RegisterIntro 3-tile chooser + ParentChurchPicker (RPL-ID/name segmented search, HQ badges, deferred-parent optional claim) + atomic branch fields on create_account_atomic
- find_church_by_code + find_parentable_churches confirmed live on prod with underground/para/branch exclusion (pre-UAT audit spot-check)
- Deferred-parent path is first-class per the 2026-06-19 architectural ruling (FK organizational; auto-link claim on name+city+country; parent-or-claim trigger dropped)
- NOT built vs original ACs: Step-B identifier dropdown + branch_identifier_* columns (zero code), multi-HQ accounts@ note (replaced by HQ checkbox), admin-queue parent-link display (data persisted, no admin UI on deployed main)
- ASP2 bypass card surfaces the branch-parent attribution ("Church branch of X" / "Parent church to be linked")

## KAN-233 — Fuzzy church name standardization — Layer 1: live hint during sign-up
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Shipped mechanism = submit-time detection, not live-typing hint: `register-church` v7 validation-only runs `find_similar_churches` (limit 3) on RegCP2 submit (`register-church/handler.ts:112-143`); FE surfaces the similar-church modal with "Go back to search" / "Continue anyway" (`RegisterChurchPage2Screen.tsx:109-123,341-355,404-431`)
- AC 5 (no hard block) ✓ — "Continue anyway" re-submits with `force:true`, v7 skips the re-check (`handler.ts:91-97,117`)
- AC 6 (underground exclusion at BE) ✓ — `20260702024153_find_similar_churches_exclude_underground.sql:30-31` (`type <> 'branch' AND type <> 'underground'`); pre-2026-07-02 it excluded only branch (fixed in the pre-UAT P1 remediation)
- AC 2/3 NOT built: no abbreviation dictionary anywhere; matching is exact/substring name (both containment directions) within same country+city + exact contact_email + last-10-digit phone (`20260702024153:32-45`) — no pg_trgm/Levenshtein, so "RCCG" will NOT match "Redeemed Christian Church of God"
- AC 1's live 400ms-debounce hint during church-name typing NOT built (the only live-typing search is ASP2's church search, a different surface)
MISSING: live-typing hint on the church-name input; ~20-entry abbreviation dictionary; trigram/Levenshtein similarity
DEPLOYED: yes (RPC + edge fn live); FE mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: Register a church whose name substring-matches an existing same-city church → confirm modal; type "RCCG" where "Redeemed Christian Church of God" exists → confirm it does NOT match (known limitation)
RECOMMENDED LANE: To Do (rescope: goal partly met at submit-time; decide whether abbreviation dictionary + fuzzy distance still wanted pre-launch or post-MVP)
COMMENT-FACTS:
- Duplicate detection shipped at SUBMIT time as the register-church v7 similar-church modal (Founder ruling 2026-06-18), not as a live-typing hint
- Modal offers "Go back to search" (jump to ASP2) and "Continue anyway" (force:true bypass) — non-blocking as specced
- Underground churches excluded from the candidate set at the BE layer (hardened 2026-07-02 in the pre-UAT P1 fix)
- Matching is exact/substring within same country+city plus exact contact-email / last-10-digits phone — NO abbreviation dictionary, NO trigram/Levenshtein; RCCG-style variants won't match
- Residual decision: is dictionary + fuzzy-distance matching still wanted, and where (signup vs admin Layer 2)

## KAN-236 — Signup: defer church creation to atomic create-account (no-orphan refactor)
CURRENT LANE: Backlog
VERDICT: BUILT
EVIDENCE:
- BE: `create-account` v8 calls `public.create_account_atomic` (shipped name for the spec's create_account_with_church) with mutually-exclusive newChurch/churchId + branch fields (`create-account/index.ts:169-176`, `handler.ts:354-410`); compensating auth-delete only when `created=true` w/ resume-path guard (ruling 3, `handler.ts:332-352,389-400`); 23505→409 contact_email_taken mapping; P0001→LEADER_CAP_EXCEEDED; fail-closed per-IP + per-IP-per-email Upstash buckets (ruling 4 + pre-UAT hardening, `handler.ts:214-300`); required idempotency key + 200-replay cache (ruling #28, `handler.ts:245-279,538-549`)
- FE non-UG: `register-church` v6/v7 is VALIDATION-ONLY, no DB write (`register-church/handler.ts:1-17`); RegCP2 stashes payload to context + navigates with `'local-draft'` sentinel (`RegisterChurchPage2Screen.tsx:357-392`); ASP2 builds `newChurch` from context at Enter Replant (`ASP2:819-886,908-941`); bypass Switch/Delete = pure context clear, register-church-delete dead code (`ASP2:66-71,608-648`)
- FE UG symmetric: RegCP1 underground handleNext routes to NameVisibilityChoice which validates only and loopbacks; atomic write still at Enter Replant (`RegisterChurchPage1Screen.tsx:526-537`)
- The fixed regression: killing the app between RegCP2 and Enter Replant leaves zero rows (nothing is written pre-Enter-Replant); contact_email never locked by abandonment
- Rulings honored: #1 pre-submit contact-email surfacing via v7 similar-check (contact_email match_reason); #6 BypassStatusRow keeps "Awaiting verification" (`ASP2:149-155`); #8 handled by parse-time validation
MISSING (ruling deviations, non-structural): #2 `church_draft_buffered` audit action not implemented (zero matches); #5 Switch modal copy says "deleted...church lookup page" not the locked "discarded" phrasing (`ASP2:1554-1556`); #7 error code kept as `contact_email_taken` (not renamed `church_contact_email_taken`) and ASP2 has no FE mapping for it; `useUnifiedSignup` rollback flag never created (moot post-ship)
DEPLOYED: yes (create-account v8 + register-church v7 + RPC live); FE mobile-tree
NEEDS-LIVE-DB: none
NEEDS-SIM: Register church → kill app before Enter Replant → confirm no churches row + contact_email reusable (test plan #11); double-tap Enter Replant → single account
RECOMMENDED LANE: Testing (Founder device pass, then Done; decide whether the 3 ruling deviations — draft-buffered audit event, "discarded" modal copy, error-code rename — are waived or micro-fixed)
COMMENT-FACTS:
- No-orphan architecture fully live: register-church is validation-only, church+leader written atomically by create_account_atomic at Enter Replant, compensating auth-delete on RPC failure with resume-path guard
- Underground path refactored symmetrically (NameVisibilityChoice → validation → atomic write) — both PRs' scope landed
- v8 adds required idempotency keys with 200-replay cache and fail-closed dual rate-limit buckets (per-IP + per-IP-per-email)
- Bypass Switch/Delete is a pure context clear; register-church-delete is dead code awaiting cleanup-PR removal (Follow-up B posture)
- Ruling deviations found: church_draft_buffered audit event not implemented (ruling 2); Switch modal says "deleted" not the locked "discarded" copy (ruling 5); error code not renamed to church_contact_email_taken and ASP2 lacks its FE mapping (ruling 7)
- Follow-up A (lock register-church to admin-only) not yet actioned — endpoint remains verify_jwt=false validation-only by design

## KAN-256 — Wire "You've been verified" toast on Home — first foreground after pending→active transition
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `src/screens/main/HomeScreen.tsx:91` — the exact TODO from the ticket is still live: `// TODO: wire toast triggers from real events (verification approved, rejected, heartcry responded)`; `toast` state never set from any verification event
- `verification_welcomed` SecureStore flag: zero matches repo-wide
- Toast COMPONENT is ready with an `approved` variant ("has been verified." / "Welcome to the network.", `NotificationToast.tsx:31`) — only the trigger wiring (the entirety of this ticket) is missing
MISSING: all of it — auth-status-check pending→active detection, per-user SecureStore flag, mount-time one-shot fire
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none (nothing to test)
RECOMMENDED LANE: To Do (pre-launch labeled; the welcome-email bridge line should be coordinated with KAN-31/KAN-81)
COMMENT-FACTS:
- Not built: HomeScreen still carries the verbatim TODO; no verification_welcomed flag exists anywhere
- NotificationToast component already has the "approved" variant with pastoral copy — remaining work is trigger wiring only (auth-status-check transition detect + user-scoped SecureStore one-shot)
- DoD's user-id-namespaced flag requirement couples this to KAN-257's key-scoping fix — build together

## KAN-257 — Tutorial SecureStore key is device-wide, not user-scoped
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- `src/components/church/ChurchTutorialOverlay.tsx:31` — `export const TUTORIAL_SEEN_KEY = 'tutorial_church_tab_seen';` (no userId in the key)
- `:157` — `await SecureStore.setItemAsync(TUTORIAL_SEEN_KEY, 'true')` — device-wide write, bug exactly as reported
- No other namespaced variant found; no audit of sibling first-time flags evident
MISSING: all of it — `tutorial_church_tab_seen:${userId}` namespacing + audit of other device-scoped first-time flags (note: KAN-256's future flag must follow the same pattern)
DEPLOYED: n/a (bug ships in mobile tree)
NEEDS-LIVE-DB: none
NEEDS-SIM: none (code inspection conclusive); post-fix: two accounts on one device should each get the tutorial once
RECOMMENDED LANE: To Do (small fix; bundle with KAN-256 per the shared flag-scoping pattern)
COMMENT-FACTS:
- Bug confirmed outstanding: TUTORIAL_SEEN_KEY is the bare literal 'tutorial_church_tab_seen' written device-wide (ChurchTutorialOverlay.tsx:31,157)
- Production posture per ticket stands (one leader per phone), but multi-account test devices suppress the tutorial after the first account
- Fix is a key-namespace change + a sweep for sibling first-time flags; KAN-256's verification_welcomed flag must be born user-scoped
