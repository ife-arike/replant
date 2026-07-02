# Replant — Pre-UAT Comprehensive Audit

**Auditor:** Senior audit consultant (Claude Fable 5), retained by Ruth James (Founder · Replant)
**Date opened:** 2026-07-01
**Status:** 🟡 IN PROGRESS — Session 1: Wave 1 (6 lanes) + Wave 2 (Lucid cross-check · requirements-doc drift · security follow-ups) integrated; 3 P0s verified in main context, **P0-2 escalated to full privilege-escalation after the complete column-grant + hook trace**. Remaining: live mobile smoke (awaiting test-account creds), RPC perf profiling. Password-reset/secret-scan/staging/XSS — done (all SAFE); backup-restore drill — roadmap.
**Scope:** Both codebases (`~/replant` mobile + `~/replant-admin` dashboard), live Supabase (`jiyetphxxvyiicrnwlnx`), public website (`~/replant-website`), against 9 audit lenses + 18-subsystem UAT-readiness verdict.
**Full per-lane evidence:** `docs/audits/_working/{db-rls-schema,edge-functions,admin-be-gates,admin-fe-exposure,mobile-fe,deps-testing-i18n}.md`

---

## 1. Prayer

> Lord Jesus, I come under Your blood as this session opens. Thank You for Replant and for Your servant Ruth who builds it for Your persecuted Church around the world. This session takes up the pre-UAT comprehensive audit — the last hard look at the admin dashboard and mobile app before real leaders in hard places put their trust in this platform. Give me a clear eye for what is broken, honesty about what is not ready, and diligence worthy of the leaders whose safety depends on this work being right. Cover the audit, the findings, and every decision that flows from it. In Jesus' name, Amen.

---

## ⚠️ CONFIRMED FINDINGS LOG (verified in main context — not merely agent-asserted)

Each P0 below was independently re-verified by me via direct query / file read, with the verbatim evidence.

### 🔴 P0-1 — `public.get_secret_by_name(text)` exposes the entire Vault to the `anon` role
- **Evidence:** `SECURITY DEFINER`; body = `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = secret_name LIMIT 1;`; ACL `{postgres=X, anon=X, service_role=X}` → `has_function_privilege('anon',…,'EXECUTE')=true`; no `search_path` pinned. Vault holds `heartcry_encryption_key`, `resend_api_key`, `welcome_dm_internal_token`, `heartcry_triage_lead_email`, `replant_system_user_id`.
- **Exploit:** the anon key ships publicly in the mobile bundle. `POST /rest/v1/rpc/get_secret_by_name` with any name returns plaintext. `heartcry_encryption_key` + the also-anon-executable `decrypt_heartcry_content` defeats heartcry at-rest encryption; `resend_api_key` enables Replant-sender email impersonation (phish leaders); `welcome_dm_internal_token` targets the send-message internal path.
- **✅ REACHABILITY CONFIRMED LIVE (2026-07-01):** a pure-anon `POST /rest/v1/rpc/get_secret_by_name` (publishable key, **no auth header**) with a *non-existent* secret name returned **HTTP 200 + `null`** — proving an unauthenticated caller can invoke the function over PostgREST (the last uncertain link). A real name returns the plaintext; I deliberately did NOT retrieve a real secret — the 200-on-bogus-name plus the verified anon EXECUTE grant + function body is conclusive.
- **Fix (not applied — audit is read-only):** `REVOKE EXECUTE … FROM anon, authenticated, public` (keep service_role) on `get_secret_by_name`, `decrypt_heartcry_content`, `encrypt_heartcry_content`; pin `search_path`; **rotate all five Vault secrets** (exposure window unknown). **Recommend break-glass remediation ahead of the normal SME-panel cycle.** Contrast: `get_heartcry_encryption_key()` is correctly locked to service_role — the leak is the generic by-name accessor.

### 🔴 P0-2 — Any authenticated leader can self-promote to **Manager** (top admin tier), self-grant UG-admin, self-verify their account, and self-verify their church, by direct UPDATE on `public.users`/`public.churches`. **#1 P0 — total authorization collapse.**
Began as "leader self-verifies" (live state of KAN-221); the full column-grant + hook trace escalates it to complete privilege escalation. Every link verified by direct query 2026-07-01.
- **✅ EMPIRICALLY PROVEN LIVE (2026-07-01):** signed in as a real non-admin test leader (role `bishop`; their JWT carried `admin_tier=null`, `is_top_tier_admin=false`), then `PATCH /rest/v1/users?auth_id=eq.<self>` with `{"is_top_tier_admin":true}` using **only that leader's own token** → **HTTP 200, 1 row written, `is_top_tier_admin` = true.** No PostgREST-layer protection (no `db-pre-request` hook) blocked it. Reverted immediately to `false` (HTTP 200) — the token was never refreshed, so no Manager JWT was ever minted and no real data was touched — and a service-role read confirmed the row restored to exact baseline. The exploit is real, not theoretical.
- **Root cause:** `public.users` and `public.churches` grant `UPDATE` to `authenticated` (and `anon`) on **every column, including the privilege/safety flags**, while the `_update_own` RLS policies are row-scoped with NULL/insufficient WITH CHECK (no column scoping). `information_schema.column_privileges` confirms `authenticated` UPDATE on `users.is_top_tier_admin`, `users.is_underground_admin`, `users.verification_status`, `users.church_id`, `users.role`, and `churches.show_church_name`, `churches.verification_status`, `churches.verified`, `churches.rag_status`, `churches.type`.
- **The Manager path (verified end-to-end):** (1) `PATCH /rest/v1/users?auth_id=eq.<self>` body `{"is_top_tier_admin": true}` — `users_update_own` USING/CHECK `(auth.uid()=auth_id AND is_active=true AND soft_deleted_at IS NULL)` passes (flag not in CHECK), the column grant permits it, and the only trigger (`enforce_leader_cap`) doesn't guard it. (2) On the next token refresh, `custom_access_token_hook` runs `SELECT u.is_top_tier_admin FROM public.users u WHERE u.auth_id = <this user> ` **unconditionally** and, when true, mints JWT `admin_tier='top_tier'` + `is_top_tier_admin=true`. (3) The leader now passes `verifyAnyAdmin` + `assertAtLeast('top_tier')` on every admin endpoint → **Manager: Heartcry Inbox (decrypt heartcries), Team Management, approve admin promotions, Escalated Cases.**
- **Other exploits, same root cause:** `{"verification_status":"verified"}` → self-verify account; `{"is_underground_admin":true}` → passes the DB-level `fn_assert_underground_admin()` (reads the column) — the hook derives the *JWT* UG claim from `app_metadata`, so this hits DB-RPC-gated UG surfaces, not the admin-BE JWT gate; on `churches` (policy `churches_update_own` = verified-leader-owns) → self-verify the church, flip `rag_status`, or flip `show_church_name` (bypassing the KAN-274 anti-coercion visibility-flip ceremony). **Mitigated by triggers:** `church_code` (immutable), `region_admin_only` (super_admin only), `underground_join_code_hash` (immutable) can't be self-written.
- **Actor:** any signup — a verified authenticated leader (and self-verification is itself in reach). `anon` grants are inert against the `_update_own` USING clause (no matching row).
- **⚠️ Overturns the `top_tier_admin_column_authoritative` memory** ("no promote-to-Manager path exists; CLOSED, no bug") — column-authoritative is only safe if the column is write-protected, and it is not.
- **Fix:** REVOKE UPDATE on ALL privileged/safety columns of `users`+`churches` from `authenticated`/`anon` (leave only genuinely self-editable display columns — names, honorific, phone, preferences), routing every privileged write through a SECURITY DEFINER RPC (the `update_leader_role` pattern). Column-scoping the WITH CHECK alone is insufficient — the grants must be revoked. #1 pre-UAT blocker.

