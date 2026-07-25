# Handoff: Prayer Wall tab (Replant · Tab 4)

## Overview

A rebuild of the Prayer Wall tab. It replaces the 5-pill landing + filter-bar chrome with **three tabs and a gliding indicator**, a **first-line list that expands in place**, and a small set of quiet accents. Intent: hold thousands of requests without reading as a backlog, and let a 60-year-old minister land with no instruction.

Three structural moves define it:

1. **Expand in place, never navigate away.** Tapping a request expands it inline. The tabs, header, and scroll position stay put. `Intercede` lives inside the expanded body. There is no detail sheet or full-screen route for a request.
2. **The list shows the opening sentence only.** Prayers are full, multi-sentence texts. The list renders sentence one (two if the first is short) with an ellipsis; the full text appears on expand.
3. **Feed and Testimonies are the same skeleton.** Same eyebrow row, same preview, same expand, same meta row, same scripture footer. Only the state dot, the action, and the byline differ.

## About the design files

`Prayer Wall.dc.html` in this bundle is a **design reference written in HTML** — a prototype of the intended look and behaviour, not production code to port. Rebuild it in the existing React Native / Expo app using the established patterns in `src/screens/main/` and `src/components/prayer/`, and the tokens in `src/constants/theme.ts`. Do not copy CSS. Where this document and the HTML disagree, **this document wins**.

## Fidelity

**High fidelity.** Colours, type sizes, spacing, copy, and motion timings below are final and reviewed. Rebuild precisely. Every string in this document is the approved copy — do not paraphrase.

---

## Post-handoff Founder decisions (2026-07-24) — these override the sections below

