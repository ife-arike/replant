# Handoff — Persecuted Tab, Multi-Page Expansion

> **Open the session with prayer.** This screen carries the cries of the persecuted body. Every value here was chosen with sobriety. Begin Claude Code by praying naming the work, end with *"In Jesus' name, Amen."*

---

## Overview

This handoff expands the Replant **Persecuted tab** (tab 3 of 5) from a single scrollable screen into a multi-page experience. The current `PersecutedScreen.tsx` becomes the **front page (Feed)**; four additional surfaces sit behind a pill-tab navigator below the NavBar:

| Pill | Surface | Status |
|---|---|---|
| **Feed** | Existing front page — threshold, action card, paginated heartcry feed | Refine in place |
| **My Heartcries** | Own submissions with severity + status track (Received → Seen → Responded) | New |
| **Bear Witness** | Living stats, editorial stories ("Around the world"), Witness of the day | New |
| **Take Heart** | Word for today, scripture-led practical guidance, body-with-you | New |
| **Together** | Aggregate prayer stats, regional intensity, prayer streak | **POST-MVP** — designed, deferred |

Plus four pushed screens reachable from those surfaces:

- **Article reader** (push from Bear Witness story tap)
- **Guidance reader** (push from Take Heart card tap)
- **All stories archive** (push from "All stories" link on Bear Witness)
- **Witness archive** (push from "Archive" link / "Witness archive →" on Witness of the Day card)

---

## About the design files

The files in this bundle are **design references created in HTML/JSX** to show intended look, interaction, and copy. **They are not production code.** The task is to rebuild them in the existing **React Native / Expo** codebase at `~/replant`, using `src/constants/theme.ts` tokens, the existing navigation stack, and the patterns already shipping in `ConnectScreen.tsx` (pill tabs) and `TheChurchScreen.tsx` (only relevant if you decide to also build the swipe variant).

The HTML mockup ships an **in-page RN Spec panel** below the phone frame that updates as you change the surface — read it for per-component values when implementing. It is the source of truth for `fontFamily`, `fontSize`, `letterSpacing`, `color`, `padding`, hit-slop, and accessibility roles.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, and interactions. Recreate pixel-faithful using the existing theme tokens. Do not invent new colors. Do not invent new fonts. The CSS variable names in the mockup map 1:1 to RN theme tokens:

| CSS variable | RN token |
|---|---|
| `--serif` | `Typography.displayRegular` / `displayMedium` / `scriptureItalic` (use the dedicated italic font asset, never `fontStyle: 'italic'` — Android safety) |
| `--sans` | `Typography.body` / `bodyMedium` / `sansLight` |
| `--mono` | `Typography.mono` |
| `--sky` `#6BB5E8` | `Colors.accent` |
| `--red` `#D9594F` (CD token) | `Colors.red` (`#E05555` in theme.ts) — keep RN's `Colors.red`. The 2-point gap is intentional in the design system. |
| `--cream` `#E6E1D5` | local const `CREAM` in `PersecutedScreen.tsx` (already exists) |
| `--off-white` `#F0EDE6` | `Colors.text` |
| `--muted` | `Colors.textMuted` |
| `--muted-2` | `Colors.textSubtle` |
| `--faint` | `Colors.border` |
| `--surface` `#121214` | `Colors.surface` (`#111111`) — close enough; use the theme value |
| `--black` `#080808` | `Colors.background` |
| `--sky-bright`, `--sky-mid`, `--sky-dim` | derive from `Colors.accent` at the alphas shown |
| `--red-mid` `rgba(217,89,79,0.30)` | `'rgba(224,85,85,0.30)'` (derive from `Colors.red`) |

`letterSpacing` in RN is **px, not em** — the existing codebase computes it as `em_value × fontSize` (e.g., `0.18em` at `9px` → `letterSpacing: 1.62`). The spec panel lists final px values.

---

## Hard invariants — never violate

These are repeated throughout the in-page spec for a reason. Surface them in the PR description.

