# The Connect Tab — Design Handoff

Hi-fi prototype + engineering spec for **Connect** — Tab 5 of 5 in the Replant React Native app.
Open `Replant - The Connect Tab.html` in any modern browser to preview at iPhone 15 Pro Max (430 × 932 pt).

> **Tone (load-bearing):** Connect is the *private* layer of the network. It is a **secure letter**,
> not a chat app. Verified leader → verified leader, and the Replant team → a single leader.
> Messages are moderated server-side; flagged messages are still **delivered** (no blocking).
> Sky is the only accent; everything else is ink on near-black. **No blur anywhere** — every
> overlay is dim-only rgba.

## What's in this package

```
Replant - The Connect Tab.html      ← open this first
connect-tab/
├── app.jsx              ← router / state machine + shared header/segmented + Tweaks + mount
├── screen-16.jsx        ← LEADERS: Thread List
├── screen-17.jsx        ← LEADERS: New DM flow / Leader Search
├── screen-18.jsx        ← LEADERS: DM Thread View (bubbles, groups, send states)
├── screen-ministries.jsx← MINISTRIES: branches list, invite-consent card, empty state
├── screen-branch.jsx    ← MINISTRIES: branch (group) thread + members sheet
├── branch-create.jsx    ← MINISTRIES: start-a-branch flow (name + invite up to 7)
├── covenant.jsx         ← first-DM Covenant Notice (one-time gate)
├── states.jsx           ← loading/error/empty/gate + TabBar + icons + Monogram + Segmented + CovenantFooter/Strip
├── data.jsx             ← mock threads, messages, leaders, ministries, branches + display-name helpers
├── styles.css           ← Connect component CSS (imports shared/styles.css)
├── rp-mark.svg          ← Replant mark (sits in the Replant Team seal)
└── tweaks-panel.jsx     ← state switcher (web prototype only; NOT for RN)
shared/
└── styles.css           ← brief tokens + app scaffold (tab bar, header, buttons, empty primitive)
```

## ⟢ Update — Ministries (branches), persistent covenant, Replant mark

This revision adds the v4 **two-sub-tab** model and two smaller asks. **Note:** the original
Connect brief lists *"No group messaging at MVP"* as a locked decision — the Ministries sub-tab
below is an **exploration of that idea** (likely post-MVP), built so you can see it, not a claim
that it ships at MVP. Tap the segmented control or use Tweaks › *Sub-tab* to move between them.

**1. Replant mark in the secure seal.** The Replant Team thread now carries `rp-mark.svg` in its
icon square (the lock moved to the name line only).

