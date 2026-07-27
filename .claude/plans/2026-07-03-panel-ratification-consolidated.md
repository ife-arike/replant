# Consolidated Panel Ratification — Heartcry E2E (KAN-313) + Account Deletion (KAN-205)

## Ratification status — ALL FIVE RATIFIED (Founder: "all clear")

1. **H-Design: RATIFIED** — architecture A.1–9 locked; design-now, build post-MVP #1; "working toward full E2E" public posture until shipped. (Jira c.16260.)
2. **Heartcry Founder calls: RATIFIED** — H-1 audit-on-release accepted · H-3 re-wrap history yes · H-4 top-tier recipients · H-5 dated key destruction tied to backup-retention horizon.
3. **H-2 escrow custody: RATIFIED** — Founder + one trustee, two physically separate sites (specific people/places settle at the offline ceremony, shared with backup-DR).
4. **B-Design: RATIFIED** — deletion flow (self_deleted substate + RestoreScreen + password re-auth + audit rows + 5 expert calls) + CONTENT copy set. Build agent dispatched (worktree, `fix/kan-205-account-deletion`; no deploys/DB applies). (Jira c.16261.)
5. **B-1 OVERRULED (Founder): leaders MUST be informed when deletion or deactivation happens.** Deletion-started notification ships WITH the KAN-205 build: standard variant (clear, includes 30-day restore guidance) + UG variant following the locked information-free welcome-email pattern (same sender domain the leader already receives, neutral subject, no "underground"/church/specifics; content discipline is the protection — the domain fingerprint was already accepted at welcome). Admin-initiated deactivation emails ride the email-infrastructure regroom (KAN-143/61 family). **B-2 RATIFIED:** deleted-vs-deactivated vocabulary sweep + accounts@ email reconciliation fold into KAN-205.

Batch CLEAR → report/block panels (KAN-304/305) DISPATCHED. DBA adjacent findings filed as KAN-320.

---

# REGISTER #2 — Report (KAN-304, 4 lanes) + Block (KAN-305, 2 lanes) — ALL SIX APPROVE

Lane files: `2026-07-03-kan304-report-panel-{sec,mod,be-admin,content}.md` · `2026-07-03-kan305-block-panel-{sec,dba}.md`

## C. Report mechanism (KAN-304) — the composed design

All four lanes converged on composition over invention: reports are a SECOND ORIGIN feeding the existing machinery (flag axes, four queues, UG auto-route, escalated two-person ceremony, reach-out) — cost is 2 new manual taxonomy codes + 3 small enum additions + one new table. Non-negotiable invariants (SEC, live-verified):

1. **Zero content-row writes at intake** — `messages` rides the realtime publication and the sender's own RLS makes UPDATE events deliverable to their client: touching the row at report time push-notifies the reported party. All report state lives in new deny-all-RLS tables (`content_reports`, reporter-scoped, polymorphic five-surface target + the church profile as sixth; snapshot-at-intake, once per case).
2. **Uniform intake response** ("Report received") across new/duplicate/invalid/not-visible — no existence or who-else-reported oracle; server re-asserts the reporter's own visibility per surface (predicates mirrored from live RLS).
3. **No reporter-side artifacts** — no report history in-app, nothing on device (seized-device test; MOD and SEC reached this independently).
4. **N reports = one case, DB-side dedupe; no count ever auto-actions content.** UG-involved (reporter OR author OR counterparty) born straight into Escalated.
5. Intake = SECURITY DEFINER RPC `submit_content_report(...)`, audit-first in one transaction; DB-window rate count; admin queue extends the Flagged tab (origin+surface chips) with counts-only digests; escalation reuses `escalated_cases` (2 additive columns + a `report` axis token); the church-profile toast stub dies — wired for real.
6. Reason list (8, human-worded; MOD × CONTENT merged): locate/identify (always Escalated, two-person) · threats · asking for money (KAN-261 folded) · impersonation · false teaching (manual lane, never auto-actioned — locked fairness ruling honored) · spam · **wellbeing concern (routes Pastoral, listed FIRST on prayer/testimony)** · something else (free text, scanned, indefinite retention).
7. CONTENT anchors: sheet "Report to the Replant team" · confirmation "It's with the team. The Replant team reviews every report. You won't be identified to anyone involved." · object-named entries ("Report this message/prayer/…") · zero UG variants by construction.

