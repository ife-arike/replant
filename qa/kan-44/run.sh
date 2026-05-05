#!/usr/bin/env bash
# KAN-44 QA harness orchestrator.
#
# Modes:
#   --dry-run   Validates structure (env-var schema, contract.json drift,
#               script presence, sample report generation, artifacts dir).
#               No live HTTP. No SQL. Exit 0 with literal line "READY" on success.
#   (no flag)   Live execution: Pass 1 → Pass 2 → report. Requires all JWTs
#               supplied via env (see README).
#
# This script is the single entry point QA invokes. SM routes to QA after SEC
# mints test JWTs.

set -uo pipefail
set +e

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REQUIRED_RUNTIME_ENV=(
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  KAN44_JWT_ACTIVE
  KAN44_JWT_PENDING_FUTURE
  KAN44_JWT_PENDING_PAST
  KAN44_JWT_DEACTIVATED_CRON
)
OPTIONAL_RUNTIME_ENV=(
  KAN44_JWT_PENDING_EDGE_1
  KAN44_JWT_PENDING_EDGE_2
  KAN44_USER_ID_PENDING_PAST
  KAN44_USER_ID_DEACTIVATED_CRON
  SUPABASE_SERVICE_ROLE_KEY
)

warn=()
err=()

# 1) env schema validation
echo "Step 1/6 — env schema validation"
for v in "${REQUIRED_RUNTIME_ENV[@]}"; do
  if [ -z "${!v:-}" ]; then
    if $DRY_RUN; then
      warn+=("$v unset (required for live run; OK for dry-run)")
    else
      err+=("$v unset (required for live run)")
    fi
  else
    echo "  ✓ $v set"
  fi
done
for v in "${OPTIONAL_RUNTIME_ENV[@]}"; do
  if [ -z "${!v:-}" ]; then
    warn+=("$v unset (optional; subtests requiring it will skip and note in report)")
  else
    echo "  ✓ $v set (optional)"
  fi
done

# 2) script presence + parse-clean
echo "Step 2/6 — script presence and parse-clean check"
for f in pass1.sh; do
  if ! [ -f "$SCRIPT_DIR/$f" ]; then err+=("$f missing"); continue; fi
  if ! bash -n "$SCRIPT_DIR/$f" 2>/dev/null; then err+=("$f has bash syntax errors"); continue; fi
  echo "  ✓ $f present and bash-parses"
done
for f in pass2_adversarial.mjs derive-contract.mjs generate-report.mjs audit-fixture-data.mjs; do
  if ! [ -f "$SCRIPT_DIR/$f" ]; then err+=("$f missing"); continue; fi
  if ! node --check "$SCRIPT_DIR/$f" 2>/dev/null; then err+=("$f has node syntax errors"); continue; fi
  echo "  ✓ $f present and node-parses"
done
for f in contract.json package.json README.md; do
  if ! [ -f "$SCRIPT_DIR/$f" ]; then err+=("$f missing"); continue; fi
  echo "  ✓ $f present"
done

# 3) contract.json derivation drift check
echo "Step 3/6 — contract.json drift check against types/auth.ts"
if ! node "$SCRIPT_DIR/derive-contract.mjs" --check; then
  err+=("contract.json drift detected — run 'node qa/kan-44/derive-contract.mjs --check' for detail")
fi

# 4) fixture-data audit (per SEC 10933) — runs when SUPABASE_SERVICE_ROLE_KEY is set;
#    SKIPPED with note otherwise. Non-zero exit = HOLD for SEC + Ife.
echo "Step 4/6 — fixture-data audit"
TS_PRE="$(date -u +%Y%m%dT%H%M%SZ)"
if $DRY_RUN; then
  AUDIT_OUT="$SCRIPT_DIR/artifacts/dryrun-$TS_PRE"
else
  AUDIT_OUT="$SCRIPT_DIR/artifacts/$TS_PRE"
fi
mkdir -p "$AUDIT_OUT"
if ! node "$SCRIPT_DIR/audit-fixture-data.mjs" "$AUDIT_OUT"; then
  if $DRY_RUN; then
    warn+=("fixture-data audit reported HOLD — see $AUDIT_OUT/audit-fixture-data.json. Live execution must wait for SEC + Ife clearance.")
  else
    err+=("fixture-data audit reported HOLD — see $AUDIT_OUT/audit-fixture-data.json. HALT per SEC 10933.")
  fi
fi

# 5) artifacts directory and timestamped subdir
echo "Step 5/6 — artifacts directory"
ARTIFACTS_DIR="$AUDIT_OUT"
echo "  ✓ using $ARTIFACTS_DIR"

# 6) sample / live report generation
echo "Step 6/6 — report generation"
if $DRY_RUN; then
  if ! node "$SCRIPT_DIR/generate-report.mjs" --sample --out "$ARTIFACTS_DIR/report.md"; then
    err+=("sample report generation failed")
  else
    echo "  ✓ sample report → $ARTIFACTS_DIR/report.md"
  fi
fi

# Summarize
if [ "${#err[@]}" -gt 0 ]; then
  echo ""
  echo "ERRORS:"
  for e in "${err[@]}"; do echo "  ✗ $e"; done
  echo ""
  echo "NOT-READY"
  exit 1
fi

if [ "${#warn[@]}" -gt 0 ]; then
  echo ""
  echo "WARNINGS:"
  for w in "${warn[@]}"; do echo "  ⚠ $w"; done
fi

if $DRY_RUN; then
  echo ""
  echo "READY"
  exit 0
fi

# Live path
echo ""
echo "Step 6 — Pass 1 (formal TCs)"
bash "$SCRIPT_DIR/pass1.sh" "$ARTIFACTS_DIR" || err+=("pass1 reported errors")

echo ""
echo "Step 7 — Pass 2 (adversarial)"
node "$SCRIPT_DIR/pass2_adversarial.mjs" "$ARTIFACTS_DIR" || err+=("pass2 reported errors")

echo ""
echo "Step 8 — populated report"
node "$SCRIPT_DIR/generate-report.mjs" --artifacts "$ARTIFACTS_DIR" --out "$ARTIFACTS_DIR/report.md" \
  || err+=("report generation failed")

if [ "${#err[@]}" -gt 0 ]; then
  for e in "${err[@]}"; do echo "  ✗ $e"; done
  exit 1
fi
echo ""
echo "Run complete: $ARTIFACTS_DIR/report.md"
