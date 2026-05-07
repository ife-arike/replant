#!/usr/bin/env bash
# Pass 1 — Formal TC re-run for KAN-44 (TC-44.1 through TC-44.7 + TC-44.3a).
# Per QA's design (escalation 10932). One artifact per TC: status + headers + body
# + audit_log dump + round-trip ms + UTC timestamp.
#
# Usage:
#   bash pass1.sh <artifacts_dir>
#
# Required env:
#   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
#   KAN44_JWT_ACTIVE, KAN44_JWT_PENDING_FUTURE, KAN44_JWT_PENDING_PAST,
#   KAN44_JWT_DEACTIVATED_CRON
# Optional:
#   SUPABASE_SERVICE_ROLE_KEY (enables audit_log queries via PostgREST;
#   absent → audit_log assertions are skipped and noted in report)
#
# This script does NOT execute in dry-run mode. run.sh --dry-run skips invoking
# pass1; the orchestrator only validates that this file is present and shellcheck-
# clean.

set -uo pipefail
set +e

ARTIFACTS_DIR="${1:-}"
if [ -z "$ARTIFACTS_DIR" ]; then
  echo "ERROR: artifacts dir required as \$1" >&2
  exit 2
fi
mkdir -p "$ARTIFACTS_DIR"

URL="${EXPO_PUBLIC_SUPABASE_URL:?missing}"
ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:?missing}"
FN="$URL/functions/v1/auth-status-check"
SERVICE_ROLE="${SUPABASE_SERVICE_ROLE_KEY:-}"

call_fn() {
  local label="$1" jwt="$2" out_dir="$3"
  local body_file="$out_dir/body.json"
  local headers_file="$out_dir/headers.txt"
  local meta_file="$out_dir/meta.json"
  mkdir -p "$out_dir"

  local started_at
  started_at="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"

  local status rt
  read -r status rt < <(
    curl -sS -X POST "$FN" \
      -H "Authorization: Bearer $jwt" \
      -H "apikey: $ANON_KEY" \
      -H "Content-Type: application/json" \
      -D "$headers_file" \
      -o "$body_file" \
      -w '%{http_code} %{time_total}\n'
  )

  cat > "$meta_file" <<EOF
{
  "label": "$label",
  "started_at": "$started_at",
  "status": $status,
  "round_trip_seconds": $rt,
  "function": "$FN"
}
EOF
  echo "  → $label: status=$status rt=${rt}s body=$body_file"
}

audit_log_for_user() {
  local user_id="$1" out_file="$2"
  if [ -z "$SERVICE_ROLE" ]; then
    echo '{"$skipped":"SUPABASE_SERVICE_ROLE_KEY not set; audit_log query skipped"}' > "$out_file"
    return
  fi
  curl -sS "$URL/rest/v1/audit_log?select=*&meta->>user_id=eq.$user_id&order=accessed_at.asc" \
    -H "apikey: $SERVICE_ROLE" \
    -H "Authorization: Bearer $SERVICE_ROLE" \
    > "$out_file"
}

JWT_ACTIVE="${KAN44_JWT_ACTIVE:?missing}"
JWT_PF="${KAN44_JWT_PENDING_FUTURE:?missing}"
JWT_PP="${KAN44_JWT_PENDING_PAST:?missing}"
JWT_CRON="${KAN44_JWT_DEACTIVATED_CRON:?missing}"

# QA supplies the public.users.id values for the staged seed via env so audit_log
# queries can target them. If unset, audit assertions are skipped per case.
USER_ID_PP="${KAN44_USER_ID_PENDING_PAST:-}"
USER_ID_CRON="${KAN44_USER_ID_DEACTIVATED_CRON:-}"

echo "Pass 1 — formal TC re-run"
echo "  Artifacts: $ARTIFACTS_DIR"
echo "  Function:  $FN"
echo "  Started:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"

call_fn "TC-44.1 active"             "$JWT_ACTIVE" "$ARTIFACTS_DIR/tc-44-1"
call_fn "TC-44.2 pending+future"     "$JWT_PF"     "$ARTIFACTS_DIR/tc-44-2"

call_fn "TC-44.3 pending+past Opt-B" "$JWT_PP"     "$ARTIFACTS_DIR/tc-44-3"
[ -n "$USER_ID_PP" ] && audit_log_for_user "$USER_ID_PP" "$ARTIFACTS_DIR/tc-44-3/audit_log.json"

call_fn "TC-44.3a idempotency"       "$JWT_PP"     "$ARTIFACTS_DIR/tc-44-3a"
[ -n "$USER_ID_PP" ] && audit_log_for_user "$USER_ID_PP" "$ARTIFACTS_DIR/tc-44-3a/audit_log.json"

call_fn "TC-44.4 cron-deactivated"   "$JWT_CRON"   "$ARTIFACTS_DIR/tc-44-4"
[ -n "$USER_ID_CRON" ] && audit_log_for_user "$USER_ID_CRON" "$ARTIFACTS_DIR/tc-44-4/audit_log.json"

# TC-44.5 — 401 paths
call_fn "TC-44.5a no-jwt"     ""                              "$ARTIFACTS_DIR/tc-44-5a"
call_fn "TC-44.5b anon-jwt"   "$ANON_KEY"                     "$ARTIFACTS_DIR/tc-44-5b"
call_fn "TC-44.5c malformed"  "garbage-not-a-jwt"             "$ARTIFACTS_DIR/tc-44-5c"

# TC-44.6 — 5xx is synthetic-only and out-of-scope for live without temp triggers.
# Marked SKIPPED-LIVE in the report; covered by handler.test.ts:283-340.
echo "  → TC-44.6 5xx: SKIPPED-LIVE (covered by unit tests handler.test.ts:283-340)"
mkdir -p "$ARTIFACTS_DIR/tc-44-6"
echo '{"status":"SKIPPED-LIVE","reason":"5xx requires temp trigger; covered by unit tests handler.test.ts:283-340"}' \
  > "$ARTIFACTS_DIR/tc-44-6/meta.json"

# TC-44.7 — non-leak: byte-compare TC-44.3 body and TC-44.4 body
echo "  → TC-44.7 non-leak: comparing TC-44.3 vs TC-44.4 body bytes"
mkdir -p "$ARTIFACTS_DIR/tc-44-7"
if cmp -s "$ARTIFACTS_DIR/tc-44-3/body.json" "$ARTIFACTS_DIR/tc-44-4/body.json"; then
  echo '{"status":"PASS","note":"TC-44.3 and TC-44.4 bodies are byte-identical"}' \
    > "$ARTIFACTS_DIR/tc-44-7/meta.json"
else
  echo '{"status":"FAIL","note":"TC-44.3 and TC-44.4 bodies differ — path-revealing field leak"}' \
    > "$ARTIFACTS_DIR/tc-44-7/meta.json"
fi

echo "  Finished:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
