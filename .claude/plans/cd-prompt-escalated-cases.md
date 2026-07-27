# CD BRIEF — Escalated Cases admin surface (KAN-293 + KAN-295 + KAN-296 + KAN-292)

## Opening prayer (hard rule)

Open this work with a real intercession naming the leaders whose accounts will be acted upon through these screens — pastors whose congregations were hit by a flag they didn't see coming, leaders signaling distress that escalated past first-tier triage, brothers and sisters whose Replant access hangs on the disposition a Manager will reach for at 11pm after a long day. Cover Ruth and her admin team — that the design slows their hand at the moments when slowing down is the costliest, and obvious when obvious-action is the right one. Cover the seat itself; this is the place where pastoral care and platform safety meet, and it has to bear weight. Cover this work in the blood of Jesus Christ. End with "In Jesus' name, Amen."

## Who you are

Senior design lead at Replant, holding the global persecuted-church endgoal as your stress-test. You design admin surfaces that admins will work for hours under pressure; you carry [[feedback-replant-admin-copy-voice]]'s register — clinical, peer-respecting, never coddling. Words like "audit-logged" are features, not warnings. Honest about mechanism over reassurance. You design for the admin who has revoked four leaders today and needs the surface to keep her honest on the fifth case.

## What Replant is

A secure communication platform for Christian leaders globally, including underground/persecution-zone leaders. The admin dashboard at `admin.projectreplant.org` is operated by Ruth and a small team across three tiers: `regular` (line admins), `super_admin` (middle tier — promoted from regular via two-eyes ceremony), `Manager` (top tier; display rename from `top_tier` enum). Manager-tier admins hold destructive write authority; super_admin proposes, Manager approves.

## What you're designing — Escalated Cases (NEW admin sibling page)

A NEW admin surface that gathers cases promoted from `/pastoral` and `/flagged` for higher-tier triage. Three-tier visibility model. Mirrors the propose/approve pattern from `/underground` (KAN-272 confirm-proposal flow). Ships with the Reach Out wiring, Close Case modal, and per-tier escalate verbs landing on the existing `/pastoral` and `/flagged` surfaces.

**Out of scope for this CD pass:** destructive action execution (revoke / temp restrict / 3-strikes auto-deactivate) — those land in a separate Leader Suspension Lifecycle ticket. On the Escalated Cases surface, these affordances render as PROPOSE buttons for super_admin and APPROVE / REJECT / CLOSE buttons for Manager (over a pending proposal). The actual destructive endpoints + leader-side experience come later.

**Four surfaces:**

1. **`/escalated` — Escalated Cases page** (sibling in nav, Operations / Sensitive lineage)
2. **Row expand drawer** — case detail + action drawer per source axis + per tier
3. **Modal family** — Reach out compose / Propose action / Approve proposal / Close case / Regular's "Escalate this case" modal (the latter rendering on `/pastoral` + `/flagged`)
4. **Empty / loading / error / SLA aggregate banner states**

## Files to READ before designing (critical for grounding)

**Admin surfaces — read for pattern + chrome continuity:**

- `/Users/ife/replant-admin/src/screens/PastoralQueue.jsx` — sibling Sensitive surface; TriageDrawer pattern + colored-row chrome + Care-not-surveillance info banner register
- `/Users/ife/replant-admin/src/screens/Flagged.jsx` — sibling Moderation surface; flagged row chrome + Escalate verb current home
- `/Users/ife/replant-admin/src/screens/Underground.jsx` — sibling Sensitive surface with tabs; propose/approve pattern reference
- `/Users/ife/replant-admin/src/screens/UndergroundPending.jsx` — SLA pill pattern + State pill pattern + filter primitives (FiltersTrigger + DropdownPanel) to mirror
- `/Users/ife/replant-admin/src/components/Shell.jsx` — admin sidebar NAV_SECTIONS; you'll insert the new `/escalated` entry under Operations between Pastoral Signals and Flagged Messages
- `/Users/ife/replant-admin/src/components/underground/HardDeleteConfirmModal.jsx` — destructive-confirm pattern (typed-code or required-reason) — mirror style
- `/Users/ife/replant-admin/src/components/underground/ForceUnmarkModal.jsx` — structured-reason dropdown + freeform pattern (≥30 char). The dispose modal lifts this pattern directly.
- `/Users/ife/replant-admin/src/components/underground/ProposeVerifyPanel.jsx` + `ConfirmProposalModal.jsx` — propose/approve ceremony pattern lift
- `/Users/ife/replant-admin/src/styles/globals.css` — admin design tokens (CSS variables: `--rp-amber`, `--rp-red`, `--rp-sky`, `--sla-yellow`, `--sla-amber`, `--sla-red`, `--state-*`, `--rp-faint` etc.)

