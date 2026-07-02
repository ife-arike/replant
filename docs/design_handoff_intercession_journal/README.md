# The Intercession Journal — Design Handoff

Hi-fi prototype for the **Intercession Journal**, a nested surface inside the **Prayer Wall tab** in the Replant React Native app. Open `Replant - Intercession Journal.html` in any modern browser to preview at iPhone 16 Pro Max.

## What's in this package

```
Replant - Intercession Journal.html      ← open this first
intercession-journal/
├── app.jsx                              ← React component tree + state
├── styles.css                           ← visual tokens + component CSS
└── tweaks-panel.jsx                     ← state switcher (web-prototype only; not for RN)
shared/
└── shared.css                           ← global tokens (sky/cream/serif/mono)
```

## Purpose of this surface

A quiet, sanctuary-feeling ledger of who the leader is currently carrying before God. Reached either from the **"Your intercession journal"** row on the Prayer Wall landing, or auto-navigated to after the leader taps **Pray** on a church profile card in The Church tab.

Two segmented lists:

1. **Churches** — up to 10 churches the leader is actively praying for. Each row is a quiet status read: who, where, when added, "● Praying" status.
2. **Standing in Gap** — a chronological record of individual prayer requests the leader has stood in for. Each row carries the request text (serif, truncated), its origin, date prayed, and a running "You + N standing" count.

The visual vocabulary matches the Prayer Wall tab exactly. **Sky-blue only — no red, no amber, no green.**

## Frames included in the prototype

| # | Tab | State | Notes |
|---|---|---|---|
| 1 | Churches | List (8 of 10) | Active default. One row shown in subtly *swiped* state hinting at the remove gesture. |
| 2 | Churches | List full (10 of 10) | Triggered when leader taps Pray on an 11th church. Inline sky-faint notice names the pending church. |
| 3 | Churches | Empty | Dashed-bordered card. Sky-ghost CTA points back to The Church tab. |
| 4 | Standing in Gap | List (7 prayers) | Chronological, newest first. |
| 5 | Standing in Gap | Empty | Same dashed pattern. CTA points back into the Prayer Wall feed. |

The Tweaks panel (bottom-right of the handoff page) lets a reviewer focus a single frame at a time.

## Design tokens

All inherited from `shared/shared.css`. Highlights used on this surface:

| Token | Value | Use on the Journal |
|---|---|---|
| `--sky` | `#6BB5E8` | Praying status dot, segmented thumb border, CTA accents, sub-counter "Full" badge |
| `--sky-mid` / `--sky-dim` / `--sky-faint` | sky @ 0.35 / 0.12 / 0.06 | Pill thumb, hover backgrounds, full-list notice background |
| `--off-white` / `--cream` | `#F0EDE6` / `#E6E1D5` | Church names (off-white), prayer text (cream) |
| `--muted` / `--muted-2` / `--faint` | cream-alpha | Meta lines, separators, hairlines between rows |
| `--serif` | Cormorant Garamond | Church names (400), prayer text (300 italic), empty-state titles |
| `--mono` | JetBrains Mono | Eyebrows, locations, dates, status, segment counts, RPL codes |
| `--sans` | DM Sans | Empty-state body copy, the few UI labels |

## Component breakdown

### `<IJHead />` — the sub-header
- Sky-blue back row "‹ PRAYER WALL" (mono caps, sky chevron, muted text — hover sky)
- Eyebrow: `TAB 4 · BODY GATHERED`
- Title: serif "Intercession Journal"
- Subtitle: `N HOLDING · 4 RETURNED WITH ANSWER` (Churches) or `N PRAYERS STOOD IN · 5,086 AMEN` (Standing)

### `<IJSeg />` — the segmented pill (`Churches` / `Standing in Gap`)
- Sky-tinted thumb (`background: rgba(107,181,232,0.12)`, `border: 0.5px sky-mid`)
- Active label: sky. Inactive: muted.
- Each label carries a tiny mono count chip (`8/10`, `7`, `0`). Active chip flips to sky.
- Thumb transitions left↔right with `cubic-bezier(.3,.7,.4,1)` over 220ms.