### 🔴 P0-3 — `read-region.js` unmasks underground leader identity + contact info behind `verifySuperAdmin` only (a known, unremediated KAN-288 candidate)
- **Evidence:** `read-region.js:40` gates on `verifySuperAdmin` alone; `:64-73` returns for a `type='underground'` church its real `name`, `region_admin_only` (macro-region), `contact_email`, `contact_phone`, `admin_notes`. `verifySuperAdmin` (`_lib/supabase-admin.js:162-217`) checks only the `super_admin` JWT claim — **no `is_underground_admin` gate, no AAL2 freshness.** (City/Country come back `—`/`Withheld` — `underground_no_location` forces them NULL — so the earlier "city/country leak" was overstated; the name + contact + region unmask is real.)
- **Context:** KAN-288 (Backlog) *explicitly lists `read-region.js` as a candidate to check.* The sibling `list-underground-churches` was hardened in PR #70; this richer endpoint (returns contact info) was missed. `underground-oversight.js` + `list-underground-churches.js` share the missing-AAL2-freshness gap.
- **Nuance:** requires a valid super_admin session (not anon-reachable like P0-1). Under the current symmetry ruling all super_admins hold the UG flag, so the *is_underground_admin* gap may not be reachable by a non-UG admin *today* — but the intended defense-in-depth control is absent, and the missing AAL2-freshness on a UG contact-reveal is unconditional. Classed P0 because it's the exact UG-unmask class Ruth prioritizes, on the single richest UG read.
- **Fix:** add `is_underground_admin` gate + AAL2 freshness to `read-region`, `underground-oversight`, `list-underground-churches`. This IS the KAN-288 sweep — pull it to pre-UAT.

