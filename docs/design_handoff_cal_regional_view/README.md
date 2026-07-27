# Handoff: Church at Large — Regional View

## Overview

This package covers **one feature** on the Replant mobile app's **"The Church at Large" (CAL)** screen — the rotating-globe view of the global church network. Everything else on that screen is already built and shipping: the globe (rotation / pause / resume / pinch-magnify), the RAG-coloured church dots, the church **profile sheet**, the **global prayer pull-up**, the first-time tutorial, and all loading/error/unverified states.

The **regional view** is the last unbuilt piece. It lets a leader:

1. See, at all times, the name of the macro-region currently **facing** them on the globe (a pill, top-right).
2. **Tap** that pill — or tap the globe body — to open a right-hand slide-over listing the churches in that region.
3. Tap a church row to open the **existing** profile sheet.

A separate, already-shipped concern: **pinch/zoom** on the globe is *only* a "look closer" magnifier (1.0–2.4× with a `NNN%` readout). It must **not** open a region. An earlier prototype tied region entry to zoom; that was dropped in favour of tap. Don't reintroduce it.

## About the Design Files

The files in `source/` are **design references created in HTML/React + Babel** — a browser prototype showing the intended look and behaviour. They are **not production code to copy directly.**

The task is to **recreate this behaviour in the Replant React Native app** using its established patterns and libraries. The CAL globe in production is rendered with **Mapbox's globe projection via `@rnmapbox/maps`** (the HTML prototype fakes the globe with an SVG orthographic projection). Lift the *logic and visual spec*, not the SVG.

A polished, illustrated version of this same spec — with flow diagrams, the expected region buckets, and per-element measurement tables — is included as **`Regional View - RN Spec.html`** (open in any browser). This README is self-sufficient, but that doc is the nicer read.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, motion, and interaction are all specified below and in the prototype. Recreate the UI pixel-faithfully using the app's existing component library and the shared CAL design tokens (listed under **Design Tokens**) — these tokens already exist in the app; do not invent new ones.

---

## The one screen / view: Regional Slide-Over

**Name:** Regional view (regional slide-over panel) on *The Church at Large*.

**Purpose:** Let a leader browse the churches of whichever world region they're looking at, then drill into one.

**Entry points:**
- The **region pill** (top-right of the globe) — pressable.
- A **tap on the globe body** (a press with no drag, not landing on a dot) opens the centered region.
- A **tap on a dot** opens that church's profile sheet directly (NOT the region) — existing behaviour, unchanged.

### Layout

- **Panel:** anchored to the **right** edge, **80%** of screen width, **full** screen height. Slides in from off-screen-right.
- Internally a vertical flex: **header** (fixed) above a **scrolling body**.

### Components

**1. Region pill** (overlay, not part of the panel)
- Position: absolute, `top: 16, right: 16`. Elevation above the globe.
- Shape: capsule, `border-radius: 100`, padding `7 / 11`, `0.5px` border in `--faint`, background `rgba(8,8,8,0.7)` with a 14px backdrop blur.
- A small `9×9` ring glyph (1px stroke, `currentColor`) + label.
- Label: the faced region's name (e.g. `East Asia`); before the first region resolves, reads `Regions`.
- Type: `--mono`, `8.5px`, uppercase, letter-spacing `0.16em`, colour `--muted`.

**2. Panel container**
- Width `80%`, height `100%`, background `--bg` (`#080808`), left border `0.5px --faint`.
- Shadow: `-20px 0 60px rgba(0,0,0,0.6)`.
- Enter/exit: `translateX(100% → 0)`, **450ms** `cubic-bezier(.22,.61,.36,1)`.
- Stacking: above the globe + overlay chips, **below** the profile sheet.

**3. Panel header**
- Padding `18 / 18 / 14`; bottom border `0.5px --faint`.
- Eyebrow: text `Region` — `--mono`, `9px`, uppercase, letter-spacing `0.22em`, colour `--sky`, margin-bottom `6`.
- Region name (h3): `--serif`, `24px`, weight `300`, letter-spacing `0.02em`.
- RAG summary row: flex, gap `10`, margin-top `12`, font `11px` `--muted`. One "chunk" per non-zero RAG band, each a `7px` colour dot + count + label:
  - green dot → `N freely operating`
  - amber dot → `N with limitations`
  - red dot → `N not freely`
- Close (✕): `28×28`, absolute `top: 18, right: 18`, colour `--muted`.

**4. Church row** (reuses the shared `.list-row` style)
- Row: flex, align-items flex-start, gap `12`, padding `14 / 8`, bottom border `0.5px --faint`, pressable.
- RAG marker: `8px` dot, margin-top `6`, glow `0 0 6px <ragColor>`. Colours: g `--green`, a `--amber`, r `--red`.
- Name: `--serif`, `17px`, weight `400`, line-height `1.2`.
- Leader line: `11.5px` `--muted`, margin-top `3`. Format = each leader as `"{Role} {Surname}"`, or just `"{Role}"` if `anon`, joined with `" · "`; then `" · {city}"` appended in `--muted-2`.
- RPL ID: `--mono`, `9px`, letter-spacing `0.18em`, `--muted`, margin-top `5`.
- Tap → open the existing profile sheet for that church.

