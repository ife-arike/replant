# Flow-gaps batch — Founder-controlled deploy checklist (2026-07-13)

Everything below is BUILT + committed + test-green; NOTHING is applied to prod. Order matters. Nothing here touches the email estate.

**Branches:**
1. `~/replant` → `feat/flow-gaps-mobile` (commits 981cbb9 gap-2 · 4fdbbbe gap-4 · 314a96d gap-3 migrations · + docs)
2. `~/replant-admin` worktree `.claude/worktrees/flow-gaps` → `feat/flow-gaps-2026-07-13` (4c0b1d0 gap-1 · ffc8eb4 gap-3) — NOT pushed (ASK rule)

## Stage 1 — migrations (apply in this order; all additive; 110002/110003 are live-body-derived and UG-behavior-preserving)

1. `20260713100000_grant_email_notifications_toggle.sql` — one column GRANT (gap 4)
2. `20260713110000_extend_audit_log_check_request_info.sql` — CHECK 84→86 + tripwire
3. `20260713110001_fn_request_info_church.sql`
4. `20260713110002_fn_should_fire_outcome_modal_surface.sql`
5. `20260713110003_fn_send_reply_to_team_surface.sql`
6. `20260713110004_fn_get_request_info_thread_church.sql`
7. `20260713110005_churches_admin_view_request_info_cols.sql`

⚠ If any OTHER session lands an audit_log CHECK migration between now and apply-time, 110000 must be re-derived from live first (its tripwire will catch a clobber, but re-derive rather than trip).

## Stage 2 — edge function

1. Deploy `auth-status-check` (→ v16) **from the `feat/flow-gaps-mobile` checkout of ~/replant** — this branch carries deployed-v15 (KAN-205 self_deleted) + the F4 lockout_reason + Panel-B resolver predicate. Deploying from main or any other branch CLOBBERS v15 (the worktree lesson).
2. `verify_jwt=true` (default; NO --no-verify-jwt).
3. Additive contract: old app builds ignore `lockout_reason` and keep today's generic copy — safe to deploy ahead of the rebuild.

## Stage 3 — admin repo (ASK gate)

1. Greenlight → push `feat/flow-gaps-2026-07-13` + open PR (push implies PR).
2. Netlify preview builds; Founder smokes on preview (test fixtures only — preview functions hit prod DB):
   1. Heartcry: submit as a test leader → dashboard Heartcries → Mark as Responded (type a short message) → mobile My Heartcries flips to RESPONDED + "Open Secure Message" opens the Replant Team thread carrying the message.
   2. Request info: Queue → pending test church → Request info → question ≥10 chars → mobile Home shows banner + modal → reply in app → panel thread shows the leader reply + "Info requested" state clears.
   3. Approve/reject a test church still works (step-up unchanged); any open request-info state clears.
3. Founder merges (preview-first; she merges, never me).
4. Interlock: migrations (Stage 1) MUST be live before this merge — the new endpoints call the new RPCs.

## Stage 4 — mobile app

1. FE changes (rejection lockout copy, Settings → Notifications, AuthProvider) ride the next Expo rebuild — bundle with the already-pending KAN-205/302/304/305 rebuild.
2. Settings toggle needs Stage 1 item 1 applied first (else the write 403s; the UI reverts gracefully, but apply first anyway).
3. Heartcry CTA needs NO mobile change — it lights up as soon as Stage 3 responds to a heartcry.

## Smoke accounts

Per standing rule: ASK which account before testing. Suggested: heartcry flow on +t5 (has heartcry history) or a fresh +t#; request-info needs a PENDING church fixture; rejected-copy check needs a disposable account set rejected via the real reject endpoint (not SQL, so the email + state flow both exercise).

## Explicitly NOT in this batch

1. Gap 5 (leader-only deactivation) — design-only, awaiting Founder ruling: `.claude/plans/2026-07-13-leader-only-deactivation-design.md`.
2. notify_t44 email send — insertion point marked in request-info-church.js; comms track wires the locked body.
3. notify_t19 heartcry-ack email — comms track wires onto the (now-real) first-admin-engagement transition.
4. The canned heartcry response line — PENDING Founder ratification (see report); shipping it as-built requires her explicit yes at the PR gate.