**Schema / state shape — read so the column set is grounded:**

- `/Users/ife/replant-admin/netlify/functions/list-pastoral-queue.js` — pastoral row response shape
- `/Users/ife/replant-admin/netlify/functions/list-flagged-messages.js` — flagged row response shape
- `/Users/ife/replant-admin/netlify/functions/triage-pastoral-action.js` — TRIAGE_ACTIONS enum, escalate_to_admin behavior
- `/Users/ife/replant-admin/netlify/functions/escalate-flag.js` — current escalate path on flagged surface

**Reach Out wiring (Option B — Connect DM via KAN-220):**

- `/Users/ife/replant-admin/netlify/functions/send-team-reply.js` — KAN-220 reply primitive; the Reach Out modal lifts this with admin freeform body + "Admin Name from Replant Team" attribution

## Locked rulings (inline-quoted — paste-ready)

### Voice register (LOAD-BEARING)

> Replant admin copy is clinical, peer-respecting, never coddling. Banned phrases: "Are you sure?" / "Oops!" / "Heads up!" / "Don't worry, this can be undone" / "Please" before action verbs in CTAs / "Permanently" used loosely. Em dashes inside button labels read apologetic — avoid. Keep heavy phrases when literally true: "audit-logged" (Founder-stamped feature), "destructive" (when literally so), "cannot be undone" (when literally so), "the leader can no longer sign in" (when literally so). Trust admins to be competent — the confirm modal IS the "are you sure"; don't repeat the question inside it.

### Typography register

> scriptureItalic font asset reserved for scripture / editorial / witness quotes ONLY. All other copy roman. Don't italicize for emphasis or decoration on admin screens.

### Three-tier visibility model (Founder-locked 2026-06-30)

> **Regular admin** — CANNOT see the Escalated Cases page. Locked out entirely from nav + route. After they hit "Escalate this case" on `/pastoral` or `/flagged`, the case disappears from THEIR view. They do not track resolution. Founder rationale (verbatim): *"cases are out of their hands and view after escalate, no need to stir up potential gossip allowing them to follow along with the case in SA or managers hands."*

> **super_admin** — sees the Escalated Cases page. Can dispose / reach out / propose destructive actions. CANNOT execute destructive actions directly. Can further-escalate cases UP to Manager via a per-row verb.

> **Manager** — sees the Escalated Cases page with full destructive-action set. Only tier with destructive write authority (deactivate, restrict-execution, etc.). Sees super_admin's pending proposals + can approve / reject / close them.

### Surface chrome (Founder + CONTENT locked)

- Eyebrow: `Operations / Sensitive` (MIRRORS Pastoral + Underground; NOT `/ Moderation`. Sensitive carries account-level destructive paths; Moderation carries message-level actions).
- Title: **Escalated Cases**
- Meta strip: `N open · N at the 7-day mark` (illustrative — use SLA buckets below)

### Two sections by source axis (CONTENT — anti-category-collapse blocker)

> The two source axes carry semantically different signals and need different cognition from the admin. Pastoral-escalated rows = the sender is in crisis (self-harm, despair, persecution panic) — Manager's question is "how do we care for this leader?". Flagged-escalated rows = the sender is potentially a bad actor (location-disclosure attempt, identity probe, spiritual coercion) — Manager's question is "do we sanction and does the recipient need follow-up?". A unified row template with all actions on every row produces predictable failure modes — a tired admin one-clicks "propose revoke" on a pastoral-escalated row, silencing a brother in distress.

Render two sectioned sub-surfaces under one page:

- **From Pastoral** — amber accent lineage (continuous with `/pastoral`)
- **From Flagged** — red accent lineage (continuous with `/flagged`)

Pastoral section renders FIRST (life-safety always above moderation).

### Listen-first action order (CONTENT pastoral framing — locked)

> Anchored in Proverbs 18:13. Action buttons on every row arranged: **Reach out → Restrict (propose) → Revoke (propose) → Close case.** Let the visual flow nudge the right disposition without writing a single instruction.

### Verb labels (Founder-ratified 2026-06-30)

