# Cluster: emails-website — 10 tickets (audited 2026-07-02)

Repos verified read-only: mobile `/Users/ife/replant` (branch feat/kan-296-mobile-attribution-slot), admin `/Users/ife/replant-admin` at `origin/main` (deployed truth, 1108fe5 lineage). No DB/network calls made.

Cross-cutting ground truth (cited repeatedly below):
- NO shared `sendEmail()` utility exists anywhere. Mobile edge fns call `https://api.resend.com/emails` via raw fetch (create-account, submit-heartcry, join-underground-church, send-message). Admin netlify fns use the Resend SDK (`resend` ^6.12.3 in admin root package.json) inline per-function.
- `email_log` writers: submit-heartcry, send-message (pastoral T1), `emit_pastoral_digest()` (migration 20260512000000). create-account welcome/new-church emails and ALL admin-repo sends are UNLOGGED.
- Only two Resend-dashboard templates referenced in code, both KAN-137 pastoral: `6e417a13-cd5d-4d2f-8534-d16406b0e429` (T1, send-message/index.ts) and `b410b64e-db33-46da-8111-9ace427f3678` (T2 digest, migration 20260512000000).
- `/Users/ife/replant/.claude/plans/email-infra-panel-briefing.md` (2026-06-24) — Founder ruled KAN-80 "very outdated"; SME panel re-scoped the whole email surface (~20 emails, 6 families) with BA/DBA/SEC/AUTH verdicts folded in. Plan only; no code landed from it.

---

