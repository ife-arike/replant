# Replant Edge-Function Security Audit — Pre-UAT

**Lane:** Backend edge functions (`supabase/functions/`) — message-send, signup, underground-join.
**Posture:** READ-ONLY audit. No code/DB/Jira/git mutations. Live edge config read via Supabase MCP (`list_edge_functions`).
**Project ref:** `jiyetphxxvyiicrnwlnx`.
**Date:** 2026-07-01. **Real leaders live since 2026-06-28.** Life-safety review.

Auditor stance: a backend gap here can expose a persecuted leader's identity, words, or location. Findings are graded P0 (life-safety / identity-exposing), P1 (serious), P2 (moderate), P3 (minor).

---

## Lane verdict

**READY for UAT after two P1 fixes; no P0.** The identity-critical, life-safety paths — DELIVER-ALWAYS (both send paths), underground exclusion (403-before-parse), rag-red forcing, generic UG errors, constant-time compares, one-shot reveal, comp-delete orphan prevention, heartcry encryption + never-logged, secrets-from-Vault/env, no-plaintext-logging — are all **correctly implemented and defended in depth** on every path inspected. **No P0.** The two P1s are (1) a get-nearby-churches config/IaC drift (prod correct, local wrong — an auth-removal footgun on redeploy) and (2) four of five anon RPCs fail-OPEN on Upstash outage, contradicting the locked "fail-CLOSED on all anon RPCs" invariant (the most life-safety-critical anon path, underground-join, is correctly fail-closed). Neither is a live identity-exposure today; both should be reconciled before UAT sign-off. Remaining items are defense-in-depth polish (CORS scoping) and test-coverage gaps.

---

## verify_jwt — live vs local config.toml

Live values pulled from `list_edge_functions` (source of truth) vs local `config.toml` uncommented `verify_jwt =` line:

| Function | Live (deployed) | Local config.toml | Match? |
|---|---|---|---|
| auth-status-check | true | (no config.toml; platform) | expected true ✓ |
| submit-heartcry | true | (no config.toml) | expected true ✓ |
| send-message | true | `:27 = true` | ✓ |
| admin-open-heartcry | true | `:7 = true` | ✓ |
| register-church | **false** | `:24 = false` | ✓ (pre-auth) |
| check-email-available | **false** | `:26 = false` | ✓ (pre-auth) |
| search-churches | **false** | `:24 = false` | ✓ (pre-auth) |
| create-account | **false** | `:47 = false` | ✓ (pre-auth) |
| get-nearby-churches | **true** | `:26 = false` | ✗ **DRIFT — see P1-1** |
| update-church | true | `:21 = true` | ✓ |
| send-branch-message | true | `:20 = true` | ✓ |
| accept-connection-request | true | (no config.toml) | expected true ✓ |
| register-church-delete | **false** | `:33 = false` | ✓ (pre-auth) |
| reveal-join-code | true | `:19 = true` | ✓ |
| join-underground-church | **false** | `:30 = false` | ✓ (pre-auth) |

All pre-auth signup functions are correctly `false`; all post-auth are `true`. **Only get-nearby-churches drifts.**

---

## FINDINGS

### P1-1 — get-nearby-churches config.toml drift (live=true, local=false)

**Severity:** P1 (serious — latent auth-removal footgun, not a live exploit).
**Evidence:**
- Live: `list_edge_functions` → `get-nearby-churches … "verify_jwt":true`.
- Local: `/Users/ife/replant/supabase/functions/get-nearby-churches/config.toml:26` → `verify_jwt = false`.
- The file's own header comment (`get-nearby-churches/config.toml`) frames `false` as "the PLATFORM default for Supabase edge functions" — i.e. the local file intends false.

**Impact:** get-nearby-churches is an **authenticated GPS endpoint** — it takes a viewer's live lat/lng and returns nearby churches. Production is correctly `true` (auth required). But local IaC says `false`. If anyone redeploys this function through a path that honors `config.toml` (e.g. a CLI deploy that reads the per-function config), the gate flips to `false` and the endpoint becomes **anonymous** — an unauthenticated caller could submit arbitrary GPS and probe the church graph, and the underground-403-before-parse guard (which depends on resolving the caller's `users` row from a JWT) would have no JWT to resolve. The current safety rests entirely on the live setting having been set manually and never being clobbered by a redeploy.

