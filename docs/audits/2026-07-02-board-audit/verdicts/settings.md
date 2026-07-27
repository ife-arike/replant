# Settings cluster verdicts — KAN-73 / KAN-74 / KAN-75 / KAN-138 / KAN-205
Audited 2026-07-02 against mobile tree `feat/kan-296-mobile-attribution-slot` (read-only).

## KAN-73 — [KAN-27b] Settings — Church Section: RAG Status (Screen 20)
CURRENT LANE: To Do
VERDICT: PARTIAL
EVIDENCE:
- `src/screens/main/SettingsScreen.tsx:700-724` — `handleRagChange`: direct `supabase.from('churches').update({ rag_status }).eq('id', churchId)`, optimistic UI + revert, exact error copy "Couldn't save. Check your connection and try again.", same-value early return (line 702), single-flight via `writeInFlight` ref (line 703). Section "03 Church" renders label "Status — can your church worship freely?" with Green/Amber/Red inline radios (lines 1079-1123).
- `supabase/migrations/20260702031830_harden_client_write_surface_sibling_tables_and_churches.sql` — REVOKE all client writes on `churches`, then `GRANT UPDATE (rag_status) ON public.churches TO authenticated` — rag_status is now the ONLY client-writable churches column (mirrored to prod).
- `supabase/migrations/20260702023938_enforce_underground_rag_red_trigger.sql` — BEFORE INSERT/UPDATE trigger forces `rag_status='red'` + nulls override fields for underground churches regardless of what the client writes (mirrored to prod).
- SEC-required RLS: `churches_update_own` = "verified-leader-owns" per the pre-UAT audit live-DB sweep (`docs/audits/2026-07-01-pre-uat-comprehensive-audit.md:32`); the policy itself predates the repo migration mirror (applied live as v1.23.0, 2026-05-03 per ticket DBA comment).
- `src/screens/main/SettingsScreenContainer.tsx:91-114` — reads `church:church_id(id,name,church_code,rag_status,type)`; does NOT fetch `users.verification_status` or `churches.rag_override_expires_at`.
MISSING:
- Verified-leaders-only render gate: no `verification_status` check anywhere in SettingsScreen/Container — Church section renders for pending/deactivated leaders too (DB rejects their write via RLS; FE would optimistic-update then revert with the error copy — not the specced section absence).
- Admin override read-only note: `rag_override` appears NOWHERE in `src/` — the "admin has set this status until {date}" note is not built.
- Ticket copy not shipped: no "Green — Safe / Amber — Caution / Red — Underground" labels, no plain-language descriptions per AC, no action-sheet picker. Shipped copy is the KAN-138 CD design ("— yes, with no limitations / — with some limitations or needs / — severely limited or facing active persecution"), Founder-approved in KAN-138 PR #34 (colored-word swatch removed, glyph-only color). Copy AC is effectively superseded, not missing — but the ticket text was never reconciled.
- New divergence the ticket predates: underground leaders still see the RAG radio (only `isPara` hides it, line 1079); their write "succeeds" but the trigger forces red — UI shows the chosen color + "Saved" while DB stays red.
DEPLOYED: mobile-tree (needs Expo rebuild note); DB grant/trigger migrations = prod
NEEDS-LIVE-DB: `SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid='public.churches'::regclass AND polcmd='w';` — confirm `churches_update_own` USING includes `verification_status = 'verified'`; plus `SELECT grantee, column_name FROM information_schema.column_privileges WHERE table_name='churches' AND privilege_type='UPDATE';` — confirm rag_status is the sole authenticated-writable column.
NEEDS-SIM: As an underground-church leader open Settings → 03 Church → tap Green: confirm UI shows Green+"Saved" while DB stays red (divergence), and decide whether the RAG row should be hidden/locked for UG (mirror of the para-ministry hide).
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- RAG write path is built + hardened: direct `churches.rag_status` update at SettingsScreen.tsx:709-712 with optimistic UI, revert-on-error, same-value no-write, single-flight — matches ticket write AC.
- DB posture exceeds ticket ask: 2026-07-02 grant cleanup leaves `rag_status` as the ONLY client-writable churches column (20260702031830), and `enforce_underground_rag_red` trigger (20260702023938) locks UG churches to red.
- SEC's `verification_status='verified'` RLS tightening confirmed live per DBA v1.23.0 comment + 2026-07-01 audit sweep ("churches_update_own = verified-leader-owns"); policy predates repo migration mirror — one live-DB spot-check closes it.
- NOT built: verified-only render gate (section shows for pending leaders; DB blocks the write), and the admin-override read-only note (`rag_override_expires_at` unread by FE).
- Shipped copy/treatment is the KAN-138 CD design ("can your church worship freely?"), Founder-approved — ticket's "Green — Safe" picker copy is superseded, ticket text never reconciled.
- Open UX gap the ticket predates: UG leaders still see the RAG radio; their pick silently becomes red server-side.

