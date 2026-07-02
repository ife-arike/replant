# Pre-UAT Audit — Dependencies, Test Coverage, i18n, Build/Perf, Migrations

**Scope:** `/Users/ife/replant` (mobile, Expo/RN) · `/Users/ife/replant-admin` (Vite/React dashboard) · `/Users/ife/replant-website` (static HTML)
**Posture:** READ-ONLY. No installs, no code changes. All commands local/offline.
**Context:** First real persecuted-leader signup 2026-06-28. Leaders live now; untested destructive paths and unpatched deps are real risk.
**Date:** 2026-07-01

---

## VERDICTS

| Lens | Verdict | One-line |
|------|---------|----------|
| **Dependencies** | **NEEDS-FIX (P1)** | No runtime-facing critical/high in the shipped mobile app; admin has 1 runtime moderate (open-redirect). All criticals are dev/build/test tooling. Non-breaking `npm audit fix` clears most. |
| **Testing** | **NEEDS-FIX (P1)** | Strong unit volume (admin 896 cases, mobile 387 Deno + 10 FE files) but **no CI test gate**, **no E2E**, **no RLS-policy tests**, and the highest-stakes destructive paths (escalated-cases, UG proposals/claim, admin promotion) have **zero automated coverage**. |
| **i18n (Lens 7)** | **ROADMAP — P1 post-MVP** | Zero i18n infrastructure. ~500 hardcoded English strings in mobile. No RTL for Arabic/Farsi/Hebrew. This will wall off Iran/Egypt/China leaders fast. |
| **Build/Perf (Lens 4)** | **DEFER (P2)** | Admin build green but one 903 KB monolithic chunk, no code-splitting. No source maps (good — matches console-opacity doctrine). Mobile deps lean. |
| **Migrations** | **NEEDS-FIX (P2)** | Forward-only, no down-migrations; recent escalated-cases migrations are NOT re-runnable (bare `DROP CONSTRAINT`/`DROP VIEW` without `IF EXISTS`). |

---

## 1. DEPENDENCY VULNERABILITIES

### Evidence — `npm audit --json` (both repos, run without `timeout`; note `timeout`/`gtimeout` absent on this macOS)

**Mobile** (1077 deps): `{low:1, moderate:19, high:4, critical:1, total:25}`
**Admin** (246 deps): `{low:1, moderate:5, high:2, critical:1, total:9}`

### Mobile critical/high — ALL dev/build/test tooling (traced via `npm ls`)

| Sev | Package | Advisory | Chain → verdict |
|-----|---------|----------|-----------------|
| CRITICAL | `shell-quote` 1.8.3 | quote() newline escape (GHSA-w7jw-789q-3m8p) | `react-native → react-devtools-core` → **DEV-ONLY** (devtools, not in prod bundle) |
| HIGH | `undici` 6.25.0 | Set-Cookie SameSite downgrade / HTTP smuggling | `expo → @expo/cli` → **BUILD/DEV CLI ONLY** |
| HIGH | `form-data` 4.0.5 | CRLF injection (GHSA-hmw2-7cc7-3qxx) | `jest-expo → jsdom` → **TEST-ONLY** |
| HIGH | `fast-uri` 3.1.0 | path traversal / host confusion | `expo-dev-client → ajv` → **DEV CLIENT ONLY** (not prod) |
| HIGH | `ws` (6.2.3/7.5.10/8.20.0) | uninit memory disclosure / DoS | 3 chains: Expo CLI + Metro = dev; **`@supabase/realtime-js@2.105.3 → ws@8.20.0`** is the only runtime-adjacent path |

**`ws`-in-realtime nuance (verify, do not assert):** `@supabase/realtime-js` declares `ws` as a dependency with **no `browser`/`react-native` package.json override field** (checked `node_modules/@supabase/realtime-js/package.json` — `browser:null, react-native:null`). In practice RN and browser bundlers supply the global `WebSocket` and realtime-js guards `ws` behind a Node-env check, so `ws` is normally NOT in the RN runtime path — but because there's no explicit override field, this should be confirmed against the actual Metro bundle rather than assumed. Bumping `@supabase/supabase-js` (2.105.3 → 2.110.0, non-breaking minor) pulls a patched `realtime-js` and is the clean fix regardless.

