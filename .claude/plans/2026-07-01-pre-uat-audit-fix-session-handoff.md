# Handoff — Pre-UAT Audit → Fix Session

**From:** the pre-UAT comprehensive audit session (2026-07-01).
**To:** the next session, which will FIX the findings.
**Full audit report (source of truth, read it):** `docs/audits/2026-07-01-pre-uat-comprehensive-audit.md`
**Break-glass runbooks (paste-ready SQL):** `docs/audits/2026-07-01-P0-1-vault-breakglass-runbook.md` · `docs/audits/2026-07-01-P0-2-privilege-escalation-runbook.md`
**Per-lane evidence:** `docs/audits/_working/*.md`

---

## 0. Open in prayer (hard rule, CLAUDE.md)
Every session in this repo opens with a real intercession naming the work — here, the remediation of live P0s on a platform serving persecuted leaders. Close "In Jesus' name, Amen."

## 1. Process conventions the fix session MUST follow
- **SME panel before meaningful fixes** (Founder rule `[[feedback_sme_panel_required]]`). Each P0/UG-blocker fix touches schema/RLS/auth or masking — dispatch a panel (SEC + DBA at minimum; SEC required on the crypto/auth ones) before writing the migration. Panels give a genuine verdict, no pre-biased "approve-with-changes."
- **P0-1 is break-glass** — it does NOT wait for a panel. Run the runbook (REVOKE + rotate) first; the REVOKE is verified-safe (all callers are service-role). Rotating `heartcry_encryption_key` DOES need care (re-encryption) — see runbook STEP 4.
- **replant-admin deploys = preview-first + ASK** (`[[feedback_preview_first_deploy]]`, `[[feedback_all_pushes_need_greenlight]]`): feature branch → Netlify preview → Founder smokes → SHE merges. Never push to admin main yourself. Batch related fixes into ONE push (`[[feedback_batch_netlify_pushes]]`). `~/replant` (mobile) pushes are lax.
- **No production data mutations** except deliberate, Founder-approved ones. The audit was read-only except two authorized test-account writes (see §5).
- **Only Founder marks Jira Done.** File tickets per finding; Founder decides which.
- **Right-the-first-time**, not MVP-patch (`[[feedback_dont_default_to_mvp]]`).

## 2. THE GUIDING PRINCIPLE (most important takeaway)
Every serious finding is the same shape: **a safety control living in a layer the client can route around.** P0-2 (auth hook trusts a client-writable column), P0-4 + prayer_requests/testimony (masking lives in the RPC, and one RPC forgot it), `messages` direct-INSERT (flagging lives in the edge function), RAG-Red bypass (invariant enforced only in create-account). **Don't just patch the instances — sweep for the pattern.** Rule to adopt: every masking or authorization control must live in RLS / a trigger / a constraint — never in app code that is merely the *intended* path. Concretely: after fixing, sweep every `resolve_display_name` caller and every edge-function-enforced rule for the same gap.

---

## 3. UAT BLOCKERS — fix these before UAT opens (4 P0s + 1 UG blocker)

### P0-1 — anon can read the entire Vault (`get_secret_by_name`)  ⚑ BREAK-GLASS, DO FIRST
- **What:** `public.get_secret_by_name(text)` is SECURITY DEFINER + anon-EXECUTE + returns any Vault secret by name. Confirmed live: pure-anon `POST /rest/v1/rpc/get_secret_by_name` returns HTTP 200. Vault holds `heartcry_encryption_key`, `resend_api_key`, `welcome_dm_internal_token`, etc.
- **Fix:** runbook `docs/audits/2026-07-01-P0-1-vault-breakglass-runbook.md` — REVOKE from anon/authenticated/public on `get_secret_by_name` + `decrypt_heartcry_content` + `encrypt_heartcry_content` (keep service_role — all callers are service-role, verified); pin `search_path`; **rotate all 5 Vault secrets** (⚠️ heartcry key needs re-encryption, not a swap — see runbook).

