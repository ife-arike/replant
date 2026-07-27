# Handoff: Replant Settings Screen (Screen 20)

## Overview
The Settings screen for the Replant leader app — accessed from the hamburger overlay (Screen 20, KAN-72). This is a v2 "on-brand" pass over the earlier wireframe: the structure, write contracts, and founder rulings are unchanged from v1, but the screen has been re-treated typographically and compositionally to match Replant's established brand system (brand kit, login flow v3, tab bar v2).

The screen carries: Account · Privacy · Church (incl. RAG status) · Language · **Notifications (new)** · About · Connect block · scripture foundation · destructive footer.

> **Round-3 update:** a new **05 — Notifications** section was added (About renumbered 05 → 06). It holds the first notification preference — a **New message badge** toggle (on by default) that gates the Connect tab's unread badge. Sizing is enumerated under *Section details → 05 — Notifications* and *Component sizing*.

## About the Design Files
The HTML file in this bundle is a **design reference** — a static prototype showing the intended look, copy, hierarchy, and interaction model. It is **not production code to copy directly**.

Your task: **recreate this design in the Replant codebase's existing mobile environment** (React Native / Expo or whatever the leader app is built on), using its established component patterns, theme tokens, and navigation primitives. If no environment is established yet for this screen, follow the conventions of adjacent already-shipped surfaces (e.g. Screen 06 login flow, the tab bar). Do not introduce new design tokens — every color, font, and spacing value in this design already exists in the brand system.

## Fidelity
**High fidelity.** Every value below is final:
- Exact hex colors (sourced from the brand kit)
- Exact typography (Cormorant Garamond, DM Sans, DM Mono — already loaded in the app)
- Exact spacing rhythm (matches login flow v3 + tab bar v2)
- Exact copy strings

Implement pixel-for-pixel using the existing component library.

---

## The Screen — single scrolling surface

A single scrollable view; no segmented frames. The hamburger overlay routes here.

### Layout (top to bottom)

1. **Status bar** — system-provided, do not draw
2. **Header** — back chevron (left, 18px col) · serif "Settings" title (center) · rp logo mark (right, 26px, 28px col)
3. **Hairline rule** — 0.5px `rgba(240,237,230,0.08)` full width
4. **Epigraph** — italic-serif sky-blue line: *"your account, your church."* centered, followed by a 28px sky-mid hairline rule centered beneath
5. **Section: 01 — Account**
6. **Section: 02 — Privacy**
7. **Section: 03 — Church**
8. **Section: 04 — Language**
9. **Section: 05 — Notifications**  *(new — first notification preference; see below)*
10. **Section: 06 — About**
11. **Connect block** — mission-treatment, full-width with flanking hairlines top + bottom
12. **Foundation block** — rp mark (28px, ~55% opacity) + italic-serif scripture + DM Mono KJV citation + version stamp
13. **Destructive footer** — Sign out (serif) + Deactivate account (DM Mono red, low opacity)

### Section composition (applies to every numbered section)

Every section uses the same head pattern, lifted from the brand kit's chapter structure:

```
[ DM Mono 01, sky #6BB5E8, letter-spacing 0.22em ]  [ Cormorant Garamond serif title, 19px, weight 400 ]
[ 0.5px hairline rule, full width, faint ]
[ rows... ]
```

- Numbered eyebrow: `01` / `02` / `03` / `04` / `05` — DM Mono, 9.5px, letter-spacing 0.22em, color `#6BB5E8`
- Section title: Cormorant Garamond, 19px, weight 400, letter-spacing 0.03em, color `#F0EDE6`
- Baseline-aligned with the number; gap 10px
- Rule beneath: 0.5px, full-width, color `rgba(240,237,230,0.08)`
- Section top padding: 22px

### Row composition

Default row:
- Padding: 13px top, 11px bottom
- Border-bottom: 0.5px `rgba(240,237,230,0.08)`; last row in a section omits this
- **Row label** (above value): DM Mono, 9px, letter-spacing 0.2em, uppercase, color `rgba(240,237,230,0.45)`, margin-bottom 5px
- **Row value**: DM Sans, 13px, weight 300, color `#F0EDE6`, letter-spacing 0.01em
- For navigation rows: row value is a flex row with `›` chevron on the right, color `rgba(240,237,230,0.45)`
- For read-only rows (Email, Church name, Language placeholder): row value uses muted color `rgba(240,237,230,0.45)`

