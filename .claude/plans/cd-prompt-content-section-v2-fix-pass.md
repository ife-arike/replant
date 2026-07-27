# CD BRIEF — Content Section v2 FIX PASS (register + simplification)

## Opening prayer (hard rule)

Open this work with a real intercession naming what these screens carry: the curators who will sit at this desk composing words that reach leaders in hiding — a scripture that lands in a prison cell's morning, an announcement read by a pastor deciding whether to gather this week, a witness testimony that steadies someone facing what that witness faced. Pray that the surfaces you design make the curator's hand steady and the leader's reading undistracted. Cover the work in the blood of Jesus Christ. End with "In Jesus' name, Amen."

## Who you are

Senior design lead at Replant. You design admin surfaces that a small team works for hours at a stretch; restraint is your craft signature. You carry the copy register — clinical, peer-respecting, never coddling — and now you carry the **visual register** with the same discipline.

## What Replant is

A secure communication platform for Christian leaders globally, including underground/persecution-zone leaders. The admin dashboard at `admin.projectreplant.org` is run by Ruth and a small team (tiers: regular admin / super_admin / Manager). The Content section — Announcements, Daily Scripture, Outreach & Missions — is where the team composes everything the network reads.

## Why a v2 exists — read this first

Your v1 pack was **structurally ratified and visually rejected.** The Founder's verdict, verbatim:

> "i kind of hated what claude design came up with… lots of things look very childlike, videogamey, and not professional at all."

This is the second time this failure mode has been named. On the pastoral wireframes (c.11631) the correction was:

> "blend better with existing admin portal. Feels too videogamey."

The bones of v1 are good and they stay. The costume goes. v2 is the same pack — same 16 screens, same workflow, same field mappings — re-rendered in the admin dashboard's actual register, and simplified per the rules below.

## What is RATIFIED and must not change

- Workflow tabs on every surface: **Home / Drafts / Posted** with counts. Home = today's + next-scheduled expanded, rest collapsed.
- Card default collapsed; chevron click-to-expand.
- Multi-select checkboxes + bulk bar on selection > 0 (Delete / Archive / Publish now / Reschedule), per-row audit note.
- **Publish-lock + correction**: published posts immutable; "Draft a correction" threads a new post via `correction_of` FK; correction affordance lives inside the Posted row's expand, beneath the lock cue.
- Filter drawer: right-side slide-in, **State first**, then Author, Date range, then surface facets.
- Pagination: **10 per page**, Posted supports load-on-demand.
- Preview / Test send / Duplicate / Version history (drafts only, freezes at publish) / analytics ghost seat.
- Submissions review queue as a filtered sub-surface under Announcements (count on the toolbar), 4 triage actions (Approve / Approve with edits / Decline with reason / Route to another curator).
- The right-drawer chassis shared by filters, preview, and version history.
- The five-field Announcements reconciliation: Source (`author_type`: admin/leader/partner/blog, drives conditional fields + approval flow) · Byline (`source_label` ≤30, live counter) · Topic (`topic`, required) · Badge (`badge`: none/new/urgent, default none) · Card type (`card_type`, behind Show more).
- Witness of the Day as a **sibling tab** under Announcements with its own data model and editor.
- Copy voice register (unchanged, load-bearing):

> Replant admin copy is clinical, peer-respecting, never coddling. Banned: "Are you sure?" / "Oops!" / "Heads up!" / exclamation marks in confirmations. Keep heavy phrases only where literally true: "audit-logged", "Locked", "cannot be undone". The confirm IS the action.

> scriptureItalic (serif italic) is reserved for scripture / editorial / witness quotes ONLY. All admin chrome is roman. No italic-for-emphasis.

## REGISTER DIRECTIVES — hard constraints, none negotiable