`npm audit fix` (non-breaking, dry-run): churns 109 packages but audit **still reports 25** — the Expo-pinned transitives don't drop out via a simple fix; they clear when the Expo SDK patch train catches up or via `@supabase/supabase-js` bump.

### Admin critical/high

| Sev | Package | Advisory | Runtime? |
|-----|---------|----------|----------|
| CRITICAL | `vitest` ≤3.2.5 | arbitrary file read+exec when **Vitest UI server** listening (GHSA-5xrq-8626-4rwp) | **DEV-ONLY** (test UI; never in prod) |
| CRITICAL (chain) | `@babel/core` ≤7.29.0 | arbitrary file read via sourceMappingURL (GHSA-4x5r-pxfx-6jf8) | **BUILD-ONLY**; **fixed by non-breaking `npm audit fix`** |
| HIGH | `vite` ≤6.4.2 | path traversal in optimized deps / launch-editor NTLM (Windows) | **DEV SERVER ONLY** |
| HIGH | `ws` 8.20.0 | uninit memory / DoS | via realtime-js; **fixed by `npm audit fix`** (→8.21.0) |
| MODERATE | `esbuild` ≤0.24.2 | dev server SSRF (GHSA-67mh-4wv8-2f99) | **DEV-ONLY**; needs `--force` (breaking vitest@4) |
| **MODERATE** | **`react-router` 6.7.0–6.30.3** | **open redirect via `//` protocol-relative URL (GHSA-2j2x-hqr9-3h42)** | **RUNTIME-FACING** — admin is a browser app with auth redirects. **Only runtime-facing admin advisory.** Fixed by non-breaking `npm audit fix` (→6.30.4). |

**Admin `npm audit fix` (non-breaking) clears:** `@babel/core` (critical), `ws` (high), `react-router` (moderate open-redirect). Remaining `vitest`/`vite`/`esbuild` chain is dev-only and needs `--force` (vitest 2→4 breaking).

### Known-exploited? None of these are on CISA KEV as actively-exploited in-the-wild as of the advisory data. Severity is driven by *reachability*, and reachability here is overwhelmingly dev/build/test — not the code a persecuted leader's device runs.

### RECOMMENDATION (P1)
1. **Admin:** run `npm audit fix` (non-breaking) — clears the runtime open-redirect + babel critical + ws. Do the `--force` vitest bump on a branch, separately (dev-only, no rush, breaking).
2. **Mobile:** bump `@supabase/supabase-js` 2.105.3 → 2.110.0 (non-breaking) to retire the runtime-adjacent `ws`. The remaining dev/build criticals ride the Expo SDK patch train — track `npx expo install --check`, don't hand-force.
3. Neither repo blocks UAT on these, but the admin non-breaking fix should land before more leaders onboard.

### Outdated (major-behind, `npm outdated`)
- **Mobile:** Expo 54→57, RN 0.81→0.86, react 19.1→19.2, TS 5.9→6.0, all `expo-*` a major behind. **Do NOT chase** — Expo SDK upgrades are coordinated, breaking, and out of UAT scope. Staying on SDK 54 is correct pre-UAT.
- **Admin:** react 18→19, react-router 6→7, vite 6→8, vitest 2→4. All major, all deferrable.

---

## 2. EXPO HEALTH

### Evidence — `npx --offline expo-doctor`
```
16/17 checks passed. 1 check failed.
✖ Check that packages match versions required by installed Expo SDK
   expo       expected ~54.0.35  found 54.0.34
   expo-font  expected ~14.0.12  found 14.0.11
```
**Verdict: HEALTHY.** Single failure is two **patch**-version drifts (cosmetic). Fix with `npx expo install --check` whenever convenient — not a UAT blocker. All 16 substantive checks (config, native modules, duplicate deps, etc.) pass.

---

## 3. TEST COVERAGE

### 3a. Mobile edge functions — 10 of 15 have tests, **5 do NOT**

