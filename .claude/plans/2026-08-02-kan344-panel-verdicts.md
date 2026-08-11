# KAN-344 Referral wiring Phase 1 — SEC + DBA panel verdicts (2026-08-02)

Both panels ran as independent opus agents against live code (~/replant, ~/replant-admin) and read-only prod SQL (jiyetphxxvyiicrnwlnx). Full verdicts below, verbatim from each panelist. Build is gated on these + the Founder decisions listed at the end.

**Verdicts: SEC GO-WITH-CHANGES (12 required changes) · DBA GO-WITH-CHANGES (6 mandatory changes).**

## The one SEC↔DBA divergence (needs Founder arbitration)

New users' code generation:
- **SEC change 1:** stop deriving codes from `users.id`; new codes = random server tokens (the derived code is a 32-bit PK prefix — F1 de-anonymization exposure).
- **DBA change 5:** mint the row `id` by reroll so derived == stored permanently — because the SHIPPED app build derives codes client-side, and an independent generator hands every new pre-update user a dead link.

Resolution options: (a) DBA reroll — keeps F1 alive for new users; (b) SEC random + the app release that reads `referral_code` from the DB ships in the same wave as the migration (viable pre-App-Store: distribution is TestFlight and Founder-controlled; only stale builds in the window share dead links). Session recommendation: (b), with the migration and mobile release landing together.

## Founder decisions pending

1. **Rotate the 74?** SEC: anonymous (40) + underground (34) leaders should get FRESH random codes at backfill (their derived codes are the severe exposure) — which kills any links those leaders already shared. Rotate, or backfill derived like everyone else?
2. **Capture shape:** paste-a-code Phase 1 (/join page shows the code + promo-style field in onboarding; DBA rec, no native work) vs. deferred deep linking now (native entitlement workstream). DBA recommends paste-a-code, deep-linking as its own ticket.
3. **Protected-inviter label copy:** when the inviter is underground, admin renders a masked label. Placeholder: "A protected leader". Needs Founder copy.
4. **New-code strategy** (the divergence above).

## Cross-cutting findings that outlive this ticket

- **SEC F1 [HIGH, LIVE TODAY]:** derived invite codes are 32-bit PK prefixes AND raw `sender_id` values reach clients in DMThreadView.tsx / BranchThreadView.tsx + connection_requests RLS → anonymous-persona unmasking by correlation. The sender_id exposure half belongs to the PLANNED KAN-338 client-side masking SEC panel scope (memory: useResolvedLeaderAuthor pending panel) — added there.
- **DBA F1:** `public.users` SELECT grant is TABLE-level for anon+authenticated → fail-OPEN for every future column (churches was converted column-level in kan338_0005; users never was). Fixed inside the KAN-344 migration.
- **DBA F2 / SEC:** `create_account_atomic` holds EXECUTE for anon+authenticated (SECURITY DEFINER, caller-supplied p_auth_id → arbitrary users-row minting with the publishable key). Pre-existing; revoked inside the KAN-344 migration.
- **SEC F3:** email-invite channel = hard NO for Phase 1 (non-member PII, unrecallable identity disclosure, relay abuse, membership oracle). Own ticket + own SEC panel when wanted.
- **DBA F3:** there is NO capture leg anywhere today (no /join page, no deep-link handling, no RPC param) — without adding it to scope, Phase 1 ships a permanently-NULL column. /join page + onboarding field are IN scope.

---

## SEC verdict (verbatim)

**Grounding:** read `InviteScreen.tsx`, `AccountSetupPage2Screen.tsx`, `create-account/index.ts`, admin `Queue.jsx` / `ChurchManagement.jsx`; live schema, RLS policies, column ACLs, triggers, and constraints on `jiyetphxxvyiicrnwlnx` (read-only).

### Findings

**F1 [HIGH] — The derived code is a de-anonymization key, and it is already shipping.** `deriveReferralCode` (InviteScreen.tsx:43-47) emits the first 8 hex chars of `public.users.id`. Raw `public.users.id` values of other leaders reach leader-facing clients: DMThreadView.tsx:587,689 (`sender_id`), BranchThreadView.tsx:788-892, and `connection_requests` RLS exposes `sender_id` on incoming pending requests. Attack: correlate a held invite link's 8 hex chars against received sender_ids → unmask an anonymous persona. 40 of 221 users are anonymous; all 34 underground leaders are force-anonymous. Live in production today, independent of Phase 1.

