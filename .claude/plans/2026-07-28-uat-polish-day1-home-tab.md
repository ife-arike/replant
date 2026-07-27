# Session handoff — Personal UAT polish pass, DAY 1: HOME TAB

**Opened:** 2026-07-27 for the 2026-07-28 session. **Program:** 5-day personal UAT polish (one tab per day).
**Registry:** `.claude/plans/uat-polish-program-state.md` — read it first, it carries cross-day state.

---

## What this pass IS, and what it is NOT

**IS:** the Founder's own visual + user-friendliness pass. One tab per day. Copy is addressed alongside layout. The goal is an app that feels **attractive to her and demo-able** — the footage from this pass becomes **the videos that show the world what Replant is**. Treat every screen as something that will be recorded.

**IS NOT:** the final UAT. That one is her community handling the app and giving feedback, and it is the **last gate before pen-test → a separate device pass → final launch requirements**. Do not conflate the two, do not describe this pass as "UAT" without the "personal polish" qualifier, and do not let work here get filed as if it closes the final-UAT gate. See [[release-phase-pipeline]].

**Scope licence (Founder, verbatim):** *"there are no limits to what can change here."* Structure, layout, hierarchy, copy, motion, spacing, card grammar — all in play. This is not a bug-fix pass; it is a make-it-beautiful pass. Do not default to minimal diffs. But: **existing locked rulings still bind** unless she overrides one in the moment (and if she does, that ruling gets updated same-turn per [[feedback-acknowledge-vs-saved]]).

---

## Two standing obligations for EVERY day of this program

### 1. Admin ↔ app must stay in lockstep
Founder: *"admin items need to be updated alongside app changes that impact the affected areas. admin to app should be clean and flowing exactly as intended."*

Before finishing any change, ask: **does an admin surface author, control, or preview this?** If yes, the admin change ships in the same batch. The admin repo is `~/replant-admin` (**pushes = ASK**, push implies PR, preview-first, she merges or grants). Home-tab couplings are mapped below.

### 2. Board hygiene as things change
Founder: *"we also need to make sure the board hygiene is being addressed as things change."*
- Any behaviour/design change that supersedes a ticket's description → **update the ticket**, do not leave it stale.
- New work discovered → **file it** rather than carrying it in prose.
- Closed-by-this-pass → transition it, do not let Done work sit In Progress.
- Live Jira via `getJiraIssue` is the source of truth for key ↔ title ↔ status before citing anything (CLAUDE.md locked rule).
- Transition ids: 31=InProg · 11=Backlog · 2=Testing · 21=ToDo · 41=InReview · 51=Done · 4=Cancelled.

---

## DAY 1 TARGET: the Home tab

### What the leader actually sees, top to bottom
`src/screens/main/HomeScreen.tsx` composes a **fixed top zone** then a scrolling feed:

1. **`HomeTopBar`** — Rp mark + "Replant" wordmark + hamburger. The hamburger is **Home-tab only** ([[feedback-hamburger-menu-location]]); `HamburgerPanel.tsx` is its content, and it is the entry to **Address the Network** and Outreach (hamburger, never a tab).
2. **`VerificationBanner`** — only when `branch === 'pending'`. **Load-bearing, do not remove or relocate** (the file says so explicitly).
3. **`HomeSectionLabel` "Today"** + **`DailyScriptureStrip`** — verse, reference, 3-line clamp with the read-on cue. Rule variant + closing hairline; the fixed zone ends at that hairline.
4. **`HomeSectionLabel` "Network updates"** + **`NetworkFeed`** — a FlatList that **owns its own scroll**, 20/page cursor pagination, 7-day feed window, pull-to-refresh.

### The card system (this is where most of the visual work lives)
`NetworkFeed` routes on `card_type`:

| card_type | component | notes |
|---|---|---|
| `standard` | `AnnouncementCard` | letterhead + rule variants; the "regular card" the title size standard came from |
| `article` / `long_read` | `ArticleCard` | drop cap + derived italic standfirst |
| `leader_word` | `LeaderWordCard` | leader voice, warm surface, Replant seal + frozen byline |
| `encouragement` | `EncouragementCard` | roman-serif lead; **no comment thread by pastoral decision** |
| `together` | `TogetherCard` | Team seal fallback; multi-author seals are post-MVP |
| `call_to_action` | `CallToActionCard` | accent words + arrow, **never a filled button** |
| link present | `LinkCard` | quiet framed resource |

Supporting: `CommentThread` (+`CommentThreadLogic`), `NotificationToast`, `RequestInfoModal`, `VerificationOutcomeModal`, `PreRemovalModal`, `UndergroundCodeReadyPrompt`, `ReplyComposer`.