---

## Section details

### 01 — Account

**Row: Email** (read-only at MVP per founder ruling)
- Label: `EMAIL`
- Value: `daniel.mwangi@example.com` (muted, no chevron, no edit affordance)

**Row: Display name shown to others** (radio pair with live preview)
- Label: `DISPLAY NAME SHOWN TO OTHERS`
- Two radio options, each rendered as:
  - Glyph `◉` (selected) or `○` (unselected) in DM Mono 11px sky / muted
  - Sans label: "First name + role" / "Full name + role"
  - **Italic-serif live preview** beneath each, indented 20px:
    - "First name + role" → *Pastor Daniel*
    - "Full name + role" → *Pastor Daniel Mwangi*
  - Preview style: Cormorant Garamond italic, 13.5px, color `#6BB5E8` (selected) / `rgba(240,237,230,0.32)` (unselected)
- Writes to `users.display_name_preference` per founder anchor D-15
- Optimistic, no Save button

**Row: Password**
- Label: `PASSWORD`
- Value: "Change password" + `›` chevron
- Tap → in-app navigation to existing Screen 06A reset flow

### 02 — Privacy

**Row: Anonymous mode**
- Label above the row: `ANONYMOUS MODE`
- Below the label: flex row with two children, `justify-content: space-between`, `align-items: center`
  - Left: "Off" (or "On") — DM Sans, 13px, color `#F0EDE6`
  - Right: toggle component (see Components below)
- Helper text beneath the toggle row (full-width): italic Cormorant Garamond, 14px, color `rgba(240,237,230,0.65)`, line-height 1.55, margin-top 10px
  - Copy: *"When on, others see your role and church only — never your name."*
- Helper copy is **placeholder pending ESC-08 close**; the toggle affordance itself does not change

### 03 — Church

**Row: Church**
- Label: `CHURCH`
- Value: `New Life Church` (muted, read-only)

**Row: Status — can your church worship freely?** (RAG)
- Label: `STATUS — CAN YOUR CHURCH WORSHIP FREELY?` (DM Mono small-caps)
- Three radio options, each on a single line:
  - **Green** — yes, with no limitations
  - **Amber** — with some limitations or needs
  - **Red** — severely limited or facing active persecution
- The color **word** is rendered as the swatch:
  - Cormorant Garamond italic, 14px, weight 500, letter-spacing 0.02em
  - Color: `#F0EDE6` (off-white) for selected and unselected — the meaning lives in the word, the color identity is reserved for map dots and other places
  - Muted slightly on unselected options via the soft tone
- Rest of the option text after the em-dash: DM Sans 12.5px, color `#F0EDE6` (selected) / `rgba(240,237,230,0.65)` (unselected)
- Verified leaders only. Unverified → render this section read-only (founder ruling, handled at screen-state level)
- Optimistic write to `churches.status` field on tap

### 04 — Language

**Row: App language**
- Label: `APP LANGUAGE`
- Value: italic Cormorant Garamond "Coming soon" (muted) — typographic placeholder, no flag-grid, no clipart

### 05 — Notifications  *(new)*

The first notification-related preference in the app. Uses the standard section head (`05 — Notifications`) and a single toggle row.

**Row: New message badge**
- Label: `NEW MESSAGE BADGE`
- Toggle row (flex, space-between): value text "On" / "Off" (DM Sans 13px `#F0EDE6`) on the left, toggle component on the right
- **On by default.**
- Helper text beneath (italic Cormorant Garamond, 14px, `--soft`, line-height 1.55, margin-top 10px): *"Shows a count on the Connect tab when you have unread messages."*
- Write: optimistic → `PATCH /users/me` `notif_message_badge` (boolean, default `true`); revert on error
- **Cross-feature contract:** when ON, the Connect tab icon (tab bar position 5) shows a numeric badge of total unread across all conversations, hidden at zero, capped "99+" (see the Connect tab handoff §15.1). When OFF, that badge is suppressed app-wide.

