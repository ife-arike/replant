# MFA Login Gate — Admin CD

Concept Direction for the two admin surfaces that fix a load-bearing auth gap
(**Option C+** per the SEC + BE panel). Today every admin session sits at AAL1
and every per-action second-factor check rejects, because nothing elevates the
session after the password. This CD designs the **UX layer** of the fix:

1. **`BlockingEnrollmentGate`** — a full-screen, no-skip MFA enrollment gate
   that stands between sign-in and the dashboard when an admin has no verified
   TOTP factor.
2. **`StepUpTotpModal`** — a refresh of the current `StepUpModal` that
   re-challenges with a **TOTP code** (not the password it used to re-probe)
   before a destructive action lands.

Built on the **live** `src/styles/globals.css` design system (`rp-*` tokens),
the `.adm` embedded-shell vocabulary, and the doc chrome shared with prior admin
CDs. **No new tokens.** Desktop admin web, dark, clinical register.

> **`preview/index.html` is the source of truth** for visual + interaction
> intent. Open it and use each **View as** control: Surface 1 switches entry
> case (first-time invitee / factor-reset admin); Surface 2 switches state
> (idle / verifying / error / locked). `source/*.jsx` are spec scaffolds — lift
> the structure + tokens; wire the real Supabase Auth calls.

---

## What I could / couldn't access

- ✅ Read every file in the mandatory list: `TotpEnrollmentScreen.jsx`,
  `TotpChallengeModal.jsx`, `StepUpModal.jsx`, `Shell.jsx`, `Login.jsx`,
  `Account.jsx`, `globals.css` tokens + primitives, and `OPS-03-totp-breakglass.md`.
- ⚠️ The two memory `.md` files (`locked_tiered_mfa_freshness`,
  `feedback_replant_admin_copy_voice`) live outside the mounted folders. Both
  rulings are quoted verbatim in the dispatch and are treated as canonical here
  (tier model in the spec notes; voice ruling drives every authored string).

---

## Design rationale (the short version)

### Surface 1 — BlockingEnrollmentGate

**It is the wrapper, not the flow.** The 3-step enrollment
(`TotpEnrollmentScreen`) is already built and design-approved — this CD does not
touch it. What was missing is the **chrome** that turns it into a gate:

| Piece | Decision | Why |
|---|---|---|
| Layout | Replaces `RpFrame` entirely — no left nav, no topbar | A gate with the dashboard's chrome implies the dashboard is reachable. It isn't. |
| Logo chrome | Bordered `R` + `Replant` wordmark, top-left, small | Lifts the `Login.jsx` logo treatment so the gate reads as an auth surface, continuous with sign-in. |
| Background | `Login.jsx` vignette + grid-mask | Same reason — visual continuity with the screen they just came from. |
| Welcome copy | Centered serif headline + sub, **above** the card. No eyebrow. | Admin lands here right after activation; this is their first impression. Greets, frames the stop, then gets out of the way. |
| One universal message | Same copy for new invitee **and** break-glass factor-reset | One honest line covers both; the gate still detects `case` for routing/analytics, but the admin sees the same welcome. The enrollment card is identical either way. |
| Sign out | One quiet link, top-right of the chrome bar | The only escape hatch. No skip, no "later," no dismiss — the gate is enforcement, not a nudge (BE 401s every endpoint regardless). |

The card's own `h1` ("Set up two-factor authentication") is the **task**; the
welcome copy is the **greeting + the why**. Clean hierarchy, minimal redundancy.

### Surface 2 — StepUpTotpModal

**Keep the host, swap the mechanism.** SEC ruled the password re-prompt
architecturally wrong: re-entering the password proves the admin knows the same
secret the session opened with — it establishes nothing new. A TOTP code proves
**possession of the second factor right now**. So:

