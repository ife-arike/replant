# KAN-304 — Leader-Facing Report Mechanism — SEC lane design

**Panel:** SEC (this doc) · MOD · BE+ADMIN · CONTENT (parallel). **Store blocker:** Apple 1.2(b) + Play UGC — in-app reporting of content AND users, absent on all five surfaces (audit §2.2; the KAN-261 cite was a miscite — no ticket exists for this build).
**Evidence basis:** live-DB introspection of `jiyetphxxvyiicrnwlnx` on 2026-07-07 (SELECT-only), repo read at `~/replant`, locked rulings (escalated-cases workflow 2026-06-30; audit-transparency 5+5 framework; indefinite audit retention 2026-07-03). Zero writes performed.

**SEC verdict: APPROVE for build — behind two non-negotiable invariants (§1.1, §1.2) and five Founder decisions (§9).** The existing moderation spine (FLAG_TAXONOMY regex → moderation_state → flagged/pastoral queues → UG auto-route → Escalated Cases) is the right chassis; reports become a second *origin* feeding the same human-review machinery, never a new action machinery.

---

## 0. Threat model (who is protected from whom)

1. **Reporter vs reported party** — retaliation. The reported party must never learn who reported them, or whether a peer (vs the regex) surfaced them. In persecuted contexts "who reported" is a physical-safety question, not a social one.
2. **Reporter vs the platform's own surfaces** — a report must not mint artifacts (device-local or admin-visible) that outlive the reporter's intent or exceed the minimum tier that needs them.
3. **Everyone vs the reporting channel as an oracle** — report intake must not confirm content existence, dedup state, other reporters' actions, or masked identities.
4. **The reported leader vs mobs** — coordinated report-bombing must not be able to bury a leader; no report count ever auto-actions content.
5. **UG identities vs every tier below Manager/super_admin** — reporting must not become a de-masking path in either direction (reported UG party, or UG reporter).

---

## 1. Reporter protection — the end-to-end guarantee

### 1.1 INVARIANT: report intake writes ZERO bytes to any content row

**This is the load-bearing technical guarantee and it is evidence-forced, not stylistic.** Verified live 2026-07-07:

- `public.messages` is in the `supabase_realtime` publication (`pg_publication_tables`), alongside `branches`, `branch_members`, `connection_requests`.
- RLS `messages_select_own` grants SELECT to `sender_id` — so Postgres-changes UPDATE events on a message row are *deliverable to the message's own sender*. The current client subscribes INSERT-only with a conversation filter (`DMThreadView.tsx:629-677`), but the publication emits UPDATEs regardless; any future subscriber, or Supabase client behavior change, turns a report-time row touch into a push notification to the reported party: "your message was just flagged."
- Therefore: intake must NOT set `messages.flagged`, `messages.flag_status`, or touch `prayer_requests` / `testimony` / `comments` / `churches` rows in any way. All report state lives in **new, report-scoped tables** (§6) with deny-all client RLS. If BE wants message-target report cases mirrored into `moderation_state` for queue reuse, that is permitted — `moderation_state` is not in the publication and its RLS is admin-JWT-only (verified) — but the content row itself is untouchable at intake. Existing-flag interplay: if the regex already flagged the same message, the report attaches to the case spine; it still does not re-touch the message row.

### 1.2 INVARIANT: uniform intake response (anti-oracle)

The `submit-report` response body and latency class must be indistinguishable across: new case created · duplicate by same reporter · case already open from other reporters · target already regex-flagged · target invalid/not-visible-to-reporter (rejected server-side, §7.3). One body: "Report received." Anything else is an oracle — dedup variance leaks *whether others reported*; invalid-target variance leaks *row existence* to an ID-probing client. Only two honest deviations: 429 when the reporter's own rate limit trips (§7.5 — reporter-derived, not target-derived), and 5xx on genuine write failure (a safety signal must never be silently dropped).

### 1.3 No reporter-facing tracking surface

Fire-and-forget by design, mirroring the locked anti-gossip escalation pattern ("Your escalation has gone up…", escalated-cases ruling 2026-06-30): no "my reports" list, no status pushes, no outcome notifications. This is not UX stinginess — it is reporter protection: **nothing on the reporter's device evidences what they reported** (seized-device posture; decisive for UG reporters), and nothing exists for the reported party's associates to shoulder-surf. The client MAY keep an in-memory-only "already reported" state per session to soften double-taps; never persisted.

