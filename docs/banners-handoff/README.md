# Replant — Notification banners · React Native handoff

Build spec for the Home-tab verification banner + the transient notification
moments. Locked tokens only (`theme.ts`, already in the app). Mirror of the
reference canvas `Replant - Notification Banners.html`.

---

## ★ Locked decisions

| Decision | Value |
|---|---|
| **Verification banner** | **Direction 1 · Held field** (soft tinted field, leading icon, no border box) |
| **Leader banner** | same Held field, sky register, no countdown |
| **Contact email** | **accounts@projectreplant.org** (was `connect@`) — rendered **plain off-white**, never colour-coded |
| **Amber copy** | "Your church will be deactivated soon" |
| **Urgent copy** | "Verification expires today" (0-day; corrects live "expires tomorrow") |
| **Transient toasts** | only **approved · not-approved · heartcry** |

---

## Deliverable 1 — VerificationBanner (Direction 1 · Held field)

Sits in `HomeScreen` body (`paddingHorizontal: 20`) above the **TODAY** label,
when `branch === 'pending'`. A soft tinted field — no hard border.

**States** (restores the 3-state model):

| State | Trigger | Tint | Head colour | Icon |
|---|---|---|---|---|
| neutral | `days > 7` | `surfaceElevated` | `Colors.text` | info · sky |
| amber | `1 < days ≤ 7` | amber 8% | `Colors.amber` | clock |
| urgent | `days ≤ 1` (incl 0) | red 8% | `Colors.red` | alert |
| register | `days === null` (no church linked) | red 8% | `Colors.red` | alert |
| leader | `variant="leader"` | sky 6% | `Colors.text` | leader |

**Copy** (email always `accounts@projectreplant.org`, plain):
- neutral — "Your church is visible to the network but limited until verified. {days} days remaining. Questions? {email}."
- amber — "Verify within {days} days to stay active. If you've already submitted, email {email}."
- urgent — "Your church will be deactivated today unless verified. Email {email}."
- register — "You have 7 days from account creation to register or join a church. Questions? {email}."
- leader — "Your church is verified. Your leader access opens once the Replant team confirms your account. {email}."

**Field spec**: `flexDirection: row`, `gap: 13`, `borderRadius: Radius.lg (12)`,
`paddingHorizontal: 15`, `paddingVertical: 14`. Icon well 30×30 circle, bg
`rgba(240,237,230,0.05)`. Head `Typography.bodyMedium 14`. Detail
`Typography.body 13.5 / 19`, `Colors.textMuted`. Dismiss × = in-memory per
session (no storage) — matches the live AC.

---

## Deliverable 2 — Leader banner

`<VerificationBanner variant="leader" />`. The church is verified, so **no
countdown and no amber/red** — a calm sky note that the leader's own seat is
pending. Same Held-field chassis as D1, so it's visually in sync.

---

## Deliverable 3 — NotificationToast (transient)

Top-of-screen, below the safe area. Slides down + fades in, lingers ~4s,
auto-dismisses; **swipe up** to dismiss early. One at a time (a new arrival
replaces the old). Home dims slightly beneath (host overlay).

| Type | Register | Icon | Tap |
|---|---|---|---|
| `approved` | green · quiet, weighty | check | — |
| `rejected` | **neutral, NOT red** · pastoral | info (muted) | → profile |
| `heartcry` | green · **sacred** (serif italic, warm surface) | heart | → Prayer Wall |

**Toast spec**: bg `Colors.surfaceElevated`, border `0.5 Colors.border`,
`borderRadius: 16`, shadow. Icon well 30 circle. Title `Typography.bodyMedium
14/18`; sacred title `Typography.scriptureItalic 16.5/21`. Sub `Typography.body
12/16 textMuted`. Grab handle 34×4. Enter: `translateY -10→0` spring + fade
~280ms. Exit: `translateY` + fade ~220ms (swipe-up or auto).

> **Heartcry icon** is a clear **heart** ("cry of the heart") — replaces the
> ambiguous praying-hands. It's a status note, not a like. Can go iconless
> (serif-only) if preferred.

---

## Files

```
banners-handoff/
├─ README.md
└─ components/
   ├─ banner-icons.tsx        react-native-svg glyphs
   ├─ VerificationBanner.tsx  Direction 1 · 5 states (church + leader)
   └─ NotificationToast.tsx   approved / rejected / heartcry + motion
```

Imports assume `../theme` and `../contexts/AuthProvider` (existing). Install
`react-native-svg` (+ `react-native-svg-transformer` if you import the Rp mark
as a component).

---

## Flags for the team

1. **Threshold change** — live `VerificationBanner.tsx` collapses neutral into
   amber (`days > 1 → amber`). This restores the **3-state** model
   (`days > 7 → neutral`). Confirm with eng before build.
2. **Email constant** — `connect@projectreplant.org → accounts@projectreplant.org`
   for all verification contact.
3. **"Not approved" tone** — deliberately avoids `Colors.red`. Confirm with the
   Founder that the quiet-note treatment is right.
4. **Deferred** — DM, new-announcement, daily-scripture, and security-alert
   toasts are intentionally **not** built; they belong to device push (security
   alert is post-MVP).
