# Handoff: Replant — Message Request Flow (Connect Tab Addition)

> Engineering handoff for the **message request consent layer** in the Connect tab. This document is
> self-sufficient: a developer who was not in the design conversation can build the feature from this
> file alone. Pair it with the existing **Connect Tab HANDOFF.md** (§1–15) for the base system, and
> the working HTML prototype in this folder for visual reference.

---

## 1. Overview

This feature adds a **consent gate** to leader-to-leader DMs. Currently, tapping **+** and selecting
a leader from search opens an instant chat. With this change, the sender composes a message that is
delivered as a **connection request**. The recipient reads the full message inside a thread and
chooses to **accept** (opening the conversation) or **decline** (no thread is created).

The metaphor: *a quiet knock on a door — an invitation to connect, not a friend request.*

This is intentionally **lighter** than branch creation. No multi-step flow, no multi-party consent.
One leader writes a letter; one leader decides whether to open the door.

**Decision: Option B (in-thread) is the selected approach** for the recipient's view. Option A
(inline card) was explored and is preserved in the design file for reference but should **not** be
built.

Device target: **iPhone 15 Pro Max, 430 × 932 pt.** All values below are at this resolution.

---

## 2. About the design files / fidelity

The files in this bundle are **design references authored in HTML + React (Babel-in-browser)** — a
**high-fidelity** prototype showing the intended look and behavior. They are **not production code
to ship**. The task is to **recreate these designs in the target codebase** (the Replant React Native
app) using its established patterns, navigation, and libraries.

**Fidelity: high.** Colors, typography, spacing, radii, and copy are final-intent. Where this doc
gives a hex/px value, treat it as the spec. All new components reuse the existing Connect design
tokens (§4 of the Connect Tab HANDOFF.md) — no new colors, no new fonts, no new radii are introduced.

---

## 3. Flow summary

```
Leader A taps + → searches → selects Leader B (no existing thread)
  │
  ├─ 1. Composer opens with RequestNote: "This will be sent as a connection request"
  │     Leader A writes a message and sends
  │
  ├─ 2. SentRequestModal appears (covenant-card style):
  │     "Your letter is on the way." → CTA: "Back to Leaders"
  │     Dismisses → returns to Leaders list
  │
  ├─ 3. Leader A's Leaders list shows a PendingRow:
  │     Dashed monogram · "PENDING" tag · italic "Awaiting their reply"
  │     Row is NOT tappable while pending
  │
  ├─ 4. Leader B's Leaders list shows an unread row (request thread)
  │     Tapping opens the thread (Option B — in-thread):
  │       System label: "CONNECTION REQUEST · {time}"
  │       Leader A's message as a received bubble
  │       RequestActionsBar: "Accept this conversation?" → Accept / Decline
  │       Locked composer: "Reply opens when you accept"
  │
  ├─ IF ACCEPTED:
  │   ├─ 5. Thread opens normally for both leaders
  │   │     System message at top: "[Name] accepted your request"
  │   │     Full composer unlocked — conversation proceeds
  │   └─ Sender's PendingRow becomes a normal active thread row
  │
  └─ IF DECLINED:
      ├─ 6. Sender's PendingRow updates to DeclinedRow:
      │     "Declined your invitation to connect." + "REMOVE" link
      │     Row is NOT tappable — no drill-in
      │     Tapping into the declined thread shows: "Keep them in your prayers."
      └─ Server deletes the pending record; no thread is created
```

---

## 4. New components — full RN StyleSheet specs

All tokens reference the existing Connect palette (§4 of Connect Tab HANDOFF.md). For convenience:
- `--bg`: `#080808`
- `--surface`: `#111111`
- `--surface2`: `#181818`
- `--text`: `#F0EDE6`
- `--muted`: `rgba(240,237,230,0.45)`
- `--subtle`: `rgba(240,237,230,0.25)`
- `--sky`: `#6BB5E8`
- `--sky-mid`: `rgba(107,181,232,0.35)`
- `--sky-dim`: `rgba(107,181,232,0.08)`
- `--border`: `rgba(240,237,230,0.08)`
- `--border-2`: `rgba(240,237,230,0.14)`

