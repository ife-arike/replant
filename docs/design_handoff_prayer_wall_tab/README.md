# The Prayer Wall Tab — Design Handoff

Hi-fi prototype + engineering spec for The Prayer Wall tab in the Replant React Native app.
Open `Replant - The Prayer Wall Tab.html` in any modern browser to preview at iPhone 16 Pro Max.

## What's in this package

```
Replant - The Prayer Wall Tab.html   ← open this first
prayer-wall-tab/
├── app.jsx                          ← React component tree + state
├── styles.css                       ← visual tokens + component CSS
└── tweaks-panel.jsx                 ← state switcher (web-prototype only; not for RN)
shared/
└── shared.css                       ← global tokens (sky/red/cream/serif/mono) + intercession primitive
```

## Purpose of this tab

A sanctuary where the body of Christ — verified Replant leaders worldwide — lifts one another up in prayer.
Two halves:
1. **Make Intercession** — pray *through* the global wall of requests submitted by other churches.
2. **Receive Intercession** — let the body lift *your* church in prayer (locked at MVP; full design ready).

Below that, a personal intercession journal entry, then a swipeable carousel of **Testimonies**
(answered prayers reported back by leaders), then a scripture footer (Ephesians 6:18).

The visual language matches the Church tab and the Persecuted tab. **Sky-blue throughout, no
multicolor palette.** The original tab used red/blue/green/amber simultaneously — that's removed.
RAG status dots remain only on global preview rows (they refer to the requesting church's RAG status).

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--sky` | `#6BB5E8` | Primary accent, all CTAs, links, eyebrows, scripture eyebrows |
| `--off-white` / `--cream` | `#F0EDE6` / `#E6E1D5` | Body text |
| `--bg` / `--black` | `#0b0b0c` / `#080808` | Background, deepest surfaces |
| `--surface` / `--surface2` | `#121214` / `#18181b` | Cards, raised surfaces |
| `--muted` | `rgba(240,237,230,0.55)` | Secondary text |
| `--muted-2` | `rgba(240,237,230,0.32)` | Tertiary text, separators |
| `--faint` | `rgba(240,237,230,0.08)` | Hairlines, dashed empty-state borders |
| `--sky-mid` | `rgba(107,181,232,0.35)` | Card borders that emphasize sanctuary |
| `--sky-dim` | `rgba(107,181,232,0.12)` | Ghost-button hover, card backgrounds |
| `--sky-faint` | `rgba(107,181,232,0.06)` | Subtle glows, hover backgrounds |

### Type system

| Family | Use |
|---|---|
| Cormorant Garamond — 300/400, regular + italic | Headings, scripture, testimony body, preview row body |
| DM Sans — 400/500/600 | UI text, button labels |
| JetBrains Mono — 400/500 | Eyebrows, meta lines, stats numbers, RPL IDs |

### Spacing

Same as other tabs — 22px screen edges, 8/12/14px gaps, 6–10px card radius.

## Component breakdown

### `<TabHeader />`
- Eyebrow: "TAB 4 · THE BODY GATHERED"
- Title: serif "Prayer Wall"
- Subtitle: "1,247 INTERCEDING · UPDATED LIVE"
- A soft sky-blue glow at the very top of the screen (sanctuary feeling)

### `<MakeIntercessionHero />`
The primary action card.
- Sky eyebrow with pulsing dot: "● TONIGHT · LIVE"
- Serif title: "Make intercession" (24px, off-white)
- Sub-line: "Pray through the wall of requests from churches around the world."
- **Two preview rows** of the latest open requests:
  - Sky dot
  - Serif italic body — single line, ellipsis-truncated
  - Mono meta below: `LAGOS, NIGERIA · 1H AGO`
- Stats line: `1,247 INTERCEDING NOW · 12 ADDED THIS HOUR`
- Full-width sky primary CTA: "Enter the prayer wall →"
- Subtle candle-glow in the bottom-right corner

### `<ReceiveIntercession />` — has 3 states
**Locked (MVP default)**: a slim row with lock glyph + title + "Coming soon" badge.

**Built · open requests**:
- Same hero pattern as Make Intercession
- Eyebrow: "● YOUR CHURCH · LIFTED BY 47"
- Title + sub
- Two preview rows of YOUR church's currently-open requests
  - Sky dot + serif italic body (truncated) + meta `POSTED 2D AGO · 23 INTERCEDING`
- Stats: `2 OPEN · 111 PRAYING FOR YOU`
- Sky-ghost button: "+ Share a need"

**Built · no requests**:
- Same hero shell
- An inset dashed-border empty card replaces the preview list:
  - Plus glyph
  - *"No open requests yet."*
  - *"Share what your church is carrying. Others will lift it before God."*
- Sky-ghost button: "+ Share a need"

### `<JournalLink />`
- One-row clickable card with hairline border
- Sky book icon + title "Your intercession journal" + meta `12 HOLDING · 4 RETURNED WITH ANSWER` + sky chevron
- On hover: subtle sky-faint background + sky-mid border

### `<TestimonyCarousel />`
A deliberate break in normalcy — the rest of the tab scrolls vertically, this moves sideways.
- One card visible at a time, near-full-width (94% of viewport)
- Native scroll-snap-x with smooth scroll
- Sky chevron buttons on either side (`prev` / `next`), dim at the ends
- Dot pagination below

### `<TestimonyCard />`
Same intercession primitive as the Church tab.
- Sky-blue 2px left accent
- Mono caps head: `● MUMBAI, INDIA   RPL-00263`
- Leader name (sans, muted)
- Serif italic body (the testimony itself)
- Mono meta row: `+ Amen` (sky, clickable) ↔ `1,289 amen · 2d ago` (muted)
- **Answered** badge in the top-right corner (sky text, mono caps, sky-mid border)

### `<TestimoniesEmpty />`
- Dashed sky circle glyph
- Serif italic title: *"No testimonies yet."*
- *"The prayers continue. When the Lord answers, the testimonies will be carried here."*

### `<ScriptureFooter />`
- Sky eyebrow "WATCHING IN PRAYER"
- Serif italic verse (Ephesians 6:18)
- Mono ref "EPHESIANS 6:18"

### `<TabBar />`
5 tabs: Home · The Church · Persecuted · **Prayer (sky active)** · Connect

## State model

```ts
type View = 'default' | 'empty-testimonies';
type ReceiveState = 'locked' | 'active' | 'active-empty';

type GlobalPreview = {
  loc: string;          // e.g. 'Lagos, Nigeria'
  when: string;         // '1h' | '3h' | '2d'
  text: string;         // truncated to one line in UI
};

type MyOpenRequest = {
  text: string;
  posted: string;       // '2d' | '6d'
  praying: number;      // count
};

type Testimony = {
  id: string;
  loc: string;          // 'Mumbai, India'
  rpl: string;          // 'RPL-00263'
  leader: string;       // 'Pastor Anand Rao'
  text: string;         // full body
  when: string;         // '2d' | '4d' | '1w'
  amened: number;       // count
  answered: boolean;    // shows "Answered" badge
};
```

## Interaction contracts

### Enter the prayer wall
```
Make Intercession CTA tapped
  → navigate to /prayer-wall/feed (deep wall, separate screen, out of scope here)
```

### Preview rows
```
Any preview row tapped (Make or Receive)
  → opens the corresponding prayer request detail in a sheet
  → backend: GET /prayer-requests/:id
```

### Share a need (Receive · active OR active-empty)
```
"Share a need" tapped
  → opens a request-composer sheet (out of scope here)
  → on submit, the new request becomes the first row in MyOpenRequests
```

### Testimony amen
```
Testimony "+ Amen" tapped
  → optimistic: amened++
  → POST /testimonies/:id/amen
```

### Testimony carousel
```
Chevron prev/next  → scrollIntoView the adjacent card
Native swipe       → updates active dot on scroll
At first card      → prev chevron disabled (0.25 opacity)
At last card       → next chevron disabled
```

### Journal link
```
Tap → navigate to /intercession-journal
  → list of "currently holding" + "returned with answer" cards
```

## React Native conversion notes

1. **CSS → StyleSheet**: translate tokens to a `theme.ts` module, then per-component StyleSheets.
2. **Fonts**: load Cormorant Garamond, DM Sans, JetBrains Mono via `expo-font`.
3. **SVGs**: re-render via `react-native-svg`. The pulsing live-dot uses CSS animation
   (`@keyframes livePulse`) — translate to Reanimated.
4. **Gradients**:
   - Hero card background (180deg surface → sky-tint)
   - Receive-active background (similar)
   - Both candle-glow `::after` radial gradients
   Use `expo-linear-gradient` + a radial-gradient hack (multiple stops via React Native Linear Gradient, or PNG underlay).
5. **Scroll-snap**: `ScrollView horizontal` with `pagingEnabled` OR `snapToInterval={cardWidth + gap}`
   + `decelerationRate="fast"`. iOS will feel native; Android may need `snapToOffsets`.
6. **Backdrop-filter / blur**: the Tab Bar's `backdrop-filter: blur(20px)` should be implemented with
   `@react-native-community/blur` or `expo-blur` on iOS. Android may need a simple semi-opaque background.
7. **Pulsing dot animation**:
   ```
   .live-dot — opacity 0.4 → 1.0 → 0.4 over 2s, ease-in-out, infinite
   ```
   Drive with Reanimated `useSharedValue` + `withRepeat(withTiming(...))`.
8. **Truncation**: preview-row body is `numberOfLines={1}` + `ellipsizeMode="tail"`.
9. **Safe area**: header sits under the status bar; use `useSafeAreaInsets()`.

## Tweaks panel

Web prototype only. Don't ship in React Native. Used for reviewer state-switching.

## Open questions

1. Receive Intercession ships at MVP as locked. When fully built, are open requests visible only
   to the church that owns them, or also to leaders who tap to view? (Currently the preview rows
   imply they're the requesting leader's own — but the spec needs to confirm visibility scope.)
2. Are testimonies moderated before publishing, or trust-and-flag?
3. Testimonies carousel: 5 testimonies shown — is there an upper bound / pagination, or is the full
   wall behind "See all"?
4. The pulsing "TONIGHT · LIVE" eyebrow: is "Tonight" the right framing if a user opens at 10am?
   Consider time-aware copy ("Right now · live") or a static "● Live" indicator.
5. The "Receive intercession" stats — `2 OPEN · 111 PRAYING FOR YOU` — does the leader want a
   notification when the praying count crosses thresholds?
