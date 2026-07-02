# The Persecuted Tab — Design Handoff

Hi-fi prototype + engineering spec for The Persecuted tab in the Replant React Native app.
Open `Replant - The Persecuted Tab.html` in any modern browser to preview at iPhone 16 Pro Max.

## What's in this package

```
Replant - The Persecuted Tab.html   ← open this first
persecuted-tab/
├── app.jsx                         ← React component tree + state
├── styles.css                      ← visual tokens + component CSS
└── tweaks-panel.jsx                ← state switcher (web-prototype only; not for RN)
shared/
└── shared.css                      ← global tokens (sky/red/cream/serif/mono) + intercession primitive
```

## Purpose of this tab

A held space for verified Christian leaders facing severe persecution
(imprisonment, prohibition of fellowship, violence, active hunting for the faith).
Two functions:
1. A persecuted leader can **share a heartcry** anonymously — region only, never country.
2. Any verified leader can **hold heartcries in prayer**, lifting persecuted siblings before God.

The visual language is intentionally restrained. **Red appears only on the threshold —
header, hairline edge, heartcry accent, share-button border.** Everything else is sky-blue
on near-black, matching the Church tab and Prayer Wall vocabulary.

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--sky` | `#6BB5E8` | Primary accent, links, interceder count highlights |
| `--red` | `#D9594F` | The threshold — header, heartcry left-accent, set-apart hairline |
| `--off-white` / `--cream` | `#F0EDE6` / `#E6E1D5` | Body text on dark surfaces |
| `--bg` / `--black` | `#0b0b0c` / `#080808` | App background, deepest surfaces |
| `--surface` / `--surface2` | `#121214` / `#18181b` | Card backgrounds, raised surfaces |
| `--muted` | `rgba(240,237,230,0.55)` | Secondary text |
| `--muted-2` | `rgba(240,237,230,0.32)` | Tertiary text, separators |
| `--faint` | `rgba(240,237,230,0.08)` | Hairlines, faint borders |

### Type system (load from Google Fonts)

| Family | Use |
|---|---|
| Cormorant Garamond — 300/400, regular + italic | Headings, scripture, heartcry body, threshold preamble |
| DM Sans — 400/500/600 | UI text, button labels, body sans |
| JetBrains Mono — 400/500 | Eyebrows, meta lines, location tags, encryption indicators |

### Spacing rhythm

- Screen horizontal padding: **22px** (left/right)
- Card padding: **18–22px**
- Section vertical gap: **22–28px**
- Card vertical gap (within a list): **12px**
- Border-radius: **6–10px** (cards), **100px** (pills)
- Hairlines: **0.5px**, often `var(--faint)` or `var(--sky-mid)`

## Component breakdown

### `<TabHeader />`
- Eyebrow: `mono caps · 9px · 0.24em · muted-2` → "TAB 3 · SET APART"
- Title: `serif · 26px · 400 · red` → "The Persecuted Church"
- Subtitle: `mono caps · 9.5px · muted` → "ENCRYPTED · ANONYMOUS · WITHIN THE NETWORK"
- A 1px red hairline gradient runs under the title (signals "you have crossed a threshold")
- A 1px red vertical hairline runs down the left edge of the entire tab (the `:before` on `.persecuted`)

### `<ThresholdNote />`
- Pad: `18px 22px 22px`, bottom hairline divider
- Red eyebrow "A HELD SPACE"
- Serif italic body: defines who this space is for (imprisonment, prohibition of fellowship, violence)
- Mono meta line: "ENCRYPTED · NO LOCATION STORED · REGION ONLY"

### `<ActionCard />` (the default state)
- Centered serif-italic prompt: *"Are you currently under persecution for the name of Jesus?"*
- Centered sub-line in two parts:
  - *"Your account is verified and your identity is held."*
  - *"This is a held space for your voice."*
- Single full-width **red-ghost button**: "Share my heartcry" (border + text in `--red`, transparent fill)

### `<ShareForm />` (when user taps Share)
- Red mono eyebrow "YOUR HEARTCRY"
- Textarea — serif italic, 16px, placeholder *"Say what is on your heart. The body is listening."*
- Two privacy chips: "Show region only" / "Show interceder count" (mono caps, sky when on)
- Actions: ghost "Cancel" + primary red "Send into the body"

### `<SharedThanks />` (after submit)
- Card with gradient surface + red border
- Red eyebrow "HELD"
- Serif italic title: *"Your heartcry is with the body."*
- Body + encryption meta line

### `<HeartcryCard />`
Same primitive as the Church tab's intercession card, **with a red left-accent** instead of sky.
- 2px red left border
- Red mono eyebrow: `• A voice · NORTH AFRICA   12m`
- Serif italic body — the heartcry quote
- Mono meta row: `+ Hold in prayer` (sky, clickable) ↔ `1.3k praying` (muted)
- When held: checkmark + "Keep holding" + slight sky-gradient background