### Admin surfaces that FEED this tab (the lockstep map)
- **`~/replant-admin` → Announcements** (`src/screens/Announcements.jsx`) authors every feed card. Its Home tab = the **wall** (posts inside the 7-day feed window, pinned + expanded) + the **queue** (scheduled, then drafts, collapsed). **The admin wall window and the app feed window must stay identical** — they were deliberately reconciled to both be 7 days.
- **`~/replant-admin` → Daily Scripture** (`src/screens/Scripture.jsx`) authors the Today strip.
- **Submissions queue + "Leader replies" sub-tab** → leader-authored cards reaching the feed.
- Column semantics that drive rendering: `card_type` (router) · `badge` (eyebrow register: none/new/urgent) · `topic` · `source_label` (frozen byline) · `source_sublabel` (church line) · `link_url`.
- **Admin previews must match the real card.** The preview-fidelity ruling is already locked; if a card's rendering changes on Day 1, **the admin preview mock changes in the same batch** or the previews start lying.

---

## Known open items already touching Home (inherit, do not rediscover)

1. **`source_label` is semantically overloaded** — byline on leader cards, CTA button label, LinkCard resource label, and it was formerly mapped into the Encouragement verse slot. Clean fix is a dedicated verse column or an unmap. This is content-build open item #14 and it is a real Day-1 candidate since it affects card rendering.
2. **Together multi-author seals** — post-MVP (Founder 2026-07-24). The Team-seal fallback is the intended MVP state; do not "fix" it into fake seals. [[postmvp-together-multi-author-seals]]
3. **Comments workstream** — KAN-343, scope undefined, Founder has plans. The MVP thread now rests at 5 with "show N earlier comments" ⇄ "hide earlier comments". **Hard constraint: identity display stays server-composed** ([[postmvp-comments-workstream]]).
4. **AnnouncementLeaderCard preview mock in admin** may be stale vs the shipped mobile card (letterhead grammar, time top-right, gated fold). Fidelity pass owed.
5. **`network_updates` = event log, not summary cards** — do not seed quantitative cards ([[postmvp-network-updates-quantitative-cards]]).

## Rulings that bind Home (violating these is a regression, not a redesign)

- **Read-on cues ONLY on real overflow**, app-wide; the pair is show/hide, never expand-only. The measurement must stay **self-correcting** — never latch the first `onTextLayout` (that trap cost 3 attempts; [[ruling-read-on-overflow-gating]]).
- **Feed card titles: one size**, the shared `FeedTitle` token (21/26). Note: ArticleCard's long-read head was flattened into it — she accepted, but it is a live candidate to revisit on Day 1 if the long-read should stand out again ([[typography-ruling]]).
- **`scriptureItalic` for scripture/editorial/witness ONLY.**
- **Identity display is server-composed.** No client-side name composition, ever ([[f11-display-name-preference-honoured]]).
- **No toasts** on admin; in-place confirmation ([[admin-dashboard-ux-audit-2026-07-13]]).
- **Copy:** audience-context gate before ANY string, no filler, no melodrama ([[feedback-no-filler-copy-audience-context]]); **minimise em dashes** ([[feedback-reduce-em-dashes]]); never close liturgically ([[feedback-no-in-jesus-name-signoff]]).
- **CD visual restraint:** no new primitives, nothing "videogamey", NO gamified prayer ([[feedback-cd-visual-restraint-register]]).
- Underground/anonymity invariants are non-negotiable regardless of visual goals.

---

## Working method for Day 1

1. **Open in prayer** naming this work (standing rule).
2. **Look before proposing.** Metro on 8082 + her device, or the simulator. She has an Expo tier build limit: **JS-only changes need only a Metro reload, never a build** ([[feedback-avoid-burning-eas-builds]]). Verify with the git diff check before ever firing EAS.
3. **Walk the tab as a new leader would** — signed out → verification-pending state → verified state. The pending state is a real user's first impression and is easy to forget.
4. Propose changes **grouped by what the eye hits first** (hierarchy → spacing/rhythm → copy → motion), not file by file.
5. **Confirm before building** on anything structural ([[feedback-confirm-before-building]]); small visual calls can just be made.
6. **Device-verify before claiming fixed** ([[feedback-dont-speculate-ship]], cap 2 tries per symptom, then instrument instead of theorising).
7. **Admin lockstep + board hygiene before the day closes.**
8. Update the registry file with what landed, what she rejected, and what carries into Day 2.

## Day 1 opening question for her
Ask what bothers her most about Home *right now* — chase her hypothesis first ([[feedback-chase-founder-hypothesis-first]]) rather than leading with an audit. Then offer the walk.

---

## Repo state at handoff (2026-07-27)
- Mobile `~/replant`: main `559b7ad`, working tree clean, 0 open PRs, branch `feat/persecuted-new` level with main.
- Admin `~/replant-admin`: main `c01fed1`, 0 open PRs.
- All KAN-338/339 identity work applied live and merged. Regression register: `.qa/kan338-identity-pins.sql` (run after any migration).
- Test fixtures live on the wall: 13 seeded comments across 5 cards incl. a 9-comment thread and long-name stress cases. Cleanup register: `.qa/2026-07-27-kan338-test-comments-register.sql` — **decide whether to keep these for the demo footage or clear them.**