**Recommendation:** Reconcile local to match production intent: set `get-nearby-churches/config.toml:26` to `verify_jwt = true` and redeploy so IaC == live. Until then, treat any get-nearby-churches redeploy as requiring an explicit post-deploy verification that live verify_jwt is still true. (Note the known Supabase CLI quirk where `config.toml` is ignored and `--no-verify-jwt` must be passed explicitly — that quirk is what has kept prod correct so far, but it is not a guarantee.)

---

### P1-2 — Four of five anon (pre-auth) RPCs fail OPEN on Upstash outage — contradicts the locked "fail-CLOSED on all anon RPCs" invariant

**Severity:** P1 (systematic contradiction of a locked SEC invariant; enumeration/abuse surface, not direct identity exposure).
**Evidence (all four confirmed by direct read of the `catch` return):**
- `create-account/index.ts:305` (per-IP-per-email) and `:324` (per-IP-only) → `return { allowed: true, count: 0 }`. Also `:293`/`:312` return allowed when Upstash env absent.
- `check-email-available/index.ts:142` (catch) and `:119` (env absent) → `{ allowed: true, count: 0 }`.
- `register-church/index.ts:106` (catch) and `:92` (env absent) → `{ allowed: true, count: 0 }`.
- `register-church-delete/index.ts:190` (catch) and `:169` (env absent) → `{ allowed: true, count: 0 }`.

Each carries a "fail-open per SEC posture" comment. **The only anon RPC that fails CLOSED is `join-underground-church`** (`index.ts:298-311`, in-memory token bucket).

**Impact:** The locked universal invariant is *"Rate-limit fail-CLOSED on all anon RPCs, with in-memory token-bucket fallback per worker on Upstash error."* In practice it is honored by **exactly one** of the five anon RPCs. During an Upstash outage the other four lose all per-IP throttling:
- `check-email-available` → **unbounded email enumeration**. On a persecuted-leader platform this is the sharpest edge: an attacker can confirm whether a specific person's email is registered with Replant (a membership oracle). This is the one fail-open with a real identity-adjacent threat model.
- `create-account` → unbounded signup/auth-user creation (bounded downstream by `create_account_atomic` uniqueness + idempotency, but the `auth.admin.createUser` calls still fire).
- `register-church` → validation-only (no write); abuse is compute/DoS only.
- `register-church-delete` → unbounded probing of the bypass-delete flow.

The **most life-safety-critical** anon path (underground join-code brute force) is correctly fail-closed, which is why this is P1 and not P0 — but the invariant as written is not met, and the fail-closed fallback pattern is **already written** in join-underground-church, so the fix is a known-good copy.

**Recommendation:** Apply the join-underground-church in-memory-token-bucket fallback to all four fail-open anon limiters (prioritize `check-email-available` for the enumeration-oracle reason, then `create-account`). If the fail-open posture is a deliberate, Founder-ratified availability trade-off for the lower-stakes ones (register-church validation), then the *invariant statement* should be narrowed to match reality (e.g. "fail-closed on join-underground-church and create-account; fail-open acceptable on read/validation anon RPCs") so the locked ruling and the code agree. Either way, code and invariant must be reconciled before UAT sign-off. **Founder ruling required** to change security posture.

_(Sub-audit note: the parallel post-auth pass graded check-email-available and register-church-delete as separate P2s, asserted register-church fails CLOSED, and did not cover create-account. Direct re-verification shows all four fail OPEN — consolidated here as one P1.)_

---

### P3-1 — get-nearby-churches rate-limit fails OPEN

**Severity:** P3 (documented, lower-stakes).
**Evidence:** `/Users/ife/replant/supabase/functions/get-nearby-churches/index.ts:127` (`if (!url || !token) return { allowed: true }; // fail-open`) and `:144` (catch → `allowed:true`). The function header (`:23`) documents "fail-open if Upstash unreachable" as the locked SEC posture.

