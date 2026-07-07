# KAN-304 Report Mechanism — BE+ADMIN Lane Verdict (intake · storage · admin surfacing)

**Panel:** KAN-304 UGC report mechanism (STORE BLOCKER — Apple 1.2(b) + Play). BE+ADMIN lane; SEC, MOD, CONTENT run in parallel.
**Method:** repo read-only (`~/replant`, mobile + `supabase/`); live-DB SELECT-only introspection of `jiyetphxxvyiicrnwlnx` on 2026-07-07 (zero writes). The admin dashboard is a separate repo not checked out — everything marked **[admin-side]** is designed from DB/API truth + the locked admin-architecture rulings, not from its code.
**Verdict: APPROVE — design locked from this lane.** The existing machinery (send-time scan → `moderation_state`, `escalated_cases` + proposals, UG auto-route triggers, append-only `audit_log`) composes cleanly under a new reporter-scoped table + one unified admin read view. Nothing here requires touching the locked propose/approve ceremony.

---

## 1. Verified ground truth (live, 2026-07-07)

1. `messages`: `flagged` bool + `flag_reason` text written at SEND time by the `send-message` edge fn taxonomy scan (DELIVER-ALWAYS; content never logged); `flag_status` CHECK `cleared|escalated`; disposition columns `flag_reviewed_at/by`. Branch + DM share the table (`message_belongs_to_one` CHECK).
2. `moderation_state`: PK `(message_id, axis)`, axis CHECK `admin|pastoral`, status CHECK `pending|seen|cleared|escalated|dispositioned|deferred`. **Message-scoped by construction.** Watched invariants on the axis predicate (KAN-125/131/137).
3. `escalated_cases`: message-anchored (`source_message_id`, dedupe on it in both UG triggers), `source_axis` CHECK `flagged|pastoral|auto_underground`, state machine `open|awaiting|replied|pending_proposal|manager_review|closed`, auto-route consistency CHECK (auto ⇒ `auto_underground` + no escalating admin). `escalated_case_proposals`: 1-pending-per-case partial UNIQUE, no-self-approve CHECK, 72h expiry.
4. UG auto-route triggers (`fn_auto_route_ug_flagged` / `_pastoral`) fire on flag-escalation flips; UG party ⇒ case created, `/pastoral` + `/flagged` bypassed; audit `escalated_case_auto_routed` with `triggered_by='system'`.
5. `audit_log`: append-only, `action` locked by a 72-token CHECK (extension mechanics: verbatim-copy rebuild, migration `20260701000004` precedent), `actor_must_be_identified`, INSERT policy = service_role only.
6. Client-write posture: **every** peer content write is a SECURITY DEFINER RPC (`post_comment`, `create_prayer_request`, `create_testimony`…); direct INSERT/UPDATE/DELETE revoked from `anon, authenticated` on all six content tables + churches (migration `20260702031830`).
7. Rate limiting house patterns: Upstash REST (GET/SETEX) on **anon-facing** edge fns (`search-churches` ip-limit before body parse; `reveal-join-code` idempotency tombstones). No authenticated-RPC limiter precedent — DB-side window count is the natural fit there.
8. Admin JWT claims: top-level `super_admin` boolean = SA + Manager only; `admin_tier` composite claim (`top_tier|super_admin|regular`). Regular admins reach queues exclusively through the admin repo's Netlify functions (`verifyAnyAdmin` + service role). RLS SELECT policies on moderation tables gate on the `super_admin` claim only — belt for direct reads.
9. Visibility predicates the intake validator must mirror (verified verbatim from live policies/functions): DM = participant (`messages_select_own`); branch = `branch_members.consent_status='joined'` + `m.is_active` (`get_branch_messages`); prayer/testimony = authenticated + `is_active`; comment = verified caller + announcement `is_active AND published_at <= now()`; church = `is_active AND (type <> 'underground' OR own church)`.
10. **Honest corrections:** (i) no `blocked_users` relation exists anywhere in the live DB (`pg_class` sweep empty) — audit §2 blocker 3's "exists DB-side, unwired" is overstated; the block ticket must CREATE it. Reports do not depend on it. (ii) Supabase advisory flags `spatial_ref_sys` with RLS disabled — that is the PostGIS extension's public geodetic reference table (no user data, extension-owned); surfacing per tooling requirement, no action recommended in this ticket.

