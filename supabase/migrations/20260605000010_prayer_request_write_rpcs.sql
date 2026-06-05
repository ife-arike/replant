-- KAN-23 — Prayer Wall write RPCs for MyOpenPrayersView (Ticket E)
--
-- Purpose:
--   Two SECURITY DEFINER RPCs that back the overflow-menu actions on a
--   leader's own open prayer request:
--     1. create_testimony(uuid, text)        — "Mark as praise": convert an
--        open prayer request into a public testimony and mark the request
--        answered.
--     2. soft_delete_prayer_request(uuid)     — "Delete": remove an open
--        prayer request from the feed WITHOUT hard-deleting (preserves
--        intercession_holds + prayer_request_prayed_by FK integrity).
--
-- Date:   2026-06-05
-- Author: DBA (Replant)
--
-- House pattern (mandatory, mirrors 20260605000001_intercession_journal.sql):
--   SECURITY DEFINER + SET search_path TO '' + fully-qualified table names
--   + caller resolved via auth_id = auth.uid() (NOT id = auth.uid())
--   + REVOKE ALL FROM PUBLIC, anon + GRANT EXECUTE TO authenticated.
--
-- Schema facts driving this design (verified against live DB 2026-06-05):
--   • Testimony table is public.testimony (SINGULAR). Columns:
--       id, church_id, user_id, content, original_request_id (FK ->
--       prayer_requests ON DELETE SET NULL), anonymous, celebrated_count,
--       is_active, created_at. There is NO testimony_text column and NO
--       char-length constraint on content.
--   • prayer_requests already has the soft-delete primitives we need:
--       is_active boolean (get_open_prayers filters is_active = true) and
--       status text CHECK IN ('open','answered','withdrawn'). We reuse these
--       rather than adding a redundant deleted_at column that would conflict
--       with the existing FE/RPC filters.
--   • "Already converted" == a testimony row already references the request
--       via original_request_id.
--   • Underground == churches.type = 'underground'; such testimonies are
--       forced anonymous, matching create_prayer_request's handling.

-- ─── 1. create_testimony(p_request_id uuid, p_testimony_text text) ────────
--
-- A verified leader converts one of their OWN church's open prayer requests
-- into a public testimony, then the request is marked answered so it leaves
-- the open feed. Underground churches always produce anonymous testimonies.

