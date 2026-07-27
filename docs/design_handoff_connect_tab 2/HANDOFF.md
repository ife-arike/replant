# Handoff: Replant — The Connect Tab (Tab 5 of 5)

> Engineering handoff for the **Connect** tab of the Replant mobile app. This document is
> self-sufficient: a developer who was not in the design conversation can build the feature from
> this file alone. Pair it with `README.md` (the design narrative + decision log) and the working
> HTML prototype in this folder.

---

## 1. Overview

Connect is the **private communication layer** of the Replant network. It is intentionally **not a
social feed** — the guiding metaphor is *"a sealed letter, not a chat app."* It has two sub-tabs,
switched by a segmented control directly under the header:

- **Leaders** — 1:1 direct messages between verified leaders, plus a system-managed **Replant Team**
  secure thread (admin → leader, created only when an admin responds to a heartcry).
- **Ministries** — **branches**: group chats that connect **up to 7 ministries** (the vine and the
  branches, John 15:5). Selecting a ministry brings all of its leaders (1–2); **every leader of every
  ministry must consent** before the branch opens to messages. No one is added without consent.

Tone: dignified, ministry-grade, reverent. Sky blue is the only accent; everything else is ink on
near-black. **No blur effects anywhere** — every overlay is a solid dim rgba (the production RN app
does not bundle expo-blur).

Device target: **iPhone 15 Pro Max, 430 × 932 pt.** All values below are at this resolution.

---

## 2. About the design files / fidelity

The files in this bundle are **design references authored in HTML + React (Babel-in-browser)** — a
**high-fidelity** prototype showing the intended look, motion, and behavior. They are **not
production code to ship**. The task is to **recreate these designs in the target codebase** (the
Replant React Native app) using its established patterns, navigation, and libraries.

**Fidelity: high.** Colors, typography, spacing, radii, and interactions are final-intent. Recreate
the UI faithfully. Where this doc gives a hex/px value, treat it as the spec.

The prototype's **Tweaks panel** and all mock data are **prototype-only** — they exist so reviewers
can flip between states. Do not port them.

---

## 3. Information architecture & navigation

```
Connect (bottom tab 5)
├─ Header (shared): "Connect" + subtitle + compose affordance (icon depends on sub-tab)
├─ Segmented control:  [ Ministries | Leaders ]
│
├─ MINISTRIES sub-tab
│   ├─ Empty state ("Start a branch")
│   ├─ Branch list
│   │   ├─ Invite-consent card (status: invited)   → Join / Decline(confirm)
│   │   ├─ Forming branch rows (awaiting consent)
│   │   └─ Active branch rows
│   ├─ Branch (group) thread view  ── push ──►  back returns to list
│   │   └─ Members sheet (bottom sheet)
│   └─ Start-a-branch flow         ── push ──►  back returns to list
│
└─ LEADERS sub-tab
    ├─ Thread list (Replant Team secure thread pinned on top + peer DMs)
    ├─ Leader search / new DM       ── push ──►  back returns to list
    └─ DM thread view               ── push ──►  back returns to list
        └─ Covenant Notice (one-time, first DM ever)

Persistent everywhere: community-covenant note at the foot of each list;
condensed covenant strip pinned above every composer.
```

Navigation rules:
- Compose affordance (top-right of header): **Leaders → leader search**; **Ministries → start-a-branch**.
- A back gesture from any push screen returns to the **list** (Screen 16 / Ministries list).
- **No duplicate threads:** tapping a leader you already message opens the existing thread; otherwise a
  thread is created **server-side only when the first message is sent** (no ghost threads).
- The bottom tab bar (5 tabs) is always visible; Connect is tab index 4 (5th), active color = sky.

---

