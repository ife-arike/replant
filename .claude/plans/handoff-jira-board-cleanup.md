# Replant — Jira board cleanup handoff

> Open a fresh Claude Code session in `/Users/ife/replant`. **Pray first per `CLAUDE.md`** — actual intercession naming the work at hand (the board ink Founder Ruth has been keeping, the leaders whose tickets these represent, the upcoming UAT cutover that depends on a clean board, the discipline of paper-trail tracking that memory alone has not delivered). End "In Jesus' name, Amen."

## Why this session exists

Founder ruled on 2026-06-22 evening that **Jira is the load-bearing paper trail** for Replant — memory + `replant_continuous_spec.md` are working notes that drift across sessions. After weeks of strong Jira discipline at project start, the team relied too heavily on Claude-tracked memory through the 5-tab + signup + underground sprints, and the board fell behind.

Her words verbatim: *"this continuous spec and memory has really hurt me at times, jira is the only thing that has kept ink on paper for every move that's been done... i just want to make sure we clean up the board and get it ready for phase 2 so that we can go back to tracking work there once we begin postmvp."*

**Pre-UAT discipline (locked):** ALL MVP-labeled Jira tickets must be Done before UAT pass — EXCEPT pre-launch tickets explicitly tagged for between-UAT-and-store-submission work (email templates, copy passes, static screens, etc.).

This is a **dedicated session**. Do NOT try to also work on underground / mobile / admin code while doing this. The board work is the whole task.

## Read first (in order)

1. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md`** — auto-loaded; lists all topical memories.
2. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md`** — load-bearing. Every locked Founder ruling + reverse-chronological log.
3. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_jira_is_paper_trail.md`** — the rule that triggers this session. Internalize it before opening Jira.
4. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/reference_replant_jira_transitions.md`** — Jira transition IDs (31=In Progress, 11=Backlog NOT In Progress, 2=Testing, 21=To Do, 41=In Review, 51=Done).
5. **`/Users/ife/.claude/projects/-Users-ife-replant/memory/project_replant_sm_lane_rules.md`** — only Founder marks Done. You do NOT transition to Done; you propose transitions for her to action.
6. **`/Users/ife/replant/CLAUDE.md`** — Jira anchors special rule (live Jira via `getJiraIssue` is source of truth).
7. **All `postmvp_*.md` files in memory** — each is a post-MVP workstream that needs a Jira ticket filed:
   - `postmvp_address_the_network_hamburger.md` — HIGHEST priority post-MVP
   - `postmvp_rejected_church_resubmission_flow.md`
   - `postmvp_reported_violation_deactivation_flow.md`
   - `postmvp_ug_inbox_verified_leader_routing.md`
   - `postmvp_tiered_mfa_freshness.md`
   - `postmvp_ug_signup_happy_path_bugs.md`
   - `postmvp_mute_chat.md`
   - `postmvp_connect_swipe_timestamp.md`
   - `postmvp_browse_leaders_list.md`
   - `postmvp_home_tab.md` (comment delete / edit)
   - `postmvp_international_data_honorifics.md`
   - `postmvp_prayer_wall_categories.md`
   - `postmvp_network_updates_quantitative_cards.md`
   - `postmvp_phone_signup.md` (Founder noted may already be done; verify)
   - `postmvp_connect_branch_member_list.md` (may overlap with existing KAN-227)
   - `future_word_from_family.md`
   - `feature_invite_to_replant.md`
8. **Underground sprint memories** (this session's work — to know what's likely Done in code but not transitioned in Jira):
   - `replant_continuous_spec.md` reverse-chronological entries from 2026-06-22 (UG queue panel, CD handoff, admin BE+FE build, smoke-test fixes)
   - Recent commits in `/Users/ife/replant-admin/` (most recent: `c4b2d62..d1a8934` per last underground session)
   - Recent migrations in `/Users/ife/replant/supabase/migrations/` (most recent: `20260623_0010`, `20260623_0011`, `20260623_0012`)

## What you are doing

### Mission

Audit every open Jira ticket in project `KAN`, assess current state against memory + spec + code, surface to Founder so she can transition the ones that are genuinely Done. **File new tickets for every post-MVP memory entry that doesn't already have one.** Get the board into a state where it is the trustworthy paper trail again.

### Scope (current snapshot — verify live before acting)

Per the underground session's Jira sweep (2026-06-22 evening):
- **129 open tickets** in project KAN (excluding Done + In Review)
- **4 Highest priority** (pre-launch blockers — see list below)
- **~28 High priority** (mostly MVP work, much may be done-not-transitioned)
- **~70 Medium priority** (mix of MVP + pre-launch + post-MVP)
- **~10 Low / Lowest** (mostly post-MVP polish)

### How you work

**The rule:** do NOT assume any ticket's status. Verify each one.