### 1.4 No auto-hide, no bundled side effects

Reporting changes nothing about the reporter's own view (no auto-hide/auto-mute rider). An auto-hide is (a) a persisted device artifact of the report (violates 1.3), (b) a behavioral tell if the reported party probes ("she stopped reacting to my messages the day after I sent X"). Block/mute is a separate, reporter-chosen sister action (§8). DELIVER-ALWAYS's cousin holds: content stays up for everyone until a human acts.

### 1.5 Outcome indistinguishability (plausible deniability by construction)

Admin outcomes on report-origin cases reuse the **exact existing verbs** (clear, reach-out, escalate, propose-restrict/revoke) with no report-specific action or copy visible to the reported party. Because the FLAG_TAXONOMY regex pipeline independently generates flags on send (21 codes live, `_shared/taxonomy-codes.ts`), any moderation contact a reported party receives is inherently ambiguous between "the system matched a pattern" and "a peer reported you." Preserve this: **reach-out copy to a reported party must never reference a report's existence, count, source surface, or timing** (constraint handed to CONTENT lane). Corollary virtue of §2's tier gating: the admin acting on a case below the identity-expand tier *does not know* who reported — they cannot leak what they never saw.

### 1.6 No push/notification channel exists to leak

Audit-verified: the client ships zero push infrastructure. No notification path can betray report events today; if push ever ships, report events are categorically excluded.

### 1.7 Read-state hygiene

Intake performs no `mark_conversation_read` calls and no `conversations.last_read_at_x` / `branch_members.last_read_at` writes beyond what the reporter's organic thread-viewing already did. Admin case review reads content via service-role SELECTs that never touch read cursors (BE lane requirement — do not reuse caller-scoped RPCs that bump cursors).

---

## 2. Reporter identity in admin surfaces — justified-access, mirroring the locked 5+5 model

The locked audit-transparency framework (feedback_user_data_sensitivity, 2026-06-30): regular admins see the flagged message line only; super_admin + Manager expand to 5+5 context/full thread with a required ≥50-char justification, audit-permanent. **Reporter identity gets exactly the same treatment:**

1. **Regular admins:** see `Reported by a leader · N reports` (distinct-reporter count only). Never a name, id, church, role, or region of any reporter. Rationale: Replant's admin pool is drawn from a small, socially-dense community; reporter names in a regular-tier queue are the retaliation/gossip vector the anti-gossip ruling exists to kill.
2. **super_admin + Manager:** reporter identity sits behind an explicit **"View reporter" expand requiring a ≥50-char justification, written permanently to `audit_log`** (`report_reporter_identity_viewed`, accessed_by = admin, meta.justification). Needed legitimately for: false-report pattern review (§5.4), clarification reach-out (§2.4), and mid-conflict weighing (§5.3).
3. **UG reporter:** identity is only reachable inside Escalated Cases (§3), which regular admins cannot open at all; the same justified expand applies on top. Until expanded, the case shows the reporter per UG masking rules ("A fellow [Role]" + macro-region — reference_anon_identity_rules).
4. **Clarification reach-out to a reporter** uses the existing locked channel (Connect DM, "Admin Name from Replant Team", 1-per-24h-per-leader rate limit, 7-day UG-scrubbed email fallback). Reach-out copy never states any conclusion or action about the reported party (anti-gossip runs both directions), and never quotes resolved identities the reporter couldn't see (§4.3).

---

## 3. UG interactions — the delicate center

### 3.1 Auto-route on ANY UG party

