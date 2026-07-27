# Replant email shell — v2 design tokens
2026-07-13 · Family 1 (join-network welcome, serve-with-us welcome). This shell is the base for the verification-lifecycle re-dress and the KAN-321 launch broadcast.

## Architecture
- **Light-first, dark-correct.** Inline styles carry the light palette (survives `<style>`-stripping clients). Head `<style>` holds ONLY: dark-mode media query, Outlook.com `[data-ogsc]/[data-ogsb]` hooks, and ≤480px tweaks. Both `color-scheme` metas declared.
- Off-tones everywhere — no pure #fff/#000 — so Gmail's auto-inversion maps gracefully when media queries aren't honored.
- 560px centered column, flat background (no card), mso ghost table for Outlook desktop width.
- One `{{GREETING}}` slot. No tracking. Only external asset: the logo PNG.

## Color

| Token | Light (inline) | Dark (`.d-*` override) |
|---|---|---|
| bg | `#f4f1ea` warm paper | `#080808` |
| heading / wordmark | `#262420` | `#f0ece4` |
| body | `#4a4741` | `#c8c8c8` |
| accent link | `#3f7fae` | `#6BB5E8` |
| muted (signoff, reply link) | `#7a766e` | `#8a8a8a` |
| dim (footer, scripture caption) | `#9b968c` | `#6a6a6a` |
| rule | `#dcd7cb` | `#22211e` |
| scripture text | `#57534b` | `#c8c8c8` (shares body) |

Dark values are the locked 2026-05-15 admin-shell tokens. Light values are the same warmth translated to paper; accent is sky darkened to 4.5:1 on the paper bg.

## Type
- Display / wordmark / scripture: `'Cormorant Garamond', Georgia, 'Times New Roman', serif` (Google Fonts link included for clients that honor it; Georgia is the intentional fallback).
- Body: `'DM Sans', 'Helvetica Neue', Arial, sans-serif`.
- Wordmark: 17px, 500, letter-spacing 0.32em, uppercase.
- H1: 29px/1.28 roman (25px ≤480px). Section display ("Pray over this network."): 23px roman.
- Body: 15px/1.72. Footer/dim: 11px. Note line: 12px.
- **Italic is reserved for scripture blocks only** (`scriptureItalic` register: 17px/1.58 italic serif + 11px letterspaced uppercase citation). No bold/italic emphasis anywhere else.

## Spacing
- Outer: 44px top / 40px bottom / 16px gutters; column pads 24px x (20px ≤480px).
- Section gaps: 26px between blocks; 36px after masthead; 40px before scripture rule; rule top-pad 26px.
- Paragraph rhythm: 17px bottom margin.

## Dark-mode class hooks
`d-bg d-head d-body d-accent d-muted d-dim d-rule` — apply to any new element and it inherits correct dark behavior. Duplicate every `@media (prefers-color-scheme: dark)` rule under `[data-ogsc]` (`[data-ogsb]` for backgrounds) for Outlook.com.

## Logo — ⚠️ OPEN ITEM
`https://projectreplant.org/logo.png` (56×56 render, 512px source, transparent, sky-blue mark — reads on both grounds, no image swap needed). **This URL does not exist yet** — the live site draws its logo as inline SVG. Founder must upload `logo.png` (the 512×512 transparent PNG from `docs/emails/logo.png`) to the site root or confirm an alternate absolute URL before these templates deploy.
