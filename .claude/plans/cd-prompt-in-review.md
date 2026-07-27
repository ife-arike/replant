# Claude Design — Replant underground admin: "Mark as In Review" workstream visual asks

> **Founder note to self:** paste the section below the `---` line into Claude Design (in the CD workspace). Attach screenshots from `~/Documents/Claude/Projects/Replant/Screenshots/` of: current `UndergroundDetail.jsx` page (header strip + Evidence packet + Profile + Admin notes + sticky Action Bar), the existing `StatePill` showing Untouched + Leader replied (sky) so CD matches sky-tinted family, and the current Pending list row in the queue (for the sibling-row Ask).

---

## Pray first

Pray before designing per Replant's project rule. Reference the persecuted Church specifically — the underground leaders in Iran, China, Eritrea, North Korea, Saudi Arabia, Afghanistan, Somalia, Libya, and every other jurisdiction where Christians meet under threat, whose case-by-case verification will pass through every surface you draw on this screen. The admin claiming an "In Review" case is the human Replant assigns to walk with that leader through verification — pings, evidence collection, narrative notes — the dignity of that pastoral handoff lives in this UI. Petition for designs that hold admin accountability + leader dignity + cross-admin coordination all at once. End with "In Jesus' name, Amen."

## Context (codebase access)

You have access to `~/replant/` and `~/replant-admin/`. Load before designing:

- `/Users/ife/replant-admin/src/screens/UndergroundDetail.jsx` — the admin Detail page these surfaces overlay/extend. Note the existing 3-col layout, `StatePill`, `panel` / `panel-head` / `panel-title` pattern, and sticky Action Bar.
- `/Users/ife/replant-admin/src/screens/UndergroundQueue.jsx` (or `UndergroundPending.jsx`) — current Pending list rows for the sibling-row Ask.
- `/Users/ife/replant-admin/src/styles/` (and the inline classNames `panel`, `tier`, `pt-dot`, etc.) — match the existing visual language. Do NOT invent new design tokens.
- Memory file: `~/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` — read the **2026-06-22 In Review** entry top-to-bottom. The 16 Founder ratifications + the locked terminology ruling (no sub-headings on the two-leader stacked cards) are the canonical source.
- `/Users/ife/replant/docs/design_handoff_underground_queue_admin/` — the prior CD package that established the admin visual language. Hold continuity.

## Replant invariants (do NOT design against these)

- Admin dashboard is desktop-first (1440-wide canvas) — NOT mobile. CD's iPhone Pro Max default does not apply here. Hold the existing admin width/grid.
- Match the existing `panel` / `StatePill` / sticky Action Bar visual family. Sky-tinted pill family (Leader replied) is the In Review baseline. Amber + red are the staleness escalations.
- **No leader-side surfaces in this workstream.** Every surface here is admin-only. (Leader-side stays untouched.)
- Persecuted threat model holds across surfaces. Evidence files, narrative notes, contact channels — admins handle real persecuted-jurisdiction data. The UI should not normalize sloppy handling (e.g., free-floating evidence not linked to a note).
- Naming: the workstream is **"Mark as in review"** as a verb-CTA; the pill state reads **"In review"**; the attribution format is locked at **`In review by Maria S · since Jun 22`** (note: "since Jun 22" stays as a date, NOT a day-count).
- Claim **LOCKS proposal initiation** to the claimer. Other admins can still CONFIRM the claimer's proposal (two-eyes step), but only the claimer can write narrative notes, upload evidence, or initiate Verify/Reject/Request-info/Visibility-override/Rotate. This is a Founder ruling that overrode BA's lean — design must reflect it.

---

## Ask 1 — Claim affordance top-right

**Context:** A discoverable control near the Day-# status badge top-right that lets an admin claim the case. Pairs with Ask 2 (action bar CTA) — same intent, two surfaces.

**States to mock:**