### P0-2 — any authenticated leader self-promotes to Manager (top admin tier)
- **What:** `authenticated`/`anon` hold column UPDATE grants on `public.users` privilege columns (`is_top_tier_admin`, `is_underground_admin`, `verification_status`, `church_id`, `role`) + `public.churches` (`verification_status`, `verified`, `show_church_name`, `rag_status`, `type`); the `_update_own` RLS is row-scoped (no column CHECK); `custom_access_token_hook` mints `admin_tier=top_tier` from the column. **PROVEN LIVE**: a non-admin test leader PATCHed `{"is_top_tier_admin":true}` on their own row → HTTP 200 (reverted). Overturns the `[[top_tier_admin_column_authoritative]]` "no bug" memory.
- **Fix:** runbook `docs/audits/2026-07-01-P0-2-privilege-escalation-runbook.md` — REVOKE UPDATE from authenticated/anon on ALL privileged columns of `users`+`churches` (pre-flight confirmed the FE writes only safe display columns + `rag_status`); route privileged writes through SECURITY DEFINER RPCs (the `update_leader_role` pattern). Column-scoping the WITH CHECK alone is insufficient — revoke the grants. **Then sweep every client-exposed table for the same grant shape.**

### P0-3 — `read-region.js` (+ `underground-oversight.js`) unmask UG leaders behind super_admin only
- **What:** both gate on `verifySuperAdmin` alone — no `is_underground_admin`, no AAL2 freshness. `read-region` returns a UG church's real name + contact email + phone + region. This is the unremediated tip of **KAN-288** (which names `read-region` as a candidate). `list-underground-churches` already has both gates (PR #70).
- **Fix:** add the `is_underground_admin` gate (use the existing `makeUndergroundGatedHandler` wrapper) + AAL2 freshness to `read-region` and `underground-oversight`. Execute the full KAN-288 sweep of UG endpoints while here.

### P0-4 — `get_open_prayers` discloses UG leaders' real names to anon (+ de-anon)
- **What:** `get_open_prayers(p_church_id)` is anon-executable + SECURITY DEFINER; unlike its sibling `get_prayer_wall`, it has NO `pr.anonymous` mask and NO underground exclusion — always returns `resolve_display_name(u.*)`. `get_prayer_wall` (also anon) includes verified UG churches masked but exposes their real `church_id`, so: anon reads get_prayer_wall → harvests UG `church_id`s → `get_open_prayers(id)` → real UG leader names.
- **Fix:** add `CASE WHEN pr.anonymous THEN NULL …` + the underground name-mask/exclusion to `get_open_prayers`, matching `get_prayer_wall`; scope/gate `p_church_id` to the caller's own church. **Then sweep every RPC that returns a name/church-name for the same missing mask.**

### UG-ONBOARDING BLOCKER — approved underground church strands its founding leader
- **What:** `fn_confirm_underground_proposal` verify-branch updates only `public.churches`, never `public.users` → founding leader stays `verification_status='pending'`, gated out of the app. AND no admin surface can fix it: `pending-leaders.js:59` (`.neq('churches.type','underground')`) excludes UG from the standard queue; the UG Oversight "Leaders" tab is second-leader-only (columns "Parent church · Applicant"). **Confirmed live on the dashboard.** Standard churches cascade (KAN-217 "verify_church cascade"); UG has neither cascade nor manual fallback. FIX PROVEN: flipping the test leader to verified lifted the app gate cleanly.
- **Fix:** add to the verify branch of `fn_confirm_underground_proposal`:
  `UPDATE public.users SET verification_status='verified' WHERE church_id=v_p.church_id AND hard_deleted_at IS NULL AND soft_deleted_at IS NULL;` (mirror standard). Confirm with Founder whether founding + second leaders should both cascade.

---