- Regular admin on `/pastoral` + `/flagged`: **"Escalate this case"** (no recipient implied)
- super_admin + Manager on Escalated Cases: a NEUTRAL "Escalate" verb on each row (escalation chain is implicit in tier hierarchy — super_admin's "Escalate" routes UP to Manager; Manager has no higher tier so this verb is absent or grayed out for them)
- Dispose verb: **"Close case"** (NOT "Dispose" — warehouse-disposal energy)
- Temp ban renaming: **"Restrict temporarily"** (Replant has pastoral relationship with leaders even ones who escalated; restriction is what a parent or pastor does; "ban" is a Reddit register)

### Reach Out — Option B (Connect DM via KAN-220) + 7-day auto-email fallback

> Primary channel: Connect DM via KAN-220 `send-team-reply.js`. Welcome DM is fully in place across the verified-leader network. Sender attribution on the leader's Connect thread: **"Admin Name from Replant Team"** — hybrid that's neither pure KAN-220 ("Replant Team" alone) nor pure leader-DM (full name + church). Founder framing: *"better bedside."* Surfaces admin's first name + "from Replant Team" affiliation; church / role / region NOT shown.
> 
> Auto email-fallback: if no leader reply within **7 days** of the Connect DM, the system auto-sends a UG-identity-scrubbed email leading them back to the Connect tab. CD does NOT design the email body; it's a server-side automation triggered by elapsed-time cron. CD MAY surface "auto-fallback fires in N days" indicator on the case row for admin awareness.
> 
> Per-leader rate limit: 1 reach-out per 24h per leader (BE-enforced).

### Confirmation modal (cross-tier — used by both escalation paths)

> Locked verbatim: *"Your escalation has gone up. If further action is needed from you, someone will reach out."* Do NOT reframe per tier; single phrase, both directions (regular→SA, SA→Manager).

### Regular's "Escalate this case" modal (on `/pastoral` + `/flagged`)

When regular hits Escalate this case:

- Title: **Escalate this case**
- Sub: routes UP for super_admin or Manager review · audit-logged
- Body: "Describe why you're escalating. Once submitted, the case leaves your view — if further action is needed from you, someone will reach out."
- **Reason category dropdown** (locked options, Founder-seeded):
  - "Destructive action is needed"
  - "Above my pay grade"
  - "Unsure how to proceed"
  - (final 5-7 token list — your call to refine, with CONTENT register)
- **Freeform supplement** (required, ≥30 chars, scrubAndCap-bound): "Add context"
- CTAs: Cancel [ghost] / Escalate [primary]
- On submit → server creates Escalated Cases entry → row disappears from `/pastoral` or `/flagged` → confirmation modal fires with the locked copy above

### super_admin's "Propose action" modal (on Escalated Cases row)

When super_admin proposes restriction / revoke / further-escalation:

- Title: **Propose action**
- Sub: super_admin can propose; Manager will approve, reject, or close · audit-logged
- **Action dropdown:** Restrict temporarily / Revoke access / Escalate to Manager (further-escalate, which doesn't request destructive — just routes UP for Manager attention)
- **Reasoning** (required, ≥30 chars): "Why is this action needed?"
- CTAs: Cancel [ghost] / Send proposal [primary]
- On submit → confirmation modal (same locked copy)

### Manager's "Review proposal" affordance

For each pending proposal in the case drawer:

- Proposal context: who proposed (super_admin's first name + "from Replant Team" attribution), when, action requested, reasoning text (full, not truncated)
- CTAs (per proposal): Approve [primary] / Reject [ghost-amber] / Close [ghost-muted]
- Approve fires the (stubbed-for-now) destructive endpoint OR the further-escalate routing
- Reject closes the proposal but keeps the case in the queue for SA to pick a different action
- Close ends the case entirely (Manager judged no action needed)

### Close case modal (KAN-295 — CONTENT taxonomy locked)

- Title: **Close this case**
- Sub: records the disposition · the case leaves the register · the leader's account is unaffected
- Body: "Closing a case removes it from the escalated register. The disposition you choose is recorded against the case in the audit log — pick the option that most honestly reflects how the situation resolved."
- **Disposition dropdown (LOCKED 8 tokens):**
  - `resolved_by_reach_out` — "Resolved — leader replied, situation closed"
  - `resolved_no_outreach` — "Resolved — no outreach needed"
  - `false_signal` — "False signal — no action warranted"
  - `routing_misclassification` — "Routing misclassification — belonged on another queue"
  - `access_revoked` — "Access revoked — case acted on" (auto-pickable from Approve-revoke flow)
  - `restriction_applied` — "Restriction applied — case acted on" (auto-pickable from Approve-restrict flow)
  - `escalated_to_super_admin` (when Manager closes a case that needs further super_admin attention — rare reverse direction) or `escalated_to_manager` (the common direction) — "Escalated to higher tier — out of this register's scope"
  - `pending_external` — "Pending external — leader being followed up offline"
- **Notes supplement** (required, ≥30 chars, scrubAndCap-bound): "Add context for the audit log. Why this disposition?"
- CTAs: Cancel [ghost] / Close case [primary]

**Deliberately excluded** (per CONTENT, ratified):
- "abusive — pattern of behavior" (a pattern produces destructive action, doesn't close a case — adding tempts admins to close without taking the action the pattern demands)
- "leader requested closure" (leaders have no visibility into the register)

### Reach Out modal

- Title: **Reach out to <Role + First name>** (use the locked role-humanisation table; underground rows use "A fellow [Role]" per [[reference-anon-identity-rules]])
- Sub: opens a Connect DM thread in your name · sender shown to leader: *<your first name> from Replant Team* · audit-logged
- Body: "This opens a direct conversation with the leader in the Connect tab. Write in your own voice — no system message is generated. The leader sees the thread as a Connect DM from you, framed as Replant Team. If they don't reply within 7 days, a UG-identity-scrubbed email automatically follows up to bring them back to the app."
- **Compose textarea** (required, ≥1 char, no upper cap besides server-side limit; scrubAndCap-bound at send; UG-identity-leak scan if leader is underground): "Your message"
- CTAs: Cancel [ghost] / Open thread [primary]

### Case ID convention (LOCKED — `EC-XXXXXX`)

- 6 uppercase alphanumerics, mirrors `RPL-XXXXX` church register
- Surfaced on every row + every modal title bar + every audit-log row's `meta.case_id`

### SLA aggregate banner (LOCKED — 3 / 7 / 14 days)

Top-of-page banner:

```
SLA · this register
  N cases open more than 3 days
  N cases open more than 7 days       ← amber
  N cases open more than 14 days      ← red
```

Click on N → filters the section to those rows. Mirror Underground SLA banner styling.

### Row layout (per section — distinct columns)

**From Pastoral rows:**
- Case ID (`EC-XXXXXX`) — mono
- Sender (the leader in distress) + Role + Church (or "A fellow [Role]" for underground)
- Original tier chip (T1 expedited / T2 amber from pastoral taxonomy)
- Escalation reason (scrubbed text the regular admin entered, 1 line clamp)
- Escalated by (regular admin's first name + tier chip) + when
- Anchor message preview (1 line clamp)
- StatePill: Open / Awaiting reply / Proposal pending Manager / Acting
- Age column with red-dot tint at >72h
- Expand chevron → row drawer with full thread + actions

**From Flagged rows:**
- Case ID (`EC-XXXXXX`) — mono
- Sender → Receiver (both with Role + Church or anon-by-rules)
- Taxonomy chips (the admin-routing flag_reason codes)
- Escalation reason + escalated by + when
- Message preview (1 line clamp; full content via the existing read-logged audit path on expand)
- StatePill + Age column same as above
- Expand chevron → row drawer

### State pill states (mirror Underground pattern)

| Pill | When | Color |
|---|---|---|
| Open | Case on register; no action taken yet | sky |
| Acting | An action has been Approved + executed but case not yet closed | amber |
| Awaiting reply | Reach Out initiated, leader hasn't responded (with N-of-7-days countdown) | sky-dotted |
| Proposal pending Manager | super_admin proposed, Manager hasn't approved/rejected/closed yet | amber-tinted |

### Empty + error states

```
EMPTY:
  Label:   No escalated cases
  Message: The admin queue and pastoral queue haven't produced any
           escalations needing case-level action.

ERROR:
  Label:   Couldn't load escalated cases
  Message: See the error above. The register did NOT load — this is
           not the empty state.
```

### Resolved (last 7 days) collapsible section

Below the two pending sections, render a third **Resolved (last 7 days)** collapsible section. Default collapsed with count badge. When expanded: dispositioned rows with action taken + admin + reason + timestamp. Older lives in `/audit`.

## What the leader experiences (transparency ledger — design honesty)

This isn't surfaced in admin UI but YOU must hold it. Your copy in admin modals must match what actually happens to the leader.

| Admin action | What the leader sees |
|---|---|
| Reach out (Connect DM) | New Connect message thread from "<your first name> from Replant Team" |
| Auto-email fallback (after 7 days no reply) | Generic UG-identity-scrubbed email; CTA "Open in app" → Connect tab |
| Close case | Nothing — they have no visibility into the case register |
| Propose restrict (super_admin) | Nothing yet — proposal isn't executed |
| Approve restrict (Manager) | (Suspension-lifecycle ticket — out of CD scope here; render as stubbed-disabled in your design) |

## Filter affordance

Mirror Underground.jsx FiltersTrigger + DropdownPanel pattern. Three facets:

1. Source axis — From Pastoral / From Flagged (default both shown)
2. Leader role — by `users.role` enum, role-humanisation per [[reference-role-humanisation]]
3. Escalated by — admin first name dropdown (for Manager auditing super_admin's escalation patterns + super_admin auditing regulars')

Sort defaults: age descending (oldest first). Sub-sort: tier descending (T1 expedited above T3 standard).

## Failure UX (you must design)

- Server-down on page load — error state with retry; do NOT fall back to a partial render
- Realtime drops (case action lands but FE didn't refresh) — debounced full-refresh on focus return
- Optimistic update on Close Case fails — undo the optimistic close + surface error + keep case in register
- Concurrent action on same case (two SAs propose simultaneously) — second submit shows "This case has a pending proposal — refresh to review" + refresh affordance
- Permission downgrade mid-session (admin demoted from super_admin to regular while on the page) — server rejects next action with 403; FE clears the surface + routes home with copy explaining permission change

## Open questions to surface back to Founder

CD has good instincts — flag anything the brief didn't resolve:

1. Reason category dropdown for regular's escalate modal — Founder seeded 3 options ("destructive action is needed" / "above my pay grade" / "unsure how to proceed"). Propose the full list (5-7 tokens) with CONTENT register. Examples worth considering: "Pattern across multiple flags" / "Pastoral judgment required" / "Cross-tier coordination needed" / "Underground-adjacent — needs UG-trained eyes."
2. Should Manager's queue surface their OWN action-set proposals separately (Manager wants to act on their own initiative — they're top tier, no propose-needed)? Or does Manager always have one-click destructive verbs that bypass the propose flow?
3. Should the per-tier escalate verb on `/pastoral` and `/flagged` change CTA color (sky default → amber when row has been Tier 1 chip'd to signal urgency at-a-glance)? Or keep neutral.
4. Resolved section — last 7 days, or different window?
5. Should there be a "Manager team meeting" affordance — a way for Manager to tag a case for the next weekly review meeting (Founder + accounts@ + Manager) without disposing it? Out-of-scope for MVP probably; flag if you'd argue it in.
6. Per-case private admin note thread — deferred per ADMIN SME lane (post-MVP); confirm by rendering disabled OR omit entirely.

## Deliverable format (your standard)

Hi-fi desktop browser mockups (1440 + 1024 + 768 responsive breakpoints — match the admin shell's existing breakpoints) + JSX component scaffolds for the load-bearing components. Cover:

- `/Users/ife/replant-admin/src/screens/EscalatedCases.jsx` — the new page component
- `EscalatedCaseDrawer.jsx` — row expand drawer (with per-tier action set)
- `ReachOutModal.jsx`
- `ProposeActionModal.jsx` (super_admin only)
- `ApproveProposalModal.jsx` (Manager only — for pending proposals)
- `CloseCaseModal.jsx`
- `EscalateThisCaseModal.jsx` — renders on `/pastoral` + `/flagged` for regulars
- Updated `Shell.jsx` sidebar entry between Pastoral Signals + Flagged Messages with `requiresTier: 'super_admin'` (admits Manager too via tier ranking)
- New CSS class additions to `globals.css` for any new tokens (try to reuse existing — `--rp-sky`, `--rp-amber`, `--rp-red`, `--sla-*`, `--state-*` should cover almost everything)
- Preview HTML at `docs/design_handoff_escalated_cases/preview/index.html` showing all the states inline

Source scaffold convention from prior briefs: drop `source/*.jsx` files as spec scaffolds — load directly into `replant-admin/src/components/` on build; lift the rest of the markup from the preview's class-based markup against globals.css.

## Closing

This surface is where pastoral oversight and platform safety meet. Galatians 6:1 — *"Brothers and sisters, if someone is caught in a sin, you who live by the Spirit should restore that person gently. But watch yourselves, or you also may be tempted."* The clinical register, the listen-first action ordering, the propose/approve gate on destructive actions — all of it is the structural defense against the admin's own temptation to use the surface punitively. Your design carries that responsibility. Words land on hearts. Let these land honestly.

In Jesus' name, Amen.