**Founder items (C-asks):**
- C-1 Reporter-identity access in admin surfaces: **justified-access per the locked 5+5 model** (regulars see count only; SA+Manager expand behind ≥50-char audit-permanent justification) — rec adopt (vs hard-never).
- C-2 Safety-class routing + pattern thresholds: locate/identify + own-thread threats go Escalated-direct; pattern cues at 3 reports/3 distinct reporters/30 days (financial: 2) — rec adopt.
- C-3 Rate-limiter outage posture at intake: **fail-open + alarm** — a deliberate DEVIATION from signup's strict fail-closed, reasoned: blocking a report during an outage silences a raised hand; intake is authenticated + post-hoc, abuse ceiling is low — rec adopt.
- C-4 CONTENT wording forks (4): sheet title ("Report to the Replant team" vs "Report a concern") · submit label ("Send to the team" vs "Send report") · church-profile a11y label migration · confirmation title ("It's with the team." vs "Report sent") — rec: first option each.

## D. Block user (KAN-305) — the composed design

**Premise correction (three lanes confirmed independently): `blocked_users` DOES NOT EXIST live** — no relation, no RPC, no migration anywhere. The audit's "exists unwired" cite was stale; green-field build. Corrected on-ticket.

1. **Scope: symmetric hard contact-plane stop, server-enforced** — DMs both directions, connection requests, same-church bypass, branch invites, comments-on-blocker-content; blocker-side freeze-and-hide; blocked-side **freeze-in-place rendering identical to the existing "leader deactivated" ambiguity class** (no new error codes, no ghost rows; silent-drop REJECTED — undelivered messages would still fire pastoral alerts).
2. **Prayer wall stays readable to the blocker** (contact-plane doctrine; review-notes defense drafted); blocker-authored content hidden from the blocked (anti-surveillance).
3. **Masked-context blocks skip directory suppression** — vanishing search results would be a de-masking correlation oracle (UG-critical); identity-known blocks do suppress.
4. **Enforcement**: symmetric `fn_is_blocked(a,b)` + **BEFORE INSERT trigger on `messages`** (the send path is service-role and bypasses RLS — the trigger is the unstrippable layer) + in-function checks in 6 RPCs + explicit 403 in `send-message`; realtime needs nothing (blocked rows can never insert). Deploy order DB → edge fn → FE = no fail-open window. Replant Team threads carved out everywhere; blocks create zero escalated side-effects; Day-30 sweeper extended to delete block rows (it scrub-updates users in place, so FK CASCADE never fires).

**Founder items (D-asks, all with recs):**
- D-1 Blocker's view of the blocked's devotional content: **leave readable** (blocking is contact-plane, not censorship of intercession) — rec adopt.
- D-2 Blocked-side thread rendering: freeze-in-place (rec) · D-3 branch group surfaces out of v1 (rec) · D-4 admin visibility = aggregate count only (rec; composes with report-pattern signals) · D-5 pending connection request at block time = auto-decline (rec) · cap 200 blocks/blocker · blocker sees explicit state, blocked sees generic.

## E. Cross-cutting security find (both block lanes, independent) — needs its own yes

**`authenticated` still holds INSERT on `conversations` with a participant-only WITH CHECK** — a modified client can create conversation rows directly, bypassing the consent layer TODAY (conversations was NOT in the 2026-07-02 Group-C revoke sweep, which covered its six sibling tables). Becomes a block bypass if any gate keys on conversation existence. **Rec: SEC-verify + REVOKE rides the KAN-305 migration** (same pattern as Group C; FE grep first to confirm zero legit client inserts).

## Register #2 asks (4)
1. **C-Design** — adopt the composed report design (invariants 1–7)?
2. **C-Founder items** — C-1 justified-access · C-2 thresholds · C-3 fail-open-alarmed intake · C-4 wording forks (recs)?
3. **D-Design + D-Founder items** — adopt the block design + the recommended calls?
4. **E** — authorize the conversations-grant REVOKE to ride the KAN-305 migration (SEC-verified, FE-grep-confirmed first)?

---

**2026-07-03.** Five design agents returned across two workstreams. This is the single decision register the Founder acts from; full designs live in the five lane files cited below. Every decision carries a recommendation. The heartcry lanes are strikingly coherent — SEC/DBA/BE independently converged on one architecture — so most calls are expert-unanimous and bundled; only the genuinely-Founder judgments are broken out as asks.

