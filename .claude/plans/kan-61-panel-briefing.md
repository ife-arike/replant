# KAN-61 verification-deadline sweep — SME panel briefing

**Founder rulings LOCKED 2026-07-13 (do not relitigate):**
1. **Flag-for-admin-confirm** — the sweep NEVER deactivates anyone. It surfaces past-deadline pending leaders for admin confirmation; the confirm click runs the existing `deactivate-church` Netlify path (which already sends the Founder-ratified `account_deactivated` email, tag `notify_t09`, and writes audit).
2. **Church-level only** — leader-level deactivation is a separate workstream (flow-gaps session). `coleader_departed` is OUT of this scope.

**Panel order:** BA → DBA → SEC (sequential; each sees prior findings appended below). Output shape: VERDICT (approve / approve-with-changes / block) + ranked findings + must-folds + Founder questions (numbered, merit-gated). Stay in lane.

## Live state (verified, 2026-07-13)

1. **Login-time enforcement EXISTS:** `auth-status-check` (v9) resolves a stale deadline into deactivation when the leader next opens the app. Skip-flow leaders read `users.verification_deadline`; church-attached leaders branch on the CHURCH's verification state before reading church deadline (stale-deadline auto-deactivation fix, 2026-06-18, KAN-36 Option Y override). **The sweep must match this resolution logic EXACTLY or the two enforcement paths diverge.**
2. **Reminders ARMED:** day-7 + day-1 emails live (cron `verification-reminder-emails`, 09:30 UTC daily; keyed `tag:<user>:<deadline-date>`).
3. **`deactivate-church.js`** (admin repo): flips church state, emails every affected verified-active leader via the shared sendEmail contract (`notify_t09`), audit-logged. This is the path admin-confirm reuses — the sweep itself sends NOTHING leader-facing.
4. **Underground pending churches have their OWN lifecycle** — day-25 route-to-Founder cron (`underground_day_25_route_daily`), day-30 auto-reject with `unreachable_30d`, separate UG queue, `audit_log_underground`. Presumption: UG rows are EXCLUDED from this sweep entirely (SEC confirms).
5. **email_log infra:** shared contract, idempotency keys, webhook delivery tracking — any admin-notify the sweep emits uses it (pattern: pastoral digest / reminder sweeps, pg_cron + `net.http_post` + inline html/text).
6. Scale reality: leader count is small (first real leaders 2026-06-28); admin team = Founder + accounts@. Design for correctness now, volume later.

## Proposed shape (panel refines)

Daily pg_cron sweep `flag_expired_verification_deadlines()`:
- Candidates: `verification_status='pending' AND is_active AND deadline resolution per auth-status-check parity AND NOT underground-lifecycle rows`.
- "Flag" mechanism — panel picks the minimal correct shape:
  1. Zero-schema option: admin Pending queue computes "deadline passed" as a filter chip at read time (no sweep state at all) + a daily admin-notify email (accounts@, counts-only) when new candidates appear.
  2. Column option: `users.deadline_flag_at timestamptz NULL` written by the sweep (visible queue state, survives, auditable).
  3. Table option: `deadline_review_queue` rows (heavier; probably overkill at MVP).
- Admin dashboard: Pending queue shows flagged rows with a "deadline passed — confirm deactivation" affordance → existing deactivate path.
- Idempotent admin-notify via email_log key (e.g., `ops-flag digest per day`), NOT per-leader spam.

## Lane questions

**BA:** (1) Does an open request-info state pause/extend the clock — is a leader who responded to admin questions but sits past deadline a legitimate flag? (2) Grace window beyond deadline before flagging (0 days? 3?)? (3) What does the ADMIN see (queue copy, count, age)? (4) Re-flag semantics if admin dismisses without deactivating (snooze? permanent dismiss?). (5) Both-leaders-emailed semantics on church confirm (existing deactivate path behavior — verify it matches intent).

**DBA:** (1) Exact candidate predicate matching auth-status-check parity (skip-flow vs church-attached branch) — write the WHERE clause. (2) Flag mechanism pick (zero-schema vs column) + index. (3) Sweep idempotency + advisory lock pattern. (4) Any race with login-time enforcement (leader logs in between flag and confirm → already deactivated → flag must self-clear).

