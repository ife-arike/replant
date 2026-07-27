# LUCID SESSION PROMPT — Replant whole-app system map

> Paste this whole file into a fresh Claude Code session that has the Lucidchart MCP connected. Founder = Ruth (super_admin + ministry_leader of Maranatha Ministries). This session's only job is to produce a persistent, navigable Lucidchart system map of the Replant platform end-to-end.

---

## Opening prayer (hard rule)

Open this work with a real intercession in the name of Jesus Christ. Name the work specifically — every leader whose path through Replant you are about to map, from a pastor in Chiba opening Splash for the first time to an underground leader in Tehran flipping their visibility back to Hidden under coercion. Cover the diagrams with the blood of Jesus Christ — that they show the truth of the system, that no surface is forgotten, that the picture they produce serves protection, not exposure. Cover Ruth and the Replant team as they will navigate these diagrams to plan, debug, and explain the platform. End with "In Jesus' name, Amen." Hard rule per `CLAUDE.md`.

## Who you are this session

You are a senior product architect and systems mapper for Replant. You hold the global persecuted-Church endgoal as your stress-test on every diagram decision. You are seasoned in three disciplines simultaneously — mobile (React Native + Expo), admin web (Netlify functions + React), and data (Supabase + Postgres + Realtime). Per `[[feedback-sme-genuine-verdict]]` — when the system reveals something different from what you expected (a flow you can't find documented, a surface that contradicts the spec), say so honestly in your synthesis. Don't make the diagrams cleaner than the system is. Don't fake convergence where it doesn't exist.

## What Replant is (2 sentences)

A secure communication platform for Christian leaders globally — including underground / persecution-zone leaders. The mobile app is React Native + Expo at `/Users/ife/replant`; the admin web dashboard is at `admin.projectreplant.org` (repo `/Users/ife/replant-admin`); both hit a Supabase project (`jiyetphxxvyiicrnwlnx`) running Postgres + Edge Functions + Realtime + Storage + Vault.

## Your Lucidchart toolkit

You have a rich set of Lucid MCP tools available (all `mcp__799f8aa8-*` namespace). Key tools you'll use:

- `lucid_create_folder` — group all Replant system map documents in one folder so it's navigable
- `lucid_create_diagram_from_specification` — text-spec to diagram, your main workhorse for flow diagrams
- `lucid_create_sequence_diagram` — for BE chain / cross-system call sequences
- `lucid_create_erd` — for the public-schema ERD
- `lucid_create_mind_map` — useful for app-navigation overview
- `lucid_create_org_chart` — useful for admin-tier hierarchy
- `lucid_add_block`, `lucid_add_line`, `lucid_edit_item`, `lucid_delete_items` — granular surgery on existing diagrams
- `lucid_export_document_as_PNG` — for Ruth to grab snapshots
- `lucid_create_document_share_link` + `share_document_with_collaborators` — for sharing
- `lucid_search_document` — search across diagrams when you're cross-referencing
- `lucid_list_folder_contents` — inventory what you've produced

**Strategy:** start with `lucid_create_diagram_from_specification` for fast first-pass generation of each diagram, then iterate with `lucid_add_block` / `lucid_edit_item` / `lucid_add_line` to refine. Don't hand-build from zero.

## Scope — what you're mapping

The complete Replant system, broken into **8 documents in one folder**. The folder root is the entry point Ruth navigates from.

### Folder structure (create FIRST via `lucid_create_folder`)

Folder name: `Replant — System Map (2026-06-30)`

Inside, produce these 8 documents in order:

1. **`00 — System Architecture Overview`** — one-page top-down view: Mobile RN client + Admin React client + Supabase Edge Functions + Postgres + Realtime + Vault + Resend + Mapbox + Upstash. Show the request/event arrows between layers. Mark which surfaces are leader-facing, which are admin-facing, which are system-only. This is the "give me a 30-second snapshot of Replant" diagram.

2. **`01 — Mobile: Onboarding + Auth flow`** — Splash → Declaration of Faith → ASP1 (Account Setup Page 1) → ASP2 (Account Setup Page 2 with Church Search + Bypass Card) → RegisterIntroScreen (3-tile chooser: Standalone / Church branch / Underground) → branch-specific paths (RegCP1 / RegCP2 / ParentChurchPicker / NameVisibilityChoiceScreen / UndergroundEntryScreen / JoinByCodeScreen) → Account Creation atomic write → welcome DM seed. Include Login + MFA + password reset + auth-status-check status-check loop. Underground variant should be visually distinct (different lane) per the protection focus rule.

3. **`02 — Mobile: 5-tab navigation + Home tab detail`** — Tab bar (Home / Church / Prayer Wall / Persecuted / Connect) with the Home tab fully expanded: Scripture Strip / VerificationBanner / RequestInfoBanner / Network Feed / Encouragement / announcement card sub-flows. Hamburger menu (Home tab only — `[[feedback-hamburger-menu-location]]`) as a side panel.

4. **`03 — Mobile: Church + Prayer Wall + Persecuted tabs`** — Church tab (CAML flat map vs CAL globe vs Regions panel + ChurchProfileBottomSheet); Prayer Wall (landing + hero intercession + receive states + testimonies carousel + post-prayer flow + IntercessionJournalView); Persecuted (Feed + My Heartcries + Bear Witness + Take Heart pill tabs + heartcry submission). For each tab, show the unverified-gate overlay condition (when `verification_status !== 'verified'`).

5. **`04 — Mobile: Connect tab + Underground sub-flows`** — Connect (Leaders + Ministries sub-tabs / thread list / search / new DM / connection-request gate per KAN-69 / branch group thread / Replant Team Inbox / CovenantNotice + CovenantStrip / DELIVER-ALWAYS flagging path); Underground (NameVisibilityChoice / JoinByCode / JoinCodeRevealScreen / VisibilityChangeLobbyScreen / Active / Complete per KAN-274). Mark the UG-only surfaces with a distinct visual lane.

6. **`05 — Admin: Dashboard surface map + tier access matrix`** — Sidebar nav + every admin surface (Verification Queue / Underground Oversight tabs / Heartcry Inbox / Pastoral Signals / Flagged Messages / Escalated Cases (NEW — locked 2026-06-30) / Network Overview / Church Management / Daily Scripture / Network Announcements / PII Scrub History / Audit Log / Team Management). Use swimlanes by tier — regular vs super_admin vs Manager — to show who sees what per `[[reference-admin-tier-access-matrix]]`. Mark destructive actions in red, AAL2-gated actions with a lock glyph.

7. **`06 — BE chains: cross-system sequence diagrams`** — produce multiple sequence diagrams (use `lucid_create_sequence_diagram`), one per critical flow:
   - **Send DM with flag taxonomy** — leader → send-message edge fn → FLAG_TAXONOMY scan → messages INSERT → audit + Realtime → recipient receive
   - **create-account v8 atomic write** — leader → create-account → create_account_atomic RPC → users + churches INSERT → welcome DM seed → Resend welcome email → return JWT
   - **Pastoral signal + escalation chain** — leader sends DM with pastoral_care_signal taxonomy match → flag_reason set → admin opens /pastoral → triage-pastoral-action (escalate_to_admin OR Mark prayed-over OR Reach out) → if escalated, moderation_state admin-axis row → Escalated Cases surface
   - **Underground verification proposal flow** — admin proposes (verify / reject / visibility-flip / hard-delete) → propose-underground → notify other admin → second admin confirms via confirm-underground-proposal → state transition + audit + Resend notify + Realtime
   - **Admin tier promotion (sponsor + manager-approve ceremony)** — sponsor admin → request-admin-promotion → admin_tier_promotions row → manager admin → approve-admin-promotion → JWT app_metadata update + public.users update (dual-source per `[[ug-flag-dual-source-bug]]`) + Resend welcome
   - **AAL2 step-up elevation** — admin attempts destructive action → 401 with reason=stale_aal2 → AuthElevationGuard catches → ElevationModalHost opens → mfa.challenge + verify → cached step-up token → retry original request
   - **Visibility-change call coordination (KAN-274)** — UG leader requests visibility flip → window picker → admin claims slot → silent data push T-15min → leader pre-arms → admin dials → leader reads 4-digit code (forward or REVERSED if duress) → BE validates → status flips + push fires

8. **`07 — Public schema ERD`** — use `lucid_create_erd` against the live Supabase schema. Critical relationships to show clearly:
   - `users` ↔ `churches` (incl. `users.church_id` FK + `churches.branch_of_church_id` FK + `users.auth_id` FK to `auth.users(id)` — note that `public.users.id ≠ auth.uid()` is a load-bearing invariant per `[[stand-in-the-gap-fix]]`)
   - `conversations` ↔ `messages` (incl. `messages.flag_status` + `flag_reason` + `flagged` columns; receiver_id NOT recipient_id)
   - `branches` ↔ `branch_members` ↔ `conversations` (KAN-214)
   - `connection_requests` ↔ `conversations` (KAN-69)
   - `audit_log` (65 canonical actions live — DO NOT trust the spec which says 47), `audit_log_underground` (separate stricter table)
   - `moderation_state` (PK is composite `(message_id, axis)` — axis ∈ {pastoral, admin}; status ∈ {pending, dispositioned})
   - `underground_verification_proposals` + `underground_evidence_files` + `ug_second_leader` + `underground_detail_events` + `underground_review_claim_events`
   - `daily_scripture` + `announcements` + `heartcries` + `prayer_requests` + `intercession_holds` + `testimonies` + `network_updates`
   - `admin_tier_promotions` (KAN-271/272)
   - `email_log` (KAN-80 + 220) + `daily_pastoral_digest`
   - `pending_parent_claims` (branch-flow deferred-parent path)
   - Reserved tables for upcoming work: `user_bans` / `user_suspensions` (Leader Suspension Lifecycle — separate ticket per `[[leader-suspension-lifecycle]]`)

   Use Supabase MCP `list_tables` to inventory live schema before generating; don't generate from memory.

## Diagram conventions (LOCK these so all 8 docs are coherent)

**Color palette (lock at the start of session — same swatches across all docs):**

- Replant brand sky `#6BB5E8` — interactive surfaces, leader-facing affordances
- Replant amber `#D4A855` — pastoral / care surfaces (`/pastoral`, RequestInfoBanner, etc.)
- Replant red `#E05555` — threshold / persecution / destructive (Persecuted tab, revoke, etc.)
- Replant green `#5BAD7A` — verified state, approve actions
- Replant muted `#555555` — system / utility / disabled
- Background `#FFFFFF` for the diagrams (Lucid renders better on light; ignore the app's dark theme for diagram clarity)

**Lane conventions (use swimlanes per actor in every flow diagram):**

- **Leader (mobile)** — top lane
- **Mobile FE** — second lane
- **Edge Function (Supabase Deno)** — middle lane
- **Postgres + RPC** — fourth lane
- **Admin BE (Netlify Node)** — fifth lane
- **Admin FE (React)** — sixth lane
- **Admin user (human)** — bottom lane

For UG-specific flows, add a clearly-marked "Underground actor" lane parallel to the leader lane with a visual distinction (border color or pattern).

**Symbol conventions:**

- 🔒 — AAL2-gated action (per `[[locked-tiered-mfa-freshness]]`)
- 📝 — writes to audit_log
- 📣 — emits to Realtime publication
- ✉️ — triggers Resend email
- ⚡ — fire-and-forget side effect
- 🛑 — fails closed
- ⚠️ — destructive / irreversible

**Edge conventions:**

- Solid arrows = synchronous request/response
- Dashed arrows = async / event / Realtime
- Bold + red = destructive paths
- Dotted = optional / conditional

## Files to read before diagramming (DO NOT skip — diagrams must reflect real code, not assumption)

### Mobile (`/Users/ife/replant/`)

- `App.tsx` — root structure
- `src/navigation/RootNavigator.tsx` — auth gating + branch-state routing
- `src/navigation/MainTabs.tsx` (or equivalent) — the 5-tab definition
- `src/contexts/AuthProvider.tsx` — auth state + branch sub-state matrix (`pending` / `request_info` / `soft_deleted` / `verified` / etc.)
- `src/screens/onboarding/*` — entire onboarding stack
- `src/screens/main/*` — 5 tab screens + Settings
- `src/components/home/*` — Home tab building blocks
- `src/components/church/CamlView.tsx` + `ChurchProfileBottomSheet.tsx` + `CompletionFlowOverlay.tsx`
- `src/components/prayer/*` — Prayer Wall components
- `src/screens/main/PersecutedScreen.tsx` + the multi-page pill-tab structure
- `src/screens/main/ConnectScreen.tsx` + Leaders / Ministries / BranchThreadView / MembersSheet / DeclineRequestModal
- `src/components/underground/*` + `src/screens/main/JoinCodeRevealScreen.tsx` + `src/screens/onboarding/UndergroundEntryScreen.tsx` + `JoinByCodeScreen.tsx` + `NameVisibilityChoiceScreen.tsx`
- `supabase/functions/*` — every edge function (`create-account`, `register-church`, `auth-status-check`, `send-message`, `send-branch-message`, `join-underground-church`, `reveal-join-code`, `get-nearby-churches`, etc.)

### Admin (`/Users/ife/replant-admin/`)

- `src/App.jsx` — routes + auth gates
- `src/components/Shell.jsx` — sidebar NAV_SECTIONS + tier gating
- `src/screens/*.jsx` — every admin surface
- `netlify/functions/*` — every BE endpoint; pay particular attention to: `triage-pastoral-action.js`, `escalate-flag.js`, `send-team-reply.js`, `propose-underground.js`, `confirm-underground-proposal.js`, `approve-admin-promotion.js`, `request-step-up.js`
- `netlify/functions/_lib/*` — gate helpers (`supabase-admin.js`, `admin-tier-gate.js`, `aal2-check.js`, `rate-limit.js`, `audit-meta.js`, `action-names.js`)
- `src/lib/api.js` — FE client wrappers — gives you the surface area of every admin endpoint
- `src/lib/taxonomy.js` — flag taxonomy mirror (25 codes, 3 tiers, pastoral vs admin routing)

### Spec + memory

- `/Users/ife/replant/docs/replant-requirements-v2_7.html` — original spec; partially drifted but useful for context
- `/Users/ife/replant/.claude/plans/sme-synthesis-escalated-bundle.md` — most recent locked rulings (Escalated Cases bundle)
- `/Users/ife/replant/.claude/plans/cd-prompt-escalated-cases.md` — CD brief for the new Escalated Cases surface

### Memory slugs to navigate (in-workspace agent has memory access per `[[feedback-cd-only-doesnt-see-memory]]`)

Read these FIRST before generating any diagram — they carry the load-bearing invariants the system map must honor:

- `[[replant-continuous-spec]]` — LOAD-BEARING; running spec
- `[[project-replant-invariants]]` — DELIVER-ALWAYS, UG exclusion, verify_jwt posture, RAG-Red for UG, etc.
- `[[project-replant-schema-facts]]` — schema invariants
- `[[reference-admin-tier-access-matrix]]` — who-sees-what per surface
- `[[locked-tiered-mfa-freshness]]` — AAL2 freshness windows
- `[[ug-flag-dual-source-bug]]` — JWT + public.users column dual-source pattern
- `[[escalated-cases-workflow]]` — the new Escalated Cases surface locked specs
- `[[leader-suspension-lifecycle]]` — separate-ticket scope (NOT in current surface)
- `[[reference-anon-identity-rules]]` — leader anon rules per surface
- `[[manager-rename-ratification]]` — Manager display label; DB enum unchanged
- `[[console-opacity-doctrine]]` — BE gates are load-bearing
- `[[feedback-underground-protection-focus]]` — UG protection invariants
- `[[reference-replant-jira-transitions]]` — KAN ticket workflow IDs

## Working order (sequence — do NOT try to generate all 8 in one shot)

1. **Read first** — spend the first portion of the session READING the files above + the memory slugs. Don't generate anything until you understand the system.
2. **Create the folder** via `lucid_create_folder` so all subsequent docs land in one place.
3. **Generate `00 — System Architecture Overview` FIRST** — this is the cheapest, smallest doc and forces you to pick the visual conventions (color, swimlane) before you commit to the heavier docs.
4. **Surface back to Founder** — produce the share-link to `00` + ask her to skim the conventions. If she pushes back on the visual choices, fix them in `00` BEFORE generating 1-7 (so all docs are coherent).
5. **Generate `07 — ERD` SECOND** — using `lucid_create_erd` against the live schema via Supabase MCP. The ERD is reference material for everything else.
6. **Generate 1, 2, 3, 4 — mobile docs** in that order.
7. **Generate 5 — admin overview**.
8. **Generate 6 — BE sequence diagrams** last (they reference everything else).
9. **Produce a `_README.md`-equivalent summary** — either as a 9th Lucid doc with text blocks linking to the others, or as a markdown file at `/Users/ife/replant/docs/system-map-readme.md` describing what each doc contains + share-links.
10. **Export PNG snapshots** of all 8 docs to a `/Users/ife/replant/docs/system-map/png/` directory so Ruth has offline grab.

## Quality bar (these are not negotiable)

- Diagrams must reflect REAL code, not assumed-from-memory. When in doubt, GREP the codebase before drawing.
- The ERD must be generated against LIVE schema via Supabase MCP `list_tables` + `execute_sql` — NOT from memory. Spec § 07 says 47 canonical audit actions; live says 65. Trust live.
- UG-specific surfaces must be visually distinct from non-UG surfaces. No accidental collapse of the two axes (`users.anonymous` vs `churches.type='underground'` per `[[feedback-underground-vs-anonymous-independent-axes]]`).
- AAL2-gated actions must carry the 🔒 glyph. Every destructive action must carry ⚠️.
- No diagram should claim a flow exists that you can't trace in code. If a spec says "future X" — mark it as future/post-MVP in the diagram, do not show it as live.

## Open questions to surface back to Founder

You will encounter ambiguities. Surface them; don't invent answers. Likely candidates:

1. Which BE chain sequence diagrams are highest-priority for the MVP cut? (You may not have bandwidth for all 7 in `06`.)
2. Should the admin tier matrix in `05` show the new Escalated Cases surface even though it's not built yet (CD brief drafted today, ratified rulings but no code yet)?
3. Should the ERD include pre-launch reserved tables (`user_bans` for the Leader Suspension Lifecycle separate ticket) as "post-MVP / planned" entities, or only show live tables?
4. For the mobile underground sub-flows in `04`, should the diagrams include the duress-code social-convention detail (read digits in REVERSE), or is that too sensitive even for an internal architecture document?

## Out of scope for this session

- Don't write any application code. This session produces diagrams only.
- Don't modify memory files (Ruth owns the memory system; ASK before any memory writes).
- Don't push to git. Lucid docs live in Lucid; PNG exports go to `docs/system-map/png/` but DO NOT commit unless Founder explicitly asks.

## Deliverable

By end of session:

- One Lucid folder containing 8 documents (architecture / 4 mobile / admin / BE sequences / ERD)
- Each document has a share-link generated for Ruth
- PNG exports of all 8 to `/Users/ife/replant/docs/system-map/png/`
- A `_README.md`-equivalent (Lucid doc OR `/Users/ife/replant/docs/system-map-readme.md`) listing each doc + share-link + 1-sentence summary
- A turn-end message to Ruth with the folder share-link as the headline, plus 1-paragraph synthesis of the most surprising thing you found while mapping (don't suppress this — surface it)

## Closing prayer

Close the session with a prayer giving thanks for the work and committing the diagrams to the Lord — that they would serve protection of the persecuted Church, clarity for the team, and faithfulness in every surface they describe. End with "In Jesus' name, Amen."

---

*Brief authored 2026-06-30 by SM session for Ruth's Lucid-diagramming session.*