1. **No new visual primitives.** Every element must already exist in `globals.css` — `q-tabs`, `.rp-btn`, `.rp-pill`, `.state` pills, mono uppercase eyebrows, `.rp-card`. If v2 genuinely needs a new primitive, name it and justify it in the README; default is you don't.
2. **Top-level tabs are underlined `q-tabs`, not a filled segmented control.** Founder-locked: one tab grammar across the whole dashboard. Announcements ↔ Witness of the Day renders as a second q-tabs row (or a single q-tabs row with the workflow tabs nested per your judgment — but the vocabulary is q-tabs).
3. **Chip discipline: a collapsed row carries at most ONE colored chip beyond the state pill.** Everything else is mono text.
4. **TODAY / NEXT UP are mono uppercase eyebrow text, not colored marker pills.**
5. **All action buttons are ghost/white** — including the submissions queue's Approve and Decline. No green/amber/red button fills anywhere in this pack. (Founder ruling from the Escalated Cases pass; destructive color returns only when an action is literally destructive, and nothing in Content is.)
6. **No toasts.** The dashboard is retiring toasts globally. Confirmation is **in-place state change**: the state pill flips, the row moves to the right tab, the lock cue appears. If an operation needs acknowledgment beyond that, it's a modal ceremony, not a floating flash.
7. **No toy phone chrome.** Previews render the leader card on a plain dark surface — no notch, no fake status bar, no invented tab bar. (Your v1 phone frame showed a Home/Scripture/Outreach/Prayer/More tab bar that does not exist in the app. Real app tabs: Home / The Church / Persecuted / Prayer Wall / Connect. Outreach lives in the hamburger menu — see functional corrections.)
8. **No gamification of spiritual practice — ever.** The Phase 3 prayer-coverage progress bars and goals are cut. Prayer renders as a plain count if it renders at all. This platform serves the persecuted Church; intercession is not a meter to fill.
9. **No dev scaffolding rendered in screens.** The field/column mapping tables move to the README exclusively. The explainer caption bands ("CD call Q5: kept as a filtered sub-surface…", "Witnesses carry their own fields…") are deleted from the UI — screens explain themselves or the README does.
10. **Color budget per screen: state pills + one accent.** Type and spacing carry hierarchy.

## SIMPLIFICATION RULES — the "one job per level" system

The Founder wants this pack to feel **simpler and cleaner**. The v1 clutter diagnosis: every card was a small dashboard and every screen rendered its own documentation. v2 gives each level exactly one job:

1. **Collapsed row = one line.** Title · state pill · date. Nothing else — no source/topic/badge chips, no byline, no checkbox until the surface enters selection (checkbox appears on hover / on first selection, per your judgment).
2. **Expanded card = the content.** Body text first. Meta compresses to ONE quiet mono line (`call to action · Ruth · push on`). Actions: **Preview** + a `⋯` overflow holding Test send / Duplicate / History. Not five buttons.
3. **Editor = a writing surface, not a database form.** Title and Body dominant at the top. Classification (Source / Topic / Badge) as one compact row of selects beneath. Delivery (Card type / Push / Targeting) behind Show more. **No "maps to author_type" hints in the UI** — the column mapping lives in the README.
4. **One control band.** Workflow tabs with Filters / Submissions / New right-aligned on the same row. No second toolbar row, no sort-note microcopy line.
5. **Whitespace over boxes.** Fewer bordered sub-panels inside cards; let spacing separate.

The Founder ratified this direction but wants to **see it before final sign-off** — treat these as the design thesis of v2, and make the pattern reference sheet demonstrate them explicitly (before/after density is welcome on that sheet).

## FUNCTIONAL CORRECTIONS — v1 assumed things the real system contradicts

### 1. Witness of the Day — remap to the REAL schema (Founder-locked)

Your v1 field map invented columns. The real table (migration `20260607000001_persecuted_multipage_tables.sql`, applies at build):

```
witnesses (
  id              uuid PK,
  era             text NOT NULL,
  years_label     text NOT NULL,          -- e.g. "c. 182 – 203" (one label, not year_from/to)
  name            text NOT NULL,
  region          text,                   -- singular text, not an array
  category        text NOT NULL CHECK IN ('Martyr','Father of the Faith','Mother of the Faith','God''s General','From Scripture'),
  martyr          boolean NOT NULL DEFAULT false,
  quote           text NOT NULL,          -- REQUIRED — the witness's own words
  scripture_ref   text NOT NULL,
  scripture_text  text,
  description     text,                   -- the testimony/summary body
  source_attribution text,
  published_at    timestamptz,
  rotation_day    int
)
```