### `<RegionBar />`
- Horizontally scrolling mono caps chips: All · Middle East 14 · Central Asia 9 · …
- Count next to each in red
- Active chip: off-white text on slightly raised surface
- Filters the heartcry list by broad region (no countries)

### `<HeartcryEmpty />`
- Dashed red circle glyph
- Serif italic title: *"Quiet here, for now."*
- Body: *"This space is held in prayer until someone speaks. If you are persecuted tonight, you can share here."*

### `<ScriptureFooter />`
- Sky eyebrow "PRAY WITH US"
- Serif italic verse (Hebrews 13:3)
- Mono ref "HEBREWS 13:3"

### `<TabBar />`
5 tabs: Home · The Church · **Persecuted (red active)** · Prayer · Connect
- 20px line-icon, mono 9px label
- Active = red color for Persecuted, sky for others

## State model

```ts
type View = 'default' | 'composing' | 'submitted' | 'empty';

type Heartcry = {
  id: string;
  region: 'Middle East' | 'Central Asia' | 'North Africa' | 'East Asia'
        | 'South Asia' | 'Southeast Asia' | (other broad regions only);
  time: string;          // '12m' | '38m' | '2h' | '4h' | …
  text: string;          // serif italic body
  interceding: number;   // count
  held: boolean;         // viewer's local hold state
};
```

## Interaction contracts

### Sharing a heartcry
```
ActionCard "Share my heartcry" tapped
  → ShareForm appears (composing)
  → User types text (autofocus on textarea)
  → Optional privacy toggles: include region / show count
  → "Send into the body" submits
    → backend stores: { region, text, leader_id (server-hashed for anti-abuse), timestamp }
    → backend NEVER stores: { country, city, IP, device }
  → SharedThanks appears
  → After ~30s or on next session, defaults back to ActionCard
```

### Holding a heartcry in prayer
```
HeartcryCard "+ Hold in prayer" tapped
  → optimistic: held=true, interceding++
  → POST /heartcries/:id/intercede
  → label becomes "✓ Keep holding"
  → tap again to release
```

### Region filter
```
RegionBar chip tapped
  → filter heartcries client-side by region match (or 'all')
  → counts on chips are server-provided + live-updated
```

## Privacy / encryption contracts (CRITICAL)

- Heartcries are end-to-end encrypted in transit.
- Backend stores: region, text, encrypted-or-hashed author handle, timestamp, interceder count.
- Backend MUST NOT store: country, city, IP address, device fingerprint, exact lat/lon.
- The mono meta line on `ThresholdNote` is a USER-FACING PROMISE. If any of these change,
  the meta copy must change with it.
- Heartcries are visible only to verified leaders. Underground churches see this tab too.

## React Native conversion notes

1. **CSS → StyleSheet**. Translate `shared.css` and `styles.css` into a tokens module
   plus per-component StyleSheet objects. The token values are designed to map directly.
2. **Fonts**: load Cormorant Garamond, DM Sans, JetBrains Mono via `expo-font` or
   `react-native-fonts`. Make sure italic variants of Cormorant are bundled.
3. **SVGs**: every SVG in `app.jsx` is hand-rolled; reuse with `react-native-svg`.
4. **Gradients**: the threshold's red hairline gradient, the .held card's subtle background,
   and the SharedThanks card all use linear-gradient. Use `expo-linear-gradient`.
5. **Scroll behavior**: the region bar is a horizontal scroll. Use `ScrollView horizontal` + snap.
   The main page is a vertical `ScrollView` (no FlatList needed; the heartcry list is short and
   loaded all at once for now).
6. **Animations**: only the held-state gradient transition is animated. Use `Animated.View` or
   Reanimated for a soft fade.
7. **Safe area**: title sits below the status bar; use `SafeAreaView` or `useSafeAreaInsets()`.
8. **Tab bar**: built into the prototype here, but in production the app will use
   React Navigation's bottom tab. Match the visual; the icons map directly.

## Tweaks panel

The web prototype includes a Tweaks panel (bottom-right). **Skip this entirely in React Native.**
It exists purely so the reviewer can toggle between states (`populated` ↔ `empty`).

## Open questions

1. Should anonymous *leaders* be allowed to share heartcries? Currently the prompt says
   "Your account is verified" — but underground leaders also have verified status.
   Confirm the abuse model.
2. Region taxonomy — current list is 6 broad regions. Final list TBD with Ife.
3. Is there a daily/hourly cap on heartcries per leader? (Abuse-prevention question.)
4. After holding a heartcry, should the viewer get notifications when interceder count crosses
   thresholds (e.g. "1000 leaders are praying with you")?
