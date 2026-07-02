# Handoff — Post Pre-UAT Audit Remediation → Lucid Chart Update

**From:** the 2026-07-01/02 pre-UAT audit *fix + remediation* session.
**To:** the next session. **Founder's stated focus: update the Lucid charts to reflect the post-audit reality.**
**★ Read FIRST:** the `replant-continuous-spec` memory — it has the full blow-by-blow, every ruling, and all commit SHAs. This doc is the executive summary + the next-task brief.
**Full audit report:** `docs/audits/2026-07-01-pre-uat-comprehensive-audit.md` (+ the two break-glass runbooks alongside it).

---

## 0. Open in prayer (hard rule, CLAUDE.md)
Every session in this repo opens with a real intercession naming the work — here, updating the system-of-record diagrams so they tell the truth about the platform that shields persecuted leaders. Close "In Jesus' name, Amen."

## 1. TL;DR
**The entire pre-UAT audit is remediated, deployed, verified, and committed.** All 4 P0s + the underground-onboarding blocker + the P1 batch are fixed on prod. The admin hardening PR is merged to admin prod. Anon-RPC rate limiting is now *real* (Upstash re-provisioned) and *fail-closed*. Everything is committed; `~/replant` is pushed; the admin PR is merged. We are in **QA** (not near launch — see the release pipeline note in §6).

## 2. What's LIVE on prod

### DB — Supabase `jiyetphxxvyiicrnwlnx` (us-east-1). 9 migrations, mirrored to `supabase/migrations/`, security-advisor CLEAN.
- **P0-1** break-glass: REVOKE EXECUTE on `get_secret_by_name` / `decrypt_heartcry_content` / `encrypt_heartcry_content` from anon/authenticated + pinned `search_path`.
- **P0-2** break-glass: REVOKE UPDATE on all privilege columns of `users`+`churches` from anon/authenticated (users was TABLE-level → wholesale revoke + re-grant of 20 safe cols); **+ `guard_users_privilege_cols` BEFORE-UPDATE trigger** (defense-in-depth).
- **P0-4**: `get_open_prayers` own-church rewrite (derives church from `auth.uid()`, drops param, anon mask, revoke anon) + `get_prayer_wall` nulls the UG `church_id` (the harvest seed) + masks role on UG/anon + `find_similar_churches` UG exclusion.
- **UG-onboarding blocker**: cascade in `fn_confirm_underground_proposal` verify branch (all non-deleted leaders) + one-shot un-strand of RPL-02104's founding leader (`ruthjames08+ung`, now verified).
- **P1 batch**: `enforce_underground_rag_red` trigger; DROP the `admin_region_read` landmine policy; sibling-table client write-surface sweep (revoke anon+authenticated writes on the 6 content tables); `messages` client-INSERT revoke (DELIVER-ALWAYS); `churches` grant cleanup (authenticated → `rag_status` only).

