# "Mark as in review" workstream — Admin CD

Concept Direction for the **10 visual asks** layering a claim/assignment model
over `UndergroundDetail.jsx` and the Pending queue. Locked against the 16 Founder
ratifications (2026-06-22 In Review entry) + the 2026-06-23 leader-card +
SLA-banner rulings.

Built entirely on the **live** `src/styles/globals.css` design system — the
`rp-*` tokens and the `.state-*` pill family. **No new design tokens.** Every
color resolves to an existing token or a quiet tint of one. Desktop-first
(1440 canvas) — this is the admin dashboard, not mobile.

> **Preview** (`preview/index.html`) is the source of truth for visual +
> interaction intent. The `source/*.jsx` files are spec scaffolds for the
> load-bearing components; lift the rest from the preview markup, which is
> class-based against the live globals.css.

---

## What I could NOT access

The memory spec `~/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md`
sits outside the mounted `replant` / `replant-admin` folders, so I could not read
it directly. The 16 ratifications + locked terminology in the Founder's brief
are treated as canonical. **If any ruling below conflicts with that memory file,
the memory file wins — flag it and I'll revise.**

---

## Founder visual rulings folded in (2026-06-23 feedback)

| Area | Decision |
|---|---|
| SLA aggregate banner | **Gray** (`.sla-agg-neutral`), not blue — informational; per-row pills carry urgency. Per-number amber/red accents + click-to-filter stay. |
| In Review staleness | **Neutral by restraint.** The pill is a calm monochrome chip; the flag glyph warms to a **single muted accent** (`--rp-amber`) as a claim ages, and only the overdue tier gets a hairline warm edge. No RAG fills. (The loud version is preserved behind a Tweak, marked *rejected*.) |
| Color discipline | RAG statuses do **not** get matching colored pills. SLA day pills are neutral chips (the day number is the signal) with one restrained accent dot at the late tiers. Color is reserved for: sky (brand/interactive), green/red (verify/reject **action** buttons only), one amber accent for urgency. |
| Leader cards | **No sub-headings.** Section header "Leader/Leaders" carries it; each card's top line is the claimed `role`. |
| Attribution | **"In review by Maria S · since Jun 22"** — "since" + a date, never a day-count on the surface. |
| Terminology | The role is **super admin** / the flag is `is_underground_admin`. Never "steward". The destructive action is **Force unmark** (Founder only); others see **Request release**. |

---

## The locked claim model (the spine of all 10 asks)

**Claim LOCKS proposal initiation to the claimer** (Founder ruling, overriding
BA's lean). Concretely:

- Only the claimer can: write narrative notes, upload evidence, initiate
  Verify / Reject / Request-info / Visibility-override / Rotate.
- Any admin can still **CONFIRM** the claimer's proposal — the two-eyes step
  survives the claim lock (confirming ≠ initiating).
- Non-claimers see primary CTAs **disabled** with a tooltip pointing to
  **Request release** (pings the claimer).
- Only the **Founder** can **force-unmark**, behind four gates (Ask 5).

---

## Files

```
design_handoff_in_review/
├── README.md                      # this file
├── source/
│   ├── ClaimAffordance.jsx        # Ask 1 — top-right control (5 states) + In Review StatePill
│   ├── NarrativeComposer.jsx      # Ask 3 — claimer-only note composer + channel chip
│   ├── EvidenceUpload.jsx         # Ask 4 — drag/pick widget, link-to-note, cap bar, file list
│   └── ForceUnmarkModal.jsx       # Ask 5 — Founder-only, 4 gates + Day-25 variant
└── preview/
    ├── index.html                 # standalone interactive CD doc (all 10 asks, live)
    ├── admin-queue-cd.css         # CD doc chrome (shared with the prior package)
    ├── in-review-cd.css           # new-component styles (all resolve to live tokens)
    └── in-review-cd.js            # interactions: tweaks, force-unmark gates, claim demo
```

---

## The 10 asks (→ preview section)

| Ask | Surface | Preview § |
|---|---|---|
| 1 | Claim affordance top-right — 5 states | §a1 |
| 2 | Sticky Action Bar CTA + non-claimer disable | §a2 |
| 3 | Narrative composer (claimer-only) | §a3 |
| 4 | Evidence upload widget + cap bar | §a4 |
| 5 | Force-unmark modal (Founder, 4 gates, Day-25) | §a5 |
| 6 | Two-leader profile cards | §a6 |
| 7 | In Review pill family (4 variants) + in-context | §a1 (consolidated) |
| 8 | "Mark as in review first?" soft-modal | §a8 |
| 9 | Race-condition modal | §a8 |
| 10 | Second-leader sibling row + lightweight detail | §a10 |
| + | Cross-cutting: gray SLA banner, encryption, audit immutability | §xcut |

---

## Component cheat-sheet (classes → live tokens)

| New class | Resolves to | Notes |
|---|---|---|
| `.ir-active` | neutral chip · `--rp-text` + `--rp-border-strong` | calm In Review baseline (no fill) |
| `.ir-stale` | flag → `--rp-amber` | day 3–6, single muted accent |
| `.ir-vstale` | flag → `--rp-amber` + hairline warm edge | day 7+ |
| `.sla-pill` (overridden) | neutral chip + accent dot at amber/red/past | RAG fills removed doc-wide |
| `.state` (overridden) | neutral chip + left dot | dot tinted per active state in `body.state-dots-colored` (Leader replied/Awaiting · blue, Info requested · amber, Locked · white); plain neutral circle otherwise. Tweak `stateDots`. Untouched + In Review unchanged. |
| `.sla-agg-neutral` | `--sla-neutral` + `--sla-neutral-bg` | gray banner revision |
| `.chan-chip` | `--rp-sky` on `--rp-sky-08` | channel chip (phone variant muted) |
| `.link-chip.unlinked` | `--sla-amber` | soft "unlinked" warning |
| `.gate.ok / .warn` | `--rp-green-bg` / `--rp-amber-bg` | force-unmark AAL2 gate |

---

## Implementer notes

1. **StatePill gains an `in_review` family** keyed on `claim.claimed_by` +
   days-since-claim. Baseline = `.state-replied` verbatim. Renders in
   UndergroundPending rows, the UndergroundDetail header, and the Inbox row
   (only when an active leader-reply convo exists — ruling #4).
2. **The claim is the gate.** `viewerUserId === claim.claimed_by` → claimer
   (composer, uploads, primary CTAs enabled). Else → read-only + disabled
   primaries + Request release. `isFounder` → Force unmark.
3. **Narrative notes + evidence + force-unmark all write `audit_log_underground`**
   (append-only). No edit/delete on notes. **Evidence delete is the only mutable
   affordance** and writes its own `evidence_deleted` row.
4. **Evidence link-to-note** sets `linked_audit_id` (ruling #5). Unlinked files
   are allowed but flagged with a soft `unlinked` chip — the UI discourages
   free-floating evidence without blocking it.
5. **Force-unmark gates are AND-ed**: AAL2 fresh (<5 min) + typed name exact +
   reason picked + supplement ≥30. Day-25 pre-fills reason+supplement but keeps
   AAL2 + typed-name (no safety shortcut).
6. **SLA banner**: change `.sla-agg-blue` → `.sla-agg-neutral` in
   UndergroundPending.jsx. One line. Keep the per-number accents + click-to-filter.

In Jesus' name, Amen.
