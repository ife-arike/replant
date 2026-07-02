# Handoff: Settings — Display name modifiers (Show last name first, Include middle name, Honorific, Suffix)

## Overview

Settings → **01 Account** has accumulated four small fields that sit underneath the existing **Display name shown to others** radio:

1. `Show last name first` — checkbox
2. `Include middle name in full name` — checkbox **(new in this pass)**
3. `Honorific` — opens a picker sheet
4. `Suffix` — opens a picker sheet **(new in this pass)**

In the current build the first two read as strays in the gap below the radio group, and the Honorific picker is a stock iOS-style menu. This handoff brings all four into the same register as the rest of the Account section: one parent row, one shared **Format** eyebrow, the Honorific/Suffix value sitting left-aligned next to its label, and two on-brand picker sheets that match the existing italic-serif + sky-mono pattern.

## About the Design Files

The file in this bundle (`Settings - Name Fields Fix.html`) is a **design reference created in HTML** — a prototype showing intended look, copy, and behavior. **Do not lift HTML/CSS into the app.** The task is to recreate it in the existing **React Native + Expo** codebase using the `Colors / Typography / Spacing / Radius` tokens from `src/theme.ts` (the same theme the rest of Settings already consumes). The HTML uses CSS variables that map 1:1 onto those tokens — the section "Design Tokens → mapping" below has the exact correspondence.

## Fidelity

**High-fidelity.** Pixel values, hex codes, typography, spacing, and copy are all final. Toggle the two checkboxes in the After phone of the HTML to see the live label/preview wiring exactly as it should behave in the app.

## Scope

Only the four fields and the two picker sheets. **Nothing else on Settings is touched** — the `Settings` header, the `your account, your church.` epigraph, the `01 Account` section eyebrow, the `Email` row, the existing radio group `First name + role` / `Full name + role`, the `Password` row, and every section below (02 Privacy → 06 About) all stay exactly as they are in the current build.

---

## Screens / Views

### 1. Settings — Account section (modified)

**Purpose:** Lets a leader choose how their display name appears across the network.

**Layout (only the new/changed block — `Display name shown to others` row):**

Inside one parent row (same `s-row` chassis used by Email and Password), top-to-bottom:

1. **Mono eyebrow** — `Display name shown to others` *(existing — unchanged)*
2. **Radio group** *(existing — labels now data-driven, see Behavior)*
   - `○ First name + role`  → italic-serif preview `Psalmist Ruth`  *(muted when not selected)*
   - `◉ Full name + role`   → italic-serif preview `Psalmist Ruth James`  *(sky when selected)*
3. **`Format` mini-eyebrow** *(new)* — same mono register as `Display name shown to others`, sits 14 px below the last radio preview
4. **Checkbox: `Show last name first`** *(restyled — see Components)*
5. **Checkbox: `Include middle name in full name`** *(new)*
6. **Hairline dashed rule** at `rgba(240,237,230,0.07)`, then…
7. **Honorific row** — mono label left, italic-serif sky value next to it, sky chevron `›`
8. **Suffix row** *(new)* — same pattern as Honorific
9. Parent row ends; the **Password** row continues below as before.

### 2. Honorific picker sheet

Bottom sheet, opens when user taps the Honorific row.

**Content (top → bottom):**

- Grip handle, 36×4 rounded
- Mono eyebrow `Choose one` (sky, with hairline rules either side)
- Italic-serif title `Honorific`
- Italic-serif italic sub-line: `A prefix shown before your name in the network.`
- Hairline rule, 28 px wide, centred, sky-mid
- Options list, each row: `◉/◯` glyph + italic-serif specimen. **No tradition labels.** Options:
  - `Not set` *(sans, not italic — neutral cleared state)*
  - `Anba`
  - `Mar`
  - `Abuna`
  - `Achen`
  - `Catholicos`
  - `Patriarch`
- Foot copy (mono, 8.5 px small-caps): `Tap a name to confirm`

