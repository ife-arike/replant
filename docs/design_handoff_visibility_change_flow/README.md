# Visibility-Change Flow — Mobile CD · KAN-274

Concept Direction for the six mobile surfaces that let an **already-verified
underground leader** change their church between **Hidden** and **Visible** in
the network. Because that flip is exactly the moment an adversary would want to
forge — a hijacked session, a coerced leader — it can't be a toggle. It routes
through a **scheduled confirmation call** with the admin team and a **4-digit
code the leader speaks aloud**, with a duress channel hidden in how the code is
read.

Built on the **live** `constants/theme.ts` tokens (mirrored verbatim as CSS
custom properties on `.rp`), the iPhone Pro Max device frame, and the doc chrome
shared with prior Replant CDs. **No new tokens.** UG leaders only — these screens
do not render for regular churches at all.

> **`preview/index.html` is the source of truth** for visual + interaction
> intent. Open it and use each **View as** control: Surface 01 switches the
> leader's current state (Hidden / Visible / Call scheduled); Surface 05 walks
> the active-call states (revealed / over-shoulder hide / idle timeout / admin
> delayed / validating) — the Hide-code button and tap-to-reveal are live on the
> device. `source/*.tsx` are spec scaffolds — lift the structure + tokens; wire
> the real Supabase / expo-screen-capture / expo-secure-store calls.

---

## What I could / couldn't access

- ✅ Read every file in the mandatory list: `SettingsScreen.tsx`,
  `NameVisibilityChoiceScreen.tsx`, `VisibilityFlipModal.tsx`,
  `RootNavigator.tsx`, `AuthProvider.tsx`, `constants/theme.ts`, `App.tsx`, and
  the admin-side `VisibilityOverrideModal.jsx` + `globals.css` tokens.
- ✅ The flow's stylesheets (`flow-screens.css`, `flow-chrome.css`) were already
  scaffolded for this ticket; the deliverable assembles them into the CD doc plus
  the interaction layer (`flow.js`) and the RN source specs.
- ⚠️ The confirmation-call **transport** (phone vs in-app voice vs dialed link)
  is not settled in the brief — surfaced as open questions Q2/Q3. The CD assumes
  a plain phone call and shows no channel UI; if that changes, the lobby + active
  screens gain a channel line.

---

## The six surfaces

| # | Surface | Component | Where it lives |
|---|---|---|---|
| 01 | Entry affordance | `ChurchVisibilityRow` | Inside `SettingsScreen`'s `'church'` section |
| 02 | Schedule picker | `VisibilityChangeScheduleScreen` | First card of `VisibilityChangeStack` |
| 03 | Safety briefing (one-shot) | `FirstCallSafetyBriefing` | Between lobby "I'm ready" and active, first call only |
| 04 | Lobby | `VisibilityChangeLobbyScreen` | Off root, surfaces at T-15 |
| 05 | Active (code) | `VisibilityChangeActiveScreen` | Off root, during the call |
| 06 | Complete | `VisibilityChangeCompleteScreen` | Terminal outcome |

`VisibilityChangeStack` mounts **off root** (not under tabs), beside
`JoinCodeReveal` in `RootNavigator` — the leader is never logged out to reach it.

---

## State machine

```
pending → revealed → in_call → validated | expired | failed
```

- **pending** — leader scheduled a window; admin hasn't claimed the slot.
- **revealed** — admin claimed; T-15 reached; leader opened the lobby.
- **in_call** — leader tapped "I'm ready"; admin dialed; code is on screen.
- **validated** — admin entered the correct (or reversed-duress) code; flip lands.
- **expired** — TTL elapsed without validation; force re-mint via a new window.
- **failed** — too many wrong attempts; admin re-mints. Leader sees only the
  terminal outcome, never the attempt count.

`ChurchVisibilityRow` reads `visibilityChangeRequest` from `AuthProvider` to
pick its idle ↔ scheduled face. The T-15 silent push flips `pending → revealed`
and the lobby presents off root.

---

## Coordination (hybrid leader-initiated)

1. Leader requests the change from Settings → picks a safe 2-hour window.
2. Admin claims the slot.
3. Silent data push at **T-15min**.
4. Leader opens app → **lobby** surfaces → taps **I'm ready** to pre-arm.
5. Code mints **only after** the pre-arm; admin dials.
6. Leader reads the code aloud — **forward = normal, reversed = duress**.
7. Admin types it in the dashboard (`VisibilityOverrideModal`); BE validates.
8. Push fires → **complete** screen shows the locked endgame copy.

The pre-arm gate means the code never exists on screen while the phone is in
someone else's hand.

---

## Security floor (active screen — non-negotiable)

- `expo-screen-capture` `preventScreenCaptureAsync()` on focus — blocks Android
  screenshots; iOS renders blank in the app-switcher. Released on blur.
- **90-second idle** drops the plaintext to `••••`; tap-to-reveal.
- Persistent **Hide code** target (large, top-right) — one-tap blank for
  over-shoulder defense, independent of the idle timer.
