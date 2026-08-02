# Personal UAT polish pass — program registry (read FIRST in every polish session)

**What this is:** the Founder's 5-day personal UAT polish — one tab per day, visual + user-friendliness + copy, no limits on what can change. Output must feel **demo-able**: this pass generates the videos that show the world what Replant is.

**What this is NOT:** the final UAT (community members handling the app — that is the last gate before pen-test → separate device pass → final launch requirements). Never conflate them.

**Standing obligations every day:** (1) admin ↔ app lockstep — admin surfaces update in the same batch as app changes that affect them; (2) board hygiene — tickets updated/filed/transitioned as things change, live Jira as source of truth.

| Day | Tab | Handoff | Status |
|---|---|---|---|
| 1 | Home | `.claude/plans/2026-07-28-uat-polish-day1-home-tab.md` → **CONTINUATION: `.claude/plans/2026-07-28-day1-home-continuation-handoff.md`** | IN PROGRESS — feed DONE + **PR #119 MERGED (2026-08-02)**; **hamburger pass DONE (2026-08-02, PR from `feat/uat-day1-hamburger`)**; board ledger on KAN-5 c.16489; admin **PR #86 open awaiting Founder preview smoke**; REMAIN: Home chrome copy review · pending-state walkthrough · /join site deploy (permission-gated, Founder runs) |
| 2 | The Church | not yet written — author at end of Day 1 with carryover | pending |
| 3 | Persecuted | not yet written | pending |
| 4 | Prayer Wall | not yet written | pending |
| 5 | Connect | not yet written | pending |

(Tab order above assumes the bottom-bar order Home · The Church · Persecuted · Prayer Wall · Connect; Founder may resequence — update this table if she does.)

## Day 1 landed (2026-07-28, all sim-verified; memory: `rulings_2026_07_28_day1_home_polish.md`)
- FeedTitle 21/26 → **19/24** (+ AnnouncementCard/LinkCard hardcode sweep); scripture strip stays 21 → verse leads the page.
- Green dots retired on Home: Leader word / Encouragement / Together = white; sky 'new' dot breathes (3400ms); urgent halo unchanged; PublishPreviewCard dot followed.
- "Long read" display retired → both article types eyebrow "Article"; admin taxonomy relabelled; editor hides long_read for new posts; link row = "Read the full article →".
- Article-family posts REQUIRE link (FE editor + BE post-announcement; drafts exempt).
- **Verse anchor shipped**: announcements.verse_text/verse_reference (CHECKs: len + text⇒ref), ScripturePull on all 6 cards, admin editor fields + preview mock. ONE anchor per post by design.
- Encouragement voice: displayMedium 18/28 + breathing white dot (off the title register).
- Motion package: StaggerRow feed entrance (replayToken prop), strip mount fade, reduced-motion aware.
- **read-on/fold regression KILLED for good** — 3 distinct event-loss mechanisms found + fixed (opacity-0 mount ancestor, warm-remount event loss, cold-mount race → useMirrorRearm). Deterministic across 3 cold launches. Details in `ruling_read_on_overflow_gating.md`.
- Wall reseeded: 10 live posts (June register, every card type, verses, links, 28 comments across named/anon/UG/no-church personas incl. Founder's verbatim comment lines) + 1 scheduled + 1 draft. Registers: `.qa/2026-07-28-day1-wall-reseed.sql` + `.qa/2026-07-28-day1-wall-wipe-snapshot.json`. Identity pins green.

## Day 1 walk feedback — landed same session (all sim-verified)
- FeedTitle bumped +1 → **20/25** (admin preview mock followed).
- **Dot motion = URGENT-ONLY** (breathing on new/encouragement reverted).
- **Named leader avatars show the NAME initial** via new server-composed `announcements.source_initial` (NULL = sealed → seal; SEC F1 intact). Founder caught the role-as-initial recurrence; client derivation is forbidden.
- Long name/ministry ellipsis on leader-voice author rows (flexShrink + numberOfLines=1).
- Inline scriptures = prose by design (no parsing); anchor = the one lift. Founder: "not mad at the anchor look."
- Comment thread: empty state "No comments yet. Be the first." (viewer-aware); spinner removed — rows ease in (220ms opacity). P10 CTA card intentionally left at 0 comments as the living empty-state fixture.
- Comment gating re-verified end to end: composer hidden unless branch active; post_comment server gate requires verified+active (not_authorized otherwise). Read stays open to pending leaders.
- Expanded-body cutoff → **SOLVED ARCHITECTURALLY: PageTurnText** (src/components/home/). Journey: key-flip fix held cold-mount but any later LayoutAnimation re-tore it; a maxHeight crop reproduced a tear locally (16e @ small text — which also wrap-MATCHED her device, pinning her config as below-default Text Size). Root truth: any clamp prop/height constraint reaching a Fabric text node's measure pass can reflow it. PageTurnText = one Text node, one config forever (no numberOfLines, absolutely pinned in a height-window sized from the engine's own line metrics, self-measuring — mirrors retired everywhere). Verified at her matched config through collapse/expand/9-comment-thread/fold. Collapsed state no longer shows "…" (cue is the signal) — **Founder ACCEPTED the trade-off** ("ready to compromise with that", 2026-07-28).