Lane files:
- `2026-07-03-heartcry-e2e-panel-sec.md` · `-dba.md` · `-be.md`
- `2026-07-03-kan205-deletion-panel-sec.md` · `-content.md`

---

## A. Heartcry E2E (KAN-313) — the agreed architecture (all three lanes APPROVE)

Adopting as recommended unless the Founder objects:

1. **Crypto construction:** extend `@noble` (ciphers already bundled for SEC 11015; add `@noble/curves` X25519+HKDF, ~20–35 KB pure JS, Hermes-safe — no native module, no libsodium). Per-message AES-256-GCM content key, sealed-box-wrapped per recipient; `envelope_id` AAD-binds ciphertext↔wraps against server mix-and-match. Same code in the admin browser.
2. **Audit-on-release replaces audit-on-decrypt:** ciphertext + wrapped key reachable ONLY via `admin_open_heartcry_v2` — same ceremony as today (verify_jwt, super_admin/top-tier, TOTP-fresh), two audit rows commit in-transaction BEFORE key material leaves the server. Decryption then happens in-browser. Honest residual: re-opens of already-cached material can evade re-audit — policy covers what cryptography can't. (This is the one place E2E costs a sliver of the transparency framework; SEC states it plainly. Confirmation is decision H-1 below.)
3. **Schema:** one `admin_encryption_keys` registry + two thin wrapped-key tables (heartcry / UG evidence — kept separate because recipient sets and audit sinks differ: `audit_log` vs `audit_log_underground`). Deny-all RLS; release RPC is service_role-EXECUTE-only. Enrollment grants nothing (pending key, zero wraps); access arrives only via the audited export→rewrap→activate ceremony; offboard hard-deletes that admin's wraps; a deferred trigger blocks any envelope heartcry committed without minimum recipient coverage.
4. **Admin private keys:** Argon2id-passphrase-wrapped blobs stored server-blind (device-loss survivable; WebCrypto-non-extractable rejected as too brittle for a 2-person team).
5. **`feed_content` stays admin-authored** (in-browser post-decrypt at approval) — NOT leader-device. BE verified it's already admin-side; leader-device generation would store a plaintext-derived excerpt before approval, re-opening the hole E2E closes. (Corrects the original brief; genuine-verdict divergence.)
6. **Rollout:** `submit-heartcry` becomes envelope-validating (validates shape/roster/caps without reading content); `client_msg_id` idempotency; a bounded dual-accept window keeps accepting v1 plaintext from old builds (DELIVER-ALWAYS) with an explicit sunset (min-version + zero v1-inserts after the window, ~30 days).
7. **Migration:** admin-ceremony client-side re-encryption of the 4 existing rows through the current audited RPC, then legacy Vault-key retirement. Corpus verified: 4 heartcries + 5 UG evidence files, 2 top-tier recipients — cheapest it will ever be.
8. **UG evidence files** ride the same envelope model (existing `envelope_key_id`/`encryption_iv` columns fit; all NULL today) — the unification mandate is satisfied.
9. **Mobile trust anchor:** Founder-held offline Ed25519 root signs monotonic keysets; app pins the pubkey; submission fails closed if the keyset doesn't verify (guards the classic E2E server-swaps-the-key hole).

**→ ASK H-Design: adopt items 1–9 as the heartcry architecture?** (One yes; flag any single item to revisit.)

### Heartcry — genuinely-Founder decisions

- **H-1 (transparency trade — confirm):** E2E means the server can no longer *enforce* audit-on-decrypt; it enforces audit-on-**release** instead (recommendation: accept — you already ruled "E2E period," and release-gating preserves the ceremony for every fetch; the residual is honest and policy-covered). Rec: **accept.**
- **H-2 (escrow custody — the irreducible one):** WHO holds the escrow key, and WHERE. One sealed offline ceremony holds both the heartcry escrow recipient key (wrapped into every envelope so a DB-backup restore can decrypt) and the Ed25519 signing root — shared with the backup-DR workstream (one custody story). Rec: **Founder + one trustee, two physically separate sites.**
- **H-3 (re-wrap history to newly-enrolled admins?):** when a future admin enrolls, do they get access to *past* heartcries via an existing key-holder's audited re-wrap ceremony, or only messages from enrollment forward? Rec: **yes, re-wrap history** (audited ceremony) — pastoral continuity for a 2-person team.
- **H-4 (recipient scope at cutover):** who can decrypt at launch. Rec: **top-tier admins only** (matches the current heartcry access matrix).
- **H-5 (legacy-key + backup destruction date):** the old Vault key stays escrowed until pre-migration backups age out, then is destroyed in a dated ceremony. Rec: **set an explicit date tied to the backup-retention horizon** (coordinated with the backup-DR session), never "indefinite."