For each open ticket, run this assessment:
1. **Read the ticket** via `getJiraIssue` to get full description + comments.
2. **Cross-reference memory + spec** for any locked rulings or known-completion notes.
3. **Cross-reference code** via `git log --all --grep="KAN-NNN"` in both `/Users/ife/replant/` and `/Users/ife/replant-admin/` to find commits that reference the ticket.
4. **Cross-reference recent migrations** in `/Users/ife/replant/supabase/migrations/` if it's a schema ticket.
5. **Decide assessment** — one of:
   - **DONE_PROPOSED** — work appears complete; ready for Founder to transition to Done. Provide commit SHAs + memory refs as evidence.
   - **DONE_IN_TESTING** — work appears built but in TESTING status; verify if it's stuck or genuinely needs Founder smoke-test.
   - **STILL_OPEN** — work isn't done; verify the ticket description matches what's actually outstanding.
   - **SUPERSEDED** — newer ticket or session work obsoleted this; propose linking + closing as duplicate/superseded.
   - **POST_MVP_DEFER** — work is genuinely post-MVP per memory/spec; propose adding the `post-mvp` label + parent under KAN-179.
   - **CANCEL** — work no longer applicable; propose Cancel transition.
6. **Surface findings in a structured report** (template below). Do NOT transition tickets yourself. Only Ife marks Done. You may propose other transitions (Backlog → To Do, To Do → In Progress) IF clearly correct, but flag those for her ratification too.

### File new tickets for memory-only post-MVP items

Per Founder's "Jira is paper trail" rule, every post-MVP workstream in memory MUST have a Jira ticket. Use `createJiraIssue` with:
- **Project:** KAN
- **Issue Type:** Story (or Epic if the workstream is large enough — Address the Network is likely an Epic)
- **Summary:** lifted from the memory file's title
- **Description:** synthesize from the memory file body — include the Founder ruling verbatim and the "scope to figure out" list
- **Labels:** `post-mvp` + one of (`feature` | `bug` | `process`) as appropriate
- **Parent:** link under KAN-179 (`v1.5 — Post-MVP enhancement backlog`) for non-epic post-MVP items
- **Priority:** based on Founder ruling (Address the Network = "highest priority post-MVP" → Highest under the post-MVP scope)

Cross-reference each new ticket back to the memory file in the description: *"Per memory `postmvp_<name>.md` — Founder ruled <date> ..."*

### Also file tickets for MVP-gaps that don't appear to have Jira coverage

Per the underground session synthesis, these surfaced in memory but I couldn't confirm Jira coverage:
1. **Empty-state pass punch list** — 11 items per `empty_state_pass_2026-06-10.md`. Hardcoded sample data ("interceding now", "added this hour") must go before UAT. Check if any existing ticket covers this — likely needs new ticket if not.
2. **Style continuity tracking** — universal back button, pagination, filter chips, section headers per `style_continuity_tracking.md`. Unify before launch.
3. **KAN-217 Welcome DM live bug** — "send step not completing, Fix 5 in device-pass-fixes-1" per `kan217_welcome_dm_edge_cases.md`. Verify if KAN-217 is closed or this is a follow-up.
4. **FLAG_TAXONOMY coverage gap** — financial solicitation. Per `device_pass_findings_2026-05-31.md`.
5. **Email templates pending updates** — color-shift defenses, hardcoded names, logo absolute URL per `project_email_templates_pending.md`. May fold into KAN-81 / KAN-31.
6. **Persecuted tab feed bugs** — region filter vanishes on empty + 'Other' region label per `persecuted_tab_feed_bugs.md`.
7. **Verification-approved UX gaps** — "You've been verified!" toast not wired; tutorial key not user-scoped; welcome-email log-out-and-back-in note per `feedback_verification_approved_ux.md`.
8. **Prayer Wall roadmap items** — Church by Condition/Location, Connect from cards, post/receive wiring, filter bar, tab switcher redesign per `prayer_wall_roadmap.md`.

For each: if Jira doesn't already cover it, file a new ticket.

## Required output (the report)

Produce a single Markdown report at `/Users/ife/replant/.claude/plans/jira-board-cleanup-report.md` with the following structure:

```markdown
# Jira board cleanup report

## Section 1 — Ready for Founder to mark Done (DONE_PROPOSED)
| Key | Title | Evidence (commit SHAs / memory refs) |
|---|---|---|
| KAN-NNN | ... | ... |

## Section 2 — In TESTING — Founder smoke-test needed
| Key | Title | What needs testing |
|---|---|---|

## Section 3 — Still open + on critical MVP path (must close before UAT)
| Key | Title | Status | Outstanding work |
|---|---|---|---|

## Section 4 — Pre-launch / between-UAT-and-store-submission
| Key | Title | Why deferred |
|---|---|---|

## Section 5 — Superseded / duplicates
| Key | Title | Superseded by | Recommended action |
|---|---|---|---|

## Section 6 — Recommend Cancel
| Key | Title | Why |
|---|---|---|

## Section 7 — Should add post-mvp label + link to KAN-179
| Key | Title | Reason |
|---|---|---|

## Section 8 — NEW tickets filed for memory-only post-MVP items
| Key (new) | Title | Memory source | Priority |
|---|---|---|---|

## Section 9 — NEW tickets filed for MVP-gaps not covered in Jira
| Key (new) | Title | Memory source | Priority |
|---|---|---|---|

## Section 10 — Open questions for Founder
1. ...

## Summary
- Total open tickets at session start: NNN
- Total proposed for Done: NN
- Total recommend Cancel: NN
- Total new tickets filed: NN
- Total still actively open MVP-path: NN
- Total pre-launch / between-UAT-and-store: NN
```