**F2 [HIGH] — "Referred by" can breach the underground exclusion boundary in admin.** `churches_admin` excludes underground; both admin surfaces read through it. A UG inviter's name/church would render inside the non-UG queue to admins never gated by `fn_assert_underground_admin`.

**F3 [HIGH] — Email-invite channel must not ship in Phase 1.** Non-member PII with no lawful basis/retention/deletion defined (ToS/privacy unsettled); inviter identity outbound over email (unrecallable; UG/anon safety exposure); relay abuse against our Resend reputation; and an invite endpoint that behaves differently for registered addresses = targeted membership oracle. Own ticket + own SEC panel.

**F4 [MEDIUM] — Any signup validation feedback is a targeted membership-and-identity oracle** (seized-phone threat model). Field renders NO validation state: no check, no error, no name echo, no differential timing/status.

**F5 [MEDIUM] — `?ref=` leaks via Referer** to store links / Netlify logs / history. /join page needs `<meta name="referrer" content="no-referrer">` + `rel="noreferrer"`; keep website/ tracker-free.

**F6 [MEDIUM] — users INSERT grant is table-level** for anon+authenticated → new columns INSERT-able the moment they exist (single-layer protection: absence of INSERT policy). Revoke explicitly.

**F7 [MEDIUM] — `public.users.id` is client-UPDATEable** (`{authenticated=w/postgres}`; not covered by guard_users_privilege_cols). Phase 1 makes it load-bearing (backfill from id, FK to id). Revoke UPDATE (id); add id to the guard.

**F8 [MEDIUM] — UNIQUE on a derived 32-bit code eventually hard-fails signup** (birthday: ~1.2% at 10k, ~50% at ~77k). Collision-safe generation with bounded retry.

**F9 [MEDIUM] — FK delete semantics must be pinned:** `ON DELETE SET NULL`, never CASCADE, never default NO ACTION.

**F10 [LOW] — RPL- namespace collision** with church network IDs (`RPL-#####`) — AccountSetupPage2Screen.tsx:129 church-search regex also matches referral codes (silent empty result if pasted there).

**F11 [MEDIUM] — Lexical collision with the UG `t1_referral` evidence tier** risks referral acquiring de facto verification weight in admins' eyes. Admin copy must read as unverified self-report: `Referred by · [Name] · [Church] — self-reported at sign-up, not verified.`

**F12 [LOW] — Underground leaders should not be in the general invite flow at all.** They have the hashed/rotatable/revocable UG join-code path; the plaintext permanent referral link is the weaker mechanism sitting next to the stronger one.

### Question answers (compressed)

1. Forged attribution: real risk is admin trust bias; acceptable with (a) unverified-self-report copy, (b) inactive/soft-deleted/rejected inviters resolve NULL + self-referral rejected, (c) one append-only audit_log row at attribution.
2. Enumeration: non-issue (2^32 space, 221 codes, rate-limited). The ORACLE is the issue → no-feedback rule.
3. UG/anon inviters: no leak to invitee at signup given F4; leader-facing leak = F1 (sender_id correlation); admin leak = F2. First-recipient consent does not extend downstream; UG leaders exit the general flow (F12).
4. Email channel: defer (see F3).
5. `?ref=` ruling: an opaque code is NOT personal data in a URL — holds only once F1 is fixed (random codes), and the Referer leak (F5) must be closed.
6. Lifecycle: deactivated/suspended/soft-deleted → code stops resolving, value retained; hard-delete → SET NULL, history never rewritten; codes never reissued; rotation = future value-change only.
7. RLS: referral_code SELECT own-row (existing policies suffice — no new policies) + never in leader-facing views; referred_by_user_id readable by service_role only (admin reads via service-role endpoint — NOT the authenticated dashboard client); writes via create_account_atomic only; REVOKE INSERT (both cols) explicitly.
8. Two-leader cap/verification: no gameable DB path (enforce_leader_cap independent); residual risk is F11 (human, lexical).