| Function | Test? | Notes |
|----------|-------|-------|
| auth-status-check | ✅ 2 files | |
| check-email-available | ✅ 2 | |
| create-account | ✅ 2 (25 cases in logic) | |
| register-church | ✅ 2 (30 cases) | |
| register-church-delete | ✅ 2 | |
| search-churches | ✅ 2 | |
| send-branch-message | ✅ 1 | |
| send-message | ✅ **5 files** (logic 35, +auth/handler/matcher/flag) | best-covered |
| submit-heartcry | ✅ 1 | |
| update-church | ✅ 1 | |
| **accept-connection-request** | ❌ **NONE** | Connect DM accept path |
| **admin-open-heartcry** | ❌ **NONE** | admin reads leader heartcry |
| **get-nearby-churches** | ❌ **NONE** | location query |
| **join-underground-church** | ❌ **NONE** | **UG-SAFETY-CRITICAL join flow** |
| **reveal-join-code** | ❌ **NONE** | **UG join-code reveal** |

**Depth of what IS tested:** Pure-logic unit tests (Deno std assert). No `createClient`/`supabase`/`fetch`/mock references in any `logic.test.ts` — they test extracted pure functions (`validateBody`, `sortParticipants`, `isUuid`, matcher on synthetic taxonomy fixtures per KAN-124 AC-12). Good hygiene (patterns never inlined), decent breadth (25–35 cases/fn), but **unit-only** — no function exercises real auth/DB/RLS end-to-end. **387 total Deno test cases** across edge fns.

### 3b. Mobile FE — 10 `src/**` unit files (jest)
`getLeaderDisplayName`, `displayHelpers`, `asp2OptimisticPending`, `persecutedLogic`, `NetworkFeed`, `DailyScriptureStrip`, `PrayerWallLogic`, `PrayerWallPullUp.invariants`, `GlobeView.invariants`, `countryCentroid`. Solid logic/invariant coverage.

**⚠ Two disjoint runners:** `jest.config.js` `testMatch` is `src/**` and explicitly ignores `/supabase/` (Deno URL imports would crash jest). So **`npm test` runs ONLY the 10 FE files** — the 387 edge-fn cases require a separate `deno test` invocation. Neither is wired to CI.

### 3c. Admin — 48 test files, **896 test cases**
- `tests/functions/`: 21 files (Netlify function tests)
- `src/test/`: 22 files (FE/helper/security: aal2-freshness, sensitive-actions, no-dangerously-set-inner-html, session-watchdog, step-up-cache, etc.)
- `netlify/functions/_lib/`: 5 files (rate-limit, validate-step-up, aal2-check, welcome-dm, audit-meta)

**But only 21 of 91 Netlify functions (~23%) have a dedicated test.** Critical destructive-path cross-check:

| Path | Tested? |
|------|---------|
| revoke-admin | ✅ |
| approve-church / reject-church | ✅ |
| verify-leader / reject-leader | ✅ |
| send-password-reset | ✅ |
| **approve-admin-promotion** | ❌ |
| **demote-admin / revoke-admin-tier / grant-admin-to-existing / invite-admin** | ❌ |
| **deactivate-church** | ❌ |
| **propose-escalated-action / approve-escalated-proposal / close-escalated-case / reach-out-to-leader-from-case** | ❌ (entire escalated-cases workflow untested) |
| **propose-underground / confirm-underground-proposal / underground-claim / hard-delete-underground-confirm** | ❌ (entire UG proposal/claim/delete flow untested) |
| **update-account-name** | ❌ |

### 3d. E2E / integration / RLS
- **No E2E anywhere.** No Detox, no Maestro (mobile); no Playwright, no Cypress (admin). Grep + file search: nothing.
- **No RLS-policy test fixtures.** No harness exercises Postgres RLS per caller role. The "RLS" grep hits are comment references + one hardening migration (`20260623_0003_users_is_active_rls_hardening.sql`), not tests. **This is the sharpest gap:** the tier-based visibility model (regulars locked out post-escalate, cross-tier column masking, UG exclusion) is the core security guarantee and has **no automated proof** that a wrong-tier caller is denied.
- **No CI test gate.** Only GitHub workflow in each repo is `update-changelog.yml` (no `run: npm test`/`deno test`/`vitest`). `netlify.toml` deploy command is `npm run build` — build only, tests not run on deploy. **Tests exist but nothing enforces them.**

### COVERAGE GAP TABLE (by critical subsystem)