**SEC:** (1) UG exclusion — confirm the predicate can never touch underground-lifecycle rows and the admin-notify email carries zero UG-inferable data. (2) Mass-flag blast-radius guard (LIMIT + alert if candidates > N — a bugged predicate must not flag the whole network). (3) Audit posture: flag events → audit_log? (4) Admin-notify email content discipline (counts only, no leader names/emails — "log in to see what needs attention" precedent).

## Cumulative findings (appended as the panel runs)

### BA verdict (2026-07-13)

VERDICT: approve-with-changes

FINDINGS:
- [HIGH] Confirm-time email fan-out silently excludes login-flipped leaders — they never get an email anywhere
  Detail: `auth-status-check.deactivateAtomically` flips the USER row (`is_active=false`, `verification_status='deactivated'`) and sends nothing. `sendVerificationEmailsToChurchLeaders` filters `is_active=true`. So a leader who logs in past deadline (flipped cold, no email) is then EXCLUDED from the notify_t09 fan-out when the admin confirms the church. Net: that leader never receives a deactivation email on any path — the exact gap KAN-61 exists to close.
  Required change: for the deadline-confirm call site, widen the fan-out (opt-in parameter, don't touch other callers) to also include leaders on the church deactivated by `login_check` (audit-identifiable: `triggered_by='system'`, `meta.trigger='login_check'`; or simply `deactivated_at >= church.verification_deadline`). Per-day email_log idempotency dedups any overlap. DBA writes the predicate.

- [HIGH] "Dismiss" must be "Extend window" — a bare flag-clear is a trap
  Detail: if an admin dismisses a flag without moving `churches.verification_deadline`, the deadline stays past, and `auth-status-check` deactivates the leader cold at next login — machine overrides the human's explicit "not yet". A UI-only dismiss is incoherent with flag-for-confirm.
  Required change: the queue's only non-confirm actions are (a) Extend window — writes `churches.verification_deadline` forward, which self-clears the flag by predicate AND re-arms day-7/day-1 reminders automatically (idempotency key includes deadline-date, so a new date = new key); or (b) approve the church via the existing path if evidence arrived. NO permanent-dismiss, NO snooze-without-deadline-write at MVP. Note: `edit-pending.js` deliberately excludes `verification_deadline` from its allowlist (anti-back-door gate) — Extend is a NEW small write surface (dedicated action, audited, step-up tier → SEC rules).

- [HIGH] Candidate unit is CHURCHES, not users; skip-flow leaders are explicitly OUT
  Detail: Founder ruling #2 (church-level only) + the confirm path taking `churchId` + fan-out covering all leaders means the natural flag unit is the church. The briefing's column option (`users.deadline_flag_at`) frames candidates as users — two leaders on one church would produce two flags and double-confirm ambiguity. Separately, skip-flow leaders (`church_id IS NULL`, 7-day `users.verification_deadline`) have NO church to confirm — `deactivate-church` cannot act on them at all.
  Required change: candidates = pending churches past deadline (`churches.verification_status='pending' AND verification_deadline <= now()`, non-UG; DBA writes exact parity predicate). Skip-flow expired leaders are OUT of KAN-61 — covered by login-time enforcement only until flow-gaps G9 (leader-level deactivation) lands. State this ownership explicitly in the KAN-61 ticket so the gap is deliberate, not accidental. Per auth-status-check parity: verified-church+pending-leader rows have no countdown (never flag); church rejected/deactivated rows need no flag (nothing to confirm); pending-church NULL-deadline anomaly → DBA rules whether it surfaces as an anomaly row.

- [MEDIUM] Request-info clock pause is MOOT at MVP for this sweep's population — but route a coordination note
  Detail: request-info exists ONLY for underground churches today (`fn_request_info_underground`, `underground_request_info_sent`, `churches.last_outcome_modal_kind`), and UG rows are excluded from the sweep. No non-UG pending church can be in a request-info state yet (flow-gaps C2 is "surface request-info path" — not built).
  Required change: policy for when C2 lands — do NOT mutate the clock; under flag-for-confirm the admin IS the pause, and Extend is the explicit instrument. The queue row must carry a "request-info open" badge once C2 exists so the human sees the context. ROUTE to the flow-gaps session: when C2 adds request-info to regular pending churches, login-time enforcement will deactivate a mid-conversation leader at the deadline — C2 must rule on that for BOTH enforcement paths (parity), not just the sweep.

- [MEDIUM] Grace window = 0 days
  Detail: login-time enforcement fires at `deadline <= now()` exactly; a sweep-side grace creates two clocks and breaks the briefing's own parity requirement. The flag is not the consequence — the grace lives in the admin's judgment between flag and confirm. Day-7 + day-1 reminders already gave warning; daily cron cadence adds natural ≤24h slack.
  Required change: flag on the first sweep run after expiry. No configurable grace at MVP.

- [MEDIUM] Admin queue experience — decision-critical context, not just a row
  Detail: at MVP the admin is the Founder + accounts@; the queue must let a human answer "did this leader ever hear the clock, and is anyone home?" in one glance.
  Required change: (1) surface in the EXISTING Pending-churches queue as a "Deadline passed" filter chip + count badge (zero-schema read-time computation satisfies this; DBA picks mechanism). (2) Row shows: church name, days overdue (not just the date), per-leader status including "deactivated at sign-in on <date>" for login-flipped leaders (reinstate path notify_t29 exists if the human judges mercy), and day-7/day-1 reminder DELIVERY state from email_log webhook tracking — two bounced reminders means the leader never heard the clock, which changes the human decision. (3) Confirm affordance runs the existing deactivate-church flow (AAL2 sensitive_destructive step-up already enforced) with `reason` PREFILLED `verification_deadline_expired` so audit_log.meta.reason distinguishes deadline-expiry from disciplinary deactivation. (4) Daily admin-notify digest to accounts@, counts-only, email_log-keyed per day (SEC owns content discipline). Copy in SEC register: "Verification window closed N days ago."

- [LOW] notify_t09 copy is generic; acceptable at MVP, log the variant
  Detail: the ratified body ("Your Replant account has been deactivated… write to accounts@…") never mentions the verification window, while the in-app lockout for this population routes `recovery_path='verification_renewal'`. Mild register mismatch; copy is Founder-ratified and locked, and she has already ruled t09 is what confirm sends.
  Required change: none now. Log a post-MVP copy item: deadline-specific variant ("your church's verification window closed") for Founder's copy queue.

MUST-FOLDS BEFORE CODE:
- Candidate set = non-UG pending CHURCHES past deadline; skip-flow exclusion written into the ticket as owned-by-G9.
- Extend-window action (new audited write surface; step-up tier → SEC) replaces any dismiss/snooze concept; deadline write self-clears flag + re-arms reminders.
- Deadline-confirm fan-out widened to include login_check-deactivated leaders (opt-in param; per-day idempotency dedups).
- Confirm prefills reason `verification_deadline_expired` into audit meta.
- Queue rows carry per-leader login-flip state + reminder delivery state from email_log.
- Grace = 0; flag on first sweep after expiry.
- Route to DBA: church-level predicate parity matrix (incl. NULL-deadline anomaly disposition), flag mechanism, self-clear on state change. Route to SEC: UG exclusion proof, digest content, Extend step-up tier, blast-radius cap. Route to flow-gaps session: C2 request-info × login-time enforcement interaction.

QUESTIONS FOR FOUNDER (merit-gated):
1. Extend-window length: fixed fresh 30-day window (recommended — matches the original covenant, re-arms day-7/day-1 reminders cleanly, no per-admin variance) or admin-picked duration?
2. When an admin extends, is the extension silent (reminders simply re-fire against the new date — recommended at MVP) or does the leader get a "your window has been extended" email? The latter is a NEW template into your copy queue; nothing ratified exists for it.

(BA lane complete — DBA next.)

### DBA verdict (2026-07-13)

VERDICT: approve-with-changes

Parity verified by READING `supabase/functions/auth-status-check/logic.ts` + `index.ts` (not the briefing summary). Load-bearing facts confirmed: (a) `resolveStatus` deactivate-writes fire ONLY on `pending_past_deadline_needs_write`, which for attached leaders requires `church.verification_status='pending'` (checked BEFORE deadline) AND `church.verification_deadline <= now()`; verified-church rows never countdown; rejected/deactivated-church rows resolve to support WITHOUT a write. (b) `deactivateAtomically` flips ONLY the user row (`verification_status='deactivated'`, `deactivated_at=now`, `is_active=false`) inside a tx with an audit row `action='deactivate_user'`, `triggered_by='system'`, `church_id`, `meta={trigger:'login_check', user_id:<public.users.id>}` — it NEVER touches the church row. (c) Live audit_log contains exactly this shape and no other writer of `deactivate_user` (5 rows, all `login_check`).

FINDINGS:

- [HIGH] Reminder clock ≠ enforcement clock — `emit_verification_reminder_emails` reads the WRONG deadline for attached leaders, and BA's "Extend re-arms reminders" claim fails as-is
  Detail: the live reminder sweep predicates on `users.verification_deadline` for ALL pending users. Enforcement for attached leaders runs on `churches.verification_deadline`. Live divergence measured: user-side deadline is 1–256 DAYS later than the church's on every attached pending leader (33 rows), and 13 more attached pending leaders have NULL user-side deadline — they get NO reminders ever. Net today: every attached leader's church clock expires BEFORE their "closes in 7 days" email would fire — login-deactivation with zero warning, which is the KAN-61 wound itself. And Extend (a `churches.verification_deadline` write) re-arms NOTHING, because the reminder predicate never reads that column.
  Required change: fold into KAN-61 — rewrite `emit_verification_reminder_emails` candidates to the same resolution matrix as the sweep: attached leader → church clock (`JOIN churches ... WHERE c.verification_status='pending' AND (c.verification_deadline::date - CURRENT_DATE) IN (1,7)` non-UG), skip leader → user clock (unchanged). Idempotency keys already embed the deadline-date, so an extended church date mints fresh keys and day-7/day-1 re-fire naturally. Do NOT dual-write `users.verification_deadline` from Extend (dual-source bug class — see ug_flag precedent).

- [HIGH] Flag mechanism: ZERO-SCHEMA (read-time predicate). No `deadline_flag_at` column, no queue table
  Detail: flag state is 100% derivable from `(verification_status, type, verification_deadline, now())`. A persisted flag is a second source of truth that needs clearing logic in every church state transition (verify, reject, extend, confirm-deactivate) — the exact dual-source class that produced the `is_underground_admin` bug. Zero-schema self-clears by construction: Extend moves the deadline → predicate false; verify/reject/confirm flips status → predicate false. Bonus for SEC: the sweep performs NO row writes at all — a bugged predicate can inflate a counts-only digest but cannot deactivate or even mark anyone; blast radius is one email.
  Required change: admin Pending-churches queue computes the chip at read time (add `verification_deadline <= now()` + `GREATEST(0, (now()::date - verification_deadline::date))` days-overdue to the existing pending-queue projection). Daily digest function is the only cron artifact (skeleton below).

- [HIGH] Exact candidate predicate (church-unit, auth-status-check parity, non-UG)
  Detail: mirrors the only branch of `resolveStatus` that produces a deadline write for attached leaders. `churches.verification_deadline` is NOT NULL by schema, so the predicate is total over pending churches. Live day-one candidate count: 14 (11 main_campus, 1 house_church, 1 ministry, 1 para_ministry); the 5 past-deadline UG pending churches are excluded by `type`.
  Required change — the canonical predicate, verbatim in sweep, queue projection, and digest:
  ```sql
  SELECT c.id
  FROM public.churches c
  WHERE c.verification_status = 'pending'
    AND c.type <> 'underground'
    AND c.verification_deadline <= now();
  ```
  Deliberately NO `is_active`/`soft_deleted_at` terms: `resolveStatus` reads neither, and adding them would let an anomalous row diverge the two enforcement paths (live data: pending co-occurs only with `is_active=true`, `soft_deleted_at IS NULL`). Optional supporting index (existing `idx_churches_deadline` suffices at current scale; add if the pending queue projection grows):
  ```sql
  CREATE INDEX idx_churches_pending_past_deadline
    ON public.churches (verification_deadline)
    WHERE verification_status = 'pending' AND type <> 'underground';
  ```

- [HIGH] Race reconciliation: a login-flip does NOT clear the church flag — and must not
  Detail: the briefing's DBA lane question 4 assumed "leader logs in first → flag must self-clear." Wrong in the church-unit frame: `deactivateAtomically` never touches the church row, so the church stays `pending` + past-deadline and REMAINS a legitimate candidate. That is correct behavior — the church lifecycle still needs the admin confirm (which flips the church AND triggers the widened fan-out that is the login-flipped leader's ONLY path to a t09 email). Double-enforcement on the same church reconciles cleanly: both paths guard `WHERE verification_status='pending'` per-user, so each user row is flipped exactly once; per-day email_log dedup (`email_log_dedup_per_day` unique index) guards the fan-out overlap window (leader flips between confirm's fan-out read and commit → they get t09 via the regular fan-out, login-flip then matches 0 rows). Post-confirm, the flipped leader's next `auth-status-check` resolves `deactivated` + past church deadline → `recovery_path='verification_renewal'` — consistent.
  Required change: verify in the admin repo that `deactivate-church.js`'s user UPDATE carries the `verification_status='pending'`-style guard (or at minimum `COALESCE`-preserves an existing `deactivated_at`) so a confirm never overwrites the login-flip timestamp the queue displays. If it blanket-overwrites, add the guard in the KAN-61 PR.

- [MEDIUM] Login-flipped-leader predicate for the widened fan-out: use the AUDIT ROW, not `deactivated_at >= deadline`
  Detail: `deactivated_at >= verification_deadline` false-positives on any post-deadline deactivation from another source (future G9 admin leader-deactivation, self soft-delete) — emailing a self-deleted account "your account has been deactivated" is the failure mode. The audit shape is exact: `deactivateAtomically` is the sole writer of `action='deactivate_user' / triggered_by='system' / meta.trigger='login_check'`, and `meta.user_id` is `public.users.id` (verified in `buildAuditRow` + live rows). Served by existing `idx_audit_log_action` + `idx_audit_log_church_id`; append-only reads, no writes.
  Required change — fan-out widening predicate, verbatim:
  ```sql
  -- leaders on :church_id deactivated by login-time enforcement (auth-status-check)
  SELECT u.id, u.email
  FROM public.users u
  WHERE u.church_id = :church_id
    AND u.verification_status = 'deactivated'
    AND u.is_active = false
    AND u.email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.audit_log al
      WHERE al.action = 'deactivate_user'
        AND al.triggered_by = 'system'
        AND al.church_id = u.church_id
        AND al.meta->>'trigger' = 'login_check'
        AND (al.meta->>'user_id')::uuid = u.id
    );
  ```

- [MEDIUM] Sweep function shape: counts-only digest, advisory lock, email_log idempotency — clone the house pattern with one deliberate improvement
  Detail: both precedents (`emit_verification_reminder_emails`, `email_dead_letter_digest`) use `pg_try_advisory_lock(hashtext(...))` + manual unlock. Both LEAK the session lock if an exception escapes outside their inner BEGIN blocks (self-healing only because pg_cron ends the session). A daily job has no concurrency need that justifies that risk.
  Required change — skeleton (tag placeholder `ops_tXX` — mint the real tag in the canonical email-tag-map per KAN-80 before code):
  ```sql
  CREATE OR REPLACE FUNCTION public.emit_deadline_flag_digest()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'pg_catalog','public' AS $fn$
  DECLARE
    resend_api_key text; n_candidates int; n_login_flipped_churches int;
    oldest_overdue_days int; req_id bigint; body_text text;
    v_key text := 'ops_tXX:deadline_flag:' || CURRENT_DATE::text;
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('emit_deadline_flag_digest')::bigint);

    SELECT count(*),
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.audit_log al
             WHERE al.action='deactivate_user' AND al.triggered_by='system'
               AND al.meta->>'trigger'='login_check' AND al.church_id = c.id)),
           max((now()::date - c.verification_deadline::date))
      INTO n_candidates, n_login_flipped_churches, oldest_overdue_days
    FROM public.churches c
    WHERE c.verification_status='pending' AND c.type<>'underground'
      AND c.verification_deadline <= now();

    IF n_candidates = 0 THEN RETURN; END IF;                  -- silence when clean (dead-letter precedent)
    IF EXISTS (SELECT 1 FROM public.email_log WHERE idempotency_key = v_key) THEN RETURN; END IF;

    resend_api_key := public.get_resend_api_key();
    IF resend_api_key IS NULL OR length(resend_api_key) = 0 THEN RETURN; END IF;

    -- counts only; NO church names, NO leader identifiers (SEC content discipline)
    body_text := format(E'Verification-deadline review digest.\n\nPending churches past deadline awaiting confirmation: %s\nOf those, churches with leaders already deactivated at sign-in: %s\nOldest overdue: %s days\n\nLog in to the dashboard Pending queue to review.\n\n— Replant Ops', n_candidates, n_login_flipped_churches, oldest_overdue_days);

    BEGIN
      SELECT net.http_post(  /* clone email_dead_letter_digest Resend call, to accounts@ */ ) INTO req_id;
      INSERT INTO public.email_log (user_id, template, sent_date, sent_at, resend_id, outcome, idempotency_key)
      VALUES (NULL, 'ops_tXX', CURRENT_DATE, now(), NULL, 'sent', v_key)
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'emit_deadline_flag_digest: emit failed: %', SQLERRM;
    END;
  END $fn$;
  -- cron: SELECT cron.schedule('deadline-flag-digest', '0 10 * * *', 'SELECT public.emit_deadline_flag_digest();');
  ```
  Xact-scope lock is a deliberate divergence from precedent (no unlock path to leak); 10:00 UTC slots after the 09:30 reminder run so day-of expiries reminded that morning aren't double-touched conceptually.

- [LOW] NULL-deadline pending-church anomaly: IMPOSSIBLE — rule closed
  Detail: `churches.verification_deadline` is `NOT NULL` (verified live in information_schema). The `resolveStatus` NULL-deadline fail-closed branch is defensive dead code for real rows (reachable only via a failed embed read). No anomaly row, no special sweep handling; the predicate's `<= now()` is total over pending churches. The REAL anomaly lives on the users side (13 attached pending leaders with NULL `users.verification_deadline`) and is fully resolved by the reminder-clock fix above (they move onto the church clock); note it in the G9 ticket for skip-flow completeness.

MUST-FOLDS BEFORE CODE:
- Zero-schema mechanism locked: no new columns/tables; queue chip + digest both compute from the canonical predicate verbatim (single SQL fragment, reused — do not paraphrase it per call site).
- Reminder-clock parity fix folds INTO KAN-61: `emit_verification_reminder_emails` resolves attached leaders on the CHURCH clock (non-UG pending churches), skip leaders on the user clock. Without it, Extend re-arms nothing and leaders keep getting deactivated before their day-7 email exists.
- Extend writes `churches.verification_deadline` ONLY (guarded `WHERE verification_status='pending'`), plus audit row. No users-side mirror write.
- Fan-out widening uses the audit-row EXISTS predicate above; never `deactivated_at >= deadline`.
- Verify `deactivate-church.js` (admin repo) user-UPDATE idempotency guard / `deactivated_at` preservation before wiring confirm.
- Mint the digest's ops tag in the canonical email-tag-map (KAN-80) before code; digest is counts-only, keyed `<tag>:<date>`, silent when zero.
- The church flag does NOT clear on a leader login-flip — church-unit candidacy persists until a CHURCH state change. State this in the ticket so nobody "fixes" it later.

QUESTIONS FOR FOUNDER (merit-gated):
- None new from the DBA lane. BA's two questions stand; note for her Q1 that a fixed fresh 30-day window composes cleanly with the reminder-clock fix (new deadline date = new idempotency keys = day-7/day-1 re-fire with zero extra code).

Route to SEC: zero-schema means the sweep writes nothing — mass-flag blast radius reduces to digest content (counts only, no church names/leader identifiers per skeleton above); UG exclusion is a single `type <> 'underground'` term in the canonical predicate (the 5 live past-deadline UG pending churches must never appear in any count — verify the digest's counts can't leak UG existence by subtraction against the dashboard totals); whether per-church flag events additionally belong in audit_log is SEC's call (zero-schema derives them retroactively from deadline + cron history).

(DBA lane complete — SEC next.)

### SEC verdict (2026-07-13)

VERDICT: approve-with-changes

Verified against admin repo **origin/main** (`git show origin/main:...` — local checkout is a stale branch and was not trusted) + live DB (read-only): `deactivate-church.js`, `edit-pending.js`, `verification-notify.js`, `pending-leaders.js`, `Queue.jsx`, `action-names.js`, `churches_admin` view def, `pg_policy` on churches, `email_log` indexes, live counts (24 non-UG pending / 14 candidates / 7 UG pending, 5 past-deadline).

FINDINGS:

- [HIGH] Confirm path is missing its action-bound step-up token — KAN-61 routinizes this endpoint; close the acknowledged follow-up now
  Detail: `deactivate-church.js` on MAIN carries `verifySuperAdmin` + AAL2 freshness `tier: 'sensitive_destructive'` (5-min, correct per the locked 4-tier table), but NO `validateStepUp` — its own comment defers "action-bound step-up token" as a "paired FE follow-up", and the FE call (`api.js:298`) sends no token. `ACTIONS.DEACTIVATE_CHURCH` already exists in both action-name twins. Every sibling verdict endpoint (approve-church, reject-church, verify-leader, edit-pending) validates a bound token; the one KAN-61 invites admins to click daily is the one without it.
  Required change: fold into KAN-61 — endpoint adds `validateStepUp(token, { expectedAction: ACTIONS.DEACTIVATE_CHURCH, ... })`; FE confirm affordance wires `useStepUp(ACTIONS.DEACTIVATE_CHURCH)`. No new action name needed.

- [HIGH] Extend-window endpoint — full SEC contract (this is the ruling BA routed)
  Detail: new endpoint `extend-verification-deadline`. Tier: **regular_destructive (30-min AAL2)** + TIER 1 action-bound step-up (default 5-min TTL) — per the canonical tier pattern, sensitive_destructive is reserved for verdict commits / UG identity / admin tier; Extend defers a verdict, it doesn't commit one, and the destructive twin (confirm) already sits at 5-min. Harassment-by-shortening is killed by construction: the endpoint accepts NO client-supplied absolute date — server computes `new_deadline = now() + 30 days` (or admin-picked days capped ≤ 30 if Founder Q1 goes that way), which is always monotonic-forward from a past deadline. No hard re-extension cap (an attacker holding this session could simply approve the church — a cap adds friction, not security); queue displays "extended N times" derived from audit rows for human judgment.
  Required change: `verifySuperAdmin` (privilege parity with the confirm affordance on the same queue row) · `checkAal2Freshness(jwt, { tier: 'regular_destructive' })` · `validateStepUp` bound to new `ACTIONS.EXTEND_VERIFICATION_DEADLINE: 'extend-verification-deadline'` (CJS + ESM twins same commit per the action-names HARD RULE) · audit FIRST, action `extend_verification_deadline`, churchId column set, meta `{old_deadline, new_deadline, extension_days, actor_email, ip}` (no PII fields, no masking needed) · UPDATE guarded `.eq('verification_status','pending')` AND `type <> 'underground'` — the UG guard is load-bearing: churchId is client-supplied, and an Extend against a UG church would silently distort the UG day-25/day-30 lifecycle clock · `edit-pending.js` blocklist VERIFIED intact on MAIN (`verification_deadline` absent from `EDITABLE_FIELDS.church`, pending-only UPDATE guard present) — add a regression test asserting `verification_deadline` never enters that allowlist so Extend stays the only path.

- [HIGH] UG exclusion is architecturally sufficient — with one load-bearing caveat: the digest's ONLY exclusion layer is the predicate term
  Detail: queue chip inherits THREE verified layers — `churches_admin` view (`WHERE type <> 'underground'`, live viewdef), RESTRICTIVE policy `churches_underground_restrict` (live pg_policy), and the canonical predicate's `type <> 'underground'`. But `emit_deadline_flag_digest` is SECURITY DEFINER and reads `public.churches` directly — RLS and the view do NOT protect it; the predicate term is its sole layer. Inference channels ruled CLEAN: digest counts are computed exclusively over non-UG rows, so they are mathematically independent of UG lifecycle events — the day-30 auto-reject moves UG rows pending→rejected, which cannot move a non-UG count (no co-movement, no subtraction channel; the dashboard Pending queue the counts would be compared against is itself non-UG). Fixed 10:00 UTC send time carries no signal; silent-when-zero signals only "≥1 non-UG candidate exists."
  Required change: (1) the digest's SQL must use the canonical predicate fragment verbatim (DBA's single-fragment rule — for the digest this is a SEC invariant, not a style rule); (2) add the sweep to the invariant greps: any future edit to `emit_deadline_flag_digest` that touches the WHERE clause needs a SEC eye; (3) digest recipient hardcoded `accounts@` — never parameterized; counts in BODY only, subject line generic (inbox-observer discipline).

