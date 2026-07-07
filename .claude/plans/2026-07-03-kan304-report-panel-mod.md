# KAN-304 — Leader-facing report mechanism — MOD lane (reason taxonomy + routing)

**Panel:** SEC + MOD + BE/ADMIN + CONTENT (parallel lanes). This is the MOD verdict.
**Ticket (live-Jira verified 2026-07-07):** KAN-304 "Leader-facing report mechanism on every UGC surface (Apple 1.2(b) + Play UGC)" — Backlog, `store-blocker`, parent KAN-301. KAN-261 "extend FLAG_TAXONOMY to cover financial solicitation" (Backlog) folds in per KAN-304's own description. KAN-291 wordlist ship is independent — nothing here waits on it.
**Posture:** compose with existing machinery; no parallel moderation system. DELIVER-ALWAYS analog holds: report submission never blocks, never fails visibly on routing errors.

---

## 1. Verified machinery this design composes with (all checked in repo/live DB this session)

1. **Auto-scan taxonomy v1.0.0** — 24 codes (21 auto / 3 manual), `supabase/functions/_shared/taxonomy-codes.ts`; 10 tier-1 persecution-safety codes populated, 11 auto codes empty pending KAN-291. Locked ruling (`.claude/plans/sme-synthesis-wordlist.md:17-21`, 2026-06-30): `false_teaching` flips auto → manual for cross-tradition fairness (Apostles' Creed floor; human adjudication only). Manual-source codes carry zero patterns by design — adding manual codes does NOT depend on KAN-291.
2. **Flag storage** — `messages.flagged` bool + `flag_reason` + `flag_status` CHECK ∈ {cleared, escalated} (live constraint); `moderation_state` axis ∈ {admin, pastoral}, status ∈ {pending, seen, cleared, escalated, dispositioned, deferred}; meta carries `matched_codes` only (pattern secrecy, SEC c.11750).
3. **Queues** — /flagged (Flagged Messages), /pastoral (Pastoral Signals + Replant Team Inbox tab), Escalated Cases (Manager + super_admin only, anti-gossip rule).
4. **UG auto-route** — `fn_auto_route_ug_flagged` / `fn_auto_route_ug_pastoral` (migration `20260701000003`): UG-touched items must never land on /flagged or /pastoral; escalated_cases row with `source_axis='auto_underground'`.
5. **Escalated Cases vocabulary (live)** — state {open, awaiting, replied, pending_proposal, closed}; source_axis {flagged, pastoral, auto_underground}; escalation_reason {destructive_needed, pattern_multi_flag, pastoral_judgment, cross_tier, unsure, auto_underground}; closed_disposition {resolved_by_reach_out, resolved_no_outreach, false_signal, routing_misclassification, access_revoked, restriction_applied, escalated_to_higher, pending_external}; proposals ceremony (1-sponsor-1-Manager, no self-approve, actions {restrict_temporarily, revoke_access, escalate_to_manager}).
6. **Reach-out machinery** — Reach Out via Connect DM; Replant Team thread + `send-team-reply`; audit action `replant_team_reply_sent`.
7. **Surfaces** — DMs and branch messages both live in `public.messages` (send-branch-message inserts there, so message-plane machinery covers both); `prayer_requests`, `testimony`, `comments`, `announcements` tables live; church-profile report stub is toast-only (`ChurchProfileBottomSheet.tsx` `handleReport`); prayer requests inherit `users.anonymous` at post time.
8. **Retention ruling (Founder, 2026-07-03)** — NO age-out; indefinite retention for ALL audit/safety classes, disclosed in privacy v0.3.

---

## 2. User-facing reason list (8 entries; leaders are not moderators)

Design principles: (a) reasons name what the LEADER saw, not what the classifier calls it; (b) accusation-shaped AND concern-shaped reasons — on a pastoral platform, "report" must also be a way to raise a hand FOR someone; (c) every reason maps onto the internal taxonomy so admin tooling, trend detection, and forensics stay on one spine; (d) copy below is working draft in the SEC register — CONTENT lane + Founder ratify final strings (this discharges KAN-261 scope item 4).

| # | Leader-facing reason (draft copy) | Internal class | Maps to taxonomy codes | Notes |
|---|---|---|---|---|
| R1 | **"Trying to find out who or where someone is"** | SAFETY | `identity_probe`, `location_disclosure`, `opsec_violation` | Persecution-safety. Highest routing everywhere. |
| R2 | **"Threatening, intimidating, or pressuring"** | SAFETY / PRIORITY | `threats`, `imminent_threat`, `recantation_pressure`, `bribery_attempt`, `hate_or_targeting` | Directness rule in §4 decides band. |
| R3 | **"Asking for money or financial pressure"** | MISCONDUCT | NEW manual code `financial_solicitation` (+ auto siblings `fundraising`, `financial_exploitation` union under one admin chip family) | KAN-261 folded in. Aggregation-sensitive (§5). |
| R4 | **"Not who they claim to be"** | MISCONDUCT | NEW manual code `impersonation` (T2, admin) | No existing code covers being impersonated (identity_probe is probing others). Infiltration pre-step in persecution contexts; also the clergy-scam opener. |
| R5 | **"False teaching or spiritual manipulation"** | MISCONDUCT (human-only) | `false_teaching` (manual per locked ruling), `spiritual_coercion`, `divisive_speech` | NEVER auto-actioned, never auto-prioritized by content; human review only; Apostles' Creed floor. The locked fairness ruling governs. |
| R6 | **"Spam or a scam link"** | LOW | `spam_pattern`, `external_link` | Lowest band. |
| R7 | **"I'm concerned for this person's safety or wellbeing"** | PASTORAL | `pastoral_care_signal`, `self_harm` (pastoral axis); free-text scan may surface `duress_signal` / `urgent_safety_request` (admin T1) | The concern-shaped reason. Routes to Pastoral, not Flagged — reporting a brother's despair is not an accusation. |
| R8 | **"Something else"** | TRIAGE | none at intake; admin re-buckets via the manual-tagging affordance (wordlist doc §manual-tagging) | Free text REQUIRED here (optional elsewhere). |

Two new manual-source codes total (`financial_solicitation`, `impersonation`). Both pattern-less by design; taxonomy version bump coordinates with KAN-291's 1.2.0 ship but does not wait for it.

---

## 3. Per-surface applicability matrix

| Surface (entry point) | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 |
|---|---|---|---|---|---|---|---|---|
| DM message (long-press) | Y | Y | Y | Y | Y | Y | Y | Y |
| DM conversation (thread header; pairs with the block-user companion ticket) | Y | Y | Y | Y | Y | Y | Y | Y |
| Branch message (long-press) | Y | Y | Y | Y | Y | Y | Y | Y |
| Prayer request | Y | Y | Y | Y | Y | Y | Y | Y |
| Testimony | Y | Y | Y | Y | Y | Y | Y | Y |
| Comment | Y | Y | Y | Y | Y | Y | Y | Y |
| Church profile (replaces the toast stub) | Y | — | Y | Y* | — | Y | — | Y |

*R4 copy variant on church profiles: "Not a real church or misrepresenting itself."

Reason ORDER differs by surface class (cheap, changes what gets filed):
1. Thread surfaces (DM, branch): R1, R2, R3, R4, R5, R6, R7, R8 — safety first.
2. Content surfaces (prayer, testimony, comment): R7 first, then R2, R1, R3, R4, R5, R6, R8 — concern-shaped lead on pastoral surfaces.
3. Church profile: R4*, R3, R1, R6, R8.

Anonymity interaction: reported items authored anonymously ("A fellow [Role]") resolve the true author server-side at intake; the reporter never learns identity, and queue visibility follows the author's actual UG/anon state, not the display state.

---

## 4. Routing rules (reason × surface × UG-involvement)

**UG-involvement definition for reports:** UG party = ANY of {reported author, other DM/branch participant, reporter}. Reporter-UG matters: a UG leader's report must not create a /flagged row that exposes their existence to regular admins. UG-involved reports go ONLY to Escalated Cases — mirroring `fn_auto_route_ug_*` semantics, but enforced at report-intake write time (not via the escalation-flip trigger), plus a defensive UG exclusion in the /flagged report view. BE lane owns wiring.

**Safety-critical class (escalated two-person handling REGARDLESS of UG):**
1. R1 — always. A solo wrong "cleared" on an identity/location probe is a life-safety failure mode. Every R1 report opens an Escalated Case directly.
2. R2 — when the reported item is inside the reporter's own DM or branch thread (a direct threat against the reporter). R2 on public-ish surfaces (comments, prayers, testimonies) → /flagged PRIORITY band instead. Directness is decidable without content parsing.
3. Any report whose free-text scan (§7) fires a tier-1 code — dual-routes into the same escalation.

This deliberately reuses the room where two-person culture already lives (proposals ceremony, anti-gossip visibility) rather than inventing a second-signature mechanic on /flagged. Side benefit: for the most dangerous class, UG and non-UG reports are handled identically — no traffic-analysis signal in admin behavior. Volume guard: `routing_misclassification` disposition (exists) is the relief valve if false-positive safety reports accumulate.

**Routing table:**

| Reason | Non-UG route | Band | UG-involved route |
|---|---|---|---|
| R1 | Escalated Cases (auto-open) | IMMEDIATE | Escalated Cases |
| R2 (own thread) | Escalated Cases (auto-open) | IMMEDIATE | Escalated Cases |
| R2 (public surface) | /flagged | PRIORITY | Escalated Cases |
| R3 | /flagged | STANDARD (bumps to PRIORITY on pattern rule §5) | Escalated Cases |
| R4 | /flagged | STANDARD | Escalated Cases |
| R5 | /flagged, human-only lane | STANDARD (never auto-bumped by content) | Escalated Cases |
| R6 | /flagged | LOW | Escalated Cases |
| R7 | /pastoral (moderation_state axis='pastoral') | Pastoral T1 alert path if free-text scan fires T1; else digest | Escalated Cases |
| R8 | /flagged triage | LOW until re-bucketed | Escalated Cases |

**Band language (no SLA, no time promises — anywhere, ever):** IMMEDIATE / PRIORITY / STANDARD / LOW are queue-ordering tokens. Admin UI copy: "reviewed first," "reviewed next," "reviewed in turn." Leader-facing copy never states a timeframe.

**Composition notes for sibling lanes (not Founder decisions):**
1. Auto-opened safety cases need either a fourth `source_axis` value `leader_report` (recommended — honest provenance chip) or reuse of `'flagged'`; plus one new `escalation_reason` token `report_safety_class`; plus amending `escalated_cases_auto_route_consistency` CHECK to admit system-created (`auto_routed=true, escalated_by_user_id NULL`) rows for this axis. DBA/BE lane rules the shape.
2. R7 rides the existing pastoral emit machinery (digest + T1 alert + per-leader Upstash rate cap) untouched.
3. Announcements are Replant-authored (not UGC) — no report affordance. Persecuted-tab witnesses likewise.

---

## 5. Aggregation semantics

1. **One row per reported item.** N reports on the same message/prayer/testimony/comment/profile collapse into one queue row. `report_count` = distinct reporters (the weight); reasons union as chips; the HIGHEST-severity reason among all reports governs routing (one safety-class report escalates the whole item).
2. **Same-reporter re-report of the same item** = update, not increment (latest reason/free text kept, prior preserved in audit). Distinct-reporter counting is the anti-inflation guard.
3. **Band bump:** ≥2 distinct reporters on one item → one band up (LOW→STANDARD→PRIORITY). Safety class is already terminal.
4. **Actor-level pattern (the KAN-261 trend concern):** rolling 30-day window per reported author across items and surfaces. Threshold: ≥3 distinct reporters OR ≥3 distinct reported items → auto-open one pattern case in Escalated Cases with existing `escalation_reason='pattern_multi_flag'`, linking all member reports. Financial (R3) threshold: ≥2 (scam campaigns move fast; this is the exact "3 leaders reported this person this month" surfacing KAN-261 asked for). Queue rows for that actor carry a chip: "3 leaders · 3 items · 30 days."
5. **Item already in an open case** (incl. UG auto-routed): new reports ATTACH as case activity — never a second case row (mirrors the existing one-case-per-source_message_id idempotency).
6. **Report-abuse guard (reports are themselves an attack surface):** mass-reporting is a known hostile-actor vector for getting a UG leader restricted. Pattern thresholds count only verified-active reporters; reports from accounts under 7 days old count toward visibility but not toward auto-thresholds; `false_signal` case dispositions decrement the reporter's weight in future threshold math. SEC lane owns submission rate limiting (Upstash pattern exists).

---

## 6. Outcome vocabulary (admin dispositions on a report row)

Composes with — never duplicates — the escalated-cases tokens. Destructive outcomes live ONLY in the case/proposal ceremony.

| Report disposition | Meaning | Composes with |
|---|---|---|
| `cleared` | Reviewed by a person; no violation | `flag_cleared` audit lineage |
| `pastoral_follow_up` | No violation; shepherding need; hands to /pastoral or Reach Out | Reach-out machinery, pastoral signal row |
| `warning_sent` | Replant Team message sent to the reported leader | Replant Team thread / `replant_team_reply_sent`; SEC-register copy, plain not coddling |
| `escalated_to_case` | Opened/attached to an Escalated Case; report row links `case_id`; final outcome then derives from the case's `closed_disposition` (access_revoked, restriction_applied, etc.) — no parallel "actioned" token on the report row | escalated_cases lifecycle + proposals ceremony |
| `duplicate_merged` | Housekeeping: collapsed into an existing item row or case | aggregation §5 |

Every disposition writes an audit row (naming style: `report_submitted`, `report_cleared`, `report_warning_sent`, `report_escalated`, `report_merged` — BE lane extends `audit_log_action_check` per the established DROP/ADD pattern). Minimum-length disposition notes mirror the 30-char discipline from escalated cases on `warning_sent` and `escalated_to_case` only; `cleared` stays one-tap.

---

## 7. Free-text field

1. **Presence:** optional on R1–R7, required on R8 (floor ~20 chars); cap 500 chars (mirrors proposals `reasoning` cap).
2. **Scan:** YES — through the same FLAG_TAXONOMY matcher pipeline, same DELIVER-ALWAYS posture (scan failure never blocks submission). Rationale: reporter free text is exactly where duress leaks ("they keep asking where we meet"). Tier-1 hits dual-route per §4; pastoral hits can fire the T1 alert path. Pattern secrecy preserved: the report row stores matched code NAMES only, never patterns (AC-12 / SEC c.11750 posture).
3. **Retention:** indefinite — reports are safety reads; the 2026-07-03 Founder ruling (no age-out, all classes) applies to report rows and their free text. Privacy v0.3 gains one disclosure line ("reports you file, including your description, are retained as safety records") — CONTENT/LEGAL lane carries it into the v0.3 brief.
4. **Visibility:** free text follows the report row's queue tier. UG-involved report free text is visible ONLY inside Escalated Cases (Manager + super_admin).

---

## 8. Reporter feedback loop (honest minimum)

1. **At submission:** one confirmation sheet — "Your report is with the Replant team. Every report is reviewed by a person." No timeframe. For R1/R2 the sheet adds one safety-steering line (CONTENT lane drafts; plain register, no coddling).
2. **Never outcomes about another leader.** No "we took action," no status updates, no notification on disposition. This extends the Escalated Cases anti-gossip rule to reporters, and in persecution contexts outcome-feedback is a retaliation and confirmation vector. Where an outcome protects the reporter directly (restriction on their own thread), they see the effect organically in-thread — not via notification.
3. **No "my reports" history surface at MVP.** A device-resident list of who-I-reported fails the seized-device test for both reporter and reported (UG posture). The confirmation is ephemeral; the server keeps the record. Industry-standard report inboxes (outcome pings, history tabs) are deliberately rejected here — genuine-verdict note: this is the one place MOD overrides common practice, and it is load-bearing, not stylistic.
4. **Store-compliance floor is met** by the visible affordance + confirmation + human review — Apple 1.2(b)/Play require a mechanism and moderation, not reporter status tracking.

---

## 9. Intake shape (one-paragraph sketch for BE/ADMIN lane — theirs to rule)

`content_reports`: id, reporter_user_id, target_type ∈ {message, conversation, prayer_request, testimony, comment, church_profile}, target_id, reason_code (R1–R8 enum), mapped_codes[], free_text, free_text_matched_codes[], band, status ∈ {open, cleared, pastoral_follow_up, warning_sent, escalated_to_case, duplicate_merged}, case_id NULL, created_at, dispositioned_by/at/note. Deny-all RLS, SECURITY DEFINER RPC intake (verify_jwt posture), UG check inside the intake transaction, aggregation counters as a view not a table. Church-profile stub (`ChurchProfileBottomSheet.handleReport`) rewires to this intake — fix-or-remove resolved as FIX.

---

## 10. Founder decisions (5, with recommendations)

1. **Reason list + copy register.** Ratify the 8 reasons in §2 (this also discharges KAN-261's copy item — "Asking for money or financial pressure" over "Financial solicitation / scam"). RECOMMEND: approve list as drafted; CONTENT lane finalizes strings.
2. **Safety-class destination.** R1/R2-direct auto-open Escalated Cases (two-person room, Manager + super_admin only) vs a /flagged top band with a new second-signature-to-clear mechanic. RECOMMEND: Escalated Cases direct — reuses the existing ceremony and keeps UG/non-UG handling indistinguishable; accept the small schema amendments in §4.
3. **Reporter feedback ceiling.** Confirm the honest minimum: confirmation-only, no outcome disclosure, no report history surface at MVP (seized-device rationale, §8). RECOMMEND: confirm.
4. **Warning vocabulary + authority.** `warning_sent` (plain) vs `guidance_sent` (softer); and whether a single admin may send it for non-safety classes (safety classes are already two-person by §4). RECOMMEND: `warning_sent`, single-admin for non-safety classes, SEC-register copy.
5. **Pattern thresholds.** 3 distinct reporters OR 3 items / 30 days (2 for financial R3); ≥2 reporters on one item = band bump; under-7-day accounts excluded from auto-thresholds. RECOMMEND: ratify these numbers as launch calibration, revisit after live volume exists.