**5. Underground footer** (conditional — see Underground rule)
- Rendered as the **last item in the body**, only when `region.underground === true`. Never a church row.
- Container: flex, gap `8`, margin-top `10`, padding `12 / 14`, **dashed** `0.5px --faint` border, radius `10`.
- `7px` `--red` dot at `0.7` opacity + label `+ gatherings we cannot name` in `--mono`, `10px`, letter-spacing `0.06em`, `--muted`.

---

## Interactions & Behavior

```
on press(pill)        → open the faced region
on tap(globe body)    → open the faced region        // press, no drag, not a dot
on tap(dot)           → open church profile sheet     // region NOT opened
on drag(globe)        → rotate longitude; not a tap → nothing opens

on press(row)         → open church profile sheet
on press(close ✕)     → close panel
on Android back       → close panel first (then normal nav)

faced region changes  → update pill label only, debounced on REGION KEY change
                        (never every animation frame)

pinch / wheel zoom    → scale globe 1.0–2.4×, show "NNN%" + Reset
                        NEVER opens a region
```

**Motion:** panel slides in/out over **450ms** with `cubic-bezier(.22,.61,.36,1)`. The globe's existing rotate / pause-on-touch / 3.5s-then-resume motion is unchanged.

**Pin vs. follow (OPEN — confirm):** while the panel is open and the globe keeps rotating, the prototype **keeps the opened region pinned** (it does not swap to whatever rotates into center). Confirm this is desired.

## State Management

```js
facedRegion   // the region currently centered on the globe — drives the pill label
openRegion    // the region shown in the panel (null = closed)
panelOpen = !!openRegion

pickRegion(region) => setOpenRegion(region ?? facedRegion)

// globe callbacks
onFaceRegion = setFacedRegion      // pill label, fires only on region-key change
onPickRegion = pickRegion          // pill press / globe-body tap
onPickChurch = openProfileSheet    // dot tap / row tap → existing sheet
```

## Data Model

No per-church region field. Eight macro-region **centers** are defined; each church is assigned to the **nearest** center by great-circle distance. Buckets stay self-consistent as churches are added, and the same centers decide which region is "faced."

```js
const REGION_DEFS = [
  { key: 'na', name: 'North America', lat:  40, lon: -100 },
  { key: 'la', name: 'Latin America', lat: -15, lon:  -60 },
  { key: 'eu', name: 'Europe',        lat:  50, lon:   15 },
  { key: 'af', name: 'Africa',        lat:   5, lon:   20 },
  { key: 'me', name: 'Middle East',   lat:  32, lon:   50 },
  { key: 'sa', name: 'South Asia',    lat:  22, lon:   78 },
  { key: 'ea', name: 'East Asia',     lat:  32, lon:  115 },
  { key: 'oc', name: 'Asia–Pacific',  lat: -10, lon:  130 },
];

function greatCircle(aLat, aLon, bLat, bLon) {      // radians (haversine)
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat/2)**2
    + Math.cos(aLat*r) * Math.cos(bLat*r) * Math.sin(dLon/2)**2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function regionKeyForChurch(c) {                    // nearest center
  let best = null, bestD = Infinity;
  for (const r of REGION_DEFS) {
    const d = greatCircle(c.lat, c.lon, r.lat, r.lon);
    if (d < bestD) { bestD = d; best = r.key; }
  }
  return best;
}

const REGIONS = REGION_DEFS
  .map(r => ({
    ...r,
    churches: GLOBAL_CHURCHES.filter(c => regionKeyForChurch(c) === r.key),
    underground: UNDERGROUND_REGIONS.includes(r.name),
  }))
  .filter(r => r.churches.length > 0);
```

**Faced-region detection (production):** the SVG orthographic `z` trick in the prototype has no Mapbox equivalent. Instead, read the **camera center coordinate** on map idle and pick the nearest region center with the same `greatCircle()`. Debounce so the pill doesn't thrash mid-gesture:

```js
const { center } = await mapRef.current.getCenter();   // [lon, lat]
let best = null, bestD = Infinity;
for (const r of REGIONS) {
  const d = greatCircle(center[1], center[0], r.lat, r.lon);
  if (d < bestD) { bestD = d; best = r; }
}
if (best.key !== facedKeyRef.current) {
  facedKeyRef.current = best.key;
  setFacedRegion(best);
}
```

### Expected buckets (acceptance fixture)

All 40 churches in the mock `GLOBAL_CHURCHES` map into exactly one region — **no orphans**. The same lat/lon set must reproduce these groupings and RAG counts:

| Region | Total | g / a / r | Cities |
|---|---|---|---|
| North America | 6 | 5 / 0 / 1 | Loganville, Washington, Mexico City, Toronto, Vancouver · **Port-au-Prince** (r) |
| Latin America | 3 | 2 / 1 / 0 | Quito, Buenos Aires · Rio de Janeiro (a) |
| Europe | 7 | 4 / 1 / 2 | Rome, Madrid, Berlin, London · Istanbul (a) · Kyiv, Moscow (r) |
| Africa | 7 | 4 / 1 / 2 | Lagos, Nairobi, Cape Town, Addis Ababa · Kinshasa (a) · Khartoum, Mogadishu (r) |
| **Middle East** ⚑ | 3 | 0 / 1 / 2 | Cairo (a) · Damascus, Tehran (r) |
| **South Asia** ⚑ | 6 | 0 / 3 / 3 | Mumbai, Delhi, Dhaka (a) · Yangon, Karachi, Kabul (r) |
| **East Asia** ⚑ | 5 | 3 / 2 / 0 | Manila, Seoul, Tokyo · Hong Kong, Bangkok (a) |
| Asia–Pacific | 3 | 2 / 1 / 0 | Sydney, Singapore · Jakarta (a) |

⚑ = `underground === true` → shows the dashed footer.

## Underground rule

Underground churches are **never pictured anywhere** — not on the globe, not in any list, **not as a row in the regional panel**. A region only *acknowledges* them via the dashed footer.

- A region's `underground` flag is true when its name is in `UNDERGROUND_REGIONS` (currently *North Africa, Central Asia, East Asia, Middle East, South Asia*). Of the live buckets that lights up **Middle East, South Asia, East Asia**.
- The footer is **qualitative only — no number**. The aggregate `+18 hidden` count stays in the CAL header chip exactly as today. Do not break the 18 down per region.

## Design Tokens

These already exist in the Replant app — reuse them, don't redefine.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#080808` | panel background |
| `--surface` | `#111111` | cards |
| `--text` | `#F0EDE6` | primary text |
| `--muted` | `rgba(240,237,230,0.45)` | secondary text / pill |
| `--muted-2` | `rgba(240,237,230,0.30)` | city suffix |
| `--faint` | `rgba(240,237,230,0.08)` | hairlines / borders |
| `--sky` | `#6BB5E8` | eyebrow / accents |
| `--green` | `#5BAD7A` | RAG "freely operating" |
| `--amber` | `#D4A855` | RAG "with limitations" |
| `--red` | `#E05555` | RAG "not freely" / underground dot |
| Serif | Cormorant Garamond | region name, church name |
| Sans | DM Sans | body, leader line |
| Mono | DM Mono | eyebrow, RPL, pill, footer |

Spacing seen here: `6 / 8 / 10 / 12 / 14 / 18` px. Radii: `10` (footer), `100` (pill/capsule). Glow shadow on RAG markers: `0 0 6px <color>`.

## Assets

None. No images or icons beyond inline SVG glyphs (the pill ring and the close ✕), which can be drawn with the app's existing icon primitives.

## Files

In this bundle:

```
README.md                       # this file — self-sufficient
Regional View - RN Spec.html    # illustrated spec (open in a browser)
source/
├── globe.jsx                   # CalGlobe: faced-region useMemo, tap handler,
│                               #   RegionalPanel component, underground footer
├── data.jsx                    # REGION_DEFS, greatCircle, regionKeyForChurch,
│                               #   REGIONS, GLOBAL_CHURCHES, COUNTS.underground_regions
├── styles.css                  # .regional-panel / .regional-head / .list-row /
│                               #   .regional-hidden / .globe-zoom-pill
└── app.jsx                     # orchestration: facedRegion state, pickGlobalRegion,
                                #   pill rendering, RegionalPanel wiring
```

Live prototype entry point (in the project root, for running the reference): **`Replant - The Church Tab.html`** — swipe to the second page, "The Church at Large," to see the globe + regional view.

Key source landmarks:
- `source/data.jsx` → `REGION_DEFS`, `greatCircle`, `regionKeyForChurch`, `REGIONS`.
- `source/globe.jsx` → `CalGlobe` (the `faced` useMemo + `facedKeyRef` effect, `onPointerUp` tap-to-open) and `RegionalPanel` (header, rows, underground footer).
- `source/app.jsx` → `facedRegion` state, `pickGlobalRegion`, the region pill markup, and the `<RegionalPanel … />` wiring.
- `source/styles.css` → search `regional` and `list-row` and `globe-zoom-pill`.

## Open questions for engineering

1. **Region source** — compute `region_key` client-side from lat/lon (prototype's approach) or have the API return it + a `/regions` rollup with counts? Client-side is fine at this scale.
2. **Pin vs. follow** — keep the opened region pinned while the globe rotates (current behaviour) or follow center?
3. **Panel width on tablet** — 80% reads well on phone; cap at ~420px on larger widths?
4. **"Asia–Pacific" label** — it absorbs Oceania + maritime SE Asia (Sydney, Jakarta, Singapore). Keep or split?
5. **Empty region** — regions with zero verified churches are filtered out, so they never become "faced." Confirm we never want to surface an empty region's underground footer alone.