Locked rule (2026-06-30): flagged/pastoral items with UG **sender OR receiver** bypass regular queues → Escalated Cases (super_admin + Manager only). Reports extend this to the full party set: **target author, target counterparty (DM receiver / branch co-members' church context where applicable), OR the reporter** — if any is UG (`users.church_id IN (SELECT id FROM churches WHERE type='underground')`, resolved server-side, the locked predicate), the report case routes to Escalated Cases and NEVER appears in a regular-tier queue. Reporter-UG routing is the natural completion of the rule's own rationale ("regular admins never see UG content" — a UG reporter's identity IS UG content). Founder decision 2 ratifies the reporter leg. Church-profile reports on a UG church route likewise.

### 3.2 Escalated-cases schema constraints (SEC requirements on BE's migration)

- `escalated_cases.escalated_by_user_id` must stay NULL for report-origin cases — **the reporter is never written into an admin-provenance column** (that column renders as "who escalated" in the drawer; reporter linkage lives only in the report tables, behind §2's gate).
- Live CHECK `escalated_cases_auto_route_consistency` couples `auto_routed=true ⇔ source_axis='auto_underground' ∧ escalated_by_user_id IS NULL` and `source_axis` CHECK allows only `flagged|pastoral|auto_underground` (verified live). BE's migration must extend both CHECKs for a report origin (e.g. `source_axis='report'`, permitted with `auto_routed=true`, `escalated_by_user_id NULL`) — extension only; do not touch the locked 8-token disposition list, which already covers report outcomes there (`false_signal` = unfounded).
- `escalated_cases.source_message_id` is message-scoped; report cases on prayers/testimonies/comments/churches link via `report_cases.escalated_case_id` (§6) — do not overload `source_message_id`.

### 3.3 De-masking oracle inventory — each designed against

| # | Oracle | Closure |
|---|--------|---------|
| a | **Intake echo** — report UI resolving/rendering more identity than the reporter already sees (e.g. confirming "Report Pastor John?" for an anonymous prayer) | Client sends `{surface, target_id, reason_code, note?}` ONLY — no author fields accepted or returned. The confirm sheet renders exactly the attribution already on screen (masked stays masked: `comments.is_masked/masked_region` are server-set; anonymous label per reference_anon_identity_rules). The response body carries no target-derived data (§1.2). |
| b | **Snapshot leakage** — the server-side snapshot (§6) captures true authorship; leaking it downward | Snapshot lives in `report_cases` with deny-all client RLS; rendered only through tier-gated BE endpoints; UG-involved cases only through Escalated-Cases endpoints (super_admin + Manager, per the locked tier matrix + `assertAtLeast` primitive). |
| c | **Queue placement as classifier** — routing varying by reporter's UG status could label the reporter class | Placement is only observable to tiers that can see the destination queue; regular admins see neither the escalated queue nor any residue of the case (it never lands in their queue at all — absence is unobservable). |
| d | **Audit surface** — Audit Log is readable by ANY admin via the dashboard (tier matrix, locked 2026-06-30) | Report audit rows never carry reporter ids or UG markers in `accessed_by`/meta (§7.2): `accessed_by=NULL`, `triggered_by='leader_report'`, meta = `report_case_id` refs only. Identity resolution requires the tier-gated report tables. The §10.13 audit-UX ticket inherits this redaction discipline. |
| e | **Reach-out quoting** — admin clarification DM to the reporter naming the reported party's real identity (which the reporter may only know masked) | Reach-out templates reference "the content you raised" + the reporter's own words; never resolved names/churches/regions of other parties. CONTENT lane constraint; reuses the locked UG-scrub email-fallback discipline. |
| f | **Client-side masking dependence** — the intake path must not repeat the `useResolvedLeaderAuthor` pattern (client fetching raw rows and masking in JS — pending SEC panel) | Intake needs no author resolution at all client-side; server snapshots from the DB. The pending NetworkFeed panel is unaffected and stays separately scoped. |

---

## 4. Abuse of the reporting channel

### 4.1 Dedupe — N reports = one case

One **open** `report_cases` row per `(target_kind, target_id)` (DB partial-unique index). Every report either opens the case or attaches to it; `distinct_reporter_count` increments; the same reporter re-reporting the same open target is idempotent (uniform success, no new row weight). **Dedupe is DB-side and therefore survives rate-limiter infrastructure outage — it, not the rate limit, is the primary bombing control.** A closed case's target can be re-reported (new case, prior case linked for reviewer context).

### 4.2 Report-bombing does not bury anyone

**INVARIANT: no report count, velocity, or reporter set ever auto-actions content** — no auto-hide at N, no auto-escalate-severity, no ranking demotion. Human review only (this is also all Apple/Play require: mechanism + timely human action). Coordinated bursts are made *visible* instead: intake sets `burst_flagged=true` on shape triggers (recommend: ≥3 reports on one target inside 10 minutes, or ≥5 distinct reporters inside 24h) rendered as a reviewer-skepticism cue ("Coordinated pattern possible"), not a severity boost. A mob's output is one case with a suspicious shape.

### 4.3 Self-serving reports mid-conflict

The case drawer (super_admin + Manager, via the existing justified 5+5/full-thread expand) shows bidirectional context — a reviewer weighing a DM report sees whether reporter and reported are mid-argument. No automation attempts to score this; the tier that can see identity is the tier equipped to judge motive. Regular admins triaging a (non-UG) DM report case without reporter identity still see the message line + reason code — enough to clear obvious non-violations or escalate.

### 4.4 False-report posture — pastoral, pattern-tracked, never punitive-by-default

- Regular-queue report cases get their own disposition tokens (new table, so no CHECK conflict): `cleared_no_violation` · `actioned` · `duplicate_superseded` · `report_unfounded` · `escalated`. **Cleared/denied paths write audit rows identically to actioned paths (§7.2)** — a cleared leader's file shows the clearance.
- `report_unfounded` (reserved for bad-faith/reckless, distinct from good-faith `cleared_no_violation`) feeds a per-reporter rolling aggregate — visible ONLY behind the §2 justified identity expand: "This reporter: N reports / M unfounded / 90d."
- Threshold (recommend ≥3 unfounded in 90d) surfaces a pastoral cue chip → the response is the existing reach-out ceremony (a conversation about the report tool), never an automatic sanction, never a filing block. Sanctioning reporters mechanically is how real victims learn to stay silent; pattern data goes to human pastoral judgment, consistent with the pastoral-axis warning doctrine.

---

## 5. (folded into §4 — numbering preserved for panel cross-reference)

---

## 6. Content snapshotting — snapshot-plus-reference, once per case

**Recommendation: capture BOTH a verbatim server-side snapshot (at case-open) and the live row reference.**

1. **Why snapshot:** every reportable table carries soft-delete (`is_active` on messages/prayer_requests/testimony; comment delete confirmed; church profiles mutable via `update-church`). Reference-only evidence evaporates exactly when the reported party cleans up — edit/delete-proof evidence is the point. Snapshot is taken **from the DB by the edge function**, never accepted from the client (client-supplied "content" is forgeable evidence-poisoning).
2. **Why once per case, not per report:** N reports duplicate nothing; one snapshot at case-open (first report). Bounded duplication: one text copy per reported target, ever.
3. **Retention:** indefinite, aligned with the Founder-ruled 2026-07-03 indefinite audit retention and the already-disclosed content-plane forever-retention (v0.3 discloses both). Report snapshots are review-evidence class; they do NOT get a divergent lifecycle. On account deletion the snapshot survives de-attributed, exactly like the content plane (author FK points at the scrubbed user row).
4. **Sensitivity inheritance:** the snapshot inherits source sensitivity — deny-all client RLS, BE tier-gated reads, UG-involved snapshots only via Escalated-Cases endpoints (§3.3b). `snapshot_meta` records the attribution *as the reporter saw it* (masked/anon label, `is_masked` state) alongside the true author FK — reviewers see both what was shown and who it was, at the tier entitled to each.
5. **Scope check:** no encrypted surfaces are reportable (heartcry is a private leader→team channel, not peer-visible UGC; UG evidence Posture C untouched) — so snapshotting never duplicates ciphertext or forces decrypt paths.

---

## 6b. Data model — SEC constraints (BE+ADMIN owns final DDL)

- **`content_reports`** (one row per report): `id, case_id FK, reporter_user_id NOT NULL, reason_code, note text NULL (≤500, scrubAndCap'd), status ∈ (attached | intake_rejected | superseded), created_at`. Partial-unique `(reporter_user_id, case_id) WHERE status='attached'`. Rejected intakes (invalid/not-visible targets) are stored here with `status='intake_rejected'` — reconnaissance forensics live tier-gated, not in any queue.
- **`report_cases`** (one per target under review): `id, case_ref ('RC-'||6 alphanum, mirroring EC-XXXXXX), target_kind CHECK ∈ (dm_message | branch_message | prayer_request | testimony | comment | church_profile), target_id, target_author_user_id NULL, snapshot_content, snapshot_captured_at, snapshot_meta jsonb, ug_involved boolean NOT NULL, routed ∈ (regular | escalated), escalated_case_id FK NULL, state, distinct_reporter_count, burst_flagged, first_reported_at, last_reported_at, disposition, disposition_note (≥30 chars when closing, house pattern), reviewed_by, reviewed_at`. Partial-unique open-case per `(target_kind, target_id)`.
- **RLS: enabled with ZERO client policies on both tables** (service-role only; console-opacity doctrine — BE gates are load-bearing). Not added to any Realtime publication.
- Message-target cases MAY additionally mirror a `moderation_state` admin-axis row for queue reuse (safe: not in publication, admin-only RLS, `meta` scrubAndCap per watched-invariant #17) — but `report_cases` is the canonical spine, because `moderation_state.message_id` is a NOT-NULL PK component (verified live) and cannot carry the other four surfaces.

---

## 7. Intake endpoint (`submit-report` edge function) — validation, rate limits, audit

### 7.1 Auth + validation (all server-side)

1. `verify_jwt` + active-user predicate mirroring `messages_insert` RLS (`is_active=true AND soft_deleted_at IS NULL`, verified live) — deactivated/soft-deleted users cannot file.
2. Payload: `{surface, target_id, reason_code, note?}`. `reason_code` from a **public** leader-facing reason list (CONTENT/MOD own wording) that maps server-side onto taxonomy codes for queue rendering (`threats`, `hate_or_targeting`, `spam_pattern`, `financial_exploitation`, `self_harm`, plus the three manual codes `idolatry_promotion`/`occult_reference`/`drunkenness` — which exist pattern-less precisely for manual flagging, satisfying live KAN-261's presumed Flag-modal dependency). Report reasons are public vocabulary; **FLAG_TAXONOMY pattern secrecy (AC-12) is untouched** — reasons name categories, never patterns.
3. `note` optional (a frightened reporter is never forced to compose prose — deliberate contrast with the admin ≥30-char escalation floor), ≤500 chars, scrubAndCap'd.
4. **Visibility check — you can only report what you can see** (service role bypasses RLS, so explicit per-surface predicates): DM → reporter ∈ {sender, receiver}; branch message → reporter is an active `branch_members` row holder; prayer/testimony → row `is_active` and network-visible; comment → parent announcement published; church_profile → church browsable. Failure → `status='intake_rejected'` row + audit, **uniform 200** (§1.2).

### 7.2 Audit rows (append-only `audit_log`, service-role insert — verified policy) — full lifecycle including denied/cleared

| Token | When | Meta discipline |
|---|---|---|
| `report_filed` | accepted intake | `report_case_id`, surface, reason_code, `dedup: opened\|attached` — **no reporter id, no target-author id, no UG marker**; `accessed_by=NULL`, `triggered_by='leader_report'` (audit page is any-admin-readable — §3.3d) |
| `report_intake_rejected` | invalid/not-visible target; validation fail | rejection class only; forensic linkage via `content_reports` row |
| `report_ratelimit_denied` / `report_ratelimit_skipped` | 429 issued / limiter outage fail-open | mirrors existing rate-limit audit patterns |
| `report_case_reviewed` | admin opens case drawer | `accessed_by=admin` (admins are accountable by name — existing pattern) |
| `report_reporter_identity_viewed` | §2 justified expand | justification ≥50 chars, permanent |
| `report_case_outcome` | every disposition **including `cleared_no_violation` and `report_unfounded`** | disposition token + action refs; content/5+5 expands keep their own existing audit rows |
| `report_case_escalated` | routed/escalated to Escalated Cases | escalated_case ref; UG auto-route provenance token |

### 7.3 Rate limits (Upstash, mirroring the send-message REST pattern in-repo)

- Per reporter: **10 reports / rolling 24h** + burst **3 / 10 min** (generous for legitimate use; makes bombing inefficient). Numbers are panel-tunable.
- Per (reporter, open case): 1 — idempotent attach (DB-enforced, not Redis).
- Per target across reporters: **unlimited** — one leader's throttle must never block another's report; volume collapses into the case counter anyway.
- Limit tripped (limiter live): honest **429**, copy referencing only the reporter's own rate ("You've filed several reports recently…" — CONTENT lane; never "too many reports on this item," which is a target oracle).

### 7.4 Fail posture

- Validation and visibility failures: **fail-closed** (discard + forensic row) behind the uniform 200.
- **Rate-limiter infrastructure outage: recommend fail-open with SOC alarm** (accept the report, `report_ratelimit_skipped` warn), NOT fail-closed. Reasoning against the house fail-closed-on-abuse-surfaces rule, honestly argued: that rule hardens *unauthenticated* intake (anon RPCs, pre-UAT audit). This surface is authenticated, and its primary bombing control is DB-side dedupe (§4.1) which functions during a Redis outage — whereas fail-closed silences genuine abuse victims for the duration. A dropped safety signal is the worse failure. Founder decision 4 if the panel wants strict precedent-consistency instead.
- DB write failure: honest 5xx + client retry affordance — never silently swallow a safety report.

### 7.5 Leader-side auth posture

No AAL2/step-up on intake (the leader app has no MFA tiers; the 4-tier MFA freshness ruling is admin-dashboard scope). Admin-side report-case endpoints inherit the locked freshness map (browse 30min; dispositions 30min; Manager approvals 5min step-up) and the `assertAtLeast` tier-gate primitive with the `_tier_denied` audit row on failure.

---

## 8. Church-profile stub + sister actions (flagged, not designed here)

**Church-profile flag stub (`ChurchProfileBottomSheet.tsx:334-336`) — fix-or-remove rides this build. Recommend FIX:** wire as the sixth surface (`target_kind='church_profile'`, org-shaped reasons: impersonation/fake church, safety concern, inappropriate profile content; UG church → auto-route per §3.1). If MOD descopes church reports, the icon is REMOVED this build — a silent-success toast in a safety flow is a lie to a reporter and must not survive either way.

One line each:

1. **Block user (store blocker #3):** must sit beside Report in the same action sheet; **live-DB correction — no `blocked_users` table exists in any schema (information_schema sweep 2026-07-07); the audit's "exists DB-side, unwired" is stale** — the block panel starts from zero DDL; needs its own SEC/DBA panel per suspension-lifecycle precedent.
2. **`connection_requests.message`** is a sixth freeform-text surface (table verified live) with no report affordance — MOD scope call this build or explicit defer.
3. **Local hide-on-report** deliberately excluded (§1.4 artifact risk) — if product wants "don't show me this again," it is a separate decision with its own device-artifact analysis.
4. **Announcements** are admin/Replant-authored — outside UGC report scope; a "report a problem" feedback channel is a different feature.
5. **`useResolvedLeaderAuthor` client-side masking** (pending SEC panel) — intake avoids the pattern entirely (§3.3f); the pending panel stays separately scoped.
6. **Audit Log admin-UX ticket (§10.13)** must inherit the §7.2 meta-redaction discipline when it builds filters/exports.
7. **Housekeeping (pre-existing, surfaced by tooling during introspection):** `public.spatial_ref_sys` has RLS disabled — it is the standard PostGIS reference catalog (8,500 spatial definitions, zero user data), read-only exposure; note for DBA backlog, do not blind-enable RLS without policies.

---

## 9. Founder decisions (≤5, each with recommendation)

1. **Reporter identity tier.** Recommend: regular admins never see reporter identity (count + "a leader" only); super_admin + Manager via justified ≥50-char expand, audit-permanent (mirrors the locked 5+5 model). Alternative — hard-never for all tiers — kills false-report pattern review and clarification reach-out.
2. **UG-reporter auto-route.** Recommend: YES — extend the locked sender-OR-receiver UG auto-route to any UG party including the reporter; a UG reporter's identity must never enter a regular-tier queue.
3. **Snapshot policy.** Recommend: snapshot-plus-reference, once per case, server-captured, indefinite retention aligned with the 2026-07-03 ruling, deny-all client RLS. Alternative reference-only loses evidence to soft-delete/edit exactly when it matters.
4. **Rate-limiter outage posture.** Recommend: fail-open with SOC alarm (DB dedupe is the real bombing control; fail-closed silences victims during infra outages). Alternative: strict fail-closed for precedent-consistency with anon-RPC hardening.
5. **Church-profile flag.** Recommend: FIX as sixth surface (org-shaped reasons) rather than remove — but the silent-success stub dies this build regardless of which way this goes.

---

*Evidence: live `pg_publication_tables` + `pg_policy` + `pg_constraint` + `information_schema` introspection of `jiyetphxxvyiicrnwlnx` (2026-07-07, SELECT-only); `supabase/functions/send-message/{taxonomy,post-flag-effects}.ts`, `_shared/taxonomy-codes.ts`; `src/components/connect/DMThreadView.tsx:629-677`; `src/components/church/ChurchProfileBottomSheet.tsx:334-336`; `docs/audits/2026-07-03-compliance-a11y-store-audit.md` §2.2; locked rulings: escalated-cases workflow (2026-06-30), audit-transparency 5+5 (2026-06-30), indefinite audit retention (2026-07-03), admin tier matrix (2026-06-30). To God be the glory — may the one who raises a hand about harm be kept safe in the raising of it. In Jesus' name.*