---

## 2. Storage shape — recommendation: **(a) new `content_reports` table**, unify at the READ layer

1. **Why not (b) extend the flag machinery:** `moderation_state`'s PK and axis CHECK are message-scoped and carry one STATE per target-axis; reports are per-REPORTER EVENTS (N rows per target) across five surfaces — different cardinality, different write path. Widening it breaks the PK, the queue index, `v_escalated_inbox`, both UG triggers, and the admin repo's queries — a large blast radius on locked KAN-125/131/137 machinery. Overloading `messages.flag_reason` would corrupt the taxonomy forensic channel (`matched_codes` linkage). Send-time scan = machine, send-scoped; report = human, post-hoc, five-surface. Two write systems, **one read view** (§5).
2. **DDL sketch (illustrative — not applied):**

```sql
CREATE TABLE public.content_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid NOT NULL REFERENCES public.users(id),        -- public.users PK (comments.author_id precedent)
  target_type      text NOT NULL CHECK (target_type IN
                     ('message','prayer_request','testimony','comment','church')),
  target_id        uuid NOT NULL,                                     -- polymorphic; NO FK by design — existence+visibility enforced in the RPC
  target_author_id uuid REFERENCES public.users(id),                  -- resolved server-side; NULL iff target_type='church'
  target_church_id uuid REFERENCES public.churches(id),               -- author's church, or the church itself; UG detection + admin context
  reason           text NOT NULL CHECK (reason IN
                     ('harassment','impersonation','false_teaching','safety_threat',
                      'financial_solicitation','spam','other')),      -- ILLUSTRATIVE — MOD lane owns tokens; coordinate with KAN-261's financial-solicitation extension
  detail           text CHECK (detail IS NULL OR char_length(detail) BETWEEN 1 AND 500),  -- scrubAndCap'd in the RPC (watched-invariant #17 discipline)
  content_snapshot text,                                              -- server-captured at intake (§2.4); NULL for church targets
  snapshot_meta    jsonb,                                             -- {target_created_at, branch_id|conversation_id|announcement_id, church profile fields for church targets}
  ug_involved      boolean NOT NULL DEFAULT false,                    -- computed at intake; drives auto-route + queue exclusion
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','cleared','escalated')),
  case_id          uuid REFERENCES public.escalated_cases(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES public.users(id),                  -- NULL on UG auto-route (system), mirrors escalated_by NULL pattern
  CONSTRAINT content_reports_status_consistency CHECK (
    (status='open'      AND reviewed_at IS NULL AND reviewed_by IS NULL AND case_id IS NULL) OR
    (status='cleared'   AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR
    (status='escalated' AND case_id IS NOT NULL)),
  CONSTRAINT content_reports_church_author CHECK (
    (target_type='church' AND target_author_id IS NULL) OR
    (target_type<>'church' AND target_author_id IS NOT NULL))
);

-- Indexes (house conventions: partial queue indexes + partial-unique dedupe)
CREATE INDEX idx_content_reports_open    ON public.content_reports (created_at DESC) WHERE status='open';
CREATE INDEX idx_content_reports_target  ON public.content_reports (target_type, target_id);
CREATE INDEX idx_content_reports_reporter_recent ON public.content_reports (reporter_id, created_at DESC);
CREATE UNIQUE INDEX uniq_content_reports_open_per_reporter_target
  ON public.content_reports (reporter_id, target_type, target_id) WHERE status='open';   -- double-tap idempotency (mirrors uniq_ecp_one_pending_per_case)
```

3. **RLS + grants — default-deny, no client policies:**

```sql
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_reports FROM anon, authenticated;   -- 20260702031830 posture
-- Intake: SECURITY DEFINER RPC only (§3). Admin reads: service-role Netlify fns only.
-- NO reporter read-back policy: report status (cleared/escalated) is a moderation outcome;
-- exposing it to reporters violates the locked anti-gossip discipline. Client shows only the
-- RPC's synchronous "received" response.
```