| | |
|---|---|
| **Reuse (unchanged)** | `useStepUp()` host architecture (`_registerOpener` / `_resolvePending` / `_rejectPending`), single global mount, z-index `2000` over `.ov` (300) + `rp-toast` (1000), backdrop-click + ESC cancel. |
| **Change** | `<input type="password">` → six `.otp-cell` inputs (mono 26px, sky focus ring, error tint) + advance/backspace/paste from `TotpChallengeModal`. Adds the **error** (attempt counter) and **locked** (5-attempt / 15-min, persisted per `factorId`) states. Card width **380 → 440** to seat six cells. Copy reworked, action surfaced by name. |

The two TOTP re-challenges in the app — Heartcry decrypt (`TotpChallengeModal`)
and step-up (this) — now share one visual language and one lockout model. The
only thing this one adds is the **action-bound context line**.

---

## Copy log (for Founder ratification)

Voice: clinical, peer-respecting, honest about mechanism. Admins know what TOTP
is — nothing coddled, nothing euphemised. Italic stays reserved for scripture;
none is forced onto an auth surface. **Banned** (per the voice ruling): "Oops!",
"Copy it somewhere safe", exclamation reassurance, and **any** auth-internal
vocabulary user-side ("AAL2," "step-up," "elevation," "freshness," "JWT").

**Surface 1 — welcome framing** _(universal — one message for both entry
conditions: new invitee and break-glass factor-reset. No eyebrow, no case split.)_

- **Headline A** _(CD lean)_: "One more step before you're in."
- **Headline B** _(alt for Founder)_: "Finish setting up your account."
- **Sub**: "Replant admins must sign in with an authenticator code. Set yours up
  to continue."
- **Why (lives in the card)**: "Admin access reaches sensitive information about
  leaders in restricted contexts. Two-factor authentication is required before
  you continue." _(universal — the screen also hosts profile re-enroll, so the
  justification is no longer Heartcry-specific.)_
- **Recovery** _(card footer)_: "…contact the **Replant Operations team** at
  **accounts@projectreplant.org** to restore access. There is no automated
  recovery."
- **Card foot**: "Every admin enrolls before reaching the dashboard. There's no
  skip." _(honest about the gate; no drama.)_

**Surface 2 — step-up**

- **Title**: "Verify your identity" _(matches `TotpChallengeModal` exactly — the
  two re-challenges read as one system.)_
- **Sub**: "Enter the 6-digit code from your authenticator app to confirm this action."
- **Action line**: "You're about to **reject underground verification** `UG-A540`.
  This can't be undone." _(action named, consequence stated, ref carried; the
  modal already receives this context.)_
- **Error**: "Incorrect code — **N attempts remaining** before 15-minute lockout."
  _(verbatim from `TotpChallengeModal`.)_
- **Locked**: "Too many attempts. Try again in 15 minutes. **The action was not
  performed.**" _(added clause reassures nothing fired.)_

---

## Files

```
design_handoff_mfa_login_gate/
├── README.md
├── preview/
│   ├── index.html            # interactive CD: rationale, both surfaces in real
│   │                         #   chrome with View-as toggles, spec, copy log, open Qs
│   ├── mfa-gate-chrome.css    # shared CD doc chrome (from prior admin CDs)
│   ├── mfa-gate.css           # surface-specific styles — all resolve to live rp-* tokens
│   └── mfa-gate.js            # renders both surfaces, OTP cell behavior, View-as switches
└── source/
    ├── BlockingEnrollmentGate.jsx   # full-screen wrapper + welcome chrome (spec scaffold)
    └── StepUpTotpModal.jsx          # TOTP-code step-up (spec scaffold)
```

---

## Wire-up notes

**Surface 1 — `BlockingEnrollmentGate`**

1. It is **not a route**. The post-sign-in guard renders it **in place of**
   `RpFrame` when `resolveTotpFactorId(supabase) === null`:
   ```jsx
   <BlockingEnrollmentGate case={resetContext ? 'reset' : 'invitee'}>
     <TotpEnrollmentScreen onEnrolled={() => navigate('/network')} />
   </BlockingEnrollmentGate>
   ```
