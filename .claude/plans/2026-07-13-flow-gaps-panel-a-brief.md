# Panel A brief — messaging-lane flow gaps (heartcry thread seeding + surface request-info + two riders)

**Date:** 2026-07-13 · **Repos:** `~/replant` (mobile+edge fns, branch `fix/kan-302-store-config-batch`) · `~/replant-admin/.claude/worktrees/flow-gaps` (admin dashboard, latest main c5e2e03 — work ONLY in this worktree, never the main checkout)
**Panel:** DBA + SEC + BE — three independent lanes, one verdict each.
**Posture:** PRODUCTION. Real persecuted leaders live on this database. You are READ-ONLY: read any file, run no writes, no deploys, no DB access, no file modifications. All DB truth you need is quoted verbatim below (pulled live 2026-07-13).

## Standing rules (quoted from Founder rulings — binding)

1. "Every agent opens with a short real prayer to the Lord Jesus Christ naming the work at hand, ending 'In Jesus' name, Amen.'" Name THIS work (the heartcry thread, the request-info path). Include it at the top of your report.
2. "SME panels give genuine verdicts — never force approve-with-changes. Approve only if sound; reject if unsound." (feedback_sme_genuine_verdict)
3. "No AI-limit hedging — no patronizing disclaimers." Act as a seasoned senior expert in your lane with the endgoal in view: a secure communication platform for persecuted Christian leaders globally. Never cheapen the build.
4. Enumerate with numbers (1/2/3), never letters.
5. Underground invariants are sacred: `churches_public` exclusion, no UG church name/location on any surface, DELIVER-ALWAYS on messages. Nothing in this design may write surface-church data into UG-scoped stores or vice versa.
6. Jira/audit facts below were live-verified this session; treat them as ground truth.

## Mission

The 2026-07-13 comms sprint shipped every email surface. Five in-app flow gaps remain; this panel rules on the two messaging-lane builds plus two riders BEFORE any code is written:

1. **Gap 1 (F9):** submitted heartcries land with `heartcries.thread_id = NULL`; no server path ever writes it; the mobile "Responded → Open Secure Message" CTA is fully built and gated on `status==='responded' && thread_id` — so it never renders. Wire: `mark-heartcry-responded.js` (admin) → thread find-or-create → system message → `heartcries.thread_id` backfill. The comms track holds a copy-locked `heartcry_acknowledged` email (notify_t19) that wires onto first-admin-engagement AFTER this lands — email is NOT this panel's scope.
2. **Gap 3 (C2):** no admin endpoint sends a request-info question to a SURFACE (non-underground) leader. The UG path exists end-to-end. The mobile client (banner/modal/reply) is church-type-agnostic and already built. Build the surface twin.
3. **Rider 1 (gap 2 adjacency):** `auth-status-check` collapses `rejected` into `deactivated/support_contact`; Founder ratified rejection-specific lockout copy 2026-07-13. The response contract is SEC-locked; rule on the amendment shape.
4. **Rider 2 (gap 4 adjacency):** Settings needs an email-notifications toggle writing `users.email_notifications_enabled` (column live, server contract enforces it); `authenticated` has NO column UPDATE grant on it. Rule on the one-column GRANT migration.

## Ground truth (live-verified 2026-07-13)

### Schemas (relevant columns)