## 4. Design tokens (authoritative)

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#080808` | App background |
| `--surface` | `#111111` | Inputs, covenant footer base, received-bubble alt |
| `--surface2` | `#181818` | Received message bubbles, cards |
| `--surface3` | `#1f1f1f` | Segmented active thumb |
| `--text` | `#F0EDE6` | Primary ink (off-white) |
| `--muted` | `rgba(240,237,230,0.45)` | Secondary ink |
| `--subtle` | `rgba(240,237,230,0.25)` | Tertiary ink, placeholders, timestamps |
| `--sky` | `#6BB5E8` | **The** accent: interactive, sent bubbles, unread, secure, links |
| `--sky-bright` | `#8AC8F0` | Hover on sky |
| `--sky-mid` | `rgba(107,181,232,0.35)` | Sky borders |
| `--sky-dim` | `rgba(107,181,232,0.08)` | Sky tint fills |
| `--sky-faint` | `rgba(107,181,232,0.04)` | Faintest sky wash (secure row, host chip) |
| `--green` | `#5BAD7A` | Consent "Joined" |
| `--amber` | `#D4A855` | Forming / reconnect signals |
| `--red` | `#E05555` | Failed send, decline, error |
| `--red-dim` | `rgba(224,85,85,0.10)` | Red tint fill |
| `--red-mid` | `rgba(224,85,85,0.30)` | Red borders |
| `--border` | `rgba(240,237,230,0.08)` | Hairlines |
| `--border-2` | `rgba(240,237,230,0.14)` | Stronger hairlines, input borders |

### Typography (web fallback ⇄ React Native font identifier)
| Role | Web | RN font | Used for |
|---|---|---|---|
| Serif | `'Cormorant Garamond'` 400/500 | `CormorantGaramond_400Regular` / `_500Medium` | Tab title, thread/branch names, modal headings, empty openers |
| Serif italic | `'Cormorant Garamond'` italic | `CormorantGaramond_600SemiBold_Italic` | Accent words |
| Scripture | `'Cormorant Garamond'` 300 italic | `CormorantGaramond_300Light` | Verse blocks, empty-state openers |
| Mono | `'DM Mono'` 400/500 | `DMMono_400Regular` | Eyebrows, timestamps, labels, lock/secure tags, send-status |
| Body | `'DM Sans'` 400/500/600 | `DMSans_400Regular` (+500/600) | Message bubbles, all UI text |
| Sans light | `'DM Sans'` 300 | `DMSans_300Light` | Optional light captions |

### Spacing, radius, motion
- Screen horizontal padding: **22px** (lists/headers). Composer/push-nav: **14–16px**.
- Card padding: **14–22px**. List-row vertical padding: **13–14px**.
- Radius: cards **10–16px**, monogram/seal **11px**, segmented **8–11px**, inputs **11–12px**,
  pills/badges **999px**, message bubbles **16px** outer / **5px** inner (tail) corner.
- Hairlines: **0.5px** (`--border`).
- Hit targets ≥ **44px** (tab items, buttons, send).
- Motion: push screens slide+fade `translateX(24px)→0`, **.26s** `cubic-bezier(.32,.72,0,1)`.
  Bottom sheets `translateY(100%)→0`, **.3s** same easing. Modals `translateY(12px) scale(.98)→1`,
  **.26s**. Scrim fade **.2s**. Reconnect/amber pulse `breathe` 1.4s. Loading shimmer 1.4s. Spinner .8s.

---

## 5. Shared chrome

### 5.1 Header (`ConnectHeader`)
- Container: `padding: 56px 22px 16px` (top accounts for status bar / Dynamic Island).
- Eyebrow: mono, 9px, `0.26em`, uppercase, `--subtle` → **"Tab 5 · In Confidence"**.
- Title: serif 400, **30px**, `0.02em` → **"Connect"**.
- Subtitle: mono, 9px, `0.2em`, uppercase, `--muted`, with `·` dot in `--subtle`
  → **"Ministry to ministry · Held in confidence"** (Ministries) / **"Leader to leader · Held in confidence"** (Leaders).
- Compose affordance: top-right, 38×38, radius 11, `--surface` bg, `0.5px --border-2` border, sky icon.
  Icon = **plus** (Ministries) or **pencil/compose** (Leaders). Hover → `--sky-dim` bg, `--sky-mid` border.