Optional parity policy (`moderation_state`-style SELECT gated on the `super_admin` claim, additionally `AND ug_involved=false`) if the dashboard ever reads this table via supabase-js — not required by the primary design; default-deny is the recommendation.

4. **Snapshot vs reference (SEC lane owns the final call — this lane's recommendation: SNAPSHOT).** `update_prayer_request` (author edit), comment delete (trigger `tg_after_comment_delete`), prayer withdraw, and message `is_active` all exist live: report-then-edit/delete otherwise evades review entirely. The RPC already reads the row for visibility validation — snapshotting the content text at intake is free, admin-only under default-deny RLS, and retained indefinitely per the 2026-07-03 audit-retention ruling (disclosed in v0.3). UG data-minimization is preserved because UG-involved reports live behind the Escalated tier wall from birth (§3.5).

---

## 3. Intake path — SECURITY DEFINER RPC (not an edge function)

1. **Signature:**

```sql
public.submit_content_report(
  p_target_type text,           -- 'message'|'prayer_request'|'testimony'|'comment'|'church'
  p_target_id   uuid,
  p_reason      text,           -- MOD-lane token
  p_detail      text DEFAULT NULL
) RETURNS jsonb
-- {ok:true, report_id, duplicate:boolean}
-- | {error:'not_authorized'} | {error:'validation_failed', detail}
-- | {error:'rate_limited'}   | {error:'not_found'}     -- uniform for not-exists AND not-visible (§4.3)
GRANT EXECUTE ... TO authenticated; REVOKE FROM PUBLIC, anon;
```

Soft-error jsonb envelope mirrors `add_intercession_hold`'s `{error:'list_full'}` house pattern — the client the bottom sheet already has handles it (§7).

2. **Why RPC over edge function:** (i) auth context native — caller resolution `auth_id = auth.uid() AND is_active AND soft_deleted_at IS NULL AND verification_status='verified'` is the exact `post_comment`/`get_branch_messages` predicate; (ii) **single transaction** — visibility check, snapshot read, report INSERT, audit INSERT, and UG auto-route case INSERT commit or roll back together. An edge function composing these over PostgREST cannot get one transaction without… calling an RPC. This is the audit-first ordering guarantee (§3.4); (iii) no server-only secret is involved (unlike the send-scan taxonomy), so the edge fn's one real advantage is absent; (iv) rate limiting for an **authenticated** intake is a DB window count — Upstash is the house pattern for anon surfaces (ip-keyed), and reports must be keyed by reporter, not ip; (v) house style: every peer content write is a definer RPC.
3. **Rate limiting:** in-RPC `COUNT(*)` over `idx_content_reports_reporter_recent` for the trailing hour; over cap ⇒ `{error:'rate_limited'}` (no row, no audit noise beyond a warn-level structured log if desired). Recommended cap 10/hour/reporter (Founder decision 4). This is deliberately server-side and silent-capped — no client-visible counter to game.
4. **Idempotency + audit-first ordering:** double-tap resolves via the partial UNIQUE — `INSERT ... ON CONFLICT DO NOTHING`; on conflict, return the existing open report's id with `duplicate:true` (client UX identical — a second tap is success, not an error). The audit row (`content_report_submitted`, `accessed_by` = reporter's `users.id`, `triggered_by='user'`, meta = `{report_id, target_type, reason, ug_involved}` — **never** content, detail text, or target-author identity; SAFE-LOG discipline) is inserted in the same transaction before RETURN: if the audit INSERT fails, the report rolls back — fail-closed, composing the heartcry audit-before-return discipline. Duplicate short-circuit writes no second audit row.
5. **UG auto-route at intake (architectural mirror of the locked triggers):** compute `ug_involved` := reporter's church is UG **OR** target author's church is UG **OR** (DM target) counterparty's church is UG **OR** (church target) church is UG. If true: the report is born `status='escalated'` — dedupe-or-create an `escalated_cases` row (`source_axis='auto_underground'`, `auto_routed=true`, `escalated_by_user_id NULL` — satisfies the live consistency CHECK verbatim; `source_message_id` set when the target is a message so existing view joins light up; new `source_target_type/id` set always, §6.3), link `case_id`, audit `escalated_case_auto_routed` alongside the submit row. **The report never exists in any regular-admin-visible state.** Reporter-is-UG routes too: "reported by [UG leader]" in a regular admin's queue is itself a UG identity leak. Whether the submit audit row for UG-involved reports should additionally mirror to `audit_log_underground` is SEC lane's call — flagged for them.
6. **New audit actions** (CHECK rebuild per `20260701000004` verbatim-copy mechanics): `content_report_submitted`, `content_report_opened`, `content_report_cleared`, `content_report_escalated`. Four tokens, one migration.