**2. Persistent community covenant.** Beyond the one-time first-DM modal, the covenant is now
always visible: the full note (*"Conversations within Replant are governed by our community
covenant. Chats are protected within the network. Keywords flagged for review if misuse is
detected."*) sits at the foot of both lists, and a condensed strip is pinned above the composer in
every thread.

**3. Ministries ⇄ Leaders segmented control** inside Connect (matches v4):
- **Leaders** = the 1:1 leader DMs (the original brief, unchanged).
- **Ministries** = **branches** — group chats connecting up to **7 ministries** (*John 15:5, the
  vine & the branches*). Selecting a ministry brings **all its leaders** (1–2); **every leader of
  every ministry must consent** before the branch opens to messages — no one is dragged in.
- **Empty state:** *"What would you like to start today?"* + the vine eyebrow + **Start a branch**.
- **Branch list:** invite-consent card (Join / Decline) for branches you've been asked into;
  `Forming` rows (awaiting consent); active rows showing *N ministries · M leaders*.
- **Branch (group) thread:** received bubbles carry **sender + ministry**; system events narrate the
  branch's life; a **members sheet** lists every ministry and per-leader consent (Joined / Invited).
  A **forming** branch is **locked** (composer disabled) with a banner *"X of Y leaders have joined…"*
  until all consent.
- **Start-a-branch flow:** name it → invite ministries (your own ministry is the locked **host**;
  cap of 7 total) → *Send invitations* → branch is created server-side as **forming**.

### New / changed Tweaks
`Sub-tab` (Ministries/Leaders) · `Ministries state` (populated/empty) · `Leaders thread list`
(populated/empty/loading/error) · plus the existing Verification / Connection / Next-send / Reset-covenant.

### Assumptions I made (please confirm or correct)
1. **Default sub-tab = Ministries** (to foreground what you asked to see). Production MVP may want **Leaders** as default since Ministries is the post-MVP idea.
2. **Selecting a ministry includes all its leaders**, and **every** leader must individually consent (branch stays *forming*, shows *X of Y joined*, until complete).
3. **The creator names the branch** (free text); your own ministry is always the host and occupies one of the 7 slots.
4. **Any verified leader can start a branch.** No role restriction.
5. **A forming branch is locked** — no messages until everyone has consented.
6. **Ministry rows show location** (e.g. *Lagos, Nigeria*); underground ministries show only *"Underground Church"*. (Leaders DMs remain name/church only, never location.)

### New open questions
- Should a **leader leave / a ministry leave** a branch, and what happens to the branch when it drops below 2 ministries?
- **Naming:** free-text vs. auto-named from members vs. both?
- **Consent granularity:** every leader, or one leader per ministry on the ministry's behalf?
- When **invited**, does declining notify the inviter? Is there an expiry?
- Should **Ministries** also surface the Replant Team secure thread, or does that stay in Leaders only (current)?

### Round-2 refinements (this pass)
- **Replant mark** now sits in the Replant Team seal (`rp-mark.svg`).
- **Persistent covenant** at the foot of both lists + a condensed strip pinned above every composer.
- **Ministries empty state** carries the **whole** John 15:5 verse; "coming soon" copy is now *"Branches with more than seven ministries coming soon."* (the **7-ministry cap is MVP**; larger branches are a post-MVP discussion).
- **Branch icon is swappable** via Tweaks › *Branch icon* (Network = current default · Linked rings · Chain · People) — still looking for the one that feels right; open to other directions.
- **Decline / consent progression** (Tweaks › *Consent (forming branch)*, on a forming branch):
  *Awaiting* → *One leader declined* (a ministry's other leader hasn't yet; banner shows *"… · 1 declined"*) → *A whole ministry declined* → the creator gets a prompt: **"{Ministry} declined this branch — continue without them?"** Choosing *Continue without them* drops that ministry and proceeds (no harm, no foul); the members sheet shows per-leader **Joined / Invited / Declined**.
- **Branch invitation is re-triggerable** — Tweaks › *Branch invitation* (Show/Hide) restores the consent invite card so it can be tested repeatedly.
- **Attachments:** a paperclip affordance is present but **coming soon** — tapping explains *"Sharing files will require consent and must follow the Replant community standard."* (No file/photo sending at MVP — avoids unsolicited documents.)
- **URLs render as inert plain text** at MVP — **not tappable, no preview**. Auto-fetched link previews would leak IP/location, which underground leaders can't risk. Post-MVP, any link handling should be explicit-tap with a safety interstitial. (See the sample message in the Living Word thread.)

### New open questions (round 2)
- **Branch icon** — which glyph? (Tweak through the options.)
- When a whole ministry declines and the creator continues, should the **declined ministry be notified**, and can they be **re-invited** later?
- **Attachments** — when built, confirm the consent-to-share gate copy and the file types allowed.
- **Links** — confirm plain-text-only is acceptable for MVP, or whether trusted domains (e.g. projectreplant.org) should be tappable with a warning.

> `app.jsx` and `tweaks-panel.jsx` are not named in the brief's file list but are required to make
> the screens navigable in one entry file (same pattern as the Persecuted & Prayer Wall handoffs).
> Neither ships to React Native.

## Design tokens (LOCKED by the Connect brief)

These values are taken verbatim from the brief — they are **not** lifted from `shared.css`
(`--red` here is the brighter `#E05555`, surfaces are flat `#111/#181818`, mono is **DM Mono**).

| Token | Value | Use |
|---|---|---|
| `--bg` | `#080808` | App background |
| `--surface` / `--surface2` | `#111111` / `#181818` | Cards, received bubbles, inputs |
| `--text` | `#F0EDE6` | Off-white body |
| `--muted` / `--subtle` | `rgba(240,237,230,0.45 / 0.25)` | Secondary / tertiary ink |
| `--sky` | `#6BB5E8` | **The** accent — interactive, sent bubbles, unread, secure thread |
| `--sky-mid / -dim / -faint` | `0.35 / 0.08 / 0.04` sky | Borders, tints, washes |
| `--green` / `--amber` / `--red` | `#5BAD7A` / `#D4A855` / `#E05555` | Signals (amber=reconnect, red=failed send) |
| `--border` | `rgba(240,237,230,0.08)` | Hairlines |

### Type — web fallback ⇄ RN identifier (1:1)

| CSS var | Web | React Native font |
|---|---|---|
| `--serif` | Cormorant Garamond 400 | `CormorantGaramond_400Regular` |
| `--serif-italic` | Cormorant Garamond 600 italic | `CormorantGaramond_600SemiBold_Italic` |
| `--scripture` | Cormorant Garamond 300 | `CormorantGaramond_300Light` |
| `--mono` | **DM Mono** 400 | `DMMono_400Regular` |
| `--body` | DM Sans 400 | `DMSans_400Regular` |
| `--sans-light` | DM Sans 300 | `DMSans_300Light` |

**Where each font does work:** serif → tab title, thread-view names, empty-state openers, covenant
heading. DM Sans → message bubbles + all UI (legibility wins inside a messaging surface). DM Mono →
eyebrows, timestamps, labels, secure/lock indicators, send-status microcopy.

## Display name rules (load-bearing — c.13246 Founder copy lock)

One canonical format, implemented in `data.jsx` (`formatDisplayName` / `leaderName` / `churchLabel`):

- **Not anonymous:** `FirstName LastName · ChurchName`
- **Anonymous:** `RoleLabel · ChurchName` (e.g. *"Pastor · Maranatha Ministries"*)
- **Underground:** church **always** renders as `Underground Church`, regardless of the leader's
  anonymous setting, with **no location**.

In rows and headers the name and church are stacked (name line over church line) rather than the
joined `·` string — this is the row presentation of the same canonical data. The **monogram** is a
rounded-square seal (not a circular social avatar) bearing the initial of the *display* name's
leading token; underground leaders render a generic mark, never initials.

## Screens & states (all rendered — not just the happy path)

### Screen 16 — Thread List (tab root) · `screen-16.jsx`
- Header: serif "Connect", mono subtitle *"Leader to leader · Held in confidence"*, **compose** affordance top-right (rounded-square, sky).
- **Search bar** — placeholder *"Search by name or church"*; activates at 2+ chars; matches **name + church only, never message content**.
- **Replant secure thread (pinned)** — always first, above the recency sort. Distinct: 2px sky left-rail, sky-tinted row, lock icon, name in sky, `Secure` tag. System-managed; the leader cannot initiate it.
- **Peer rows** — monogram · name · church (or "Underground Church") · 60-char preview · relative timestamp · sky unread badge.
- **States:** populated · empty (*"No conversations yet. Find a leader…"* + **Find a Leader** CTA) · loading (skeleton rows, same dimensions) · error (*"Couldn't load your conversations." · Tap to retry*) · **unverified gate**.

### Screen 17 — New DM Flow / Leader Search · `screen-17.jsx`
- Pushes over the list; autofocused field *"Find a leader"*; live results at 2+ chars (250ms debounce).
- Result rows: monogram · name · church · chevron. **No location/country/region anywhere.**
- **No duplicate threads:** tapping a leader you already have a thread with opens it; otherwise opens a *lazily-created* thread (the row is created server-side only on the first sent message — no ghost threads).
- Errors: deactivated leader → toast *"This leader is no longer active in the network."*; empty search → *"No leaders found matching that search."*
- **Underground safety:** the search corpus is pre-filtered — a query for an underground church's real name never matches; only the `Underground Church` label is searchable. (Verified in the prototype.)

### Screen 18 — DM Thread View · `screen-18.jsx`
- Header: back · name + church. Secure thread shows lock + literal *"Replant Team — Secure Message"*.
- Bubbles: **sent** = sky, right; **received** = `--surface2`, left; ~75% max width. Consecutive same-author bubbles tighten their inner corner. Secure (received) bubbles carry a sky left-edge so provenance reads at a glance.
- **Timestamps grouped per 5-min window** — a centered mono divider above the first message of each window, not on every bubble. Formats: `2:34 PM` (today) · `Yesterday 9:12 AM` · `Mon 4:00 PM` · `Apr 28 10:00 AM` (beyond a week).
- **Optimistic send states:** pending (bubble at 55% + *Sending* w/ clock) → sent (clears) → failed (red edge + *Not delivered · Tap to retry*). Retry re-sends.
- Composer fixed at bottom: auto-grow textarea (max ~5 lines then scrolls) + circular paper-plane send; disabled when empty.
- Pagination: scroll-to-top loads previous page (spinner), then *"Beginning of conversation"* when exhausted.
- Empty (new lazy thread): pastoral opener — *"A new, private letter."* (CONTENT to refine).
- Reconnect: inline amber pill *"Reconnecting"* — never a modal.

### Covenant Notice (first-DM gate) · `covenant.jsx`
- Shown **once, ever** — before the leader's very first DM on Connect (not per conversation). Fires on the first send attempt; requires **"I understand"** (no dismiss-without-accept). Dim-only scrim.
- **Copy is placeholder** — final wording by Content + Founder. The container/modal shape is the CD deliverable.

## Interaction contracts

```
Compose (+)  → Leader Search
Find a Leader (empty CTA) → Leader Search
Search result tapped:
  · inactive leader → toast, stay
  · existing thread → open it (no duplicate)
  · otherwise       → open lazily-created thread (server row on first send only)
Thread row tapped → Thread View
Back (Search or Thread) → Thread List
First send (covenant not yet acknowledged) → Covenant Notice → "I understand" → send proceeds
Send → optimistic pending → sent | failed(→ tap retry)
```

## React Native conversion notes

1. **Tokens → StyleSheet module.** `shared/styles.css` `:root` maps 1:1; the RN font names are in the type table above.
2. **No blur.** expo-blur is not installed — every overlay (`.scrim`, gate sheet, covenant) is solid dim rgba. Keep it that way.
3. **SVGs** in `states.jsx` (`Icon`) are hand-rolled stroke icons → `react-native-svg`.
4. **Lists:** thread list + search results → `FlatList` (25/page, scroll-to-load). Messages → inverted `FlatList` (30 on mount, load-older on reach-top).
5. **Composer:** RN `TextInput multiline` with `onContentSizeChange` for auto-grow; cap height ≈ 5 lines.
6. **Optimistic send:** append with `state:'pending'`, reconcile on ACK/timeout to `sent`/`failed`. Failed messages are **lost on navigation away at MVP** (acceptable — no cross-session persistence).
7. **Real-time:** new inbound messages append at the bottom; dropped connection shows the inline reconnect pill only.
8. **Safe areas:** header sits below the Dynamic Island; tab bar reserves the 34pt home-indicator inset (`useSafeAreaInsets`).
9. **Covenant ack** is a per-account one-time flag (server or secure local store) — gate on it globally, not per thread.

## CD decisions made in this pass (flag for review)

- **Subtitle kept, not an italic accent word** — *"Leader to leader · Held in confidence"* (mono). Reads as confidentiality, not branding.
- **Compose affordance** = rounded-square sky icon top-right of the header (matches the monogram language).
- **Monograms are rounded squares, not circles** — a sealed-letterhead read rather than a social-avatar read. Underground/anonymous use a generic figure glyph.
- **Message body is DM Sans, not serif** — serif is reserved for names/openers/covenant; sans keeps long threads legible. (Open to a serif treatment for the Replant Team's words if Founder wants the system voice to feel more "letter".)
- **Unverified gate = bottom sheet** over a dimmed (brightness 0.5) list — softer than the Persecuted hard block, per brief. One **"I understand"** dismiss.
- **Secure received bubbles** get a subtle sky left-edge (provenance cue) — not specified, added for the "secure" read. Easy to remove.

## Open questions

1. **Covenant copy** — placeholder in `covenant.jsx`; needs Content + Founder final wording and the eyebrow/heading/body split confirmed.
2. **Empty-thread opener** — *"A new, private letter."* placeholder; confirm voice.
3. **Unread badge** on the secure thread — currently shown; confirm the Replant Team thread should carry a count or just a dot.
4. **Should the secure received bubble keep the sky left-edge**, or read identically to a peer received bubble?
5. **Timestamp grouping window** — brief says 5 min; confirm that's the production threshold.
6. **Reconnect pill placement** — top of the message list vs. just above the composer.
