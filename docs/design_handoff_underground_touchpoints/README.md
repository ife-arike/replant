# Underground Queue — Leader Touchpoints (App)

RN spec pass for the **six in-app surfaces the underground verification queue
produces** for the leader. Locked against the Founder rulings (2026-06-22).
Builds on the existing Replant theme tokens — **no new colors, fonts, spacing,
or radii**.

**Threat model is sacred:** the device could be held by anyone. Underground
leaders see **generic chrome** — byte-identical to what a standalone-church
leader sees. Nothing here ever renders the word "underground" in a way a
screenshot could fingerprint.

> The **preview** (`preview/index.html`) is the source of truth for visual +
> interaction intent — every phone is interactive. The `source/*.tsx` files are
> RN spec scaffolds: component shape, props, states, and **copy are the
> contract**; navigation + mutations follow the codebase's existing patterns
> (`VerificationBanner.tsx`, `TheChurchScreen.tsx`, onboarding flow).

---

## Scope — which surfaces are universal vs underground-only

The verification queue serves all church types. Most of these surfaces are
therefore **shared** — and that sameness is itself the underground safety
guarantee. Two are underground-only because only underground churches have the
underlying state.

| # | Surface | Scope |
|---|---|---|
| 16 | Request-info modal | **All church types** |
| 17 | Reply composer | **All church types** |
| 18 | Verification-outcome modal (rejection + safety variant) | **All church types** |
| 19 | Persistent outcome banner | **All church types** |
| 20 | Pre-removal warning (day 23) | **All church types** |
| 21 | Visibility flips + join-code rotation | **Underground only** |

Build #16–20 as the **shared** verification surfaces (no underground branch).
Build #21 to mount only when the viewer is underground (`viewerChurchType ===
'underground'`) — but keep the chrome identical to every other modal.

---

## Founder-final visual choices (locked from CD tweak rail)

| Surface | Choice |
|---|---|
| §16 Question delivery | **Modal-on-launch** + persistent banner |
| §18 Rejection glyph | **No glyph** (heavy red ✕ is never used) |
| §21 Join-code block | **Quiet** (underlined, no box) |

The other variant for each is preserved as a `// CD-ALT:` comment in source so
the fork is recoverable.

---

## Files

```
design_handoff_underground_touchpoints/
├── README.md                          # this file
├── source/
│   ├── RequestInfoModal.tsx           # NEW  — §16 admin question, modal-on-launch
│   ├── ReplyComposer.tsx              # NEW  — §17 reply field + sent confirmation
│   ├── VerificationOutcomeModal.tsx   # NEW  — §18 "could not be verified" (+ safety_concern)
│   ├── VerificationBanner.outcome.tsx # EDIT — §19 persistent Home-tab banner
│   ├── PreRemovalModal.tsx            # NEW  — §20 day-23 blameless warning
│   └── VisibilityAndJoinModals.tsx    # NEW  — §21 visibility flips + join-code refresh
└── preview/
    └── index.html                     # standalone interactive CD doc (all 6 sections, live)
```

---

## The six surfaces

### §16 · Request-info modal (Ruling #16)
When the queue requests info, the leader sees a **modal-on-launch** on the Home
tab — **not** a notification badge in a new inbox. The question sits in a
**scriptureItalic quote treatment** (the same voice the Home verse uses). Agent
is **"the Replant team"** — never a name, never "Admin." Tone: *"Reply when
you're ready. There's no rush."* — no time-of-day, no deadline.