### 5.2 Segmented control (`Segmented`)
- Row under header: `margin: 2px 22px 8px`, `padding: 3px`, `--surface` bg, `0.5px --border`, radius 11.
- Two items flex:1, centered, body 500 12.5px, `--muted`. Active item: `--surface3` bg, `--text`, radius 8.

### 5.3 Tab bar (bottom)
- 5 tabs, `padding: 10px 4px 30px` (30px = home-indicator inset), `rgba(8,8,8,0.97)` bg, top `0.5px --border`.
- Tab: 20px stroke icon + 9.5px body label. Inactive opacity 0.42, label `--muted`. **Active = sky** icon + label.
- Order: Home · The Church · Persecuted · Prayer · **Connect**.

### 5.4 Persistent covenant (two forms)
- **Footer** (`CovenantFooter`) — at the foot of *every* list. `margin: 14px 22px 22px`, `padding: 13px 15px`,
  `--surface2` bg, `0.5px --border`, radius 10. Body 11px / 1.65, `--muted`. Copy (verbatim):
  *"Conversations within Replant are governed by our community covenant. Chats are protected within the
  network. Keywords flagged for review if misuse is detected."*
- **Strip** (`CovenantStrip`) — pinned directly above *every* composer. Flex center, `padding: 7px 18px`,
  `rgba(8,8,8,0.96)` bg, top `0.5px --border`. Mono 8px `0.12em` uppercase `--subtle`, with a small sky
  lock icon (opacity .7). Copy: *"Protected within the network · flagged keywords are reviewed"*.

---

## 6. LEADERS sub-tab

### 6.1 Thread list (Screen 16)
- **Search bar:** `margin: 4px 22px 6px`, 42px tall, `--surface` bg, `0.5px --border`, radius 11, search
  icon (`--subtle`) + input (body 14px). Placeholder **"Search by name or church"**. Focus → `--sky-mid` border.
  Activates at **2+ chars; matches leader name + church only — never message content.**
- **Row** (`thread-row`): flex, `gap 14px`, `padding 14px 22px`, 0.5px bottom hairline inset to left:76px.
  - **Monogram (seal):** 40×40, radius 11, `--surface2` bg, `0.5px --border-2`, serif 18px 500 initial.
    Anonymous/underground → muted figure glyph (not initials). **Replant Team → `rp-mark.svg` logo** in the seal.
  - **Center:** name (body 14.5px 500, ellipsis, fills width), church (body 11.5px `--muted`), preview
    (body 12.5px `--muted`, single line, **60-char** truncation w/ ellipsis). Unread → name + preview `--text`.
  - **Right:** timestamp (mono 9.5px `--subtle`), unread badge below (sky pill, min 19px, mono 10px, bg-on-text `--bg`).
  - Relative timestamps: `2m ago` · `3h ago` · `Yesterday` · `3d ago`.
- **Replant secure thread (pinned first, always above recency sort):** row gets `--sky-faint` bg, a **2px sky
  left rail**, sky-tinted seal w/ logo, name in sky, a `Secure` tag (mono 8px `0.18em`, sky, `0.5px --sky-mid`,
  radius 4), and a small lock before the name. System-managed; the leader cannot create it.
- **Sort:** secure pinned; peers by `last_message_at` DESC. **Pagination:** 25 initial, scroll-to-load next 25.

### 6.2 Leader search / new DM (Screen 17)
- Push screen. Nav: back chevron + serif 19px title **"New Message"**.
- Field: `margin: 16px`, 46px, `--surface` bg, **`0.5px --sky-mid`** border, radius 12, sky search icon,
  input body 15px, autofocus on mount, **debounce ~250ms**, clear (✕) when non-empty.
- Before 2 chars: centered serif-italic hint *"Search the network by a leader's name or the name of their church."*
- Result row: seal + name (14.5px 500) + church (12px muted) + chevron. **No location/country/region anywhere.**
- Empty: *"No leaders found matching that search."*
- Tap behavior: inactive leader → toast *"This leader is no longer active in the network."*; existing thread →
  open it; else → open a lazily-created thread (server row on first send only).