- [MEDIUM] Blast-radius guard: supersede "LIMIT" with an anomaly threshold; NO bulk-confirm affordance, ever
  Detail: zero-schema means the sweep cannot write — remaining blast surfaces are the digest and the human. A LIMIT on a counts-only aggregate would silently UNDERSTATE an anomaly (worse than none). The real mass-confirm guard is structural: confirm is per-church, each click behind sensitive_destructive AAL2 + step-up (per finding 1).
  Required change: N = 25 (hard constant; ~2× the day-one backlog of 14; revisit at scale). When `n_candidates > 25` the digest prepends a warning line ("candidate count exceeds anomaly threshold — verify the sweep predicate before confirming any deactivation") and still sends. Queue ships with NO select-all / bulk-confirm control — state this in the KAN-61 ticket as a design constraint, not an omission.

- [MEDIUM] Audit posture ruled: read-time flags are acceptable; enrich the CONFIRM's meta server-side; digest stays email_log-only
  Detail: no per-flag audit rows needed — flag state is retroactively derivable (deadline + cron history + digest email_log rows). But zero-schema makes the confirm's audit row the ONLY persistent record of WHY a church was deactivated, and today `deactivate-church` writes only client-supplied `reason` into meta.
  Required change: (1) FE deadline-queue confirm sends the structured constant `reason: 'verification_deadline_expired'` (disciplinary call sites keep free text); (2) endpoint reads the church row before UPDATE and writes `deadline_at_deactivation` (+ derived `days_overdue`) into meta server-side — forensics must not depend on a client-supplied field; (3) digest → email_log idempotency row only, NO audit_log breadcrumb (audit_log records principal actions on data subjects; a counts-only ops email has neither — daily rows would be noise).