| Subsystem | Automated test? | Risk |
|-----------|-----------------|------|
| send-message (flag/matcher) | ✅ strong (mobile) | low |
| create-account | ✅ unit (mobile) | low-med (no integration) |
| register-church | ✅ unit (mobile) | low-med |
| verify/reject leader | ✅ (admin) | low |
| approve/reject church | ✅ (admin) | low |
| **join-underground / reveal-join-code** | ❌ **NONE** | **HIGH — UG-safety** |
| **admin promotion (approve/deny/grant/demote/revoke-tier)** | ⚠ only revoke-admin | **HIGH — privilege escalation** |
| **escalated-cases (propose/approve/close/reach-out)** | ❌ **NONE** | **HIGH — anti-gossip visibility invariant** |
| **UG proposals (propose/confirm/claim/hard-delete)** | ❌ **NONE** | **HIGH — destructive + UG-safety** |
| accept-connection-request | ❌ NONE | med |
| RLS policies per role | ❌ NONE | **HIGH — core security model unproven** |

### RECOMMENDATION (P1)
1. **Before UAT, add tests for the UG-safety + privilege paths first:** `join-underground-church`, `reveal-join-code`, the admin promotion cluster, and the escalated-cases visibility invariant. These are where an untested bug = real harm to a persecuted leader.
2. **Add ONE CI workflow per repo** running `npm test` (jest) + `deno test supabase/functions/` (mobile) and `npm test` (admin, vitest). Tests that don't run in CI decay.
3. **Introduce an RLS policy test harness** (pgTAP or a seeded per-role integration suite) proving cross-tier denial. This is post-MVP-sized but is the highest-value security test investment.
4. E2E (Maestro for mobile, Playwright for admin) is a legitimate DEFER — unit + RLS coverage first.

---

## 4. i18n (Lens 7) — the big roadmap gap

### Evidence (grep across both repos, node_modules excluded)
- **i18n framework:** NONE. No `i18next`, `react-i18next`, `react-intl`, `@lingui`, `formatjs`, `expo-localization`, `i18n-js`, `polyglot` in either `package.json`. `expo-localization` not even installed transitively.
- **`locales/` / `translations/` dir:** NONE.
- **`t('...')` / `useTranslation` / `<Trans>` call sites:** **0 files.**
- **RTL (Arabic/Farsi/Hebrew):** NONE. No `I18nManager`, `writingDirection`, `isRTL`, `forceRTL`, `allowRTL`, `dir="rtl"` anywhere.
- **Locale-aware formatting:** No `Intl.DateTimeFormat`/`NumberFormat`/`RelativeTimeFormat`. Dates use scattered `toLocaleDateString`/`toLocaleString` (device-locale default, no explicit locale, inconsistent) across ~9 files. No date lib (raw `Date`).

### Magnitude (heuristic grep across screens/components)
- **Mobile:** 123 `.tsx` files in `src/screens` + `src/components`. ~378 JSX text nodes (`>Word…<`) + ~114 string props (`title=`/`label=`/`placeholder=`) + 18 `Alert.alert` dialog sites ≈ **~490+ hardcoded user-facing English strings.** Sample proves they're real copy: `>Back to sign in<`, `>First Name<`, `>This will be your login email.<`, `>Confirm Password<`.
- **Admin:** 91 files, ~406 text nodes. (Admin is dashboard-only, staff-facing — English acceptable at MVP; **far lower priority than mobile**.)
- **Website:** static HTML, `<html lang="en">` hardcoded, English-only (acceptable for a marketing site).

### Stakes (make explicit)
Replant's users are persecuted Christian leaders in **Iran (Farsi/Persian — RTL), China (Simplified Chinese), Egypt (Arabic — RTL), Nigeria (Hausa/English)**. For many, English is not the primary language. An **English-only mobile app with no RTL** means:
- Farsi/Arabic speakers get a left-to-right layout that reads backwards — not just untranslated, structurally wrong.
- The most vulnerable, least-English-fluent leaders — exactly the ones the platform exists to reach — hit the wall first.
- Every day of growth adds more hardcoded strings, making the eventual extraction linearly more expensive.

