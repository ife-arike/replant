# Cluster: underground-signup — 8 tickets (KAN-181/182/183/186/187/188/189/191)

Shipped-design baseline (2026-06-19..25 underground sprint, Founder-ratified 33 rulings + CD handoff ratifications): standard `church_code` (RPL-NNNNN, identical to surface churches, no visual differentiator BY DESIGN) + separate one-shot `underground_join_code` (RPL-XXXX-NNNNN, bcrypt-hashed at rest in `churches.underground_join_code_hash`, lazily minted at reveal, revealed exactly once, second-leader join only). There is deliberately NO `underground_network_id` column — zero hits repo-wide.

---

## KAN-181 — Security fix: exclude underground churches from onboarding search (D-59)
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- `/Users/ife/replant/supabase/functions/search-churches/index.ts:7-9,88-92,106-120` — ASP2 onboarding search (SEARCH_CHURCHES_URL at `/Users/ife/replant/src/screens/onboarding/AccountSetupPage2Screen.tsx:63`) sources exclusively from `churches_public`; the RPL-ID direct-lookup branch re-selects from `churches_public`, so a UG RPL code returns zero rows.
- `/Users/ife/replant/supabase/migrations/20260528000000_kan211_churches_public_contact_cleanup_v1.sql:174` — `churches_public` view def: `WHERE is_active = true AND type <> 'underground'`; live-verified 2026-07-01 (`/Users/ife/replant/docs/audits/_working/db-rls-schema.md:94`).
- `/Users/ife/replant/supabase/migrations/20260702024153_find_similar_churches_exclude_underground.sql:31` — `AND c.type <> 'underground'` added to `find_similar_churches` (the anon signup duplicate-check RPC). This was a REAL gap until 2026-07-02: pre-UAT audit P1-2 found it returned UG name+verification_status on name/email/phone match (existence oracle).
- `docs/audits/_working/db-rls-schema.md:159` (P3-4) — live spot-check: `find_church_by_code` and `find_parentable_churches` (RegCP1 branch-parent picker, also onboarding-time) both exclude underground; `search_leaders`/`get_invite_candidates` mask/exclude UG (comprehensive audit line 100).
- NOT FOUND: any sentinel/regression test asserting UG exclusion on onboarding-search paths — `search-churches` tests contain no underground assertion (exclusion lives in the view, unreachable by the unit mocks); no pgTAP/e2e infra in repo.
MISSING: Sentinel test per AC5-resolution + DoD ("no code change needed, just stamp + sentinel test"); DBA + SEC re-affirm stamps. Enforcement itself is fully built and deployed.
DEPLOYED: yes (view + RPC migrations mirrored to prod; search-churches edge fn deployed)
NEEDS-LIVE-DB: none
NEEDS-SIM: In ASP2 church search, enter a known UG church's name and its RPL church_code — both must return zero results; a surface-church name must still return normally (AC4 no-regression).
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Server-side UG exclusion verified on every onboarding church-query path: search-churches→churches_public (incl. RPL-ID branch), find_church_by_code, find_parentable_churches, find_similar_churches, search_leaders, get_invite_candidates.
- churches_select_active RLS did NOT cover the actual paths (service-role edge fn + SECURITY DEFINER RPCs bypass RLS) — AC5's verify-on-build was warranted; enforcement lives at view-WHERE + RPC-predicate level.
- find_similar_churches was a live UG existence/contact oracle until 2026-07-02 (pre-UAT audit P1-2); closed by migration 20260702024153 on prod.
- Correction to 2026-06-23 comment: register-church does NOT skip the similarity check for type=underground (only branch/force skip — register-church/handler.ts:110-117); protection instead lands via find_similar_churches excluding UG rows from candidates.
- Outstanding: sentinel test guarding the exclusion against regression (none exists in repo) + DBA/SEC stamps.

---

