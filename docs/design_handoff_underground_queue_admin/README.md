# Underground Verification Queue (Admin)

CD pass for the **fifteen desktop surfaces** that extend
`admin.projectreplant.org/underground` from a read-only viewer (`Underground.jsx`)
into a working **two-eyes verification queue**. Locked against the Founder
rulings (2026-06-22).

Built on the existing admin design system — **`src/styles/globals.css` `rp-*`
tokens only, no new colors/fonts/spacing**. This is a **React web** app (not RN);
source scaffolds are `.jsx`, matching `Queue.jsx` / `Underground.jsx`.

> The **preview** (`preview/index.html`) is the source of truth for visual +
> interaction intent. The `source/*.jsx` files are spec scaffolds: component
> shape, props, states, and copy are the contract; data + mutations follow the
> existing screen patterns (`Queue.jsx` propose/confirm, `AdminNotes.jsx`,
> `Underground.jsx` AAL2 gate, `StepUpModal.jsx`).

---

## Founder-final visual choices (locked from CD tweak rail)

| Tweak | Choice |
|---|---|
| SLA pill (list rows) | **Day only** — message clause dropped in dense rows |
| State pill | **Dot + label** |
| Relay-token entry | **4 cells** |
| Density | **Comfortable** |

The SLA **band board** (deliverable 4) still renders the full band messages —
that is the ratification artifact. Only the day-count pills in the list rows go
compact.

---

## What's locked (do NOT redesign)

1. **3 tabs** — `Pending / Verified / Deactivated`. AAL2 + `is_underground_admin`
   gate at the parent route.
2. **Two-eyes** for verify, reject, rotate join code, visibility override.
   Admin A proposes → Admin B confirms. **Founder cannot be A and B on the same
   row.**
3. **Counter-proposal:** Admin B can DECLINE A's proposal (required
   `counter_notes`) → row returns to **Untouched** + A is notified. NOT a
   rejection of the church.
4. **Detail = dedicated route** `/underground/pending/:id` — not inline expansion.
5. **SLA bands** (5/15/25 within a 30-day window) — see table below. Day-30
   auto-reject for an unresponsive pending UG; `stalled_pending` sub-state pauses
   the clock when the leader is responsive but the admin is overloaded.
6. **Visibility = Visible / Hidden** (never Brave/Safe). DB column stays
   `show_church_name boolean`.
7. **Visibility override requires a 4-digit relay token** — the code the leader
   spoke during the T2 call. Anti-social-engineering.
8. **T2 channels:** Signal / Wire / In-person / Letter / Referring-leader-relay.
   Explicitly NOT WhatsApp or regular phone.
9. **Hard-delete** requires typing the `church_code` (e.g. `RPL-12345`). Strictly
   one-by-one, no bulk select.
10. **Rejection enum (8 values)** — admin label → leader translation (see
    `ProposePanel.jsx`).
11. **Admin B notification:** in-app badge (live Realtime) on the Underground
    sidebar entry + email with **NO UG-identifying body** — just *"An underground
    action needs your confirmation. Sign in to review."* No push, no PWA.
12. **Day-25 → Founder.** At day 25 the row auto-routes to the Founder as sole
    owner. Sunday weekly review cadence.
13. **Proposal TTL: 72h** auto-cancel — shown as a live countdown on the confirm modal.

---

## SLA bands — the #1 ratification ask (deliverable 4)

Yellow (days 5–14) and amber (days 15–24) MUST read as visibly distinct. Derive
band from `days_since_submitted` against the 5/15/25/30 thresholds.

| Range | Band | Token | Pill copy |
|---|---|---|---|
| 0–4 | neutral gray | `--sla-neutral #7a7a7a` | `Day n · contact within day 5` |
| 5–14 | **yellow** | `--sla-yellow #D6C24A` | `Day n · decision-or-info by day 15` |
| 15–24 | **amber** | `--sla-amber #D8943A` | `Day n · final by day 25` |
| 25–29 | red | `--sla-red #d96860` | `Day n · final overdue` |
| 30+ | pulsing red | `--sla-red` + pulse | `Day n · past window — auto-reject pending` |