- Token **never** persisted to `AsyncStorage`; only an encrypted
  `expo-secure-store` entry, 30-min TTL, for force-quit recovery.
- **No copy-to-clipboard** affordance anywhere.
- Token cleared on blur, app-background, and TTL.
- **No back-out mid-call**: `beforeRemove` blocks the gesture; Android hardware
  back intercepted while `status === 'in_call'`.

## Duress via social convention (security-class)

Taught **once**, in plain words, in `FirstCallSafetyBriefing` (item 3): *if
anyone is with you and forcing this change, read the digits in reverse.* The BE
detects a reversed submission, returns **success** to the admin UI, and silently
flags the account for human review — **invisible** to a room observer (the screen
always shows the canonical code; the signal is only in what is **spoken**).

The active screen carries **only a coded jog** — "Read them in the order shown."
— innocuous to an observer, meaningful to a briefed leader (the word *order* is
the only on-screen cue). Restraint by design: a quiet utility line, never a banner.

---

## Copy log (for Founder ratification)

Voice: clinical, peer-respecting, never coddling. **Banned**: "Oops!", "Copy it
somewhere safe", exclamation reassurance, and any auth-internal vocabulary
user-side ("TOTP", "token", "AAL2", "duress"). Italic stays reserved for
scripture — none is forced onto these utility surfaces, so the **endgame lines
render roman** even though the brief quotes them in italics.

**Endgame — LOCKED verbatim:**

- Hidden → Visible: **"Your church name now shows in the network."**
- Visible → Hidden: **"Your church name is now hidden."**
- Failure (expired or failed): **"We didn't connect. Choose a new window when
  you're ready."**

No greens and no celebratory flare on the flip — success tracks the new state
with **sky / muted**, never a green check.

---

## Files

```
design_handoff_visibility_change_flow/
├── README.md
├── preview/
│   ├── index.html          # interactive CD: flow + state machine, six surfaces
│   │                       #   in iPhone frames with View-as toggles, copy log, open Qs
│   ├── flow-chrome.css      # shared CD doc chrome (from prior Replant CDs)
│   ├── flow-screens.css     # device frame + RN-screen recreations — all resolve to theme.ts
│   └── flow.js              # icons, View-as toggles, hide-code / idle / picker interactions
└── source/
    ├── ChurchVisibilityRow.tsx              # Surface 01 — entry affordance
    ├── VisibilityChangeScheduleScreen.tsx   # Surface 02 — explainer + window picker
    ├── FirstCallSafetyBriefing.tsx          # Surface 03 — one-shot briefing
    ├── VisibilityChangeLobbyScreen.tsx      # Surface 04 — pre-arm lobby
    ├── VisibilityChangeActiveScreen.tsx     # Surface 05 — live code + security floor
    └── VisibilityChangeCompleteScreen.tsx   # Surface 06 — terminal outcome
```

---

## Wire-up notes

1. **Mount the stack off root.** Register `VisibilityChangeStack` in
   `RootNavigator` beside `JoinCodeReveal` — `gestureEnabled: false`,
   `animation: 'fade'`, in the `active | pending` branch. Screens: `Schedule`,
   `SafetyBriefing`, `Lobby`, `Active`, `Complete`, `Cancel`.
2. **`AuthProvider` gains `visibilityChangeRequest`** (status, direction,
   windowLabel, and — only while armed — the minted `code`). The T-15 push
   handler flips `pending → revealed` and the navigator presents the lobby.
3. **Entry row gates on `viewerChurchType === 'underground'`** — the host
   already threads `viewerChurchType` into `SettingsScreen`. Render nothing for
   regular churches.
4. **Active screen owns the security floor** — see `VisibilityChangeActiveScreen.tsx`.
   The plaintext code lives in component state only; secure-store holds it (30-min
   TTL) solely for force-quit recovery.
5. **Admin side already exists** — `VisibilityOverrideModal.jsx` is where the
   admin types the spoken code (`validate-relay-token` server-side compare). This
   CD is the leader end of that same call.

---

## Open questions — Founder ratification

1. **Window-picker granularity.** CD shows **2-hour blocks** per the panel.
   Alternatives: 30-min slots or leader-defined. **CD lean → keep 2-hour blocks.**
2. **Does the leader see who the admin is?** CD shows **nothing** — no name, no
   avatar — to keep the surface symmetric and leak-free. Alt: "Replant team member".
3. **Surface the call channel?** CD assumes a **plain phone call** and shows no
   number/link. If it's in-app voice or a dialed number, lobby + active need a
   channel line.
4. **Duress reminder frequency.** CD puts the **plain teaching in the one-shot
   briefing** and a **coded jog** on every active render. **CD recommends → coded
   jog every call** (muscle memory under stress; innocuous to an observer).
5. **Reversibility asymmetry.** Onboarding makes Visible → Hidden never
   self-reversible (admin-only). This flow puts **both directions** behind the
   same call — confirm a verified leader may self-initiate going Hidden again here.

In Jesus' name, Amen.
