# Day 1 (Home tab) — CONTINUATION handoff, written mid-day at context limit

**Written:** 2026-07-28, mid-session. **Program:** personal UAT polish, Day 1 of 5 (registry: `.claude/plans/uat-polish-program-state.md` — read it first).
**Original Day-1 brief:** `.claude/plans/2026-07-28-uat-polish-day1-home-tab.md` (method + lockstep map + binding rulings — still valid, read it).
**Rulings ledger for today:** memory `rulings_2026_07_28_day1_home_polish.md` (patched to end-of-context state; trust it over stale summaries).

## Where things stand RIGHT NOW

- **Mobile PR OPEN:** https://github.com/ife-arike/replant/pull/119 (`feat/persecuted-new` → main). All Day-1 app work is in it; body describes every change. Founder smokes on her device from Metro 8082; SHE merges (or grants).
- **Admin lockstep: committed LOCALLY, NOT pushed.** Repo `~/replant-admin`, branch `feat/uat-day1-home-lockstep`, commit `37d29d9` (8 files: taxonomy/editor/validator/handlers/model/primitives/content.css). **Pushing needs Founder greenlight (ASK rule); push implies opening its PR; preview-first; never push main.** ASK STATUS: asked in the same message that delivered this handoff — check her reply before acting.
- **Prod DB (jiyetphxxvyiicrnwlnx) already carries:** `announcements.verse_text` + `verse_reference` (nullable text columns, migration applied); the reseeded wall (10 posts, ids `da1000xx…`); 27 seeded comments; the CTA post deliberately at 0 comments as the live empty-state fixture. Registers: `.qa/2026-07-28-day1-wall-wipe-snapshot.json` (pre-wipe archive) + `.qa/2026-07-28-day1-wall-reseed.sql`. KAN-338 identity pins were run GREEN after the Day-1 migrations (program registry records it); re-run only after any future migration.
- **Sim bench:** iPhone 16e simulator was left booted, logged in as `ruthjames08+t1@gmail.com` (Test1234!, dummy fixture), content size "small" (matched the Founder's device wrap). 17 Pro sim got signed out (token rotation when 16e logged in) — one live session per test account; log in on ONE sim only.
- **Founder was mid-walk on her device.** Last confirmed on-device: cue present, tear fixed, author-row ellipsis good, empty state + quiet comment load good ("ready to compromise" = accepted the no-ellipsis clamp trade).

## What shipped today (compressed; PR #119 body has the full story)

1. **FeedTitle 21/26 → 20/25** (via 19/24; Founder settled +1 on device). Strip verse stays 21 = scripture largest voice.
2. **White dots** (green retired); **dot motion URGENT-ONLY** — urgent halo pulse stays, 'new' + Encouragement breathing removed.
3. **long_read displays as "Article"** everywhere (enum unchanged). Article-family link REQUIRED (admin editor + BE validator, in the admin branch). Link row: "Read the full article →".
4. **Encouragement voice** — own warm-serif scale, no longer title register.
5. **Verse anchors** — text+ref = scriptureItalic pull-quote w/ rail; ref-only = quiet blue anchor; neither = nothing; ONE per post; inline scripture in prose stays prose (no parsing, ruled deliberate).
6. **Motion package** — Prayer-Wall grammar: staggered fade+rise rows, strip settle, reduced-motion respected.
7. **PageTurnText** — THE clamp for the whole feed now (`src/components/home/PageTurnText.tsx`; its header comment is the authoritative mechanism doc). ONE Text node, one config forever: no numberOfLines EVER, no maxHeight on the text (that intermediate also tore), node absolutely pinned in a height window sized from engine line metrics (lineHeight × fontScale estimate until its own unclamped onTextLayout lands — self-measuring, offscreen mirrors RETIRED), expand/collapse animates the window only. `useMirrorRearm` survives repurposed: re-keys the node post-paint so Fabric's one measurement event can't be lost. Compromise Founder accepted: no "…" at the clamp; the read-on cue carries the signal. **Never reintroduce numberOfLines flips, per-card clamps, or first-event latching on the feed.**
8. **Comments** — empty state ("No comments yet. Be the first." / read-only "No comments yet."), spinner removed (rows ease in, 220ms), long-thread fold pair unchanged. Server gate verified in pg: `post_comment` requires `is_active AND verification_status='verified'`; FE hides composer unless `branch==='active'`; pending leaders read-only. Founder still wants her own gating test pass.
9. **Wall reseed** — 10 posts covering: every card_type, all badge registers, both verse modes + none, links, 0/1/2/4/5/9-comment threads (9 exercises the fold), long-name stress (Bishop Yerlan Abdrakhmanov / Astana Evangelical Christian Mission), masked identities, Founder's verbatim comment lines ("this was a really good read, thanks for sharing." / "Amen, we are standing with you."), human-but-Godly register throughout.
10. **Long-name overflow fix** — LeaderWord + Encouragement author rows: flexShrink + single-line ellipsis; comments affordance can't be crowded off.
11. **Named-leader avatars = NAME initial, server-composed** — new `announcements.source_initial` column (NULL = sealed → Replant seal; SEC F1 intact). Founder caught a client-derived charAt(0) recurrence: **initials are server-composed, never client-derived, no exceptions.** Publish-path stamping (content_submission_publish + recompose_frozen_bylines) rides the composer-extension follow-up ticket; until then new leader posts fail safe to the seal.

**The program registry's "Cross-day carryover" section carries additional line-items from stretches of the session this handoff's author no longer held** (BE update-announcement partial-patch link gap; admin preview-mock remaining fidelity items — letterhead grammar, time-top-right, gated fold cue; wiped submission pointer 24708ec3). **Trust the registry where it is more specific.**

**Founder Q&A on record:** multiple scriptures mid-sentence = plain prose by design (anchor is the one deliberate lift). Feed at scale = 20/page cursor, 7-day window, always ends at "— held in prayer —", pull-to-refresh only, NO realtime injection — calm and bounded by design, not a Twitter feed; volume knobs (window, curation, digest) are post-MVP decisions.

## PENDING — the rest of Day 1 (in priority order)

1. **Hamburger panel pass** (Founder: "we will also cover the hamburger tabs in this sesh"). `src/components/home/HamburgerPanel.tsx` + entries (Address the Network, Outreach — hamburger-only, Home-tab-only chrome). Same method: hierarchy → spacing → copy → motion; apply today's motion grammar + dot/title rulings where they echo.
2. **Home copy review** (Founder explicitly wants it) — full sweep of Home chrome strings with the audience-context gate: VerificationBanner variants, outcome/request-info/pre-removal modals, UndergroundCodeReadyPrompt, empty/error states ("The wall is still for now."), composer placeholder ("Add a word…"), footer "— held in prayer —", strip fallbacks. Em-dash reduction rule applies to ALL copy. No filler, no melodrama, never coddle.
3. **Pending-state walkthrough** — the original Day-1 brief's step 3 (signed-out → verification-pending → verified first-impressions walk) never ran as its own pass. VerificationBanner is load-bearing; do not relocate.
4. **Board hygiene (NOT touched this session — Jira is stale w.r.t. today).** JQL first, live Jira as source of truth, then:
   - Update whatever ticket covers Home card system if today's changes supersede its description.
   - **Follow-up tickets the Founder WANTS (file-vs-fold is HER open call, asked, unanswered):**
     a. ATN leader composer: verse_text/verse_reference authoring + `content_submission_publish` passthrough (leaders currently cannot attach verse anchors; admin can post-annotate via update).
     b. Admin AnnouncementLeaderCard preview-mock fidelity vs shipped mobile card (letterhead grammar, PageTurnText clamp, verse block).
     c. Post-MVP feed-at-scale knobs (window tightening / curation / digest) — from her "thinking large" question.
     d. Standing: `tag_type` shadow-drop migration (floor-version gated, KAN-335 tail).
   - Comments workstream KAN-343 scope conversation still open (identity stays server-composed — hard line).
5. **Admin push + PR** once she greenlights; then preview-deploy for her smoke. The preview mock must be re-verified against the FINAL mobile card renders (20/25, white dots, verse block, no-ellipsis clamp) — content.css mirror was updated but eyeball it in the preview.
6. **Program registry** — after hamburger + copy review land, close Day 1 in `uat-polish-program-state.md` and author the Day-2 (The Church) handoff per program rules.

## Method notes (hard-won today — do not relearn)

- **She is the repro machine for visual bugs; sims lie by omission.** Her device wraps ≈ 16e at content size "small". Test that cell.
- **Fabric text-measurement is race-prone**: mirror events can fire before listeners attach; LayoutAnimation + text-node prop flips leave stale frames. PageTurnText + useMirrorRearm are the sanctioned mechanisms; extend them, don't fork.
- JS-only day: Metro reload only, EAS untouched — keep it that way.
- One live session per test account across devices (refresh-token rotation signs out the other).
- Founder communication: enumerate 1/2/3, consolidate questions at END, no time estimates, minimal em dashes, plain warm register.