### RECOMMENDED FIRST STEP (roadmap, post-MVP but do NOT let it grow unbounded)
1. **Pick the framework now, extract incrementally:** `i18next` + `react-i18next` + `expo-localization` (device-locale detection) is the standard, well-supported RN stack. Adopt the `t('key')` pattern.
2. **Freeze the bleed:** establish `src/locales/en.json` + a `t()` layer and require new screens to use it, so the string count stops growing inline even before back-filling.
3. **Back-fill mobile-first** (the ~490 strings), starting with onboarding + destructive-path copy (the 18 Alerts) since those are where mistranslation = a leader making the wrong safety decision.
4. **RTL:** wire `I18nManager.forceRTL`/`allowRTL` and audit flex layouts for logical (start/end) vs physical (left/right) props — a distinct, larger workstream to schedule after string extraction.
5. **Locale-aware dates:** replace bare `toLocaleDateString()` with an explicit-locale formatter once locale context exists.

**Prioritize target languages by leader geography** (Farsi, Arabic, Simplified Chinese first) rather than translating everything at once.

---

## 5. BUILD / PERF (Lens 4)

### Admin build — `npm run build` (Vite 6.4.2), EXIT 0
```
✓ 190 modules transformed.
dist/index.html                 0.91 kB │ gzip:   0.47 kB
dist/assets/index-*.css        85.85 kB │ gzip:  14.91 kB
dist/assets/index-*.js        903.12 kB │ gzip: 235.30 kB   ← single chunk
(!) Some chunks are larger than 500 kB after minification.
✓ built in 2.45s
```
- **One monolithic 903 KB JS chunk** (235 KB gzipped). Source has **0 dynamic imports / `React.lazy`** → nothing is code-split. Vite warns.
- **No source maps emitted** (`find dist -name '*.map'` = 0). **GOOD** — matches the console-opacity doctrine (KAN-289): minified + no maps is the intended deterrent. Do NOT add source maps to the prod admin build.
- dist total 1.0 MB.

**Verdict: DEFER (P2).** Ships fine; the admin dashboard is a low-user-count staff tool where a 235 KB gzipped first-load is acceptable. A later perf pass can add route-level `React.lazy` + `manualChunks` to split vendor/route bundles.

### Mobile — deps are LEAN
Runtime deps are all Expo/RN-managed: navigation, `@rnmapbox/maps` (native, expected for the Church map tab), `@noble/ciphers` (lightweight crypto, used in `src/lib/secure-storage.ts` — legitimate, not bloat), `react-native-svg`, Google Fonts. **No obviously heavy third-party JS libs.** Nothing flagged. (RN app not built per scope.)

### Heavy read RPCs/endpoints — confirmed present (for a later perf-profiling pass, NOT profiled here)
| RPC/View | Location |
|----------|----------|
| `get_prayer_wall` | migrations (kan18/kan21 nearby-churches + enrichment) |
| `get_heartcry_feed` | migrations `20260606…heartcry_feed_*`, `kan65_heartcry_feed_region` |
| `list-pastoral-queue` | `replant-admin/netlify/functions/list-pastoral-queue.js` + `src/lib/api.js` |
| `v_escalated_inbox` | migrations `20260701000005_create_v_escalated_inbox` (+ 3 alters) |
| `get_leader_thread_list` | `src/screens/main/ConnectScreen.tsx` + migration `20260609…connect_request_flow` |

All 5 exist and are wired. A future perf pass should `EXPLAIN ANALYZE` these under realistic row counts (esp. `v_escalated_inbox` which is a VIEW re-created several times, and `get_heartcry_feed` which fans out by region).

---

## 6. MIGRATION REVERSIBILITY

### Evidence
- **88 `.sql` migrations**, forward-only. **No down-migrations, no `down/` dir, no rollback/revert files** (`find` = 0).
- Aggregate idempotency-keyword counts: `CREATE OR REPLACE` 58 files, `IF NOT EXISTS` 27, `IF EXISTS` 29, bare `DROP` 30, explicit `BEGIN;…COMMIT` txn 20.
- **Spot-check of 5 recent migrations reveals the keyword counts overstate re-runnability:**

