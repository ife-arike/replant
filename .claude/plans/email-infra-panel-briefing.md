# Email Infrastructure SME Panel — Briefing 1-pager

**Sprint:** Email-tidying tidying + KAN-80 modernization
**Filed by:** SM/CC (current Claude Code session), 2026-06-24 evening III
**Founder ruling driving this panel:** *"KAN-80 is very outdated. a lot of things have changed since the ticket was first created."* SME panel required before any code lands. Seasoned-expert + biblical-wise + Replant-endgoal-in-view review.
**Sequencing:** BA → DBA → SEC → AUTH → BE → OPS → CONTENT. Each SME sees this 1-pager + cumulative findings from prior SMEs.

---

## 1. Mission framing (every SME — open with this)

You are a seasoned, senior **[LANE]** for Project Replant — a secure ministry network app for verified Christian leaders globally, including the persecuted underground. You operate at principal-tier in your lane, with years shipping sensitive-data systems and a deep instinct for what breaks at scale.

**Hold the endgoal in view:** churches from all over the globe — underground, persecuted, resource-constrained, mainstream — using Replant the way it was meant to be used. Every recommendation should hold up against that endgoal, not just today's sprint scope.

**Pray first.** Open with a real, specific intercession in the name of Jesus Christ, naming this work (KAN-80 email infrastructure modernization) and the leaders it serves — particularly the underground brother in Tehran whose email may be the only durable touchpoint, the verified pastor in Lagos who fills out an interest form and gets the first impression of who Replant is, the volunteer whose welcome email lands in a spam folder if we get dark-mode wrong. End "In Jesus' name, Amen."

## 2. Live state of the email surface (16 + 2 carve-outs = ~18 total)

After Founder ruled scope (2026-06-24 evening III), in-app event emails (Connect DM, Prayer Wall comment, branch invite at send-time) are OUT — push notifications handle those. Two carve-outs are IN: heartcry-acknowledged-to-leader + branch-invite-stale-after-24-48h.

### Family 1 — Website intake confirmations (CD redesign in flight)
1. `intake_form_welcome` → leader (Netlify `join-welcome.js` calls Resend with inline HTML)
2. `intake_form_admin_notify` → Replant team
3. `serve_with_us_welcome` → volunteer (Netlify `volunteer-welcome.js`)
4. `serve_with_us_admin_notify` → Replant team

### Family 2 — Account-created (KAN-12 atomic txn Steps 6–7; lives in Supabase `create-account` edge function)
5. `welcome_skip` (skip-flow leader, no church yet)
6. `welcome_pending_church` (church in 30-day window)
7. `welcome_verified_church` (joins verified church)
8. `welcome_underground_pending` (underground branch — strict identity rules)
9. `new_church_registered` → admin/`accounts@`

### Family 3 — Verification lifecycle (mostly NOT BUILT; KAN-143 + KAN-62)
10. `verification_request_info` → leader (admin asks pending leader for more)
11. `verification_approved` → leader
12. `verification_rejected` → leader
13. `verification_reminder_7d` → leader (cron, KAN-62)
14. `verification_reminder_1d` → leader (cron, KAN-62)
15. `account_deactivated` → leader (KAN-61 cron, Founder tone-gated per KAN-81 T5)
16. `coleader_departed` → remaining leader

### Family 4 — Password reset (KAN-198 Highest; KAN-39 In Progress)
17. `password_reset_otp` → leader (self-serve, Email OTP path replacing PKCE)
18. `password_reset_admin` → admin (admin-initiated from Team Management — partial: `_lib/admin-invite-email.js::buildPasswordResetEmail` exists today)

### Family 5 — In-app event email carve-outs (Founder-ratified, narrow)
19. `heartcry_acknowledged` → submitting leader (admin has opened/prayed; no body content quoted; underground-safe)
20. `branch_invite_stale` → invited leader (24–48h gate; only if leader hasn't responded in app)

### Family 6 — Admin notifications (some live; KAN-271 bundle being handled in another session — DO NOT scope here)
21. `flag_escalated` → super-admin team (LIVE today via `escalate-flag.js`)
22. `heartcry_triage_ping` → triage lead (LIVE today via `submit-heartcry/index.ts`; Vault-resolved recipient)
23. `admin_invite` → new admin (LIVE today via `_lib/admin-invite-email.js::buildInviteEmail`)
24. `admin_access_granted` → existing user newly granted admin (LIVE today via `_lib/admin-invite-email.js::buildAccessGrantedEmail`)
25. `admin_account_deactivated` → demoted admin (NOT BUILT; KAN-168)
26. `admin_promotion_*` / `admin_demote` / `admin_name_change` → various (NOT BUILT; KAN-271 bundle in OTHER session — out of scope for THIS panel except for utility-contract compatibility)

## 3. Runtime split (the architectural reality KAN-80 spec missed)

Sending happens in TWO runtimes that cannot share a single ESM/Deno module:

- **Deno (Supabase edge functions)** — `create-account`, `submit-heartcry`, `join-underground-church`, `send-message`. Today: each function calls `fetch("https://api.resend.com/emails")` inline. No shared module.
- **Node (admin Netlify functions)** — `join-welcome`, `volunteer-welcome`, `invite-admin`, `grant-admin`, `send-password-reset`, `escalate-flag` + `_lib/underground-notify`, `_lib/admin-invite-email`. Today: each calls Resend SDK or raw API.

**SM proposal (BE will weigh in):** **Option A — two thin client implementations of one contract.** ~150 lines each. Same `email_log` writes (via service-role from both sides), same idempotency-via-unique-constraint, same retry, same fire-and-forget posture. Code-duplication is acceptable because the contract is the source of truth, not the code path.

**Alternative — Option B:** consolidate all email sends into Supabase edge functions; admin Netlify functions call a Supabase function. Larger refactor. Single runtime. Centralizes secret handling.

## 4. `email_log` schema as it actually lives in prod

Verified live 2026-06-24 evening III via `information_schema.columns`:

```
id          uuid       NOT NULL  DEFAULT gen_random_uuid()
user_id     uuid       NOT NULL
template    text       NOT NULL
sent_date   date       NOT NULL  DEFAULT CURRENT_DATE
sent_at     timestamptz NOT NULL DEFAULT now()
resend_id   text       NULL
outcome     text       NOT NULL  DEFAULT 'sent'
```

**Notable deviations from KAN-80 spec:**
- KAN-80 expected `status` column. Live column is `outcome`. Same purpose, different name.
- UNIQUE constraint `email_log_dedup` on `(user_id, template, sent_date)` is expected per spec; **DBA to confirm live**.
- KAN-80's "hard block on `email_log.status` migration" is **functionally resolved** — column exists.

## 5. KAN-80 spec deltas (what's outdated)

The KAN-80 ticket was filed early in Replant's life. Founder explicit: *"a lot has changed since the ticket was first created."* Outdated assumptions:

| KAN-80 spec assumed | Reality today |
|---|---|
| 8 named templates | 18+ surfaces; enum needs expansion to ~22–26 identifiers (admin-tier bundle excluded — that's KAN-271's other session) |
| Single Deno utility | Two runtimes (Deno + Node); cannot share a module |
| `email_log.status` | Live column is `outcome` |
| KAN-31a Done = hard block | Functionally done — every admin Netlify function sends from `connect@projectreplant.org` in prod today |
| Template 5 tone-gated on Ife via COO | "Ife" = Founder; tone gate still applies for the dignity-of-deactivation copy but the COO-routing path is now Founder-direct |
| Anonymous template 7 (heartcry triage ping) — zero variables | Now also: heartcry-acknowledged-to-leader carve-out; still NO body content in any heartcry email |
| Resend SDK install | Today: `fetch()` direct against REST API in Deno; SDK in Node admin functions. Choose path. |

## 6. Proposed contract for `sendEmail()` (BE will refine)

Per-lane review this contract; flag what's wrong:

```ts
type EmailKind =
  // Family 1
  | 'intake_form_welcome' | 'intake_form_admin_notify'
  | 'serve_with_us_welcome' | 'serve_with_us_admin_notify'
  // Family 2
  | 'welcome_skip' | 'welcome_pending_church'
  | 'welcome_verified_church' | 'welcome_underground_pending'
  | 'new_church_registered'
  // Family 3
  | 'verification_request_info' | 'verification_approved'
  | 'verification_rejected'
  | 'verification_reminder_7d' | 'verification_reminder_1d'
  | 'account_deactivated' | 'coleader_departed'
  // Family 4
  | 'password_reset_otp' | 'password_reset_admin'
  // Family 5 (carve-outs)
  | 'heartcry_acknowledged' | 'branch_invite_stale'
  // Family 6 (in-scope admin; KAN-271 bundle excluded)
  | 'flag_escalated' | 'heartcry_triage_ping'
  | 'admin_invite' | 'admin_access_granted'
  | 'admin_account_deactivated';

sendEmail({
  template: EmailKind,
  to: string,                // recipient email
  variables: Record<string, unknown>,
  userId: string,             // for email_log dedup; required even for admin notify (resolve to a sentinel "system" user_id if no leader subject)
  idempotencyKey?: string,    // optional; defaults to (template + userId + UTC-day) hash
}): Promise<{ success: true; resend_id: string } | { success: false; reason: string }>
```

**Behavior:**
- Idempotency check: `SELECT id, resend_id FROM email_log WHERE user_id=? AND template=? AND sent_date=CURRENT_DATE LIMIT 1`. If hit → short-circuit return `{ success: true, resend_id: existing }`. Do not send.
- Send via Resend REST API (`POST https://api.resend.com/emails`). API key from Supabase Vault via `get_secret_by_name('resend_api_key')` (NOT env vars, per KAN-80 B2). Node side: may use Resend SDK with Vault-resolved secret OR raw fetch; BE picks.
- On 5xx / network error → ONE retry after 5s. On second failure → `INSERT email_log (..., outcome='failed', resend_id=NULL)` and return `{ success: false, reason }`.
- On 2xx → capture `resend_id`, `INSERT email_log (..., outcome='sent', resend_id=<id>)`.
- **Fire-and-forget contract:** caller does NOT roll back its transaction on email failure. Per SEC ruling KAN-31 comment 10013.
- **PII discipline:** no body content, no variable values, no recipient address in console / structured logs. `email_log` row stores `template`, `user_id`, `sent_date`, `sent_at`, `resend_id`, `outcome` — no PII.

**Webhook handler** (new edge function `resend-webhook` — Deno): verifies Resend signature, processes `email.delivered` / `email.bounced` / `email.complained` events → updates the matching `email_log` row's `outcome`.

## 7. Underground invariants (apply to every template that addresses a leader)

- Never name an underground leader's church. Use "your church" / "your ministry" as the literal default.
- Never name their region / city / country. Even in admin-internal notifications about underground rows — Template 2 (`new_church_registered`) suppresses location for `church.type='underground'` and points admin to the Underground Oversight admin screen instead.
- First name only regardless of `display_name_preference`.
- `churches_public` view excludes underground — any email-side join against churches must respect this view, not the raw `churches` table.
- The 2 carve-outs (Family 5) are underground-safe by design: heartcry-ack quotes no body, branch-invite-stale names no church.

## 8. What I want from each SME (output shape)

Return your verdict + findings in this shape (tight, structured — no essays):

```
VERDICT: approve | approve-with-changes | block

FINDINGS:
- [CRITICAL/HIGH/MEDIUM/LOW] <one-line headline>
  Detail: <2–4 lines max>
  Required change: <concrete, paste-able diff or schema/copy directive>

MUST-FOLDS BEFORE CODE:
- <bullet list of the items above that gate code from landing>

ADDITIONS / OBSERVATIONS (in-lane only):
- <bullet list of things I should know about but that aren't blocking>

QUESTIONS FOR FOUNDER (if any):
- <bullet list; numbered (1, 2, 3 — NEVER A, B, C) per [[feedback-enumerate-with-numbers]]>
```

Stay in your lane. Trust the other SMEs to cover theirs. If something straddles, name it and say which lane should own it — don't try to own everything.

---

## Cumulative findings (append below as panel runs)

> Each SME's verdict + findings get folded into this file as the panel proceeds; later SMEs read the prior findings before responding from their lane.

### BA — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings that constrain downstream lanes:**

1. **Per-UTC-day dedup is wrong for cron-driven sends.** UTC-day boundary collisions are real (`verification_reminder_7d` cron at 23:55 UTC fails, retry at 00:05 UTC succeeds → two rows on two different `sent_date` values → leader gets two reminders 10 min apart). Worse for UTC±12 leaders. **Required:** add `idempotency_key text NULL` column to `email_log` with partial UNIQUE on `(user_id, template, idempotency_key) WHERE idempotency_key IS NOT NULL`. Cron callers pass explicit key (e.g., `verification_reminder_7d:${user_id}:${verification_deadline_date}`). User-triggered welcomes keep `(user_id, template, sent_date)` default. **The contract's optional `idempotencyKey` param becomes mandatory for cron + admin-notify templates.** (DBA owns schema; BE owns API.)

2. **Admin-notify dedup must key on EVENT, not user.** `new_church_registered`, `flag_escalated`, `intake_form_admin_notify`, `serve_with_us_admin_notify` — recipient ≠ subject. Sentinel "system" user_id → silently drops second event same UTC day. Submitting-leader user_id → intake-form submitters aren't `public.users` rows yet. **Required:** dedup keys on `${template}:${event_id}` (church_id, flag_id, intake_submission_id, etc.). Sentinel user_id (= `accounts@projectreplant.org` admin's `public.users.id` = `19bf5467` per [[reference-highest-tier-admins]]) satisfies FK but is NOT the dedup key. Contract should split `dedupSubjectId` and `logUserId`; default both to same value with override.