---

## B. Account Deletion (KAN-205) — build-ready (SEC + CONTENT)

### The one true blocker (build requirement, not a decision)
`auth-status-check` is blind to USER-level soft-deletion — it reads only the church's `soft_deleted_at`. A self-deleted leader who isn't the last leader on their church would sign into a normal-looking app where every write silently fails, with no restore surface. **Fix:** new `self_deleted` branch substate + a dedicated RestoreScreen ceremony (post-auth only — no pre-auth existence signal; sign-in works all 30 days since `auth.users` survives to the sweeper). Also: non-UG self-delete/restore/hard-delete write NO audit row today — add `account_soft_deleted/restored/hard_deleted`. Corrected assumption: `fn_initiate_restore_underground` is the admin two-eyes rejection lane, NOT a leader path — self-deleted UG leaders use standard `fn_restore_my_account`; verified status survives.

### Deletion — expert calls (bundle; adopt as recommended)
1. Re-auth = FE password re-entry before the RPC (no mobile MFA exists today); optional AMR 5-min server hardening if the claim is present.
2. Global refresh-token revoke on self-delete (kills other-device sessions).
3. Allow transient restore over the cap-of-2 (a returning leader isn't blocked by a slot filled during their absence).
4. Delete/restore cycle rate limit: 3 per 30 days.
5. Disclose the 30-day window plainly + keep one register (audit rows above).

### Deletion — copy (CONTENT, APPROVED for build; house voice)
- Settings row: **DELETE ACCOUNT** · sub-line "Starts a 30-day window before your account is permanently removed."
- First modal: **Delete your account** — "Here is exactly what happens, so you can decide in peace." (states the 30-day window, what stays de-named, the sole-leader-church disclosure variant)
- Confirm: type **DELETE** (never echoes a name/church). Recommended over hold-to-confirm (holds fail switch-control/tremor users — a11y).
- Goodbye screen written mechanism-free (cold-viewable over Login; no UG variant needed).
- Safe button: **"Keep my account"** (vs house-standard "Cancel").
- Restore prompt: welcome-back ceremony on sign-in during the window.

**→ ASK B-Design: adopt the deletion flow (SEC build shape + the 5 expert calls + CONTENT copy) as recommended?** (One yes.)

### Deletion — genuinely-Founder decisions
- **B-1 (confirmation email):** none at MVP (email infra is thin; inbox = paper trail; for UG a mailed confirmation is itself a risk). Rec: **no email at MVP;** neutral-subject later, skipped/extra-plain for UG.
- **B-2 (vocabulary sweep — confirm scope):** "deleted" (user-initiated) now collides with "deactivated" (admin/auto). The build sweeps DeactivationModal / VerificationBanner / the superseded ComingSoon copy for distinctness, and reconciles the three divergent contact emails (info@/connect@/accounts@ → the ruled `accounts@`). Rec: **fold the sweep into the KAN-205 build.**

---

## C. Adjacent findings → hygiene ticket (not ratification asks)
DBA surfaced two pre-existing issues while introspecting live, unrelated to the E2E build:
1. `auth.users` tier-field drift (`role` vs `admin_tier` naming).
2. A 300s-vs-90s life-safety MFA-freshness mismatch (`admin_open_heartcry` uses 5-min/Sensitive; some heartcry actions use 90s/life-safety per the locked 4-tier ruling — reconcile which tier heartcry-open belongs to).
Filing as a SEC/DBA hygiene ticket under the security epic unless the Founder folds them elsewhere.

---

## Ratification asks (≤5, consolidated)
1. **H-Design** — adopt the heartcry architecture (A.1–9)?
2. **Heartcry Founder calls** — H-1 accept audit-on-release · H-3 re-wrap history (yes) · H-4 top-tier recipients · H-5 dated key destruction. (H-2 escrow custody is the one that needs your specific people/places answer.)
3. **H-2 escrow custody** — who holds it, where (rec: you + one trustee, two sites)?
4. **B-Design** — adopt the deletion flow + copy?
5. **Deletion Founder calls** — B-1 no confirmation email at MVP · B-2 fold the vocabulary/email-reconcile sweep into the build?
