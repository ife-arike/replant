# Handoff → Claude Code: Content Section (Admin) · v2

## Overview

The **Content** section of `admin.projectreplant.org` — the **shared Content
pattern** and its three surfaces (**Announcements**, **Daily Scripture**,
**Outreach & Missions**), plus the **Witness of the Day** sibling and the
**Submissions** review queue. 16 screens. This is the register-corrected v2 of a
previously-ratified structure.

Read **`README.md`** first — it holds the design decisions, the register/
simplification rationale, the ratified structure, the **field/column mapping
tables**, the v2 + round-2 changelogs, and the open Founder questions. This file
is the **implementation** guide: how to build it in the real app.

## About the design files

The files in `preview/` are a **design reference built in HTML/React-via-Babel**
— a clickable prototype of the intended look and behavior. **Do not ship them.**
The task is to recreate these surfaces in the real **`replant-admin`** codebase
(React + Vite, the shipped `src/styles/globals.css`), using its established
patterns — `RpFrame`, `components/FilterPrimitives`, `components/Icons`,
`lib/api`, `lib/admin-tier` — exactly as the existing `Announcements.jsx` /
`Scripture.jsx` / `PastoralQueue.jsx` / `EscalatedCases.jsx` screens do.

## Fidelity: HIGH

Pixel-level intent, and deliberately built **only** on `globals.css` primitives
(`q-tabs`, `.rp-btn` / `-ghost` / `-primary`, `.rp-pill`, the `.state` family,
`.rp-card`, `.rp-input` / `.rp-select`, mono uppercase eyebrows). The prototype's
`content.css` is **layout-only** (grid/spacing/positioning + the not-shipped
harness) — port those layout rules, but source every visual token from
`globals.css`. No new tokens, colors, or fonts were introduced.

The leader **preview** cards were rebuilt to match the shipped app components in
`home-tab-handoff/components/` (`AnnouncementCard.tsx`, `LinkCard.tsx`,
`ScriptureStrip.tsx`). In the real admin, **import and reuse those actual
components** for the preview panel rather than reimplementing them.

## How to wire it in

- **Shell:** each surface renders inside `RpFrame crumb="Content" title=…`,
  matching the shipped `Announcements.jsx`.
- **Tabs:** both levels are `q-tabs` (Founder-locked). Announcements ↔ Witness of
  the Day is the upper `q-tabs` row (mirror `TriageTabBar`); Home/Drafts/Posted is
  the workflow row. One control band: tabs left, `Filters / Submissions / New`
  right, sharing the underline.
- **Filters / Preview / Version history** share the shipped right-drawer chassis
  (`.rp-decrypt-*` in globals). Reuse `FilterPrimitives` for the facet controls;
  State first, then Author, Date range, with surface facets folded behind
  "More filters".
- **Confirmation = state, not toast.** Publish flips the row's state and moves it
  between tabs. Only operations needing more (test send, correction, bulk,
  decline-with-reason, route, import) open a modal ceremony (`.ov`/`.mdl`). The
  dashboard is retiring toasts globally — do not add a success toast.
- **Data:** map the visible fields to the columns in the README tables. `lib/api`
  already exposes `postAnnouncement` / `updateAnnouncement` / `deleteAnnouncement`
  and accepts `scheduled_for`.

## Surfaces & components

Prototype files under `preview/` — each maps to one real screen module:

| Prototype file | Real target | Notes |
|---|---|---|
| `shared.jsx` | shared primitives / `components/` | `CollapsibleCard`, `WorkflowTabs`/`SiblingTabs` (→ q-tabs), `StatePill` (→ `.state`), `OverflowMenu`, `LockCue`, `BulkBar`, `FilterDrawer`, `PreviewDrawer`, `CeremonyModal`, editor `Field`/`Select`/`ShowMore`. |
| `announcements.jsx` | `screens/Announcements.jsx` (extend) | list card, writing-surface editor, Witness sibling, Submissions sub-surface. |
| `scripture.jsx` | `screens/Scripture.jsx` (extend) | verse editor + Post-MVP panel. |
| `outreach.jsx` | new `screens/Outreach.jsx` | Ph.1 ships; Ph.2/3 are concept. |
| `patternsheet.jsx` | reference only | not a shipped screen. |
| `data.jsx` | fixtures | replace with `lib/api` calls. |
| `app.jsx` / `content.css` | harness / layout | harness is prototype-only; port layout CSS. |

