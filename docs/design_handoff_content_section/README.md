# Content Section — Admin CD

The **shared Content pattern** + its three surface applications: **Announcements**,
**Daily Scripture**, and the new **Outreach & Missions** surface. Design once,
apply everywhere — Announcements, Scripture, Outreach, and every future Content
surface are the same shell with different content. That repetition is the thesis,
not a shortcut.

Delivered in the shape of the Escalated Cases CD pack: one live, clickable
prototype built on the real admin shell + `globals.css` tokens, plus this README
documenting the locked decisions and the CD calls on the Founder-open questions.

## Run the prototype

Open `preview/index.html`. Use the **CD deliverables** panel (bottom-right) to jump
between all 16 screens and to flip the **viewer tier**. Every surface is live: click
the top-level segmented control (Announcements ↔ Witness of the Day), the workflow
tabs (Home / Drafts / Posted), expand/collapse cards, open the filter / preview /
version-history drawers, select draft rows to raise the bulk bar, and toggle the
editor preview panel.

Every mockup carries a **Field / column mapping** footer grounding each visible
field to its DB column.

## The 16 deliverables

**Shared pattern (1)**
- Reference sheet — every shared primitive shown once: top-level + workflow tabs,
  card collapse, state pills, multi-select + bulk bar, filters, preview, test send,
  duplicate, version history, pagination, publish-lock + correction, editor grammar,
  analytics ghost slot, field-mapping footer.

**Announcements (6)**
- Home (today's + next-scheduled expanded, rest collapsed)
- Drafts (multi-select, 3 rows selected, bulk-action bar)
- Posted (publish-lock cue + "Draft a correction" affordance + correction chain)
- Editor (all 5 reconciled fields + preview toggled ON)
- Witness of the Day sibling tab (Home view of witness cards)
- Submissions review queue (Leader / Partner / Blog + 4 triage actions)

**Daily Scripture (3)**
- Home (today's scripture expanded, theme + translation visible)
- Editor (two-column: verse left, reflection + related right, preview toggled)
- Filter drawer (Theme + Translation + Book facets)

**Outreach & Missions (6)**
- Phase 1 · Home (curator view)
- Phase 1 · Editor (mission listing)
- Phase 1 · Leader mobile view (how curated content shows up on the Outreach tab)
- Phase 2 concept · Partner application intake queue
- Phase 2 concept · Partner org profile (admin edit)
- Phase 3 concept · Trip marketplace (interest + prayer-coverage indicators)

## Voice + typography (honored, load-bearing)

- **Clinical, peer-respecting, never coddling.** No "Are you sure?" — the confirm
  IS the action. Publish label is `Publish` (not Post it!/Send). Correction verb is
  `Draft a correction` (not Edit/Fix). Bulk bar reads `3 selected · Delete · Archive
  · Publish now · Reschedule` — chip count + verb list, no exclamation. "audit-logged"
  / "Locked" / "cannot be undone" kept only where literally true.
- **scriptureItalic reserved for scripture / editorial / witness.** The verse text,
  witness testimony, and leader-word lead render in serif italic; all admin chrome is
  roman. No italic-for-emphasis on admin screens.

## Shared pattern, as built

- **Tabs** — three workflow tabs on every surface: Home (today's + next-scheduled,
  curated) / Drafts (WIP, edit available) / Posted (archive, read-only + correction).
- **Card collapse** — default collapsed; only today's + next-scheduled render expanded
  on Home & Posted. Chevron click-to-expand.
- **Multi-select** — row checkbox + a bulk bar that surfaces on selection > 0
  (Delete / Archive / Publish now / Reschedule). Every bulk op audit-logged per row.
- **Post-publish = FULL-LOCK + add-correction.** Once published, immutable. A
  correction is a new `Correction to [title]` post threaded via `correction_of` FK,
  rendering as a follow-up card in the leader feed. Not a technical limit — a
  discipline: what leaders read yesterday, we don't retroactively rewrite.
- **Filters** — right-side slide-in drawer, sticky at top. State first, then Author,
  Date range, then surface-specific facets. Consistent across all three surfaces.
- **Pagination** — 10 per page (Content only). Posted supports load-on-demand.
- **Preview** — right-side slide-in rendering the SAME leader card component the app
  ships (AnnouncementCard / LeaderWordCard / ScriptureCard / MissionCard).
- **Test send** — sends to one leader (usually the curator) with `test=true`; never
  counts toward analytics.
- **Duplicate** — new draft pre-fills title/body/source/tag from the parent; audit
  records the parent id.
- **Version history** — drafts only, pre-lock. Freezes at publish.
- **Analytics** — post-MVP; a ghost slot holds the seat on every card.

## Column reconciliation (Announcements)

The editor surfaces five clean concepts over the migration mess:

| Concept | Column | What the curator sees |
|---|---|---|
| Source | `author_type` (extended) | First field. Drives downstream fields + approval flow. |
| Byline | `source_label` (kept) | One-line, 30-char cap, live counter. |
| Topic | `topic` (NEW) | Required. Filter facet + card decoration. |
| Badge | `badge` (was `tag_type`) | Optional, default none. Tiny selector. |
| Card type | `card_type` (unchanged) | Advanced — behind "Show more". Default standard. |

## CD calls on the Founder-open questions

1. **Top-level tab bar visual** → **segmented control**. A filled segmented control
   reads as "which surface am I in" and is visually distinct from the underlined
   `q-tabs` workflow bar beneath it — the two never read as tab-in-tab. (Pill row was
   too close to the workflow chips; q-tabs twice was the confusion trap.)
2. **Preview panel placement** → **right-side slide-in**. Always one tap away, never
   in the way, and it shares the drawer chassis with filters + version history so the
   curator learns one right-edge affordance. (Modal blocks the editor you're checking
   against; bottom sheet fights the publish bar.)
3. **Filter facet order** → **State first**, then Author, Date range, then
   surface-specific facets. State is the workflow anchor the curator thinks in;
   ordering it first is consistent across all three surfaces.
4. **Correction affordance** → lives in the **Posted row's expand drawer**, beneath
   the publish-lock cue — not an always-visible inline button. Corrections are rare
   and deliberate; surfacing the affordance only after the curator opens the locked
   post keeps the row calm and makes the correction a considered act.
5. **Submissions queue placement** → **a filtered sub-surface under Announcements**,
   reached from a `Submissions · 4` control on the toolbar — not its own top-level
   Content entry. Submissions become announcements; they belong to the announcements
   workflow, and a separate nav entry would orphan them from the surface they feed.

## Constraints honored (did NOT design)

Post-publish edit UI (lock-only; correction affordance only) · no new tokens/colors
(all `--rp-*`) · no i18n picker · no analytics widgets (ghost slot only) · no comment
moderation · no per-surface sub-account permissions (three-tier gates apply as-is).

## File map

**`preview/`** — the clickable prototype
- `index.html` · `globals.css` (lifted from `src/styles/globals.css`) ·
  `content.css` (shared-pattern + surface classes + harness + mobile frame) ·
  `data.jsx` · `shared.jsx` (all shared primitives) · `patternsheet.jsx` ·
  `announcements.jsx` · `scripture.jsx` · `outreach.jsx` · `app.jsx`

Markup uses the class vocabulary already in `globals.css` (q-tabs, .rp-btn, .state,
.rp-pill families) plus the `cs-*` classes added in `content.css`. On build, the
surfaces wire to `../lib/api` and reuse `FilterPrimitives`, `Icons`, and the leader
app's mobile card components for the live preview panel.
