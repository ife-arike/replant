# Replant Communications Matrix — Email · In-App · Push

**Audited 2026-07-12 · UPDATED 2026-07-13 post-sprint (Batches 1–6 shipped).** Original evidence: live `email_log`, pg catalog, both repos, iOS push config, live Jira, sim-UAT F1–F11, Lucid Appendix A. This revision folds in everything shipped through the comms sprint (admin PRs #74–#78, prod migrations, armed crons).

**Legend — wired state:** 🟢 LIVE (deployed + evidenced) · 🔴 LIVE-FAILING · 🟡 WIRED-UNVERIFIED / unlogged · ⚪ DESIGNED-UNWIRED · ⬛ NOT DESIGNED
**Legend — copy state:** LOCKED (Founder-ratified) · DRAFTED (awaiting Founder) · CODE-INLINE (live copy never Founder-reviewed) · MISSING

**Estate architecture (new since 07-13):** every send except `create-account` (see B1) routes through the shared sendEmail contract — `email_log`-anchored, idempotent, webhook delivery-tracked (`sent → delivered/bounced/complained`), notification-toggle-aware (transactional never suppressed). Resend webhook live + verified. Opaque tag map: `docs/architecture/email-tag-map.json`.

**Push baseline: still absolute zero.** Workstream ticket awaits Founder go-ahead.

---

## ⚠ THE ONE OPEN BUILD ITEM (found in this 07-13 update)

**B1/B2 — `create-account` welcome family never migrated.** The 4-kind welcome email (skip / pending_church / verified_church / underground_pending) + `new_church_registered` admin notify still send via inline code (unlogged, no delivery tracking, copy never Founder-reviewed). This was Batch 2's deferred "PR3 — atomic-txn surgery"; the Batch-4 label subsequently drifted to the CD website-form shells and PR3 was never picked back up. **Delivery itself is healthy** (Resend log showed t6's welcome delivered 07-12) — this is an observability + copy-governance gap, not an outage. Needs: migration through the contract + Founder copy review. The UG second-leader variant (`join-underground-church`, welcome_t08) IS migrated — it's only the create-account path that lags.

---

## A. Website (pre-app waitlist)

