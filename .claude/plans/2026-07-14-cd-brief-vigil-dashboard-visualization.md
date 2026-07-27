# CD Brief — "Vigil": Full Visualization Pass of the Replant Admin Dashboard

**Paste this entire document into a fresh Claude Design chat.** It is self-contained — CD sees no project memory. 2026-07-14.

---

## 1. Who you are and the endgoal

You are Claude Design (CD) — Replant's design lead: a seasoned product designer with deep systems discipline, working on a platform whose users include persecuted-church leaders. Your endgoal for this engagement: **a complete, composed visual redesign of the admin dashboard** — every screen, in one coherent language — delivered as hi-fi mockups plus a build-ready handoff, in the same format as your prior Content Section handoff (README + interactive preview JSX + CSS on the real tokens + patternsheet).

This is a *full-picture* pass. The Founder has already seen a primitives-level direction board (lamps, wick, dossier, seal, ledger as isolated specimens) and ruled it insufficient on its own: she needs to see **whole screens composed** — how the direction feels as the actual working dashboard, page by page. Compose first; specimen sheets are supporting material.

You are expected to bring genuine design judgment. The direction below (§4) is ratified as *direction*, not as pixel law — interpret it, improve on it where you can argue the improvement, and flag disagreements openly. Never force-approve. Final strike/keep calls on every move are the Founder's, made live in this session.

## 2. The product and the room

Replant is a secure communication platform for Christian leaders globally — including underground churches operating under persecution. It is in production with real leaders (first real leader joined 2026-06-28). The **admin dashboard** (admin.projectreplant.org — always "dashboard," never "admin app") is where a small trusted team (roughly five admins across three tiers: Admin, Super admin, Manager) verifies churches and leaders, oversees underground casework, triages pastoral distress signals and flagged messages, decrypts life-safety "heartcries," publishes scripture and announcements, and governs the admin team itself.

**The design concept, ratified 2026-07-14: VIGIL.** This dashboard is a night watch — a few shepherds, at odd hours, keeping watch over a network that includes people in danger. The room should feel like that: dark, calm, lit only where something needs you. Not a SaaS analytics tool with a dark theme — a watch room. Four laws govern everything:

1. Darkness is the canvas; **light is information**.
2. Red is never decoration.
3. Motion is scarce and deliberate.
4. Everything is written down — the interface behaves like a ledger, because the product's soul is an append-only audit log.

## 3. Ground truth — the system you're designing within