**Impact:** Lower stakes than P2-1 — this is an **authenticated read** of already-masked public church data (name omitted for unverified callers, underground excluded before parse). Fail-open here only relaxes the 30/hr enumeration brake on data that is already access-controlled and masked. It is NOT an "anon RPC" (verify_jwt=true), so the "fail-closed on anon RPCs" rule does not strictly apply.

**Recommendation:** Accept as-is for MVP (matches locked posture), OR add the in-memory-bucket fallback for consistency with the write paths. No action required for UAT.

---

### P3-2 — Identity-critical functions have zero automated tests

**Severity:** P3 (coverage gap; deep test-gap analysis is a separate lane — presence-only noted here).
**Evidence:** `find … -name '*.test.ts'` per function:
- **NONE:** `join-underground-church`, `reveal-join-code`, `get-nearby-churches`, `admin-open-heartcry`, `accept-connection-request`.
- Present: auth-status-check(2), check-email-available(2), create-account(2), register-church(2), register-church-delete(2), search-churches(2), send-message(5), send-branch-message(1), submit-heartcry(1), update-church(1).

**Impact:** The two newest and most identity-sensitive functions — `join-underground-church` (constant-time compare, cap-of-2, comp-delete, fail-closed rate limit) and `reveal-join-code` (one-shot plaintext reveal, tombstone-only cache) — have **no unit tests**. Their logic is correct on inspection, but regressions to the fail-closed / one-shot / generic-error invariants would ship silently. get-nearby-churches (the UG-403-before-parse guard) also has no test pinning that ordering.

**Recommendation:** Route to the test-coverage lane. Prioritize: (1) reveal one-shot + tombstone-not-plaintext; (2) join fail-closed rate limit + cap-of-2 + generic-error-on-all-failure; (3) get-nearby-churches 403-before-body-parse for underground caller.

---

## WHAT WORKS WELL (specific, verified protections)

1. **DELIVER-ALWAYS is airtight in BOTH send paths, at the SQL layer.**
   - `send-message/index.ts:472-490` and `send-branch-message/index.ts:135-155`: the `messages` INSERT writes `flagged` / `flag_reason` as plain bound values — **no `WHERE flagged`, no branch, no early-return**. `flagged` is computed purely from keyword matches in the handler and never gates the INSERT, the 200, or Realtime (which fires on commit).
   - `send-message/handler.ts:243` and `internal-handler.ts:211`: the `if (flagged)` block runs strictly **after** `sendInTransaction` returns, fires only post-commit moderation_state + pastoral-alert side-effects, and is wrapped in try/catch that **swallows every error** to honor DELIVER-ALWAYS. Taxonomy-unavailable folds to `flagged=false` and still delivers (`taxonomy.ts`).

2. **Underground exclusion is defense-in-depth, and the get-nearby-churches 403 truly precedes body parse.**
   - `get-nearby-churches/index.ts:221-223` returns `caller_underground_no_nearby` **before** `await req.json()` at `:228` and before the rate-limit key is built at `:246`. An underground caller's GPS never enters the parser, the RPC, the Postgres log, or the Upstash key. Own-church inject path has an explicit load-bearing `ownRow.type !== "underground"` guard (`:303`).
   - `search-churches/index.ts:119,138`: every path (including RPL-ID lookup) routes through the `churches_public` view (`is_active AND type <> 'underground'`), so an underground RPL ID yields zero results. ILIKE wildcards are escaped (`escapeLikeWildcards`, `:262`) and input is bound via `.ilike()`, not concatenated — no LIKE-injection.

3. **create-account underground hardening — server never trusts the client.**
   - `create-account/logic.ts:178` forces `rag_status='red'` for underground (ignores FE). `:184,185,191,192` strip city/address/lat/lng to NULL for underground.
   - Generic UG welcome email `index.ts:243-253`: verbatim body, no church name / role / region / country / first name / the word "underground".
   - `handler.ts:496-522`: no connect@ admin email for UG founders; `church_id` suppressed from the routine `account_created` log line (no user↔UG-church binding in telemetry).
   - Comp-delete orphan prevention `handler.ts:377-386`: auth user deleted on RPC failure **only when this call created it** (`created=true`); resume path leaves an existing auth user alone (load-bearing). Idempotency key REQUIRED before any write (`:246-248`).