- [LOW] Widened fan-out predicate is tight — add one cheap server-side gate on the opt-in param
  Detail: DBA's audit-EXISTS predicate (sole-writer of `deactivate_user`/`system`/`login_check` verified in code + live rows) cannot sweep in other-reason deactivations, and emailing the login-flipped leader is emailing the data subject about their own account with Founder-ratified generic t09 copy — no PII/inference issue. Two residuals: (a) `resolveStatus` has NO UG branch on the pending-past-deadline path, so UG-attached leaders CAN carry `login_check` audit rows; a disciplinary `deactivate-church` call on a UG church with the widened param would then email them (t09 is generic — no church name — so impact is minimal, but the path shouldn't exist). (b) A reinstated-then-re-deactivated leader's stale `login_check` row could re-match — far-fetched at MVP, accepted.
  Required change: the widened fan-out activates only via the explicit opt-in param from the KAN-61 confirm call site, and the endpoint additionally gates it server-side on `church.type <> 'underground'` (one comparison). Residual (b): accept; note in code comment.

- [LOW] Reminder-clock fold (DBA's must-fold): no NEW inbox-oracle exposure — net UG-exposure REDUCTION; confirm and move on
  Detail: "reminder arrived → account still pending" is the same information class the current user-clock reminders already emit to an inbox observer; switching which clock drives timing adds no new category, and content stays leader-facing. The rewritten non-UG predicate also STOPS deadline reminders to UG-attached leaders (possible today via `users.verification_deadline`), removing a UG-adjacent inbox artifact.
  Required change: none to the fold itself. ROUTE to the UG lifecycle workstream: whether UG leaders should receive ANY deadline-adjacent comms (their day-25/day-30 cadence currently sends them nothing directly) is that workstream's call, not KAN-61's.

MUST-FOLDS BEFORE CODE:
- deactivate-church gains `validateStepUp` bound to `ACTIONS.DEACTIVATE_CHURCH` + FE `useStepUp` wiring (closes the in-code acknowledged follow-up).
- Extend endpoint per the contract above: regular_destructive AAL2 + TIER 1 step-up + new action name in both twins + audit-first + pending-and-non-UG UPDATE guard + server-computed forward-only date (no client-supplied absolute date).
- Digest: canonical predicate verbatim (SECURITY DEFINER = predicate is the only UG layer); N=25 anomaly warning line; hardcoded accounts@ recipient; counts in body only; email_log-only (no audit row).
- Confirm meta enrichment: structured `verification_deadline_expired` reason + server-read `deadline_at_deactivation`/`days_overdue`.
- Widened fan-out: opt-in param + server-side non-UG gate on the param path.
- No bulk-confirm affordance in the queue — written into the ticket as a design constraint.
- Regression test: `verification_deadline` stays out of `edit-pending` `EDITABLE_FIELDS.church`.

QUESTIONS FOR FOUNDER (merit-gated):
- None new from the SEC lane. BA's Q1/Q2 stand; note for Q1 that fixed-30-day composes with the SEC contract most cleanly (server computes the date; zero client input surface).

(SEC lane complete — panel done.)
