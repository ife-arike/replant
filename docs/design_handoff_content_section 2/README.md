# Content Section — Admin CD · v2

The **shared Content pattern** + its three surface applications —
**Announcements**, **Daily Scripture**, **Outreach & Missions** — re-rendered
in the admin dashboard's own register. Design once, apply everywhere: the three
surfaces (and every future Content surface) are the same shell with different
content. That repetition is the thesis, not a shortcut.

v2 keeps every ratified bone of v1 and replaces the costume. The v1 pack was
**structurally ratified and visually rejected** ("childlike, videogamey, not
professional") — the same failure named earlier on the pastoral wireframes
("feels too videogamey"). This pass re-renders the same 16 screens through
`globals.css` primitives only, and simplifies each level to one job.

## Run the prototype

Open `preview/index.html`. Use the **CD deliverables** panel (bottom-right) to
jump between the 16 screens and flip the viewer tier. Every surface is live:
switch the sibling tabs (Announcements ↔ Witness of the Day), the workflow tabs
(Home / Drafts / Posted), expand/collapse cards, open the filter / preview /
version-history drawers, select draft rows to raise the bulk bar, use the ⋯
overflow menu, and toggle the editor preview.

## The 16 deliverables

**Shared pattern (1)** — Reference sheet: every shared primitive shown once, in
the v2 register, plus the before/after simplification thesis made explicit.

**Announcements (6)** — Home · Drafts (multi-select + bulk) · Posted (lock +
correction) · Editor (writing surface) · Witness of the Day (rotation workflow)
· Submissions review queue.

**Daily Scripture (3)** — Home · Editor (two-column + preview) · Filter drawer.

**Outreach & Missions (6)** — Ph.1 Home · Ph.1 Editor · Ph.1 Leader view ·
Ph.2 Partner intake · Ph.2 Partner profile · Ph.3 Trip marketplace.

---

## v2 — what changed and why

Everything below is a correction to a named v1 defect. Structure, workflow, and
field mappings are unchanged.

### Register directives

1. **No new visual primitives.** The v1 costume (`cs-toplevel`, `cs-marker`,
   `cs-phone`, `cs-toast`, colored `cs-tag` chips, a parallel `cs-state`) is
   deleted. Everything now renders through `globals.css`: `q-tabs`, `.rp-btn`
   (+ `-ghost` / `-primary`), `.rp-pill`, the `.state` pill family, `.rp-card`,
   `.rp-input`, and mono uppercase eyebrows. `content.css` is now layout-only.
2. **Top-level tabs are `q-tabs`, not a segmented control.** Announcements ↔
   Witness of the Day is the upper `q-tabs` row (a notch heavier so the two
   rows read as hierarchy, mirroring the app's TriageTabBar + inner tabs), with
   the workflow `q-tabs` beneath. One tab grammar across the dashboard.
3. **Chip discipline.** A collapsed row carries no chips at all now — title ·
   state pill · date. Source / topic / badge / byline moved into the expanded
   card's single mono meta line.
4. **Today / Next up are mono eyebrows,** not colored marker pills. Today
   carries the one sky accent; Next up is muted.
5. **All action buttons are ghost.** Submissions Approve / Decline, partner
   Approve / Decline, and the bulk bar are all ghost. No green / amber / red
   fills anywhere — nothing in Content is destructive, so the confirm carries
   the weight, not the color. The single sky-primary CTA per surface
   (Post to Feed / Schedule / Publish) matches the shipped Announcements screen.
6. **No toasts.** Confirmation is the in-place state change — posting a draft
   removes it from Drafts (it moves to Posted); the pill flips. When an
   operation needs more acknowledgment (test send, correction, bulk delete) it
   is a modal ceremony, not a floating flash.
7. **No phone chrome.** The preview renders the leader card on a plain dark
   surface — no notch, no fake status bar, and no invented tab bar (v1's
   Home/Scripture/Outreach/Prayer/More bar does not exist in the app).
8. **No gamification of spiritual practice.** The Phase 3 prayer-coverage bars,
   goals, and stat tiles are cut. Prayer renders as a plain count.
9. **No dev scaffolding in screens.** The field/column mapping tables moved to
   this README (below). The CD-commentary caption bands are deleted — screens
   explain themselves; the README explains the rest.
10. **Color budget: state pills + one accent (sky).** Type and spacing carry the
    hierarchy.

### Simplification — one job per level

1. **Collapsed row = one line** (marker · title · state · date). The checkbox
   appears on hover / once selection begins.
2. **Expanded card = the content.** Body first; meta compresses to one quiet
   mono line; actions are **Preview + a ⋯ overflow** (Test send / Duplicate /
   History), not five buttons.
3. **Editor = a writing surface.** Title + Body dominant; classification
   (Source / Topic / Badge) in one compact select row; delivery (Card type /
   Push / Targeting) behind Show more. No "maps to author_type" hints in the UI.
4. **One control band** — workflow tabs with Filters / Submissions / New
   right-aligned on the same row, sharing the underline.
5. **Whitespace over boxes.**

### Functional corrections

1. **Witness of the Day remapped to the real schema** (migration
   `20260607000001`). Editor fields are exactly the columns; `quote` is required
   and is the serif-italic centerpiece; `category` is the 5-value dropdown;
   `martyr` is a toggle; **no portrait slots.** The workflow is rotation-aware —
   **Today (derived) / Roster / Drafts** — not the scheduled grammar of
   announcements.
2. **Daily Scripture multi-translation is cut** (DB enforces
   `UNIQUE (scripture_date)`). One scripture per date, one translation.
3. **Announcements editor gained a Schedule affordance** ("Schedule for later"
   reveals a datetime; the CTA switches to Schedule) — the backend already
   accepts `scheduled_for`.
4. **Leader-card badge labels:** `new` → "NEW" (was "NOTICE"); `none` →
   topic-derived eyebrow, fallback "FROM REPLANT" (was "NETWORK UPDATE").
5. **Outreach lives in the leader hamburger menu** — no Outreach tab is mocked;
   the leader view is a plain surface with a one-line context note.
6. **Content is curated by any admin tier** (matches the live gate). The harness
   note is corrected.

---

## Review round 2 — changes from your notes

- **Byline auto-populates from the author, and stays editable.** Selecting a
  Source fills the byline from a template (leader → the leader's role + region,
  partner/blog → the org name); admin posts carry the Replant Team seal with no
  byline. A manual edit takes over, with a "Reset to the author template" link.
- **"Word from family" removed from Announcements.** `word_from_family` (topic)
  and `leader_word` (card type) are gone from the editor and the sample data —
  "A Word for Today" is a **Persecuted-tab** feature (a sibling of Witness of
  the Day), not Content, and shouldn't be filable as an announcement. Standing
  it up on the Persecuted tab is out of scope for this pack (flagged for CC).
- **Link / article / blog examples** now render as the real app cards:
  `card_type = link` renders the framed **LinkCard** resource well;
  `article` / `long_read` render the AnnouncementCard with the "read on"
  affordance; `source = blog` carries the syndicated byline. Needs a new
  `announcements.link_url` column (flag for DBA — noted on the real `LinkCard`).
- **Preview cards rebuilt to match the shipped app** (`home-tab-handoff`
  `AnnouncementCard` / `LinkCard` / `ScriptureStrip`): dot + hairline eyebrow,
  21pt Cormorant title, 15pt body, the read-on rule, the seal + Replant Team
  footer, and the unboxed scripture strip with the hanging quote.
- **Scripture reference is now structured** — Book (canonical dropdown) +
  Chapter (bounded to the book's chapter count) + Verse — so an admin can't
  post "Habbakuk" or give Jude a chapter it doesn't have.
- **Scripture reflection + related held as Post-MVP.** The MVP editor is the
  verse; reflection, prompt, and related verses live in a clearly-marked
  Post-MVP panel so the shape is agreed without shipping early. Leader preview
  shows the verse-only card.
- **Theme is optional and expanded** (~20 values incl. a "— none —"). Open
  question below on whether it stays a curated list, becomes a free tag, or is
  dropped.
- **Filter drawer lightened.** State / Author / Date range stay visible; the
  surface-specific facets fold behind a "More filters" disclosure so the drawer
  reads calm on open.
- **Multi-select entry made discoverable.** On Drafts the checkbox column shows
  faintly at rest and solid on hover / selection — so the way in is visible
  before you commit. Selecting any row raises the bulk bar.
- **Witness roster ties to the spreadsheet.** An "Import roster" affordance maps
  the shared witness spreadsheet (Sheets / CSV) to the `witnesses` table; rows
  land as Drafts to review before entering the rotation.
- **Submissions journeys sketched.** Decline opens a required-reason field;
  Route opens a curator picker; Approve / Approve-with-edits are stubbed to the
  publish / editor paths. Full flows + RBAC are a CC build item (below).

## Notes for CC (build-time)

- **Pagination is one component** (`PaginationFooter`) used identically on every
  Content surface — keep it that way in the build (10 per page; Posted =
  load-on-demand). Do not let any one surface fork its own pager.
- **Submissions — the four journeys + RBAC.** Approve (publish now) · Approve
  with edits (open as draft) · Decline with reason (required text → submitter) ·
  Route to another curator (queue handoff). Gate which actions each tier sees;
  any admin tier curates, so scope routing/deletion per the live gate.
- **Witness spreadsheet sync** — decide the source of truth (Sheet ↔ DB one-way
  import, or two-way) and the column→field mapping contract.
- **"A Word for Today"** (word-from-family) belongs on the Persecuted tab; needs
  its own data model + surface, not an announcement type.

---

## Field / column mapping (moved out of the screens)

### Announcements

| Concept | Column | Notes |
|---|---|---|
| Source | `author_type` | admin / leader / partner / blog. Drives conditional fields + approval flow. |
| Byline | `source_label` | text ≤ 30, live counter. |
| Topic | `topic` | required. Filter facet + card decoration. |
| Badge | `badge` | none / new / urgent, default none. |
| Card type | `card_type` | rendering router, behind Show more. Default standard. `link` shows a resource well; `word_from_family` / `leader_word` removed (Persecuted-tab feature). |
| Link URL | `link_url` | **NEW** — required when card type = link (flag for DBA). |
| State | `published_at` / `is_active` | NULL → Draft · > now → Scheduled · ≤ now → Posted. |
| Correction link | `correction_of` | FK → `announcements.id`. |

### Witness of the Day — real schema (`witnesses`)

| Field | Column | Notes |
|---|---|---|
| Name | `name` | text, required. |
| Era | `era` | text, required. |
| Years label | `years_label` | text, required — one label (e.g. "c. 182 – 203"). |
| Region | `region` | text, singular (not an array). |
| Category | `category` | required · Martyr / Father of the Faith / Mother of the Faith / God's General / From Scripture. |
| Martyr | `martyr` | boolean, default false. |
| Quote | `quote` | **required** — the witness's own words; serif-italic centerpiece. |
| Scripture ref | `scripture_ref` | text, required. |
| Scripture text | `scripture_text` | text, optional. |
| Testimony | `description` | roman body. |
| Source | `source_attribution` | text. |
| Rotation | `rotation_day` / `published_at` | "today" derived via `get_witness_of_day()` (day-of-year modulo roster). |

### Daily Scripture

| Field | Column | Notes |
|---|---|---|
| Date | `scripture_date` | **PK · UNIQUE** — one scripture per date. |
| Translation | `translation` | one per date (multi-translation cut). |
| Reference | `reference` | Book (canonical dropdown) + Chapter (bounded to the book) + Verse — structured, not free text. |
| Theme | `theme` | **optional** filter facet (expanded list; open question below). |
| Verse | `content` | serif-italic on the card. |
| Reflection | `reflection` | **Post-MVP** — designed, held. |
| Prompt | `reflect_prompt` | text ≤ 200, **Post-MVP**. |
| Related | `scripture_related` | join → 1–N verses, **Post-MVP**. |

### Outreach & Missions

| Field | Column | Notes |
|---|---|---|
| Mission type | `mission_type` | enum. |
| Location | `location` | text / region. |
| Duration | `date_start` / `date_end` | optional. |
| Apply URL | `apply_url` | url. |
| Coordinating org | `org_id` | FK → `partner_orgs` (Ph.2). |
| Source / Topic / Byline | `author_type` / `topic` / `source_label` | shared with Announcements. |

---

## Ratified structure (unchanged from v1)

Workflow tabs (Home / Drafts / Posted) on every surface · card collapse ·
multi-select + bulk bar (Delete / Archive / Publish now / Reschedule,
audit-logged per row) · publish-lock + `correction_of` threading, correction
affordance inside the Posted row's expand beneath the lock cue · right-drawer
filters (State first, then Author, Date range, then facets) · 10 per page,
Posted load-on-demand · Preview / Test send / Duplicate / Version history
(drafts only, freezes at publish) / analytics ghost seat · submissions review
queue as a filtered sub-surface under Announcements (4 triage actions) · the
five-field Announcements reconciliation · Witness of the Day as a sibling tab.

**Voice (load-bearing, unchanged):** clinical, peer-respecting, never coddling.
Banned: "Are you sure?" / "Oops!" / "Heads up!" / exclamations in confirmations.
"audit-logged" / "Locked" / "cannot be undone" kept only where literally true.
`scriptureItalic` (serif italic) is reserved for scripture / editorial / witness
quotes only; all admin chrome is roman.

## File map

`preview/` — `index.html` · `globals.css` (lifted from the admin) ·
`content.css` (layout-only) · `data.jsx` · `shared.jsx` (all shared primitives)
· `patternsheet.jsx` · `announcements.jsx` · `scripture.jsx` · `outreach.jsx` ·
`app.jsx`.

---

## v2.1 — post-SME-panel corrections (2026-07-22, applied in place)

Four-lane panel (DBA · SEC · CONTENT · BA) reviewed this pack against live prod.
The jsx + this README were patched; where the pack and the panel disagree, the
panel's file-cited findings govern the build. Corrections applied:

1. **`word_for_today` topic + `leader_word` card RESTORED** (Founder): leader-authored
   words are announcements on the Home feed. "A word from your family" (Persecuted-tab
   pager) remains out — two different features. **SEC gate:** UG-origin words publish
   under the Replant Team seal with a frozen role+region `source_label` — never
   `author_type='leader'` live-resolution (D-64 surfaces real names; no UG exclusion
   exists in the feed resolver).
2. **No `card_type='link'`** — the live CHECK has no such value; the app routes to
   LinkCard on `link_url` presence. Options + sample corrected.
3. **`link_url` is NOT new** (live since 2026-06-02, scheme-checked); `correction_of`,
   `topic`, `badge` ARE new — the pack's field tables had this backwards. The DBA
   migration plan (M1–M6) is the schema source of truth: additive `badge` (NO rename —
   a rename breaks the live mobile feed projection), `reference` stays canonical +
   `book` added, witnesses migration carved + corrected (fixed rotation fn,
   `is_published` gate), `content_submissions` table, audit actions from the live
   89-action array.
4. **Route-to-curator CUT** (Founder) — queue is unassigned; 3 actions remain.
5. **Decline modal**: reason placeholder rewritten ("Write this as the leader will
   read it…"), "This cannot be undone" replaced with the literally-true "The email
   sends as soon as you confirm," and a "They'll receive:" preview line added.
6. **Approve / approve-with-edits ceremonies** now name the submitter email;
   the edits email fires at publish of the edited draft, not at the click.
7. **Test send greyed** (Founder) — no endpoint ships at MVP (a greyed button over a
   deployed function is still a live endpoint).
8. **Push toggle ships greyed** — zero push infrastructure exists; real push is its
   own SEC panel (lock-screen exposure is a life-safety surface for UG leaders).
9. **Structured Book/Chapter/Verse entry already exists** in the live Scripture screen
   (full 66-book canon) — reuse it; do not rebuild from this pack's abbreviated list.
10. The **Founder-5 section below is CLOSED** — theme: curated + optional (locked);
    byline template: locked as drawn; Word-for-Today: resolved per #1; stacked q-tabs:
    interim-accepted design debt; test send: no ceremony (greyed anyway).

## For the Founder — 5 rulings before final sign-off (CLOSED — see v2.1 §10)

1. **Scripture theme** — you flagged the 7 as too limited. It is now optional
   with a ~20-value list. Keep it a curated list, make it a free tag, or drop
   the field entirely? (Dropping it removes one scripture filter facet.)
2. **Byline template** — the auto-fill pulls role + region for a leader, the org
   name for partner / blog, and nothing for admin (Replant Team seal). Are those
   the right fields to template from, or is there other poster info to include?
3. **"A Word for Today"** (word-from-family) is now treated as a Persecuted-tab
   feature, removed from Announcements. Confirm it should be spec'd as its own
   Persecuted-tab surface (sibling to Witness of the Day), not a Content type.
4. **Two stacked `q-tabs` rows** (sibling above workflow) on the Announcements
   surface — does the one-notch weight difference read as clean hierarchy, or
   would you rather Witness of the Day become its own sidebar entry so there is
   only ever one tab row?
5. **Confirmation model** — in-place state flip for publish; modal ceremony for
   test send / correction / bulk. Is a ceremony the right weight for a *test
   send*, or should that be silent (state only)?
