# Handoff: Replant — Message Request Flow (Connect Tab Addendum)

> Engineering handoff for the **message request gate** on Connect. This is an **addendum** to the
> main Connect Tab handoff (`HANDOFF.md`). All existing Connect surfaces are unchanged — this
> document covers **only the new states and components** for the connection-request consent layer.
> Pair it with the working HTML reference `Replant - Message Request Flow.html`.

---

## 1. Overview

Right now, when a leader taps the compose affordance and selects someone from search, they get
instant access to a DM thread. This feature adds a **consent layer**: leaders send a **connection
request** first; the other leader **accepts or declines** before a thread opens.

**Guiding metaphor:** a quiet knock on a door — lighter than branch creation, faith-saturated, not
tech-startup. The language is *"invitation to connect,"* never *"friend request."*

**Decision:** the recipient sees the request **in-thread** (Option B in the design file). The
inline-card option (4A) was explored and is in the design file for reference, but **Option B is the
approved direction.** See §5 for the rationale.

Device target: **iPhone 15 Pro Max, 430 × 932 pt.** All values at this resolution.

---

## 2. Information architecture delta

The request flow **inserts into the existing Leaders sub-tab navigation** — no new screens or tabs.
The changes are gated states within the existing thread-list and thread-view surfaces.

```
Leaders sub-tab (existing)
├─ Thread list (Screen 16)
│   ├─ [NEW] Pending row (connection request sent, awaiting reply)
│   ├─ [NEW] Declined row (request was declined + "Remove" affordance)
│   └─ Active thread rows (unchanged)
│
├─ Leader search / new DM (Screen 17) — unchanged
│
└─ DM thread view (Screen 18)
    ├─ [NEW] Pre-connection state:
    │   ├─ RequestNote inside composer zone
    │   └─ SentRequestModal (one-time, after first message send)
    │
    ├─ [NEW] Recipient view (unconnected thread):
    │   ├─ Sender's message as a received bubble
    │   ├─ RequestActionsBar (Accept / Decline)
    │   └─ Locked composer ("Reply opens when you accept")
    │
    ├─ [NEW] Post-acceptance: system message at top of thread
    │   └─ "[Name] accepted your request." (branch-event style)
    │
    └─ [NEW] Post-connection empty state (approved copy):
        └─ Matthew 18:20 + "A letter to a fellow leader."
```

---

## 3. New components — full RN StyleSheet specs

All values are final-intent. Hex values are absolute, not token references — the corresponding
token names from `HANDOFF.md §4` are noted where helpful.

### 3.1 RequestNote (composer inline notice)

A small, centered notice inside the composer zone — sits between the CovenantStrip and the text
field. Shown **only** when composing to an **unconnected** leader. Removed once the connection is
accepted.

```js
// container
{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  paddingVertical: 9,
  paddingHorizontal: 18,
  backgroundColor: 'rgba(8,8,8,0.96)',    // matches composer bg
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(240,237,230,0.08)', // --border
}

// icon (envelope SVG — react-native-svg)
{
  width: 13,
  height: 13,
  color: '#6BB5E8',   // --sky
  opacity: 0.6,
}

// label
{
  fontFamily: 'DMSans_400Regular',
  fontSize: 11,
  color: '#6BB5E8',   // --sky
  letterSpacing: 0.06,
}
```

**Copy:** *"This will be sent as a connection request"*

**Behavior:** When the RequestNote is present, the composer's own `borderTopWidth` is removed (the
note's container provides it). Removing the note restores the composer's default border.

### 3.2 SentRequestModal (covenant-card variant)

After the leader sends their first message to an unconnected leader, a centered modal confirms the
request. **Matches the Covenant Notice card exactly** (HANDOFF.md §6.4) — same card, seal,
typography, and animation. The only differences are content and icon.