---

### 4.1 RequestNote (composer inline notice)

A single-line contextual notice positioned **inside the composer zone**, between the CovenantStrip
and the text input row. Shown only when composing a message to an **unconnected** leader.

```
┌──────────────────────────────────────┐
│         CovenantStrip (existing)      │
├──────────────────────────────────────┤
│  ✉  This will be sent as a           │  ← RequestNote
│     connection request                │
├──────────────────────────────────────┤
│  📎  [ Write a message        ]  ➤   │  ← Composer (existing)
└──────────────────────────────────────┘
```

**StyleSheet:**
```js
container: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  paddingVertical: 9,
  paddingHorizontal: 18,
  backgroundColor: 'rgba(8,8,8,0.96)',
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(240,237,230,0.08)',  // --border
},
icon: {
  width: 13,
  height: 13,
  color: '#6BB5E8',  // --sky
  opacity: 0.6,
},
label: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 11,
  color: '#6BB5E8',  // --sky
  letterSpacing: 0.06,
},
```

**Icon:** Simple envelope/sealed-letter glyph (stroke, 1.4 weight). SVG:
```xml
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
     stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="5" width="18" height="14" rx="2"/>
  <path d="M3 5l9 7 9-7"/>
</svg>
```

**Behavior:**
- Shown when the recipient leader has **no existing accepted connection** with the sender.
- When the note is removed (post-connection), the composer's default `borderTop` is restored.
- The note does not affect the composer's text input behavior.

---

### 4.2 SentRequestModal (covenant-card variant)

A centered modal overlay that appears after the sender taps Send on a connection request. Matches
the existing Covenant Notice card (§6.4) in structure and style.

**StyleSheet:**
```js
scrim: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(4,4,4,0.74)',
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 34,
},
card: {
  width: '100%',
  maxWidth: 360,
  backgroundColor: '#111111',       // --surface
  borderWidth: 0.5,
  borderColor: 'rgba(240,237,230,0.14)',  // --border-2
  borderRadius: 18,
  paddingTop: 30,
  paddingHorizontal: 26,
  paddingBottom: 24,
  alignItems: 'center',
},
seal: {
  width: 48,
  height: 48,
  borderRadius: 14,
  borderWidth: 0.5,
  borderColor: 'rgba(107,181,232,0.35)',  // --sky-mid
  backgroundColor: 'rgba(107,181,232,0.08)',  // --sky-dim
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 20,
},
sealIcon: {
  // same envelope icon, 22×22, --sky
  width: 22,
  height: 22,
  color: '#6BB5E8',
},
eyebrow: {
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 2.34,
  textTransform: 'uppercase',
  color: '#6BB5E8',  // --sky
  marginBottom: 14,
},
heading: {
  fontFamily: 'CormorantGaramond_400Regular',
  fontSize: 24,
  lineHeight: 30,
  color: '#F0EDE6',  // --text
  textAlign: 'center',
  marginBottom: 14,
},
body: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  lineHeight: 22,
  color: 'rgba(240,237,230,0.45)',  // --muted
  textAlign: 'center',
  marginBottom: 22,
},
bodyName: {
  fontFamily: 'DMSans_500Medium',
  color: '#F0EDE6',  // --text
},
cta: {
  // btn-primary, width: '100%'
  // see existing btn-primary spec in Connect Tab HANDOFF §5
},
```

**Copy (verbatim):**
- Eyebrow: `"REQUEST SENT"`
- Heading: `"Your letter is on the way."`
- Body: `"Your message request to **[Name]** has been sent. If they accept, your conversation will appear here."`
- CTA: `"Back to Leaders"`

**Animation:**
- Enter: `translateY(12) + scale(0.98) → translateY(0) + scale(1)`, 260ms, `cubic-bezier(.32,.72,0,1)`.
- Dismiss: CTA tap only (no tap-outside dismiss). CTA navigates back to the Leaders list.

---

### 4.3 PendingRow (thread-row variant — sender's Leaders list)