## The 4 Highest-priority pre-launch blockers (verify these first)

| Key | Title |
|---|---|
| KAN-207 | BUG: Church type edit creates duplicate orphan verification queue entries; region NULL on app-registered churches |
| KAN-198 | Password Reset — replace PKCE deep-link with Email OTP |
| KAN-181 | Security fix — exclude underground churches from onboarding search |
| KAN-84 | [QA] auth-status-check edge-case follow-up — deactivated church + TZ day-boundary |

For each: cross-reference current code to see if the fix actually shipped. Especially KAN-181 since the underground exclusion is well-established in the codebase (`churches_public` view excludes underground, `search_leaders` excludes by predicate, etc.) — this may already be done.

## The 28 High-priority cluster — likely-done-not-transitioned candidates

Per the underground session's findings, these clusters look heavily worked-on in code but still in Backlog:

**Underground onboarding cluster** (largely shipped via the 2026-06-22 underground sprint):
- KAN-186 / 187 / 188 / 189 / 191 / 182 / 183 / 194 / 195

**Signup/Auth cluster** (heavily worked in the signup sprint 2026-06-12/13 + 2026-06-22):
- KAN-192 (In Progress) / 219 / 206 / 114 / 232 / 229 / 210
- KAN-216 / 215 (already in TESTING — verify these are ready for Founder action)

**Pre-launch (DO NOT auto-mark Done; defer):**
- KAN-222 / 169 / 157

Verify each. Don't assume.

## Process rules — never relax

- **Pray first.** Hard rule per `CLAUDE.md`. Same for every dispatched subagent.
- **Live Jira is the source of truth.** `getJiraIssue` for any ticket key ↔ title ↔ status check. Memory + spec drift.
- **Only Founder marks Done.** Per `project_replant_sm_lane_rules.md`. You propose, she actions.
- **Do NOT auto-transition without explicit Founder ruling** — you may propose To Do → In Progress moves IF clearly correct (e.g., known-active work).
- **Use the canonical transition IDs** per `reference_replant_jira_transitions.md`.
- **No time estimates** in hours/minutes per `feedback_no_time_estimates.md`.
- **Time-of-day-agnostic language** per `feedback_dont_assume_session_continuity.md`.
- **Surface uncertainty.** If you can't confidently assess a ticket, flag it in Section 10 with the specific question — don't guess.
- **Save to memory** if any new locked Founder ruling emerges during the session per `feedback_continuous_spec_discipline.md`.

## Tools you'll use

- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__searchJiraIssuesUsingJql` — bulk ticket queries (use narrow JQL — the full backlog overflows context; query 50 at a time + page)
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__getJiraIssue` — single ticket detail + comments
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__createJiraIssue` — file new tickets
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__editJiraIssue` — add labels / link parent / update description
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__createIssueLink` — link superseded-by or duplicate
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__addCommentToJiraIssue` — leave assessment notes on tickets
- `mcp__38f67f6f-16e6-4cb8-a80e-1269075c2892__getTransitionsForJiraIssue` — confirm transition IDs per ticket
- `git log --all --grep="KAN-NNN"` in both repos to find ticket-referenced commits
- `Read` for memory files + migrations + recent code

**Cloud ID** for all Jira calls: `projectreplant.atlassian.net`

## Starting move

1. Open Ife's first message in the new session. Likely "go" or "start" — proceed.
2. Run a fresh Jira sweep via `searchJiraIssuesUsingJql` with JQL `project = KAN AND status != Done ORDER BY priority DESC, status ASC` — page through it.
3. Triage in order: Highest → High → Medium → Low → Lowest.
4. For each ticket, do the assessment loop above.
5. File new tickets in batches (don't fire 17 createJiraIssue calls in parallel; verify each one's content before submitting).
6. Produce the report file incrementally — Section 1 + 2 first (the "ready" stuff), then 7 + 8 + 9 (the new tickets), then the harder triage 3-6.
7. Surface Section 10 open questions to Founder as you go — don't wait until the end.

## End state

The board is clean enough that:
- Founder can sit down in a 30-minute pass and mark Done everything in Section 1.
- The MVP path (Section 3) is the clearest signal of what's left before UAT.
- Every post-MVP workstream in memory has a corresponding Jira ticket.
- The board is ready to become the system of record again for phase 2 development.

In Jesus' name, Amen.