- **Underground safety:** search corpus is pre-filtered server-side — an underground church's real name never
  matches; only the label **"Underground Church"** is searchable.

### 6.3 DM thread view (Screen 18)
- Header (`thread-head`): `padding 54px 14px 12px`, `rgba(8,8,8,0.92)` bg, bottom `0.5px --border`. Back +
  name (serif 18px 500) + church (mono 9.5px `0.12em` uppercase `--muted`). **Secure thread:** lock + literal
  **"Replant Team — Secure Message"** in sky; sub-label *"Replant · system-managed"*.
- **Messages** region: scroll, `padding 14px 18px 10px`, column `gap 3px`.
- **Timestamp grouping — per 5-minute window:** a centered mono 9px `0.14em` uppercase `--subtle` divider above
  the *first* message of each window, not on every bubble. Formats: `2:34 PM` (today) · `Yesterday 9:12 AM` ·
  `Mon 4:00 PM` · `Apr 28 10:00 AM` (beyond a week).
- **Bubbles:** max-width **75%**, `padding 11px 15px`, body 14.5px / 1.5.
  - Received: `--surface2` bg, `--text`, `0.5px --border`, radius `16 16 16 5`.
  - Sent (mine): `--sky` bg, ink `#07232f`, radius `16 16 5 16`.
  - Consecutive same-author bubbles tighten the inner corner (tail).
  - Secure received bubble: `0.5px --sky-mid` + a **2px sky left border** (provenance cue).
  - **Plain text only.** **URLs render as inert plain text — not linkified, no preview** (security: prevents
    IP/location leakage via prefetch).
- **Optimistic send states:** pending = bubble at **0.55 opacity** + below it `· Sending` w/ clock (mono 8.5px,
  `--subtle`); sent = indicator clears; failed = bubble gets `0.5px --red-mid` ring + `Not delivered · Tap to
  retry` (red, tappable → re-send).
- **Composer** (fixed bottom, `padding 10px 14px 28px`, top `0.5px --border`):
  - **Attachment** affordance (paperclip, `--subtle`) — **coming soon**; tap → toast *"Attachments are coming
    soon. Sharing files will require consent and must follow the Replant community standard."* (No file/photo
    sending at MVP.)
  - Auto-grow textarea: min 42px, **max 124px (~5 lines)** then internal scroll, `--surface` bg, `0.5px --border-2`,
    radius 21, body 14.5px. Enter = send, Shift+Enter = newline.
  - Send: 42×42 circle, sky bg, ink icon; **disabled (surface2 / subtle) when empty**.
- **History pagination:** 30 on mount (newest at bottom); scroll-to-top loads previous 30 (top spinner +
  *"Loading earlier"*), then *"Beginning of conversation"* when exhausted.
- **Empty (new lazy thread):** centered sky lock glyph + serif-italic *"A new, private letter."* + *"Say what is
  on your heart to begin. Only the two of you will read it."* (copy = CONTENT to finalize). Composer functional.
- **Reconnect:** inline amber pill `· Reconnecting` (never a modal).

### 6.4 Covenant Notice (one-time, first DM ever)
- Fires on the leader's **first send attempt, ever** (not per conversation). Dim scrim `rgba(4,4,4,0.74)`,
  centered card: `--surface`, `0.5px --border-2`, radius 18, `padding 30px 26px 24px`, centered.
- Sky seal (shield) → mono sky eyebrow *"A word before you write"* → serif 24px heading *"Connect is a room of
  trust."* → body 13px/1.7 `--muted` with a serif-italic pull-quote *"Behave as you would before your King."*
- **Requires acknowledgement** — single primary **"I understand"**; cannot be dismissed otherwise. Once
  acknowledged, never shown again (per-account flag). **Copy is placeholder — finalize with Content + Founder.**

---

