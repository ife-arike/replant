# Replant — Home Tab · React Native build spec

A drop-in spec + scaffold for rebuilding the Home tab as designed. Built entirely
on the locked tokens (`src/constants/theme.ts`) — **no new colors, no new fonts,
no social metrics.** Mirror of the interactive reference:
`Replant - Home Tab (Live Prototype).html` (iPhone 16 Pro Max).

---

## ★ Preferred configuration (Founder's pick)

| Decision | Use | Set in |
|---|---|---|
| **Scripture treatment** | `open` | `HomeScreen.tsx → SCRIPTURE_VARIANT` |
| **Announcement card** | `letterhead` | `HomeScreen.tsx → CARD_VARIANT` |
| **Title size** | `21` | `HomeScreen.tsx → TITLE_SIZE` |
| Wordmark | `Replant`, 26pt, title-case | `TopBar.tsx` (locked) |
| Mark | Rp mark on **Home only** | `TopBar.tsx` (locked) |
| Section labels | **ALL-CAPS** (only place caps remain) | `SectionLabel.tsx` (locked) |
| Page-turn truncation | **on** (locked — "read on / fold") | `AnnouncementCard.tsx` |
| Warm card surface | **off** by default | `AnnouncementCard.tsx → warm` |

Everything is wired so the three preferred constants live at the top of
`HomeScreen.tsx`. Change them in one place to evaluate the alternates below.

### Alternates (in case it doesn't sit right in practice)

- **Scripture `rule`** — a 2px sky rule in the margin instead of the faint quote.
  `<ScriptureStrip variant="rule" … />`
- **Card `rule`** — coloured left margin-rule instead of the letterhead eyebrow.
  `<AnnouncementCard variant="rule" … />`  *(seal/watermark direction was cut.)*
- **Title `20` or `22`** — `titleSize={20 | 22}` (line-heights 25 / 27).
- **Warm card surface** — `warm` on `AnnouncementCard` shifts `#111113 → #131110`.
  The leader "word" card is warm **by design** and is unaffected by this flag.
- Discarded (do not build): candle scripture, "just now" live pulse, hero card,
  seal/watermark card, solidarity "standing with" layer, the centred/seal scripture
  treatments.

---

## Screen anatomy

```
SafeAreaView (Colors.background #080808)
├─ TopBar                      Rp mark + "Replant" 26 · hamburger right
└─ ScrollView (px 20)
   ├─ SectionLabel  "TODAY"
   ├─ ScriptureStrip (open)    Cormorant 300 italic · 23/33
   ├─ SectionLabel  "NETWORK UPDATES"
   └─ feed (gap 14)
      ├─ AnnouncementCard  letterhead · tag=update
      ├─ LeaderWordCard    "A word for today"
      ├─ AnnouncementCard  letterhead · tag=notice
      ├─ LinkCard          external resource
      └─ AnnouncementCard  letterhead · tag=urgent
```

The 5-tab bar is owned by navigation and is **not** redefined here.

---

## Files

```
theme.ts                     tokens (Colors / Typography / Spacing / Radius / Tags)
HomeScreen.tsx               screen + sample data + the 3 preferred constants
components/
  icons.tsx                  react-native-svg icons + Rp mark re-export
  TopBar.tsx
  SectionLabel.tsx
  ScriptureStrip.tsx         open | rule
  AnnouncementCard.tsx       letterhead | rule · page-turn · footer comments
  LeaderWordCard.tsx         leader devotional · comments in author row
  LinkCard.tsx               framed resource link
  CommentThread.tsx          in-place thread + compose + Hide
assets/
  rp-mark.svg                the brand mark (exact asset)
```

---

## Setup

1. **Fonts** — already in the app: Cormorant Garamond (300/300i/400/500/600),
   DM Sans (300/400/500), DM Mono (400). `Typography.*` holds the RN family names.
2. **SVG** — `npm i react-native-svg` and `react-native-svg-transformer`, then in
   `metro.config.js` route `.svg` through the transformer so
   `import RpMark from '../assets/rp-mark.svg'` yields a component.
3. Drop `theme.ts` values against your existing `src/constants/theme.ts` — they
   should match 1:1 (the extra `cardSurface` / `cardWarm` / `linkWell` keys are the
   only additions, all derived from existing tokens).

---

## Interactions

- **Page-turn truncation** — card body is `numberOfLines={3}` collapsed; tapping the
  card expands to full text. `LayoutAnimation.easeInEaseOut` on toggle. The trailing
  cue reads **read on** ⇄ **fold**. (No chevron, no button.)
- **Comments** — the count sits in the footer, right-aligned (announcement/link) or in
  the author row (leader word). Tap to open the thread in place; the chevron rotates.
  **Two ways to close:** tap the indicator again, or the **Hide** control in the thread
  header. Tapping inside the thread must not toggle the card body (separate `Pressable`).
- **Held identity** — under-threat leaders comment with a lock avatar,
  "A leader in the network", region withheld. Never surface a name or location.

---

## New DB fields — flag for DBA before build

`announcements` today: `id, title, body, published_at, is_active, source_label, tag_type`.

| Field / table | Used by | Notes |
|---|---|---|
| `announcements.link_url` (text, nullable) | LinkCard | external resource URL |
| `announcements.author_type` (enum `admin`\|`leader`) | LeaderWordCard | leader posts; name/church via join on existing `author_id` (D-56) |
| `announcements.comment_count` (int / computed) | all cards | denormalised count for the footer |
| **`comments`** (new table) | CommentThread | `id, announcement_id, author_id, body, created_at, is_masked, masked_region_label` |

No new fields are needed for page-turn, scripture treatment, title size, or warm
surface — those are client-only.

---

## Voice / guardrails

Quiet, weighty, unhurried — a letter from the family, not a dashboard. No likes,
no follower counts, no algorithmic signals. Scripture governs the tone; where two
options are equal, the more pastoral one wins.