## KAN-80 — [KAN-31b] BE: Resend SDK + sendEmail() Utility + Retry / Bounce Handling
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- No `sendEmail()` utility in either repo (B4–B7 ✗): mobile fns raw-fetch Resend (`supabase/functions/create-account/index.ts:54,120-129`; `submit-heartcry/index.ts:182`; `send-message/index.ts:274`; `join-underground-church/index.ts:146`); admin fns each `new Resend(...)` inline (join-welcome.js, church-intake.js, escalate-flag.js, grant-admin-to-existing.js, send-password-reset.js, volunteer-welcome.js, _lib/underground-notify.js).
- No retry logic anywhere (B8–B10 ✗); no Resend webhook endpoint in either repo — grep for webhook/svix across `supabase/functions/` and admin `netlify/functions/` returns nothing (B13–B17 ✗).
- email_log written only by 3 paths (B18 ✗): `submit-heartcry/index.ts:213` (no outcome col), `send-message/index.ts` T1 block (with outcome), `emit_pastoral_digest()` in migration 20260512000000. create-account welcome + new-church sends unlogged (`create-account/handler.ts:491-497,515` — `void ...catch(log)` fire-and-forget only).
- What IS in place: Vault-based key via `get_resend_api_key` RPC, service-role-only post P0-1 break-glass (migration 20260702021323); per-cold-start client/key caching (create-account/index.ts:58-67,114-119 — B3 ✓); fire-and-forget contract honored (B11 ✓); `email_log.outcome` column shipped via KAN-137 (migration 20260512000000:49-60) — the blocking-note `status` column ask functionally resolved under a different name; `email_log_dedup` UNIQUE constraint pre-exists (per KAN-89 c. + briefing).
- Ticket superseded-in-part: Founder ruling + SME panel 2026-06-24 (`.claude/plans/email-infra-panel-briefing.md`) re-scoped KAN-80 to a two-runtime (Deno edge + Node netlify) thin-client contract; the panel spec, not this ticket's B1–B20, is the current build target.
MISSING: shared utility (B4–B7), idempotency short-circuit (B6), retry (B8–B10), bounce/delivery/complaint webhook + signature verification (B13–B17), universal email_log logging (B18), template literal-union (B5).
DEPLOYED: n/a (utility not built; the ad-hoc sends that do exist are deployed on both surfaces)
NEEDS-LIVE-DB: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='email_log' ORDER BY ordinal_position;` (confirm live shape = id, user_id, template, sent_date, sent_at, resend_id, outcome — no status)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No shared sendEmail() utility exists; 10+ call sites send ad-hoc (raw fetch in 4 Supabase edge fns, inline Resend SDK in 7+ admin netlify fns).
- Retry (B8–B10) and the bounce/delivery webhook (B13–B17) are not built in either repo.
- email_log is written by only 3 paths (submit-heartcry, send-message T1, pastoral digest RPC); create-account welcome emails and all admin-dashboard sends are unlogged.
- The Ready→In Progress blocker resolved under a different name: `email_log.outcome` (not `status`) shipped live via KAN-137 migration 20260512000000.
- Resend API key is Vault-held (`get_resend_api_key`, service-role-only after P0-1 break-glass 20260702021323) and cached per cold start; fire-and-forget contract is honored at every call site.
- Ticket spec superseded by the 2026-06-24 email-infra SME panel (email-infra-panel-briefing.md): two-runtime thin-client contract replaces the single-utility B1–B20 shape. Ticket needs rewrite against the panel before build.

## KAN-81 — [KAN-31c] OPS+BE: Scaffold 8 Email Templates in Resend (Variable Maps + Underground Branch)
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Zero of the 8 named templates exist as Resend-dashboard templates per repo evidence: the only `template_id` strings in either repo are KAN-137's pastoral pair (send-message/index.ts:284 `6e417a13-…`; migration 20260512000000:212 `b410b64e-…`). Grep for the 8 literals (`welcome`,`new_church_registered`,`verification_reminder_7d/1d`,`account_deactivated`,`coleader_departed`,`heartcry_triage_ping`,`flag_escalated`) as template names: no hits in src/functions.
- 4 of 8 template GOALS shipped by different design (inline sends, different names): welcome → create-account/index.ts:219-280 four plain-text copy variants (skip / pending_church / verified_church / underground_pending) locked Founder 2026-06-18/19 — underground branch STRONGER than C3 spec (no first name, no church, no role, generic body); new_church_registered → create-account/index.ts:281-288 (to connect@, plain text); heartcry_triage_ping → submit-heartcry as literal `heartcry_triage_notification`, static body, Vault-resolved recipient; flag_escalated → admin escalate-flag.js:166-178 static notification-only body (T8.6 default-safe resolved: no message_content, per KAN-55 SEC sign-off in code comment).
- 4 of 8 NOT built at all: verification_reminder_7d, verification_reminder_1d, account_deactivated, coleader_departed — no cron, no code, no template (grep `reminder` across supabase/ = no hits; briefing Family 3 confirms "mostly NOT BUILT").
- Sender identity C1 violated by shipped code: mobile sends from `noreply@projectreplant.org` (create-account/index.ts:55), admin from `connect@projectreplant.org` — and the 2026-05-15 Founder ruling on KAN-143 moved the canonical sender to `accounts@projectreplant.org` project-wide, superseding C1 entirely.
MISSING: all 8 Resend-dashboard scaffolds + variable maps + brand-kit shell + plain-text fallback pairs (C4–C6); Templates 3/4/5/6 in any form; Ife tone-gate copy for T5; test-send pass (C10).
DEPLOYED: n/a (dashboard-side artifact; the inline stand-ins are deployed)
NEEDS-LIVE-DB: none — needs Resend dashboard/API check instead (list templates; expect only the 2 pastoral templates, not the 8)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Repo evidence shows only 2 Resend-dashboard templates in use (KAN-137 pastoral T1+T2); none of this ticket's 8 are referenced anywhere.
- Welcome, new_church_registered, heartcry ping, and flag_escalated goals shipped as INLINE plain-text sends with different names/designs; verification reminders (7d/1d), account_deactivated, coleader_departed have no implementation at all.
- Underground welcome branch shipped STRICTER than C3: no first name, no church, no role, generic "Your Replant registration" body (Founder ruling 2026-06-19).
- Template 8 body question (T8.6) resolved default-safe in code: escalate-flag.js sends a static no-PII notification; message content never rendered.
- Sender identity spec (C1 connect@) superseded by Founder ruling 2026-05-15 (accounts@ project-wide); shipped code currently uses noreply@ (mobile) and connect@ (admin) — neither matches.
- Ticket needs re-grooming against the 2026-06-24 email-infra panel surface map before any scaffolding.

## KAN-88 — [OPS] Resend template verified-link audit (recurring observability)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No audit script/lint/cron in mobile repo: `.github/workflows/` contains only update-changelog.yml; no `scripts/` link-audit; no Deno URL-walker anywhere.
- Admin repo origin/main `.github/workflows/`: update-changelog.yml only.
- No domain-inventory doc in either repo (grep infra-inventory/allowed-domains across docs/ = no hits); no pre-commit hooks (.husky absent both repos).
MISSING: all ACs — scanner, inventory list + documented location, cadence, P1 alert wiring, first audit pass.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No URL-audit automation exists in either repo (only workflow in both is update-changelog.yml).
- No canonical domain-inventory artifact found in docs/ of either repo.
- Live email-URL surface has grown since filing (admin _emails HTML, church-intake, escalate-flag deep links, pastoral template deep_link) — first audit pass scope is larger than the ticket lists.

## KAN-89 — [OPS] Resend dead-letter monitoring — automated watcher on email_log resend_id=NULL
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No watcher exists: pg_cron jobs in migrations are only `emit_pastoral_digest` daily 09:00 UTC (20260512000000:300) and admin-tier promotions sweeper 4h (20260624000008:46). Neither queries `resend_id IS NULL`.
- No GH Actions cron in either repo; admin scheduled netlify fns are underground EXIF-scrub + orphan-bytes only (scheduled-underground-*.js) — not email.
- No runbook entry for the alert (docs/ grep = nothing); failure-mode test never encoded.
MISSING: all ACs — polling job, threshold alert, routing, payload, runbook, failure-mode test, plus the SM-comment additions (heartcries cross-reference for dedup undercount).
DEPLOYED: n/a
NEEDS-LIVE-DB: `SELECT jobname, schedule, command FROM cron.job;` (confirm no email-watcher job exists on prod beyond digest + promotions sweeper)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No automated watcher on email_log resend_id=NULL exists; prod pg_cron carries only the pastoral digest and admin-tier promotions sweeper.
- Silent-failure mode flagged at KAN-66 c.11109 is still live: a failed heartcry triage send is recorded (email_log row, resend_id NULL) but nothing alerts.
- Watcher scope has grown since filing: send-message pastoral T1 and the digest RPC now also write failure outcomes (`failed_resend_emit`, `suppressed_rate_limit`) worth including in the poll.

## KAN-143 — OPS+BE+CONTENT: Admin action email templates — approve / reject / deactivate / reinstate church notifications
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- The four handlers at admin origin/main send NO email: approve-church.js, reject-church.js, deactivate-church.js, reinstate-church.js — only `actor_email` audit meta appears (approve-church.js:152, reject-church.js:91, deactivate-church.js:26, reinstate-church.js:28). No `church_approved`/`church_rejected`/`church_deactivated_admin`/`church_reinstated` template anywhere.
- 5th template `user_deactivated_admin` (Founder decision c.11991): not built — verify-leader.js/reject-leader.js/revoke-admin.js/demote-admin.js contain zero email code.
- Scope-item `admin_invited` REGRESSED since the 2026-05-15 comment marked it delivered: KAN-104's Resend-owned invite (commit 2c6bb60, grant-admin.js) was deleted 2026-06-29 as orphan (commit e1ffa87, KAN-285); the current deployed invite path invite-admin.js (KAN-271) uses Supabase default `inviteUserByEmail` with in-code note "Custom Resend send mirroring grant-admin is a post-MVP follow-up" (invite-admin.js:155-157). `buildInviteEmail`/`buildAccessGrantedEmail` in _lib/admin-invite-email.js have NO callers at origin/main (dead code); only buildPasswordResetEmail (send-password-reset.js) and buildAdminGrantedToExistingEmail (grant-admin-to-existing.js:199) are live.
- Sister mechanism note: church approval DOES notify the leader in-app via welcome DM (KAN-217 `_lib/welcome-dm.js`, fired from approve-church.js + verify-leader.js) — in-app, not email; does not satisfy this ticket.
MISSING: all four church templates + emit wiring, user_deactivated_admin (5th), Founder tone confirmation for church_rejected + church_deactivated_admin, email_log literals, underground branches.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Zero email emit in the four church-action functions at deployed origin/main; leaders still get no email on approve/reject/deactivate/reinstate.
- Approve path does fire an in-app welcome DM (KAN-217) — the only leader-facing notification on any of these actions today.
- admin_invited status must be corrected: the KAN-104 Resend invite path was deleted 2026-06-29 (KAN-285); deployed invite-admin.js uses Supabase's default invite email, and buildInviteEmail/buildAccessGrantedEmail are now uncalled dead code.
- grant-admin-to-existing.js is the only Team-Management path that sends a branded Resend email today (buildAdminGrantedToExistingEmail).
- Founder copy anchors captured 2026-05-16 (approval/rejection tone notes) remain unimplemented.

## KAN-164 — CONTENT+BE+OPS: Intake form welcome email — on-submit transactional email to registering leader
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Deployed & wired: admin origin/main church-intake.js (KAN-146) sends a leader welcome on every successful intake submission (public/intake.html → church-intake fn), fire-and-forget (church-intake.js:184-225). AC1 ✓; AC3 ✓ ("has been received and is now in our system for review… team will review and verify"); AC4 ✓ (accounts@ contact line); AC5 ✓ (prayer paragraph: "We ask for your prayers throughout every phase of this mission…"); AC9 ✓ single send per submission.
- AC6 copy anchor is a close PARAPHRASE, not verbatim: shipped "You are part of the group bringing this vision to life. You are the foundation of the Replant Network and help make this initiative impactful for the globe." vs anchor "Thank you for being a part of a group that brings this vision to life… help us make this initiative impactful for the globe." Ticket says do-not-paraphrase.
- AC2 ✗ no Network ID in the email — but the KAN-144 blocker mechanism NOW exists (`network_id` = church_code, migrations 20260528000001 + 20260528000007); it simply isn't wired into the email. Admin-notify email carries the raw church UUID instead (church-intake.js:173).
- AC7 ✗ plain text only (no html key — not the dark Georgia/DM Sans design); AC8 ✗ From is `Replant <connect@projectreplant.org>` not accounts@ (church-intake.js:192).
- Recipient nuance: welcome goes to the MINISTRY email (`resolvedContactEmail`), not the leader's personal email — intentional per commit 247f19a "Fix welcome email to ministry email", but the in-code comment ("Sent to personal email") is stale.
MISSING: Network ID in body (AC2, blocker now cleared), dark-background HTML design (AC7), From accounts@ (AC8), verbatim Founder copy anchor (AC6), CONTENT review + Founder ratification (DoD).
DEPLOYED: yes (origin/main)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- A working intake welcome email is live (church-intake.js, KAN-146): auto-fires on submission, review-next-steps copy, accounts@ contact, prayer statement, fire-and-forget.
- Founder copy anchor shipped as a close paraphrase, not the verbatim wording the ticket mandates.
- Network ID absent from the email; the KAN-144 blocker is functionally cleared (network_id/church_code live since migrations 20260528000001/7) — wiring is the remaining work.
- Email is plain text from connect@; ticket requires dark-background HTML design and accounts@ sender.
- Recipient is the ministry/church email, not the leader's personal address (intentional, commit 247f19a; code comment stale).

## KAN-165 — CONTENT+OPS: Early access invitation email — for join-us form registrants
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Zero artifacts in either repo: no "early access" copy, no subject-line options, no template file, no send code (grep across website/, docs/, both netlify/functions trees = no hits).
- The manual-workflow hook DOES exist: join-us registrants land in the tracking Google Sheet with a blank "Reached out?" column G for manual fill (mobile netlify/functions/submission-created.js:73).
- DoD requires a template staged in Resend — repo cannot prove dashboard state, but nothing in-repo references any such template.
MISSING: all ACs — subject options for Founder, body draft, CONTENT review, Founder ratification, Resend-staged template.
DEPLOYED: n/a
NEEDS-LIVE-DB: none — needs Resend dashboard/API check (list templates + broadcasts for an early-access draft)
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No early-access invitation email artifacts exist in either repo (copy, template, or send path).
- The manual trigger surface is ready: the join-us tracking sheet's "Reached out?" column is wired (submission-created.js).
- A Resend dashboard check would definitively rule out a manually staged template; repo evidence says none.

## KAN-168 — OPS+BE+CONTENT: Admin account deactivation email — notify affected admin
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No `admin_account_deactivated` template or send anywhere: revoke-admin.js, demote-admin.js, revoke-admin-tier.js at origin/main contain zero email/Resend code (grep = no hits).
- 2026-06-24 email-infra panel briefing Family 6 item 25 independently confirms: "admin_account_deactivated → demoted admin (NOT BUILT; KAN-168)".
- No email_log literal, no _lib builder for it (admin-invite-email.js exports invite/access-granted/password-reset/granted-to-existing + UG restore builders only).
MISSING: all of scope — template, sendEmail literal, emit wiring from the deactivation handler, email_log spot-verify.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Deactivated/demoted admins still receive no out-of-band email; revoke-admin/demote-admin/revoke-admin-tier send nothing at deployed origin/main.
- The 2026-06-24 email-infra panel surface map lists this exact email as NOT BUILT (Family 6, item 25).
- Adjacent precedent exists to copy from: grant-admin-to-existing.js + _lib/admin-invite-email.js shell (branded builder + best-effort send + email_sent flag).

## KAN-262 — Email templates — sync deployed admin Netlify HTML to docs/emails upgrade
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Ticket premise is STALE: deployed admin origin/main already bundles upgraded HTML at `netlify/functions/_emails/join-welcome.html` + `volunteer-welcome.html` since commit 9b23339 (2026-05-14: "upgrade join/volunteer welcome emails to production templates… logo src updated to https://projectreplant.org/logo.png"). Deployed templates contain: `color-scheme` dark-only meta (×4), `[data-ogsc]` Outlook overrides (×7), Cormorant Garamond (×8), italic "The Church, Connected" tagline, ABSOLUTE logo URL, and `{{GREETING}}` recipient templating (function-side `.replace('{{GREETING}}', greeting)` in join-welcome.js — same goal as the ticket's `{{{FIRST_NAME}}}` ask, different mechanism).
- Deployed is AHEAD of local: `/Users/ife/replant/docs/emails/join-welcome.html` still has relative `src="logo.png"` + hardcoded "Dear Samuel"/"Dear Grace" (diff confirmed). The sync direction the ticket describes is inverted — docs/emails needs back-sync.
- NOT shipped (3 of the 5 tidy items): top `linear-gradient` hairline still present in deployed (×1 — Outlook desktop defense not applied); dim-color bumps absent (`#c8c8c8` ×9 remains; no `#9a9a9a`/`#777`/`#2a2a2a`); no `@media (prefers-color-scheme: light)` block (×0).
- LIVE DEFECT RISK: `logo.png` is NOT in the website publish dir — mobile-repo netlify.toml publishes `website/` which contains only 4 HTML files; `https://projectreplant.org/logo.png` likely 404s, breaking the logo in every deployed welcome email. (Repo-provable absence; live check listed below.)
MISSING: gradient→solid hairline swap, Gmail auto-dark color bumps, light-mode fallback block, logo.png actually hosted at the absolute URL, Gmail/Apple Mail smoke-test, docs/emails back-sync.
DEPLOYED: yes (the upgraded templates; the 3 color-shift defenses are not built anywhere)
NEEDS-LIVE-DB: none
NEEDS-SIM: `curl -sI https://projectreplant.org/logo.png` (expect 404 → logo broken in live welcome emails); then submit the join-network form and inspect rendering in Gmail dark mode
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- Ticket's drift table is stale: deployed origin/main `_emails/` HTML has carried the color-scheme meta, data-ogsc overrides, Cormorant, tagline, absolute logo URL, and {{GREETING}} templating since commit 9b23339 (2026-05-14).
- Local docs/emails/ is now the OLDER copy (relative logo, hardcoded Dear Samuel/Grace) — sync direction reverses.
- Still unshipped: gradient-hairline→solid swap, dim-color bumps for Gmail auto-dark, and the prefers-color-scheme:light fallback — in both deployed and local copies.
- Probable live defect: logo.png is absent from the website publish dir, so the absolute URL the deployed emails reference likely 404s — verify with curl before rescoping.
- Recipient templating shipped as function-side {{GREETING}} replacement, not Resend triple-mustache — goal met, mechanism differs.