4. **join-underground-church — the identity gate is textbook.**
   - Rate-limit **fail-CLOSED**: `index.ts:298-311` — Upstash error falls to a per-worker in-memory token bucket (`inMemRateCheck`), never returns `allowed:true`; even the no-env case (`:283-291`) fails closed.
   - Constant-time bcrypt compare is delegated to `redeem_underground_join_code` RPC called via a **user-scoped** client (`index.ts:218-228`) — the plaintext code is passed to Postgres, never compared in JS.
   - Single generic `invalid_or_consumed_code` on every redemption failure (`handler.ts:277`), with the ratified `email_already_registered` (409) override scoped to a strict email-collision regex (`:194-204`); all other createUser failures fold to generic (enumeration defense).
   - Cap-of-2 enforced **before attach**: `handler.ts:306` `activeCount + 1 > 2` → full comp-delete of both rows. Every failure branch (steps 6-10) comp-deletes public.users + auth.users.
   - Defensive log scrub drops any `code`/`plaintext`/`join_code` field as a backstop (`index.ts:322-338`).

5. **reveal-join-code — one-shot, tombstone-only, no plaintext anywhere.**
   - One-shot: `index.ts:184-186` (410 if `revealed_at` set) plus RPC `already_revealed` → 410 (`:218-219`). Founding-leader double-gated (pre-check `:188-203` + RPC internal).
   - Tombstone-only cache: `index.ts:248-254` caches `{ revealed: true }`, never the plaintext (explicit comment). Response carries `Cache-Control: no-store`, `Pragma: no-cache` (`:271-273`). Plaintext never logged (scrub fn + `reveal_success` omits church_id).

6. **submit-heartcry — the leader's plaintext never rests in the clear and never hits a log.**
   - `index.ts:141-151`: `encrypt_heartcry_content(plaintext, key)` RPC; only the ciphertext writes (`:163`). Triage email body is **static** (`:192-198`) — no church/leader name, no content, no severity, no preview (D-26 / G-24 lock).
   - Forged-body defense `:153-167`: `insertHeartcry` omits `feed_approved`/`status`/`id` so a client body can never self-approve to the public feed. Boot-time 5xx if triage lead can't resolve (`:72-76`) prevents orphan heartcries. Heartcry commits before email; email failure swallowed (store-always).

7. **send-message /internal system-DM path — constant-time token auth.**
   - `internal-auth.ts:25-35`: byte-wise XOR constant-time compare against a Vault-stored 64-char-hex token, plus a sentinel header, timing-equalized, single 401 for either failure (no oracle). Token rides on `X-Internal-Token` (not Authorization) so the platform verify_jwt gate still applies.

8. **Secrets hygiene across the board.**
   - Every key comes from `Deno.env.get(...)` or a `get_*` SECURITY DEFINER RPC (`get_resend_api_key`, `get_heartcry_encryption_key`); **zero hardcoded** service-role keys, JWTs (`eyJ…`), or `sb_secret_*` literals (grep clean). No committed `.env` files under `supabase/`.
   - All outbound `fetch()` hosts are **hardcoded constants** (`https://api.resend.com/emails`) or **env-derived** (Upstash `${url}` with `encodeURIComponent` on keys). **No user-controlled fetch host anywhere — no SSRF surface.**
   - 500 handlers return **static strings** (`"Send failed"`, `INTERNAL_ERROR`) — no `err.message`, stack, SQLSTATE, or table names leaked to the client. `create-account` maps PG ERRCODEs to controlled API codes; the one place `message` is surfaced (`handler.ts:187`, P0004-P0008) carries developer-authored PL/pgSQL RAISE strings, and the CHECK/unknown paths return generic text.
   - Auth defense-in-depth: post-auth handlers re-reject `role==='anon'` at the function layer (e.g. `send-message/handler.ts:121`, `reveal-join-code/index.ts:115`), not relying on the gateway alone.

9. **CORS posture is correct per surface.** Only the two browser-reachable functions set CORS: `admin-open-heartcry/index.ts:84` and `get-nearby-churches/index.ts:35`, both `*`. Wildcard is acceptable here because auth is enforced by JWT (not by Origin) and no credentialed cookies are used — but see the note below. The mobile-only functions (send-message, send-branch-message, submit-heartcry, signup fns) set **no CORS / no OPTIONS**, which is correct — `replant://` native fetch has no browser preflight.

