# Sim UAT — Logged-in Visual & Functional Pass (2026-07-12)

Senior QA/UAT pass of the logged-in mobile app on simulator. Persona-driven, lens-driven, single device. **In-app only** — anything admin-side is done via SQL/Supabase, never the dashboard UI. No Jira writes until Founder go-ahead.

---

## 0. Posture

- **Production database.** Every state change is logged in the register (§7), scoped to `ruthjames08+t*` QA accounts, and reverted or dispositioned at pass end. Real leaders are on the platform (first real leader 2026-06-28) — seeded announcements are written to be genuinely edifying, never "test 123".
- **No screenshot dumps.** Screenshots are taken to *see* (and for Dynamic Type / visual-ease judgment where the a11y tree is blind), not stored as a deliverable.
- **Findings over fixes.** This pass reports; it does not patch app code.

## 1. Environment

| Item | Value |
|---|---|
| Device | iPhone 17 Pro sim (`7AE8C944`), iOS 26.3 — already booted, app installed (`org.projectreplant.replant`) |
| Runtime | Metro via `npx expo start` (background), dev client build |
| Driving | XcodeBuildMCP: `snapshot_ui` (a11y tree) + `tap`/`type_text`/`swipe` + `screenshot` for visual judgment |
| Sim GPS | set to Atlanta metro (`33.749, -84.388`) so The Church map/GPS pills behave sanely against the GA test churches |

**Harness notes carried from 2026-07-03 a11y sim audit (load-bearing):**
1. Keep exactly ONE sim booted — a second booted sim breaks accessibility automation.
2. iOS AutoFill/Strong-Password sheets intercept secure fields — was disabled on this sim; verify still disabled before login.
3. Sticky bottom CTAs do not enter the a11y tree — tap those by screenshot coordinates, not element refs.
4. `simctl pbcopy` mangles non-ASCII — use host `pbcopy` + `simctl pbsync` if needed.
5. Blue "Refreshing…" Metro banner is a dev artifact, not an app defect.

## 2. Accounts & personas

Persona is the *lens*; DB roles stay untouched. All three are verified, active, church-linked — the interesting axes (anon display, church types, RAG red) are already naturally covered.

| Account | DB identity | Persona lens | What this lens hunts |
|---|---|---|---|
| `+t5` | Pastor Ifeoluwa Jamesarike · Regent Kingdom Church (house_church, verified, **RAG red**, Loganville) | **Senior pastor** — older eyes, deliberate pace | Smallest text, contrast, tap-target size, label comprehension, patience states (loading/empty), anything requiring precision gestures |
| `+t3` | Evangelist Ruth James · **anonymous=true** · Blessings Abound (main_campus, verified, green, Dacula) | **Young pastor** — fast, gesture-fluent, mobile-native | Continuity: back behavior, tab-state retention, scroll position, stale data after actions, transition jank, dead ends; plus anon identity presentation ("A fellow Evangelist" masking) everywhere she writes |
| `+t4` | Elder Ruthie Jamie · We Are One Ministries (**without_walls**, verified, green, Grayson) | **Online-ministry leader** (secondary lens — Founder 2026-07-12: without_walls is an online ministry, NOT an org) | Connect initiation side of the live DM pair; without-walls presentation on map/profile; feed comprehension |
| `+tNN` (next available suffix — verified live before signup; Founder: t6 may be taken) | fresh signup registering a **Para-ministry / Organization** | **Org leader + new arrival** (Founder 2026-07-12: new account needed for true org testing) | Onboarding → member continuity (ONE manual signup; full automated matrix comes later) · para org copy swaps ("REGISTER ORGANIZATION · 1 OF 2", "Organization Name", tooltip, NO HQ checkbox) · pending experience → SQL-verify → Verified toast + CompletionFlow with org copy → org-lens pass on Church tab + Connect Ministries |

RBAC boundaries this implies: no admin accounts → no elevated mobile surfaces; **UG surfaces out of scope** (no UG account in the trio; UndergroundEntry/JoinCodeReveal skipped); `replant_staff` not exercised. Dashboard is out of scope by definition.

## 3. UAT lens rubric (Founder's five questions, operationalized)

