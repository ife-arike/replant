# Replant Project Artifacts Hub — Program Plan

**Phase 3 ratification artifact · authored 2026-07-13 · status: RATIFIED 2026-07-13 — all §8 questions answered + prayer-enforcement ruling; rulings mirrored in program-state file + continuous spec. Production opened same day (Wave 0+1).**
**Classification: T2 (internal).** ⚠ Do NOT commit this file (or the program-state file) to the mobile repo until Question 1 (public-repo exposure) is ruled — the repo is public and past plan docs are already on pushed public branches.
Program-state file: `.claude/plans/artifacts-hub-program-state.md` (living registry; updated every artifacts session).

---

## 0. Mission readback

Stand up Replant's Project Artifacts Hub: a curated, classified, maintained library of project documents — each authored as a markdown source-of-record, published as a default-private Claude Artifact, all registered behind one hub/index artifact — such that **someone who joins Replant's C-suite completely blind can self-serve into being well-informed on what we are, what we've built, and how we do it — without a single leader being exposed by what we publish.** Sources of truth stay the repos, Jira, the live DB, and memory; artifacts are rendered views, freshness-stamped, honest about shipped vs Testing vs planned. Nothing below is produced until the Founder ratifies this plan.

---

## 1. Inventory — what exists (Phase 1, verified 2026-07-13)

### 1.1 Repos + visibility (VERIFIED live via `gh`)

