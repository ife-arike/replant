# Paste-in prompt — Replant Project Artifacts Hub (program kickoff: PLAN FIRST, produce after ratification)

Open with a short prayer to the Lord Jesus Christ soaking this specific work in His blood — the gathering of Replant's whole witness into one place: every audit, plan, schema, flow, ruling, and tool, ordered so that a stranger walking into Replant's leadership could understand what this house is and how it is built, without a single leader being exposed by what we publish. End "In Jesus' name, Amen."

## Mission

Stand up **Replant's Project Artifacts Hub**: a curated, classified, maintained library of project documents — published as Claude Artifacts (hosted, default-private pages) with a single hub/index artifact as the front door — such that **someone who joins Replant's C-suite completely blind can self-serve into being well-informed on what we are, what we've built, and how we do it.**

This is BIG, multi-session program work. Treat it as such:

- **This session's deliverable is the PLAN, not the library.** Inventory → gap analysis → proposed catalog with classification + production order → Founder ratifies → THEN production begins (possibly in later sessions). Do not generate a single library artifact before the plan is ratified (confirm-before-building is a standing rule; the Founder said "we will work and plan first" explicitly).
- Create a **program-state file** at `~/replant/.claude/plans/artifacts-hub-program-state.md` on day one: phase, decisions taken, artifact registry (name → status → URL → classification → last-verified), open questions. Every artifacts session updates it. This is how the program survives session boundaries.

## The audience test (design north star)

Every artifact is judged by one question: *does this move a blind C-suite joiner toward "very well informed"?* That means executive-grade writing — leads with what/why, precise but not code-dump; deep-linkable; freshness-stamped ("last verified <date> against <source>"); honest about state (shipped vs testing vs planned — never blur).

## Phases