---

## 4. Per-surface targeting — what the client sends, and the anti-enumeration gate

1. **The client sends `(target_type, target_id, reason, detail?)` and nothing else.** No content echo, no author id, no church id — the server resolves author/church/snapshot itself. Payloads are therefore UG-masking-safe by construction: a client payload can never carry another leader's identity.
2. **Target ids per surface** (all already in client hands on the rendering path): message ⇒ `messages.id` (DM bubbles and branch messages both — `get_branch_messages` returns `message_id`); prayer ⇒ `prayer_requests.id` (wall cards); testimony ⇒ `testimony.id`; comment ⇒ `comments.id` (`get_comments`); **church ⇒ `churches.id`** — exactly `profile.id` from `get_church_profile`, which is what `ChurchProfileBottomSheet` already holds (§7).
3. **Visibility validation server-side (the probe gate).** SECURITY DEFINER bypasses RLS, so the RPC re-asserts the *reporter's own* read rights over the target, mirroring the live predicates verbatim (§1.9):

| target_type | must hold (verified against live policies/functions 2026-07-07) |
|---|---|
| message (DM) | `conversation_id IS NOT NULL` AND reporter ∈ {sender, receiver} AND `sender_id <> reporter` |
| message (branch) | `branch_id IS NOT NULL` AND reporter has `branch_members.consent_status='joined'` AND `m.is_active` AND `sender_id <> reporter` |
| prayer_request | `is_active = true` AND `user_id <> reporter` |
| testimony | `is_active = true` AND `user_id <> reporter` |
| comment | comment exists AND announcement `is_active AND published_at <= now()` AND `author_id <> reporter` |
| church | `is_active = true` AND (`type <> 'underground'` OR reporter's own church) |

Any failure returns the **uniform `{error:'not_found'}`** — identical for does-not-exist and not-visible-to-you, so the RPC is not an existence oracle. Reporting an id you couldn't legitimately see is a probe and learns nothing.
4. **Drift risk, named:** these predicates are copies of RLS/RPC quals; per the sister-action rule, any future change to a surface's SELECT policy must update this validator in step. Mitigation worth building: factor per-surface checks into one `fn_report_target_visible(reporter users, type text, id uuid)` helper so there is exactly one place to keep honest.
5. **Anonymous content:** an anonymous prayer/testimony is anonymous to peers, not to moderation — `target_author_id` resolves the true author server-side (admins already see flagged-message senders). The reporter never receives it.

---

## 5. Admin surfacing **[admin-side — separate repo; designed from DB truth + locked rulings]**

1. **Placement — recommendation: extend the Flagged Messages tab into the unified moderation queue, not a 5th tab.** The locked Pastoral Care architecture is 4 tabs (Pastoral Signals · Flagged Messages · Replant Team Inbox · Escalated Cases); reports share Flagged's triager population (any admin), verbs (Clear/Escalate), tier gates, and escalation machinery. A parallel Reports tab forks identical triage across two queues and invites a missed-SLA orphan. Rows carry an **origin chip** — `Auto-scan` vs `Leader report` — and a **surface chip** (DM/Branch/Prayer/Testimony/Comment/Church). Display rename (e.g. "Flagged Content") is CONTENT lane's; the tab-set change is Founder decision 2.
2. **Unified read shape** (DB-side view, this repo's migrations; `security_invoker=true` per `v_escalated_inbox` precedent — admin repo consumes via service role):

```sql
CREATE VIEW public.v_moderation_inbox WITH (security_invoker=true) AS
  SELECT 'scan'::text AS origin, 'message'::text AS surface, m.id AS target_id,
         1 AS report_count, ARRAY[m.flag_reason] AS reasons,
         m.created_at AS first_at, m.created_at AS last_at, false AS ug_involved
    FROM messages m
   WHERE m.flagged AND m.flag_status IS NULL                -- existing pending-queue semantics
UNION ALL
  SELECT 'report', r.target_type, r.target_id,
         count(*)::int, array_agg(DISTINCT r.reason),
         min(r.created_at), max(r.created_at), bool_or(r.ug_involved)
    FROM content_reports r
   WHERE r.status = 'open'                                   -- UG rows are never 'open' (born escalated); WHERE NOT ug_involved as belt
   GROUP BY r.target_type, r.target_id;
```

**Dedupe/aggregation query shape:** one row per reported target, `report_count` + distinct `reasons[]` + first/last timestamps; MOD lane owns the rendering semantics on top of this shape. Sub-ms at current scale over the partial `status='open'` index; the GROUP BY stays index-supported at 100K-row scale (DBA precedent style).
3. **Endpoints** (Netlify-function house style, gates per the locked matrix + sister-action rule — all four share the gate): `list-moderation-inbox` (extend `list-flagged-messages`), `open-report-target` (drawer: per-report rows, snapshots, live target state; writes `content_report_opened` — the `flag_read` sibling), `clear-report-target`, `escalate-report-target`. Gate: `verifyAnyAdmin`; AAL2 freshness per the locked table — list = browse (30 min); clear/escalate = regular_destructive (30 min). No 5-min step-up here: nothing at this layer is destructive on a leader — destructive stays behind Manager approval exactly as today. Add the `escalated_inbox_tier_denied`-style audit row on gate failures (recon signal precedent).
4. **Reporter identity:** never in the list row; in the drawer per-report detail only (Founder decision 3 for display form). Never in any email.
5. **Notification — compose the counts-only pastoral digest precedent** (live meta verified: `pastoral_digest_emitted`, `triggered_by='cron'`, `{pending_total, deferred_count, template_id}` — zero content). Recommendation: extend the existing digest cron/email with a second counts line (`open report targets: N, new since last digest: M`) rather than a separate email — one shepherd email a day, not two (Founder decision 5). Audit action reuse: extend the digest meta rather than minting a new action if folded; `report_digest_emitted` if separate. **No immediate-alert leg at MVP** — the T1 pastoral alert already covers scan-detected life-safety; a report-reason immediate leg is post-UAT material.

---

## 6. Lifecycle + audit

1. **Report state machine:** `open → cleared` | `open → escalated` (UG auto-route births at `escalated`). Terminal from this table's perspective — escalated resolution lives on the case (existing machinery). Re-report after clear is permitted (the partial UNIQUE binds open rows only); the queue row simply reappears, and prior disposals are queryable for the drawer.
2. **Disposition is per-TARGET, not per-report:** Clear flips **all** open reports on `(target_type, target_id)` in one action — one decision, one audit row `content_report_cleared` with meta `{target_type, target_id, reports_cleared: N, reasons}`. The cleared path is explicitly audited — deciding *not* to act is itself the record (mirrors `flag_cleared`).
3. **Escalation reuses the existing case machinery — nothing parallel is invented.** Additive migration on `escalated_cases`:

```sql
ALTER TABLE public.escalated_cases
  ADD COLUMN source_target_type text CHECK (source_target_type IN
    ('message','prayer_request','testimony','comment','church')),
  ADD COLUMN source_target_id uuid;
-- source_axis CHECK rebuilt verbatim + 'report' token (admin-escalated reports; auto-UG keeps 'auto_underground')
-- Case dedupe for reports: partial UNIQUE (source_target_type, source_target_id)
--   WHERE source_target_type IS NOT NULL AND state <> 'closed'
--   — an escalation onto a live case LINKS (content_reports.case_id) instead of duplicating.
-- v_escalated_inbox: additive columns + snapshot fields for non-message targets (message targets keep
--   their live joins via source_message_id, which the RPC/endpoint also sets when target is a message).
```

`escalate-report-target` creates (or links) the case with `source_axis='report'`, `escalated_by_user_id/tier` = acting admin, `leader_user_id` = target author, `escalation_reason/context` from the admin's modal (existing ≥30-char CHECK applies), then flips the reports. From there: SLA banner, propose/approve (`escalated_case_proposals` — 1-pending-per-case, no-self-approve, Manager approval, 5-min step-up), dispositions, Reach Out — **all existing, untouched.** Regular admins lose sight of the case after escalation exactly as the locked anti-gossip rule requires — the status flip removes it from the open queue automatically.
4. **Who transitions what (tier):** submit = any active verified leader (RPC). Clear / escalate = any admin (matches the live `/flagged` posture and the locked "regulars see Escalate on their own rows" rule). Case-side transitions = existing tier rules (SA propose, Manager approve/reject/close). UG-involved anything = Manager + SA behind the Escalated wall only, enforced at birth by auto-route rather than by queue filtering.
5. **Retention:** indefinite, all classes, per the 2026-07-03 Founder ruling — reports, snapshots, and audit rows age out never; disclosed in privacy v0.3. No cron, no sweeper.

---

## 7. The stub — `ChurchProfileBottomSheet.tsx:334-336`

1. Current: `handleReport` toasts `'Report received'` wired to nothing (audit §2.2 — "worse than absence"). The Pressable at line 580 already carries `accessibilityLabel="Report a concern"`.
2. Wire: tap → reason picker sheet (UI is CD/CONTENT territory per SME rules; the RPC **requires** a reason token, so a bare tap can no longer submit — this is a product improvement, not scope creep: Apple 1.2(b) expects a real mechanism, and reasonless reports are untriageable) → `supabase.rpc('submit_content_report', { p_target_type: 'church', p_target_id: profile.id, p_reason, p_detail })`.
3. Response handling mirrors `handlePray`'s soft-error pattern in the same file: `ok:true` (including `duplicate:true`) → toast **"Report received."** — the existing copy becomes true; `rate_limited` / `not_found` / error → the file's existing generic failure toast. No client-side dedupe state needed — the server is idempotent.
4. The identical RPC contract serves the other four surfaces as MOD/CONTENT land their affordances (message long-press, prayer/testimony card overflow, comment action) — one intake, five surfaces, no per-surface backend.

---

## 8. Cross-lane notes

1. **KAN-261 linkage:** live KAN-261 (FLAG_TAXONOMY financial-solicitation extension) *presumes* a leader-facing Flag modal — this design is that modal's backend; the `reason` token set should be locked jointly with MOD so `financial_solicitation` lands once.
2. **SEC lane:** snapshot ruling (§2.4), UG audit mirroring (§3.5), reporter-identity display (§5.4), and whether repeated `not_found` probes deserve a recon audit row.
3. **Block ticket:** `blocked_users` does not exist live (§1.10) — that ticket creates it; a later block-follows-report affordance can join on `content_reports.target_author_id`.

## 9. Founder decisions (≤5, each with this lane's recommendation)

1. **Snapshot vs reference for reported content** — recommend **snapshot at intake** (evasion-proof; admin-only; indefinite retention already ruled). SEC lane co-signs or overrules.
2. **Queue placement** — recommend **extending the Flagged Messages tab** into the unified origin-chipped queue (4-tab lock preserved) over a 5th Reports tab.
3. **Reporter identity in the admin drawer** — recommend **full name** (house norm: `v_escalated_inbox` exposes `full_name` to case-tier admins), never in list rows, never in emails; UG reporters never reach a regular drawer at all.
4. **Rate cap** — recommend **10 reports/hour/reporter**, silent server-side cap; double-tap idempotent regardless.
5. **Notification** — recommend **folding report counts into the existing counts-only pastoral digest email** (one email; zero content) over a separate report email; no immediate-alert leg at MVP.

---

*Live introspection read-only throughout; zero writes to DB, code, or Jira. Every raised hand lands in a queue a shepherd opens — and the underground stay invisible even in the reporting of harm. In Jesus' name.*
