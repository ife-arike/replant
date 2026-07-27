# Replant — Handoff: signup-flow continuation

> Open a fresh Claude Code session in `/Users/ife/replant`. Pray first per `CLAUDE.md` — actual intercession naming the work at hand (signup-flow remaining build, branch flow, underground flow, the leaders coming into the network through the path we're building), ending "In Jesus' name, Amen."

**Status framing — do NOT undersell scope.** The architectural pieces are in place. The signup path itself still has a meaningful build ahead before UAT-ready. After signup is sorted, the app is mostly UAT-ready (Founder's framing). That's the prize. Don't rush.

---

## Read first (in order)

1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — auto-loaded; spot the entries added 2026-06-18.
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_dont_assume_session_continuity.md` — don't carry "tonight/today" framing across pauses.
3. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_dont_skip_test_scenarios.md` — Founder is a tester; don't dismiss scenarios.
4. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_sme_panel_required.md` — every cross-lane change gets a panel.
5. `/Users/ife/.claude/projects/-Users-ife-replant/memory/feedback_no_time_estimates.md` — never give hours/minutes estimates.
6. `/Users/ife/replant/.claude/plans/orphan-prevention-architecture.md` — the full architecture doc behind the orphan-prevention sprint that just shipped.

---

## What shipped recently (do NOT redo)

### Edge functions (deployed, locked unless SME-cleared)

- **`create-account` v6** — atomic write via `create_account_atomic` PL/pgSQL RPC. Accepts `firstName / middleName / lastName / phone` + optional `newChurch` payload OR `churchId`. Branched welcome email (skip / pending_church / verified_church) with dynamic days. Force-flag plumbing on the leader side. Comp-delete on RPC failure (only when this function created the auth user). `verify_jwt=false` preserved.
- **`register-church` v7** — validation-only (no DB write). Pre-flight similarity check via `find_similar_churches` RPC (name+city OR contact_email OR contact_phone, branches excluded). Accepts `force: true` to skip the similarity check. `verify_jwt=false` preserved.
- **`auth-status-check` v7** — comprehensive resolveStatus rewrite. Skip-flow leaders use `users.verification_deadline`. Attached leaders branch on `church.verification_status` BEFORE reading `church.verification_deadline` (stale deadlines on verified churches were auto-deactivating new leaders). `verify_jwt=true` preserved. Founder ratified the override of KAN-36 Option Y on 2026-06-18.

### DB

- **`create_account_atomic(uuid, jsonb, jsonb, uuid)`** — single-transaction church + leader INSERT.
- **`find_similar_churches(text, text, text, text, text, int)`** — v7 signature: (name, country, city, contact_email, contact_phone, limit). Returns `match_reason` ("contact_email" / "contact_phone" / "name_city"). Branches excluded.

### FE (in main, locked unless SME-cleared)

- ASP1 + ASP2 + RegCP1 phantom-inset fix (Keyboard.dismiss before nav + useFocusEffect scroll reset).
- ASP2 + RegCP1 + RegCP2 refactored to v4/v6/v7 contracts. Bypass card uses `local-draft` sentinel — no DB write until Enter Replant.
- RegCP2 similar-church **modal** (replaces inline red error). Two CTAs: "Go back to search" (CommonActions.reset to ASP2) and "Continue anyway" (re-call register-church with `force:true`).
- Welcome email kind/days computed in handler, then passed to `sendWelcomeEmail`. Three copy variants.
- `useChurchVerifiedStatus` reads `verification_status === 'verified'` (was reading `rag_status`).
- Prayer Wall locked card badge stacked under the body text.
- `formatLeaderLine` + `getLeaderLine` trust the BE display string (`resolve_display_name` already prepends role/honorific; FE was double-prefixing across every Prayer Wall surface).

### Memory + feedback (loaded into MEMORY.md)

- `feedback_dont_assume_session_continuity` — don't carry "tonight/today" framing.
- `feedback_dont_skip_test_scenarios` — Founder is a tester; don't bypass.
- `feedback_sme_panel_required` — earlier session; still active.
- `feedback_no_time_estimates` — earlier session; still active.
- `reference_replant_role_abbreviations` — canonical SEC/DBA/BA/CC/CD shortcodes.

---

## What's STILL ahead on signup-flow (DO NOT undersell)

This is the bulk of the remaining work. Each one is a real workstream. Founder's framing: "we still have a long ways to go on signup path." Do not draft the new session like signup is almost done.

### 1 · Required-fields audit
Walk the entire signup flow (ASP1, ASP2, RegCP1, RegCP2) and identify which fields are GATING for Next vs OPTIONAL. Current state has accumulated inconsistencies. Confirm each with Founder before locking. Touches BE validation (parsePayload), FE form state, and copy ("Optional —" labels).

### 2 · Branch church flow — entire flow needs building
Branch type currently shares the standard flow. Founder ruling 2026-06-18: branches must NOT trigger duplicate-similarity checks (shipped — defense-in-depth). The PROPER branch UX is not yet built: parent-church identification (RPL ID lookup?), branch member context, branch-specific copy, admin verification implications. Cross-lane. Needs SEC + DBA + BA + BE + CD panel.

### 3 · Underground signup flow — separation
Underground currently shows in the RegCP1 church-type dropdown (BUG — task in punch list). The real fix is one of two paths:
- (a) Filter underground OUT of the dropdown entirely. Add a separate entry point ("I am registering an underground church") with its own dedicated flow (no city/lat/lng, RPL ID dropdown, brave/safe toggle per memory `project_underground_signup_spec`).
- (b) Keep underground IN the dropdown but immediately fork to the underground flow on selection.

Founder leans (a) per the verbal "or rather if they select underground church it should take them to a separate flow, or should be able to tap im registering an underground church somewhere on reg page 1." Confirm posture before building. Cross-lane. SEC owns the underground threat-model invariants per `project_replant_invariants` — they MUST sign off.

### 4 · Add "para ministry" to church-type dropdown
New church_type enum value. Cross-lane:
- DBA — enum migration (add 'para_ministry').
- BE — `CHURCH_TYPES` constant in `_shared/church-validation.ts` + both function mirrors.
- FE — `CHURCH_TYPES` dropdown in RegCP1 + display labels.
- ADMIN — admin verification surfaces need to handle the new type.
- CONTENT — copy / definitions (what's a "para ministry" per Replant's framing — likely missions agencies, sending orgs, training schools, etc.).
- BA — implications for the duplicate-similar check (does para-ministry follow same rules?). Founder needs to clarify.

### 5 · Clear Jira backlog for signup/login
Direct Founder action. There are existing Jira tickets sitting in backlog that relate to signup/login. Reading-pass + decision-making per ticket: ship, defer, kill, merge into one of the workstreams above. Use Atlassian MCP (`mcp__plugin_engineering_atlassian__*`) to list / triage. Cite ticket IDs in any work that closes them.

---

## SME-panel queue (do NOT ship without panel)

| Task | Lane(s) | Notes |
|------|---------|-------|
| #19 — state/province/region field | SEC + DBA + BA + BE + CD + CONTENT + ADMIN | Conditional dropdown per country, curated lists, admin dashboard surface, branch-exemption confirmed. Founder ratified the rule; the IMPLEMENTATION still needs panel. |
| #21 — verification_deadline lifecycle | DBA + BA + ADMIN + SEC | Should we add `verified_at`, treat deadline as archival post-verification, or current "deadline-stays-forensic" model is fine if consumers honor it? auth-status-check v7 covers consumers; question is whether to keep that model or migrate. |
| #15 — OMIT vs COALESCE / NULL vs NOT NULL placeholder columns | DBA + BA + SEC | Two related questions on `congregation_size_range` + `show_contact_on_profile`. |
| #14 — `pg_trgm` install + fuzzy upgrade | DBA | Current matching uses ILIKE substrings; pg_trgm enables real similarity scoring. Adds an extension. |
| Branch flow architecture (#2 above) | SEC + DBA + BA + BE + CD | Whole subworkstream. |
| Underground flow split (#3 above) | SEC + DBA + BA + BE + CD | SEC must own the threat-model invariants. |
| Para ministry addition (#4 above) | DBA + BE + BA + ADMIN + CONTENT | Enum migration plus downstream. |

For all of these: draft a 1-page proposal first (current state → target state → contract changes → edge cases → deploy order → rollback). Dispatch `general-purpose` agents in parallel with role-specific briefings (each prays first per CLAUDE.md). Synthesize, then ship. See `feedback_sme_panel_required` for the discipline.

---

## Polish queue (smaller, CC-direct unless flagged)

These don't need panel — quick spot-fixes once we're not in a sprint context.

- **Underground in church-type dropdown** — punch-list item. Remove it from the dropdown (depends on the #3 split above).
- **RAG Red stickiness when changing church type from Underground** — RegCP1 doesn't clear `ragStatus` when type changes away from underground (which auto-locks Red). Clear the state on type change.
- **#16 — ASP2 first-card-larger + title truncation** — intermittent layout bug + `numberOfLines={1}` on church name.
- **#20 — RegCP2 similar-church modal copy** — Founder said copy needs work. DEFER until the state-field work (#19) so the copy can address state mismatch in one pass. Don't polish prematurely.
- **#22 — Test scenario #8 (resume path)** — manufacture orphaned auth.users row + retry signup. Confirm comp-delete behavior. Founder's directive: don't skip. Run it properly.
- **#10 — Log orphan-prevention work to Jira via MCP** — post-ship documentation. Use `createJiraIssue` to file the architectural sprint.

---

## Testing posture (per Founder ruling 2026-06-18)

- Don't dismiss test scenarios as "skippable" or "unreachable."
- Help Founder manufacture odd-input states; let her decide whether to run.
- Edge cases are exactly what she wants verified.
- See `feedback_dont_skip_test_scenarios`.

---

## Founder rulings to honor (locked, do NOT relitigate)

- `connect@projectreplant.org` is the welcome-email From (until further notice).
- Only Founder marks Done in Jira.
- Modal copy + Founder-locked strings are quoted verbatim. No paraphrasing.
- Don't strip protection-layer modals without asking.
- Never assume test account / device.
- "Build for the full end goal" — global persecuted Church.
- Don't pull Netlify env vars via MCP.
- Branches do NOT trigger duplicate-similar checks (v7 rule).
- Skip-flow leaders read user.verification_deadline (Option Y override ratified 2026-06-18).
- verified-church + pending-leader = no countdown (admin owns the transition).
- All agent dispatches include a real intercessory prayer naming the specific work.

---

## Starting move

1. Pray properly per CLAUDE.md — name the signup-flow remaining build, the branch + underground + para-ministry workstreams, the leaders we're building this for.
2. Read the memory files above in order.
3. **Ask Founder which signup workstream to take first** — required-fields audit, branch flow, underground split, para ministry, or Jira backlog triage. Do NOT pick for her; she sequences.
4. Once she picks, regurgitate understanding + propose scope before building (`feedback_confirm_before_building`).
5. For ANYTHING cross-lane, draft the 1-pager and dispatch SME panel BEFORE writing implementation code.
6. Time-of-day-agnostic language throughout. No "tonight."

In Jesus' name, Amen.
