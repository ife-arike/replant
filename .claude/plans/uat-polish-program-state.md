# Personal UAT polish pass — program registry (read FIRST in every polish session)

**What this is:** the Founder's 5-day personal UAT polish — one tab per day, visual + user-friendliness + copy, no limits on what can change. Output must feel **demo-able**: this pass generates the videos that show the world what Replant is.

**What this is NOT:** the final UAT (community members handling the app — that is the last gate before pen-test → separate device pass → final launch requirements). Never conflate them.

**Standing obligations every day:** (1) admin ↔ app lockstep — admin surfaces update in the same batch as app changes that affect them; (2) board hygiene — tickets updated/filed/transitioned as things change, live Jira as source of truth.

| Day | Tab | Handoff | Status |
|---|---|---|---|
| 1 | Home | `.claude/plans/2026-07-28-uat-polish-day1-home-tab.md` → **CONTINUATION: `.claude/plans/2026-07-28-day1-home-continuation-handoff.md`** | IN PROGRESS — feed DONE incl. device-walk feedback; **PR #119 OPEN (Founder merges)**; hamburger + copy review + board hygiene remain |
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

## Cross-day carryover
- **Hamburger panel pass** — Founder wants it inside the Day-1 session, after the main-screen walk.
- **Day-1 push state (2026-07-28 end-of-context):** mobile batch committed `b5a3e37`, pushed, **PR #119 open** (`feat/persecuted-new` → main; Founder smokes + merges). Admin lockstep committed LOCALLY on `~/replant-admin` branch `feat/uat-day1-home-lockstep` (`37d29d9`, main untouched) — **push = ASK (greenlight requested, pending) + push implies PR + preview-first**.
- **Admin preview-mock full fidelity pass** (handoff open item 4) — title size + verse done today; letterhead grammar/time-top-right/gated fold cue still owed (mock renders "read on" unconditionally).
- **Leader ATN submissions don't carry verse fields** — content_submission_* + composer lack verse_text/verse_reference; file as ticket (folds naturally into the Content/ATN workstream).
- **BE update-announcement doesn't enforce article-link** on partial patches (FE editor always sends full state; insert path enforces). Line-item for the KAN-341-era hardening.
- Wiped submission pointer: content_submissions 24708ec3 published_announcement_id → NULL (row kept).

## Rulings changed during this pass
- **FeedTitle one-size ruling: value changed 21/26 → 19/24, then +1 → 20/25 after her device walk** (Founder 2026-07-28); scripture-leads hierarchy added. Recorded in `rulings_2026_07_28_day1_home_polish.md` same turn.
- **Dot motion = urgent-only** (breathing dots reverted same day). Same file, item 2.
- **PageTurnText clamp + no-ellipsis compromise accepted** ("ready to compromise with that"). Same file, item 16.
- **Together/leader-voice dot register: green → white** (Founder 2026-07-28). Same file.
- **long_read display retired** (Founder: "change 'long read' to 'Article' permanently"). Same file.