## 7. MINISTRIES sub-tab (branches)

### 7.1 Empty state (`MinistriesEmpty`)
- Centered. Sky branch seal (58×58, radius 16, `--sky-dim` bg, `0.5px --sky-mid`).
- Serif 24px **"What would you like to start today?"** + body 13px/1.65 `--muted` *"Open a church-to-church
  conversation. You can bring up to seven ministries together into one branch — everyone joins by consent."*
- Primary **"Start a branch"**.
- **Full verse** (scripture 300 italic 15px `--muted`, max 300px): *"I am the vine, ye are the branches: He
  that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing."* +
  mono ref **John 15:5**.
- Post-note (mono 9px `--subtle`): *"Branches with more than seven ministries coming soon."*
  (**The 7-ministry cap is MVP; larger branches are a post-MVP discussion.**)

### 7.2 Branch list
- **Branch row** (`branch-row`): seal (sky branch glyph) + center + right, same metrics as thread rows.
  - Name (body 14.5px 500) + optional **`Forming`** tag (mono 8px `0.16em`, amber, `0.5px` amber border, radius 4).
  - Members line: mono 9.5px sky → **"{N} ministries · {M} leaders"**.
  - Preview (body 12.5px `--muted`, ellipsis) + timestamp + unread badge.
- **Invite-consent card** (`InviteCard`, status `invited`, shown above rows): `--surface`, `0.5px` amber border,
  radius 14. Amber branch seal + mono amber eyebrow *"You're invited to a branch"* + serif 19px branch name.
  Body: *"**{Ministry}** invited your ministry to join — {N} ministries, {M} leaders in all. Everyone joins
  only by consent."* Actions: **Decline** (ghost) + **Join the branch** (primary, flex 1.4).
  - **Decline opens a confirmation modal** (`DeclineConfirm`): centered card (`--surface`, radius 18), serif
    22px *"Decline this invitation?"*, body *"Your ministry won't join "{branch}." {inviter} can invite you
    again later — no harm, no foul."*, actions **Keep invitation** (ghost) + **Decline** (red ghost,
    `--red` text / `--red-mid` border, hover `--red-dim`). Confirm → toast *"Invitation declined."*

### 7.3 Branch (group) thread view (`BranchView`)
- Header: back + branch glyph + branch name (serif 18px 500) + sub *"{N} ministries · {M} leaders"* + a
  **members** action (users icon, right) opening the members sheet.
- **Group bubbles:** received bubbles are preceded by an **author label** — sender name (body 11.5px 600, sky) +
  ministry (mono 8.5px `0.08em` uppercase `--muted`); omitted for consecutive same-sender. Sent bubbles unchanged.
- **System events** (`branch-event`): centered mono 9px `0.1em` uppercase `--subtle` — e.g. *"You started this
  branch."*, *"Grace Network and Living Word joined."*
- **Forming state (composer locked):** amber banner — serif 18px *"Forming this branch"* + body *"{joined} of
  {total} leaders have joined. Messages open once every leader accepts — {pending} still to consent."* Composer
  shows a disabled note *"Messaging opens once everyone has joined"* + disabled send.
- **Members sheet** (bottom sheet, max-height 76%): branch name + *"{N} ministries · {M} leaders"*, then per
  ministry a block (ministry label + `Your ministry` tag for the host) listing each leader with a consent badge:
  **Joined** (green + check) · **Invited** (subtle) · **Declined** (red + ✕). Removed ministries render struck-through.