While a request is awaiting response, the sender sees a modified thread row.

**Visual differences from a standard thread row:**
```js
monogram: {
  opacity: 0.55,
  borderStyle: 'dashed',
  // all other monogram properties inherit from standard monogram (§6.1)
},
pendingTag: {
  fontFamily: 'DMMono_400Regular',
  fontSize: 8,
  letterSpacing: 1.28,
  textTransform: 'uppercase',
  color: '#6BB5E8',  // --sky
  borderWidth: 0.5,
  borderColor: 'rgba(107,181,232,0.35)',  // --sky-mid
  borderRadius: 4,
  paddingVertical: 2,
  paddingHorizontal: 5,
},
preview: {
  color: 'rgba(240,237,230,0.25)',  // --subtle
  fontStyle: 'italic',
  // text: "Awaiting their reply"
},
```

**Behavior:**
- Row is **not tappable** — no drill-in while pending.
- Pending rows sort by **sent time**, below active/unread threads, above declined rows.
- No unread badge (nothing to read yet).

---

### 4.4 RequestActionsBar (Option B — in-thread recipient view)

When the recipient taps on the request row, the thread opens. The sender's message renders as a
received bubble. Above the locked composer, an action bar presents Accept/Decline.

**Layout (top to bottom):**
```
┌──────────────────────────────────────┐
│  ← Pastor Daniel Osei                │  thread-head (existing)
│    CORNERSTONE FELLOWSHIP             │
├──────────────────────────────────────┤
│   CONNECTION REQUEST · 2:14 PM        │  branch-event (existing style §7.3)
│                                       │
│  ┌─────────────────────────────┐     │
│  │ Brother, I wanted to reach  │     │  received bubble (existing)
│  │ out about the regional...   │     │
│  └─────────────────────────────┘     │
│                                       │
├──────────────────────────────────────┤
│       Accept this conversation?       │  RequestActionsBar
│    [ Decline ]  [    Accept    ]      │
├──────────────────────────────────────┤
│   🔒 Protected within the network    │  CovenantStrip (existing)
├──────────────────────────────────────┤
│  [ Reply opens when you accept ] ➤   │  Locked composer (existing pattern)
└──────────────────────────────────────┘
```

**StyleSheet — RequestActionsBar:**
```js
bar: {
  paddingVertical: 14,
  paddingHorizontal: 18,
  backgroundColor: '#111111',  // --surface
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(240,237,230,0.08)',  // --border
  alignItems: 'center',
},
label: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 12,
  color: 'rgba(240,237,230,0.45)',  // --muted
  textAlign: 'center',
  marginBottom: 12,
},
buttons: {
  flexDirection: 'row',
  gap: 8,
},
declineBtn: {
  flex: 1,
  // btn-quiet style (existing)
},
acceptBtn: {
  flex: 1.4,
  // btn-primary style (existing)
},
```

**System label (above the message):**
```js
systemLabel: {
  // Reuses existing branch-event style (§7.3):
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 0.9,
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)',  // --subtle
  alignSelf: 'center',
  marginTop: 14,
  // Copy: "CONNECTION REQUEST · {time}"
},
```

**Locked composer:**
- Identical to the branch "forming" locked composer (§7.3 of Connect Tab HANDOFF).
- Note text: `"Reply opens when you accept"`
- Send button: disabled state.

---

### 4.5 DeclinedRow (thread-row variant — sender's Leaders list)

When the recipient declines, the sender's pending row updates to a declined state.

**StyleSheet:**
```js
row: {
  opacity: 0.72,
  // not tappable from the list — no drill-in
},
monogram: {
  opacity: 0.4,
  // all other monogram properties inherit standard
},
name: {
  color: 'rgba(240,237,230,0.45)',  // --muted (dimmed from standard --text)
},
declineText: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 12.5,
  lineHeight: 19,
  color: 'rgba(240,237,230,0.45)',  // --muted
  marginTop: 5,
  // Copy: "Declined your invitation to connect."
},
removeLink: {
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 1.26,
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)',  // --subtle
  hitSlop: { top: 8, bottom: 8, left: 12, right: 12 },
},
```

