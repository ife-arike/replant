# Account page — Admin CD

Concept Direction for the new **`/account`** page (KAN-271 admin tier bundle).
A canonical home for personal account management across all three admin tiers —
**Overseer**, **Super admin**, **Admin** — with **TOTP enrollment** as the hero,
since the new regular Admin tier has Team Management hidden and no other home for
it today.

Built on the **live** `src/styles/globals.css` design system (`rp-*` tokens) and
the `.adm` embedded-shell vocabulary shared with the Underground / In Review admin
CDs. **No new design tokens.** Desktop admin web app, dark, clinical register.

> **Preview** (`preview/index.html`) is the source of truth for visual +
> interaction intent. Open it and use the **View as** control to flip tier
> (Admin / Super admin / Overseer) and TOTP state (not enrolled / enrolled) —
> all three required variants are live in the real chrome. `source/*.jsx` are
> spec scaffolds; lift the rest from the preview markup.

---

## What I could / couldn't access

- ✅ `Shell.jsx`, `TotpEnrollmentScreen.jsx`, `globals.css` tokens + primitives,
  build manifest §3.5, the tier model + tier-chip colors.
- The MVP baseline and 16/ratified rulings in the prompt are treated as canonical.

---

## Design rationale (the short version)

**Layout — single column, sectioned cards (~760px).** Account management is
low-frequency and personal. A second left nav would fight the global nav; tabs
would hide the one thing a new Admin came for. Single column lets the eye fall to
the TOTP hero and scroll the rest. (An anchor-rail variant is in Tweaks for long
scrolls.)

**Sections:**

| Section | Status | Why |
|---|---|---|
| Identity (name · tier chip · email read-only) | **MVP baseline** | §3.5 |
| **Two-factor authentication** | **MVP baseline** | the hero — embeds `TotpEnrollmentScreen` if not enrolled, else status card + Reset |
| Sign out | **MVP baseline** | mirrors nav for on-page discoverability |
| Active sessions | CD proposed | real risk on a shared/observed machine; "sign out other devices" |
| Recent account activity | CD proposed | this admin's own sign-ins — a "was this you?" mirror, NOT the global audit log |
| Preferences (timezone · language · notifications) | CD proposed | logs render in tz; localization slot; digest cadence |
| Deactivation request | CD proposed | not self-service — routes to another admin |

**Excluded (judgment):** theme switch (dark-only is locked), avatar upload
(vanity + security smell on an oversight tool), data export (defer — little
personal data here).

**Visual register:** clinical. Serif headers, dark `#080808`, `rp-*` tokens,
generous whitespace. No scripture forced onto a settings page — italic stays
reserved for `scriptureItalic`. Admins are competent: plain labels, standard
vocabulary (TOTP, 2FA), **zero** auth-internal jargon (no AAL2 / JWT / RLS on any
surface). Every action says what it does.

---

## My recommendation on the Team Management redundancy question

**Make the Account page the single source of truth for personal TOTP and pull the
personal TOTP setup out of Team Management.** Team Management is for managing
*others*; burying your own second factor inside it is what made enrollment
invisible in the first place. Leave a one-line pointer on Team Management
("Manage your own two-factor authentication on your Account page →") for
discoverability during transition. Clean separation: Team Management = team/tier
ops; Account = self. (Surfaced as **open Q1** for ratification.)

---

## Files

```
design_handoff_account_page/
├── README.md
├── source/
│   ├── AccountPage.jsx   # screens/AccountPage.jsx — page shell + section tree, reuse points
│   └── TierChip.jsx      # components/admin/TierChip.jsx — claim → user-facing label + quiet chip
└── preview/
    ├── index.html        # interactive CD: rationale, the page in real chrome (tier/TOTP switch), TOTP closeups, states, spec, open Qs
    ├── account-chrome.css# CD doc chrome (shared with prior admin CDs)
    ├── account-cd.css    # account-specific component styles (all resolve to live tokens)
    └── account-cd.js     # renders shell + page, View-as switch, tweaks host protocol
```

---

## Wire-up notes

1. **Route:** add `/account` → `AccountPage` in `App.jsx`. Render inside `RpFrame`.
2. **Click-target (Shell.jsx):** wrap the bottom-left identity block in a Link.
   The whole block is the target; sign out stays above, unchanged:
   ```jsx
   // in NavBody, .rp-side-foot — sign out row UNCHANGED above this
   <Link to="/account" className="rp-id rp-id-link">
     <div className="rp-id-avatar">{initials(displayName)}</div>
     <div>
       <div className="rp-id-name">{displayName}</div>
       <TierChip tier={user?.app_metadata?.admin_tier} size="sm" />
     </div>
   </Link>
   ```
   (Add `.rp-id-link { text-decoration:none; cursor:pointer }` + the hover from
   `account-cd.css .adm-id`.) The current static `super_admin` badge becomes the
   tier-aware `<TierChip>`.
3. **TOTP:** `resolveTotpFactorId` → `null` renders `TotpEnrollmentScreen`
   (verbatim, `onEnrolled={loadFactor}`); a string renders the status card +
   guarded Reset (existing `unenrollTotpFactor` → re-mount). No separate gate.
4. **Tier-aware:** the page is identical for all tiers; only the Overseer
   cross-notify sub-block is gated. Nav differences (Team Management / Admin tier
   hidden for Admin) live in Shell's NAV config, not here.
5. **Graceful states:** sessions + activity resolve through the live
   `SkeletonRows` / `EmptyState` / `ErrorBanner`. Identity + TOTP never block on a
   fetch — they read the session in hand.
6. **Audit:** Reset TOTP, Sign out other devices, and Deactivation request are
   sensitive — each opens a confirm and writes an audit row.

---

## Open questions — Founder ratification (2026-06-24)

1. ~~Team Management redundancy~~ — **Resolved → pull out.** Personal TOTP moves off Team Management; Account is the single source of truth + a one-line pointer stays for transition.
2. ~~Beyond-MVP scope~~ — **Resolved → all post-MVP.** MVP ships identity + TOTP + sign out. Active sessions, Recent activity, Preferences approved as post-MVP. Deactivation request still under consideration.
3. ~~Recent activity scope~~ — **Resolved → aligned.** This-admin-only, nothing leader-identifying.
4. ~~Notification ownership~~ — **Resolved → always-on.** Cross-notify is always-on; shown as an "Always on" status, not a toggle.
5. **Deactivation routing** — leaning Ops inbox; open whether requester keeps access until actioned. (Founder dwelling.)
6. **Email editability** — ever self-service, or always admin-mediated?
7. ~~Layout~~ — **Resolved → single column.**

## Untouched: TOTP enrollment

`TotpEnrollmentScreen.jsx` is already built and is **rendered verbatim** — this CD
does not change it, only hosts it on `/account` instead of Team Management. The
preview shows a labeled representation for context, marked "existing component ·
rendered verbatim."

In Jesus' name, Amen.
