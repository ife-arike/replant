# Handoff — 2026-07-22 — Content Section build session (escalated smoke → full Content build)

Session opened in prayer over the admin flow; closing it with the Content build nearly funneled. Next session: pray first, read this + `content_section_architecture.md` memory (the registry of record), then pick up at "THE FUNNEL" below.

## TL;DR

Escalated Cases bundle finished and merged to prod (PR #71 + #72) early in the session. Then the entire Content section program ran end to end in one session: scoping, CD v1 rejected → v2 ratified, four-lane SME panel, Jira epic KAN-323 (stories KAN-324–337), migrations authored + reviewed + 5 of 6 APPLIED LIVE, three build lanes + reconciliation, two more build lanes, admin FE merged, **PR #83 open awaiting Founder smoke**. Nine varied announcements seeded (5 live). Mobile card-grammar fixes shipped; a second card batch is RUNNING in an agent worktree at session end.

## THE FUNNEL (immediate next steps, in order)

1. **Preview 404**: deploy-preview-83--replant-admin.netlify.app returned Site-not-found right at session end. Check PR #83 checks (`gh pr checks 83`) — likely still building or a failed deploy needing a look. Resolve, hand Founder the working preview.
2. Founder smokes preview → **SHE merges PR #83** (preview-first rule).
3. **THE M1 MOMENT — critical choreography**: the instant the production bundle publishes after her merge, apply M1 (`supabase/migrations/20260722120000_content_m1_announcements_topic_correction_authortype.sql`) to live via execute_sql (strip nothing; it carries BEGIN/COMMIT). M1 = topic NOT NULL (no default) + correction_of + author_type extend. Applying before the new bundle breaks live posting; applying late leaves new BE 400ing. Old-bundle window during deploy is unavoidable (~2 min). Then verify: insert-with-topic works, topic column exists, existing 36 rows backfilled 'update'.
4. **Card batch agent** (running at handoff): fold-everywhere + encouragement roman + ArticleCard CD treatment (drop cap + derived standfirst) + CTA/Together routing verification + the "From a network" verse-slot answer. Its commits land on its worktree branch; review its report, merge into `feat/flow-gaps-mobile`, push (repo LAX).
5. **Mobile branch consolidation** for the Founder's phone build: merge into `feat/flow-gaps-mobile`: badge-cutover branch `worktree-agent-aff7d0abe0e91040f` (5b9f2b5) + card batch (step 4) + **ATN `feat/address-the-network` (557bab4) ONLY after Founder reviews it** (held unpushed by her rule). Then produce her device build. ATN consent-loop publish errors until M1 is in (expected; M1 lands in step 3).

## DB state (project jiyetphxxvyiicrnwlnx)

- **APPLIED LIVE this session**: M2 (badge additive, backfilled 19 none / 4 urgent / 4 new; tag_type retained as shadow), M3 (scripture theme + book/chapter/verse parts, 108/108 parsed, Psalm 90:2,4 = book+chapter only), M5 (content_submissions, RLS deny-all), M5b (proposed_title/body + attribution + leader_change_request + 6 SECURITY DEFINER RPCs incl. content_submissions_list_mine; publish RPC author_id = system Team user 028be745 because **announcements.author_id is NOT NULL live** — the reconciliation catch), M6 (93 audit tokens).
- **M1 NOT APPLIED** — see funnel step 3.
- Earlier in session: escalated_case_proposals.category + escalated_cases manager_review state + case_escalated_to_manager token (all applied).
- Seeds: 9 varied announcements (Founder-upgraded bodies 600–940 chars); LIVE: leader_word, encouragement, call_to_action(urgent), long_read, together. Scheduled: article, standard, link-card teaser. 1 soft-deleted fixture.

## Repo/branch map

**replant-admin** (pushes = ASK):
- `feat/content-section` = PR #83 (PUSHED). BE wave (KAN-327 announcements write-path + publish-lock 409 PUBLISH_LOCKED + per-auth_id caps; KAN-328/329 submissions + notify + emails) + FE wave (KAN-330/331/333 per pack v2.1 + list-submissions endpoint with server-side UG mask — mask reviewed by me, church join verified). 272 new tests pass. CANONICAL_ACTIONS carries all 4 content tokens.
- Worktrees: `.claude/worktrees/content-be` (merged), `.claude/worktrees/content-fe` (merged). Main checkout sits ON feat/content-section.
- **prod = main** (post PR #72): Flagged mirrors Pastoral etc. Escalated work all live.

**replant** (LAX):
- `feat/flow-gaps-mobile` (PUSHED, fe079f1): all migration FILES (M1–M6 + M5b with list RPC + author_id patch) + card grammar round 1 (Encouragement green-dot letterhead, timestamps top-right, ArticleCard fold).
- `feat/address-the-network` (worktree agent-aa9c8222309b62e8e, 557bab4, UNPUSHED-held): full ATN per ratified pack, RPC names aligned (content_submission_create/publish/request_changes/withdraw + content_submissions_list_mine), tsc clean, dev-only stub data.
- Badge cutover: `worktree-agent-aff7d0abe0e91040f` (5b9f2b5, unmerged): feed prefers badge, "Notice" label unreachable, UG name-resolution exposure documented file:line (filed in useResolvedLeaderAuthor memory).
- Card batch round 2: agent worktree, RUNNING at handoff.
- NOTE: 3d8b7c4 (read-on overflow gating, spun-off session) is NOT an ancestor of flow-gaps-mobile — merge/cherry-pick when consolidating so cues gate on actual overflow.

## Open items (tracked, none forgotten)

1. Thin notify hook: surface leaders confirming edits get no "live" email (SQL RPC can't send) — small edge function at deploy phase.
2. `announcement_edited` as M6's 94th token → then flip the action string in update-announcement.js (currently registered-action + meta.event house pattern).
3. Decline taxonomy: 7 leader-facing lines + declined/edits subjects await Founder copy pass (approved subject LOCKED "Your post is live on Replant!"; declined body draft ratified "fine for now").
4. SEC nods at deploy: softer decline notify cap (moderation lands, email throttles) + formal pass on list-submissions mask (my review: sound; fail-open-on-missing-join hardening noted).
5. Unverified-leader manual intake tightening — Founder call pending.
6. Testimony card variant + exact length caps — confirm at wiring.
7. Witness: KAN-325 migration (carved, fixed rotation, is_published) NOT authored/applied; gated on KAN-336 roster (Founder+Editorial; roster does not exist anywhere).
8. Outreach & Missions Ph1 (KAN-334): NOT BUILT yet — greenfield table+BE+admin+nav+leader hamburger page, Founder wants it visible with coming-soon gates.
9. Scheduler email (post-MVP): rec parked = one email per submission at decision moment; "set for {date}" subject variant when scheduled.
10. ATN region label: "A Pastor from your region" degradation until a client-safe macro-region label exists — resolves inside the NetworkFeed UG-masking SEC panel (evidence filed in memory).
11. tag_type shadow drop: later migration, gated on app floor version reading badge.
12. Leader Suspension Lifecycle (session task #16): SEC+DBA panel still pending, sequenced after Content.
13. Partner-approved email: Founder "slides for now," review before first partner onboarding.

## Ruling highlights locked this session (all in memory)

Team thread = support chat not workflow (ATN My Submissions carries leader actions) · ATN pulled into MVP, concept ratified, family-word type = Coming Soon popup reworded (NO family_words table this build) · notify = EMAIL auto (UG in-app), no deep links, no toggle · decline = taxonomy + optional scrubbed line + verbatim preview; Route CUT · publish-lock forbids silent edits only, takedown STAYS · curation any-admin · q-tabs not segmented; stacked q-tabs = interim design debt · em dashes minimized EVERYWHERE (feedback_reduce_em_dashes) · no filler copy, audience-context gate (feedback_no_filler_copy_audience_context) · no numeric question caps in briefs · card grammar: letterhead + time top-right + 3-line fold on EVERY card type; encouragement lead roman.

## Memory files touched (same-turn discipline held)

content_section_architecture (the registry — read it), future_word_from_family, postmvp_address_the_network_hamburger, ruling_team_thread_is_support_not_workflow (new), feedback_no_filler_copy_audience_context (new), feedback_reduce_em_dashes (new), feedback_no_ai_limit_hedging (reinforced), feedback_ask_before_pushing_during_smoke ("still smoking" decode), admin_dashboard_ux_audit (Vigil deferred), useResolvedLeaderAuthor memory (exposure evidence). Jira: KAN-323 epic comment 16408 = build+reconciliation record; KAN-325/328/329/337 descriptions current.

## LATE ADDENDUM (post-handoff, same session)
Preview-83 404 CAUSE FOUND + FIXED: KAN-327 lane left post-announcement.test.js + update-announcement.test.js at netlify/functions TOP LEVEL; Netlify rejects dotted function names ("Incorrect function names") and fails the whole deploy. Fix: relocated to tests/functions/ + ESM specifiers repointed (they are import-style, NOT require). 50/50 pass. Commits 8550dc0 + fd184ca pushed to PR #83; preview rebuilds at the same URL. LESSON for the build convention: never place *.test.js at the functions root; house convention = tests/functions/ (KAN-328 lane did it right).

## FINAL ADDENDUM — card batch round 2 COMPLETE (last running task; session transitions after this)
Branch `worktree-agent-a34f333ee98636a41` (4 commits: 58cb358/c738ba1/ab8bafb + 5184e12 cherry-pick of fe079f1). Agent worktree was cut BELOW fe079f1 but ABOVE 3d8b7c4 (inverse of assumed) — it cherry-picked fe079f1 and correctly DEVIATED from the dispatch by shipping GATED read-on cues per the LOCKED ruling_read_on_overflow_gating (right call; dispatch premise was wrong). Delivered: encouragement lead roman 22/30 · gated 3-line fold on LeaderWord/Encouragement/CTA/Together · ArticleCard = CD frame (head 26, italic derived standfirst via deriveArticleStandfirst() with 11 tests, RN-approximated drop cap ~2 lines, gated fold above Read link). tsc clean on all 8 files; 49/49 feed tests. NOT pixel-verified on device.
FINDINGS: (1) CTA renders generic ONLY when link_url missing (deliberate no-dead-button guard) — live seed row NOW FIXED (link_url + button label set), Founder sees distinct CTA next refresh. TogetherCard always distinct (green dot + overlapping seals when coAuthors passed; feed passes undefined today → Team-seal fallback). (2) "From a network · Central Asia" mystery ANSWERED: NetworkFeed maps announcements.source_label → EncouragementCard verse slot; source_label is semantically OVERLOADED (byline vs CTA button label vs LinkCard resource vs verse anchor). Clean fix = dedicated verse column or unmap for encouragement — ADD TO OPEN ITEMS (#14).
MERGE NOTE: this branch carries 3d8b7c4 + fe079f1; merging into feat/flow-gaps-mobile reconciles toward gated-everywhere (the locked end state). Consolidation order in FUNNEL step 5 stands.

## PROGRESS — follow-up session (2026-07-22, later)

- FUNNEL 1 DONE: preview-83 verified live (HTTP 200, "Deploy Preview ready!", checks green) after the tests/functions relocation fix. PR #83 OPEN + MERGEABLE. Founder smoke is the gate now.
- FUNNEL 4 DONE: card-batch branch worktree-agent-a34f333ee98636a41 merged into feat/flow-gaps-mobile (67ba580). Conflicts in ArticleCard/EncouragementCard/LeaderWordCard resolved take-theirs after verifying 5184e12 file content byte-identical to fe079f1 (strict superset, zero loss). 3d8b7c4 read-on gating now IS an ancestor of flow-gaps-mobile.
- FUNNEL 5 PARTIAL: badge-cutover 5b9f2b5 merged clean (e7323c9). tsc: home files clean (6 pre-existing errors in untouched onboarding/blog files only). Tests 67/67 (NetworkFeed + DailyScriptureStrip + displayHelpers). PUSHED fe079f1..e7323c9.
- HELD: ATN 557bab4 unmerged awaiting Founder review. Device build awaits her call (with-ATN after review, or without now). M1 armed, fires at her PR #83 merge deploy boundary.

## PROGRESS 2 — merge + M1 + build (same follow-up session, Founder at dinner)

- Founder smoke: 4 preview fix rounds shipped (8276649 default-expand/test-send-inline/density · 5c1c959 stacked-right EXPERIMENT · ff21a16 REVERT on "i hate it", Coming Soon tag + ghost seat stay dead · b067451 CD typography restore incl. italic axes font load · 9a52611 leader-preview mirrors shipped DailyScriptureStrip + chips centered/smaller). Founder: "all good, we can proceed", then explicit grant "you merge".
- FUNNEL 2 DONE: PR #83 SQUASH-MERGED to main 21:57:33Z by Claude on that grant.
- FUNNEL 3 DONE, THE M1 MOMENT EXECUTED: waited for prod bundle flip (DwkVeQ3c → S4NSx82G), applied M1 via execute_sql immediately after. VERIFIED: 36/36 backfilled 'update', topic NOT NULL + CHECK(6), correction_of uuid FK + partial index, author_type CHECK(4), insert-with-topic probe OK (rolled back). Announcements admin 42703 is dead.
- LEDGER NOTE: M1–M6 all absent from supabase_migrations by batch convention (applied live via execute_sql, files canonical on feat/flow-gaps-mobile). Reconcile as a batch at branch merge. Do NOT record M1 alone.
- FUNNEL 5 DONE: iOS development-device build FIRED from consolidated ad2b900: build da5480c8 (expo.dev/accounts/replant/projects/replant/builds/da5480c8-3bf3-4240-b287-385be5fb84cc). Monitor armed for terminal status.
- Jira: KAN-323 c.16441 = merge+M1+build record.
- NEW OPEN ITEM (#15): AnnouncementLeaderCard preview mock in admin primitives likely stale vs the merged mobile card batch (letterhead grammar, time top-right, gated fold). Fidelity pass mirrors the RN component once Founder can smoke announcements post-M1.
- BUILD FINISHED: da5480c8 development-device iOS build completed successfully. Install from expo.dev/accounts/replant/projects/replant/builds/da5480c8-3bf3-4240-b287-385be5fb84cc. FUNNEL COMPLETE.

## PROGRESS 3 — post-dinner smoke round (prod + device build feedback)

- FOUNDER FEEDBACK BATCH: LockCue sentence deleted · Announcements Home = THE WALL RULE (all live posts pinned top + EXPANDED, scheduled soonest-first then drafts collapsed; two-segment pagination) — both on replant-admin PR #84 (fix/content-smoke-r5, preview-first, she merges) · Witness answer = gated on KAN-336 roster (does not exist), unchanged.
- IDENTITY DEEP-DIVE (the "cannot happen"): root cause = leader-voice cards live-resolved author_id per-viewer (RLS-gated users/churches reads) + the two leader seeds carried the FOUNDER'S OWN PK (hand-seeded pre-M5b). Second account's RLS could not read her row → MASKED_AUTHOR ('·' initial + "A leader in the network"); resolvable viewers would see "Ruth James". FIX f0b1e8d: frozen attribution per SME interim (source_label byline + Rp seal), author_id dropped from the feed projection, resolver deleted from NetworkFeed, seeds repointed to system Team user 028be745. Verse-slot overload (open item 14) resolved by unmap. CommentThread resolver copy = remaining SEC-panel scope (memory updated).
- Mobile also in f0b1e8d: CTA = hyperlink+arrow register (filled pill killed) · ArticleCard drop cap 46/48 (unclipped, sized down).
- OPEN QUESTION to Founder: TogetherCard overlapping seals need a data source (no multi-author columns exist; card supports coAuthors, feed has nothing to pass).
- Founder sees mobile fixes via dev client (da5480c8) + metro; no new EAS build needed for JS-only changes.
- ROUND 5 MERGED: PR #84 (40ad994) squash-merged on Founder grant — announcements Home = wall (7-day feed-window posts, pinned + expanded) + queue (scheduled asc, drafts, collapsed); LockCue sentence deleted. Wall window mirrors RLS leaders_can_read_posted_announcements. Prod bundle flip being polled.
- 2026-07-25: fold/read-on regression ROOT-CAUSED + FIXED (210b195 on flow-gaps-mobile): RN 0.81 new-arch view culling killed all 7 offscreen mirrors (top:-10000 → culled → onTextLayout never fired → cues+expand dead app-wide incl. scripture strip). Mirrors now in-viewport overlays; 4 batch cards' mirror width also corrected (double-inset). Feed card colors unified (cardWarm = cardSurface, Founder ruling). Verified: build+tests+sim runs fixed bundle; visual pass needs signed-in session (Founder phone dev-client or sim panel grant).
- KAN-338 panel RETURNED — synthesis `.claude/plans/2026-07-25-kan338-panel-synthesis.md`, Jira c.16475. P0s found (get_comments gates, UG name default-exposure, search_leaders harvest). 4 Founder decisions pending; VERIFY-LIVE batch blocked on Supabase MCP reconnect.