### 7.4 Consent / decline progression (load-bearing)
Every leader of every ministry must consent before a branch opens. Demonstrated as a progression:
1. **Awaiting** — some joined, rest invited. Banner: *"2 of 5 leaders have joined … 3 still to consent."*
2. **One leader declined** — within a 2-leader ministry, one declines, one still pending. Banner adds *"· 1 declined."*
3. **A whole ministry declined** — all of a ministry's leaders decline → the **branch creator** is prompted
   (`decline-prompt`, red-tinted card): serif 18px *"{Ministry} declined this branch."* + body *"Their leaders
   chose not to join. You can continue forming the branch without them — no harm, no foul."* Actions:
   **Cancel branch** (ghost) + **Continue without them** (primary). Continuing **drops that ministry** and
   proceeds; toast *"Continuing without {Ministry} — {N} still to consent."* (or *"Branch formed without
   {Ministry}."* if no one else is pending).

### 7.5 Start-a-branch flow (`BranchCreate`)
- Push screen. Nav back + serif title **"Start a branch"**. Left-aligned John 15:5 eyebrow.
- **Name field:** serif 19px input, `--surface`, radius 12, 48px, placeholder *"e.g. East Africa Outreach"*, max 48 chars.
- **Invite ministries:** mono label + a **"{n} of {cap} selected"** counter (cap = `7 − 1 host = 6`).
- **Host chip** (locked): your ministry, `--sky-faint` bg, `0.5px --sky-mid`, *"Your ministry · host"* + lock.
- Search ministries + pick list: rows with seal + name + *"{location} · {n} leaders"* + a check box (sky when on).
  Selecting past the cap is disabled (rows dim to 0.35).
- **Footer:** summary *"{N} ministries · {M} leaders will be invited"* + **Send invitations** (disabled until a
  name + ≥1 ministry). On send → branch is created **server-side as `forming`** and opens to the forming view.

---

## 8. States every screen needs

| Screen | States |
|---|---|
| Leaders list | loading (skeleton rows, same dims) · error (*"Couldn't load your conversations." · Tap to retry*) · empty (*"No conversations yet. Find a leader in the network and start one."* + **Find a Leader**) · populated · unverified gate |
| Leader search | pre-2-char hint · live results · empty · inactive-leader toast · network-failure toast |
| DM thread | loading-older · history-exhausted · empty (new lazy) · sending/sent/failed · reconnect · covenant gate |
| Ministries list | empty (start a branch) · populated · invited (consent card) · forming rows · active rows |
| Branch thread | forming (locked + banner) · active · decline progression · members sheet |
| Start-a-branch | empty/partial selection · cap reached · valid (send enabled) |

**Unverified gate** (when `branch !== 'active'` for the leader): a **soft bottom sheet** (not a hard block) over a
**dimmed list** (`filter: brightness(0.5)`), scrim `rgba(4,4,4,0.5)`. Sky shield glyph, serif 22px *"For verified
leaders"*, body *"Available to verified leaders. Verification confirms your place in the network."*, single
**"I understand"** dismiss. Header + list remain visible behind it.

---

## 9. State model (suggested)

```ts
type SubTab = 'ministries' | 'leaders';
type Screen = 'list' | 'search' | 'thread' | 'branch' | 'create';

type Leader = { id; fullName; role; church; anonymous: boolean; underground: boolean; active: boolean };
type Thread = { id; system?: boolean; leaderId?; preview; lastAt; unread: number };
type Message = { id; mine: boolean; text; at; groupLabel?: string|null; state?: 'pending'|'sent'|'failed' };

type Ministry = { id; name; location?; underground: boolean; leaders: string[]; mine?: boolean };
type Branch = {
  id; name; status: 'active'|'forming'|'invited';
  ministryIds: string[];          // ≤ 7
  invitedBy?: string;             // ministry id (status='invited')
  joined?: number;                // consent count (status='forming')
  preview; lastAt; unread: number;
};

// Global, one-time, per account:
covenantAcknowledged: boolean;    // gates the FIRST DM ever
```

### Display-name rule (canonical — c.13246 Founder copy lock)
```
not anonymous:  "FirstName LastName · ChurchName"
anonymous:      "RoleLabel · ChurchName"            // e.g. "Pastor · Maranatha Ministries"
underground:    church ALWAYS renders "Underground Church" (no location), regardless of anonymous flag
```
In rows/headers the name and church stack (name line over church line) — same canonical data, row presentation.

---

## 10. Interaction & behavior contracts

- **First DM ever** → Covenant Notice gate → "I understand" → message proceeds; flag set for the account.
- **Optimistic send:** append `pending` → reconcile to `sent` on ACK or `failed` on error/timeout. **Failed
  messages are lost on navigation away (MVP — no cross-session persistence).**
- **Branch creation:** invitations sent → branch `forming` → opens to messages only when **all** invited
  leaders consent. A fully-declined ministry triggers the creator's "continue without them?" prompt.
- **No duplicate threads / branches.** **No group messaging in the *Leaders* tab.** **No read receipts, typing
  indicators, message deletion/editing, or archiving at MVP.** **No media attachments at MVP** (affordance is
  "coming soon" + will require consent-to-share + community standard).
- **Links:** plain text, not tappable, no preview at MVP.
- **Real-time:** inbound messages append at the bottom; dropped connection shows the inline reconnect pill only.
- **Moderation:** messages are moderated server-side; **flagged messages are still delivered (no blocking)**.
  "Secure" = provenance, not transport encryption (standard TLS).

---

## 11. Assets
- `rp-mark.svg` — the Replant mark (sky `#71bdfe`), shown in the Replant Team seal. Already in this folder.
- All other icons are simple inline stroke SVGs (`Icon` / `IconBranch` in `states.jsx`) — port to
  `react-native-svg`. Branch glyph has 4 swappable variants (network = default · linked-rings · chain · people);
  the final choice is an open question (see README).
- Fonts: Cormorant Garamond, DM Sans, DM Mono — load via `expo-font` (bundle Cormorant italics).

---

## 12. Files in this bundle
```
Replant - The Connect Tab.html   ← open to preview the full prototype
README.md                        ← design narrative + per-round decision log + open questions
HANDOFF.md                       ← this engineering spec
connect-tab/
  app.jsx            router/state machine + shared header/segmented + (prototype-only) Tweaks
  screen-16.jsx      Leaders: thread list
  screen-17.jsx      Leaders: leader search / new DM
  screen-18.jsx      Leaders: DM thread view
  screen-ministries.jsx  Ministries: branch list, invite + decline-confirm, empty state
  screen-branch.jsx  Ministries: branch group thread + members sheet + consent progression
  branch-create.jsx  Ministries: start-a-branch flow
  covenant.jsx       one-time first-DM Covenant Notice
  states.jsx         TabBar, icons (Icon/IconBranch), Monogram, BranchSeal, Segmented,
                     CovenantFooter/Strip, skeleton/error/empty, unverified gate, toast
  data.jsx           mock leaders/threads/messages/ministries/branches + display-name helpers
  styles.css         component CSS (imports shared/styles.css)
  rp-mark.svg        Replant mark
  tweaks-panel.jsx   prototype-only state switcher (DO NOT port)
shared/
  styles.css         tokens + app scaffold (tab bar, header, buttons, empty primitive)
```

## 13. React Native conversion notes
1. Tokens map 1:1 to a StyleSheet/theme module; RN font names are in §4.
2. **No blur** — all overlays are solid dim rgba (expo-blur is not bundled).
3. Lists → `FlatList` (Leaders 25/page; messages inverted, 30 on mount, load-older on reach-top).
4. Composer → `TextInput multiline` + `onContentSizeChange` auto-grow capped ~5 lines.
5. Bottom sheets / modals → native sheet or reanimated; match the easing in §4.
6. Covenant ack = per-account flag (secure store / server), gated globally not per thread.
7. Safe areas via `useSafeAreaInsets()`; bottom tab reserves the 34pt home-indicator inset.

## 14. Open questions (carried from the design conversation)
- Default sub-tab in production (prototype opens on **Ministries** to showcase; MVP may prefer **Leaders**).
- **Branch glyph** — which of the four variants.
- Whether **Ministries** is MVP or post-MVP (the original brief locked *"no group messaging at MVP"* — branches
  are an approved exploration).
- Consent granularity (every leader vs. one-per-ministry), leaving/removing a ministry, decline notifications,
  re-invites, branch naming (free-text vs. auto), expiry of invitations.
- Whether trusted links (e.g. projectreplant.org) should ever be tappable behind a safety interstitial.
- Final copy for: Covenant Notice, new-thread empty opener, attachment consent gate.

---

## 15. Round-3 additions — unread badge · badge setting · attachment popover

### 15.1 Connect tab unread badge (MVP — Connect only)
- A **numeric badge on the Connect tab icon** (tab bar position 5). MVP scope; Connect only.
- Count = **total unread across all conversations** (Leaders DMs + Ministries branches):
  `Σ thread.unread + Σ branch.unread`. **Hidden when zero.** Display capped at **"99+"**.
- Follows iOS/Android native badge convention: red disc, white numerals, anchored to the icon's
  top-right, separated from the bar by a background-colored ring.
- **Gated by the Settings "New message badge" preference** (§15.2) — when off, never rendered.
- Enumerated (430 × 932):
  | Property | Value |
  |---|---|
  | Min-width × height | **18 × 18px** (grows for 2–3 digits via `padding: 0 4px`) |
  | Border-radius | **9px** |
  | Background | `--red` `#E05555` |
  | Text | `#FFFFFF`, DM Sans **10.5px / 600**, line-height 1 |
  | Separation ring | **2px solid `--bg` `#080808`** (box-sizing: border-box) |
  | Position | `top: -8px; left: 10px` relative to the 20 × 20 icon (extends past the icon's right edge — native) |
  | Tab icon / label | 20 × 20 icon · DM Sans 9.5px label |
- RN: use React Navigation's `tabBarBadge` (renders a native badge) styled to the above, fed by a
  `totalUnread` selector; hide at 0; respect the badge preference flag.

### 15.2 Settings — "New message badge" toggle  *(full spec in the Settings handoff)*
- New **"05 — Notifications"** section in Settings (About renumbers to **06**). **First notification
  preference in the app. On by default.**
- Toggle: 38 × 21px, radius 11, thumb 15 × 15 sliding 16px; on = `--sky-tint` fill + `--sky` border +
  sky thumb (identical to the Anonymous-mode toggle). Label `NEW MESSAGE BADGE`, value "On/Off",
  helper italic-serif: *"Shows a count on the Connect tab when you have unread messages."*
- Write: `PATCH /users/me` `notif_message_badge: boolean` (default `true`), optimistic. When `false`,
  the tab badge (§15.1) is suppressed app-wide.

### 15.3 Attachment "coming soon" popover (DM + branch composer)
- The composer paperclip is present but attachments are **not** in MVP. Tapping it opens a small,
  **anticipatory** popover above the paperclip — intentional, not an error toast.
- Copy: title **"Attachments — coming soon"**; sub **"Sharing files and photos is on the way — with
  consent, of course."**
- Dismiss: tap anywhere outside (transparent catcher), tap the paperclip again, or start typing.
- Enumerated (430 × 932):
  | Property | Value |
  |---|---|
  | Width | **246px** |
  | Padding | **13px 15px 14px** |
  | Background | `--surface2` `#181818` |
  | Border | **0.5px `--sky-mid`** |
  | Radius | **13px** |
  | Shadow | `0 14px 40px rgba(0,0,0,0.55)` |
  | Title | Cormorant Garamond **17px / 500**, `--text` |
  | Sub | DM Sans **11.5px / 1.5**, `--muted` |
  | Caret/tail | 11 × 11px rotated square, `--surface2` + right/bottom 0.5px `--sky-mid`, at `left: 20px`, pointing down |
  | Anchor | `bottom: 50px; left: -8px` relative to the paperclip wrap |
  | Enter anim | fade + 6px rise, **.18s** `cubic-bezier(.32,.72,0,1)` |
  | Paperclip hit area | ≥ 34 × 42px |
- RN: a positioned popover/tooltip anchored to the paperclip, dismissed on backdrop tap. No file
  picker is wired at MVP. (Replaces the earlier toast treatment.)