1. **No `expo-blur`** anywhere.
2. **No `expo-linear-gradient`** — use solid `backgroundColor`. Where the mockup shows a gradient (e.g., body-with-you sky tint), use a solid `'rgba(107,181,232,0.04)'`.
3. **No `fontStyle: 'italic'`** — use the dedicated `Typography.scriptureItalic` font asset (Android safety).
4. **Region only, never country, never city.** No location stored.
5. **Red is threshold-only.** Do not bleed red into decorative elements. The Persecuted tab icon is the only tab with a non-sky active color.
6. **No leader identity in feed or stats.** Aggregates only.
7. **Dark theme only.** Base `#080808`.
8. **In-app readers — NEVER open an external URL** from article reader or guidance reader. Both fetch their bodies via RPC and render in-place.
9. **Guidance reader is silent.** No `screen_view` event, no `track('opened_guidance')`. Long-press-to-share disabled on body text via `selectable={false}`.
10. **`SafeAreaView` edges = `['top']`** on every screen on this tab — the tab bar handles bottom.

---

## Navigation pattern (final)

**Pill tabs (Option B)** — TabView under the NavBar. Five routes plus four pushable readers.

```tsx
// PersecutedTab.tsx
const routes = [
  { key: 'feed',         title: 'Feed' },
  { key: 'mine',         title: 'My Heartcries' },
  { key: 'memorial',     title: 'Bear Witness' },
  { key: 'encouragement',title: 'Take Heart' },
  { key: 'stand',        title: 'Together' },   // feature-flagged off until 5k+ leaders
];

<SafeAreaView edges={['top']} style={styles.root}>
  <LeftEdgeAccent />
  <NavBar title="The Persecuted Church" subtitle="ENCRYPTED · ANONYMOUS · WITHIN THE NETWORK" />
  <TabView
    navigationState={{ index, routes }}
    renderScene={SceneMap({
      feed:          FeedScene,
      mine:          MyHeartcriesScene,
      memorial:      BearWitnessScene,
      encouragement: TakeHeartScene,
      stand:         TogetherScene,
    })}
    renderTabBar={renderPillBar}
    swipeEnabled
  />
  <TabBar active="persecuted" />
</SafeAreaView>
```

**Pill chip styling** — `Typography.mono`, `fontSize: 9`, `letterSpacing: 1.62`, `paddingVertical: 8`, `paddingHorizontal: 13`, `borderRadius: 100`. Idle: `color: Colors.textMuted`, transparent border. Active: `color: Colors.red`, `borderColor: 'rgba(224,85,85,0.30)'`, `backgroundColor: 'rgba(224,85,85,0.05)'`. **Red, never sky** — Persecuted is the one tab with red as its accent.

**Pushed screens** — `Stack.Screen` with `animation: 'slide_from_right'`. Each owns its own scroll state.

**Back affordance** (final pattern after iteration) — mono eyebrow row **above** the title, in normal flow (not absolutely positioned). `Typography.mono`, `fontSize: 9`, `letterSpacing: 0.18em`, `color: Colors.textMuted`, `marginBottom: 10`. Chevron is a `<Path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.3" />`. Hit-slop `12`.

---

## Surface-by-surface

### Surface 1 — Feed (refine existing PersecutedScreen.tsx)

**Keeps everything that ships:** ThresholdPreamble, PersecutedActionCard, RegionFilterBar, HeartcryCard, ScriptureFooter (Hebrews 13:3), HeartcryEmpty.

**Adds:**

1. **NotifBar** (top, above ThresholdPreamble, only when `hasUnreadStatus === true`)
   - Sky-tinted ribbon, dismissible, tappable → `navigation.navigate('MyHeartcries')`
   - `backgroundColor: 'rgba(107,181,232,0.05)'`, `borderColor: 'rgba(107,181,232,0.22)'`, `borderLeftWidth: 2`, `borderLeftColor: Colors.accent`
   - Eyebrow `YOUR HEARTCRY` (mono 8px, sky), body italic serif 14px cream
   - Close X with `hitSlop: 14`, body Pressable with `hitSlop: 8`
   - `accessibilityRole="button"`, `accessibilityLabel="Your heartcry has a new status"`