### 🔴 P0-4 — `get_open_prayers(p_church_id)` discloses underground leaders' real names to UNAUTHENTICATED callers (+ de-anonymizes anonymous prayer requests). Found by the Tier-1 anon-function sweep 2026-07-01; chain verified by direct query.
- **Evidence:** `get_open_prayers` is anon-executable + SECURITY DEFINER; its body returns `resolve_display_name(u.*)` (the author's real name) with **NO `pr.anonymous` mask and NO underground exclusion** — contrast its sibling `get_prayer_wall`, which masks both. `get_prayer_wall` (also anon-executable) includes verified underground churches' open requests (its WHERE = `is_active AND status='open' AND c.is_active AND c.verification_status='verified'` — no `type <> 'underground'`), masked as `'Underground Church'` but exposing the real `church_id` UUID.
- **Exploit (no login):** call `get_prayer_wall` → harvest the `church_id`s of rows named `'Underground Church'` → call `get_open_prayers(<that church_id>)` → real display names of the underground leaders who posted. Passing any church_id also returns real names for *anonymous* prayer requests (app-wide de-anon).
- **Fix:** add `CASE WHEN pr.anonymous THEN NULL …` + underground name-mask/exclusion to `get_open_prayers` to match `get_prayer_wall`; scope `p_church_id` to the caller's own church (or gate the function). This is the "masking lives in the RPC and one RPC forgot" pattern again.

### 🟠 Confirmed P1 batch (verified via file read / grep / query)
- **Three TIER-1 admin actions have no step-up / no AAL2 freshness** — `deactivate-church.js`, `reinstate-church.js`, `rag-override.js` = `verifySuperAdmin` + audit + effect, no `validateStepUp` (sibling `update-church-details.js:82-91` shows the correct pattern). A stolen/stale super_admin session can take a church offline or flip its RAG safety signal without fresh TOTP.
- **`approve-heartcry-feed.js`** publishes decrypted heartcry text to the public feed with no step-up (mitigated: `post_to_feed=true` opt-in rows only).
- **`find_similar_churches` returns underground church NAME** as a signup existence-oracle (siblings `find_church_by_code`/`find_parentable_churches` exclude UG; city can't leak — NULL by CHECK).
- **`get-nearby-churches` config drift** — live `verify_jwt=true`, local `config.toml=false`; a CLI redeploy honoring config flips an authenticated GPS endpoint anonymous.
- **4 of 5 pre-auth anon RPCs fail OPEN on Upstash outage** (`check-email-available`, `create-account`, `register-church`, `register-church-delete`) — contradicts the locked fail-CLOSED invariant; `join-underground-church` correctly fails closed.
- **`react-router` 6.30.3 open-redirect** (GHSA-2j2x-hqr9-3h42) in admin — the one runtime-facing dependency vuln; non-breaking `npm audit fix`.
- ~~**Mobile `useResolvedLeaderAuthor`**~~ — **RESOLVED, de-escalated to P2.** Traced 2026-07-01: it does a direct client `.from('users').eq('id', authorId)` for the announcement author's row; `users` RLS is confirmed ENABLED and SELECT is self-only (`users_select_own`) + super_admin (`users_admin_select`). So a regular leader's device receives NULL for another leader's row → the component stays masked by default. The real name only reaches a **super_admin** (already authorized to see all). Not a leak to regular leaders. Two residual notes: (a) **P2 defense-in-depth** — refactor to a pre-masked SECURITY DEFINER RPC (like `get_comments`) *before* anyone ever adds a cross-leader `users` SELECT policy, which would instantly make the client-side masking load-bearing and leak anon leaf columns to every device; (b) **functional side effect** — under current RLS, non-anon announcement author names won't render for regular-leader viewers (they'll all show masked), which may or may not be intended.

---

## 2. Executive summary

Replant's **underground-protection architecture is genuinely strong** — location is structurally unleakable, two-person integrity ceremonies are DB-constraint-enforced, the T3 evidence tier is correctly locked out, DELIVER-ALWAYS is airtight at the SQL layer, and server-side masking (CommentThread, CamlView's early-return) is model work. That is the good news, and it is substantial. The bad news is **four P0 UAT blockers plus a UG-onboarding blocker** — all verified in main context (three from static analysis + live PoC, one from the anon-function sweep, one from the live device test): (1) an unauthenticated caller can read the entire Vault — including the heartcry encryption key and the Resend key — via `get_secret_by_name`, which the anon role can execute; (2) **any authenticated leader can self-promote to the Manager admin tier** by self-setting `public.users.is_top_tier_admin=true` — which the access-token hook mints straight into their JWT — gaining heartcry decryption, team management, and promotion approval, and can also self-verify their own account and church (the escalated, fully-traced state of KAN-221, and the single worst finding here); (3) `read-region.js` unmasks an underground leader's real name and contact details behind a super_admin claim alone, with no `is_underground_admin` gate and no fresh-TOTP; and (4) `get_open_prayers` discloses underground leaders' real names — and de-anonymizes any anonymous prayer request — to unauthenticated callers (masking that its sibling `get_prayer_wall` applies but this RPC omits). Separately, a **UG-onboarding blocker**: underground church approval never cascades verification to the founding leader, and no admin surface can rescue them — proven live. Beneath those sit a coherent P1 tier: three TIER-1 destructive admin actions ship without step-up, four pre-auth RPCs fail open instead of closed, `find_similar_churches` leaks an underground name, `messages` direct-INSERT bypasses DELIVER-ALWAYS flagging, `prayer_requests`/`testimony` are directly readable (de-anon), and `list-pending-underground` over-fetches exact UG country to the admin browser. **The security posture is ~80% excellent and ~20% dangerous**, and the dangerous fraction concentrates in exactly the places that matter most for persecuted-leader safety: secret custody, the verification trust gate, and underground unmasking. Two P0s (Vault, get_open_prayers) are reachable with **no authentication at all**. None requires a code rewrite — each is a REVOKE + rotation, a column-grant revoke + RPC, gate additions, an RPC masking fix, and a one-line verification cascade. **UAT must not open until all four P0s + the UG cascade blocker are closed;** P0-1 warrants break-glass treatment ahead of the normal fix cycle because its exposure window is unknown. Separately, the testing and i18n posture is thin (no CI test gate; the UG-critical and escalated-cases clusters are untested; zero i18n infrastructure for a global-leader base) — not UAT-blocking, but the roadmap should name it now.

**UAT blockers (5):** P0-2 (any authenticated leader self-promotes to Manager — full authorization collapse) · P0-1 (Vault readable by anon) · P0-4 (get_open_prayers unmasks UG leaders to anon) · P0-3 (read-region UG unmask) · UG-onboarding cascade blocker (approved UG church strands its founding leader, no admin recovery). Two are unauthenticated (P0-1, P0-4).
**Top 3 things that work notably well:** underground location is structurally unleakable (three independent layers) · two-person integrity is a DB-level impossibility to bypass and T3 is correctly locked out · audit-first ordering + append-only audit_log + no-secrets-in-logs is honored consistently across both backends.

---

## 3. UAT-readiness verdict per subsystem

| Subsystem | Verdict | Load-bearing reason |
|---|---|---|
| Onboarding + auth | 🔴 NEEDS-FIX | P0-2 self-promote-to-Manager + self-verify; 4/5 anon RPCs fail-open |
| Home tab | 🟢 READY | `useResolvedLeaderAuthor` masking resolved to P2 (RLS confirmed self-only — no anon-name leak to regular leaders) |
| Church tab | 🟢 READY | UG viewer guards correct; anon rendering correct; minor P3 (network_id pill no-op) |
| Prayer Wall | 🟢 READY | Server-masked; empty/error states covered |
| Persecuted | 🟢 READY | No P0/P1 surfaced |
| Connect | 🟢 READY | Covenant gate in SecureStore; server-masked threads |
| Underground sub-flows | 🔴 NEEDS-FIX | P0-3 read-region unmask; P1 find_similar_churches name-oracle; **visibility-flip (KAN-274) unbuilt on mobile → that piece is DEFER** |
| Admin verification queue | 🟠 NEEDS-FIX | Endpoint gates OK, but P0-2 lets leaders self-verify, undermining the queue's purpose |
| Admin Pastoral + Flagged | 🟢 READY* | Gates + IDOR defense strong; *dispose/reach-out incomplete (KAN-295/296 Backlog) |
| Admin Escalated Cases | 🟠 NEEDS-VERIFICATION | Code shipped (migrations live, PR #71 merged) but Jira Backlog + **zero automated tests**; 2-eyes enforced at BE |
| Admin UG Oversight | 🔴 NEEDS-FIX | P0-3 + KAN-288 sweep incomplete; AAL2-freshness gaps on UG reads |
| Admin Heartcry Inbox | 🟠 NEEDS-FIX | P1 approve-heartcry-feed no step-up; heartcry encryption undermined by P0-1 |
| Admin Team Mgmt | 🔴 NEEDS-FIX | Admin-flow logic is correct ("super_admin never approves" holds; dual-source sync correct) BUT P0-2 lets any leader self-mint `is_top_tier_admin` → the whole tier model is bypassable at the DB layer |
| Admin Content (Scripture + Announcements) | 🟢 READY | Opened to all admin tiers per matrix; no findings |
| Realtime + Notifications | 🟢 READY* | messages/branches/branch_members are the documented, RLS-filtered messaging-realtime design; *verify RLS-on-broadcast for `connection_requests` + `admin_tier_promotions`; underground correctly uses event-only tables (no PII in publication) |
| UG evidence lifecycle | 🟢 READY | Private bucket + deny-all storage RLS + revoked grants + TTL-300s signed URLs = gold standard |
| Audit + observability | 🟢 READY* | Audit-first + append-only enforced; *no monitoring/alerting (roadmap) |
| Deploy story | 🟠 NEEDS-FIX | No CI test gate; forward-only migrations (no down-migrations); config-drift risk (get-nearby-churches) |

---

## 4. Compliance findings (Replant invariants + rulings)

| # | Invariant / ruling | Verdict | Evidence |
|---|---|---|---|
| DELIVER-ALWAYS (both send paths) | ✅ HELD | `messages` INSERT writes `flagged`/`flag_reason` as plain bound values, no gating branch; `if(flagged)` side-effects strictly post-commit, errors swallowed (`send-message/handler.ts:243`, `internal-handler.ts:211`) |
| `churches_public` excludes underground | ✅ HELD | View definition carries `WHERE type <> 'underground'`; `churches_admin` too |
| `underground_no_location` (NULL city/lat/lng) | ✅ HELD | CHECK verified; even brave UG gets NULL — confirmed structurally in read-region output |
| UG masking in search RPCs | 🟠 PARTIAL | `search_leaders`/`get_invite_candidates` mask correctly, but **`find_similar_churches` does NOT exclude UG (P1)** |
| verify_jwt posture per fn | 🟠 HELD-with-drift | All 15 live values correct; **local `get-nearby-churches/config.toml=false` drift (P1)** |
| audit-first (KAN-117) | ✅ HELD | audit_log INSERT before effect across the admin surface (two reasoned exceptions) |
| audit_log append-only | ✅ HELD | `prevent_audit_log_mutation` BEFORE UPDATE/DELETE present on audit_log + audit_log_underground |
| 4-tier MFA freshness | 🔴 GAP | `deactivate-church`/`reinstate-church`/`rag-override` (TIER-1) + `approve-heartcry-feed` carry NO step-up/AAL2-freshness (P1); `read-region` UG-reveal no freshness (P0-3) |
| Tier access matrix | 🟢 HELD | approve-promotion is manager-only (super_admin rejected); Verification/Pastoral/Flagged/Content open to all admins; Heartcry/UG/Team gated correctly |
| is_underground_admin column-authoritative + dual-source | 🟢 HELD | approve-promotion sets both sources; demote + revoke-tier clear both; grant-to-existing correctly abstains |
| is_top_tier_admin via hook | 🟢 HELD | hook derives from column (column-authoritative); no drift path |
| super_admin claim column-authoritative | 🟠 NOTE | hook derives super_admin + is_underground_admin from JWT app_metadata (not column) — asymmetry vs top_tier; runtime still column-safe on gates (P2, DB agent) |
| Console-opacity (KAN-289) | 🟢 HELD (deferred by design) | admin prod build: no source maps, minified; KAN-289 gated post-QA/UAT |
| Anon identity rules | 🟠 HELD-except-Home | Correct across Prayer Wall / comments / Church profile / CAML; **Home `useResolvedLeaderAuthor` masks client-side (P1)** |
| Idempotency-key on pre-auth signup | ✅ HELD | create-account + join-underground require it |
| RAG-Red forced for UG | 🟠 PARTIAL (P1) | `create-account` forces `rag_status='red'` at signup, but **NO trigger enforces it** — a UG leader can flip `rag_status` off Red post-signup via the Settings toggle (`SettingsScreen.tsx:709`, direct `churches.rag_status` write; P0-2 root cause). Fix = underground-lock trigger + route the toggle via RPC (see P0-2 runbook STEP 3). |
| UG evidence 2-tier (T3 deferred) | ✅ HELD | `evidence_tier` CHECK accepts only `t1_referral`/`t2_live_call`; no `t3` value present |
| UG 2-eyes (proposer≠confirmer) | ✅ HELD | `no_self_confirm` CHECK — DB-level impossibility |
| Escalated 2-eyes (proposer≠approver) | ✅ HELD | `ecp_no_self_approve` CHECK + BE enforcement (proposer_tier, category-required, quorum) |
| Rate-limit fail-CLOSED on anon RPCs | 🔴 GAP | 4/5 fail OPEN (P1) |
| Comp-delete on create-account RPC failure | ✅ HELD | orphan auth user compensating-deleted |

---

## 5. Security findings — 50-item vibecoded checklist + Replant additions

Compact verdicts (GAP items detailed above / in `_working/`). SAFE unless noted.

| # | Item | Verdict | # | Item | Verdict |
|---|---|---|---|---|---|
|1|Exposed DB creds|✅ SAFE|26|JWT weak/leaked/reused|✅ SAFE|
|2|Public .env files|✅ SAFE (gitignored; JWT_SECRET not VITE_)|27|Overly permissive CORS|🟠 GAP (admin fns `ACAO:*` P2)|
|3|Hardcoded API keys|✅ SAFE (anon/publishable only)|28|Rate limits missing|🟠 GAP (4/5 anon fail-open P1)|
|4|Weak/missing auth|🔴 GAP (P0-2)|29|Public test/staging envs|❔ NEEDS-VERIFICATION|
|5|No authz checks|🔴 GAP (P0-3, TIER-1 P1)|30|Default creds|✅ SAFE|
|6|Users access others' data|🔴 GAP (P0-3; read-region; Home P1)|31|Webhook no sig verify|🟠 GAP (Netlify Forms unsigned P2)|
|7|Open DB read/write|🔴 GAP (P0-2 column grants; P0-1)|32|Payment checks FE-only|N/A (no payments)|
|8|Misconfigured Supabase|🔴 GAP (P0-1 vault fn; find_similar UG)|33|IDOR|🟠 GAP (read-region; else strong)|
|9|Admin routes unprotected|✅ SAFE (strong BE gates)|34|APIs trust user IDs/roles|🔴 GAP (P0-2 self-write role/verif)|
|10|Debug pages in prod|✅ SAFE (console.logs to strip P2)|35|Logs w/ tokens/PII|✅ SAFE (verified clean both BEs)|
|11|Build logs leak secrets|✅ SAFE|36|Source maps in prod|✅ SAFE (none — both repos)|
|12|Verbose errors leak stack|🟠 MOSTLY (admin passes raw `error.message` P3)|37|Dependency vulns|🟠 GAP (react-router open-redirect P1)|
|13|Leaked repos/history|❔ NEEDS-VERIFICATION|38|Outdated packages|🟠 NEEDS-FIX (P2)|
|14|Secrets in frontend JS|✅ SAFE (verified)|39|Prompt injection (AI)|N/A (regex-only, no prod LLM)|
|15|Client-side-only checks|🟠 GAP (Home masking P1)|40|AI tools access w/o perms|N/A|
|16|Missing input validation|✅ MOSTLY SAFE|41|Excessive DB perms for app user|🔴 GAP (P0-1, P0-2 grants)|
|17|SQL injection|✅ SAFE (parameterized/RPC)|42|No audit logs|✅ SAFE — a strength|
|18|NoSQL injection|N/A|43|No monitoring/alerting|🟠 GAP (none — roadmap P2)|
|19|XSS|❔ NEEDS-VERIFICATION (React-escaped; admin has no-dangerouslySetInnerHTML test; website inline handlers P3)|44|No backup/restore plan|❔ NEEDS-VERIFICATION (auto-backups; no restore drill confirmed P2)|
|20|CSRF|✅ SAFE (token auth, not cookies)|45|Public internal dashboards|✅ SAFE|
|21|Insecure file uploads|✅ SAFE (MIME allowlist + EXIF strip + private bucket)|46|Missing security headers|🟠 GAP (website ZERO; admin missing HSTS/Permissions-Policy P2)|
|22|Path traversal|✅ SAFE (ID-derived paths)|47|Cookie flags|❔ N/A (localStorage session — XSS-exfil note)|
|23|SSRF|✅ SAFE (no user-controlled outbound)|48|Unencrypted sensitive data|🔴 GAP (heartcries pgp-encrypted BUT P0-1 exposes the key)|
|24|Broken password reset|❔ NEEDS-VERIFICATION (PKCE→OTP KAN-198 not deep-audited)|49|Poor tenant isolation|🟠 GAP (P0-2 church_id self-reassign)|
|25|Weak session mgmt|🟠 MOSTLY (AAL2/PKCE/AES-GCM wrap; TIER-1 freshness gaps P1)|50|Over-trusting generated code|— (this audit is the mitigation)|

**Replant-specific additions:** UG protection posture ✅ strong except P0-3 · duress code (KAN-274) — **flow unbuilt on mobile, cannot be exercised** · envelope encryption Posture C ✅ (bucket private, TTL-300s, EXIF-scrub fn exists) · BE gate stack ✅ except the P0-3/P1 endpoints · storage bucket policies ✅ gold-standard · Vault key hygiene 🔴 P0-1 · rate-limit fail-mode 🔴 4/5 fail-open · idempotency ✅ · comp-delete ✅.

### Wave-2 verification closures (security follow-up, 2026-07-01) — all 6 resolved, no new P0/P1
- **Password reset — ✅ SAFE.** Admin `send-password-reset.js` is audit-first (row before `generateLink`), Founder + `can_manage_admins` gated, 60/min, generic `RESET_FAILED`, behind `verifySuperAdmin` (not a public oracle). Mobile `ForgotPasswordScreen` shows success in `finally` with "if an account exists" copy — byte-identical for existing vs non-existing email. TTL/single-use delegated to Supabase GoTrue. (Closes #24.)
- **Committed secrets — ✅ SAFE.** Only `.env.example` ever committed (all 3 repos, `--diff-filter=A`); real env gitignored; admin `JWT_SECRET` gitignored + not `VITE_`-prefixed; `.gitleaksignore` holds published founder UUIDs, not secrets. **P2:** `replant/.gitignore` ignores only `.env*.local` — widen to bare `.env`/`.env.production`. (Closes #13/#14.)
- **Public staging env — ✅ SAFE.** Single Supabase project everywhere; no `config.toml`; `eas.json` "preview" is a build profile. **P3:** confirm Netlify deploy-preview auto-publish is off (dashboard). (Closes #29.)
- **Backup/restore — 🟠 GAP P2 (roadmap).** No documented restore procedure / RPO-RTO / drill; Supabase auto-backups at platform level but the restore path is untested. (Closes #44 as GAP.)
- **XSS — ✅ SAFE (admin).** Zero `dangerouslySetInnerHTML`; CI guard `no-dangerously-set-inner-html.test.js` fails the build on any use. **P2 (website):** inline `on*=` handlers + inline `<script>`, no CSP — move to external JS before adding a website CSP. (Closes #19.)
- **Verbose errors — 🟠 GAP P2.** 19 admin fns return raw Supabase `error.message` (leaks SQLSTATE/table/RLS-policy names), e.g. `reject-leader.js:92`, `mark-heartcry-responded.js:35`, `rag-override.js:58`. **P2 only** because all sit behind `verifyAnyAdmin`/`verifySuperAdmin` — recipient is always a vetted admin, never the public. Fix: generic literal to client + `console.error` for ops. (Refines #12.)
- **Header posture clarified:** admin `netlify.toml` DOES ship `X-Frame-Options: DENY` + `nosniff` + `Referrer-Policy` + a CSP with `connect-src` locked to `*.supabase.co`. Admin needs only **HSTS + Permissions-Policy**; the **public website** is the zero-header surface. (Refines #46.)

### Post-hoc RLS client-surface sweep (2026-07-01 — closing the audit's biggest methodology gap)
P0-2's write-hole was proven on `users`/`churches` but not systematically checked on every client-exposed table; and the READ surface (can a client bypass the masking RPCs and hit tables directly?) was not swept at all. Ran both in main context. RLS is enabled on all sensitive tables. Results:

**Cleared — verified safe at the TABLE layer (protect these):**
- **Underground churches are NOT directly client-readable** — `churches_underground_restrict` (`type <> 'underground' OR id = caller's own church`) + `churches_select_active` (`… AND type <> 'underground'`): a leader's direct `.from('churches').select().eq('type','underground')` returns zero foreign UG rows. UG masking is enforced at RLS, not only the `churches_public` view.
- **Two-eyes ceremonies safe at the access layer, not just the CHECK** — `underground_verification_proposals.uvp_no_direct_write` = `ALL USING(false) WITH CHECK(false)`; `escalated_case_proposals`/`escalated_cases` have zero client policies (default-deny). Writes only via SECURITY DEFINER RPCs.
- `heartcries` read is own-only (no cross-leader ciphertext read; no client UPDATE → no `feed_approved` self-approve); `messages` read participant-only; `connection_requests` own-only; `announcements` not leader-writable; `underground_evidence_files` — authenticated holds NO table privileges.

**NEW findings the agent-based audit missed:**
- 🟠 **P1 — `prayer_requests` + `testimony` are directly SELECT-able raw by any authenticated leader** (`… auth.role()='authenticated' AND is_active`). The row carries `user_id`, `church_id`, `is_anonymous`, content. Anonymity is enforced ONLY in the `get_prayer_wall` RPC — a client hitting the table bypasses it, de-anonymizing anonymous posts at the **church level** (resolve `church_id`→name via readable non-UG `churches` rows) and correlating authorship via `user_id`. UG-church posts are partly protected (their `church_id` can't be resolved to a name) but the UUIDs + `is_anonymous` still leak. **Violates the anon-identity invariant.** Fix: tighten the SELECT policy so non-owners can't read author refs — force reads through the masking RPC, or mask leaf columns at the table.
- 🟠 **P1 — `messages` direct INSERT bypasses the send-message/send-branch-message edge functions.** `messages_insert` checks only `sender_id IN own`; NO trigger does keyword flagging or branch-membership (confirmed: only triggers are `trg_auto_route_ug_flagged` AFTER UPDATE + `trg_flip_escalated_case_on_leader_reply` AFTER INSERT). So a leader can write `messages` directly with any `branch_id` (inject into a branch they're not in) and **evade DELIVER-ALWAYS keyword flagging entirely** (the flag is written by the edge fn, not a trigger) — an admin-moderation blind spot on a safety-critical surface. Fix: enforce flagging + membership in a BEFORE INSERT trigger, or revoke direct INSERT and force the edge functions.
- 🔵 **P2 — `comments` exposes raw `author_id`** on direct read (masking only in `get_comments`). Lower severity (`author_id`→`users` is self-only) but anonymous-comment authorship is correlatable by `author_id`.

**Anon-function surface — now CLASSIFIED (all 85, 2026-07-01):** 14 trigger-only (grant moot); ~30 admin-gated (self-assert `fn_assert_*` on entry — verified on the UG list/notes/evidence readers + admin-promotion, so the grant is moot); ~18 self-filtered by `auth.uid()`; signup lookups `find_church_by_code`/`find_parentable_churches` correctly EXCLUDE underground; `get_prayer_wall`/`get_testimonies`/`get_landing_testimonies` correctly mask UG (`'Underground Church'`, country NULL) + anonymous (NULL name). **Mutable-search-path on the 18 fns DOWNGRADED to P3** — `has_schema_privilege('anon'|'authenticated','public','CREATE') = false`, so search-path shadowing isn't possible; pin anyway as hygiene.

**🔴 NEW — P1 (P0 for underground): `get_open_prayers(p_church_id)` de-anonymizes prayer authors and leaks underground leaders' real names.** Anon-executable + SECURITY DEFINER, takes an arbitrary `church_id`, and — unlike its sibling `get_prayer_wall` — has **NO `anonymous` mask and NO underground exclusion**: it always returns `resolve_display_name(u.*)` (author's real display name). Chain: unauthenticated caller reads `get_prayer_wall` (UG rows masked but real `church_id` UUID exposed) → harvests UG `church_id`s → `get_open_prayers(<ug church_id>)` → real names of underground leaders + de-anon of any anonymous prayer request app-wide. Single-omission pattern (every other prayer/testimony RPC masks; this one forgot). Fix: add `CASE WHEN pr.anonymous THEN NULL` + underground handling to match `get_prayer_wall`; scope/gate the `church_id`.

**Self-service WRITE functions verified (no IDOR):** `remove_connection_request`/`withdraw_connection_request` reject `sender_id <> caller`; `fn_send_reply_to_team` checks the question is the caller's church; `update_prayer_request` requires `user_id = caller AND status='open'`; `celebrate` blocks self-celebrate. Minor: `celebrate`/`update_prayer_request` compare `auth.uid()` to `public.users.id` (echoes the fixed `stand_in_the_gap` auth_id-vs-id bug — likely fail-closed, verify).

### Dashboard gate-presence sweep (2026-07-01) — all 91 Netlify functions
Scanned every function for gate coverage. **Result: strong.** Every function carries an appropriate gate (`verifyAnyAdmin` / `verifySuperAdmin` / `makeUndergroundGatedHandler` / inline app_metadata admin check). The apparent "ungated" set were all explained: deprecated `410` stubs (`decline-underground-proposal`), public-by-design email/intake handlers (`church-intake`, `join-welcome`, `volunteer-welcome`), cron (`scheduled-underground-*`), and inline-gated (`activate-account` — verifies JWT + admin `app_metadata` + own-account-only).
- **Only real gate gap: `read-region` + `underground-oversight` are `verifySuperAdmin`-only, missing `is_underground_admin`** (P0-3; `list-underground-churches` already carries both after PR #70).
- **🔵 P2 (new): `church-intake.js`** is an unauthenticated DB-write + email-send (public website intake form) with rate-limiting only *asserted* ("handled at the Netlify edge layer") and no CAPTCHA/honeypot — a spam / email-bomb / pending-church-flood surface. Verify the edge rate-limit is actually configured + add bot protection (ties to the website-forms-no-honeypot note).
- **🔵 P3 (new): `activate-account`** writes its audit row AFTER the password update (reasoned best-effort, but a 3rd audit-after exception beyond the 2 the agent noted).
- **🟠 P1 (console-opacity / KAN-289 — CONFIRMED LIVE via DevTools, 2026-07-01): `list-pending-underground` over-fetches precise underground church `country` to the admin browser.** The list UI renders only the macro-region (`region_admin_only`), but the API response body carries the exact `country` for every UG church (Afghanistan / Syria / Eritrea / Uzbekistan / Tunisia / Venezuela / Sudan / Brunei — real dangerous location data), plus `pending_proposal_admin_notes`, `contact_channel`, `evidence_tier`. Church **names ARE correctly excluded** from the list — so the masking is inconsistent (name hidden, exact country shipped). Gated to UG admins (not unauthenticated), but for the console-opacity threat model (a curious/compromised admin session in DevTools) this exposes exact UG locations beyond the UI's macro-region masking. This is the concrete instance of KAN-289 on the most sensitive surface. Fix: the list endpoint should return only rendered fields (ref, macro-region, SLA, state, claim); move `country` + proposal detail to the per-row detail fetch (separately gated + audited). Re-sweep every list endpoint for the same UI-vs-payload gap. **Reassuring contrast (verified live):** the sibling `list-underground-churches` endpoint is correctly minimal — `id` + `region_admin_only` + `is_active` + `verification_status` + `created_at`, **no country, no name** — so the team knows the right pattern; `list-pending-underground` simply drifted. Fixable drift in one endpoint, not systemic.
- **Live admin smoke (2026-07-01, super_admin session):** Underground Oversight loaded with **0 console errors**, all requests 200; underground data flows through the gated Netlify functions (`list-pending-underground`, `underground-list-siblings`), not direct table reads; the Leaders tab is confirmed second-leader-only (see punch-list #12).
- **Still agent-level (not individually re-read):** per-function tier-CORRECTNESS (right tier per the matrix) + audit-first ordering across all 91 — medium-high confidence (helper + P0/P1 paths verified directly).

---

## 6. Testing gaps

- 🟠 **P1 — No CI test gate in either repo.** Only workflow is `update-changelog.yml`; `npm test`/`deno test`/`vitest` run nowhere automatically. Tests exist but nothing enforces them on push/PR.
- 🟠 **P1 — UG-safety-critical edge fns have ZERO tests:** `join-underground-church`, `reveal-join-code` (+ `accept-connection-request`, `admin-open-heartcry`, `get-nearby-churches`).
- 🟠 **P1 — Escalated-cases + UG-proposal + admin-promotion clusters untested:** of 91 admin functions only ~21 (~23%) have tests. `propose/approve/close-escalated`, `propose/confirm-underground`, `underground-claim`, `hard-delete`, `approve-admin-promotion`, `demote-admin`, `grant/revoke-tier` all uncovered.
- 🟠 **P1 — No RLS-policy test harness.** The tier-visibility model — the core security guarantee, and exactly where P0-2 hid — has no automated proof that a wrong-tier / wrong-column caller is denied. **A single RLS fixture set would have caught P0-2.**
- 🟢 Where tests exist they're good: 896 admin + 387 mobile-edge cases, security-focused suites (`sensitive-actions`, `aal2-freshness`, `no-dangerously-set-inner-html`, matcher patterns never inlined).

---

## 7. Performance findings (from advisors — no live EXPLAIN run yet)

- 🔵 **42 unindexed foreign keys** — add covering indexes on FK columns on the hot tables (messages, comments, escalated_case_proposals, underground_evidence_files). P2.
- 🟡 **57 `auth_rls_initplan`** — RLS policies re-evaluate `auth.<fn>()` per-row; wrap in `(select auth.uid())` to evaluate once. Meaningful at 100k scale. P2.
- 🟡 **28 multiple-permissive-policies** — overlapping permissive policies on the same table/role multiply row checks. P2/P3.
- 🔵 **23 unused indexes** — candidate drops after confirming no rare-but-critical query depends on them. P3.
- 🟠 **Admin bundle: single 903 KB monolithic JS chunk**, no code-splitting (0 dynamic imports). P2 — fine for admins on good connections, poor for anyone throttled.
- **Not yet profiled** (Wave 2): `get_prayer_wall`, `get_heartcry_feed`, `list-pastoral-queue`, `v_escalated_inbox`, `get_leader_thread_list` — confirmed to exist; need `EXPLAIN ANALYZE` under realistic data.

---

## 8. UX + voice findings

- 🟢 Voice register is clean: no stale "Overseer" in mobile leader surfaces; **one P3 leftover** — `PromoteAdminModal.jsx:178` (admin) still shows an "Overseer" placeholder in the prod bundle → should read "Manager".
- 🟢 Hamburger placement correct (Home tab only); Church tab has its own chrome; `covenant_ack` in SecureStore; no `expo-blur`.
- 🟢 Anon rendering correct on Prayer Wall / comments / Church profile ("A fellow {role}", not "Name withheld") / CAML — **except** Home feed's client-side path (P1, §Home).
- 🟢 Empty + error states covered on all four primary mobile lists.
- 🟢 Typography: `scriptureItalic` scoped to scripture/editorial/witness.

---

## 9. Accessibility findings (mobile — Lens 6)

Strong baseline: 210 `accessibilityLabel` + 245 `accessibilityRole`; **zero `allowFontScaling={false}`** (OS Dynamic Type respected); 143 explicit ≥44px targets + 103 `hitSlop`. No systemic P1/P2 gap surfaced. Admin dashboard keyboard-nav not yet exercised (Wave 2, Playwright). P3: spot-audit color contrast against the Replant palette in a dedicated pass.

---

## 10. I18n roadmap (Lens 7)

🟠 **P1 (post-MVP roadmap, not UAT-blocking):** zero i18n infrastructure — no framework, no `t()` calls, no `expo-localization`, no RTL for Farsi/Arabic/Hebrew, ~490 hardcoded English strings in mobile, scattered device-locale `toLocaleDateString` with no explicit locale. For a leader base spanning Iran, China, Egypt, and Nigeria's Middle Belt, English-only hits a wall fast. **Recommended first step:** adopt `i18next` + `react-i18next` + `expo-localization`; freeze the bleed by wrapping new strings in `t()`; back-fill mobile-first (onboarding + the 18 `Alert` dialogs); RTL as a separate workstream. Underground-safe language-pack considerations (no telltale locale metadata) fold into that workstream.

---

## 11. Documentation vs code drift

- **Jira ↔ code drift (escalated-cases):** KAN-293 / KAN-295 / KAN-296 show **Backlog** in live Jira, but their migrations are applied (`20260701000001-000007`) and PR #71 ("Phase 3 BE + Phase 4 admin FE") is merged. The feature is substantially shipped while its tickets read Backlog. Per "only Founder marks Done," likely just un-transitioned — but it means UAT scoping can't rely on Jira status for this cluster. KAN-292 is correctly In Progress.
- **KAN-288 is Backlog but is a live P0 source** (read-region). Elevate.
- **KAN-221 is Backlog + only partially implemented** — the WITH CHECK was hardened (row-scope) but the column-scope the ticket calls for never landed (P0-2). The ticket text predates the partial fix.
- **KAN-274 (UG visibility-flip / relay-token)** confirmed Backlog + unbuilt on mobile — the admin side expects a 4-digit relay token the mobile app never surfaces. The UG visibility-change flow does not function end-to-end; `validate-relay-token` returns false in real use.
- **Requirements doc `docs/replant-requirements-v2_7.html`** — line-by-line drift pass done (§16). Strong coverage through 2026-06-18; nearly all drift is post-that-date workstream. **The most important pattern: the doc describes a *safer* posture than the code enforces** — it presents admin as "super-admin only" when live it's 3 tiers with regular admins reading leader PII/DM content, and Heartcry/UG as super-admin-only when a non-founder manager can decrypt heartcries. Anyone threat-modeling from the doc would underestimate the leader-data exposure surface. Fix those rows first.
- **Lucid system map** — deep cross-check done (`_working/lucid-map-crosscheck.md`). The 3 known drifts confirmed real (doc 05 is wrong two ways — omits the 6th state `manager_review` AND still lists `awaiting`). NEW drift: (a) **docs 04/05/08 present verification / RPL-ID minting / tier promotion / UG name-visibility as admin-only audited ceremonies, but the live DB lets a verified leader perform every one directly (P0-2)** — diagram 08 (Verification Lifecycle) is the one most likely to mislead a builder into assuming enforcement that isn't there; (b) docs 06.7/04 draw the KAN-274 visibility-flip/relay-token flow at endpoint granularity with no "roadmap" marker though it's unbuilt; (c) doc 11 lists `conversations` in the Realtime publication — it is not (live pub = the 7 tables verified above); (d) doc 06.5 gate string `assertAtLeast("super_admin")` contradicts the locked "Managers may sponsor" ruling.

---

## 12. Operations findings

- 🟠 **No CI/CD test gate** (see §6) — deploys are not test-guarded. P1.
- 🟠 **Migrations are forward-only, no down-migrations**; the recent escalated-cases batch uses bare `DROP CONSTRAINT` / `DROP VIEW` (not re-runnable). Rollback of a bad migration is manual. P2.
- 🟠 **No monitoring/alerting or incident-response runbook** (acceptable at MVP scale, name as roadmap). P2.
- 🔴 **Secrets rotation:** P0-1 forces immediate rotation of all five Vault secrets; there is no documented rotation cadence for Supabase/Resend/Mapbox/Upstash/Vault. P1 to establish.
- **Config-drift risk:** local `get-nearby-churches/config.toml` diverges from live — a CLI redeploy could flip verify_jwt. Reconcile. P1.
- Deploy story otherwise sound: admin = Netlify preview-per-branch → Founder smoke → merge = prod; mobile = Expo (EAS). Website = `netlify deploy --prod`.

---

## 13. What works well (protect these from future drift)

1. **Underground location is structurally unleakable** — `underground_no_location` CHECK (NULL lat/lng/city even for brave UG) + both `churches_public`/`churches_admin` views excluding `type='underground'` + RPC-layer masking. Three independent layers; read-region output confirms city/country come back blank even when a gate is otherwise weak.
2. **Two-person integrity is a DB-level impossibility to bypass** — `no_self_confirm` (UG) and `ecp_no_self_approve` (escalated) CHECKs; T3 evidence tier correctly locked out of the `evidence_tier` CHECK.
3. **UG evidence storage is gold-standard** — private bucket + ALL-deny `storage.objects` policies + revoked table grants + UG-admin-gated, TTL-300s, append-only-audited signed-URL RPC.
4. **DELIVER-ALWAYS is airtight at the SQL layer** in both independent send paths — flag is a plain bound value, side-effects strictly post-commit.
5. **Audit-first + append-only + zero-secrets-in-logs** across both backends — a genuine strength; `writeAuditLog` centralizes the canonical shape and rejects unknown actions before the DB CHECK fires.
6. **`CamlView` UG early-return** (`:200-202`) — first statement in the body, before any hook / `locationManager.start()` / Mapbox / `get-nearby-churches`; hooks-order-safe. Model implementation.
7. **`CommentThread` server-side masking** — `author_id` never sent to client; all four `mask_reason` cases handled with correct avatars.
8. **The Founder "never" holds** — `approve-admin-promotion` is genuinely manager-only; super_admin cannot approve (rank check, no shortcut).
9. **is_underground_admin dual-source sync** is correct across all three tier-writers.
10. **`get-nearby-churches` 403-before-body-parse** — an underground caller's GPS never enters the parser/RPC/Postgres-log/Upstash key.
11. **submit-heartcry** encrypts before insert, writes only ciphertext, static triage email (no name/content/preview) — the leader's words never rest in the clear or hit a log.
12. **Admin FE ships no secrets and no source maps**; active bearer-token scrubber strips `Bearer …` from error bodies (`error-routing.js:34`).

---

## 14. What could work better

- **RLS row-scope vs column-scope discipline.** P0-2 exists because a WITH CHECK was added for rows but the privileged-column GRANTs were never revoked. Establish the pattern: privileged columns (`verification_status`, `is_active`, `church_id`, tier flags) are NEVER client-writable — always via SECURITY DEFINER RPC. Audit every client-exposed table for the same shape.
- **Symmetric hook derivation.** `is_top_tier_admin` derives from the column; `super_admin` + `is_underground_admin` derive from JWT app_metadata. Make all three column-authoritative for one mental model and zero stale-claim risk — **but only once those columns are write-protected from clients (P0-2's fix), or column-authoritative literally means self-promotion.**
- **Gate-stack as a wrapper, not a convention.** The `_lib` helpers are strong, but TIER-1 endpoints opt into step-up individually and three forgot. A `makeTier1Handler(...)` / `makeUndergroundGatedHandler(...)` wrapper that bundles verify→assert→AAL2→step-up→rate-limit→audit would make omission structurally impossible (KAN-288 already references `makeUndergroundGatedHandler`).
- **Realtime publication should be event-only** everywhere (the locked invariant) — migrate the four PII tables out and use event-table + refetch (the pattern already used for `underground_detail_events`).
- **Fail-closed by default** on anon RPCs — copy `join-underground-church`'s in-memory bucket fallback to the other four.

---

## 15. Recommended memory additions (Ruth to file)

1. **`get_secret_by_name` anon-Vault exposure (P0-1)** — the by-name Vault accessor pattern is dangerous; any `SELECT decrypted_secret … WHERE name=$1` SECURITY DEFINER fn must be service_role-only. Link `[[project_replant_schema_facts]]`.
2. **KAN-221 is live AND worse than filed (P0-2) — privilege escalation, not just self-verify.** `authenticated` retains column UPDATE grants on `users.is_top_tier_admin`/`is_underground_admin`/`verification_status`/`church_id` + `churches.verification_status`/`show_church_name`/`rag_status`; a leader self-promotes to Manager (the hook mints `admin_tier=top_tier` from the column). **This invalidates the `[[top_tier_admin_column_authoritative]]` memory's "no promote-to-Manager path exists / CLOSED, no bug" conclusion** — column-authoritative is only safe with a write-protected column. Update that memory + `[[project_replant_schema_facts]]`. Durable lesson: any column read by an auth hook or a `fn_assert_*` gate MUST be revoked from client write.
3. **read-region is the unremediated KAN-288 tip (P0-3)** — the KAN-288 sweep is a pre-UAT blocker, not a post-launch nicety.
4. **RLS row-scope ≠ column-scope** — a durable process note: adding a WITH CHECK does not protect columns; verify column GRANTs + triggers too.
5. **Escalated-cases Jira/code drift** — code shipped ahead of Jira status; note for UAT scoping.

## 16. Recommended requirements doc 2_7 updates (paste-ready deltas)

Full delta list + **paste-ready HTML blocks grouped by section** in `docs/audits/_working/requirements-2_7-drift.md`. The doc (internally "v4.0", newest content dated 2026-06-18) has strong coverage *through* that date; nearly all drift is post-2026-06-18 workstream it has no rows for. **Reconcile every ticket cite against live Jira before locking paste-blocks in** (CLAUDE.md anchor rule).

**⚠️ Priority — the doc describes a SAFER posture than the code enforces (fix these first, they mislead threat-modeling):**
1. Doc says admin dashboard is **"super-admin only"**; live = 3 tiers (regular / manager / super_admin) with the locked access matrix — **regular admins can read Verification, Pastoral, Flagged, and Content, including DM content + leader PII.** The doc materially understates who sees leader data.
2. Heartcry Inbox + UG Oversight framed super-admin-only; live = **super_admin + manager** (a non-founder manager can decrypt heartcries), regulars excluded. Neither half documented.
3. Underground **second-leader join-code** surface entirely absent (`reveal-join-code`/`join-underground-church` + 4 `underground_join_code_*` columns live) — the mechanism by which a second identity enters an underground church's protected space is undocumented.
4. Flag taxonomy summarized "17 auto + 3 manual" but the doc's own D-46 body pastoral-routes `self_harm` + `pastoral_care_signal` to a separate queue — life-safety routing hidden by the summary line.

**Other deltas (top ~10):** escalated_cases 6-state machine absent · Overseer→Manager rename (enum `top_tier` unchanged) · `para_ministry` missing from enum tables (live `church_type` = 7 values, doc says 6 "final") · KAN-274 UG visibility-flip has no row (log as spec'd-but-unbuilt so it isn't assumed shipped) · Content Section architecture (2026-07-01) absent · KAN-213 profile-setup-flow never stated at screen level as non-underground-only. Housekeeping: live = 15 edge fns (doc versions drifted — create-account v8/register-church v8/auth-status-check v9 vs doc v6/v7); audit-action count "47" likely stale post-escalation (verify `audit_log_action_check` live before re-citing); `evidence_tier` confirmed 2-tier; all `verify_jwt` postures still hold (flagged so they aren't "corrected" by mistake).

---

## 17. UAT blocker punch list (P0/P1 — must land before UAT opens)

**P0 (block UAT):**
1. **P0-1 Vault exposure** — REVOKE `get_secret_by_name`/`decrypt_heartcry_content`/`encrypt_heartcry_content` from anon/authenticated/public; pin search_path; **rotate all 5 Vault secrets. Break-glass — do this first, ahead of the normal cycle.**
2. **P0-2 privilege escalation (self-promote to Manager)** — REVOKE UPDATE from `authenticated`/`anon` on ALL privileged/safety columns of `users` (`is_top_tier_admin`, `is_underground_admin`, `verification_status`, `church_id`, `role`, `is_active`, `auth_id`) AND `churches` (`verification_status`, `verified`, `show_church_name`, `rag_status`, `type`); route privileged writes through SECURITY DEFINER RPCs. Column-scoping the WITH CHECK alone is insufficient — the grants must be revoked. **#1 blocker** (KAN-221 → pre-UAT). Then sweep every other client-exposed table for the same grant shape.
3. **P0-3 read-region UG unmask** — add `is_underground_admin` gate + AAL2 freshness to `read-region`, `underground-oversight`, `list-underground-churches` (execute the KAN-288 sweep).
4. **P0-4 `get_open_prayers` unauthenticated UG-name disclosure** — add `anonymous` masking + underground exclusion to match `get_prayer_wall`; scope/gate `p_church_id`. (Also sweep every RPC that calls `resolve_display_name`/returns a church name for the same missing mask.)

**P1 (ship-blocker soon; strongly advise before UAT):**
4. Add step-up/AAL2-freshness to TIER-1 `deactivate-church`/`reinstate-church`/`rag-override` + `approve-heartcry-feed`.
5. `find_similar_churches` — add `AND type <> 'underground'`.
6. Flip 4 anon RPCs to fail-CLOSED (or Founder ruling to narrow the invariant).
7. Reconcile `get-nearby-churches` config.toml (local→true).
8. `npm audit fix` the react-router open-redirect (+ smoke).
9. Establish a Vault/secret rotation cadence.
10. **(NEW, RLS sweep) `prayer_requests` + `testimony` direct-read de-anonymization** — tighten the table SELECT policy so anonymous authors' `user_id`/`church_id` aren't exposed to non-owners; force reads through the masking RPC.
11. **(NEW, RLS sweep) `messages` direct-INSERT bypasses DELIVER-ALWAYS flagging + branch-membership** — move flagging/membership into a BEFORE INSERT trigger or revoke direct client INSERT.
12. **🔴 (NEW, device test — UG-ONBOARDING BLOCKER, no remediation path) Underground church approval strands its founding leader permanently-pending.** `fn_confirm_underground_proposal` verify-branch updates only `public.churches` (never `public.users`) → the founding leader stays `verification_status='pending'`, gated out of the app. AND **there is no admin path to fix it**: `pending-leaders.js:59` (`.neq('churches.type','underground')`) excludes underground churches from the Leaders-pending queue by design (UG has its own flow), so the founding leader appears nowhere an admin could verify them; `verify-leader.js` exists but is unreachable for this case. Standard churches cascade (KAN-217 "verify_church cascade") and also have the manual queue as a fallback; UG has neither. Verified live: `RPL-02104` + `RPL-02106` both have pending founding leaders. **Every underground church approved through the real 2-eyes flow lands its founding leader in a dead-end — approved church, unusable app, no operator recovery.** Fix: cascade in the confirm-proposal verify branch (`UPDATE public.users SET verification_status='verified' WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL AND soft_deleted_at IS NULL`), mirroring standard. Highest-stakes population — UAT blocker for the UG onboarding path. **Confirmed live on the dashboard (2026-07-01):** the UG Oversight "Leaders" tab is a *second-leader* queue — columns "Ref · Parent church · Applicant · Submitted · Day · State", empty state "No pending second-leader applications"; a founding leader (no parent church) structurally cannot appear there. Leader A has no operator surface anywhere.
13. **(NEW, live smoke — console-opacity / KAN-289) `list-pending-underground` over-fetches precise underground `country`** (+ proposal admin-notes / contact-channel / evidence-tier) to the admin browser though the list UI renders only the macro-region. Trim the list payload to rendered fields (ref, macro-region, SLA, state); move `country` + proposal detail to the per-row detail fetch. Sweep every list endpoint for the same UI-vs-payload gap.

_(Former punch-list item — mobile `useResolvedLeaderAuthor` — RESOLVED to P2 and moved to §18: `users` RLS confirmed self-only, so no anon name reaches a regular leader's device; refactor to a pre-masked RPC is post-UAT defense-in-depth.)_

## 18. Post-UAT roadmap adds (P2/P3)

- CI test gate + RLS-policy fixture harness + tests for UG/escalated/promotion clusters (P1-ish for durability; sequence early post-UAT).
- i18n framework + string extraction + RTL (P1 roadmap).
- Realtime publication → event-only for the 4 PII tables.
- Performance: index the 42 unindexed FKs; wrap RLS `auth.*()` in `(select …)`; code-split the 903 KB admin chunk; profile the 5 heavy RPCs.
- Security headers: website `_headers` (HSTS/X-Frame-Options/nosniff); admin HSTS + Permissions-Policy.
- CORS scoping (drop `ACAO:*` on admin fns); sign Netlify Forms webhooks; strip client console.logs; monitoring/alerting; restore-drill; down-migrations.
- "Overseer" → "Manager" in `PromoteAdminModal.jsx:178`; network_id pill no-op on Church profile.

---

## 19. Audit trail

### Sources read (Session 1, 2026-07-01)
- `CLAUDE.md`, `MEMORY.md` index, `replant_continuous_spec.md` (full), `project_replant_invariants.md`, `project_replant_schema_facts.md`, audit prompt.
- Git state both repos; requirements doc located at `docs/replant-requirements-v2_7.html`.

### Queries I ran directly (main-context verification, read-only)
- `get_advisors` (security 235 lints + performance 151 lints), `list_edge_functions`, `list_migrations` (130).
- ACL + body of `get_secret_by_name` / `decrypt_heartcry_content` / `encrypt_heartcry_content` / `get_heartcry_encryption_key` / `find_similar_churches`; Vault secret NAMES (not values). → P0-1.
- `pg_policies` on `public.users`; `information_schema.column_privileges` (UPDATE, users, authenticated/anon); `pg_trigger` on `public.users`. → P0-2.
- Read `read-region.js`, `approve-heartcry-feed.js`, `deactivate-church.js`, `_lib/supabase-admin.js`; grep `action-names.js` + sibling gate patterns. → P0-3 + P1s.
- Live Jira `getJiraIssue`/JQL: KAN-221/274/288/289/292/293/295/296 (anchor-rule spot-check). → drift findings.

### Wave 1 subagents (opus, read-only) — full evidence in `docs/audits/_working/`
`db-rls-schema` · `edge-functions` · `admin-be-gates` · `admin-fe-exposure` · `mobile-fe` · `deps-testing-i18n`. All 6 returned; every P0 independently re-verified in main context above.

### Raw inventory
Supabase security advisors: 2 ERROR `security_definer_view` (churches_public/admin — intended, view hardening P3), 1 ERROR `rls_disabled_in_public` (spatial_ref_sys — accepted PostGIS FP), 85 anon-executable SECURITY DEFINER fns — **spot-verified 5 of the most dangerous (2026-07-01):** the UG list/notes/evidence readers + admin-promotion all self-gate on line 1 (`fn_assert_underground_admin()` / `fn_assert_top_tier_admin()`), so the broad grant is harmless there; `get_secret_by_name` + the two heartcry-crypto fns do NOT (P0-1). **~75 remain individually unread** — pattern holds but not exhaustively verified. **P3 (new):** cron/maintenance fns (`scrub_user_pii`, `scrub_church_pii`, `fn_hard_delete_expired_soft_deletes`, `expire_*`) are anon-executable with no internal gate — harm limited by their retention-window `WHERE` clauses (only already-due rows), but REVOKE from anon/authenticated as defense-in-depth. Also: 18 mutable-search-path, leaked-password-protection OFF. Performance: 57 auth_rls_initplan, 42 unindexed FK, 28 multiple-permissive, 23 unused-index. Edge fns: 15 live (verify_jwt posture verified correct). Migrations: 130. Admin: 91 Netlify fns. Website: 5 static HTML pages.

### Wave 2 — status
- **DONE + integrated:** Lucid map cross-check · requirements-doc 2_7 drift · password-reset audit · committed-secret scan · staging-env check · XSS · backup posture.
- **Live mobile smoke (Lens 3) — DONE (read-only confirmation):** current working tree **builds + launches clean** (iPhone 17 Pro, iOS 26.3, warnings only). On an existing surface-leader session I confirmed: Home (daily scripture in scriptureItalic + Home-only "Open menu" hamburger + designed empty state + 5-tab nav), The Church (own chrome / CAML horizon switcher, **no hamburger**, surface-viewer CAML path), Prayer Wall (live seed content — DR Congo + Myanmar churches rendered as church-name + region + time, **no leader-name exposure**; Feed/Testimonies/My Prayers/Revelation sub-tabs; own-church empty state). No writes performed. Build health + load-bearing UI invariants confirmed.
- **Underground-viewer device test (Lens 3) — DONE (2026-07-01, real UG test account):** logged in as an underground leader (church verified, leader still pending). **Confirmed LIVE:** the Church tab lands on **CAL (globe) ONLY — no CAML, no "AT MY LOCATION", no location header, no horizon switcher** (contrast the surface leader's CAML view), and the runtime log shows **zero** `mapbox`/`get-nearby`/`locationManager`/`CLLocation`/`geocode` activity for the whole session → the `CamlView` underground early-return holds in the running app. `+N HIDDEN` tally renders (per ruling). Findings from this test: **🔴 UG-onboarding BLOCKER** — UG church approval strands the founding leader permanently-pending with **no admin remediation path** (punch-list #12; `pending-leaders.js:59` excludes UG from the queue by design + the confirm-proposal verify branch doesn't cascade + `verify-leader.js` unreachable for this case). (The numeric "24-72 hrs / 30 days" gate copy is NOT a fingerprint — Founder confirmed it is now universal across all church types; withdrawn.) **Verified-state confirmed (simulated the missing cascade):** flipped the test leader to `verified` via direct write (the write the RPC *should* do) → cold restart → **the pending gate lifted cleanly**, proving the cascade is the correct fix. Verified UG viewer: Church tab = **CAL globe only, no CAML, no location** (runtime log shows 0 location/Mapbox/nearby calls in the verified session too); Connect tab accessible with "LEADER TO LEADER · HELD IN CONFIDENCE" + covenant/keyword-flagging disclosure; no UG data leak observed across Home/Church/Connect. (Test leader left `verified` — disposable account.)
- **Remaining (optional / next session):** login-onboarding flow (fresh signup); fully-verified UG-viewer interactive pass; admin dashboard Playwright (TOTP-gated); RPC `EXPLAIN ANALYZE` perf profiling; per-function dashboard tier-correctness re-read.