### SEC verdict: GO-WITH-CHANGES (12)

1. Stop deriving new codes from users.id — random server tokens; backfill existing 221 with derived values so live links keep working.
2. Rotate NOW for the highest-risk cohort (all anonymous + all UG leaders = fresh random codes; invalidates their shared links — FOUNDER CALL).
3. Gate admin "Referred by" on inviter type (UG inviter → masked unless fn_assert_underground_admin; resolve server-side, never join raw users into churches_admin path).
4. No validation feedback at signup (silent accept / silent soft-fail).
5. Cut the email-invite channel from Phase 1 (own ticket, own panel).
6. /join page: no-referrer meta + noreferrer store links; no third-party analytics.
7. REVOKE INSERT (referral_code, referred_by_user_id) FROM anon, authenticated; verify neither col in pg_attribute.attacl for UPDATE post-migration.
8. FK: ON DELETE SET NULL ON UPDATE CASCADE; never cascade delete.
9. Collision-safe generation (bounded retry; a collision never fails an account creation).
10. Add id to guard_users_privilege_cols + REVOKE UPDATE (id) FROM authenticated.
11. Keep "referral" lexically distinct from t1_referral; admin copy: "Referred by · [Name] · [Church] — self-reported at sign-up, not verified."
12. referred_by never surfaced to the referred leader (admin-only projection; side table preferred).

Post-migration: KAN-338 pins re-run + extend the register to cover anonymous-persona correlation in DMThreadView/BranchThreadView (the sender_id exposure).

---

## DBA verdict (verbatim, compressed only where marked)

Ground truth: 221 users (2 soft-deleted, 34 UG-affiliated); derived codes 221/221 DISTINCT (zero collisions today); no existing referral columns; account path = create-account edge fn (service_role) → create_account_atomic (SECURITY DEFINER, 7 args, named-arg call); users RLS = 2 SELECT policies + 1 UPDATE, NO INSERT policy; users SELECT/INSERT grants TABLE-level (fail-open); UPDATE column-level (20 cols).

### DDL

```sql
ALTER TABLE public.users
  ADD COLUMN referral_code           text,
  ADD COLUMN referred_by_user_id     uuid,
  ADD COLUMN referral_code_attempted text;

ALTER TABLE public.users
  ADD CONSTRAINT users_referral_code_format
  CHECK (referral_code ~ '^RPL-[0-9A-F]{8}$');

ALTER TABLE public.users
  ADD CONSTRAINT users_referred_by_user_id_fkey
  FOREIGN KEY (referred_by_user_id) REFERENCES public.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_referred_by_not_self
  CHECK (referred_by_user_id IS NULL OR referred_by_user_id <> id);

ALTER TABLE public.users
  ADD CONSTRAINT users_referral_attempt_only_on_failure
  CHECK (referral_code_attempted IS NULL
         OR (referred_by_user_id IS NULL AND length(referral_code_attempted) <= 32));

-- after backfill: ALTER COLUMN referral_code SET NOT NULL;
-- outside txn: CREATE UNIQUE INDEX CONCURRENTLY users_referral_code_key ON public.users (referral_code);
--              CREATE INDEX CONCURRENTLY users_referred_by_user_id_idx ON public.users (referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;
```

FK ON DELETE SET NULL justified: hard-delete SCRUBS the users row (fn_hard_delete_expired_soft_deletes rewrites fields, deletes only auth.users) — FK fires only on manual DBA removal. Backfill EVERY row incl. soft-deleted (codes stay reserved; never reissued). referral_code_attempted: kept (distinguishes "nobody used links" from "every code failed"), value only on failure, ≤32 chars, service_role-only.

Generation strategy (DBA change 5): reroll id until derived code free (bounded EXCEPTION retry) so derived == stored permanently — see divergence note at top. Rejected: independent random alphabet (breaks shipped-build derivation during rollout window; revisit post-launch with dual-read).

### Write posture