2. **HeartcryCard read-on/fold** — matches Home tab `AnnouncementCard.tsx` pattern exactly:
   - `numberOfLines={expanded ? undefined : 4}` (down from full)
   - Affordance: 24×1 hairline + `Typography.mono` 10px lowercase **`read on`** ⇄ **`fold`**, `color: Colors.textSubtle`
   - `LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))` on toggle
   - Threshold: show affordance only when `text.length > 220`

3. **Paginated rounds** — replaces infinite scroll. **This component is reusable on Prayer Wall.** Lift to `src/components/PagedList.tsx`.
   - `ROUND_SIZE = 4` heartcries per page
   - Footer row: three-part flex — `← previous` | `1–4 of 12` | `next →`
   - All three: `Typography.mono`, `fontSize: 10`, `letterSpacing: 0.10em`, sentence case, **NO button border**
   - Active links `color: Colors.accent`, disabled links `color: Colors.textSubtle` with `pointerEvents: 'none'`, count `color: Colors.textMuted`
   - `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on each Pressable
   - On page change: `FlatList.scrollToIndex({ index: 0, animated: true })` so the user lands at the top of the new page
   - RPC stays `get_heartcry_feed(p_limit, p_offset, p_region)` — prefetch next page when index changes

4. **EntryPointBlock × 3** below the feed (only the live three; Together is feature-flagged):
   - `My Heartcries` → "What you have shared, and what the team has held." · meta "Four submitted · one awaiting you"
   - `Bear Witness` → "For those watching, and those who came before." · meta "Stories · witnesses · living stats"
   - `Take Heart` → "Scripture for the threshold and practical guidance." · meta "Word for today · guidance · the body with you"
   - Each: 1×38px red-mid left marker, serif 19px title, italic serif 14.5px sub, italic serif 13px muted-2 meta, right chevron, hairline divider
   - `Pressable` with `hitSlop={{ top: 4, bottom: 4 }}`

### Surface 2 — My Heartcries

- `<FlatList>` (not ScrollView) with `estimatedItemSize={186}`
- `ListHeaderComponent`: MyHeartcryIntro (red eyebrow `HELD FOR YOU`, italic body)
- Each row:
  - **Severity tag**: `Active` (red `#B83A30`), `Urgent` (`Colors.red`), `Serious` (`Colors.amber #D4A855`), `Ongoing` (amber 70%), `Informational` (`Colors.textMuted`). 0.5px border `currentColor`, `borderRadius: 2`, mono 8px
  - **Timestamp**: relative on right ("2h ago"), absolute below ("Today · 1:14 PM")
  - **Excerpt**: italic serif 15px cream, truncated with `…` ellipsis
  - **StatusTrack**: three steps connected by 0.5px hairlines
    - Received → `Colors.text` (off-white) when done
    - Seen → **`Colors.accent` (sky)** when done — *not amber* (founder ruling)
    - Responded → `Colors.green` (`#5BAD7A`) when done
    - Idle dot: 8×8, `borderColor: Colors.border`, transparent
    - `accessibilityRole="progressbar"`, `accessibilityValue={{ now: idx+1, min: 1, max: 3 }}`
  - **Responded CTA** (only on `status === 'responded'`): sky-tinted row, "Open Secure Message", chevron, opens DM:
    ```tsx
    navigation.navigate('Connect', { screen: 'DM', params: { threadId } })
    ```
- ScriptureFooter — Psalm 142:1, eyebrow "The Lord Hears"

### Surface 3 — Bear Witness

Three sections, each `SectionHeader` + content. SectionHeader rule: serif 19px sentence case + flex-1 hairline + italic serif 14px sky link (right).

1. **Standing this week** — three stat rows. Number 34px `Typography.displayRegular`, italic description 15px cream.
2. **Around the world** — three story cards (article previews). Tap → push `ArticleReader`. Section link "All stories" → push `StoryArchive`.
3. **Witness of the day** — *one* featured card, daily rotation. Tap "Witness archive →" → push `WitnessArchive`.

