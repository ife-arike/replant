-- Flow-gaps deploy smoke register — 2026-07-13
-- Fixture: +t6 (ruthjames08+t6@gmail.com) — Founder-designated this pass.
--   users.id    25f142c9-4774-478e-8f61-2fc0afc6ee97 (auth c1075fdf-3763-4d31-a7be-7426e9bdc0d8)
--   churches.id a4674ed4-2911-4bca-9c48-2822f18fc8da (Lighthouse Relief And Development Initiative, para_ministry)
-- Snapshot before pass: user verified/active/notifications-true · church verified,
--   deadline 2026-08-11 (future — no stale-deadline hazard), modal cols NULL/NULL.
-- Everything below was REVERTED to that exact snapshot; final live check confirmed
-- user_vs=verified, is_active=t, email_notifications_enabled=t, church_vs=verified,
-- modal cols NULL/NULL, and auth-status-check → active.

-- ── What was exercised (v16 + the 7 flow-gaps migrations) ──
-- 1. Baseline: auth-status-check → active (no lockout_reason key — omit-when-absent).
-- 2. Gap 4: PATCH own email_notifications_enabled false → true via PostgREST as +t6
--    (both round-trips returned the row); NEGATIVE: PATCH verification_status → 42501
--    (privilege columns still denied; column-scoped grant confirmed non-widening).
-- 3. F4 S1: user→pending + church→rejected → wire carried
--    recovery_path=support_contact + lockout_reason=church_rejected.
-- 4. F4 S2: user→rejected (church still rejected) → lockout_reason=leader_rejected
--    (precedence: more-specific state wins, per SEC Panel A).
-- 5. S3/gap 3: user→verified (restore) + church→pending;
--    fn_request_info_church(church, question, NULL admin, 'flow-gaps-smoke', NULL)
--    → question b0affbc3-77a8-412d-b6d8-fcbecd73111f;
--    fn_should_fire_outcome_modal as +t6 → fire=true kind=request_info + question_text;
--    NEGATIVE: fn_request_info_church as authenticated +t6 → 42501 (SEC blocker live);
--    fn_send_reply_to_team as +t6 → 204; state-clear verified (kind NULL, shown_at set);
--    fn_get_request_info_thread_church → 2 rows (request_info_sent:admin → request_info_reply:leader).
-- 6. RESTORE: church verified + modal cols NULL/NULL (exact snapshot).

-- ── Mutations applied (in order), with their reverts ──
UPDATE public.users SET verification_status='pending'  WHERE id='25f142c9-4774-478e-8f61-2fc0afc6ee97'; -- S1
UPDATE public.churches SET verification_status='rejected' WHERE id='a4674ed4-2911-4bca-9c48-2822f18fc8da'; -- S1
UPDATE public.users SET verification_status='rejected' WHERE id='25f142c9-4774-478e-8f61-2fc0afc6ee97'; -- S2
UPDATE public.users SET verification_status='verified' WHERE id='25f142c9-4774-478e-8f61-2fc0afc6ee97'; -- S3 restore (user)
UPDATE public.churches SET verification_status='pending' WHERE id='a4674ed4-2911-4bca-9c48-2822f18fc8da'; -- S3 (gap-3 leg)
-- + email_notifications_enabled false→true (PostgREST, as +t6, self-row) — net zero.
-- + fn_request_info_church / fn_send_reply_to_team writes (see residue below).
UPDATE public.churches SET verification_status='verified', last_outcome_modal_kind=NULL, last_outcome_modal_shown_at=NULL
  WHERE id='a4674ed4-2911-4bca-9c48-2822f18fc8da'; -- FINAL restore

-- ── Residue deliberately left (append-only store; forensically truthful) ──
-- audit_log rows on church a4674ed4:
--   b0affbc3-77a8-412d-b6d8-fcbecd73111f  request_info_sent  (meta.actor_email='flow-gaps-smoke')
--   + one request_info_reply by +t6 ("Confirmed — we operate from Lagos, Nigeria. (smoke reply)")
-- These are real test artifacts on a test fixture church; audit_log is append-only
-- (never delete). They also serve as the first live rows of the surface
-- request-info thread shape.
