# Cluster: auditlog-data-content — 7 tickets (KAN-131, 133, 134, 136, 156, 157, 222)
Auditor: QA/BA cluster agent · 2026-07-02 · Admin deployed truth = origin/main (1108fe5); mobile truth = feat/kan-296-mobile-attribution-slot tree.

## KAN-131 — audit_log.meta JSON Schema validator at write time (SEC KAN-119 forward-track)
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- No `validateAuditMeta` symbol and no meta-schema definition file in either repo (grep across `/Users/ife/replant/supabase/` + `/Users/ife/replant-admin/netlify/`; `find -iname "*schema*"` in admin netlify/src → zero non-node_modules hits). Mobile `supabase/functions/_shared/` holds only church-validation.ts + taxonomy/jwt helpers.
- `writeAuditLog` chokepoint exists at `/Users/ife/replant-admin/netlify/functions/_lib/supabase-admin.js` (origin/main) but takes `meta = {}` as an unvalidated passthrough — the AC-2 hook-point exists, the validator does not.
- No pg_jsonschema / `jsonb_matches_schema` / CHECK-on-meta in any migration; the only audit_log CHECK is the action whitelist (latest: `supabase/migrations/20260701000004_extend_audit_log_action_check.sql`).
- AC-11 length-distribution monitoring and AC-12 monthly FP sampling: no cron job, no CI step, no runbook artifact anywhere.
- Adjacent-but-not-this: KAN-119's `audit-meta.js` scrub+cap and approve/reject-church BE mandatory notes/reason cover AC-10's premise at the WRITE layer only; the schema-layer validator this ticket specifies is absent.
MISSING: AC-1 through AC-12 in full — schema file, validator helper, writer refactor, tests, monitoring, sampling, sign-offs.
DEPLOYED: n/a
NEEDS-LIVE-DB: optional belt-and-braces (out-of-band break-glass DDL occurred 2026-07-02): `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.audit_log'::regclass AND NOT tgisinternal;` — expect no meta-validator trigger.
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- No meta-schema validator exists in any layer: no schema file, no validateAuditMeta, no pg_jsonschema, no CHECK on audit_log.meta.
- writeAuditLog (admin `_lib/supabase-admin.js`) is the single chokepoint AC-2 anticipated — it passes `meta` through unvalidated.
- Ticket premise has compounded: the action whitelist is now a 45-element `audit_log_action_check` (per supabase-admin.js header) vs the 23–25 actions the ticket anticipated; by-convention meta shapes are the only enforcement.
- AC-11 monitoring and AC-12 FP sampling have no instrumentation anywhere.
- KAN-119's write-layer mandatory notes/reason (AC-10 premise) is live; the schema-layer twin is not started.

## KAN-133 — audit-meta scrubPii regex hardening — bare-domain URL + IDN/UTF-8 email
CURRENT LANE: Backlog (SM-AUDIT 2026-05-14: COO DEFER — do not dispatch)
VERDICT: NOT_BUILT
EVIDENCE:
- Deployed `netlify/functions/_lib/audit-meta.js` @ admin origin/main: `URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>'"]+/gi` — requires `https?://` or `www.` prefix; scheme-less bare domain (`example.com/path`) still slips. AC-1 not met.
- Same file: `EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` — ASCII-only classes; `user@münchen.de` / `用户@example.cn` slip (Punycode `xn--…` form would match). AC-2 not met.
- `audit-meta.test.js` @ origin/main has no bare-domain or IDN cases — URL tests cover only `https://example.com/…` and `www.foo.org/x` (test lines 53–58).
- git log on the file: 13c801f (KAN-119 original), 531e3fb (KAN-147 scrubEmailToDomain), bfc7d2f (KAN-206 maskPhone) — no KAN-133 commit; working tree identical to origin/main (diff empty).
MISSING: AC-1 (bare-domain URL_RE), AC-2 (IDN/UTF-8 EMAIL_RE), AC-3 (new tests), AC-4 (SEC pattern review) — all.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- BA's anchor flag resolved: SCAFFOLD path `netlify/functions/_lib/audit-meta.js` is correct; 5-pattern set confirmed (email/URL/IPv4/IPv6/phone).
- Neither AC gap-closure is implemented on deployed origin/main; URL_RE catches `www.`-prefixed but not scheme-less bare domains; EMAIL_RE is ASCII-anchored.
- File has evolved since filing (KAN-147 scrubEmailToDomain, KAN-206 maskPhone) — orthogonal helpers; the two FN classes SEC surfaced remain open.
- COO DEFER hold (2026-05-14) still governs; no dispatch has occurred.