```js
// scrim
{
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(4,4,4,0.74)',
}

// card
{
  width: '100%',
  maxWidth: 360,
  backgroundColor: '#111111',              // --surface
  borderWidth: 0.5,
  borderColor: 'rgba(240,237,230,0.14)',   // --border-2
  borderRadius: 18,
  paddingTop: 30,
  paddingHorizontal: 26,
  paddingBottom: 24,
  alignItems: 'center',
}

// seal (envelope icon inside)
{
  width: 48,
  height: 48,
  borderRadius: 14,
  borderWidth: 0.5,
  borderColor: 'rgba(107,181,232,0.35)',   // --sky-mid
  backgroundColor: 'rgba(107,181,232,0.08)', // --sky-dim
  marginBottom: 20,
}

// eyebrow — "REQUEST SENT"
{
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 2.34,     // 0.26em × 9
  textTransform: 'uppercase',
  color: '#6BB5E8',        // --sky
  marginBottom: 14,
}

// heading — "Your letter is on the way."
{
  fontFamily: 'CormorantGaramond_400Regular',
  fontSize: 24,
  lineHeight: 30,
  color: '#F0EDE6',        // --text
  marginBottom: 14,
}

// body
{
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  lineHeight: 22,          // 1.7 × 13
  color: 'rgba(240,237,230,0.45)', // --muted
  marginBottom: 22,
}

// body — recipient name (bold span)
{
  fontFamily: 'DMSans_500Medium',
  color: '#F0EDE6',        // --text
}

// CTA — "Back to Leaders"
// Standard btn-primary (HANDOFF.md §shared), width: '100%'
```

**Copy:** *"Your message request to **[Name]** has been sent. If they accept, your conversation
will appear here."*

**Animation:** Card enters with `translateY(12) + scale(0.98) → identity`, 260ms
`cubic-bezier(.32,.72,0,1)`. Scrim fades in 200ms ease. **Dismiss: CTA only** (not backdrop tap).

### 3.3 PendingTag + PendingRow (sender's Leaders list)

While awaiting a response, the sender's Leaders list shows a **pending row** — visually distinct
from active/unread thread rows.

```js
// PendingTag (inline badge on the name line)
{
  fontFamily: 'DMMono_400Regular',
  fontSize: 8,
  letterSpacing: 1.28,     // 0.16em × 8
  textTransform: 'uppercase',
  color: '#6BB5E8',        // --sky
  borderWidth: 0.5,
  borderColor: 'rgba(107,181,232,0.35)', // --sky-mid
  borderRadius: 4,
  paddingVertical: 2,
  paddingHorizontal: 5,
}

// PendingRow — monogram treatment
{
  opacity: 0.55,
  borderStyle: 'dashed',
  // all other monogram properties unchanged (40×40, radius 11, etc.)
}

// PendingRow — preview text
{
  color: 'rgba(240,237,230,0.25)', // --subtle
  fontStyle: 'italic',
}
```

**Copy:** preview reads *"Awaiting their reply"*

**Behavior:**
- Row is **not tappable** — no drill-in while pending.
- Pending rows sort by sent time, **below active threads, above declined.**
- The pending row transitions to a **declined row** (§3.4) or an **active thread row** on
  resolution.

### 3.4 DeclinedRow + RemoveLink (sender's Leaders list)

When the recipient declines, the pending row transforms into a declined row. Gentle — dimmed
monogram, muted name, single-line decline text. A "Remove" affordance lets the sender dismiss it.

```js
// row container
{
  opacity: 0.72,
  // not tappable — no drill-in
}

// monogram
{
  opacity: 0.4,
  // rest inherits standard monogram
}

// name
{
  color: 'rgba(240,237,230,0.45)', // --muted (overrides --text)
}

// decline text
{
  fontFamily: 'DMSans_400Regular',
  fontSize: 12.5,
  lineHeight: 19,
  color: 'rgba(240,237,230,0.45)', // --muted
  marginTop: 5,
}

// "Remove" link (right column, below timestamp)
{
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 1.26,     // 0.14em × 9
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)', // --subtle
  hitSlop: { top: 8, bottom: 8, left: 12, right: 12 },
}
```

**Copy:** *"Declined your invitation to connect."* (row preview)
*"Keep them in your prayers."* — shown only if the user taps into the declined thread, **not** in
the list row.

**Behavior:**
- Tap "Remove" → deletes the declined row from the list (server deletes the pending record; no
  thread is created).
- Also removable via **swipe-to-dismiss**.
- Auto-dismisses after **48 hours** if not manually removed.
- Copy tone: gentle, prayerful — no red, no harsh language.

### 3.5 RequestActionsBar (recipient's in-thread view — Option B)