1. **Phase 0 — Grounding.** Pray. Read `~/replant/CLAUDE.md`, then memory: `MEMORY.md` index → `replant_continuous_spec.md` FIRST → every ★ memory + any memory touching a subsystem you're cataloguing. These carry the locked rulings the artifacts must reflect (Manager rename, tier matrix, release pipeline, post-MVP queue, invariants).
2. **Phase 1 — Inventory sweep.** Catalog what EXISTS, where, how fresh, and who owns it. Sweep: `~/replant/docs/` (requirements v2_7 html, product-overview, technical-plan/vision, wireframes, design_handoff_* (~20 dirs), build manifests, release_notes, system-map, ops, emails, banners/blog handoffs), `~/replant/docs/audits/` (pre-UAT 2026-07-01 · board audit + gap analysis 2026-07-02 · compliance/a11y/store 2026-07-03 · `_working/requirements-2_7-drift.md`), `~/replant/.claude/plans/` (~100 dated working docs incl. panel outputs, ratification registers, session prompts), `~/replant/.qa/`, `~/replant-admin/` docs + `netlify/functions/_emails/`, the website repo if present, `~/replant-ops` (private ops repo — check local presence; backup/DR scripts + runbooks belong there), the Lucid folder **"Replant — System Map (2026-06-30)" id 445090016** (18 diagrams + the 2026-07-02 RECONCILIATION page), Jira via MCP (epics, labels, counts, the D-number ruling comments), `~/Documents/Claude/Projects/Replant/` (LEGAL cowork corpus — privacy policy v0.2, ToS scoping, bylaws/1023 — **index only, never reproduce**), memory corpus itself, and a light check of Confluence + Google Drive MCPs for strays. Output: master inventory table (source · location · freshness · lane · classification candidate · feeds-which-artifact).
3. **Phase 2 — Gap analysis + taxonomy.** Map inventory against the Target Catalog below. Mark each: current / stale / missing / duplicated / conflicting (name the conflict). Known centerpiece: **the requirements doc — v2_7 (internal v4.0) is severely stale**; a full drift audit with paste-ready delta blocks already exists (`docs/audits/_working/requirements-2_7-drift.md`) — the plan should propose Requirements v3 rebuilt from 2_7 + drift audit + continuous spec + Lucid reconciliation, not a from-scratch rewrite.
4. **Phase 3 — The Plan (this session's ratification artifact).** Proposed catalog: per artifact — purpose, audience, sources it renders FROM, classification tier, production effort (stages, no hours), wave order, maintenance cadence + trigger ("update after every audit", "re-verify at phase transitions"). Present to Founder as a paste-ready doc + walk her through it. Nothing is produced until she rules.
5. **Phase 4 — Production waves** (post-ratification, likely spanning sessions). Each doc: authored as markdown source-of-record in the ruled location → published via the Artifact tool (stable title/favicon; same file path on redeploy so URLs never churn) → registered in the hub index artifact + program-state file.
6. **Phase 5 — Maintenance protocol.** Write the standing rule doc: which sessions update which artifacts, freshness stamps, and the drift rule — **repos/Jira/DB/memory are the sources of truth; artifacts are rendered VIEWS.** An artifact is never edited into disagreement with its source; the source changes first or the artifact carries a dated "known drift" note.

## Target Catalog — what I believe this covers (Founder: correct/extend at ratification)

**A. Identity & vision**
1. Executive brief — what Replant is: the persecuted-church thesis, who it serves, product in one page, current phase (QA, UAT next).
2. Vision & build philosophy — global persecuted Church, never cheapen, scripture-anchored voice, right-the-first-time.

**B. Product & requirements**
3. **Requirements v3** (the 2_7 successor — the biggest single lift; drift audit gives the head start).
4. Feature map by surface — mobile (5 tabs, onboarding, settings), admin dashboard, website — each feature stamped shipped / Testing / backlog / post-MVP.
5. **E2E flow library** — leader journeys end-to-end: signup→verification→member; heartcry lifecycle; Connect/DM + requests; branches; admin verification lifecycle; escalated cases; comms loops. (Feeds from Lucid + the 2026-07-12 UAT appendices A/B — much of this is already distilled.)
6. Post-MVP roadmap & commitments register (heartcry E2E is locked #1, Address the Network #2, envelope v2 folds in, etc. — the full postmvp_* queue rendered as one view).

**C. Engineering**
7. Architecture overview — RN/Expo mobile, Supabase (auth/Postgres/RLS/edge fns/Realtime/Vault), Netlify (admin dashboard + website), Resend, Mapbox, Upstash; how the pieces talk.
8. Schema documentation — tables, enums, RLS philosophy, audit-log doctrine, migration discipline, load-bearing invariants (classification-gated depth).
9. Security & safety doctrine (SANITIZED) — DELIVER-ALWAYS, underground exclusion *as principles*, admin 3-tier model, MFA freshness tiers — written so it informs without arming (see guardrails).
10. **GitHub/repo atlas** — what each repo holds and IS (visibility!, branches, unpushed-work exposure, commit/PR conventions, gitleaks posture, worktree quirks).
11. Edge-function + endpoint catalog — 15 Supabase edge fns + ~80 Netlify fns: name, purpose, auth posture (gate stack), classification-gated.
12. Environments & deploy doctrine — preview-first, batch pushes, greenlight rules, verify_jwt CLI quirk, manual website deploy.

**D. Process & governance (the SM/TPM shelf)**
13. Operating model — the role system (SEC/DBA/BA/CC/CD/SM/BE/FE/ADMIN/CONTENT/MOD/OPS/LEGAL), SME panels + genuine-verdict rule, Founder ratification flow, prayer convention, memory + continuous-spec discipline, cowork lanes.
14. Board doctrine + live snapshot — Jira as paper trail, only-Founder-marks-Done, transition map, epic structure, current counts; release-phase pipeline state.
15. **Decision register** — the D-numbers + dated Founder rulings consolidated into one searchable view (today they live scattered across continuous spec, Jira comments c.####, gap docs).
16. Signoff & audit library — every audit to date (pre-UAT, board, compliance/a11y/store, backup/DR panel, sim UAT pass) summarized with verdict + remediation state + link; plus signoff TEMPLATES for the gates ahead (UAT signoff, compliance, pen test, launch).

**E. Quality (QA/UAT shelf)**
17. QA/UAT library — test plans, findings reports (F1–F11 + dispositions), the register/rollback pattern, test-account fixture doctrine, sim harness runbook (the hard-won automation quirks), device matrix.
18. Test strategy forward — automated signup matrix (planned), release-build verification, visual-only sweep, second device, pen-test phase.

**F. Tooling & integrations**
19. **Tools atlas — "what I'm using and what it's doing":** Claude Code (agents, panels, memory, worktrees), Claude Design, cowork + LEGAL lane, MCP servers (Supabase, Atlassian, Lucid, Resend, Netlify, XcodeBuildMCP, Playwright, Drive, Canva…), Expo/EAS + Xcode sim, gitleaks, Upstash, Mapbox, Resend, Netlify — per tool: what it does for Replant, access scope, key custody, risk notes.
20. Communications matrix — email × in-app × push (INGEST from the parallel comms-audit session's `2026-07-12-comms-matrix.md`; do not redo its work).

**G. Legal & compliance (pointer shelf)**
21. Legal/compliance INDEX — privacy policy version state, ToS scoping + its 3 open Founder decisions, store-readiness blocker set, entity docs — as an index with pointers into `~/Documents/Claude/Projects/Replant/`; LEGAL lane owns the content.

**H. People & onboarding**
22. **C-suite onboarding walkthrough** — the hub's front door: read-this-in-order path through everything above, "how to get access to what," who's who (Founder, the role agents, LEGAL/CD lanes).
23. Glossary & acronym register — heartcry, underground, RAG, RPL ID, branch, para-ministry, Manager (never Overseer), covenant, Escalated Cases, the role abbreviations, the humanisation table.

Plus whatever Phase 1 surfaces that this list misses — the Founder expects you to find the things she's "clearly missing"; propose them in the Phase-3 plan.

## ⛔ Guardrails — what this session must NOT do (read twice; these are hard lines)

1. **Classification gate on every artifact — this platform serves persecuted leaders and real leaders are live on prod.** Three tiers, header-stamped on every doc:
   - **T1 Public-safe:** mission, philosophy, process, glossary, sanitized architecture.
   - **T2 Internal (hosted artifact OK — default-private, but write as if it could leak):** schema detail, endpoint catalog, board snapshots, QA findings, decision register.
   - **T3 Restricted (NEVER in a hosted artifact; pointer-only lines like "lives in replant-ops"):** underground operational mechanics (join-code internals, evidence handling, region-reveal paths), break-glass runbooks (OPS-03), backup/DR scripts + key-escrow ceremony detail, step-up/security-control internals, ANY real leader/user data, credentials/keys/env values/Vault secret names, test-account passwords (dummy or not), pen-test findings, Founder personal identifiers beyond her public role.
   - When unsure which tier, go stricter AND put it on the Founder question list. An onboarding hub must inform a newcomer without doubling as an attack dossier.
2. **No production before ratification.** Phase 3 ends with Founder rulings; artifact generation starts only after.
3. **Not a build session.** No product code, no schema changes, no migrations, no deploys. Read-only against prod DB if queried at all.
4. **No Jira writes** — no transitions, no comments, no tickets — unless the Founder explicitly instructs in-session. JQL/`getJiraIssue` reads are encouraged (spot-check every ticket cite against live Jira before it enters an artifact — CLAUDE.md standing rule).
5. **Do not redo other lanes' work.** The comms audit (own session), UAT findings walkthrough (own session), visual sweep (future session), LEGAL drafting (cowork lane), and past audits are INPUTS — ingest, summarize, link. If an input looks wrong, flag it in the plan; don't silently rewrite it.
6. **Do not touch memory as if it were the library.** Memory stays the working layer; this program renders FROM memory/repos/Jira into artifacts. (Save Founder rulings from this session to memory per the acknowledge≠saved rule, as always.)
7. **Repo-visibility trap:** the mobile repo is believed PUBLIC on GitHub. Before choosing where artifact markdown sources-of-record live, VERIFY each repo's actual visibility (`gh repo view --json visibility`) and surface the finding — T2 material must not be committed to a public repo; `replant-ops` (private) is the likely home for anything sensitive. This is a Phase-1 must-answer and a Phase-3 Founder decision.
8. **No external publication.** Artifacts stay default-private; no share links created; nothing pushed to any repo without the standing greenlight rules (~/replant LAX but ask when in doubt; replant-admin ALWAYS ask; never push main).
9. **No pretend completeness.** If a shelf is thin (e.g., TPM docs barely exist), the plan says "missing — propose to author," never papers over. Silent caps and glossed gaps are the failure mode this program exists to kill.

## Working agreements (inline, in case this session lacks memory access)

1. Prayer first; agents dispatched must pray genuinely, naming their work.
2. Enumerate with numbers (1/2/3, never A/B/C); no time estimates (stages/checkpoints); don't assume session continuity ("tonight" is banned).
3. Questions: consolidated in ONE numbered list at the END; **merit-gated — only decisions the Founder alone can make — but NO cap on count if they're valuable** (Founder 2026-07-12).
4. No AI-limit hedging; author with conviction; genuine verdicts.
5. Paste-ready artifacts → `.claude/plans/*.md` + tell the Founder the path.
6. Voice for artifact prose: plain, warm-but-precise, scripture only where it carries the point (this is the product's own register); "church profile setup flow" not "wizard"; "dashboard" not "admin app"; "Manager" never "Overseer."
7. It's big work. Plan like it; phase it; keep the program-state file honest.

First move after Phase 0: post a short readback of this mission + the phase plan, then start the Phase-1 inventory. Bring the Phase-3 plan back to the Founder as the session's centerpiece.