**Gate interaction (#22):** while `branch === 'request_info'`, the verified-gate
tiny-copy in `UnverifiedGateView` is **suppressed** — the team is waiting on the
leader, not the other way around. CTA "Send a reply" → `ReplyComposer`. Also
leaves a persistent banner (§19-style) so a dismissed modal isn't lost.

### §17 · Reply composer (Ruling #16)
One field, the question kept in view for context, send. Post-send: a calm green
takeover — **"Your reply was sent to the team."** — that auto-returns to Home.
**No** read receipts, typing indicators, or "team will respond by…" — nothing
that pressures. Writes to the request-info thread the admin reads in the detail
route.

### §18 · Verification-outcome modal (Ruling #17 — highest-leverage surface)
The trauma-aware surface. An underground leader may have risked exposure to
register; "rejected" lands like a door slammed. We never say it.

- **Lead-in (always):** *"After review, your registration could not be verified
  at this time."*
- **Reason:** one sentence from the 8-value enum's leader-facing translation.
- **Close:** *"You are welcome to re-apply when you're ready."*
- **Appeal:** accounts@projectreplant.org. CTA *"I understand."*

**`safety_concern` variant — trauma-aware silence:** **no reason detail, no
close, no re-apply invitation.** We deliberately say less, because the worst
outcome is making a person who may be in real danger feel rejected or
interrogated. Branch on `reason === 'safety_concern'`.

### §19 · Persistent outcome banner (Ruling #17)
After the modal is dismissed, the Home tab keeps a **persistent banner**:
*"Your registration could not be verified at this time."* + **"Read details →"**
which re-opens the full modal. Sits where the verification-pending banner did —
same chrome, neutral tint (the modal already carried the weight). Generic enough
that a screenshot reveals nothing underground-specific. No auto-dismiss; stays
until re-apply or record removal. **The leader is never logged out** — the
notice is revisitable any time from this banner.

### §20 · Pre-removal warning (Ruling #18, copy revised 2026-06-22)
Day 23 (3 days before the day-30 auto-delete window), once. **Blameless** — the
headline centers our wish to keep them and the body owns that the delay may be
on Replant's side:

> **We don't want to lose your registration**
> Your registration hasn't been completed yet, and it's set to be removed from
> our records in a few days. Sometimes that's because we're still reviewing on
> our end. If you'd still like to join — or if you've been waiting to hear from
> us — please reach out and we'll pick it back up with you.

Amber glyph well (a heads-up, not a verdict). Appeal accounts@projectreplant.org.
Single **"I understand"** CTA — no dismiss-X that feels like a trap.

> **Copy note:** this REVISES the originally-locked *"Your registration will be
> removed soon"* string per Founder feedback — the old line implied the leader
> dropped the ball. New copy never does.

### §21 · Visibility flips + join-code rotation (Rulings #19 + #20) — underground only
Three modal-on-launch notices the admin actions produce.

- **Hidden→Visible:** *"Your visibility setting was updated. Your church is now
  listed as Visible in the Replant network. Your location remains hidden."*
- **Visible→Hidden:** *"Your visibility setting was updated. Your church is now
  listed as Hidden. Other leaders will see 'Underground Church' and your region
  only."*
- **Join-code refresh:** *"Your join code has been refreshed"* + new code (quiet
  treatment, `RPL-XXXX-NNNNN`, monospace) + **Copy** (Clipboard + success haptic)
  + **Got it.**

**Neither visibility notice names the channel of contact** — that's
admin-internal meta only. All locale-safe: no idioms, no time-of-day.
"Visible / Hidden" map directly to `show_church_name` — the internal
"Brave / Safe" jargon never surfaces to a leader.

---

## Design tokens used

All from `constants/theme.ts`. No additions.

| Token | Value | Use |
|---|---|---|
| `Colors.background` | `#080808` | Phone bg, takeovers |
| `Colors.surface` | `#111111` | Cards, fields, banners |
| `Colors.surfaceElevated` | `#181818` | Modals |
| `Colors.accent` | `#6BB5E8` | Interactive, Visible pill, code accent |
| `Colors.text` | `#F0EDE6` | Primary text |
| `Colors.textMuted` | `rgba(240,237,230,0.45)` | Secondary text |
| `Colors.textSubtle` | `rgba(240,237,230,0.25)` | Hints, placeholders |
| `Colors.amber` | `#D4A855` | Pre-removal glyph (heads-up) |
| `Colors.green` | `#5BAD7A` | Reply-sent confirmation, copy-success |
| `Colors.red` | `#E05555` | **Reserved** — not used on the rejection surface |
| `Typography.display / displayMedium` | Cormorant 600 / 500 | Modal titles |
| `Typography.scriptureItalic` | Cormorant 300 Italic | Question quote, close line ONLY |
| `Typography.body / bodyMedium` | DM Sans | Body, CTAs |
| `Typography.mono` | DM Mono | Join code, eyebrows |
| `Spacing.sm/md/lg/xl` | 8 / 16 / 24 / 32 | — |
| `Radius.md/lg/xl` | 8 / 12 / 20 | — |

---

## Notes for the implementer

1. **No new tokens. One edited file, five new components.**
   `VerificationBanner.tsx` gains an `outcome` state (§19); the rest are new
   modals.

2. **Red is NOT used on the rejection surface.** A heavy red ✕ on "could not be
   verified" reads as punishment. The outcome modal uses muted chrome and a
   small Replant mark, not an error glyph. Red stays reserved for things the
   leader can act on.

3. **Cormorant on Android.** Use named `Typography.*` families — never apply
   `fontWeight`/`fontStyle` to a regular asset (synthetic weight/italic breaks
   Android). The quote + close lines use the native `scriptureItalic` asset.

4. **Modal-on-launch is a launch-gate contract**, not a push. No push, no PWA
   (Ruling #12 is admin-side; leader side has no push either). These fire on the
   next Home-tab launch when their flag is set, once each, then leave a banner.

5. **Generic chrome is the safety mechanism.** #16–20 must be byte-identical to
   what a standalone leader sees. Add no underground-specific copy, icon, or
   color anywhere a screenshot could capture it. #21 mounts only for underground
   viewers but keeps the same modal chrome.

6. **The leader is never logged out** after an outcome. Every notice is
   revisitable from the Home banner ("Read details →"). Open question parked by
   Founder: session/revisit policy + exact deactivated-modal timing.

In Jesus' name, Amen.