Selecting an option dismisses the sheet and writes the value into the Honorific row.

### 3. Suffix picker sheet (new)

Same chassis as the Honorific sheet — only the title, sub-line, and options change.

- Title: `Suffix`
- Sub-line: `Earned or honorary letters shown after your name. PhD, MDiv, ThD…`
- Options: `Not set`, `PhD`, `MDiv`, `DMin`, `ThD`, `DD`, `Other…`
- `Other…` opens a single-line text input (max ~12 chars) so a leader can enter letters we didn't list (`ThM`, `EdD`, `Hon.`, etc.). Same chassis as the rest of the sheet — italic-serif input, sky caret, mono "Confirm" pill.

---

## Components

### Checkbox (`Format` checkboxes)

| State | Border | Fill | Check glyph |
|---|---|---|---|
| Off | `0.5 px` `rgba(240,237,230,0.18)` (`Colors.border` × 2-ish — use `borderAccent` if you'd rather, or define `Colors.hairline = 'rgba(240,237,230,0.18)'`) | `Colors.background` | none |
| On | `0.5 px` `Colors.accent` (`#6BB5E8`) | `rgba(107,181,232,0.10)` (sky-tint) | sky tick, 1.2 px stroke, rotated −45° |

- Outer hit area: full row, ~32 px tall.
- Square size: **14 × 14**, `Radius.sm` (4).
- Label sits to the right with a 12 px gap, `Typography.body` 13 px, `Colors.text` (on) or `Colors.text` at 0.65 alpha (off) — the HTML uses `--soft` (`rgba(240,237,230,0.65)`) for the off label.
- Transition: 150 ms ease.

### Honorific / Suffix row

Layout: `flex-direction: row; align-items: baseline; gap: 14`.

- **Label** — `Typography.mono`, **9 px**, letter-spacing `0.2em`, uppercase, `Colors.textMuted`. `min-width: 64` so Honorific and Suffix labels stack-align visually.
- **Value** — `Typography.displayMediumItalic` (Cormorant 500 italic), **14.5 px**, `Colors.accent` (`#6BB5E8`), letter-spacing `0.01em`, line-height 1.
- **Chevron `›`** — `Typography.body` 11 px, `Colors.accent`, opacity 0.8, 6 px gap from value.

The whole row is one tappable target (~38 px tall) that opens the corresponding picker.

### Picker sheet chassis (shared by Honorific + Suffix)

- Bottom sheet, slides up from below.
- Position: 14 px from left/right/bottom inside the screen, leaves the dimmed Settings header peeking at the top.
- Background `#131313`, 0.5 px border `rgba(240,237,230,0.06)`, `Radius.xl` (20), shadow `0 28px 60px rgba(0,0,0,0.7)`.
- Backdrop: scrim `rgba(0,0,0,0.55)` over the underlying Settings screen + a 2 px blur if the platform allows it.
- Padding: 22 / 22 / 18 / 22.
- Internal layout, top→bottom:
  1. Grip 36×4, `rgba(240,237,230,0.18)`, `Radius.xs`, centred, 14 px bottom margin.
  2. Mono eyebrow with hairline rules either side (each 16 × 0.5 px, sky-mid).
  3. Italic-serif title — `Typography.displayItalic` 22 px, centred.
  4. Italic-serif sub-line — `Typography.scriptureItalic` 12.5 px, `--soft` (rgba 0.65), max-width 230, centred, line-height 1.55.
  5. 28 × 0.5 px sky-mid rule, centred, 12 px below.
  6. Options list — see below.
  7. Foot copy — `Typography.mono` 8.5 px, sky letter-spacing `0.22em`, centred, 14 px top padding.

### Picker option

Each option is a row, `flex-direction: row`, gap 10, padded 11 / 4 / 11 / 4, separated by a 0.5 px `Colors.border` hairline (omit the rule on the last option).

- **Glyph column** (22 px) — `Typography.mono` 11 px. Selected: `◉` sky. Unselected: `◯` `Colors.textMuted`.
- **Title** — `Typography.displayItalic` (Cormorant 600 italic) **17 px**, `Colors.text`, letter-spacing 0.02em. Selected: `Colors.accent`. Exception: the `Not set` option renders in `Typography.body` 13.5 px (sans, not italic) so it reads as a neutral cleared state and visually separates from the actual honorifics below it.
- The whole row is the tap target.

---

## Interactions & Behavior

### Live label + preview wiring

Source of truth: the user's stored profile (`firstName`, `middleName?`, `lastName`, `role`, `honorific?`, `suffix?`, `lastNameFirst: boolean`, `includeMiddleName: boolean`).

Render rules:

```
preview = [honorific, role, namePart, suffix && ', ' + suffix].filter(Boolean).join(' ')

namePart, when lastNameFirst === false:
  full       = firstName + (includeMiddleName && middleName ? ' ' + middleName : '') + ' ' + lastName
  firstRole  = firstName

namePart, when lastNameFirst === true:
  full       = lastName + ', ' + firstName + (includeMiddleName && middleName ? ' ' + middleName : '')
  firstRole  = lastName     ← AND the radio label itself flips from "First name + role" to "Last name + role"
```

Toggling **`Show last name first`**:
- Radio option 1's **label** changes: `First name + role` ⇄ `Last name + role`.
- Radio option 1's **preview** updates: `Psalmist Ruth` ⇄ `Psalmist James`.
- Radio option 2's **preview** updates: `Psalmist Ruth James` ⇄ `Psalmist James, Ruth`.

Toggling **`Include middle name in full name`**:
- Only affects the **Full name + role** preview (and the resulting network display when that option is selected).
- Off: `Psalmist Ruth James` / `Psalmist James, Ruth`.
- On: `Psalmist Ruth Elizabeth James` / `Psalmist James, Ruth Elizabeth`.

Honorific selected (e.g. `Anba`):
- Prepended to every preview: `Anba Psalmist Ruth James`.

Suffix selected (e.g. `PhD`):
- Appended after a comma + space: `Psalmist Ruth James, PhD`.

### Picker open / dismiss

- Tap the Honorific or Suffix row → sheet slides up (~220 ms, ease-out).
- Tap an option → write value to profile, dismiss sheet (~180 ms ease-in).
- Tap backdrop or drag the grip down → dismiss without change.
- `Other…` on Suffix → swap the option list for a text input + small `Confirm` pill below it. `Confirm` validates non-empty (trimmed) ≤ 12 chars and writes the value.

### Accessibility

- Each picker option: `accessibilityRole="radio"`, `accessibilityState={{ selected }}`.
- Checkboxes: `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`.
- Honorific/Suffix row: `accessibilityRole="button"`, `accessibilityLabel="Honorific, currently Not set"` (live-updates with value).
- The radio label-text change on Show-last-name-first toggle should also fire an `AccessibilityInfo.announceForAccessibility` so a screen-reader user hears the new label without having to swipe back.

---

## State Management

Add to whatever store currently holds `displayNamePreference` (the `First name + role` / `Full name + role` radio's state). Suggested field names:

```ts
type DisplayNamePrefs = {
  preference: 'first' | 'full';      // existing
  lastNameFirst: boolean;             // new
  includeMiddleName: boolean;         // new
  honorific: string | null;           // new — null = Not set
  suffix: string | null;              // new — null = Not set; free-form when "Other…"
};
```

Persistence: same write path as the existing radio (`PATCH /users/me`, `display_name_preference` group). Add fields `last_name_first`, `include_middle_name`, `honorific`, `suffix` to that payload. Optimistic UI; revert on error toast (matches the existing pattern for `display_name_preference`).

---

## Design Tokens → mapping

The HTML uses CSS variables that map onto existing `theme.ts` tokens (no new tokens required):

| HTML var | `theme.ts` token |
|---|---|
| `--bg`        | `Colors.background` (`#080808`) |
| `--surface`   | `Colors.surface` (`#111111`) |
| `--text`      | `Colors.text` (`#F0EDE6`) |
| `--muted`     | `Colors.textMuted` (`rgba(240,237,230,0.45)`) |
| `--soft`      | *(not in theme; use `'rgba(240,237,230,0.65)'` inline — or add `Colors.textSoft` if you want it tokenised)* |
| `--faint`     | `Colors.border` (`rgba(240,237,230,0.08)`) |
| `--hairline`  | *(not in theme; use `'rgba(240,237,230,0.18)'` inline — or add `Colors.hairline`)* |
| `--sky`       | `Colors.accent` (`#6BB5E8`) |
| `--sky-mid`   | `Colors.borderAccent` (`rgba(107,181,232,0.25)`) — sheet rules use 0.35 in the HTML; either is acceptable. Prefer `borderAccent` for consistency. |
| `--sky-tint`  | *(not in theme; use `'rgba(107,181,232,0.10)'` inline — or add `Colors.accentTint`)* |
| `--serif`     | `Typography.display` / `displayItalic` / `displayMediumItalic` |
| `--sans`      | `Typography.body` / `bodyMedium` |
| `--mono`      | `Typography.mono` |

**If you'd rather not inline the three missing values**, add to `theme.ts`:

```ts
textSoft:    'rgba(240, 237, 230, 0.65)',
hairline:    'rgba(240, 237, 230, 0.18)',
accentTint:  'rgba(107, 181, 232, 0.10)',
```

Spacing values used: `Spacing.xs` (4), `Spacing.sm` (8), `Spacing.md` (16), `Spacing.lg` (24).
Radii used: `Radius.sm` (4) on the checkbox; `Radius.xl` (20) on the sheet — the HTML uses 18 px which rounds to `Radius.xl`. The grip uses `Radius.sm` (2 in CSS — close enough to `xs/2`, just hardcode 2).

---

## Copy reference (exact)

- Section parent label: **`Display name shown to others`**
- Radio (lastNameFirst === false): **`First name + role`** / **`Full name + role`**
- Radio (lastNameFirst === true):  **`Last name + role`** / **`Full name + role`**
- Format eyebrow: **`Format`**
- Checkbox 1: **`Show last name first`**
- Checkbox 2: **`Include middle name in full name`**
- Honorific row label: **`Honorific`**, value placeholder: **`Not set`**
- Suffix row label: **`Suffix`**, value placeholder: **`Not set`**
- Honorific sheet eyebrow / title / sub: `Choose one` / `Honorific` / `A prefix shown before your name in the network.`
- Suffix sheet eyebrow / title / sub: `Choose one` / `Suffix` / `Earned or honorary letters shown after your name. PhD, MDiv, ThD…`
- Sheet foot: `Tap a name to confirm` (Honorific) / `Tap to confirm · "Other" opens a text field` (Suffix)

---

## Assets

No new images, icons, or fonts. All glyphs are typographic (`◉`, `◯`, `›`) and the check mark is drawn with two CSS borders rotated −45° — in React Native, draw it the same way with a `View` (1.2 px `borderLeftWidth` + `borderBottomWidth` + `transform: [{ rotate: '-45deg' }]`) or use an inline SVG path if your component library has one available.

## Files in this bundle

- `Settings - Name Fields Fix.html` — the live design reference. Open it in a browser, scroll to the **After — Account row** phone, and toggle the two checkboxes to watch the labels + previews update exactly as they should in the app. The two picker sheets are shown in the row below.
- `README.md` — this document.

## Open questions for product

1. **Sort order in the Honorific sheet.** Alphabetical or by tradition prevalence? Current order is the order the live build uses; confirm before ship.
2. **Suffix free-form length.** 12 chars suggested above — confirm with QA.
3. **Where to bind the middle name.** If we don't already collect `middleName` at signup, this checkbox should be disabled with a helper line — "Add a middle name in Account → Edit profile" — and the row should link there. Confirm whether middle name lives in the profile schema yet.