## KAN-74 — [KAN-27c] Settings — Security Section: Change Password (Screen 20)
CURRENT LANE: To Do
VERDICT: NOT_BUILT
EVIDENCE:
- `src/screens/main/SettingsScreen.tsx:759-764` — `handleChangePassword` opens ComingSoonModal: "Password change is on the way." The Password row (lines 977-990, in 01 Account — there is no "Security" section) is a chevron row wired to that stub.
- Repo-wide grep: `supabase.auth.updateUser({ password })` exists ONLY at `src/screens/onboarding/SetNewPasswordScreen.tsx:112` — that is the KAN-40 forgot-password/recovery deep-link flow, not a Settings change-password.
- No `ChangePassword` screen/route exists anywhere (`grep -rln ChangePassword src/` hits only the SettingsScreen stub handler); no `signInWithPassword` re-auth step, no three-field form, no policy-hint reuse in Settings.
MISSING: Entire A/C set — Security section, three-field form (current/new/confirm + show/hide), shared KAN-11 policy validation, server-side current-password verification via `signInWithPassword`, `updateUser()` call, `USER_UPDATED` session-rotation handling, success toast, same-as-current rejection, rate-limit copy.
DEPLOYED: n/a (nothing to deploy)
NEEDS-LIVE-DB: none
NEEDS-SIM: none
RECOMMENDED LANE: To Do
COMMENT-FACTS:
- Not built. Settings "Password / Change password ›" row exists but opens the canonical ComingSoonModal (SettingsScreen.tsx:759-764) — an intentional stub since the KAN-138 v2.1 pass.
- The only `auth.updateUser({password})` in the app is SetNewPasswordScreen.tsx:112 — the KAN-40 recovery flow, a different ticket and a different session type.
- All groundwork from the 2026-05-03 comment thread (signInWithPassword re-auth pattern, `USER_UPDATED` event confirmation, QA TC-74.1-74.4) remains valid and unimplemented.
- Ticket also assumes a "Security" section header; current screen has none — the row lives under 01 Account, so the build should reconcile section placement with the KAN-138 design.