## KAN-182 — Schema + generation: underground_network_id column (D-60, D-57)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- `underground_network_id` = ZERO hits across all .ts/.tsx/.sql/.md in `/Users/ife/replant` — the column, the `{church_code}-{NNN}-{word}` format, and the wordlist were never built, by design.
- Replacement (live-verified 2026-07-01, `docs/audits/_working/db-rls-schema.md:100-108`): `churches.underground_join_code_hash` + `join_code_only_underground` CHECK + partial UNIQUE `churches_underground_join_code_hash_unique` + `trg_prevent_underground_join_code_hash_change` immutability trigger (mirrors ticket AC6's intent).
- `/Users/ife/replant/supabase/functions/reveal-join-code/index.ts:1-18` — lazy one-shot mint+reveal: `reveal_underground_join_code(p_church_id)` mints, hashes, sets revealed_at, audits, returns plaintext ONCE; idempotency cache stores tombstone only; retry → 410 `code_already_consumed`; admin rotation is sole recovery (stronger than ticket AC3's "response payload one time").
- `/Users/ife/replant/supabase/functions/create-account/index.ts:17-19` — no code generated at signup (Founder ratification 2026-06-20, reveal-on-tap); code format `RPL-XXXX-NNNNN` per ruling #2 (`join-underground-church/logic.ts:43-44`), bcrypt at rest per ruling #3.
- Never exposed via search/list (ticket AC4 intent): hash column is REVOKEd from client UPDATE (migration 20260702021338) and `churches_public`/`churches_admin` exclude UG rows entirely.
MISSING: n/a (superseded)
DEPLOYED: yes (DB columns/CHECK/trigger live per 2026-07-01 audit; reveal-join-code + create-account v8 edge fns deployed)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Spec replaced by locked 2026-06-19/20 underground-flow design: NO underground_network_id column exists anywhere; UG churches carry the standard RPL-NNNNN church_code (identical to surface churches, no differentiator by design).
- Affiliation credential is the separate one-shot underground_join_code (RPL-XXXX-NNNNN, ruling #2), bcrypt-hashed at rest (ruling #3) — stronger than the ticket's plaintext-column spec (nothing recoverable at rest).
- Immutability delivered as trg_prevent_underground_join_code_hash_change + client-write REVOKE (P0-2), mirroring the ticket's prevent-change-trigger intent.
- One-time disclosure delivered via reveal-join-code (2-tap gate, tombstone idempotency, 410 on retry, admin-rotate-only recovery) — supersedes at-registration response-payload display.
- Close as superseded; no residual scope.

---

## KAN-183 — Affiliation lookup endpoint: Network ID → church name + region (D-59, D-60)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- No lookup endpoint exists (`supabase/functions/` listing: no lookup-underground or similar) — deliberate: the shipped design removed the confirm-before-join step entirely, so no endpoint ever returns church name/region for a code (zero-oracle posture, stronger than the ticket's minimal-disclosure 404 design).
- Replacement: `/Users/ife/replant/supabase/functions/join-underground-church/` — one-shot atomic redemption: `index.ts:14-15` single generic `invalid_or_consumed_code` on EVERY failure (ruling #4); `handler.ts:116-119` cap-of-2; `index.ts:218-228` constant-time bcrypt compare delegated to `redeem_underground_join_code` RPC as the user (plaintext never compared in JS); `index.ts:279-311` per-IP 5/hr rate limit FAIL-CLOSED with in-memory bucket fallback (ruling #27).
- `handler.ts:184-205` — sole deliberate exception: 409 `email_already_registered` (Founder override 2026-06-20, accepted enumeration trade for legitimate-reuser UX).
- Success returns `{ userId, churchId }` only after full account creation + attach; comp-delete orphan prevention on any post-createUser failure (`index.ts:22-23`).
- 2026-07-01 edge-fn audit verdict row (`docs/audits/_working/edge-functions.md:163`): join-underground-church READY — fail-closed RL, constant-time redeem, cap-of-2, comp-delete, generic errors all ✓.
MISSING: n/a (superseded)
DEPLOYED: yes
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: Done
COMMENT-FACTS:
- The lookup/confirmation endpoint was deliberately not built: Founder-locked design (2026-06-19 rulings) has NO pre-join confirmation — trust is the in-person code handoff; any name+region lookup would itself be an oracle.
- Replaced by join-underground-church one-shot redemption: constant-time bcrypt via redeem_underground_join_code RPC, single generic error for all failure modes, per-IP 5/hr fail-closed rate limit, cap-of-2, comp-delete orphan prevention.
- Ticket's enumeration-protection goals (generic 404 posture, rate limit, no distinguishing detail) are all present in the replacement — plus the code is consumed on first use (hash nulled), which the lookup design could not offer.
- Audit-log posture: plaintext join code never logged (defensive key-scrub in both join + reveal fns); UG church names never logged.
- Close as superseded by join-underground-church + reveal-join-code; no residual scope. KAN-182's replacement note applies here too.

---

## KAN-186 — Underground onboarding: separate navigator stack (D-57)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- `/Users/ife/replant/src/navigation/OnboardingNavigator.tsx:114-121,209-218` — three dedicated UG routes registered: `UndergroundEntry`, `NameVisibilityChoice`, `JoinByCode` (routes within the single onboarding stack, not a separate navigator).
- `/Users/ife/replant/src/screens/onboarding/RegisterIntroScreen.tsx:81-90,122-126` — entry point is the "Register an underground church" tile on the RegisterIntro 3-tile chooser (inserted between ASP2 and RegCP1, 2026-06-18 Option A), NOT a link on AccountSetupPage1 (ASP1 has zero 'underground' references — AC2's placement superseded).
- `/Users/ife/replant/src/screens/onboarding/UndergroundEntryScreen.tsx:63-69,96-104` — nested secondary chooser (ruling #13): "Register a new underground church" → RegCP1 with `entry='underground'` / "Join an existing fellowship with a code" → JoinByCode; join path never advertised on the main intro.
- AC5 held for its named screens: ASP1/ASP2 carry no underground parameterization; but `RegisterChurchPage1` IS parameterized (`entry` param, type locked, `RegisterChurchPage1Screen.tsx:104-114,356`) and `NameVisibilityChoiceScreen.tsx:141-146` loops back to ASP2 for the atomic create-account v8 submit — AC6's "no ASP2 loopback" was deliberately replaced by the SME-locked orphan-prevention architecture (2026-06-14: create-account owns the single atomic write boundary, fired from ASP2).
- Founder walked the happy path on device 2026-06-22 (Shine Bright Church Gathering, church id 6d8670e8) per ticket comment; residual UG-signup bugs tracked in KAN-247.
MISSING: n/a (superseded)
DEPLOYED: yes for BE; mobile-tree for the RN screens (in pushed source-of-truth branch; reaches devices via Expo build — a dev build containing the flow was device-walked 2026-06-22)
NEEDS-LIVE-DB: none
NEEDS-SIM: Re-walk RegisterIntro → Underground tile → UndergroundEntry and confirm both branches (RegCP1-underground / JoinByCode) reachable with back-navigation intact.
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Dedicated UG onboarding path SHIPPED 2026-06-19/22 with a Founder-ratified structure differing from this ticket's spec: entry = RegisterIntro 3-tile chooser (post-ASP2), not an ASP1 link; nested UndergroundEntry chooser (ruling #13) shields the join-with-code option from over-the-shoulder observation.
- AC5 honored where it pointed: ASP1/ASP2 carry no underground flags; RegCP1 is entry-parameterized instead (type-locked, location fields removed for UG).
- AC6 (no ASP2 loopback) superseded by the 2026-06-14 orphan-prevention architecture: ALL church-creation paths (standalone/branch/underground) stage the church and loop to ASP2, where create-account v8 performs the single atomic auth+users+churches write.
- Founder device-walked the founder happy path 2026-06-22; known follow-up bugs live in KAN-247 (post-MVP holding) and do not block close.
- Close as superseded (goal met by shipped design).

---

## KAN-187 — Underground personal details screen (D-57, D-58)
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- Shipped design shares ASP1 as the single personal-details surface for all paths (no dedicated UG personal-details screen): `/Users/ife/replant/src/screens/onboarding/AccountSetupPage1Screen.tsx:130-152` fields = first/middle/last name, email, phone, password, role (12-role enum matching AC1), country picker, inline anonymous toggle. NO city/address/lat-lng anywhere (AC3 met). Second-leader path collects personal details inline on JoinByCode (`JoinByCodeScreen.tsx` "Mirrors ASP1+ASP2 fields").
- AC2 NOT BUILT: no `users.country` column exists (no migration repo-wide; the Founder-ratified `ALTER TABLE public.users ADD COLUMN country text NULL` never shipped); `CreateAccountPayload` has no country field (`create-account/logic.ts:256-278`); ASP2's payload omits it (`AccountSetupPage2Screen.tsx:915-941`); JoinByCode has no country field at all.
- Sharper: ASP1's country is REQUIRED (`AccountSetupPage1Screen.tsx:186` — form invalid without it) and `personalDetails.country` has ZERO consumers repo-wide — collected then silently discarded. This inverts D-58's optional-in-UG-flow intent (required, not optional; unpersisted, not stored-as-NULL-able).
- AC5 superseded-inverted: UG RegCP1 carries optional in-app "needs/has" share fields (Founder ruling 2026-06-20, `RegisterChurchPage1Screen.tsx:300-309`); connect@ was deliberately REMOVED from the UG loop (ruling #22 — email channel treated as compromised; create-account/handler.ts:502-515 suppresses the connect@ admin email for UG founders). No email-us-to-disclose pointer exists.
- AC6 superseded: register-vs-affiliate branch happens BEFORE the form via UndergroundEntry chooser, not on personal-details submit.
MISSING: AC2 — optional personal country persisted to `users.country` (column + create-account payload field + optional UI semantics). Never built anywhere; ASP1's required-but-discarded country field is the current state.
DEPLOYED: yes for BE; mobile-tree for RN screens
NEEDS-LIVE-DB: Confirm column truly absent live (expected 0 rows): `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='country';`
NEEDS-SIM: Walk UG founder path through ASP1 and confirm personal-details surface shows no city/address/location fields; note country picker is mandatory.
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Personal-details goal (no location capture, privacy-forward path) met via shared ASP1 in the shipped 2026-06-22 design — no dedicated UG personal-details screen exists, per Founder-walked structure.
- AC2 (KAN-185-absorbed optional country → users.country) was NEVER built: no column, no payload field, no migration.
- Live oddity worth a Founder ruling: ASP1 requires a country selection but the value has zero consumers — it is discarded client-side, never persisted for any signup path (surface or underground).
- AC5's "email connect@ to disclose more" was superseded by the opposite posture: ruling #22 removed connect@ from the UG loop entirely (compromised-channel assumption); optional in-app needs/has fields on UG RegCP1 carry voluntary disclosure instead.
- Decision needed: formally drop the users.country scope (close this ticket superseded) or respawn it as a scoped ticket; either way resolve the collected-but-discarded ASP1 country field.

---

## KAN-188 — Underground new church registration screen (D-57, D-59, D-60)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- AC1 inverted by ratified design: `RegisterChurchPage1Screen.tsx:104-114,356,398-399,634-642` — RegCP1 IS reused with `entry='underground'` (type locked, city/address/lat-lng fields hidden and cleared, RAG defaulted red, private-name notice); the NEW screen is `NameVisibilityChoiceScreen.tsx` (show/hide name + irreversible-commit framing, "Submit Church" CTA, default hidden matching the server default). UG founders skip RegCP2 entirely (`RegisterChurchPage1Screen.tsx:300-302,531-537` → NameVisibilityChoice).
- AC2/AC3 met-variant: UG payload = name, country (admin-only per underground_no_location relaxation), contact, state_declaration, show_church_name — no city/lat/lng on the wire (`NameVisibilityChoiceScreen.tsx:92-109`); RAG is FORCED red server-side regardless of FE (`create-account/logic.ts:172-205`), hardened post-signup by `enforce_underground_rag_red` trigger (migration 20260702023938); `underground_no_location` CHECK backstops at DB (migration 20260520000001; live-verified audit line 99).
- AC4 met-variant: register-church called validation-only (verify_jwt=false), church row born later via create-account v8 atomic RPC on ASP2 submit (orphan prevention).
- AC5/AC7 superseded by a stronger mechanism: no ID exists at registration; join code is lazily minted at post-VERIFICATION one-shot reveal — `auth-status-check/handler.ts:127-165` (`underground_join_code_pending_reveal` only for founding leader of verified UG church, no prior reveal), 2-step "I'm somewhere private" gate + copy-on-tap + heap-drop of plaintext (`src/screens/main/JoinCodeRevealScreen.tsx:14-23,242-243`), 410 `code_already_consumed` forever after; nothing recoverable anywhere in-app (AC7's intent exceeded — hash at rest only).
- Welcome email = generic `underground_pending` body, no church/role/region/country/"underground" mention; no connect@ admin email for UG founders (`create-account/index.ts:235-253`, `handler.ts:435-444,502-515`).
MISSING: n/a (superseded)
DEPLOYED: yes for BE + migrations; mobile-tree for RN screens
NEEDS-LIVE-DB: none
NEEDS-SIM: Device-walk UG founder registration (RegCP1-underground → NameVisibilityChoice → ASP2 submit) and confirm pending state lands; post-verification, confirm the code-ready prompt + 2-tap reveal appears once and never again.
RECOMMENDED LANE: Done
COMMENT-FACTS:
- UG registration screen SHIPPED 2026-06-19/22 as RegCP1 `entry='underground'` variant + NEW NameVisibilityChoice screen (show/hide church name, default hidden, "Submit Church") — reuse of RegCP1 was ratified via CD handoff, replacing this ticket's no-reuse AC.
- Location impossible by construction: FE omits city/lat/lng, create-account v8 strips them server-side, underground_no_location CHECK rejects at DB; RAG locked red server-side + BEFORE-UPDATE trigger (2026-07-02) closed the Settings-toggle bypass.
- AC5/AC7 (show Network ID once at registration) superseded by the stronger post-verification one-shot reveal: no code exists until the founding leader taps through the 2-step private-place gate; plaintext returned once, hash-only at rest, 410 on any retry, admin rotation sole recovery.
- Welcome email is the generic underground_pending body (no church/role/region/underground reference); connect@ admin email suppressed for UG founders — UG queue + audit_log_underground carry the admin signal.
- Close as superseded (goal met, several protections exceed spec).

---

## KAN-189 — Underground affiliation flow: Network ID entry (D-59, D-60)
CURRENT LANE: Backlog
VERDICT: SUPERSEDED
EVIDENCE:
- `/Users/ife/replant/src/screens/onboarding/JoinByCodeScreen.tsx` — path-B screen SHIPPED: single code input (segmented cell UI, `autoCapitalize="characters"`, `autoCorrect={false}` lines 269-270; no browse/list/autocomplete surface anywhere) + inline personal-details fields; submits `{ idempotencyKey, joinCode, leader }` to join-underground-church which redeems + creates the account atomically.
- AC3/AC4 superseded: NO lookup/confirmation step exists — no church name/region is ever shown pre-join (deliberate zero-oracle design; KAN-183's endpoint was never built). On success the leader lands signed-in and attached (`users.church_id` set via `attachUserToChurch`, `join-underground-church/index.ts:240-246` — AC5's linkage intent met).
- AC6 met: all redemption failures map to one generic copy (`JoinByCodeScreen.tsx:173-187,383-392`; BE single `invalid_or_consumed_code`, ruling #4); sole ratified exception 409 `email_already_registered` (Founder override 2026-06-20).
- AC8 variant: 429 → "Too many tries. Please wait a few minutes before trying again." (`JoinByCodeScreen.tsx:388-392`) — generic wait copy, though it does acknowledge throttling ("too many tries"), a softer posture than this ticket's don't-confirm-detection wording; the governing spec is now ruling #27 (5/hr per-IP fail-closed + lifetime per-code cap then admin-rotate).
- 2026-07-01 edge-fn audit: join-underground-church READY (constant-time redeem, cap-of-2, comp-delete, generic errors, fail-closed RL); noted gap — no unit tests on join-underground-church/reveal-join-code (`docs/audits/_working/edge-functions.md:103,163`).
MISSING: n/a (superseded)
DEPLOYED: yes for BE; mobile-tree for the RN screen
NEEDS-LIVE-DB: Verify the two DB-side claims that have no repo mirror (bcrypt compare + lifetime attempt cap per ruling #27): `SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='redeem_underground_join_code';`
NEEDS-SIM: With a verified UG church whose code has been revealed, walk JoinByCode as second leader (success path); then submit a wrong code and confirm the single generic error renders with no format-vs-existence distinction.
RECOMMENDED LANE: Done
COMMENT-FACTS:
- Second-leader affiliation SHIPPED 2026-06-20 as JoinByCode + join-underground-church one-shot redemption — the confirm-church-before-joining step (KAN-183 lookup) was deliberately removed; the in-person code handoff is the trust anchor and nothing discloses church identity pre-join.
- Enumeration posture verified in code: single generic invalid_or_consumed_code on every failure path, constant-time bcrypt via redeem RPC, per-IP 5/hr fail-CLOSED (in-memory bucket fallback), code consumed (hash nulled) on first successful join, plaintext never logged (defensive log scrub).
- Ratified exception: email_already_registered is distinguishable (Founder override 2026-06-20 — accepted trade).
- Input hardened against enumeration assist: autoCorrect off, character cells, no autocomplete/browse/suggestions UI.
- Residual (non-blocking, flagged by 2026-07-01 audit): no unit tests pin the generic-error/fail-closed/one-shot invariants on join-underground-church or reveal-join-code.

---

## KAN-191 — RLS hardening: underground data tier (MVP) (D-61, Lean-2)
CURRENT LANE: Backlog
VERDICT: PARTIAL
EVIDENCE:
- AC1/AC3 anchors (the five KEEP policies incl. `churches_underground_restrict`, `churches_select_active`, `churches_admin_select` with `type <> 'underground'`) were live-verified 2026-05-20 in the ticket itself; no repo migration since touches any of them (grep across `supabase/migrations/`: only 20260702031830, which DROPs the `admin_region_read` always-true UPDATE landmine — a strengthening). AC5 verified live 2026-07-01: `churches_admin` view `WHERE type <> 'underground'` (`docs/audits/_working/db-rls-schema.md:95`).
- AC6 met in code: founder linkage via `create_account_atomic` (atomic users+churches insert, `create-account/index.ts:160-200`); second-leader linkage via `attachUserToChurch` post-redeem (`join-underground-church/index.ts:240-246`).
- P0-2 remediation (2026-07-01/02) materially STRENGTHENS this ticket's model: migration 20260702021338 revoked table-level UPDATE on `users` from authenticated/anon and re-granted only 20 non-privilege columns (is_underground_admin/role/verification_status/church_id NOT writable), + surgical REVOKE of 17 `churches` privilege columns (show_church_name, type, underground_join_code_hash, region_admin_only…); migration 20260702031920 `guard_users_privilege_cols` trigger blocks any direct client mutation of `church_id` et al. — closing the self-affiliation bypass (a leader could otherwise PATCH `users.church_id` to an UG church and become "affiliated" under the RLS anchor). Migration 20260702031830 revoked churches INSERT/UPDATE/DELETE from clients except UPDATE(rag_status), which `enforce_underground_rag_red` (20260702023938) forces red for UG.
- UG read-path masking extended (AC8 territory): get_prayer_wall nulls UG church_id + masked-author role (20260702024300 — closed the P0-4 harvest seed); get_open_prayers own-church-only + anon mask (20260702024556); 2026-07-01 audit ground-truth PASS on the UG-tied table enumeration: `audit_log_underground` FORCE RLS + append-only triggers, `underground_verification_proposals` CHECKs (no_self_confirm, T3 locked out), `underground_evidence_files` grants-revoked + signed-URL RPC only, `underground_claim_events` no-update/no-delete (db-rls-schema.md:103-124).
- NOT FOUND anywhere in repo: AC2/AC9 sentinel tests (pgTAP or Playwright-with-JWT four-row matrix: affiliated ✓ / non-affiliated ✗ / super_admin-direct ✗ / super_admin-via-read-region ✓). No test infra of this kind exists; the 2026-07-01 audit was a one-time manual verification, not a repeatable guard.
MISSING: AC2+AC9 sentinel-test matrix (all four rows); AC8's enumeration result captured on this ticket's audit trail (it lives in docs/audits/2026-07-01 working files instead); fresh by-name re-verification of the five churches SELECT policies post-P0-2 (last named-policy verification 2026-05-20).
DEPLOYED: yes (all cited migrations mirrored to prod; P0/P1 remediation confirmed live 2026-07-02)
NEEDS-LIVE-DB: `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='churches' ORDER BY policyname;` — confirm churches_underground_restrict / churches_select_active / churches_admin_select / churches_select_own / churches_update_own remain byte-identical to the 2026-05-20 anchors (and admin_region_read is gone).
NEEDS-SIM: none (DB-layer ticket)
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- The five KEEP policies were live-verified 2026-05-20 and no subsequent migration weakens them; the only churches-policy change since is the 2026-07-02 DROP of the admin_region_read landmine (strengthening).
- KAN-127 invariant #14 holds across base table AND views: churches_admin view UG-exclusion live-verified 2026-07-01 (AC5 ✓); super_admin UG reveals remain read-region + AAL2 only (no direct-SELECT grant added, AC4 ✓); replant_admin role not introduced (AC7 ✓ — the 2026-06-24 `replant_staff` is a user_role enum value for admin invitees, not a DB role with policies).
- P0-2 (2026-07-01/02) closed a hole the ticket's model silently depended on: clients could previously UPDATE users.church_id (self-affiliate into the UG RLS anchor) and churches.show_church_name/type — now blocked by table/column REVOKEs + guard_users_privilege_cols trigger.
- UG-tied table enumeration (AC8) exists and passes in the 2026-07-01 audit (audit_log_underground FORCE RLS, uvp CHECKs, evidence storage triple-locked, claim events append-only) — needs transplanting onto this ticket for the paper trail.
- Outstanding for Done: AC9 four-row sentinel-test matrix (none exists in any form), DBA+SEC stamps, and the cheap pg_policies spot-check above.
