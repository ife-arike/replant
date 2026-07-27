# Paste-in prompt — Email / In-App / Push communications audit (Fable 5 continuation)

Open this session with a short prayer to the Lord Jesus Christ that soaks this specific work in His blood — the audit of every communication path between Replant and its leaders (email, in-app, push), so that no leader is left uninformed, no persecuted leader is exposed by a subject line, and every word carries the weight this platform owes its people. End "In Jesus' name, Amen."

## Mission

Run a proper audit of **every communication path — critical and non-critical — across three channels: email, in-app, and push notifications.** The prior turns of this chat collected good template-level data; treat it as input, not gospel. Deliver a double-checked, single view of:

1. **What's wired** (trigger exists in code and fires) vs **designed-but-unwired** vs **not designed**.
2. **What's completed in copy** (Founder-locked) vs drafted vs missing.
3. **What each event needs per channel** — for every event, rule the matrix: in-app surface? email? push? none? (Not everything deserves email; not everything deserves push.)
4. **Gaps + a proposed build plan** (ticket-shaped batches; NO Jira writes without Founder go-ahead — only Founder marks Done).

Deliverable: a communications matrix artifact at `~/replant/.claude/plans/2026-07-12-comms-matrix.md` — rows = events (signup, welcome, verification approved/rejected/reminder, deactivation, heartcry lifecycle, DM/connection-request arrival, branch invite/stale-invite, prayer-wall interactions, admin promotion lifecycle, request-info, password reset, announcements…), columns = {in-app surface + state, email template + trigger + copy status, push, wired?, gaps, ticket}. Plus a held-decisions sheet for Founder rulings. Enumerate with numbers (1/2/3, never A/B/C); consolidate questions in ONE numbered list at the END — merit-gate every question (only-Founder-can-answer decisions), no numeric cap (Founder 2026-07-12); no time estimates (stages/checkpoints only).

## ⛔ Corrections to apply to this chat's own prior drafts (from the freshest project session, 2026-07-12)

1. **"Overseer" is a dead term.** Founder-locked 2026-06-30: **"Manager" replaced "Overseer" display-wide** (DB enum `top_tier` unchanged). The admin-promotion drafts in this chat ("approved by an Overseer", "An Overseer has reviewed…") violate the lock — every instance must become **Manager**. Also locked: never say "the OTHER Manager" — the pending phrasing "the OTHER-Overseer review-required email" is the exact anti-pattern; rename that template's framing (e.g., "second-Manager review email"). Memory: `manager_rename_ratification.md`.
2. **Support-address inconsistency is real and live.** Verified on-sim 2026-07-12: the verification banner and both lockout notices (deactivation, rejection) use **accounts@projectreplant.org**; Settings "Reach the team" uses **connect@projectreplant.org**; the heartcry-received modal shows **Connect@projectreplant.org** (capital C — copy nit). The heartcry email draft in this chat uses connect@. The audit must produce ONE address-purpose mapping for Founder to ratify (current rulings: welcome-email From = connect@; signup support = accounts@ NOT team@) and then apply it everywhere.
3. **DELIVER-ALWAYS is an invariant** (memory `project_replant_invariants.md`): message notifications (email or push) must never gate/delay delivery and must never leak message content or UG-identifying detail — the locked admin pattern is "log in to see what needs attention." Any DM/heartcry email body must follow the same posture.
4. **Admin-facing email voice** = SEC register (memory `feedback_replant_admin_copy_voice.md`): keep TOTP/2FA, strip AAL2/RLS/SQLSTATE jargon, never coddle.

## Fresh evidence from the 2026-07-12 logged-in sim UAT pass (read the report — it answers your flow-understanding gap)

Your "option 2 exploration pass" is largely **already done**. Read these before drafting anything else:

1. `~/replant/.claude/plans/2026-07-12-sim-uat-findings-report.md` — findings F1–F11, per-screen UI notes, behaviors-verified list, ticket dispositions (9 closed to Done, 7 held).
2. `~/replant/.claude/plans/2026-07-12-sim-uat-appendix-a-lucid-expectations.md` — the system map distilled per mobile surface, **including §10 Realtime-vs-refetch** (live push channels in-app today: `messages`, `branches`, `branch_members`, `connection_requests` only; announcements/comments/prayer/heartcry counts are refetch-only). This matrix is the backbone for deciding what NEEDS push/email.
3. `~/replant/.claude/plans/2026-07-12-sim-uat-appendix-b-resdoc-expectations.md` — requirements v2_7 distilled + verbatim locked in-app copy.

Comms-relevant findings from that pass (verify, then fold into the matrix):