## KAN-75 — [KAN-27d] Settings — Privacy Section: Anonymous Mode (Screen 20) ✅ ESC-08 CLOSED
CURRENT LANE: Backlog
VERDICT: SUPERSEDED (toggle built exactly as specced; canonical display format + enforcement mechanism replaced by later locked design)
EVIDENCE:
- `src/screens/main/SettingsScreen.tsx:676-698` — `handleAnonymousToggle`: direct `supabase.from('users').update({ anonymous }).eq('auth_id', userId)`, optimistic + revert + inline error, single-flight. Rendered in "02 Privacy" (lines 999-1019) with toggle + helper "When on, others see your role and church only — never your name." Container reads `users.anonymous` on mount (SettingsScreenContainer.tsx:95).
- Precedence AC honored and exceeded: Display-Name-preference row is HIDDEN entirely when anonymous is on (SettingsScreen.tsx:865-868, KAN-138 PR #34 fix 5).
- Consumer enforcement moved SERVER-SIDE (stronger than the ticket's FE-helper design): `get_prayer_wall` nulls `leader_display_name`/`leader_role` for anonymous authors with the super_admin carve-out retained (`supabase/migrations/20260702024300...sql:22-30`); `get_open_prayers` gained the same anon mask + super_admin parity (`20260702024556...sql:21-28`); `get_church_profile` returns `name: NULL, anonymous: true` (`20260528000001_kan20_get_church_profile_network_id.sql:64-69`).
- Canonical anon format is now "A fellow {Role}" (+ church line), NOT "[Role] at [Church Name]": `displayHelpers.formatLeaderLine` (src/utils/displayHelpers.ts:112-118 → 'A fellow leader'), NetworkFeed resolveAnonLabel (`src/components/home/NetworkFeed.tsx:348-352` → "A fellow {role}"), ChurchProfileBottomSheet.tsx:433-439, Connect surfaces (LeaderSearch.tsx:168-179, LeadersList.tsx:195, DMThreadView.tsx:547, BranchThreadView.tsx:464-680) all render anon monogram + masked name while keeping the leader findable.
- The ticket's `getLeaderDisplayName` helper DOES exist (`src/utils/getLeaderDisplayName.ts`, KAN-83, format "RoleLabel · ChurchName") but is consumed by the onboarding preview, not as the single source across the six consumer surfaces — masking is per-surface (server RPC + FE label), per the locked anon-identity rules.
MISSING: n/a (goal met by replacement design; see residual risks in comment-facts)
DEPLOYED: mobile-tree (needs Expo rebuild note); all cited RPC migrations = prod
NEEDS-LIVE-DB: none (RPC anon masks + super_admin carve-out present in prod-mirrored migrations)
NEEDS-SIM: Flip Anonymous ON as Account B, then as the other account verify Prayer Wall card, Network Feed item, Church Profile leaders list, and Connect search/thread header all show "A fellow {Role}" with no real name; flip OFF and confirm name restores on refetch.
RECOMMENDED LANE: Testing
COMMENT-FACTS:
- Settings toggle built exactly per AC: reads/writes `users.anonymous`, optimistic + revert + inline error + single-flight (SettingsScreen.tsx:676-698); default false is DB-level (boolean NOT NULL DEFAULT false since v1.0.0).
- ESC-08's "[Role] at [Church Name]" canonical format was SUPERSEDED by the locked anon-identity rules: "A fellow {Role}" + church, masked server-side. Ticket text still carries the old format.
- Enforcement is stronger than specced: `get_prayer_wall` / `get_open_prayers` / `get_church_profile` null the name in the RPC (anonymous authors), with the super_admin carve-out retained in `get_prayer_wall` (20260702024300) — the SEC/DBA Done-gates from the 2026-05-03 thread are closed on prod.
- Precedence AC exceeded: Display-Name row hides entirely when anonymous is on.
- Residual risk already tracked separately: Network Feed author masking is client-side in `useResolvedLeaderAuthor` (NetworkFeed.tsx) — pending its own SEC panel; not a blocker for this ticket's verdict.
- Recommend: sim pass across the consumer surfaces, then Done with a closing comment recording the superseding format.

## KAN-138 — Settings Screen 20 — on-brand visual treatment (v2 pass)
CURRENT LANE: In Progress
VERDICT: PARTIAL (build substantially shipped and iterated well past the ticket; Founder sign-off explicitly withheld 2026-05-23 — "Not yet satisfied, need few more things added.")
EVIDENCE:
- AC1 numbered eyebrow + serif + hairline: SettingsScreen.tsx:336-383 + styles 1598-1615 (mono 9.5px `Colors.accent` number, Cormorant 21px title, 0.5px rule) — shipped, but sections are now SIX (01 Account · 02 Privacy · 03 Church · 04 Language · 05 Notifications · 06 About) with a collapse accordion (lines 454-465), evolving past the ticket's five static sections.
- AC2 epigraph: line 800/849 — `your account, ${viewer.yourChurchOrOrg}.` (para-ministry variant swap added 2026-06-18). AC3 rp-mark 26px in header: line 839. AC4 radio labels + italic sky live specimen: lines 531, 902, 931 + radioSpecimen style — extended by KAN-229 (honorific/suffix/last-name-first/middle-name modifiers feed the specimen). AC5 anon helper italic serif: rowHelper style (Typography.displayMediumItalic). AC7 Connect mission block incl. copy+mailto: lines 738-741, 1219-1233. AC9 Sign out serif / Deactivate mono small-caps 0.55 opacity: styles 1860-1874.
- AC6 (colored word as swatch) and AC8 (rp-mark in foundation) were reversed BY Founder rulings recorded on this ticket: PR #34 removed word color (glyph-only), v2.2 rebuild removed foundation rp-mark and moved the destructive footer ABOVE the foundation block — current code matches the amended rulings, not the original AC text.
- AC10 write contracts: display-name/anonymous/RAG optimistic writes preserved verbatim (lines 535-724); Sign out now has the confirmation modal → `signOut()` (lines 749-751, 1396-1436); Password + Deactivate chevrons go to ComingSoonModal (759-788), NOT Screen 06A / step-up-reauth — those screens are declared Out of scope on this ticket but AC10's nav contract is unfulfilled until KAN-74/KAN-205 build.
- Since Founder's 2026-05-23 "not satisfied" comment the screen absorbed KAN-229 name fields, 05 Notifications (SecureStore-backed badge pref, lines 1144-1166), ComingSoonModal pattern, para-ministry copy/RAG-hide — git: e034013, 8cd880e, e4ffbdb, 2d1e7a1.
MISSING: Founder visual sign-off (DoD item 1) — the one explicit outstanding gate; the "few more things" from 2026-05-23 were never enumerated on the ticket, so the ticket cannot be closed as-is.
DEPLOYED: mobile-tree (needs Expo rebuild note)
NEEDS-LIVE-DB: none
NEEDS-SIM: Founder visual pass of the current Settings screen against her 2026-05-23 "few more things" list — that list needs to be captured on the ticket first.
RECOMMENDED LANE: In Progress
COMMENT-FACTS:
- All 11 AC are implemented or Founder-amended: AC1-5/7/9/11 shipped as written; AC6 + AC8 intentionally reversed by Founder rulings recorded in this ticket's own comment trail (glyph-only RAG color, no foundation rp-mark, destructive footer above foundation).
- Screen has iterated well past the v2 pass since: collapse accordion, 05 Notifications section, KAN-229 name-field modifiers + honorific/suffix pickers, ComingSoonModal, para-ministry variants — file header now reads "KAN-138 v2.3".
- AC10's Password → Screen 06A and Deactivate → step-up-reauth navigations are ComingSoon stubs; both target screens are Out of scope here (KAN-74 / KAN-205).
- Blocker to Done is singular: Founder's 2026-05-23 "Not yet satisfied, need few more things added" was never itemized — capture the list or run the sign-off pass.

## KAN-205 — [Settings] User self-deactivation — account deactivation from Settings screen
CURRENT LANE: Backlog
VERDICT: PARTIAL (DB layer fully built + on prod; Settings UI deliberately stubbed; ticket's three grooming preconditions not evidenced as cleared)
EVIDENCE:
- `supabase/migrations/20260623_0006_soft_delete_rpcs.sql:80-150` — `fn_soft_delete_my_account(p_reason)`: SECURITY DEFINER, enforces `p_reason='leader_initiated'`, audit-before-content (audit_log_underground for UG), sets `soft_deleted_at` + `hard_delete_scheduled_at = now()+30d` + `is_active=false`, mirrors soft-delete onto the church when the caller is the last active leader. GRANT EXECUTE TO authenticated.
- Same file lines 156-228 — `fn_restore_my_account()`: self-restore within 30 days, leader-initiated-only (admin-initiated deactivations bounce to team), restores mirrored church row. Both mirrored to prod per repo rules.
- `src/screens/main/SettingsScreen.tsx:783-788` — `handleDeactivateTap` opens ComingSoonModal: "Account deactivation is on the way. A guided deactivation flow will be available before launch." DEACTIVATE ACCOUNT row renders in the destructive footer (lines 1258-1265).
- Repo-wide grep: NO caller of `fn_soft_delete_my_account` / `fn_restore_my_account` anywhere in `src/` or `supabase/functions/` (only a doc comment in `auth-status-check/logic.ts:82`) — the RPCs are unwired end-to-end.
MISSING: Entire Settings-side flow — deactivation surface, confirmation/consequence ceremony, step-up reauth, RPC invocation, post-deactivation routing, restore surfacing at login. Also missing: the three DO-NOT-GROOM preconditions (KAN-157 legal ratification, Screen-20 wireframe, Founder reversible-vs-deletion ruling) have no closure evidence on this ticket — though the shipped RPCs de facto implement a reversible 30-day-window posture, which pre-answers precondition 3 unless Founder/Legal rule otherwise.
DEPLOYED: DB RPCs = prod; UI stub = mobile-tree; flow itself = not built
NEEDS-LIVE-DB: none (migration mirror is authoritative per brief)
NEEDS-SIM: none (nothing wired to test)
RECOMMENDED LANE: Backlog
COMMENT-FACTS:
- DB layer is DONE and on prod: `fn_soft_delete_my_account` / `fn_restore_my_account` (20260623_0006, UG-queue migration 6/8) — leader-initiated-only, audit-before-content, 30-day restore window, hard-delete scheduling, last-active-leader church mirror.
- Settings UI is an intentional stub: DEACTIVATE ACCOUNT row → ComingSoonModal ("A guided deactivation flow will be available before launch"); zero FE/edge-function callers of either RPC.
- The RPCs embody a reversible-soft-delete posture (disabled, data retained 30 days, self-restore) — this partially pre-decides the ticket's precondition 3 (Founder reversible-vs-deletion ruling); grooming should ratify or amend that posture explicitly with KAN-157 (legal) still open.
- Ticket remains a correctly-parked shell: AC is TBD by design; keep in Backlog until the three preconditions clear, then the build is mostly UI + wiring.