## 4. P1s — strongly advise before UAT (each has a concrete fix in the report §17 punch list)
1. **TIER-1 admin actions lack step-up/AAL2:** `deactivate-church.js`, `reinstate-church.js`, `rag-override.js` (+ `approve-heartcry-feed.js`) — add `validateStepUp` (sibling `update-church-details.js:82-91` is the correct pattern).
2. **4/5 pre-auth anon RPCs fail OPEN on Upstash outage** (`check-email-available`, `create-account`, `register-church`, `register-church-delete`) — flip to fail-CLOSED (copy `join-underground-church`'s in-memory fallback), OR Founder ruling to narrow the invariant.
3. **`find_similar_churches`** — add `AND type <> 'underground'` (leaks UG name as signup oracle).
4. **`get-nearby-churches` config drift** — local `config.toml=false`, live `true`; reconcile local→true (a CLI redeploy would flip a GPS endpoint anonymous).
5. **`react-router` 6.30.3 open-redirect** (admin, GHSA-2j2x-hqr9-3h42) — non-breaking `npm audit fix` + smoke.
6. **`prayer_requests` + `testimony` directly SELECT-able raw** (`authenticated AND is_active`) → de-anon of anonymous posts at church level. Tighten the table SELECT policy / force reads through the masking RPC.
7. **`messages` direct-INSERT bypasses DELIVER-ALWAYS flagging + branch-membership** (INSERT policy checks only `sender_id`; no flagging trigger) — move flagging + membership into a BEFORE INSERT trigger, or revoke direct client INSERT.
8. **RAG-Red-for-underground bypassable** — Settings toggle (`SettingsScreen.tsx:709`) writes `churches.rag_status` directly; no trigger enforces the lock (only `create-account` does). Add a BEFORE UPDATE trigger forcing `rag_status='red'` when `type='underground'`; hide/lock the RAG toggle for UG in Settings.
9. **`list-pending-underground` over-fetches exact UG country** (+ proposal notes/channel/tier) to the admin browser though the list UI shows only macro-region (KAN-289, confirmed live). Trim the list payload to rendered fields; `list-underground-churches` is the correct minimal template. Sweep all list endpoints.
10. **Establish a Vault/secret rotation cadence** (P0-1 forces it now; document the recurring cadence).

## 5. ⚠️ LIVE-STATE CHANGES THIS SESSION (next session + Founder must know)
- **`ruthjames08+ug@gmail.com` (RPL-02106, `public.users.id = 9d6dd5d2-b76b-404d-8c72-c6e0252bb7b3`) was flipped `verification_status: pending → verified`** to simulate the missing UG cascade and unblock the device test. It is STILL verified. Disposable test account per Founder. Set back to `pending` if you need to re-test the pending state.
- `ruthjames08+t1@gmail.com` (bishop, non-UG) had `is_top_tier_admin` toggled true→false during the P0-2 PoC — **fully reverted**, verified at baseline.
- A Playwright browser session may still be logged into the live admin dashboard as Founder (super_admin). Not signed out to avoid bumping the Founder's session; Founder can close it.
- No other production writes. All else was read-only SELECT via Supabase MCP.

## 6. Memory to update (report §15; some already filed)
- `[[top_tier_admin_column_authoritative]]` — already flipped to ⛔ OVERTURNED this session.
- `[[replant_continuous_spec]]` — audit entry filed; ensure P0-4, the UG cascade blocker, and the country over-fetch are captured (this session appends them).
- After fixes land: update `[[project_replant_schema_facts]]` (KAN-221 note), `[[project_replant_invariants]]` (RAG-Red now trigger-enforced), and close the audit findings.

## 7. What is NOT done (residual — post-UAT or if time allows)
- **Regular-admin console-opacity test** — the highest-value remaining LIVE check (a *regular* admin pulling tier-scoped data they shouldn't). This session was super_admin, so it couldn't be tested. Needs a regular-admin login.
- Exhaustive per-function tier-CORRECTNESS re-read of all 91 Netlify functions (gate PRESENCE verified; correctness is agent-level + P0/P1 spot-checks).
- DM content at rest is plaintext (only heartcries encrypted) — a design decision to raise, not a bug.
- Session/MFA config not read live; storage signed-URL TTL / EXIF-scrub not exercised.
- Performance: advisor-level only (42 unindexed FKs, 57 RLS-initplan, 903 KB admin chunk) — no EXPLAIN/load test.
- I18n: zero infrastructure (~490 hardcoded strings, no RTL) — post-MVP roadmap.
- No CI test gate; UG/escalated/promotion clusters untested; no RLS-policy fixture harness (would have caught P0-2).

## 8. Reproduction / tools
- Supabase project `jiyetphxxvyiicrnwlnx` (prod). Publishable key: `sb_publishable_Gpwkg-q8oDAYL0ejtjJnwg_99n9IDOl` (legacy anon key disabled).
- Mobile sim: `replant` workspace/scheme, iPhone 17 Pro; Metro runs via `expo start`; runtime logs under `~/Library/Developer/XcodeBuildMCP/workspaces/replant-*/logs`.
- Admin: `admin.projectreplant.org` (TOTP AAL2 on every session — needs Founder). Local: `npm run dev` (vite; functions need `netlify dev`).
- Founder test accounts: main `bb6c6385`/Maranatha, Account B `b8f4657c`/Blessings Abound; PoC used disposable `+t1` (non-UG) and `+ug`/`+ung` (underground).
