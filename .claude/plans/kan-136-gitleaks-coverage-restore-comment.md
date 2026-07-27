# KAN-136 — paste-ready Jira comment (gitleaks coverage restore, 2026-07-02)

**Before posting:** per the Jira-anchors rule (KAN-119 c.11455), run `getJiraIssue` on KAN-136 first to confirm the ticket's live key/title/status, then post the body below as a comment. Do not transition the ticket — only Founder marks Done.

---

**2026-07-02 — gitleaks pre-commit coverage on the mobile repo: RESTORED + live-fire verified.** Scoped to the one-line coverage restore flagged by the board audit; everything else on this ticket stays open.

**Found:**
1. The mobile repo's local `.git/config` set `core.hooksPath` to its own `.git/hooks` (init-time `.sample` files only) — silently bypassing the global gitleaks hook at `~/.git-hooks/pre-commit`. The admin repo had no such override.
2. Setter: no hook manager exists (no husky, no lefthook, no `prepare` script, no tracked reference to hooksPath). The likely mechanism is Claude Code worktree isolation — the active Claude worktree carries the same override in its worktree-scoped config (`extensions.worktreeConfig=true`). Timeline corroborates: `.gitleaksignore`'s documented false positive (2026-05-14) means the hook still fired for this repo then; the override landed after.

**Done:**
1. Unset the shared-local `core.hooksPath` — the main tree now resolves the global hook (the posture README.md already documents at lines 120–126; the override contradicted the repo's own README).
2. Chained `.git/hooks/pre-commit` → `exec ~/.git-hooks/pre-commit`, so worktree-scoped overrides (the current Claude worktree, plus any future ones that would silently re-open the gap) also hit gitleaks instead of an empty directory.

**Verified (gitleaks 8.30.1, live-fire on both commit paths):**
1. Staged canary with a fake AWS key + GitHub PAT → commit BLOCKED (exit 1; findings `aws-access-token`, `github-pat`) in BOTH the main tree and a worktree. Canary discarded; HEAD unchanged; both trees clean.
2. Benign staged content commits normally — no false-positive storm.
3. Caveat for the CI workstream: the 8.30.1 default config PASSES obviously-fake sequential values (a `ghp_ABCDEF…`-style canary sailed through on the first attempt); real-shaped fakes detect fine. Smoke the future Actions workflow with real-shaped test values.

**Still open on this ticket (untouched, deliberately):** gitleaks GitHub Actions workflows in both repos (this fix is dev-machine-only — a PUBLIC repo still needs server-side scanning), SECURITY.md hygiene section, PAT decision, .gitignore audit doc.

Evidence: `docs/audits/2026-07-02-board-audit/verdicts/auditlog-data-content.md` (KAN-136 section) · `docs/audits/2026-07-02-mvp-board-audit-gap-analysis.md` §2. Note: those docs' "ZERO coverage" statements are stale as of this fix.