**WitnessOfDayCard**:
- Red-left-accent surface card
- Header row: era pill (mono caps, muted border) + optional **Martyr badge** (mono caps red, 0.5px red-mid border, sky red 5% bg, leading filled circle marker). Only render when `witness.martyr === true`.
- Name: `Typography.displayRegular`, 24px
- Meta line: `yearsLabel · category · region` (italic serif 14px muted)
- Quote: italic serif 17px cream
- Bottom row: scripture ref left (italic serif 14px sky), "Witness archive ›" right (italic serif 13px muted with chevron)

**RPC**: `get_witness_of_day()` — see schema below under "Pre-launch data work."

ScriptureFooter — Hebrews 12:1, eyebrow "A Cloud Of Witnesses"

### Surface 4 — Take Heart

1. **WordForToday** — large centered, tap-to-cycle. 5 verses (Isaiah 43:2, Matthew 5:10, Romans 8:35, 2 Cor 4:8, Isaiah 41:10). Auto-cycle every 12s via `useEffect` + `setInterval`; pause on `Pressable` active. Dot pager below.
2. **Practical guidance** — 4 cards (lock / door / shield / book glyphs in sky). Tap any → push `GuidanceReader`.
3. **Body with you** — sky-tinted block, large count (38px sky), italic copy, mono meta line "Aggregate only · no identity exposure". `backgroundColor: 'rgba(107,181,232,0.04)'` (solid, no gradient).

ScriptureFooter — John 16:33, eyebrow "Take Heart"

### Surface 5 — Together (post-MVP)

Designed and approved; **build deferred** until volume is meaningful.

- Hide behind a feature flag (`FEATURE_TOGETHER`) until **5k+ verified leaders active across >20 regions**
- Hide the front-page `Together` entry-point under the same flag, or replace with a quiet "coming" placeholder
- When built: aggregate rows (3 stats), 2-column region grid with red heat bar (`opacity: heat` 0.26–0.92), 412-day prayer streak card

### Pushed — Article Reader

`Stack.Screen name="ArticleReader"`.

- NavBar: title "Bear Witness", subtitle `AN EDITORIAL · HELD IN-APP`, back row
- ReaderMeta: italic serif source line (sky author tag), title 30px `Typography.displayRegular`, italic muted "6 min read"
- ReaderBody:
  - **Body text uses `Typography.displayRegular` (NOT italic), `fontSize: 17`, `lineHeight: 27`, `color: CREAM`** — long-form reading wants roman, not italic
  - Pull quote: 2px red left border, italic serif 22px, sky red 3% bg
  - Paragraphs separated by `marginBottom: 18`
- ScriptureFooter at the end

**RPC**: `get_article(p_article_id uuid)` → `{ id, source, author, title, body_md, pull_quote, scripture_ref, scripture_verse }`. Body rendered with a tiny markdown allowlist (paragraphs, emphasis, blockquote). Cache aggressively — articles are immutable post-publish.

### Pushed — Guidance Reader

`Stack.Screen name="GuidanceReader"`.

- NavBar: title "Take Heart", subtitle `GUIDANCE · HELD IN-APP · NOTHING LOGGED`, back row
- GuidanceIntro: red eyebrow, title, italic sub, sky "Held in-app" badge (4px pill)
- Step rows, each with shape `{ n, label, body, scripture: { text, ref } }`:
  - Number: `Typography.mono`, 11px, `Colors.red`, width 28
  - Label: `Typography.displayRegular`, 19px
  - Copy: `Typography.displayRegular`, 15.5px, lineHeight 24, CREAM
  - **Scripture block**: 1px sky left rule, italic serif quote + mono uppercase ref. **The scripture is the foundation of the step, not an afterthought.**
  - Gap between rows: `gap: 22`
- ScriptureFooter at the end

**Security invariants on this screen** (repeat in PR description):
- NEVER open an external URL
- No telemetry — no `screen_view`, no `track`
- `selectable={false}` on body text
- Print prevented; long-press-to-share disabled