`stalled_pending` freezes the clock and renders neutral-gray with a paused glyph.
Pulse is gated behind `prefers-reduced-motion`. **These five SLA tokens are the
only additions to the palette** — see `preview/admin-queue-cd.css` `:root`.

---

## Files

```
design_handoff_underground_queue_admin/
├── README.md                       # this file
├── source/
│   ├── SlaPill.jsx                 # deliverable 4 — band component (the hero)
│   ├── UndergroundQueue.jsx        # deliverables 1,2,3,5 — Pending tab (tabs/banner/filters/rows)
│   ├── VisibilityOverrideModal.jsx # deliverable 11 — 4-digit relay-token modal
│   └── UndergroundAccessDenied.jsx # deliverable 15 — super-admin gate denial
└── preview/
    ├── index.html                  # standalone interactive CD doc (all 15 surfaces, live)
    ├── admin-queue-cd.css          # surface styles + SLA tokens
    └── admin-queue-cd.js           # interactions (tabs, filters, modals, relay token, TTL)
```

The remaining surfaces (detail route, propose verify/reject, confirm/decline,
join-code state machine, deactivated tab, hard-delete) are fully specified in the
interactive preview and the section spec panels; the four `.jsx` scaffolds cover
the load-bearing / novel components. Lift the rest from the preview markup, which
is class-based against `globals.css`.

---

## The 15 surfaces (deliverable → where)

| # | Surface | Preview §
|---|---|---|
| 1 | 3-tab bar + counts | §1 |
| 2 | Pending list rows (ref / region / SLA / state / tier) | §1 |
| 3 | SLA aggregate banner (click a number → filter) | §1 |
| 4 | **SLA pill states — all 5 side by side** | §2 |
| 5 | Filter chips (Region / SLA / Proposer / Tier), collapsible | §1 |
| 6 | Detail route — evidence packet, profile, threads, action bar | §3 |
| 7 | Propose Verify panel | §4 |
| 8 | Propose Reject panel (8-value enum) | §4 |
| 9 | Confirm modal (Admin B) + 72h TTL + exact leader text | §5 |
| 10 | Decline-proposal modal (counter_notes → Untouched) | §5 |
| 11 | Visibility override + 4-digit relay token | §6 |
| 12 | Join-code state machine (hashed → rotate → re-reveal) | §6 |
| 13 | Deactivated tab rows (countdown, reinstate, hard-delete) | §7 |
| 14 | Hard-delete confirm (type the church_code) | §7 |
| 15 | Super-admin gate denial | §7 |

---

## Terminology (Founder note 2026-06-22)

Do NOT use "steward" / "underground steward" anywhere in the UI — it's neither a
real role nor accurate. The gate flag is **`is_underground_admin`**; the access
role is **super admin**. The denial copy reads:

> **Super admin access required**
> This area is limited to **super admins with underground access**
> (`is_underground_admin`). Contact ops if you believe this is an error.

The agent label the LEADER sees is always "the Replant team" (handled in the app
flow), never an admin name.

---

## Notes for the implementer

1. **Extends `Underground.jsx`.** The read-only single table becomes the
   `Pending` tab. The restricted-access banner, client-side decryption, and the
   AAL2 + `is_underground_admin` parent gate are PRESERVED.
2. **Two-eyes is a state machine, not a button.** A proposal creates a pending
   record (72h TTL), flips the row to `Awaiting confirm`, and notifies Admin B.
   Confirm commits; Decline returns to `Untouched` with `counter_notes`. The
   church's standing changes ONLY on confirm.
3. **Relay token validates server-side** against the value captured on the T2
   call. The 4 numeric cells are UX; the gate is the BE check.
4. **Hard-delete is the only destructive path** — typed `church_code` match,
   one-by-one, no bulk. Mirrors the typed-confirm gravity of `StepUpModal.jsx`.
5. **Email to Admin B carries no UG-identifying body.** Just "An underground
   action needs your confirmation. Sign in to review."

In Jesus' name, Amen.