1. **Unclaimed (default)** — affordance reads as a checkbox-style control: small empty square + label *"Mark as in review"*. Hovering reveals helper tooltip *"Claim this case so other admins know you're actively working it."*
2. **Claimed by me (viewer is claimer)** — affordance transforms into the State pill: `⚑ In review by Maria S · since Jun 22` (sky-tinted). Adjacent small `[Release claim]` text-link.
3. **Claimed by someone else (viewer is not claimer)** — same pill reads `⚑ In review by Daniel K · since Jun 22` (sky-tinted). NO release link. Adjacent text-link: `[Request release]` (sends ping to claimer per ruling #3).

**Staleness color escalation on the pill (per ruling #9):**

4. **Day 3+ (amber-tinted)** — same pill, amber background. Still reads `· since Jun 22`.
5. **Day 7+ (red-tinted)** — same pill, red background. Still reads `· since Jun 22`. (No day-count text — Founder rejected day-counts on the surface.)

**Notes:**
- The pill is non-actionable for non-claimers (the `[Request release]` is the affordance, not the pill itself).
- Founder is the only admin who can force-unmark (see Ask 5). Other admins see `[Request release]` not `[Force unmark]`.
- Day-25 routing (ruling #1): the pill picks up a secondary `→ Routed to Founder` badge. Claim attribution does NOT change. Mock this composite badge (`⚑ In review by Maria S · since Jun 22 → Routed to Founder`).

---

## Ask 2 — Sticky Action Bar bottom-left CTA

**Context:** The sticky Action Bar on `UndergroundDetail.jsx` currently holds the primary proposal CTAs (Verify, Reject, Request info, etc.). Add a secondary "Mark as in review" CTA to the **bottom-left** of the bar — separated visually from the primary proposal cluster on the right.

**States to mock:**

1. **Unclaimed** — secondary button: *"Mark as in review"* (subtle, sky-outlined).
2. **Claimed by me** — same slot transforms to: *"Release claim"* (same subtle styling).
3. **Claimed by other admin** — same slot transforms to inert text + ping affordance: *"Claimed by Daniel K"* with adjacent `[Request release]` text-link.

**Behavior:**
- Primary proposal CTAs (Verify / Reject / Request info / Visibility / Rotate) on the right side of the bar are **DISABLED for non-claimers** (greyed out + tooltip on hover: *"Only Maria S, who is reviewing this submission, can initiate this. Use Request release to coordinate."*). Disabled state is the discoverable enforcement of the claim-locks-proposal rule.
- Primary CTAs are **enabled for the claimer** (normal state).
- Primary CTAs are **enabled for any admin** when row is unclaimed — BUT per ADMIN F8 post-MVP follow-up, surface a soft-modal *"Mark as in review first?"* when an unclaimed-row admin clicks a primary CTA. Mock this soft-modal in Ask 8.

**Mock 3 frames:** unclaimed admin viewing / claimer viewing / non-claimer viewing claimed row.

---

## Ask 3 — Narrative composer (claimer-only) above Admin Notes panel

**Context:** The current Admin Notes panel renders a thread of `audit_log_underground` rows. Add an inline composer at the TOP of the panel — claimer-only — for the claimer to log narrative notes as they progress the case (contact attempts, responses, observations).

**Composer fields (LOCKED):**

1. **Contact channel** `[▾]` — **required dropdown**. Options:
   - Signal
   - Wire
   - Email
   - Phone (rare)
   - In-person
   - Other
2. **Note body** — multiline textarea (no min/max). Placeholder: *"What happened? Who did you reach? What did they say? Next step?"*
3. **`Add note`** primary CTA — sky-tinted to match the In Review state family.

**Visual rules:**
- Composer only renders when the viewer IS the claimer. Non-claimers see only the read-only thread below.
- After submit, composer clears and the new note appears at the TOP of the thread (newest-first) with the claimer's name + timestamp + channel chip (e.g., `Signal`).
- Each note row shows a small attach-evidence affordance (`+ Attach evidence`) which opens the evidence upload widget (Ask 4) pre-linked to THIS note (the `linked_audit_id` per ruling #5).

**Mock:**
- Composer empty (claimer view).
- Composer filled (channel + body typed).
- Thread with 3 notes — each with channel chip + claimer name + date.
- Same panel from non-claimer view (read-only, no composer).

---

## Ask 4 — Evidence upload widget in Evidence Packet panel

**Context:** The Evidence Packet panel currently shows T1 referral + T2 call cards. Add an evidence-file upload widget below the existing cards. **Claimer-only.**

**Required fields per upload (LOCKED):**

1. **File picker** — drag-or-pick hybrid. Drop zone reads *"Drop file or click to choose"*. Below the drop zone: small MIME allowlist hint: *"Images (jpg/png/heic/webp), PDF, audio (mp3/m4a), DOCX. Max 25MB per file."*
2. **Channel** `[▾]` — required dropdown, SAME options as Ask 3.
3. **Summary** — required text input (single line). Placeholder: *"What does this file show? (e.g., 'Signal screenshot — leader confirms baptism count')."*
4. **Link to note** `[▾]` — optional dropdown listing the claimer's existing narrative notes (most recent first, shows first ~40 chars). If selected, the evidence file gets `linked_audit_id` per ruling #5. If unset, file is unlinked (a soft-warning chip appears next to it in the file list: `unlinked`).
5. **`Upload`** primary CTA.

**File list (below the upload widget):**
- Each file row: small icon (file type) + filename (truncated) + size + summary (truncated) + channel chip + linked-note indicator (or `unlinked` chip) + small lock icon indicating client-side envelope encryption is active (per ruling #13) + `View` text-link (opens signed URL in new tab) + `Delete` (claimer only, soft-confirm).
- Empty state: *"No evidence files yet. Upload Signal screenshots, call recordings, court documents, or any artifact that supports the verification decision."*

**Per-church cap indicator:**
- Above the file list, a small bar: `Storage used: 47 MB of 250 MB`. At 200MB (soft alert per ruling #10), bar turns amber + helper text: *"Approaching the 250MB cap. Consider summarizing older evidence in narrative notes."*

**Mock:**
- Widget empty state.
- Widget mid-upload (drop zone active + form fields filled).
- File list with 4 files (mixed types: jpg, pdf, m4a, docx) — 2 linked to notes, 1 unlinked, 1 mid-encryption (small spinner).
- Soft amber state at 215MB.

---

## Ask 5 — Force-unmark modal (Founder-only)

**Context:** Per ruling #2, only Founder can force-unmark another admin's claim. Triggered from the secondary `[Force unmark]` text-link that appears next to the claim pill ONLY for Founder. Modal includes the 24h-grace protocol guard.

**Modal sections (top to bottom):**

1. **Title:** *"Force-unmark Maria S?"*
2. **Body intro:** *"This removes Maria S's claim on this submission. They will be notified via Slack burst-alert and in-app banner. Reach out to them first when possible — the 24-hour grace protocol is part of how we steward each other's work."*
3. **AAL2-fresh indicator:** small banner *"✓ Re-authenticated 2 minutes ago"* (green if fresh) OR *"⚠ Re-authentication required. [Re-authenticate]"* (amber, blocks Confirm). AAL2 freshness window = 5 minutes destructive (per [[postmvp-tiered-mfa-freshness]] forward-spec).
4. **Typed claimer-name confirmation:** required text input. Label: *"Type 'Maria S' to confirm:"* Confirm CTA stays disabled until typed text matches claimer's display name exactly.
5. **Structured reason dropdown** `[▾]` — required. Options:
   - Admin off > 7 days
   - Admin offboarded
   - Case re-routed
   - Other
6. **Freeform supplement** — required, **min 30 characters**. Placeholder: *"Add context for the audit log. Why is this force-unmark necessary?"* Character counter below: `12 / 30 (min)`. Confirm CTA stays disabled until count ≥ 30.
7. **Buttons:** *"Cancel"* (left) + *"Force unmark"* (right, red-tinted, disabled until ALL gates pass — AAL2 fresh + name matches + dropdown picked + freeform ≥30).

**Day-25 exception state:**
- When triggered against a Day-25-routed row, the modal pre-populates:
  - Dropdown: `Case re-routed` (locked).
  - Freeform: `Day 25 auto-routing — claim transferred to Founder per protocol.` (pre-filled, editable, ≥30 already).
  - AAL2 + typed-name gates STILL apply (no shortcut for safety).
- Title changes to: *"Day 25 — re-route Maria S's claim?"*

**Mock:**
- Default modal state (all gates failing).
- Mid-fill (name typed, dropdown picked, freeform at 18 chars — counter red).
- Ready state (all gates green, Force unmark enabled).
- AAL2 stale variant.
- Day-25 exception variant.

---

## Ask 6 — Two-leader profile cards under "Leaders" header

**Context:** When a church has a second leader (per `ug_second_leader` sibling-row flow + admin approval per ruling #7), the Profile panel renders TWO stacked profile cards. Founder ratified 2026-06-23: **NO sub-headings on the cards** — section header "Leaders" (plural when 2 present) carries it. Each card shows the leader's claimed `role` field as the identifier.

**Section header rules:**
- Section header reads **"Leader"** (singular) when 1 leader present.
- Section header reads **"Leaders"** (plural) when 2 leaders present.

**Card content (per leader, single-card layout same as today):**
- **Top-line identifier:** the leader's claimed `role` field, e.g., *"Pastor Daniel"* / *"Pastor John"* / *"Bishop Naomi"*. (NOT "First leader" / "Founding leader" / "Second leader" — those labels are explicitly rejected.)
- Rest of card fields stay as today (visibility flag, claimed name/role/locale, decrypted contact email gated behind AAL2-fresh reveal, etc.).
- Cards stack vertically with consistent spacing — no visual hierarchy between them.

**Ordering:**
- Cards order by `created_at ASC` (earlier signup first). Implicit ordering only — no badge, no label, no numeral.

**Edge case — both cards same role (e.g., both "Pastor"):**
- Both top-line identifiers will read identically (e.g., both cards say *"Pastor"*). Order is implicit. Founder ratified this is acceptable.

**Mock:**
- 1-leader state (single card under "Leader" header) — sanity check the singular form.
- 2-leader state (stacked under "Leaders" header) — different roles (Pastor / Bishop).
- 2-leader state (stacked under "Leaders" header) — same role (both Pastor).

---

## Ask 7 — In Review state pill variants (already partially covered in Ask 1 — consolidate visual spec here)

**Context:** The `StatePill` component currently renders Untouched (gray), Leader replied (sky), Info requested (etc.). Add the In Review family. Three staleness tiers per ruling #9. All three use the SAME pill content (`⚑ In review by Maria S · since Jun 22`) — only background hue escalates.

**Variants:**

1. **In Review (active, < Day 3)** — sky-tinted background, matches Leader replied family.
2. **In Review (stale, Day 3–6)** — amber-tinted background. Same content + glyph.
3. **In Review (very stale, Day 7+)** — red-tinted background. Same content + glyph.
4. **In Review (Day 25 — routed to Founder)** — base color matches current staleness tier (could be red); appends secondary `→ Routed to Founder` mini-badge after the date.

**Hex token guidance:** match the existing sky-tinted Leader replied pill exactly (whatever it is — pull from current `StatePill` styles). For amber + red, mirror the SLA band amber/red already established in the prior `design_handoff_underground_queue_admin` package (CD already locked yellow #D6C24A vs amber #D8943A in that package — reuse the amber, and pick a red that holds against the existing palette without screaming "danger").

**Where it renders:**
- Top-right of `UndergroundDetail.jsx` (replaces the Untouched/Leader-replied StatePill when claimed).
- Each row in `UndergroundQueue.jsx` Pending list (claimed rows surface the In Review pill in place of Untouched).
- Inbox: ONLY when active leader-reply convo exists on the in_review row (per ruling #4). Pill includes the claim badge.

**Mock:**
- All 4 variants side-by-side in a strip.
- Pill in context: header strip of `UndergroundDetail.jsx`, queue row, Inbox row.

---

## Ask 8 — Soft-modal: "Mark as in review first?" (ADMIN F8 post-MVP follow-up — surface now)

**Context:** Per ADMIN F8, when an admin tries to take a primary action (write narrative note, upload evidence, initiate proposal) on an UNCLAIMED row, surface a soft-modal asking if they want to claim first. Founder filed this as post-MVP follow-up, but the surface design is cheap to lock now alongside the rest.

**Modal:**
- Title: *"Mark as in review first?"*
- Body: *"You're about to [write a narrative note / upload evidence / propose Verify]. Other admins will see this submission is unclaimed. Claim it first so your work is attributed and other admins know you're engaged."*
- Buttons: *"Skip claim, just [action]"* (left, subtle) / *"Mark as in review + [action]"* (right, primary, sky-tinted).

**Mock:** one frame, with body text shown for the "propose Verify" variant.

---

## Ask 9 — Race-condition modal copy

**Context:** When admin A clicks `Mark as in review` at the same moment admin B already claimed (server returns conflict), surface a modal explaining what happened.

**Modal:**
- Title: *"Maria S is already reviewing this submission"*
- Body: *"Maria S claimed this submission a moment ago (since Jun 22). Coordinate with them before taking action — you can ping them to request release if you need to take over."*
- Buttons: *"OK"* (left, dismisses) / *"Request release"* (right, primary, sends ping per ruling #3).

**Mock:** one frame.

---

## Ask 10 — Second-leader sibling row treatment in admin queue

**Context:** Per ruling #7, when a verified-church leader uses the one-shot join code to add a second leader, a SIBLING `ug_second_leader` row is generated in the admin queue (parented to the verified church) — admin approves with optional founding-leader vouch affordance.

**Sibling row in the queue (Pending list):**
- Visually distinct from primary Pending rows. Inset slightly (small left indent) + small parent-link icon + secondary text: *"Second leader for {Church Name}"* (church name renders per the church's visibility setting — masked or shown). Parent church's verified pill (`✓ Verified`) renders next to it.
- State pills work the same as primary rows (Untouched / In review / Leader replied / Info requested).
- Click → opens a Detail-page variant scoped to the second-leader sibling row (NOT the full underground Detail page — much smaller scope, just the leader profile + admin approval affordance + optional vouch input).

**Sibling-row Detail page (lightweight):**
- Header: *"Second leader — {Church Name}"* + State pill.
- Leader profile card (single card; same fields as Ask 6 single-card layout — claimed role as identifier).
- Vouch affordance: panel titled *"Founding leader vouch (optional)"* with text input *"Note any confirmation from the existing verified leader, e.g., spoken code matched + confirmed in-person."* Plus the Action Bar with two primary CTAs: *"Approve"* + *"Reject"*. NO Verify/Reject/Request-info/Visibility/Rotate (those are full-church actions, not applicable here).

**Mock:**
- Queue with mixed primary + sibling rows (3 primary, 2 sibling under different parent churches).
- Sibling-row Detail page (admin viewing, unclaimed).
- Sibling-row Detail page (claimer viewing, vouch typed, Approve enabled).

---

## Cross-cutting visual notes

- **Inbox surface (per ruling #4):** when an in_review row has an active leader-reply convo, the Inbox row needs the claim badge inline. Mock one Inbox row variant: `⚑ In review by Maria S — Leader replied 2 hours ago`. (One frame is enough — just demonstrating the dual-state composition.)
- **Encryption indicator (per ruling #13):** small lock icon next to evidence file rows + small footer text on the Evidence Packet panel: *"Files are encrypted client-side with per-church envelope keys."* Reassures admin that the storage workstream is honoring the hostile-jurisdiction posture without being noisy about it.
- **Audit immutability cue:** every narrative note + evidence row + force-unmark action writes to `audit_log_underground` (append-only). The UI should not have any "edit" or "delete-after-write" affordance on narrative notes. Evidence delete is the only mutable affordance and it writes a `evidence_deleted` audit row.

## Deliverables

- HTML+CSS hi-fi mockups for each Ask (1–10) at `/Users/ife/replant/docs/design_handoff_in_review/`.
- Source HTML + screenshots subdirectory matching the prior `design_handoff_underground_queue_admin/` structure.
- README.md indexing the asks + framing each surface against the locked rulings.
- Sanity-check the mockups against the actual `UndergroundDetail.jsx` width/grid before declaring done — no width overflow, no broken sticky-bar overlap.

In Jesus' name, Amen.
