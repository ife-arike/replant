# KAN-44 — QA harness

Reusable QA scaffold for the `auth-status-check` edge function. Pass 1 re-runs the formal TCs from QA's plan (KAN-44 comment 10313). Pass 2 runs the adversarial sweep (escalation 10932). Produces a `report.md` per QA seat.

This subtree is the seed for KAN-82 / KAN-59 and any future auth-surface ticket — copy `qa/kan-44/` to `qa/<ticket>/`, swap the contract + JWT-name conventions, and the same `run.sh` orchestrates.

## Layout

```
qa/kan-44/
├── README.md                this file
├── run.sh                   orchestrator. --dry-run validates structure only.
├── pass1.sh                 formal TC re-run (TC-44.1 → TC-44.7 + TC-44.3a)
├── pass2_adversarial.mjs    adversarial Node script (subtests 2.1–2.7)
├── contract.json            byte-level oracle (derived from types/auth.ts)
├── derive-contract.mjs      drift check: re-derives contract from types/auth.ts
├── generate-report.mjs      report builder (sample / populated)
├── package.json             Node deps (jsonwebtoken)
└── artifacts/               run output — gitignored except .gitkeep
    └── <UTC-timestamp>/     one dir per run; report.md + per-TC subdirs
```

## First-time setup

```
cd qa/kan-44
npm install        # installs jsonwebtoken
```

`npm install` is required for live execution (Pass 2 needs `jsonwebtoken`). Dry-run does NOT need the dep installed.

## Required env (live run)

QA receives these from SEC after JWT mint:

- `KAN44_JWT_ACTIVE`              — verified user, `is_active=true`, future deadline
- `KAN44_JWT_PENDING_FUTURE`      — pending user, future deadline
- `KAN44_JWT_PENDING_PAST`        — pending user, past deadline (Option-B trigger)
- `KAN44_JWT_DEACTIVATED_CRON`    — deactivated user, set by cron path

Already in `.env.local`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `KAN44_JWT_PENDING_EDGE_1` / `KAN44_JWT_PENDING_EDGE_2` — paired with day-boundary sweep (2.1) and concurrent race (2.2)
- `KAN44_USER_ID_PENDING_PAST`    — `public.users.id` for the pending-past user; enables `audit_log` queries in Pass 1 TC-44.3 / 3a
- `KAN44_USER_ID_DEACTIVATED_CRON`
- `SUPABASE_SERVICE_ROLE_KEY`     — enables PostgREST `audit_log` queries directly from the script. Absent → `audit_log` checks skipped and noted in the report; QA runs them via MCP `execute_sql` from their seat instead.

## Dry-run

```
bash run.sh --dry-run
```

Validates env-var schema, contract drift, script syntax, sample report generation, artifacts directory creation. Exits with literal `READY` line on success or `NOT-READY` on failure. Does NOT make any HTTP request, does NOT touch the DB.

## Live run

```
. ../../.env.local
export KAN44_JWT_ACTIVE=...
export KAN44_JWT_PENDING_FUTURE=...
export KAN44_JWT_PENDING_PAST=...
export KAN44_JWT_DEACTIVATED_CRON=...
# optional vars per above
bash run.sh
```

Output lands in `artifacts/<UTC-timestamp>/`:

- `report.md` — top-level QA report, ≤60 lines, format per SM packet
- `tc-44-N/` — per-TC directory with `body.json`, `headers.txt`, `meta.json`, `audit_log.json` (when applicable)
- `pass2-results.json` — adversarial subtest results

## Reading the report

Each TC line shows status, round-trip, and any case-specific extras (days_remaining, audit_row presence, byte-identical claim). Verdict line at the bottom is `PASS` only when all formal TCs and all adversarial subtests pass; `SKIPPED` and `STUB` subtests are not failures but are flagged for follow-up.

## Drift guard

`derive-contract.mjs --check` compares `contract.json` against `types/auth.ts` (the FE-signed canonical source per KAN-44 comment 10292 + SM 10854/10887). Run on every dry-run to catch silent contract changes.

## Constraints

- Function code (`supabase/functions/auth-status-check/`) is locked at commit `15755b4`. Harness does not modify it.
- Schema is locked. Harness does not migrate.
- Deploy is locked. Harness does not deploy.
- Done is locked to Ife (transition ID 51). Harness does not transition.