### `<IJCounter />`
- Sub-line under the pill. Mono caps muted.
- Left: contextual label (`Currently holding before God`, `Prayers you have stood in for`).
- Right: status chip (`8 / 10`, `10 / 10 · Full` — sky), or `Chronological`.

### `<ChurchRow />` — Churches list row
Layout:
```
[RPL-glyph]  Grace Chapel Lagos  RPL-00012        ● Praying
             LAGOS, NIGERIA · ADDED TODAY
```
- 34px square initials glyph (serif sky initials over surface).
- Name: serif 17/1.2, off-white, with inline mono RPL code in muted.
- Meta: mono caps muted, truncates with ellipsis if location + date overflow.
- Status: sky "● Praying" with a slowly-pulsing dot. Right-aligned at the top of the row.
- Long press or swipe-left reveals a remove affordance (one row in the prototype is shown subtly translated to hint at the gesture).
- Hairline divider between rows; the last row has no divider.

### `<StandingRow />` — Standing in Gap row
Layout:
```
●  "A baptism on Sunday — fourteen souls. Pray they are kept under the wings."
   GRACE CHAPEL LAGOS · LAGOS, NIGERIA · TODAY             YOU + 247 STANDING
```
- Sky dot + serif italic 15/1.4 cream (truncates to one line with ellipsis).
- Meta line: church + location + date in mono caps muted, with sky-muted separators. Truncates from the right.
- "You + N standing" sky, mono caps, right-aligned, never wraps.

### Full-list inline prompt (`<IJFullNotice />`)
Shown only when the leader tries to add an 11th church.
- Dashed sky-mid border, sky-faint background.
- Sky `!` glyph in a small sky-bordered circle.
- Serif italic title: *"Your intercession list is full."*
- Sub: `Remove a church to add another. <pending church name> is waiting to be added.`
- No buttons — the prompt is informational; the actual remove gesture happens on the rows below.

### Empty states (`<IJEmpty />`)
Both tabs share the same primitive — dashed border, dim glyph, serif italic title, short sans body, sky-ghost pill CTA.
- Churches glyph: dashed sky circle around a steeple line drawing.
- Standing glyph: dashed sky circle around two raised-hand strokes.
- CTAs: `Find a church to pray for ›`  and  `Enter the prayer wall ›` respectively.

### `<IJFoot />` — contextual scripture footer
- Eyebrow `CARRIED BEFORE THE THRONE`
- Verse: Galatians 6:2 ("Bear ye one another's burdens, and so fulfil the law of Christ.") — serif italic, 15/1.55, cream.
- Hidden in empty states (the page is sparse enough).

## State model

```ts
type Tab = 'churches' | 'standing';
type View = 'list' | 'full' | 'empty';

type ChurchHold = {
  id: string;
  name: string;          // serif display name
  rpl: string;           // e.g. 'RPL-00012'
  loc: string;           // e.g. 'Lagos, Nigeria'
  added: string;         // 'Today' | '2d ago' | '6w ago'
  leader: string;        // pastor name (not currently rendered in the row; reserved for detail sheet)
};

type StandingEntry = {
  id: string;
  text: string;          // full prayer body (truncated to one line in the row)
  church: string;
  loc: string;
  when: string;          // 'Today' | '2d ago' | '1w ago'
  others: number;        // running "+ N standing" count
  mine: true;            // marker that this entry belongs to the current leader
};
```

## Interaction contracts

### Entry points
```
Prayer Wall landing → "Your intercession journal" link row
  → /intercession-journal?tab=churches

The Church tab → church profile sheet → "Pray" tapped
  → if leader has < 10 holds → optimistic insert + navigate to /intercession-journal?tab=churches
  → if leader has = 10 holds → navigate to /intercession-journal?tab=churches&pending=<rpl>
                              (shows the full-list inline notice naming <pending>)
```