Editor fields = exactly these. `quote` is required and is the serif-italic centerpiece of the card; `description` is the roman body; `category` is a required dropdown of the 5 values; `martyr` is a toggle.

**Rotation model, not schedule model:** the app derives "today's witness" by day-of-year rotation (`get_witness_of_day()` — day-of-year modulo roster count). Witness admin Home is therefore **rotation-aware**: "Today's rotation" is computed, not scheduled. Shape the witness workflow as **Today (derived) / Roster (published witnesses, the rotation pool) / Drafts** — do not apply the scheduled-date grammar of announcements to witnesses.

**No portrait slots.** Type-led witness cards — name, era, years_label, the quote. Dignified, and no photo-rights sourcing problem for martyrs.

### 2. Daily Scripture — multi-translation is CUT

The live DB enforces `UNIQUE (scripture_date)` — one scripture per date, one translation. Remove the "Allow multiple translations this date" toggle entirely. (Leader-side translation preference is a distant post-MVP idea; nothing in this pack anticipates it.) Everything else in the scripture editor stays: date + translation + reference autocomplete + theme + verse + reflection + prompt + related verses + Schedule CTA.

### 3. Announcements editor — ADD a Schedule affordance

v1's editor could only Publish, but scheduled announcements exist across the pack and the backend already accepts `scheduled_for`. Add schedule-for-later beside Publish (your call on the control: split button, date field revealed on demand — keep it quiet).

### 4. Leader-card badge labels

- `badge = new` renders "NEW" on the leader card — v1 rendered "NOTICE", which is retired vocabulary.
- `badge = none` renders a neutral eyebrow ("FROM REPLANT" or topic-derived) — v1's "NETWORK UPDATE" collides with topic=update.

### 5. Outreach & Missions placement (Founder-locked)

The leader-side Outreach & Missions page lives in the **hamburger menu**. There is no Outreach tab and none is being added. The "leader mobile view" screen renders the outreach cards on a plain surface with a one-line context note (reached via hamburger → Outreach & Missions). Real app tab bar is never mocked with invented tabs.

### 6. Curation tier

Content is curated by **any admin tier** (matches the live backend gate). Correct the harness note that said "curated by super_admin." A post-approval flow (admin posts → higher-tier approves) is post-MVP and out of scope for this pack.

## Files to READ before designing

- `/Users/ife/replant/docs/design_handoff_content_section/` — your v1 pack (the structure you're preserving)
- `/Users/ife/replant-admin/src/styles/globals.css` — the ONLY primitive vocabulary
- `/Users/ife/replant-admin/src/screens/PastoralQueue.jsx` — the register anchor: mono eyebrows, restrained banners, ghost buttons
- `/Users/ife/replant-admin/src/screens/EscalatedCases.jsx` — sibling register anchor: state pills, quiet tables, ceremony modals
- `/Users/ife/replant-admin/src/screens/Flagged.jsx` — the just-shipped mirror of Pastoral (parity discipline example)
- `/Users/ife/replant/supabase/migrations/20260607000001_persecuted_multipage_tables.sql` — the real witnesses schema + rotation RPCs

## Deliverables

Same format as v1: the clickable prototype (same file structure — `preview/index.html` + jsx + css) plus README. Revise in place conceptually — v2 replaces v1. README gains a **"v2 — what changed and why"** section listing every register/simplification correction so the Founder can audit the diff. Keep the 16-screen scope; the Phase 2/3 concept screens follow the same register rules (the Phase 3 marketplace loses its progress bars and stat-tile styling — plain counts, quiet cards).

Consolidate anything you need the Founder to rule on to **at most 5 questions** at the end of the README. Do not re-ask what this brief already locks.

## What NOT to do

- Do not redesign the ratified structure (tabs, lock/correction, filters, pagination, submissions queue).
- Do not introduce tokens, colors, fonts, or components outside `globals.css`.
- Do not render field-mapping tables or CD commentary inside screens.
- Do not use toasts, progress bars, colored marker pills, filled segmented controls, or phone-frame chrome.
- Do not design the post-approval flow, analytics widgets, i18n, or comment moderation.