| # | Event | Email | Wired? | Notes | Ticket |
|---|---|---|---|---|---|
| A1 | Join-network form → leader | `join-welcome.js` → shared contract, tag `intake_t12`, CD v2 shell (PR #76), `{{GREETING}}`, dedup on submission id | 🟢 logged+tracked | Copy = Founder voice bench (LOCKED). Dark-mode-correct shell live | KAN-164 |
| A2 | Join-network → team notify | Same fn, `intake_t27` | 🟢 | — | — |
| A3 | Serve-with-us → volunteer | `volunteer-welcome.js`, `intake_t18`, CD v2 shell | 🟢 | **G12 triple-fire FIXED + prod-proven** (double-POST → single send → delivered) | — |
| A4 | Serve-with-us → team notify | `intake_t33` | 🟢 | — | — |
| A5 | App-is-ready waitlist broadcast | Resend Broadcast + Audience mechanism; runbook + staged checklist at `.claude/plans/kan-321-launch-broadcast-runbook.md`; tag `intake_t41` reserved | ⚪ staged | Draft copy = "good start", Founder sitting with it. Fires only by her hand on launch day | **KAN-321** (created) |
| A6 | ~~`church-intake.js`~~ | **DECOMMISSIONED** (deleted, PR #74) | — | Founder dashboard task: remove any Netlify form-notification webhook still pointing at it | closed |

## B. Signup & account creation (in-app)

| # | Event | Email | Wired? | Notes | Ticket |
|---|---|---|---|---|---|
| B1 | Account created — welcome (4 kinds) | `create-account` inline sends — **NOT migrated, unlogged, CODE-INLINE copy** | 🟡 | **See ⚠ box above — the one open build item.** UG variant body is Founder-locked generic; other 3 kinds never reviewed | KAN-31/81 remainder |
| B2 | New church registered → accounts@ | Same fn, inline | 🟡 | Rides the B1 migration. UG location-suppression rule (BA F10) verify during migration | KAN-81 |
| B3 | Welcome DM (Replant Team thread) | n/a (DM) | 🟢 | Wired in admin repo (approve-church fan-out + verify-leader); F6 was a SQL-flip test artifact. Residual: re-verify via real dashboard approval (on smoke checklist) | KAN-217 Done |
| B4 | UG second-leader join welcome | `join-underground-church` → shared contract, `welcome_t08`, body byte-identical to create-account UG kind | 🟢 logged+tracked | No-differentiation invariant verified (both `noreply@`) | — |

## C. Verification lifecycle — **ALL admin-endpoint transitions now email (Batch 3, PR #75)**

| # | Event | In-app | Email | Wired? | Notes |
|---|---|---|---|---|---|
| C1 | Pending countdown | Banner + gates 🟢 (LOCKED copy, accounts@) | none needed | 🟢 | — |
| C2 | Request-info | Banner + modal exist | `verification_request_info` → `notify_t44` — Founder pasted the Q10 locked body 2026-07-13; wired via the shared verification fan-out | 🟢 (flow session 2026-07-13) | Surface send-path LIVE: request-info-church endpoint + service-role RPCs + Queue panel (PR #80 merged `21d6db5`); notify-only per her ruling — in-app reply is the source of truth; subject reuses the ratified "a note from our team" class (flagged) |
| C3 | Approved | Verified toast (endpoint-side) | `verification_approved` → `notify_t51`, approve-church fan-out + verify-leader, para noun swap | 🟢 | Per-day dedup covers endpoint overlap |
| C4 | Rejected | **In-app still generic lockout (F4)** — rejection-specific copy RATIFIED 07-13, wiring = flow session | `verification_rejected` → `notify_t26`, church + personal variants, benediction close | 🟢 email | Email = LOCKED verbatim; in-app gap remains flow-side |
| C5 | Reminders day-7 / day-1 | nothing (correct) | `notify_t17`/`notify_t31` — **ARMED cron** `verification-reminder-emails` (09:30 UTC daily), deadline-keyed idempotency, concrete subjects ("closes in 7 days"/"closes tomorrow") | 🟢 | KAN-62 satisfied for skip-flow deadline holders |
| C6 | Deactivated (admin manual) | Lockout 🟢 | `account_deactivated` → `notify_t09`, tone-gated body RATIFIED, deactivate-church fan-out | 🟢 | **Automated deadline-sweep deactivation (KAN-61 cron) still unbuilt** — no email on that path until the sweep exists |
| C7 | Reinstate | Clean restore 🟢 | `account_reinstated` → `notify_t29`, RATIFIED ("We're glad to have you back.") | 🟢 | — |
| C8 | Leader-only deactivation | ⬛ | ⬛ | ⬛ | Founder-flagged scope gap — flow session owns; comms designs after |
| C9 | Co-leader departed | nothing | `coleader_departed` LOCKED bodies | ⚪ | Trigger = KAN-61 cron path (unbuilt) |

## D. Heartcry lifecycle

| # | Event | Email | Wired? | Notes |
|---|---|---|---|---|
| D1 | Submit → leader receipt | none by design (in-app modal owns; capital-C nit FIXED `3ca3e5b`) | 🟢 | — |
| D2 | Submit → triage lead | `heartcry_triage_notification` | 🟢 healthy | Legacy semantic template string (DBA-locked keep) |
| D3 | Tier-1 pastoral alert | inline html/text, `Replant Operations <accounts@>` | 🟢 fixed | Was 422-dead; awaits first real t1 event for live proof |
| D4 | Tier-2 pastoral digest | `emit_pastoral_digest()` fixed + accounts@ | 🟢 fixed | Was silently 422-dead for its entire life (41 false 'sent') |
| D5/D7 | Seen / feed-approval | in-app only | 🟢 | — |
| D6 | Admin responds → leader email | `heartcry_acknowledged` (`notify_t19`) — subject LOCKED "Replant — your message reached us", body rev-3 w/ My Heartcries pointer | ⚪ UNBLOCKED (comms wires) | **F9 CLOSED 2026-07-13** (flow session): mark-heartcry-responded now seeds the secure thread + flips status + writes thread_id — the My Heartcries card + "Open Secure Message" CTA are LIVE surfaces (PR #80 merged). Wire notify_t19 onto this endpoint's first-transition (already the single admin-engagement chokepoint; response carries message_delivered) |

## E. Connect

| # | Event | Email | Wired? | Notes |
|---|---|---|---|---|
| E1–E4, E6 | DM / request / accept / branch / team-reply | none (Realtime + future push own these) | 🟢 in-app | Push = MVP set proposal, ticket pending |
| E5 | Branch invite stale 24–48h | `notify_t22` — **ARMED cron** `stale-branch-invite-emails` (every 6h), once per invite, body FOUNDER-LOCKED verbatim ("…waiting for you on Replant Connect…") | 🟢 | — |
| E7 | Escalated-case Reach Out | DM 🟡; 7-day email fallback NOT BUILT | ⬛ email | Decide pre-launch |

## F. Prayer Wall + Home — all refetch-only, no email/push. Correct; unchanged.

## G. Auth / password

| # | Event | Email | Wired? | Notes |
|---|---|---|---|---|
| G1 | Forgot password (current PKCE) | Supabase-branded | 🟡 | 60-day dual-path window locked for the OTP cutover |
| G2 | Forgot password (target OTP) | `auth_t17` LOCKED body | ⚪ | KAN-198 (Highest, pre-launch) — auth workstream |
| G3 | Email change verify-new/notify-old | 2 templates LOCKED | ⚪ | Flow session owns the flow |
| G4 | Admin password reset | `send-password-reset` → shared contract, `auth_t24`, per-invocation key (never wrongly dedups) | 🟢 logged+tracked | Migrated Batch 5 |

## H. Admin-facing (`Replant Operations <accounts@>` — Founder-locked)

| # | Event | Email | Wired? | Notes |
|---|---|---|---|---|
| H1 | Admin invite (new staff) | Supabase-branded magic-link — NOT a Replant template | 🟢 | **Open decision:** acceptable at MVP vs Replant Ops template (generateLink + builder exists) |
| H2 | Grant admin to existing leader | `admin_t29` via shared contract + triggered_by | 🟢 | Batch 2/5 |
| H3 | Promotion: candidate notified | `admin_t41` — RATIFIED ("A manager is reviewing the sponsorship.") | 🟢 | request-admin-promotion |
| H4 | Promotion: Manager review-required | `admin_t52` — RATIFIED, "request" wording; every Manager except sponsor (both when sponsor = super_admin) | 🟢 | — |
| H5 | Promotion approved / denied / expired | `admin_t63` / `admin_t77` (endpoints) + `admin_t44` (**armed DB sweep cron**, 10 past every 4h) | 🟢 | Naming-rule test guards (never "Overseer"/"the other manager") |
| H6 | Revoke access (both paths) | `admin_t37` — RATIFIED verbatim, KAN-168 CLOSED (PR #78) | 🟢 | Demote deliberately excluded (tier change ≠ removal) |
| H8 | Flag escalated | `notify_t13` via shared contract + triggered_by, dedup per message | 🟢 | — |
| H9 | UG admin notify | `notify_t47` via shared contract (observability only; locked zero-detail body) | 🟢 | — |
| H10 | Ops observability | **Dead-letter digest ARMED** (13:15 UTC daily, `ops_t12`, sends only when something is amiss; first digest delivered 07-13). NOT built: SLA monitor, orphan reconciler, Sentry-SMS path | 🟢 partial | Remainder = KAN-89 orbit, post-MVP unless Founder pulls forward |

---

## Cron register (all verified active in `cron.job`, 2026-07-13)

| Job | Schedule | Sends |
|---|---|---|
| `verification-reminder-emails` | 30 9 * * * | notify_t17 / notify_t31 |
| `stale-branch-invite-emails` | 45 */6 * * * | notify_t22 |
| `email-dead-letter-digest` | 15 13 * * * | ops_t12 (conditional) |
| `admin_promo_expired_email_sweep` | 10 */4 * * * | admin_t44 |
| `pastoral-daily-digest` | 0 9 * * * | pastoral_signal_digest_t2 (fixed) |

**Known limitation:** DB-side (pg_net) sends store `resend_id = NULL` → the webhook can't promote them past 'sent'. Digest excludes them from stale-counts. Acceptable at current volume; orphan-matching is post-MVP.

## Push — unchanged proposal (MVP set of 4, content-free, UG default-OFF pending SEC). Awaits Founder go-ahead to file the ticket.

## Address-purpose mapping — RATIFIED 2026-07-13 (with read-the-room flexibility)

| Address | Purpose |
|---|---|
| `connect@projectreplant.org` | Relationship: welcomes, forms, leader-facing lifecycle From, reply-to |
| `accounts@projectreplant.org` | Record/ops: verification outcomes, security, admin ops (`Replant Operations`), digests |
| `info@projectreplant.org` | Community/general questions |

## Gaps register — closeout state

| # | Gap | State |
|---|---|---|
| G1 | Resend MCP key invalid | ✅ Founder reconnected 07-13; dashboard audited |
| G2 | Pastoral layer dead (t1+t2) | ✅ FIXED + verified |
| G3 | Welcome DM "unwired" | ✅ RETRACTED (audit error; SQL-flip artifact) |
| G4 | Heartcry thread_id never seeded (F9) | ✅ CLOSED (flow session 2026-07-13, PR #80) — notify_t19 unblocked, comms wires |
| G5 | Verification lifecycle silent | ✅ ALL endpoint transitions email (PR #75) |
| G6 | Sends unlogged | ✅ closed for everything EXCEPT create-account (see ⚠ B1) |
| G7 | Waitlist broadcast | ✅ staged (KAN-321 + runbook); copy pending Founder |
| G8 | Push zero infra | 🔶 OPEN — ticket awaits go-ahead |
| G9 | Leader-only deactivation comms | 🔶 flow BUILT (deactivate/reinstate-leader live, PR #80) — comms now owns the two personal-variant bodies (deactivation twin of t09 "your account"; reinstate twin of t29); insertion points marked in both endpoints |
| G10 | Rejected in-app generic copy (F4) | ✅ CLOSED (flow session 2026-07-13) — lockout_reason live on auth-status-check v16+; ratified copy renders on the next Expo rebuild |
| G11 | Admin invite Supabase-branded | 🔶 OPEN decision |
| G12 | Volunteer triple-fire | ✅ FIXED + prod-proven |
| G13 | Zero webhooks / bounce-blind | ✅ webhook live + e2e verified |
| **G14** | **create-account welcome family unmigrated + copy unreviewed (⚠ B1/B2)** | 🔶 **OPEN — the one build straggler; found in this update** |
| G15 | KAN-61 deadline-sweep cron (deactivation automation + its email + coleader_departed) | 🔶 OPEN — separate workstream (not comms-only; touches deactivation policy) |

## Build batches — closeout

1. ✅ Batch 1 — pastoral layer fix (+ accounts@ move, capital-C nit)
2. ✅ Batch 2 — KAN-80 foundation (migrations, webhook, contract both runtimes, PR #74)
3. ✅ Batch 3 — verification lifecycle emails (PR #75)
4. ✅ Batch 4 — CD Family-1 v2 shells (PR #76) — *note: original "Batch 4 = welcome family" scope drifted here; the create-account remainder became G14*
5. ✅ Batch 5 — promotion emails + deferred migrations + tag map (PR #77) + KAN-168 (PR #78)
6. ✅ Batch 6 — crons (all armed) + KAN-321 runbook
7. 🔶 Push workstream — ticket-shaped, awaits go-ahead

## Founder threads open (post-sprint)

1. KAN-321 broadcast copy (sitting with it)
2. Push workstream ticket go-ahead
3. H1 admin-invite branding decision
4. G14 create-account migration + welcome-copy review (needs scheduling)
5. Smoke checklist (`.claude/plans/2026-07-13-comms-smoke-checklist.md`)
6. Jira transitions for completed tickets (Founder marks Done)