### Tab switch
```
Segmented pill tap → setActiveTab(tab); thumb animates left↔right (cubic-bezier .3,.7,.4,1, 220ms)
```

### Remove a church from the list
```
Long-press OR swipe-left on .ij-church
  → reveal remove affordance (72px slot, mono "REMOVE" + trash glyph)
  → tap remove → confirmation toast (undo for 4s)
  → on confirm: optimistic delete, DELETE /intercession-holds/:id
```

### Tap a church row
```
Tap .ij-church → push detail sheet (church profile, same primitive as Church tab)
```

### Tap a Standing in Gap row
```
Tap .ij-gap → push the prayer-request detail sheet (the same one Make Intercession opens)
```

### Empty-state CTAs
```
Churches empty CTA → switch to The Church tab (tabBar.setActive('the-church'))
Standing empty CTA → enter the prayer wall feed (push /prayer-wall/feed)
```

## React Native conversion notes

1. **Segmented pill**: `Animated.View` for the thumb, drive `left` with `withTiming(idx * (W - 6) / 2, { duration: 220, easing: Easing.bezier(.3,.7,.4,1) })`. Each label is a `Pressable` with haptic feedback (`Haptics.selectionAsync`).
2. **Status pulse dot**: same `livePulse` keyframe as the Prayer Wall tab — translate to Reanimated `withRepeat(withTiming(...))`.
3. **Swipe-to-remove on `<ChurchRow />`**: use `react-native-gesture-handler` `Swipeable` with `renderRightActions`. Cap the threshold around 72px so a small swipe reveals the action without committing.
4. **Long-press fallback**: `onLongPress` on the row also opens the remove affordance, for accessibility parity.
5. **Truncation**: row body `numberOfLines={1}` + `ellipsizeMode="tail"`. The web prototype uses CSS `text-overflow: ellipsis` on the meta lines — equivalent on RN with `numberOfLines={1}`.
6. **Lists**: both tabs are `FlatList` so the journal scrolls smoothly past the header. Headers (`<IJHead />` and `<IJSeg />`) can sit in a sticky `ListHeaderComponent` for the segmented pill to remain reachable while scrolling.
7. **Full-list inline notice**: rendered as the first item in the FlatList when `pending` is set, so it scrolls with the list rather than blocking the gesture surface.
8. **Empty states**: when the FlatList data array is empty, render `<IJEmpty />` via `ListEmptyComponent`.
9. **Safe area / tab bar**: page sits below the status bar via `useSafeAreaInsets()`; tab bar height already accounted for in the parent navigator.
10. **Fonts**: load Cormorant Garamond (300/400, regular + italic), DM Sans (400/500/600), JetBrains Mono (400/500) via `expo-font`. Same set already loaded for the Prayer Wall tab.

## Tweaks panel

Web prototype only — do not ship in RN. Drives a `frameOverride` value that lets the reviewer focus a single phone frame on the handoff page.

## Open questions

1. **List cap at 10** — confirm this is a hard cap. If it's soft (warn at 10, allow more), the inline notice copy needs to soften and the segmented pill count should not say `10/10 · Full`.
2. **"Standing in Gap" pagination** — chronological is fine while small, but past say ~50 entries we may want grouping by month, or a load-more cursor. Out of scope here; flagging for the cycle.
3. **Returned with answer** — the header subtitle says `4 returned with answer` for Churches, but this surface doesn't currently expose a way to see those four. Should we add a tertiary segment ("Returned"), or surface them via a chip on the relevant church row?
4. **Removing a church from Churches** — does that also remove related entries from Standing in Gap, or are those decoupled (you can stop holding a church but the prayer-by-prayer record stands)? My assumption is the latter.
5. **Auto-navigation on Pray** — confirm: should we always auto-navigate, or only the first time per session (with a passive toast on subsequent taps)? Auto-navigating every time may interrupt the leader's flow while browsing churches.