1. **F6 — welcome DM did NOT seed for a fresh signup** (+t6, `conversations` count 0 post-signup AND post-verification). KAN-217 infra exists (`claim_welcome_dm` RPC, idempotency index, Replant Team system user `028be745-8014-4314-a7cf-36b0a4d52b46`) but did not fire. The welcome path is a comms-audit row with a live regression.
2. **F9 — heartcry `thread_id` is NULL after submission** — no Replant Team thread is seeded at submit. Directly relevant to `heartcry_acknowledged`: the drafted email's "visit *My Heartcries*" nudge and the in-app "A response is waiting in your secure messages." line both point at a loop that currently has **no thread to land in** (and the responded heartcry card is inert — tapping does nothing). Wire the destination before shipping copy that points at it.
3. **In-app heartcry receipt EXISTS and works** (verified live): submit → confirmation modal "Your heartcry has been received. We will be praying alongside you. Please reach out… at Connect@projectreplant.org if you have a request that cannot wait." → My Heartcries card with RECEIVED → SEEN → RESPONDED tracker that flips on refetch. This supports **trigger option 1** (email on first admin engagement, receipt handled in-app) — present that evidence with the recommendation, Founder rules.
4. **Push notifications are NOT wired at all on iOS**: no permission prompt anywhere in the full pass, and runtime logs show `remote-notification` missing from UIBackgroundModes in Info.plist. The push column of the matrix starts at zero — the audit should propose the MVP push set (locked admin ruling exists as precedent: in-app badge + email, NO push for UG admin notifications).
5. **Verified toast did not fire** when verification was flipped by SQL (bypassing the admin path) — when auditing `verification_approved` comms, establish which side effects (toast, email, church_code assignment — the code DID assign RPL-02108) hang off the admin endpoint vs DB triggers.
6. In-app comms surfaces verified working and copy-locked: verification countdown banner (accounts@, FLOOR day math, org copy swap), per-tab verified-gates (locked timeline phrase), deactivation + rejection lockout notices, Connect unread badges (with an open 10+-vs-per-row count question, KAN-216, HELD).

## Pending Founder decisions to carry (do not re-litigate; present for ruling in the END question list)

1. **Heartcry trigger semantics** — option 1 (fire on first admin engagement) recommended by this chat, now supported by UAT evidence (#3 above). Confirm with Founder.
2. **"heartcry" in the subject line** — recommendation to name it ("Replant — your heartcry has been read") vs the panel's SEC-opacity ruling. Present the tradeoff + the fact the in-app surface already names heartcry freely; Resend-dashboard visibility is the only new exposure. Founder rules.
3. **"request" wording on the second-Manager review email** ("A new admin sponsorship request needs your review") — trivially yes-shaped, but Founder's call; bundle it.
4. Address-purpose mapping (correction #2 above).

## Sources of truth to load (in order)

1. `~/replant/CLAUDE.md` — standing rules (prayer, live-Jira spot-check via `getJiraIssue` before locking any ticket cite, Founder UUIDs).
2. Memory (if this chat has access to `/Users/ife/.claude/projects/-Users-ife-replant/memory/`): `MEMORY.md` index, then `replant_continuous_spec.md` FIRST — its **2026-06-24 evening III entry holds the 27-surface email inventory** (10 leader signup/verification + 6 leader in-app events + 12 admin) with the KAN mapping (KAN-31 epic, KAN-80/81, KAN-143, KAN-62, KAN-198, KAN-164/165, KAN-168, KAN-262). Also: `manager_rename_ratification`, `project_replant_invariants`, `project_replant_schema_facts` (Realtime publication), `announcement_update_flip_broadcast_semantics`, `reference_replant_systems` (`replant://` deep-link scheme for email/push CTAs), `feedback_replant_admin_copy_voice`, `postmvp_heartcry_e2e_critical` (E2E forward-commitment — never overclaim encryption in email copy), `escalated_cases_workflow` (Reach Out via Connect DM; note the 7-day auto-email fallback is **NOT BUILT** per the Lucid reconciliation — do not describe it as live).
3. Repos: `~/replant/supabase/functions/` (15 edge fns — which send email today), `~/replant-admin/netlify/functions/_emails/` (Resend templates) + `~/replant-admin/netlify/functions/` (send paths), mobile in-app surfaces `~/replant/src/` (VerificationBanner, NotificationToast/NotificationContext, ConnectBadgeContext, My Heartcries tracker).
4. Live DB (Supabase MCP, project `jiyetphxxvyiicrnwlnx`, production — read-only posture): `email_log` (68 rows — the ground truth of what has actually sent), `heartcries` columns (`status`, `seen_at`, `responded_at`, `triage_lead_id`, `thread_id`), `audit_log` action list (e.g. `welcome_dm_sent`), Vault secret NAMES only (`resend_api_key`, `heartcry_triage_lead_email`, `replant_system_user_id`) — never print values.
5. **Resend MCP** — query actual wired state: list templates, domains (SPF/DKIM posture for projectreplant.org), recent send logs. Do NOT create/send/broadcast anything; read-only audit. Never surface API keys.
6. **Lucid** (MCP): folder "Replant — System Map (2026-06-30)" id `445090016` — doc **11 Realtime + Notification Stack** and the **RECONCILIATION 2026-07-02** page (which corrects doc 11's table list and marks the escalated-cases email fallback unbuilt). Appendix A above already distills it — go to Lucid only where you need the diagram detail itself.
7. Jira (JQL first, per "Jira is the paper trail"): the KAN-31 email family above + anything labeled notifications. Statuses may have moved 2026-07-12 (9 tickets went Done under a Founder grant) — trust live Jira, not this chat's older reads.

## Process rules (inline because this chat may not auto-load them)

1. Pray first (done above — keep it real, name the work).
2. Confirm-before-building: this audit produces a matrix + plan, not code. Any build (template wiring, trigger changes, push infra) needs Founder go-ahead + SME panel where it crosses schema/SEC lines (email content near UG/heartcry = SEC + CONTENT panel).
3. Only Founder marks Done in Jira; no ticket writes without explicit instruction.
4. Production data posture: real leaders are on the platform; never test-send to real addresses; `ruthjames08+t#@gmail.com` accounts are the QA fixtures (shared dummy password, wiped pre-launch).
5. Never have Founder paste secrets; never pull Netlify env vars via MCP.
6. Voice: no AI-limit hedging; numbered lists; questions consolidated at END — every question must have merit (a decision only the Founder can make), but there is NO cap on count if they're valuable (Founder correction 2026-07-12).