**Note on CORS `*` (observational, not a finding):** `admin-open-heartcry` is the admin-dashboard (browser) path; `Access-Control-Allow-Origin: *` is safe today because the endpoint authenticates via Bearer JWT and does not rely on cookie credentials (wildcard + credentials is the dangerous combo, and that combo is absent). If the admin dashboard ever moves to cookie-based auth, tighten to the admin origin. No action for UAT.

---

## PER-FUNCTION VERDICT

| Function | verify_jwt OK | Verdict | Notes |
|---|---|---|---|
| send-message | ✓ true | **READY** | DELIVER-ALWAYS airtight (ext + internal); constant-time internal token; anon re-reject. |
| send-branch-message | ✓ true | **READY** | DELIVER-ALWAYS airtight at SQL layer. |
| submit-heartcry | ✓ true | **READY** | Plaintext encrypted via RPC; never logged; static triage email; forged-body defense. |
| create-account | ✓ false | **NEEDS-FIX (P1-2)** | rag-red force, UG strip, idempotency-required, comp-delete all ✓; **rate-limit fails OPEN**. |
| join-underground-church | ✓ false | **READY** | Fail-closed RL, constant-time redeem, cap-of-2, comp-delete, generic errors — all ✓. |
| reveal-join-code | ✓ true | **READY** | One-shot, tombstone-only, no-store, no plaintext logging ✓. |
| get-nearby-churches | live true / local false | **NEEDS-FIX (P1-1)** | Runtime behavior correct (403-before-parse, own-church guard); config.toml drift must be reconciled. |
| search-churches | ✓ false | **READY** | churches_public UG exclusion on all paths; ILIKE escaped. |
| auth-status-check | ✓ true | **READY** | GET-only; anon re-reject `handler.ts:87`; no PII in logs; no fetch. |
| admin-open-heartcry | ✓ true | **READY** | `super_admin===true` (gateway-verified claim) + AAL2/TOTP 5-min freshness gate; SAFE-LOG; CORS `*` (P3). |
| update-church | ✓ true | **READY** | Server-side ownership ACL before UPDATE (service-role bypasses RLS — correctly enforced in-fn); UG coercion. |
| accept-connection-request | ✓ true | **READY** | anon re-reject `:119-125`; UUID-validated; SAFE-LOG (no content); status-guard prevents re-accept. |
| check-email-available | ✓ false | **NEEDS-FIX (P1-2)** | Email validated; no email in logs; **rate-limit fails OPEN** (enumeration oracle). |
| register-church | ✓ false | **NEEDS-FIX (P1-2)** | Validation-only (no write); UG coercion; **rate-limit fails OPEN** (lower stakes — compute only). |
| register-church-delete | ✓ false | **NEEDS-FIX (P1-2)** | UUID+email validated; **rate-limit fails OPEN**; SQLSTATE logged internally (not client-exposed) (P3). |

---

## APPENDIX — Post-auth + pre-auth-secondary functions (verified)

Covers the 8 functions not walked line-by-line in the body. Reconciled against direct re-verification of the rate-limit `catch` blocks (which corrected the fail-open count — see P1-2).

**auth-status-check** (`handler.ts`, `logic.ts`): verify_jwt=true + handler re-rejects `role==='anon'` (`handler.ts:87`). GET-only, no request body → no injection surface. Logs only `user_id`/`resend_ok` (no PII). Static error strings. No outbound fetch. **READY.**