3. **`welcome_underground_pending` BLOCKED pending Founder ruling.** Threat-model conflict: durable touchpoint vs. inbox-side paper trail / Resend-side log tying email to "underground" string. (Founder Q1 below.)

4. **Bounce policy is three-tier with underground carve-out.** KAN-80's "no automated leader-side action" is too permissive. **Required:** new `email_suppressions` table; hard bounce → suppress ALL templates + flag `email_channel_status='broken'` + in-app banner ("we tried and it bounced; update email in Settings"); soft bounce → 3 retries / 24h then escalate to hard; **underground hard bounce → suppress + UG Inbox queue per [[postmvp-ug-inbox-verified-leader-routing]] + treat as compromise signal**. Recovery via in-app email change clears suppression. (DBA owns table; SEC will weigh in on underground signal handling; OPS owns monitoring.)

5. **Complaint policy needs underground carve-out.** Non-underground complaint → suppress marketing-class, KEEP transactional (verification/password reset/deactivation). Underground complaint → suppress ALL + freeze account into "compromise-suspected" state + UG Inbox HIGH severity. This is exactly the architectural-layer protection per [[feedback-underground-protection-focus]].

6. **Two retry profiles in contract:**
   - `retryProfile: 'standard'` (default) — one retry after 5s, then dead-letter.
   - `retryProfile: 'pastoral'` — three retries (5s / 30s / 5min) + admin alert on dead-letter. Applied to `account_deactivated`, `verification_rejected`, `coleader_departed`, `admin_account_deactivated`, `verification_request_info`.
   Heartcry retries stay standard (speed > redundancy).

7. **Dead-letter SLAs named per profile** (OPS to ratify in their pass):
   - Pastoral: 4-business-hour SLA; admin alert via flag-escalation channel; manual re-trigger.
   - Standard: next-business-day SLA; daily digest to `accounts@`.
   - Heartcry (`heartcry_triage_ping`, `heartcry_acknowledged`): 1-hour SLA; PagerDuty-style alert.
   In-app surface MUST be the primary signal — email is backup; verify in-app coverage before each template ships.

8. **`heartcry_acknowledged` triggers on FIRST admin action against the heartcry row** (open-with-intent OR triage note — whichever lands first), idempotency-keyed on `heartcry_id`. Body says only "We have received and are praying." No admin name, no triage content, no heartcry quote. (Founder Q3.)

9. **`branch_invite_stale` fires exactly once per invite in 24–48h window via cron.** Cron sweeps every 6h for `invite_status='pending' AND invite_sent_at < now()-24h AND invite_sent_at > now()-48h AND no prior email_log row for (invited_user_id, 'branch_invite_stale', invite_id)`. After 48h window closes — no further nag. Idempotency on `invite_id`.

10. **`new_church_registered` splits surface vs underground recipients.** Surface → `accounts@projectreplant.org`. Underground → underground-admin-only (Founder + accounts@ per [[reference-highest-tier-admins]]; NOT general admin team). Underground variant suppresses location/region in body.

11. **`verification_request_info` reply path at MVP = email reply to `connect@`.** Admin pastes into queue note field. Post-MVP: in-app verification inbox. (Founder Q4.)

12. **`verification_rejected` is final-state notification with one recovery line** ("If this feels wrong, write to `accounts@projectreplant.org`"). Don't bake appeal flow into MVP copy — aligns with [[postmvp-rejected-church-resubmission-flow]]. (Founder Q5.)

13. **Intake-form timeline promise.** Recommendation: commit to "within 7 days" + backing admin digest of unactioned submissions >7d. Or drop timeline and say "we read every submission." (Founder Q6.)

**Founder questions BA surfaced (still open — Founder to rule before code lands):**
1. `welcome_underground_pending` — ships at all? If yes, generic template name + plain text + generic From. If no, in-app post-signup screen carries the story alone.
2. Bounce + complaint policy for underground (stricter than surface — confirm posture).
3. `heartcry_acknowledged` trigger moment — first admin action, keyed on heartcry_id?
4. `verification_request_info` reply path at MVP = email reply to `connect@`?
5. `verification_rejected` appeal language = "write to accounts@" as only recovery line?
6. Intake-form welcome timeline — 7-day commitment with admin digest, or no-timeline promise?

**BA observations downstream lanes should know:**
- `welcome_skip` (no church yet) MUST name the 30-day deactivation deadline in body. In-app banner is source of truth; email mirrors.
- Contract should split `dedupSubjectId` (idempotency) from `logUserId` (FK). Same value by default; allow override.
- "Fire-and-forget" rests on the assumption that in-app surface always carries the truth. Verify every new template kind has an in-app companion before lock.
- `account_deactivated` tone-gate per KAN-81 T5 still applies. Founder reviews copy before deploy.
- `coleader_departed` for underground = generic "your co-leader has departed" with admin-channel recourse; surface = name departing leader. CONTENT decides.
- Sentinel user_id for admin-notify FK = `19bf5467` (`accounts@`), NOT `bb6c6385` (Founder personal). Institutional account, not the person. **NOTE: DBA superseded this — see DBA Finding 5 below; `user_id` becomes NULLable so no sentinel is required.**

---

### DBA — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings that constrain downstream lanes:**

1. **HARD BLOCKER: live `email_log_outcome_check` CHECK only allows 4 values** (`sent`, `suppressed_empty_queue`, `suppressed_rate_limit`, `failed_resend_emit`). KAN-80 lifecycle states (`delivered`, `bounced`, `complained`, `failed`) and BA's hard/soft bounce distinction ALL hit a CHECK violation. **Webhook handler cannot land any update under current constraint.** Migration M1 rewrites the CHECK to the full lifecycle: `queued | sent | delivered | soft_bounced | hard_bounced | complained | failed | suppressed_pre_send` + the 3 legacy `suppressed_*` / `failed_resend_emit` values (49 prod rows all `outcome='sent'` — no backfill).

2. **Locked state machine** (BE enforces in code; no DB trigger — `email_log` is intentionally mutable for webhook updates, unlike `audit_log`):
   ```
   queued → sent → delivered          (happy path)
   queued → sent → soft_bounced → delivered
   queued → sent → soft_bounced → hard_bounced
   queued → sent → hard_bounced
   queued → sent → complained         (terminal post-delivery)
   queued → failed                    (Resend 5xx, retry exhausted)
   ```
   Terminal: `delivered`, `hard_bounced`, `complained`, `failed`, `suppressed_*`.

3. **`resend_id` is unindexed today.** Every webhook event would table-scan at 5M rows/year + no protection against duplicate `resend_id` rows. M3: `CREATE UNIQUE INDEX email_log_resend_id_uniq ON public.email_log (resend_id) WHERE resend_id IS NOT NULL;`