- **L1 Readability** — Founder calibration 2026-07-12: **Home tab text size is APPROVED — it is the baseline**; judge every other tab against it. Priority concern: **italic body text at scroll-length** — Prayer Wall cards (scriptureItalic 16px by 2026-06-05 ruling), Testimonies, Persecuted heartcry cards. The bar is Instagram-scroll endurance: can a leader get through a long list without eye strain? If italics fail that bar, the finding cites the 2026-06-05 italic ruling and recommends options for HER re-decision (never unilaterally change). Also: smallest glyphs per screen (timestamps, pills, footers, source labels); contrast; scriptureItalic only for scripture/editorial/witness; one Dynamic Type bump test on Home + Prayer Wall + Settings.
- **L2 Continuity** — Does the app feel like one continuous place? Tab-switch state retention, back-stack sanity, scroll restoration, post-action freshness (pray → count, comment → count, accept → thread), session persistence across app kill/relaunch, no identity flicker (esp. t3's anon mask). **Founder mandate 2026-07-12: maintain a per-screen BACK-BEHAVIOR MATRIX** — for every pushed screen/sheet/modal: what back affordance exists (top-left chevron · swipe-back gesture · X · tap-outside · none), where it returns to, and whether the pattern matches its siblings. Differences are findings.
- **L3 Navigation effort** — What feels difficult? Taps-to-complete for core jobs (post a prayer request; pray for someone; read an announcement + comment; start a DM; find my church; reach Settings), discoverability of hamburger items (Home tab only — by ruling), affordance clarity (does it look tappable?), dead-end screens.
- **L4 Visual ease** — Hierarchy, spacing, alignment drift between tabs, empty states that instruct vs. apologize, loading states, visual noise, chrome consistency (Church tab intentionally owns its chrome — check it still feels like the same app).
- **L5 Behavior correctness** — Are primary functions working as expected? Every write path exercised gets verified in-UI *and* spot-checked in SQL where cheap.

Severity: **P0** broken primary function / data integrity · **P1** blocks a core job or major UX failure · **P2** real friction/inconsistency · **P3** polish.

## 3.5 Grounded expected-behavior register (sources-of-truth read 2026-07-12)

Expected-vs-observed judgments during the pass anchor to THESE, not intuition. Sources: locked memories · continuous spec · requirements v2_7 + its 2026-07-01 drift audit (`docs/audits/_working/requirements-2_7-drift.md`) · Lucid map + res-doc extraction sheets (appendices A/B when agents return).

**Identity display (t3 writes everywhere):**
- Public anon = `"A fellow [Role]"` + **squarish "A" avatar** + church name **ALWAYS shown** (anon hides the person, never the church). Never the literal word "Anonymous".
- Role display = "Role + first name" (Pastor Ifeoluwa · Elder Ruthie · Evangelist Ruth); `ministry_leader`/`other` → "Minister"; masked-null-role → "A leader in the network".
- `leader_word`/`encouragement` announcement cards use client-side masking (`useResolvedLeaderAuthor`, known pending SEC panel) — observe closely if any appear, but the RPC-refactor absence is NOT a new finding.

**Home tab:**
- Pending (unverified) leaders CAN read comments, CANNOT post (composer hidden; RPC hard-gates) → S8 check.
- Announcements arrive on refetch (Realtime rollout for announcements designed 2026-07-01, NOT applied); comment_count freshness via refetch. DMs DO update live (`messages` is in the Realtime publication; `conversations` is not — thread list via `get_leader_thread_list` RPC).
- Comment delete/edit = post-MVP (absence is expected).

**Prayer Wall:** 5 pills Feed | Testimonies | My Prayers | Revelation | Locations; journal reached via JournalLinkRow; SHARE A NEED opens post modal (anon toggle present for non-UG); testimony max **300 chars**; Mark-as-Praise + Delete wired on My Prayers; detail sheet shows disabled "This is your church" on own-church requests; **Locations = Coming Soon placeholder and Revelation "Voices from the Body" composer disabled — both EXPECTED** (placeholder-content risk is separately tracked, KAN-254 adjacent).

**The Church tab:** intentionally **resets to CAML page 0 on every tab visit** (focus effect — NOT a continuity bug). RE-CENTER ME = fly to live GPS (appears only after panning >0.5km); MY CHURCH LOCATION = fly to registered coords (visible when away from church). `ownChurchId` from users.church_id, never GPS.

**Verified-gate (pending users), locked copy 2026-06-22:** full-screen gate on Church + Connect; timeline phrase — "This process may take up to 30 days, but reviews are typically complete within 24-72 hours." (identical for all viewer types); body "…connect with verified leaders around the world" (Church) / "…reach verified leaders around the world" (Connect); NO scripture block on gates; glyph lowered (~Persecuted-equivalent). VerificationBanner on Home untouched by that ruling (KAN-35 countdown banner in Testing).

**Connect:** first-DM-ever covenant gate (`covenant_ack` in SecureStore) is **DEVICE-scoped** — fires once per install, not per account; test deliberately on t4's first DM (KAN-166 copy), then note it won't re-fire for t3 on the same sim. Empty-state "Find a leader" opens the search modal (dedicated Browse list = post-MVP). Unread counts via `get_leader_thread_list` (KAN-216). Prayer-card → Connect CTA was ruled "wire pre-UAT" (KAN-260 item 3) — check presence; if absent, report as status-check on the existing ticket, not a new bug.

**Settings:** structured name columns are LIVE (first/middle/last + honorific etc., KAN-229 in Testing) — the old "full_name single field" memory rule is superseded. Display-name preference change propagates on NEXT REFETCH (instant broadcast = post-MVP ruling; not a bug). Anonymous Mode toggle = KAN-75 (in Testing) — flip on t3 (already anon: verify state reads correctly; flip off/on and watch propagation).

**Stale-memory corrections encountered (do not apply):** full_name-single-field rule (superseded by KAN-229); Realtime publication now 7 tables incl. 2 UG event tables.

## 4.5 Jira Testing/In-Review tickets this pass exercises (report will speak to these; NO status changes without go-ahead)

| Ticket | Surface in pass |
|---|---|
| KAN-38 Login status routing · KAN-41 Session restoration | S1 all personas |
| KAN-35 Verification countdown banner · KAN-195 pending action gating | S8 matrix |
| KAN-258 Prayer Wall post + receive intercession wired | S3 deep |
| KAN-75 Settings anonymous mode | S7 on t3 |
| KAN-166 first-DM covenant copy · KAN-216 precise unread counts | S5 |
| KAN-229 name structure end-to-end | S7 + display everywhere |
| KAN-231 phone field · KAN-192 ASP2 · KAN-184 country dropdown · KAN-236 atomic signup · KAN-206 leader-joins-verified-church · KAN-232 branch smoke (partial) | S9 (t6, if approved) |
| KAN-181 UG excluded from onboarding search | S9 ASP2 search spot-check (read-only) |
| KAN-207 church-type edit duplicate-orphan bug (Critical) | S7b conditional — see R7 |

Out-of-pass Testing tickets (admin-side): KAN-273, KAN-220, KAN-116; KAN-39 (In Review, email flow).

## 4. Surface inventory × persona

| Surface | t5 senior | t3 young | t4 org | Notes |
|---|---|---|---|---|
| Login / splash / session restore | deep | fast | fast | AutoFill note §1 |
| Home feed (4 card types, tag pills) | deep | deep | pass | fresh seeds at top (§6) |
| Home comments (read/post/own-delete) | post | post (anon mask) | read | comment_count freshness |
| Hamburger: Vision, Outreach & Missions, FAQ, Language, Invite, Settings entry | deep | pass | pass | Home tab only |
| Prayer Wall: browse, filters, post, urgent, pray-for, counts | deep | deep | pass | t3 prays for t5's request |
| Journal (private) | pass | deep | — | privacy spot-check |
| Testimony post + celebrate | post | celebrate | read | |
| The Church: card, map, RE-CENTER ME (GPS) vs MY CHURCH LOCATION pills | pass | pass | deep | without_walls + RAG-red render |
| Connect: list, request, accept, DM both ways, badges, empty states | — | accept+reply | initiate | live t4→t3 pair |
| Persecuted (365 witnesses) | deep | pass | pass | typography lens |
| Heartcry submission | (Q2) | — | — | live-fire decision |
| Settings: Account/Privacy/Church/Notifications/Language, display-name pref | deep | pass | pass | display-name change = next-refetch by ruling, not a bug |
| Verification banners (pending/rejected/verified) | SQL matrix on t5 | — | — | §7 |
| Onboarding → member continuity | — | — | — | t6 only (Q4) |

**Appendices (step-level expectation registers for execution):** [A — Lucid map expectations](2026-07-12-sim-uat-appendix-a-lucid-expectations.md) · [B — requirements v2_7 expectations + verbatim locked copy](2026-07-12-sim-uat-appendix-b-resdoc-expectations.md). Where the live app disagrees with an EXPECT (and it isn't on the §10 do-not-flag list or superseded by a later ruling noted in the appendix headers) = finding. B's headers carry the reconciliation rule for doc-vs-later-rulings conflicts.

## 5. Scenario suites

**S1 Entry & session (all)** — cold launch → splash → resume; login; app kill + relaunch (session restore); logout returns to login cleanly; wrong-password error tone (SEC register, no coddling).

**S2 Home (deep: t5, t3)** — feed order (fresh seeds on top); each card type renders (standard / article+source_label+link / call_to_action / together); tag pills (notice/update/urgent/new); article link opens; comment read/post/count; t3's comment shows anon mask per anon identity rules; pull-to-refresh; hamburger walk (each destination opens + back).

**S3 Prayer Wall (deep: t5, t3)** — browse + smallest-text audit; post request as t5 (+ urgent tag → rises to top); t3 prays for it → count/hold updates; prayed-by presentation; journal privacy (t3's journal invisible to others); testimony post (t5) + celebrate (t3); own-content edit/delete affordances.

**S4 The Church (deep: t4)** — church card vs map; RE-CENTER ME = sim GPS; MY CHURCH LOCATION = registered coords; without_walls presentation (t4); RAG-red presentation (t5's church); profile fields (declaration, needs, size, language); branch-typed church rendering spot-check.

**S5 Connect (t4 → t3)** — empty/list states + CovenantFooter; Leaders/Ministries sub-tab search (t3 findable by name, min-2-char rule; no UG in results); lazy thread creation (no row until first send); t4 initiates request (REQUEST_REQUIRED cross-church gate; same-church = only bypass); t3 sees request card + accepts (toast deep-link if live); DM both directions (serial logins, one device) — live-push check, optimistic send, 5-min timestamp grouping; unread badge appears/clears (KAN-216); CovenantStrip + one-time CovenantNotice (device-scoped SecureStore); Replant Team pinned thread with lock + Secure tag on all accounts; long-message wrap.

**S6 Persecuted (all, light)** — four pill pages per map (Feed · My Heartcries · Bear Witness · Take Heart); Feed shows only admin-approved, PII-scrubbed heartcries; Bear Witness double-tap idempotency check; Take Heart 365-rotation read-only; scriptureItalic legitimacy; submission per Q2 (if yes: submit once as t5 → verify it does NOT hit Feed, sits in My Heartcries as status=new with Team-thread deep-link → SQL-mark responded → verify status pill flips on refetch).

**S7 Settings & profile (deep: t5)** — structured name fields correct; display-name preference flip → verify propagation on next refetch (ruling: not instant); privacy/church/notifications/language sections open and read sanely; change-password screen opened but not executed.

**S8 Verification banner matrix (SQL, t5)** — snapshot row → `pending` (VerificationBanner copy; per-tab gates with LOCKED 2026-06-22 timeline phrase; Home banner-vs-full-gate observation → resolves map ambiguity #5; comments read-yes/post-no; zero Realtime for unverified) → `rejected` + `rejected_at` (sign-out-to-Splash vs read-only-Home+appeal → RESOLVES map ambiguity #1) → restore exact original (expect ONE-TIME Verified toast on next sign-in + tabs unlock). Status flips observed via background→foreground (polling, not push — also answers ambiguity #2). Conditional: brief `deactivated` flip (ambiguity #3) ONLY if users-table trigger inspection shows a clean revert. Then Regent Kingdom Church `verified→pending→verified` (brief; also affects +t7's view; logged). Deliverable add-on: record observed truth for map ambiguities #1/#2/#3/#5/#6/#10 in the findings report.

**S9 New account t6 (only if Q4 = yes)** — full signup → declaration → setup 1/2 → register/join church → name visibility choice → pending experience → SQL-verify → member experience. Account left in place afterward, listed in report.

**S10 Cross-cutting sweeps** — Dynamic Type bump (two notches up, Home + Prayer Wall + Settings; restore after); dark/light appearance flip (does the app hold its theme or break?); tap-target scan on smallest controls; loading/empty/error states inventory; scroll jank notes. *(Push notifications out of scope — sim + no device pass yet. In-app badge behavior covered in S5.)*

## 6. Announcement seeds (4 — mirror live framing, author fields copied from existing admin rows, `published_at = now()`, `is_active = true`)

Existing register observed: short declarative sentences, quiet gravity, no hype, no emoji. Combos chosen to cover all four card types + all four tag pills + one long-title wrap test + one long-body truncation test.

| # | tag_type | card_type | Title | Body |
|---|---|---|---|---|
| D1 | notice | standard | Three churches joined the network this week | Three congregations came into the network this week — two in North America, one in East Africa. Welcome them the way this house does everything: hold their leaders on the Prayer Wall. |
| D2 | update | article (`source_label`: Replant briefing, `link_url`: https://projectreplant.org) | Shepherding through economic hardship: field notes from leaders who have walked it | Across the network, leaders are carrying congregations through job losses, currency shocks, and thin offering baskets. We gathered counsel from pastors who have led through lean years without letting the mission thin out. Bi-vocational rhythms, congregational care when everyone is stretched, and what to stop doing first. Read it before you plan the next quarter. |
| D3 | urgent | call_to_action | Overnight prayer chain this weekend | Leaders in three regions are in acute crisis this week. We are assembling an overnight prayer chain, Saturday into Sunday — one-hour watches, midnight to six. Take a watch. The Prayer Wall will carry the hour-by-hour focus. |
| D4 | new | together | You are not the only one carrying this | Somewhere in the network tonight another leader is praying through the same burden you are. Open Connect and find them. The distance between you is one message. |

Cleanup default: `is_active = false` at pass end (delete would orphan any comments; deactivate is reversible). Founder may elect to keep any of them live — they are written to stand.

Drafts validated against live CHECK constraints: `tag_type ∈ {urgent, update, notice, new, none}`, `card_type ∈ {standard, article, long_read, leader_word, encouragement, together, call_to_action}`, `author_type ∈ {admin, leader}`, `link_url ~ ^https?://`. All four comply (D1 notice/standard · D2 update/article · D3 urgent/call_to_action · D4 new/together). Inserting with `published_at = now()` makes them immediately RLS-visible to leaders — the draft→publish flip semantics don't apply to a direct published insert.

## 7. SQL state-change register (mirrors `.qa/pending_cleanup.sql` practice)

Every change: before-snapshot captured in this file at execution time → change → revert/disposition. Planned entries:

| # | Change | Scope | Revert |
|---|---|---|---|
| R1 | ~~Rotate passwords~~ **N/A — Founder 2026-07-12: t-account passwords are shared dummy QA fixtures, wiped before launch, not sensitive. No rotation.** | — | — |
| R2 | Insert D1–D4 announcements (ids recorded) | announcements | `is_active=false` at end (Q3) |
| R3 | t5 `verification_status` verified→pending→rejected→**restore exact snapshot** (incl. `rejected_at`, `verification_deadline`, outcome-modal fields) | 1 user | full restore |
| R4 | Regent Kingdom Church `verification_status` verified→pending→**restore** | 1 church (t5+t7 visible) | full restore |
| R5 | *(if Q2 yes)* heartcry submitted via app → SQL mark `responded` + note | 1 row | dispositioned, kept |
| R6 | +tNN (next free suffix) account + its Para-ministry/Organization created via app signup; SQL-verify user+org after pending-state observation (+ `assign_church_code` RPC if deployed, else note "Replant ID pending" is a bypass artifact, not a bug) | additive | left in place, listed in report |
| R7 | *(conditional)* KAN-207 verification: edit t5's church type via profile setup flow, SQL-check no duplicate verification-queue entry + region non-NULL, revert type | 1 church | full restore; SKIPPED unless code inspection first confirms the fix is deployed (must not reproduce the orphan bug on prod) |

No writes outside these. No touch on Founder accounts, Maranatha, real-leader rows, UG tables, or `audit_log` (append-only — verify via `pg_get_constraintdef` only if needed).

## 8. Execution order

1. **C0 Env** — Metro up · one-sim check · AutoFill check · sim GPS set · next-free +t# suffix verified (R1 password rotation: N/A).
2. **C1 Seed** — R2 announcements in (so every persona sees fresh content at top).
3. **C2 t5 senior pass** — S1, S2, S3, S4(pass), S6 incl. heartcry live-fire, S7. Deep + slow: readability audit throughout (italic-fatigue focus).
4. **C3 org signup (S9)** — +tNN para-ministry signup → pending experience → SQL-verify → Verified toast + CompletionFlow(org copy).
5. **C4 org-leader pass on +tNN** — S4(deep, org presentation), S2(pass), Connect Ministries surfaces.
6. **C5 t4 online-ministry pass** — S1(fast), S4(without_walls spot), S5-initiate request to t3.
7. **C6 t3 young pass** — S1(fast), S2 (comment, anon mask), S3 (pray/celebrate cross-account), S5-accept+reply, journal privacy, S7 anon-mode setting.
8. **C7 State matrix** — S8 on t5 (+church flip), relogin checks.
9. **C8 Sweeps** — S10 Dynamic Type / appearance / tap-targets.
10. **C9 Cleanup + report** — register reverts, announcement deactivation, heartcry disposition, findings report + back-behavior matrix assembled.

## 9. Deliverables (end of pass)

1. **Findings report** (chat + this folder): `F-## | P0–P3 | lens | persona | screen | expected vs observed | repro` — ranked, most severe first.
1b. **Back-behavior continuity matrix** (Founder mandate) — per screen/sheet/modal: affordance · returns-to · pattern-consistent?
1c. **Readability verdict per tab vs Home baseline** — incl. italic scroll-endurance judgment on Prayer Wall/Testimonies/Persecuted.
2. **Behaviors verified OK** list (what UAT can lean on).
3. Coverage matrix (§4) marked done/partial/blocked.
4. **Held Jira drafts** — proposed bug tickets + which in-Testing tickets they touch. **Nothing written to Jira until go-ahead.**
5. Completed state-change register with revert confirmations.

## 10. Out of scope (this pass)

Underground surfaces · admin dashboard · push notifications · offline/airplane behavior · second device type (later pass by ruling) · Jira writes · any app-code fixes.

**Known-deferred / known-absent — DO NOT FLAG as new findings** (each already ruled or tracked):
comment delete + edit (post-MVP) · latest-comment preview (post-MVP) · mute chat · Connect swipe-timestamp · branch member list on invite · anon connection-request confirm modal (post-MVP) · Browse Leaders dedicated list (MVP = search modal) · Locations view placeholder · Revelation "Voices from the Body" composer (disabled, post-MVP backend) · **report-content + block-user UI (KAN-304/305 — tables + ratified panels live, mobile UI unbuilt; known Apple 1.2 store blocker)** · UG visibility flip on mobile (KAN-274 spec'd/unbuilt) · name-change rate limit (post-MVP) · instant display-name broadcast (MVP = next refetch) · network_updates seeding (ruled skip pre-MVP).

**Advisor appendix (report §):** security advisors run 2026-07-12 — bulk is known-posture by design (SECURITY DEFINER RPC architecture ×211 with internal guards; `churches_public`/`churches_admin` SECURITY DEFINER views = deliberate UG exclusion; deny-all no-policy RLS on blocked_users/content_reports/escalated_case_proposals; spatial_ref_sys = PostGIS system table, previously dispositioned). Carried as candidates: (1) `auth_leaked_password_protection` disabled — one-toggle HaveIBeenPwned check; (2) `audit_log_underground` always-true INSERT policy for authenticated (verify intent); (3) 15 functions with mutable search_path. Performance advisors deliberately deferred — DB tuning, not in-app UX; run in a DBA pass.