| Migration | Idempotent / re-runnable? |
|-----------|---------------------------|
| `20260701000005_create_v_escalated_inbox` | ✅ `CREATE OR REPLACE VIEW` |
| `20260701000010_manager_review_state_and_columns` | ❌ bare `ALTER TABLE … DROP CONSTRAINT escalated_cases_state_check` + bare `ADD COLUMN` (no `IF EXISTS`/`IF NOT EXISTS`) — re-run errors |
| `20260701000011_escalated_case_replied_at_trigger` | ❌ bare `ADD COLUMN replied_at` + **`DROP VIEW public.v_escalated_inbox`** (no `IF EXISTS`) then recreate — re-run errors |
| `20260701000008_add_category_to_escalated_case_proposals` | ❌ bare `ADD COLUMN category` (no `IF NOT EXISTS`) |
| `20260701000004_extend_audit_log_action_check` | ❌ bare `ALTER TABLE … DROP CONSTRAINT audit_log_action_check` |

### Verdict: NEEDS-FIX (P2) — but this is *convention*, not a live bug
The recent escalated-cases migrations are **single-shot, forward-only, and not re-runnable** (re-applying a bare `DROP CONSTRAINT`/`DROP VIEW` errors because the object is already gone). This is *acceptable* under Supabase's tracked-migration model (each file runs exactly once), and CHECK-constraint swaps genuinely need drop-then-add. **The real risk is the absence of any rollback path:** if a migration ships bad in prod, there is no down-migration to revert cleanly — recovery is a hand-written corrective migration under pressure.

**RECOMMENDATION:**
1. Adopt `DROP CONSTRAINT IF EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP VIEW IF EXISTS` as house style so migrations are at least re-runnable if a deploy half-applies.
2. For destructive/structural migrations touching live tables (audit_log CHECK, escalated_cases columns), author a paired down-migration or documented rollback SQL before merge. Not a UAT blocker, but with real leaders live, a broken forward-only migration with no rollback is the kind of thing that becomes a 2am incident.

---

## WHAT WORKS WELL

1. **Test hygiene is genuinely good where it exists** — mobile edge tests are clean pure-logic units with security-conscious fixtures (matcher patterns never inlined per KAN-124 AC-12), and admin has real security-focused suites (`no-dangerously-set-inner-html`, `sensitive-actions`, `aal2-freshness`, `session-watchdog`, `validate-step-up`). 896 admin + 387 mobile edge cases is not a token effort.
2. **Runtime dependency exposure is small** — the scary "1 critical, 4 high" mobile headline is entirely dev/build/test tooling; the code on a persecuted leader's phone carries essentially none of it. Mobile runtime deps are lean and Expo-managed.
3. **Console-opacity posture is correct** — admin prod build emits NO source maps and is minified into an opaque chunk, exactly per the KAN-289 doctrine. (The chunk being *large* is a perf nit, not a security one.)
4. **Expo health is strong** — 16/17 doctor checks pass; only trivial patch drift.
5. **Migration idempotency is mostly disciplined** — 58 files use `CREATE OR REPLACE`; the gaps are concentrated in the newest escalated-cases batch, a fixable convention slip not a systemic mess.
6. **Admin is architecturally tiny** — 6 runtime deps, 246 total. Small attack surface, fast build (2.45s).

---

## COMMANDS SKIPPED / NEEDING MANUAL RUN
- **`timeout`/`gtimeout` unavailable on this macOS** — all `timeout`-prefixed commands (per the audit brief) failed with exit 127. Re-ran every one WITHOUT the prefix; all completed locally. **No finding was skipped for this reason**, but be aware the literal bracketed commands in the brief won't run as-written on this box.
- **`npm audit fix` / `--force`** — only DRY-RUN executed (read-only constraint). The non-breaking fixes for admin (babel/ws/react-router) and the mobile `@supabase/supabase-js` bump need a manual run + smoke.
- **RN app build** — not run (per scope). Mobile bundle size not measured; deps inspected statically only.
- **RPC `EXPLAIN ANALYZE`** — not run (read-only; would need DB). The 5 heavy RPCs were confirmed to EXIST but not profiled.
- **Live vuln→KEV cross-reference** — advisory metadata used; no network call to CISA KEV (offline). Worth a manual KEV check if any advisory is later escalated.
