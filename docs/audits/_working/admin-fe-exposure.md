# Admin Dashboard FE + Public Website — Browser/Internet Exposure Audit

**Auditor role:** Senior web-security / frontend-supply-chain SME (retained, pre-UAT)
**Date:** 2026-07-01
**Method:** READ-ONLY static analysis. No code changes, no deploys. Inspected committed source, build config, and the already-present production build output (`replant-admin/dist/`, built 2026-07-01 13:41). Website is static (no build); shipped bytes == source bytes.
**Scope A:** `/Users/ife/replant-admin/` (React + Vite admin dashboard)
**Scope B:** `/Users/ife/replant-website/` (static marketing site, `netlify deploy --prod`)

**Ground-truth frame:** Console-opacity doctrine (KAN-289) — the browser always reveals what the session fetches; real protection is BE gates + RLS. FE hardening = minify + NO prod source maps + no over-fetch + only the anon/publishable key in client JS. Adversary class per repo `SECURITY.md` includes state-actor security services; harm = deanonymization / geographic exposure of underground leaders. Findings weighted against that.

---

## VERDICTS

- **Admin FE: READY** — with 3 low-severity hardening nits (all P2/P3). No P0/P1. No secret leak, no source maps, minified, correct single-key posture, active bearer-scrubbing in error paths.
- **Website: NEEDS-FIX (light)** — one P2 (zero security headers) that is a cheap, high-value add before UAT. No secrets, no CVE-bearing CDN libs, clean forms. Everything else READY.

**Severity tally:** P0: 0 · P1: 0 · P2: 2 · P3: 4

---

## SCOPE A — ADMIN DASHBOARD

### What works well (admin)
1. **No source maps ship to prod.** `find dist -name '*.map'` → 0 files. No `sourceMappingURL` comment anywhere in `dist/` (HTML or JS). Vite default (`build.sourcemap: false`) is respected; `vite.config.mjs` correctly does not enable it.
2. **Exactly one key in the browser bundle, and it is the right one.** The only JWT in `dist/assets/index-CK2lY1wR.js` decodes to `{"iss":"supabase","ref":"jiyetphxxvyiicrnwlnx","role":"anon",...}` — the publishable anon key. Zero `service_role`, `sb_secret`, `re_*` (Resend), `UPSTASH`, `sk_*`, private-key, or `JWT_SECRET` material in the bundle.
3. **Active token-leak defense.** `src/lib/error-routing.js:34-35` scrubs bearer tokens out of error bodies before surfacing: `{ rx: /Bearer\s+[A-Za-z0-9._-]+/g, repl: 'Bearer [scrubbed]' }`. Rare and commendable.
4. **Resend SDK never reaches the browser.** `src/` does not import `resend`; all 9 `require('resend')` sites are Netlify functions (server-side). The 4 "resend" substrings in the bundle are Supabase Realtime's `joinPush.resend()` WebSocket retry, not the email SDK.
5. **Security headers already configured** in `netlify.toml` for the admin app (CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy) — see P2-1 for the two that are missing.
6. **Clean secret hygiene in the repo.** Only `.env.example` is tracked (placeholders + documentation, correctly separates `VITE_` public vars from server-side). `.env` / `.env.local` are gitignored; the real service-role key is NOT present locally (`.env.local` still has the `your...` placeholder). Bundle minified (903 KB / 110 lines).
7. **Supabase client is minimal and correct** (`src/supabase.js`): anon key only, throws if env missing, `persistSession` + `autoRefreshToken`; no manual token-in-cookie, no CORS wildcard in src.

### Findings (admin)

**[P2-1] Missing HSTS and Permissions-Policy headers on the admin dashboard.**
- Evidence: `netlify.toml` lines 34-40 set `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` — but **no `Strict-Transport-Security`** and **no `Permissions-Policy`**.
- Impact: Without HSTS, a first-visit or SSL-strip MITM can attempt to downgrade the admin session to HTTP. On a dashboard where an admin holds an AAL2 Supabase session, forcing HTTPS-only is table stakes. Missing Permissions-Policy leaves camera/mic/geolocation/USB defaults open to any same-origin (or CSP-permitted) script.
- Recommendation: Add `Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"` and a locked-down `Permissions-Policy` (e.g. `camera=(), microphone=(), geolocation=(), usb=(), payment=()`) to the existing `[[headers]]` block. Raised to P2 (not P1) only because the four highest-value headers are already present and CSP `frame-ancestors` intent is partially covered by X-Frame-Options DENY.

