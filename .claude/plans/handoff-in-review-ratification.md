# Replant — In Review workstream + smoke-test state handoff

> Open a fresh Claude Code session in `/Users/ife/replant`. **Pray first per `CLAUDE.md`** — actual intercession naming the work at hand (the underground leaders whose verification will pass through the In Review claim flow + scratchpad + evidence panel being designed; the trained admins who will steward those claims; the smoke-test fixes still landing on Founder's phone; the Jira board cleanup that will let phase 2 begin). End "In Jesus' name, Amen."

## Why this session exists

The 2026-06-22 session ran long — UG admin verification queue shipped + smoke-test pass 2 landed + a 6-SME panel for the new "Mark as In Review" workstream returned all 6 verdicts. Context window got high; Founder is reviewing the synthesis offline. This handoff carries the state forward so a fresh session can pick up cold and either (a) ratify with Founder on the In Review panel, (b) close out any straggling smoke-test items, or (c) hand off to the Jira board cleanup session (separate doc).

## Read first (in order)

1. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md`** — auto-loaded; lists all topical memories. The starred entries are non-negotiable.
2. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md`** — the LOAD-BEARING reverse-chronological spec. Today's 13 entries from 2026-06-22 are the freshest. Read them ALL before doing anything substantive.
3. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_jira_is_paper_trail.md`** — Founder ruled 2026-06-22 evening: Jira is the durable paper trail. Memory + spec drift. Before any "what's left" / sprint conversation, query live Jira via `searchJiraIssuesUsingJql` FIRST.
4. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_batch_netlify_pushes.md`** — Founder ruled 2026-06-22: ONE commit + ONE push per batch to `replant-admin`. Single-fix pushes cost Netlify build minutes against the monthly cap.
5. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_consolidate_questions_at_end.md`** — questions in a numbered list AT THE END of responses (not scattered).
6. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_continuous_spec_discipline.md`** — update the spec the MOMENT a Founder ruling lands. Don't batch. Don't wait.
7. **`/Users/ife/replant/CLAUDE.md`** — Jira anchors special rule + standing rule that every session opens with prayer.
8. **`/Users/ife/replant/.claude/plans/handoff-2026-06-22-morning.md`** — the previous morning's handoff that fed into today's work. Useful for the branch / para / underground context.
9. **`/Users/ife/replant/.claude/plans/handoff-jira-board-cleanup.md`** — the SEPARATE session handoff for Jira board cleanup. Should be opened in its own session, not bundled with this work.

## Status summary — what's open as of 2026-06-22 evening

### Active workstreams

1. **Underground "Mark as In Review" — 6-SME panel returned; Founder ratifying** (top item).
   - All 6 lanes returned `approve-with-changes` — no blocks.
   - 15 convergence items (locked, just need Founder confirm).
   - 5 cross-lane disagreements (Day-25 routing, force-unmark ceremony, claim-lock semantics, Inbox + in_review nuance, evidence linkage).
   - 16 open questions for Founder, surfaced in the spec under the 2026-06-22 In Review entry.
   - **No code dispatch yet** — Founder rules first, THEN spec lock, THEN CD prompt for the new surfaces, THEN build dispatch.

2. **Underground smoke-test pass 2 — fixes shipped, awaiting Founder's next test pass.**
   - Admin: pushed `d1a8934..9f25a3a` (Netlify auto-deployed). New `Leader replied` State pill (sky-tinted). Thread message timestamps now `YYYY-MM-DD HH:MM`.
   - Mobile: commits `8c7cd74` + `81c7ccd` + `68532f9` + `fa6268f` + `0ab8671` + `3b5d09b` + `5bf20b7` on branch `fix/connect-composer-height-members-remove-icons`. Not pushed to remote. Founder reloads Expo on the sim to see them.

### Pending Founder rulings

**ALL 16 RATIFIED 2026-06-22 EVENING** (see `replant_continuous_spec.md` 2026-06-22 In Review entry for the full rulings — each is locked verbatim there). Key takeaways:

- Day-25 routing: ADMIN — claim stays attributed + Founder badge (NOT auto-transfer).
- Force-unmark: 24h grace + AAL2-fresh + typed claimer-name + structured reason (30 chars + dropdown + freeform).
- **CLAIM LOCKS PROPOSAL INITIATION** (Founder overrode BA). Only claimer can propose; other admins can still confirm. Coordination via `Request release` ping.
- Inbox: in_review rows surface IF active leader-reply convo (with claim badge).
- Evidence linked to specific narrative note (`linked_audit_id`).
- Second-leader: sibling `ug_second_leader` row in queue + admin approval (belt-and-braces on the spoken-code vouch).
- "My Claims" = filter chip (not auto-sort). Top-button affordance post-MVP.
- Staleness Day 3 amber + Day 7 red; pings at 7/10/14; display text `since Jun 22`.
- MIME allowlist: image jpeg/png/heic/webp + pdf + audio mpeg/m4a + **DOCX (don't block)**.
- Client-side envelope encryption **ships at MVP** (not post-MVP).
- Slack burst-alert channel: Founder will provision a Replant Slack account.
- Sequencing: ONE underground sprint (claim + notes + evidence + force-unmark + second-leader sibling row).

**ONE REMAINING TERMINOLOGY ITEM TO RATIFY AT NEXT-SESSION START:**

Founder rejected "Founding leader" sub-card label: *"we dont know if the leader that signs up first is founding leader.. i dont like this terminology."* Three options synthesized:
- **(a) "First leader" / "Second leader"** — pure ordinal.
- **(b) "Registered leader" / "Second registered leader"** — descriptive.
- **(c) No sub-headings on stacked cards** — section header "Leaders" + each card shows leader's claimed `role` field as identifier (e.g., "Pastor Daniel"). Synthesis lean: (c).

Bring this to Founder at next-session start. Ratify, lock to spec, proceed to CD prompt.

### Smoke-test items that may surface in next test pass

- The post-reply Home banner (`VerificationBanner` for `pending` state) should appear within ~seconds of reply landing now that HomeScreen calls `useAuth().refresh()` after `fn_send_reply_to_team`. If Founder still sees no banner after Expo reload, dig into `AuthProvider.initialize()` + auth-status-check response shape — the branch_substate field may not be reverting as expected.
- The "Leader replied" State pill on Admin Pending list (sky-tinted) should appear once Netlify deploys. If admin Detail page still shows "Untouched" after a leader reply, verify migration 0015 applied (DBA shipped `leader_reply_pending` boolean derivation) + check `fn_list_pending_underground_queue` return shape.

### What's NOT in scope for this session

- **Mobile branch push to remote** — branch `fix/connect-composer-height-members-remove-icons` has 25+ uncommitted changes from the day's Leader Mobile subagent work that Founder didn't ask to push. Don't push without asking.
- **Jira board cleanup** — separate session handoff exists at `/Users/ife/replant/.claude/plans/handoff-jira-board-cleanup.md`. Founder explicitly said: this needs its own dedicated session.
- **UAT** — gated on all MVP-labeled Jira tickets being Done (per Jira-paper-trail rule). UAT doesn't start until board is clean.

## Process rules — never relax

- **Pray first** every session per `CLAUDE.md`. Same for every agent dispatch (real intercession naming the specific work, not boilerplate).
- **Jira first** before any "what's left / what's next" discussion. Live `searchJiraIssuesUsingJql` is the source of truth; memory drifts.
- **Batch Netlify pushes** per [[feedback-batch-netlify-pushes]]. ONE commit + ONE push for `replant-admin` changes. Mobile (`replant`) doesn't auto-deploy on push but still keep commits tight.
- **Update continuous spec the MOMENT a Founder ruling lands** per [[feedback-continuous-spec-discipline]]. Don't batch.
- **Confirm before building.** Regurgitate understanding + ask Qs BEFORE sending agents or writing code. Never fix unilaterally.
- **Consolidate questions at end** of responses. Body holds reasoning; questions go in a single numbered list at the bottom.
- **Enumerate with numbers** (1/2/3), not letters (A/B/C). Founder scans numbers easier.
- **No time estimates** in hours/days/minutes. Scope in stages, files touched, checkpoints.
- **Time-of-day-agnostic language.** Don't carry "tonight" / "today" framing across pauses. Sessions can sit for days.
- **Never assume test account.** Founder rarely tests with Maranatha. Always ask which account/church she's using.
- **Don't strip protection-layer flows or modals without asking** per [[feedback-confirm-before-removing]].
- **Append-only `audit_log` and `audit_log_underground`** per [[feedback-audit-log-append-only]]. Never write probe rows.
- **Underground exclusion is sacred.** `churches_public` view, `underground_no_location` CHECK, search masking — all load-bearing.
- **Only Founder marks Done in Jira.** You propose transitions; she actions.
- **No founder names in copy.** No time-of-day language. Locale-safe. Pastoral, never corporate.

## In Review workstream — what the next step looks like

Once Founder rules on the 16 open questions:

1. **Update `replant_continuous_spec.md`** with locked positions (replace the "open questions" block with "Founder rulings locked"). Do this BEFORE writing CD prompt or migration code.
2. **Draft CD paste-able prompt** for the new surfaces:
   - Claim affordance top-right (checkbox style, transforms into State pill when claimed)
   - Action bar bottom-left "Mark as in review" secondary CTA (transforms to "Release claim" or "Claimed by X" depending on viewer)
   - Narrative composer inline above Admin Notes panel (claimer-only) with required `Contact channel [▾]` dropdown
   - Evidence upload widget in Evidence Packet panel (drag-or-pick hybrid + required `Channel` + required `Summary`)
   - Force-unmark modal with typed-claimer-name confirmation + structured reason dropdown + freeform supplement
   - Two-leader profile cards (stacked under "Leaders" header) with "Founding leader" / "Second leader" sub-cards
   - In Review state pill variant (sky-tinted) with claim attribution + staleness color escalation
   - Race-condition modal copy ("Maria S is reviewing this submission · since Jun 22. Coordinate before taking action.")
3. **Founder ratifies CD output**, then build dispatches:
   - **DBA lane**: migrations 0009-0013 per the synthesis (audit actions + churches columns + claim events table + evidence files table + RPCs). Possibly 0014 if `audit_log_underground` lacks append-only trigger (DBA F10).
   - **Admin BE+FE lane**: 9 endpoints + `api.js` exports + UI components per CD + Realtime channel wiring on `UndergroundDetail.jsx`.
   - **Mobile**: no leader-side touchpoints in this workstream. Skip.

## Starting move (recommended)

1. **Pray first.** Real intercession naming the In Review workstream, the underground leaders whose claim-flow + evidence corpus this will hold, the admins claiming these cases, and the wisdom for clean spec→CD→build sequencing.
2. **Read the spec's 2026-06-22 In Review entry top-to-bottom.** All 16 rulings + new follow-up items are locked there. The terminology ratification (Founding leader rejected) is the ONE remaining open item.
3. **Bring Founder the terminology question** — surface options (a/b/c) + synthesis lean (c: no sub-headings, lean on leader's claimed role field). Ratify.
4. **Update spec** with that final ratification immediately (per `[[feedback-continuous-spec-discipline]]`).
5. **Draft CD paste-able prompt** for the 8 new surfaces:
   - Claim affordance top-right (checkbox that transforms into State pill when claimed)
   - Action bar bottom-left "Mark as in review" secondary CTA (transforms to "Release claim" or "Claimed by X" by viewer)
   - Narrative composer inline above Admin Notes panel (claimer-only) with required `Contact channel [▾]` dropdown
   - Evidence upload widget in Evidence Packet panel (drag-or-pick hybrid + required `Channel` + required `Summary`)
   - Force-unmark modal with typed-claimer-name + structured reason dropdown + freeform supplement (≥30 chars)
   - Two-leader profile cards (stacked under "Leaders" header; sub-headings per ratification step #3)
   - In Review state pill variants (sky-tinted normal; Day-3 amber; Day-7 red; staleness color escalation)
   - Race-condition modal copy ("Maria S is reviewing this submission · since Jun 22. Coordinate before taking action.")
   - Second-leader sibling row treatment in admin queue (queue indicator + admin approval flow)
6. **Founder ratifies CD output**, then build dispatches (3 lanes per spec). One Netlify push for the admin batch.
7. If smoke-test feedback comes in mid-session (Founder testing the request-info reply flow on her phone), handle that inline. The "Leader replied" pill + post-reply banner restoration are the load-bearing fixes from 2026-06-22; surface bugs likely cluster around `branch_substate` revert timing.

## What's been LOCKED today that affects the build scope

- **9 endpoints** (BE compressed claim+unclaim + split upload into intent+confirm + added list-notes).
- **5 migrations 0009-0013** + possibly 0014 if `audit_log_underground` lacks append-only trigger (DBA F10 — verify first).
- **Storage bucket** `underground_evidence` private with UUID file_id paths; 25MB per-file + 250MB per-church caps; signed-URL TTL 60s-5min; MIME allowlist + EXIF strip + filename sanitization at upload; **client-side envelope encryption at MVP** (raised the bar per ruling #13).
- **Realtime channel** `underground_detail:{church_id}` per Detail page; events emit IDs only.
- **Defense-in-depth gate:** Netlify gate + RPC body (LOAD-BEARING) + RLS (all direct writes blocked).
- **Concurrent claim:** partial unique index + ON CONFLICT DO NOTHING + SELECT FOR UPDATE belt-and-braces.
- **Audit-before-content:** pre-audit intent + post-audit confirm + hourly cleanup cron for orphan intent rows.

## Founder identity anchors (don't get these wrong)

```
auth.users.id:   ded45949-438e-422e-9dbf-9dadb2ee4f84
public.users.id: bb6c6385-236a-402a-9a6c-66ca3468fdf5
Church:          Maranatha Ministries (id e54903a3-b013-4399-8ff3-786c61091636)
Role:            super_admin / ministry_leader
Church code:     RPL-00001 (locked, public)
```

Also `accounts@projectreplant.org` = `19bf5467-...`, both top-tier admins per [[reference-highest-tier-admins]].

## Tools / surfaces in play

- **Supabase MCP** for migrations + RPC introspection. Project `jiyetphxxvyiicrnwlnx`.
- **Jira MCP** via `searchJiraIssuesUsingJql` etc. CloudId `projectreplant.atlassian.net`.
- **Atlassian MCP** for `getJiraIssue` source-of-truth checks.
- **XcodeBuildMCP** for sim screenshots. Sim UDID `7AE8C944-D959-4D82-8D6C-E165B55DB2FB` (iPhone 17 Pro).
- **Netlify admin site** auto-deploys on push to `main` of `/Users/ife/replant-admin/`.
- **Expo dev server** for mobile (`/Users/ife/replant/`). Force-close + reopen on Founder's sim/phone to pick up new commits.

## Smoke-test reproduce path (if needed)

To exercise the request-info → reply flow end-to-end:

1. **Admin side:** sign in at `admin.projectreplant.org/underground` (Founder Ruth or accounts@). AAL2 TOTP needed.
2. Navigate to a pending UG church Detail page (e.g., Shine Bright Church Gathering — `6d8670e8-fd49-441b-8e70-347ad8da5d60` — or We Will Abound Ministries — `e75d77ca-0ea5-4ac6-8ef0-6314592328cb`).
3. Click "Ask a question" → type ≥10 chars → send.
4. **Leader side:** force-close + reopen the app on `ruthjames08+ung@gmail.com` (Shine Bright) or `ruthjames08+ug@gmail.com` (We Will Abound).
5. RequestInfoModal should fire on Home with the question. Sky-tinted banner persists below.
6. Tap "Send a reply" → composer → type → send → green confirmation → return to Home.
7. **Banner reverts** to standard "Verification pending" (assuming `refresh()` fired correctly).
8. **Admin side:** Pending list row shows new "Leader replied" sky pill.

## When in doubt

Re-read the spec. Then ask Founder.

In Jesus' name, Amen.
