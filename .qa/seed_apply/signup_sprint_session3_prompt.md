# Replant signup sprint — Session 3 starter prompt

Paste this entire block into a new Claude Code session opened in `/Users/ife/replant`.

---

You're resuming the Replant signup/login sprint mid-flight. Pray first per `/Users/ife/replant/CLAUDE.md` — the work ahead reshapes the only door new leaders walk through to reach the persecuted-church platform, so the prayer should hold that weight (not "build a form").

## Read these first (in this order)

1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/MEMORY.md` — the auto-loaded index. Spot `signup_sprint_state_2026-06-12.md` and read it.
2. `/Users/ife/.claude/projects/-Users-ife-replant/memory/signup_sprint_state_2026-06-12.md` — full snapshot of what's shipped + what's deferred.
3. `/Users/ife/.claude/plans/oh-last-thing-to-stateful-corbato.md` — the full sprint plan with Founder rulings 1-8.

## What's already shipped (do NOT redo)

Phases 0–2 fully complete. Concretely:

- 6 Jira tickets filed: **KAN-229 / KAN-230 / KAN-231 / KAN-232 / KAN-233 / KAN-234**
- **KAN-207** church-type-edit orphan + region NULL bug (defense-in-depth INSERT trigger + region map function)
- **KAN-229** Name structure foundation — `first_name`/`middle_name`/`last_name`/`last_name_first`/`honorific` columns, 198 leaders backfilled with cultural overrides, `resolve_display_name()` SQL helper, 8 RPCs rewired (`get_comments`, `get_prayer_wall`, `get_testimonies`, `get_landing_testimonies`, `get_open_prayers`, `get_branch_members`, `get_leader_thread_list`, `get_church_profile`), 5 FE consumers stripped of split-and-prefix logic (`CommentThread`, `LeadersList`, `BranchThreadView`, `DMThreadView`, `NetworkFeed.useResolvedLeaderAuthor`), sign-up form middle-name input + character whitelist (Unicode letters + space + hyphen + apostrophe + period), Settings "Show last name first" checkbox + hybrid honorific picker (15 common + Other), Page 1 honorifics hint copy
- **KAN-231** Phone field + Founder-locked reassurance note ("We will only reach out to you directly if your church contact does not answer.")
- **KAN-230** Church contact email uniqueness with `main_campus`+`branch` exception, typed 409 + inline error mapping
- **KAN-184** Country dropdown polish (autoFocus, empty state, native clear button only, friendlier copy)
- **KAN-197** Needs & Offerings textarea moved Page 2 → Page 1, optional, 500-char soft counter, "your ministry" voice
- **Bonus shipped:** "Personal" prefix on Email/Phone labels, country picker keyboard occlusion fix (`KeyboardAvoidingView` + `automaticallyAdjustKeyboardInsets`), Splash + country + role picker `accessibilityRole="button"`, back affordance on DoF + Page 1, DoF copy fix ("lived a sinless life,") + roman body
- **First-name-only convention rule locked:** family name is ALWAYS visible (e.g., "Reverend Dirk Van Wyk" not "Reverend Dirk"). Founder approved this is the new behaviour.

## Pending sprint items (in order)

**Phase 3 — Page 2 + branch flow:**

3.1 **KAN-192** — AccountSetupPage2 wireframe v4 reconciliation. Reworks the church-search Page 2:
- Remove the duplicate "Register a New Church" outline button → single "Don't see your church? Register yours →" card anchored below results
- Results card layout per wireframe v4 (status dot, capacity note, etc.)
- Empty state copy before search
- **Skip mechanic (D-65):** "Skip for now →" blue text link always visible. Tap → main home tab. `users.church_id` stays NULL. **The 7-day registration window (from `users.created_at`) is NOT reset and NOT paused.**
- **Enter Replant CTA (D-69):** when route params contain `newChurchId` (loopback from RegisterChurchPage2 or underground reg), bypass search entirely, show "Enter Replant" confirmation
- **RPL Network ID search folded in (memory #14):** the search input also accepts `RPL-XXXXX` IDs and resolves to the matching church

3.2 **KAN-232** — Branch church sign-up flow (2-step parent lookup). After church-name capture:
- Step A: "Is your main campus registered on Replant?" Yes/No/Not Sure
- Step A.Yes: RPL Network ID field, lookup edge function, locked parent name display
- Step B (when parent confirmed): "What best describes your identifier?" dropdown (Location/Type/Name) + free-text input
- Schema: `churches.parent_church_id` FK + `branch_identifier_type` enum + `branch_identifier_value` text
- Multi-HQ note copy under RPL ID field: "Only one main campus per church network is currently supported. If your network has multiple regional headquarters, please contact accounts@projectreplant.org."
- IMPORTANT: use only fake church names in placeholder text (Founder ruling — legal risk)

3.3 **KAN-233** — Fuzzy church name standardization Layer 1. Live hint during church-name input. ≥3 chars + ~400ms debounce. Known abbreviations dict (RCCG → Redeemed Christian Church of God, etc.) + similarity threshold. Non-blocking hint with dismiss; underground excluded from results.

3.4 **KAN-148 / KAN-155 / KAN-158** Leader slot conflict / overflow / one-leader-one-church sweep. Same surface (RegisterChurchPage2:600 has the 2-leader cap error already pointing to `accounts@`). Build full 3rd-leader-conflict UX + one-leader-one-church constraint at intake.

**Phase 4 — Login + session + admin gate:**

4.1 **KAN-26 / KAN-38 / KAN-41** Login flow + session restoration
4.2 **KAN-219** auth-status-check — surface `church_verified` + State B copy across 4 mobile gate surfaces
4.3 **KAN-84** auth-status-check edge cases (deactivated church + TZ day-boundary)
4.4 **KAN-194 / KAN-202** pg_cron sweeps (Day-7 unregistered + orphan church)
4.5 **KAN-206** Individual leader verification (Leader N joining existing verified church). Approach per Founder ruling: verify admin state first, build gaps. Leader-side waiting UI via Claude Design (CD) wireframe.

**Phase 5 — BLOCKED on CD wireframe:**
5 **KAN-198** Email OTP password reset. Kicks off when CD wireframe lands.

**Phase 6 — Admin sprint (not this sprint):**
6 **KAN-234** Admin "Remove leader from church" action.

## Deferred to a separate session (do NOT touch)

- **Underground onboarding chain** (KAN-181 / KAN-182 / KAN-183 / KAN-186 / KAN-187 / KAN-188 / KAN-189 / KAN-191). Memory item #15.

## Open follow-ups to track

- Drop `users.full_name` column once nothing reads from it (still written for safety; not blocking)
- KAN-207 AC 6 (CI regression test) — file as a testing-strategy ticket if Founder asks
- KAN-230 first-rendered Jira description ate one bullet (markdown blockquote in AC 2); worth a comment + edit pass
- KAN-229: sign-up flow doesn't expose `last_name_first` + `honorific` at account creation time (Settings does post-create). Likely fine for MVP; revisit if Founder asks
- KAN-184: role picker uses the same overlay style as country but is non-searchable (no keyboard). If a search input gets added to it later, apply the same `KeyboardAvoidingView` wrap

## Founder feedback patterns to honor

- "Personal" copy convention worked → consider applying to any new ambiguous labels
- Keyboard occlusion testing is a real concern → check every modal that hosts a search input
- DoF copy "not final lock but pretty close" — Founder may push more tweaks; keep diffs small
- Honorifics list is curated; "Other…" must always be available as the escape hatch
- Family name in first_name_only is the new norm; do not "fix" it back

## Sprint plan reference

`/Users/ife/.claude/plans/oh-last-thing-to-stateful-corbato.md` — Founder rulings 1-8 locked here. Re-read before any new design decision; do not invent a new ruling without surfacing.

## Sim state

- Device: iPhone 17 Pro (`7AE8C944-D959-4D82-8D6C-E165B55DB2FB`)
- XcodeBuildMCP session defaults already set
- App parked at the country picker mid-test in the prior session — restart it (`xcrun simctl terminate org.projectreplant.replant && xcrun simctl launch org.projectreplant.replant`) before re-driving
- Founder is logged OUT — Splash → Create Account → DoF is the entry. If you need to verify Settings/Comments, ask Founder to log in OR drive there yourself

## Starting move

Default: roll straight into **Phase 3.1 — KAN-192**. Begin by pulling the full ticket via `getJiraIssue` for the AC list, then read `src/screens/onboarding/AccountSetupPage2Screen.tsx` to understand the current state before touching anything.

Confirm with Founder if anything in this handoff feels stale before you start substantial work. The plan + memory files are the source of truth; this prompt is just the on-ramp.

In Jesus' name, Amen.