## KAN-134 — Mobile-repo CI vitest for dangerouslySetInnerHTML zero-grep (parity with admin)
CURRENT LANE: Backlog (SM-AUDIT 2026-05-14: COO DEFER — do not dispatch)
VERDICT: NOT_BUILT
EVIDENCE:
- Mobile repo has no such test: no `src/test/` dir, no dangerouslySetInnerHTML test file anywhere; test infra is jest not vitest (`/Users/ife/replant/jest.config.js`, preset jest-expo; package.json `"test": "jest"`) — answers AC-2's runner question.
- Mobile `.github/workflows/` contains only `update-changelog.yml` (push-to-main changelog generator; runs no tests) — no PR-triggered CI exists, so AC-4 has no substrate.
- Parity target confirmed: admin origin/main HAS `src/test/no-dangerously-set-inner-html.test.js` (KAN-119 AC-12), whose header explicitly notes mobile stays a manual SM-grep ritual "until the mobile repo gets its own CI gate".
- Invariant itself currently holds: `grep -rln dangerouslySetInnerHTML /Users/ife/replant/src/` → zero matches.
- Parity caveat: the admin test is not pipeline-enforced either — admin `.github/workflows/` = changelog only; Netlify build command is `npm run build` (no vitest). "CI enforcement" on both repos is currently local-`npm test` only.
MISSING: AC-1 (test file), AC-2 (runner wiring — will be jest, not vitest), AC-3 (header comment), AC-4 (PR-triggered CI — does not exist in the repo at all), AC-5 (SEC stamp).
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Mobile test/CI parity not started; mobile runner is jest (jest-expo), so the ticket's vitest framing needs a one-word amendment at dispatch.
- Zero dangerouslySetInnerHTML matches in mobile src/ today — invariant holds, unenforced.
- Admin reference test exists at the SCAFFOLD path (BA's flag resolved) but is NOT run by any GitHub Actions or Netlify build step — neither repo has PR-triggered test CI; AC-4 implies creating the mobile repo's first test workflow.
- COO DEFER hold (2026-05-14) still governs.

## KAN-136 — [SEC] Post-leak hardening — gitleaks Actions + PAT review + SECURITY.md + .gitignore audit
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- F.1: no gitleaks workflow in either repo — `.github/workflows/` = `update-changelog.yml` only in both (`grep -ril gitleaks .github/` both repos → zero).
- F.4: admin `SECURITY.md` @ origin/main is the KAN-99 ops-only password-reset doc ("Last reviewed: 2026-05-07"; git log = KAN-99 commits 4a5927e + bf03007 only); zero of the five F.4 posture items (1Password boundary / gitleaks pre-commit / SSH standard / no-PATs / secret-scanning link) present.
- F.7: no documented .gitignore audit (ticket has no post-filing comments; admin .gitignore last touched by KAN-94 commit 1e81244). Content is already hygienic (.env family, .DS_Store, IDE dirs) — the audit itself is the missing artifact.
- F.2: no PAT decision documented on the ticket; not repo-verifiable.
- Coverage-premise finding: the local gitleaks pre-commit hook exists at `~/.git-hooks/pre-commit` (global `core.hooksPath`, installed 2026-05-11) and covers the ADMIN repo — but the MOBILE repo's local `.git/config` sets `core.hooksPath=/Users/ife/replant/.git/hooks`, which contains NO pre-commit hook → mobile commits are not gitleaks-scanned at all (neither locally nor server-side).
- F.6 inline note: stale branch `origin/claude/check-file-access-EAFsT` still exists on the mobile remote. F.3: `.gitleaksignore` present in both repos.
MISSING: F.1 (both workflows), F.2 (documented decision), F.4 (hygiene section in SECURITY.md), F.7 (documented audit) — all four bundled items.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- None of the four bundled items (F.1/F.2/F.4/F.7) is done or documented.
- Both repos' only workflow is update-changelog.yml; no server-side secret scanning anywhere.
- Admin SECURITY.md exists but is entirely KAN-99 ops-reset scope; the 2026-05-11 hygiene section was never added.
- New finding raising urgency above the filed P3 premise: mobile repo's local core.hooksPath override bypasses the global gitleaks pre-commit hook — mobile commits currently have zero secret-scan coverage, local or CI.
- Stale branch `claude/check-file-access-EAFsT` (F.6 courtesy item) still on mobile remote.

## KAN-156 — Data quality: global gap tracking — phone format, country standardization, font rendering, i18n
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Phone: no libphonenumber/E.164 anywhere in either repo (package.json + code grep → zero). `users.phone` and `churches.contact_phone` columns exist with no format constraint (contact_phone deliberately stripped from public surfaces per KAN-211 migration 20260528000000).
- Country: stored as full-name strings. Mobile signup constrains intake via a hardcoded ~88-entry full-name COUNTRIES array (`src/screens/onboarding/RegisterChurchPage1Screen.tsx:556`, twin in AccountSetupPage1Screen); admin derives macro_region via full-name `COUNTRY_TO_REGION` map (`netlify/functions/_lib/region-map.js`, KAN-147). No ISO-3166 canonical standard, no country-value audit/migration.
- Fonts: mobile loads CormorantGaramond + DMSans only (`App.tsx:93` useFonts); no non-Latin font audit artifact exists; non-Latin scripts ride unverified system-font fallback.
- i18n: zero infrastructure — corroborated by pre-UAT audit `docs/audits/2026-07-01-pre-uat-comprehensive-audit.md:233` ("no framework, no t() calls, no expo-localization… ~490 hardcoded English strings"), classed P1 post-MVP there.
- Tracker mechanics: AC "to be defined per sub-item at grooming" never happened; no spun-off implementation tickets are referenced in the ticket file and no repo artifact evidences any of the four gaps being systematically diagnosed.
MISSING: all four gaps undiagnosed/unresolved; grooming + per-gap AC definition (the ticket's own next step) not done.
DEPLOYED: n/a
NEEDS-LIVE-DB: diagnosis query the SM comment itself asked for: `SELECT country, count(*) FROM public.churches GROUP BY 1 ORDER BY 2 DESC;` (prioritizes font-script + country-standardization work).
NEEDS-SIM: render a leader/church name in Arabic + CJK + Devanagari on device (e.g. temp row or seed) to verify system-font fallback for gap 3's minimum bar (native-script names render even while UI stays English).
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- Tracker never groomed; none of the four gaps has an implementation artifact in either repo.
- Phone: no E.164/libphonenumber; columns store free-form strings.
- Country: full-name strings constrained only by a hardcoded signup dropdown (~88 entries) + admin region-map full-name keys — no ISO standard, no audit migration.
- Fonts: only Latin-script CormorantGaramond + DMSans are loaded; non-Latin rendering is unaudited system fallback.
- i18n: zero infrastructure; pre-UAT audit (2026-07-01) independently logged ~490 hardcoded English strings as P1 post-MVP — the two trackers should be cross-linked to avoid double-tracking.

## KAN-157 — LEGAL: International data handling — cross-border compliance, privacy policy, ToS alignment
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Deliverable (Legal memo / compliance checklist): NOT FOUND — `/Users/ife/replant/docs/` contains design handoffs/audits/emails, zero legal/compliance/GDPR artifacts; same for admin repo.
- Privacy Policy / ToS: NOT FOUND — website source `/Users/ife/replant/website/` = index.html, faq.html, volunteer.html, next-steps.html only; faq.html has a "Privacy & Safety" FAQ category (line 899) but no policy document; no ToS anywhere. (iOS `PrivacyInfo.xcprivacy` is an Apple manifest, not a policy.)
- Stale technical anchor in ticket context: `scrub_church_pii()` does NOT exist in either repo. The current automated PII-lifecycle mechanism is `fn_hard_delete_expired_soft_deletes()` (`supabase/migrations/20260623_0007_hard_delete_sweeper.sql` — Day-30 tombstone PII scrub, pg_cron daily 03:00 UTC) plus the soft-delete RPCs (20260623_0006).
- LEGAL role unassigned per ticket comments; KAN-205 (self-deactivation shell) remains blocked-by this ticket per the 2026-05-24 comment.
MISSING: entire scope — legal memo, all six analysis areas, Privacy Policy + ToS review.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- No legal memo, no Privacy Policy, no ToS exists in either repo or the website source; drafting "actively" referenced in the ticket has no repo artifact.
- Ticket's technical anchor is stale: `scrub_church_pii()` (90-day) not found anywhere; current lifecycle = Day-30 tombstone scrub via `fn_hard_delete_expired_soft_deletes()` (pg_cron 03:00 UTC) — LEGAL handoff surface-map must be corrected before analysis.
- KAN-205 is still blocked-by this ticket; High priority + launch-gating framing stands.
- LEGAL role remains un-onboarded/unassigned; ticket cannot be dispatched to code agents by design.

## KAN-222 — Pre-launch copy sweep — review and refine wording across all app surfaces
CURRENT LANE: Backlog
VERDICT: NOT_BUILT
EVIDENCE:
- Both example strings the Founder flagged are still live verbatim: `src/components/church/CompletionFlowOverlay.tsx:335` ("Before you enter the Network,…let's finalize your card.") and `:342` ("You are verified. Other leaders are waiting to find you…").
- No copy-sweep or KAN-222 commits in either repo (`git log --all --grep` both repos → zero).
- Pre-UAT audit (2026-07-01, `docs/audits/…:233`) independently confirms unswept state: ~490 hardcoded English strings across mobile surfaces.
- Ticket has zero comments; the Founder-led review pass that gates CC implementation has not begun.
MISSING: entire scope — Founder copy review pass + CC implementation of approved changes.
DEPLOYED: n/a
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- No sweep has occurred; the two named welcome-screen strings from the KAN-213 device pass are unchanged in CompletionFlowOverlay.tsx (lines 335/342).
- ~490 hardcoded English strings across mobile (pre-UAT audit 2026-07-01) define the sweep surface.
- Ticket is Founder-gated (review pass precedes implementation) and is marked pre-launch critical — belongs in To Do, not Backlog, as GA approaches.
- Suggest pairing the sweep with KAN-156's i18n groundwork decision so approved copy lands once (string freeze before any t() wrapping).