**[P3-1] Stale "Overseer" copy survives into the production bundle (voice drift vs. 2026-06-30 Manager rename).**
- Evidence: `src/components/tier/PromoteAdminModal.jsx:178` — placeholder string `"Why you trust this admin for Super admin tier. Shown to the other Overseer."` This is the single `Overseer` occurrence that survived minification into `dist/assets/index-CK2lY1wR.js` (confirmed by grep of the built bundle). It is user-facing: a super_admin sees it when sponsoring a promotion.
- Impact: Copy drift only (no security impact). Per the locked rename, leader/admin-facing display copy must say "Manager," not "Overseer" (DB enum `top_tier` unchanged).
- Recommendation: Change the placeholder to "…Shown to the other Manager." The ~60 other `Overseer` hits in `src/` are internal code comments and JS identifiers (`isOverseer`, `overseerCount`, `SEEDED_OVERSEER_EMAILS`) — harmless, optional cleanup, not shipped as copy.

**[P3-2] No `drop_console` on the production build — library console statements ship.**
- Evidence: App source is disciplined (only 3 `console.*` in `src/`, all `.error`/`.warn`, none logging sensitive data). But the built bundle contains 14 `console.log`, 16 `console.error`, 16 `console.warn`, 1 `console.trace` — all originating from `@supabase/supabase-js` / React internals. Vite/esbuild default minify does not strip `console`.
- Impact: Low. Per Console-opacity doctrine the browser already reveals session fetches; these are library diagnostics, not app-authored leaks of sensitive data. Purely a noise/deterrent-hardening gap.
- Recommendation (optional): add `esbuild: { drop: ['console', 'debugger'] }` (or `pure`) to `vite.config.mjs` to strip console/debugger from the prod bundle. Verify TOTP/error flows still behave, since some libs branch on console presence (rare).

**[Not a finding — verified benign]**
- `src/lib/api.js:486` "`service_role`" is a *comment* explaining the FE uses the anon key while the Netlify function uses service_role server-side (`listTeamInbox` → `call('list-team-inbox', {})`). Correct architecture, not a client-side service-role call.
- `.env` contains `JWT_SECRET` (len 88, duplicated line). It is **not** `VITE_`-prefixed, so Vite cannot inline it into the browser; it is gitignored and absent from the bundle. The duplicate line is cosmetic. (Confirm it is also not consumed anywhere it could reach a client artifact — appears to be a local/functions convenience var; flag to the BE agent only if any Netlify function echoes it.)
- Session token in localStorage is the Supabase SDK default (`persistSession: true`). Standard XSS-exfil consideration; the CSP present is the mitigation. No app code places an auth token in a non-HttpOnly cookie. Acceptable at MVP.
- FE tier gating (`isOverseer`/`isSuperAdmin` in `TeamManagement.jsx` etc.) is defense-in-depth UI gating; comments repeatedly reference the KAN-282 BE gate. **Cross-reference note for the BE agent:** confirm every FE-gated destructive tier action (demote/revoke/approve/deny/reset) has a matching BE authorization check + AAL2 step-up — FE gating alone is not a control. No evidence of an FE-only gate here, but this is the BE agent's lane to close.

---

## SCOPE B — PUBLIC WEBSITE