### Card levels (one job per level)
- **Collapsed row** = one line: marker (mono eyebrow) · title (serif) · state
  pill · date (mono). Checkbox appears on hover / once selection begins.
- **Expanded** = body first, one mono meta line, then **Preview + a ⋯ overflow**
  (Test send / Duplicate / Version history) — not five buttons.
- **Posted** rows show the restrained lock cue with **Draft a correction**
  beneath (threads a new post via `correction_of`).

### Editor (writing surface, not a form)
Title + Body dominant → one classification row (Source / Topic / Badge) →
Byline (auto-fills from the author via template, editable, "reset to template")
→ Show more (Card type / Push / Targeting; `link` card type reveals Link URL +
resource label) → footer with a quiet "Schedule for later" that swaps the CTA to
Schedule. **No column-name hints in the UI.**

### Witness of the Day (real `witnesses` schema)
Fields = the columns (see README). Workflow is **Today (derived) / Roster /
Drafts** — Today is computed via `get_witness_of_day()`, read-only. `quote` is
required and is the serif-italic centerpiece; `category` is the 5-value enum;
`martyr` is a toggle; **no portraits**. "Import roster" maps the shared
spreadsheet to the table.

### Daily Scripture
`UNIQUE(scripture_date)` — one per date, one translation. Reference is a
structured **Book + Chapter + Verse** picker (no free text). Theme is optional.
Reflection / prompt / related are **Post-MVP** (designed, not shipped for MVP).

### Submissions (filtered sub-surface under Announcements)
Four ghost actions: Approve · Approve with edits · Decline with reason · Route to
another curator. See CC build items below.

## Interactions, state, tokens, assets

- **Interactions & state:** per-surface `view` (list/editor/submissions), workflow
  tab, `expanded` Set, selection Set (raises the bulk bar), drawer `{type,item}`,
  modal `{type}`. Drawers/modals animate via the shipped `.rp-decrypt-*` / `.ov`
  keyframes. All actions are ghost; the single sky-primary CTA per surface is the
  publish/schedule action.
- **Design tokens:** none new — use `--rp-*` from `globals.css`
  (`src/styles/globals.css`). Fonts: Cormorant Garamond (serif / editorial), DM
  Sans (chrome), JetBrains Mono (eyebrows / meta). `scriptureItalic` (serif
  italic) is reserved for scripture / witness quotes / editorial only.
- **Assets:** none — icons are inline SVG mirroring `components/Icons`; the leader
  seal is the `RpMark`. No images; imagery in mocks is a placeholder well.

## Open build items (CC)

1. **Submissions — the four journeys + RBAC.** Approve (publish now) · Approve
   with edits (open as draft) · Decline with reason (required text → submitter) ·
   Route to another curator (queue handoff). Gate actions per tier (any admin
   tier curates; scope routing/deletion to the live gate).
2. **Pagination is one shared component** — 10 per page, Posted load-on-demand.
   Keep it identical across every Content surface; don't fork per-surface pagers.
3. **`announcements.link_url`** — NEW column, required when card type = `link`
   (flag for DBA; already noted on the shipped `LinkCard`).
4. **Witness spreadsheet sync** — decide source of truth (Sheet→DB import vs
   two-way) and the column→field mapping contract.
5. **"A Word for Today"** (word-from-family) — spec as its own **Persecuted-tab**
   surface (sibling to Witness of the Day); it was removed from Announcements.
6. Analytics per-post (opens/reactions/saves) is post-MVP — a ghost seat holds
   the slot on every card.

## Files

`preview/index.html` · `globals.css` (lifted from `src/styles/globals.css`) ·
`content.css` (layout-only) · `data.jsx` · `shared.jsx` · `patternsheet.jsx` ·
`announcements.jsx` · `scripture.jsx` · `outreach.jsx` · `app.jsx`. Design
rationale + field maps: `README.md`.