**RPC**: `get_guidance(p_slug)` → cached on device.

### Pushed — All Stories Archive

`Stack.Screen name="StoryArchive"`.

- NavBar: "All stories", subtitle `AROUND THE WORLD · HELD IN-APP`, back row
- ArchiveIntro: red eyebrow `FROM THE BODY`, italic body
- FilterChips: All / Replant Editorial / Partner feeds (mono caps chip pattern, matches region filter on Feed)
- `<FlatList>` `estimatedItemSize={88}`, story rows:
  - Meta line: source (sky) · author (muted)
  - Title: serif 17px
  - Date: italic muted 12px
  - Hairline divider, `Pressable` with `hitSlop`
  - Tap → push `ArticleReader` with the story's id
- ScriptureFooter — Revelation 12:11, eyebrow "The Body Speaks"

**RPC**: `get_story_archive(p_filter)`

### Pushed — Witness Archive

`Stack.Screen name="WitnessArchive"`.

- NavBar: "Witness archive", subtitle `THOSE WHO CAME BEFORE`, back row
- ArchiveIntro: red eyebrow `A CLOUD OF WITNESSES`, italic body
- FilterChips: All / Martyrs / Fathers of the faith / Mothers of the faith / God's generals / From scripture
- When `filter === 'all'`:
  - Featured row at top — today's `WITNESS_OF_DAY` with `backgroundColor: 'rgba(217,89,79,0.03)'` and 2px red left border
  - Above it: red mono caps eyebrow `WITNESS OF THE DAY`
  - Below it: serif 16px off-white section label `Past witnesses`
- Witness rows:
  - Era column: width 78, serif 13.5 muted-2
  - Name + small badge: martyrs get red `Martyr` badge, others get muted category badge (`Father of the Faith`, `God's General`, etc.)
  - Italic serif 13.5 cream description
  - Mono uppercase sky scripture ref
- ScriptureFooter — Hebrews 12:1, eyebrow "Run With Endurance"

**RPC**: `get_witnesses(p_filter)`

---

## Pre-launch data work — Founder + Editorial

Two datasets need editorial sign-off before any public release. **Run these in Claude Code plan-mode with the founder.**

### 1. Witnesses (`witnesses` Supabase table)

Schema:
```sql
create table witnesses (
  id              uuid primary key default gen_random_uuid(),
  era             text not null,                   -- "AD 156" or "1898–1963"
  years_label     text not null,                   -- "c. AD 69 – 156" / "Biblical"
  name            text not null,
  region          text,
  category        text not null check (category in (
                    'Martyr',
                    'Father of the Faith',
                    'Mother of the Faith',
                    'God''s General',
                    'From Scripture'
                  )),
  martyr          boolean not null default false,  -- controls red Martyr badge
  quote           text not null,                   -- single-line or short multi-line
  scripture_ref   text not null,                   -- "Revelation 2:10"
  scripture_text  text,                            -- full verse (optional)
  desc            text,                            -- one-line for archive list
  source_attribution text,                         -- editorial note
  published_at    timestamptz default now(),
  rotation_day    int                              -- day-of-year index for daily rotation
);
```

RPC: `get_witness_of_day()` selects by `day_of_year() % witness_count` with a yearly shuffle seed. RPC: `get_witnesses(p_filter)` for the archive.

**Drafted candidate list** lives in `persecuted-multipage/data.jsx` as a header comment on `WITNESS_OF_DAY`. Includes:
- **Martyrs**: Stephen, James son of Zebedee, Polycarp, Perpetua & Felicity, John Hus, Tyndale, Latimer & Ridley, Jim Elliot, Bonhoeffer
- **Fathers/Mothers**: Augustine, Athanasius, Wycliffe, Bunyan, Müller, Spurgeon, Andrew Murray, Hudson Taylor, Amy Carmichael, David Brainerd, Brother Andrew, Eric Liddell
- **God's Generals**: John G. Lake, Sadhu Sundar Singh, William Seymour, Kathryn Kuhlman, Smith Wigglesworth, A.W. Tozer, C.S. Lewis
- **From Scripture**: Stephen, Daniel, the three Hebrews, John the Baptist, Paul, Esther, Jeremiah, Elijah, Mary, the early apostles