| Repo / location | Visibility | What it holds |
|---|---|---|
| `ife-arike/replant` (~/replant) | **PUBLIC** | Mobile app (RN/Expo) + `docs/` (324 tracked files) + `.claude/plans/` (55 tracked) + `.qa/` (8) + `supabase/` (105 migrations, 16 fn dirs) + `website/` + `blog/` (Astro) + Netlify form fn |
| `ife-arike/replant-admin` (~/replant-admin) | PRIVATE | Admin dashboard (Vite/React), **91 Netlify functions** + 17 `_lib` helpers + Vitest suite; `_emails/` (2 templates); **no docs/, no .claude/plans/** — knowledge lives in CLAUDE.md + SECURITY.md + Jira |
| `ife-arike/replant-website` (~/replant-website) | PRIVATE | Fresher (May 14) marketing-site copy — **not wired to Netlify** (see F5) |
| `replant-ops` | **DOES NOT EXIST** (not local, not on GitHub) | Planned home for backup/DR scripts + runbooks per 2026-07-03 rulings — never created |
| `~/Documents/Claude/Projects/Replant/` | local folder (not a repo) | LEGAL cowork corpus + a full second product workspace (see 1.7) |
| `~/.replant/` | local stray | `qa-kan-66.env` (unopened; flagged) |

**Exposure state (verified):** `origin/main` is clean (1 plan file, 34 docs, 0 audits). But pushed branches **`origin/fix/kan-302-store-config-batch`** (55 plan files · 323 docs · 39 audit files · 8 .qa) and **`origin/feat/kan-296-mobile-attribution-slot`** (42 · 323 · 39 · 8) expose on the public internet: `underground-flow.md` (all 33 UG rulings incl. join-code design), `2026-07-03-backup-dr-session-brief.md`, both P0 break-glass runbooks, `docs/ops/OPS-03-totp-breakglass.md`, the three cowork-LEGAL briefs (entity + EIN), the compliance bundle's PII data-inventory + iOS privacy worksheet, UAT registers, and `cd-prompt-underground.md`. `flag_taxonomy_secret.json` is properly gitignored and absent from the remote; the 2026-07-01 pickaxe already proved no Supabase keys in history. → **Question 1.**

### 1.2 The docs shelf (`~/replant/docs`, mtimes are the truthful dates — git history was flattened by a 2026-07-02 bulk commit)

- **Requirements:** `replant-requirements-v2_7.html` (193KB, mtime 06-18, internally "Living Requirements Document v2.7", feature refs to v4.0). Second copy in ~/Documents (identical vintage). **Severely stale vs live platform**; the drift audit (1.3) is the ready head start.
- **Foundation-era docs, frozen ~Apr 29:** technical-plan (40KB), wireframes, product-overview + technical-vision (0.7KB stubs), brandkit, postmvp-notes (superseded by memory), dev-roles pointer.
- **Current planning layer:** 5 `build_manifest_*` (Jun 22–30), `release_notes/` (convention adopted 06-23, **one real entry**), `system-map/` (Lucid handoff + 07-02 reconciliation sheet — newest content).
- **`docs/ops/`: only OPS-03** (TOTP break-glass). OPS-04/OPS-05 were ruled "in parallel with code" (2026-06-22) and never landed — gap.
- **24 design_handoff_* dirs** (May 27 → Jun 30) with superseded generations left in place (Connect v1/v2/v3, Church v1/v2, Persecuted v1/v2, 4 Prayer-Wall redline files); `emails/` + stale `v1/`; home-tab/banners/blog handoffs.
- Hygiene strays: demo TOTP seeds in `design_handoff_mfa_login_gate/` (~99 otpauth/secret-shaped strings — demo, but on a public repo), mock-PII fixtures in church-tab data.jsx, `cd-*.png` admin mockups at repo root, .DS_Store litter.
- Top-level governance docs **all frozen 2026-04-29**: VISION.md, PRINCIPLES.md (v1.0 — good bones), SECURITY.md, ROADMAP.md (still says "Phase 1: Foundation"). CHANGELOG.md claims automation, last entry 05-16 — **broken**.

### 1.3 Audit record (complete, current, high quality)

| Audit | Date | State |
|---|---|---|
| Pre-UAT comprehensive (9 lenses) + P0-1/P0-2 runbooks + `_working/` 9 worksheets | 07-01/02 | FULLY REMEDIATED on prod (per continuous spec); doc carries raw markers, not a closed-out ledger |
| MVP board audit + gap analysis (+ `2026-07-02-board-audit/` brief, LEDGER, 13 verdict files) | 07-02 | Done; all 11 Founder rulings locked (c.16178–16189) |
| Compliance/a11y/store synthesis (+ 9-file lane bundle incl. PII data-inventory, iOS privacy worksheet, device scripts) | 07-03 | Complete; tickets KAN-302–319 filed; remediation in flight |
| **`_working/requirements-2_7-drift.md`** | 07-01 | 196 lines: P-1…P-4 priority deltas, D-A…D-G structural deltas, housekeeping, **9 paste-ready HTML delta blocks** for doc §01/§13/§14/§16 + flag-taxonomy reconciliation + verification appendix. Ready but unapplied; ticket cites gated on live-Jira spot-check |
| Backup/DR panel (in continuous spec + `.claude/plans` brief; ⛔ PITR reminder gate before store upload) | 07-03 | Rulings locked; drill #1 = completion gate; hardware deferred-not-nixed |
| Sim UAT logged-in pass (F1–F11 + register) | 07-12 | Complete; findings await Founder walkthrough (separate lane) |

### 1.4 Working plans corpus (`~/replant/.claude/plans`) — 65 files, 2026-06-14 → 07-13

- **Buckets:** 17 build handoffs (near-daily chain Jun 20→Jul 02 — a strong provenance trail) · 14 SME panel outputs/syntheses · 8 CD prompts · 6 session prompts · 6 UAT/QA artifacts · 5 matrices/audits · 3 cowork-LEGAL briefs · 1 formal ratification register (`2026-07-03-panel-ratification-consolidated.md`) · 5 misc architecture/flow specs.
- **Git state:** 55 tracked (on the public branches); the **10 newest files (whole Jul-12/13 batch: sim-UAT findings + appendices, comms matrix, this program's files) are untracked — local-only, unbackuped.**
- **Anchors:** comms matrix (07-12, current — #20 ingests it) · sim-UAT findings + appendices A/B (07-12) · consolidated ratification register (covers KAN-313 + KAN-205; the same-day KAN-304/305 panels were stamped on-ticket c.16297/16298 but never folded into the register — decision-register archaeology input) · `underground-flow.md` (June 19; the corpus's most safety-critical file) · two heavyweight briefs (email-infra 85KB, realtime rollout 135KB).
- **Sensitivity sweep (filenames only):** test-account emails in 5 tracked files (`handoff-in-review-ratification`, `2026-07-01-pre-uat-audit-fix-session-handoff`, `handoff-2026-06-27-mfa-architecture`, `orphan-prevention-architecture`, `kan271-uat-fixes`) · join-code mechanics in 6 files · break-glass detail in 7 · **`sme-synthesis-wordlist.md` = FLAG_TAXONOMY starter patterns (a moderation-bypass surface) — tracked on public branches.** No real-leader identity data surfaced.
- Correction to prior assumption: `founder-device-scripts.md` lives in `docs/audits/2026-07-03-compliance-a11y-store-audit/`, not in plans.

### 1.5 QA surfaces

`.qa/` (current): UAT pass register SQL (07-12), pending_cleanup.sql, seed_apply/ session-2 seed set — test fixtures + live project ref, operationally sensitive. Top-level `qa/kan-44/` (May): orphaned self-contained harness with **committed node_modules** — consolidation candidate. Sim-harness runbook knowledge lives in session prompts/memory, not a doc.

### 1.6 Sister repos, website, blog (F5)

Live `projectreplant.org` = Netlify site `b5e8b365`, deployed manually from the **mobile repo's `website/` folder — stale Apr 29**; the **fresher private `replant-website` repo (May 14, diverging index.html) is unwired**; the form-capture function (`submission-created` → Google Sheet) exists **only** in the mobile repo, so a naive cutover drops form capture; the **Astro blog** (mobile repo `blog/`, freshest Jul 2, strict CSP) has **no confirmed Netlify site**. Admin repo: 12 never-pushed local branches (single-machine loss risk — echoes the backup workstream's finding).

### 1.7 LEGAL / cowork corpus (`~/Documents/Claude/Projects/Replant/`, indexed only — 26 relevant of 83 top-level files)

- **Legal/governance core (11):** bylaws v0.1, community covenant v0.1, COI policy v0.1, Form-1023 narrative v0.1 (all Jun 8) · privacy policy v0.1→**v0.2** (May 13) · ToS scoping note v0.1 (May 13; 3 Founder decisions still open) · threat model (May 8) · audit-log runbook (May 8) · financial log v1.1 (May 15).
- **Governance-adjacent (4):** COO handoff (74KB, May 18), OPS-03 update brief, post-MVP notes, pre-launch checklist (May 18).
- **Non-legal but hub-relevant (11):** requirements v2_5→**v2_7** (2nd copy), **data dictionary** (71KB, May 18), **dev-roles-updated** (75KB, May 2 — the role-system source doc), technical plan (2nd copy), **ADRs+migrations** (102KB) + migrations index + v1.24 SQL, changelog, **RTM v1.0→v1.1** (requirements traceability, May 10).
- Rest of folder: wireframes, 8 design_handoff dirs, emails, Instagram content, screenshots, web-e2e. **Everything here is May-era or earlier — the whole TPM/COO shelf is 6–8 weeks stale.**

### 1.8 Lucid system map (verified via MCP)

Folder "Replant — System Map (2026-06-30)" id 445090016: **19 documents** = 18 diagrams (00 architecture · 01 onboarding/auth · 02 nav/home · 03 church/prayer/persecuted · 04 connect+UG · 05 admin surfaces/tier matrix · 06.1–06.7 sequence diagrams · 07 ERD live-06-30 · 08 verification lifecycle · 09 moderation lifecycle · 10 UG evidence lifecycle · 11 realtime/notification stack) + the **2026-07-02 RECONCILIATION page** (corrections to 00/04/05/06.5/06.7/08/11 — **unapplied in place**; MCP scope 403s content edits; apply prompt exists in plans).

### 1.9 Jira board shape (live reads 2026-07-13)

**17 epics**: KAN-4/5/6/26/27/30/31 In Progress · KAN-8/28/29/32/33 Done · KAN-34 To Do · KAN-7 Cancelled · KAN-179 + KAN-239 (Address the Network, post-MVP #2) + KAN-301 (Compliance & Store) Backlog. Highest ticket **KAN-321** (~320 issued). Precise per-status counts belong to the board-snapshot artifact at production time (live JQL each refresh). D-number rulings live scattered in ticket comments (c.16178–16189, c.16260–16264, c.16297–16299, c.11455 …) + continuous spec + ratification registers → feeds #15.

### 1.10 Memory corpus (`~/.claude/projects/-Users-ife-replant/memory/`) — 172 files

- **170 catalogued** (beyond MEMORY.md + spec): **75 feedback · 68 project · 21 reference · 6 without frontmatter**. Continuous spec = 1,243 lines / 244KB; MEMORY.md = 148 lines.
- **Hygiene findings:** 2 **dangling** MEMORY.md links — `feedback_church_tab_design_rulings.md` and `feedback_completion_flow_edit_mode.md` are indexed but **do not exist on disk** (two ruling files effectively lost; index hooks preserve only their one-line gist). 41 orphan files exist on disk with no index line — mostly dated session snapshots (expected), but 6 are live rulings worth indexing (`feedback_cd_not_dispatchable`, `feedback_cd_handoff_decisions_are_founder`, `feedback_commit_before_handoff`, `feedback_delegate_build_to_agents`, `feedback_test_panel_findings_vs_product`, `postmvp_underground_findable_in_search`).
- For the hub: memory stays the working layer — #6, #12, #13, #15, #23 render FROM it; artifacts never replace it.

### 1.11 Live platform surface (verified today)

- **Supabase `jiyetphxxvyiicrnwlnx`:** **18 edge functions ACTIVE** (memory said 15 — drift): auth-status-check v15, send-message v13, register-church v16, create-account v16, check-email-available v16, delete-account v1, submit-report v1, **resend-webhook v1 (deployed ~today — the KAN-80 bounce-blindness fix landing)**, etc. 105 local migration files (prod count re-verify at production time).
- **Netlify:** projectreplant site + admin site (91 fns incl. 2 @daily UG-evidence sweepers).
- **Confluence:** single default "Project Management" onboarding space (2026-05-05) — no Replant content lives there.
- **Google Drive:** 2 Replant files — "Replant Join-Us Registrations" (**real waitlist PII**, fed by the website form fn) + "Replant - Admin UAT pass v1" (May). Nothing else surfaced under "Replant".
- **Resend / Upstash / Mapbox / EAS:** states as per continuous spec (domain verified/tracking off; new us-east-1 Upstash DB; Mapbox telemetry off in KAN-302 batch pending rebuild).

---

## 2. Findings that shape the program

1. **F1 — The public-repo exposure is the program's first decision.** T3-class material (UG join-code design, break-glass, backup design, LEGAL entity briefs, PII inventory) is live on pushed branches of a PUBLIC repo. Main is clean; the two feature branches are not. Every artifact source-of-record decision hangs on this. → Q1/Q2.
2. **F2 — `replant-ops` was ruled into existence and never created.** The natural private home for T3 (and possibly T2 sources) is missing.
3. **F3 — The requirements ecosystem is rebuild-ready:** v2_7 ×2 copies (both stale) + a 196-line drift audit with 9 paste-ready delta blocks + the continuous spec + Lucid reconciliation. Requirements v3 is a staged rebuild, not a rewrite.
4. **F4 — The repo's public face is frozen at April:** VISION/ROADMAP/SECURITY/CHANGELOG all pre-date the actual product. Anyone reading the public repo today gets a false picture (ROADMAP: "Phase 1: Foundation").
5. **F5 — Three website surfaces, one wired:** live site deploys from the stale Apr-29 copy; the fresh redesign repo is unwired; the blog is unconfirmed. → Q6.
6. **F6 — Knowledge asymmetry:** the mobile repo has sprawling docs; the admin repo has none; the TPM/COO shelf (roles, RTM, data dictionary, COO handoff, ADRs) lives in ~/Documents at May-vintage; the CURRENT truth lives in memory + continuous spec + Jira comments. Exactly the gap this program exists to close.
7. **F7 — Conventions adopted but thin:** release notes (1 entry), CHANGELOG (broken), OPS-04/05 (absent).
8. **F8 — Sensitive strays:** `~/.replant/qa-kan-66.env`, `supabase/functions/send-message/supabase/.temp/` CLI junk (embeds project ref, dated today), demo TOTP seeds in a public-repo handoff dir, mock-PII fixtures, `qa/kan-44` committed node_modules, Drive waitlist sheet = real PII (pointer-only forever).
9. **F9 — Live-state drift vs memory is real and recent:** 18 edge fns vs remembered 15; 91 admin fns vs remembered ~80; audit-action counts drifted repeatedly. Confirms the freshness-stamp + re-verify discipline this plan bakes in.
10. **F10 — Memory hygiene:** two MEMORY.md-indexed ruling files are missing on disk (Church-tab design rulings; CompletionFlowOverlay edit mode) — their content survives only as index hooks; 6 live rulings sit unindexed. A consolidate-memory pass is warranted (separate from this program).
11. **F11 — The newest program work is unbackuped:** the 10 untracked Jul-12/13 plan files (UAT findings, comms matrix, this plan) exist on one machine only — the same single-machine risk the backup/DR workstream named. Tracking them in git would put them on the public repo → resolution rides Q1/Q2.

---

## 3. Gap analysis vs target catalog

| # | Artifact | Verdict | Basis |
|---|---|---|---|
| 0 | Hub index | **missing** | — |
| 1 | Executive brief | **missing** (stale seeds: README, product-overview stub) | 1.2 |
| 2 | Vision & build philosophy | **stale/partial** — PRINCIPLES.md v1.0 good bones; VISION.md Apr-29; current voice lives in memory rulings | 1.2 |
| 3 | Requirements v3 | **stale ×2 copies + rebuild-ready** (drift audit) | F3 |
| 4 | Feature map by surface | **missing as a view** (sources: Jira epics, spec, stale ROADMAP) | 1.9 |
| 5 | E2E flow library | **partial** — Lucid 18 + UAT appendices A/B + lucid-crosscheck worksheet; reconciliation unapplied | 1.8 |
| 6 | Post-MVP roadmap & commitments | **fragmented** — ~20 postmvp_* memories + KAN-179/239 + spec; no single view | 1.10 |
| 7 | Architecture overview | **stale** — technical-plan Apr-29 ×2 copies + Lucid 00; no current narrative | 1.2/1.7 |
| 8 | Schema documentation | **stale/partial** — data dictionary May 18; ERD live-06-30; schema-facts memory | 1.7/1.8 |
| 9 | Security & safety doctrine (sanitized) | **partial** — SECURITY.md Apr-29; threat model May 8; invariants/memory current; audits current | 1.2/1.7 |
| 10 | Repo atlas | **missing** — visibility facts verified this session | 1.1 |
| 11 | Endpoint catalog | **missing as doc** — live: 18 edge + 91 admin fns; seeds: edge-functions + admin-be-gates worksheets | 1.11 |
| 12 | Environments & deploy doctrine | **fragmented** — lives as ~10 memory rules + quirk files | 1.10 |
| 13 | Operating model | **stale/fragmented** — dev-roles HTML May 2 + role memories + spec process rules | 1.7/1.10 |
| 14 | Board doctrine + snapshot | **partial** — Jira live + transition-map memory; no doctrine/snapshot view | 1.9 |
| 15 | Decision register | **fragmented (biggest archaeology after #3)** — spec + Jira comments + ratification registers + gap-ruling memories | 1.9 |
| 16 | Signoff & audit library | **sources complete; library + signoff TEMPLATES missing** | 1.3 |
| 17 | QA/UAT library | **partial** — registers/findings/device-scripts exist; no consolidated library; device matrix thin; fixtures doctrine folds in here | 1.5 |
| 18 | Test strategy forward | **missing** (flags exist in audits: no CI gate, untested clusters) | 1.3 |
| 19 | Tools atlas | **missing** | 1.11 |
| 20 | Communications matrix | **EXISTS + current (07-12/13, comms lane)** → ingest/link, do not redo | spec |
| 21 | Legal/compliance index | **missing** (26 source files indexed; 3 ToS decisions open) | 1.7 |
| 22 | C-suite onboarding walkthrough | **missing** | — |
| 23 | Glossary & acronym register | **missing** (seeds: role abbreviations + humanisation memories) | 1.10 |
| 24 | Lucid diagram atlas *(proposed addition)* | **partial** — system-map README + reconciliation; no per-diagram index w/ drift status | 1.8 |
| 25 | Design & UI library index *(proposed addition)* | **missing** — 24 handoff dirs incl. superseded generations; brandkit Apr-29 | 1.2 |

**Duplicated/conflicting (named):** requirements ×2 · technical plan ×2 · postmvp-notes.html (Apr) vs postmvp_* memories (current — memories win) · website ×3 · emails v1/ archive · design handoff generations (Connect v1-v3, Church v1-v2, Persecuted v1-v2, PW redlines v5-v8) · RTM v1.0 vs v1.1 · ROADMAP/CHANGELOG vs reality · Lucid docs 00/04/05/06.5/06.7/08/11 vs the unapplied reconciliation.

---

## 4. Proposed catalog (26 artifacts)

Tiering: **T1 public-safe** {1, 2, 13, 22, 23} · **T2 internal, default-private, written as-if-leakable** {everything else} · **T3 never hosted** — appears only as pointer lines ("lives in <private ops home>"). Write-rules for every artifact: no credentials/keys/env values/Vault names · no test-account emails or passwords (even dummy) · no real-leader or waitlist data ever · no Founder personal identifiers beyond her public role · UG mechanics at principle level only (join-code internals, evidence handling, region-reveal paths, break-glass, escrow ceremony detail = T3) · T1 additionally: no internal URLs/UUIDs/project refs. Every artifact header: tier badge + "Last verified <date> against <sources>" + honest state labels (shipped / Testing / planned — never blurred).

Effort: **S** = one sitting · **M** = a session lane · **L** = multi-session workstream.

### Shelf A — Identity & vision
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence / trigger |
|---|---|---|---|---|---|---|
| 1 | Executive brief — what Replant is | T1 | PRINCIPLES/VISION bones + product-overview + continuous spec current-phase + release pipeline memory | S | 0 | phase transitions |
| 2 | Vision & build philosophy | T1 | PRINCIPLES.md v1.0 + build-philosophy/voice/never-cheapen rulings + Founder verbatims in spec | S | 0 | on Founder re-articulation |

### Shelf B — Product & requirements
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 3 | **Requirements v3** | T2 | v2_7 + drift audit (9 delta blocks) + continuous spec + Lucid reconciliation + RTM v1.1 | **L** | R-track | phase transitions + ratified scope changes |
| 4 | Feature map by surface (mobile 5-tab/onboarding/settings · dashboard · website) | T2 | Jira epics live + spec shipped-state + release notes | M | 3 | after shipped batches; re-verify at phase gates |
| 5 | E2E flow library (signup→verification→member · heartcry · Connect/DM · branches · admin verification · escalated cases · comms loops) | T2 | Lucid 01/04/06.x/08/09 + UAT appendices A/B + escalated-cases memory | M–L | 3 | when a flow's mechanics change |
| 6 | Post-MVP roadmap & commitments register | T2 | postmvp_* memories + KAN-179/239 + heartcry-E2E/Address-Network/envelope-v2 locks + PITR ⛔ gate | M | 3 | after ratification batches touching sequencing |

### Shelf C — Engineering
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 7 | Architecture overview (RN/Expo · Supabase auth/PG/RLS/edge/Realtime/Vault · Netlify ×2 · Resend · Mapbox · Upstash; how pieces talk) | T2 | Lucid 00/11 + technical-plan bones + spec + live checks | M | 2 | on infra change |
| 8 | Schema documentation (tables, enums, RLS philosophy, audit-log doctrine, migration discipline, invariants) | T2 | live schema + ERD 07 + data dictionary + schema-facts/invariants memories | M–L | 2 | after migration batches; stamp "verified against live schema <date>" |
| 9 | Security & safety doctrine (SANITIZED principles: DELIVER-ALWAYS, UG exclusion-as-principle, 3-tier admin, MFA freshness tiers, propose/approve ceremonies) | T2 | invariants + tier matrix + mfa-freshness + escalated-cases memories + threat model + audits | M | 4 | after SEC panels/audits |
| 10 | GitHub/repo atlas (what each repo IS, visibility, branch/PR conventions, gitleaks posture, worktree quirks, unpushed-work exposure) | T2 | §1.1/§1.6 verified facts + push-discipline memories | S–M | 2 | on repo topology/visibility change |
| 11 | Edge-function + endpoint catalog (18 Supabase + 91 Netlify: name, purpose, auth posture at gate-stack level) | T2 | live list_edge_functions + admin fn tree + edge-functions/admin-be-gates worksheets + verify_jwt table | M–L | 2 | after deploy batches |
| 12 | Environments & deploy doctrine (preview-first, batch pushes, greenlight rules, worktree-deploy rule, verify_jwt CLI quirk, manual website deploy) | T2 | ~10 process memories + spec lessons | S–M | 1 | on process ruling change |

### Shelf D — Process & governance
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 13 | Operating model (SEC/DBA/BA/CC/CD/SM/BE/FE/ADMIN/CONTENT/MOD/OPS/LEGAL; SME panels + genuine-verdict; ratification flow; prayer convention; memory/spec discipline; cowork lanes) | T1 | dev-roles HTML + role/panel/dispatch memories + spec process rules | M | 1 | on role/process rulings |
| 14 | Board doctrine + live snapshot (Jira-as-paper-trail, only-Founder-marks-Done, transition map, epic structure, counts) | T2 | live JQL + transition-map memory + F1-style board audits | S doctrine + auto snapshot | 1 | snapshot every artifacts session; doctrine stable |
| 15 | **Decision register** (D-numbers + dated rulings, searchable) | T2 | continuous spec + Jira ruling comments + ratification registers + gap-batch memory | **L** (archaeology) | 1 (start) → rolling | after every ratification batch |
| 16 | Signoff & audit library (every audit: verdict + remediation state + link) **+ signoff TEMPLATES** (UAT signoff, compliance, pen test, launch) | T2 | §1.3 corpus + release pipeline memory | M | 1 | after every audit; templates at gate approach |

### Shelf E — Quality
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 17 | QA/UAT library (test plans, F1–F11 + dispositions, register/rollback pattern, fixtures doctrine [no passwords], sim-harness runbook, device matrix) | T2 | .qa/ + UAT findings + device scripts + sim-harness lessons | M | 4 | after each QA/UAT pass |
| 18 | Test strategy forward (automated signup matrix, release-build verification, visual sweep, second device, pen-test phase) | T2 | audit roadmap flags + planned-work prompts | S–M | 4 | at phase transitions |

### Shelf F — Tooling & integrations
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 19 | Tools atlas ("what we use and what it's doing": Claude Code agents/panels/memory/worktrees, CD, cowork+LEGAL lane, MCP servers, Expo/EAS+Xcode sim, gitleaks, Upstash, Mapbox, Resend, Netlify — per tool: role, access scope, key custody location [never values], risk notes) | T2 | MCP config + tool-quirk memories + this session's live checks | M | 2 | on tool adoption/removal |
| 20 | Communications matrix | T2 | **INGEST `.claude/plans/2026-07-12-comms-matrix.md` (current, owned by comms lane)** — summarize + link, never redo | S | 3 | after comms batches ship |

### Shelf G — Legal & compliance (pointer shelf)
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 21 | Legal/compliance INDEX (privacy v0.2→v0.3 state, ToS scoping + 3 open decisions, store-blocker set, entity docs) — pointers into ~/Documents; LEGAL lane owns content | T2 | §1.7 index + KAN-301/KAN-157 live | S | 4 | when LEGAL versions change |

### Shelf H — People & onboarding
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 22 | C-suite onboarding walkthrough (the front door: read-in-order path, how access works, who's who) | T1 | everything above | S skeleton → M final | 0 skeleton, finalized last | after each wave |
| 23 | Glossary & acronym register (heartcry, underground [principle-level], RAG, RPL ID, branch, para-ministry, Manager-never-Overseer, covenant, Escalated Cases, role codes, humanisation table) | T1 | naming/terminology memories + spec | S | 0 | new ratified terms |

### Proposed additions (Phase-1 surfaced)
| # | Artifact | Tier | Renders from | Effort | Wave | Cadence |
|---|---|---|---|---|---|---|
| 24 | Lucid diagram atlas (per-diagram index: what each shows, last-verified, **drift status incl. unapplied reconciliation items**) | T2 | Lucid folder 445090016 + reconciliation sheet + lucid-crosscheck worksheet | S–M | 2 | after Lucid edits |
| 25 | Design & UI library index (handoff dirs mapped current-vs-superseded, brandkit, CD conventions, typography/icon rulings) | T2 | 24 handoff dirs + brandkit + design memories | M | 3 | after new CD handoffs |
| — | Data & fixtures doctrine | — | **folded into #17** | — | — | — |
| 0 | Hub index (front door registry: every artifact, tier badge, freshness, status) | T2 | program-state registry | S | 0 | every publish |

---

## 5. Production waves + per-session protocol

**Wave 0 — Spine (first post-ratification session):** #0 hub shell · #1 exec brief · #2 vision & philosophy · #23 glossary · #22 walkthrough skeleton. All T1/S — the blind joiner gets a front door immediately.
**Wave 1 — Governance shelf:** #13 operating model · #14 board doctrine+snapshot · #15 decision register (started; rolls) · #16 audit library + templates · #12 deploy doctrine.
**Wave 2 — Engineering core:** #7 architecture · #10 repo atlas (needs Q1/Q2 ruled) · #8 schema · #11 endpoint catalog · #24 Lucid atlas · #19 tools atlas.
**Wave 3 — Product:** #4 feature map · #5 E2E flow library · #6 post-MVP register · #20 comms ingest · #25 design index.
**Wave 4 — Quality + legal + security:** #17 QA/UAT library · #18 test strategy · #9 security doctrine (SEC-adjacent review before publish) · #21 legal index · #22 walkthrough finalized.
**R-track — Requirements v3 (parallel, its own lane):** R1 apply the 9 drift deltas to v2_7 (spot-check ticket cites vs live Jira first — CLAUDE.md rule) → R2 fold post-07-01 locked rulings + Lucid reconciliation → R3 restructure into v3 markdown source-of-record, exec-grade, classification-gated sections → R4 SME spot-panel + Founder ratification. Starts alongside Wave 1–2; lands by Wave 4. The two v2_7 HTML copies get dated SUPERSEDED banners at v3 ship.

**Per-session protocol (every artifacts session):** pray naming the work → read program-state → live-verify the facts the wave's artifacts assert (Jira cites via getJiraIssue; schema via MCP; repo state via gh) → author markdown source-of-record in the ruled location → publish via Artifact tool (stable title/favicon; same file path on redeploy — URLs never churn) → update hub index + program-state registry → memory note per acknowledge≠saved. No pushes without the standing greenlight rules; artifacts stay default-private; no share links unless the Founder creates them.

---

## 6. Maintenance protocol (Phase 5, draft standing rule — ships as a doc in Wave 0)

1. **Repos/Jira/DB/memory are sources of truth; artifacts are rendered VIEWS.** An artifact is never edited into disagreement with its source: the source changes first, or the artifact carries a dated `⚠ Known drift (YYYY-MM-DD): <what> — source: <where>` note until reconciled.
2. **Freshness stamp** on every artifact header: `Last verified YYYY-MM-DD against <named sources>`. A stamp older than the last phase transition = stale by definition; the hub index shows it amber.
3. **Triggers table** (per artifact — see §4 cadence column). Standing minimum: every artifacts session refreshes the board snapshot + hub index; every audit refreshes #16; every ratification batch refreshes #15 (+#6 if sequencing moved).
4. **Honest-state vocabulary:** shipped / Testing / planned / deferred-not-nixed — never blurred (mirrors PRINCIPLES.md I–II).
5. **Registry:** the program-state file is the registry of record; the hub index artifact mirrors it. Artifact URLs never churn (same file path on redeploy).
6. **Classification enforcement:** tier badge in every header; T3 exclusion list re-read before each publish; when unsure, stricter + add to the Founder question list.

---

## 7. Proposed follow-ups (NOT questions — for greenlight whenever convenient, no Jira writes made this session)

1. Hygiene cleanup batch (mobile repo): delete `supabase/functions/send-message/supabase/` CLI junk · retire `qa/kan-44` (committed node_modules) · relocate root `cd-*.png` strays · .DS_Store sweep · archive superseded design generations + `emails/v1/` under an `archive/` convention · scrub demo TOTP seeds in `design_handoff_mfa_login_gate` (or note them as demo).
2. `~/.replant/qa-kan-66.env` — Founder deletes or relocates (contents unread by this program).
3. OPS-04/OPS-05 — author per the 2026-06-22 ruling (belongs to the ops lane, not this program; noted so it isn't lost).
4. CHANGELOG: either fix the automation or mark the file historical.
5. Website: after Q6, retire the losing copies (stale `website/` or unwired repo) so the atlas can tell one truth.
6. Scrub the 5 tracked plan files carrying test-account emails + relocate `sme-synthesis-wordlist.md` off the public repo (both moot if Q1 = flip private, which handles them wholesale).
7. Memory consolidate pass (F10): restore-or-retire the 2 dangling index entries; index the 6 live orphan rulings.

---

## 8. Founder decision list (consolidated — each is yours alone)

1. **Public-repo exposure (F1) — pick the remediation.** The public `ife-arike/replant` currently exposes, via the two pushed feature branches, the UG-flow design file, backup/DR brief, P0 break-glass runbooks, OPS-03, LEGAL entity briefs, PII data-inventory worksheet, UAT registers, test-account emails in 5 plan files, and the FLAG_TAXONOMY starter wordlist (origin/main is clean; no credentials — keys were pickaxe-cleared 2026-07-01). Options: **(1) flip the repo PRIVATE now** — one click in GitHub settings, ends all exposure incl. history; EAS builds and the manual Netlify website deploy are unaffected; the public-witness README/VISION/PRINCIPLES lose their public home (they could later move to the website or a small curated public repo). **(2)** Keep public; after the open PRs merge, delete the two remote branches + history-purge `.claude/plans/`, `docs/audits/`, `docs/ops/` (BFG rewrite — heavier, and anyone could have cloned meanwhile). **(3)** Keep public; relocate those directories to a private repo going forward + purge history. My recommendation: **(1)** — the repo has no external contributors, and for a platform serving persecuted leaders, hygiene outranks witness-by-repository. Your call on the witness trade-off.
2. **Where do artifact markdown sources-of-record live?** Depends on Q1: if the repo flips private → keep sources in `~/replant/docs/hub/` (simplest, one home). If it stays public → create **one private repo** (recommend the already-ruled `replant-ops`) holding T3 ops material AND `hub-sources/` for T2 artifact markdown; T1 sources may stay public. Creating any repo happens post-ratification with your go.
3. **Ratify the catalog + waves:** 26 artifacts (the 23 + hub #0 + Lucid atlas #24 + design index #25; fixtures doctrine folded into #17), wave order §5, and the R-track staged approach for Requirements v3 (rebuild from v2_7 + drift audit + spec + reconciliation — not from scratch; supersede both HTML copies at ship).
4. **Tier rulings on the four judgment calls:** #1 exec brief T1 · #13 operating model T1 · #23 glossary T1 (UG entries principle-level) · #14 board snapshot T2 with sanitized ticket titles. Default-stricter alternative: make #13/#23 T2 and keep only #1/#2/#22 public-safe. I recommend the proposed tiers with the write-rules in §4; your call.
5. **Access model for the blind C-suite joiner:** artifacts-only (hub + share links you create per person), or artifacts + read access to repos/Jira? This shapes how much pointer-vs-content every T2 artifact carries (artifacts-only pushes more self-contained depth into T2 docs).
6. **Website canonical source (F5):** which copy is truth going forward — the mobile repo's `website/` (currently what deploys, stale), the fresher private `replant-website` repo (unwired; a cutover must carry the form-capture function with it), or a fresh consolidation? Also: is the Astro blog meant to be live?
7. **Drive "Replant Join-Us Registrations" sheet holds real waitlist PII.** Proposal: the hub references it pointer-only forever (tools atlas + comms artifacts name its existence, never its contents), and it stays out of every artifact. Confirm — and worth a moment verifying its share settings yourself (I did not and will not open share state).
8. **Program cadence:** dedicated artifacts sessions per wave (recommended — Wave 0 is one session), or wave items ride the tail of other sessions? You own timing per the batch-across-workstreams rule.

---

*Sources for every §1 claim: live `gh`/git/MCP reads 2026-07-13 + the six inventory lanes (agent outputs) + continuous spec. Ticket cites in artifacts get live-Jira spot-checks at production time per CLAUDE.md.*
