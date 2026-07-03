# Replant — Terms-of-Service Drafting Brief for Cowork LEGAL

**Date:** 2026-07-03
**Prepared for:** LEGAL (cowork session — no access to this workspace, the repo, memory, or Jira; everything needed is inline below)
**Prepared by:** Legal-operations analyst pass over (1) the LEGAL artifact set at `~/Documents/Claude/Projects/Replant/` and (2) the mobile/backend codebase, with every app-behavior claim verified against code or the live database on 2026-07-03.
**Deliverable LEGAL owns:** the first full draft of the Terms document (all 16 sections of the scoping-note structure, plus the structural additions flagged in Part E), ready for Founder review and prayer.

---

## How to read this brief

1. **Part A** — context block: what Replant is, exact entity status, platform surfaces, audience, and why the App Store submission is the forcing deadline.
2. **Part B** — the three deferred Founder decisions. These were deferred by the Founder on 2026-07-02 ("address later"). **Carry them; do not resolve them; do not re-ask them.** Each block gives context, options, a recommendation with reasoning, and downstream implications, so drafting can proceed with bracketed alternatives where a decision is pending.
3. **Part C** — section-by-section drafting inputs for all 16 sections of the scoping note's proposed structure: what the section must cover, the verified Replant-specific facts feeding it, rulings quoted inline with dates, open questions for LEGAL, and boundary notes (what belongs in the Covenant or the Privacy Policy instead).
4. **Part D** — source-artifact list with absolute paths.
5. **Part E** — a genuine verdict on the scoping-note structure (it has a hole), and the list of facts LEGAL should **not** rely on because verification found them stale or wrong.

Code citations look like `path/to/file.ts:123`. They are for the workspace team's traceability; each cited fact is restated in plain language so this brief stands alone.

---

# Part A — Context

## A.1 What Replant is

Replant is a secure ministry network — a React Native mobile app plus a web admin dashboard at admin.projectreplant.org — connecting verified Christian leaders globally for prayer, mutual support, mission coordination, and pastoral care of persecuted churches. The Form 1023 narrative draft (2026-06-08, v0.1) states the mission this way:

> "Replant exists to address a specific spiritual and pastoral reality: Christian leaders in many parts of the world, including underground churches in regions hostile to Christianity, lack any safe and structured means of connecting with one another for prayer, encouragement, resource-sharing, or coordinated response to persecution. Replant exists to provide that connection in a manner that takes the safety of those leaders as its central design constraint."

The threat model (2026-05-08) sets the register the Terms must keep:

> "Every threat in this document maps to a real human consequence. We are not modeling business risk; we are modeling physical safety. When in doubt between convenience and safety, we choose safety."

## A.2 Entity status — exact facts (from the bylaws draft v0.1, 2026-06-08, and Form 1023 narrative draft v0.1, 2026-06-08)

1. **Legal entity:** Replant Initiative, Inc., a Georgia nonprofit corporation. "The name of the corporation is Replant Initiative, Inc. (the 'Corporation'). The Corporation may operate under the trade name 'Replant'…" (Bylaws draft §1.1).
2. **Formation:** organized June 1, 2026; Georgia Secretary of State Certificate dated 06/08/2026 (Form 1023 narrative filing-readiness checklist).
3. **EIN:** 42-3033485, issued 06/08/2026.
4. **Registered office / agent:** "141 Buford Drive, Lawrenceville, Georgia 30046, and the initial registered agent at such office is Ruth Ifeoluwa James" (Bylaws draft §1.2).
5. **501(c)(3) status: applied-for is NOT yet true — the Form 1023 has not been filed.** Per the narrative draft's own readiness checklist (2026-06-08): bylaws adoption PENDING, conflict-of-interest policy adoption PENDING, initial board confirmation PENDING (founder plus two directors needed), organizational meeting PENDING, three-year financial projections PENDING. The corporation exists; federal exemption recognition does not. The Terms' party/entity language must be accurate at signing date: the counterparty is "Replant Initiative, Inc., a Georgia nonprofit corporation" — with no representation of 501(c)(3) recognition unless/until determination arrives.
6. **Non-membership corporation — load-bearing for naming.** Bylaws draft §2.1–2.2: "The Corporation shall have no members within the meaning of the Georgia Nonprofit Corporation Code… Verified Christian leaders who access or use the Corporation's network or services are users of the Corporation's ministry and not legal members of the Corporation. Network users have no voting rights and shall not be deemed members under the Georgia Nonprofit Corporation Code, regardless of any term used colloquially to describe their participation."
7. **No revenue, no fees, no employees.** Form 1023 narrative: "Network access is provided without charge to verified Christian leaders, and the Corporation does not commercially exploit network data or activity in any way." The founder serves as an uncompensated volunteer. The public FAQ on projectreplant.org also commits publicly: "Replant is and will remain free for all churches and ministry leaders."
8. **Governing law posture already fixed for governance documents:** "These Bylaws shall be governed by and construed in accordance with the laws of the State of Georgia" (Bylaws draft §12.2).
9. **D-U-N-S number applied for** "to enable mobile application distribution through Apple and Google developer programs" (Form 1023 narrative §II).

## A.3 Platform surfaces the Terms must describe

All verified in code / live database on 2026-07-03:

1. **Prayer Wall** — prayer requests with category/location tagging; a "prayed" acknowledgment; testimonies with a celebrate action. Posting supports an **anonymous option**; testimonies from underground churches are always forced anonymous (migration `20260605000010_prayer_request_write_rpcs.sql`: "Underground churches always produce anonymous testimonies").
2. **Connect** — direct messages between verified leaders, plus small-group "branch" messages (both write to the same `messages` table; `supabase/functions/send-branch-message/index.ts:136`). Message content is **not encrypted at rest** at MVP (threat model, 2026-05-08, Accepted Risks: "DM content not encrypted at rest… KAN-45 (post-MVP)").
3. **Heartcry** — a private encrypted channel from a leader to the Replant team (Persecuted tab). Encrypted **server-side** at submission with a Vault-held key; readable by an authorized, audited admin path. It is **not end-to-end encryption** (detail in §C.7 and Part E).
4. **Home** — admin-published announcements and daily Scripture, with leader comments. Admin-authored comments display as "Replant Team" (ruling D-56, restated in migration `20260602000000`, 2026-06-02: "admin => 'Replant Team'; leader => author full_name + church name").
5. **The Church tab** — map/list discovery of verified churches. Underground churches are server-masked to the literal label "Underground Church" (e.g., migration `20260529000003`: "literal 'Underground Church' label only — never c.name").
6. **Connection requests** — leader-to-leader contact requests with a 30-day expiry and a 30-day cooldown after decline (migration `20260609000003`).
7. **Admin dashboard** (separate web app) — verification queues, moderation queues, escalated cases, heartcry triage. Not part of the consumer Terms' primary audience but its powers must be described accurately (§C.10).