**Rules:**
- Every name **must** be a bonafide Christian whose confession of Christ alone is undisputed.
- Quotes must be either historically verified or marked as paraphrase in `source_attribution`.
- Polycarp's "Eighty-six years…" and Latimer's "play the man…" are canonical traditional quotes — keep verbatim. Bonhoeffer's "When Christ calls a man…" verbatim from *The Cost of Discipleship*.
- Dates: confirmed year if known; `c.` prefix for approximate; biblical figures use `Biblical` or `First century` era markers.

### 2. Stories (`articles` Supabase table)

Schema:
```sql
create table articles (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,            -- "Replant Editorial" / "Voice of the Martyrs" / "Open Doors"
  author          text not null,
  title           text not null,
  body_md         text not null,            -- markdown (allowlist: p, em, blockquote)
  pull_quote      text,
  scripture_ref   text,
  scripture_text  text,
  published_at    timestamptz default now()
);
```

The mockup ships placeholder editorial copy in `data.jsx` (`ARTICLE_BODY`). Real articles need editorial review.

---

## Component map (where to put things)

```
src/
├── screens/main/
│   ├── PersecutedScreen.tsx              # REFACTOR — becomes the TabView host
│   ├── persecuted/
│   │   ├── scenes/
│   │   │   ├── FeedScene.tsx             # extracted from current PersecutedScreen
│   │   │   ├── MyHeartcriesScene.tsx     # NEW
│   │   │   ├── BearWitnessScene.tsx      # NEW
│   │   │   ├── TakeHeartScene.tsx        # NEW
│   │   │   └── TogetherScene.tsx         # NEW (feature-flagged)
│   │   ├── readers/
│   │   │   ├── ArticleReaderScreen.tsx   # NEW (Stack.Screen)
│   │   │   ├── GuidanceReaderScreen.tsx  # NEW (Stack.Screen)
│   │   │   ├── StoryArchiveScreen.tsx    # NEW (Stack.Screen)
│   │   │   └── WitnessArchiveScreen.tsx  # NEW (Stack.Screen)
│   │   └── components/
│   │       ├── NotifBar.tsx              # NEW
│   │       ├── EntryPointBlock.tsx       # NEW
│   │       ├── PillTabBar.tsx            # NEW (or use Connect's if extracted)
│   │       ├── BackRow.tsx               # NEW — mono eyebrow back affordance
│   │       ├── SeverityTag.tsx           # NEW
│   │       ├── StatusTrack.tsx           # NEW
│   │       ├── WitnessOfDayCard.tsx      # NEW
│   │       ├── MartyrBadge.tsx           # NEW
│   │       ├── FilterChips.tsx           # NEW (reusable)
│   │       └── ArchiveIntro.tsx          # NEW
│   └── persecutedLogic.ts                # keep, extend
├── components/
│   └── PagedList.tsx                     # NEW — extracted from feed pagination, reused on Prayer Wall
└── lib/
    └── supabase.ts                       # existing
```

---

## RPC contracts (new)

```sql
-- already shipping
get_heartcry_feed(p_limit int, p_offset int, p_region text)

-- own submissions, viewer-scoped
get_my_heartcries()                            -- returns own rows with status

-- stats (Bear Witness header)
get_standing_this_week()                       -- aggregate, anonymous

-- editorial
get_story_archive(p_filter text)               -- 'all' | 'replant' | 'partner'
get_article(p_article_id uuid)

-- guidance
get_guidance(p_slug text)                      -- e.g. 'raid' | 'arrest' | 'digital' | 'prohibition'

-- witnesses
get_witness_of_day()
get_witnesses(p_filter text)                   -- 'all' | 'martyr' | 'father' | 'mother' | 'general' | 'scripture'

-- encouragement
get_active_intercession_count()                -- live count for "body with you"

-- together (post-MVP only)
get_aggregate_prayer_stats()
get_region_prayer_intensity()
get_intercession_streak_days()
```

