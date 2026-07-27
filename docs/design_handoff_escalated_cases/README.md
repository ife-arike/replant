# Escalated Cases — Admin CD (KAN-293 + KAN-295 + KAN-296 + KAN-292)

Escalated Cases is the 4th **tab** under a merged parent sidebar entry
(**Pastoral Care**, with the pastoral-signals icon) that combines **Pastoral
Signals · Flagged Messages · Replant Team Inbox · Escalated Cases** (Founder
delta 2026-06-30). The Escalated Cases tab gathers cases promoted from `/pastoral` and `/flagged`
for higher-tier triage. Three-tier visibility, a propose/approve gate on
destructive actions, the Reach Out wiring, the Close Case modal, and the
regular's "Escalate this case" touchpoint on the two source tabs.

## Run the prototype

Open `preview/index.html`. It's a live, clickable prototype of the real
admin shell. Use the **Prototype controls** panel (bottom-right) to:

- switch **viewer tier** — Admin (regular) / Super admin / Manager. Regular
  sees only 3 tabs (the **Escalated Cases** tab is hidden — anti-gossip
  rule); super_admin + Manager see all 4. The drawer action set changes
  with tier;
- click between the **4 tabs** (Pastoral Signals / Flagged Messages /
  Replant Team Inbox / Escalated Cases) — Pastoral + Flagged demo the
  regular's "Escalate this case" verb + the locked confirmation modal;
- flip the Escalated tab's **data state** — Normal / Loading / Empty /
  Error / permission **Downgrade**;
- trigger the **concurrent-proposal** failure modal.

Expand any row to open its drawer. As Manager, expand a *Proposal pending
Manager* row → **Review proposal** to approve, reject, or close.

## What's locked, and honored here

- **Voice** — clinical, peer-respecting, never coddling. No "Are you sure?";
  the confirm modal *is* the question. "audit-logged" / "destructive" /
  "the leader's account is unaffected" kept where literally true.
- **Merged parent + 4 tabs** — one sidebar entry, tab bar = the only shared
  chrome; each tab keeps its own eyebrow (Pastoral=Sensitive,
  Flagged=Moderation, Inbox=Sensitive, Escalated=Sensitive). Escalated
  Cases is hidden from the bar for regular admins.
- **Escalated tab = page view** — two stacked sections, *From Pastoral*
  (first — life-safety above moderation) then *From Flagged*, with neutral
  headers and generous spacing between them. Different columns, different
  cognition — the anti-category-collapse separation without a colored spine.
  **No Resolved/closed register is held** — once a case is closed or actioned
  (after the confirmation), it leaves the view; the disposition already lives
  in the audit log.
- **Color, with intent (goldilocks)** — color earns its place: calm/neutral
  for steady states (Open), cool sky for in-motion (Awaiting reply), warm
  amber for what needs a hand (Proposal pending Manager — white label + amber
  flag-dot — T1 expedited, pastoral lineage), red for genuine urgency
  (>14-day age, flagged lineage, revoke). SLA banner stays gray with only the 7-day
  (amber) + 14-day (red) numbers tinted — matching Underground. No glowing
  halos or loud fills.
- **Underground auto-routes here** — a flagged/pastoral message with an
  underground church as sender or recipient skips both queues and lands
  straight in Escalated Cases (regular admins have no underground access, so
  they never see it). Such rows read **Auto-routed · underground** instead of
  an escalating admin.
- **Propose → approve, in plain terms** — a proposal routes to another
  Manager to review and approve; no one approves their own. (The "two eyes"
  label was removed — it read surveillance-state.)
- **One filter dropdown** — State · Tier level · Escalated by (leader-role
  and source-axis facets dropped).
- **Listen-first action order** (Proverbs 18:13) — Reach out → Restrict
  (propose) → Revoke (propose) → Escalate → Close case.