### What works well (website)
1. **No secrets, no JWTs, no internal endpoints.** Full grep of all HTML/SVG for `service_role`/`sb_secret`/`re_*`/`sk_*`/`UPSTASH`/JWT/`SUPABASE_SERVICE`/private-key/`supabase.co`/`jiyetphxxvyiicrnwlnx`/`admin.projectreplant` → nothing. The marketing site references zero backend internals.
2. **No third-party CDN CVE surface.** The only external resource loaded is Google Fonts (`fonts.googleapis.com`). No jQuery, no analytics-with-token, no outdated vendored library.
3. **Forms are safe.** `join-network` (index.html) and `serve-with-us` (volunteer.html) use native Netlify Forms (`data-netlify="true"` + hidden `form-name`). `handleSubmit` POSTs URL-encoded data to `/` (same-origin) — no external endpoint, no secret, no token. No `eval` / `document.write` / user-data `innerHTML` sinks anywhere.
4. **Email hygiene.** Only `connect@projectreplant.org` (intended) and a `your@email.com` form placeholder appear. No leaked internal addresses.
5. **Static, no framework dev build.** Plain HTML shipped; nothing to expose a dev server or source map.

### Findings (website)

**[P2-2] Website ships ZERO security headers.**
- Evidence: no `netlify.toml` and no `_headers` file in `/Users/ife/replant-website/`. Therefore no CSP, no HSTS, no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy on the public site.
- Impact: Lower than the admin app (no auth, no user data, no PII collected beyond opt-in form fields Netlify handles). But: no HSTS (downgrade risk on the public front door), no X-Frame-Options (site can be framed → clickjacking of the "join the network" CTA, a phishing vector against prospective persecuted leaders), no `X-Content-Type-Options: nosniff` (MIME-sniff). All are one-file, near-zero-risk additions.
- Recommendation: Add a `_headers` file (or `netlify.toml [[headers]]`) with at minimum `Strict-Transport-Security`, `X-Frame-Options: DENY` (or `SAMEORIGIN` if any self-framing is needed), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. A CSP is a nice-to-have here; note the inline `onsubmit=` handlers + inline `<script>` would need `'unsafe-inline'` or a nonce if a strict CSP is added, so scope CSP carefully.

**[P3-3] Public forms have no honeypot / `netlify-honeypot` bot-field.**
- Evidence: `grep -i 'bot-field|honeypot'` across the site → none. Both public forms rely on Netlify's default spam handling only.
- Impact: Spam/abuse exposure only (no security leak). For a persecuted-Church intake form, spam volume can bury genuine signups and cost moderation effort.
- Recommendation: Add `netlify-honeypot="bot-field"` + a hidden `bot-field` input, and/or enable Netlify's reCAPTCHA on these two forms.

**[P3-4] Inline event handlers/scripts couple the site to a no-CSP posture.**
- Evidence: `index.html:594` / `volunteer.html:871` use `onsubmit="handleSubmit(event)"` and inline `<script>` blocks.
- Impact: Not a vulnerability today (no CSP to violate). Flagged only so that when P2-2's headers are added, whoever adds a CSP knows these inline handlers require `'unsafe-inline'`/nonce handling or a small refactor to `addEventListener`.
- Recommendation: When adding CSP, either allow inline via nonce or move `handleSubmit` binding to an external/attached listener. Non-blocking.

---

## Cross-agent handoffs (not fixed here — out of my read-only FE lane)
- **BE agent:** confirm each FE-gated tier action (demote/revoke/approve/deny/reset in `TeamManagement.jsx`) has a matching BE authz check + AAL2 step-up. FE gating is defense-in-depth only.
- **BE/ops:** confirm the real `SUPABASE_SERVICE_ROLE_KEY` and `RESEND` key are set only in Netlify env (server context), never in a Netlify "Local development"-context var (prior memory note: dev-context leaks plaintext). Confirm `.env` `JWT_SECRET` is not surfaced by any Netlify function response.
- **Dependency agent:** `npm audit` is that lane. Nothing glaring in `replant-admin/package.json` (React 18.3, Vite 6.3.5, supabase-js 2.49, react-router 6.29, resend 6.12, sharp 0.33 — all recent). `resend`/`sharp` are function-runtime deps, correctly not in the browser bundle.

---

## Bottom line
No P0/P1. No secret leaked to the browser, no source maps in prod, bundle minified, single correct anon key, and an active bearer-scrubber in the error path — the admin FE exposure posture is genuinely good. The only two things worth doing before UAT are cheap header additions: HSTS + Permissions-Policy on the admin app (P2-1) and a `_headers` file on the website (P2-2). The stale "Overseer" placeholder (P3-1) is the one user-facing copy nit.
