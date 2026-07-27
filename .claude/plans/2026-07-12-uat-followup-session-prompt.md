# Paste-in prompt — UAT findings walkthrough (continuation of the 2026-07-12 logged-in sim pass)

Open with a short prayer to the Lord Jesus Christ soaking this work in His blood — the walkthrough of the UAT findings from the logged-in sim pass, so that every defect that could confuse, tire, or expose a leader is judged rightly and dispatched cleanly. End "In Jesus' name, Amen."

## Where things stand (state as of session close, 2026-07-12)

The full logged-in sim UAT pass is **complete** and the Founder has the findings. This session's job: walk the findings with her, take her rulings, and execute exactly what she instructs (file bugs, advance/hold tickets, fix items, or hand to other lanes). **She has NOT yet given findings instructions — that conversation is the first agenda item. Do not act on findings before her word.**

### Read these first, in order
1. `/Users/ife/.claude/projects/-Users-ife-replant/memory/replant_continuous_spec.md` (standing discipline — read FIRST) + `MEMORY.md` index. New memories from the pass session: `reference_test_account_passwords_dummy.md` (all +t# share `Test1234!` — never rotate, never ask) and `feedback_without_walls_not_org.md` (without_walls = online ministry; org personas = para_ministry).
2. **`~/replant/.claude/plans/2026-07-12-sim-uat-findings-report.md` — the source of truth.** Findings F1–F11 (ranked), per-screen UI notes (what works / what doesn't), behaviors-verified list, back-behavior matrix, readability verdicts, resolved system-map ambiguities, ticket dispositions.
3. `~/replant/.claude/plans/2026-07-12-sim-uat-logged-in-visual-pass.md` (the executed plan) + appendices A (Lucid expectations) and B (requirements v2_7 expectations) beside it.
4. `~/replant/.qa/2026-07-12-uat-pass-register.sql` — every DB state change + revert/disposition, including the findings observation log.

### Findings needing Founder rulings (one-line recall; full detail in the report)
- **F1 (P1)** Dynamic Type ignored app-wide — the top readability finding.
- **F2 (P1)** anon leader's real name leaks in the connection-request "REQUEST SENT" modal (only surface that broke masking; SEC-adjacent).
- **F11 (P1)** `resolve_display_name` shows surname for first_name_only users + comments drop the role prefix — **blocks KAN-229 (HELD)**; Settings promises "Pastor Ifeoluwa", comments show "Ifeoluwa Jamesarike".
- **F3 (P2)** DM letter-composer froze the RN bridge once — **dev/Metro teardown suspected; do NOT file until reproduced on a release build.**
- **F4 (P2)** rejected church → generic "Account deactivated" lockout (no rejection-specific copy) — intended?
- **F5 (P2)** org CompletionFlow Step 1 says "CHURCH NAME"; **F6 (P2)** welcome DM not seeded for fresh signup (+t6); **F7–F10 (P3)** preview truncation, anon-label casing, heartcry thread_id NULL, DM-view empty a11y tree.
- Also queued for her: the Connect tab badge 10+ vs 1/1 rows question (KAN-216, HELD) and the anon **search-by-real-name existence leak** (searching "Ruth" surfaces the masked anon row — P1 SEC-flag in the report narrative; fold into the F2/SEC discussion).

### Jira state (all moves already made under a session-scoped Founder grant — THAT GRANT IS EXPIRED; only Founder marks Done from here)
- **Moved to Done 2026-07-12, each with a QA-evidence comment:** KAN-38, KAN-41, KAN-258, KAN-184, KAN-181, KAN-231, KAN-236, KAN-35, KAN-195.
- **HELD in Testing with reasons (in the report's dispositions table):** KAN-229 (F11), KAN-75 (F2 + toggle write untested), KAN-216 (badge math), KAN-166 (covenant modal never displayed — this sim's `covenant_ack` SecureStore flag is pre-acknowledged; testing it needs an app-data reset/reinstall), KAN-192 (three AC deltas), KAN-206 (join-existing-church path not run), KAN-232 + KAN-207 (not exercised; KAN-207 deliberately skipped — orphan-bug risk on prod).
- Per CLAUDE.md: spot-check any ticket against live Jira (`getJiraIssue`) before citing or transitioning.

### Environment + harness cheat sheet (if the sim pass resumes)
1. Sim: iPhone 17 Pro `7AE8C944-D959-4D82-8D6C-E165B55DB2FB`, app `org.projectreplant.replant` installed; GPS set to Atlanta (33.749,-84.388); content-size reset to medium; appearance dark. **Metro is STOPPED** — restart with `npx expo start` (background) from `~/replant` before launching the app; dev-client connects to localhost:8081.
2. Drive via XcodeBuildMCP (`snapshot_ui`/`tap`/`type_text`) — session defaults already carry sim + bundleId. Quirks learned: a11y tree caps ~110 nodes with everything duplicated ×2 (action rows drop out — re-snapshot or scroll to re-window); the DM/letter view sometimes exposes an EMPTY tree (F10); sticky bottom CTAs never enter the tree — tap by coordinates; switches only respond to element-ref taps (not row/coordinate taps); AXe typing drops characters — verify every landed value, retype with `replaceExisting`; **typing can trigger the Expo dev menu and reload the app (lost a full signup once) — type in short bursts.**
3. Coordinate math: device pt = screenshot px × 1.0924. AXe binary for coordinate taps: `/Users/ife/.npm/_npx/99336612077b7094/node_modules/xcodebuildmcp/bundled/axe tap -x <pt> -y <pt> --udid <UDID>`.
4. Accounts: t5 = senior pastor (restored to exact verified snapshot, church RPL-02102); t3 = anonymous evangelist; t4 = elder (without_walls); **t6 = Deborah Okafor, Minister, para-ministry "Lighthouse Relief And Development Initiative" (created by the pass, verified via SQL bypass, LEFT IN PLACE, RPL-02108)**; t7 untouched (pending leader on t5's church). All passwords `Test1234!`.
5. The 4 seeded announcements are **deactivated** (`is_active=false`; ids in the register) — one UPDATE re-activates them if the Founder wants them for her own device pass.
6. t5 has one live artifacts set from the pass: an open urgent prayer request (1 intercessor: t3), a comment on D1, and a responded heartcry (`a71a8c42…`, dispositioned). t4↔t3 have an accepted conversation with 2 messages.

### Scope boundaries (Founder-set)
1. **Visual-only deep sweep = a separate future session.** Not this one.
2. Second device type = later pass. Underground surfaces, admin dashboard, push = out of scope unless she says otherwise.
3. A parallel chat is running the **email/in-app/push communications audit** (prompt: `~/replant/.claude/plans/2026-07-12-comms-audit-session-prompt.md`). Findings F6 (welcome DM) and F9 (heartcry thread) are shared ground — coordinate through the Founder, don't double-fix.
4. `~/replant` is LAX for pushes but nothing from the pass needs committing except possibly the `.claude/plans/` + `.qa/` artifacts — ask before any push; never push replant-admin without greenlight.

First move after prayer and reading: give the Founder a one-paragraph recap of where the walkthrough stands and ask which finding she wants to start with — then follow her lead, one ruling at a time, updating the register/report/memory as rulings land (acknowledge ≠ saved: decisions get a memory file the same turn).