- **Compose success lands FOLDED.** §View 5 says the new request returns expanded; Founder overrode after device testing — it arrives collapsed at the top of Feed like any other row. (The RPC still returns the new id and `WallComposeView` still passes it up, so flipping back is one line.)
- **Revelation + Locations surfaces retired** from this tab (see NOTES-postmvp.md for the church-state articles idea that replaces Revelation's role, and the Locations post-MVP ticket).
- **"Interceding now" live presence replaced** by the trailing-7-day intercession count (`get_wall_weekly_intercessions`) — live presence cannot be computed truthfully without realtime infra. Label: `INTERCESSIONS THIS WEEK`.
- **Journal list sections collapse by default** (settings behaviour) and the carry sub-copy is: *"Added from the Church Tab. Add up to ten ministries at a time."*
- Token decision **(A)** taken: mono allowance extended (Item 08 note updated in `theme.ts`); `borderAccentStrong` / `borderAccentSubtle` added.
- **(2026-07-25) Feed welcome line** is now **"Welcome to the wall. Add your voice."** (first sentence replaced only — "Add your voice." stays; Founder correction after a build briefly dropped it). Still hidden when the feed is empty.
- **(2026-07-25) Entry hub:** the fixed zone extends past the tab rule DOWN THROUGH the intro block — welcome, count row, meta line, and filter panel no longer scroll; the boundary is the hairline under the meta line, and only rows scroll beneath it. Approved on device and now applied to ALL THREE tabs — Testimonies (byline + count + meta fixed) and My Prayers (heading + counts fixed, in the gate branch too).

## ⚠️ Two token decisions to make before you start

**1. DM Mono vs DM Sans for eyebrow labels.** `theme.ts` records that KAN-23 v7 Item 08 swept Prayer Wall mono usage to DM Sans, keeping `Typography.mono` **only** for filter chips, feed card category/urgent tags, and the testimony chip.

This design uses a tiny-caps mono register much more widely — location eyebrows, `INTERCEDING NOW`, tab labels, section labels, meta labels. That is deliberate; the mono caps are what make the wall read as a quiet ledger rather than a social feed.

Pick one and apply it consistently:
- **(A) Recommended — extend the mono allowance** on this tab to the eyebrow/label register specified below. Requires updating the Item 08 note in `theme.ts`.
- **(B) Honour Item 08** and render every label in `Typography.body` at the same size/letter-spacing/uppercase. Visibly softer, still workable.

Everything below is written for **(A)**. If you choose (B), swap `Typography.mono` → `Typography.body` in label styles only; leave sizes, spacing, and colours untouched.

**2. Two new hairline tokens.** The tab rule and row separators are sky-tinted, which `theme.ts` does not yet cover:

```ts
// add to Colors
borderAccentStrong: 'rgba(107, 181, 232, 0.22)',  // header rule under the tabs
borderAccentSubtle: 'rgba(107, 181, 232, 0.10)',  // row separators, panel borders
```

`Colors.borderAccent` (0.25) is close to `borderAccentStrong` — if you prefer not to add tokens, reuse `borderAccent` for the header rule and accept the row separators at `Colors.border` (neutral 0.08). The blue tint is subtle but intentional: it is the only thing keeping the long list from reading as grey.

---

## Colour system

Sparing by design. The palette below is the whole tab.

| Role | Value | Token | Where |
|---|---|---|---|
| Ground | `#080808` | `Colors.background` | tab background |
| Primary text | `#F0EDE6` | `Colors.text` | prayer/testimony body, headings, counts |
| Warm off-white | `#E6E1D5` | — | welcome lines, scripture, journal entries |
| Muted | `rgba(240,237,230,.45)` | `Colors.textMuted` | eyebrow labels, counts-in-meta |
| Subtle | `rgba(240,237,230,.38)` | — | timestamps |
| Faint | `rgba(240,237,230,.30)` | — | gate notices, "Tap to open" |
| Sky | `#6BB5E8` | `Colors.accent` | **interactive only** — tab indicator, action borders/labels, non-urgent state dot, filled gap bar, Rejoice |
| Red | `#E05555` | `Colors.red` | **urgent only** — state dot, margin rule, `URGENT` label |
| Amber | `#D4A855` | `Colors.amber` | character counter at ≥250 |
| Neutral hairline | `rgba(240,237,230,.08)` | `Colors.border` | gate/empty-state rules |

**Rules that must hold:**
- **Green is not used on this tab.** Earlier iterations used `Colors.green` for testimonies; it read as childish. Answered state is carried by weight and brightness instead.
- **Sky means interactive.** Never decorative.
- **Red means urgent, nothing else.** Note for the team: red is otherwise reserved for the Persecuted tab, so a leader in both tabs sees it in two registers. This was accepted deliberately — the alternative (blue urgency) read as "expandable", colliding with the expand affordance.
- No shadows, no gradients, no emoji. Radii 6–12px.

## Type scale

Family names are the literal `Typography.*` values from `theme.ts`.

| Element | Family | Size | Line height | Letter-spacing | Colour |
|---|---|---|---|---|---|
| Screen title "Prayer Wall" | `displayRegular` | 27 | 27 | 0.4 | `text` |
| Welcome / byline line | `scriptureLight` | 19 | 27.5 | — | `#E6E1D5` |
| Section heading | `displayRegular` | 21–22 | — | — | `text` |
| Live count number | `displayMedium` | 21 | — | — | `text` |
| **Prayer / testimony preview** | `displayRegular` | **18** | **27** | — | `text` |
| **Prayer / testimony expanded** | `displayRegular` | **19** | **29.5** | — | `text` |
| Embedded request text | `displayRegular` | 16 | 24.8 | — | `rgba(240,237,230,.55)` |
| Eyebrow / label caps | `mono` | 8–9 | — | 1.4–2.0 | varies, uppercase |
| Tab label | `mono` | 10 | — | 1.6 | `text` / `rgba(…,.38)` |
| Meta (timestamp, count) | `body` | 10.5 | — | — | `.38` / `.45` |
| Gate/empty body copy | `sansLight` | 13 | 21.5 | — | `rgba(240,237,230,.50)` |
| Scripture | `scriptureItalic` | 17 | 26 | — | `#E6E1D5` |
| Scripture citation | `mono` | 9 | — | 2.0 | `textMuted`, uppercase |

**Body size rationale:** 18/19 Cormorant optically matches the 15px DM Sans body in the Home announcement cards. Earlier drafts at 20/21 read as large-text-preference. Post-MVP: expose a text-size preference in Settings.

**Italics — critical.** Only scripture, journal entries, and short reassurance lines are italic, and they must use the `Typography.scriptureItalic` **font asset**. Never apply `fontStyle: 'italic'` to a roman Cormorant file — they are separate assets and synthetic italic breaks Android rendering (already noted in `theme.ts`).

**Testimony body is NOT italic.** It was, and it was cut. Testimonies are roman, same as prayers.

## Spacing

Horizontal page padding **22**. Row vertical padding **19–20**. Section gap **34–36**. Card-internal gaps 8–14. Prefer `Spacing` tokens where they land on these values; do not round the type sizes to fit the scale.

---

## Screen: Prayer Wall (single screen, five views)

One screen. A fixed header, then one of five views in a scroll container. Journal and Compose are views of this screen, not routes — the header stays mounted.

### Header (fixed, always mounted)

Top to bottom:

1. **Status row** — time only, left aligned, `mono` 11, `letter-spacing: 1`, `textMuted`. Nothing on the right. *(In the real app this is the OS status bar — the mock's is a stand-in. There is no in-app "REPLANT" wordmark and no "Tab 4" eyebrow; both were removed.)*
2. **Title row** — "Prayer Wall" (spec above) on the left; on the right, two `mono` 9.5 / `letter-spacing: 1.3` uppercase text actions in a row, gap 16: **Journal** and **+ Post**.
   - `+ Post` — `accent` when verified, `rgba(240,237,230,.28)` when gated.
   - `Journal` — `accent` when the Journal view is open, `rgba(240,237,230,.42)` when closed, `rgba(240,237,230,.28)` when gated.
3. **Tab row** — `Feed` · `Testimonies` · `My Prayers`, gap 26, `mono` 10 / `letter-spacing: 1.6` uppercase. Active `text`, inactive `rgba(240,237,230,.38)`. Bottom padding 12.
4. **Gliding indicator** — 1.5px bar, `Colors.accent`, absolutely positioned at the bottom of the tab row. Animates `left` and `width` to the measured frame of the active label.
5. **Header rule** — 1px, `borderAccentStrong`.

**Indicator implementation.** Measure each tab label with `onLayout` (capture `x` and `width` of the **text**, not the touchable's padding box) into a ref keyed by tab id. Drive two `Animated.Value`s with `Animated.timing`, **420ms**, `Easing.bezier(0.22, 0.61, 0.36, 1)`, `useNativeDriver: false` (layout props). Re-measure on font load and orientation change. Precedent: `src/components/connect/Segmented.tsx` and `PrayerWallPillNav.tsx`.

The indicator is **hidden** (width 0) whenever Journal or Compose is open — those are not tabs.

### View 1 — Feed

**Intro block** (padding 20 top / 14 bottom):
- Welcome line: *"The body is already praying. Add your voice."* — **hidden when the feed is empty**, so it can never contradict a zero count.
- **Live count row**, `alignItems: center`, gap 10:
  - 6px sky dot. Breathing animation: opacity `.3 → .85 → .3`, **3400ms**, `Easing.inOut(Easing.ease)`, looping, `useNativeDriver: true`. Static at full opacity when reduced motion is on.
  - `INTERCEDING NOW` — `mono` 9 / `ls 2` uppercase, `rgba(240,237,230,.50)`.
  - Count, right-aligned via `marginLeft: 'auto'` — `displayMedium` 21, `text`, thousands-separated.
  - **Filter mark** — three stacked 1px bars, widths 13 / 9 / 5, gap 2.5, right-aligned. `accent` when the panel is open, `rgba(240,237,230,.42)` closed. Hit area ≥44×44 via `hitSlop`.
- **Meta line** — `mono` 8.5 / `ls 1.5` uppercase, `rgba(240,237,230,.30)`: `"{sort} · Pull to refresh"`, or `"{sort} · Urgent only"` when filtered.

> **What the count means:** leaders with the wall open and praying **right now** — live presence, not a total of requests. It must read `0` when the wall is empty. Consider relabelling to **"Leaders praying now"**: user flagged "Interceding now" as ambiguous (people praying vs. prayers being prayed for). Not yet decided.

**Filter panel** (collapsed by default, expands under the meta line):
Border 1px `borderAccentSubtle`, radius 8, padding 14, margin-bottom 18. Fades/slides in over 250ms.
- Label `SORT` — `mono` 8 / `ls 1.8` uppercase, `rgba(240,237,230,.35)`. Options in a wrapping row, gap 16, `body` 12.5: **Newest first** (default) · **Most interceding** · **Urgent first**. Selected `accent`, unselected `rgba(240,237,230,.42)`.
- Label `SHOW`, same treatment: **All requests** (default) · **Urgent only**.

Changing either re-triggers the row stagger.

**Request row — collapsed:**
- Top separator 1px `borderAccentSubtle`. Padding: 19 top, 0 bottom (the meta row carries the bottom space).
- **Eyebrow row**, gap 9: 5px state dot — **red if urgent, sky if not** — then location `mono` 8.5 / `ls 1.5` uppercase `rgba(240,237,230,.50)`. If urgent, `URGENT` pushed right (`marginLeft: 'auto'`), `mono` 8 / `ls 1.4` uppercase, `Colors.red`, **pulsing** opacity `1 → .4 → 1` over **2600ms** `Easing.inOut(Easing.ease)`, looping.
- **Preview row** — if urgent, a 1.5px vertical rule at `rgba(224,85,85,.5)`, radius 1, full height of the text block, gap 11 before the text. Then the first-sentence preview (18/27).
- **Meta row** — `justifyContent: space-between`, margin 11 top / 19 bottom. Left: `"Posted {when}"`, `body` 10.5, `.38`. Right: `"{n} interceding"`, `body` 10.5, `.45`. **Both need `nowrap`** — the timestamp wrapped to two lines in an earlier build.

Whole row is one touchable. Collapsed rows also show `Tap to open` (`body` 10.5, `.30`) at the right of the eyebrow row when not urgent.

**Request row — expanded** (replaces the preview and meta rows, 300ms fade + 3px slide down):
- Leader line — `bodyMedium` 12, `rgba(240,237,230,.60)`. Anonymous posts read `"A fellow leader"` (see `PrayerWallLogic.ts`).
- Full prayer text (19/29.5).
- Meta row — left `"Posted {when} · {Category}"`; right a **Fold** action, `mono` 8.5 / `ls 1.2` uppercase, `.40`.
- **Action row**, gap 14, margin-top 18:
  - **Intercede button** — border 0.5px `rgba(107,181,232,.30)`, radius 7, padding 10×18, transparent. Contains the gap mark then the label `mono` 9.5 / `ls 1.7` uppercase `text`, **`nowrap`**.
  - **The gap mark** — three 1.5px-wide × 13px-tall bars, gap 2.5, `alignItems: flex-end`. Outer two `rgba(240,237,230,.50)`. Centre bar `rgba(240,237,230,.09)` when idle; **`Colors.accent`** when interceding, animating `scaleY` 0 → 1 with a fade over **450ms** `Easing.bezier(0.22,0.61,0.36,1)`, transform origin bottom. This is the metaphor — you close the gap. Do not substitute an icon.
  - Interceded state: background `rgba(107,181,232,.07)`, border `rgba(107,181,232,.50)`, label **"Standing in the gap"**.
  - Count `"{n} interceding"` — `body` 11.5, `.45`, `marginLeft: 'auto'`, `nowrap`.
- **No other actions.** "Connect with this church", "Share this request", and "Add to my journal" were all removed → post-MVP.

**Scripture footer** — 24px above, separated by a 1px `borderAccentSubtle` rule, centred, max-width 300:
> *"Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance."*
> `EPHESIANS 6:18 · KJV`

**Row stagger.** On first mount, tab switch, refresh, and filter change, rows fade+rise (7px, 500ms) with **55ms** per-row delay. Implement by remounting rows on an `animTick` counter — key each row `` `${id}-${animTick}` ``. Cap the delay so a long list does not accumulate seconds (cap at ~10 rows). Skip entirely when reduced motion is on.

**Pull to refresh.** Use `RefreshControl` (`tintColor: Colors.accent`) as in `NetworkFeed.tsx` and the existing `PrayerWallScreen.tsx` — the mock's custom pull affordance exists only because HTML has no equivalent. On finish, bump the live count, re-trigger the stagger, and toast **"The wall is current."**

Feed is an **endless scroll sorted newest-first**. No "this hour" cap — the network is not yet large enough. Paginate on scroll.

### View 2 — Testimonies

Identical skeleton to Feed. Differences only:

- **Byline**: *"See what God has been doing — and share your own."*
- **Count row**: off-white `#E6E1D5` 6px dot (no breathing), label `ANSWERED THIS MONTH`, count right-aligned. No filter mark.
- **Meta line**: `NEWEST FIRST · PULL TO REFRESH`.
- **State dot**: off-white `#E6E1D5`, not green.
- If the testimony came from a request, `ANSWERED REQUEST` sits right in the eyebrow row — `mono` 8 / `ls 1.3` uppercase, `rgba(240,237,230,.42)`.
- **Preview and body are roman, not italic** (18/27 and 19/29.5).
- **Meta row**: left `"{when} ago"`, right `"{n} rejoicing"`.
- **Action**: **Rejoice** — same button chrome as Intercede. Idle: 9px ring, 1px `accent` border. Active: filled `accent` disc plus **two echo rings** — 1px `accent` borders animating `scale` 1 → 2.7 with opacity `.65 → 0` over **1900ms** `Easing.out(...)`, looping, the second offset **950ms**. Reads as a sustained sound going out. Label flips **Rejoice → Rejoicing**.
- **Embedded answered request** (expanded only) — the pair that carries the meaning:
  - A block with a 1.5px left rule `rgba(240,237,230,.16)`, padding-left 13, margin-top 14:
    - `THE REQUEST · {reqWhen}` — `mono` 8 / `ls 1.7` uppercase, `rgba(240,237,230,.38)`
    - the original request text, 16/24.8, `rgba(240,237,230,.55)`
    - `"{n} stood in the gap"` — `body` 10.5, `.30`
  - Then `THE ANSWER` — `mono` 8 / `ls 1.7` uppercase, `rgba(240,237,230,.70)`, margin-top 20
  - Then the testimony body at full brightness.
  - **Request and answer separate by brightness, not hue.** Muted past, bright present.
- **Scripture footer**: *"And they overcame him by the blood of the Lamb, and by the word of their testimony."* / `REVELATION 12:11 · KJV`

### View 3 — My Prayers

- Heading "Your church's open prayers" (`displayRegular` 22); sub-line `mono` 8.5 / `ls 1.5` uppercase `.40`: `"{n} open · {total} interceding"`.
- **Rows** — no expand. Prayer text 18/27, then a meta row: left `"Posted {when}"`, right `"{n} interceding"` (right-aligned, matching Feed). A **⋮** overflow button sits at the top-right of the row (`rgba(240,237,230,.40)`, 16px, ≥44px hit area).
- **⋮ menu** (inline, expands under the row; border 1px `borderAccentSubtle`, radius 8, 250ms):
  - **Mark as testimony** — 6px `#E6E1D5` dot + `mono` 9.5 / `ls 1.4` uppercase `text`.
  - **Remove** — same type, `rgba(240,237,230,.50)`.
- **Mark-as-testimony flow** (replaces the menu inline): a block with a 1.5px left rule `rgba(240,237,230,.18)`, padding-left 13:
  - `THE ANSWER` label
  - Textarea, **roman** Cormorant 18/26, placeholder *"Add a few words of praise — or mark it as it stands."*, bottom rule `rgba(240,237,230,.14)`
  - **Mark as testimony** button (border 0.5px `rgba(240,237,230,.30)`, radius 7, padding 9×16) and a plain **Cancel**.
  - On confirm: the row **leaves My Prayers** and appears in Testimonies as an embedded request+answer pair, using the typed words or, if blank, `"The Lord answered this. We are giving thanks."` Toast: **"Marked as testimony — moved to Testimonies."**
- **Remove** also drops the row from the list. Toast: **"Removed from your prayers."**
- **+ Post a prayer request** button below the list — full width, border 0.5px `rgba(107,181,232,.30)`, radius 7, padding 13, label `mono` 10 / `ls 1.6` uppercase `accent`. Hidden when gated.
- **Scripture footer**: *"Cast thy burden upon the Lord, and he shall sustain thee."* / `PSALM 55:22 · KJV`

**Post-MVP:** Edit a request (existed in the current build; deliberately not in this design).

### View 4 — Journal (Intercession journal)

Reached from the header. Starts with a **← Back to the wall** action (`accent`, `mono` 9.5 / `ls 1.6` uppercase).

1. **Heading** "Intercession journal" with a flex-1 hairline to its right (`rgba(107,181,232,.14)`); sub-line *"Private — only you can see this."*
2. **Composer** — Cormorant 20/29 textarea, placeholder *"A name, a burden, a line of prayer…"*, bottom rule. **Keep** button: 10px ring, 1px `#E6E1D5`, + label `mono` 10 / `ls 1.8` uppercase `#E6E1D5`. Toast: **"Kept. Only you can see this."**
3. **Entries** — each with a 1.5px left rule `rgba(240,237,230,.12)`, padding-left 14: date `mono` 8.5 / `ls 1.6` `.35`, then the entry in **`scriptureItalic` 18/28**, `#E6E1D5`.
4. **Standing in the gap** — section heading (`displayRegular` 19) + hairline + `"{n} held"` right-aligned. Rows: the gap mark (with its centre bar sky), location eyebrow, first-line preview (17/24.6, `#E6E1D5`), and a **Release** action at the right (`mono` 8, `.35`).
   - **Auto-populated:** tapping **Intercede** anywhere on the wall files the request here. This is the whole point — it keeps the tap from being insincere and gives the leader a living reminder. **Release** removes it and un-interceded the request.
   - Open question for the team: should entries expire after some time? If they do, **the intercede count must not change**.
5. **Churches you carry** — heading + `"{n} of 10"`; sub-line *"Added from The Church. Ten at a time."* Rows: 5px sky dot, church name (`body` 13), `"{location} · since {date}"` (`mono` 8 / `ls 1.3` uppercase `.35`), **Release** at the right.
   - **Populated from the Church tab** — praying for a church there adds it here. **Hard limit 10.** Toast on release: **"Released. You can carry another."**

### View 5 — Compose (Post a request)

Field set is a faithful port of `src/components/church/PostPrayerRequestModal.tsx` — keep the RPC contract and validation exactly.

1. **← Back**, then heading "Post a request" + hairline.
2. **Attribution line** — `scriptureItalic` 15/22.5, `rgba(240,237,230,.50)`. Non-editable, and it must react to the anonymous toggle:
   - default: `"This request will be posted on behalf of {churchName}."`
   - anonymous **or** underground: `"This request will be posted anonymously on behalf of {churchName}."`
3. **`YOUR PRAYER`** label, then the textarea — Cormorant 21/30.5, min-height 132, bottom rule, placeholder *"Share what your church is bringing before the Lord."*, `maxLength={300}`.
4. **Character counter**, right-aligned, `mono` 8.5 / `ls 1.2`: `"{n} / 300"`. `rgba(240,237,230,.35)` → **`Colors.amber` at ≥250** → **`Colors.red` at ≥280**. Must update on every keystroke and **reset to 0 whenever the view opens** (a stale amber count over an empty field was a real bug in the prototype).
5. **`CATEGORY`** label, then chips in a wrapping row, gap 8: the 8 canonical values from `PrayerWallLogic.ts` — Healing, Protection, Provision, Salvation, Unity, Guidance, Endurance, Laborers. Chip: border 0.5px, radius 6, padding 8×13, `mono` 9 / `ls 1.3` uppercase. Unselected border `rgba(240,237,230,.12)` / text `rgba(240,237,230,.50)`; selected border `rgba(107,181,232,.50)` / text `accent`. **Required.**
   - **Post-MVP: multi-select.** Single-select today; BE is not multi yet.
6. **Two toggle rows**, each separated by a 1px `borderAccentSubtle` rule above, title `body` 13.5 `text` + description `sansLight` 11.5/17 `rgba(240,237,230,.42)`, switch right:
   - **Mark as urgent** — *"For requests needing immediate intercession."*
   - **Post anonymously** — *"Your name will be hidden. Your church will still be shown."* **Hidden entirely for underground churches** (always anonymous).
   - Switch: 42×24, radius 12, 17px `#F0EDE6` knob, 250ms `Easing.bezier(0.22,0.61,0.36,1)` travel. Off: track `rgba(240,237,230,.07)`, border `rgba(240,237,230,.14)`. On: track `rgba(107,181,232,.35)`, border `rgba(107,181,232,.50)`. Use the platform `Switch` with these colours if it lands closer to the app's other toggles.
7. **Lift it up** — full-width submit, background `rgba(240,237,230,.05)`, border 0.5px `rgba(240,237,230,.30)`, radius 7, padding 15, label `mono` 10 / `ls 2` uppercase `text`. *(It was blue; the blue wash was rejected.)*
   - Disabled until trimmed text is non-empty **and** a category is chosen.
   - Validation copy, verbatim from the existing modal: **"Please add a prayer request before submitting."** / **"Please pick a category."** Map the six RPC error codes exactly as `PostPrayerRequestModal.errorCopy` does.
   - Success → return to Feed with the new request **~~expanded~~ folded** *(Founder override 2026-07-24 — see decisions section at top)*, and toast **"Lifted up. The body will pray it through."**

---

## Gated state (unverified church or leader)

An unverified church **can read the whole wall** — Feed, Testimonies, filters, expanding requests, and all counts. Only the actions are gated.

**Copy principle, and it matters:** prayer is never gated, only the feature. Say what the app unlocks; never imply the leader's praying is unqualified. An earlier draft read "Only verified leaders can intercede" and was rejected outright.

| Surface | Gated behaviour |
|---|---|
| `+ Post` (header) | `rgba(240,237,230,.28)`. Tap → toast **"Your church must be verified to post."** *(verbatim from the existing `not_verified` RPC copy)* |
| `Journal` (header) | `rgba(240,237,230,.28)`. Tap → toast **"The journal unlocks once your church is verified."** Route blocked in logic too. |
| Expanded request | Intercede button replaced by **"Unlocks once your church is verified"** — `mono` 9 / `ls 1.4` uppercase, `rgba(240,237,230,.32)`. Count stays visible. |
| Expanded testimony | Same notice in place of Rejoice. |
| My Prayers | List hidden; sub-line reads `NOT YET VERIFIED`; `+ Post a prayer request` hidden. Gate panel shown (below). |
| Compose / Journal views | Unreachable. **If verification lapses while one is open, fall back to Feed** — and make the tab indicator, nav highlight, and pull-to-refresh follow that fallback. Deriving the five view flags from `s.view` alone rendered an empty screen; derive them from an effective `view`. |

**My Prayers gate panel** — 1px `Colors.border` rule above, padding 24 top:
- "Verification pending" — `displayRegular` 22, `text`
- *"Your church is visible to the network but limited until verified. Posting and interceding open once the Replant team confirms your church."* — `sansLight` 13/21.5, `.50`
- *"You are welcome to read the wall and pray with the body in the meantime."* — `scriptureItalic` 16/24, `.45`
- `QUESTIONS? EMAIL THE REPLANT TEAM.` — `mono` 8.5 / `ls 1.5` uppercase, `.32`, above a 1px rule
  - **Wire the real address** — reuse the `EMAIL` constant and `Mail` link pattern from `src/components/home/VerificationBanner.tsx`. The mock omits it deliberately.

Copy is aligned to the existing gates (`VerificationBanner.tsx`, `MyOpenPrayersView.tsx`, `PostPrayerRequestModal.tsx`). Keep it that way.

## Empty states

One serif line and one plain sentence. Hairline above, padding 34 top. No icons, no illustrations.

| View | Heading | Body |
|---|---|---|
| Feed | "The wall is quiet." | "No requests have been lifted yet. Yours can be the first the body carries." |
| Feed, filtered to Urgent | "Nothing urgent right now." | *italic* "That is its own kind of mercy." + **Show all requests** button (border 0.5px `rgba(107,181,232,.30)`, radius 7, `accent` label) |
| Testimonies | "No testimonies yet." | "When a prayer is answered, mark it in My Prayers — it will be told here, and the body will rejoice with you." |
| My Prayers | "Nothing lifted yet." | "When your church brings something before the Lord, post it here and the body will carry it with you." — **+ Post a prayer request** sits directly beneath, so the empty state is the invitation |
| Journal entries | — | *italic* "Nothing kept yet. Write a name or a burden above — only you will see it." |
| Standing in the gap | — | "Requests you intercede for on the wall gather here." |
| Churches you carry | — | *italic* "None yet. Pray for a church from The Church and it will be held here." |

**Counts must read `0`, not hide** — My Prayers shows `0 OPEN · 0 INTERCEDING`, and the Feed count reads `0`, so nothing looks broken. The Feed welcome line hides at zero.

## State

```ts
view: 'feed' | 'testimonies' | 'mine' | 'journal' | 'compose'   // effective view; gate falls back to 'feed'
expandedRequestId: string | null      // one at a time
expandedTestimonyId: string | null    // one at a time
overflowMenuId: string | null
testifyingId: string | null           // inline mark-as-testimony composer
sort: 'newest' | 'most' | 'urgent'    // default 'newest'
show: 'all' | 'urgent'                // default 'all'
filterPanelOpen: boolean
composeLen: number                    // reset to 0 on compose open
urgent: boolean; anonymous: boolean; category: PrayerCategory | null
animTick: number                      // increments to re-trigger row stagger
refreshing: boolean
toast: string | null                  // ~2600ms, then fade
```

Server state: requests (paginated), testimonies, my church's open prayers, journal entries, journal intercessions, carried churches (max 10), live presence count.

**Optimistic interactions.** Intercede / Rejoice update the count and flip the label immediately, then reconcile — follow the existing `PrayerWallPullUp.tsx` rollback pattern (`not_verified`, `self_interaction_blocked`).

**No toast on Intercede.** The mark filling and the count rising say it. A toast here was removed as noise.

## Motion summary

| What | Duration | Easing |
|---|---|---|
| Tab indicator glide | 420ms | `bezier(0.22, 0.61, 0.36, 1)` |
| Row stagger (fade + 7px rise) | 500ms, 55ms/row | `ease` |
| Expand / collapse | 300ms | `ease` |
| View fade on tab change | 350ms | `ease` |
| Live-count dot breathe | 3400ms loop | `inOut(ease)` |
| `URGENT` pulse | 2600ms loop | `inOut(ease)` |
| Gap bar fill (`scaleY`) | 450ms | `bezier(0.22, 0.61, 0.36, 1)` |
| Rejoice echo rings | 1900ms loop, 2nd offset 950ms | `out(ease)` |
| Toggle knob | 250ms | `bezier(0.22, 0.61, 0.36, 1)` |
| Toast in / out | 300 / 220ms | `ease` |

`Animated` + `useNativeDriver: true` everywhere except the indicator (layout props). **Honour `src/utils/useReducedMotion.ts`**: freeze the breathe, pulse, and echo loops at their resting state and skip the stagger; keep functional transitions.

## Accessibility

- Every touchable ≥44px — the ⋮, the filter mark, and Release actions need `hitSlop`.
- `accessibilityRole="tab"` on tabs with `selected`; `"button"` elsewhere; `"radio"` on category chips and sort/show options.
- Labels must not rely on the mark alone: `"Intercede — {n} interceding"`, `"Standing in the gap — {n} interceding"`, `"Rejoice — {n} rejoicing"`.
- Announce the counter as it crosses the amber and red thresholds.
- Never carry meaning by colour alone — urgency is dot **+ word + rule**; answered state is label **+ brightness**.

## Files

- `Prayer Wall.dc.html` — the design reference. Two switches at the top of the file drive the review states: `churchVerified` (gate) and `showEmptyStates`.
- `NOTES-postmvp.md` — the parked list, carried forward from review.

## Post-MVP (agreed, do not build now)

- Text-size preference in Settings.
- Home nudge: *"Need something to do? Pray for {an old prayer point they marked as intercession}."*
- Edit a prayer request in My Prayers.
- Connect with this church, from an expanded request (concept approved).
- Share a request / testimony.
- Add to my journal, from an expanded request (interceding already files it automatically).
- Category multi-select.