### 06 — About

Three navigation rows, each with title + `›` chevron, in-app navigation to a read-only content view:
1. **Declaration of Faith**
2. **Terms of use**
3. **Privacy policy**

---

## Connect block (mission-treatment)

Sits below the About section. Full-width, centered text, hairlines top + bottom.

- Padding: 22px top, 18px bottom, 8px horizontal
- Border-top + border-bottom: 0.5px `rgba(240,237,230,0.08)`
- **Eyebrow**: "Reach the team" — DM Mono, 9px, letter-spacing 0.24em, uppercase, color `#6BB5E8`, with flanking 14px hairlines (left + right) at sky-mid `rgba(107,181,232,0.35)`
- **Email**: `connect@projectreplant.org` — Cormorant Garamond italic, 18px, weight 400, color `#6BB5E8`, letter-spacing 0.01em, line-height 1.3
- **Hint**: "Tap to copy & open mail" — DM Mono, 8.5px, letter-spacing 0.2em, uppercase, color `rgba(240,237,230,0.45)`
- **Tap interaction**: copies the address to clipboard AND opens the default mail composer pre-filled to that address. Same pattern as the deactivation modal in login flow v3. No CTA button — the address *is* the action.

---

## Foundation block (scripture anchor)

Below the Connect block. Centered.

- Padding: 26px top, 8px bottom
- **rp mark**: 28px × 28px, opacity 0.55, centered, margin-bottom 10px (uses `rp-mark.svg` bundled in this folder; viewBox already cropped to the mark)
- **Scripture**: italic Cormorant Garamond, 12.5px, weight 300, color `rgba(240,237,230,0.65)`, line-height 1.65, max-width 230px
  - Exact copy: *"That they all may be one, as thou, Father, art in me, and I in thee."*
- **Citation**: `JOHN 17:21 — KJV` — DM Mono, 8.5px, letter-spacing 0.2em, uppercase, color `#6BB5E8`, margin-top 10px
- **Version stamp**: `VERSION 1.0.0` — DM Mono, 8.5px, letter-spacing 0.18em, uppercase, color `rgba(240,237,230,0.45)`, margin-top 18px

---

## Destructive footer

Below the foundation block, separated by a 0.5px faint hairline. Centered, vertical stack, gap 18px.

- **Sign out**: Cormorant Garamond, 14px, weight 400, color `rgba(240,237,230,0.65)`, letter-spacing 0.04em — a name, not a button
  - Tap → lightweight confirmation → `signOut()` → returns to Screen 06 default state
- **Deactivate account**: DM Mono, 9px, letter-spacing 0.22em, uppercase, color `rgba(224,85,85,0.55)` (low-opacity red — solemn, not alarming)
  - Tap → step-up reauth modal (canonical exception to inline-over-modal) → consequence screen → `deactivate_user` audit row + `scrub_user_pii` scheduled per 90-day retention window (D-42). Consequence screen is its own surface, not in scope here.

---

## Interactions & behavior

| Row | Action | Write contract |
|---|---|---|
| Email | (read-only) | — |
| Display name pref | Tap option → instant UI update | `PATCH /users/me` `display_name_preference`; revert on error |
| Password chevron | Tap → navigate | In-app push to Screen 06A reset flow |
| Anonymous toggle | Tap → instant flip | `PATCH /users/me` `anonymous`; revert on error |
| Church name | (read-only) | — |
| RAG status | Tap option → instant UI update | Write to `churches.status`; verified leaders only |
| Language | (placeholder) | — |
| About chevrons | Tap → navigate | In-app push to read-only content view |
| Connect email | Tap | Copy to clipboard + open mail composer |
| Sign out | Tap → lightweight confirm | `signOut()` → Screen 06 |
| Deactivate account | Tap | Step-up reauth modal → consequence screen → audit + PII scrub |

**Optimistic writes everywhere.** No Save button on any row. The leader changes a preference, it changes instantly, and the network call follows. On error, revert the UI and surface the existing error toast pattern.

---

## State management