## Hamburger pass landed (2026-08-02, all sim-verified on the 16e cell; branch `feat/uat-day1-hamburger`)
- Walked ALL entries: panel, The Vision, Outreach & Missions, FAQ, Invite (modal), ATN (intro + Compose + composer + My Submissions), Settings top level. Panel + screens structurally healthy; CD v5 grammar kept, nothing structural changed.
- **FAQ search made LIVE** (was `editable={false}` stub): case-insensitive filter over question + answer, accordion keyed by question text, original numbering preserved while filtering, quiet no-match line, contact card always reachable.
- **Copy sweep** (em-dash ruling + audience gate): Vision lede/para, FAQ answers (+ "two (2)" contract-speak), Outreach limits note, invite share message. Outreach: doubled empty-hint differentiated, straight quotes dropped from the Zech 7:10 anchor, coming-soon body de-jargoned ("surface" removed), "Prayer Wall" capitalised as the tab's proper name.
- Panel: "Log out" → **"Sign out"** (matches its own confirm Alert + auth register); "No church registered" case fix.
- Invite: full URL + RPL code now visible (adjustsFontSizeToFit, was truncating at "RPL…"); **`/join` was a 404** → `website/_redirects` 302s to the homepage (DEPLOY PENDING — permission-gated, Founder runs `npx netlify deploy --prod --dir website`).
- ATN composer: title placeholder aligned to the title-REQUIRED ruling (was "or leave it as…"); "the Body in love" capitalised.
- **Feed pluralisation fix** (found on-camera during verification): "1 comments" → shared `commentCountLabel` in CommentThreadLogic + jest cases, swept across all five commenting cards; CommentThread retry line em dash removed.
- **Wall top-up** (Founder: new posts, not re-pins): 5 posts P13–P17 restore every aged-out register incl. named leader word w/ verse pull + `source_initial` 'D' + 7-comment fold thread, and CTA at 0 comments as the live empty-state fixture. Register `.qa/2026-08-02-day1-wall-topup.sql`. **7-day window CONFIRMED single/global** (rulings file item 18); Word-for-Today short-life parked as the first feed-at-scale knob.
- Referral answer on record: nothing captured at signup today (no column, no admin field); admin referred-by surfacing folds into the future Invite-to-Replant feature (memory updated).
- Parked, deliberately NOT done: reduced-motion on the panel slide + hamburger screens; scripture-block grammar unification (Vision rail vs Outreach hairlines vs ScripturePull) — both CD-locked designs, raise only if Founder wants them.
- **Settings walk (Founder asked "no finds in settings?" — full accordion walk done 2026-08-02, commit `0b476ff`):** footer John 17:21 reference was MALFORMED ("JOHN 17 · 21 · KJV") — fixed; verse straight quotes dropped; anon-mode helper + RAG descriptions + RAG label de-em-dashed (comma/colons/middot). EMAIL_NOTIF_OFF_HELPER left alone (Founder-ratified verbatim 2026-07-13). Account/Notifications/Language interiors clean; About doc rows are coming-soon by design (legal docs pending). Sign out at the bottom already matched the panel fix.

## Cross-day carryover
- **FAQ content pass owed by FOUNDER** — she will go through the question list again and make updates (2026-08-02: "i need to go through this list again"); the mechanical/copy cleanups are done.
- **Day-1 push state (updated 2026-08-02):** mobile **PR #119 MERGED** (`ac0cc76` on main — Founder greenlight). Admin lockstep **pushed, PR #86 OPEN** (`feat/uat-day1-home-lockstep`, `37d29d9`) — Founder smokes the Netlify branch preview and SHE merges; never touch admin main.
- **Admin preview-mock full fidelity pass** (handoff open item 4) — title size + verse done today; letterhead grammar/time-top-right/gated fold cue still owed (mock renders "read on" unconditionally).
- **Leader ATN submissions don't carry verse fields** — content_submission_* + composer lack verse_text/verse_reference; file as ticket (folds naturally into the Content/ATN workstream).
- **BE update-announcement doesn't enforce article-link** on partial patches (FE editor always sends full state; insert path enforces). Line-item for the KAN-341-era hardening.
- Wiped submission pointer: content_submissions 24708ec3 published_announcement_id → NULL (row kept).

## Rulings changed during this pass
- **FeedTitle one-size ruling: value changed 21/26 → 19/24, then +1 → 20/25 after her device walk** (Founder 2026-07-28); scripture-leads hierarchy added. Recorded in `rulings_2026_07_28_day1_home_polish.md` same turn.
- **Dot motion = urgent-only** (breathing dots reverted same day). Same file, item 2.
- **PageTurnText clamp + no-ellipsis compromise accepted** ("ready to compromise with that"). Same file, item 16.
- **Day-1 follow-up tickets FOLD INTO the UAT polish pass** (Founder 2026-08-02) — no standalone filings now; pass umbrella carries them; anything unfinished at pass close gets filed then. Same file, item 17.
- **Together/leader-voice dot register: green → white** (Founder 2026-07-28). Same file.
- **long_read display retired** (Founder: "change 'long read' to 'Article' permanently"). Same file.