When the recipient taps the request row, a thread opens showing the sender's message as a received
bubble. Above the locked composer, a **RequestActionsBar** presents Accept and Decline.

```js
// bar container
{
  paddingVertical: 14,
  paddingHorizontal: 18,
  backgroundColor: '#111111',              // --surface
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: 'rgba(240,237,230,0.08)', // --border
  alignItems: 'center',
}

// label — "Accept this conversation?"
{
  fontFamily: 'DMSans_400Regular',
  fontSize: 12,
  color: 'rgba(240,237,230,0.45)', // --muted
  marginBottom: 12,
}

// buttons — flex row, gap: 8
// Decline: btn-quiet, flex: 1
// Accept:  btn-primary, flex: 1.4
```

**System label** at the top of the message list (above the sender's bubble):
*"CONNECTION REQUEST · {time}"* — uses **branch-event style** (HANDOFF.md §7.3):
```js
{
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 0.9,
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)', // --subtle
  alignSelf: 'center',
}
```

**Locked composer** — identical to the branch forming locked composer (HANDOFF.md §7.3):
Copy: *"Reply opens when you accept"* + disabled send button.

### 3.6 AcceptSystemMessage (thread view)

When the recipient accepts, the thread opens normally. A **system message** at the very top of the
message list confirms the connection.

```js
// matches branch-event style exactly (HANDOFF.md §7.3)
{
  alignSelf: 'center',
  textAlign: 'center',
  maxWidth: '84%',
  marginVertical: 8,
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 0.9,
  textTransform: 'uppercase',
  lineHeight: 14,
  color: 'rgba(240,237,230,0.25)', // --subtle
}
```

**Copy:** *"[Name] accepted your request."*

Positioned as the **first element** in the message list (above the sender's original message).
Thread opens normally after acceptance — full composer, no locked state.

### 3.7 EmptyState (approved DM copy — post-connection)

The empty state for an **accepted DM thread** with no messages yet (distinct from the
pre-connection empty in Frame 1).

```js
// glyph — lock icon
{
  width: 22,
  height: 24,
  color: '#6BB5E8',  // --sky
  opacity: 0.7,
}

// title — "A letter to a fellow leader."
{
  fontFamily: 'CormorantGaramond_300Light',
  fontStyle: 'italic',
  fontSize: 20,
  lineHeight: 29,
  color: '#F0EDE6',  // --text
}

// sub — "Let your words be with grace."
{
  fontFamily: 'DMSans_400Regular',
  fontSize: 12.5,
  lineHeight: 20,
  color: 'rgba(240,237,230,0.45)', // --muted
  maxWidth: 240,
}

// verse — Matthew 18:20
{
  fontFamily: 'CormorantGaramond_300Light',
  fontStyle: 'italic',
  fontSize: 15,
  lineHeight: 23,
  color: 'rgba(240,237,230,0.45)', // --muted
  maxWidth: 260,
  marginTop: 16,
}

// reference — "MATTHEW 18:20"
{
  fontFamily: 'DMMono_400Regular',
  fontSize: 9,
  letterSpacing: 1.98,  // 0.22em × 9
  textTransform: 'uppercase',
  color: 'rgba(240,237,230,0.25)', // --subtle
  marginTop: 8,
}
```

**Copy (verbatim):**
- *"A letter to a fellow leader."*
- *"Let your words be with grace."*
- *"For where two or three gather in my name, there am I with them."*
- Matthew 18:20

---

## 4. State model delta

```ts
// New fields on the Thread type:
type Thread = {
  // ... existing fields from HANDOFF.md §9 ...
  connectionStatus?: 'none' | 'pending' | 'declined' | 'accepted';
  // 'none' = no request sent (new search result, no thread yet)
  // 'pending' = request sent, awaiting recipient response
  // 'declined' = recipient declined
  // 'accepted' = connected — thread behaves normally
};

// For the recipient, the incoming request surfaces as a thread with:
type IncomingRequest = {
  threadId: string;
  senderId: string;
  senderName: string;
  senderChurch: string;
  message: string;           // the sender's first message
  sentAt: string;            // ISO timestamp
  connectionStatus: 'incoming'; // distinguishes from 'pending' (sender's view)
};
```

### Display rules

| `connectionStatus` | Sender's list | Recipient's list | Thread view |
|---|---|---|---|
| `none` | — | — | RequestNote in composer |
| `pending` | PendingRow (dashed mono, PENDING tag, italic preview) | — | — |
| `incoming` | — | Unread row (taps into request thread) | RequestActionsBar + locked composer |
| `declined` | DeclinedRow (dimmed, REMOVE link) | — | *"Keep them in your prayers."* if tapped |
| `accepted` | Normal thread row | Normal thread row | System message + full composer |

---

## 5. Decision: Option B (In-Thread) — rationale

Both options were designed at full fidelity (Frames 4A and 4B in the HTML reference). **Option B
(in-thread) is the approved direction.** Rationale:

1. **Consistent with the sealed-letter metaphor.** A connection request is a letter — the recipient
   opens it, reads the full message, and decides whether to respond. Opening the thread before
   deciding is the physical model.
2. **Full message context.** The recipient reads the complete message in a proper thread context,
   not a truncated card preview.
3. **Pattern reuse.** The locked composer + action bar mirrors the existing "forming" branch
   pattern, reducing new visual components and cognitive overhead.
4. **Quieter.** An unread row that opens into a thread is less visually heavy than a card in the
   list — more "knock on a door," less notification.
5. **Gracious decision.** Declining from within the thread (after reading the full letter) is more
   considered and respectful than declining from a glanced-at card.

---

## 6. Interaction & behavior contracts

- **First message to an unconnected leader** → RequestNote visible in composer → message sends →
  SentRequestModal appears → "Back to Leaders" returns to list → PendingRow visible.
- **Recipient opens the request thread** → sees sender's message as a received bubble →
  "CONNECTION REQUEST · {time}" label → RequestActionsBar (Accept / Decline) → locked composer.
- **Accept** → thread converts to a normal active thread → system message *"[Name] accepted your
  request"* appears at top → full composer unlocked → both leaders can message freely.
- **Decline** → sender's PendingRow becomes DeclinedRow → preview: *"Declined your invitation to
  connect."* → "Remove" link in right column → auto-dismiss after 48h.
- **Remove (sender action)** → declined row removed from list → server deletes the pending record
  → no thread is created.
- **No re-request throttle at MVP.** A sender can send another request after removal/decline. (A
  cooldown period is a post-MVP discussion.)
- **Covenant Notice** still fires on the leader's first-ever DM attempt (per HANDOFF.md §6.4),
  **before** the request flow. The request note appears after the covenant is acknowledged.
- **No duplicate requests.** If a pending request exists for a leader, tapping them in search opens
  the pending state (not a new compose).

---

## 7. Files in this bundle

```
Replant - Message Request Flow.html   ← open to preview all frames
HANDOFF-REQUEST-FLOW.md               ← this engineering spec (addendum)
request-flow/
  app.jsx          page layout, spec blocks, recommendation, render
  frames.jsx       all 8 static phone frames (PhoneBezel + screen content)
  styles.css       new component CSS (imports connect-tab/styles.css)
```

**Dependencies** (loaded from the existing Connect Tab bundle):
```
connect-tab/
  data.jsx         mock data + display-name helpers
  states.jsx       Icon set, Monogram, TabBar, CovenantFooter/Strip, shared states
  styles.css       existing Connect component CSS
  rp-mark.svg      Replant mark
shared/
  styles.css       design tokens + app scaffold
```

---

## 8. Open questions

- **Re-request cooldown.** Should there be a waiting period after a decline before the sender can
  request again? (Not in MVP.)
- **Decline confirmation.** Should the recipient see a confirmation modal before declining (like the
  branch decline-confirm), or is the single tap sufficient? The current design is single-tap.
- **Notification.** Does the recipient get a push notification for an incoming request? (Depends on
  the notification system — not in scope here.)
- **Request expiry.** Do pending requests expire after N days of no response? (Post-MVP.)
- **Block / report.** If a leader repeatedly sends unwanted requests, is there a block mechanism?
  (Post-MVP, separate feature.)
- **"Keep them in your prayers" detail view.** The prayerful close shows only if the sender taps
  into the declined thread. Should there be anything else in that view, or just the message +
  prayer line? (Content decision.)