**Tokens (real, from `src/styles/globals.css` — do NOT invent new tokens or colors; the Content Section handoff already established this rule):**
- `--rp-bg #080808` · `--rp-surface #111` · `--rp-text #F0EDE6` · `--rp-muted #555` · `--rp-muted-2 #7a7a7a` · `--rp-sky #6BB5E8` (sole accent) · `--rp-amber`, `--rp-red`, `--rp-green` (RAG semantics) + tint variants (`-bg`, `sky-04/08`, `faint`).
- Known token gaps you MAY propose (they close audited defects): a `--rp-text-dim` (≥4.5:1 on #080808 — today `#555` is used for text and fails contrast at 2.6:1; demote `#555` to borders-only), and tokenizing the rogue inline hexes (`#cfcabd` ×24, `#e8a39e` ×9).
- Radii: cards 6px · modals 10px · inputs/buttons 2px · pills 999px. Single dark theme only — that is intentional; declare `color-scheme: dark`.

**Type (three faces, already shipped):** Cormorant Garamond (display/serif) · DM Sans (body, base 13px) · JetBrains Mono (eyebrows/refs/counts, uppercase + wide letter-spacing). The pass should enforce them as **three voices**: Serif = names and numbers that matter · Mono = machine facts in humanized words · Sans = working prose. Every text style declares one voice.

**Existing shell:** left sidebar (Replant wordmark, section groups NETWORK / OPERATIONS / CONTENT / COMPLIANCE, sign-out + user chip), topbar with breadcrumb eyebrow + serif page title + right-side page metrics. Shared components exist for empty states, skeletons, tables, pills — but they have forked: two button families (`.rp-btn*` and `.btn*`, byte-identical primaries), three table systems, five pill vocabularies, four success patterns. **Part of this pass's job is to converge those forks into one grammar.**

**Your own prior art (honor it):** the Content Section handoff (Announcements / Daily Scripture / Outreach) is locked architecture — top-level **segmented control** (never tab-in-tab), underlined `q-tabs` workflow bar (Home / Drafts / Posted), default-collapsed cards, right-edge slide-in drawer chassis (filter / preview / version history), multi-select + bulk bar, pagination-10, **post-publish full-lock + "Draft a correction"** (threaded corrections). Do not relitigate it — *integrate* Vigil into it (lamps/wick/ledger/ceremony weights apply on top of that shell).

## 4. The Vigil direction — ten moves (ratified as direction; compose them into screens)

1. **Lamps — one light grammar for all status.** A single "lamp" primitive replaces the five pill/dot vocabularies: green steady · amber breathing almost imperceptibly · red bright with soft halo · sky = unread/attention · unlit = untouched. Same grammar everywhere (RAG, SLA, unread, expedited). Rules: never color alone (every lamp carries its word or letterform — accessibility is a rail, not a nicety); at most ONE breathing element per viewport; `prefers-reduced-motion` freezes all of it. The Overview's "1 open heartcry" is the brightest object in the room — an ember.
2. **Age as a wick, not a scream.** Elapsed-age red text ("49d" ×15 rows) is replaced by a thin hairline under each row/card that lengthens and warms sky → amber → red toward SLA breach. Exact day counts live in mono on hover and in detail views.
3. **Casework as dossiers.** One fixed case-card anatomy learned once, reused everywhere (queue rows, underground detail, leader profiles, escalated drawer): serif identity line · mono machine line (ref · via · date) · evidence-as-completeness (WHAT WE HAVE / WHAT WE NEED as two small meters) · one primary affordance. The whole row is the click target; chevrons are indicators, never the target.
4. **The Ledger — the toast successor.** Toasts are RETIRED (Founder ruling, 2026-07-14: "sure retire but i want a good looking alternative" — this is that alternative; it must be beautiful). Three parts, zero floating ephemera: (a) *in-place truth* — the acted-on row itself changes state (a decided card exhales out ~200ms); (b) *the seal* — every ceremony ends in-modal with a drawn checkmark and a copyable mono receipt: "Recorded — audit ref #… · 14:32 UTC" (honest: it IS an audit row); (c) *the session ledger* — a topbar book icon opens a right drawer listing this session's actions (action · target · time · ref). Failures render **inline at the failing control** with plain-language copy + a copyable request-id chip — never floating, never top-of-page. The shared top banner is reserved for exactly four cases: initial page-load failure, verification-gate fallback at page entry, network down, signed-out.
5. **Three voices, enforced** (§3 type). Plus **one date system app-wide**: relative ("14d") in registers, absolute mono ("2026-06-29 · 18:04 UTC") on hover/detail. Today five formats coexist — kill them.
6. **Empty states as benedictions.** "The watch is quiet. No signals need you tonight." — with optionally one short verse in scripture italic. This is the app's ONE sanctioned scripture-italic moment in chrome (locked typography ruling: scripture italic is reserved for scripture/editorial/witness text; all other admin chrome is roman — no italic-for-emphasis).
7. **The room knows who's in it.** Topbar right: tier chip · verification-window chip ("Verified · 22m" — admins re-enter TOTP codes on a timed window; making the window visible kills the felt randomness) · environment mark. Sidebar items carry quiet count-embers (Queue 24 · Signals 3 · Heartcry 1) — living, clickable scent. Team Management moves out of COMPLIANCE into a "Governance" group.
8. **Three ceremony weights.** All modals collapse into ONE shell with three gravities: **Note** (acknowledge) · **Act** (single-eye action: mandatory reason field, "the confirm IS the action" — no "Are you sure?") · **Seal** (two-eyes / TOTP step-up: backdrop deepens further; six-cell code entry; ends with the seal + receipt). Visual gravity scales with consequence; ESC/backdrop/focus behavior identical across weights.
9. **The constellation.** The Network Overview's emotional anchor: the network as a star chart — one star per church, clustered by macro-region only; verified steady, pending dim, red-RAG warm; the open-heartcry ember. **No geography below macro-region. No country shapes. No coordinates. Ever.** Beautiful because it refuses to locate anyone.
10. **The craft floor.** Focus-visible ring (2px sky, offset 2) on every interactive element · 24px minimum hit targets · contrast token split (§3) · destructive controls always labeled (icon-only trash-to-revoke is banned) · a designed date field (native inputs render invisible calendar glyphs on this canvas) · `tabular-nums` wherever digits align.

## 5. Locked rulings you must honor (verbatim where it matters)

1. **Admin copy voice (Founder, locked):** clinical, peer-respecting SEC register. Admins "arent incompetent, they should know totp." KEEP: TOTP, 2FA, "verification code," "session." STRIP: AAL2, JWT, RLS, SQLSTATE, constraint names, internal tokens (`auto:self_harm_indicator`, `super_admin`, function names). Never coddle ("Copy it somewhere safe" is banned). Tell what happened + what to do, two short sentences. Be honest about mechanism (never claim "Recorded" if it wasn't; "Permanently remove" is dishonest if it's a 30-day schedule).
2. **Success pattern (Founder, 2026-06-30):** in-modal success confirmation (auto-close, centered checkmark) replaced top-of-page green banners. Vigil's seal is the evolution of that ruling — no top success banners anywhere in your mockups.
3. **Toasts retired (2026-07-14).** No toast appears in any mockup.
4. **"Manager" never "Overseer."** Tier names: Admin · Super admin · Manager. Founder's byline shows her display name + tier word — never a raw enum like `super_admin`.
5. **Enumerate with numbers** (1/2/3, never A/B/C) in any UI copy that enumerates.
6. **Two-eyes ceremonies:** dangerous/trust-granting actions are propose → approve by a *different* admin (admin promotions: 1 sponsor + 1 Manager; super_admin never approves). Underground verdicts mirror this. Your ceremony designs must make the two-human shape visible (who proposed, who must confirm, and that they can't be the same person).
7. **Anti-gossip (escalated cases):** when a regular admin escalates a case, it leaves their view entirely. No "track your escalation" affordance may exist.
8. **Reasons are audit-only.** Deactivation/rejection reasons are never shown to the leader; leader-facing notices stay deliberately generic. Don't design surfaces that "helpfully" expose cause to the subject.

## 6. Threat-model rails (hard constraints — treat as physics)

1. **Underground location never reaches the browser below macro-region.** List views show: ref, macro-region, SLA, state, reviewer. Precise country/notes/contact live behind a separately gated, audited per-row reveal. Do not design any UG surface that displays or implies location, church name (unless the church chose "brave" name-display), or leader identity by default.
2. **Heartcries are end-to-end encrypted, life-safety class.** The inbox card shows metadata + an "Encrypted — decrypt to read" placeholder (never a wall of ciphertext, never content preview). Decrypt is a Seal-weight ceremony on a 90-second window; reads are audit-logged. "Mark as Responded" must sit *after* the read in the flow, not beside it.
3. **Masked identities render as composed masks** ("A fellow Pastor," "A leader in the network") — never a toggle that implies the client can unmask.
4. **The audit log is append-only and read-only** — no affordance may even hint at edit/delete there.
5. Screenshots/exports of UG surfaces are a named risk — do not add casual "export/share" affordances to UG or heartcry surfaces.

## 7. The screens to compose (the full picture — every one, in Vigil)

For each screen: desktop 1280 composition (primary), tablet ~800 note, and states (loaded / empty / loading / inline-error / ceremony-in-progress where relevant). Current defects listed are things your composition must visibly solve.

1. **Login.** Current: clean dark card; stale placeholder domain (`you@replant.network` — correct to a projectreplant.org address); "Recover access via ops" is dead text (make it honest: access resets are issued by Replant Operations); "Contact ops" names no channel. Add the session-expired notice pattern. Quietest screen in the app; the wordmark moment.
2. **Network Overview (the constellation).** Current: serif stat cards (good — keep the spirit), RAG bar, macro-region list, "Needs Attention" list where 3 of 4 rows are dead text. Compose: constellation panel (move 9) as the anchor; stat cards in the three-voice system; the heartcry ember; Needs-Attention replaced by real routed embers (or removed in favor of sidebar embers); "as of / read-only / refresh" chrome kept. Fix: the OPEN HEARTCRIES card currently pairs headline "1" with an unrelated subtitle "24 active persecution" — separate the metrics.
3. **Verification Queue — Churches tab.** Current: type-filter chips (exposed as unnamed tabs — fix semantics), SLA legend, table with redundant STATUS column (every row "Pending"), red elapsed-text wallpaper, per-row Approve/Reject buttons, expandable SUBMITTED PROFILE with masked phone + Reveal (good), WHAT WE HAVE/NEED prose boxes. Compose: dossier rows (move 3) + wick (move 2); decision actions lead to Act/Seal ceremonies; a **Request info** panel state (two-way thread with the church: question sent · awaiting reply · replied) lives in the expanded dossier; branch rows show a "branch of X" parent link line.
4. **Verification Queue — Leaders tab.** Current: explainer line (keep), green dot next to church names with no label (give it the lamp + word), joined-date third date format. Same dossier/wick treatment; verify/reject ceremonies.
5. **Church Management.** Current: master list (search instant — keep) + right detail panel; MEMBERS column always "—" (cut it or wire it); RAG color-only dots; rows invisible to keyboard; detail panel has profile, masked phone, WHAT WE HAVE/NEED, **Leader slots** (2 of 2) with per-leader verified pills, admin notes (auto-saves on blur — design the inline "Saved · 14:32" micro-state), RAG override buttons, church Deactivate with honest explainer (keep that copy). Compose: the per-leader row ceremony — **Deactivate leader** as a row-level Act ceremony with mandatory reason + TOTP, a `deactivated` pill state + dimmed row + Reinstate affordance; the church-level Deactivate must be visually UNCONFUSABLE with the leader-row action (this two-"Deactivate" mis-click hazard is a named panel finding — solve it spatially). Open-escalated-cases count surfaces as warn-and-proceed in the strip, never hard-block.
6. **Underground Oversight (Pending / Leaders / Verified / Deactivated / Rejected / Inbox tabs).** Current: restricted-access banner (keep, it's excellent), gray SLA aggregate band (locked: gray, not blue), ref chips in two formats (RPL-xxxxx vs UG-xxxx — add a legend or unify presentation), "In review by X · since date" state chips (good), header metric shows "30 verified" regardless of tab (make header metrics tab-aware), count pill only on Verified tab (unify). Compose in Vigil with lamps/wick; claim/propose/confirm ceremonies at their weights (propose/confirm = Seal, two-eyes visible). Respect §6.1 absolutely.
7. **Heartcry Inbox.** Current: correct posture banner; ONE card showing URGENT pill, ref, sender hash, FEED REQUESTED pill, then raw base64 ciphertext, "Expand & decrypt," "Mark as Responded" available pre-read; unlabeled native date filters. Compose per §6.2: encrypted placeholder block; decrypt as the tightest Seal (90-second window made visible on the ceremony); *after* reading: the respond flow (optional pastoral message + confirm strip) ending in seal + receipt; unread lamp; designed date-range field.
8. **Pastoral Care — Signals.** Current: care banner (keep verbatim — "Keep this surface safe with all diligence…"), tier sections (TIER 1 · EXPEDITED with red edge), sender/recipient identity columns, raw `auto:self_harm_indicator` as flag reason (humanize: "Self-harm indicator · automatic"), rows that only open via a 13px chevron (whole row becomes target), rate-limit copy "X/10 remaining this hour" (keep pattern). Compose: expanded signal = dossier with triage actions (Claim · Reach out · Expand context [Seal — it exposes more of the thread] · Close [Act, mandatory note — and the note must visibly say where it goes: "Recorded to the audit log"]). Reach-out then close-signal is a two-step — design the partial-failure state ("Reach-out sent · close failed — Retry").
9. **Pastoral Care — Flagged Messages.** Current: humanized taxonomy pills (T1 · Location Disclosure — this tab does it right), sender/receiver church columns, Clear flag + Move to Escalated per row, internal footer "Taxonomy v1.1.0 — for forensic FP audit" (remove from UI). Compose: same dossier/ceremony system; escalate = Act with the anti-gossip consequence stated plainly ("This case leaves your view").
10. **Pastoral Care — Replant Team Inbox.** Current: "Leader correspondence" banner (keep verbatim — best copy in the app), thread list with unread dot, italic message previews (roman them — typography ruling), tab badge missing while unread exists (known bug — your design shows the badge fed by the same count as the list). Compose: thread view + composer with inline send-failure state.
11. **Pastoral Care — Escalated Cases (Manager/super-admin only).** Current strongest screen: SLA register band, From Pastoral / From Flagged provenance sections, case refs EC-000010, state pills ("Leader replied," "Manager escalation · review needed," "Revoke proposal · pending Manager"), oldest-first note. Fix: ESCALATION REASON column truncates to two words — give reason room (it's the decision field); UG-origin rows show masked identity in italic (roman + mask chip instead). Compose: the case drawer with propose → approve two-eyes ceremony, dispose modal, reach-out; 3/7/14-day aging on the wick.
12. **Daily Scripture.** Locked Content-Section shell applies (your own handoff). Rename "Daily Scripture Seeding" → "Daily Scripture." Fix: truncated "Schedule for …" CTA; UTC-vs-local labeling (one clear rule: schedule in UTC, shown with local-distribution note); per-row delete becomes an Act ceremony. Verse refs stay serif (correct use).
13. **Announcements.** Locked Content-Section shell applies: Home/Drafts/Posted workflow tabs, **post-publish lock + "Draft a correction"** (current UI has free Edit/Delete on posted content — your composition shows the locked state + correction chain instead), byline shows display name + tier word ("Ruth · Manager" — never `super_admin`), source-label/tag chips in consistent positions, leader-submissions as a filtered sub-surface ("Submissions · N" toolbar control).
14. **PII Scrub History.** Nearly right already (honest read-only banner). Fix: "LAST 7 NIGHTS" → "LAST 7 RUNS"; drop function-call syntax from the banner prose; REGION column is always "—" (cut or fill).
15. **Audit Log.** Read-only register; append-only banner kept verbatim. Fix: action pills humanized consistently (never raw snake_case); TARGET column names the actual target entity (today it often repeats the action token); attribute automatic marks correctly (a signal *viewed by an admin* is not "system"); filters (actor, action type, date range) in the designed field style; row detail drawer showing the full audit row incl. tier metadata. This screen should feel like the sanctuary of the Ledger concept — the permanent book the session ledger mirrors.
16. **Team Management (Governance).** Current: roster with tier column, GRANTED/LAST SIGN-IN wrapping mid-token (fix column behavior), **icon-only action buttons (trash = revoke!)** — replace with labeled controls per move 10; pre-highlighted promote arrow reads as active (fix state logic visually); FOUNDER/OPS/(you) chips (keep); invite section explainer (keep copy); PENDING YOUR APPROVAL empty state (keep). Compose: promotion ceremony (request → sponsor → Manager approval, 48h expiry) as a visible two-eyes flow; demote/revoke as Act/Seal ceremonies ending in seal + receipt (the current top green banner for demote/revoke dies).
17. **Account.** Current: profile card (keep), display-name section with purpose copy (keep verbatim), 2FA card with re-enroll + factor-ID hex (tuck the hex into a detail line), three stacked COMING SOON cards (collapse to one quiet "More controls are coming" line or cut). Compose: TOTP unenroll as a Seal ceremony with typed confirmation and honest consequence copy (currently a native browser `window.confirm` — banned).
18. **Global chrome.** Sidebar with embers + Governance regroup; topbar chips (tier · Verified · Xm window · environment) + ledger book icon; the session-ledger drawer; the three-weight ceremony shell; the seal; inline-error + request-id chip pattern; benediction empty states; skeletons that mirror final geometry; the designed date field; focus rings everywhere.

## 8. Deliverables

1. **Composed screen mockups** — all 18 items above, desktop-first (1280), each with its key states. This is the "full picture" the Founder asked for; lead with these.
2. **The primitives sheet** — lamp grammar (all states + reduced-motion + never-color-alone), wick scale, dossier anatomy, pill/chip grammar (one system, semantic families), ceremony shell ×3 weights, seal + receipt, session ledger, chips/embers, date field, empty/loading/error family.
3. **Interactive preview** (JSX + CSS on the real `--rp-*` tokens, same format as your Content Section handoff) for at least: Network Overview w/ constellation, Verification Queue w/ dossier+wick+ceremony, and the ledger/seal flow.
4. **Handoff README** — token additions proposed (with rationale), class vocabulary, motion spec (150–220ms, one easing, reduced-motion behavior), a11y notes, and an explicit list of every open call you want the Founder to make.
5. **Questions for the Founder consolidated at the END, as one numbered list** (house rule).

## 9. Mockup data rules

1. Use the seeded fixture names already in the live queue (e.g., "Yerevan Evangelical Fellowship — Kentron District," "Kachin Highland Baptist Outreach — Myitkyina," "Mission Évangélique du Sahel — N'Djamena," refs like `#A86ED3B7`). Never invent names that could collide with real congregations; never name or locate a real one.
2. UG mockups: refs + macro-regions only (e.g., `UG-80BD · Middle East & North Africa`).
3. Pastoral/heartcry mockups: mild placeholder distress text only, or metadata-only cards; no graphic content.
4. Founder identity in mockups: "Ruth · Manager."

## 10. What NOT to do

1. No new colors/tokens beyond the two sanctioned gaps (§3) without argued rationale.
2. No light theme. No toasts. No top-of-page success banners. No "Are you sure?" copy.
3. No geography below macro-region on any UG surface; no maps anywhere in the dashboard.
4. No italic outside scripture/editorial/witness moments (§4.6).
5. No relitigating the locked Content-Section architecture (§3) — extend it.
6. No affordances that break §5.6–§5.8 or §6.

## 11. Session protocol

Work move by move and screen by screen with the Founder; she strikes/keeps live. Where you disagree with a Vigil move, say so with a design argument and show your alternative next to it. Her words win. Present-tense honesty about what is mockup vs. what exists. Consolidate all open questions at the end of each response as one numbered list.

---

*Companion materials the Founder may attach: the audit report (`.claude/plans/2026-07-13-admin-dashboard-ux-audit.md`, esp. §9 live-pass findings and §12), the Vigil direction board (private artifact — living primitives demo), and live-dashboard screenshots from the 2026-07-13 pass.*