- `user.display_name_preference`: `'first_name_role' | 'full_name_role'` (default `'first_name_role'`)
- `user.anonymous`: `boolean` (default `false`)
- `user.church.status`: `'green' | 'amber' | 'red'` (default `'green'`)
- `user.is_verified_leader`: `boolean` — gates whether the RAG section is interactive vs. read-only
- Standard mutation pattern: optimistic update local state → fire `PATCH` → on error, revert + surface error toast

---

## Design tokens

These already exist in the Replant brand system. Do not add new tokens.

### Colors
| Token | Value | Used for |
|---|---|---|
| `--bg` | `#080808` | Primary background |
| `--surface` | `#0F0F0F` | Reserved (not used on this screen) |
| `--text` | `#F0EDE6` | Primary text, RAG color words |
| `--muted` | `rgba(240,237,230,0.45)` | Labels, read-only values, hints |
| `--soft` | `rgba(240,237,230,0.65)` | Helper italic, unselected option text, scripture |
| `--faint` | `rgba(240,237,230,0.08)` | Hairline rules |
| `--hairline` | `rgba(240,237,230,0.18)` | Toggle border (off state) |
| `--sky` | `#6BB5E8` | Brand accent, eyebrows, section numbers, italic flourishes, citation |
| `--sky-mid` | `rgba(107,181,232,0.35)` | Sky-mid hairlines |
| `--sky-tint` | `rgba(107,181,232,0.10)` | Toggle on-state background |
| `--green` | `#5BAD7A` | RAG green (reserved for map; not on word text here) |
| `--amber` | `#D4A855` | RAG amber |
| `--red` | `#E05555` | RAG red + deactivate (low opacity) |

### Typography
| Family | Use |
|---|---|
| Cormorant Garamond (300/400/500, italic) | Titles, section titles, italic-serif previews, italic helpers, scripture, Sign out, italic Coming soon |
| DM Sans (300/400/500) | Body, row values, option text |
| DM Mono (400/500) | Eyebrows, row labels, section numbers, KJV citation, version stamp, hints, Deactivate account |

### Spacing
- Screen horizontal padding: 26px
- Section top padding: 22px
- Row padding: 13px top, 11px bottom
- Section title gap to rule: 14px (from head) / 4px (rule to first row)
- Hairline rules: 0.5px

### Component sizing
- Toggle: 38 × 21px, border-radius 11px, thumb 15 × 15px, slides 16px
- Radio glyph (◉ / ○): DM Mono 11px
- rp mark in header: 26 × 26px
- rp mark in foundation: 28 × 28px @ opacity 0.55

---

## Assets

- **rp-mark.svg** — primary Replant mark (sky-blue). Bundled in this folder. ViewBox already cropped to the glyph; use as-is at any size. Already in the codebase if the brand asset folder is wired up.
- No icons used on this screen by design — the brand register avoids row icons in favor of typographic hierarchy.

---

## Files in this bundle

- `Replant Settings - On-brand.html` — the full design reference, including spec annotations alongside the screen. Treat the phone frame inside as the canonical visual; annotations are for context.
- `rp-mark.svg` — the Replant primary mark.
- `README.md` — this file.

---

## Notes for the implementer

1. **The numbered-eyebrow + serif-title section header is the brand's signature composition.** It's used throughout the brand kit (chapters), and now on this screen. If you're adding a new section to Settings later, reuse this pattern exactly — don't invent a new section-head style.

2. **The italic-serif previews under the Display-name radios are the brand's display face.** They show the leader exactly how they'll appear on the Prayer Wall and other surfaces. Don't replace them with plain sans labels.

3. **The Connect block and the Foundation block are mission-grade compositions, not rows.** They sit outside the section structure deliberately. The Connect block mirrors the deactivation-modal pattern in login flow v3. The Foundation block mirrors the brand kit's Mission & Foundation block.

4. **Destructive register is solemn, not loud.** Sign out is a serif name. Deactivate is mono small-caps red at 55% opacity. The weight lives on the step-up modal and the consequence screen — not on these links.

5. **Helper text under the anonymous toggle is italic-serif at 14px.** It reads at the weight of the row, not as a footnote. This is intentional — privacy copy carries weight here.

6. **Optimistic writes, no Save button anywhere.** Match the inline-over-modal preference established elsewhere.
