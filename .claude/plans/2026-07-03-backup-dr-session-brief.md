# Backup & Disaster-Recovery Session — Brief

**Paste this as the opening message of a dedicated new Claude Code session in `~/replant`.** Founder-scoped 2026-07-03, to run in parallel with the audit-findings fix sessions. Open with prayer naming this specific work — the safeguarding of everything the leaders have entrusted to Replant, so that no single machine, account, or region failure can take it away — in Jesus' name, Amen. Then read the continuous spec memory FIRST (standing discipline), then this brief.

## Mission

Design and stand up Replant's backup + disaster-recovery posture: **off-machine, encrypted, restore-drilled, threat-model-aware.** We are in QA phase — this is durable infrastructure, not pre-launch checklist theater. A backup that has never been restored is a hope, not a backup: the workstream is not done until a restore drill has run and is documented.

## The four planes (verified starting facts, 2026-07-03)

1. **Supabase prod `jiyetphxxvyiicrnwlnx`** (AWS us-east-1, Postgres 17.6) — the crown jewels: `public.*` (users, churches, messages, prayer_requests, heartcries, UG tables, escalated cases), `auth.users`, both append-only audit tables, Vault secrets, 9 pg_cron jobs, RLS policies/roles/triggers, and the single private storage bucket `underground_evidence` (envelope-encryption columns).
   **Verify FIRST (dashboard + read-only MCP):** the project's plan tier and current backup status (Dashboard → Database → Backups), whether daily backups exist at all today, PITR availability/cost. Do not assume any backup currently exists.
   **The key nuance that makes this non-trivial:** heartcry content is pgp_sym-encrypted at rest with `heartcry_encryption_key` held in **Supabase Vault**. Vault contents are encrypted with a project-managed root key — a logical dump restored into a *different* project will NOT decrypt Vault rows. Without a separately escrowed copy of the heartcry key, a restored database has permanently unreadable heartcries. **Key escrow (offline custody, sealed, never in chat/repo/cloud-notes) is a SEC-panel design item at the center of this workstream.** Same question applies to `underground_evidence` envelope keys — verify how those are derived/stored before trusting any restore path.
2. **Code + config.** Mobile repo = GitHub public `ife-arike/replant` (off-machine once PUSHED — unpushed commits are local-only; check `git log origin/<branch>..HEAD`); admin repo = GitHub private. Migrations follow mirror-on-apply discipline (adopted 2026-07-02) — spot-check for drift since. Edge-function secret VALUES live only in Supabase secrets (+ Founder's 1Password); Netlify env vars are dashboard-side — **locked rules: never pull Netlify env vars via MCP, never have the Founder paste secrets into chat.** The deliverable for this plane is a *secrets inventory by NAME + where each value is held + how it would be re-provisioned*, not a copy of values.
3. **Machine-local assets in NO repo or cloud** (highest single-machine risk):
   1. `~/.claude/projects/-Users-ife-replant/memory/` — the load-bearing session memory (continuous spec + all rulings). Exists nowhere else.
   2. `~/Documents/Claude/Projects/Replant/` — legal/governance corpus (privacy drafts, ToS scoping note, bylaws, Form 1023 narrative, threat model, RTM spreadsheets, design handoffs). Sensitive content → encrypted backup target only.
   3. Anything unpushed in either repo checkout.
   The mechanism here may be as simple as machine-level backup (Time Machine to an encrypted disk, and/or an encrypted cloud target) — but it must be *deliberate, encrypted, and stated*, not assumed.
4. **Third-party state.** Jira + Lucid + the Google Sheet (leads) are provider-hosted (note them, don't rebuild them); Upstash is ephemeral rate-limit/idempotency state — nothing to back up; Resend templates are in-repo/inline; Netlify Forms holds website lead submissions (single copy — fold into the website-leads lifecycle finding from the 2026-07-03 compliance audit rather than duplicating machinery).

## Binding threat-model constraint

Every backup copy is NEW attack surface for T0 data (heartcries, underground). Backups must be encrypted at rest; the storage location, custody, and jurisdiction are deliberate Founder decisions, not defaults; UG invariants are sacred; production-data sensitivity posture applies (first real leader signed up 2026-06-28). Read-only on prod throughout design; never write to audit_log; any backup machinery that touches the DB (roles, scheduled dumps) ships only after the panel + Founder ratification.

## Method (the house pattern)

1. **Verify current state** — plan tier, existing backups, storage bucket contents inventory (metadata only), unpushed-commit check both repos, migration-mirror drift spot-check.
2. **SME panel BEFORE any build** — SEC (required: key escrow, backup encryption, custody/jurisdiction, restore-path attack surface) + DBA (pg_dump vs Supabase-native daily vs PITR; what a logical dump does/doesn't capture — roles, cron, Vault; restore sequencing) + OPS (runbook, drill cadence, alerting on backup failure). Agents pray naming the work; seasoned-expert framing; genuine verdicts.
3. **Founder ratification** — consolidate to ≤5 asks at the end, likely: (1) plan tier / paid-backup willingness (Pro daily + optional PITR vs self-managed dumps — recommend, don't just list); (2) external backup store + jurisdiction (e.g., encrypted object storage in a second provider/region) ; (3) heartcry-key escrow custody ceremony (who holds it, in what form, where); (4) drill cadence + who runs it; (5) scope/mechanism for the machine-local plane.
4. **Implement** what she ratifies.
5. **Restore DRILL** — restore into a scratch Supabase project (or local stack): verify schema + data integrity, verify heartcry decrypt using the ESCROWED key (this is the test that matters), verify RLS/roles/cron re-provisioning steps, time the recovery. Document as an OPS runbook in `docs/ops/` (OPS-03 break-glass is the format precedent), including the drill record.

## Deliverables

1. Backup inventory + tiering doc (the four planes, T0–T3 sensitivity, mechanism per tier).
2. Ratified strategy + implemented automation.
3. Key-escrow ceremony completed and documented (contents never in the doc — custody and procedure only).
4. `docs/ops/` backup + restore runbook with a real drill record.
5. Jira tickets (propose the epic home — likely a new OPS/infra story set; Jira is the paper trail; spot-check any ticket cites against live Jira before locking them in).
6. Memory updates the same turn any Founder ruling lands (continuous-spec discipline).

## Coordination — parallel sessions are in flight

Audit-fix sessions may be working this repo simultaneously. Rules of the road:
1. Work in an isolated worktree or your own branch (`feat/backup-dr` off current HEAD); confine repo writes to `docs/ops/` + a scripts directory. Check `git status` before assuming the tree is yours.
2. NO schema or edge-function changes without the panel + Founder ratification.
3. Push discipline: `~/replant` = LAX, `replant-admin` = ASK; batch pushes across workstreams — the Founder owns timing.
4. If a fix session's change collides with backup design (e.g., new cron, new secret), note it and coordinate through the Founder rather than assuming.

## Standing cautions (do not relearn)

1. Never have the Founder paste secrets into chat — dashboard forms; verify via deploy + smoke.
2. No time estimates — stages and checkpoints only. Enumerate with numbers. Consolidate questions at the end.
3. Only the Founder marks Done in Jira.
4. Don't default to MVP-thin — right-the-first-time posture; staged paths only where the Founder explicitly rules.
5. Confirm before building: regurgitate understanding + ask before dispatching agents or writing code.