-- SEC fix (2026-06-05): a STALE 3-arg overload exists on live DB
--   public.create_testimony(p_prayer_request_id uuid, p_content text, p_anonymous boolean)
-- with a broken auth path (it resolves the caller via `WHERE id = auth.uid()`,
-- but in Replant public.users.id != auth.uid() — see feedback_stand_in_the_gap_fix).
-- That overload is unused (no FE call site; only a TODO stub) and broken, yet it
-- is GRANTed to authenticated. Because CREATE OR REPLACE matches on signature,
-- creating the 2-arg version below would leave BOTH overloads present, causing
-- PostgREST RPC ambiguity and leaving a mis-authed SECURITY DEFINER function
-- callable. Drop the stale overload explicitly before defining the correct one.
DROP FUNCTION IF EXISTS public.create_testimony(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.create_testimony(
  p_request_id     uuid,
  p_testimony_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id       uuid := auth.uid();
  v_caller_id     uuid;   -- public.users.id (NOT auth.uid())
  v_caller_church uuid;
  v_req_church    uuid;
  v_req_status    text;
  v_req_active    boolean;
  v_church_type   text;
  v_anonymous     boolean;
  v_trimmed       text;
  v_new_id        uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Resolve caller via auth_id; gate on active + verified.
  SELECT u.id, u.church_id, u.anonymous
  INTO   v_caller_id, v_caller_church, v_anonymous
  FROM public.users u
  WHERE u.auth_id = v_auth_id
    AND u.is_active = true
    AND u.verification_status = 'verified'
  LIMIT 1;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_verified');
  END IF;

  -- Validate testimony content (mirror create_prayer_request limits).
  v_trimmed := trim(COALESCE(p_testimony_text, ''));
  IF v_trimmed = '' THEN
    RETURN jsonb_build_object('error', 'content_required');
  END IF;
  IF char_length(v_trimmed) > 300 THEN
    RETURN jsonb_build_object('error', 'content_too_long');
  END IF;

  -- Look up the request (must exist).
  SELECT pr.church_id, pr.status, pr.is_active
  INTO   v_req_church, v_req_status, v_req_active
  FROM public.prayer_requests pr
  WHERE pr.id = p_request_id;

  IF v_req_church IS NULL THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  -- Ownership: the request must belong to the caller's church.
  IF v_req_church IS DISTINCT FROM v_caller_church THEN
    RETURN jsonb_build_object('error', 'not_your_request');
  END IF;

  -- A withdrawn/inactive request is no longer eligible — treat as not found
  -- so the FE doesn't resurrect a deleted card into a testimony.
  IF v_req_active = false OR v_req_status = 'withdrawn' THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  -- Already converted: a testimony already references this request, OR the
  -- request is already marked answered.
  IF v_req_status = 'answered'
     OR EXISTS (
       SELECT 1 FROM public.testimony t
       WHERE t.original_request_id = p_request_id
     )
  THEN
    RETURN jsonb_build_object('error', 'already_converted');
  END IF;

  -- Underground churches always publish anonymously, overriding the leader's
  -- stored preference. Otherwise inherit users.anonymous.
  SELECT c.type::text INTO v_church_type
  FROM public.churches c
  WHERE c.id = v_caller_church;

  IF v_church_type = 'underground' THEN
    v_anonymous := true;
  ELSE
    v_anonymous := COALESCE(v_anonymous, false);
  END IF;

  -- Create the testimony, linked back to the originating request.
  INSERT INTO public.testimony (
    church_id, user_id, content, original_request_id, anonymous
  ) VALUES (
    v_caller_church, v_caller_id, v_trimmed, p_request_id, v_anonymous
  )
  RETURNING id INTO v_new_id;

  -- Mark the request answered so it drops out of the open feed. We keep the
  -- row (and is_active = true) so the testimony's original_request_id FK and
  -- any intercession history remain resolvable.
  UPDATE public.prayer_requests
  SET status = 'answered'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('action', 'created', 'testimony_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_testimony(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_testimony(uuid, text) TO authenticated;

-- ─── 2. soft_delete_prayer_request(p_request_id uuid) ────────────────────
--
-- A leader removes one of their OWN church's open prayer requests from the
-- feed. Soft delete only: we set is_active = false and status = 'withdrawn'.
-- We never DELETE the row because intercession_holds and
-- prayer_request_prayed_by reference prayer_requests; hard-deleting would
-- destroy the record of who stood in the gap.

-- SEC fix (2026-06-05): existing live function uses parameter name
-- p_prayer_request_id; CREATE OR REPLACE cannot rename input parameters.
-- Drop and recreate to fix the parameter name and add audit parity.
DROP FUNCTION IF EXISTS public.soft_delete_prayer_request(uuid);

CREATE OR REPLACE FUNCTION public.soft_delete_prayer_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_id       uuid := auth.uid();
  v_caller_id     uuid;   -- public.users.id (NOT auth.uid())
  v_caller_church uuid;
  v_req_church    uuid;
  v_req_active    boolean;
  v_req_status    text;
  v_req_anonymous boolean;
  v_req_prayed    integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT u.id, u.church_id
  INTO   v_caller_id, v_caller_church
  FROM public.users u
  WHERE u.auth_id = v_auth_id
    AND u.is_active = true
  LIMIT 1;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT pr.church_id, pr.is_active, pr.status, pr.anonymous, pr.prayed_count
  INTO   v_req_church, v_req_active, v_req_status, v_req_anonymous, v_req_prayed
  FROM public.prayer_requests pr
  WHERE pr.id = p_request_id;

  IF v_req_church IS NULL THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  -- Ownership: church-scoped (any active leader of the owning church may
  -- remove the request from their church's feed).
  IF v_req_church IS DISTINCT FROM v_caller_church THEN
    RETURN jsonb_build_object('error', 'not_your_request');
  END IF;

  IF v_req_active = false OR v_req_status = 'withdrawn' THEN
    RETURN jsonb_build_object('error', 'already_deleted');
  END IF;

  -- Soft delete: drop from the feed, preserve the row + all FK references.
  UPDATE public.prayer_requests
  SET is_active = false,
      status    = 'withdrawn'
  WHERE id = p_request_id;

  -- Audit (canonical action 'prayer_request_withdrawn'). The prior live version
  -- of this function recorded every withdrawal to the append-only audit_log;
  -- this replacement MUST preserve that record to avoid a compliance regression.
  -- accessed_by is the public.users.id (resolved via auth_id), triggered_by 'user'.
  INSERT INTO public.audit_log (accessed_by, action, triggered_by, church_id, meta)
  VALUES (
    v_caller_id,
    'prayer_request_withdrawn',
    'user',
    v_caller_church,
    jsonb_build_object(
      'prayer_request_id',          p_request_id,
      'was_anonymous',              v_req_anonymous,
      'prayed_count_at_withdrawal', v_req_prayed,
      'withdrawn_by',               v_caller_id,
      'request_church_id',          v_req_church
    )
  );

  RETURN jsonb_build_object('action', 'deleted');
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_prayer_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_prayer_request(uuid) TO authenticated;