**submit-heartcry** — re-confirmed in body (finding #6, What-Works-Well). anon re-reject `handler.ts:93`; verified-only `:108`; plaintext encrypted via `encrypt_heartcry_content` RPC before insert; static triage email; no content/severity/church_id in any log. **READY.**

**admin-open-heartcry** (`index.ts`): The forged-super_admin defense — gateway (verify_jwt=true) validates the JWT **signature** before the handler runs; the handler then checks `claims.super_admin === true` (`:160`) and rejects `role==='anon'` (`:146-153`). Because the `super_admin` claim is re-derived from the `users` column on every token mint (per the column-authoritative ruling), trusting the signed claim here is correct. **Plus** an AAL2/TOTP freshness gate (`:174-209`) requiring a recent TOTP factor within a 5-minute window — matches the LOCKED 4-tier MFA freshness (sensitive-destructive = 5min). SAFE-LOG: only `operation_id` + event, never heartcry content/church/leader. Generic 5xx. No outbound fetch (RPC only). **CORS `Access-Control-Allow-Origin: *`** (`:84`) — see P3-3. **READY.**

**update-church** (`handler.ts`, `logic.ts`): Server-side **ownership ACL** enforced before any UPDATE (`handler.ts:86` `checkOwnership(user.id, church_id)` → `users.auth_id=uid AND church_id=? AND is_active`); the code explicitly notes service-role bypasses RLS so ownership MUST be enforced in-function — and it is. Comprehensive field validation (`logic.ts:166-346`), including forcing city/lat/lng NULL when type='underground' (`:313-343`). Logs church_id/type only. Static errors. No fetch. **READY.**

**accept-connection-request** (`index.ts`): anon re-reject (`:119-125`); `request_id` UUID-validated (`:136-138`); caller resolved to `public.users.id` and checked against `recipient_id`; status-guard rejects non-pending re-accepts (`:173-174`). Message content read from DB, never from body. SAFE-LOG (no content, only request_id/conversation_id/flagged). DELIVER-ALWAYS mirrored on the seed-message moderation_state insert (non-blocking). Static errors. No fetch. **READY.**

**check-email-available** (`handler.ts`, `logic.ts`): pre-auth read (verify_jwt=false, correct). Email validated (non-empty, ≤320, `EMAIL_RE`) `logic.ts:40-61`. Logs only `ip_hash` (djb2), never the email. Static errors. Upstash fetch host from env. **Rate-limit fails OPEN → P1-2** (the enumeration-oracle case). **NEEDS-FIX (P1-2).**

**register-church** (`handler.ts`, `logic.ts`): pre-auth **validation-only** (no DB write; invokes `find_similar_churches` RPC read). Full church-payload validation (`logic.ts:94-189`) with UG coercion (city/lat/lng→NULL). Logs `country_hash`/`name_length`/`type` only — no contact details. Idempotency N/A (no write). **Rate-limit fails OPEN → P1-2** (lowest stakes of the four — compute/DoS only, no write, no enumeration oracle). **NEEDS-FIX (P1-2).**

**register-church-delete** (`handler.ts`, `logic.ts`): pre-auth (verify_jwt=false). `churchId` UUID-validated + `contactEmail` normalized/validated (`logic.ts:57-69`). Logs `ip_hash`/`rate_count` only. **P3-3b:** internal error path throws with `delErr.code` (SQLSTATE, e.g. 23503) — but this is **logged only**, never returned to the client (client still gets generic `error500()`); acceptable, minor. Idempotency N/A (DELETE naturally idempotent). **Rate-limit fails OPEN → P1-2.** **NEEDS-FIX (P1-2).**

---

### P3-3 — admin-open-heartcry CORS is wildcard `*`

**Severity:** P3 (mitigated by JWT + AAL2; no credentialed-cookie combo).
**Evidence:** `/Users/ife/replant/supabase/functions/admin-open-heartcry/index.ts:84` → `"Access-Control-Allow-Origin": "*"`.
**Impact:** admin-open-heartcry is the admin-dashboard (browser) path that opens a heartcry (decrypts leader plaintext for an admin). Wildcard CORS is safe today because the endpoint authenticates via Bearer JWT **and** an AAL2/TOTP freshness gate, and does not use cookie credentials (wildcard-plus-credentials is the dangerous combo, and it is absent). But `*` is broader than necessary for a decryption endpoint.
**Recommendation:** Scope `Access-Control-Allow-Origin` to the admin origin (`https://admin.projectreplant.org`) as defense-in-depth. Not blocking for UAT. (Same note applies observationally to get-nearby-churches `*`, which returns only masked/public data.)

---

## APPENDIX — Post-auth + pre-auth-secondary functions

<!-- FILLED FROM SUB-AGENT -->