### Admin — `replant-admin`, PR [#73](https://github.com/ife-arike/replant-admin/pull/73) MERGED to main (squash `1108fe5`; Netlify deployed to admin prod).
- **P0-3 / KAN-288**: `read-region` + `underground-oversight` now gate on `is_underground_admin` + AAL2 (via `makeUndergroundGatedHandler`), tier `browse` (matches the AuditLog FE's client freshness).
- **#7**: welcome-DM fan-out into `confirm-underground-proposal.js` on a verify confirm.
- **P1 step-ups**: AAL2 freshness gates on `deactivate-church` / `reinstate-church` / `rag-override` (5-min) + `approve-heartcry-feed` (90-sec). *(Note: used `checkAal2Freshness`, NOT `validateStepUp` — the panel's literal rec would have broken these; see the PR body / continuous spec for why.)*
- **react-router** 6.30.3 → 6.30.4 (open-redirect GHSA-2j2x-hqr9-3h42).

### Anon signup RPCs — 4 deployed **fail-closed**, Upstash **LIVE**.
- `check-email-available`, `create-account`, `register-church`, `register-church-delete`: on an Upstash *outage* they now reject (503) instead of silently dropping the rate-limit cap. NOT-configured (local dev) path stays fail-open.
- **Upstash story (important):** the original April-30 Upstash free DB had been auto-deleted (inactivity) → rate limiting had been silently non-functional platform-wide (9 functions depend on it). Founder created a NEW free DB (us-east-1) 2026-07-02 + updated the Supabase secrets (dashboard form). Verified live (`upstash_ok`). Rate limiting is now functional; 503 only on a genuine outage.

### Mobile FE.
- `get_open_prayers` arg-drop in `PrayerWallLanding` + `MyOpenPrayersView` (+ `PrayerWallLogic.PrayerRow.church_id` nullable). Live in the running sim via Fast Refresh; a fresh Expo build is needed for any other installed build.

## 3. Git / Jira state
- **`~/replant`** (branch `feat/kan-296-mobile-attribution-slot`): `dad6310` (audit code + 9 migration mirrors), `9c5c571` (385-file sweep of accumulated untracked artifacts + gitignore of `.playwright-mcp/`,`.claude/worktrees/`), `8bd20e5` (fail-closed comment fixes), + this handoff. **Pushed.** Tree clean.
- **`~/replant-admin`**: PR #73 merged (`1108fe5`); audit worktree removed; Founder's `feat/flagged-mirror-pastoral` untouched.
- **Jira**: KAN-221 c.15971 (P0-2) + KAN-288 c.15972 (P0-3) have factual comments. **NOT transitioned — only Founder marks Done.** Consider closing KAN-221/KAN-288; KAN-289 (console opacity) is broader/still open.

## 4. ★ NEXT TASK — update the Lucid charts to post-audit reality
The audit found several diagrams now stale/misleading. Existing Lucid handoff/prompt: `.claude/plans/lucid-map-handoff.md` + `.claude/plans/lucid-prompt-replant-system-map.md`. Full "Doc drift" list: audit report §11. Specifics to reconcile:
1. **P0-2 write model changed.** Any data-flow / RLS diagram showing client-writable privilege columns on `users`/`churches` is now WRONG — those writes are revoked + guarded by trigger (durable RPC still pending, §5). Redraw as service-role/RPC-only writes + the guard trigger.
2. **Diagram 08 (Verification Lifecycle).** The audit flagged it as implying enforcement that (pre-fix) wasn't there. Post-fix the UG verify **cascade to leaders** + the guard exist — update the lifecycle to show the cascade + fail-closed posture.
3. **Doc 06.5 (admin tier promotion sequence).** Clarify `is_top_tier_admin` is **column-authoritative + hook-derived** (see the `top_tier_admin_column_authoritative` memory); no promote-to-Manager path exists; the P0-2 fix locked the column from client write.
4. **KAN-274 UG visibility-flip** is drawn as live but is **unbuilt** — mark not-built.
5. **New dependency to represent:** rate-limit + idempotency ride on **Upstash** (9 functions); worth showing the fail-closed posture + the in-memory token-bucket fallback that `join-underground-church` already uses.

## 5. Deferred / residual (NOT UAT-blocking; do as Founder directs)
- **`update_leader_settings` SECURITY DEFINER RPC** + repoint `SettingsScreen` + drop the residual `authenticated` UPDATE grant on `users` — the durable P0-2 close-out. (The guard trigger already covers the hole, so this is hygiene, not urgent.) [SEC/DBA panel]
- **Action-bound step-up tokens** on the 4 TIER-1 admin actions (stronger than the AAL2 freshness now shipped; needs paired FE `useStepUp` wiring).
- **`get-nearby-churches` `verify_jwt` reconcile** — needs a SEC ruling (its config comment says so; the fn self-verifies, so it's not actually anon). NOT a mechanical flip.
- **Deno test suites** for the 4 anon RPCs are pre-existing-drifted (`register-church` `insertChurch` not in `Deps` — validation-only v7). Worth a real test pass when next touching signup.
- **P2/P3 roadmap** (audit §18): CI test gate + RLS-policy fixture harness, i18n, perf (42 unindexed FKs / RLS-initplan / 903 KB admin chunk), security headers, CORS scoping.
- **Secret rotation** (resend / welcome_dm / heartcry) — pre-launch phase, **behind UAT signoff**, NOT near. See the `release_phase_pipeline` memory.

## 6. Gotchas / lessons carried forward
- **Phase:** QA (not done) → UAT → UAT signoff → [compliance/legal · pen tests · pre-launch]. Don't invoke downstream-phase framing. (`release_phase_pipeline` memory.)
- **Secrets:** never have the Founder paste a token in chat; she sets via the dashboard form; verify via deploy+smoke so the value never enters context. (`feedback_never_have_founder_paste_secrets`.)
- **Handoff = commit + flush FIRST** (this rule, `feedback_commit_before_handoff`): before writing a handoff, commit + push everything so the next session starts from a clean SHA.
- **Deployed-vs-HEAD drift is real** — mirror applied migrations to local files AND commit deployed code, every time. (This session's fail-closed deploy briefly drifted from HEAD; that's the cautionary tale.)
- **Upstash free DBs auto-delete on inactivity.** If rate limiting breaks again → check the DB is alive in the Upstash console before anything else.
- **Grants:** check `pg_class.relacl` (table-level) vs `pg_attribute.attacl` (column-level) BEFORE a column REVOKE — a column REVOKE against a table-level grant silently no-ops.

## 7. Tools / reproduction
- Supabase prod `jiyetphxxvyiicrnwlnx` (us-east-1). Publishable key `sb_publishable_Gpwkg-q8oDAYL0ejtjJnwg_99n9IDOl` (legacy anon disabled).
- Admin: `admin.projectreplant.org` (TOTP AAL2 every session — needs Founder). Local: `npm run dev` (vite) + `netlify dev` for functions.
- Mobile: `replant` scheme, iPhone 17 Pro sim; Metro via `expo start` (was running this session).
- New Upstash free Redis DB (us-east-1) — REST creds in the Supabase edge-function secrets (dashboard) + Founder's 1Password.

_In Jesus' name — the covering over this work continues into the next session. Amen._