## KAN-228 — blog.projectreplant.org — v1 scaffold + first post
CURRENT LANE: In Progress
VERDICT: PARTIAL
EVIDENCE:
- Phases 1–4 built at `/Users/ife/replant/blog/`: Astro ^6.4.6 + @astrojs/mdx/rss/sitemap (package.json, astro.config.mjs with `site: 'https://blog.projectreplant.org'` + sitemap filter); tokens.css/prose.css; Base/PostLayout layouts; Nav/Footer/PostCard/Scripture components; index/about/posts/[...slug]/rss.xml.js pages; content.config.ts; `dist/` built with rss.xml + sitemap-0.xml + sitemap-index.xml present.
- Privacy posture per spec: blog/netlify.toml headers = Referrer-Policy no-referrer, X-Content-Type-Options nosniff, X-Frame-Options DENY, Permissions-Policy denying camera/mic/geolocation, CSP `script-src 'self'` with only Google Fonts allowances; public/robots.txt allows indexing + sitemap pointer; no analytics/third-party scripts anywhere in src/.
- Phase 5 NOT done: `src/content/posts/` contains only `_template.mdx` (no real post — ticket bars public DNS until one exists); about.astro is an explicit placeholder ("This page is a placeholder. Founder will draft the final copy…"); `public/og-default.png` absent (file map planned it, Founder-approval-gated).
- Founder-owned gates (Netlify project creation, DNS binding, first-post + About copy) not verifiable from repo; blog tree first committed 2026-07-02 (9c5c571).
MISSING: first real post, About copy (Founder), og-default.png, Netlify site provision + blog.projectreplant.org DNS (Founder gates), post-deploy verifications (cell-data load, RSS validator).
DEPLOYED: n/a (separate Netlify site is a Founder gate; no binding provable from repo)
NEEDS-LIVE-DB: none
NEEDS-SIM: none (non-repo check: Netlify dashboard — does a blog site bound to blog.projectreplant.org exist; `dig blog.projectreplant.org` for DNS)
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- Scaffold phases 1–4 complete in-repo: Astro+MDX+RSS+sitemap, brand tokens lifted from the marketing site, all planned layouts/components/pages present, dist builds clean with RSS + sitemap artifacts.
- Privacy posture fully encoded: no-referrer, nosniff, frame-deny, camera/mic/geo denied, CSP script-src 'self'; zero analytics or third-party widgets.
- Phase 5 open: no real post (only _template.mdx), About page is a marked placeholder, og-default.png not yet added — all Founder-copy gates per the ticket.
- Netlify site + DNS binding are Founder-owned gates and not provable from the repo; ticket correctly remains In Progress.
