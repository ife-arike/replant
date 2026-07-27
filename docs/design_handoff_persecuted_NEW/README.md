# Handoff: The Persecuted Church tab (Replant · Tab 5)

## Overview

A refinement — **not a rebuild** — of the Persecuted tab. It keeps what the current implementation gets right (the threshold preamble, the anonymity byline, "hold in prayer", the status track, four distinct scripture footers, the guidance library, the EAP prompt) and fixes the two things that were breaking it: **red used as the tab's accent colour**, and **four pills of chrome plus a second filter row** before the reader reaches one word from a persecuted brother.

It inherits the Prayer Wall skeleton wholesale: three tabs with a gliding indicator, a first-sentence list that expands in place, hairline rows instead of cards, and a header text action where `Journal` sits.

Five structural moves define it:

1. **Three tabs, not four pills.** `Heartcries` · `Witnesses` · `Take heart`, with a gliding indicator. **My Voice** (the leader's own heartcries) is a header text action, not a tab — four labels do not fit one tab row at mono 10 / ls 1.6.
2. **The card shows the sender's tier, not a state.** Every heartcry carries the severity word the sender chose in the submission form — Critical · Urgent · Serious · Ongoing · Informational. The current build renders the DB's `critical` as the label **"Active"**, which showed a *state* where the sender had picked a *tier*. That is corrected here.
3. **Every heartcry is red, in two intensities.** These are escalated prayer requests by definition; none of them are routine. Filled dot for the top two tiers, hollow red ring for the rest. Sky is never a row state — sky means "you can touch this."
4. **Expand in place.** Tapping a heartcry expands it inline; the header, tabs, and scroll position stay put. `Hold in prayer` lives inside the expanded body. No detail route.
5. **Witnesses opens on the living.** "Standing this week" (current counts from real leaders) precedes Witness of the day. The tab is not a memorial wall with statistics bolted on; it is the standing body, then the cloud that went before.

## About the design files

`Persecuted.dc.html` in this bundle is a **design reference written in HTML** — a prototype of the intended look and behaviour, not production code to port. Rebuild it in the existing React Native / Expo app using the established patterns in `src/screens/main/persecuted/` and the tokens in `src/constants/theme.ts`. Do not copy CSS. Where this document and the HTML disagree, **this document wins**.

The prototype's Tweaks panel drives the review states: `tabAccent` (sky / red — **red is the approved selection**), `verified` (gate), `showEmpty` (empty states), `bodyItalic`, `reducedMotion`.

## Fidelity

**High fidelity.** Colours, type sizes, spacing, copy, and motion timings below are final and reviewed. Rebuild precisely. Every string in this document is the approved copy — do not paraphrase.

---

## Post-handoff Founder decisions (2026-07-26) — these resolve the sections below

- **§1(a) resolved: CONTINENT.** The anonymisation scheme stays 6-continent UN M.49, matching the live pipeline. Byline `A VOICE · {CONTINENT}`, security row `ENCRYPTED · ANONYMOUS · CONTINENT ONLY`, filter = continents present in the feed, form promise unchanged. Country-level remains possible later as data + copy only, after a deliberate security review.
- **§1(b) resolved: empty state.** "Standing this week" renders its approved empty line until `get_persecuted_standing()` + `situation_type` admin tagging exist. Nothing is fabricated.
- **(Device pass 2026-07-26)** The filter label → meta line → first row stack read as choked at the spec's 9px — meta line spacing extended to 14 above / 18 below.
- Blog routing points at `https://www.projectreplant.org/blog` (no constant existed; pending Founder confirmation).

## ⚠️ Read this before you start

### 1. Two blocking data decisions

**(a) Country vs. continent anonymisation.** This design shows **country** in the byline (`A VOICE · NIGERIA`) and the submission form promises *"your country only, never your name or church."* The current backend anonymises to **6-continent UN M.49** — `HeartcrySubmissionScreen.tsx` carries a comment recording that the copy was deliberately corrected *from* "region" *to* "continent" for exactly that reason.

**The form must not promise something the pipeline does not deliver.** Resolve one of two ways before shipping:
- Move the anonymisation scheme to country level, and keep this design as written; **or**
- Keep continents, and change *both* the byline and the form subtext back to continent.

They cannot differ between the two screens. This is the single highest-risk item in the handoff — it is a promise made to someone in danger.

**(b) "Standing this week" needs an RPC that does not exist.** Four counts, scoped to the last seven days, no names and no places:

```
get_persecuted_standing() → {
  leaders_count      int,   -- heartcries shared in the last 7 days
  countries_count    int,   -- distinct countries among them
  imprisoned_count   int,   -- currently imprisoned
  prohibited_count   int,   -- fellowships meeting under prohibition
  holding_count      int    -- leaders holding any heartcry in prayer
}
```

`imprisoned_count` and `prohibited_count` are **not derivable from `severity`** — severity is how fast, not what kind. They need either a new `situation_type` on the heartcry row or admin tagging during review. Until the RPC exists, render the section's empty state; **do not fabricate rows** (the existing scenes already follow this rule and should keep following it).

### 2. Severity label rename

`persecutedLogic.ts` `SEVERITY_RADIO_OPTIONS` is correct: `critical` → **"Critical"**. `SeverityTag.tsx` disagrees — it maps both `active_persecution` and `critical` to the label **"Active"**. Fix `SeverityTag` to render `"Critical"`, and delete the `active_persecution` alias if the column no longer emits it. The tier word must be byte-identical on the feed card and in My Voice, because it is the sender's own choice being reported back.

### 3. Three new tokens

```ts
// add to Colors
borderRowSubtle:   'rgba(107,181,232,0.10)',  // row separators (sky-tinted, keeps the list from reading grey)
borderAccentRed:   'rgba(224,85,85,0.26)',    // header rule under the tabs
redRing:           'rgba(224,85,85,0.55)',    // hollow tier ring
```

`Colors.surface` is reused for the share card; the value in the prototype is `#111113`. If `theme.ts` resolves `surface` to something else, **use the token** — do not hardcode.

### 4. DM Mono is used widely

Same decision as the Prayer Wall handoff: this tab uses a tiny-caps mono register for eyebrows, tab labels, tier words, and meta labels. `theme.ts` records that KAN-23 v7 Item 08 restricted `Typography.mono` on Prayer Wall. Extend the allowance here (recommended — the mono caps are what make the tab read as a quiet ledger), or swap `Typography.mono` → `Typography.body` in label styles only, leaving sizes, spacing, and colours untouched.

---

## The red system

This is the part to get right. Red appeared roughly sixty times in the current build — screen title, header hairline, a 2px left border on every card, every section eyebrow, the spinner, the empty glyph, five severity colours, and a line down the entire left edge of the screen. It became wallpaper, and it made a held space read as an emergency dashboard.

**One sentence, true on both Prayer Wall and Persecuted:**

> **Red means someone is in danger.**

On Prayer Wall that is the urgent request. Here it is the heartcry's tier. A leader moving between tabs never re-learns it.

**Five marks carry red. Nothing else may.**

| Mark | Where | Value |
|---|---|---|
| **Filled dot** | Eyebrow row, tiers `critical` + `urgent` | 5×5, `Colors.red` |
| **Hollow ring** | Eyebrow row, tiers `serious` + `ongoing` + `informational` | 5×5, 1px `redRing`, transparent fill |
| **The tier word** | Eyebrow row, right-aligned, every card | `Colors.red` for the top two; brightness below |
| **Margin rule** | Left of the preview, filled tiers only | 1.5px `rgba(224,85,85,.5)`, radius 1 |
| **The seal** | Witness of the day, martyrs only | 7×7 square, 1px `Colors.red`, **unfilled** |

Plus exactly **two** interactive reds, both deliberate exceptions:

- **`Share my heartcry`** (share card, and the My Voice empty state) — outlined, `rgba(224,85,85,.30)` border, red label.
- **`Send my heartcry`** (submission form) — same treatment.

These are the only actions in the app taken from *inside* danger, and sky read as casual on them. Everything else interactive is sky.

**Red must not touch:** the screen title, section rules, card borders, spinners, empty-state glyphs, chips, radio marks, toggles, or any filled button. **No filled red buttons anywhere** — the current form's solid `Colors.red` submit with near-black text is the loudest element in the app and reads as a banner.

**Only `critical` animates.** Opacity `1 → .4 → 1`, 2600ms, `Easing.inOut(Easing.ease)`, looping. Five pulsing labels is the old flood in miniature; one pulse on "immediate threat to life or freedom" is the only animation that earns itself. Freeze at full opacity when reduced motion is on.

**Green is not used on this tab.** It appeared three times on My Heartcries (the Responded step, the CTA border and fill, the envelope and chevron). Answered state is carried by **brightness**, as on Prayer Wall.

## Colour system

| Role | Value | Token | Where |
|---|---|---|---|
| Ground | `#080808` | `Colors.background` | tab background |
| Surface | `#111113` | `Colors.surface` | share card only |
| Primary text | `#F0EDE6` | `Colors.text` | body, headings, tab labels, stat numbers |
| Warm off-white | `#E6E1D5` | — | preamble, scripture, stat descriptions, quotes |
| Muted | `rgba(240,237,230,.45)` | `Colors.textMuted` | eyebrows, region lines |
| Subtle | `rgba(240,237,230,.38)` | — | timestamps, source attribution |
| Faint | `rgba(240,237,230,.30)` | — | meta line, gate notices |
| Sky | `#6BB5E8` | `Colors.accent` | **interactive only** — Hold, My Voice, filter mark, chips, radios, toggle, text links, guidance index |
| Red | `#E05555` | `Colors.red` | **danger only** — the five marks + two share actions |
| Row hairline | `rgba(107,181,232,.10)` | `borderRowSubtle` | row separators |
| Header rule | `rgba(224,85,85,.26)` | `borderAccentRed` | under the tabs |
| Neutral hairline | `rgba(240,237,230,.08)` | `Colors.border` | section rules, empty-state rules |

No shadows on the tab (the confirmation modal keeps its existing elevation). No gradients, no emoji. Radii 6–12px; the tier ring and dot are circles, the seal is a square.

## Type scale

Family names are the literal `Typography.*` values from `theme.ts`.

| Element | Family | Size | Line height | Letter-spacing | Colour |
|---|---|---|---|---|---|
| Screen title | `displayRegular` | 25 | 25 | 0.4 | `text` |
| Header text action | `mono` | 9.5 | — | 1.3 | varies, uppercase |
| Tab label | `mono` | 10 | — | 1.6 | `text` / `.38` / `.22` |
| Preamble / intro body | `displayRegular` | 18 | 28 | — | `#E6E1D5` |
| Section heading | `displayRegular` | 19 | — | — | `text` |
| **Heartcry preview** | `displayRegular` | **18** | **27** | — | `text` |
| **Heartcry expanded** | `displayRegular` | **19** | **29.5** | — | `text` |
| Eyebrow / label caps | `mono` | 8–9 | — | 1.4–2.1 | varies, uppercase |
| Tier word | `mono` | 8 | — | 1.4 | tier tint, uppercase |
| Meta (timestamp, count) | `body` | 10.5–11.5 | — | — | `.38` / `.45` |
| Gate / empty body | `sansLight` | 13 | 21.5 | — | `.50` |
| Scripture | `scriptureItalic` | 17 | 26 | — | `#E6E1D5` |
| Scripture citation | `mono` | 9 | — | 2.0 | `.45`, uppercase |
| Stat number | `displayRegular` | 34 | 34 | 0.3 | `text` |
| Stat description | `displayRegular` | 17 | 26 | — | `#E6E1D5` |
| Witness name | `displayRegular` | 27 | 32.5 | 0.3 | `text` |
| Witness quote | `scriptureItalic` | 19 | 29 | — | `#E6E1D5` |

**Heartcry body is roman, not italic.** The current build renders it in `scriptureItalic`. Italicising a person's account of persecution turns testimony into a devotional quote — it aestheticises it. Prayer Wall cut italic body for the same reason. *(The prototype exposes a `bodyItalic` tweak if the team wants to re-litigate; the default and the spec are roman.)*

**Italics — critical.** Only scripture, witness quotes, story excerpts, and short reassurance lines are italic, and they must use the `Typography.scriptureItalic` **font asset**. Never apply `fontStyle: 'italic'` to a roman Cormorant file — separate assets, and synthetic italic breaks Android rendering (already noted in `theme.ts`).

## Spacing

Horizontal page padding **22** (the submission form uses **20**, matching the existing pushed screen). Row vertical padding **19**. Section gap **34–36**. Card-internal gaps 8–18.

---

## Header (fixed, always mounted)

Top to bottom:

1. **Status row** — OS status bar. The mock's `9:41` is a stand-in.
2. **Title row** — `align-items: flex-end`, gap 14, margin-top 16.
   - Left: **"The Persecuted Church"** (`displayRegular` 25). *(The red title is gone — it was the loudest permanent element on the tab.)*
   - Right: **My Voice** — `mono` 9.5 / ls 1.3 uppercase, `nowrap`, `padding-bottom: 3`. Open `accent`; closed `rgba(240,237,230,.42)`; gated `rgba(240,237,230,.28)`.
   - **Unread dot** — 4px `accent` circle, gap 6, immediately left of the label, shown when a heartcry has been responded to and My Voice is closed. **This replaces `NotifBar` entirely** — one dot instead of a full-width banner row.
3. **Tab row** — `Heartcries` · `Witnesses` · `Take heart`, gap 26, `padding-bottom: 12` on each touchable, `position: relative`.
4. **Gliding indicator** — 1.5px bar, **`Colors.red`**, absolutely positioned at the bottom of the tab row. **Tab labels stay off-white in both accent modes** — red is the indicator and the rule, never the letters.
5. **Header rule** — 1px `borderAccentRed`.

The **security subtitle is removed** from the header (`ENCRYPTED · ANONYMOUS · WITHIN THE NETWORK`). It now lives inside the share card, next to the act of sharing, where it is load-bearing rather than decorative.

**Indicator implementation.** Measure each tab label with `onLayout` (capture `x` and `width` of the **text**, not the touchable's padding box) into a ref keyed by tab id; subtract the trailing letter-space (~1.6px) so the bar is optically flush. Drive two `Animated.Value`s with `Animated.timing`, **420ms**, `Easing.bezier(0.22, 0.61, 0.36, 1)`, `useNativeDriver: false` (layout props). Re-measure on font load and orientation change. Precedent: `src/components/connect/Segmented.tsx`.

The indicator is **width 0** whenever My Voice is open or the leader is gated.

---

## View 1 — Heartcries

### Threshold preamble

`padding: 22 top / 20 bottom`, 1px `Colors.border` bottom rule.

- Eyebrow **`A HELD SPACE`** — `mono` 9 / ls 2 uppercase, `textMuted`. *(Was red.)*
- Body, margin-top 12 — *"For churches under threat, imprisonment, prohibition of fellowship, violence, and active hunting for the faith."*

### Share card

Restored to the current build's `actionCard` design — surface fill, centred, full-width button. `margin: 22 / 0 / 4`, `Colors.surface`, border 0.5px `Colors.border`, radius 10, padding `22 / 20 / 20`, `text-align: center`.

- Prompt — *"Are you suffering persecution for the name of Jesus?"* (`displayRegular` 20 / lh 27 / ls 0.2)
- Sub — *"Heartcries shared to Replant are encrypted and your identity is held. This is a safe space for your voice."* (`body` 12.5 / lh 20, `rgba(240,237,230,.45)`)
- **Security row**, centred, gap 7, margin-top 14 — a small lock glyph (8×10, 1px `rgba(240,237,230,.38)`, radius 1.5 with 4px top corners) then `ENCRYPTED · ANONYMOUS · COUNTRY ONLY` (`mono` 8.5 / ls 1.5 uppercase, `rgba(240,237,230,.38)`).
- CTA — full width, margin-top 18, transparent, border 0.5px `rgba(224,85,85,.30)`, radius 6, padding `12 / 16`, label `bodyMedium` 11.5 / ls 1.6 uppercase `Colors.red`, `nowrap`. **Not filled.**

### Filter row

`padding-top: 24`.

- Label — `mono` 9 / ls 2 uppercase, `rgba(240,237,230,.50)`: **"Heartcries from the body"**, or **"Heartcries from {Country}"** when filtered. This doubles as the section heading; the separate "Heartcries from the body" heading in the current build is removed.
- **Filter mark**, right-aligned — three 1px bars, widths 13 / 9 / 5, gap 2.5, `align-items: flex-end`. `accent` when the panel is open, `rgba(240,237,230,.42)` closed. Hit area ≥44×44 via `hitSlop`.
- Meta line, margin-top 9 — `NEWEST FIRST · PULL TO REFRESH` (`mono` 8.5 / ls 1.5 uppercase, `rgba(240,237,230,.30)`).

### Filter panel (collapsed by default)

Border 1px `rgba(107,181,232,.18)`, radius 8, padding 14, margin-top 16. Fades/slides in over 250ms.

- Label `COUNTRY` — `mono` 8 / ls 1.8 uppercase, `rgba(240,237,230,.35)`.
- Options in a wrapping row, gap 16, `body` 12.5: **All countries** (default) then the countries present in the feed. Selected `accent`, unselected `rgba(240,237,230,.42)`.

**Country, not continent.** The current build filters by continent and includes Antarctica. Drop the continent taxonomy and the horizontal chip row entirely. Changing the country re-triggers the row stagger.

### Heartcry row — collapsed

- Top separator 1px `borderRowSubtle`. Padding: 19 top, 0 bottom (the meta row carries the bottom space).
- **Eyebrow row**, gap 9:
  - **Tier dot** — 5px. Filled `Colors.red` for `critical`/`urgent`; 1px `redRing` hollow circle otherwise.
  - **Byline** — `A VOICE · {COUNTRY}` (`mono` 8.5 / ls 1.5 uppercase, `rgba(240,237,230,.50)`).
  - **Tier word**, `marginLeft: 'auto'`, `flex: none` — `mono` 8 / ls 1.4 uppercase, tier tint. `critical` pulses.
  - No "Tap to open" — the tier occupies that slot on every card.
- **Preview row**, margin-top 9, gap 11 — for filled tiers, a 1.5px vertical rule `rgba(224,85,85,.5)`, radius 1, full height of the text block; then the **first sentence only** (18/27, roman) with an ellipsis.
- **Meta row** — `space-between`, `align-items: baseline`, margin `11 / 0 / 19`. Left `"Shared {when}"` (`body` 10.5, `.38`). Right `"{n} praying"` (`body` 10.5, `.45`). **Both need `nowrap`.**

The whole row is one touchable.

### Heartcry row — expanded

Replaces the preview and meta rows; 300ms fade + 3px slide.  `padding: 10 top / 22 bottom`.

- Full text (19/29.5, roman).
- Meta row, margin-top 14 — left `"Shared {when}"`; right a **Fold** action (`mono` 8.5 / ls 1.2 uppercase, `.40`).
- **Action row**, gap 14, margin-top 18:
  - **Hold button** — border 0.5px, radius 7, padding `10 / 18`, label `mono` 9.5 / ls 1.7 uppercase `text`, **`nowrap`**.
    - Idle: transparent, border `rgba(107,181,232,.30)`, label **"+ Hold in prayer"**.
    - Held: background `rgba(107,181,232,.07)`, border `rgba(107,181,232,.50)`, label **"Keep holding"**.
    - Must `stopPropagation` — the parent row is the expand toggle.
  - Count `"{n} praying"` — `body` 11.5, `.45`, `marginLeft: 'auto'`, `nowrap`.
- **No other actions.** No icon on the hold button — the label flip and the rising count say it. **No toast on hold.**

Optimistic update with rollback, following the existing `handleToggleHold` in `FeedScene.tsx`.

### Empty states

Hairline above, `padding: 34 top / 6 bottom`.

| Case | Heading | Body |
|---|---|---|
| No heartcries | "Quiet here, for now." | "This space is held in prayer until someone speaks. If you are experiencing any form of persecution, you can share here." |
| Filtered to a country | "Nothing from {Country}." | "No one there has written to us. The body is praying for that church regardless." + **All countries** button (sky outline, radius 7, `accent` label) |

### Scripture footer

Margin-top 34, padding-top 22, 1px `borderRowSubtle` rule, centred, max-width 300:

> `PRAY WITH US`
> *"Remember them that are in bonds, as bound with them; and them which suffer adversity, as being yourselves also in the body."*
> `HEBREWS 13:3 · KJV`

The footer eyebrow is `mono` 9 / ls 2.1 uppercase `rgba(240,237,230,.45)` — **not sky** (sky is interactive only; the current build has these in `Colors.accent`).

### Feed mechanics

- **Endless scroll, newest first.** Paginate on scroll. **Remove the `ROUND_SIZE = 4` pager entirely** — four items per page with prev/next, scrolling to top on every flip, in a feed.
- **Pull to refresh** — `RefreshControl`, `tintColor: Colors.accent`. On finish, re-trigger the stagger and toast **"The feed is current."**
- **Row stagger** — on first mount, tab switch, refresh, and filter change: fade + 7px rise, 500ms, **55ms** per row, capped at ~10 rows. Remount rows on an `animTick` counter, key each `` `${id}-${animTick}` ``. Skip entirely when reduced motion is on.

---

## View 2 — Witnesses

Renamed from **Bear Witness**. μάρτυς means *witness*; the label carries martyrs and living confessors alike without saying "the dead."

### Section A — Standing this week (the living)

`padding: 22 top / 4 bottom`. **This is the first thing on the tab**, before any historical content.

- Eyebrow `STANDING THIS WEEK` — `mono` 9 / ls 2.1 uppercase, `textMuted`. *(Was red.)*
- Stat rows, gap 16, margin-top 18 — `flex-direction: row`, `align-items: flex-start`, gap 14:
  - Number — `displayRegular` 34 / lh 34 / ls 0.3, `text`, `minWidth: 70`.
  - Description — `displayRegular` 17 / lh 26, `#E6E1D5`, `flex: 1`, `paddingTop: 5`.
- Footnote, margin-top 18 — *"Counted from heartcries shared in the last seven days. No names, no places."* (`sansLight` 11.5 / lh 18.5, `rgba(240,237,230,.35)`)

Prototype copy, pending the RPC in §1(b):

| Number | Description |
|---|---|
| 31 | leaders wrote to us this week, from fourteen countries. |
| 9 | are in prison as you read this. |
| 4 | fellowships are meeting under prohibition. |
| 2,417 | leaders are holding them in prayer. |

**No dots or tier marks in this block** — the numbers at 34px carry it. The last line implicates the reader, which is the point of the section; keep it last.

**Empty state** (no RPC data yet): *"Standing reports will be tallied here as leaders take their places across the body."* (`body` 13 / lh 20, `textMuted`)

### Section B — Witness of the day

Section header: `displayRegular` 19 + `flex: 1` hairline `Colors.border`, gap 14, margin-top 34.

Card, `padding-top: 20`:

1. **Seal row**, gap 8 — the 7×7 unfilled red square, then `MARTYR` (`mono` 8.5 / ls 1.5 uppercase, `Colors.red`), a `·` at `rgba(240,237,230,.30)`, then the era (`mono` 8.5 / ls 1.5 uppercase, `textMuted`).
   - Non-martyrs render **no seal** and the word `CONFESSOR` at `rgba(240,237,230,.42)`. The seal only means something because some entries lack it.
2. **Region · years** line, margin-top 8 — `mono` 8.5 / ls 1.5 uppercase, `textMuted`.
3. **Name** — `displayRegular` 27 / lh 32.5 / ls 0.3, margin-top 16.
4. **Quote** — the centrepiece, the witness's own words. Block with a 1.5px left rule `rgba(240,237,230,.16)`, padding-left 14, margin-top 20; `scriptureItalic` 19 / lh 29, `#E6E1D5`.
5. **Description** — `displayRegular` 18 / lh 28.5, `text`, margin-top 22. Roman.
6. **Scripture** — margin-top 24, padding-top 18, 1px `Colors.border` top rule: citation (`mono` 8 / ls 1.7 uppercase, `.38`) then the verse (`scriptureItalic` 17 / lh 26, `#E6E1D5`, margin-top 10).
7. **Source** — `sansLight` 10.5 / lh 17, `rgba(240,237,230,.35)`, margin-top 20.

Schema, from the reviewed example (Perpetua of Carthage):

```
category            'martyr' | 'confessor'
era                 e.g. 'pre-Constantinian'
years_label         e.g. 'c. 182–203'
region              e.g. 'North Africa'
name
quote               the serif-italic centrepiece — the witness's own words
scripture_ref       e.g. 'Revelation 2:10'
scripture_text      optional
description         roman body
source_attribution
martyr              boolean → drives the seal
rotation_day        day-of-year slot
```

**Empty state:** *"The witnesses will be lifted up here, one a day. The first will be posted soon."*

> **Known gap:** the historical roster below the daily witness was cut in review — only the day's witness ships. Until the rotation includes a `confessor`, every witness on the tab is a martyr and the seal reads as decoration rather than distinction. Seed at least one confessor in the first rotation batch.

### Section C — Around the world

Section header: heading + hairline + a **`Blog ›`** action (`mono` 8.5 / ls 1.4 uppercase, `accent`, `nowrap`).

Story rows, gap 20, margin-top 18 — border-left 1.5px `rgba(240,237,230,.14)`, padding `2 / 0 / 2 / 14`:

- Meta — `mono` 8.5 / ls 1.5 uppercase, `rgba(240,237,230,.40)` (e.g. `REPLANT FIELD NOTE · CENTRAL ASIA`)
- Title — `displayRegular` 19 / lh 24.7, `text`, margin-top 7
- Excerpt — `scriptureItalic` 16 / lh 24, `rgba(240,237,230,.60)`, margin-top 6

Then **Read more on the blog** — sky outline button, margin-top 22.

**Every row routes to the blog**, not to a per-article reader. `ArticleReaderScreen` and `StoryArchiveScreen` are not used by this design. *(The left rule was red at `rgba(224,85,85,.30)` in the current build — neutralised, since it was decorative red.)*

### Scripture footer

> `A CLOUD OF WITNESSES`
> *"Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and let us run with patience the race that is set before us."*
> `HEBREWS 12:1 · KJV`

---

## View 3 — Take heart

### Hero — A word from your family

`padding: 30 / 8 / 28`, centred, 1px `Colors.border` bottom rule. Kept with its empty state, as reviewed.

- Eyebrow `A WORD FROM YOUR FAMILY` — `mono` 9 / ls 2.1 uppercase, `rgba(240,237,230,.45)`. *(Was sky at 70% — sky is interactive only, and with no words to cycle there is nothing to press.)*
- Body — *"Words from the body will appear here as leaders share encouragement with those enduring persecution."* (`sansLight` 13 / lh 21, `.50`, max-width 300, margin-top 16)
- **Find out how ›** — `mono` 9.5 / ls 1.5 uppercase, `accent`, margin-top 16. Opens the existing `ComingSoonModal` with its current copy.

When leader-submitted words exist (post-MVP), restore the tap-to-cycle behaviour and the 12s auto-advance, with the dot pager in `accent`.

### Practical guidance

Section header, then rows in a column, gap 10, margin-top 16.

Row — `flex-direction: row`, `align-items: center`, gap 14, border 0.5px `Colors.border`, radius 8, padding 14:

- **Index** — 32×32 circle, background `rgba(107,181,232,.08)`, label `mono` 9 / ls 0.5, `rgba(107,181,232,.80)`: `01`–`04`.
  - *This replaces the four hand-drawn lock / door / shield / book glyphs.* The circles were the most decorative element on the tab and the four icons were doing no work the titles weren't already doing. A quiet index keeps the visual rhythm and reads as a library. If the team prefers the glyphs, keep the circle geometry exactly and swap the numeral for the existing `GuidanceIcon` at 12px.
- Title — `displayRegular` 17 / lh 22, `text`
- Sub — `displayRegular` 14.5 / lh 21.75, `textMuted`, margin-top 4
- Chevron — `›`, `body` 13, `rgba(240,237,230,.40)`

Content unchanged, verbatim:

| # | Title | Sub |
|---|---|---|
| 01 | Digital security, brief. | Six habits that protect you and the body. Read once, return when needed. |
| 02 | If your fellowship is raided. | Steps to protect the gathered, the records, and those who came new. |
| 03 | If you are arrested. | What to say, what not to say, and how the body will continue without you. |
| 04 | Continuing under prohibition. | How the early church gathered when forbidden, and what they wrote to each other. |

Each pushes `GuidanceReader` with its existing `slug` (`digital`, `raid`, `arrest`, `prohibition`).

### The body with you

Section header, then a block, margin-top 16: border 0.5px `Colors.border`, radius 8, padding 18. **No sky fill** — the current build's `rgba(107,181,232,.04)` background and `.18` border are stripped.

- Copy — *"Do you have an Emergency Action Plan with the churches around you?"* (`displayRegular` 18 / lh 27, `#E6E1D5`)
- **START AN EAP BRANCH** — sky outline button, margin-top 16. Routes to `Tabs → Connect` with `initialSubTab: 'ministries'`, as today.

### Scripture footer

> `TAKE HEART`
> *"These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world."*
> `JOHN 16:33 · KJV`

---

## View 4 — My Voice (header action)

Named **My Voice**, not "My Heartcries" or "Mine": every entry in the feed is *a voice*, so the leader's own are their voice. It sits where `Journal` sits on Prayer Wall, and the tab indicator collapses to width 0 while it is open.

### Intro

`padding: 22 top / 20 bottom`.

- Eyebrow `SET ASIDE FOR YOU` — `mono` 9 / ls 2 uppercase, `textMuted`. *(Was red.)*
- Body, margin-top 12 — *"Our team reads each one, prays through it, and reaches you directly if you ask us to."* (`displayRegular` 18 / lh 28, `#E6E1D5`)

> Copy note: the current build promises *"reaches you directly in your secure messages when there is something to say."* The revised line makes the response opt-in, per review. If the team responds to every heartcry regardless, revert to the original sentence — but do not promise a response the process cannot guarantee.

### Rows

No expand. Top separator 1px `borderRowSubtle`, padding `19 / 0`.

- **Eyebrow row**, gap 9 — tier dot (filled / hollow, same rule as the feed), tier word (`mono` 8.5 / ls 1.5 uppercase, tier tint), then the relative timestamp right-aligned (`body` 10.5, `.38`, `nowrap`).
- **Excerpt** — `displayRegular` 18 / lh 27, `text`, margin-top 10. Roman. Falls back to the existing status strings when `feed_content` is not yet set.
- **Status track**, margin-top 16 — see below.
- **Open secure message ›** — when `status === 'responded'` and `thread_id` is set: `mono` 9.5 / ls 1.5 uppercase, `accent`, margin-top 16, no border, no icon, no background. Routes to `Tabs → Connect` with `conversationId: thread_id`, as today.
  - *This replaces the green CTA card entirely* (`rgba(91,173,122,.06)` fill, green border, green envelope, green chevron).

### Status track

`flex-direction: row`, `align-items: center`, margin-top 16. Steps **Received → Seen → Responded**.

**Reads by brightness, not hue:**

| Step | Done colour |
|---|---|
| Received | `rgba(240,237,230,.45)` |
| Seen | `rgba(240,237,230,.72)` |
| Responded | `#F0EDE6` |

- Dot — 8×8, radius 4, border 0.5px. Done: border and fill both the step colour. Not done: border `rgba(240,237,230,.14)`, fill transparent.
- Connector rule — `height: 0.5`, `flex: 1`, `marginHorizontal: 6`. Done: the step colour. Not done: `rgba(240,237,230,.10)`.
- Label — `mono` 8.5 / ls 1.5 uppercase. Not done: `rgba(240,237,230,.28)`.
- Step wrapper: first `flex: 0 0 auto`, the rest `flex: 1 1 auto`, gap 6.

**The green Responded step is removed.** Progress toward being heard is a brightening, not a traffic light.

### Empty state

- "Nothing written yet." (`displayRegular` 21)
- *"If a day comes when you need to be heard, this space will hold it. Until then, the body is praying around you."* (`sansLight` 13 / lh 21.5, `.50`, max-width 300)
- **Share my heartcry** — red outline button (`rgba(224,85,85,.30)` border, radius 6, padding `11 / 20`, `bodyMedium` 11 / ls 1.5 uppercase `Colors.red`), margin-top 22. The empty state is the invitation.

### Scripture footer

> `THE LORD HEARS`
> *"I sought the Lord, and he heard me, and delivered me from all my fears."*
> `PSALM 34:4 · KJV`

---

## View 5 — Submission form (Screen 15)

A faithful port of `HeartcrySubmissionScreen.tsx`. **The field set, order, validation, request body, and all copy are unchanged** — keep the edge-function contract exactly. Only the colour of the controls changes.

**All security invariants in that file's header comment still hold.** Content, severity, request_type, and post_to_feed must never appear in logs, analytics, storage, or crash payloads. No draft persistence. `feed_approved` is never sent. `church_id` is resolved server-side from the JWT.

Pushed screen, `padding: 20`, `gap: 24` between field groups.

1. **Top bar** — height 52, `space-between`, padding `0 / 20`, 1px `Colors.border` bottom rule. Back `←` (`body` 22, `text`, width 22), title **"Heartcry"** (`displayRegular` 20 / ls 0.4), 22px right spacer.
2. **Pastoral intro** — border-left 1.5px `rgba(240,237,230,.16)`, padding-left 18. `displayRegular` 18 / lh 28, `text`. Copy verbatim; non-dismissible.
   - *The red left border (2px `Colors.red`) and red 4% fill are removed.*
3. **Your Heartcry** — field label `bodyMedium` 14 / ls 0.28. Textarea: min-height 150, margin-top 12, transparent, **bottom rule only** (1px `rgba(240,237,230,.14)`), padding-bottom 12, `displayRegular` 19 / lh 29.5, `text`. Placeholder *"Write what you are carrying. There is no limit here."* at `rgba(240,237,230,.40)`.
   - *Was a boxed input in `scriptureItalic`. Roman, bottom-rule — matching Prayer Wall's composer and the feed body.* Keep `autoCorrect={false}`, `autoComplete="off"`, `spellCheck={false}`.
   - Error: *"Please write your heartcry before sending."*
4. **What do you need?** — 2×2 grid, gap 10, margin-top 12. Multi-select; values `prayer`, `practical_support`, `guidance`, `just_to_be_heard`; labels **Prayer · Practical support · Guidance · Just to be heard**.
   - Chip: height 44, radius 22, padding `0 / 12`, border 0.5px, `body` 13.5, `nowrap`, centred.
   - Unselected: border `rgba(240,237,230,.16)`, text `text`, transparent.
   - **Selected: border `rgba(107,181,232,.50)`, background `rgba(107,181,232,.07)`, text `accent`, plus a 6px `accent` dot at gap 7.** *(Was red.)*
   - Helper *"Select all that apply."* (`sansLight` 11.5, `.50`). Error: *"Pick at least one."*
5. **How urgent is your situation?** — five radios, `padding: 14 / 2`, 1px `Colors.border` bottom rule on all but the last.
   - Mark: 22×22, radius 11, border 1.5px `rgba(240,237,230,.16)`; **selected border `accent` with an 11px `accent` dot**. *(Was red.)*
   - Label `bodyMedium` 15, `text`. Descriptor `sansLight` 12.5 / lh 18, `rgba(240,237,230,.55)`, margin-top 3.
   - Values and descriptors **verbatim from `SEVERITY_RADIO_OPTIONS`** — do not re-word:

   | Value | Label | Descriptor |
   |---|---|---|
   | `critical` | Critical | Immediate threat to life or freedom. |
   | `urgent` | Urgent | The situation is worsening and needs prayer now. |
   | `serious` | Serious | Significant pressure — not yet at immediate risk. |
   | `ongoing` | Ongoing | Persistent persecution, not currently escalating. |
   | `informational` | Informational | I want the Replant team to know what is happening here. |

   - Error: *"Choose how urgent this is."*
   - **Why the controls are sky:** the radio is a widget, not a warning. Five red radio marks is the old flood at small scale. The tier's redness appears where it does work — on the feed card.
6. **Let the Body stand with you** — block, border 0.5px `rgba(240,237,230,.12)`, radius 12, padding 18.
   - Label `displayRegular` 18 / ls 0.18, `text`, `flex: 1`.
   - **Switch** — 42×24, radius 12, 17px `#F0EDE6` knob travelling left 3 → 20 over **250ms** `Easing.bezier(0.22,0.61,0.36,1)`. Off: track `rgba(240,237,230,.07)`, border `rgba(240,237,230,.14)`. On: track `rgba(107,181,232,.35)`, border `rgba(107,181,232,.50)`. *(Was `trackColor: true → Colors.red`.)*
   - Sub, margin-top 14 — *"After Replant team review, your heartcry may appear in the feed — your country only, never your name or church."* (`body` 12.5 / lh 19, `.55`)
   - ⚠️ **See §1(a).** This sentence is the promise that must match the pipeline.
7. **Send my heartcry** — full width, margin-top 26, transparent, border 0.5px `rgba(224,85,85,.30)`, radius 8, padding 15, `bodyMedium` 12.5 / ls 1.6 uppercase `Colors.red`, `nowrap`. Opacity 0.45 until valid.
   - *Was solid `Colors.red` with `#0A0A0A` text at height 52.*
   - Disabled until trimmed content is non-empty **and** ≥1 request type **and** a severity is chosen. Validation hints appear only after the first Send.
   - Submitting: spinner in place of the label. Error: *"We couldn't send your heartcry. Please try again."* (`body` 13, `Colors.red`, centred). Never echo server detail strings.
8. **Encrypted disclosure** — lock glyph + *"Your words are encrypted the moment you send them. They go to the Replant team, and no one else."* (`sansLight` 11.5 / lh 18, `.55`), margin-top 18.
   - **The 🔒 emoji is removed** and replaced with the drawn lock used in the share card. No emoji anywhere in Replant.

### Confirmation (Screen 15B)

Unchanged from the current implementation except that it is reached from this form. Scrim `rgba(0,0,0,.72)`, padding `0 / 28`. Card: `Colors.surfaceElevated`, border 1px `rgba(240,237,230,.16)`, radius 18, padding `28 / 24 / 22`, gap 16, centred, existing shadow.

- Glyph — 44×44 circle, border 1px `rgba(107,181,232,.35)`, background `rgba(107,181,232,.10)`, sky check at 18pt.
- Body — `displayRegular` 17 / lh 26, `text`, centred. Copy verbatim: *"Your heartcry has been received. We will be praying alongside you."* / *"Please reach out to the Replant Team directly at connect@projectreplant.org if you have a request that cannot wait."* The email is an inline `mailto` Pressable in `scriptureItalic` `accent`.
- Divider 1px `Colors.border`, margin-top 4.
- **Done** — height 48, radius 10, background `#1F1F1F`, border 1px `rgba(240,237,230,.16)`, `bodyMedium` 14 / ls 0.56, `text`.
- On Done: dismiss, pop the form, and **land the leader in My Voice** (not the feed) so they see their heartcry at `Received`.

---

## Gated state

**The whole tab is gated** — unlike Prayer Wall, an unverified leader reads nothing here. Heartcries carry real risk for the people who write them.

`padding-top: 44`:

- `NOT YET VERIFIED` — `mono` 8.5 / ls 1.8 uppercase, `rgba(240,237,230,.35)`
- "This section is for verified leaders in the Replant network." — `displayRegular` 22 / lh 29.5, `text`, margin-top 16
- *"Heartcries carry real risk for the people who write them, so the room stays closed until the Replant team confirms your church. Once verified, it opens in full."* — `sansLight` 13 / lh 21.5, `.50`, margin-top 14
- *"In the meantime the Prayer Wall is open to you, and the body there is praying for these same churches."* — `scriptureItalic` 16 / lh 24, `.45`, margin-top 18
- 1px `Colors.border` rule, margin-top 28
- `QUESTIONS? EMAIL THE REPLANT TEAM.` — `mono` 8.5 / ls 1.5 uppercase, `.32`, margin-top 16. **Wire the real address** — reuse the `EMAIL` constant and `Mail` link pattern from `src/components/home/VerificationBanner.tsx`.

**The 60px lock glyph is removed.** A lock is the locked-out register; the copy already says what is closed and what opens it, and it points the leader somewhere they *can* pray.

**Tabs while gated** — labels dim to `rgba(240,237,230,.22)`, the indicator collapses to width 0, and tapping a tab or `My Voice` toasts **"The Persecuted Church unlocks once your church is verified."** Live-looking tabs that do nothing are a lie when reading is blocked.

**Copy principle:** gate the feature, never the praying. Say what the app unlocks and where they can pray meanwhile.

---

## State

```ts
tab: 'heartcries' | 'witnesses' | 'takeheart'
voiceOpen: boolean                    // My Voice view; hides the indicator
formOpen: boolean                     // submission form (pushed route in the app)
expandedId: string | null             // one at a time
filterOpen: boolean
country: string                       // 'All countries' default
held: Record<string, boolean>         // optimistic
counts: Record<string, number>        // optimistic
animTick: number                      // increments to re-trigger row stagger
refreshing: boolean
toast: string | null                  // ~2600ms, then fade
unread: boolean                       // drives the dot beside My Voice

// form
content: string
needs: Set<HeartcryRequestType>
severity: HeartcrySeverity | null
postToFeed: boolean
touched: boolean                      // validation hints appear only after first Send
confirmOpen: boolean
```

Server state: heartcry feed (paginated, newest first, optional country filter), my heartcries with status + thread_id, standing counts (§1b), witness of the day, field-note previews.

In the app, `formOpen` is the existing pushed `HeartcrySubmission` route — the prototype models it as an overlay only because HTML has no navigator. Gate fallback: if verification lapses while any view is open, fall back to the gate; derive every view flag from an effective view rather than raw state.

## Motion summary

| What | Duration | Easing |
|---|---|---|
| Tab indicator glide | 420ms | `bezier(0.22, 0.61, 0.36, 1)` |
| Row stagger (fade + 7px rise) | 500ms, 55ms/row, cap 10 | `ease` |
| Expand / collapse | 300ms | `ease` |
| View fade on tab change | 350ms | `ease` |
| **Critical tier pulse** | **2600ms loop, opacity 1 → .4 → 1** | `inOut(ease)` |
| Filter panel open | 250ms | `ease` |
| Toggle knob | 250ms | `bezier(0.22, 0.61, 0.36, 1)` |
| Toast in / out | 300 / 220ms | `ease` |

`Animated` + `useNativeDriver: true` everywhere except the indicator (layout props). **Honour `src/utils/useReducedMotion.ts`**: freeze the Critical pulse at full opacity and skip the stagger; keep functional transitions.

## Accessibility

- Every touchable ≥44px — the filter mark, `Fold`, and `Blog ›` need `hitSlop`.
- `accessibilityRole="tab"` on tabs with `selected`; `"button"` elsewhere; `"radio"` on severity options and country options; `"checkbox"` on need chips.
- **Never carry meaning by colour alone.** The tier is always dot **+ word**; the filled band adds the margin rule; answered state is label **+ brightness**; the seal is always accompanied by the word `MARTYR`.
- Labels must not rely on the mark: `"Hold in prayer — {n} praying"`, `"Keep holding — {n} praying"`, `"{Tier}. {descriptor}"` on severity radios.
- Announce the status track as `progressbar` with `now`/`min`/`max`, as today.
- The Critical pulse must not be the only signal — the word is there regardless.

## Files

- `Persecuted.dc.html` — the design reference. Tweaks: `tabAccent` (**red** approved), `verified`, `showEmpty`, `bodyItalic`, `reducedMotion`.
- `design_handoff_prayer_wall/README.md` — the sibling tab's spec. The two must stay consistent; read its red note alongside this one.

## What to delete

- `persecuted/components/PillTabBar.tsx` — replaced by the three-tab row + indicator.
- `persecuted/components/FilterChips.tsx` and `RegionFilterBar` in `FeedScene.tsx` — replaced by the filter mark + panel.
- `persecuted/components/NotifBar.tsx` — replaced by the 4px dot beside My Voice.
- `persecuted/components/MartyrBadge.tsx` — replaced by the seal + word in the witness eyebrow row.
- The `ROUND_SIZE` pager block in `FeedScene.tsx`.
- The left-edge red accent line in `PersecutedScreen.tsx`.
- The dashed red circle empty glyph in `FeedScene.tsx` and the envelope glyph in `MyHeartcriesScene.tsx` — empty states are one serif line and one plain sentence, no illustrations.
- `SeverityTag.tsx`'s coloured pill chrome (border + background + radius) — the tier is now a dot plus a mono word. Keep the label map, fix `critical` → "Critical".

## Post-MVP (agreed, do not build now)

- Leader-submitted "word from your family" entries, with the tap-to-cycle carousel and dot pager.
- The historical witness roster beneath Witness of the day (expand-in-place rows; the prototype's `WITNESSES` data models it).
- `WitnessArchiveScreen` / `StoryArchiveScreen` / `ArticleReaderScreen` — stories route to the blog for now.
- Text-size preference in Settings.
- "Together" tab — feature-flagged off until 5k+ leaders.
- A separate "happening right now" fact, distinct from the tier. If wanted, it belongs in the expanded body as a timestamp phrase ("Still unfolding as of 2 hours ago"), never as a second badge competing with the tier.
