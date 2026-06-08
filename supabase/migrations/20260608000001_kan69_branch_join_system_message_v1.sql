-- KAN-69 Branch join system message v1
--
-- When a leader accepts a branch invitation (respond_to_branch_invite
-- called with p_response='joined'), insert a system message into the
-- branch thread so the conversation shows a durable, human-readable
-- record of consent: "Grace Community joined this branch."
--
-- WHY a message row (not just the existing 'branch_invite_responded'
-- audit_log entry): the audit_log is admin-facing and leader-opaque
-- (KAN-70). The branch thread is the leaders' shared surface. A system
-- message gives the gathered ministries a visible, in-context record of
-- who consented and when — reinforcing the consent covenant between
-- church leaders rather than burying it in an admin-only log.
--
-- WHAT CHANGED vs 20260529000001 (Migration 2 of 3):
--   * Added a fail-open system-message INSERT block immediately after the
--     `UPDATE branch_members SET consent_status = p_response` statement,
--     gated on `p_response = 'joined'`. Nothing else in the function body
--     is altered: the activation gate, both audit_log writes, the caller
--     gate, and the return value are byte-for-byte the original.
--
-- SHAPE of the inserted row (satisfies message_belongs_to_one):
--   sender_id       = system user 028be745-8014-4314-a7cf-36b0a4d52b46
--   branch_id       = p_branch_id           (NOT NULL → branch arm)
--   conversation_id = NULL (default)         ─┐ both NULL → the row lands
--   receiver_id     = NULL (default)         ─┘ on the branch arm of the
--                                              3-way exclusivity CHECK.
--   content         = '<ministry> joined this branch.'
--   is_active       = true (default)         → visible to get_branch_*
--   flagged         = false (default)        → not in moderation queue
--   no_self_message: receiver_id IS NULL ⇒ CHECK passes vacuously.
--
-- FAIL-OPEN POSTURE: the consent UPDATE is the load-bearing covenant
-- write. If the system user row is ever missing/deactivated, or the
-- INSERT fails for any reason, we MUST NOT roll back the consent
-- decision. The INSERT is wrapped in a nested BEGIN/EXCEPTION sub-block
-- that swallows any error (consent recorded, no message shown — strictly
-- better than consent lost). This is the one place we deliberately
-- absorb an exception; everywhere else in this function continues to
-- propagate (e.g. the audit_log writes are NOT wrapped, by design).
--
-- NOT CHANGED: no table schema, constraints, grants, RLS policies, or
-- audit_log actions. The system message is written ONLY to public.messages
-- — it is not an audit_log event, so audit_log_action_check is untouched.
--
-- SECURITY: unchanged — SECURITY DEFINER + SET search_path = '' means the
-- INSERT runs as the function owner with RLS bypassed, exactly as the
-- existing audit_log INSERTs in this same function already do. The
-- messages table has no INSERT policy for `authenticated`; this RPC
-- remains the authorized write path.
--
-- Anchored by KAN-69.

BEGIN;

CREATE OR REPLACE FUNCTION public.respond_to_branch_invite(
  p_branch_id uuid,
  p_response  text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id      uuid;
  v_pending_count  int;
  v_new_status     text;
BEGIN
  IF p_response NOT IN ('joined', 'declined') THEN
    RAISE EXCEPTION 'invalid_response';
  END IF;

  SELECT id INTO v_caller_id
  FROM public.users
  WHERE auth_id = auth.uid()
    AND is_active = true
    AND verification_status = 'verified';
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Must have an open invitation. Already-joined / already-declined
  -- rows are idempotent no-ops at the FE — but at the RPC layer we
  -- reject them so a stale FE doesn't silently overwrite a consent
  -- decision the leader already made.
  IF NOT EXISTS (
    SELECT 1 FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND user_id   = v_caller_id
      AND consent_status = 'invited'
  ) THEN
    RAISE EXCEPTION 'not_invited';
  END IF;

  UPDATE public.branch_members
  SET consent_status = p_response,
      consented_at   = now()
  WHERE branch_id = p_branch_id
    AND user_id   = v_caller_id;

  -- ─── KAN-69: system message on join (fail-open) ──────────────────
  -- Post the "<ministry> joined this branch." notification into the
  -- thread. Wrapped so any failure here NEVER rolls back the consent
  -- UPDATE above — recording consent is the covenant; the notification
  -- is a courtesy. On error we degrade silently (no message shown).
  IF p_response = 'joined' THEN
    DECLARE
      v_system_user_id constant uuid := '028be745-8014-4314-a7cf-36b0a4d52b46';
      v_ministry_name  text;
    BEGIN
      -- Ministry name snapshot taken from THIS branch_members row
      -- (ministry_id is denormalized at invite time), so a leader who
      -- later changes church doesn't rewrite the consent record.
      SELECT c.name
        INTO v_ministry_name
      FROM public.branch_members bm
      JOIN public.churches c ON c.id = bm.ministry_id
      WHERE bm.branch_id = p_branch_id
        AND bm.user_id   = v_caller_id;

      INSERT INTO public.messages (sender_id, branch_id, content)
      VALUES (
        v_system_user_id,
        p_branch_id,
        COALESCE(v_ministry_name, 'A ministry') || ' joined this branch.'
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Swallow: consent already recorded above. Notification is
        -- best-effort. (Missing/inactive system user, FK violation,
        -- etc. all land here without disturbing the transaction's
        -- covenant-critical work.)
        NULL;
    END;
  END IF;
  -- ─────────────────────────────────────────────────────────────────

  -- Activation gate: only triggers on 'joined' (a decline can't unlock
  -- a branch). Counts all rows whose consent_status is NOT joined; if
  -- zero, every member is in.
  IF p_response = 'joined' THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM public.branch_members
    WHERE branch_id = p_branch_id
      AND consent_status <> 'joined';
    IF v_pending_count = 0 THEN
      UPDATE public.branches SET status = 'active' WHERE id = p_branch_id;
      INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
      VALUES (
        'branch_activated', v_caller_id, 'user',
        jsonb_build_object('branch_id', p_branch_id, 'cause', 'final_consent')
      );
    END IF;
  END IF;

  SELECT status INTO v_new_status
  FROM public.branches WHERE id = p_branch_id;

  INSERT INTO public.audit_log (action, accessed_by, triggered_by, meta)
  VALUES (
    'branch_invite_responded', v_caller_id, 'user',
    jsonb_build_object(
      'branch_id',               p_branch_id,
      'response',                p_response,
      'resulting_branch_status', v_new_status
    )
  );

  RETURN v_new_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.respond_to_branch_invite(uuid, text) TO authenticated;

COMMIT;