All aggregate RPCs are SECURITY DEFINER and return anonymized rows only.

---

## Accessibility checklist

- Every Pressable: `accessibilityRole="button"`, descriptive `accessibilityLabel`
- StatusTrack: `accessibilityRole="progressbar"` with `accessibilityValue`
- Pull quote: wrapped in `<View accessible accessibilityHint="Pull quote">`
- Title: `accessibilityRole="header"`
- Body text: rely on default text role; users can scale system font — use `lineHeight` ratios that scale cleanly
- Hit-slop: 8 on small text Pressables, 14 on close X, 10 on chips

---

## Files in this bundle

| File | What it is |
|---|---|
| `Replant - Persecuted Tab Multi-Page.html` | Open this in a browser. Tweaks panel (bottom-right) switches between surfaces, navigation patterns, and reader overlays. Per-surface RN spec is rendered below the phone frame. |
| `persecuted-multipage/app.jsx` | Main entry, Tweaks wiring, phone frame |
| `persecuted-multipage/data.jsx` | All mock content + the **witness candidate list** (header comment on `WITNESS_OF_DAY`) |
| `persecuted-multipage/shared.jsx` | NavBar, ThresholdPreamble, ActionCard, HeartcryCard (with read-on/fold), SectionHead, RegionFilter, ScriptureFooter, TabBar, NotifBar, EntryPoint |
| `persecuted-multipage/screens.jsx` | All five surfaces + four reader/archive screens + `WitnessOfDayCard` + `RoundedHeartcryList` (pagination) |
| `persecuted-multipage/nav.jsx` | Three navigation patterns (Stack/Pills/Swipe) — only **PillNav** is the production target |
| `persecuted-multipage/spec.jsx` | The in-page RN Spec panel that updates per surface — read this when implementing each component |
| `persecuted-multipage/styles.css` | CSS reference for spacing, colors, typography (maps to RN tokens above) |
| `persecuted-multipage/shared.css` | Base tokens — imported by `styles.css` |
| `persecuted-multipage/tweaks-panel.jsx` | Tweaks panel (design tooling only — not part of the app) |

To inspect a surface or reader: open the HTML, change the Tweaks "Page" select or "Reader overlay" select. The RN Spec panel below the frame updates accordingly.

---

## Verification checklist before merging

- [ ] All five surface routes render with the existing `theme.ts` tokens (no new colors, no new fonts)
- [ ] NotifBar appears only when `hasUnreadStatus` and is dismissible
- [ ] Heartcry pagination shows `previous · X–Y of N · next`, four per page, lifts to `src/components/PagedList.tsx`
- [ ] HeartcryCard `read on / fold` matches Home tab `AnnouncementCard.tsx` exactly (24×1 rule + mono lowercase)
- [ ] My Heartcries: Seen status uses `Colors.accent` (sky), **not amber**
- [ ] My Heartcries: Responded row opens DM via `Connect → DM` with `threadId`
- [ ] Bear Witness: WitnessOfDayCard renders martyr badge only when `martyr === true`
- [ ] Bear Witness: "All stories" link pushes StoryArchive; "Witness archive" link pushes WitnessArchive
- [ ] Take Heart: guidance card tap pushes GuidanceReader (NEVER external URL, NEVER telemetry)
- [ ] Together: feature-flagged off, entry-point hidden
- [ ] Back affordance: mono eyebrow row above title (normal flow, not absolutely positioned)
- [ ] Every screen: `SafeAreaView edges={['top']}`
- [ ] No `expo-blur`, no `expo-linear-gradient`, no `fontStyle: 'italic'`
- [ ] Witness data and article data: marked DRAFT until Founder + Editorial finalize in plan-mode
- [ ] Polycarp's quote, Latimer's quote, Bonhoeffer's quote: verbatim with `source_attribution`

---

## Open with prayer. Build with reverence. Ship with sobriety.

Hebrews 13:3 — *"Remember those who are in prison, as though in prison with them, and those who are mistreated, since you also are in the body."*