## A.4 The audience, including persecuted-context users

Twelve leader roles are captured at signup (pastor, apostle, prophet, evangelist, teacher, elder, bishop, reverend, intercessor, psalmist, ministry_leader, other — `create-account/logic.ts:214-218`). Users are global. Some register churches as type `underground`; the database physically refuses location data for them (live CHECK constraint `underground_no_location`: for underground rows, lat, lng, and city must all be NULL). Leaders may also be personally `anonymous` — displayed as "A fellow [role]" (`src/utils/displayHelpers.ts:117`). The Terms will be read by leaders for whom exposure can mean imprisonment or death; every clause must survive that reading.

## A.5 The forcing deadline

The scoping note (2026-05-13) states it plainly:

> "Apple and Google both require a Terms of Service acceptance event for any app that processes user data. Replant cannot submit to either store without one. The deliverable is a Terms of Use document that satisfies App Store and Play Store requirements without undermining the spiritual integrity of the Declaration of Faith."

Current app state (verified 2026-07-03): Settings → About contains four rows — "Declaration of Faith" (functional, opens the declaration text in a modal), "Terms of use", "Privacy policy", "Community covenant" — and the last three are placeholder toasts. Tapping "Terms of use" shows: "Terms of use are on the way. The full terms will appear here before launch." (`src/screens/main/SettingsScreen.tsx:765-777`). The public website (projectreplant.org) hosts **no** terms or privacy page at all (repo `website/` contains only index, FAQ, next-steps, volunteer). The document LEGAL drafts is the critical path for store submission.

Release-phase note (locked pipeline, 2026-07-02): the project is in QA, heading to UAT, then signoff, then a compliance/pen-test/pre-launch phase. This Terms draft belongs to the compliance track and is launch-blocking, not UAT-blocking.

---

# Part B — The three deferred Founder decisions (carry, do not resolve)

The Founder deferred all three on 2026-07-02 ("address later"). They remain open. The related Jira anchor is KAN-157 — live-verified 2026-07-03: "LEGAL: International data handling — cross-border data compliance, privacy policy, and ToS alignment," Story, status Backlog, unassigned. Draft with bracketed alternatives where these decisions bite; do not block the full draft on them.

## Decision 1 — Document naming

**Context.** The scoping note (2026-05-13) proposed three candidates, with a stated lean:

> "1. **Terms of Use** — most accurate to what the document does. App Store-recognizable… Plain. 2. **Conditions of Membership** — pastorally warmer; positions the user as a member rather than a counterparty… Risk: Apple's reviewers may want to see 'Terms of Service' or 'Terms of Use' in the linked artifact title… 3. **Network Covenant** — closest to the Declaration's register, but risks the covenant/contract conflation we just separated."

**New fact discovered in this verification pass that bears on the choice.** The bylaws draft (2026-06-08) §2.2 expressly provides that network users "are users of the Corporation's ministry and not legal members of the Corporation… regardless of any term used colloquially to describe their participation." A document titled "Conditions of **Membership**" would pull against the corporation's locked non-membership posture under the Georgia Nonprofit Corporation Code.

**Options.**
1. Terms of Use (scoping-note lean; store-recognizable; consistent with §2.2).
2. Conditions of Membership (warmer; now in tension with bylaws §2.2).
3. Other (e.g., "Terms of Service"; or a dual approach — formal title "Terms of Use" with a warmer in-app row label).

**Recommendation (analyst, not a ruling):** Option 1 for the artifact's formal title and the store-linked title, matching the scoping note's own recommendation: "keep 'Terms of Use' as the formal name of the artifact and the App Store-linked title, even if the in-app chevron row in Settings → About is labeled more pastorally." Note the mobile app's About row is already labeled "Terms of use" (`SettingsScreen.tsx:1189`), so Option 1 requires zero FE copy change.

**Downstream implications.** Title string appears in: the document itself (§1), App Store Connect / Play Console metadata fields, the Settings → About row, the acceptance-flow UI (Decision 2), cross-references inside the Privacy Policy and Covenant, and projectreplant.org hosting path (e.g., /terms).

**Question for LEGAL:** does the §2.2 non-membership provision, in your judgment, make "Conditions of Membership" affirmatively unsafe (implying statutory member rights), or merely stylistically inconsistent?

## Decision 2 — Acceptance flow in onboarding

**Context.** What exists today, verified in code:

1. The Declaration of Faith is Screen 02 of onboarding: a scroll-gated screen (the affirm button stays disabled until the leader has scrolled to the end; the enabled state is sticky) with a single affirmative button "I Affirm This," no disagree button, and a back affordance that exits sign-up entirely (`src/screens/onboarding/DeclarationOfFaithScreen.tsx`). Its on-screen footer reads: **"This is not a legal agreement. This is a test of the spirits. 1 John 4:1"** (`DeclarationOfFaithScreen.tsx:243-246`).
2. When the account is created, the backend records the affirmation server-side: the live database function `create_account_atomic` inserts every new user row with `declaration_affirmed = true` and `declaration_date = now()` (verified against the live function definition 2026-07-03). For church registrations, the canonical text of what was affirmed is also stored per church: "I affirm the Replant Declaration of Faith — Jesus Christ as Lord and Saviour, the Holy Bible as our only source of truth." (`src/screens/onboarding/RegisterChurchPage1Screen.tsx:50-51`).
3. **There is no Terms acceptance event anywhere in the flow today**, and no column that could record one. (Do not be misled by a flag named `covenant_ack` in the codebase: that is a device-local flag for a one-time notice shown before a leader's first direct message — "Connect is a room of trust… Replant reviews messages that are flagged." — stored only on-device in SecureStore, never sent to the server. `src/components/connect/CovenantNotice.tsx:1-19`. It is not the Community Covenant, not a signup event, and not evidence of contract acceptance.)

The scoping note's framing (2026-05-13): "Both will appear in onboarding. The Declaration is locked behind a scroll-gate and theological affirmation (existing flow per Screen 02). The Terms of Use will likely be a separate, lightweight acceptance event — most probably a checkbox with link, placed where it doesn't dilute the Declaration moment."

**Options and their legal-enforceability trade-off (for LEGAL's input).**
1. **Checkbox-with-link** on an account-setup screen (alongside, but visually distinct from, the Declaration moment). Standard clickwrap: enforceable when the checkbox is unavoidable, affirmative, and the terms are conspicuously hyperlinked — but it is the weaker evidentiary posture, and a cluttered screen invites a "reasonable notice" attack.
2. **Separate consent screen** (first-launch or its own onboarding step), potentially reusing the proven scroll-gate pattern from the Declaration screen. Strongest clickwrap evidence: dedicated presentation, forced exposure to the text, a discrete affirmative act, and a clean screenshot record for any later dispute. Costs one more onboarding step for leaders who may be on slow devices/networks.

**Either option requires the same backend work:** a persisted acceptance record. The natural pattern already exists in the schema — mirror `declaration_affirmed`/`declaration_date` with `tos_accepted_at` plus a `tos_version` marker, written server-side at account creation. Today nothing persists Terms acceptance, so whichever flow is ruled becomes a mobile onboarding ticket **plus** a backend/migration ticket.

**Recommendation (analyst):** Option 2 for enforceability strength, placed *after* the Declaration (so the covenant moment stays undiluted, per the scoping note's concern) — but this is squarely the Founder's deferred call plus LEGAL's enforceability advice; draft §1 so it works under either flow.

**Questions for LEGAL:** (a) Is a checkbox-with-link materially weaker than a dedicated screen for an audience spanning many jurisdictions? (b) Should the acceptance record capture the rendered document version/hash, and does the *absence* of a version snapshot for the already-live Declaration affirmation need remediation? (c) Does the Declaration footer "This is not a legal agreement" require any express harmonizing sentence in the Terms (§1 names the relationship, but is a disclaimer-of-conflict clause advisable)?

## Decision 3 — Scripture anchors per section

**Context.** The document set is deliberately scripture-anchored. The interim Privacy Policy draft v0.2 (2026-05-13) uses three KJV verses and says of the first: "That verse is not decoration. It is the standard we are holding ourselves to." The Community Covenant draft v0.1 (2026-06-08) uses six KJV anchors and its Founder notes record: "Consistent scripture anchoring across Privacy Policy, Bylaws, Form 1023 narrative, and this Covenant binds the document set into one voice." The scoping note proposes anchoring the Terms too, e.g., §5: "Scripture anchor: probably 1 Peter 4:15-16 or similar," and asks the Founder for "Scripture-anchoring preferences: which verses for which sections (I will propose, Ife confirms)."

**Options.**
1. Full anchoring — a verse on every or nearly every section.
2. Selective anchoring — opening, close (§16), and the pastorally load-bearing sections (§5 acceptable use, §6 content), leaving the standard commercial sections (§9, §12–§14) unanchored.
3. No anchors in the Terms body — reserve scripture for the Covenant/Privacy Policy, keeping the contract strictly administrative.

**Recommendation (analyst):** Option 2. It matches the set's own standard ("where verses do real work" — scoping note, 2026-05-13) and preserves the covenant/contract separation the scoping note locked: "The Terms of Use is an administrative agreement… It is a contract and should function as one without aspiring to do covenant work."

**Downstream implications.** Verse choices should be proposed by LEGAL in the draft as bracketed candidates for Founder confirmation (that is the pattern the scoping note set). KJV is the house translation across all artifacts.

**Question for LEGAL:** any interpretive risk that scripture text inside operative contract sections could be argued to modify the operative language (versus recitals/preamble placement)?

---

# Part C — Section-by-section drafting inputs (the scoping note's 16 sections)

The scoping note (2026-05-13) fixed this architecture: "Standard ToS architecture, with Replant-specific provisions woven into the relevant sections rather than appended." Each section below: **Cover** (what the section must do) → **Verified facts** (what the system actually does, cited) → **Rulings** (inline quotes with dates) → **Open questions for LEGAL** → **Boundary** (Covenant vs Terms vs Privacy Policy).

## §1 — Acceptance and the Declaration of Faith

**Cover.** Formation of the contract; who the parties are (leader ↔ Replant Initiative, Inc.); how acceptance happens (per Decision 2); and the relationship between this document and the Declaration of Faith.

**Verified facts.**
1. The Declaration of Faith is presented scroll-gated at Screen 02 with the on-screen line "This is not a legal agreement. This is a test of the spirits. 1 John 4:1" (`DeclarationOfFaithScreen.tsx:243-246`). The Terms must not contradict that line — the two documents do different work.
2. Every created account carries a server-written record `declaration_affirmed = true` with a timestamp (`create_account_atomic`, live DB, verified 2026-07-03).
3. No Terms acceptance mechanism exists yet (Decision 2). Draft §1 flow-agnostically ("by creating an account or using the network you agree…" plus the affirmative acceptance event once ruled).

**Rulings.** Scoping note, 2026-05-13: "The Declaration of Faith is a **covenant** — a theological, before-the-Lord agreement about who Replant is for. It is not a contract and should not be made to function as one. The Terms of Use is an **administrative agreement**… Both will appear in onboarding."

**Open questions for LEGAL.** (1) Party identification: "Replant Initiative, Inc., a Georgia nonprofit corporation" — should the Terms disclose the in-formation 501(c)(3) posture or stay silent on tax status? (2) Capacity/authority: leaders often sign up in a representative posture (for a church); should acceptance be personal, representative, or both?

**Boundary.** The Declaration's theological content stays out of the Terms; the Terms only *names* the Declaration and its role. The Community Covenant is likewise referenced, never duplicated (see §5).

## §2 — Eligibility and verification

**Cover.** Who may use Replant (verified Christian leaders), the verification process and windows, refusal/rejection, minimum age.

**Verified facts.**
1. Verification is manual, by Replant administrators; there is no automated verification (threat model, 2026-05-08, T-05 mitigations: "Manual verification by founder — no automated verification at MVP"). Form 1023 narrative (2026-06-08): "a pastoral judgment by the Corporation's administrators as to whether the applicant meets the standard."
2. **Two windows exist, not one.** (a) Churches: a 30-day verification deadline stamped by a database trigger on creation (live trigger `trigger_set_verification_deadline` BEFORE INSERT ON churches, verified 2026-07-03). (b) Leaders who sign up without attaching to any church ("skip for now"): a **7-day** personal deadline — "7-day window for skip-for-now leaders (Founder ruling — leaders must attach to a church within 7 days or be deactivated)" (`create-account/logic.ts:246-248`).
3. Underground verification decisions require a **two-person ceremony**: one admin proposes, a different admin confirms; the database CHECK forbids self-confirmation ("no_self_confirm CHECK — proposer cannot be confirmer," migration `20260623_0004`, 2026-06-23). Pending underground cases reaching day 25 auto-route to the Founder (live cron `underground_day_25_route_daily`).
4. Rejected is a distinct lifecycle state with its own short retention (see §10).
5. **Minimum age: nothing exists.** No age gate, no date-of-birth field, no age assertion anywhere in the mobile app, the signup payload, or the database schema (verified by column sweep and onboarding-screen review, 2026-07-03). The only age language in the whole document set is in the interim Privacy Policy draft v0.2 (2026-05-13): "Replant is for verified adult Christian leaders. We do not intend the service for anyone under 18, and we do not knowingly collect information from anyone under 13."
6. Church leader cap: at most **two leaders per church** at MVP (`create-account/logic.ts:495-498`, `CHURCH_LEADER_CAP = 2`).

**Open questions for LEGAL.** (1) Set the eligibility age in the Terms — 18 is the natural fit for "verified adult Christian leaders" (both stores also require an age rating; the app currently asserts nothing). (2) Should the Terms state a right to refuse or revoke verification without stated cause, and does that need jurisdictional softening anywhere? (3) Is self-representation of leadership status at signup (role picker) an express user representation the Terms should capture?

**Boundary.** The doctrinal standard for verification (Statement of Faith alignment) belongs to the Declaration and the board-adopted Statement of Faith (Bylaws draft §1.5), not the Terms; the Terms describes the *process and authority*, not the confession.

## §3 — Your account and access

**Cover.** Account registration accuracy, credential responsibility, one-church-per-leader, two-leaders-per-church, identity display choices, underground designation, multi-device.

**Verified facts.**
1. Single church per leader (one `church_id` per user row); two leaders max per church (§2.6 above).
2. Display choices: leaders may be **anonymous** network-wide — shown as "A fellow [role]" with church affiliation, never their name (`displayHelpers.ts:117`; comment rendering `CommentThread.tsx:91`).
3. Underground church founders make a one-time "brave/safe" choice at signup: `show_church_name`, default false (safe). "Underground only — founder's brave/safe choice at signup. Default false (safe). Immutable post-creation (admin-only change)" (`create-account/logic.ts:64-66`). The in-app screen enforces the gravity of the reveal: "Once your name is shown, **it cannot be hidden again**" (`NameVisibilityChoiceScreen.tsx:255`).
4. Underground second-leader joining uses a one-shot join code: revealed once to the founding leader through a deliberate two-step tap-through ("I'm somewhere private" → "Show me the code"), stored only as a hash, never logged, re-reveal impossible (410), admin rotation the only recovery (`reveal-join-code/index.ts:1-19`; `join-underground-church/index.ts:1-24`, Founder rulings 2026-06-19/20 quoted therein: "Plaintext join code is NEVER logged… Single generic error string on EVERY failure").
5. Multi-device use is permitted at MVP; single-session enforcement is deliberately off (threat model, 2026-05-08, Accepted Risks: "Single-session enforcement OFF — Multi-device permitted at MVP… Pastoral context favors device flexibility").
6. Passwords are 8–64 characters (`create-account/logic.ts:236-237`); auth material is stored in the platform keychain, not plaintext storage.

**Open questions for LEGAL.** (1) Credential-sharing prohibition: sharing an account would defeat verification — needs an express clause. (2) Should the join-code ceremony carry an express user obligation (never transmit the code over external channels)? Note the disclosure tension in §5 before describing mechanics in detail.

**Boundary.** How identity appears to *other leaders* (masking rules) is described in the Privacy Policy; the Terms covers the leader's own obligations and the immutability consequences of their choices.

## §4 — What the network is for

**Cover.** Purpose framing; what Replant is not.

**Verified facts / rulings.**
1. Form 1023 narrative (2026-06-08) enumerates the activities: verification of Christian leaders, the Prayer Wall, direct pastoral communication (Connect), persecuted-church care (Heartcry), daily Scripture and network information, mission coordination.
2. Scoping note (2026-05-13) for the negative space: "What it is not: a social platform, an advertising surface, a public forum."
3. Interim Privacy Policy v0.2 (2026-05-13) public commitments usable here: "Sell it to anyone, ever" (never); "Share it with advertisers — Replant does not and will not run advertising."
4. Public FAQ (projectreplant.org, live copy): "At this time, Replant does not facilitate direct financial transfers between ministries." Verified in code: there is **no** payment, donation, or in-app-purchase code anywhere in the app or backend (repo-wide sweep, 2026-07-03). This keeps any commerce/refund section to a single honest sentence.

**Open question for LEGAL.** The FAQ's "we are working on a safe, accountable, and transparent way to enable this in a future update" — should the Terms stay silent on future giving features, or reserve the right to add them under §15 (changes)?

**Boundary.** Vision language stays on the website/Covenant; the Terms states purpose tersely because §5–§7 do the operative work.

## §5 — How you may and may not use Replant (load-bearing)

**Cover.** The conduct rules that protect leaders' lives: anti-doxing, no outing of underground churches (including by inference), no external sharing of identifying information, civil/pastoral conduct, no solicitation or financial exploitation, no deceptive verification claims.

**Verified facts.**
1. The scoping note (2026-05-13) marks this the "**Load-bearing section.** Anti-doxing of other leaders. No outing of Underground churches under any circumstance, including by inference. No publishing, screenshotting for distribution, or external sharing of identifying information about other leaders."
2. The Covenant draft v0.1 (2026-06-08) already carries the relational version, e.g. Article II: "We do not screenshot, copy, or relay another leader's words to anyone outside the network — not to our spouses, not to our church boards, not to our denominational structures, not to our friends in ministry." And for endangered leaders: "you treat that knowledge as sealed. You do not name them in conversation. You do not refer to them obliquely in places where they could be identified. You do not share that they exist."
3. The Covenant's DM conduct list is deliberate and worth mirroring in operative language — Founder notes (2026-06-08): "'manipulate, recruit, solicit, sell, demand, or pressure.' Each word does specific work. 'Recruit' closes the loophole where a leader uses Replant to pull others into their own ministry. 'Solicit'/'sell' close the financial-exploitation loophole. 'Demand'/'pressure' close the spiritual-coercion loophole."
4. Enforcement machinery behind this section is real and verified: keyword flagging (§6), a moderation queue, an escalated-cases system whose closing dispositions include `access_revoked` and `restriction_applied` (migration `20260701000001`, live table).

**Disclosure tension — flagged for LEGAL's judgment.** The Terms must prohibit underground-outing *without teaching adversaries how the protections work*. Specifics that should stay **out** of the public Terms text: the existence and mechanics of the flag-keyword taxonomy (pattern secrecy is a locked engineering rule — "pattern strings come from the FLAG_TAXONOMY secret… NEVER inlined" `send-message/matcher.ts:18-20`), join-code mechanics beyond what the user experiences, the admin-only region field, and any enumeration of what the database does or does not store for underground churches beyond the Privacy Policy's own (corrected — see Part E) language. The Terms can say *that* messages may be reviewed for safety (the app already tells users this before their first DM: "Replant reviews messages that are flagged," `CovenantNotice.tsx:14-15`) without saying *how*.

**Open questions for LEGAL.** (1) Should the anti-doxing clause survive account termination as an express post-termination obligation (the Covenant's Article V says relationally: "What was sealed inside Replant remains sealed" — does the Terms need the enforceable twin?)? (2) Remedies: is injunctive-relief language appropriate given that money damages cannot repair an outing?

**Boundary.** The Covenant carries the same duties in covenant register; the Terms must **reference** the Covenant and restate the prohibitions as enforceable conditions of access — not copy its text. (Covenant Founder notes, 2026-06-08, implementation ruling: the Covenant is "NOT a verification click-through (Declaration of Faith + Privacy Policy + ToU already do the acceptance work)" — so the Terms is where these duties become binding.)

## §6 — Content you submit

**Cover.** What content leaders submit; ownership and license; the delete/retention story; moderation described as it actually works.

**Verified facts.**
1. **Content types (all live tables, verified 2026-07-03):** prayer requests (+ prayed-by records), testimonies (+ celebrated-by; anonymous option; underground-church testimonies always anonymous), comments on announcements, direct and branch messages, heartcries (encrypted), connection-request messages, and church registration data (including a free-text `state_declaration` and optional needs/resources lists).
2. **Ownership/license: nothing exists today.** No license grant, no content-ownership language anywhere in-app. The scoping-note posture for §9 applies: "Your content remains yours. License grant to Replant (limited, for the purpose of operating the network)." LEGAL drafts this from scratch.
3. **Deletion story (verified, layered — the scoping note's "soft-delete pattern (D-01)" is now a fuller regime):**
   - Leader-initiated deletion: `fn_soft_delete_my_account` marks the account soft-deleted, inactive, and schedules hard delete at +30 days (migration `20260623_0006`, 2026-06-23: "Sets soft_deleted_at, hard_delete_scheduled_at = now()+30d, is_active=false").
   - Restore: `fn_restore_my_account` self-restore within 30 days, only for leader-initiated deletion; admin-initiated deactivation tells the leader "contact team to restore" (same migration).
   - Day 30: a daily sweeper (live cron, 03:00 UTC) scrubs PII to a tombstone — name fields become "[redacted]", the email is rewritten to a `deleted+<uuid>@projectreplant.org` placeholder to free the address for re-signup, the authentication record is deleted outright, and a skeleton row remains to preserve the audit trail (migration `20260623_0007`, 2026-06-23, Founder ruling 2026-06-22 quoted therein: "Day 30 hard-delete = PII scrub… + skeleton row stays + auth.users row DELETED").
   - Separately, asymmetric PII scrubbing runs nightly (live crons): contact PII scrubbed **90 days** after deactivation and **7 days** after verification rejection (ruling D-42/ADR-004, 2026-05-08; both `scrub_user_pii` and `scrub_church_pii` verified live with 90-day and 7-day branches, 2026-07-03).
   - Content the leader posted to shared surfaces (prayers, comments, messages already delivered) is not represented as recalled by account deletion — the Terms should say what deletion actually removes (identity/PII) versus what persists (delivered messages in others' conversations; the immutable audit log).
4. **Moderation reality (must be described truthfully):**
   - Outbound messages are scanned server-side against a confidential keyword taxonomy; a match writes a flag on the message row and routes it to admin and/or pastoral review queues. **Flagging never blocks or delays delivery.** This is a locked decision — D-45 clause 3 (2026-05-09), restated in code: "keyword match writes `flagged` and `flag_reason` columns ONLY. It does NOT gate the INSERT, the Realtime broadcast, or the 200 response. A HOLD requires explicit admin action — never automatic" (`send-message/index.ts:9-14`). The Form 1023 narrative (2026-06-08) states the pastoral reason: "for leaders in persecuted contexts, a silent message hold or delivery delay can carry life-and-death implications… The Corporation does not monitor message content for purposes unrelated to the safety of the network's leaders."
   - Flag review: flagged messages enter an admin review queue; serious cases escalate to a restricted "Escalated Cases" surface visible only to the two highest admin tiers ("super_admin + Manager only, anti-gossip rule," migration `20260701000001`, 2026-07-01). Messages touching underground contexts auto-escalate at write time.
   - Outreach: if the team contacts a leader about a case, it arrives as a Connect direct message attributed as "[First name] · Replant Team" (migration `20260701000007`, 2026-07-01), falling back to plain "Replant Team".
   - Accountability: every privileged admin action (verification, deactivation, reading a heartcry, escalation reach-outs) writes to an append-only audit log; a live database trigger blocks any UPDATE or DELETE on it (`audit_log_immutable`, verified live 2026-07-03; ADR-001). The Terms can honestly say safety reads are permanently recorded.
   - The pre-first-DM notice already sets user expectation in-app: "Replant reviews messages that are flagged" (`CovenantNotice.tsx`, Founder-ratified copy).
5. Direct messages are **not encrypted at rest** at MVP (threat model, 2026-05-08, accepted risk; `messages.content` is a plain text column, verified live 2026-07-03). The Terms must not imply otherwise; the Privacy Policy owns the fuller disclosure.

**Open questions for LEGAL.** (1) License scope: does "operate, display to intended recipients, moderate for safety, and back up" suffice, with an express no-commercial-exploitation covenant mirroring the 1023 language? (2) Moderation description depth: how much of item 4 belongs in the Terms versus the Privacy Policy? (Recommend: Terms states that safety review exists, never holds delivery, and is audited; Privacy Policy carries the data-handling detail.) (3) Any needed consent language for the pastoral-alert email pathway (a tier-1 pastoral flag triggers an email notification to the triage lead)?

**Boundary.** Retention *numbers* are shared with the Privacy Policy — keep one source of truth and cross-reference; the Terms should carry the user-facing consequences (what delete does, what persists).

## §7 — Replant's role and limits

**Cover.** Replant connects and stewards; it is not emergency services, professional counseling, medical care, or legal advice; no guaranteed response windows.

**Verified facts.**
1. Heartcry triage is a designated-person model: the triage lead is resolved from a secure vault at startup and every heartcry is assigned to that lead (ruling D-26, 2026-05-02, "Heartcry triage fixed designated person"; `submit-heartcry/index.ts` boot sequence). Severity is classified in five tiers and four request types (Form 1023 narrative, 2026-06-08: "Active Persecution, Urgent, Serious, Ongoing, Informational… Prayer, Practical Support, Guidance, or Just to be Heard").
2. Response channel commitment already made in the 1023 narrative (2026-06-08): "The Corporation responds to Heartcries through secure in-application direct messages, never through external channels unless the leader explicitly consents."
3. **No response-time promise exists anywhere in the system** — there is a daily pastoral digest and an immediate alert email for tier-1 pastoral flags (live cron + code), but these are internal routing, not user-facing SLAs. The scoping note (2026-05-13): "We do not guarantee response within any specific window for non-heartcry surfaces." Note: even for heartcries, no time-bound promise exists in code or docs — the Terms should not invent one.
4. **No emergency-services disclaimer currently exists in the app.** The Heartcry submission screen does not tell a leader in acute danger to also seek local emergency help. The Terms' §7 disclaimer will, for now, be the only place this is said (flagged as a worksheet item in the lane verdict; an in-app line may follow as a FE ticket).

**Open questions for LEGAL.** (1) Standard "not a substitute for emergency services" language needs persecuted-context sensitivity — in some users' jurisdictions the police *are* the threat; consider "emergency services where it is safe for you to use them" phrasing. LEGAL's judgment on wording. (2) Does the pastoral triage function create any duty-of-care exposure that §11/§12 must expressly bound (a "we will act in good faith but cannot guarantee outcomes" clause)?

**Boundary.** The Covenant (Article III, 2026-06-08) covers how *leaders* treat heartcry knowledge ("that knowledge is sealed"); the Terms covers what *Replant* is and is not undertaking to do.

## §8 — Privacy

**Cover.** Cross-reference to the Privacy Policy; short highlights of architectural protections.

**Verified facts (safe-to-state highlights, each verified live 2026-07-03).**
1. Underground churches: the database physically rejects city and coordinates for underground rows (live CHECK constraint `underground_no_location`), and other leaders only ever see the label "Underground Church" (server-side masking in the discovery/profile functions).
2. Heartcries are stored encrypted with a key held in a separate vault; decryption happens only through an audited admin path with a 90-second step-up re-authentication window (threat model T-02 mitigations, 2026-05-08).
3. The admin audit log is append-only, enforced by a database trigger (live).
4. Asymmetric PII retention (90-day / 7-day) plus the 30-day post-deletion scrub (§6.3).

**Critical accuracy guardrails — do not import these claims (details in Part E):** the interim Privacy Policy v0.2's sentence "Not country, not city, not address, not coordinates" is **wrong on country** (all 38 live underground churches store a country, and an admin-only macro region field exists); and heartcry encryption is **server-side, not end-to-end** (the plaintext transits Replant's edge function over TLS before encryption; Replant can decrypt by design — the interim policy's own "We can decrypt and read it pastorally" is the honest framing).

**Open question for LEGAL.** The mobile app's iOS location-permission string reads: "Replant uses your location to show verified churches nearby. Your position is never shared." (`app.json:21-22`). The client's GPS position is sent to Replant's server to run the nearby-churches query (it is not persisted as a location history, and is not shared with other users). Is "never shared" acceptable as-is (meaning: never shared with third parties/other users), or should the Privacy Policy carry a clarifying disclosure the Terms can lean on?

**Boundary.** All collection/retention/rights detail is Privacy Policy territory. §8 of the Terms should be short: the cross-reference, the effective-date linkage, and three or four verified architectural highlights.

## §9 — Intellectual property

**Cover.** Replant's marks; user content ownership; limited license (drafted under §6); scripture texts.

**Verified facts.**
1. Marks in actual use: "Replant" (trade name authorized in Bylaws draft §1.1) and "Project Replant" (domain projectreplant.org; email identities; the Jira project is "Project Replant Team"). No registered-trademark filing is referenced anywhere in the artifact set — LEGAL should not assert registration.
2. All scripture across app and documents is KJV (Covenant notes, 2026-06-08: "All KJV, all doing real work").
3. The app's fonts/assets are standard licensed resources; no user-facing IP complications found.

**Open questions for LEGAL.** (1) Confirm KJV public-domain posture is un-flagged for a globally distributed app (the Crown-rights nuance in the UK) or decide it is de minimis for a Terms document. (2) Mark-protection clause scope for an unregistered mark.

**Boundary.** License-to-Replant text lives once — either §6 or §9 — with the other cross-referring. Recommend the grant in §6 (where content is defined) and §9 owning marks + Replant-owned materials.

## §10 — Suspension, deactivation, removal

**Cover.** When and why Replant may restrict, deactivate, or remove; what the leader can do (restore, appeal); retention consequences.

**Verified facts.**
1. **Deactivation reasons are a closed set in the schema** (live CHECK constraint, churches; mirrored for users): `leader_initiated`, `admin_deactivation`, `verification_lapse`, `underground_join_code_compromised`, `reported_violation`, `safety_evacuation`. These six reasons are an honest skeleton for the Terms' "when we may act" list — note that two of them (`underground_join_code_compromised`, `safety_evacuation`) are *protective* deactivations done for the leader's safety, worth naming as such.
2. Underground-church destructive actions (verify/reject/deactivate) require the two-person propose/confirm ceremony (§2.3). Verification rejection cascades: the church's leaders are deactivated with a 30-day hard-delete scheduled (migration `20260702024007`, 2026-07-02).
3. Restore paths: self-restore within 30 days only for leader-initiated deletion; "admin-initiated deactivation; contact team to restore" (RPC error text, migration `20260623_0006`). The Terms' appeal path should match: direct contact with the team.
4. Retention on exit: the layered regime in §6.3 (30-day tombstone; 90-day/7-day scrubs). The scoping note's §10 line "Asymmetric PII retention (D-42): 7d rejected, 90d deactivated. Appeal path." is still true but incomplete — describe the layered regime.
5. **Gap the Terms must not paper over:** the in-app self-deactivation flow is not yet wired — Settings shows "Account deactivation is on the way. A guided deactivation flow will be available before launch." (`SettingsScreen.tsx:783-788`), and the backend deletion functions have no mobile call site yet. Apple's guideline 5.1.1(v) requires in-app account deletion for apps with account creation, so this ships before submission; draft §10 to describe the flow as it will exist at submission, and the lane verdict flags the build dependency.

**Ruling (tone).** Covenant Article V (2026-06-08): "If the day comes when the Replant team must, for any reason, remove a leader from the network, we do so prayerfully, communicate clearly, and continue to pray for that leader's ministry going forward. Removal is a pastoral act, not a punitive one. Our hope is always restoration." The Terms should be consistent in spirit while remaining operative.

**Open questions for LEGAL.** (1) Does Replant reserve immediate-removal power without prior notice for safety cases (it operationally has it), with notice-after where lawful? (2) Should the appeal path be formalized (a named mailbox and a response commitment) or kept as "contact the team"? Note the Privacy Policy committed to seven-day responses for data-rights requests (2026-05-13 draft) — avoid accidental inconsistency.

**Boundary.** Post-removal confidentiality duties → §5 / Covenant. Data consequences → shared with Privacy Policy.

## §11 — Disclaimers

**Cover.** "As is"; no uptime/latency guarantee; honest persecuted-context framing; third-party dependencies.

**Verified facts.**
1. **No uptime promise, SLA, or availability commitment exists anywhere** in the codebase, docs, or public copy (verified by sweep). The scoping note (2026-05-13): "No guarantee of message delivery latency, uptime, or any commercial-style SLA. Persecuted-context honest framing."
2. DELIVER-ALWAYS is a *design posture*, not a delivery guarantee: flags never hold messages, but the Terms should not convert that into a promise that any message will be delivered (network failures, service outages, and account states can all prevent delivery). Describe it as: Replant will never *intentionally* delay or withhold a message based on automated content review.
3. Third-party dependencies are named in the threat model (2026-05-08, assumptions): "Supabase, Netlify, and Resend are trusted services." (Plus Upstash for rate limiting and Expo/EAS for app delivery.) Their outages are outside Replant's control — standard third-party disclaimer applies; the Privacy Policy owns naming them as processors.
4. Accepted-risk honesty available for LEGAL's calibration (threat model, 2026-05-08, Accepted Risks table): DM content not encrypted at rest (forward-tracked); point-in-time backup recovery deferred; device-seizure threats out of scope ("We do not currently defend against an attacker with the unlocked device in hand").

**Ruling (register).** The Privacy Policy v0.2 (2026-05-13) models the voice: "No website or network can promise that no piece of information will ever be exposed. Anyone who tells you otherwise is not being honest with you."

**Open question for LEGAL.** Warranty disclaimers must be conspicuous (caps/bold) under US law — how does that interact with the document set's pastoral typography? (Recommend: keep the conspicuous block, add one preceding sentence in the house voice explaining why it is there.)

**Boundary.** Security-architecture detail → Privacy Policy §8 cross-ref. This section is about what is *not promised*.

## §12 — Limitation of liability

**Cover.** Standard limitation with the ethic the scoping note locked.

**Rulings.** Scoping note (2026-05-13): "Standard limitation, with explicit carve-outs we will not hide behind (gross negligence, willful misconduct). Per Replant's threat-model ethic, we do not minimize accountability for safety-relevant failures behind boilerplate." Threat model (2026-05-08): "We are not modeling business risk; we are modeling physical safety."

**Verified facts feeding calibration.** The service is free (no fees to refund or cap against); the corporation currently has no revenue and no D&O policy yet (Bylaws draft §6.3 only *permits* insurance). A conventional "liability capped at fees paid in the last 12 months" clause would compute to zero — LEGAL should choose a structure that is honest rather than mechanically commercial.

**Open questions for LEGAL.** (1) Cap structure for a free charitable service (fixed nominal cap vs. exclusion-of-categories-only). (2) Do Georgia charitable-immunity or volunteer-protection doctrines interact with this section for a nonprofit with volunteer operators? (3) Consumer-law override notice for international users ("some jurisdictions do not allow…" savings clause).

**Boundary.** Indemnification of *directors/officers* is bylaws territory (Article VI) — do not restate it here; §12–§13 govern the user relationship.

## §13 — Indemnification

**Cover.** Scoping note (2026-05-13): "Standard, narrow. Reciprocal where appropriate."

**Verified facts.** No existing indemnification language anywhere user-facing. Note the audience: asking persecuted-context leaders with no resources to indemnify a US corporation should be narrow indeed — tie it to breach of §5 conduct duties and unlawful use, not to blanket "any claim arising from your use."

**Open question for LEGAL.** Is a reciprocal indemnity (Replant → leader) prudent or overreach for a nonprofit with no insurance yet? The scoping note raises reciprocity; LEGAL should test it against the entity's actual capacity to stand behind it.

## §14 — Governing law and disputes

**Cover.** Georgia law; dispute-resolution ladder; the international-leader carve-out.

**Rulings and verified facts.**
1. Scoping note (2026-05-13): "Georgia, USA. Dispute resolution path (mediation first, arbitration consideration, court as last resort). International-leader carve-out: leaders in jurisdictions where US arbitration would be impossible or hostile to their safety retain access to home-jurisdiction dispute paths." Bylaws draft §12.2 already fixes Georgia law for governance.
2. The scoping note's open input from the Founder (2026-05-13, still open): "International dispute carve-out posture: how far do we go to honor leaders in hostile jurisdictions who cannot use a US arbitration path?" Treat as a sub-question inside this section; LEGAL proposes, Founder confirms.
3. Live Jira anchor for the international dimension — KAN-157 (verified live 2026-07-03, status Backlog): "Replant serves verified church leaders globally — including regions with distinct data privacy regimes (EU/GDPR, UK GDPR post-Brexit, Nigeria NDPR, India DPDP Act 2023, Brazil LGPD, South Korea PIPA, and others)." The Terms should not attempt jurisdiction-specific carve-outs clause-by-clause in v1; a general savings clause plus the KAN-157 compliance memo (separate deliverable) is the working split.
4. The relational conflict pattern is Covenant territory — Article IV (2026-06-08) encodes Matthew 18 ("We address it first directly, in private… If that does not resolve, we bring a witness. If that does not resolve, we bring it to the Replant team.") The Terms' dispute section governs legal disputes with *Replant*, not disputes between leaders.

**Open questions for LEGAL.** (1) Mediation-first with a faith-based mediation body — enforceable and prudent? (2) Arbitration: include, exclude, or offer as claimant's option? (Mandatory arbitration plus class waiver reads adversarial for this audience; the scoping note only says "arbitration consideration.") (3) The carve-out drafting itself: how to give hostile-jurisdiction leaders a safe path without inviting universal forum-shopping.

**Boundary.** Leader-versus-leader conflict → Covenant. Data-rights complaints → Privacy Policy (which committed, 2026-05-13 draft: "If you are outside the United States, your local data laws may give you additional rights against us. We will honor those rights to the extent the law gives them.").

## §15 — Changes to these Terms

**Cover.** Notice period; communication channels; right to decline by deleting the account; re-acceptance mechanics.

**Verified facts.**
1. Precedent already set by the Privacy Policy draft (2026-05-13): "The full Privacy Policy that replaces this one at launch will be published with at least thirty days' notice before it takes effect." A parallel 30-day-notice posture for material Terms changes keeps the set consistent — LEGAL to confirm the period.
2. Available notice channels that actually exist: transactional email (Resend, from noreply@projectreplant.org — live sending identity in code), in-app announcements (live `announcements` table + Home surface), and the website.
3. "Delete your account if you decline" depends on the §10 in-app deletion flow shipping (see the gap in §10.5).
4. If Decision 2 lands on a versioned acceptance record, material changes can trigger re-acceptance with a version bump — draft the clause to permit but not hard-require in-app re-acceptance, pending the decision.

**Open question for LEGAL.** Standard for "material" change requiring notice versus silent fixes (typos, contact addresses)?

## §16 — Contact and a word at the close

**Cover.** Contact channels; scripture anchor; pastoral close matching the Privacy Policy's register.

**Verified facts.**
1. Existing addresses (threat model, 2026-05-08, operational surface): ruth@projectreplant.org (founder), connect@projectreplant.org and accounts@projectreplant.org (pastoral and account contact paths). The Privacy Policy carry-forward item (2026-05-13, still open) recommends creating privacy@projectreplant.org — a parallel question exists for a terms/legal contact address. LEGAL should draft with a bracketed contact pending Founder's choice; **do not** invent an address.
2. Postal: the registered office (141 Buford Drive, Lawrenceville, GA 30046) exists; whether to publish it in the Terms is Founder's call (the Privacy Policy draft left "[postal address]" bracketed too).
3. Register model — the Privacy Policy's close (2026-05-13): "You are not a record in a database. You are a member of the Body of Christ who has trusted us with a small piece of yourself. We are trying to be worthy of that trust." The Covenant's close anchors John 17:21, "Replant's central verse" (Covenant notes, 2026-06-08). Scripture choice here is Decision 3 territory.

---

# Part D — Source artifacts (absolute paths)

**LEGAL artifact set (HTML documents, in the cowork-visible folder):**
1. `/Users/ife/Documents/Claude/Projects/Replant/replant-tos-scoping-note-v0.1.html` — the 16-section structure this brief follows (2026-05-13).
2. `/Users/ife/Documents/Claude/Projects/Replant/replant-community-covenant-draft-v0.1.html` — sibling covenant, v0.1 (2026-06-08).
3. `/Users/ife/Documents/Claude/Projects/Replant/replant-interim-privacy-policy-draft-v0.2.html` — privacy boundary + voice model (2026-05-13).
4. `/Users/ife/Documents/Claude/Projects/Replant/replant-bylaws-draft-v0.1.html` — entity, non-membership, Georgia law (2026-06-08).
5. `/Users/ife/Documents/Claude/Projects/Replant/replant-form1023-narrative-draft-v0.1.html` — activities, EIN, filing-readiness status (2026-06-08).
6. `/Users/ife/Documents/Claude/Projects/Replant/replant-threat-model.html` — threat actors, accepted risks, safety ethic (2026-05-08).

**Repository facts (verified read-only in `/Users/ife/replant`, branch `feat/kan-296-mobile-attribution-slot`, plus the live Supabase database, 2026-07-03):** key files cited throughout Part C; the companion gap file for this lane is `/Users/ife/replant/docs/audits/2026-07-03-compliance-a11y-store-audit/tos-lane.md`.

# Part E — Structural verdict and facts LEGAL should NOT rely on

## E.1 Verdict on the 16-section structure

The architecture is sound and the Replant-specific weaving is right. It has **one real hole and one soft gap**:

1. **Missing section — platform (Apple/Google) required terms.** Apps distributed with a custom EULA/Terms must carry the store operators' minimum provisions: acknowledgment that the agreement is between the user and Replant (not Apple/Google), that the store operator has no maintenance/support or warranty obligation, and that the store operator is a third-party beneficiary entitled to enforce the Terms. Apple's minimum terms also include an export-control/embargo representation ("not located in a country subject to a U.S. Government embargo…"). **For Replant this is not boilerplate:** leaders in embargoed or sanctioned jurisdictions are plausibly part of the served audience, and a representation clause could make truthful acceptance impossible for exactly the leaders the platform exists to protect. LEGAL should draft the platform-terms section (recommend a new §17) and give a considered judgment on the embargo representation — verbatim adoption, narrowed drafting, or store-guidance-compliant alternative.
2. **Soft gap — general provisions.** No section carries severability, entire-agreement, assignment, no-waiver, survival, or force majeure. Severability appears in the Bylaws draft (§12.1) but nothing user-facing. Recommend folding into the new §17 or a short §18, with survival expressly covering §5's confidentiality duties (the Covenant's "sealed after departure" principle needs an enforceable twin that outlives termination).

## E.2 Facts LEGAL should NOT rely on (stale or wrong against verified code/data)

1. **"Underground churches: zero geographic data… Not country, not city, not address, not coordinates" (interim Privacy Policy v0.2, 2026-05-13) — wrong on country.** Verified live 2026-07-03: the signup validator *requires* country for every church type including underground (`create-account/logic.ts:106`), country is deliberately not stripped on the underground path (`logic.ts:183`), all 38 live underground churches have a country stored, and every one has an admin-only macro-region field set. The database CHECK forbids only lat/lng/city. True statement: *no city, no coordinates, no address; country and an admin-only macro region are stored*. Do not port the v0.2 sentence into the Terms; the Privacy Policy needs its own correction (flagged in the lane verdict).
2. **Heartcry described as "End-to-end encrypted" (Jira KAN-157 description, live text) — overclaim.** Verified: heartcry plaintext travels from the client over TLS to Replant's edge function, which encrypts it server-side via the `encrypt_heartcry_content` database function with a Vault key before storage (`submit-heartcry/index.ts:7-9`). Replant can decrypt by design through an audited path. "Encrypted at submission, never stored in plaintext, decryptable only by an audited admin path" is honest; "end-to-end" is not.
3. **`covenant_ack` is not covenant acceptance.** It is a device-local, never-synced flag for the one-time Connect first-send notice. No server record exists that any leader acknowledged anything covenant-related. Anyone summarizing "the covenant is acknowledged at signup" is wrong twice (wrong document, wrong persistence).
4. **The scoping note's §6/§10 retention description (2026-05-13) is incomplete.** "Soft-delete pattern (D-01)" and "7d rejected, 90d deactivated" are both still real, but the operative regime is now layered: leader-initiated delete → 30-day restore → Day-30 tombstone + auth deletion, *alongside* the 90-day/7-day scrubs, plus a rejection cascade that schedules leader hard-deletes at 30 days (migration `20260702024007`, 2026-07-02). Use §C.6.3 of this brief.
5. **Public FAQ claim "Users will be informed of this in the community covenant at signup" (projectreplant.org, live) — does not match the ruled design.** The Covenant is expressly *not* a signup click-through (Founder ruling in Covenant notes, 2026-06-08); the actual in-app notice about flagged-message review appears before the first DM, not at signup. The Terms should describe the review truthfully (§C.6.4); the FAQ needs a copy correction (lane verdict).
6. **Do not represent 501(c)(3) status.** Form 1023 is unfiled (readiness checklist, 2026-06-08). The entity is a Georgia nonprofit corporation, nothing more yet.
7. **Do not describe an in-app account-deletion flow as existing.** It is a placeholder in Settings today; the backend functions exist but are unwired in the mobile app (verified 2026-07-03). Draft §10 for the flow as it must exist at store submission, and treat wiring it as a build dependency (lane verdict, store blocker).
8. **"Two leaders maximum per church" and "single church per leader" (scoping note §2–3) — both verified true**, retained here so LEGAL knows they were checked rather than assumed (`CHURCH_LEADER_CAP = 2`, one `church_id` per user).

---

*Prepared under the standing rule that live Jira is the source of truth for ticket cites (KAN-157 spot-checked live 2026-07-03) and that working summaries drift — which this verification pass confirmed twice (E.2.1, E.2.2). May the Lord guard the leaders these Terms exist to protect.*

---

## Addendum — Founder rulings 2026-07-03 (binding for drafting)

1. **Encryption representations.** Any language touching heartcry or message security describes the current model truthfully (server-side encryption at rest with audited, TOTP-gated admin access) — never "end-to-end" as present fact. A good-faith forward commitment MAY be included where posture is discussed: full end-to-end encryption for heartcry is Replant's highest post-MVP engineering priority. Counsel drafts wording; no overclaim of present state.
2. **Audit/access-records retention: indefinite, all classes** (Founder-ruled 2026-07-03, superseding the earlier 30-day age-out element). Any retention language must reflect indefinite retention of audit/access records, disclosed plainly.