4. **Idempotency primitive split + per-day UNIQUE rewrite** (resolves BA Critical #1 + #2 in one migration). M2 adds `idempotency_key text NULL` + single-column partial UNIQUE (not composite — caller namespaces the key e.g. `flag_escalated:<flag_id>` or `verification_reminder_7d:<user_id>:<deadline>`); rewrites legacy `email_log_dedup` UNIQUE as partial-on-`WHERE idempotency_key IS NULL`. Two dedup modes coexist cleanly.

5. **DBA supersedes BA's sentinel-admin pattern.** Make `email_log.user_id` NULLable + add CHECK `(user_id IS NOT NULL OR idempotency_key IS NOT NULL)`. Admin-notify rows = `user_id=NULL` + namespaced idempotency_key. No FK churn risk. M4 also tightens the per-day partial UNIQUE to `WHERE idempotency_key IS NULL AND user_id IS NOT NULL`. BA's `dedupSubjectId` / `logUserId` split becomes natural — `logUserId` is just nullable.

6. **Webhook-fires-before-INSERT race pattern (DBA prescribes; BE implements):**
   ```
   1. INSERT email_log INSIDE the calling transaction with outcome='queued',
      resend_id=NULL, idempotency_key set if applicable.
      UNIQUE constraint = atomic claim.
   2. COMMIT calling transaction.
   3. POST to Resend. On 2xx → UPDATE to outcome='sent', resend_id=<id>.
      On 5xx after retry → UPDATE to outcome='failed'.
   4. Webhook handler retries with backoff (500ms / 2s / 10s) to absorb
      INSERT-not-yet-visible; after 3 misses → dead-letter.
   ```
   This is also why `outcome='queued'` is required (Finding 1).

7. **`email_suppressions` table** (M5):
   ```sql
   CREATE TABLE public.email_suppressions (
     id uuid PK default gen_random_uuid(),
     email_norm text NOT NULL,        -- GENERATED ALWAYS AS lower(btrim(email_original)) STORED
     email_original text NOT NULL,
     reason text NOT NULL CHECK IN ('hard_bounce','soft_bounce_threshold','complaint','underground_compromise_suspected','admin_manual','invalid_address'),
     severity text NOT NULL DEFAULT 'standard' CHECK IN ('standard','underground'),
     associated_user_id uuid NULL REFERENCES users(id),
     first_observed_at timestamptz NOT NULL DEFAULT now(),
     last_observed_at timestamptz NOT NULL DEFAULT now(),
     observation_count integer NOT NULL DEFAULT 1,
     expires_at timestamptz NULL,
     cleared_at timestamptz NULL,
     cleared_by uuid NULL REFERENCES users(id),
     meta jsonb NULL
   );
   CREATE UNIQUE INDEX email_suppressions_active_uniq
     ON email_suppressions (email_norm) WHERE cleared_at IS NULL;
   ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
   CREATE POLICY email_suppressions_service_only ON email_suppressions
     USING (auth.role() = 'service_role');
   ```
   Email normalization: `lower(trim(email))` only — do NOT strip plus-addressing (legitimate routing). Soft-bounce escalation logic is BE-side; DBA enables. Hard / complaint / underground_compromise_suspected = `expires_at NULL` (manual or in-app clear only).

8. **Recovery RPC** (M5b):
   `public.clear_email_suppression_for_change(p_old_email text, p_new_email text)` — SECURITY DEFINER. Guard: caller's `auth.uid()` resolves to a `users` row whose CURRENT email matches `p_old_email`. UPDATE sets `cleared_at`. If `severity='underground'`, also writes `audit_log` action `'underground_suppression_cleared'` (coordinate with SEC).

9. **`users` state for in-app banner + underground freeze** (M6):
   ```sql
   ALTER TABLE users ADD COLUMN email_channel_status text NOT NULL DEFAULT 'ok'
     CHECK IN ('ok','bouncing','broken');
   ALTER TABLE users ADD COLUMN account_freeze_reason text NULL
     CHECK IS NULL OR IN ('underground_compromise_suspected','admin_action');
   ALTER TABLE users ADD COLUMN account_frozen_at timestamptz NULL;
   ```
   Partial indices on the non-default states. In-app banner reads `users.email_channel_status` (covered by existing `users_select_own` RLS) — NOT `email_suppressions` directly (service-role-only stays).

10. **Template identifier strategy = CHECK constraint** (M7) — NOT PG enum (nightmare ALTER), NOT FK registry (join on every send). **CRITICAL: prod already has 3 templates not in proposed `EmailKind`:**
    - `heartcry_triage_notification` (48 rows, ~98% of prod email_log volume) — this is THE SAME surface as proposed `heartcry_triage_ping`. ONE gets renamed. **DBA recommends keeping the live string** (`heartcry_triage_notification`) and renaming the proposed enum to match — avoids 48-row data migration that gets expensive at 5M rows.
    - `pastoral_signal_digest_t2` (44 rows)
    - `pastoral_signal_alert_t1` (1 row)
    
    Flagged for CONTENT to confirm legacy / KAN-271-bundle / in-scope.

11. **Audit_log breadcrumb actions** to add (coordinate with SEC):
    - `email_suppression_added`
    - `email_suppression_cleared`
    - `underground_email_freeze_applied`
    
    DBA does NOT write these from inside `sendEmail()` (latency coupling) — suppression-write RPCs + account-freeze RPC emit them.

12. **RLS posture confirmed: service-role-only on both `email_log` and `email_suppressions`.** No leader read on `email_log` (PII discipline + underground behavioral fingerprint risk). If Settings ever needs a count, expose SECURITY DEFINER RPC returning scalar only — never row contents.

13. **Partitioning deferred to post-MVP** (at ~3M rows partition by RANGE `sent_date` monthly). Indices fit in cache at <10M rows. File a post-MVP ticket.

**Migration sequence (DBA-locked):**
M1 first (lifecycle states unblock everything) → M2+M3+M4 atomic batch (`email_log` schema in one txn so send-path is never half-migrated) → M5+M5b atomic batch (suppressions table + normalization function + recovery RPC) → M6 (`users` columns) → M7 (template CHECK constraint, after CONTENT picks heartcry triage canonical string).

**Founder questions DBA surfaced (still open):**
1. `account_frozen_at` + `account_freeze_reason` block outbound email at sendEmail() guard layer. Should they ALSO block in-app actions (read-only mode, forced sign-out, full disable), or is "frozen = email blackout only, in-app continues normally" the MVP read? AUTH lane co-owns this question.
2. Underground compromise-freeze — reversible by the leader through in-app path (similar to email-change suppression clear), or admin-only reversal? Affects whether `account_freeze_reason` needs a leader-clearable RPC.
3. Three live template strings (`pastoral_signal_digest_t2`, `pastoral_signal_alert_t1`, `heartcry_triage_notification`) — in-scope for modernization (keep + route through `sendEmail()`), or being decommissioned alongside KAN-271 bundle? DBA needs the answer to decide CHECK lock posture.

**DBA observations downstream lanes should know:**
- Live `email_log` = 49 rows, 80 kB. All current rows `outcome='sent'`. M1 CHECK rewrite breaks nothing.
- FK `email_log.user_id → users(id)` is `ON DELETE NO ACTION` (verified live). Correct; keep. With M4's nullable `user_id`, sentinel pattern is no longer load-bearing.
- The legacy `email_log_dedup` UNIQUE migration into a partial is a single migration; partial-on-`idempotency_key IS NULL` is the right replacement.
- `idempotency_key` MUST be namespaced by caller (BE enforces format convention). DBA-locked single-column UNIQUE — if a caller forgets to namespace, collision possible.
- `suppressed_rate_limit` outcome value exists in live CHECK; whatever path emits it (probably pastoral signal digest) stays. Rate-limiting belongs at BE/OPS, not schema.
- The webhook handler is the only path that mutates `email_log` post-send — terminal-state enforcement is BE-side (no DB trigger).

---

### SEC — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings that constrain downstream lanes:**

1. **CRITICAL: Template identifier opacity.** Identifiers like `welcome_underground_pending`, `heartcry_triage_ping`, `heartcry_acknowledged` leak member-class semantics into (a) the Resend third-party dashboard and (b) any future read of `email_log.template`. Per [[feedback-underground-protection-focus]] — protect at the architecture layer.
   
   **Required:** map all underground-class + heartcry-class identifiers to opaque outbound tags. Internal `EmailKind` keeps semantic names (used only in BE code constants). The value sent to Resend's `tags` field AND the value stored in `email_log.template` is the opaque tag (e.g., `welcome_underground_pending` → `welcome_t8`, `heartcry_triage_ping` → `notify_t21`, `heartcry_acknowledged` → `notify_t19`). Map lives in `_lib/email-tags.ts` mirrored across Deno + Node. SEC also recommends folding `heartcry_triage_notification` (live), `pastoral_signal_digest_t2`, `pastoral_signal_alert_t1` into the opaque tag map.
   
   **BE refusal check:** reject `email_log` insert where `template` or `idempotency_key` matches `/underground|heartcry/i` — belt-and-braces against careless adds.

2. **HIGH: `idempotency_key` two-tier storage** (standard plaintext / underground-class hashed). Standard rows keep namespaced plaintext for collision-avoidance + ops debuggability. Underground-class or rows with templates in `{welcome_underground_pending, heartcry_triage_ping, heartcry_acknowledged, branch_invite_stale-when-invitee-underground, coleader_departed-when-church-underground}` store `'h:' || sha256(plaintext_key)` instead. BE-side helper computes; idempotency check hashes the candidate before SELECT.

3. **HIGH: Webhook signature verification + replay protection** (new migration M5c, sibling to M5):
   ```sql
   CREATE TABLE public.webhook_events_processed (
     provider text NOT NULL,                  -- 'resend'
     event_id text NOT NULL,
     received_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (provider, event_id)
   );
   ALTER TABLE public.webhook_events_processed ENABLE ROW LEVEL SECURITY;
   CREATE POLICY webhook_events_service_only ON public.webhook_events_processed
     USING (auth.role() = 'service_role');
   -- TTL: nightly cron sweep > 14 days.
   ```
   
   **Handler flow:** (1) read `Resend-Signature` + `Resend-Timestamp`; missing → 401, NO audit (don't audit attacker probes). (2) reject `|now - timestamp| > 5min` → 401. (3) HMAC-SHA256 over `timestamp || '.' || body` against Vault `resend_webhook_signing_secret`; constant-time compare via existing `timingSafeEqualStrings` from `supabase/functions/send-message/internal-auth.ts` (REUSE — do not re-roll); mismatch → 401 + audit_log `'webhook_signature_invalid'` ONLY if signature header present-but-wrong (distinguishes probe from active attack). (4) INSERT into `webhook_events_processed`; ON CONFLICT → 200 no-op (replay-safe; Resend stops retrying). (5) THEN process the event.

4. **HIGH: Vault posture per runtime.**
   - **Deno (Supabase edge):** `adminClient.rpc('get_resend_api_key')` — mirror the live `submit-heartcry/index.ts` pattern exactly. Cached per isolate.
   - **Node (Netlify admin):** `process.env.RESEND_API_KEY` with the env var flagged "Sensitive." Round-tripping through Supabase RPC on every Netlify send adds latency + second-failure surface; SEC accepts env var path at MVP. The 2026-06-14 leak ([[feedback-dont-pull-netlify-env-vars-via-mcp]]) was procedural, not architectural.
   - **Webhook signing secret:** Deno-only Vault (`resend_webhook_signing_secret`); Node never needs it.
   - **Rotation:** 90 days OR on suspected compromise. Runbook lives at `docs/ops/OPS-RESEND-rotation.md` (parallels OPS-03). OPS authors; SEC reviews.
   - **Belt-and-braces:** BE adds boot-time check — if the API key doesn't start with `re_` (Resend's known prefix), refuse to send + Sentry alert. Catches misrotation swapping in placeholder.

5. **HIGH: DBA's `severity='underground'` literal at rest is itself a tell** (`pg_dump`, S3 backup leak, junior DBA local clone). RLS doesn't protect at-rest.
   
   **Required schema deltas (DBA migration M5 amendment + audit-action rename):**
   - `email_suppressions.severity` values: `'standard'` → `'s1'`, `'underground'` → `'s2'`. Meaning lives in code constants (`SEVERITY_UNDERGROUND = 's2'`).
   - Audit_log action: `underground_email_freeze_applied` → `account_freeze_applied` with `meta.reason_code = 'r_uc'` (underground-compromise = `r_uc`); add mirror `account_freeze_cleared`.
   - Code book lives at `docs/sec/sec-reason-codes.md` (internal).
   - Post-MVP: pgsodium-encrypt the `severity`/`reason` columns + `meta` if Founder wants belt-and-braces at-rest encryption (file ticket; not MVP-gating).

6. **HIGH: Compromise-suspected freeze = FULL-LOCKDOWN, not email-blackout-only** (DBA Founder Q1 — SEC owns the threat-model recommendation; AUTH implements):
   - On freeze: invalidate ALL refresh tokens (`auth.admin.signOut(user_id, 'global')`).
   - `users.account_freeze_reason IS NOT NULL` → RootNavigator gate forces re-auth flow that does NOT use email channel (TOTP-style verification via in-app push to known device, OR admin-mediated clear via UG Inbox — Founder picks policy).
   - In-app read-only mode: no posts to Connect, no heartcry submit, no profile edit, no email change, no church-leave — READ access continues so the leader sees the "we've flagged this account; reach us via [channel]" banner.
   - **Underground freeze reversal: admin-only via UG Inbox.** NOT leader-clearable — the whole point is that the channel we'd verify against IS the compromised one. (DBA Founder Q2 — SEC owns.)
   - Surface (non-underground) freeze reversal: leader clears via in-app email-change flow → DBA's M5b RPC clears suppression → freeze auto-lifts. OR admin-cleared.

7. **HIGH: Add `email_log.triggered_by uuid NULL REFERENCES users(id)` for admin-class forensics** (DBA M2 addendum). DBA's nullable-`user_id` admin-notify pattern is schema-clean but loses actor attribution. `<flag_id>` in the namespaced idempotency_key is the bridge to `audit_log` which has the actor — but the convention must be enforced. Contract rule: if `userId` (subject) is NULL, `triggeredBy` is REQUIRED for admin-class templates. Same partial-RLS service-role-only.

8. **MEDIUM: `email_suppressions.meta jsonb` needs explicit allow-list + BE validator.**
   - **Allowed:** `bounce_type` (`'hard'|'soft'|'transient'`), `smtp_code` (int), `resend_event_id` (text — matches `webhook_events_processed`), `source` (`'webhook'|'admin_manual'|'compromise_signal'`).
   - **Forbidden:** any IP / geo / user-agent / message body / subject content / leader identity beyond existing `associated_user_id` column.
   - Documented at `docs/sec/email-suppressions-meta-schema.md`. BE-side validator rejects + Sentry-alerts on disallowed keys.

9. **MEDIUM: Audit-log breadcrumb naming + meta** (final lock):
   - `email_suppression_added` → meta `{reason: 's_hard'|'s_soft'|'s_complaint'|'s_uc'|'s_manual', severity_code: 's1'|'s2', via: 'webhook'|'admin'|'system'}`. NO email address in meta; suppression row holds it; reference via `meta.suppression_id`.
   - `email_suppression_cleared` → meta `{suppression_id, cleared_via: 'email_change'|'admin_clear'}`. NO old/new email in audit_meta (PII bleeds into append-only forever).
   - `account_freeze_applied` (renamed from `underground_email_freeze_applied`) → meta `{reason_code: 'r_uc'|'r_admin', triggered_by_event_type: 'complaint'|'hard_bounce'|'admin_manual'}`.
   - `account_freeze_cleared` (mirror).
   - **Do NOT add** `email_bounce_observed` / `email_complaint_observed` as audit_log actions — those are operational telemetry, not governance. They live in `email_log.outcome` updates + optionally an `email_events_observed` ops table OPS owns. Audit_log = governance trail only per [[feedback-audit-log-append-only]].

10. **MEDIUM: Status-divergence reconciler (security requirement, not OPS nicety).** If `verification_rejected` dead-letters AND the leader never opens the app, system believes "rejected" while leader believes "pending" — for a hostile actor account that buys time admin doesn't know they're giving. Daily cron `email-dead-letter-reconcile` compares `users.verification_status` transitions (last 7 days) against `email_log` outcomes. Any user whose status changed AND whose latest matching email row is `failed`/`hard_bounced`/`dead_letter` + no manual override → daily digest to `accounts@` for human follow-up. NOT a fire-and-forget violation — this is the out-of-band reconciler safety net. OPS implements; SEC mandates.

11. **MEDIUM: KAN-31 c.10013 fire-and-forget ruling re-confirmed.** Unchanged. Caller transaction does NOT roll back on email failure; in-app surface is truth. Reconciler from Finding 10 is safety net, not contract change.

12. **LOW: Webhook URL `https://<project>.supabase.co/functions/v1/resend-webhook`** — minor information disclosure. Vanity-domain proxy is real work for marginal benefit. Accept Supabase URL at MVP; post-MVP ticket: vanity proxy `https://hooks.projectreplant.org/resend`.

13. **LOW: Resend dashboard PII retention** — recipient email + subject are unavoidable in Resend's hands. Mitigation: generic subjects + opaque template tags for underground/heartcry (Finding 1 covers tags; CONTENT owns subject lines, SEC anchors that subjects pass "if Resend staff member read this, what could they infer" test).

**SEC raised Founder questions (5):**
1. Compromise-suspected freeze = FULL-LOCKDOWN (forced sign-out + re-auth via non-email channel + read-only mode)? SEC strongly recommends yes.
2. Underground freeze reversal = admin-only via UG Inbox, NOT leader-clearable? SEC strongly recommends yes.
3. Resend dashboard retains recipient email + subject — acknowledged-and-accepted at MVP as third-party ESP cost?
4. Generic outbound tag opacity at Resend dashboard AND `email_log.template` — approve, or keep full semantic transparency in our own DB?
5. Vanity webhook domain — defer to post-MVP, use bare Supabase URL at launch — confirm.

**SEC observations downstream lanes should know:**
- `submit-heartcry/index.ts`'s `adminClient.rpc('get_resend_api_key')` is the load-bearing Deno Vault reference — new sendEmail Deno helper mirrors exactly.
- `_shared/mint-test-jwt.ts` uses `crypto.subtle.sign('HMAC', ...)` — reuse for webhook signature verification.
- `send-message/internal-auth.ts` provides `timingSafeEqualStrings` — reuse for constant-time signature compare.
- Underground recovery deliberately does NOT go through email channel (compromised channel = the verification target).
- "Fire-and-forget + reconciler" is the right shape for any future critical out-of-band channel (push, SMS, postal). File pattern as Replant doctrine doc once email infra lands.
- The three live template strings (`heartcry_triage_notification`, `pastoral_signal_digest_t2`, `pastoral_signal_alert_t1`) should fold into the opaque tag map alongside the proposed enum — coordinate with CONTENT/OPS on final code values.

**Schema impact (added to DBA's migration set):**
- **M2 addendum:** `email_log.triggered_by uuid NULL REFERENCES users(id)`.
- **M5 amendment:** `severity` values opaque (`s1`/`s2`).
- **M5c (NEW):** `webhook_events_processed` table.
- **Audit-action set:** `email_suppression_added`, `email_suppression_cleared`, `account_freeze_applied` (NOT `underground_*`), `account_freeze_cleared`, `webhook_signature_invalid`.

---

### AUTH — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings that constrain downstream lanes:**

1. **CRITICAL: KAN-198 OTP routes to email-on-file, NOT user-typed email.** If a leader recovers from a stale/hostile email, accepting the typed email as OTP destination IS the takeover. Server resolves user_id from typed email → sends OTP to the `public.users.email` value for that row. UI shows masked confirmation ("we sent a code to r•••@g••••.com"). **Constant-time miss response**: if typed email doesn't match a user, sleep to median observed latency and return identical response shape to defeat enumeration. NEVER 4xx differently. Audit `password_reset_otp_requested` regardless of hit (meta: `{hit: bool, ip_class: 'masked'}`).

2. **CRITICAL: OTP spec locked.** 6-digit numeric, leading zeros preserved, TTL **10 minutes** (balance for slow networks in restricted regions). Hashed at rest (bcrypt or sha256+pepper from Vault — never plaintext). One-time use via `SELECT ... FOR UPDATE` atomic claim. Rate limit **3 requests / email / hour + 10 / IP / hour**. **5 failed attempts → 15-min lockout** + mark `consumed_at=now()` with `outcome='locked_out'` + force new OTP request. **New DBA table** (sibling to M5):
   ```sql
   CREATE TABLE public.password_reset_otps (
     id uuid PK default gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id),
     otp_hash text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     expires_at timestamptz NOT NULL,
     consumed_at timestamptz NULL,
     attempt_count integer NOT NULL DEFAULT 0,
     outcome text NOT NULL DEFAULT 'pending'
       CHECK (outcome IN ('pending','consumed','expired','locked_out','account_freeze_blocked','broken_channel_blocked')),
     request_ip_class text NULL  -- masked IP class for rate-limit + audit
   );
   ```
   AUTH owes a parallel `email_change_otps` table (DO NOT share schema with password_reset_otps — different lifecycles, different blast radii).

3. **HIGH: `account_freeze_reason IS NOT NULL` blocks OTP issuance.** Whole point of freeze is "we don't trust the email channel." Allowing OTP defeats the lockdown. Generic constant-time response (no enumeration), audit `password_reset_otp_blocked_frozen` (meta `{reason_code: 'r_uc'|'r_admin'}`). In-app banner tells frozen leader password reset is admin-mediated until freeze clears.

4. **HIGH: Underground freeze recovery at MVP = admin-mediated UG Inbox ONLY.** Replant has NO leader-side TOTP today; building "TOTP-setup-on-first-freeze" is a 2-week rabbit hole AND the device the leader is using when frozen can't be trusted to enroll TOTP anyway. **Honest path:** static read-only banner with contact channel; admin opens UG Inbox; two-eyes confirmation (per verified-queue pattern); clear freeze via new `clear_account_freeze(p_user_id uuid)` SECURITY DEFINER RPC (DBA owes — callable only by super_admin OR is_underground_admin per [[reference-highest-tier-admins]]). Writes `account_freeze_cleared` audit per SEC Finding 9. Post-MVP: leader-side TOTP gets its own sprint with admin tiered-MFA work.

5. **HIGH: Email source-of-truth = `public.users.email`.** Trigger keeps `auth.users.email` in sync, NOT the reverse. Canonical write surface = `public.users.email`. Trigger on `public.users` UPDATE mirrors new email into `auth.users` via SECURITY DEFINER function with `auth_admin` grant (Supabase supports this). Reverse-direction sync (auth → public) is FORBIDDEN. Admin-class email changes route through `public.users` path so audit + suppression-clear + Resend tags fire correctly. sendEmail() resolves recipient via `SELECT email FROM public.users WHERE id=$1` — NEVER joins `auth.users` for email. DBA owes the trigger function (M5b sibling).

6. **HIGH: Email change flow gets TWO new templates + 24h cooldown** (closes DBA M5b attacker-loop):
   - Today's gap: attacker with authenticated session changes email to their own → suppression clears → future sends route to attacker.
   - **New `email_change_verify_new`** — sent to the NEW address, OTP-based, 15-min TTL. Email change does NOT commit until new-address OTP is verified.
   - **New `email_change_notify_old`** — sent to OLD address: "your email is being changed to f••••@g••••.com — if this wasn't you, log in and revert + reach `accounts@`."
   - **24h cooldown** before suppression-clear RPC fires post-commit, giving legit owner a window to scream.
   - **~18 → ~20 surface count.** BA backfill required.
   - **New DBA columns (M6 addendum):** `users.email_change_pending_at` + `users.email_change_pending_new_email`. Pending state surfaces NO in-app banner to logged-in user (don't tip the attacker who's already in) — old-email notification IS the alarm.
   - DBA `clear_email_suppression_for_change` RPC adds `committed_at + interval '24h' <= now()` guard.

7. **HIGH: New `'frozen'` AuthBranch + RLS-side `account_freeze_reason IS NULL` predicate on EVERY write-class policy.** `auth.admin.signOut(user_id, 'global')` invalidates refresh tokens server-side but in-flight access tokens stay valid until natural expiry (≤60min Supabase default). Two-layer defense:
   - **RLS-side:** add `account_freeze_reason IS NULL` predicate to write-class RLS on `messages`, `branch_messages`, `prayer_wall_posts`, `heartcry_submissions`, `churches` (leader's own row), `users` (for email-change). Read-class policies stay open so the read-only banner surfaces. DBA M6 addendum + SEC ratifies RLS column-list.
   - **FE-side:** RootNavigator renders a full-screen read-only overlay swallowing all interaction when `accountFreezeReason` is set. Existing 30s debounce + AppState=active re-check means worst case 30s of stale state.

8. **HIGH: `auth-status-check` returns 200 for frozen accounts (not 401).** Frozen account is technically authenticated (leader needs to SEE the banner). Extend `AuthStatusResponse` with `account_freeze_reason?: string` field. When non-null, FE maps to new `'frozen'` AuthBranch, **set BEFORE evaluating `data.verification_status`** — freeze is highest-priority state.

9. **MEDIUM: `users.email_channel_status='broken'` pre-empts OTP mint pre-issuance** (not via suppression check). For `bouncing` (soft midway), still mint — soft can flip back. For `broken`, generic constant-time response (no enumeration). In-app Settings → Edit Email surfaces "your email is bouncing" badge when status != 'ok'.

10. **MEDIUM: `password_reset_admin` keeps Supabase action-link path.** Different surface from leader OTP — deeper trust. sendEmail() wraps the Supabase-generated action link from `auth.admin.generateLink({type: 'recovery'})`. SAME suppression check + email_channel_status check applies. SAME idempotency on `${template}:${admin_user_id}:${UTC-day}`. Admin-class so `triggered_by` (SEC Finding 7) is REQUIRED. Refactors `_lib/admin-invite-email.js::buildPasswordResetEmail` to route through new contract.

11. **MEDIUM: `verification_request_info` reply-via-email = trust FROM header at MVP, paste-only.** Do NOT attempt server-side validation that reply's FROM matches registered address (SPF/DKIM/DMARC alignment for non-Replant inbound domains is unreliable + admin two-eyes provides human verification + leader can spoof their own reply trivially anyway). Admin treats incoming email content as untrusted user input. Post-MVP: in-app verification inbox eliminates email-reply path. CONTENT lock: email body must say "Reply to this email" — flag for OPS to configure `connect@` inbound routing.

12. **MEDIUM: `coleader_departed` triggers auth state change for sole founding leader** (esp. underground → new `underground_join_code_pending_reveal` AuthStatusResponse field). The leave RPC must bump auth-cache invalidation so the next `auth-status-check` reflects the new CapabilityProfile. BE confirms 30s AppState handler already covers this.

13. **MEDIUM: `triggered_by` is caller-vouched, NEVER auto-filled from session.** AAL2 enforcement lives at the admin function gate, NOT inside sendEmail(). sendEmail() trusts caller-vouched `triggered_by`. Document in contract.

14. **LOW: 60-day backwards-compat window for old PKCE deep-link.** Older unsent reset emails carry PKCE deep-link tokens; AuthProvider needs to keep handling them gracefully for 60 days (max practical OTP expiry from stale email) before deprecating. Keep `password_recovery` AuthBranch + SetNewPasswordScreen for 60 days post-OTP launch; one-time "this link has expired" UX path. After 60-day window, remove handler + branch. **File calendar reminder, not just TODO comment.** Persecuted leaders who don't check email often are exactly the profile this serves.

**AUTH raised Founder questions (5):**
1. Surface freeze posture — leader-clearable via in-app email change WITH 24h cooldown after new-email OTP verification? Underground = admin-only (locked). Surface = leader-clearable. Confirm.
2. PASSWORD_RECOVERY 60-day backwards-compat window — acceptable, shorter, or longer?
3. `email_change_notify_old` template — industry-standard belt-and-braces against session-hijack-to-email-change attacks. Confirm we ship it (adds 1 template to count).
4. OTP TTL 10 minutes — confirm vs 5min (too tight for slow networks) or 30min (too loose)?
5. Extend SEC Finding 1 opacity rule to Family 4 password-reset templates? AUTH proposes `auth_t17` etc. — "account in distress" signal worth not advertising even for surface.

**Schema deltas added by AUTH:**
- **NEW table:** `password_reset_otps` (sibling to M5).
- **NEW table:** `email_change_otps` (separate from password_reset_otps — different lifecycles).
- **M6 addendum:** `users.email_change_pending_at` + `users.email_change_pending_new_email` + RLS predicate `account_freeze_reason IS NULL` on write-class policies for `messages`, `branch_messages`, `prayer_wall_posts`, `heartcry_submissions`, `churches`, `users`.
- **M5b addendum:** sync trigger `public.users.email → auth.users.email` (SECURITY DEFINER, one-way).
- **M5b addendum:** `clear_email_suppression_for_change` RPC adds `committed_at + 24h` cooldown guard.
- **NEW RPC:** `clear_account_freeze(p_user_id uuid)` SECURITY DEFINER, super_admin OR is_underground_admin only.
- **Audit-action additions:** `password_reset_otp_requested`, `password_reset_otp_blocked_frozen`, `password_reset_otp_blocked_broken_channel`.

**Template additions (~18 → ~20):**
- `email_change_verify_new`
- `email_change_notify_old`

**AUTH observations downstream lanes should know:**
- Resend webhook endpoint MUST be `verify_jwt=false` per [[project-replant-invariants]] — signature replaces JWT. Add to invariants table with reason.
- OTP path lives ENTIRELY outside authenticated session lifecycle (ForgotPasswordScreen → OtpEntryScreen → SetNewPasswordScreen → Login). AuthProvider stays clean. Preserve.
- `auth.admin.signOut(user_id, 'global')` scheduled AFTER freeze row committed and BEFORE `account_freeze_applied` audit row so audit reflects final state. Cross-runtime ordering matters; BE locks the sequence.
- The 30s stale-state window after RLS-side belt is read-only-stale, not exploit-stale.
- AAL2 enforcement stays at admin function gate layer, not inside sendEmail().

---

### BE — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings that constrain downstream lanes:**

1. **CRITICAL: sendEmail() splits into two-phase contract — `claim()` + `dispatch()`.** Single-call shape breaks DBA Finding 6 (INSERT inside caller txn; POST after commit). PG LISTEN/NOTIFY adds worker dep; internal queue defeats fire-and-forget locality. The clean shape is two-method module:
   ```ts
   // Phase A — INSIDE caller's txn; caller passes client bound to same txn
   email.claim(client, args): Promise<
     | { status: 'claimed'; logId: string }
     | { status: 'duplicate'; logId: string; resendId: string | null }
     | { status: 'suppressed'; reason: 'address_suppressed' | 'channel_broken' | 'account_frozen' }
   >
   // Phase B — AFTER caller commits; POSTs to Resend, UPDATEs row
   email.dispatch(logId, args): Promise<SendResult>
   // Convenience for non-transactional callers (most admin Netlify):
   email.send(args): claim() + dispatch() against service-role client; NO caller txn
   ```
   Document loudly that `send()` is for non-transactional contexts only.

2. **CRITICAL: Pastoral retry is OUT-OF-PROCESS** (Deno edge functions cap at ~60s wall-clock; pastoral profile = 5s + 30s + 5min = ~6min total). New DBA table sibling to M5:
   ```sql
   CREATE TABLE public.email_retry_queue (
     id uuid PK default gen_random_uuid(),
     email_log_id uuid NOT NULL REFERENCES email_log(id),
     attempt integer NOT NULL DEFAULT 0,
     next_attempt_at timestamptz NOT NULL,
     payload jsonb NOT NULL,
     last_error text NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE INDEX email_retry_queue_due ON email_retry_queue(next_attempt_at);
   ```
   `standard` = in-process single retry 5s (~10s total). `pastoral` first attempt in-process; on 5xx → INSERT `email_retry_queue` with `next_attempt_at=now()+5s`, function returns `{outcome:'queued_for_retry'}`. New edge function `email-retry-worker` runs on pg_cron every 60s — claims via `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 25`, re-POSTs, schedules next attempt or dead-letters. OPS owns cron schedule + dead-letter alerting.

3. **CRITICAL: Cron sends are edge functions, NOT PL/pgSQL** (PL/pgSQL can't hold Resend key cleanly, can't do `fetch()`/backoff). Two new edge functions:
   - `email-cron-verification-reminders` — sweeps users for `verification_reminder_7d` + `verification_reminder_1d` candidates.
   - `email-cron-branch-invite-stale` — sweeps branch_invites for 24–48h stale rows.
   
   pg_cron schedules `pg_net.http_post` to each function URL with service-role JWT every 6h. Function sweeps candidates → `email.claim()` (UNIQUE on `idempotency_key` is atomic claim — winner `claimed`, loser `duplicate` and skips) → `email.dispatch()`.

4. **HIGH: Contract surface locked** (incorporates SEC + BA + AUTH):
   ```ts
   type EmailKind = /* internal semantic names — NEVER sent to Resend */ ...;
   type RetryProfile = 'standard' | 'pastoral';
   type SendResult =
     | { success: true; resendId: string; outcome: 'sent' | 'queued_for_retry' }
     | { success: false; outcome: 'suppressed'|'frozen'|'broken_channel'|'misconfigured'|'dead_lettered'; reason: string };

   interface ClaimArgs {
     template: EmailKind;
     to: string;                              // recipient address; see Finding 8 re: resolution
     variables: Record<string, unknown>;
     logUserId: string | null;                // email_log.user_id; NULL for admin-notify
     dedupSubjectId?: string;                 // defaults to logUserId
     idempotencyKey?: string;                 // namespaced; mandatory for cron + admin-notify
     triggeredBy?: string;                    // REQUIRED when logUserId is null AND template is admin-class
     retryProfile?: RetryProfile;             // defaults 'standard'
   }
   ```
   `meta` field DROPPED from contract — PII discipline. Resend bounce payloads land via separate `recordWebhookEvent()` call, not the send path.

5. **HIGH: Opaque tag map = hand-mirrored vendored JSON + CI equality test.**
   - Canonical: `/Users/ife/replant/docs/architecture/email-tag-map.json` (single source).
   - Both Deno and Node modules import `tag-map.ts/.js` that hard-codes the map.
   - CI test in each repo loads the JSON, asserts strict equality with code-side constant. Diverge → CI red.
   - Map changes require coordinated 2-PR commit (replant + replant-admin).

6. **HIGH: Idempotency-key validator** — `email.claim()` entrypoint rejects malformed keys via prefix check:
   ```
   if (UNDERGROUND_CLASS_TEMPLATES.has(template)) {
     // Hash mode — caller passes plaintext; helper computes 'h:'+sha256(plaintext)
     assertStartsWith(plaintextKey, template);  // validate BEFORE hashing
     storedKey = 'h:' + sha256(plaintextKey);
   } else {
     assertStartsWith(idempotencyKey, template);
     storedKey = idempotencyKey;
   }
   ```
   Throw `EmailContractError` (new type) — distinct from Resend/network failures.

7. **HIGH: Webhook handler — concrete outline; underground determination via tag-set, NOT users join.**
   ```
   1. Verify Resend-Signature + Resend-Timestamp; missing → 401 NO audit.
   2. Reject |now - ts| > 5min → 401.
   3. HMAC-SHA256 over `${tsHeader}.${body}` against Vault signing secret; constant-time compare via timingSafeEqualStrings. Mismatch → audit 'webhook_signature_invalid' + 401.
   4. INSERT webhook_events_processed (provider='resend', event_id=email_id+':'+type) ON CONFLICT DO NOTHING. Replay → 200 no-op.
   5. Resolve email_log row via resend_id (UNIQUE per DBA M3). Backoff 500ms/2s/10s for not-yet-visible INSERT. After 3 misses → INSERT webhook_orphaned_events row (NEW table OPS monitors); do NOT 5xx Resend.
   6. isUndergroundClass = UNDERGROUND_CLASS_TEMPLATES.has(emailLog.template)  // tag-side check
   7. Switch event.type:
      - email.delivered → UPDATE email_log outcome='delivered'
      - email.bounced (hard) → UPDATE outcome='hard_bounced'; INSERT email_suppressions (severity = isUndergroundClass ? 's2' : 's1'); UPDATE users.email_channel_status='broken' WHERE id=emailLog.user_id; audit 'email_suppression_added'
      - email.bounced (soft) → UPDATE outcome='soft_bounced'; UPSERT email_suppressions (++observation_count); if observation_count ≥ 3 in 24h → escalate to hard path
      - email.complained → UPDATE outcome='complained'; INSERT email_suppressions (reason='complaint', severity); if isUndergroundClass → applyAccountFreeze(emailLog.user_id, 'r_uc')
      - email.sent → UPDATE outcome='sent' IF outcome='queued' (idempotent)
   8. Return 200.
   ```
   **`applyAccountFreeze(userId, reasonCode)` SECURITY DEFINER RPC** (DBA owes): atomic txn — UPDATE users.account_freeze_reason + account_frozen_at → call `auth.admin.signOut(userId, 'global')` from edge function AFTER RPC commits → audit 'account_freeze_applied'. signOut failure: leave freeze applied, Sentry alert, OPS daily reconciler verifies refresh-token state. Do NOT roll back freeze.

8. **HIGH: Recipient resolution rule.** Caller-provided `to` is trusted IF `logUserId` is null (admin-notify); re-resolved from `public.users.email` IF `logUserId` is set.
   ```
   const resolvedTo = args.logUserId
     ? await client.from('users').select('email').eq('id', args.logUserId).single().then(r => r.data.email)
     : args.to;
   if (args.logUserId && resolvedTo !== args.to) { /* Sentry warning, use resolved */ }
   if (logUserId && resolvedTo NULL) → return { success:false, outcome:'broken_channel' }
   ```

9. **HIGH: Boot-time API key prefix check fails CLOSED (soft refuse), not OPEN (throw).** Throwing kills isolate and crashes caller txn (fire-and-forget violated). Module-level `_emailModuleHealth` flag; sendEmail short-circuits return `{success:false, outcome:'misconfigured'}` if not `'ok'`. Sentry alert on transition to `'misconfigured'`. Both runtimes check `re_` prefix; also check `sb_secret_*` prefix per [[feedback-supabase-new-api-keys-migration]].

10. **HIGH: 4 Supabase function migrations (sequence locked):**
    - **PR1 — `submit-heartcry/index.ts`** (lowest risk, biggest prod volume — validates contract at scale). Replace inline POST (line 179) with `email.send({template: 'heartcry_triage_ping', logUserId: null, triggeredBy: heartcryAuthorUserId, idempotencyKey: 'heartcry_triage_ping:'+heartcryId, retryProfile: 'standard'})`. Heartcry stays standard per BA Finding 6.
    - **PR2 — `join-underground-church/index.ts`** (low risk). Replace line 264 with `email.send({...})`.
    - **PR3 — `create-account/index.ts`** (medium risk — atomic-txn surgery). `email.claim()` MOVES INSIDE atomic txn at Step 5; `email.dispatch()` after commit. Variables map per template (`welcome_skip`/`welcome_pending_church`/`welcome_verified_church`/`welcome_underground_pending`).
    - **PR4 — `send-message/index.ts`** (HELD pending CONTENT ruling on `pastoral_signal_alert_t1` / `pastoral_signal_digest_t2`).

11. **HIGH: 6+ admin Netlify migrations (sequence locked):**
    - PR-A: `_lib/email/` module ships + `escalate-flag.js` migrates (lowest risk).
    - PR-B: `join-welcome.js` + `volunteer-welcome.js` (Family 1; coordinate with CD redesign landing).
    - PR-C: `invite-admin.js` + `grant-admin.js` (Family 6 live templates).
    - PR-D: `send-password-reset.js` (highest risk — admin auth; coordinate with KAN-198 OTP work).
    - PR-E: `_lib/underground-notify.js` (UG Inbox path).
    - PR-F: retire `_lib/admin-invite-email.js`.
    
    Existing `buildShell()` HTML helper REPLACED, not extended.

12. **MEDIUM: Refresh-token sequencing on freeze** — freeze write BEFORE signOut, signOut failure does NOT roll back freeze. Sentry alert routes to OPS; daily reconciler verifies frozen accounts have no live refresh tokens.

13. **MEDIUM: Test matrix locked.**
    - **Unit (Deno + Node parallel):** idempotency-key validator (plaintext + hash), opaque-tag mapping equality, retry profile selection, suppression short-circuit, recipient resolution.
    - **Integration (Deno-side, local Supabase):** UNIQUE conflict path, webhook signature pass/fail, replay-protection, retry-queue SKIP LOCKED.
    - **E2E (Resend simulator):** real send to Founder test account → Resend dashboard → webhook fires → email_log lifecycle transitions. Bounce via `bounce@simulator.resend.com`; complaint via `complaint@simulator.resend.com`.
    - **Soak:** 100-rps burst at `email-retry-worker` to verify SKIP LOCKED prevents double-claim.

14. **MEDIUM: Module layout locked** (full tree):
    ```
    /Users/ife/replant/supabase/functions/_shared/email/
      ├── sendEmail.ts       # claim()/dispatch()/send()
      ├── templates.ts       # EmailKind + variable type maps + tag-map import
      ├── tag-map.ts         # imports email-tag-map.json (vendored)
      ├── tag-map.json       # vendored from /docs/architecture/email-tag-map.json
      ├── retry.ts           # in-process retry (standard)
      ├── suppression.ts     # email_suppressions lookup + UPSERT
      ├── webhook-verify.ts  # HMAC + replay (reused by resend-webhook)
      ├── types.ts           # SendResult, ClaimArgs, EmailContractError
      └── sendEmail.test.ts

    /Users/ife/replant/supabase/functions/{resend-webhook, email-retry-worker, email-cron-verification-reminders, email-cron-branch-invite-stale}/

    /Users/ife/replant-admin/netlify/functions/_lib/email/
      └── (mirror Deno layout — sendEmail.js, templates.js, tag-map.{js,json}, retry.js, etc.)

    /Users/ife/replant/docs/architecture/
      ├── sendEmail-contract.md  # SOURCE OF TRUTH
      └── email-tag-map.json     # CANONICAL OPAQUE TAG MAP
    ```

15. **LOW: `email_log.attempt_count integer NOT NULL DEFAULT 0`** (DBA M2 addendum). Retry worker reads/increments. Dead-letter threshold = 4 attempts for `pastoral`, 2 for `standard`.

**BE raised Founder questions (5):**
1. Pastoral retry as out-of-process worker adds `email-retry-worker` edge function + `email_retry_queue` table. BE recommends accepting (cleaner, survives function deploys mid-retry).
2. Resend webhook URL at MVP = bare `<project>.supabase.co/functions/v1/resend-webhook` — confirm.
3. Two separate cron functions (`email-cron-verification-reminders` + `email-cron-branch-invite-stale`) vs one consolidated `email-cron-sweep`? BE recommends separate (independent failure domains).
4. CI equality test for tag-map across two repos at MVP — manual coordination, or lightweight GitHub Action diff against canonical? BE recommends manual at MVP.
5. `send-message/index.ts` migration deferred to follow-on PR until CONTENT lands on `pastoral_signal_*`? BE recommends defer (unblocks 3 of 4 Deno migrations now).

**Schema deltas added by BE:**
- **NEW table:** `email_retry_queue` (M5 sibling).
- **NEW table:** `webhook_orphaned_events`.
- **NEW SECURITY DEFINER RPC:** `applyAccountFreeze(userId, reasonCode)`.
- **M2 addendum:** `email_log.attempt_count integer NOT NULL DEFAULT 0`.

**BE observations downstream lanes should know:**
- `submit-heartcry/index.ts` is the closest existing template for Deno `email.send()` shape — mirror exactly (Vault-resolved key cached per-isolate, single POST, `email_log` write).
- `_lib/admin-invite-email.js::buildShell()` REPLACED, not extended (drift risk across runtimes).
- `crypto.subtle.sign('HMAC', ...)` reuse for webhook signature (Deno Web Crypto API).
- Node-side HMAC: `node:crypto.createHmac('sha256', secret).update(...).digest('hex')`.
- Deploy posture: webhook + cron + retry-worker edge functions all need `verify_jwt=false` in config.toml AND `--no-verify-jwt` at deploy time per [[feedback-supabase-cli-verify-jwt]] CLI 2.95.4 quirk.
- pg_cron may overlap rare invocations; `SKIP LOCKED` prevents double-dispatch.
- Resend simulator addresses (`bounce@simulator.resend.com`, `complaint@simulator.resend.com`) used for webhook E2E.
- `EmailContractError` distinguishes malformed-key (caller bug, throws) from Resend 5xx (returns `{success:false}`).
- `send-message/index.ts` legacy `outcome='failed_resend_emit'` stays in lifecycle CHECK per DBA Finding 1.

---

### OPS — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings:**

1. **CRITICAL: Resend dashboard pre-deploy checklist MUST land before any code.** Without it, every BE PR1 send succeeds but every webhook event silently fails signature verification → rows stuck at `outcome='sent'` while team thinks fine. File `docs/ops/OPS-RESEND-dashboard-checklist.md`:
   - (1) Verify domain `projectreplant.org` DKIM/SPF/DMARC with sender `connect@projectreplant.org`.
   - (2) Confirm reply-to routing — `connect@` is Google Workspace; Resend sets Reply-To on outbound; verify reply lands in Workspace inbox.
   - (3) Register webhook URL `https://jiyetphxxvyiicrnwlnx.supabase.co/functions/v1/resend-webhook` subscribed to EXACTLY `email.sent`, `email.delivered`, `email.bounced`, `email.complained`. **NOT `email.opened`/`email.clicked`** — those leak read-receipts and don't fit state machine.
   - (4) Capture signing secret → Vault `resend_webhook_signing_secret` (Deno-only) via Studio: `select vault.create_secret('whsec_...', 'resend_webhook_signing_secret')`.
   - (5) Deploy webhook handler with sig verification ENABLED from first deploy.
   - (6) THEN merge BE PRs in locked sequence.
   - **Templates are NOT registered as Resend server-side templates** — we send fully-rendered HTML; Resend = transport only. Opaque tags ride the `tags` field.

2. **CRITICAL: pg_cron schedules locked atomically as migration M-OPS1** (DBA ratifies; OPS owns SQL body):
   ```sql
   -- Prereqs: pg_cron + pg_net extensions enabled at Supabase project level.
   -- Vault: edge_function_invoker_jwt (service-role JWT), edge_function_base_url.
   
   SELECT cron.schedule('email-retry-worker', '* * * * *',
     $$SELECT net.http_post(url := <base>/email-retry-worker, headers := <auth>, body := '{}', timeout_milliseconds := 50000);$$);
   
   SELECT cron.schedule('email-cron-verification-reminders', '7 */6 * * *', $$ ... $$);  -- :07 offset from retry-worker
   SELECT cron.schedule('email-cron-branch-invite-stale', '17 */6 * * *', $$ ... $$);
   SELECT cron.schedule('email-dead-letter-reconcile', '0 13 * * *', $$ ... $$);  -- 13:00 UTC daily
   ```
   **Paired M-OPS2 health-probe cron** at 04:00 UTC queries `cron.job_run_details` for prior 24h; any of 4 jobs has 0 successful runs OR `>10%` failed → INSERT `ops_alerts` (severity='page' for retry-worker, 'high' for rest). Retry-worker is the canary.

3. **CRITICAL: PagerDuty does NOT exist at Replant — heartcry 1-hour SLA needs an actual firing path.** Three-tier signal cascade:
   - **(1) Sentry** — new alert rule: any error event with `tags.email_sla='heartcry_1h'` → immediate email to `accounts@` + **Founder personal phone via Sentry SMS** (Sentry → Notifications → add Founder phone). Repeat every 15min until acked.
   - **(2) New edge function `email-sla-monitor`** runs every 5min via pg_cron, queries:
     ```sql
     SELECT id, template, sent_at FROM email_log
     WHERE template IN ('notify_t19','notify_t21')  -- heartcry-class opaque tags
       AND outcome IN ('failed','hard_bounced')
       AND sent_at < now() - interval '55 minutes'
       AND id NOT IN (SELECT email_log_id FROM ops_alerts WHERE sla_acknowledged_at IS NOT NULL);
     ```
     Each hit → Sentry capture with `tags.email_sla='heartcry_1h'` severity=fatal.
   - **(3) Signal channel** post-MVP ticket (file now): when admin team grows, route same alert into Signal admin channel + proper on-call rota.
   - Ack writeback: `ops_alerts.sla_acknowledged_at` set via admin RPC `ack_sla_alert(p_alert_id)`. Founder + accounts@ ack via SQL Console at MVP; one-page admin-dash widget post-MVP. Pastoral (4h) + Standard (next-business-day) use SAME `ops_alerts` table; different thresholds.

4. **HIGH: Webhook signing secret rotation = dual-endpoint pattern, not in-place swap.** Resend allows ONE signing secret per endpoint; naïve swap drops events during cutover → hundreds of `delivered` events lost. Runbook `docs/ops/OPS-RESEND-webhook-rotation.md`:
   - (1) Pre: confirm `webhook_orphaned_events` at baseline.
   - (2) Register SECOND webhook at `/resend-webhook-v2` (identical handler, reads `resend_webhook_signing_secret_v2`).
   - (3) Wait 5 min, verify v2 receives + verifies events.
   - (4) Delete OLD endpoint.
   - (5) Wait 24h for in-flight retries to clear.
   - (6) Promote: rename `_v2` → canonical, redeploy, undeploy `-v2`.
   - (7) Audit: action `webhook_signing_secret_rotated` (NEW), meta `{prev/new_secret_id_hash, dual_window_minutes}` — no plaintext.
   
   Resend API key rotation uses SAME dual-key pattern (Vault `_v2` entry, both runtimes verify, revoke after 5min). Pin as canonical rotation pattern.

5. **HIGH: Vault accessor cache TTL = 15min (not until isolate eviction)** to guard against post-rotation stale-key reads. `RESEND_KEY_CACHE_TTL_MS = 900_000` in `_shared/email/sendEmail.ts`. On RPC failure → Sentry `tags.outage='vault_resend_key'` + transition to `'misconfigured'`. Runbook `docs/ops/OPS-RESEND-vault-recovery.md` documents recovery. **Add legacy-JWT-format negative check** to boot — refuse if key starts with `eyJhbGci` (catches Supabase service-role key accidentally pasted into Resend env slot per [[feedback-supabase-new-api-keys-migration]]).

6. **HIGH: Daily digest meta-loop guard.** If digest itself fails via sendEmail() and Resend down, it would trigger future digest about failed digest. New edge function `email-daily-digest` at 13:30 UTC (after reconciler at 13:00 UTC). NEW EmailKind `ops_daily_digest` (CONTENT owns body + DBA M7 CHECK addition). If digest dead-letters → `ops_unreachable_log` table (severity='page') + Sentry `tags.outage='digest_undeliverable'` → SAME 1h Sentry-SMS path as heartcry SLA. **Digest does NOT recurse.** Founder personal email fallback if `accounts@` is suppressed.

7. **HIGH: Status-divergence reconciler shape locked** (DBA M6 addendum):
   - `users.email_reconciler_acknowledged_at timestamptz NULL`.
   - `users.email_reconciler_acknowledged_by uuid NULL REFERENCES users(id)`.
   - Reconciler query in OPS finding 7 (LATERAL join against `email_log` for last matching row).
   - Admin RPC `ack_email_reconciler_row(p_user_id)` (super_admin only) writes audit `email_reconciler_ack` (NEW).
   - Reconciler does NOT auto-retry — human decides.

8. **HIGH: `webhook_orphaned_events` table (M-OPS3 NEW):**
   ```sql
   CREATE TABLE public.webhook_orphaned_events (
     id uuid PK default gen_random_uuid(),
     provider text NOT NULL,
     event_id text NOT NULL,
     resend_id text NULL,
     event_type text NULL,
     payload jsonb NOT NULL,
     received_at timestamptz NOT NULL DEFAULT now(),
     reconciled_at timestamptz NULL,
     reconciled_via text NULL CHECK (reconciled_via IS NULL OR reconciled_via IN ('late_insert','manual','expired'))
   );
   ALTER TABLE webhook_orphaned_events ENABLE ROW LEVEL SECURITY;
   CREATE POLICY webhook_orphaned_events_service_only ON ...
   ```
   New cron `email-orphan-reconciler` every 30min retries email_log lookup via `resend_id`; hit → applies delayed state transition + sets `reconciled_at, reconciled_via='late_insert'`. >7 days unreconciled → `expired`, Sentry once. Threshold: >50 unreconciled → daily digest severity='high'; >500 → Sentry-SMS. Retention: archive `reconciled_at < now() - 60d` monthly.

9. **HIGH: Resend retention boundary doc gates first leader-class send.** File `docs/sec/third-party-data-processors.md` BEFORE BE PR3 (`create-account`):
   - Resend: retention lifetime of account; subprocessors per `resend.com/legal/subprocessors`; data region US for MVP (documented); DPA at `resend.com/legal/dpa`; SOC 2 Type II per Resend trust center; acknowledgment that recipient address is unavoidable → mitigated via opaque template tags.
   - Supabase + Netlify: separately covered; link out.
   - Annual review + at subprocessor notification. Last-review date stamped at top.
   - SEC reviews; Founder signs off in PR description.

10. **HIGH: `connect@projectreplant.org` inbound = manual Google Workspace mailbox, no SLA at MVP.** For underground pending leader, an unread reply IS the blocker. File `docs/ops/OPS-CONNECT-inbox.md`:
    - `connect@` = Google Workspace mailbox owned by Founder + accounts@. NOT routed through Resend. Confirm DNS MX still points to Google.
    - MVP SLA: admin checks within 1 business day (24h Mon-Fri). Manual discipline.
    - Backup alert (post-MVP ticket): Workspace API or Apps Script monitors `connect@` for unread >48h, pings Founder.
    - Lock `connect@` reply-to in Resend dashboard sender settings, not in code.

11. **MEDIUM: Deploy posture per runtime + Netlify build-minute batching.**
    - **Deno:** lock deploy script `scripts/deploy-email-infra.sh` with `--no-verify-jwt` for ALL 8 edge functions (resend-webhook, email-retry-worker, email-cron-verification-reminders, email-cron-branch-invite-stale, email-dead-letter-reconcile, email-orphan-reconciler, email-sla-monitor, email-daily-digest).
    - **Netlify (admin) batching to preserve build minutes per [[feedback-batch-netlify-pushes]]:** 6 PRs → 3 batched pushes:
      - **Batch 1** = PR-A (_lib/email/ + escalate-flag.js).
      - **Batch 2** = PR-B + PR-C + PR-E (join-welcome, volunteer-welcome, invite-admin, grant-admin, underground-notify). Coordinate with CD Family 1 redesign.
      - **Batch 3** = PR-D (send-password-reset) + PR-F (retire admin-invite-email.js). Coordinate with KAN-198 OTP work.

12. **MEDIUM: Resend test mode = simulator addresses, NOT test API keys** (no `re_test_*` keys exist per Resend docs). E2E uses Founder personal Gmail for happy path; `bounce@simulator.resend.com` + `complaint@simulator.resend.com` for webhook paths. Soak tests use simulator. Doc `docs/architecture/email-test-strategy.md`.

13. **MEDIUM: Domain warm-up posture at MVP launch.** Domain not cold (heartcry triage sending for months) but volume profile shifts at launch. Cap intake-form welcome dispatch:
    - Week 1: 100/day (Vault config `EMAIL_DAILY_INTAKE_CAP=100`). Excess waits for next day.
    - Week 2: 500/day.
    - Week 3: uncapped if no Resend dashboard hits.
    - Cap is Vault-resolved (mutable without redeploy). Document at `docs/ops/OPS-RESEND-volume-policy.md`.

14. **MEDIUM: OTP pepper rotation policy = NEVER at MVP** (rotating breaks all in-flight OTPs). Vault `auth_otp_pepper` seeded once via `openssl rand -hex 32`. Document at `docs/ops/OPS-OTP-pepper-policy.md` tagged `do-not-rotate-without-engineering-review`. Alert if any 90-day automation tries to touch it.

15. **MEDIUM: KAN-262 closes with link to this briefing** (NOT silently rolled into KAN-80 per [[feedback-jira-is-paper-trail]]). Comment: "Superseded by KAN-80 panel (email infra modernization). Family 1 redesign + redeploy lands via BE PR-B batch."

16. **MEDIUM: Resend rotation runbook** `docs/ops/OPS-RESEND-rotation.md` BEFORE first 90-day rotation (no later than 60d post-MVP). Audit action `resend_api_key_rotated` (NEW). Same dual-key pattern as webhook signing secret.

17. **LOW: Vanity webhook domain post-MVP ticket** filed: `hooks.projectreplant.org` proxy. Requires dual-webhook rotation pattern in production first.

18. **LOW: M1 CHECK rewrite is NON-REVERSIBLE.** Forward migration safe (49 prod rows all `outcome='sent'`); rollback after webhook ships and has written `delivered`/`bounced` rows would fail constraint violation. Header comment in migration file. Recovery is forward — `UPDATE email_log SET outcome='sent' WHERE outcome NOT IN (legacy_set)` after disabling webhook.

**OPS raised Founder questions (5):**
1. Sentry SMS to Founder personal phone for heartcry 1h SLA — acceptable for MVP? OPS recommends SMS + email-to-accounts@ as belt-and-braces.
2. Resend volume cap (100/500/uncapped over 3 weeks) — confirm or adjust?
3. KAN-262 — close outright with link, OR keep open as child of KAN-80 for explicit redeploy traceability?
4. Dual-key rotation windows (5min API key / 24h webhook signing secret) — confirm the trade-off.
5. Vanity webhook domain — defer to post-MVP per SEC Finding 12 — confirm.

**Schema deltas added by OPS:**
- **NEW table:** `ops_alerts` (SLA alerts + ack).
- **NEW table:** `ops_unreachable_log` (digest meta-loop guard).
- **M-OPS1 (NEW):** pg_cron schedules atomic batch (4 jobs).
- **M-OPS2 (NEW):** health-probe cron schedule.
- **M-OPS3 (NEW):** `webhook_orphaned_events` table (BE flagged; OPS specs).
- **M6 addendum:** `users.email_reconciler_acknowledged_at` + `users.email_reconciler_acknowledged_by`.
- **M7 addendum:** add `ops_daily_digest` to template CHECK.
- **New audit actions:** `webhook_signing_secret_rotated`, `resend_api_key_rotated`, `email_reconciler_ack`.

**Template additions:** `ops_daily_digest` (NEW). Surface count ~20 → ~21.

**OPS observations downstream lanes should know:**
- `cron.job_run_details` retains 5 days; post-MVP ticket: monthly archive to audit table.
- `pg_net.http_post` runs separate txn; health-probe must look at `net._http_response` table too, not just `cron.job_run_details`.
- 13:00 UTC + 13:30 UTC daily times land before North American business hours but after Europe; consider twice-daily post-MVP for global admin scale.
- Resend webhook retry behavior: 5xx response → exponential backoff up to 24h. Handler MUST return 200 even on orphaned-events insert path.
- Founder + accounts@ both hold elevated permissions ([[reference-highest-tier-admins]]); either can ack SLA alerts (no two-eyes required for ack; two-eyes remains for destructive flows).
- Confirm Founder's local Supabase CLI version before edge function deploy. If 2.95.4, `--no-verify-jwt` flag required; if ≥2.100.1, can rely on `config.toml`. Deploy script passes both belts — forward-safe.
- Project-level pg_cron + pg_net extensions verify enabled before M-OPS1.

---

### CONTENT — verdict: approve-with-changes (returned 2026-06-24 evening III)

**Critical / High findings — see full text in agent return; key locks:**

1. **Canonical opaque tag map** authored — full JSON at end of CONTENT pass; lives at `docs/architecture/email-tag-map.json`. Family-prefix (`welcome_*`, `notify_*`, `auth_*`, `ops_*`, `intake_*`) preserved; numeric suffix shuffled non-monotonically; underground + heartcry routed into `notify_*` (mixed with non-sensitive admin notify); reserved range `admin_t40-t79` for KAN-271 + `notify_t90-t99` for future Family 5 carve-outs + `ops_t60-t69` for future ops templates.
2. **Heartcry triage rename:** KEEP live `heartcry_triage_notification` as canonical semantic name (NOT proposed `heartcry_triage_ping`). Opaque tag = `notify_t21`. Zero data migration. Update briefing section 6 EmailKind list + BE PR1 spec.
3. **`pastoral_signal_*` disposition:** DEFER to KAN-271 bundle. DBA M7 CHECK includes them so prod writes stay valid; BE PR4 stays HELD; opaque tags `notify_t73` + `notify_t74` reserved (not allocated).
4. **Plain-text fallback:** every template ships HTML + plain-text. Single source `{ subject, html, text }`; CI test asserts non-empty. URLs spelled out, reply-to named, no unicode that fails to degrade.
5. **Subject-line table locked** for all 28 templates (see CONTENT agent return for full table). Key rules:
   - All 4 `welcome_*` variants share IDENTICAL subject `"Welcome to Replant"` (no by-elimination leak).
   - `verification_request_info` / `verification_rejected` / `account_deactivated` share `"Replant — a note from our team"` (subject doesn't pre-judge outcome).
   - NO "heartcry" word in any subject.
6. **Body language per family** — full bodies authored for each template; key locks:
   - "your church" literal across all leader-addressed templates (NOT "your ministry"; reserved for volunteer-class).
   - `heartcry_acknowledged` = single line `"We have received and are praying. — The Replant Team"`. No `{{{FIRST_NAME}}}`, no personalization, no admin name, no triage content, no heartcry quote.
   - `verification_rejected` closes with `"May the Lord keep you."` (benediction reserved for final-state pastoral communications).
   - `account_deactivated` = **sentinel `TODO_FOUNDER_LOCK` throws at render-time** until Founder pastes final copy (KAN-81 T5 tone-gate procedurally enforced).
   - `coleader_departed` surface = name departing leader; underground = generic + UG Inbox recourse.
   - `verification_request_info` body = 5 lines; "Reply to this email and we'll follow up directly." Per AUTH Finding 11.
   - `email_change_notify_old` calibrated: convey urgency without panic-phishing-feel; subject `"Replant — a security note"`.
7. **Copy ownership boundary** locked: subject/HTML/text body authored by CONTENT in template files; From/Reply-To/EmailKind/opaque-tag hardcoded in BE; variables BE-supplied; nothing in Resend dashboard. PR review gate on `subject` / `html` / `text` requires CONTENT label.
8. **Underground branch rules** — every leader-addressed template has CI snapshot tests for `church_type='underground'` AND `church_type='surface'`. Underground diff CANNOT contain church name, region, full name, "underground", or admin identifiers. First-name-only regardless of `display_name_preference`.
9. **Sender identity split** — leader-facing: `From: Replant <connect@projectreplant.org>`, `Reply-To: connect@`. Admin-facing: `From: Replant Admin <accounts@projectreplant.org>`, `Reply-To: accounts@`. No personalization, no tracking pixels, no `<img>` beacons.
10. **Typography ruling extended to email:** `<em>` ONLY for scripture quotation; plain-text uses `"quotation marks"`. NO italics/bold for emphasis. Dignity register carries weight in copy, not typography.
11. **Variables NEVER persisted** to `email_log` / Sentry / console / Resend `data` field. CI test snapshots `email_log` row per `EmailKind` — no substituted values present.

**CONTENT raised Founder questions (6):**
1. `welcome_underground_pending` ship-or-not (parallels BA Q1 + SEC Q4). CONTENT recommends ship with generic body + identical subject + opaque tag.
2. `account_deactivated` copy paste timing — author now (context fresh) or after BE PR3 lands?
3. Benediction close (`"May the Lord keep you."`) on final-state pastoral templates only (verification_rejected + account_deactivated) — confirm pattern?
4. `Replant` vs `Replant Admin` From-line split — confirm dual-identity OR collapse to single `Replant`?
5. `heartcry_acknowledged` — CONTENT recommends NO `{{{FIRST_NAME}}}` personalization (universality of the line is its weight).
6. Subject-line table — approve as-is or rework specific lines?

**Schema deltas added by CONTENT:**
- **M7 addendum:** include `pastoral_signal_digest_t2`, `pastoral_signal_alert_t1`, `heartcry_triage_notification`, `ops_daily_digest` in template CHECK.
- **Post-MVP ticket:** rename `pastoral_signal_*` to opaque codes after KAN-271 ships.

---

## END SME PANEL — 7 of 7 returned

All 7 SMEs returned `approve-with-changes`. No blockers. Synthesis follows separately for Founder ratification.

