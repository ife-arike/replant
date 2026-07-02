# Wave-1 Security Follow-ups — NEEDS-VERIFICATION closeout

**Auditor role:** Senior AppSec (pre-UAT). **Posture:** READ-ONLY. **Date:** 2026-07-01.
**Repos:** `/Users/ife/replant` (mobile), `/Users/ife/replant-admin` (dashboard), `/Users/ife/replant-website` (marketing).
**Scope:** close the 6 open items from the Wave-1 audit. Each item below is resolved to SAFE or GAP+severity with file:line / command evidence.

Severity key: P0 exploitable-now / P1 high / P2 hardening / P3 low.

---

## 1. Password-reset flow — SAFE (admin) + SAFE (mobile), 1x P3 note

Two independent reset surfaces exist. Both verified sound.

### 1a. Admin-initiated reset (super_admin resets a team member) — SAFE
`replant-admin/netlify/functions/send-password-reset.js` (KAN-167).
- **Audit-FIRST confirmed.** The `admin_password_reset_sent` audit row is written at **L195–210, BEFORE** `generateLink` (L217) and the Resend send (L233). On audit-write failure it returns 500 with the reset NOT sent (L209). Denial path also writes a `failure_reason:'rate_limit_exceeded'` audit row before the 429 (L143–154). Meets "audit-first" AC.
- **Single-use / expiring token:** delegated to Supabase GoTrue `generateLink({type:'recovery'})` (L217–222) — GoTrue recovery tokens are server-side single-use + TTL-bounded. Correct; not re-implemented client-side.
- **Rate-limited:** 60/min per admin via Upstash fixed-window, bucketed on `actor.auth_id` (L101–104, L133–172).
- **Not an enumeration oracle:** this endpoint is gated by `verifySuperAdmin` (L111) + Founder guard (L118) + `can_manage_admins` claim (L129). It is not public/self-service; only vetted admins can call it. `USER_NOT_FOUND` (404, L182) is only reachable *after* passing all three gates, so it is not a public probe.
- **No detail leak on 500:** all internal failures collapse to generic `RESET_FAILED` (L209/225/238/251); only verifier 401/403 pass through (L248–250).
- Redirect pinned to prod `ADMIN_SITE_URL` / `https://admin.projectreplant.org/set-password` (L62–63) — never localhost.

### 1b. Mobile self-service reset (leader "Forgot password?") — SAFE (anti-enumeration holds)
`replant/src/screens/onboarding/ForgotPasswordScreen.tsx` (KAN-38).
- **No enumeration oracle.** `handleSubmit` sets the success view in the `finally` block (L91–95) **regardless** of the `resetPasswordForEmail` outcome. Success copy is unconditional: *"If an account exists for that address, a reset link is on its way"* (L48). Errors (unknown email, rate-limit, network) are swallowed to `console.warn` only (L86, L90). Existing vs non-existing email produce **byte-identical** UI. This is the correct pattern; Supabase's `resetPasswordForEmail` is itself non-enumerating.
- Recovery completion at `SetNewPasswordScreen.tsx` runs `supabase.auth.updateUser({ password })` (L112) on the `PASSWORD_RECOVERY` session Supabase establishes from the `replant://reset-password` deep-link token — the recovery token is the auth gate.
- **P3 note (not a gap):** there is no leader-facing rate-limit signal on the mobile form (deliberate, for anti-enumeration). Supabase's own per-address email throttle is the backstop. Acceptable; flag only so it is a conscious decision.

**Verdict: SAFE. Item closed.**

---

## 2. Committed secrets / repo history — SAFE (no secret ever committed)

- **Only `.env.example` was ever committed**, in all three repos:
  - `git -C <repo> log --all --diff-filter=A -- '*.env*'` returns exactly one add per repo, all `.env.example` (mobile 5f6cfb4, admin 92ce72c; website: none).
  - `git ls-files | grep .env` → `.env.example` only (mobile, admin); website: none tracked.
- **Real env files hold live secrets but are all gitignored & on-disk-only:**
  - `replant-admin/.env` → `JWT_SECRET` (gitignored ✓; **NOT** `VITE_`-prefixed, so it is never inlined into the browser bundle — confirms the prior finding). No function `console.log`s it.
  - `replant-admin/.env.local` → real `VITE_/SUPABASE_/SERVICE_ROLE` values (gitignored ✓).
  - `replant/.env.local` → real `EXPO_PUBLIC_*` anon values (gitignored ✓).
  - `check-ignore` confirms each is IGNORED.