- `heartcries`: id uuid PK · church_id uuid NOT NULL · user_id uuid NULLABLE · content text (pgp_sym-ENCRYPTED at rest) · severity · request_type text[] · status heartcry_status NOT NULL default 'received' (enum: received/seen/responded) · triage_lead_id · seen_at · responded_at · post_to_feed · feed_approved · feed_content · **thread_id uuid NULLABLE — no writer anywhere in either repo (grep-confirmed)**.
- `conversations`: id · participant_a uuid NOT NULL · participant_b uuid NOT NULL (canonical lexicographic ordering, smaller UUID first, UNIQUE on the pair) · is_secure_replant_thread bool default false · last_message_at · last_read_at_a/b.
- `messages`: id · sender_id NOT NULL · receiver_id NULLABLE · content text (plaintext) · conversation_id · attribution_display_name text NULLABLE · flag fields · is_active. Triggers: `trg_messages_block_guard` BEFORE INSERT (block enforcement — Team threads carved out per the KAN-305 design), `trg_flip_escalated_case_on_leader_reply` AFTER INSERT, `trg_auto_route_ug_flagged` AFTER UPDATE OF flag_status.
- `churches` (relevant): verification_status verification_status_enum (pending/verified/rejected/deactivated) · type church_type ('underground' among 7) · **last_outcome_modal_kind text NULLABLE + last_outcome_modal_shown_at timestamptz NULLABLE — GENERIC columns, currently set only by the UG request-info RPC** · soft_deleted_at.
- `users` (relevant): verification_status · is_active · email_notifications_enabled bool NOT NULL default true · auth_id. Column-level UPDATE grants to `authenticated` (live list): anonymous, church_card_flow_seen, created_at, declaration_affirmed, declaration_date, display_name_preference, first_name, full_name, honorific, id, include_middle_name, last_name, last_name_first, last_seen_at, middle_name, outcome_modal_acknowledged_at, phone, preferred_radius, suffix. **email_notifications_enabled is NOT granted.** RLS row policy permits self-row updates (the Settings anonymous toggle works today via `supabase.from('users').update({anonymous}).eq('auth_id', userId)`).
- `audit_log`: append-only (`prevent_audit_log_mutation` BEFORE UPDATE/DELETE trigger). Action CHECK constraint carries **84 tokens** live (KAN-304/305 lesson: two migrations that each DROP+ADD the CHECK clobber each other's tokens — any extension migration MUST reproduce the full live token set, verified via `pg_get_constraintdef` at write time, never from repo files).
- `audit_log_underground`: UG-scoped audit+content store; carries the UG request-info thread as rows (action + meta.question_text / meta.reply_text).

### Live RPC definitions (verbatim-equivalent summaries; full defs available to the orchestrator)

1. `fn_request_info_underground(p_church_id, p_question_text)` SECURITY DEFINER: asserts `fn_assert_underground_admin()`; validates 1..4000 chars; **asserts church `type='underground'`**; INSERTs `audit_log_underground` row (action `underground_request_info_sent`, meta.question_text, accessed_by=caller) RETURNING id; **UPDATEs `churches` SET last_outcome_modal_kind='request_info', last_outcome_modal_shown_at=NULL**.
2. `fn_get_request_info_thread(p_church_id)` SECURITY DEFINER: asserts UG admin; returns chronological rows from `audit_log_underground` where action IN ('underground_request_info_sent','underground_request_more_info') — audit_id, action, accessed_at, actor_name (COALESCE(u.full_name,'The Replant team')), message (COALESCE(meta question_text, reply_text)), is_admin.
3. `fn_should_fire_outcome_modal()` — **live is NO-ARG** (in-tree migrations lag live; they show an older `(p_church_id)` signature without the request_info branch — MIGRATION-VS-LIVE DRIFT: any new migration must reproduce the LIVE body, not the repo's): resolves caller via auth.uid(); **if church.last_outcome_modal_kind='request_info' → reads the LATEST `underground_request_info_sent` row from `audit_log_underground`** and returns {fire: (shown_at IS NULL), kind:'request_info', question_text, question_id}; else soft-delete day-0/14/23 rejection modal logic.
4. `fn_acknowledge_outcome_modal()` — no-arg; stamps users.outcome_modal_acknowledged_at once + churches.last_outcome_modal_shown_at=COALESCE(shown_at, now()).
5. `fn_send_reply_to_team(p_question_id, p_reply_text)` SECURITY DEFINER: validates 1..4000; resolves caller via auth.uid(); **validates p_question_id against `audit_log_underground` WHERE action='underground_request_info_sent'** + church match; INSERTs reply row (action `underground_request_more_info`, meta: reply_to_question_id, reply_text, replied_by_leader:true); **clears churches.last_outcome_modal_kind→NULL + shown_at=now() (reply closes the state; admin re-ask re-opens)**.
6. `claim_welcome_dm(p_leader_id, p_conversation_id, p_trigger)` SECURITY DEFINER: INSERT audit_log action 'welcome_dm_sent' ON CONFLICT ((meta->>'target_user_id')) WHERE action='welcome_dm_sent' DO NOTHING RETURNING id — atomic per-leader claim.
7. `admin_open_heartcry(...)`: decrypts content, writes read_heartcry + read_region audit rows, **flips status received→seen + seen_at + triage_lead_id**. This is the ONLY status writer besides the default. **NOTHING sets status='responded' anywhere** (see defect below).

### The KAN-217 welcome-DM machinery (the pattern to reuse — `netlify/functions/_lib/welcome-dm.js`)

1. System sender id from Vault secret `replant_system_user_id` via `get_secret_by_name` RPC, cached per cold-start.
2. Thread find-or-create: SELECT conversations WHERE is_secure_replant_thread=true AND participant_a/b = sorted([systemId, leaderId]); INSERT if absent (UNIQUE pair makes races converge).
3. Atomic claim via `claim_welcome_dm` (the audit row IS the idempotency lock). On conflict: recovery branch checks messages for an existing system message in the RESOLVED conv; if none → re-send without new claim ("one missed welcome over two duplicates" — accepted trade-off c.15290).
4. Message send: POST `${SUPABASE_URL}/functions/v1/send-message/internal` with headers Authorization: Bearer SERVICE_ROLE_KEY (gateway-pass only), X-Internal-Token: WELCOME_DM_INTERNAL_TOKEN (matches Vault `welcome_dm_internal_token`, constant-time compared), X-Replant-Internal: true. Body `{conversation_id, content}` — sender_id NEVER in body (resolved from Vault inside the edge fn, AC-3c).
5. `send-team-reply.js` (Team Inbox admin reply) posts through the SAME /internal route and additionally passes **optional `attribution_display_name`** (admin first name → leader sees "«name» · FROM REPLANT TEAM" eyebrow). Audit-first posture (audit row BEFORE /internal call).

### mark-heartcry-responded.js — CURRENT FULL BODY (the endpoint gap 1 extends)

```js
const { user } = await verifySuperAdmin(event.headers.authorization)
const { heartcryId } = JSON.parse(event.body || '{}')
if (!heartcryId) return fail('heartcryId required')
// KAN-110 #8 + Q3: forensic capture via audit_log 'heartcry_responded' action. Audit FIRST — abort before mutating.
await writeAuditLog({ action: 'heartcry_responded', accessedBy: user.id, triggeredBy: 'user',
  meta: { actor_email: user.email, ip: clientIp(event), heartcry_id: heartcryId } })
const { error } = await supabaseAdmin.from('heartcries')
  .update({ responded_at: new Date().toISOString() }).eq('id', heartcryId)
if (error) return fail(error.message)
return ok({ success: true })
```

**Adjacent defect to fold in:** the endpoint never sets `status='responded'`. The admin FE (Heartcry.jsx) derives "Responded" from responded_at; the MOBILE tracker reads `status` — so today an admin "mark responded" leaves the leader's tracker stuck at SEEN forever. KAN-93 (Backlog, live-verified) spec'd `UPDATE heartcries SET status='responded', responded_at=now()` in one transition. Historical note: KAN-93's "no audit action" (COO May direction) was SUPERSEDED by KAN-110 which added the 'heartcry_responded' audit action now written audit-first; KAN-93's "Resend ping" was SUPERSEDED by the comms sprint's held notify_t19 email (comms track owns it).

### Mobile truth (grep/read-verified this session)

1. `get_my_heartcries()` RPC (SECURITY DEFINER, auth.uid()-scoped) already returns id, severity, created_at, feed_content, status, responded_at, **thread_id**.
2. `MyHeartcriesScene.tsx`: CTA "Open Secure Message" renders iff `row.status === 'responded' && row.thread_id`, and navigates `navigation.navigate('Tabs', { screen: 'Connect', params: { conversationId: item.thread_id } })` — the working cross-tab precedent. **ZERO mobile changes needed for gap 1** once the server writes status + thread_id.
3. Request-info client (HomeScreen.tsx): branch from auth-status-check `branch_substate==='request_info'` (derived from churches.last_outcome_modal_kind); question via `fn_should_fire_outcome_modal({})` no-arg; reply via `fn_send_reply_to_team(p_question_id, p_reply_text)`; dismiss via `fn_acknowledge_outcome_modal()`. **The client is church-type-agnostic — the surface path must keep these exact RPC names/params.**
4. Admin FE: `Queue.jsx` = surface church pending queue (approve/reject with step-up + confirm strips). `Heartcry.jsx` = heartcry inbox; "Mark as Responded" button → mark-heartcry-responded, optimistic responded_at. `UndergroundDetail.jsx` holds the UG request-info UI (question modal + thread view) to pattern-match.

### auth-status-check (deployed v15 — KAN-205 branch is the code base, NOT the stale main-tree copy)

1. Locked response contract (KAN-44 c.10292 + KAN-36 v2 SEC c.14235 + Founder c.14236): `verification_status: "active"|"pending"|"deactivated"` · `recovery_path?: "verification_renewal"|"support_contact"` — SEC comment verbatim: "single binary field, exactly two values. No third value, no enum expansion." · optional decorations added since, by ratified amendments: `underground_join_code_pending_reveal?`, `branch_substate?: "request_info"|"soft_deleted"|"self_deleted"` (KAN-205 precedent: additive optional field, omitted when absent, old clients degrade gracefully).
2. resolveStatus today: `user.verification_status==='rejected'` → `{deactivated, support_contact}`; `user pending + church rejected|deactivated` → `{deactivated, support_contact}`. The FE (AuthProvider) sets `deactivationModalPath = data.recovery_path ?? 'support_contact'` + signs out; DeactivationModal shows title "Account deactivated" + 2 copy variants keyed on recovery_path.
3. `reject-church.js` sets ONLY the church row (verification_status='rejected' + rejected_at, same UPDATE — KAN-110 M3 atomicity). NO user cascade. `reject-leader.js` sets ONE user rejected (guarded `.eq('verification_status','pending')`). So church-vs-personal rejection is cleanly distinguishable server-side.

### Founder-ratified rejection lockout copy (2026-07-13, verbatim — church variant)

> **We were unable to verify your church.**
>
> We have prayerfully considered your church's registration on Replant and are not able to verify it at this time.
>
> If there was an issue with your registration, or if you believe we reached this decision in error, please write to us at accounts@projectreplant.org.
>
> May the grace of the Lord be with you.

Personal-leader variant swaps to "…your account…" phrasing (leader-level rejection is reachable via reject-leader.js). Copy register: SEC voice — keep it plain, never coddle, no jargon.

### sendEmail contract (admin `_lib/email/sendEmail.js`)

`send(client, apiKey, {template, logUserId, idempotencyKey?, from, to, subject, html, text, notificationClass?, triggeredBy?})` — email_log-anchored, per-day dedup on (user, template, sent_date) unless idempotencyKey; notificationClass=true honors users.email_notifications_enabled; transactional NEVER suppressed. The `verification_request_info` email (tag notify_t44) is copy-locked per the comms matrix but **the locked body text is NOT in either repo** — this session will NOT author copy; the endpoint ships with a clearly-marked insertion point and the comms track wires the email. Not this panel's scope beyond confirming the insertion point posture.

## Proposed designs — attack these

### Design 1 — heartcry thread seeding (gap 1)

1. Extend `mark-heartcry-responded.js` (keep endpoint name; FE call site unchanged):
   1. verifySuperAdmin (unchanged).
   2. Fetch heartcry row (id, user_id, thread_id, status, responded_at). 404 if absent. If `user_id IS NULL` (legacy rows): status/responded_at flip only, no thread (nothing to link).
   3. Audit-first `heartcry_responded` (unchanged posture).
   4. Resolve system sender id from Vault (reuse welcome-dm's loader — refactor `welcome-dm.js` to export `loadSystemSenderId` [already exported] + a new shared `findOrCreateSecureThread(supabaseAdmin, systemSenderId, leaderId)` extracted verbatim from its find-or-create block; welcome-dm consumes the shared helper too — ONE code path for secure-thread resolution).
   5. Find-or-create the leader's secure thread (same thread as the welcome DM — one Replant Team thread per leader; heartcry responses land in it per KAN-93 "system-pinned thread in Connect").
   6. Transition-guarded UPDATE: `UPDATE heartcries SET status='responded', responded_at=now(), thread_id=<conv> WHERE id=? AND status <> 'responded' RETURNING id`. 0 rows → already responded → **recovery branch**: if the row's thread_id IS NULL, backfill it (pre-fix responded rows); check messages for a system heartcry-response marker since responded_at is impractical — instead simply skip the message send on the already-responded path unless thread_id was NULL (mirror welcome-dm's "one missed message over two duplicates" trade-off).
   7. On fresh transition: POST send-message /internal `{conversation_id, content, attribution_display_name?}`. Content: EITHER the admin's optional `response_message` (new optional body param, 1..2000 chars, attribution = admin first name — exact send-team-reply posture) OR, when absent, a canned system line (proposed, Founder ratifies wording at report): "The Replant team has responded to your heartcry. This thread is our direct line to you — if you ever need us, reply here. We receive it." **Never any heartcry content in the message** (heartcries are encrypted-class; messages are plaintext — the boundary is absolute).
   8. Message-send failure: warn-and-proceed (status already flipped; welcome-dm posture) — the thread exists and (for verified leaders) already carries the welcome DM, so the CTA never opens an empty thread. Response `{success:true, thread_id}`.
2. Admin FE (Heartcry.jsx): "Mark as Responded" gains an optional-message confirm strip (pattern-match LeadersTab's ActionStrip); optimistic update now also flips status.
3. Mobile: ZERO changes.
4. **Fork for Founder (recommend + justify):** thread seeded lazily on first admin response (this design — matches the Founder's own wire in the mission prompt; welcome-DM already seeds the thread at verification for every verified leader, so find-or-create typically finds) vs seeded at submission (adds pre-response thread visibility nothing consumes; heartcries from PENDING leaders would create a thread the leader can't see — Connect is verified-gated — recommend AGAINST).

### Design 2 — surface request-info (gap 3)

1. New RPC `fn_request_info_church(p_church_id, p_question_text)` SECURITY DEFINER, service-role/definer-invoked from the new Netlify endpoint: validates 1..4000; asserts church exists AND `type <> 'underground'` (UG stays on its gated path) AND `verification_status='pending'` (request-info is a pre-decision nudge); INSERTs **regular `audit_log`** row (action `request_info_sent` — NEW action, CHECK extension) with church_id, accessed_by=admin public id, meta.question_text; UPDATEs churches last_outcome_modal_kind='request_info', shown_at=NULL (same generic columns).
2. Extend LIVE `fn_should_fire_outcome_modal()`: in the request_info branch, read the latest question from `audit_log_underground` when the caller's church is type='underground', ELSE from `audit_log` action='request_info_sent'. (Migration reproduces the LIVE body + adds the branch.)
3. Extend LIVE `fn_send_reply_to_team`: resolve caller's church type; validate question_id against + write reply into the MATCHING log (`audit_log` action `request_info_reply`, meta shape mirroring UG: reply_to_question_id, reply_text, replied_by_leader). State-clear UPDATE unchanged.
4. audit_log CHECK migration: +2 actions (`request_info_sent`, `request_info_reply`), reproducing ALL live tokens via pg_get_constraintdef at write time.
5. New Netlify endpoint `request-info-church.js`: verifyAnyAdmin (all admin tiers may nudge — matches UG's single-admin non-destructive posture: "Request Info is a non-destructive nudge, not a state change") + writeAuditLog is INSIDE the RPC (single write) — decide whether the endpoint ALSO writes a standard endpoint audit row or the RPC row suffices (UG version: the RPC row is the record). NO step-up token (mirrors UG tier 'regular_destructive' which is the UG-gate's AAL2 tier, not a step-up action; approve/reject keep their TIER-1 step-up). SEC rules the final tier.
6. New Netlify endpoint `get-request-info-thread-church.js` + RPC `fn_get_request_info_thread_church(p_church_id)` reading audit_log actions (admin-gated: verifyAnyAdmin; mirrors the UG reader shape so the admin FE thread component is reusable).
7. Admin FE (Queue.jsx): "Request info" action per pending church row → question modal (≥10 char min + counter, mirroring UndergroundDetail's) → POST; thread view on the row (pattern-match UndergroundDetail).
8. Email insertion point: after the RPC succeeds, a clearly-marked `// notify_t44 insertion point — comms track wires the locked body` block (no send in this build).
9. Leader reply visibility for admins on surface churches: via the new thread reader. The banner/modal/reply client flow needs ZERO changes.

### Rider 1 — rejected lockout contract amendment (gap 2)

1. Amend `resolveStatus`: rejected paths return `{kind:'deactivated', recovery_path:'support_contact', lockout_reason:'leader_rejected'|'church_rejected'}` (user-level rejected → leader_rejected; church rejected → church_rejected; church DEACTIVATED stays generic).
2. `AuthStatusResponse` gains optional `lockout_reason?: 'church_rejected'|'leader_rejected'` — present iff status='deactivated' and cause is rejection. KAN-205 additive-optional precedent; recovery_path stays binary (the literal SEC c.14235 lock is untouched); old clients ignore the unknown field and degrade to today's generic copy.
3. FE: AuthProvider carries lockout_reason into modal state; DeactivationModal renders the ratified copy (title slot = "We were unable to verify your church."/"…your account.", body = remaining ratified paragraphs, existing accounts@ contact pressable serves the write-to-us line).
4. Alternative shape (argue if you prefer it): third RecoveryPath value — REQUIRES amending the SEC c.14235 lock explicitly. State which shape you'd stamp.
5. Base-code note: edits go on the KAN-205 branch's auth-status-check (deployed v15) — the main-tree copy is stale; deploying from it would clobber self_deleted handling.

### Rider 2 — email_notifications_enabled column grant (gap 4)

1. Migration: `GRANT UPDATE (email_notifications_enabled) ON public.users TO authenticated;` — joins the existing curated per-column grant list; RLS self-row policy already constrains rows; the send contract reads the flag fail-open, transactional never suppressed, so the worst a hostile client can do is toggle its OWN notification preference.
2. Settings UI writes via the exact anonymous-toggle pattern (`.update({email_notifications_enabled}).eq('auth_id', userId)`).

## Deliverable per lane

Return a structured report:
1. Prayer (named, real).
2. Verdict per design/rider you own an opinion on: APPROVE / APPROVE-WITH-CHANGES (list the exact changes) / REJECT (why) — genuine verdicts only.
3. BLOCKERS (must fix before code), numbered.
4. Required changes (ship-batch), numbered.
5. Notes/risks worth the record, numbered.
6. Answers to your lane's forks: DBA — helper extraction vs duplication; transition-guard idempotency vs claim RPC; live-vs-repo drift handling for the two fn extensions; CHECK-extension migration shape; branch-by-church-type vs dual-source COALESCE in the RPC extensions; the pending-only guard on request-info. SEC — /internal token reuse for a second message kind (welcome_dm_internal_token now serves heartcry responses + team replies too — acceptable or rename/scope?); encrypted-class boundary (canned line + admin words, never heartcry content); admin tier + step-up posture for request-info-church; lockout_reason contract amendment shape vs the c.14235 lock; the column GRANT; disclosure implications of rejection-specific copy at the login boundary (Founder ratified the copy — rule on mechanics, not the decision). BE — endpoint composition order + failure postures; optional response_message vs canned-only; Queue.jsx/Heartcry.jsx integration shape; migration sequencing; anything that breaks the mobile contract.