- Convert users SELECT to column-level (mirror kan338_0005): REVOKE SELECT FROM authenticated, anon; GRANT explicit column lists (authenticated: today's 35 + referral_code; anon: today's list, nothing new). referred_by_user_id + referral_code_attempted granted to NOBODY (service_role/postgres only).
- No new RLS policies (KAN-338 PIN 1 asserts exactly 2 SELECT policies — preserved).
- REVOKE EXECUTE ON create_account_atomic FROM anon, authenticated (F2).
- REVOKE UPDATE (id, created_at) FROM authenticated.
- Optional: REVOKE INSERT ON users FROM anon, authenticated (closes fail-open INSERT; zero behavior change).
- Immutability trigger tg_users_referral_immutable: referral_code immutable; referred_by set-once (NULL→value allowed for future claim path; re-point forbidden). This — not an acyclicity CHECK — is what keeps the graph a forest.

### Signup path

create_account_atomic gains `p_referral_code text DEFAULT NULL` (8th arg). **DROP FUNCTION then CREATE — never CREATE OR REPLACE** (overload → PGRST203 for named-arg PostgREST calls). Validation before the users INSERT: trim + strip whitespace + uppercase; RPL- prefix optional on input; regex-gate; inviter must be active, not soft/hard-deleted (pending-verification inviters ALLOWED; anonymous inviters ALLOWED — display-layer concern); every failure → NULL + signup completes; NOTHING returned about referral. No client-callable validation RPC exists, by design. Edge fn create-account v9 passes referralCode verbatim; deploy --no-verify-jwt.

### Admin surfacing

Service-role Netlify function returning a pre-masked projection (NOT a view, NOT client-callable RPC, NOT browser embed): extend pending-leaders.js with explicit FK hints (`referrer:users!users_referred_by_user_id_fkey`), mask in the mapper (UG inviter → `{protected:true}` → FE renders the protected-leader string). ChurchManagement needs a sibling church-leaders.js service-role endpoint (KAN-127 direction anyway). Real full_name is correct on admin surfaces.

### Migration plan (compressed)

0. Pre-flight: assert 0 derived-code collisions at migration time; capture grant state + pg_get_functiondef for rollback.
1. Txn 1 (lock_timeout 3s): ADD COLUMNs, backfill, SET NOT NULL, CHECKs+FK, grant conversion block, REVOKE UPDATE (id, created_at), immutability trigger.
2. Outside txn: CONCURRENTLY indexes; verify indisvalid.
3. Txn 2: DROP + CREATE 8-arg function; OWNER postgres; GRANT EXECUTE service_role ONLY.
4. Deploy create-account v9 (--no-verify-jwt).
5. Ship capture leg same release (website/join.html + onboarding field via OnboardingContext → AccountSetupPage2Screen submit ~line 915). Fix the church-search regex ambiguity (RPL- referral code pasted in church search → silent empty) + InviteScreen.tsx:10 doc comment (example uses the AUTH uuid prefix; code correctly uses public.users.id — comment wrong, code right).
6. Admin endpoints preview-first; Founder smokes + merges.
7. Re-run KAN-338 pins (expect green).
8. Append 4 new pins: R1 no column privilege for authenticated/anon on referred_by_user_id + referral_code_attempted; R2 no UPDATE on the 3 new cols + id + created_at; R3 users table-level SELECT stays revoked (fail-closed); R4 `count(*) WHERE referral_code <> 'RPL-'||upper(left(id::text,8))` = 0 (drift tripwire — note: R4 becomes conditional/dropped if the SEC random-code strategy wins the divergence).
9. Rollback: drop columns (cascade), restore grants + 7-arg function from captured definition.

### DBA verdict: GO-WITH-CHANGES (6 mandatory)

1. Convert users SELECT to column-level BEFORE adding referred_by_user_id (blocker).
2. Mask UG inviters server-side in the admin projection.
3. Add the capture leg to ticket scope (/join page + onboarding field + RPC param) — else the column is permanently NULL.
4. DROP FUNCTION then CREATE for create_account_atomic (overload trap).
5. Mint row id by reroll so derived == stored (see divergence).
6. REVOKE EXECUTE on create_account_atomic FROM anon, authenticated.