2. `case` selects welcome copy only. Default `"invitee"`; pass `"reset"` when the
   no-factor state follows an `admin_mfa_factor_reset` (break-glass / Overseer
   reset). The enrollment child is identical in both.
3. `TotpEnrollmentScreen` is rendered **verbatim** — `onEnrolled` navigates to the
   dashboard. Its `challengeAndVerify` auto-issues the elevated session.
4. **Login.jsx changes (out of this component, flagged):** today
   `Login.handleSubmit` routes a first-timer to `/account`. After this work it
   should route to the gate instead — and an existing-factor admin should hit
   the inline `TotpChallengeModal` before `/network`. That router change is the
   other half of Option C+; these two surfaces are the destinations.

**Surface 2 — `StepUpTotpModal`**

1. Drop-in replacement for `StepUpModalHost` at the app root. The `useStepUp`
   hook's `requireStepUp` now passes an **action descriptor** (not a bare name):
   ```jsx
   const token = await requireStepUp(ACTIONS.REJECT_UNDERGROUND, { target: 'UG-A540' })
   // ACTIONS.REJECT_UNDERGROUND = { key, verb: 'reject', context: 'underground verification' }
   ```
2. On a passing code: `challengeAndVerify(factorId, code)` proves possession, then
   `POST request-step-up { action: action.key, target }` (no password) mints the
   token. **Token contract:** bound to the `(user_id, action)` pair, 5-min TTL,
   single-use against that one action (anti-replay across a different
   destructive call). Separate from AAL2 session freshness.
3. `onVerified(token)` hands the token to the caller; **Cancel / ESC / backdrop**
   reject the awaiter so the destructive action **never fires**.
4. Lockout (`5` attempts / `15` min) is persisted per `factorId` in
   `localStorage` — the same UX brake `TotpChallengeModal` uses. The real gate is
   server-side.

---

## Open questions — Founder ratification

1. **Welcome copy (Surface 1).** Copy is now **universal** across both entry
   conditions (no eyebrow, no case split). Headline staged for final lock:
   **A** "One more step before you're in." (CD lean) vs **B** "Finish setting up
   your account." **Founder locks final.**
2. **Sign-out placement (Surface 1).** CD pick: **top-right corner of the logo
   chrome** (shown). Alternative: a quiet link below the card. It reads as an
   escape hatch rather than an option where it is. **Founder ratify.**
3. **Surface 2 chrome.** **CD recommends → modal overlay** (shown), for visual
   consistency with `TotpChallengeModal` — not a body-replace of the triggering
   modal, not a side panel. **Founder confirm.**
4. **Loading state between password entry and the inline TOTP challenge
   (Login).** Out of these two surfaces' scope, but flagged: recommend an
   **instant** transition — the challenge modal's own focus state is feedback
   enough. Add a spinner only if the factor lookup proves slow in practice.
5. **Recovery flow ("Lost your authenticator?").** **Out of scope — post-MVP,
   acknowledged.** Today recovery is OPS-03 break-glass (founder-mediated SQL).
   A self-serve "lost authenticator" surface **will** need to exist; it is not
   designed here, but the seam is real and named so it isn't forgotten.

---

## Untouched: TOTP enrollment + the challenge pattern

`TotpEnrollmentScreen.jsx` is rendered **verbatim** inside Surface 1 — this CD
does not change its three steps. **Two one-line copy changes only**, both
because this screen also hosts profile re-enroll (so its copy must read
universally, not Heartcry-specific): (1) the intro justification — "Admin access
reaches sensitive information about leaders in restricted contexts. Two-factor
authentication is required before you continue."; (2) the recovery footer —
"…contact the **Replant Operations team** at **accounts@projectreplant.org** to
restore access." `TotpChallengeModal.jsx` is the **visual reference** for Surface
2's input + lockout — lifted, not redesigned. The preview shows faithful
representations of both for context.

In Jesus' name, Amen.