- **Three-tier model** — regular locked out of the register entirely;
  super_admin proposes (can't execute destructive); Manager reviews + has the
  destructive set.
- **Verb labels** — "Escalate this case" (regular) · neutral "Escalate"
  (super_admin, routes up) · "Move to Escalated" (Manager — no higher tier;
  relocates a pastoral/flagged item into the register to action it) ·
  "Close case" (not Dispose) · "Restrict temporarily" (not ban).
- **Reach Out** — Option B Connect DM, attribution "*\<first\> from Replant
  Team*", 7-day auto-email fallback if no reply. SA + Manager only — regular
  admins don't reach out; on the touchpoint surfaces they can resolve a false
  alarm (Clear flag / Mark prayed-over) or escalate.
- **Confirmation modal** — verbatim, both directions: *"Your escalation has
  gone up. If further action is needed from you, someone will reach out."*
- **Case IDs** `EC-XXXXXX`, **SLA banner** 3 / 7 / 14 (gray / neutral —
  matches the Underground pending view; per-stat tinting dropped on review),
  neutral **state pills** (Open · Awaiting reply — no day countdown · Leader
  replied — sky, surfaces a re-engaged thread · Proposal pending Manager —
  white label + amber flag-dot; the "Acting" interim state was dropped), **Close-case** 8-token disposition taxonomy. Multiple
  taxonomy flags collapse to *first chip · +N* in the row (full list in the
  drawer). Underground-linked cases auto-route here (badge **Auto-routed ·
  underground**); copy is kept terse — no explanatory banners.

## CD calls on the Founder-open questions

1. **Reason categories (5)** — Destructive action is needed · Pattern across
   multiple flags · Pastoral judgment required · Cross-tier coordination
   needed · Unsure how to proceed.
2. **Manager self-initiated action** — uniform propose→approve. A Manager who
   acts first *proposes*, and it routes to **another Manager** to review and
   approve — never self-approve. (⇒ there must always be ≥2 Managers.) No
   one-click
   destructive bypass.
3. **Escalate verb color** — kept **neutral**. The tier chip already carries
   urgency; coloring the verb nudges the punitive one-click the brief warns
   against.
4. **Resolved register** — **none held**. Closed/actioned cases leave the
   surface after the confirmation; the audit log is the system of record.
   (No 14-day window needed.)
5. **Parent name** — **Pastoral Care** (with the pastoral-signals icon),
   Founder-liked; CONTENT lane may still ratify an alternative.
6. **Weekly-review tag (Q5)** + **private admin note (Q6)** — rendered as
   disabled **post-mvp** stubs in the drawer so the seat is visible.

## File map

**`preview/`** — the clickable prototype
- `index.html` · `globals.css` (lifted verbatim from `src/styles/globals.css`)
  · `escalated.css` (new classes) · `data.jsx` · `modals.jsx` · `escalated.jsx`
  · `app.jsx`

**`source/`** — build-ready scaffolds → `replant-admin/src/`
- `EscalatedCases.jsx` → `screens/` — the page (sections, SLA banner, filters,
  resolved, states, tier gate, failure UX)
- `EscalatedCaseDrawer.jsx` → `components/escalated/` — row drawer + per-tier
  action set + pending-proposal review
- `ReachOutModal.jsx` · `ProposeActionModal.jsx` · `ApproveProposalModal.jsx`
  · `CloseCaseModal.jsx` · `EscalateThisCaseModal.jsx` → `components/escalated/`
- `Shell.nav-patch.jsx` — merges the Operations siblings into one parent
  entry + the 4-tab `TriageSurface` route map + icon
- `globals.additions.css` — append to `src/styles/globals.css` (preview-only
  harness blocks flagged to drop)

Markup uses the class-based vocabulary already in `globals.css`; the
scaffolds reference `../lib/api` endpoints (`listEscalatedCases`,
`reachOutToLeader`, `proposeEscalatedAction`, `approveEscalatedProposal`,
`rejectEscalatedProposal`, `closeEscalatedCase`, `escalateCaseFromQueue`) and
a `lib/role-humanisation` helper — both to be wired on build. Destructive
*execution* + the leader-side experience are out of scope (Leader Suspension
Lifecycle ticket) and render stubbed.