**Copy:**
- In list row: `"Declined your invitation to connect."`
- Inside the declined thread (if tapped into): `"Keep them in your prayers."` (serif italic, `--subtle`)

**"Remove" affordance:**
- Positioned in the right column, below the timestamp.
- Copy: `"REMOVE"` (mono, uppercase)
- Tap removes the declined row from the list (server deletes the pending record).
- Also removable via **swipe-to-dismiss**.
- Row **auto-dismisses after 48 hours** if not manually removed.

---

### 4.6 AcceptSystemMessage (in-thread)

When the recipient accepts, the thread opens normally for both parties. A system message at the
very top of the message list confirms the connection.

**StyleSheet:**
```js
event: {
  // Reuses existing branch-event style (§7.3):
  alignSelf: 'center',
  textAlign: 'center',
  maxWidth: '84%',
  marginVertical: 8,
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 0.9,
  textTransform: 'uppercase',
  lineHeight: 14,
  color: 'rgba(240,237,230,0.25)',  // --subtle
},
```

**Copy:** `"[Name] accepted your request"`

**Behavior:**
- Positioned as the **first element** in the message list (above the sender's original message).
- Thread opens normally after acceptance — full composer, no locked state, no request actions bar.
- The sender's PendingRow in the Leaders list transitions to a standard active thread row.

---

### 4.7 EmptyState (approved DM copy — unchanged)

The post-connection empty state for an accepted DM thread with no messages yet. **Already approved
and specified in the Connect Tab HANDOFF (§6.3).** Confirmed to render cleanly in the request-flow
context.

```js
glyph: {
  // Lock icon, 22×24, --sky, opacity 0.7
},
title: {
  fontFamily: 'CormorantGaramond_300Light',
  fontStyle: 'italic',
  fontSize: 20,
  lineHeight: 29,
  color: '#F0EDE6',
  // "A letter to a fellow leader."
},
sub: {
  fontFamily: 'DMSans_400Regular',
  fontSize: 12.5,
  lineHeight: 20,
  color: 'rgba(240,237,230,0.45)',
  maxWidth: 240,
  // "Let your words be with grace."
},
verse: {
  fontFamily: 'CormorantGaramond_300Light',
  fontStyle: 'italic',
  fontSize: 15,
  lineHeight: 23,
  color: 'rgba(240,237,230,0.45)',
  maxWidth: 260,
  marginTop: 16,
  // "For where two or three gather in my name, there am I with them."
},
ref: {
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 1.98,
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)',
  marginTop: 8,
  // "MATTHEW 18:20"
},
```

**Note:** The **pre-connection** empty state (Frame 1) uses different copy:
- Title: `"A new, private letter."`
- Sub: `"Say what is on your heart to begin. Only the two of you will read it."`

---

## 5. State model additions

```ts
// Extend the existing Thread type:
type ConnectionStatus = 'none' | 'pending' | 'accepted' | 'declined';

type Thread = {
  id: string;
  system?: boolean;
  leaderId?: string;
  preview: string;
  lastAt: Date;
  unread: number;
  connectionStatus: ConnectionStatus;  // NEW — default 'accepted' for existing threads
};

// New type for pending/incoming requests:
type ConnectionRequest = {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  sentAt: Date;
  status: 'pending' | 'accepted' | 'declined';
};
```

**State transitions:**
```
Sender sends message to unconnected leader
  → Request created: status = 'pending'
  → Sender sees: PendingRow in Leaders list
  → Recipient sees: unread row in Leaders list

Recipient accepts:
  → Request status → 'accepted'
  → Thread created with connectionStatus = 'accepted'
  → System message: "[Name] accepted your request"
  → Sender's PendingRow → standard active thread row
  → Full composer unlocked for both

Recipient declines:
  → Request status → 'declined'
  → No thread created
  → Sender's PendingRow → DeclinedRow
  → DeclinedRow auto-expires after 48h or manual remove
```

---

## 6. Interaction & behavior contracts

- **Existing Covenant Notice still fires first.** If this is the sender's very first DM ever, the
  Covenant Notice (§6.4) fires on send attempt **before** the request is dispatched. Once
  acknowledged, the request proceeds. The Covenant Notice is per-account, not per-request.

- **One active request per pair.** A leader cannot send a second request to someone who already has
  a pending request from them. The composer note should not appear for already-connected leaders.

- **Declined leaders can be re-requested.** After a declined row is removed (manually or via 48h
  expiry), the sender can search and send a new request. No cooldown (trust the leaders).

- **Request messages are plain text only.** Same constraints as existing DMs: no links, no
  attachments, no media. The message is delivered as a standard received bubble.

- **No notification sound distinction.** Connection requests use the same push notification
  channel as DMs. The notification copy should read: *"[Name] sent you a connection request."*

- **Pending rows do not count toward the unread badge.** Only accepted, unread threads count.

- **The request flow should feel lighter than branch creation.** No multi-step wizard, no
  multi-party consent, no forming state. One message, one decision.

---

## 7. Sort order (Leaders list, updated)

```
1. Replant Team secure thread (always pinned first)
2. Active threads with unread messages (by last_message_at DESC)
3. Active threads, read (by last_message_at DESC)
4. Pending request rows (by sent_at DESC)
5. Declined request rows (by declined_at DESC, auto-expire after 48h)
```

---

## 8. Files in this bundle

```
Replant - Message Request Flow.html   ← open to preview all frames
REQUEST-FLOW-HANDOFF.md               ← this engineering spec
request-flow/
  frames.jsx       all 8 screen frames as static React components
  app.jsx          page layout, spec blocks, recommendation callout, render
  styles.css       new component CSS (imports connect-tab/styles.css chain)

Dependencies (existing, in parent folder):
  connect-tab/
    states.jsx     Icon, TabBar, CovenantFooter, CovenantStrip, Monogram, etc.
    data.jsx       mock data + display-name helpers
    styles.css     base component CSS → imports shared/styles.css
    rp-mark.svg    Replant mark
  shared/
    styles.css     design tokens + app scaffold
```

---

## 9. Frames index (design reference)

| Frame | Screen | Description |
|---|---|---|
| 1 | Composer with request note | DM composer for unconnected leader, RequestNote above input |
| 2 | Sent request confirmation | Modal overlay after send, "Your letter is on the way" |
| 3 | Pending row (sender's list) | Leaders list with dashed-monogram PendingRow |
| 4A | Option A — inline card | *(Not selected — reference only)* Card in recipient's list |
| 4B | Option B — in-thread | *(Selected)* Recipient opens thread, reads message, Accept/Decline |
| 5 | Decline notice (sender's list) | DeclinedRow with "Remove" affordance |
| 6 | Accept — system message | Thread opens normally, system message at top |
| 7 | Empty state (approved) | Post-connection empty DM, Matthew 18:20 |

---

## 10. What is NOT changing

- No modifications to any existing Connect surface (Leaders list, DM thread, search, branch, etc.)
- No new colors, fonts, or design tokens
- No changes to the Covenant Notice, CovenantStrip, or CovenantFooter
- No changes to the tab bar, header, or segmented control
- The existing empty state copy (Matthew 18:20) is approved as-is
- Branch creation flow is unaffected — this is Leaders-only

---

## 11. Open questions

- **Re-request cooldown:** Currently no cooldown after a decline. Should there be a minimum interval
  (e.g., 30 days) before a leader can re-request the same person?
- **Notification copy:** Exact push notification text for incoming requests — should it preview
  the message body or just say "[Name] sent you a connection request"?
- **Declined thread drill-in:** The "Keep them in your prayers" copy shows if the sender taps into
  a declined thread. Should the thread be tappable at all, or strictly list-only?
- **Request expiry:** Should pending requests expire after a period (e.g., 30 days with no
  response)? If so, what does the sender see?
- **Block after decline:** Should declining a request offer an option to prevent future requests
  from that leader? (Heavier feature — likely post-MVP.)