- **Committed `.env.example` files carry no live secrets** — placeholders only (`your_service_role_key_here`, etc.). Admin example does list the prod Supabase URL + project ref `jiyetphxxvyiicrnwlnx` (not a secret; it is public and RLS-protected).
- **`.gitleaksignore` is NOT laundering real secrets** — both repos' entries are the Founder / accounts@ `auth.users.id` UUIDs (published in CLAUDE.md + Jira), each with a one-line justification. Legitimate false-positive suppressions.
- **Mobile bundle carries no service-role key:** `grep service_role src/` → none; `src/lib/supabase.ts` inits `createClient` with `EXPO_PUBLIC_SUPABASE_ANON_KEY` only (L67), with a hard SEC comment barring service-role client-side (L26).

### ⚠ GAP — P2 (mobile .gitignore is too narrow)
`replant/.gitignore` ignores only `.env*.local` — it does **NOT** ignore a bare `.env` or `.env.production`:
```
$ git -C /Users/ife/replant check-ignore .env         → NOT ignored
$ git -C /Users/ife/replant check-ignore .env.production → NOT ignored
```
No such file exists today (nothing committed, no bare `.env` on disk), so this is **latent, not live**. But a future `eas env:pull` variant or a hand-created `.env` would be stage-able. **Recommendation:** widen `replant/.gitignore` to `.env` and `.env*` (matching admin's stricter block with a `!.env.example` negation). Website `.gitignore` has no env coverage either — same one-line hardening (it ships no functions, so lower priority).

**Verdict: SAFE (no secret ever committed). One P2 latent-gitignore hardening.**

---

## 3. Public test/staging environment — SAFE (no non-prod env with real data)

- **Single Supabase project** across all code: the only project ref anywhere is `jiyetphxxvyiicrnwlnx.supabase.co`. No second/staging/preview Supabase project referenced in `src`, `netlify/functions`, or website.
- **No `supabase/config.toml`** in either repo (project managed via dashboard) — nothing to leak a staging URL.
- `eas.json` "preview" (L23–25) is an **EAS build profile** (an app-binary channel), not a publicly reachable web environment. Not an exposure.
- Admin `netlify.toml` has no staging/branch-deploy config; the `[dev]` block is localhost-only.
- No password-ungated preview deploy found in configs.

**Verdict: SAFE. Item closed.** (Residual: Netlify auto-generates deploy-preview URLs per PR by default — those inherit the same prod Supabase env + RLS. Confirm in the Netlify dashboard that deploy-preview auto-publishing is off or the previews are unlisted; not verifiable from repo. Tracked as a dashboard-side check, P3.)

---

## 4. Backup / restore posture — GAP, P2 (roadmap; no restore runbook)

- The only ops runbooks in-repo are auth break-glass, not data recovery:
  - `replant/docs/ops/OPS-03-totp-breakglass.md` (TOTP reset)
  - `replant/docs/audits/2026-07-01-P0-1-vault-breakglass-runbook.md` (Vault key break-glass)
- `grep -rilE 'restore|point.?in.?time|pitr|disaster recovery' docs/` returns **no documented restore procedure or drill**. Supabase provides automated daily backups (and PITR on paid tiers) at the platform level, so data *is* being backed up — but there is **no tested restore runbook**, no RPO/RTO statement, and no evidence of a restore drill.
- **Impact:** for a platform protecting persecuted-leader data, an untested restore path means recovery time under a real incident (corruption, accidental mass-delete via a service-role function, ransomware on the ops laptop) is unknown. Break-glass covers auth, not data.
- **Recommendation (roadmap):** author `docs/ops/OPS-XX-restore-runbook.md` — confirm the Supabase backup tier + PITR window, document the restore-to-a-branch-then-promote procedure, state RPO/RTO, and run one restore drill before UAT sign-off. Not a code fix; an ops artifact.

**Verdict: GAP, P2 (documentation/ops).**

---

## 5. XSS spot-check (admin + website) — SAFE (admin), P2 CSP-hardening (website)

### Admin — SAFE, guard is real & CI-enforced
- `grep -rn dangerouslySetInnerHTML src/` → **zero** occurrences (only the guard test names the string).
- `grep -rn innerHTML src/` → **zero**.
- The guard `replant-admin/src/test/no-dangerously-set-inner-html.test.js` runs `git grep -l 'dangerouslySetInnerHTML' -- 'src/' ':!<self>'` in CI (L66–73) and **asserts empty output** — any new usage fails the build. Self-exclusion pathspec is correct. Holds.
- Admin also ships hardening headers via `netlify.toml`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a real **CSP** (`connect-src` locked to `*.supabase.co`/`wss://*.supabase.co`). Strong. (Minor: `script-src` includes `'unsafe-inline'` — see P3 below.)

### Website — SAFE for injection, P2 for future CSP
- No dynamic HTML sink: `grep -niE 'innerHTML|document.write|eval|insertAdjacentHTML' *.html` → **none**. Content is static/authored, so no reflected/stored XSS vector.
- No secrets embedded in HTML (`grep` for `sb_secret|SERVICE_ROLE|re_|sk.|eyJ` → none).
- **⚠ P2 (future-CSP conflict):** the site uses inline event handlers and inline `<script>` blocks — `index.html` 8 `on*=` handlers + 2 `<script>`; `faq.html` 21 + 2; `volunteer.html` 11 + 2; `next-steps.html` 7 + 1. The marketing site currently ships **no CSP header at all** (no `netlify.toml`/`_headers`). When a CSP is added, these force `'unsafe-inline'` in `script-src`, which defeats much of the CSP's XSS value. **Recommendation:** before adding a website CSP, refactor inline `onclick=`/inline `<script>` into an external bundle so the CSP can be `script-src 'self'` without `'unsafe-inline'`. Not a live vuln (static content); a hardening prerequisite.

**Verdict: admin SAFE (item closed). Website injection SAFE; P2 CSP-refactor before adding a website CSP.**

---

## 6. Verbose error leakage (admin functions) — GAP, P2 (raw Supabase errors to authenticated admins)

**19 functions** return a **raw Supabase/PostgREST `error.message`** straight to the client via the `if (error) return fail(error.message)` pattern (`fail` = `{ error: message }` verbatim, `_lib/supabase-admin.js` L346–352). These leak SQLSTATE codes, table names, column names, constraint names, and RLS-policy names to the response body.

Confirmed offenders (file:line — the `error` is a `.from()/.rpc()` client error):
```
reject-leader.js:92            (.from('users'))
mark-heartcry-responded.js:35  (.from('heartcries'))
rag-override.js:58             (.from('churches'))
verify-leader.js:113
reject-church.js:111
escalate-flag.js:111
clear-flag.js:32
open-flagged-message.js:29
approve-heartcry-feed.js:45
update-church-admin-notes.js:52
reinstate-church.js:35
deactivate-church.js:37
reactivate-announcement.js:71
post-announcement.js:160
update-announcement.js:164
delete-announcement.js:29
seed-scripture.js:30
delete-scripture.js:19
read-region.js:61
```
(Separately, ~66 more `fail(err.message, err.status || 401/403)` fall-throughs exist, but those `err.message` values originate from the **verifier** — controlled strings like `AAL2_REQUIRED` — not raw DB errors, so they are lower-risk and out of scope for this item.)

**Severity = P2, not P1**, because **every one of these functions is gated by `verifyAnyAdmin`/`verifySuperAdmin`** (spot-checked: `reject-leader.js:39`, `mark-heartcry-responded.js:8`, `verify-leader.js:53`, `escalate-flag.js:43`, `reject-church.js:43`). The client receiving the leaked schema detail is always an **authenticated, vetted admin** — never the public and never a persecuted leader. So this is defense-in-depth / audit-hygiene, not a public information-disclosure hole. It still matters: admin-console schema leakage aids a compromised-admin or shoulder-surfing scenario, and Replant's own doctrine says surfaces shouldn't emit SQLSTATE/table names.

**Recommendation:** replace `return fail(error.message)` with a generic literal + server-side `console.error(error.message)` for ops (the pattern `send-password-reset.js` already uses — generic `RESET_FAILED` to client, full detail to logs). One mechanical pass across the 19 files.

**Verdict: GAP, P2.**

---

## Summary table

| # | Item | Verdict | Severity |
|---|------|---------|----------|
| 1 | Password-reset (admin + mobile) | SAFE — audit-first, single-use/TTL via GoTrue, rate-limited, no enumeration oracle | P3 note only |
| 2 | Committed secrets / history | SAFE — only `.env.example` ever committed; real env gitignored | P2 (mobile/website `.gitignore` too narrow — latent) |
| 3 | Public test/staging env | SAFE — single Supabase project, no staging web env | P3 (confirm Netlify deploy-preview publishing off — dashboard) |
| 4 | Backup / restore posture | GAP — no restore runbook/drill exists | P2 (ops/roadmap) |
| 5 | XSS (admin + website) | SAFE — admin guard CI-enforced, no dynamic sinks | P2 (website inline handlers block a future strict CSP) |
| 6 | Verbose error leakage | GAP — 19 fns return raw Supabase `error.message` (but all admin-gated) | P2 |

**New P0/P1: none.** All findings are P2 hardening or below. No item exposes a persecuted leader to a live, publicly-reachable vulnerability.
